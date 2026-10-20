import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addQueueSources,
  FavoriteUpdates,
  samePlaybackSources,
} from "../src/core/playbackRequests";
import { fallbackMetadata, type Track } from "../src/core/types";

const track = (id: string): Track => ({
  ...fallbackMetadata(`${id}.flac`),
  id,
  uri: `${id}.flac`,
  path: `${id}.flac`,
  sourceId: "local",
  available: true,
  size: 42,
  mtime: 1,
  favorite: false,
});

test("reuse preserves queue order and rejects changed audio, but allows updated metadata", () => {
  const a = track("a"),
    b = track("b");
  assert.equal(
    samePlaybackSources([a, b], [{ ...a, favorite: true, title: "new" }, b]),
    true,
  );
  assert.equal(samePlaybackSources([a, b], [b, a]), false);
  assert.equal(samePlaybackSources([a, b], [a]), false);
  for (const patch of [
    { uri: "new" },
    { mtime: 2 },
    { size: 43 },
    { available: false },
    { sourceId: "remote" },
  ])
    assert.equal(samePlaybackSources([a], [{ ...a, ...patch }]), false);
});

test("large queues yield before work and between bridge batches; newer requests cancel old additions", async () => {
  const added: number[] = [];
  let yields = 0,
    current = true;
  const result = await addQueueSources(
    Array.from({ length: 100 }, (_, i) => i),
    (source) => added.push(source),
    () => current,
    async () => {
      yields++;
      if (yields === 3) current = false;
    },
  );
  assert.equal(result, false);
  assert.deepEqual(
    added,
    Array.from({ length: 48 }, (_, i) => i),
  );
  assert.equal(yields, 3);
  assert.equal(
    await addQueueSources(
      [100, 101],
      (source) => added.push(source),
      () => true,
    ),
    true,
  );
  assert.deepEqual(added.slice(-2), [100, 101]);
});

test("favorite taps update immediately and serialize persistence without reading the library", async () => {
  const updates = new FavoriteUpdates(),
    shown: boolean[] = [],
    saved: boolean[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const persist = async (value: boolean) => {
    await gate;
    saved.push(value);
  };
  const show = (value: boolean) => shown.push(value);
  const failure = () => assert.fail("unexpected write error");
  const first = updates.toggle("a", false, show, persist, failure);
  // The caller may still hold the pre-render track. The latest intent must win.
  const second = updates.toggle("a", false, show, persist, failure);
  assert.deepEqual(shown, [true, false]);
  assert.deepEqual(saved, []);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(saved, [true, false]);
});

test("failed favorite writes cannot overwrite newer taps; latest failure restores confirmed state", async () => {
  const updates = new FavoriteUpdates(),
    shown: boolean[] = [];
  const show = (value: boolean) => shown.push(value);
  let errors = 0;
  const failed = () => {
    errors++;
  };
  const reject = async () => {
    throw Error("disk full");
  };
  const first = updates.toggle("a", false, show, reject, failed);
  const second = updates.toggle("a", false, show, async () => {}, failed);
  await Promise.all([first, second]);
  assert.deepEqual(shown, [true, false]);
  await updates.toggle("a", false, show, reject, failed);
  assert.deepEqual(shown, [true, false, true, false]);
  assert.equal(errors, 2);
});
