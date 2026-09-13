import { useEffect } from "react";

/**
 * Porte de `agenda-/js/mobile-core.js` (`mobAtualizarAlturaReal`,
 * `mobDecidirMedidasDoViewport`, `mobMarcarTeclado`, `mobObservarTeclado`,
 * `mobTravarEixoHorizontal` — commit `f4cf4ff` e o que veio depois dele) +
 * `agenda-/js/mobile-bootstrap.js` (os listeners). Só o alvo da escrita
 * mudou de `document.documentElement`/`#mobileRoot` fixo por id para a
 * variável `--vh` que `:root`/`#root` já esperam em styles.css.
 *
 * O QUE ISTO RESOLVE (e o CSS sozinho não resolve):
 *
 * TAMANHO. Com o teclado do iOS aberto, `window.innerHeight` continua
 * sendo a tela inteira — quem encolhe é `visualViewport.height`. Sem medir
 * isso, o app fica com a altura da tela cheia e sobra espaço por baixo do
 * teclado (a barra de navegação flutuando no meio da tela).
 *
 * NÃO PORTADO (removido depois de testar no device real):
 * - `--vv-top`/`translateY` (compensação de POSIÇÃO via
 *   `visualViewport.offsetTop`). Calibrada pro empurrão do Safari normal,
 *   mas no WKWebView standalone real testado (iPhone 15 Pro Max instalado
 *   na tela de início) ela sobrepunha o cabeçalho na barra de status ao
 *   abrir o teclado — piorava a posição em vez de corrigi-la. --vh sozinho
 *   já resolve o tamanho; sem a compensação de posição sobra o layout
 *   original, sem overcorrection.
 * - a checagem de atualização (`mobChecarAtualizacaoSilenciosa`) — é PWA
 *   de outro projeto, sem equivalente aqui ainda.
 *
 * ADICIONADO (não existe em agenda-): detecção de teclado por ALTURA, além
 * da detecção por foco. A detecção por foco depende de
 * matchMedia('(pointer: coarse)') pra não atrapalhar desktop — testado no
 * device real, sintomas (saudação não centraliza no espaço acima do
 * teclado, cabeçalho se comporta errado) batem com data-teclado nunca
 * ligando de verdade nesse WKWebView específico, então a altura serve de
 * rede de segurança independente: se o visualViewport encolher bem mais
 * que o normal, é teclado, ponto — não importa se o foco foi detectado.
 */

const TOLERANCIA_ALTURA = 60;
/** Encolhimento mínimo (px) do visualViewport pra considerar "teclado
 * aberto" por altura — bem maior que TOLERANCIA_ALTURA (que é sobre
 * ruído de medida) porque aqui é sobre o teclado de verdade, que tira
 * várias centenas de pixels de altura útil. */
const LIMIAR_TECLADO_POR_ALTURA = 150;

interface EstadoViewport {
  altura: number;
  teclado: boolean;
  vhAplicado: number | null;
}

/** Decide SE precisa reescrever --vh, sem tocar em nada — separado da
 * função que escreve pra ficar testável sem visualViewport nenhum. */
function decidirAltura(estado: EstadoViewport): number | null {
  const limite = estado.teclado ? TOLERANCIA_ALTURA : 1;
  if (estado.vhAplicado === null || Math.abs(estado.altura - estado.vhAplicado) >= limite) {
    return estado.altura;
  }
  return null;
}

const CAMPOS_DE_TEXTO = ["INPUT", "TEXTAREA"];
function ehCampoDeTexto(el: Element | null): boolean {
  return !!el && CAMPOS_DE_TEXTO.indexOf(el.tagName) !== -1;
}

/** Caixas que rolam o próprio conteúdo na horizontal DE PROPÓSITO (tiras de
 * filtro, tabelas) e não podem ter o scrollLeft zerado por baixo delas. */
const CAIXAS_QUE_ROLAM_TEXTO = ["INPUT", "TEXTAREA", "SELECT"];

/**
 * Ativa a trava de teclado/viewport pro app inteiro. Chame uma vez, no
 * componente raiz — os efeitos (atributo em `<html>`, variável CSS em
 * `:root`) são globais por natureza, então um único listener cobre qualquer
 * tela.
 */
