import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Library, type Database } from "../src/core/library";
import { fallbackMetadata, type Entry } from "../src/core/types";
function setup() {
  const sqlite = new DatabaseSync(":memory:");
  const db: Database = {
    execAsync: async (s) => {
      sqlite.exec(s);
    },
    runAsync: async (s, ...p) => sqlite.prepare(s).run(...p),
    getAllAsync: async <T>(s: string, ...p: any[]) =>
      sqlite.prepare(s).all(...p) as T[],
    getFirstAsync: async <T>(s: string, ...p: any[]) =>
      (sqlite.prepare(s).get(...p) as T) || null,
    withTransactionAsync: async (task) => {
      sqlite.exec("BEGIN");
      try {
        await task();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { lib: new Library(db), sqlite };
}
const entry = (path: string, size = 100, mtime = 1): Entry => ({
  path,
  size,
  mtime,
});
const parse = async (e: Entry) => ({
  ...fallbackMetadata(e.path),
  title: `标题 ${e.mtime}`,
});
const progress = () => {};
test("incremental/full/forced tag refresh retain identity, favorite and preferences", async () => {
  const { lib } = setup();
  await lib.init();
  let calls = 0;
  const reader = async (e: Entry) => {
    calls++;
    return parse(e);
  };
  await lib.scan("full", async () => [entry("one.flac")], reader, progress);
  const initial = (await lib.list())[0];
  await lib.favorite(initial.id, true);
  await lib.set("preferences", { record: "aurora" });
  const incremental = await lib.scan(
    "incremental",
    async () => [entry("one.flac")],
    reader,
    progress,
  );
  assert.equal(calls, 1);
  assert.equal(incremental.unchanged, 1);
  await lib.scan(
    "full",
    async () => [entry("one.flac", 120, 2)],
    reader,
    progress,
  );
  const updated = (await lib.list())[0];
  assert.equal(updated.id, initial.id);
  assert.equal(updated.title, "标题 2");
  assert.equal(updated.favorite, true);
  await lib.scan(
    "refresh",
    async () => [entry("one.flac", 120, 2)],
    reader,
    progress,
  );
  assert.equal(calls, 3);
  assert.deepEqual(await lib.get("preferences", {}), { record: "aurora" });
});
test("failed enumeration and cancellation never mark tracks missing", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.scan("full", async () => [entry("one.wav")], parse, progress);
  await assert.rejects(
    lib.scan(
      "full",
      async () => {
        throw new Error("permission lost");
      },
      parse,
      progress,
    ),
  );
  assert.equal((await lib.list())[0].available, true);
  const signal = new AbortController();
  signal.abort();
  await assert.rejects(
    lib.scan("full", async () => [], parse, progress, signal.signal),
  );
  assert.equal((await lib.list())[0].available, true);
});
test("only a successful enumeration marks absence; reappearance restores favorites", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.scan("full", async () => [entry("one.flac")], parse, progress);
  const id = (await lib.list())[0].id;
  await lib.favorite(id, true);
  const result = await lib.scan("full", async () => [], parse, progress);
  assert.equal(result.missing, 1);
  assert.equal((await lib.list())[0].available, false);
  await lib.scan(
    "incremental",
    async () => [entry("one.flac")],
    parse,
    progress,
  );
  assert.equal((await lib.list())[0].favorite, true);
  assert.equal((await lib.list())[0].id, id);
});
test("metadata failure preserves old tags and retries on next incremental scan", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.scan("full", async () => [entry("one.wav")], parse, progress);
  const fail = await lib.scan(
    "refresh",
    async () => [entry("one.wav")],
    async () => {
      throw new Error("broken tag");
    },
    progress,
  );
  assert.equal(fail.errors.length, 1);
  assert.equal((await lib.list())[0].title, "标题 1");
  assert.equal((await lib.list())[0].available, true);
  const retry = await lib.scan(
    "incremental",
    async () => [entry("one.wav")],
    parse,
    progress,
  );
  assert.equal(retry.updated, 1);
  assert.equal((await lib.list())[0].warning, undefined);
});
test("rejects overlapping scans without interfering with the running job", async () => {
  const { lib } = setup();
  await lib.init();
  let release!: () => void;
  const blocked = new Promise<void>((r) => {
    release = r;
  });
  const first = lib.scan(
    "full",
    async () => {
      await blocked;
      return [];
    },
    parse,
    progress,
  );
  await assert.rejects(
    lib.scan("full", async () => [], parse, progress),
    /扫描正在进行/,
  );
  release();
  await first;
});
test("sources with identical filenames are independent; offline scans preserve other sources", async () => {
  const { lib } = setup();
  await lib.init();
  const a = await lib.saveSource({
    id: "sd",
    kind: "directory",
    name: "SD Card",
    uri: "content://sd/tree/Music",
  });
  const duplicate = await lib.saveSource({ ...a, id: "other-id" });
  assert.equal(duplicate.id, "sd");
  const b = await lib.saveSource({
    id: "phone",
    kind: "directory",
    name: "Phone",
    uri: "content://phone/tree/Music",
  });
  await lib.scan(
    "full",
    async () => [{ ...entry("same.flac"), uri: "content://sd/file/1" }],
    parse,
    progress,
    undefined,
    a.id,
  );
  await lib.scan(
    "full",
    async () => [{ ...entry("same.flac"), uri: "content://phone/file/1" }],
    parse,
    progress,
    undefined,
    b.id,
  );
  const tracks = await lib.list();
  assert.equal(tracks.length, 2);
  assert.notEqual(tracks[0].id, tracks[1].id);
  await lib.favorite(tracks[0].id, true);
  await assert.rejects(
    lib.scan(
      "full",
      async () => {
        throw new Error("card ejected");
      },
      parse,
      progress,
      undefined,
      a.id,
    ),
  );
  await lib.scan("full", async () => [], parse, progress, undefined, b.id);
  const after = await lib.list();
  assert.equal(after.find((t) => t.sourceId === "sd")!.available, true);
  assert.equal(after.find((t) => t.sourceId === "phone")!.available, false);
  assert.equal(after[0].favorite, true);
});
test("upgrades the initial database without losing IDs, favorites or preferences", async () => {
  const { lib, sqlite } = setup();
  sqlite.exec(
    "CREATE TABLE tracks(id TEXT PRIMARY KEY,path TEXT UNIQUE,size INTEGER,mtime REAL,metadata TEXT,available INTEGER);CREATE TABLE favorites(track_id TEXT PRIMARY KEY);CREATE TABLE preferences(key TEXT PRIMARY KEY,value TEXT NOT NULL);PRAGMA user_version=1;",
  );
  sqlite
    .prepare("INSERT INTO tracks VALUES(?,?,?,?,?,?)")
    .run(
      "local:legacy.wav",
      "legacy.wav",
      100,
      1,
      JSON.stringify(fallbackMetadata("legacy.wav")),
      1,
    );
  sqlite.exec(
    "INSERT INTO favorites VALUES('local:legacy.wav');INSERT INTO preferences VALUES('preferences','{\"record\":\"black\"}');",
  );
  await lib.init();
  await lib.init();
  const [track] = await lib.list();
  assert.equal(track.id, "local:legacy.wav");
  assert.equal(track.sourceId, "local");
  assert.equal(track.favorite, true);
  assert.equal((await lib.get<any>("preferences", {})).record, "black");
});
test("unknown modification dates are re-read instead of silently skipping changed tags", async () => {
  const { lib } = setup();
  await lib.init();
  let reads = 0;
  const reader = async (e: Entry) => {
    reads++;
    return parse(e);
  };
  await lib.scan(
    "full",
    async () => [entry("one.wav", 100, 0)],
    reader,
    progress,
  );
  await lib.scan(
    "incremental",
    async () => [entry("one.wav", 100, 0)],
    reader,
    progress,
  );
  assert.equal(reads, 2);
});

