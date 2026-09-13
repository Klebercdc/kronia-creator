import { useEffect, useRef } from "react";

/**
 * Motor de mola do menu lateral — porte 1:1 da física de
 * `agenda-/js/mobile-core.js` (`mobMenuMola`, commit anterior a `07f879a`,
 * que removeu o menu de lá). Mesmos números, mesma forma de curva — só o
 * alvo da pintura mudou de `getElementById` pra refs do React.
 *
 * NÃO é uma transição CSS: é massa-mola-amortecedor integrada por passo
 * fixo (1/240s), parametrizada como o SwiftUI faz (resposta + fração de
 * amortecimento), alimentada por uma rampa em S de duração finita (não um
 * alvo que salta) — é isso que dá o "peso" da abertura em vez de um
 * deslizar mecânico. Ver o histórico do arquivo original pra todo o
 * raciocínio de calibração por trás destes números; aqui só a mecânica.
 */

const RESPOSTA = 0.14;
const AMORT = 0.76;
const RAMPA = 0.17; // s — duração da rampa em S no percurso inteiro
const W = (2 * Math.PI) / RESPOSTA;
const K = W * W;
const C = 2 * AMORT * W;
const PASSO = 1 / 240; // s
const DT_MAX = 0.064; // s
const PARADO_P = 0.001;
const PARADO_V = 0.012;

const SUBIDA = 0.18; // fração da fase gasta acelerando
const DESCIDA = 0.28; // fração gasta desacelerando
const CRUZEIRO = 1 - SUBIDA - DESCIDA;
const NORMA = 1 - (SUBIDA + DESCIDA) / 2;

function suavizar(x: number): number {
  return x * x * x * (x * (x * 6 - 15) + 10);
}
function intSuavizar(x: number): number {
  return x * x * x * x * (x * x - 3 * x + 2.5);
}
function velNorm(u: number): number {
  if (u < SUBIDA) return suavizar(u / SUBIDA);
  if (u > 1 - DESCIDA) return suavizar((1 - u) / DESCIDA);
  return 1;
}
function suave(u: number): number {
  let a: number;
  if (u < SUBIDA) a = SUBIDA * intSuavizar(u / SUBIDA);
  else if (u <= 1 - DESCIDA) a = SUBIDA * 0.5 + (u - SUBIDA);
  else a = SUBIDA * 0.5 + CRUZEIRO + DESCIDA * (0.5 - intSuavizar((1 - u) / DESCIDA));
  return a / NORMA;
}
function suaveDeriv(u: number): number {
  return velNorm(u) / NORMA;
}

export interface MenuSpringLayers {
  app: HTMLElement;
  menu: HTMLElement;
  sombra: HTMLElement;
  veu: HTMLElement;
}

/** Deslocamento real em px — min(300px, 82vw), igual ao CSS original
 * (`--mob-menu-desloca`), pra nunca deixar o app sem nenhuma fatia de tela
 * pra tocar de volta num aparelho estreito. */
function desloca(): number {
  if (typeof window === "undefined") return 300;
  return Math.min(300, window.innerWidth * 0.82);
}

/** Único lugar que sabe como o menu se parece num dado ponto do caminho
 * (p: 0 fechado, 1 aberto, pode passar de 1 no overshoot). */
function pintar(c: MenuSpringLayers, p: number) {
  const d = desloca();
  const pv = Math.max(0, p);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const px = Math.round(d * pv * dpr) / dpr;
  const t = `translate3d(${px}px,0,0)`;
  c.app.style.transform = t;
  c.app.style.borderRadius = (30 * Math.min(pv, 1)).toFixed(2) + "px";
  c.sombra.style.transform = t;
  c.sombra.style.opacity = Math.min(pv, 1).toFixed(3);
  c.menu.style.transform = `translate3d(${(-24 * (1 - Math.min(pv, 1))).toFixed(2)}px,0,0)`;
  c.veu.style.opacity = (1 - 0.82 * Math.min(pv, 1)).toFixed(3);
}

