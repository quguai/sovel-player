import { test } from "node:test";
import assert from "node:assert/strict";
import {
  excludesEntry,
  excludesPath,
  normalizeScanRules,
} from "../src/core/scanRules";
import { defaultScanRules } from "../src/core/types";
test("relative scan paths, hidden ancestors, subfolders, and the exact KB boundary", () => {
  const rules = { ...defaultScanRules, filterSmall: true, minSizeKB: 100 };
  assert.equal(excludesEntry({ path: "a.flac", size: 102400 }, rules), false);
  assert.equal(excludesEntry({ path: "a.flac", size: 102399 }, rules), true);
  assert.equal(excludesPath("album/.cache/a.flac", rules), true);
  assert.equal(excludesPath("album.live/a.flac", rules), false);
  assert.equal(
    excludesPath("album/a.flac", { ...rules, includeSubfolders: false }),
    true,
  );
  assert.equal(
    excludesPath(".a.flac", { ...rules, ignoreHidden: false }),
    false,
  );
  assert.deepEqual(normalizeScanRules(), defaultScanRules);
  assert.equal(normalizeScanRules({ minSizeKB: -5 }).minSizeKB, 1);
  assert.equal(normalizeScanRules({ minSizeKB: Infinity }).minSizeKB, 100);
});
