import { z } from "zod";

/** Intenções editoriais da criação. O objetivo é separar intenção de nicho:
 * um mesmo perfil pode criar mensagem, engajamento, venda ou roteiro. */
export const CREATIVE_INTENTS = ["message", "engagement", "sales", "script", "custom"] as const;
export type CreativeIntent = (typeof CREATIVE_INTENTS)[number];

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

/** Contexto interno mínimo: a IA decide como criar; o código não transforma
 * esse contexto em frases. */
export const DEFAULT_CREATIVE_CONTEXT: CreativeContext = {
  intent: "sales",
  objective: "conversão",
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
