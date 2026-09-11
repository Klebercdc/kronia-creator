import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { interpretTrend } from "../core/intelligence/trends/interpreter";
import { TrendInputSchema, type TrendAnalysis } from "../core/intelligence/trends/schemas";
import { deriveCreatorDna } from "../core/intelligence/memory/creator-dna";
import { generateOpportunities } from "../core/intelligence/opportunities/engine";
import { totalScore, type Opportunity } from "../core/intelligence/opportunities/schemas";

export interface OpportunityWithScore extends Opportunity {
  score: number;
}

export interface FindOpportunitiesResult {
  trendAnalysis: TrendAnalysis;
  opportunities: OpportunityWithScore[];
}

/**
 * RPC único da tela "Oportunidades" — interpreta a tendência, deriva o
 * Creator DNA do histórico existente (sem LLM, sem tabela nova) e gera as
 * oportunidades. Síncrona (não passa pelo Job Engine): são só 2 chamadas
 * LLM rápidas (interpretação + geração), não o tipo de trabalho pesado
 * que estoura o timeout de uma function — ver ARCHITECTURE.md.
 */
export const findOpportunities = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ trendInput: TrendInputSchema, count: z.number().int().min(1).max(10).optional() }).parse(data))
  .handler(async ({ data }): Promise<FindOpportunitiesResult> => {
    const trendAnalysis = await interpretTrend(data.trendInput);
    const creatorDna = await deriveCreatorDna();
    const opportunities = await generateOpportunities({
      trendInput: data.trendInput,
      trendAnalysis,
      creatorDna,
      count: data.count,
    });

    return {
      trendAnalysis,
      opportunities: opportunities.map((o) => ({ ...o, score: totalScore(o.scoreComponents) })),
    };
  });
