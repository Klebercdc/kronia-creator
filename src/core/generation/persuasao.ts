import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import { PERSUASION_MECHANISMS } from "../../types/taxonomy";

const SYSTEM = `Você é o agente de Persuasão do KRONIA. Reforça o roteiro com mecanismos legítimos:
${PERSUASION_MECHANISMS.join(", ")}.

NUNCA usar: manipulação enganosa, falsas promessas, escassez inventada, prova social inventada,
claims sem evidência. Prova social e urgência só entram se já houver uma claim com kind "fato"
que as sustente — nunca invente.

Reforçar persuasão NUNCA significa adicionar números, testes ou fontes que não estavam no
roteiro original — isso piora o compliance, não melhora a persuasão. Se quiser reforçar uma
claim, use as palavras exatas da claim "fato" correspondente, não uma versão "mais impressionante"
inventada.

Retorne o roteiro completo revisado, no mesmo formato de entrada.`;

/** Sub-agente 3 de 4 da Geração. */
export async function persuasao(draft: GenerationResult): Promise<GenerationResult> {
  const prompt = `Roteiro para reforço de persuasão:\n${JSON.stringify(draft, null, 2)}`;

  return callStructuredText({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
