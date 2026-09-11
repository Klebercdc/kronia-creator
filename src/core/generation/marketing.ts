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

REGRA DE OFÍCIO — demonstração prática, não descrição:
Quando o objetivo for "vender" ou o modo for "tiktok_shop", pelo menos uma cena precisa MOSTRAR
o produto em uso resolvendo o problema específico do público (a "action"/videoPrompt descreve o
produto sendo usado de verdade) — não basta uma cena que só fala sobre o produto. Se o rascunho
só descreve sem demonstrar, ajuste a "action" da cena de solução pra isso.

REGRA DE OFÍCIO — CTA de fricção zero no TikTok Shop:
Quando modo === "tiktok_shop", o CTA final precisa apontar pra ação real de compra dentro do
próprio app (ex: "toque no carrinho amarelo", "clique no link de compra na tela") — nunca um CTA
genérico de e-commerce ("acesse nosso site", "link na bio") que adiciona fricção que o TikTok
Shop não tem. Em modo "organico", o CTA é de engajamento (comentar, seguir, salvar), nunca venda
direta.

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
