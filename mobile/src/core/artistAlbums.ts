import type { Track } from "./types";

export const albumKey = (track: Track) =>
  track.releaseKey ||
  JSON.stringify([track.albumArtist || track.artist, track.album]);

export type ArtistAlbum = {
  key: string;
  title: string;
  artist: string;
  cover: Track;
  tracks: Track[];
};

export function artistAlbums(tracks: Track[], current: Track): ArtistAlbum[] {
  const groups = new Map<string, ArtistAlbum>();
  for (const track of tracks) {
    const key = albumKey(track);
    let album = groups.get(key);
    if (!album) {
      album = {
        key,
        title: track.album,
        artist: track.albumArtist || track.artist,
        cover: track,
        tracks: [],
      };
      groups.set(key, album);
    }
    album.tracks.push(track);
    if (!album.cover.artwork && track.artwork) album.cover = track;
  }
  return [...groups.values()]
    .filter((album) =>
      album.tracks.some((track) => track.artist === current.artist),
    )
    .map((album) => ({
      ...album,
      tracks: album.tracks.sort(
        (a, b) =>
          (a.disc || 1) - (b.disc || 1) || (a.track || 0) - (b.track || 0),
      ),
    }))
    .sort(
      (a, b) =>
        Number(b.key === albumKey(current)) -
          Number(a.key === albumKey(current)) ||
        a.title.localeCompare(b.title, "zh-CN"),
    );
}
