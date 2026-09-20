/**
 * Fórmulas de fala dos blocos do gerador de Blocos de venda — fonte
 * única, usada tanto pelo componente (BlocosVendaGenerator.tsx, pra
 * mostrar os alertas de "passa de 10s") quanto pela geração por IA
 * (blocos-venda-vision.ts, pra IMPEDIR que o texto já saia estourado em
 * vez de só avisar depois). Antes esse cálculo só existia no componente —
 * a IA gerava sem saber do limite real, por isso passava e o usuário só
 * descobria pelo alerta.
 *
 * Suporta 3 variantes de duração (pedido do usuário: manter a mesma
 * "espinha" gancho → desenvolvimento → CTA, só variando quantos blocos de
 * 10s entram no meio) — "curto" nunca usa fato/proposito/prova/
 * beneficioExtra/objecao, "longo" usa todos os campos.
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
  /** Só usado na variante "longo" — demonstração/prova extra do produto. */
  prova: string;
  /** Só usado na variante "longo" — um segundo benefício, além do principal. */
  beneficioExtra: string;
  /** Só usado na variante "longo" — resposta a uma dúvida/objeção comum. */
  objecao: string;
}

export type BlocosVendaVariant = "curto" | "padrao" | "longo";

export const VARIANT_LABEL: Record<BlocosVendaVariant, string> = {
  curto: "Curto (~30s)",
  padrao: "Padrão (~50s)",
  longo: "Longo (~80s)",
};

export const VARIANT_ORDER: BlocosVendaVariant[] = ["curto", "padrao", "longo"];

export function clean(s: string): string {
  return String(s || "").trim().replace(/[.…\s]+$/, "");
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => w && w !== "…").length;
}

/** Quantidade de letras/caracteres faladas (sem contar espaço) — palavra
 * NÃO é uma unidade confiável de tempo de fala: "e" e
 * "extraordinariamente" contam como "1 palavra" cada, mas têm duração bem
 * diferente. Contar letra por letra é o que corrige isso (pedido direto:
 * "não sabe contar letras" — a estimativa de segundos usava só contagem
 * de palavra). */
export function charCount(s: string): number {
  return s.replace(/\s+/g, "").length;
}

/** Ritmo de fala em português: ~13 letras/segundo (equivalente ao antigo
 * ~2,1 palavras/s pra uma palavra média de ~6 letras, mas agora sensível
 * ao tamanho real de cada palavra) + 1,2s de folga de respiração/pausa no
 * início e no fim do bloco. */
export function estimateSecs(s: string): number {
  return charCount(s) / 13 + 1.2;
}

interface TemplateEntry {
  campo: (keyof BlocosVendaFieldsLike)[];
  fala: (v: BlocosVendaFieldsLike) => string;
}

const GANCHO: TemplateEntry = {
  campo: ["publico", "valores"],
  fala: (v) => `Se você é ${clean(v.publico)} que valoriza ${clean(v.valores)}… não passe esse vídeo sem ver isso.`,
};
const REVELACAO: TemplateEntry = {
  campo: ["produto", "funcao"],
  fala: (v) => `Isso não é só ${clean(v.produto)}… é ${clean(v.funcao)}.`,
};
const DOR: TemplateEntry = {
  campo: ["dor"],
  fala: (v) => `Na correria da vida… às vezes ${clean(v.dor)}.`,
};
const ALIVIO: TemplateEntry = {
  campo: ["fato", "proposito"],
  fala: (v) => `${clean(v.fato)} para ${clean(v.proposito)}.`,
};
const CTA: TemplateEntry = {
  campo: ["local"],
  fala: (v) => `Se essa mensagem fez sentido para você… o link está no ${clean(v.local)}, aqui embaixo.`,
};
/** Curto não tem espaço pra revelação e dor em blocos separados — combina
 * os dois numa frase só, mais enxuta, mantendo os dois campos. */
const REVELACAO_DOR_CURTO: TemplateEntry = {
  campo: ["produto", "funcao", "dor"],
  fala: (v) => `Isso não é só ${clean(v.produto)}… é ${clean(v.funcao)} — porque às vezes ${clean(v.dor)}.`,
};
const PROVA: TemplateEntry = {
  campo: ["prova"],
  fala: (v) => `E não para por aí… ${clean(v.prova)}.`,
};
const BENEFICIO_EXTRA: TemplateEntry = {
  campo: ["beneficioExtra"],
  fala: (v) => `Além disso… ${clean(v.beneficioExtra)}.`,
};
const OBJECAO: TemplateEntry = {
  campo: ["objecao"],
  fala: (v) => `Se você ainda tem dúvida… ${clean(v.objecao)}.`,
};