export function useViewportKeyboardLock() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raiz = document.documentElement;
    let vhAplicado: number | null = null;
    let quadroAgendado = false;
    // Maior altura já vista sem teclado — atualizada só fora do teclado,
    // então acompanha rotação de tela sem precisar de lógica própria pra
    // isso (uma orientação nova simplesmente vira o novo teto na próxima
    // medida sem teclado).
    let alturaCheia: number | null = null;

    function escreverAltura() {
      const vv = window.visualViewport;
      const semZoom = !!vv && vv.scale <= 1.01;
      const altura = semZoom && vv ? vv.height : window.innerHeight;
      const teclado = raiz.hasAttribute("data-teclado");

      // Detecção por altura — ver comentário no topo do arquivo. Roda
      // ANTES de decidir o --vh, pra já usar o data-teclado atualizado
      // (a tolerância de decidirAltura muda conforme teclado ou não).
      if (!teclado) {
        alturaCheia = alturaCheia === null ? altura : Math.max(alturaCheia, altura);
      } else if (alturaCheia !== null && altura >= alturaCheia - TOLERANCIA_ALTURA) {
        // Voltou perto da altura cheia com data-teclado ainda ligado (por
        // foco) — realinha o teto pra não ficar preso num valor de uma
        // sessão de teclado anterior.
        alturaCheia = altura;
      }
      if (alturaCheia !== null && alturaCheia - altura >= LIMIAR_TECLADO_POR_ALTURA) {
        marcarTeclado(true);
      } else if (teclado && alturaCheia !== null && alturaCheia - altura < TOLERANCIA_ALTURA) {
        marcarTeclado(false);
      }

      const novoVh = decidirAltura({
        altura,
        teclado: raiz.hasAttribute("data-teclado"),
        vhAplicado,
      });
      if (novoVh !== null) {
        raiz.style.setProperty("--vh", novoVh * 0.01 + "px");
        vhAplicado = novoVh;
      }
    }

    function atualizarAlturaReal() {
      if (quadroAgendado) return;
      quadroAgendado = true;
      requestAnimationFrame(() => {
        quadroAgendado = false;
        escreverAltura();
      });
    }

    // Só marca — NÃO mede aqui. Quem mede é o evento real de
    // visualViewport (resize), disparado pelo próprio teclado animando;
    // medir no foco mediria a altura de ANTES do teclado mudar nada.
    // "Reforço que só erra pra um lado é pior que reforço nenhum" — mesmo
    // comentário de agenda-/js/mobile-core.js.
    function marcarTeclado(aberto: boolean) {
      raiz.toggleAttribute("data-teclado", aberto);
    }

    function aoFocar(e: FocusEvent) {
      if (ehCampoDeTexto(e.target as Element)) marcarTeclado(true);
    }
    function aoDesfocar() {
      // Próximo quadro: entre sair de um campo e entrar no seguinte existe um
      // instante sem foco nenhum, e reagir nele faria a UI piscar ao pular de
      // campo em campo.
      setTimeout(() => {
        if (!ehCampoDeTexto(document.activeElement)) marcarTeclado(false);
      }, 0);
    }

    function aoRolar(e: Event) {
      const el = e.target;
      if (!(el instanceof HTMLElement) || !el.scrollLeft) return;
      if (CAIXAS_QUE_ROLAM_TEXTO.indexOf(el.tagName) !== -1) return;
      if (el.isContentEditable) return;
      const overflowX = window.getComputedStyle(el).overflowX;
      if (overflowX === "hidden") el.scrollLeft = 0;
    }

    const toque = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

    escreverAltura();
    window.addEventListener("resize", atualizarAlturaReal);
    window.addEventListener("orientationchange", () => setTimeout(atualizarAlturaReal, 100));
    window.visualViewport?.addEventListener("resize", atualizarAlturaReal);
    if (toque) {
      document.addEventListener("focusin", aoFocar);
      document.addEventListener("focusout", aoDesfocar);
    }
    // Fase de captura porque scroll não borbulha; um listener só no
    // documento cobre qualquer caixa do app, presente ou futura.
    document.addEventListener("scroll", aoRolar, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", atualizarAlturaReal);
      window.visualViewport?.removeEventListener("resize", atualizarAlturaReal);
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", aoDesfocar);
      document.removeEventListener("scroll", aoRolar, { capture: true });
    };
  }, []);
}
