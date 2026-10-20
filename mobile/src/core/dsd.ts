export const pcmRates = [44100, 88200, 176400, 352800] as const;
export type PcmRate = (typeof pcmRates)[number];
// DoP/Native are displayed as unavailable until a real output adapter exists.
export type DsdSettings = { mode: "pcm"; pcmRate: PcmRate };
export const defaultDsd: DsdSettings = { mode: "pcm", pcmRate: 176400 };
export function normalizeDsd(value: unknown): DsdSettings {
  const input =
    value && typeof value === "object" ? (value as Partial<DsdSettings>) : {};
  return {
    mode: "pcm",
    pcmRate: pcmRates.includes(input.pcmRate as PcmRate)
      ? input.pcmRate!
      : defaultDsd.pcmRate,
  };
}