/** Cada variante é uma sequência de blocos de 10s — a "espinha" gancho →
 * desenvolvimento → CTA é sempre preservada, só o meio (desenvolvimento)
 * cresce ou encolhe. "padrao" é EXATAMENTE o que já existia antes das
 * variantes (não mude sem verificar os testes/alertas antigos). */
export const FALA_TEMPLATES_BY_VARIANT: Record<BlocosVendaVariant, TemplateEntry[]> = {
  curto: [GANCHO, REVELACAO_DOR_CURTO, CTA],
  padrao: [GANCHO, REVELACAO, DOR, ALIVIO, CTA],
  longo: [GANCHO, REVELACAO, DOR, PROVA, ALIVIO, BENEFICIO_EXTRA, OBJECAO, CTA],
};

/** Campos realmente usados pela variante — usado pra não checar (nem
 * cobrar preenchimento de) campo que a variante nem usa (ex.: "curto" não
 * usa fato/proposito/prova/beneficioExtra/objecao). */
export function fieldsUsedBy(variant: BlocosVendaVariant): Set<keyof BlocosVendaFieldsLike> {
  const set = new Set<keyof BlocosVendaFieldsLike>();
  FALA_TEMPLATES_BY_VARIANT[variant].forEach((t) => t.campo.forEach((c) => set.add(c)));
  return set;
}

export interface FalaCheck {
  bloco: number;
  campos: (keyof BlocosVendaFieldsLike)[];
  fala: string;
  words: number;
  chars: number;
  secs: number;
  over: boolean;
  /** Sobrou tempo demais no bloco (s < 8 = mais de 2s do bloco de 10s
   * desperdiçados) — pedido direto: "faça aproveitar bem os 10 segundos".
   * Só sinaliza; nunca alonga sozinho em código (isso exigiria inventar
   * conteúdo) — vira instrução pra LLM elaborar mais o campo. */
  under: boolean;
}

/** Mesmo limiar usado no componente (s > 11 = estourou o bloco de 10s).
 * "under" (s < 8) é o oposto: bloco curto demais, desperdiçando o tempo
 * disponível do slot de 10s. */
export function checkFalaLengths(fields: BlocosVendaFieldsLike, variant: BlocosVendaVariant): FalaCheck[] {
  return FALA_TEMPLATES_BY_VARIANT[variant].map((t, i) => {
    const fala = t.fala(fields);
    const secs = estimateSecs(fala);
    return { bloco: i + 1, campos: t.campo, fala, words: wordCount(fala), chars: charCount(fala), secs, over: secs > 11, under: secs < 8 };
  });
}

/** Checagens estruturais determinísticas — pegam erros de gramática/
 * repetição que a LLM comete mesmo depois de instruída a não cometer (visto
 * na prática: "é traz porções..."/"é é um guia..." com verbo duplicado,
 * "Na correria da vida… às vezes Na correria do dia a dia…" com o campo
 * "dor" repetindo a própria abertura fixa do bloco). Roda em código, não
 * em julgamento de IA — mesmo princípio da checagem de duração acima. */
const NOMINAL_VERB_START =
  /^(é|são|traz|oferece|ajuda|cont[ée]m|proporciona|apresenta|fornece|d[áa]|gera|promove|cria|inclui|fortalece|eleva|melhora|aumenta|reduz|alivia|cura|resolve|transforma|inspira|guia|ilumina|conecta|desperta|renova)\b/i;
const DOR_ECHO_START = /^(na correria|no dia a dia|no corre|às vezes|as vezes)\b/i;
const FATO_TESTIMONIAL = /(leitores?|clientes?|usu[áa]rios?|consumidores?|pessoas?) (relatam|dizem|afirmam|contam|garantem)/i;
const PUBLICO_PREPOSITION_START = /^(para|pra)\s/i;

