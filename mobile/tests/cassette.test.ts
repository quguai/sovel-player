import { test } from "node:test";
import assert from "node:assert/strict";
import { tapeRadius } from "../src/core/cassette";
import { normalizePreferences } from "../src/core/preferences";
import {
  createSettingsBackup,
  parseSettingsBackup,
} from "../src/core/settingsBackup";
import { defaults } from "../src/core/types";

test("winding conserves the total tape area and clamps invalid progress", () => {
  const inner = 25,
    outer = 63;
  for (const progress of [0, 0.1, 0.5, 0.75, 1]) {
    const left = tapeRadius(1 - progress, inner, outer);
    const right = tapeRadius(progress, inner, outer);
    assert.ok(
      Math.abs(left * left + right * right - (inner * inner + outer * outer)) <
        1e-8,
    );
  }
  assert.equal(tapeRadius(-2, inner, outer), inner);
  assert.equal(tapeRadius(2, inner, outer), outer);
  assert.equal(tapeRadius(NaN, inner, outer), inner);
});

test("cassette settings survive backup and older backups migrate without losing other choices", () => {
  const backup = createSettingsBackup({
    ...defaults,
    player: "cassette",
    cassette: "studio",
  });
  assert.equal(
    parseSettingsBackup(JSON.stringify(backup)).settings.cassette,
    "studio",
  );
  assert.equal(
    parseSettingsBackup(JSON.stringify(backup)).settings.player,
    "cassette",
  );
  const { cassette: _, ...legacy } = backup.settings;
  const migrated = parseSettingsBackup(
    JSON.stringify({ ...backup, settings: legacy }),
  );
  assert.equal(migrated.settings.cassette, "noir");
  assert.equal(migrated.settings.player, "cassette");
  assert.throws(() =>
    parseSettingsBackup(
      JSON.stringify({
        ...backup,
        settings: { ...legacy, cassette: "unknown" },
      }),
    ),
  );
  assert.equal(
    normalizePreferences({ cassette: "unknown", player: "cover" }).cassette,
    "noir",
  );
});
