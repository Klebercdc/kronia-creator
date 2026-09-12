import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";

const SYSTEM = `Você corrige um roteiro que foi reprovado no compliance.

Para cada violação listada:
1. Aplique a "suggestion" quase literalmente — não invente uma correção diferente da sugerida.
2. Selos e avisos obrigatórios (ex: "#Ad", "Conteúdo gerado por IA") vão no campo "onScreenText"
   da cena mais no início do vídeo (normalmente a cena de hook), NUNCA dentro da narração falada.
3. Depois de corrigir, releia CADA violação da lista e confirme que o "flaggedText" original não
   aparece mais em nenhuma cena, narração ou claim do roteiro — se ainda aparecer, corrija de novo
   antes de responder.

Mude apenas o necessário para resolver as violações — não reescreva cenas que não foram apontadas.
Retorne o roteiro completo corrigido, no mesmo formato de entrada.`;

/** Correção direcionada às violações apontadas — nunca regeneração cega do zero. */
export async function correctForCompliance(
  generation: GenerationResult,
  violations: ComplianceViolation[],
): Promise<GenerationResult> {
  const prompt = `Roteiro atual:\n${JSON.stringify(generation, null, 2)}\n\nViolações a corrigir:\n${JSON.stringify(violations, null, 2)}`;

  return callStructuredText({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
