import type { ReferenceLock } from "../../types/reference-studio";
import type { CreativeSpec } from "../intelligence/creative/schemas";

function renderLocks(locks: ReferenceLock[]): string {
  return locks
    .filter((item) => !item.variable)
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, normal: 2 } as const;
      return rank[a.priority] - rank[b.priority];
    })
    .map((item) => `${item.type}/${item.attribute}: ${item.value}`)
    .join("; ");
}

/** Injeta invariantes de referência depois do raciocínio LLM e antes do
 * Target Specialist/Prompt Compiler. O LLM não é a fonte da verdade dos
 * locks; eles entram de forma determinística no contrato que será compilado. */
export function applyReferenceLocks(spec: CreativeSpec, locks: ReferenceLock[]): CreativeSpec {
  if (!locks.length) return spec;

  const rendered = renderLocks(locks);
  const characterLocks = locks.filter((item) =>
    ["identity", "body", "wardrobe", "voice_performance"].includes(item.type),
  );
  const productLocks = locks.filter((item) =>
    ["product_identity", "product_fidelity", "product_scale"].includes(item.type),
  );
  const continuity = [spec.directorSpec.continuityNotes, `Reference locks: ${rendered}.`]
    .filter(Boolean)
    .join(" ");

  return {
    ...spec,
    characterConsistency: characterLocks.length ? rendered : spec.characterConsistency,
    brandConstraints: productLocks.length ? rendered : spec.brandConstraints,
    directorSpec: {
      ...spec.directorSpec,
      continuityNotes: continuity || null,
    },
  };
}
