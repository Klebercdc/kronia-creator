import { useEffect } from "react";

/**
 * Porte 1:1 de `agenda-/js/mobile-core.js` (`mobAtualizarAlturaReal`,
 * `mobDecidirMedidasDoViewport`, `mobMarcarTeclado`, `mobObservarTeclado`,
 * `mobTravarEixoHorizontal` — commit `f4cf4ff` e o que veio depois dele) +
 * `agenda-/js/mobile-bootstrap.js` (os listeners). Mesmo raciocínio, mesmos
 * números — só o alvo da escrita mudou de `document.documentElement` /
 * `#mobileRoot` fixo por id para as duas variáveis (`--vh`, `--vv-top`) que
 * `:root` e `#root` já esperam em styles.css.
 *
 * O QUE ISTO RESOLVE (e o CSS sozinho não resolve):
 *
 * 1. TAMANHO. Com o teclado do iOS aberto, `window.innerHeight` continua
 *    sendo a tela inteira — quem encolhe é `visualViewport.height`. Sem medir
 *    isso, o app fica com a altura da tela cheia e sobra espaço por baixo do
 *    teclado (a barra de navegação flutuando no meio da tela).
 * 2. POSIÇÃO. Ao focar um campo, o Safari empurra o viewport VISUAL pra
 *    trazer o campo pra cima do teclado — mesmo com html/body em
 *    position:fixed (ver styles.css), que só zera a área ROLÁVEL do
 *    documento. `window.scrollY` continua 0 nesse caminho, então não tem
 *    scroll pra desfazer: o que sobra é compensar com `translateY` a mesma
 *    distância que `visualViewport.offsetTop` andou.
 *
 * NÃO PORTADO: a checagem de atualização (`mobChecarAtualizacaoSilenciosa`) —
 * é PWA de outro projeto, sem equivalente aqui ainda.
 */

const TOLERANCIA_ALTURA = 60;
const TOLERANCIA_DESLOC = 2;

interface EstadoViewport {
  altura: number;
  offsetTop: number;
  semZoom: boolean;
  teclado: boolean;
  vhAplicado: number | null;
  vvTopAplicado: number | null;
}

interface DecisaoViewport {
  vh: number | null;
  vvTop: number | null;
}

/** Decide O QUE precisa ser reescrito, sem tocar em nada — separado da
 * função que escreve pra ficar testável sem visualViewport nenhum. */
function decidirMedidas(estado: EstadoViewport): DecisaoViewport {
  const saida: DecisaoViewport = { vh: null, vvTop: null };
  const limite = estado.teclado ? TOLERANCIA_ALTURA : 1;
  if (estado.vhAplicado === null || Math.abs(estado.altura - estado.vhAplicado) >= limite) {
    saida.vh = estado.altura;
  }
  const desloc = estado.semZoom && estado.teclado ? Math.round(estado.offsetTop) : 0;
  // Voltar pro zero sempre passa: é o que desfaz o empurrão quando o teclado
  // fecha, e deixá-lo pela metade deixaria o app deslocado pra sempre.
  const zerando = desloc === 0 && estado.vvTopAplicado !== 0;
  if (
    estado.vvTopAplicado === null ||
    zerando ||
    Math.abs(desloc - estado.vvTopAplicado) >= TOLERANCIA_DESLOC
  ) {
    saida.vvTop = desloc;
  }
  return saida;
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
 * componente raiz — os efeitos (atributo em `<html>`, variáveis CSS em
 * `:root`) são globais por natureza, então um único listener cobre qualquer
 * tela.
 */
export function useViewportKeyboardLock() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const raiz = document.documentElement;
    let vhAplicado: number | null = null;
    let vvTopAplicado: number | null = null;
    let quadroAgendado = false;

    function escreverMedidas() {
      const vv = window.visualViewport;
      const semZoom = !!vv && vv.scale <= 1.01;
      const altura = semZoom && vv ? vv.height : window.innerHeight;
      const decisao = decidirMedidas({
        altura,
        offsetTop: vv ? vv.offsetTop : 0,
        semZoom,
        teclado: raiz.hasAttribute("data-teclado"),
        vhAplicado,
        vvTopAplicado,
      });
      if (decisao.vh !== null) {
        raiz.style.setProperty("--vh", decisao.vh * 0.01 + "px");
        vhAplicado = decisao.vh;
      }
      if (decisao.vvTop !== null) {
        raiz.style.setProperty("--vv-top", decisao.vvTop + "px");
        vvTopAplicado = decisao.vvTop;
      }
    }

    function atualizarAlturaReal() {
      if (quadroAgendado) return;
      quadroAgendado = true;
      requestAnimationFrame(() => {
        quadroAgendado = false;
        escreverMedidas();
      });
    }

    // Só marca — NÃO mede aqui. Quem mede é o evento real de
    // visualViewport (resize/scroll), disparado pelo próprio teclado
    // animando; medir no foco mediria a altura de ANTES do teclado mudar
    // nada. "Reforço que só erra pra um lado é pior que reforço nenhum" —
    // mesmo comentário de agenda-/js/mobile-core.js.
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

    escreverMedidas();
    window.addEventListener("resize", atualizarAlturaReal);
    window.addEventListener("orientationchange", () => setTimeout(atualizarAlturaReal, 100));
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", atualizarAlturaReal);
      // 'scroll' também, não só 'resize': o teclado muda o TAMANHO do
      // viewport visual (resize) e a POSIÇÃO dele (scroll) em eventos
      // diferentes. Só o resize deixava o app do tamanho certo e deslocado.
      window.visualViewport.addEventListener("scroll", atualizarAlturaReal);
    }
    if (toque) {
      document.addEventListener("focusin", aoFocar);
      document.addEventListener("focusout", aoDesfocar);
    }
    // Fase de captura porque scroll não borbulha; um listener só no
    // documento cobre qualquer caixa do app, presente ou futura.
    document.addEventListener("scroll", aoRolar, { capture: true, passive: true });

    return () => {
      window.removeEventListener("resize", atualizarAlturaReal);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", atualizarAlturaReal);
        window.visualViewport.removeEventListener("scroll", atualizarAlturaReal);
      }
      document.removeEventListener("focusin", aoFocar);
      document.removeEventListener("focusout", aoDesfocar);
      document.removeEventListener("scroll", aoRolar, { capture: true });
    };
  }, []);
}
