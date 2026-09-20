/**
 * Fala dos blocos do gerador comercial.
 *
 * Regra desta fase:
 * IA decide linguagem/narrativa; código valida o resultado.
 * Os moldes abaixo continuam apenas como compatibilidade/fallback.
 */

import type { CreativeStrategy, CreativeBlock } from "./creative-context";

export type CreativeIntent = "message" | "engagement" | "sales" | "script" | "custom";

export interface BlocosVendaFieldsLike {
  gancho: string;
  produto: string;
  funcao: string;
  dor: string;
  fato: string;
  proposito: string;
  local: string;
  prova: string;
  beneficioExtra: string;
  objecao: string;
  intent?: CreativeIntent;
  /** Fala pronta de CTA. Quando presente, ganha precedência sobre "local". */
  cta?: string;
  strategy?: CreativeStrategy;
  roteiro?: Array<{ role: string; fala: string }>;
}

export type BlocosVendaVariant = "curto" | "padrao" | "longo";

export interface CreativeScriptLike {
  strategy?: CreativeStrategy;
  roteiro?: CreativeBlock[];
}

export const CREATIVE_ROLES_BY_VARIANT: Record<BlocosVendaVariant, string[]> = {
  curto: ["gancho", "desenvolvimento", "cta"],
  padrao: ["gancho", "revelacao", "dor", "alivio", "cta"],
  longo: ["gancho", "revelacao", "dor", "prova", "alivio", "beneficio_extra", "objecao", "cta"],
};

export function hasCreativeScript(fields: BlocosVendaFieldsLike): fields is BlocosVendaFieldsLike & CreativeScriptLike {
  const roteiro = fields.roteiro;
  return Array.isArray(roteiro) && roteiro.length > 0 && roteiro.every((b) => Boolean(b?.fala?.trim()));
}

export function finalFalasFor(fields: BlocosVendaFieldsLike, variant: BlocosVendaVariant): string[] {
  const roteiro = fields.roteiro;
  const expected = CREATIVE_ROLES_BY_VARIANT[variant].length;
  if (Array.isArray(roteiro) && roteiro.length === expected && roteiro.every((b) => Boolean(b?.fala?.trim()))) {
    return roteiro.map((b) => b.fala.trim());
  }
  return FALA_TEMPLATES_BY_VARIANT[variant].map((t) => t.fala(fields));
}

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

export function charCount(s: string): number {
  return s.replace(/\s+/g, "").length;
}

export function estimateSecs(s: string): number {
  return charCount(s) / 13 + 1.2;
}

/**
 * Retorna o objetivo semântico do CTA.
 * Isto evita reutilizar uma frase de mensagem em um fluxo de venda.
 */
export function ctaObjectiveFor(intent: CreativeIntent): "message" | "engagement" | "sales" | "none" {
  switch (intent) {
    case "sales":
      return "sales";
    case "engagement":
      return "engagement";
    case "message":
      return "message";
    default:
      return "none";
  }
}

const MESSAGE_CTA_RE =
  /se essa mensagem fez sentido|essa mensagem falou com você|compartilhe com alguém que precisa ouvir/i;

const SALES_CTA_RE =
  /carrinho|link|confira|veja os detalhes|compre|adquira|ver produto/i;

export function validateIntentSemantics(fields: BlocosVendaFieldsLike, intent: CreativeIntent): string[] {
  const issues: string[] = [];
  const roteiro = fields.roteiro;
  const cta = clean(fields.cta || (roteiro?.[roteiro.length - 1]?.fala ?? "") || fields.local);

  if (intent === "sales" && MESSAGE_CTA_RE.test(cta)) {
    issues.push(
      "CTA incompatível com intenção de venda: foi detectada linguagem de mensagem/reflexão. Gere um CTA comercial contextualizado.",
    );
  }

  if (intent !== "sales" && SALES_CTA_RE.test(cta)) {
    issues.push(
      `CTA comercial detectado em intenção "${intent}". Gere uma ação coerente com o objetivo atual.`,
    );
  }

  return issues;
}

interface TemplateEntry {
  campo: (keyof BlocosVendaFieldsLike)[];
  fala: (v: BlocosVendaFieldsLike) => string;
}

const GANCHO: TemplateEntry = {
  campo: ["gancho"],
  fala: (v) => String(v.gancho || "").trim(),
};

/**
 * Fallbacks determinísticos mantidos para não quebrar o fluxo legado.
 * Eles não devem ser usados como moldes criativos primários.
 */
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

const CTA_FALLBACK: TemplateEntry = {
  campo: ["cta", "local"],
  fala: (v) =>
    String(v.cta || (v.local ? `Confira no ${clean(v.local)}, aqui embaixo.` : "Confira os detalhes abaixo.")).trim(),
};

const REVELACAO_DOR_CURTO: TemplateEntry = {
  campo: ["produto", "funcao", "dor"],
  fala: (v) =>
    `Isso não é só ${clean(v.produto)}… é ${clean(v.funcao)} — porque às vezes ${clean(v.dor)}.`,
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

export const FALA_TEMPLATES_BY_VARIANT: Record<BlocosVendaVariant, TemplateEntry[]> = {
  curto: [GANCHO, REVELACAO_DOR_CURTO, CTA_FALLBACK],
  padrao: [GANCHO, REVELACAO, DOR, ALIVIO, CTA_FALLBACK],
  longo: [GANCHO, REVELACAO, DOR, PROVA, ALIVIO, BENEFICIO_EXTRA, OBJECAO, CTA_FALLBACK],
};

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
  under: boolean;
}

