import { test } from "node:test";
import assert from "node:assert/strict";
import { open, readFile } from "node:fs/promises";
import { readMetadata } from "../src/core/metadata";
import { parseLyrics, currentLyric, singleLineLyric } from "../src/core/lyrics";
for (const path of [
  "tests/fixtures/sample.wav",
  "tests/fixtures/sample.flac",
  "tests/tagged.dsf",
])
  test(`reads tags, cover and lyrics from ${path} using ranged I/O`, async () => {
    const file = await open(path, "r");
    const { size } = await file.stat();
    let bytes = 0,
      closed = false;
    const result = await readMetadata(
      {
        size,
        read: async (position, length) => {
          const b = new Uint8Array(length);
          const result = await file.read(b, 0, length, position);
          bytes += result.bytesRead;
          return b.subarray(0, result.bytesRead);
        },
        close: () => {
          closed = true;
          void file.close();
        },
      },
      path,
    );
    assert.equal(result.metadata.artist, "Sovel");
    assert.equal(result.metadata.album, "声音手记");
    assert.ok(result.picture?.data.length);
    assert.equal(result.artistPicture, undefined);
    assert.equal(result.metadata.lyrics.length, 6);
    assert.equal(result.metadata.lyrics[1].time, 4);
    assert.ok(result.metadata.sampleRate);
    assert.equal(closed, true);
    if (path.endsWith(".wav")) {
      assert.ok(bytes < size / 2, `read ${bytes} of ${size}`);
      assert.equal(result.metadata.duration, 24);
      assert.equal(result.metadata.bits, 16);
    }
    if (path.endsWith(".dsf"))
      assert.equal(result.metadata.sampleRate, 2822400);
  });
async function readPictureTags(types: number[]) {
  const dsf = await readFile("tests/tagged.dsf");
  const image = await readFile("assets/artwork/ocean.jpg");
  const cover = await readFile("assets/artwork/mountain.jpg");
  const syncSafe = (n: number) =>
    Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
  const body = Buffer.concat([
    ...types.map((type) => {
      const data = Buffer.concat([
        Buffer.from([3]),
        Buffer.from("image/jpeg\0"),
        Buffer.from([type, 0]),
        type === 3 ? cover : image,
      ]);
      return Buffer.concat([
        Buffer.from("APIC"),
        syncSafe(data.length),
        Buffer.alloc(2),
        data,
      ]);
    }),
    Buffer.concat([
      Buffer.from("TCON"),
      syncSafe(13),
      Buffer.alloc(2),
      Buffer.from("\x03Ambient\0Jazz"),
    ]),
  ]);
  const bytes = Buffer.concat([
    dsf.subarray(0, Number(dsf.readBigUInt64LE(20))),
    Buffer.from([73, 68, 51, 4, 0, 0]),
    syncSafe(body.length),
    body,
  ]);
  bytes.writeBigUInt64LE(BigInt(bytes.length), 12);
  return readMetadata(
    {
      size: bytes.length,
      read: async (position, length) =>
        bytes.subarray(position, position + length),
      close: () => {},
    },
    "portraits.dsf",
  );
}
test("embedded artist images are read separately from front cover artwork", async () => {
  const portrait = await readFile("assets/artwork/ocean.jpg");
  const cover = await readFile("assets/artwork/mountain.jpg");
  for (const type of [7, 8, 10, 19]) {
    const result = await readPictureTags([type, 3]);
    assert.ok(result.artistPicture?.data.length, `artist picture type ${type}`);
    assert.deepEqual(result.metadata.genres, ["Ambient", "Jazz"]);
    assert.ok(result.picture?.data.length, "album cover is retained");
    assert.deepEqual(Buffer.from(result.artistPicture!.data), portrait);
    assert.deepEqual(Buffer.from(result.picture!.data), cover);
  }
});
test("a portrait-only tag must not become an album cover", async () => {
  const result = await readPictureTags([8]);
  assert.ok(result.artistPicture?.data.length);
  assert.equal(result.picture, undefined);
});
test("LRC supports repeated timestamps, offsets and plain lyrics", () => {
  const lines = parseLyrics(
    "[offset:500]\n[00:01.25][00:04.5]一句歌词\n[00:03.000]另一句",
  );
  assert.deepEqual(
    lines.map((l) => l.time),
    [1.75, 3.5, 5],
  );
  assert.equal(currentLyric(lines, 0), -1);
  assert.equal(currentLyric(lines, 3.7), 1);
  assert.deepEqual(parseLyrics("第一句\n第二句"), [
    { time: null, text: "第一句" },
    { time: null, text: "第二句" },
  ]);
});

test("single-line lyric display keeps all words and removes embedded Unicode line separators", () => {
  assert.equal(singleLineLyric("第一句\r\n第二句\u2028第三句\u2029第四句\u0085last line"), "第一句 第二句 第三句 第四句 last line");
  const long = "a long lyric without truncation ".repeat(100);
  assert.equal(singleLineLyric(long), long);
});
