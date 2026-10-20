import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailySelection,
  localDayKey,
  relatedSelection,
} from "../src/core/discovery";
const songs = Array.from({ length: 50 }, (_, i) => ({
  id: String(i),
  artist: `Artist ${i % 5}`,
  album: `Album ${i % 10}`,
  favorite: i === 3,
}));
test("daily mix is stable for the local day, capped, unique and independent of row order", () => {
  const mix = dailySelection(songs, "2026-10-20");
  assert.equal(mix.length, 30);
  assert.equal(new Set(mix.map((t) => t.id)).size, 30);
  assert.deepEqual(dailySelection([...songs].reverse(), "2026-10-20"), mix);
  assert.notDeepEqual(dailySelection(songs, "2026-10-21"), mix);
  assert.equal(dailySelection(songs.slice(0, 2), "2026-10-20").length, 2);
  assert.deepEqual(dailySelection([], "2026-10-20"), []);
  assert.equal(localDayKey(new Date(2026, 9, 20, 0, 1)), "2026-10-20");
});
test("related songs exclude current and unrelated songs, rank same album before favorites", () => {
  const mix = relatedSelection(songs, songs[0]);
  assert.equal(mix[0].artist, songs[0].artist);
  assert.equal(mix[0].album, songs[0].album);
  assert.ok(
    mix.every(
      (t) => t.id !== "0" && (t.artist === songs[0].artist || t.favorite),
    ),
  );
  assert.deepEqual(relatedSelection(songs), [songs[3]]);
  assert.deepEqual(
    relatedSelection(
      [{ id: "a", artist: "未知艺术家", album: "未知专辑", favorite: false }],
      {
        id: "b",
        artist: "未知艺术家",
        album: "未知专辑",
        favorite: false,
      },
    ),
    [],
  );
});
