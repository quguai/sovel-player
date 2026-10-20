import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
fs.mkdirSync(path.join(root, "tests/fixtures"), { recursive: true });
const safe = (n) =>
  Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
const frame = (name, data) =>
  Buffer.concat([Buffer.from(name), safe(data.length), Buffer.alloc(2), data]);
const title = "初见";
const lyrics =
  "[00:00.00]听见，属于自己的声音\n[00:04.00]光落在安静的房间\n[00:08.00]让时间慢一点\n[00:12.00]在旋律里，回到自己\n[00:16.00]此刻，专注聆听\n[00:20.00]让余音慢慢散去";
const body = Buffer.concat([
  ...[
    ["TIT2", title],
    ["TPE1", "Sovel"],
    ["TALB", "声音手记"],
  ].map(([k, v]) =>
    frame(k, Buffer.concat([Buffer.from([3]), Buffer.from(v)])),
  ),
  frame(
    "USLT",
    Buffer.concat([
      Buffer.from([3]),
      Buffer.from("zho"),
      Buffer.from([0]),
      Buffer.from(lyrics),
    ]),
  ),
  frame(
    "APIC",
    Buffer.concat([
      Buffer.from([3]),
      Buffer.from("image/jpeg\0"),
      Buffer.from([3, 0]),
      fs.readFileSync(path.join(root, "assets/artwork/ocean.jpg")),
    ]),
  ),
]);
const id3 = Buffer.concat([
  Buffer.from([73, 68, 51, 4, 0, 0]),
  safe(body.length),
  body,
]);
const rate = 44100,
  seconds = 24,
  pcm = Buffer.alloc(rate * seconds * 4);
for (let i = 0; i < rate * seconds; i++) {
  const t = i / rate,
    phase = t % 4,
    fade = Math.min(t / 2, (seconds - t) / 3, 1),
    chord = [
      [261.63, 329.63, 392],
      [220, 261.63, 329.63],
      [174.61, 220, 261.63],
      [196, 246.94, 293.66],
      [261.63, 329.63, 392],
      [196, 261.63, 329.63],
    ][Math.floor(t / 4)];
  const y =
    chord.reduce(
      (v, f, j) =>
        v + Math.sin(t * 2 * Math.PI * f) * Math.exp(-phase * (0.7 + j * 0.1)),
      0,
    ) *
    0.065 *
    fade;
  const n = Math.max(-32768, Math.min(32767, Math.round(y * 32767)));
  pcm.writeInt16LE(n, i * 4);
  pcm.writeInt16LE(n, i * 4 + 2);
}
const chunk = (type, data) => {
  const size = Buffer.alloc(4);
  size.writeUInt32LE(data.length);
  return Buffer.concat([
    Buffer.from(type),
    size,
    data,
    ...(data.length % 2 ? [Buffer.alloc(1)] : []),
  ]);
};
const fmt = Buffer.alloc(16);
fmt.writeUInt16LE(1);
fmt.writeUInt16LE(2, 2);
fmt.writeUInt32LE(rate, 4);
fmt.writeUInt32LE(rate * 4, 8);
fmt.writeUInt16LE(4, 12);
fmt.writeUInt16LE(16, 14);
const wave = Buffer.concat([
  Buffer.from("WAVE"),
  chunk("fmt ", fmt),
  chunk("id3 ", id3),
  chunk("data", pcm),
]);
const size = Buffer.alloc(4);
size.writeUInt32LE(wave.length);
fs.writeFileSync(
  path.join(root, "tests/fixtures/sample.wav"),
  Buffer.concat([Buffer.from("RIFF"), size, wave]),
);
execFileSync("ffmpeg", [
  "-y",
  "-v",
  "error",
  "-i",
  path.join(root, "tests/fixtures/sample.wav"),
  "-i",
  path.join(root, "assets/artwork/mountain.jpg"),
  "-map",
  "0:a",
  "-map",
  "1:v",
  "-c:a",
  "flac",
  "-c:v",
  "copy",
  "-disposition:v",
  "attached_pic",
  "-metadata",
  "title=微光",
  "-metadata",
  "artist=Sovel",
  "-metadata",
  "album=声音手记",
  "-metadata",
  `lyrics=${lyrics}`,
  path.join(root, "tests/fixtures/sample.flac"),
]);
// Valid small DSF with ID3 at EOF, used only for metadata tests.
const dsd = Buffer.alloc(28);
dsd.write("DSD ");
dsd.writeBigUInt64LE(28n, 4);
const format = Buffer.alloc(52);
format.write("fmt ");
format.writeBigUInt64LE(52n, 4);
format.writeUInt32LE(1, 12);
format.writeUInt32LE(2, 20);
format.writeUInt32LE(2, 24);
format.writeUInt32LE(2822400, 28);
format.writeUInt32LE(1, 32);
format.writeBigUInt64LE(32768n, 36);
format.writeUInt32LE(4096, 44);
const data = Buffer.alloc(12 + 8192, 0x69);
data.write("data");
data.writeBigUInt64LE(BigInt(data.length), 4);
const offset = dsd.length + format.length + data.length;
dsd.writeBigUInt64LE(BigInt(offset + id3.length), 12);
dsd.writeBigUInt64LE(BigInt(offset), 20);
fs.writeFileSync(
  path.join(root, "tests/tagged.dsf"),
  Buffer.concat([dsd, format, data, id3]),
);
console.log(
  "Created original WAV/FLAC listening samples and DSF metadata fixture.",
);