export function checkStructuralIssues(fields: BlocosVendaFieldsLike, variant: BlocosVendaVariant): string[] {
  const used = fieldsUsedBy(variant);
  const issues: string[] = [];

  if (used.has("publico") && PUBLICO_PREPOSITION_START.test(clean(fields.publico))) {
    issues.push(
      `Campo "publico" ("${fields.publico}") começa com "para"/"pra" — ele entra em "Se você é {publico} que valoriza...", e "é para quem..." é gramaticalmente errado (o "é" já cumpre esse papel). Reescreva "publico" sem o "para"/"pra" inicial (ex.: "quem busca inspiração espiritual", não "para quem busca...").`,
    );
  }

  if (used.has("valores") && NOMINAL_VERB_START.test(clean(fields.valores))) {
    issues.push(
      `Campo "valores" ("${fields.valores}") começa com verbo — ele entra em "que valoriza {valores}…", então tem que ser uma frase NOMINAL (ex.: "sua fé e sua paz interior"), nunca outro verbo colado (ex.: "valoriza fortalece..." está gramaticalmente errado). Reescreva "valores" como frase nominal.`,
    );
  }

  if (used.has("funcao") && NOMINAL_VERB_START.test(clean(fields.funcao))) {
    issues.push(
      `Campo "funcao" ("${fields.funcao}") começa com verbo — ele entra em "é {funcao}.", então tem que ser uma frase NOMINAL (ex.: "um guia diário de amor"), nunca outro verbo colado (ex.: "é traz..."/"é é..." está gramaticalmente errado). Reescreva "funcao" como frase nominal.`,
    );
  }

  if (used.has("dor") && DOR_ECHO_START.test(clean(fields.dor))) {
    issues.push(
      `Campo "dor" ("${fields.dor}") repete a abertura fixa do bloco ("Na correria da vida… às vezes {dor}."). "dor" tem que ir direto pra dor específica, sem repetir "na correria"/"no dia a dia"/"às vezes" — isso já está no template, repetir vira frase duplicada tipo "às vezes... às vezes...".`,
    );
  }

  if (used.has("fato") && FATO_TESTIMONIAL.test(fields.fato)) {
    issues.push(
      `Campo "fato" ("${fields.fato}") é um depoimento/prova social inventada ("leitores relatam" etc.), não um fato verificável — proibido (mesma regra do resto do KRONIA: nunca prova social sem evidência real). Reescreva "fato" como uma característica objetiva e verificável do produto (visível na foto/embalagem), nunca uma citação de terceiros.`,
    );
  }

  return issues;
}

/** Orçamento por bloco em LETRAS (não palavras) — perto do teto real do
 * bloco de 10s (over dispara em s>11, ou seja, ~127 letras), não no
 * mínimo aceitável: cortar até aqui ainda aproveita quase todo o slot de
 * 10s, em vez de deixar o bloco curto demais depois do corte. */
const TARGET_CHARS_PER_BLOCK = 114;

/** Último recurso, determinístico — corta palavra por palavra (a unidade
 * que se corta continua sendo a palavra inteira, pra não quebrar no meio
 * de uma; o que muda é a MEDIDA do orçamento, agora em letras) até caber.
 * Pedir pra LLM encurtar (via instrução de revisão) já se mostrou pouco
 * confiável na prática, mesmo com 2 rodadas de revisão: às vezes ela
 * simplesmente ignora o pedido e devolve o campo quase do mesmo tamanho.
 * Isso aqui GARANTE que nenhum bloco sai da geração acima de ~10s — corta
 * do campo com mais letras primeiro (geralmente o menos essencial pra
 * manter a frase compreensível), até o total do bloco caber no orçamento. */
export function enforceFalaBudgets<T extends BlocosVendaFieldsLike>(fields: T, variant: BlocosVendaVariant): T {
  const result: T = { ...fields };

  for (const t of FALA_TEMPLATES_BY_VARIANT[variant]) {
    if (estimateSecs(t.fala(result)) <= 11) continue;

    const blanked = { ...result };
    t.campo.forEach((c) => (blanked[c] = ""));
    const fixedChars = charCount(t.fala(blanked));
    const budget = Math.max(15, TARGET_CHARS_PER_BLOCK - fixedChars);

    const campoWords: Partial<Record<keyof BlocosVendaFieldsLike, string[]>> = {};
    t.campo.forEach((c) => (campoWords[c] = clean(result[c]).split(/\s+/).filter(Boolean)));
    const totalChars = () => t.campo.reduce((sum, c) => sum + (campoWords[c]?.join("").length ?? 0), 0);

    while (totalChars() > budget) {
      const longest = t.campo.reduce((best, c) =>
        (campoWords[c]?.join("").length ?? 0) > (campoWords[best]?.join("").length ?? 0) ? c : best,
      );
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
