import { test } from "node:test";
import assert from "node:assert/strict";
import { albumKey, artistAlbums } from "../src/core/artistAlbums";
import { fallbackMetadata, type Track } from "../src/core/types";

const track = (id: string, fields: Partial<Track> = {}): Track => ({
  ...fallbackMetadata(`${id}.flac`),
  id,
  sourceId: "local",
  uri: "",
  path: `${id}.flac`,
  size: 1,
  mtime: 0,
  available: true,
  favorite: false,
  artist: "歌手甲",
  album: "专辑甲",
  ...fields,
});

test("artist album cards count their own songs and do not merge another artist's identically named album", () => {
  const current = track("1", { track: 2 });
  const library = [
    current,
    track("2", { track: 1, artwork: "cover.jpg" }),
    track("3", { artist: "歌手乙" }),
    track("4", { album: "专辑乙" }),
  ];
  const albums = artistAlbums(library, current);
  assert.equal(albums.length, 2);
  assert.equal(albums[0].key, albumKey(current));
  assert.deepEqual(
    albums[0].tracks.map((song) => song.id),
    ["2", "1"],
  );
  assert.equal(albums[0].cover.artwork, "cover.jpg");
  assert.equal(albums[1].tracks.length, 1);
  assert.deepEqual(
    library.map((song) => song.id),
    ["1", "2", "3", "4"],
  );
});

test("a compilation card opens the full album in disc and track order", () => {
  const current = track("1", { albumArtist: "群星", disc: 2, track: 1 });
  const songs = [
    current,
    track("2", { albumArtist: "群星", artist: "歌手乙", disc: 1, track: 2 }),
    track("3", { albumArtist: "群星", artist: "歌手丙", disc: 1, track: 1 }),
  ];
  const [album] = artistAlbums(songs, current);
  assert.equal(album.artist, "群星");
  assert.equal(album.tracks.length, 3);
  assert.deepEqual(
    album.tracks.map((song) => song.id),
    ["3", "2", "1"],
  );
});
