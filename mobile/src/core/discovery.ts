import type { ListeningProfile } from "./listeningHistory";
type MusicItem = {
  id: string;
  artist: string;
  album: string;
  favorite: boolean;
  genres?: string[];
};

export function localDayKey(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Stable within a local calendar day, independent of database row order.
export function dailySelection<T extends MusicItem>(
  tracks: T[],
  day: string,
): T[] {
  const result = [...new Map(tracks.map((t) => [t.id, t])).values()].sort(
    (a, b) => a.id.localeCompare(b.id),
  );
  let seed = 2166136261;
  for (const char of day) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const random = () => {
    seed += 0x6d2b79f5;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.slice(0, 30);
}

export function relatedSelection<T extends MusicItem>(
  tracks: T[],
  current?: T,
  profile?: ListeningProfile,
): T[] {
  const known = (text: string) => text.trim() && !/^(未知|unknown)/i.test(text);
  return tracks
    .filter((t) => t.id !== current?.id)
    .map((track) => {
      const sameArtist =
        !!current && known(current.artist) && track.artist === current.artist;
      const sameAlbum =
        sameArtist && known(current!.album) && track.album === current!.album;
      return {
        track,
        score:
          (sameArtist ? 12 : 0) +
          (sameAlbum ? 6 : 0) +
          (track.favorite ? 6 : 0) +
          Math.max(-4, Math.min(4, profile?.tracks[track.id] || 0)) +
          Math.max(-4, Math.min(8, profile?.artists[track.artist] || 0)) +
          Math.max(
            -4,
            Math.min(
              8,
              (track.genres || []).reduce(
                (sum, genre) =>
                  sum + (profile?.genres[genre.toLowerCase().trim()] || 0),
                0,
              ),
            ),
          ),
      };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id))
    .slice(0, 30)
    .map(({ track }) => track);
}
