import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseVersion, repositoryName } from "../src/core/appUpdates.ts";
import { packageRelease } from "./release-packages.mjs";

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
  packageRelease(root, tag, repo, config, process.argv[3]);
} else
  throw new Error(
    "Usage: node scripts/release.mjs prepare|package [apk-directory]",
  );
