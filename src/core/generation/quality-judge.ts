import { z } from "zod";
import { callStructuredText } from "../../lib/openai";
import { GenerationResultSchema, type GenerationResult } from "../../types/pipeline";
import { CREATIVE_QUALITY_BAR } from "./quality-bar";

/** decisionLog nunca é pedido de volta aqui — reviseForQuality não é um dos
 * agentes que acrescenta entrada própria (só Recomendação/Creative
 * Director/Roteirista/Marketing/Teólogo/Persuasão-e-Psicologia/
 * Cinematográfico fazem isso); o log acumulado é só preservado. */
const ReviseInferredSchema = GenerationResultSchema.omit({ decisionLog: true });

/**
 * Quality Judge — etapa nova entre o Cinematográfico e o Compliance.
 * Compliance julga risco legal/política (claim sem evidência, linguagem
 * proibida); isso aqui julga QUALIDADE CRIATIVA (genérico, clichê,
 * roteiro que serviria pra qualquer produto) — eixo diferente, por isso
 * é um agente separado, não uma regra a mais dentro do Compliance.
 *
 * Notas vêm da LLM; o VEREDITO (pass/needs_revision) é decidido em
 * CÓDIGO a partir das notas — mesmo princípio já usado no resto do
 * Creative Intelligence (LLM interpreta, código decide o contrato),
 * pra não depender só do juízo textual solto do modelo.
 */
const QualityScoresSchema = z.object({
  especificidade: z.number().min(0).max(10),
  naturalidade: z.number().min(0).max(10),
  persuasao: z.number().min(0).max(10),
  aderenciaProduto: z.number().min(0).max(10),
});

const QualityJudgmentInferredSchema = z.object({
  scores: QualityScoresSchema,
  weakestPoint: z.string(),
  revisionInstruction: z.string(),
});

export interface QualityJudgment {
  scores: z.infer<typeof QualityScoresSchema>;
  verdict: "pass" | "needs_revision";
  weakestPoint: string;
  revisionInstruction: string;
}

const JUDGE_SYSTEM = `Você é o Quality Judge do KRONIA — não escreve nada, só avalia com rigor o
roteiro que os outros agentes produziram, procurando motivo pra REPROVAR conteúdo mediano.

${CREATIVE_QUALITY_BAR}

Dê nota de 0 a 10 em 4 eixos:
- especificidade: essa cópia é específica DESTE produto, ou serviria pra qualquer produto do
  mesmo nicho só trocando o nome?
- naturalidade: soa como um roteirista humano escreveu, ou como texto de IA (hedge, clichê,
  frase remendada)?
- persuasao: o roteiro realmente dá motivo pra prestar atenção/acreditar/agir, ou é só bonito?
- aderenciaProduto: o roteiro usa o produto real (características/claims fornecidas) como
  evidência central, ou o produto é só decoração no final?

"weakestPoint": aponte o trecho/cena mais fraco, específico (não uma nota genérica).
"revisionInstruction": se alguma nota estiver abaixo de 7, escreva uma instrução CIRÚRGICA de
correção (o que mudar, onde, por quê) — nunca "melhore o roteiro" genérico. Se tudo estiver
forte, ainda aponte o ponto relativamente mais fraco (sempre existe um), mesmo que não precise
de correção.`;

function computeVerdict(scores: z.infer<typeof QualityScoresSchema>): "pass" | "needs_revision" {
  const values = Object.values(scores);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const anyBelow7 = values.some((v) => v < 7);
  return average < 8 || anyBelow7 ? "needs_revision" : "pass";
}

export async function judgeQuality(draft: GenerationResult): Promise<QualityJudgment> {
  const prompt = `Roteiro para avaliação de qualidade criativa:\n${JSON.stringify(draft, null, 2)}`;

  const inferred = await callStructuredText({
    schema: QualityJudgmentInferredSchema,
    system: JUDGE_SYSTEM,
    prompt,
    toolName: "quality_judgment",
  });

  return { ...inferred, verdict: computeVerdict(inferred.scores) };
}

const REVISE_SYSTEM = `Você reescreve um roteiro a partir de UMA instrução cirúrgica de qualidade
criativa (não de compliance/legal — isso é sobre a peça ficar mais específica, natural e
persuasiva, nunca sobre risco legal).

${CREATIVE_QUALITY_BAR}

Aplique a instrução no trecho indicado, mantendo o resto do roteiro como está — não reescreva
cenas que não foram apontadas. Nunca invente característica, benefício ou prova do produto que
não esteja nas claims já existentes no roteiro — reforçar qualidade não é licença pra inventar.
Retorne o roteiro completo, no mesmo formato de entrada.`;

/** 1 revisão direcionada — nunca um loop (o Compliance já tem o dele
 * depois; empilhar dois loops de correção custaria caro sem ganho real). */
export async function reviseForQuality(draft: GenerationResult, instruction: string): Promise<GenerationResult> {
  const prompt = `Roteiro atual:\n${JSON.stringify(draft, null, 2)}\n\nInstrução de revisão:\n${instruction}`;

  const revised = await callStructuredText({
    schema: ReviseInferredSchema,
    system: REVISE_SYSTEM,
    prompt,
    toolName: "generation_result",
  });

  return { ...revised, decisionLog: draft.decisionLog };
}
