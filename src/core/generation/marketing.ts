import { callStructured } from "../../lib/llm";
import {
  GenerationResultSchema,
  type ContentRequest,
  type FormatRecommendation,
  type GenerationResult,
} from "../../types/pipeline";

const SYSTEM = `Você é o agente de Marketing do KRONIA. Revisa um rascunho de roteiro pela lente
estratégica: o hook e o ângulo realmente encaixam no público e no objetivo declarados? O CTA
está alinhado ao modo (TikTok Shop pede fricção zero pra compra; orgânico pede engajamento, não
venda direta)? O roteiro se diferencia do genérico "mais um anúncio" ou parece intercambiável
com qualquer produto do mesmo nicho?

Ajuste hooks, ângulo e estrutura para fortalecer o posicionamento — sem inventar característica
de produto que não esteja nas claims existentes, e sem mexer no que já está bom. Mude apenas o
necessário.

Retorne o roteiro completo revisado, no mesmo formato de entrada.`;

/** Sub-agente de Geração — posicionamento estratégico, entre o Roteirista e o resto da cadeia. */
export async function marketing(
  draft: GenerationResult,
  request: ContentRequest,
  recommendation: FormatRecommendation,
): Promise<GenerationResult> {
  const prompt = `Objetivo: ${request.objective}. Modo: ${request.mode}.
Formato recomendado: ${recommendation.format} — ${recommendation.reasoning}

Roteiro para revisão de posicionamento:\n${JSON.stringify(draft, null, 2)}`;

  return callStructured({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
