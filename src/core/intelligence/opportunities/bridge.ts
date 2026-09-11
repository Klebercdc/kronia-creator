import type { ReferenceAnalysis } from "../../../types/pipeline";
import { totalScore, scoreTier, type Opportunity } from "./schemas";

/**
 * Converte uma Opportunity escolhida no formato que `runContentPipeline`
 * já entende (`precomputedAnalysis`) — o MESMO contrato usado quando a
 * Ingestão de vídeo de referência já rodou. Isso é o que permite a
 * oportunidade entrar no pipeline de geração existente sem tocar em uma
 * linha dele: `ingestion: null` porque não veio de vídeo nenhum;
 * `classification`/`recommendation` sintetizados a partir da oportunidade.
 *
 * `derivedFromReference: false` é semanticamente correto (não veio de
 * vídeo) e comprovadamente inerte no resto do pipeline — só é lido por
 * `resolveRecommendationSource`, que só roda dentro de `recommend.ts`, e
 * esse bridge pula `recommend.ts` inteiramente (é isso que
 * `precomputedAnalysis` faz).
 */
export function opportunityToPrecomputedAnalysis(opportunity: Opportunity): ReferenceAnalysis {
  const score = totalScore(opportunity.scoreComponents);
  const confidence = scoreTier(score);

  return {
    ingestion: null,
    classification: {
      formatPrimary: opportunity.format,
      formatSecondary: null,
      hookType: opportunity.hookType,
      narrativeStructure: [opportunity.angle],
      pacing: "medio",
      persuasionMechanisms: opportunity.persuasionMechanisms,
      derivedFromReference: false,
    },
    recommendation: {
      format: opportunity.format,
      secondaryFormat: null,
      confidence,
      reasoning: opportunity.reasoning,
      alternatives: [],
    },
  };
}
