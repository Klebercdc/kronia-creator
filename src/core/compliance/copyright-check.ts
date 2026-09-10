import { z } from "zod";
import { callStructuredText } from "../../lib/openai";
import { ComplianceViolationSchema, type ComplianceViolation } from "../../types/compliance";
import type { GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o agente de Copyright do KRONIA. Verifica um roteiro contra risco de
propriedade intelectual de terceiros:

- Menção a marca/concorrente de terceiros sem autorização (nome de produto, empresa, ou
  personagem de outra marca).
- Uso implícito de personagem, obra ou música protegida por direito autoral.
- Conceito de campanha praticamente idêntico a uma campanha publicitária real e conhecida
  (não apenas o mesmo formato genérico — um formato como "unboxing" não é problema; recriar
  uma campanha específica e reconhecível é).
- Reivindicação de endosso, licença ou parceria que não está nas informações fornecidas do
  produto.

Não sinalize o uso do produto do próprio usuário, nem referências religiosas/culturais gerais
(um copo com "Jesus" e cruz não é violação de propriedade intelectual — é o produto do cliente).
Só aponte risco real, concreto e específico.

Retorne SEMPRE um array "violations" (vazio se não houver nada a apontar) — cada item com
group="propriedade_intelectual", flaggedText, reason e suggestion.

Exemplo de resposta quando não há nenhum problema: {"violations": []}
Exemplo de resposta com um problema: {"violations": [{"group": "propriedade_intelectual", "flaggedText": "...", "reason": "...", "suggestion": "..."}]}`;

const ResultSchema = z.object({
  violations: z.array(ComplianceViolationSchema),
});

/** Checagem dedicada de risco de IP — roda na OpenAI: julgamento de "isso é
 * risco real ou não" exige mais nuance do que uma lista de palavras banidas. */
export async function checkCopyright(generation: GenerationResult): Promise<ComplianceViolation[]> {
  const prompt = `Roteiro para checagem de propriedade intelectual:\n${JSON.stringify(generation, null, 2)}`;

  const result = await callStructuredText({
    schema: ResultSchema,
    system: SYSTEM,
    prompt,
    toolName: "copyright_check",
  });

  return result.violations.map((v) => ({ ...v, group: "propriedade_intelectual" as const }));
}
