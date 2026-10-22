import type { Metadata } from "./types";
const normalize = (s = "") =>
  s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function releaseIdentity(tags: Metadata) {
  if (tags.releaseId) return `mb-release:${normalize(tags.releaseId)}`;
  return JSON.stringify([
    normalize(tags.albumArtist || tags.artist),
    normalize(tags.album),
    tags.year || 0,
    normalize(tags.edition),
  ]);
}
/** Deliberately conservative: unknown tags never collapse unrelated files. */
export function songIdentity(tags: Metadata, copyId: string) {
  const release = releaseIdentity(tags);
  if (
    !tags.title ||
    tags.artist === "未知艺术家" ||
    tags.album === "未命名专辑" ||
    !tags.duration
  )
    return `copy:${copyId}`;
  return JSON.stringify([
    release,
    tags.recordingId
      ? `mb:${normalize(tags.recordingId)}`
      : normalize(tags.title),
    normalize(tags.artist),
    tags.disc || 1,
    tags.track || 0,
    Math.round(tags.duration),
  ]);
}
export function isLossless(format: string) {
  return ["FLAC", "WAV", "WAVE", "AIFF", "AIF", "ALAC", "DSF"].includes(
    format.toUpperCase(),
  );
}
