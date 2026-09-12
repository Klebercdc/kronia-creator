import { callStructuredText } from "../../lib/openai";
import {
  FormatRecommendationSchema,
  resolveRecommendationSource,
  type ClassificationResult,
  type ContentRequest,
  type FormatRecommendation,
} from "../../types/pipeline";
import { CONTENT_FORMATS } from "../../types/taxonomy";

const SYSTEM = `Você recomenda o melhor formato de vídeo para um produto e objetivo, a partir de uma
taxonomia fechada: ${CONTENT_FORMATS.join(", ")}.
"confidence" é sempre qualitativo (alta/media/baixa) — nunca um percentual, porque ainda não
existe dado estatístico de performance real por trás da recomendação.
Nunca invente características do produto que não estão nas informações fornecidas pelo usuário.`;

/**
 * Etapa 3 — Recomendação. Quando há classificação (vídeo de referência), o
 * formato extraído vira a âncora; sem referência, decide a partir do
 * pedido puro (produto + objetivo + modo).
 */
export async function recommend(
  request: ContentRequest,
  classification: ClassificationResult | null,
): Promise<FormatRecommendation> {
  const source = resolveRecommendationSource(classification);

  const prompt =
    source === "referencia_ancora" && classification
      ? `O vídeo de referência foi classificado como formato primário "${classification.formatPrimary}"
(secundário: ${classification.formatSecondary ?? "nenhum"}), hook "${classification.hookType}",
mecanismos de persuasão: ${classification.persuasionMechanisms.join(", ")}.
Use esse formato como âncora e recomende alternativas coerentes com o produto e objetivo abaixo.
Objetivo: ${request.objective}. Modo: ${request.mode}.
Informações do produto (única fonte de verdade): ${JSON.stringify(request.productInfo)}.`
      : `Não há vídeo de referência. Recomende o melhor formato a partir do produto e objetivo abaixo.
Objetivo: ${request.objective}. Modo: ${request.mode}.
Informações do produto (única fonte de verdade): ${JSON.stringify(request.productInfo)}.`;

  return callStructuredText({
    schema: FormatRecommendationSchema,
    system: SYSTEM,
    prompt,
    toolName: "format_recommendation",
  });
}
