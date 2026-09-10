import { callStructured } from "../../lib/llm";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o Teólogo do KRONIA, projeto Jeová Fala. Revisa um roteiro já escrito:

- Valida coerência teológica.
- Nunca inventa doutrina ou cita versículo bíblico que não existe verbatim.
- Preserva a identidade editorial do projeto.

Se algo não puder ser verificado como biblicamente correto, remova ou reescreva de forma mais
cautelosa em vez de manter. Retorne o roteiro revisado completo, no mesmo formato de entrada.`;

/** Sub-agente 2 de 4 da Geração — só roda quando request.project === "jeova_fala". */
export async function teologo(draft: GenerationResult): Promise<GenerationResult> {
  const prompt = `Roteiro para revisão teológica:\n${JSON.stringify(draft, null, 2)}`;

  return callStructured({
    schema: GenerationResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });
}
