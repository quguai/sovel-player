import { test } from "node:test";
import assert from "node:assert/strict";
import { albumPlaceholder, artistPlaceholder, albumPlaceholders, artistPlaceholders } from "../src/core/placeholderArtwork";

test("album placeholders follow album identity across tracks, rescans and compilation artists", () => {
  const one = { album: "夜航", albumArtist: "Various Artists", artist: "歌手 A", title: "第一首", id: "old" };
  const two = { ...one, artist: "歌手 B", title: "第二首", id: "new" };
  assert.equal(albumPlaceholder(one), albumPlaceholder(two));
  assert.equal(albumPlaceholder(one), albumPlaceholder({ ...two, album: " 夜航 ", albumArtist: "various artists" }));
  const choices = new Set(Array.from({ length: 50 }, (_, i) => albumPlaceholder({ ...one, album: `专辑 ${i}` })));
  assert.equal(choices.size, albumPlaceholders.length);
});

test("artist defaults are stable, normalized, and do not require a portrait", () => {
  assert.equal(artistPlaceholder("  Sovel  "), artistPlaceholder("sovel"));
  assert.equal(artistPlaceholder(), artistPlaceholder("未知艺术家"));
  const choices = new Set(Array.from({ length: 30 }, (_, i) => artistPlaceholder(`Artist ${i}`)));
  assert.equal(choices.size, artistPlaceholders.length);
  assert.equal(albumPlaceholder(), albumPlaceholders[0]);
});
