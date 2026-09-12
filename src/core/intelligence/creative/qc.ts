import type { CreativeSpec, QcResult, TargetProfile } from "./schemas";
import type { CompiledPrompt } from "./compiler";

const OVERLOAD_ACTIONS_PER_SECOND = 0.5; // >1 ação a cada ~2s já é overload nesta heurística

function countActionClauses(action: string): number {
  return action
    .split(/,| e | then | depois /i)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

/**
 * Prompt QC — determinístico, ZERO chamada de LLM. Avalia o PROMPT
 * COMPILADO (depois do compile) — nunca a intenção/CreativeSpec, isso é
 * papel do Creative Evaluation (evaluation.ts), que roda ANTES do compile.
 */
export function runPromptQc(compiled: CompiledPrompt, spec: CreativeSpec, profile: TargetProfile): QcResult {
  const issues: string[] = [];

  if (spec.media === "video") {
    const sumShots = spec.shotPattern.shots.reduce((acc, s) => acc + s.durationSeconds, 0);
    if (Math.abs(sumShots - spec.shotPattern.totalDurationSeconds) > 0.5) {
      issues.push(
        `Duração dos shots (${sumShots}s) não bate com a duração total declarada (${spec.shotPattern.totalDurationSeconds}s).`,
      );
    }

    spec.shotPattern.shots.forEach((shot, position) => {
      const clauses = countActionClauses(shot.action);
      const maxClauses = Math.max(1, Math.ceil(shot.durationSeconds * OVERLOAD_ACTIONS_PER_SECOND));
      if (clauses > maxClauses) {
        issues.push(
          `Shot ${position + 1} (${shot.durationSeconds}s) tem ${clauses} ações — excesso de ações pra duração curta (shot overload).`,
        );
      }
    });
  }

  if (spec.dialogueSpec?.hasDialogue) {
    const audioCapability = profile.capabilities["audio_native"];
    if (audioCapability === "unsupported") {
      issues.push(`Diálogo pedido, mas "${profile.name}" não suporta áudio nativo (audio_native: unsupported).`);
    }
  }

  for (const unknownTerm of spec.productTruth.unknown) {
    const negativeLine = compiled.negativePrompt ?? "";
    const restOfPrompt = compiled.promptText.replace(/Não mostrar\/afirmar \(desconhecido\):.*$/m, "");
    if (restOfPrompt.toLowerCase().includes(unknownTerm.toLowerCase()) && !negativeLine.toLowerCase().includes(unknownTerm.toLowerCase())) {
      issues.push(`Característica não confirmada "${unknownTerm}" aparece fora da lista de exclusão — possível claim não suportada.`);
    }
  }

  if (issues.length === 0) {
    return { state: "pass", issues: [] };
  }

  const hasHardFailure = issues.some((i) => i.includes("claim não suportada") || i.includes("shot overload"));
  return { state: hasHardFailure ? "repair_required" : "warning", issues };
}
