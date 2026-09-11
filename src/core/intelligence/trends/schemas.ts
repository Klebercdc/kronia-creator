import { z } from "zod";

/**
 * Entrada do Trend Interpreter/Opportunity Engine. `product` é a entrada
 * principal agora (usuário do TikTok Shop que já tem produto mas não sabe
 * como vender) — `trendText` virou contexto OPCIONAL, não obrigatório: o
 * usuário pode simplesmente perguntar "como vendo este produto pro meu
 * nicho", sem tendência nenhuma.
 */
export const TrendInputSchema = z.object({
  niche: z.string().min(1),
  /** Vocabulário próprio da camada de inteligência — NÃO é o enum
   * OBJECTIVES do pipeline de geração (esse fica intocado). */
  objective: z.string().min(1),
  /** O produto/serviço que o criador quer vender — texto livre com as
   * características reais que ele sabe (nunca inventar propriedade além
   * disso, mesma regra de EvidencedClaim no resto do pipeline). */
  product: z.string().min(1),
  trendText: z.string().nullable(),
  /** Texto livre tipo "+1.350%" — nunca tratado como dado confiável, só
   * contexto pro LLM interpretar. */
  growthHint: z.string().nullable(),
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
