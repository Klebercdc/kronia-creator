import { callStructured } from "../../lib/llm";
import { ComplianceResultSchema, RULE_GROUPS, type ComplianceResult } from "../../types/compliance";
import type { ContentRequest, GenerationResult } from "../../types/pipeline";

const SYSTEM = `Você é o gate de Compliance do KRONIA. Verifica um roteiro gerado contra os grupos de
regra: ${RULE_GROUPS.join(", ")}.

Regra central: nenhuma claim pode ser afirmação absoluta sem evidência (uma claim com kind
diferente de "fato" não pode ser apresentada como certeza no texto).
"originalidade_anti_copia": verifique se o texto do roteiro não repete frases literais do vídeo
de referência, quando houver.

Selos obrigatórios (divulgação comercial, aviso de conteúdo gerado por IA) devem estar no campo
"onScreenText" de alguma cena — se estiverem ausentes de todo o roteiro, é violação; se já
estiverem presentes em "onScreenText", não repita a mesma violação outra vez.

Para "afirmacoes_absolutas" e "promessas_nao_comprovadas": ao escrever a "suggestion", NUNCA
sugira inventar uma fonte, teste ou número que não está em nenhuma claim com kind "fato" — a
correção certa é generalizar ou remover o dado específico não comprovado, nunca dar mais
credibilidade falsa a ele. Se a claim "fato" diz "mantém a temperatura por várias horas" e o
roteiro escreveu "mantém por até 4 horas segundo testes independentes", isso é violação mesmo
parecendo mais crível — a suggestion deve pedir para voltar ao que a claim "fato" realmente diz.

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
