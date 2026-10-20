import type { Metadata } from "./types";

// Keep these IDs stable: images are shared by every view of the same collection.
export const albumPlaceholders = ["album-amber", "album-tidal", "album-dusk", "album-dune"] as const;
export const artistPlaceholders = ["artist-bronze", "artist-slate"] as const;
const normalize = (value = "") => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
const known = (value = "") => !!normalize(value) && !/^(未知|unknown)/i.test(value.trim());

function choose<T>(key: string, choices: readonly T[]): T {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return choices[(hash >>> 0) % choices.length];
}

export function albumPlaceholder(track?: Pick<Metadata, "album" | "albumArtist" | "artist" | "title"> & { id?: string }) {
  if (!track) return albumPlaceholders[0];
  const artist = known(track.albumArtist) ? track.albumArtist! : track.artist;
  const key = known(track.album)
    ? ["album", normalize(artist), normalize(track.album)]
    : ["track", normalize(artist), normalize(track.title) || track.id || ""];
  return choose(JSON.stringify(key), albumPlaceholders);
}

export function artistPlaceholder(name?: string) {
  return known(name) ? choose(normalize(name), artistPlaceholders) : artistPlaceholders[0];
}
