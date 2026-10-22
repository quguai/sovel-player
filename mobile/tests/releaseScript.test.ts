import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
test("release script produces matching version, APK name, checksum and manifest without modifying the checkout", () => {
  const temp = mkdtempSync(join(tmpdir(), "sovel-release-test-"));
  try {
    for (const d of [
      "scripts",
      "src/core",
      "android/app/build/outputs/apk/release",
    ])
      mkdirSync(join(temp, d), { recursive: true });
    cpSync(resolve("scripts/release.mjs"), join(temp, "scripts/release.mjs"));
    cpSync(
      resolve("scripts/release-packages.mjs"),
      join(temp, "scripts/release-packages.mjs"),
    );
    cpSync(
      resolve("src/core/appUpdates.ts"),
      join(temp, "src/core/appUpdates.ts"),
    );
    writeFileSync(
      join(temp, "app.json"),
      JSON.stringify({
        expo: {
          version: "0.0.0",
          android: { package: "cn.quguai.music.sovel" },
        },
      }),
    );
    const abis = ["arm64-v8a", "armeabi-v7a", "x86_64"];
    for (const abi of ["universal", ...abis]) {
      const source = join(temp, abi);
      for (const included of abi === "universal" ? abis : [abi]) {
        const folder = join(source, "lib", included);
        mkdirSync(folder, { recursive: true });
        writeFileSync(
          join(folder, "libfixture.so"),
          `test fixture ${included}`,
        );
      }
      execFileSync(
        "zip",
        [
          "-qr",
          join(
            temp,
            `android/app/build/outputs/apk/release/app-${abi}-release.apk`,
          ),
          "lib",
        ],
        { cwd: source },
      );
    }
    const apk = readFileSync(
      join(
        temp,
        "android/app/build/outputs/apk/release/app-universal-release.apk",
      ),
    );
    const env = {
      ...process.env,
      GITHUB_REF_NAME: "v0.2.0-rc.1",
      GITHUB_REPOSITORY: "quguai/sovel-player",
      GITHUB_OUTPUT: join(temp, "outputs"),
    };
    for (const action of ["prepare", "package"]) {
      const result = spawnSync(
        process.execPath,
        [join(temp, "scripts/release.mjs"), action],
        { env, encoding: "utf8" },
      );
      assert.equal(result.status, 0, result.stderr);
    }
    const manifest = JSON.parse(
      readFileSync(join(temp, "release/update.json"), "utf8"),
    );
    assert.equal(manifest.version, "0.2.0-rc.1");
    assert.equal(manifest.versionCode, 200101);
    assert.equal(manifest.packages.length, 4);
    assert.equal(
      manifest.sha256,
      createHash("sha256").update(apk).digest("hex"),
    );
    assert.equal(manifest.size, apk.length);
    assert.deepEqual(readFileSync(join(temp, "release", manifest.name)), apk);
    assert.equal(
      readFileSync(join(temp, "release/SHA256SUMS"), "utf8"),
      manifest.packages
        .map(
          (pkg: { sha256: string; name: string }) =>
            `${pkg.sha256}  ${pkg.name}\n`,
        )
        .join(""),
    );
    assert.match(readFileSync(join(temp, "outputs"), "utf8"), /preview=true/);
    const invalid = spawnSync(
      process.execPath,
      [join(temp, "scripts/release.mjs"), "prepare"],
      { env: { ...env, GITHUB_REF_NAME: "vbad" }, encoding: "utf8" },
    );
    assert.notEqual(invalid.status, 0);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
