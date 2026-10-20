import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  appendFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  releaseVersion,
  releaseAssetUrl,
  repositoryName,
} from "../src/core/appUpdates.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.env.GITHUB_REF_NAME;
const version = tag?.startsWith("v") && releaseVersion(tag);
if (!version)
  throw new Error(
    "Tag must be vX.Y.Z, vX.Y.Z-beta.N or vX.Y.Z-rc.N (each number 0–99; preview N 1–99).",
  );
const repo = repositoryName(process.env.GITHUB_REPOSITORY);
const configPath = resolve(root, "app.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (process.argv[2] === "prepare") {
  config.expo.version = version.version;
  config.expo.android.versionCode = version.code;
  config.expo.extra = { ...config.expo.extra, githubRepository: repo };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${version.version}\ncode=${version.code}\npreview=${version.preview}\n`,
    );
  console.log(`Preparing ${tag} (${version.code}) for ${repo}`);
} else if (process.argv[2] === "package") {
  if (
    config.expo.version !== version.version ||
    config.expo.android.versionCode !== version.code
  )
    throw new Error("Run prepare before packaging.");
  const apk = readFileSync(
    resolve(root, "android/app/build/outputs/apk/release/app-release.apk"),
  );
  const name = `sovel-${version.version}-universal.apk`;
  const sha256 = createHash("sha256").update(apk).digest("hex");
  const output = resolve(root, "release");
  mkdirSync(output, { recursive: true });
  copyFileSync(
    resolve(root, "android/app/build/outputs/apk/release/app-release.apk"),
    resolve(output, name),
  );
  writeFileSync(
    resolve(output, "update.json"),
    JSON.stringify(
      {
        schema: 1,
        version: version.version,
        versionCode: version.code,
        packageId: config.expo.android.package,
        name,
        size: apk.length,
        sha256,
        url: releaseAssetUrl(repo, tag, name),
      },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(resolve(output, "SHA256SUMS"), `${sha256}  ${name}\n`);
} else throw new Error("Usage: node scripts/release.mjs prepare|package");
