import { DEFAULT_TARGET_ID, getTargetProfile, TARGET_PROFILES } from "./target-profiles";
import type { CreativeSpec, TargetProfile, TargetSelectionMode } from "./schemas";

export interface ResolvedTarget {
  profile: TargetProfile;
  selectionMode: TargetSelectionMode;
}

/**
 * Target Capability Matching (Fase 2) — deriva, em código e a partir do
 * CreativeSpec real (nunca perguntado ao LLM), quais capabilities essa
 * execução específica realmente precisa. Lista pequena e literal de
 * propósito: só capabilities que o spec efetivamente usa, nunca uma
 * lista especulativa.
 */
export function deriveRequiredCapabilities(spec: CreativeSpec): string[] {
  const required: string[] = [];
  if (spec.media === "video") {
    required.push("text_to_video");
    if (spec.shotPattern && spec.shotPattern.shots.length > 1) required.push("multi_shot");
  }
  if (spec.media === "image") {
    required.push("image_generation");
  }
  if (spec.dialogueSpec?.hasDialogue) required.push("audio_native");
  if (spec.characterConsistency) required.push("character_reference");
  return required;
}

/**
 * Score determinístico: capability confirmada ("supported") soma, capability
 * confirmada como ausente ("unsupported") penaliza forte (nunca prometer o
 * que o target comprovadamente não faz), capability "unknown" não soma nem
 * penaliza — não é prova de ausência, só falta de verificação (item 17 do
 * adendo da Fase 1, preservado aqui: nunca tratar unknown como unsupported).
 */
export function scoreTarget(profile: TargetProfile, requiredCapabilities: string[]): number {
  let score = 0;
  for (const capability of requiredCapabilities) {
    const status = profile.capabilities[capability];
    if (status === "supported") score += 2;
    else if (status === "unsupported") score -= 5;
  }
  return score;
}

/** Ranking completo do registry pra um conjunto de capabilities exigidas —
 * maior score primeiro, ordem original do registry como desempate estável. */
export function rankTargets(requiredCapabilities: string[]): TargetProfile[] {
  return [...TARGET_PROFILES].sort((a, b) => scoreTarget(b, requiredCapabilities) - scoreTarget(a, requiredCapabilities));
}

/**
 * Target Resolver — 3 modos reais:
 *   - user_selected: usuário escolheu um targetId explícito, sempre respeitado.
 *   - automatic_target_selection: só quando NÃO há escolha do usuário E o
 *     ranking por capability real encontra um target com score
 *     estritamente melhor que o default pra esse spec específico — ou
 *     seja, uma capability CONFIRMADA que o spec precisa e que o default
 *     não tem confirmada (ou tem como "unsupported"). Nunca dispara só
 *     porque "parece melhor" sem diferenciação comprovada.
 *   - default_target: fallback fixo (DEFAULT_TARGET_ID) nos demais casos —
 *     inclusive quando a única diferença entre targets é capability
 *     "unknown", porque isso não é uma vitória real, é ausência de dado.
 *     NUNCA chamado de "automático inteligente" na UI/copy quando cai
 *     neste modo.
 */
export function resolveTarget(userTargetId: string | null, spec?: CreativeSpec): ResolvedTarget {
  if (userTargetId) {
    const profile = getTargetProfile(userTargetId);
    if (profile) {
      return { profile, selectionMode: "user_selected" };
    }
  }

  const fallback = getTargetProfile(DEFAULT_TARGET_ID);
  if (!fallback) {
    throw new Error(`DEFAULT_TARGET_ID "${DEFAULT_TARGET_ID}" não existe no registry de targets.`);
  }

  if (spec) {
    const required = deriveRequiredCapabilities(spec);
    if (required.length > 0) {
      const ranked = rankTargets(required);
      const best = ranked[0];
      const bestScore = scoreTarget(best, required);
      const defaultScore = scoreTarget(fallback, required);
      if (best.id !== fallback.id && bestScore > defaultScore) {
        return { profile: best, selectionMode: "automatic_target_selection" };
      }
    }
  }

  return { profile: fallback, selectionMode: "default_target" };
}
