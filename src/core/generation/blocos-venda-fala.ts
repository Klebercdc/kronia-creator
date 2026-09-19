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

/** Checagens estruturais determinísticas — pegam erros de gramática/
 * repetição que a LLM comete mesmo depois de instruída a não cometer (visto
 * na prática: "é traz porções..." com dois verbos colados, "Na correria da
 * vida… às vezes Na correria do dia a dia…" com o campo "dor" repetindo a
 * própria abertura fixa do bloco). Roda em código, não em julgamento de
 * IA — mesmo princípio da checagem de duração acima. */
const FUNCAO_VERB_START = /^(traz|oferece|ajuda|cont[ée]m|proporciona|apresenta|fornece|d[áa]|gera|promove|cria|inclui)\b/i;
const DOR_ECHO_START = /^(na correria|no dia a dia|no corre|às vezes|as vezes)\b/i;
const FATO_TESTIMONIAL = /(leitores?|clientes?|usu[áa]rios?|consumidores?|pessoas?) (relatam|dizem|afirmam|contam|garantem)/i;

export function checkStructuralIssues(fields: BlocosVendaFieldsLike): string[] {
  const issues: string[] = [];

  if (FUNCAO_VERB_START.test(clean(fields.funcao))) {
    issues.push(
      `Campo "funcao" ("${fields.funcao}") começa com verbo — ele entra em "é {funcao}.", então tem que ser uma frase NOMINAL (ex.: "um guia diário de amor"), nunca outro verbo colado (ex.: "é traz..." está gramaticalmente errado). Reescreva "funcao" como frase nominal.`,
    );
  }

  if (DOR_ECHO_START.test(clean(fields.dor))) {
    issues.push(
      `Campo "dor" ("${fields.dor}") repete a abertura fixa do bloco 3 ("Na correria da vida… às vezes {dor}."). "dor" tem que ir direto pra dor específica, sem repetir "na correria"/"no dia a dia"/"às vezes" — isso já está no template, repetir vira frase duplicada tipo "às vezes... às vezes...".`,
    );
  }

  if (FATO_TESTIMONIAL.test(fields.fato)) {
    issues.push(
      `Campo "fato" ("${fields.fato}") é um depoimento/prova social inventada ("leitores relatam" etc.), não um fato verificável — proibido (mesma regra do resto do KRONIA: nunca prova social sem evidência real). Reescreva "fato" como uma característica objetiva e verificável do produto (visível na foto/embalagem), nunca uma citação de terceiros.`,
    );
  }

  return issues;
}
