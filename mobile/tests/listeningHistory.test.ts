import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Library, type Database } from "../src/core/library";
import { fallbackMetadata } from "../src/core/types";
import {
  listeningScore,
  type ListeningEvent,
} from "../src/core/listeningHistory";
import { relatedSelection } from "../src/core/discovery";
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
    withTransactionAsync: async (work) => {
      sqlite.exec("BEGIN");
      try {
        await work();
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return new Library(db);
}
const now = Date.now();
const event = (patch: Partial<ListeningEvent> = {}): ListeningEvent => ({
  id: "play-1",
  trackId: "local:one.flac",
  startedAt: now - 110000,
  updatedAt: now,
  duration: 100,
  listenedSeconds: 92,
  coveredSeconds: 92,
  reason: "completed",
  seekCount: 0,
  revision: 1,
  ...patch,
});
test("history snapshots are idempotent, reject stale/invalid progress, and survive rescans", async () => {
  const lib = setup();
  await lib.init();
  const enumerate = async () => [{ path: "one.flac", size: 1, mtime: 1 }];
  const parse = async () => ({
    ...fallbackMetadata("one.flac"),
    title: "One",
    artist: "Artist",
    genres: ["Ambient"],
  });
  await lib.scan("full", enumerate, parse, () => {});
  await lib.history.ingest([event(), event()]);
  assert.deepEqual(
    { ...(await lib.history.summary()) },
    {
      plays: 1,
      seconds: 92,
      completed: 1,
    },
  );
  await lib.history.ingest([
    event({ revision: 2, listenedSeconds: 105, coveredSeconds: 98 }),
  ]);
  await lib.history.ingest([
    event(),
    event({ id: "invalid", coveredSeconds: 500 }),
    event({ id: "nan", duration: NaN }),
  ]);
  assert.deepEqual(
    { ...(await lib.history.summary()) },
    {
      plays: 1,
      seconds: 105,
      completed: 1,
    },
  );
  assert.equal((await lib.history.recent())[0].completion, 0.98);
  await lib.init();
  await lib.scan("full", enumerate, parse, () => {});
  assert.equal((await lib.history.summary()).plays, 1);
  const profile = await lib.history.profile(now);
  assert.equal(profile.genres.ambient, 2);
  assert.equal(profile.artists.Artist, 2);
  assert.equal((await lib.history.recent())[0].metadata.title, "One");
});
test("preference evidence distinguishes skips, seeks, interruptions, repeats and old records", async () => {
  assert.equal(
    listeningScore(
      event({ coveredSeconds: 2, listenedSeconds: 2, reason: "skip" }),
    ),
    -0.35,
  );
  for (const reason of ["paused", "interrupted", "error", "replay"]) {
    assert.equal(
      listeningScore(event({ coveredSeconds: 2, listenedSeconds: 2, reason })),
      0,
    );
  }
  assert.equal(
    listeningScore(
      event({
        coveredSeconds: 2,
        listenedSeconds: 2,
        reason: "skip",
        seekCount: 1,
      }),
    ),
    0,
  );
  const lib = setup();
  await lib.init();
  await lib.scan(
    "full",
    async () => [{ path: "one.flac", size: 1, mtime: 1 }],
    async () => ({
      ...fallbackMetadata("one.flac"),
      artist: "Artist",
      genres: ["Jazz"],
    }),
    () => {},
  );
  await lib.history.ingest(
    Array.from({ length: 10 }, (_, i) => event({ id: `repeat-${i}` })),
  );
  assert.equal(
    (await lib.history.profile(now)).tracks["local:one.flac"],
    6,
    "repeat evidence is bounded",
  );
  const oldLib = setup();
  await oldLib.init();
  await oldLib.history.ingest([
    event({ startedAt: now - 100 * 86400000, updatedAt: now - 99 * 86400000 }),
  ]);
  assert.equal(
    (await oldLib.history.recent()).length,
    1,
    "full history is retained",
  );
  assert.deepEqual(
    (await oldLib.history.profile(now)).tracks,
    {},
    "old evidence leaves the recent profile",
  );
  const candidates = [
    {
      id: "a",
      artist: "New Artist",
      album: "New",
      genres: ["Jazz"],
      favorite: false,
    },
    {
      id: "b",
      artist: "Other",
      album: "Other",
      genres: ["Rock"],
      favorite: false,
    },
  ];
  assert.deepEqual(
    relatedSelection(candidates, undefined, await lib.history.profile(now)).map(
      (t) => t.id,
    ),
    ["a"],
  );
});
test("unknown duration has no invented completion and history can be paged", async () => {
  const lib = setup();
  await lib.init();
  await lib.history.ingest([
    event({ id: "a", duration: 0, coveredSeconds: 0 }),
    event({ id: "b" }),
  ]);
  const recent = await lib.history.recent(1),
    older = await lib.history.recent(1, 1);
  assert.notEqual(recent[0].id, older[0].id);
  assert.equal(
    (await lib.history.recent()).find((t) => t.id === "a")?.completion,
    null,
  );
});
