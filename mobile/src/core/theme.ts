export type ThemeSettings = {
  name: string;
  background: string;
  accent: string;
};
export const themePresets: ThemeSettings[] = [
  { name: "黑金", background: "#17191c", accent: "#d5b782" },
  { name: "深海", background: "#141d27", accent: "#9bbfdf" },
  { name: "松影", background: "#16211e", accent: "#a7c9b4" },
  { name: "暮色", background: "#241b22", accent: "#d9aebf" },
];
export const defaultTheme = themePresets[0];
const hex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const luminance = (color: string) => {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(color.slice(i, i + 2), 16) / 255)
    .map((c) =>
      c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
export function validTheme(value: unknown): value is ThemeSettings {
  if (!value || typeof value !== "object") return false;
  const t = value as ThemeSettings;
  // Keep the cover-derived player and white typography readable. These are dark themes.
  return (
    typeof t.name === "string" &&
    !!t.name.trim() &&
    t.name.length <= 24 &&
    hex(t.background) &&
    hex(t.accent) &&
    luminance(t.background) <= 0.025 &&
    (luminance(t.accent) + 0.05) / (luminance(t.background) + 0.05) >= 4.5
  );
}
export function normalizeTheme(value: unknown): ThemeSettings {
  return validTheme(value)
    ? {
        name: value.name.trim(),
        background: value.background.toLowerCase(),
        accent: value.accent.toLowerCase(),
      }
    : { ...defaultTheme };
}
export const palette = {
  bg: defaultTheme.background,
  surface: "#24262b",
  gold: defaultTheme.accent,
  text: "#f2f0eb",
  muted: "#929398",
  line: "#ffffff12",
};
let active = "";
export const themeKey = () => active;
// The music context owns persistence and render notification; styles share its single app palette.
export function applyTheme(value: ThemeSettings) {
  const theme = normalizeTheme(value),
    key = theme.background + theme.accent;
  if (key === active) return;
  active = key;
  palette.bg = theme.background;
  palette.gold = theme.accent;
  palette.muted =
    theme.background === defaultTheme.background ? "#929398" : "#b2b4ba";
  palette.surface =
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.min(255, parseInt(theme.background.slice(i, i + 2), 16) + 13)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
}
