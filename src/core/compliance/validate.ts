import { callStructured } from "../../lib/llm";
import { ComplianceResultSchema, RULE_GROUPS, type ComplianceResult } from "../../types/compliance";
import type { ContentRequest, GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o gate de Compliance do KRONIA. Verifica um roteiro gerado contra os grupos de
regra: ${RULE_GROUPS.join(", ")}.

Regra central: nenhuma claim pode ser afirmação absoluta sem evidência (uma claim com kind
diferente de "fato" não pode ser apresentada como certeza no texto).
"originalidade_anti_copia": verifique se o texto do roteiro não repete frases literais do vídeo
de referência, quando houver.

Para cada violação, aponte o texto exato sinalizado (flaggedText), o motivo (reason) e uma
sugestão de correção concreta (suggestion) — nunca uma reprovação genérica.`;

const InferredSchema = ComplianceResultSchema.omit({ attempt: true });

/** Etapa 5 — Compliance (gate). */
export async function validateCompliance(
  request: ContentRequest,
  generation: GenerationResult,
  attempt: number,
): Promise<ComplianceResult> {
  const prompt = `Modo: ${request.mode}. Projeto: ${request.project}.
Roteiro para validação:\n${JSON.stringify(generation, null, 2)}`;

  const result = await callStructured({
    schema: InferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "compliance_result",
  });

  return { ...result, attempt };
}