export function checkFalaLengths(fields: BlocosVendaFieldsLike, variant: BlocosVendaVariant): FalaCheck[] {
  return FALA_TEMPLATES_BY_VARIANT[variant].map((t, i) => {
    const fala = t.fala(fields);
    const secs = estimateSecs(fala);
    return {
      bloco: i + 1,
      campos: t.campo,
      fala,
      words: wordCount(fala),
      chars: charCount(fala),
      secs,
      over: secs > 11,
      under: secs < 8,
    };
  });
}

const NOMINAL_VERB_START =
  /^(é|são|traz|oferece|ajuda|cont[ée]m|proporciona|apresenta|fornece|d[áa]|gera|promove|cria|inclui|fortalece|eleva|melhora|aumenta|reduz|alivia|cura|resolve|transforma|inspira|guia|ilumina|conecta|desperta|renova)\b/i;

const DOR_ECHO_RE = /(na correria|no dia a dia|no corre\b|às vezes|as vezes)/i;

function startsWithCapital(s: string): boolean {
  const c = s.charAt(0);
  return c !== "" && c === c.toUpperCase() && c !== c.toLowerCase();
}

const FATO_TESTIMONIAL =
  /(leitores?|clientes?|usu[áa]rios?|consumidores?|pessoas?) (relatam|dizem|afirmam|contam|garantem)/i;

const PROPOSITO_PARA_START = /^(para|pra)\s/i;
const LOCAL_ARTICLE_START = /^(um|uma|o|a)\s/i;
const GANCHO_FORMULA_ANTIGA = /^se você é .+\bque valoriza\b/i;

export function checkStructuralIssues(fields: BlocosVendaFieldsLike, variant: BlocosVendaVariant): string[] {
  const used = fieldsUsedBy(variant);
  const issues: string[] = [];

  if (used.has("gancho") && GANCHO_FORMULA_ANTIGA.test(clean(fields.gancho))) {
    issues.push(
      `Campo "gancho" caiu na fórmula antiga ("Se você é X que valoriza Y…") — escreva uma abertura livre, específica e natural.`,
    );
  }

  if (used.has("funcao") && NOMINAL_VERB_START.test(clean(fields.funcao))) {
    issues.push(
      `Campo "funcao" ("${fields.funcao}") começa com verbo — ele entra após "é"; reescreva como complemento nominal.`,
    );
  }

  if (used.has("dor") && DOR_ECHO_RE.test(clean(fields.dor))) {
    issues.push(
      `Campo "dor" ("${fields.dor}") repete conectores do fallback; remova "na correria", "no dia a dia" e "às vezes".`,
    );
  }

  if (used.has("dor") && startsWithCapital(clean(fields.dor))) {
    issues.push(
      `Campo "dor" ("${fields.dor}") começa com maiúscula, mas o fallback o usa como continuação.`,
    );
  }

  if (used.has("proposito") && PROPOSITO_PARA_START.test(clean(fields.proposito))) {
    issues.push(
      `Campo "proposito" ("${fields.proposito}") começa com "para/pra" e pode duplicar o conector do fallback.`,
    );
  }

  if (used.has("fato") && FATO_TESTIMONIAL.test(fields.fato)) {
    issues.push(
      `Campo "fato" ("${fields.fato}") parece depoimento/prova social não verificada.`,
    );
  }

  if (used.has("local") && LOCAL_ARTICLE_START.test(clean(fields.local))) {
    issues.push(
      `Campo "local" ("${fields.local}") começa com artigo e pode gerar construção incorreta com "no".`,
    );
  }

  return issues;
}

const TARGET_CHARS_PER_BLOCK = 114;

const DANGLING_END_WORDS = new Set([
  "de", "com", "para", "pra", "em", "a", "o", "os", "as", "um", "uma", "uns", "umas",
  "que", "e", "ou", "mas", "no", "na", "nos", "nas", "do", "da", "dos", "das",
  "ao", "aos", "à", "às", "pelo", "pela", "pelos", "pelas", "sem", "sob", "sobre", "até",
]);

export function enforceFalaBudgets<T extends BlocosVendaFieldsLike>(fields: T, variant: BlocosVendaVariant): T {
  if (hasCreativeScript(fields)) return fields;
  const result: T = { ...fields };

  for (const t of FALA_TEMPLATES_BY_VARIANT[variant]) {
    if (estimateSecs(t.fala(result)) <= 11) continue;

    const blanked = { ...result };
    t.campo.forEach((c) => {
      if (c !== "cta") blanked[c] = "";
    });

    const fixedChars = charCount(t.fala(blanked));
    const budget = Math.max(15, TARGET_CHARS_PER_BLOCK - fixedChars);

    const campoWords: Partial<Record<keyof BlocosVendaFieldsLike, string[]>> = {};
    t.campo.forEach(
      (c) => (campoWords[c] = clean(String(result[c] || "")).split(/\s+/).filter(Boolean)),
    );

    const totalChars = () =>
      t.campo.reduce((sum, c) => sum + (campoWords[c]?.join("").length ?? 0), 0);

    while (totalChars() > budget) {
      const candidates = t.campo.filter((c) => c !== "cta");
      const longest = candidates.reduce((best, c) =>
        (campoWords[c]?.join("").length ?? 0) > (campoWords[best]?.join("").length ?? 0) ? c : best,
      );

      const words = campoWords[longest];
      if (!words || words.length <= 1) break;

      words.pop();

      while (
        words.length > 1 &&
        DANGLING_END_WORDS.has(clean(words[words.length - 1]).toLowerCase())
      ) {
        words.pop();
      }
    }

    for (const c of t.campo) {
      if (c !== "cta") result[c] = (campoWords[c] ?? []).join(" ");
    }
  }

  return result;
}
