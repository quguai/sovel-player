import type { LyricLine } from "./types";
export function parseLyrics(text: string): LyricLine[] {
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const timed: LyricLine[] = [],
    plain: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const value = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (!value) continue;
    if (!stamps.length) plain.push({ time: null, text: value });
    for (const stamp of stamps)
      timed.push({
        time: Math.max(
          0,
          Number(stamp[1]) * 60 +
            Number(stamp[2]) +
            Number(`0.${stamp[3] || 0}`) +
            offset,
        ),
        text: value,
      });
  }
  return timed.length ? timed.sort((a, b) => a.time! - b.time!) : plain;
}
export const normalizeLyricOffset = (value: number) => Number.isFinite(value) ? Math.round(Math.max(-30, Math.min(30, value)) * 10) / 10 : 0;
// Positive offset advances lyrics. Seeking uses the inverse so the tapped line stays aligned.
export const lyricSeekTime = (time: number, offset: number) => Math.max(0, time - normalizeLyricOffset(offset));
export function currentLyric(lines: LyricLine[], seconds: number, offset = 0) {
  let index = -1;
  for (let i = 0; i < lines.length; i++)
    if (lines[i].time !== null && lines[i].time! <= seconds + normalizeLyricOffset(offset)) index = i;
  return index;
}
