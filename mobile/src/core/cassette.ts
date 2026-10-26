import type { CassetteStyle } from "./types";

export const cassetteStyles: { id: CassetteStyle; name: string }[] = [
  { id: "noir", name: "烟透银灰" },
  { id: "classic", name: "经典纸标" },
  { id: "studio", name: "金属机能" },
  { id: "pop", name: "随身 PLAY" },
];

/** Tape length is proportional to the wound area, rather than its radius. */
export function tapeRadius(fraction: number, inner: number, outer: number) {
  const amount = Number.isFinite(fraction)
    ? Math.max(0, Math.min(1, fraction))
    : 0;
  return Math.sqrt(inner * inner + amount * (outer * outer - inner * inner));
}
