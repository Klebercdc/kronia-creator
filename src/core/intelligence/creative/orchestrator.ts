import { randomUUID } from "node:crypto";
import { generateCreativeSpec, type CreativeReasoningInput } from "./reasoning";
import { evaluateCreativeSpec } from "./evaluation";
import { resolveTarget } from "./target-resolver";
import { resolveSpecialist } from "./target-specialists";
import { compilePrompt } from "./compiler";
import { runFullQc } from "./semantic-qc";
import { repairCreativeSpec } from "./repair";
import { buildReferenceGrammar } from "./reference-grammar";
import { CREATIVE_QC_MAX_ATTEMPTS, type CreativeEvaluation, type CreativeSpec, type PromptArtifact } from "./schemas";
import type { VideoAnalysis } from "../../../types/video-analysis";

export interface BuildCreativePromptInput extends Omit<CreativeReasoningInput, "referenceGrammar"> {
  targetId: string | null;
  /** Fase 2B — análise (já pronta, vinda do Job Engine) de um vídeo de
   * referência opcional. A conversão pra gramática criativa (texto,
   * nunca fala/identidade literal) acontece aqui, em código — ver
   * reference-grammar.ts. */
  referenceAnalysis: VideoAnalysis | null;
}

export interface BuildCreativePromptResult {
  spec: CreativeSpec;
  evaluation: CreativeEvaluation;
  artifact: PromptArtifact | null;
}

/**
 * Orquestra o fluxo completo:
 *   Creative Reasoning -> Creative Evaluation -> Target Resolver ->
 *   Target Specialist -> Prompt Compiler -> QC (determinístico +
 *   semântico, ver semantic-qc.ts) -> Repair (até CREATIVE_QC_MAX_ATTEMPTS)
 *   -> Creative Evaluation de novo -> ... -> resultado final.
 *
 * Fase 2: `runFullQc` (semantic-qc.ts) compõe o QC determinístico
 * existente (qc.ts, inalterado, continua zero-LLM) com uma segunda
 * passada semântica (semantic-truth.ts, 1 chamada LLM) que só roda quando
 * o determinístico não rejeitou de cara E existe característica
 * `unknown` — controle de custo: não gasta a chamada semântica quando o
 * determinístico já é suficiente pra decidir.
 *
 * Se a Creative Evaluation reprovar (verdict "fail" — product truth
 * violado), o fluxo PARA antes de compilar: `artifact` vem null e a
 * evaluation carrega o motivo. Nunca gera um prompt em cima de uma
 * intenção que já falhou na avaliação. Isso vale tanto pra spec original
 * quanto pra spec que saiu de um repair (correção de auditoria: repair é
 * uma chamada LLM livre pra reescrever format/pattern/mechanic/shots/
 * directorSpec — sem reavaliar depois, uma correção podia sair coerente
 * o suficiente pro Prompt QC (que olha duração/overload/claims, não
 * coerência formato↔padrão↔mecânica) mas incoerente pra Creative
 * Evaluation, e isso nunca era pego).
 *
 * Se o Prompt QC não passar depois do teto de repair, `artifact.status`
 * vem "manual_review_required" — nunca "ready" mascarado (mesmo princípio
 * do Compliance existente).
 */
export async function buildCreativePrompt(input: BuildCreativePromptInput): Promise<BuildCreativePromptResult> {
  const referenceGrammar = input.referenceAnalysis ? buildReferenceGrammar(input.referenceAnalysis) : null;
  const spec = await generateCreativeSpec({ ...input, referenceGrammar });
  let evaluation = evaluateCreativeSpec(spec);

  if (evaluation.verdict === "fail") {
    return { spec, evaluation, artifact: null };
  }

  const { profile, selectionMode } = resolveTarget(input.targetId, spec);
  const specialist = resolveSpecialist(profile.id);

  let currentSpec = spec;
  let attempt = 0;
  for (;;) {
    const targetSpecific = specialist(currentSpec, profile);
    const compiled = compilePrompt(targetSpecific);
    const qc = await runFullQc(compiled, currentSpec, profile);

    if (qc.state === "pass" || qc.state === "warning") {
      return {
        spec: currentSpec,
        evaluation,
        artifact: {
          id: randomUUID(),
          version: "v1",
          specVersion: "v1",
          targetId: profile.id,
          targetKind: profile.kind,
          targetSelectionMode: selectionMode,
          promptText: compiled.promptText,
          negativePrompt: compiled.negativePrompt,
          qc,
          status: "ready",
        },
      };
    }

    if (attempt >= CREATIVE_QC_MAX_ATTEMPTS) {
      return {
        spec: currentSpec,
        evaluation,
        artifact: {
          id: randomUUID(),
          version: "v1",
          specVersion: "v1",
          targetId: profile.id,
          targetKind: profile.kind,
          targetSelectionMode: selectionMode,
          promptText: compiled.promptText,
          negativePrompt: compiled.negativePrompt,
          qc,
          status: "manual_review_required",
        },
      };
    }

    attempt += 1;
    currentSpec = await repairCreativeSpec(currentSpec, qc.issues);

    // Revalidação determinística (evaluateCreativeSpec continua sem LLM —
    // nenhuma chamada nova aqui) da spec que voltou do repair. O repair tem
    // liberdade pra reescrever format/pattern/mechanic/shotPattern/
    // directorSpec pra resolver o problema do QC; sem essa revalidação, uma
    // correção podia introduzir uma incoerência que só a Creative
    // Evaluation original checava (formato↔padrão↔mecânica, shot sequence,
    // product truth) e nunca seria pega, já que o Prompt QC verifica outra
    // coisa. Se falhar, é falha de integridade: nunca compila, nunca
    // retorna ready — mesmo "comportamento seguro" do caminho de avaliação
    // inicial.
    evaluation = evaluateCreativeSpec(currentSpec);
    if (evaluation.verdict === "fail") {
      return { spec: currentSpec, evaluation, artifact: null };
    }
  }
}
