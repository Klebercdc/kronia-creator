import { DEFAULT_TARGET_ID, getTargetProfile } from "./target-profiles";
import type { TargetProfile, TargetSelectionMode } from "./schemas";

export interface ResolvedTarget {
  profile: TargetProfile;
  selectionMode: TargetSelectionMode;
}

/**
 * Target Resolver — Fase 1 só implementa 2 dos 3 modos do contrato:
 *   - user_selected: usuário escolheu um targetId explícito.
 *   - default_target: fallback fixo (DEFAULT_TARGET_ID) quando nada foi
 *     escolhido. NUNCA chamado de "automático inteligente" em lugar
 *     nenhum da UI/copy.
 * O terceiro modo (automatic_target_selection, via capability matching +
 * ranking) fica só no contrato de TargetProfile (capabilities/
 * requiredCapabilities) — sem lógica de ranking rodando nesta fase.
 */
export function resolveTarget(userTargetId: string | null): ResolvedTarget {
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
  return { profile: fallback, selectionMode: "default_target" };
}