test("scan rules exclude small and hidden files without treating retained tracks as missing", async () => {
  const { lib } = setup();
  await lib.init();
  const original = [
    entry("tiny.flac", 100),
    entry(".hidden/old.wav", 9000),
    entry("album/song.flac", 9000),
    entry("gone.wav", 9000),
  ];
  await lib.scan("full", async () => original, parse, progress);
  const retained = (await lib.list()).find((t) => t.path === "tiny.flac")!;
  await lib.favorite(retained.id, true);
  let reads = 0;
  const result = await lib.scan(
    "full",
    async () => [
      entry("tiny.flac", 100),
      entry("new-small.wav", 1023),
      entry("boundary.flac", 1024),
    ],
    async (e) => {
      reads++;
      return parse(e);
    },
    progress,
    undefined,
    "local",
    {
      filterSmall: true,
      minSizeKB: 1,
      ignoreHidden: true,
      includeSubfolders: false,
    },
  );
  assert.equal(reads, 1);
  assert.equal(result.filtered, 2);
  assert.equal(result.missing, 1);
  assert.equal(result.added, 1);
  const after = await lib.list();
  for (const path of ["tiny.flac", ".hidden/old.wav", "album/song.flac"])
    assert.equal(after.find((t) => t.path === path)!.available, true);
  assert.equal(after.find((t) => t.id === retained.id)!.favorite, true);
  assert.equal(
    after.some((t) => t.path === "new-small.wav"),
    false,
  );
  assert.equal(after.find((t) => t.path === "gone.wav")!.available, false);
});

test("a previously large file becoming filtered stays indexed and keeps its ID", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.scan("full", async () => [entry("a.wav", 9000)], parse, progress);
  const before = (await lib.list())[0];
  const result = await lib.scan(
    "full",
    async () => [entry("a.wav", 100, 2)],
    parse,
    progress,
    undefined,
    "local",
    {
      filterSmall: true,
      minSizeKB: 1,
      ignoreHidden: true,
      includeSubfolders: true,
    },
  );
  assert.equal(result.missing, 0);
  assert.equal(result.filtered, 1);
  assert.deepEqual((await lib.list())[0], before);
});

