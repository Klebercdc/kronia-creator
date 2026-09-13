/**
 * Tema claro/escuro — porte do mecanismo de agenda-/js/mobile-core.js
 * (mob.tema + mobSetTema): toggle manual persistido em localStorage, nunca
 * segue prefers-color-scheme do sistema. O valor é lido/aplicado num
 * <script> inline em __root.tsx ANTES do primeiro paint (ver lá o porquê:
 * sem isso, a página nasceria clara e trocaria pra escura visivelmente).
 */
export type Tema = "claro" | "escuro";

const CHAVE = "kronia-tema";

export function getStoredTema(): Tema {
  if (typeof window === "undefined") return "claro";
  return window.localStorage.getItem(CHAVE) === "escuro" ? "escuro" : "claro";
}

export function setStoredTema(tema: Tema): void {
  window.localStorage.setItem(CHAVE, tema);
  document.documentElement.setAttribute("data-theme", tema);
}

/** Script inline aplicado no <head>, antes de qualquer paint — mesma
 * técnica de agenda- (`document.documentElement.setAttribute('data-theme',
 * mob.tema)` rodava antes do primeiro mobRender). Sem isto a página sempre
 * nasceria no tema claro do :root e só trocaria pro escuro depois que o
 * React hidratasse, o que pisca visivelmente pra quem usa escuro. */
export const TEMA_ANTI_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(CHAVE)})==="escuro"?"escuro":"claro";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