function limpar(c: MenuSpringLayers) {
  c.app.style.transform = "";
  c.app.style.borderRadius = "";
  c.sombra.style.transform = "";
  c.sombra.style.opacity = "";
  c.menu.style.transform = "";
  c.veu.style.opacity = "";
}

interface SpringHandle {
  ir(alvo: number): void;
}

function createSpring(getLayers: () => MenuSpringLayers | null): SpringHandle {
  let p = 0;
  let v = 0;
  let alvo = 0;
  let raf = 0;
  let ultimo = 0;
  let rampaDe = 0;
  let rampaT = 0;
  let rampaDur = 0;

  function assentar(c: MenuSpringLayers | null) {
    p = alvo;
    v = 0;
    raf = 0;
    rampaT = rampaDur;
    if (c) limpar(c);
  }

  function quadro(agora: number) {
    const c = getLayers();
    if (!c) {
      raf = 0;
      return;
    }
    let dt = Math.min((agora - ultimo) / 1000, DT_MAX);
    ultimo = agora;
    for (let t = 0; t < dt; t += PASSO) {
      const h = Math.min(PASSO, dt - t);
      rampaT = Math.min(rampaT + h, rampaDur);
      const puxa = rampaDur > 0 ? rampaDe + (alvo - rampaDe) * suave(rampaT / rampaDur) : alvo;
      v += (-K * (p - puxa) - C * v) * h;
      p += v * h;
    }
    if (rampaT >= rampaDur && Math.abs(p - alvo) < PARADO_P && Math.abs(v) < PARADO_V) {
      assentar(c);
      return;
    }
    pintar(c, p);
    raf = requestAnimationFrame(quadro);
  }

  return {
    ir(novoAlvo: number) {
      alvo = novoAlvo;
      const c = getLayers();
      if (!c) return;

      rampaDe = p;
      rampaT = 0;
      rampaDur = RAMPA * Math.abs(alvo - p);

      const rumo = (alvo - rampaDe) * v;
      const vao = Math.abs(alvo - rampaDe);
      if (rampaDur > 0 && rumo > 0 && vao > 1e-6) {
        const velAlvo = (Math.abs(v) * rampaDur) / vao;
        const dianteira = (C * Math.abs(v)) / K / vao;
        let achou = false;
        for (let i = 1; i <= 108; i++) {
          const u = i / 120;
          if (suaveDeriv(u) >= velAlvo && suave(u) >= dianteira) {
            rampaT = u * rampaDur;
            achou = true;
            break;
          }
        }
        if (!achou) rampaT = SUBIDA * rampaDur;
      }

      const jaLa = !raf && Math.abs(p - alvo) < PARADO_P && Math.abs(v) < PARADO_V;
      if (jaLa) {
        if (c.app.style.transform) assentar(c);
        return;
      }
      if (!raf) {
        pintar(c, p);
        ultimo = performance.now();
        raf = requestAnimationFrame(quadro);
      }
    },
  };
}

/**
 * Hook — chame com o estado aberto/fechado e refs pras 4 camadas
 * (app/menu/sombra/veu). A mola persegue `open` toda vez que ele muda,
 * exatamente como `mobSincronizarMenuLateral` chamava `mobMenuMola.ir()`.
 */
export function useMenuSpring(
  open: boolean,
  refs: {
    app: React.RefObject<HTMLElement | null>;
    menu: React.RefObject<HTMLElement | null>;
    sombra: React.RefObject<HTMLElement | null>;
    veu: React.RefObject<HTMLElement | null>;
  },
) {
  const springRef = useRef<SpringHandle | null>(null);
  if (!springRef.current) {
    springRef.current = createSpring(() => {
      const { app, menu, sombra, veu } = refs;
      return app.current && menu.current && sombra.current && veu.current
        ? { app: app.current, menu: menu.current, sombra: sombra.current, veu: veu.current }
        : null;
    });
  }

  useEffect(() => {
    springRef.current?.ir(open ? 1 : 0);
  }, [open]);
}
