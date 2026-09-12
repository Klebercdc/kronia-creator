import type { TargetSpecificSpec } from "./target-specialists";

export interface CompiledPrompt {
  promptText: string;
  negativePrompt: string | null;
}

/**
 * Prompt Compiler — determinístico, código puro, ZERO chamada de LLM.
 * Monta o texto final a partir do Creative Spec + constraints do target.
 * Nunca vaza nome/versão do modelo dentro do texto do prompt em si (regra
 * observada em Square-Zero-Labs/video-prompting-skill, reaproveitada como
 * conceito) — o target já é selecionado fora do prompt.
 */
export function compilePrompt({ spec, targetConstraints }: TargetSpecificSpec): CompiledPrompt {
  const lines: string[] = [];

  lines.push(`Formato: ${spec.format}. Padrão criativo: ${spec.pattern}. Mecânica visual: ${spec.mechanic}.`);

  if (spec.directorSpec.framing) lines.push(`Enquadramento: ${spec.directorSpec.framing}.`);
  if (spec.directorSpec.cameraMovement) lines.push(`Movimento de câmera: ${spec.directorSpec.cameraMovement}.`);
  if (spec.directorSpec.lighting) lines.push(`Iluminação: ${spec.directorSpec.lighting}.`);
  if (spec.directorSpec.environment) lines.push(`Ambiente: ${spec.directorSpec.environment}.`);

  if (spec.media === "video") {
    lines.push(`Sequência de shots (${spec.shotPattern.totalDurationSeconds}s total):`);
    // Numeração pela posição no array, nunca por shot.index (o LLM não garante
    // índices 0-based sequenciais, especialmente depois de um repair — visto
    // na prática: shots voltando numerados "2,3,4..." sem nenhum "1").
    spec.shotPattern.shots.forEach((shot, position) => {
      lines.push(`  ${position + 1}. [${shot.durationSeconds}s, ${shot.function}] ${shot.action} — câmera: ${shot.camera}`);
    });
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
