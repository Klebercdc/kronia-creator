import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EvidencedClaimSchema } from "../types/evidence";
import { buildCreativePrompt, type BuildCreativePromptResult } from "../core/intelligence/creative/orchestrator";

const BuildCreativePromptInputSchema = z.object({
  media: z.enum(["image", "video"]),
  productInfo: z.array(EvidencedClaimSchema),
  idea: z.string().nullable(),
  opportunityContext: z.string().nullable(),
  objective: z.string(),
  targetId: z.string().nullable(),
});

/**
 * RPC único do módulo Prompt Intelligence — orquestra Creative Reasoning ->
 * Creative Evaluation -> Target Resolver/Specialist -> Prompt Compiler ->
 * Prompt QC -> Repair (ver core/intelligence/creative/orchestrator.ts).
 * Síncrono, mesmo perfil de custo/latência do `findOpportunities`: no
 * máximo 1-3 chamadas LLM rápidas (reasoning + até 2 repairs), não passa
 * pelo Job Engine.
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
