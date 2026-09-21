import { randomUUID } from "node:crypto";
import { generateCreativeSpec, type CreativeReasoningInput } from "./reasoning";
import { evaluateCreativeSpec } from "./evaluation";
import { resolveTarget } from "./target-resolver";
import { resolveSpecialist } from "./target-specialists";
import { compilePrompt } from "./compiler";
import { runFullQc } from "./semantic-qc";
import { repairCreativeSpec } from "./repair";
import { buildReferenceGrammar } from "./reference-grammar";
import { applyReferenceLocks } from "../../reference-studio/apply-locks";
import { CREATIVE_QC_MAX_ATTEMPTS, type CreativeEvaluation, type CreativeSpec, type PromptArtifact } from "./schemas";
import type { ReferenceContext, ReferenceLock } from "../../../types/reference-studio";
import type { VideoAnalysis } from "../../../types/video-analysis";

export interface BuildCreativePromptInput extends Omit<CreativeReasoningInput, "referenceGrammar"> {
  targetId: string | null;
  /** Fase 2B — análise (já pronta, vinda do Job Engine) de um vídeo de
   * referência opcional. A conversão pra gramática criativa (texto,
   * nunca fala/identidade literal) acontece aqui — ver reference-grammar.ts. */
  referenceAnalysis: VideoAnalysis | null;
  /** Invariantes visuais vindos do Reference Studio. São aplicados em código
   * antes da compilação, portanto o LLM não é a fonte de verdade dos locks. */
  referenceContext?: ReferenceContext;
}

export interface BuildCreativePromptResult {
  spec: CreativeSpec;
  evaluation: CreativeEvaluation;
  artifact: PromptArtifact | null;
}

/**
 * Orquestra o fluxo completo:
 * Creative Reasoning -> Creative Evaluation -> Target Resolver ->
 * Target Specialist -> Prompt Compiler -> QC -> Repair -> QC.
 *
 * Reference Studio entra como camada transversal: locks são aplicados
 * deterministicamente após o raciocínio inicial e novamente após cada repair,
 * impedindo que uma correção LLM remova invariantes de identidade/produto.
 */
function resolveReferenceLocks(context?: ReferenceContext): ReferenceLock[] {
  if (!context) return [];
  const negativeLocks: ReferenceLock[] = context.negativeConstraints.map((value, index) => ({
    id: `context-negative-${index}`,
    type: "negative_visual",
    attribute: "negative_visual",
    value,
    priority: "critical",
    sourceEvidenceIds: [],
    variable: false,
  }));
  return [...context.locks, ...negativeLocks];
}

export async function buildCreativePrompt(input: BuildCreativePromptInput): Promise<BuildCreativePromptResult> {
  const referenceGrammar = input.referenceAnalysis ? buildReferenceGrammar(input.referenceAnalysis) : null;
  const referenceLocks = resolveReferenceLocks(input.referenceContext);
  let spec = await generateCreativeSpec({ ...input, referenceGrammar });
  spec = applyReferenceLocks(spec, referenceLocks);
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
    currentSpec = applyReferenceLocks(currentSpec, referenceLocks);

    evaluation = evaluateCreativeSpec(currentSpec);
    if (evaluation.verdict === "fail") {
      return { spec: currentSpec, evaluation, artifact: null };
    }
  }
}
