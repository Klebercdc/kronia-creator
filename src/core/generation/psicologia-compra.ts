import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import { BUYING_PSYCHOLOGY_TRIGGERS } from "../../types/taxonomy";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";

const SYSTEM = `Você é o agente de Psicologia de Compra do KRONIA — aplica princípios
comportamentais reais (Cialdini, Kahneman) ao roteiro: ${BUYING_PSYCHOLOGY_TRIGGERS.join(", ")}.

Diferença em relação à Persuasão: aqui o critério é psicológico e ético, não só de copy —
cada gatilho só entra se houver evidência real por trás (uma claim com kind "fato"). A linha
entre "gatilho comportamental legítimo" e "manipulação enganosa" é a evidência: ancoragem de
preço real, prova social com número real, escassez real (estoque, prazo) — sim; número
inventado, contagem regressiva falsa, urgência fabricada — não, nunca.

Onde um gatilho já evidenciado puder ser expresso com mais clareza psicológica (ex: reformular
o CTA para reduzir a sensação de risco da decisão — aversão a perda trabalhando a favor do
usuário, não contra), ajuste a narração/onScreenText da cena relevante.

${CREATIVE_QUALITY_BAR}

Retorne o roteiro completo revisado, no mesmo formato de entrada.`;

/** Sub-agente de Geração — roda na OpenAI: a linha entre gatilho legítimo e
 * manipulação exige julgamento fino, não é uma checagem mecânica de lista. */
export async function psicologiaDeCompra(draft: GenerationResult): Promise<GenerationResult> {
  const prompt = `Roteiro para revisão de psicologia de compra:\n${JSON.stringify(draft, null, 2)}`;

  return callStructuredText({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
