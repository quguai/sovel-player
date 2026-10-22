export const lyricIdleDelay = 8000;

export function lyricMetrics(width: number, fontScale: number, large: boolean) {
  // Size follows width; a short screen should show fewer lines, not crush the gaps.
  const scale = Math.max(0.75, Math.min(1, width / 440));
  const fontSize = Math.round((large ? 32 : 28) * scale);
  const lineHeight = Math.ceil(fontSize * 1.3);
  const minRowHeight = Math.ceil(lineHeight * fontScale + 30);
  return { fontSize, lineHeight, minRowHeight };
}

export function lyricFocus(
  distance: number,
  timed: boolean,
  browsing = false,
  screenReader = false,
) {
  if (!timed) return { opacity: 0.72, blur: 0 };
  if (distance === 0) return { opacity: 1, blur: 0 };
  // Browsing removes blur for readability, never promotes other lines to current.
  if (browsing || screenReader) return { opacity: 0.56, blur: 0 };
  if (distance === 1) return { opacity: 0.56, blur: 1.2 };
  if (distance === 2) return { opacity: 0.4, blur: 1.8 };
  return { opacity: 0.26, blur: 2.4 };
}
