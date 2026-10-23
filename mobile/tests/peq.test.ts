import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAutoEq, normalizePeq } from "../src/core/peq";
import { defaultReplayGain, replayGainDb } from "../src/core/replayGain";
import {
  createSettingsBackup,
  parseSettingsBackup,
} from "../src/core/settingsBackup";
import { defaults } from "../src/core/types";
test("AutoEq imports exact peak and shelf Q parameters, including disabled filters", () => {
  const p = parseAutoEq(
    "Preamp: -6.2 dB\r\nFilter 1: ON LSC Fc 105 Hz Gain 5.5 dB Q 0.71\r\nFilter 2: OFF PK Fc 3000 Hz Gain -2 dB Q 4.3\nFilter 3: ON HSC Fc 10000 Hz Gain 1.0 dB Q 0.7",
  );
  assert.equal(p.preamp, -6.2);
  assert.deepEqual(p.bands[1], {
    enabled: false,
    type: "PK",
    frequency: 3000,
    gain: -2,
    q: 4.3,
  });
  assert.equal(p.bands[2].type, "HSC");
  for (const text of [
    "",
    "GraphicEQ: 20 0",
    "Filter 1: ON HP Fc 50 Hz",
    "Preamp: 3 dB\nFilter 1: ON PK Fc 100 Hz Gain 1 dB Q 1",
    "Filter 1: ON PK Fc 100 Hz Gain 2 dB Q 0",
    "Filter 1: ON PK Fc 100 Hz Gain Infinity dB Q 1",
  ])
    assert.throws(() => parseAutoEq(text));
  assert.throws(() =>
    parseAutoEq(
      Array(11).fill("Filter 1: ON PK Fc 100 Hz Gain 1 dB Q 1").join("\n"),
    ),
  );
});
test("PEQ and ReplayGain backup migrate older versions and reject unsafe values", () => {
  const b = createSettingsBackup({
    ...defaults,
    peq: parseAutoEq("Filter 1: ON PK Fc 500 Hz Gain -5 dB Q 2"),
    replayGain: { mode: "album", preamp: -3, preventClipping: true },
  });
  assert.deepEqual(parseSettingsBackup(JSON.stringify(b)), b);
  const old = JSON.parse(JSON.stringify(b));
  delete old.settings.peq;
  delete old.settings.replayGain;
  assert.deepEqual(
    parseSettingsBackup(JSON.stringify(old)).settings.peq,
    normalizePeq(),
  );
  b.settings.peq.bands[0].q = NaN;
  assert.throws(() => parseSettingsBackup(JSON.stringify(b)), /PEQ/);
});
test("ReplayGain mode, album fallback, missing tags, peak protection and unsafe metadata", () => {
  const tags = { trackGain: -5, trackPeak: 0.9, albumGain: -3, albumPeak: 0.8 };
  assert.equal(replayGainDb(tags, defaultReplayGain), 0);
  assert.equal(replayGainDb(tags, { ...defaultReplayGain, mode: "track" }), -5);
  assert.equal(replayGainDb(tags, { ...defaultReplayGain, mode: "album" }), -3);
  assert.equal(
    replayGainDb({ trackGain: -4 }, { ...defaultReplayGain, mode: "album" }),
    -4,
  );
  assert.equal(
    replayGainDb(undefined, { ...defaultReplayGain, mode: "track", preamp: 5 }),
    0,
  );
  assert.equal(
    replayGainDb({ trackGain: NaN }, { ...defaultReplayGain, mode: "track" }),
    0,
  );
  assert.equal(
    replayGainDb(
      { trackGain: 6, trackPeak: 1 },
      { ...defaultReplayGain, mode: "track" },
    ),
    0,
  );
  assert.ok(
    Math.abs(
      replayGainDb(
        { trackGain: 6, trackPeak: 2 },
        { ...defaultReplayGain, mode: "track" },
      ) + 6.0206,
    ) < 0.001,
  );
  assert.equal(
    replayGainDb(
      { trackGain: 6, trackPeak: 1 },
      { ...defaultReplayGain, mode: "track", preventClipping: false },
    ),
    6,
  );
});
