export type PeqBand = {
  enabled: boolean;
  type: "PK" | "LSC" | "HSC";
  frequency: number;
  gain: number;
  q: number;
};
export type PeqSettings = {
  enabled: boolean;
  preamp: number;
  headroom: boolean;
  bands: PeqBand[];
};
export const defaultPeq: PeqSettings = {
  enabled: false,
  preamp: 0,
  headroom: true,
  bands: [],
};
const bounded = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.min(max, Math.max(min, n))
    : fallback;
export function normalizePeq(value?: Partial<PeqSettings> | null): PeqSettings {
  return {
    enabled: value?.enabled === true,
    preamp: bounded(value?.preamp, -24, 0, 0),
    headroom: value?.headroom !== false,
    bands: (Array.isArray(value?.bands) ? value.bands : [])
      .slice(0, 10)
      .filter((b) => b && typeof b === "object")
      .map((b) => ({
        enabled: b.enabled !== false,
        type: b.type === "LSC" || b.type === "HSC" ? b.type : "PK",
        frequency: bounded(b.frequency, 10, 24000, 1000),
        gain: bounded(b.gain, -24, 24, 0),
        q: bounded(b.q, 0.1, 20, 1),
      })),
  };
}
// Equalizer APO / AutoEq parametric text; reject unsupported filters instead of silently changing the curve.
export function parseAutoEq(text: string): PeqSettings {
  if (text.length > 65536) throw new Error("AutoEQ 文件不能超过 64 KB");
  const bands: PeqBand[] = [];
  let preamp = 0,
    seenPreamp = false;
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const amp = /^Preamp:\s*([+-]?[\d.]+)\s*dB$/i.exec(line);
    if (amp) {
      if (seenPreamp) throw new Error("重复的前级增益");
      preamp = Number(amp[1]);
      seenPreamp = true;
      continue;
    }
    const filter =
      /^Filter\s+\d+:\s*(ON|OFF)\s+(PK|LSC|HSC|LS|HS)\s+Fc\s+([\d.]+)\s*Hz\s+Gain\s+([+-]?[\d.]+)\s*dB\s+Q\s+([\d.]+)$/i.exec(
        line,
      );
    if (!filter)
      throw new Error(`无法识别的 AutoEQ 参数：${line.slice(0, 70)}`);
    const type = filter[2]
      .toUpperCase()
      .replace(/^LS$/, "LSC")
      .replace(/^HS$/, "HSC") as PeqBand["type"];
    bands.push({
      enabled: filter[1].toUpperCase() === "ON",
      type,
      frequency: Number(filter[3]),
      gain: Number(filter[4]),
      q: Number(filter[5]),
    });
  }
  if (
    !bands.length ||
    bands.length > 10 ||
    !Number.isFinite(preamp) ||
    preamp < -24 ||
    preamp > 0 ||
    bands.some(
      (b) =>
        !Number.isFinite(b.frequency) ||
        b.frequency < 10 ||
        b.frequency > 24000 ||
        !Number.isFinite(b.gain) ||
        Math.abs(b.gain) > 24 ||
        !Number.isFinite(b.q) ||
        b.q < 0.1 ||
        b.q > 20,
    )
  )
    throw new Error(
      "支持 1–10 段；频率 10–24000 Hz，增益 ±24 dB，Q 0.1–20，前级 -24–0 dB",
    );
  return { enabled: true, preamp, headroom: true, bands };
}
