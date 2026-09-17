import type { TargetSpecificSpec } from "./target-specialists";

export interface CompiledPrompt {
  promptText: string;
  negativePrompt: string | null;
}

function formatShotSequence(
  shotPattern: NonNullable<TargetSpecificSpec["spec"]["shotPattern"]>,
  targetId: string,
): string[] {
  const lines: string[] = [];
  const { shots, totalDurationSeconds } = shotPattern;

  if (targetId === "flow") {
    lines.push(`Timeline SceneBuilder (${totalDurationSeconds}s total, ${shots.length} clipe${shots.length > 1 ? "s" : ""} conectado${shots.length > 1 ? "s" : ""}):`);
    shots.forEach((shot, position) => {
      lines.push(`  Clipe ${position + 1} [${shot.durationSeconds}s]: ${shot.action} (câmera: ${shot.camera}, função: ${shot.function})`);
    });
  } else if (targetId === "kling") {
    lines.push(`Sequência (${totalDurationSeconds}s total, movimento-only por shot):`);
    shots.forEach((shot, position) => {
      lines.push(`  ${position + 1}. [${shot.durationSeconds}s] Movimento: ${shot.action}, câmera ${shot.camera}.`);
    });
  } else {
    lines.push(`Sequência de shots (${totalDurationSeconds}s total):`);
    shots.forEach((shot, position) => {
      lines.push(`  ${position + 1}. [${shot.durationSeconds}s, ${shot.function}] ${shot.action} — câmera: ${shot.camera}`);
    });
  }

  return lines;
}

/**
 * Prompt Compiler — determinístico, código puro, ZERO chamada de LLM.
 * Reference locks são compilados aqui, depois de serem aplicados em código
 * ao CreativeSpec. Assim identidade, produto e continuidade não dependem
 * da memória do LLM e sobrevivem ao Target Specialist.
 */
export function compilePrompt({ spec, targetConstraints, targetId }: TargetSpecificSpec): CompiledPrompt {
  const lines: string[] = [];

  lines.push(`Formato: ${spec.format}. Padrão criativo: ${spec.pattern}. Mecânica visual: ${spec.mechanic}.`);

  if (spec.characterConsistency) lines.push(`Identidade/personagem — invariantes: ${spec.characterConsistency}.`);
  if (spec.brandConstraints) lines.push(`Produto — invariantes: ${spec.brandConstraints}.`);
  if (spec.directorSpec.continuityNotes) lines.push(`Continuidade: ${spec.directorSpec.continuityNotes}.`);

  if (spec.directorSpec.framing) lines.push(`Enquadramento: ${spec.directorSpec.framing}.`);
  if (spec.directorSpec.cameraMovement) lines.push(`Movimento de câmera: ${spec.directorSpec.cameraMovement}.`);
  if (spec.directorSpec.lighting) lines.push(`Iluminação: ${spec.directorSpec.lighting}.`);
  if (spec.directorSpec.environment) lines.push(`Ambiente: ${spec.directorSpec.environment}.`);

  if (spec.media === "video" && spec.shotPattern) {
    lines.push(...formatShotSequence(spec.shotPattern, targetId));
    if (spec.videoSpec?.aspectRatio) lines.push(`Aspect ratio: ${spec.videoSpec.aspectRatio}.`);
  } else if (spec.media === "image") {
    if (spec.imageSpec?.composition) lines.push(`Composição: ${spec.imageSpec.composition}.`);
    if (spec.imageSpec?.subjectPlacement) lines.push(`Posição do sujeito: ${spec.imageSpec.subjectPlacement}.`);
    if (spec.imageSpec?.depthOfField) lines.push(`Profundidade de campo: ${spec.imageSpec.depthOfField}.`);
    if (spec.imageSpec?.aspectRatio) lines.push(`Aspect ratio: ${spec.imageSpec.aspectRatio}.`);
  }

  if (spec.dialogueSpec?.hasDialogue && spec.dialogueSpec.lines) {
    lines.push(`Diálogo: ${spec.dialogueSpec.lines.join(" / ")}`);
  }

  const confirmedFacts = spec.productTruth.confirmed.map((c) => c.text);
  if (confirmedFacts.length > 0) {
    lines.push(`Características confirmadas do produto (não alterar/inventar além disso): ${confirmedFacts.join("; ")}.`);
  }
  if (spec.productTruth.unknown.length > 0) {
    lines.push(`Não mostrar/afirmar (desconhecido): ${spec.productTruth.unknown.join("; ")}.`);
  }

  if (targetConstraints.length > 0) {
    lines.push(`Restrições do target: ${targetConstraints.join(" ")}`);
  }

  const negativeParts: string[] = [];
  if (spec.productTruth.unknown.length > 0) {
    negativeParts.push(...spec.productTruth.unknown.map((u) => `no ${u}`));
  }

  return {
    promptText: lines.join("\n"),
    negativePrompt: negativeParts.length > 0 ? negativeParts.join(", ") : null,
  };
}
