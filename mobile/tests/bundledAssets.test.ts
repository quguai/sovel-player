import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("packaging guard rejects the actual WAV/FLAC fixtures but accepts artwork-only output", () => {
  const dir = mkdtempSync(join(tmpdir(), "sovel-assets-"));
  const verify = () =>
    spawnSync(
      process.execPath,
      [resolve("scripts/check-listening-assets.mjs"), dir],
      { encoding: "utf8" },
    );
  try {
    mkdirSync(join(dir, "drawable-mdpi"));
    writeFileSync(join(dir, "drawable-mdpi/cover.png"), "image fixture");
    assert.equal(verify().status, 0);
    mkdirSync(join(dir, "raw"));
    cpSync("tests/fixtures/sample.wav", join(dir, "raw/assets_sample.wav"));
    cpSync("tests/fixtures/sample.flac", join(dir, "raw/assets_sample.flac"));
    const result = verify();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Test audio must not be packaged/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
