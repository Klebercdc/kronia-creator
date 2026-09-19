/**
 * Fórmulas de fala dos 5 blocos do gerador de Blocos de venda — fonte
 * única, usada tanto pelo componente (BlocosVendaGenerator.tsx, pra
 * mostrar os alertas de "passa de 10s") quanto pela geração por IA
 * (blocos-venda-vision.ts, pra IMPEDIR que o texto já saia estourado em
 * vez de só avisar depois). Antes esse cálculo só existia no componente —
 * a IA gerava sem saber do limite real, por isso passava e o usuário só
 * descobria pelo alerta.
 */

export interface BlocosVendaFieldsLike {
  publico: string;
  valores: string;
  produto: string;
  funcao: string;
  dor: string;
  fato: string;
  proposito: string;
  local: string;
}

export function clean(s: string): string {
  return String(s || "").trim().replace(/[.…\s]+$/, "");
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => w && w !== "…").length;
}

/** Mesma fórmula usada no componente: ritmo de fala de ~2,1 palavras/s
 * mais 1,2s de folga de respiração/pausa no início e no fim do bloco. */
export function estimateSecs(s: string): number {
  return wordCount(s) / 2.1 + 1.2;
}

export const FALA_TEMPLATES: {
  campo: (keyof BlocosVendaFieldsLike)[];
  fala: (v: BlocosVendaFieldsLike) => string;
}[] = [
  {
    campo: ["publico", "valores"],
    fala: (v) => `Se você é ${clean(v.publico)} que valoriza ${clean(v.valores)}… não passe esse vídeo sem ver isso.`,
  },
  {
    campo: ["produto", "funcao"],
    fala: (v) => `Isso não é só ${clean(v.produto)}… é ${clean(v.funcao)}.`,
  },
  {
    campo: ["dor"],
    fala: (v) => `Na correria da vida… às vezes ${clean(v.dor)}.`,
  },
  {
    campo: ["fato", "proposito"],
    fala: (v) => `${clean(v.fato)} para ${clean(v.proposito)}.`,
  },
  {
    campo: ["local"],
    fala: (v) => `Se essa mensagem fez sentido para você… o link está no ${clean(v.local)}, aqui embaixo.`,
  },
];

export interface FalaCheck {
  bloco: number;
  campos: (keyof BlocosVendaFieldsLike)[];
  fala: string;
  words: number;
  secs: number;
  over: boolean;
}

/** Mesmo limiar usado no componente (s > 11 = estourou o bloco de 10s). */
export function checkFalaLengths(fields: BlocosVendaFieldsLike): FalaCheck[] {
  return FALA_TEMPLATES.map((t, i) => {
    const fala = t.fala(fields);
    const secs = estimateSecs(fala);
    return { bloco: i + 1, campos: t.campo, fala, words: wordCount(fala), secs, over: secs > 11 };
  });
}
