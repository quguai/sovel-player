import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultDsd, normalizeDsd, pcmRates } from "../src/core/dsd";
import {
  defaults,
  fallbackMetadata,
  playbackSupport,
  type Track,
} from "../src/core/types";
import { normalizePreferences } from "../src/core/preferences";
import {
  createSettingsBackup,
  parseSettingsBackup,
} from "../src/core/settingsBackup";
import {
  restoreSession,
  type PlaybackSession,
} from "../src/core/playbackSession";

test("DSD PCM rates survive preferences and backups; older backups migrate safely", () => {
  for (const pcmRate of pcmRates) {
    const prefs = normalizePreferences({ dsd: { mode: "pcm", pcmRate } });
    assert.equal(prefs.dsd.pcmRate, pcmRate);
    assert.deepEqual(
      parseSettingsBackup(JSON.stringify(createSettingsBackup(prefs))).settings
        .dsd,
      prefs.dsd,
    );
  }
  assert.deepEqual(normalizeDsd(null), defaultDsd);
  assert.deepEqual(normalizeDsd({ mode: "native", pcmRate: NaN }), defaultDsd);
  const backup = createSettingsBackup(defaults);
  const { dsd: _, ...oldSettings } = backup.settings;
  assert.deepEqual(
    parseSettingsBackup(JSON.stringify({ ...backup, settings: oldSettings }))
      .settings.dsd,
    defaultDsd,
  );
  for (const dsd of [
    { mode: "dop", pcmRate: 176400 },
    { mode: "native", pcmRate: 176400 },
    { mode: "pcm", pcmRate: 12345 },
  ]) {
    assert.throws(
      () =>
        parseSettingsBackup(
          JSON.stringify({
            ...backup,
            settings: { ...backup.settings, dsd },
          }),
        ),
      /DSD/,
    );
  }
});

test("only builds with the native decoder admit DSF into play queues and restored positions", () => {
  const tracks: Track[] = ["dsf", "flac", "dff"].map((format) => ({
    ...fallbackMetadata(`song.${format}`),
    format,
    id: format,
    sourceId: "sd",
    uri: `content://music/${format}`,
    path: `song.${format}`,
    size: 1000,
    mtime: 1,
    available: true,
    favorite: false,
    duration: 60,
  }));
  assert.deepEqual(
    tracks.filter(playbackSupport(false)).map((t) => t.id),
    ["flac"],
  );
  assert.deepEqual(
    tracks.filter(playbackSupport(true)).map((t) => t.id),
    ["dsf", "flac"],
  );
  assert.equal(
    playbackSupport(true)({ ...tracks[0], available: false }),
    false,
  );
  const session: PlaybackSession = {
    version: 1,
    token: "dsf",
    queueIds: ["dsf", "flac", "dff"],
    originalIds: ["dsf", "flac", "dff"],
    nativeIds: ["dsf", "flac"],
    currentId: "dsf",
    position: 12,
    mode: "repeat",
  };
  const restored = restoreSession(session, tracks, null, playbackSupport(true));
  assert.equal(restored.current?.id, "dsf");
  assert.equal(restored.position, 12);
  assert.deepEqual(
    restored.original.map((t) => t.id),
    ["dsf", "flac"],
  );
  assert.equal(restoreSession(session, tracks).current?.id, "flac");
  assert.equal(restoreSession(session, tracks).position, 0);
});
