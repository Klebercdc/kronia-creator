import { randomUUID } from "node:crypto";
import { generateCreativeSpec, type CreativeReasoningInput } from "./reasoning";
import { evaluateCreativeSpec } from "./evaluation";
import { resolveTarget } from "./target-resolver";
import { resolveSpecialist } from "./target-specialists";
import { compilePrompt } from "./compiler";
import { runPromptQc } from "./qc";
import { repairCreativeSpec } from "./repair";
import { CREATIVE_QC_MAX_ATTEMPTS, type CreativeEvaluation, type CreativeSpec, type PromptArtifact } from "./schemas";

export interface BuildCreativePromptInput extends CreativeReasoningInput {
  targetId: string | null;
}

export interface BuildCreativePromptResult {
  spec: CreativeSpec;
  evaluation: CreativeEvaluation;
  artifact: PromptArtifact | null;
}

/**
 * Orquestra o fluxo completo:
 *   Creative Reasoning -> Creative Evaluation -> Target Resolver ->
 *   Target Specialist -> Prompt Compiler -> Prompt QC -> Repair (até
 *   CREATIVE_QC_MAX_ATTEMPTS) -> resultado final.
 *
 * Se a Creative Evaluation reprovar (verdict "fail" — product truth
 * violado), o fluxo PARA antes de compilar: `artifact` vem null e a
 * evaluation carrega o motivo. Nunca gera um prompt em cima de uma
 * intenção que já falhou na avaliação.
 *
 * Se o Prompt QC não passar depois do teto de repair, `artifact.status`
 * vem "manual_review_required" — nunca "ready" mascarado (mesmo princípio
 * do Compliance existente).
 */
export async function buildCreativePrompt(input: BuildCreativePromptInput): Promise<BuildCreativePromptResult> {
  const spec = await generateCreativeSpec(input);
  const evaluation = evaluateCreativeSpec(spec);

  if (evaluation.verdict === "fail") {
    return { spec, evaluation, artifact: null };
  }

  const { profile } = resolveTarget(input.targetId);
  const specialist = resolveSpecialist(profile.id);

  let currentSpec = spec;
  let attempt = 0;
  for (;;) {
    const targetSpecific = specialist(currentSpec, profile);
    const compiled = compilePrompt(targetSpecific);
    const qc = runPromptQc(compiled, currentSpec, profile);

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
          promptText: compiled.promptText,
          negativePrompt: compiled.negativePrompt,
          qc,
          status: "manual_review_required",
        },
      };
    }

    attempt += 1;
    currentSpec = await repairCreativeSpec(currentSpec, qc.issues);
  }
}
