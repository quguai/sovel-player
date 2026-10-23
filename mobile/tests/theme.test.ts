import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validTheme,
  normalizeTheme,
  defaultTheme,
  palette,
  applyTheme,
  themePresets,
} from "../src/core/theme";
import {
  createSettingsBackup,
  parseSettingsBackup,
} from "../src/core/settingsBackup";
import { defaults } from "../src/core/types";
test("themes preserve readable dark backgrounds, reject invalid colors and migrate old backups", () => {
  for (const t of themePresets) assert.ok(validTheme(t));
  for (const t of [
    null,
    { name: "x", background: "#ffffff", accent: "#d5b782" },
    { name: "x", background: "#17191c", accent: "#121212" },
    { name: "x", background: "rgba(0,0,0,1)", accent: "red" },
  ])
    assert.equal(validTheme(t), false);
  const theme = { name: "自定义", background: "#101826", accent: "#b1d3ee" };
  assert.deepEqual(normalizeTheme(theme), theme);
  applyTheme(theme);
  assert.equal(palette.gold, theme.accent);
  assert.equal(palette.bg, theme.background);
  applyTheme(defaultTheme);
  const backup = createSettingsBackup({ ...defaults, theme });
  assert.deepEqual(
    parseSettingsBackup(JSON.stringify(backup)).settings.theme,
    theme,
  );
  const older: any = backup;
  delete older.settings.theme;
  assert.deepEqual(
    parseSettingsBackup(JSON.stringify(older)).settings.theme,
    defaultTheme,
  );
});
