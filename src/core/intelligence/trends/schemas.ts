import { z } from "zod";

/** Entrada do Trend Interpreter — o usuário informa a tendência, não o
 * sistema sai varrendo o TikTok inteiro (fora de escopo do MVP). */
export const TrendInputSchema = z.object({
  trendText: z.string().min(1),
  /** Texto livre tipo "+1.350%" — nunca tratado como dado confiável, só
   * contexto pro LLM interpretar. */
  growthHint: z.string().nullable(),
  niche: z.string().min(1),
  /** Vocabulário próprio da camada de inteligência — NÃO é o enum
   * OBJECTIVES do pipeline de geração (esse fica intocado). */
  objective: z.string().min(1),
});
export type TrendInput = z.infer<typeof TrendInputSchema>;

/**
 * Interpretação estruturada da tendência — nunca vira conteúdo direto,
 * é o passo intermediário "o que está acontecendo e por quê" antes de
 * decidir se vale a pena virar oportunidade.
 */
export const TrendAnalysisSchema = z.object({
  topic: z.string(),
  possibleReasonsForGrowth: z.array(z.string()),
  audienceIntent: z.array(z.string()),
  /** Qualitativo, igual a `confidence` no resto do projeto — nunca
   * percentual sem dado estatístico real por trás. */
  commercialRelevance: z.enum(["alta", "media", "baixa"]),
  contentRelevance: z.enum(["alta", "media", "baixa"]),
  risk: z.string().nullable(),
  trendStrength: z.enum(["alta", "media", "baixa"]),
});
export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;
