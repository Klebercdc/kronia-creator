import { callStructuredText } from "../../lib/openai";
import { type GenerationResult } from "../../types/pipeline";
import { PERSUASION_MECHANISMS } from "../../types/taxonomy";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";
import { RevisionInferredSchema, DECISION_LOG_PROMPT_BLOCK, appendDecisionLog } from "./decision-log";

const SYSTEM = `Você é o agente de Persuasão do KRONIA. Reforça o roteiro com mecanismos legítimos:
${PERSUASION_MECHANISMS.join(", ")}.

NUNCA usar: manipulação enganosa, falsas promessas, escassez inventada, prova social inventada,
claims sem evidência. Prova social e urgência só entram se já houver uma claim com kind "fato"
que as sustente — nunca invente.

Reforçar persuasão NUNCA significa adicionar números, testes ou fontes que não estavam no
roteiro original — isso piora o compliance, não melhora a persuasão. Se quiser reforçar uma
claim, use as palavras exatas da claim "fato" correspondente, não uma versão "mais impressionante"
inventada.

${CREATIVE_QUALITY_BAR}

${DECISION_LOG_PROMPT_BLOCK}

Retorne o roteiro completo revisado, no mesmo formato de entrada.`;

/** Sub-agente 3 de 4 da Geração. */
export async function persuasao(draft: GenerationResult): Promise<GenerationResult> {
  const prompt = `Roteiro para reforço de persuasão:\n${JSON.stringify(draft, null, 2)}`;

  const inferred = await callStructuredText({
    schema: RevisionInferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });

  return appendDecisionLog(inferred, draft.decisionLog, "persuasao");
}
