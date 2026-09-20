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
  /** Frase de abertura do bloco 1, já pronta pra falar — nunca montada
   * de fragmentos ("publico"/"valores" encaixados num molde fixo, que é
   * exatamente o que soava "anúncio", não fala natural). Escrita livre
   * (pela IA ou digitada), escolhendo a técnica de gancho que melhor
   * encaixa (repertório em hook-library.ts) — código só valida (duração,
   * compliance, clichê), nunca decide como a frase começa. */
  gancho: string;
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
  return String(s || "").trim().replace(/[.,;…\s]+$/, "");
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

/** Antes era um molde fixo ("Se você é {publico} que valoriza {valores}…")
 * que forçava a mesma cadência em todo gancho — pedido direto do usuário
 * pra parar de soar "anúncio". Agora "gancho" já é a frase pronta,
 * escrita livre; código só garante que não é vazia (as checagens de
 * duração/clichê/compliance ficam em `checkStructuralIssues` /
 * `checkFalaLengths`, que já rodam sobre esse texto igual aos outros
 * blocos). */
const GANCHO: TemplateEntry = {
  campo: ["gancho"],
  fala: (v) => String(v.gancho || "").trim(),
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
/** Não ancorado no início — o problema é o campo "dor" duplicar o "às
 * vezes" que o TEMPLATE já injeta antes dele (ex.: "Na correria da
 * vida… às vezes {dor}."), não importa em que ponto da frase isso
 * aconteça. Visto na prática: a LLM inventa uma abertura DIFERENTE da
 * lista fixa ("Na dor da vida, às vezes perdemos a fé" — não bate
 * "na correria" nem começa a frase com "às vezes") mas ainda embute
 * "às vezes" no meio, duplicando o conector do template.
 * Sem \b ao redor de "às"/"as" — o \b do JS não reconhece fronteira antes
 * de vogal acentuada (não é \w por padrão), então "\bàs vezes\b" nunca
 * batia de verdade; aqui a frase inteira ("às vezes"/"as vezes") já é
 * específica o bastante pra dispensar o \b. */
const DOR_ECHO_RE = /(na correria|no dia a dia|no corre\b|às vezes|as vezes)/i;
/** "dor" entra como CONTINUAÇÃO de "…às vezes {dor}.", nunca como frase
 * independente com sujeito próprio — visto na prática: "às vezes Muitas
 * pessoas se sentem desorientadas..." (maiúscula no meio da frase,
 * porque o campo foi escrito como sentença solta, não como continuação).
 * Checagem simples e eficaz: se "dor" começa com maiúscula, não é
 * continuação de minúscula nenhuma. */
function startsWithCapital(s: string): boolean {
  const c = s.charAt(0);
  return c !== "" && c === c.toUpperCase() && c !== c.toLowerCase();
}
const FATO_TESTIMONIAL = /(leitores?|clientes?|usu[áa]rios?|consumidores?|pessoas?) (relatam|dizem|afirmam|contam|garantem)/i;
/** "fato" + "proposito" viram "{fato} para {proposito}." — se "proposito"
 * também começar com "para", a frase final duplica ("...para para...").
 * Já estava documentado como regra no prompt de geração
 * (blocos-venda-vision.ts), mas nunca tinha virado checagem em código —
 * por isso a LLM ignorou na prática (visto: "sempre há uma luz para
 * para ajudar..."). */
const PROPOSITO_PARA_START = /^(para|pra)\s/i;
/** "local" entra em "o link está no {local}, aqui embaixo." — "no" já é a
 * contração de "em o", então um artigo solto no começo do campo ("um
 * carrinho...") vira "no um carrinho..." (errado). Visto na prática. */
const LOCAL_ARTICLE_START = /^(um|uma|o|a)\s/i;
/** Guardrail contra o molde antigo que causava a queixa "parece anúncio,
 * não fala natural" — "gancho" agora é escrito livre, mas não pode
 * regredir pra exatamente a fórmula que a gente tirou de propósito. Não é
 * checagem de conteúdo/gramática (isso fica por conta de duração e
 * compliance, que já rodam sobre qualquer texto), só impede a MESMA
 * cadência fixa de sempre. */
const GANCHO_FORMULA_ANTIGA = /^se você é .+\bque valoriza\b/i;

export function checkStructuralIssues(fields: BlocosVendaFieldsLike, variant: BlocosVendaVariant): string[] {
  const used = fieldsUsedBy(variant);
  const issues: string[] = [];

  if (used.has("gancho") && GANCHO_FORMULA_ANTIGA.test(clean(fields.gancho))) {
    issues.push(
      `Campo "gancho" ("${fields.gancho}") caiu na fórmula fixa antiga ("Se você é X que valoriza Y…") — exatamente o padrão que soa anúncio/template, não fala natural. Escreva uma frase de abertura diferente, escolhendo livremente a técnica (pergunta, confissão, observação cotidiana, contraste, identificação direta etc. — repertório completo no bloco de técnicas do prompt).`,
    );
  }

  if (used.has("funcao") && NOMINAL_VERB_START.test(clean(fields.funcao))) {
    issues.push(
      `Campo "funcao" ("${fields.funcao}") começa com verbo — ele entra em "é {funcao}.", então tem que ser uma frase NOMINAL (ex.: "um guia diário de amor"), nunca outro verbo colado (ex.: "é traz..."/"é é..." está gramaticalmente errado). Reescreva "funcao" como frase nominal.`,
    );
  }

  if (used.has("dor") && DOR_ECHO_RE.test(clean(fields.dor))) {
    issues.push(
      `Campo "dor" ("${fields.dor}") repete, em qualquer ponto da frase, a abertura fixa do bloco ("Na correria da vida… às vezes {dor}.") — mesmo que não seja com essas palavras exatas (ex.: "Na dor da vida, às vezes perdemos a fé" também conta, porque ainda embute "às vezes"). "dor" tem que ir direto pra dor específica, sem "na correria"/"no dia a dia"/"às vezes" em NENHUMA posição do campo — isso já está no template, repetir vira frase duplicada tipo "às vezes... às vezes...".`,
    );
  }

  if (used.has("dor") && startsWithCapital(clean(fields.dor))) {
    issues.push(
      `Campo "dor" ("${fields.dor}") começa com maiúscula — ele entra como CONTINUAÇÃO de "Na correria da vida… às vezes {dor}.", nunca como frase independente com sujeito próprio (ex.: "às vezes Muitas pessoas se sentem..." está errado — maiúscula no meio da frase). Reescreva "dor" em minúscula, como continuação direta de "às vezes" (ex.: "às vezes perdemos o rumo", não "às vezes Muitas pessoas perdem o rumo").`,
    );
  }

  if (used.has("proposito") && PROPOSITO_PARA_START.test(clean(fields.proposito))) {
    issues.push(
      `Campo "proposito" ("${fields.proposito}") começa com "para"/"pra" — ele entra em "{fato} para {proposito}.", e "para" já vem antes dele, então "para para..." fica duplicado. Reescreva "proposito" sem o "para"/"pra" inicial (ex.: "viver com mais propósito", não "para viver com mais propósito").`,
    );
  }

  if (used.has("fato") && FATO_TESTIMONIAL.test(fields.fato)) {
    issues.push(
      `Campo "fato" ("${fields.fato}") é um depoimento/prova social inventada ("leitores relatam" etc.), não um fato verificável — proibido (mesma regra do resto do KRONIA: nunca prova social sem evidência real). Reescreva "fato" como uma característica objetiva e verificável do produto (visível na foto/embalagem), nunca uma citação de terceiros.`,
    );
  }

  if (used.has("local") && LOCAL_ARTICLE_START.test(clean(fields.local))) {
    issues.push(
      `Campo "local" ("${fields.local}") começa com artigo ("um"/"uma"/"o"/"a") — ele entra em "o link está no {local}, aqui embaixo.", e "no" já é a contração de "em o", então "no um carrinho..." fica gramaticalmente errado. Reescreva "local" sem o artigo inicial (ex.: "carrinho laranja", não "um carrinho laranja").`,
    );
  }

  return issues;
}

/** Orçamento por bloco em LETRAS (não palavras) — perto do teto real do
 * bloco de 10s (over dispara em s>11, ou seja, ~127 letras), não no
 * mínimo aceitável: cortar até aqui ainda aproveita quase todo o slot de
 * 10s, em vez de deixar o bloco curto demais depois do corte. */
const TARGET_CHARS_PER_BLOCK = 114;

/** Palavras que nunca podem sobrar como ÚLTIMA palavra de um campo depois
 * do corte — preposição/artigo/conjunção solta no fim vira frase
 * quebrada (visto na prática: cortar "outros" de "conexão com os
 * outros" deixa "...conexão com os." pendurado). */
const DANGLING_END_WORDS = new Set([
  "de", "com", "para", "pra", "em", "a", "o", "os", "as", "um", "uma", "uns", "umas",
  "que", "e", "ou", "mas", "no", "na", "nos", "nas", "do", "da", "dos", "das",
  "ao", "aos", "à", "às", "pelo", "pela", "pelos", "pelas", "sem", "sob", "sobre", "até",
]);

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
      while (words.length > 1 && DANGLING_END_WORDS.has(clean(words[words.length - 1]).toLowerCase())) {
        words.pop();
      }
    }

    t.campo.forEach((c) => {
      result[c] = (campoWords[c] ?? []).join(" ");
    });
  }

  return result;
}
