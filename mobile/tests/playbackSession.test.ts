import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkpointFor,
  reorderedSessionIds,
  normalizeSession,
  restoreSession,
  type PlaybackSession,
} from "../src/core/playbackSession";
import { fallbackMetadata, type Track } from "../src/core/types";
const track = (id: string, available = true): Track => ({
  ...fallbackMetadata(`${id}.wav`),
  id,
  available,
  sourceId: "local",
  uri: "",
  path: `${id}.wav`,
  size: 1,
  mtime: 0,
  favorite: false,
  duration: 24,
});
const session: PlaybackSession = {
  version: 1,
  token: "queue-a",
  queueIds: ["c", "a", "b"],
  originalIds: ["a", "b", "c"],
  nativeIds: ["c", "a", "b"],
  currentId: "a",
  position: 8,
  mode: "shuffle",
};
test("restore shuffled queue, original order and position using fresh metadata", () => {
  const result = restoreSession(session, [track("a"), track("b"), track("c")]);
  assert.deepEqual(
    result.ordered.map((t) => t.id),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    result.original.map((t) => t.id),
    ["a", "b", "c"],
  );
  assert.equal(result.current?.id, "a");
  assert.equal(result.position, 8);
});
test("native checkpoint wins only for its own queue token and native projection", () => {
  const saved = { ...session, nativeIds: ["a", "b"] };
  const tracks = [track("a"), track("b"), track("c", false)];
  const result = restoreSession(saved, tracks, {
    token: "queue-a",
    index: 1,
    position: 11,
  });
  assert.equal(result.current?.id, "b");
  assert.equal(result.position, 11);
  for (const checkpoint of [
    { token: "old-queue", index: 1, position: 11 },
    { token: "queue-a", index: 4, position: 11 },
    { token: "queue-a", index: 1, position: NaN },
  ])
    assert.equal(restoreSession(saved, tracks, checkpoint).position, 8);
});
test("offline current falls forward without deleting canonical queue IDs or reusing its position", () => {
  const result = restoreSession(session, [
    track("a", false),
    track("b"),
    track("c"),
  ]);
  assert.equal(result.current?.id, "b");
  assert.equal(result.position, 0);
  assert.equal(result.unavailable, 1);
  assert.deepEqual(session.queueIds, ["c", "a", "b"]);
  assert.equal(restoreSession(session, [track("a", false)]).current, undefined);
});
test("restoring a queue skips unsupported DSD regardless of format tag casing", () => {
  for (const format of ["DSF", "dsf", "DFF", "dff"]) {
    const result = restoreSession(session, [
      { ...track("a"), format },
      track("b"),
      track("c"),
    ]);
    assert.equal(result.current?.id, "b");
    assert.equal(result.position, 0);
    assert.deepEqual(result.ordered.map((t) => t.id), ["c", "b"]);
    assert.deepEqual(session.queueIds, ["c", "a", "b"]);
  }
});
test("invalid sessions are rejected and a shorter replacement file clamps position", () => {
  assert.equal(normalizeSession({ version: 9 }), null);
  assert.equal(normalizeSession(null), null);
  assert.equal(
    restoreSession({ ...session, position: 100 }, [track("a")]).position,
    23.95,
  );
  assert.deepEqual(
    normalizeSession({
      ...session,
      queueIds: ["a", "a", null, 3],
      position: -1,
    })?.queueIds,
    ["a"],
  );
});

test("compact database checkpoint is used if the native record is absent or belongs to an old queue", () => {
  const database = { token: session.token, index: 2, position: 12 };
  const selected = checkpointFor(
    session,
    { token: "old", index: 1, position: 9 },
    database,
  );
  assert.deepEqual(selected, database);
  assert.equal(
    restoreSession(session, [track("a"), track("b"), track("c")], selected)
      .current?.id,
    "b",
  );
  assert.equal(
    checkpointFor(
      session,
      {},
      { token: session.token, index: 0, position: -1 },
    ),
    undefined,
  );
});

test("switching random and ordered playback retains offline entries in the saved queue", () => {
  const shuffled = reorderedSessionIds(session, ["b", "c"], true);
  assert.deepEqual(shuffled.queueIds, ["b", "c", "a"]);
  assert.deepEqual(shuffled.originalIds, ["a", "b", "c"]);
  const ordered = reorderedSessionIds(
    { ...session, ...shuffled },
    ["b", "c"],
    false,
  );
  assert.deepEqual(ordered.queueIds, ["a", "b", "c"]);
});
