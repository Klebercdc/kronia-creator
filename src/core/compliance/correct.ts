import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import type { ComplianceViolation } from "../../types/compliance";
import { CREATIVE_QUALITY_BAR } from "../generation/quality-bar";

/** decisionLog nunca é pedido de volta aqui — correção de compliance não é
 * um dos agentes que acrescenta entrada própria; o log acumulado é só
 * preservado (ver types/pipeline.ts). */
const CorrectInferredSchema = GenerationResultSchema.omit({ decisionLog: true });

const SYSTEM = `Você corrige um roteiro que foi reprovado no compliance.

Para cada violação listada:
1. A "suggestion" indica O QUE precisa mudar (a ideia/direção da correção), não o texto final a
   colar. Reescreva a frase INTEIRA de forma natural, mantendo o tom, o gancho e a conexão com as
   frases vizinhas da mesma cena — nunca só suavize a palavra problemática isolada (isso produz um
   texto remendado, cheio de hedge tipo "pode ajudar"/"se quiser"/"explore a oportunidade", sem
   nexo com o resto). O objetivo é uma frase que um roteirista de verdade escreveria, não uma
   frase tecnicamente corrigida mas fraca.
2. PROIBIDO justapor a sugestão e a frase original na mesma cena (ex.: "Use sua fé como parte do
   seu estilo! Com o anel, você leva sua crença com você aonde quer que vá." — a segunda frase é
   exatamente o "flaggedText" que devia ter sumido, só com uma frase nova colada na frente). A
   correção SUBSTITUI o trecho problemático — o "flaggedText" original nunca convive ao lado do
   texto novo na mesma cena, nem reformulado por perto. Se a cena tinha 1 frase problemática, a
   cena corrigida tem 1 frase (a nova), não 2.
3. Depois de corrigir, releia CADA violação da lista e confirme que o "flaggedText" original não
   aparece mais em nenhuma cena, narração ou claim do roteiro — se ainda aparecer, corrija de novo
   antes de responder. Releia também o roteiro inteiro em voz alta (mentalmente) pra garantir que
   as cenas ainda fluem uma pra outra depois da correção.

Mude apenas o necessário para resolver as violações — não reescreva cenas que não foram apontadas.

${CREATIVE_QUALITY_BAR}

Retorne o roteiro completo corrigido, no mesmo formato de entrada.`;

/** Correção direcionada às violações apontadas — nunca regeneração cega do zero. */
export async function correctForCompliance(
  generation: GenerationResult,
  violations: ComplianceViolation[],
): Promise<GenerationResult> {
  const prompt = `Roteiro atual:\n${JSON.stringify(generation, null, 2)}\n\nViolações a corrigir:\n${JSON.stringify(violations, null, 2)}`;

  const corrected = await callStructuredText({
    schema: CorrectInferredSchema,
    system: SYSTEM,
    prompt,
    toolName: "generation_result",
  });

  return { ...corrected, decisionLog: generation.decisionLog };
}

function textOf(generation: GenerationResult): string {
  return [
    ...generation.scenes.flatMap((s) => [s.narration, s.onScreenText ?? ""]),
    ...generation.claims.map((c) => c.text),
  ]
    .join(" \n ")
    .toLowerCase();
}

/** Verificação DETERMINÍSTICA (código, não confiança na LLM) de que cada
 * "flaggedText" realmente sumiu do roteiro corrigido — substring
 * case-insensitive no texto que vai pro usuário (narração/onScreenText/
 * claims). Isso é o que detecta o bug real já visto na prática: a LLM
 * "corrige" colando a sugestão do lado da frase original em vez de
 * substituir, e a frase original continua lá. */
export function findStillPresentViolations(
  generation: GenerationResult,
  violations: ComplianceViolation[],
): ComplianceViolation[] {
  const haystack = textOf(generation);
  return violations.filter((v) => v.flaggedText.trim().length > 0 && haystack.includes(v.flaggedText.toLowerCase()));
}

/**
 * Correção como operação ESTRUTURADA: substituição → validação
 * determinística de que o original sumiu → reauditoria (1 nova
 * chamada, só das violações que sobreviveram, nunca um loop
 * ilimitado). Ponto único de entrada pro Job Engine e pro pipeline
 * síncrono — os dois usam a mesma régua.
 */
export async function correctForComplianceStructured(
  generation: GenerationResult,
  violations: ComplianceViolation[],
): Promise<GenerationResult> {
  let corrected = await correctForCompliance(generation, violations);

  const stillPresent = findStillPresentViolations(corrected, violations);
  if (stillPresent.length > 0) {
    // Reauditoria: 1 nova tentativa, só nas violações que sobreviveram —
    // o validateCompliance seguinte continua sendo a rede de segurança
    // final se mesmo assim algo escapar.
    corrected = await correctForCompliance(corrected, stillPresent);
  }

  return corrected;
}
