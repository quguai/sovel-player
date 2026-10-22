import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { packageRelease } from "./release-packages.mjs";
import {
  androidPackageAbis,
  releaseVersion,
  findUpdate,
  parseUpdatePackage,
} from "../src/core/appUpdates.ts";

const tag = "v0.2.0-beta.1";
const repo = "quguai/sovel-player";
const version = releaseVersion(tag);
const config = {
  expo: {
    version: version.version,
    android: { versionCode: version.code, package: "cn.quguai.music.sovel" },
  },
};
function fixture(
  t,
  wrongAbi = false,
  missingAbi = false,
  universalAbis = androidPackageAbis,
) {
  const root = mkdtempSync(resolve(tmpdir(), "sovel-release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const output = resolve(root, "android/app/build/outputs/apk/release");
  mkdirSync(output, { recursive: true });
  for (const abi of ["universal", ...androidPackageAbis]) {
    if (missingAbi && abi === "x86_64") continue;
    const source = resolve(root, abi);
    for (const included of abi === "universal"
      ? universalAbis
      : [wrongAbi && abi === "arm64-v8a" ? "x86_64" : abi]) {
      const folder = resolve(source, "lib", included);
      mkdirSync(folder, { recursive: true });
      writeFileSync(
        resolve(folder, "libfixture.so"),
        `test fixture ${included}`,
      );
    }
    execFileSync(
      "zip",
      ["-qr", resolve(output, `app-${abi}-release.apk`), "lib"],
      { cwd: source },
    );
  }
  return root;
}
test("packages four ABI-verified APKs with matching checksums and backward-compatible update data", (t) => {
  const root = fixture(t);
  mkdirSync(resolve(root, "release"));
  writeFileSync(resolve(root, "release/stale.apk"), "stale");
  const packages = packageRelease(root, tag, repo, config);
  const manifest = JSON.parse(
    readFileSync(resolve(root, "release/update.json"), "utf8"),
  );
  assert.equal(readdirSync(resolve(root, "release")).length, 6);
  assert.equal(manifest.schema, 1);
  assert.equal(manifest.name, `sovel-${version.version}-universal.apk`);
  assert.equal(new Set(packages.map((p) => p.versionCode)).size, 1);
  const sums = readFileSync(resolve(root, "release/SHA256SUMS"), "utf8");
  for (const pkg of packages) {
    const data = readFileSync(resolve(root, "release", pkg.name));
    assert.equal(pkg.sha256, createHash("sha256").update(data).digest("hex"));
    assert.equal(pkg.size, data.length);
    assert.ok(sums.includes(`${pkg.sha256}  ${pkg.name}\n`));
  }
  const release = findUpdate(
    [
      {
        tag_name: tag,
        prerelease: true,
        assets: [
          {
            name: "update.json",
            browser_download_url: `https://github.com/${repo}/releases/download/${tag}/update.json`,
          },
        ],
      },
    ],
    "preview",
    1,
    repo,
  );
  assert.equal(
    parseUpdatePackage(manifest, release, repo, config.expo.android.package)
      .abi,
    "universal",
  );
  for (const abi of androidPackageAbis)
    assert.equal(
      parseUpdatePackage(manifest, release, repo, config.expo.android.package, [
        abi,
      ]).abi,
      abi,
    );
});
test("refuses mislabeled APKs rather than publishing an incompatible update", (t) => {
  const root = fixture(t, true);
  assert.throws(
    () => packageRelease(root, tag, repo, config),
    /Wrong native architectures/,
  );
  assert.equal(existsSync(resolve(root, "release")), false);
});
test("refuses an incomplete set of APKs", (t) => {
  const root = fixture(t, false, true);
  assert.throws(() => packageRelease(root, tag, repo, config));
  assert.equal(existsSync(resolve(root, "release")), false);
});
test("requires matching prepared version information", (t) => {
  const root = fixture(t);
  assert.throws(
    () =>
      packageRelease(root, tag, repo, {
        expo: { ...config.expo, version: "0.1.0" },
      }),
    /Run prepare/,
  );
});

test("rejects extra prebuilt x86 libraries in the universal APK", (t) => {
  const root = fixture(t, false, false, [...androidPackageAbis, "x86"]);
  assert.throws(
    () => packageRelease(root, tag, repo, config),
    /Wrong native architectures.*x86/,
  );
  assert.equal(existsSync(resolve(root, "release")), false);
});

test("packages staged APKs without reading the output overwritten by the next Gradle build", (t) => {
  const root = fixture(t);
  mkdirSync(resolve(root, "artifacts"));
  renameSync(
    resolve(root, "android/app/build/outputs/apk/release"),
    resolve(root, "artifacts/release-apks"),
  );
  const packages = packageRelease(
    root,
    tag,
    repo,
    config,
    "artifacts/release-apks",
  );
  assert.equal(packages.length, 4);
  for (const pkg of packages)
    assert.ok(existsSync(resolve(root, "release", pkg.name)));
});
