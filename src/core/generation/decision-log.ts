import { z } from "zod";
import { GenerationResultSchema, type DecisionLogEntry, type GenerationResult } from "../../types/pipeline";

/** Campos transitórios pedidos à LLM junto do resultado principal — nunca
 * fazem parte do GenerationResult persistido diretamente; viram 1 entrada
 * de decisionLog, montada em código (ver appendDecisionLog). */
export const DecisionLogFieldsSchema = z.object({
  decisaoResumo: z.string(),
  motivoDecisao: z.string(),
  alternativasDescartadas: z.array(z.string()).optional(),
});

/** Schema pra agentes que REVISAM um GenerationResult já existente (recebem
 * o objeto inteiro, devolvem revisado) — omite "decisionLog" de propósito:
 * a LLM nunca vê/reescreve o log acumulado como array, só devolve sua
 * própria entrada nova através dos campos de DecisionLogFieldsSchema. */
export const RevisionInferredSchema = GenerationResultSchema.omit({ decisionLog: true }).merge(DecisionLogFieldsSchema);

export const DECISION_LOG_PROMPT_BLOCK = `REGISTRO DE DECISÃO: preencha "decisaoResumo" (1 frase: o que você mudou ou manteve e por quê),
"motivoDecisao" (a razão real, específica pra ESTE produto/objetivo, nunca genérica) e, se
cabível, "alternativasDescartadas" (o que você considerou mudar e decidiu não mudar) — isso é o
que o próximo agente da cadeia lê antes de decidir se mexe no que você entregou.`;

/** Monta o GenerationResult final acrescentando 1 entrada ao decisionLog
 * acumulado (nunca apaga/reescreve entrada de outro agente — `previousLog`
 * é sempre o decisionLog do draft ANTES desta chamada). */
export function appendDecisionLog(
  inferred: z.infer<typeof RevisionInferredSchema>,
  previousLog: DecisionLogEntry[],
  agente: string,
): GenerationResult {
  const { decisaoResumo, motivoDecisao, alternativasDescartadas, ...rest } = inferred;
  const entry: DecisionLogEntry = { agente, decisao: decisaoResumo, motivo: motivoDecisao, alternativasDescartadas };
  return { ...rest, decisionLog: [...previousLog, entry] };
}
