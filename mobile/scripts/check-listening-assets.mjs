import { readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

if (!process.argv[2])
  throw new Error("Provide an APK or exported Android assets directory");
const target = resolve(process.argv[2]);
const walk = (folder) =>
  readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(join(folder, entry.name))
      : [join(folder, entry.name)],
  );
const entries = statSync(target).isDirectory()
  ? walk(target)
  : execFileSync("unzip", ["-Z1", target], { encoding: "utf8" }).split("\n");
const audio = entries.filter((entry) => /\.(?:wav|flac|dsf)$/i.test(entry));
if (audio.length)
  throw new Error(
    `Test audio must not be packaged in the app:\n${audio.join("\n")}`,
  );
console.log("Verified: no WAV, FLAC or DSF test audio is packaged.");
