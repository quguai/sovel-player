import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createSettingsBackup,
  parseSettingsBackup,
} from "../src/core/settingsBackup";
import { defaults } from "../src/core/types";
import {
  currentLyric,
  lyricSeekTime,
  normalizeLyricOffset,
} from "../src/core/lyrics";
test("portable backup round trip retains custom EQ and independent layouts but no file identity", () => {
  const backup = createSettingsBackup({
    ...defaults,
    lastTrack: "secret-local-id",
    albumLayout: "list",
    artistLayout: "cards",
    equalizer: {
      ...defaults.equalizer,
      userPresets: [
        {
          id: "user-test",
          name: "夜听",
          gains: [1, 2, 3, 0, 0, 0, 0, -1, -2, -3],
          preamp: -3,
          headroom: true,
        },
      ],
    },
  });
  const imported = parseSettingsBackup(
    JSON.stringify({
      ...backup,
      settings: {
        ...backup.settings,
        sourceUri: "private",
        lastTrack: "secret",
      },
    }),
  );
  assert.deepEqual(imported, backup);
  assert.ok(!JSON.stringify(imported).includes("secret"));
  assert.equal(imported.settings.albumLayout, "list");
  assert.equal(imported.settings.artistLayout, "cards");
});
test("backup rejects unsupported versions, missing fields, unsafe EQ and duplicate presets", () => {
  assert.throws(() => parseSettingsBackup("broken"), /JSON/);
  assert.throws(
    () => parseSettingsBackup('{"format":"sovel-settings","version":2}'),
    /版本/,
  );
  const invalid = (update: (b: any) => void) => {
    const b = createSettingsBackup(defaults);
    update(b);
    assert.throws(() => parseSettingsBackup(JSON.stringify(b)));
  };
  invalid((b) => (b.settings = {}));
  invalid((b) => (b.settings.scanRules = null));
  invalid((b) => (b.settings.equalizer.gains = [24]));
  invalid((b) => (b.settings.equalizer.preamp = 6));
  invalid((b) => (b.settings.albumLayout = "unknown"));
  invalid(
    (b) =>
      (b.settings.equalizer.userPresets = [1, 2].map(() => ({
        ...b.settings.equalizer,
        id: "user-same",
        name: "重复",
      }))),
  );
});
test("lyric offset advances or delays display and applies the inverse when seeking", () => {
  const lyrics = [
    { time: 0, text: "one" },
    { time: 8, text: "two" },
    { time: 16, text: "three" },
  ];
  assert.equal(currentLyric(lyrics, 7.8, 0.2), 1);
  assert.equal(currentLyric(lyrics, 8, -0.2), 0);
  assert.equal(lyricSeekTime(8, 0.2), 7.8);
  assert.equal(lyricSeekTime(8, -0.2), 8.2);
  assert.equal(lyricSeekTime(0, 0.2), 0);
  assert.equal(normalizeLyricOffset(31), 30);
  assert.equal(normalizeLyricOffset(-31), -30);
  assert.equal(normalizeLyricOffset(NaN), 0);
  assert.deepEqual(
    lyrics.map((l) => l.time),
    [0, 8, 16],
  );
});
