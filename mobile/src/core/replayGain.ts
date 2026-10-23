export type ReplayGainTags = {
  trackGain?: number;
  trackPeak?: number;
  albumGain?: number;
  albumPeak?: number;
};
export type ReplayGainSettings = {
  mode: "off" | "track" | "album";
  preamp: number;
  preventClipping: boolean;
};
export const defaultReplayGain: ReplayGainSettings = {
  mode: "off",
  preamp: 0,
  preventClipping: true,
};
export function normalizeReplayGain(
  value?: Partial<ReplayGainSettings> | null,
): ReplayGainSettings {
  return {
    mode:
      value?.mode === "track" || value?.mode === "album" ? value.mode : "off",
    preamp:
      typeof value?.preamp === "number" && Number.isFinite(value.preamp)
        ? Math.max(-12, Math.min(12, value.preamp))
        : 0,
    preventClipping: value?.preventClipping !== false,
  };
}
export function replayGainDb(
  tags: ReplayGainTags | undefined,
  settings: ReplayGainSettings,
): number {
  if (!tags || settings.mode === "off") return 0;
  const album = settings.mode === "album" && Number.isFinite(tags.albumGain);
  const gain = album ? tags.albumGain : tags.trackGain;
  if (typeof gain !== "number" || !Number.isFinite(gain)) return 0;
  let db = Math.max(-60, Math.min(24, gain + settings.preamp));
  const peak = album ? tags.albumPeak : tags.trackPeak;
  if (
    settings.preventClipping &&
    typeof peak === "number" &&
    Number.isFinite(peak) &&
    peak > 0
  )
    db = Math.min(db, -20 * Math.log10(peak));
  return Math.max(-60, db) || 0;
}
