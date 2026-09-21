import type { ReferenceLock } from "../../types/reference-studio";
import type { CreativeSpec } from "../intelligence/creative/schemas";

const BLOCKS = {
  character: ["[REFERENCE_LOCKS:CHARACTER]", "[/REFERENCE_LOCKS:CHARACTER]"],
  product: ["[REFERENCE_LOCKS:PRODUCT]", "[/REFERENCE_LOCKS:PRODUCT]"],
  style: ["[REFERENCE_LOCKS:STYLE]", "[/REFERENCE_LOCKS:STYLE]"],
} as const;

function activeLocks(locks: ReferenceLock[], types: ReferenceLock["type"][]): ReferenceLock[] {
  const rank = { critical: 0, high: 1, normal: 2 } as const;
  return locks
    .filter((item) => !item.variable && types.includes(item.type))
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id));
}

function renderLocks(locks: ReferenceLock[]): string {
  return locks.map((item) => `${item.type}/${item.attribute}: ${item.value}`).join("; ");
}

function replaceManagedBlock(
  original: string | null,
  kind: keyof typeof BLOCKS,
  locks: ReferenceLock[],
): string | null {
  const [start, end] = BLOCKS[kind];
  const escapedStart = start.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const escapedEnd = end.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const withoutPrevious = (original ?? "")
    .replace(new RegExp(`\\s*${escapedStart}[\\s\\S]*?${escapedEnd}`, "g"), "")
    .trim();

  if (!locks.length) return withoutPrevious || null;

  const managed = `${start} ${renderLocks(locks)} ${end}`;
  return [withoutPrevious, managed].filter(Boolean).join(" ");
}

/**
 * Aplica locks de forma determinística e idempotente. Cada categoria só entra
 * no campo correspondente; blocos gerenciados anteriores são substituídos,
 * evitando duplicação depois de repairs sucessivos.
 */
export function applyReferenceLocks(spec: CreativeSpec, locks: ReferenceLock[]): CreativeSpec {
  if (!locks.length) return spec;

  const characterLocks = activeLocks(locks, ["identity", "body", "wardrobe", "voice_performance"]);
  const productLocks = activeLocks(locks, ["product_identity", "product_fidelity", "product_scale"]);
  const styleLocks = activeLocks(locks, ["style_pattern"]);
  const negativeLocks = activeLocks(locks, ["negative_visual"]);
  const negativeValues = negativeLocks.map((item) => item.value);
  const unknown = Array.from(new Set([...spec.productTruth.unknown, ...negativeValues]));

  return {
    ...spec,
    characterConsistency: replaceManagedBlock(spec.characterConsistency, "character", characterLocks),
    brandConstraints: replaceManagedBlock(spec.brandConstraints, "product", productLocks),
    productTruth: {
      ...spec.productTruth,
      unknown,
    },
    directorSpec: {
      ...spec.directorSpec,
      continuityNotes: replaceManagedBlock(spec.directorSpec.continuityNotes, "style", styleLocks),
    },
  };
}
