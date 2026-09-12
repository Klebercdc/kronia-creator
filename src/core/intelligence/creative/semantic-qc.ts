import { runPromptQc } from "./qc";
import { checkSemanticProductTruth } from "./semantic-truth";
import type { CompiledPrompt } from "./compiler";
import type { CreativeSpec, QcResult, TargetProfile } from "./schemas";

/**
 * Deterministic QC + Semantic QC (Fase 2) — composição, não substituição.
 * qc.ts continua 100% determinístico e inalterado (contrato preservado:
 * "ZERO chamada de LLM"); esta função só ADICIONA uma segunda passada
 * semântica, e só quando ela realmente agrega valor:
 *
 * 1. Roda o QC determinístico primeiro (barato, sem rede).
 * 2. Se ele já rejeitou (`repair_required`), retorna direto — não gasta
 *    uma chamada LLM confirmando uma rejeição que já vai pro repair mesmo
 *    assim (controle de custo, seção 18 do pedido de Fase 2).
 * 3. Se não há nenhuma característica `unknown`, não há o que o Semantic
 *    Truth Validator julgue — retorna direto.
 * 4. Só quando o determinístico passou (ou só gerou warning) E existe
 *    característica não confirmada é que a validação semântica roda.
 */
export async function runFullQc(compiled: CompiledPrompt, spec: CreativeSpec, profile: TargetProfile): Promise<QcResult> {
  const deterministic = runPromptQc(compiled, spec, profile);

  if (deterministic.state === "repair_required") return deterministic;
  if (spec.productTruth.unknown.length === 0) return deterministic;

  const semantic = await checkSemanticProductTruth(spec);
  if (!semantic.violatesProductTruth) return deterministic;

  return {
    state: "repair_required",
    issues: [
      ...deterministic.issues,
      `Semantic Product Truth: demonstração implícita de característica não confirmada (${semantic.violatedProperties.join(", ")}) — ${semantic.explanation}`,
    ],
  };
}