test("full scan re-reads unchanged tags while incremental uses the existing index", async () => {
  const { lib } = setup();
  await lib.init();
  let version = 1;
  const reader = async (e: Entry) => ({
    ...(await parse(e)),
    title: `version ${version}`,
  });
  await lib.scan("full", async () => [entry("a.flac")], reader, progress);
  const id = (await lib.list())[0].id;
  await lib.favorite(id, true);
  version = 2;
  await lib.scan(
    "incremental",
    async () => [entry("a.flac")],
    reader,
    progress,
  );
  assert.equal((await lib.list())[0].title, "version 1");
  const result = await lib.scan(
    "full",
    async () => [entry("a.flac")],
    reader,
    progress,
  );
  assert.equal(result.updated, 1);
  assert.equal(result.unchanged, 0);
  assert.equal((await lib.list())[0].title, "version 2");
  assert.equal((await lib.list())[0].id, id);
  assert.equal((await lib.list())[0].favorite, true);
});

test("cancellation during metadata reading commits neither partial tags nor missing state", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.scan(
    "full",
    async () => [entry("a.wav"), entry("b.wav")],
    parse,
    progress,
  );
  const before = await lib.list();
  const controller = new AbortController();
  await assert.rejects(
    lib.scan(
      "full",
      async () => [entry("a.wav", 200, 2)],
      async (e) => {
        controller.abort();
        return parse(e);
      },
      progress,
      controller.signal,
    ),
  );
  assert.deepEqual(await lib.list(), before);
});

test("all sources are discovered before import and progress uses one fixed filtered total", async () => {
  const { runScanJob } = await import("../src/core/scanJob");
  const { lib } = setup();
  await lib.init();
  const sources = ["a", "b"].map((id) => ({
    id,
    name: id,
    kind: "directory" as const,
    uri: `file:///${id}`,
  }));
  const events: string[] = [];
  const updates: import("../src/core/types").ScanProgress[] = [];
  const report = await runScanJob({
    library: lib,
    sources,
    mode: "full",
    signal: new AbortController().signal,
    rules: {
      filterSmall: true,
      minSizeKB: 1,
      ignoreHidden: true,
      includeSubfolders: true,
    },
    enumerate: async (source, found) => {
      events.push(`enumerate:${source.id}`);
      const entries =
        source.id === "a"
          ? [entry("a.flac", 2048), entry("small.wav", 100)]
          : [entry("b.flac", 2048), entry("c.flac", 2048)];
      found(entries.length, "");
      return entries;
    },
    parse: async (e, source) => {
      events.push(`parse:${source.id}`);
      return parse(e);
    },
    progress: (value) => updates.push(value),
    sourceError: () => assert.fail("No source should fail"),
  });
  assert.deepEqual(events.slice(0, 2), ["enumerate:a", "enumerate:b"]);
  assert.equal(report.added, 3);
  assert.equal(report.filtered, 1);
  assert.ok(
    updates
      .filter((p) => p.phase === "discovering")
      .every((p) => p.total === null),
  );
  const importing = updates.filter((p) => p.phase !== "discovering");
  assert.ok(importing.every((p) => p.total === 3));
  assert.equal(importing[0].done, 0);
  assert.equal(importing.at(-1)!.done, 3);
  assert.ok(importing.every((p, i) => !i || p.done >= importing[i - 1].done));
});

test("cancelling discovery writes no sources, even after earlier sources were fully enumerated", async () => {
  const { runScanJob } = await import("../src/core/scanJob");
  const { lib } = setup();
  await lib.init();
  await lib.scan(
    "full",
    async () => [entry("old.flac")],
    parse,
    progress,
    undefined,
    "a",
  );
  const before = await lib.list();
  const controller = new AbortController();
  await assert.rejects(
    runScanJob({
      library: lib,
      sources: ["a", "b"].map((id) => ({
        id,
        name: id,
        kind: "directory" as const,
        uri: `file:///${id}`,
      })),
      mode: "full",
      signal: controller.signal,
      rules: {
        filterSmall: false,
        minSizeKB: 1,
        ignoreHidden: true,
        includeSubfolders: true,
      },
      enumerate: async (source) => {
        if (source.id === "b") controller.abort();
        return [entry("new.flac")];
      },
      parse: async () =>
        assert.fail("No tag parsing is allowed during discovery"),
      progress: () => {},
      sourceError: () => assert.fail("Cancellation is not an offline source"),
    }),
  );
  assert.deepEqual(await lib.list(), before);
});

test("lyric offsets and playback session survive full rescans and repeated schema initialization", async () => {
  const {lib} = setup(); await lib.init();
  await lib.scan("full", async () => [entry("song.flac")], parse, progress);
  const id = (await lib.list())[0].id;
  await lib.setLyricOffset(id, -0.4);
  await lib.set("playbackSession", {queueIds: [id], position: 8});
  await lib.scan("full", async () => [entry("song.flac", 200, 2)], parse, progress);
  await lib.init();
  assert.deepEqual(await lib.lyricOffsets(), {[id]: -0.4});
  assert.deepEqual(await lib.get("playbackSession", null), {queueIds: [id], position: 8});
  await lib.setLyricOffset(id, 0); assert.equal((await lib.lyricOffsets())[id], 0);
});
