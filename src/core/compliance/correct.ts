import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";

const SYSTEM = `Você corrige um roteiro que foi reprovado no compliance.

Para cada violação listada:
1. A "suggestion" indica O QUE precisa mudar (a ideia/direção da correção), não o texto final a
   colar. Reescreva a frase INTEIRA de forma natural, mantendo o tom, o gancho e a conexão com as
   frases vizinhas da mesma cena — nunca só suavize a palavra problemática isolada (isso produz um
   texto remendado, cheio de hedge tipo "pode ajudar"/"se quiser"/"explore a oportunidade", sem
   nexo com o resto). O objetivo é uma frase que um roteirista de verdade escreveria, não uma
   frase tecnicamente corrigida mas fraca.
2. Depois de corrigir, releia CADA violação da lista e confirme que o "flaggedText" original não
   aparece mais em nenhuma cena, narração ou claim do roteiro — se ainda aparecer, corrija de novo
   antes de responder. Releia também o roteiro inteiro em voz alta (mentalmente) pra garantir que
   as cenas ainda fluem uma pra outra depois da correção.

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
