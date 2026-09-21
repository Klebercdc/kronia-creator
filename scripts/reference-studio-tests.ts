import assert from "node:assert/strict";
import { applyReferenceLocks } from "../src/core/reference-studio/apply-locks";
import type { CreativeSpec } from "../src/core/intelligence/creative/schemas";
import type { ReferenceLock } from "../src/types/reference-studio";

const spec: CreativeSpec = {
  version: "v1",
  media: "video",
  format: "ugc",
  pattern: "demonstration",
  mechanic: "try_on",
  shotPattern: {
    shots: [{ index: 0, function: "demo", durationSeconds: 5, camera: "fixed", action: "show product" }],
    totalDurationSeconds: 5,
  },
  directorSpec: {
    framing: null,
    cameraMovement: null,
    lighting: null,
    environment: null,
    continuityNotes: "Preserve scene.",
  },
  productTruth: { observed: [], confirmed: [], inferred: [], recommended: [], unknown: [] },
  imageSpec: null,
  videoSpec: { aspectRatio: "9:16", durationSeconds: 5 },
  dialogueSpec: null,
  characterConsistency: "Keep natural expression.",
  brandConstraints: "Keep visible logo.",
  reasoning: "Safe demonstration.",
};

const locks: ReferenceLock[] = [
  {
    id: "identity-1",
    type: "identity",
    attribute: "face",
    value: "same face",
    priority: "critical",
    sourceEvidenceIds: ["e1"],
    variable: false,
  },
  {
    id: "product-1",
    type: "product_fidelity",
    attribute: "color",
    value: "yellow",
    priority: "critical",
    sourceEvidenceIds: ["e2"],
    variable: false,
  },
  {
    id: "style-1",
    type: "style_pattern",
    attribute: "camera",
    value: "fixed camera",
    priority: "high",
    sourceEvidenceIds: ["e3"],
    variable: false,
  },
  {
    id: "negative-1",
    type: "negative_visual",
    attribute: "extra_product",
    value: "extra products",
    priority: "critical",
    sourceEvidenceIds: ["e4"],
    variable: false,
  },
];

const once = applyReferenceLocks(spec, locks);
const twice = applyReferenceLocks(once, locks);

assert.deepEqual(twice, once, "lock application must be idempotent");
assert.match(once.characterConsistency ?? "", /same face/);
assert.doesNotMatch(once.characterConsistency ?? "", /yellow|fixed camera/);
assert.match(once.brandConstraints ?? "", /yellow/);
assert.doesNotMatch(once.brandConstraints ?? "", /same face|fixed camera/);
assert.match(once.directorSpec.continuityNotes ?? "", /fixed camera/);
assert.doesNotMatch(once.directorSpec.continuityNotes ?? "", /same face|yellow/);
assert.deepEqual(once.productTruth.unknown, ["extra products"]);

console.log("Reference Studio locks: OK");
