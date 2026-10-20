import { normalizePreferences } from "./preferences";
import type { Preferences } from "./types";
export type PortableSettings = Omit<Preferences, "lastTrack">;
export type SettingsBackup = {
  format: "sovel-settings";
  version: 1;
  createdAt: string;
  settings: PortableSettings;
};
export const backupMaxBytes = 1024 * 1024;
export function createSettingsBackup(
  prefs: Preferences,
  date = new Date(),
): SettingsBackup {
  const { lastTrack: _, ...settings } = normalizePreferences(prefs);
  return {
    format: "sovel-settings",
    version: 1,
    createdAt: date.toISOString(),
    settings,
  };
}
export function parseSettingsBackup(text: string): SettingsBackup {
  if (text.length > backupMaxBytes) throw new Error("备份文件超过 1 MB");
  let value: any;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("这不是有效的 JSON 备份");
  }
  if (value?.format !== "sovel-settings" || value?.version !== 1)
    throw new Error("不支持的备份格式或版本");
  const p = value.settings;
  if (!p || typeof p !== "object" || Array.isArray(p))
    throw new Error("备份缺少设置内容");
  const normalized = normalizePreferences(p);
  // Older v1 backups predate DSD settings; missing values migrate to defaults.
  if (
    p.dsd !== undefined &&
    (p.dsd?.mode !== "pcm" || p.dsd?.pcmRate !== normalized.dsd.pcmRate)
  )
    throw new Error("DSD 输出模式或 PCM 采样率无效");
  for (const key of [
    "home",
    "player",
    "record",
    "recordSpeed",
    "tonearmStyle",
    "cartridgeColor",
    "stylusLight",
    "playbackMode",
    "albumLayout",
    "artistLayout",
    "largeLyrics",
    "backgroundPlayback",
  ] as const)
    if (p[key] !== normalized[key]) throw new Error(`备份设置无效：${key}`);
  const r = p.scanRules;
  if (
    !r ||
    ["filterSmall", "ignoreHidden", "includeSubfolders"].some(
      (k) => typeof r[k] !== "boolean",
    ) ||
    !Number.isInteger(r.minSizeKB) ||
    r.minSizeKB < 1 ||
    r.minSizeKB > 1048576
  )
    throw new Error("扫描规则无效");
  const eq = p.equalizer;
  const validSound = (s: any) =>
    s &&
    Array.isArray(s.gains) &&
    s.gains.length === 10 &&
    s.gains.every(
      (g: unknown) =>
        typeof g === "number" && Number.isFinite(g) && g >= -12 && g <= 12,
    ) &&
    typeof s.preamp === "number" &&
    Number.isFinite(s.preamp) &&
    s.preamp >= -24 &&
    s.preamp <= 0 &&
    typeof s.headroom === "boolean";
  if (
    !validSound(eq) ||
    typeof eq.enabled !== "boolean" ||
    typeof eq.presetId !== "string" ||
    !Array.isArray(eq.userPresets) ||
    eq.userPresets.length > 30 ||
    eq.userPresets.some(
      (s: any) =>
        !validSound(s) ||
        typeof s.id !== "string" ||
        !s.id.startsWith("user-") ||
        typeof s.name !== "string" ||
        !s.name.trim() ||
        s.name.length > 24,
    ) ||
    new Set(eq.userPresets.map((s: any) => s.id)).size !==
      eq.userPresets.length ||
    new Set(eq.userPresets.map((s: any) => s.name.trim())).size !==
      eq.userPresets.length
  )
    throw new Error("均衡器参数或自定义预设无效");
  // Only exportable fields survive; paths, grants, queues and arbitrary keys never enter storage.
  return createSettingsBackup(
    normalized,
    Number.isFinite(Date.parse(value.createdAt))
      ? new Date(value.createdAt)
      : new Date(0),
  );
}
