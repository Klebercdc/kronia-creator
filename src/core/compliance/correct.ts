import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";

const SYSTEM = `Você corrige um roteiro que foi reprovado no compliance. Para cada violação,
aplique a sugestão indicada ou uma correção equivalente — mude apenas o necessário, não
reescreva o roteiro inteiro.

Retorne o roteiro completo corrigido, no mesmo formato de entrada.`;

/** Correção direcionada às violações apontadas — nunca regeneração cega do zero. */
export async function correctForCompliance(
  generation: GenerationResult,
  violations: ComplianceViolation[],
): Promise<GenerationResult> {
  const prompt = `Roteiro atual:\n${JSON.stringify(generation, null, 2)}\n\nViolações a corrigir:\n${JSON.stringify(violations, null, 2)}`;

  return callStructured({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
