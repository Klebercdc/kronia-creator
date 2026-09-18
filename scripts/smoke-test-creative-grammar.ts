import assert from "node:assert/strict";
import { resolveCreativeGrammar, projectGrammarToShotPattern } from "../src/core/intelligence/creative/grammar";

const first = resolveCreativeGrammar({
  format: "unboxing",
  pattern: "receive_open_reveal_showcase",
  mechanic: "unboxing",
  seed: "grammar-test-a",
  productPresent: true,
});

assert.equal(first.format, "unboxing");
assert.equal(first.pattern, "receive_open_reveal_showcase");
assert.ok(first.beats.length >= 1);
assert.ok(first.camera.length >= 1);
assert.ok(first.productInteraction.length >= 1);
assert.ok(first.realism.includes("REALISTIC_MOTION"));

const second = resolveCreativeGrammar({
  format: "unboxing",
  pattern: "receive_open_reveal_showcase",
  mechanic: "unboxing",
  seed: "grammar-test-b",
  productPresent: true,
});

assert.notDeepEqual(
  { mechanic: first.mechanic, camera: first.camera, environment: first.environment, performance: first.performance },
  { mechanic: second.mechanic, camera: second.camera, environment: second.environment, performance: second.performance },
  "different production seeds should be able to produce materially different grammar combinations",
);

const shotPattern = projectGrammarToShotPattern(
  {
    shots: [
      { index: 0, function: "hook", durationSeconds: 3, camera: "old", action: "old" },
      { index: 1, function: "demo", durationSeconds: 4, camera: "old", action: "old" },
      { index: 2, function: "payoff", durationSeconds: 3, camera: "old", action: "old" },
    ],
    totalDurationSeconds: 10,
  },
  first,
);

assert.equal(shotPattern.totalDurationSeconds, 10);
assert.equal(shotPattern.shots.length, 3);
assert.deepEqual(
  shotPattern.shots.map((shot) => shot.index),
  [0, 1, 2],
);
assert.ok(shotPattern.shots.every((shot) => shot.action.length > 0));
assert.ok(shotPattern.shots.every((shot) => first.camera.includes(shot.camera as never)));

console.log("creative grammar smoke test: PASS");
