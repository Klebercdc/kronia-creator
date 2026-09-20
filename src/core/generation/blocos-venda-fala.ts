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
const NOMINAL_VERB_START =
  /^(traz|oferece|ajuda|cont[ée]m|proporciona|apresenta|fornece|d[áa]|gera|promove|cria|inclui|fortalece|eleva|melhora|aumenta|reduz|alivia|cura|resolve|transforma|inspira|guia|ilumina|conecta|desperta|renova)\b/i;
const DOR_ECHO_START = /^(na correria|no dia a dia|no corre|às vezes|as vezes)\b/i;
const FATO_TESTIMONIAL = /(leitores?|clientes?|usu[áa]rios?|consumidores?|pessoas?) (relatam|dizem|afirmam|contam|garantem)/i;
const PUBLICO_PREPOSITION_START = /^(para|pra)\s/i;

export function checkStructuralIssues(fields: BlocosVendaFieldsLike): string[] {
  const issues: string[] = [];

  if (PUBLICO_PREPOSITION_START.test(clean(fields.publico))) {
    issues.push(
      `Campo "publico" ("${fields.publico}") começa com "para"/"pra" — ele entra em "Se você é {publico} que valoriza...", e "é para quem..." é gramaticalmente errado (o "é" já cumpre esse papel). Reescreva "publico" sem o "para"/"pra" inicial (ex.: "quem busca inspiração espiritual", não "para quem busca...").`,
    );
  }

  if (NOMINAL_VERB_START.test(clean(fields.valores))) {
    issues.push(
      `Campo "valores" ("${fields.valores}") começa com verbo — ele entra em "que valoriza {valores}…", então tem que ser uma frase NOMINAL (ex.: "sua fé e sua paz interior"), nunca outro verbo colado (ex.: "valoriza fortalece..." está gramaticalmente errado). Reescreva "valores" como frase nominal.`,
    );
  }

  if (NOMINAL_VERB_START.test(clean(fields.funcao))) {
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

/** Último recurso, determinístico — corta palavra por palavra até caber.
 * Pedir pra LLM encurtar (via instrução de revisão) já se mostrou pouco
 * confiável na prática, mesmo com 2 rodadas de revisão: às vezes ela
 * simplesmente ignora o pedido e devolve o campo quase do mesmo tamanho.
 * Isso aqui GARANTE que nenhum bloco sai da geração acima de ~10s — corta
 * do campo com mais palavras primeiro (geralmente o menos essencial pra
 * manter a frase compreensível), até o total do bloco caber no orçamento. */
export function enforceFalaBudgets<T extends BlocosVendaFieldsLike>(fields: T): T {
  const result: T = { ...fields };

  for (const t of FALA_TEMPLATES) {
    if (estimateSecs(t.fala(result)) <= 11) continue;

    const blanked = { ...result };
    t.campo.forEach((c) => (blanked[c] = ""));
    const fixedWords = wordCount(t.fala(blanked));
    const budget = Math.max(3, 18 - fixedWords);

    const campoWords: Partial<Record<keyof BlocosVendaFieldsLike, string[]>> = {};
    t.campo.forEach((c) => (campoWords[c] = clean(result[c]).split(/\s+/).filter(Boolean)));
    const total = () => t.campo.reduce((sum, c) => sum + (campoWords[c]?.length ?? 0), 0);

    while (total() > budget) {
      const longest = t.campo.reduce((best, c) => ((campoWords[c]?.length ?? 0) > (campoWords[best]?.length ?? 0) ? c : best));
      const words = campoWords[longest];
      if (!words || words.length <= 1) break;
      words.pop();
    }

    t.campo.forEach((c) => {
      result[c] = (campoWords[c] ?? []).join(" ");
    });
  }

  return result;
}
