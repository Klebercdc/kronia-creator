import { z } from "zod";
import { CONTENT_FORMATS, HOOK_TYPES, PERSUASION_MECHANISMS } from "../../../types/taxonomy";

/**
 * Componentes do score — somados em CÓDIGO, nunca confiando na soma que o
 * LLM disser (modelo erra aritmética). Pesos batem com o total de 100:
 * 20+20+20+20+10+10.
 */
export const OpportunityScoreComponentsSchema = z.object({
  trendRelevance: z.number().min(0).max(20),
  creatorFit: z.number().min(0).max(20),
  audienceFit: z.number().min(0).max(20),
  novelty: z.number().min(0).max(20),
  commercialFit: z.number().min(0).max(10),
  executionFit: z.number().min(0).max(10),
});
export type OpportunityScoreComponents = z.infer<typeof OpportunityScoreComponentsSchema>;

export function totalScore(components: OpportunityScoreComponents): number {
  return (
    components.trendRelevance +
    components.creatorFit +
    components.audienceFit +
    components.novelty +
    components.commercialFit +
    components.executionFit
  );
}

/** Nunca "% de chance de viralizar" — é heurística de aderência, não
 * probabilidade estatística (não existe dado de performance real por trás
 * ainda, ver Módulo Performance na fase futura). */
export function scoreTier(score: number): "alta" | "media" | "baixa" {
  if (score >= 80) return "alta";
  if (score >= 60) return "media";
  return "baixa";
}

/**
 * Uma oportunidade acionável. `format`/`hookType`/`persuasionMechanisms`
 * reaproveitam a MESMA taxonomia fechada que o resto do pipeline já usa
 * (`classify.ts` faz igual) — evita qualquer tradução frágil entre texto
 * livre do LLM e o enum que o pipeline de geração exige.
 */
export const OpportunitySchema = z.object({
  title: z.string(),
  /** Por que essa oportunidade existe — nunca opcional, é o que
   * diferencia "aqui está uma ideia" de "aqui está uma oportunidade". */
  reasoning: z.string(),
  angle: z.string(),
  hookText: z.string(),
  format: z.enum(CONTENT_FORMATS),
  hookType: z.enum(HOOK_TYPES),
  persuasionMechanisms: z.array(z.enum(PERSUASION_MECHANISMS)),
  scoreComponents: OpportunityScoreComponentsSchema,
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const OpportunityListSchema = z.object({
  opportunities: z.array(OpportunitySchema),
});
