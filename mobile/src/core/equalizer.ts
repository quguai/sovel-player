export const eqFrequencies = [
  31.25, 62.5, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;
export type EqSound = { gains: number[]; preamp: number; headroom: boolean };
export type EqPreset = EqSound & { id: string; name: string };
export type EqualizerSettings = EqSound & {
  enabled: boolean;
  presetId: string;
  userPresets: EqPreset[];
};
const preset = (id: string, name: string, gains: number[]): EqPreset => ({
  id,
  name,
  gains,
  preamp: 0,
  headroom: true,
});
// Sovel's own gentle starting curves; no spatial/reverb processing is implied.
export const eqPresets: EqPreset[] = [
  preset("flat", "平直", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  preset("vocal", "人声", [-2, -2, -1, 0, 1, 2, 2, 1, 0, -1]),
  preset("pop", "流行", [1, 2, 1, 0, -1, 0, 1, 2, 1, 0]),
  preset("rock", "摇滚", [2, 3, 2, 0, -2, -1, 1, 2, 3, 2]),
  preset("classical", "古典", [1, 1, 0, 0, 0, 0, 0, 1, 2, 1]),
  preset("bass", "低频增强", [4, 4, 3, 1, 0, 0, 0, 0, 0, 0]),
];
export const defaultEqualizer: EqualizerSettings = {
  enabled: false,
  presetId: "flat",
  gains: Array(10).fill(0),
  preamp: 0,
  headroom: true,
  userPresets: [],
};
const clamp = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : 0;
export function normalizeEqSound(value: Partial<EqSound> = {}): EqSound {
  return {
    gains: eqFrequencies.map((_, i) => clamp(value.gains?.[i], -12, 12)),
    preamp: clamp(value.preamp, -24, 0),
    headroom: value.headroom !== false,
  };
}
export function normalizeEqualizer(
  value?: Partial<EqualizerSettings> | null,
): EqualizerSettings {
  const saved = value || {},
    seen = new Set<string>();
  const userPresets = (
    Array.isArray(saved.userPresets) ? saved.userPresets : []
  )
    .flatMap((p) => {
      if (
        !p ||
        typeof p.id !== "string" ||
        !p.id.startsWith("user-") ||
        seen.has(p.id) ||
        typeof p.name !== "string" ||
        !p.name.trim()
      )
        return [];
      seen.add(p.id);
      return [
        { id: p.id, name: p.name.trim().slice(0, 24), ...normalizeEqSound(p) },
      ];
    })
    .slice(0, 30);
  const id = typeof saved.presetId === "string" ? saved.presetId : "flat";
  return {
    ...normalizeEqSound(saved),
    enabled: saved.enabled === true,
    userPresets,
    presetId: [...eqPresets, ...userPresets].some((p) => p.id === id)
      ? id
      : "custom",
  };
}
export function applyEqPreset(
  settings: EqualizerSettings,
  id: string,
): EqualizerSettings {
  const found = [...eqPresets, ...settings.userPresets].find(
    (p) => p.id === id,
  );
  return found
    ? { ...settings, ...normalizeEqSound(found), presetId: id }
    : settings;
}
export function saveEqPreset(
  settings: EqualizerSettings,
  name: string,
  id: string,
): EqualizerSettings {
  const cleaned = name.trim().slice(0, 24);
  if (!cleaned) throw new Error("请为预设取一个名字");
  if (settings.userPresets.some((p) => p.name === cleaned && p.id !== id))
    throw new Error("已有同名预设，请换一个名字");
  if (
    settings.userPresets.length >= 30 &&
    !settings.userPresets.some((p) => p.id === id)
  )
    throw new Error("最多保存 30 个自定义预设");
  return normalizeEqualizer({
    ...settings,
    presetId: id,
    userPresets: [
      ...settings.userPresets.filter((p) => p.id !== id),
      { id, name: cleaned, ...normalizeEqSound(settings) },
    ],
  });
}
export function deleteEqPreset(
  settings: EqualizerSettings,
  id: string,
): EqualizerSettings {
  return {
    ...settings,
    presetId: settings.presetId === id ? "custom" : settings.presetId,
    userPresets: settings.userPresets.filter((p) => p.id !== id),
  };
}
export const eqPresetName = (settings: EqualizerSettings) =>
  [...eqPresets, ...settings.userPresets].find(
    (p) => p.id === settings.presetId,
  )?.name || "自定义";
export const eqFrequencyLabel = (hz: number) =>
  hz >= 1000 ? `${hz / 1000}k` : `${Math.round(hz)}`;
