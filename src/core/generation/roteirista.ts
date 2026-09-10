import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type ContentRequest, type FormatRecommendation, type GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o Roteirista do KRONIA. Cria conceito, roteiro e 5 opções de hook para um vídeo
curto, seguindo o formato recomendado. O hook aparece nos primeiros 2–3 segundos.

Se houver mecânica de um vídeo de referência, adapte a ESTRUTURA e o RITMO — nunca copie frases,
texto ou sequência visual literal do vídeo original.

Toda claim sobre o produto vai como EvidencedClaim: kind "fato" só quando vier das informações
fornecidas pelo usuário; "inferencia" ou "sugestao_ia" quando for elaboração sua, marcada como tal.
Nunca marque uma claim como "fato" sem uma fonte real por trás.`;

/** Sub-agente 1 de 4 da Geração. */
export async function roteirista(
  request: ContentRequest,
  recommendation: FormatRecommendation,
): Promise<GenerationResult> {
  const prompt = `Formato recomendado: ${recommendation.format} (${recommendation.reasoning}).
Objetivo: ${request.objective}. Modo: ${request.mode}. Projeto: ${request.project}.
Informações do produto (única fonte de verdade): ${JSON.stringify(request.productInfo)}.

Gere 5 hooks, escolha o melhor como selectedHook, e o roteiro completo em cenas timestampadas.`;

  return callStructured({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
