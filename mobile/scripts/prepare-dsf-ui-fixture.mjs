// Simulator-only, generated silence. This file is never bundled with the app.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const container = execFileSync(
  "xcrun",
  [
    "simctl",
    "get_app_container",
    process.argv[2] || "booted",
    "cn.quguai.music.sovel",
    "data",
  ],
  { encoding: "utf8" },
).trim();
const safe = (n) =>
  Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
const frame = (key, value) => {
  const b = Buffer.concat([Buffer.from([3]), Buffer.from(value)]);
  return Buffer.concat([Buffer.from(key), safe(b.length), Buffer.alloc(2), b]);
};
const body = Buffer.concat([
  frame("TIT2", "DSF PCM Test"),
  frame("TPE1", "Sovel"),
  frame("TALB", "DSD Fixture"),
  frame("TXXX", "REPLAYGAIN_TRACK_GAIN\0-6.0 dB"),
  frame("TXXX", "REPLAYGAIN_TRACK_PEAK\0" + "0.8"),
  frame("TXXX", "REPLAYGAIN_ALBUM_GAIN\0-4.0 dB"),
  frame("TXXX", "REPLAYGAIN_ALBUM_PEAK\0" + "0.9"),
]);
const tags = Buffer.concat([
  Buffer.from([73, 68, 51, 4, 0, 0]),
  safe(body.length),
  body,
]);
const rate = 2822400,
  samples = rate * 24,
  blocks = Math.ceil(samples / 32768),
  bytes = 92 + blocks * 8192;
const file = Buffer.alloc(bytes + tags.length, 0x69);
file.fill(0, 0, 92);
file.write("DSD ");
file.writeBigUInt64LE(28n, 4);
file.writeBigUInt64LE(BigInt(file.length), 12);
file.writeBigUInt64LE(BigInt(bytes), 20);
file.write("fmt ", 28);
file.writeBigUInt64LE(52n, 32);
file.writeUInt32LE(1, 40);
file.writeUInt32LE(2, 48);
file.writeUInt32LE(2, 52);
file.writeUInt32LE(rate, 56);
file.writeUInt32LE(1, 60);
file.writeBigUInt64LE(BigInt(samples), 64);
file.writeUInt32LE(4096, 72);
file.write("data", 80);
file.writeBigUInt64LE(BigInt(bytes - 80), 84);
tags.copy(file, bytes);
const folder = join(container, "Documents/Music");
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, "sovel-dsf-ui-test.dsf"), file);
process.stdout.write("Created simulator DSF fixture; run incremental scan.\n");
