import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoverDirectory,
  type DirectoryChild,
} from "../src/core/directoryScan";
import { defaultScanRules } from "../src/core/types";

const child = (
  name: string,
  directory = false,
  uri = name,
): DirectoryChild => ({ name, directory, uri, size: 123, mtime: 456 });

test("discovery overlaps four directory reads, stays bounded across branches and returns a stable sorted snapshot", async () => {
  let active = 0,
    peak = 0;
  const counts: number[] = [];
  const entries = await discoverDirectory(
    "root",
    async (uri) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) =>
        setTimeout(resolve, uri === "d0" ? 20 : 1),
      );
      active--;
      return uri === "root"
        ? Array.from({ length: 12 }, (_, i) => child(`d${i}`, true))
        : [child(`${uri}.flac`), child(`${uri}.LRC`), child("cover.jpg")];
    },
    undefined,
    defaultScanRules,
    (count) => counts.push(count),
  );
  assert.equal(peak, 4);
  assert.equal(active, 0);
  assert.equal(entries.length, 12);
  assert.equal(new Set(entries.map((entry) => entry.path)).size, 12);
  assert.deepEqual(
    entries.map((e) => e.path),
    entries.map((e) => e.path).sort((a, b) => a.localeCompare(b)),
  );
  assert.equal(entries[0].lyricUri, "d0.LRC");
  assert.deepEqual(
    counts,
    [...counts].sort((a, b) => a - b),
  );
});

test("hidden directories, recursion options and cyclic directory identifiers are respected", async () => {
  const read = async (uri: string) => {
    if (uri === "root")
      return [
        child(".hidden", true),
        child("album", true),
        child("song.wav"),
        child(".small.flac"),
      ];
    assert.equal(uri, "album");
    return [child("back", true, "root"), child("track.dsf")];
  };
  const entries = await discoverDirectory(
    "root",
    read,
    undefined,
    defaultScanRules,
  );
  assert.deepEqual(
    entries.map((e) => e.path),
    [".small.flac", "album/track.dsf", "song.wav"],
  );
  // Filtered files remain in the discovery snapshot; Library applies file rules.
  const flat = await discoverDirectory("root", read, undefined, {
    ...defaultScanRules,
    includeSubfolders: false,
  });
  assert.equal(flat.length, 2);
});

for (const cancelled of [true, false]) {
  test(`discovery ${cancelled ? "cancellation" : "failure"} drains outstanding reads without returning a partial snapshot`, async () => {
    const controller = new AbortController();
    const releases: (() => void)[] = [];
    let ready!: () => void;
    const started = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let settled = false;
    const task = discoverDirectory(
      "root",
      async (uri) => {
        if (uri === "root")
          return Array.from({ length: 8 }, (_, i) => child(`d${i}`, true));
        await new Promise<void>((resolve) => {
          releases.push(resolve);
          if (releases.length === 4) ready();
        });
        if (!cancelled && uri === "d0") throw Error("offline");
        return [child("track.flac")];
      },
      controller.signal,
    );
    const rejected = assert.rejects(task, cancelled ? /取消/ : /offline/);
    void task.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await started;
    if (cancelled) controller.abort();
    releases[0]();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    assert.equal(releases.length, 4);
    releases.slice(1).forEach((release) => release());
    await rejected;
    assert.equal(settled, true);
  });
}
