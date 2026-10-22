import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Library, type Database } from "../src/core/library";
import {
  fallbackMetadata,
  type Metadata,
  type MusicSource,
} from "../src/core/types";
function setup() {
  const sql = new DatabaseSync(":memory:");
  const db: Database = {
    execAsync: async (s) => {
      sql.exec(s);
    },
    runAsync: async (s, ...p) => sql.prepare(s).run(...p),
    getAllAsync: async <T>(s: string, ...p: any[]) =>
      sql.prepare(s).all(...p) as T[],
    getFirstAsync: async <T>(s: string, ...p: any[]) =>
      (sql.prepare(s).get(...p) as T) || null,
    withTransactionAsync: async (task) => {
      sql.exec("BEGIN");
      try {
        await task();
        sql.exec("COMMIT");
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { sql, db, lib: new Library(db) };
}
const tags = (patch: Partial<Metadata> = {}): Metadata => ({
  ...fallbackMetadata("a.flac"),
  title: "远方的信",
  artist: "陈屿",
  album: "海岸",
  format: "FLAC",
  duration: 200,
  disc: 1,
  track: 1,
  lyrics: [{ text: "cached lyrics", time: 0 }],
  ...patch,
});
async function add(lib: Library, source: string, list = [tags()]) {
  await lib.scan(
    "full",
    async () =>
      list.map((_, i) => ({ path: `${i}.flac`, size: 100, mtime: 1 })),
    async (e) => list[Number(e.path.split(".")[0])],
    () => {},
    undefined,
    source,
  );
}
const remote: MusicSource = {
  id: "server",
  name: "Home NAS",
  kind: "jellyfin",
  uri: "https://music.test/#library1",
};
test("v4 migration is additive and idempotent; IDs, favorites, lyrics, offsets, sources and queue survive", async () => {
  const { sql, lib } = setup();
  sql.exec(
    `CREATE TABLE tracks(id TEXT PRIMARY KEY,source_id TEXT NOT NULL,uri TEXT NOT NULL,path TEXT NOT NULL,size INTEGER,mtime REAL,metadata TEXT,available INTEGER,UNIQUE(source_id,path));CREATE TABLE favorites(track_id TEXT PRIMARY KEY);CREATE TABLE sources(id TEXT PRIMARY KEY,name TEXT,kind TEXT,uri TEXT,bookmark TEXT,UNIQUE(kind,uri));CREATE TABLE preferences(key TEXT PRIMARY KEY,value TEXT);CREATE TABLE lyric_offsets(track_id TEXT PRIMARY KEY,seconds REAL);PRAGMA user_version=4;`,
  );
  sql
    .prepare("INSERT INTO tracks VALUES (?,?,?,?,?,?,?,?)")
    .run(
      "old-id",
      "local",
      "file:///music/a.flac",
      "a.flac",
      100,
      1,
      JSON.stringify(tags()),
      1,
    );
  sql.exec(
    `INSERT INTO favorites VALUES ('old-id');INSERT INTO lyric_offsets VALUES ('old-id',1.25);INSERT INTO preferences VALUES ('playbackSession','{"queueIds":["old-id"]}');`,
  );
  await lib.init();
  await lib.init();
  const page = await lib.catalog.page();
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, "old-id");
  assert.equal(page.items[0].favorite, true);
  assert.deepEqual(page.items[0].lyrics, []);
  assert.equal(
    (await lib.catalog.detail("old-id"))!.lyrics[0].text,
    "cached lyrics",
  );
  assert.equal((await lib.lyricOffsets())["old-id"], 1.25);
  assert.deepEqual(await lib.get("playbackSession", null), {
    queueIds: ["old-id"],
  });
  assert.equal((await lib.sources())[0].enabled, true);
});
test("aggregate duplicate copies, prefer lossless then local, remember a version; source toggles preserve favorites", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.saveSource(remote);
  await add(lib, "local", [tags({ format: "MP3" })]);
  await add(lib, remote.id);
  await lib.favorite("local:0.flac", true);
  let page = await lib.catalog.page();
  assert.equal(page.total, 1);
  assert.equal(page.items[0].sourceId, remote.id);
  assert.equal(page.items[0].copyCount, 2);
  assert.equal(page.items[0].favorite, true);
  const key = page.items[0].songKey!;
  await lib.catalog.prefer(key, "local:0.flac");
  assert.equal((await lib.catalog.page()).items[0].sourceId, "local");
  await lib.catalog.configureSource("local", { enabled: false });
  assert.equal(
    (await lib.catalog.page({ favorites: true })).items[0].sourceId,
    remote.id,
  );
  await lib.catalog.configureSource("local", { enabled: true });
  await lib.catalog.prefer(key, null);
  await add(lib, "local");
  assert.equal((await lib.catalog.page()).items[0].sourceId, "local");
  await lib.favorite("server:0.flac", false);
  assert.equal((await lib.catalog.page({ favorites: true })).total, 0);
  assert.equal((await lib.list()).length, 2);
});
test("source priority only breaks equal candidates; disabled, missing or unsupported copies cannot win", async () => {
  const { lib, db } = setup();
  await lib.init();
  await lib.saveSource(remote);
  await lib.saveSource({
    ...remote,
    id: "emby",
    kind: "emby",
    uri: "https://music.test/#library2",
  });
  await add(lib, "server");
  await add(lib, "emby");
  await lib.catalog.configureSource("server", { priority: 0 });
  await lib.catalog.configureSource("emby", { priority: 10 });
  assert.equal((await lib.catalog.page()).items[0].sourceId, "server");
  await lib.catalog.configureSource("emby", { priority: -10 });
  assert.equal((await lib.catalog.page()).items[0].sourceId, "emby");
  await db.runAsync("UPDATE tracks SET available=0 WHERE source_id='emby'");
  assert.equal((await lib.catalog.page()).items[0].sourceId, "server");
  await lib.catalog.configureSource("server", { enabled: false });
  assert.equal((await lib.catalog.page()).items[0].available, false);
  await lib.catalog.configureSource("server", { enabled: true });
  await add(lib, "emby", [tags({ format: "DSF" })]);
  assert.equal((await lib.catalog.page()).items[0].sourceId, "server");
  assert.equal(
    (await lib.catalog.page({ dsf: true })).items[0].sourceId,
    "emby",
  );
});
test("editions, unknown tags, recordings and different artists remain distinct", async () => {
  const { lib } = setup();
  await lib.init();
  await add(lib, "local", [
    tags(),
    tags({ title: "远方的信 (Live)" }),
    tags({ edition: "2020 Remaster" }),
    tags({ artist: "另一位歌手" }),
    tags({ album: "未命名专辑" }),
    tags({ album: "未命名专辑" }),
  ]);
  assert.equal((await lib.catalog.page()).total, 6);
  const albums = await lib.catalog.page({ kind: "albums" });
  assert.equal(albums.total, 4);
  assert.ok(albums.items.some((item) => item.collectionCount === 2));
});
test("database pages are stable and hydrate only requested rows; Chinese substring and literal searches work", async () => {
  const { lib } = setup();
  await lib.init();
  await add(
    lib,
    "local",
    Array.from({ length: 330 }, (_, i) =>
      tags({ title: `声音手记 ${i}`, track: i + 1 }),
    ),
  );
  const first = await lib.catalog.page({ limit: 80 });
  const second = await lib.catalog.page({ offset: 80, limit: 80 });
  assert.equal(first.total, 330);
  assert.equal(first.items.length, 80);
  assert.equal(
    new Set([...first.items, ...second.items].map((t) => t.id)).size,
    160,
  );
  assert.ok(first.items.every((t) => !t.hydrated && !t.lyrics.length));
  assert.equal((await lib.catalog.page({ query: "声音手记 329" })).total, 1);
  assert.equal((await lib.catalog.page({ query: "声音" })).total, 330);
  assert.equal((await lib.catalog.page({ query: '" OR 1=1 --' })).total, 0);
  const album = (await lib.catalog.page({ kind: "albums" })).items[0];
  assert.equal(album.collectionCount, 330);
  assert.equal(
    (
      await lib.catalog.page({
        collectionKind: "albums",
        collection: album.collectionKey,
        limit: 80,
      })
    ).total,
    330,
  );
  assert.equal(
    (await lib.catalog.page({ sourceIds: ["not-selected"] })).total,
    0,
  );
});

test("complete albums stay on one source; credential failures cannot outrank a local copy", async () => {
  const { lib } = setup();
  await lib.init();
  await lib.saveSource(remote);
  await add(lib, "local", [tags({ title: "One", track: 1 })]);
  await add(lib, "server", [
    tags({ title: "One", track: 1 }),
    tags({ title: "Two", track: 2 }),
  ]);
  const album = (await lib.catalog.page({ kind: "albums" })).items[0];
  assert.equal(
    await lib.catalog.completeAlbumSource(album.releaseKey!),
    "server",
  );
  await add(lib, "local", [
    tags({ title: "One", track: 1 }),
    tags({ title: "Two", track: 2 }),
  ]);
  assert.equal(
    await lib.catalog.completeAlbumSource(album.releaseKey!),
    "local",
  );
  lib.catalog.setSourceAvailability("local", false);
  assert.equal((await lib.catalog.page()).items[0].sourceId, "server");
  assert.equal(
    await lib.catalog.completeAlbumSource(album.releaseKey!),
    "server",
  );
  lib.catalog.setSourceAvailability("local", true);
  assert.equal((await lib.catalog.page()).items[0].sourceId, "local");
  await lib.catalog.prefer(
    (await lib.catalog.page()).items[0].songKey!,
    "server:0.flac",
  );
  assert.equal(
    await lib.catalog.completeAlbumSource(album.releaseKey!),
    undefined,
  );
});

test("imports use the transaction-scoped connection when exclusive transactions are available", async () => {
  const { lib, db, sql } = setup();
  await lib.init();
  let exclusive = 0;
  let active = false;
  const write = db.runAsync.bind(db);
  const tx: Database = { ...db, runAsync: write };
  db.runAsync = async (query, ...params) => {
    assert.equal(active, false, "import writes escaped to the main connection");
    return write(query, ...params);
  };
  db.withExclusiveTransactionAsync = async (task) => {
    exclusive++;
    active = true;
    sql.exec("BEGIN");
    try {
      await task(tx);
      sql.exec("COMMIT");
    } catch (error) {
      sql.exec("ROLLBACK");
      throw error;
    } finally {
      active = false;
    }
  };
  await add(lib, "local");
  assert.equal(exclusive, 1);
  assert.equal((await lib.catalog.page()).total, 1);
});

test("a legacy favorite is visible on every duplicate including hydrated playback details", async () => {
  const { lib, sql } = setup();
  await lib.init();
  await lib.saveSource(remote);
  await add(lib, "local");
  sql.prepare("INSERT INTO favorites VALUES (?)").run("local:0.flac");
  await add(lib, "server");
  const page = await lib.catalog.page({ favorites: true });
  assert.equal(page.total, 1);
  const copies = await lib.catalog.copies(page.items[0].songKey!);
  assert.ok(copies.every((copy) => copy.favorite));
  assert.equal((await lib.catalog.detail("server:0.flac"))?.favorite, true);
  assert.equal((await lib.catalog.byIds(["server:0.flac"]))[0].favorite, true);
});

test("artist album queries include complete compilations without loading unrelated albums", async () => {
  const { lib } = setup();
  await lib.init();
  await add(lib, "local", [
    tags({ artist: "Artist A", albumArtist: "Various", track: 1 }),
    tags({ artist: "Artist B", albumArtist: "Various", track: 2 }),
    tags({ artist: "Artist B", album: "Unrelated", track: 1 }),
  ]);
  const page = await lib.catalog.page({ artistAlbumsOf: "Artist A" });
  assert.equal(page.total, 2);
  assert.deepEqual(
    new Set(page.items.map((item) => item.artist)),
    new Set(["Artist A", "Artist B"]),
  );
});
