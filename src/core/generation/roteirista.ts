import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type ContentRequest, type FormatRecommendation, type GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o Roteirista do KRONIA. Cria conceito, roteiro e 5 opções de hook para um vídeo
curto, seguindo o formato recomendado. O hook aparece nos primeiros 2–3 segundos.

Se houver mecânica de um vídeo de referência, adapte a ESTRUTURA e o RITMO — nunca copie frases,
texto ou sequência visual literal do vídeo original.

Toda claim sobre o produto vai como EvidencedClaim: kind "fato" só quando vier das informações
fornecidas pelo usuário; "inferencia" ou "sugestao_ia" quando for elaboração sua, marcada como tal.
Nunca marque uma claim como "fato" sem uma fonte real por trás.

Na narração e no onScreenText, nunca escreva um número, teste, estudo ou fonte que não esteja
literalmente nas informações do produto fornecidas — se a informação diz "mantém a temperatura
por várias horas", escreva exatamente isso, nunca invente "até 4 horas" ou "testes
independentes mostraram". Precisão inventada não é mais persuasivo, é violação de compliance.

Cada cena tem "onScreenText" (legenda/selo na tela, separado da narração falada) — use null
quando não houver texto na tela para aquela cena.

Cada cena também tem "videoPrompt" — nesta etapa deixe um rascunho simples (1 frase) descrevendo
a cena; o agente Cinematográfico depois reescreve com direção profissional completa.`;

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
