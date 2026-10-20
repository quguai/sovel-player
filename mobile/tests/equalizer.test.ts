import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEqualizer,
  defaultEqualizer,
  applyEqPreset,
  saveEqPreset,
  deleteEqPreset,
  eqPresets,
} from "../src/core/equalizer";
test("old and malformed preferences become bounded, disabled EQ settings", () => {
  assert.deepEqual(normalizeEqualizer(), defaultEqualizer);
  const result = normalizeEqualizer({
    gains: [Infinity, -90, 80],
    preamp: 99,
    userPresets: [null] as never,
  });
  assert.deepEqual(result.gains, [0, -12, 12, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(result.preamp, 0);
  assert.equal(result.enabled, false);
  assert.equal(result.userPresets.length, 0);
});
test("choosing a preset preserves the user's enable state and saved presets", () => {
  const saved = saveEqPreset(defaultEqualizer, "我的耳机", "user-test");
  const selected = applyEqPreset(saved, "bass");
  assert.equal(selected.enabled, false);
  assert.equal(selected.gains[0], 4);
  assert.equal(selected.userPresets[0].name, "我的耳机");
  assert.deepEqual(applyEqPreset(selected, "unknown"), selected);
});
test("custom curves persist, duplicate names are rejected and deleting does not reset sound", () => {
  const settings = {
    ...defaultEqualizer,
    gains: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    preamp: -4,
  };
  const saved = saveEqPreset(settings, " 夜晚 ", "user-one");
  const restored = normalizeEqualizer(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored, saved);
  assert.throws(() => saveEqPreset(saved, "夜晚", "user-two"), /同名/);
  assert.throws(() => saveEqPreset(saved, " ", "user-two"), /名字/);
  const removed = deleteEqPreset(restored, "user-one");
  assert.equal(removed.presetId, "custom");
  assert.deepEqual(removed.gains, settings.gains);
  assert.equal(removed.userPresets.length, 0);
});
test("built-in curves have unique IDs and ten finite band values", () => {
  assert.equal(new Set(eqPresets.map((p) => p.id)).size, eqPresets.length);
  for (const p of eqPresets) {
    assert.equal(p.gains.length, 10);
    assert.ok(p.gains.every((g) => Number.isFinite(g) && Math.abs(g) <= 12));
  }
});
