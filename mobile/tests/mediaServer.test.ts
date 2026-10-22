import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { MediaServer, normalizeServerUrl } from "../src/core/mediaServer";
import { syncMediaSource } from "../src/core/remoteSync";
import { Library, type Database } from "../src/core/library";
import type { MusicSource } from "../src/core/types";
const config = {
  baseUrl: "https://music.test/jellyfin",
  userId: "u1",
  libraryId: "music1",
  serverId: "s1",
};
const source: MusicSource = {
  id: "remote",
  name: "家庭曲库",
  kind: "jellyfin",
  uri: "server:music1",
  config,
};
const audio = (n: number) => ({
  Id: `a${n}`,
  Name: `Song ${n}`,
  Artists: ["Artist"],
  AlbumArtist: "Artist",
  Album: "Album",
  AlbumId: "album1",
  IndexNumber: n + 1,
  RunTimeTicks: 2000000000,
  ImageTags: { Primary: "cover-revision" },
  MediaSources: [
    {
      Id: `media${n}`,
      Size: 12345,
      MediaStreams: [
        {
          Type: "Audio",
          Codec: "flac",
          SampleRate: 96000,
          BitDepth: 24,
          Channels: 2,
        },
      ],
    },
  ],
  Path: `/music/Song ${n}.flac`,
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
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
for (const kind of ["jellyfin", "emby"] as const)
  test(`${kind}: login, music libraries, metadata pages and original stream URLs`, async () => {
    const requests: { url: URL; options?: RequestInit }[] = [];
    const mock: typeof fetch = async (url, options) => {
      const parsed = new URL(String(url));
      requests.push({ url: parsed, options });
      if (parsed.pathname.endsWith("AuthenticateByName"))
        return response({
          AccessToken: "secret",
          User: { Id: "u1" },
          ServerId: "s1",
        });
      if (parsed.pathname.endsWith("Views"))
        return response({
          Items: [
            { Id: "music1", Name: "音乐", CollectionType: "music" },
            { Id: "video", CollectionType: "movies" },
          ],
        });
      return response({ Items: [audio(0)], TotalRecordCount: 1 });
    };
    const server = new MediaServer(config.baseUrl, kind, mock);
    const session = await server.login("listener", "private-password");
    assert.equal(
      JSON.parse(requests[0].options!.body as string).Pw,
      "private-password",
    );
    assert.ok(!requests[0].url.toString().includes("private-password"));
    assert.deepEqual(await server.libraries(session), [
      { id: "music1", name: "音乐" },
    ]);
    assert.equal(
      new Headers(requests[1].options?.headers).get("X-Emby-Token"),
      "secret",
    );
    const page = await server.items(
      config,
      "secret",
      100,
      new AbortController().signal,
    );
    assert.equal(requests[2].url.searchParams.get("StartIndex"), "100");
    assert.equal(page.items[0].metadata.sampleRate, 96000);
    assert.equal(page.items[0].metadata.duration, 200);
    assert.equal(page.items[0].metadata.format, "FLAC");
    const stream = new URL(server.stream(config, "a0", "media0"));
    assert.equal(stream.pathname, "/jellyfin/Audio/a0/stream");
    assert.equal(stream.searchParams.get("Static"), "true");
    assert.ok(!stream.searchParams.has("api_key"));
  });
test("reject credential URLs; 401 messages never expose server bodies", async () => {
  for (const url of [
    "file:///music",
    "https://user:secret@music.test",
    "https://music.test?api_key=secret",
    "not a url",
  ])
    assert.throws(() => normalizeServerUrl(url));
  assert.equal(
    normalizeServerUrl("http://192.168.1.2:8096/emby/"),
    "http://192.168.1.2:8096/emby",
  );
  const server = new MediaServer(config.baseUrl, "emby", async () =>
    response({ error: "sensitive token" }, 401),
  );
  await assert.rejects(server.login("user", "secret"), /登录已失效/);
});
test("remote sync discovers before importing; resync preserves favorites and marks missing only after success", async () => {
  const { db, lib, sql } = setup();
  await lib.init();
  await lib.saveSource(source);
  let count = 205;
  const server = new MediaServer(config.baseUrl, "jellyfin", async (url) => {
    const start = Number(new URL(String(url)).searchParams.get("StartIndex"));
    return response({
      Items: Array.from({ length: Math.min(100, count - start) }, (_, n) =>
        audio(start + n),
      ),
      TotalRecordCount: count,
    });
  });
  const steps: { phase: string; done: number; total: number | null }[] = [];
  await syncMediaSource(
    db,
    source,
    "secret",
    new AbortController().signal,
    (p) => steps.push(p),
    server,
  );
  assert.equal((await lib.catalog.page()).total, 205);
  const firstImport = steps.findIndex((s) => s.phase === "importing");
  assert.equal(steps[firstImport].total, 205);
  assert.equal(steps[firstImport - 1].done, 205);
  assert.equal(steps.at(-1)!.done, 205);
  await lib.favorite("remote:a0", true);
  count = 2;
  await syncMediaSource(
    db,
    source,
    "secret",
    new AbortController().signal,
    () => {},
    server,
  );
  assert.equal((await lib.catalog.page({ favorites: true })).total, 1);
  assert.equal(
    sql
      .prepare(
        "SELECT COUNT(*) AS n FROM tracks WHERE source_id='remote' AND available=1",
      )
      .get()!.n,
    2,
  );
  assert.equal(
    sql.prepare("SELECT COUNT(*) AS n FROM remote_stage").get()!.n,
    0,
  );
  assert.ok(
    !JSON.stringify(
      sql.prepare("SELECT uri,metadata FROM tracks").all(),
    ).includes("secret"),
  );
});
test("incomplete listings, duplicates, changing totals and cancellation retain the previous snapshot", async () => {
  for (const scenario of ["partial", "duplicate", "changed", "cancel-import"]) {
    const { db, lib, sql } = setup();
    await lib.init();
    await lib.saveSource(source);
    const initial = new MediaServer(config.baseUrl, "jellyfin", async () =>
      response({ Items: [audio(0)], TotalRecordCount: 1 }),
    );
    await syncMediaSource(
      db,
      source,
      "secret",
      new AbortController().signal,
      () => {},
      initial,
    );
    const before = sql.prepare("SELECT * FROM tracks").all();
    const controller = new AbortController();
    const client = new MediaServer(config.baseUrl, "jellyfin", async (url) => {
      const start = Number(new URL(String(url)).searchParams.get("StartIndex"));
      if (scenario === "cancel-import")
        return response({ Items: [audio(1)], TotalRecordCount: 1 });
      return response({
        Items: start ? (scenario === "partial" ? [] : [audio(1)]) : [audio(1)],
        TotalRecordCount: scenario === "changed" && start ? 3 : 2,
      });
    });
    await assert.rejects(
      syncMediaSource(
        db,
        source,
        "secret",
        controller.signal,
        (p) => {
          if (scenario === "cancel-import" && p.phase === "importing" && p.done)
            controller.abort();
        },
        client,
      ),
    );
    assert.deepEqual(
      sql.prepare("SELECT * FROM tracks").all(),
      before,
      scenario,
    );
    assert.equal(
      sql.prepare("SELECT COUNT(*) AS n FROM remote_stage").get()!.n,
      0,
    );
  }
});

test("album-level MusicBrainz IDs are mapped to audio so local and remote releases can aggregate", async () => {
  const client = new MediaServer(config.baseUrl, "jellyfin", async (url) => {
    const query = new URL(String(url)).searchParams;
    return query.get("IncludeItemTypes") === "MusicAlbum"
      ? response({
          Items: [
            { Id: "album1", ProviderIds: { MusicBrainzAlbum: "release-123" } },
          ],
        })
      : response({ Items: [audio(0)], TotalRecordCount: 1 });
  });
  const page = await client.items(
    config,
    "secret",
    0,
    new AbortController().signal,
  );
  assert.equal(page.items[0].metadata.releaseId, "release-123");
});
