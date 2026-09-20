import { z } from "zod";

export const CREATIVE_INTENTS = ["message", "engagement", "sales", "script", "custom"] as const;
export type CreativeIntent = (typeof CREATIVE_INTENTS)[number];

export const CREATIVE_OBJECTIVES = [
  "retention",
  "reflection",
  "engagement",
  "share",
  "comment",
  "follow",
  "save",
  "conversion",
  "education",
  "connection",
  "custom",
] as const;
export type CreativeObjective = (typeof CREATIVE_OBJECTIVES)[number];

export const CREATIVE_HOOK_MECHANICS = [
  "curiosity",
  "pattern_interrupt",
  "bold_statement",
  "question",
  "social_proof",
  "before_after",
  "negative_hook",
  "relatable_pain",
  "story_open",
  "result_first",
  "identity_call",
  "number_stat",
] as const;

export type CreativeHookMechanic = (typeof CREATIVE_HOOK_MECHANICS)[number];

export const CTA_OBJECTIVES = ["purchase", "click", "comment", "share", "follow", "save", "reflect", "none"] as const;
export type CtaObjective = (typeof CTA_OBJECTIVES)[number];

export const CreativeStrategySchema = z.object({
  intent: z.enum(CREATIVE_INTENTS),
  objective: z.string().min(1),
  theme: z.string().nullable(),
  coreTruth: z.string().nullable(),
  audience: z.string().nullable(),
  emotionalStart: z.string().nullable(),
  emotionalEnd: z.string().nullable(),
  hookMechanic: z.string().min(1),
  narrativeArc: z.string().min(1),
  ctaObjective: z.enum(CTA_OBJECTIVES),
  verifiedFacts: z.array(z.string()),
  observedVisuals: z.array(z.string()),
  creativeAssumptions: z.array(z.string()),
});

export type CreativeStrategy = z.infer<typeof CreativeStrategySchema>;

export const CreativeBlockSchema = z.object({
  role: z.string().min(1),
  fala: z.string().min(1),
});

export type CreativeBlock = z.infer<typeof CreativeBlockSchema>;

export const CreativeContextSchema = z.object({
  intent: z.enum(CREATIVE_INTENTS),
  objective: z.string().min(1),
  niche: z.string().nullable(),
  theme: z.string().nullable(),
  audience: z.string().nullable(),
  tone: z.string().nullable(),
  emotion: z.string().nullable(),
  coreTruth: z.string().nullable(),
  context: z.string().nullable(),
  verifiedFacts: z.array(z.string()),
  observedVisuals: z.array(z.string()),
  constraints: z.array(z.string()),
});

export type CreativeContext = z.infer<typeof CreativeContextSchema>;

export const DEFAULT_CREATIVE_CONTEXT: CreativeContext = {
  intent: "sales",
  objective: "conversion",
  niche: null,
  theme: null,
  audience: null,
  tone: "natural",
  emotion: null,
  coreTruth: null,
  context: null,
  verifiedFacts: [],
  observedVisuals: [],
  constraints: [],
};

/**
 * Este é o limite da engenharia reversa: não tentamos reproduzir cadeia de
 * pensamento privada. Transformamos comportamento criativo observável em
 * decisões estruturadas que podem ser auditadas e validadas pelo código.
 */
export const CREATIVE_DECISION_ORDER = [
  "observe",
  "context",
  "intent",
  "objective",
  "opportunity",
  "theme",
  "coreTruth",
  "emotion",
  "strategy",
  "write",
  "validate",
  "revise",
] as const;

export function expectedCreativeBlockCount(variant: "curto" | "padrao" | "longo"): number {
  return variant === "curto" ? 3 : variant === "padrao" ? 5 : 8;
}
