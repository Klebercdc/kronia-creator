import type {
  ReferenceEvidence,
  ReferenceLock,
  ReferenceLockType,
  ReferenceProfile,
} from "../../types/reference-studio";

function lock(
  id: string,
  type: ReferenceLockType,
  item: ReferenceEvidence,
  priority: ReferenceLock["priority"] = "high",
): ReferenceLock {
  return {
    id,
    type,
    attribute: item.attribute,
    value: item.value,
    priority,
    sourceEvidenceIds: [item.id],
    variable: false,
  };
}

/**
 * Converte evidências observadas em invariantes candidatos.
 * Não cria atributos: só trava evidências existentes e deixa a revisão humana
 * decidir o que realmente deve permanecer invariável.
 */
export function deriveCandidateLocks(profile: ReferenceProfile): ReferenceLock[] {
  const locks: ReferenceLock[] = [];

  for (const item of profile.character?.identity ?? []) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-identity-${item.id}`, "identity", item, "critical"));
    }
  }

  for (const item of profile.character?.body ?? []) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-body-${item.id}`, "body", item));
    }
  }

  for (const item of profile.character?.wardrobe ?? []) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-wardrobe-${item.id}`, "wardrobe", item));
    }
  }

  for (const item of profile.character?.voicePerformance ?? []) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-voice-${item.id}`, "voice_performance", item));
    }
  }

  for (const item of profile.product?.visualAttributes ?? []) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-product-identity-${item.id}`, "product_identity", item, "critical"));
      locks.push(lock(`lock-product-fidelity-${item.id}`, "product_fidelity", item, "critical"));
    }
  }

  for (const item of profile.style?.hook ?? []) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-style-hook-${item.id}`, "style_pattern", item));
    }
  }
  for (const item of [
    ...(profile.style?.structure ?? []),
    ...(profile.style?.pacing ?? []),
    ...(profile.style?.framing ?? []),
    ...(profile.style?.camera ?? []),
  ]) {
    if (item.kind === "observed" || item.kind === "user_provided") {
      locks.push(lock(`lock-style-${item.id}`, "style_pattern", item));
    }
  }

  return locks;
}
