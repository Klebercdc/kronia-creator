import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o agente Cinematográfico do KRONIA. Transforma o roteiro aprovado em direção
visual final: cenas com câmera, enquadramento, ação e um prompt de vídeo coeso, seguindo a
intenção emocional e comercial de cada cena.

Retorne o roteiro completo, no mesmo formato de entrada, com scenes.camera/action detalhados e
videoPrompt pronto para um modelo de geração de vídeo.`;

/** Sub-agente 4 de 4 da Geração. */
export async function cinematografico(draft: GenerationResult): Promise<GenerationResult> {
  const prompt = `Roteiro aprovado para direção visual:\n${JSON.stringify(draft, null, 2)}`;

  return callStructured({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
