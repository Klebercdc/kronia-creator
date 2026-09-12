import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EvidencedClaimSchema } from "../types/evidence";
import { VideoAnalysisSchema } from "../types/video-analysis";
import { buildCreativePrompt, type BuildCreativePromptResult } from "../core/intelligence/creative/orchestrator";

const BuildCreativePromptInputSchema = z.object({
  media: z.enum(["image", "video"]),
  productInfo: z.array(EvidencedClaimSchema),
  idea: z.string().nullable(),
  opportunityContext: z.string().nullable(),
  objective: z.string(),
  targetId: z.string().nullable(),
  /** Fase 2B — Reference Intelligence: análise de um vídeo de referência já
   * ingerido pelo Job Engine (ver reference-ingestion.ts), opcional. */
  referenceAnalysis: VideoAnalysisSchema.nullable(),
});

/**
 * RPC único do módulo Prompt Intelligence — orquestra Creative Reasoning ->
 * Creative Evaluation -> Target Resolver/Specialist -> Prompt Compiler ->
 * QC (determinístico + semântico, ver semantic-qc.ts) -> Repair (ver
 * core/intelligence/creative/orchestrator.ts). Síncrono, não passa pelo
 * Job Engine: no máximo 1 chamada LLM (reasoning) + até 2 repairs + até 1
 * chamada semântica por cada uma das até 3 passadas de QC (só quando há
 * característica `productTruth.unknown` e o QC determinístico não rejeitou
 * antes) — até 6 chamadas no pior caso, não "1-3" como antes da Fase 2A.
 *
 * NÃO persiste nada em tabela nova — o PromptArtifact é devolvido ao
 * cliente (mesmo padrão do Opportunity Engine hoje, que também não
 * persiste até o usuário decidir "Criar conteúdo").
 */
export const buildCreativePromptFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => BuildCreativePromptInputSchema.parse(data))
  .handler(async ({ data }): Promise<BuildCreativePromptResult> => {
    return buildCreativePrompt(data);
  });
