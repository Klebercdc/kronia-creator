import type { TargetSpecificSpec } from "./target-specialists";

export interface CompiledPrompt {
  promptText: string;
  negativePrompt: string | null;
}

/**
 * Formata a sequência de shots — varia por target (Fase 2: Prompt Compiler
 * target-aware), mas sem NUNCA tocar as linhas de Product Truth/exclusão
 * que vêm depois (confirmado/desconhecido/restrições) — essas continuam
 * idênticas pra qualquer target, é só a descrição da ação visual que muda
 * de formato. Numeração sempre pela posição no array, nunca por
 * `shot.index` (o LLM não garante índices 0-based sequenciais,
 * especialmente depois de um repair — visto na prática: shots voltando
 * numerados "2,3,4..." sem nenhum "1").
 */
function formatShotSequence(
  shotPattern: NonNullable<TargetSpecificSpec["spec"]["shotPattern"]>,
  targetId: string,
): string[] {
  const lines: string[] = [];
  const { shots, totalDurationSeconds } = shotPattern;

  if (targetId === "flow") {
    // Flow monta a cena numa timeline (SceneBuilder) — vocabulário de
    // "clipe" reflete isso, cada um pensado como um clipe conectável, não
    // como um "shot" de roteiro tradicional (fonte: blog.google, ver
    // target-profiles.ts).
    lines.push(`Timeline SceneBuilder (${totalDurationSeconds}s total, ${shots.length} clipe${shots.length > 1 ? "s" : ""} conectado${shots.length > 1 ? "s" : ""}):`);
    shots.forEach((shot, position) => {
      lines.push(`  Clipe ${position + 1} [${shot.durationSeconds}s]: ${shot.action} (câmera: ${shot.camera}, função: ${shot.function})`);
    });
  } else if (targetId === "kling") {
    // Kling: convenção motion-only pra I2V confirmada no repositório de
    // referência auditado (maciejdzierzek/kling-ai-prompt-generator, MIT)
    // — descrever o MOVIMENTO, não a cena inteira; câmera entra como parte
    // do movimento, não como um campo técnico separado.
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
 * Monta o texto final a partir do Creative Spec + constraints do target.
 * Nunca vaza nome/versão do modelo dentro do texto do prompt em si (regra
 * observada em Square-Zero-Labs/video-prompting-skill, reaproveitada como
 * conceito) — o target já é selecionado fora do prompt, só a FORMATAÇÃO
 * varia por target (Fase 2), nunca a intenção criativa (mesma CreativeSpec
 * pra todos — "Prompt Portability": mesma ideia, execução textual
 * otimizada por target).
 */
export function compilePrompt({ spec, targetConstraints, targetId }: TargetSpecificSpec): CompiledPrompt {
  const lines: string[] = [];

  lines.push(`Formato: ${spec.format}. Padrão criativo: ${spec.pattern}. Mecânica visual: ${spec.mechanic}.`);

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
