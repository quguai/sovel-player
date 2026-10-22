import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import {
  androidPackageAbis,
  releaseVersion,
  releaseAssetUrl,
} from "../src/core/appUpdates.ts";

export function packageRelease(
  root,
  tag,
  repo,
  config,
  apkDirectory = "android/app/build/outputs/apk/release",
) {
  const version = releaseVersion(tag);
  if (
    !version ||
    config.expo.version !== version.version ||
    config.expo.android.versionCode !== version.code
  )
    throw new Error("Run prepare before packaging.");
  const packages = ["universal", ...androidPackageAbis].map((abi) => {
    const path = resolve(root, apkDirectory, `app-${abi}-release.apk`);
    const apk = readFileSync(path);
    const entries = execFileSync("unzip", ["-Z1", path], {
      encoding: "utf8",
    }).split("\n");
    const actual = [
      ...new Set(
        entries.flatMap(
          (entry) => /^lib\/([^/]+)\/[^/]+\.so$/.exec(entry)?.[1] ?? [],
        ),
      ),
    ].sort();
    const expected = (
      abi === "universal" ? [...androidPackageAbis] : [abi]
    ).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(
        `Wrong native architectures in ${path}: ${actual.join(", ")}`,
      );
    const name = `sovel-${version.version}-${abi}.apk`;
    return {
      abi,
      version: version.version,
      versionCode: version.code,
      packageId: config.expo.android.package,
      name,
      size: apk.length,
      sha256: createHash("sha256").update(apk).digest("hex"),
      url: releaseAssetUrl(repo, tag, name),
    };
  });
  const output = resolve(root, "release");
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const pkg of packages) {
    copyFileSync(
      resolve(root, apkDirectory, `app-${pkg.abi}-release.apk`),
      resolve(output, pkg.name),
    );
    console.log(`${pkg.abi}: ${(pkg.size / 1024 / 1024).toFixed(1)} MB`);
  }
  // Old clients read the universal entry; new clients choose from packages.
  writeFileSync(
    resolve(output, "update.json"),
    JSON.stringify({ schema: 1, ...packages[0], packages }, null, 2) + "\n",
  );
  writeFileSync(
    resolve(output, "SHA256SUMS"),
    packages.map((pkg) => `${pkg.sha256}  ${pkg.name}\n`).join(""),
  );
  return packages;
}
