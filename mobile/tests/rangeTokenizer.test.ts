import { test } from "node:test";
import assert from "node:assert/strict";
import { EndOfStreamError } from "strtok3/core";
import { RangeTokenizer } from "../src/core/RangeTokenizer";

test("tiny tag reads share bounded cache and random seeks skip the audio payload", async () => {
  const size = 3 * 1024 ** 3;
  const reads: { position: number; length: number }[] = [];
  let closed = false;
  const tokenizer = new RangeTokenizer(
    {
      size,
      read: async (position, length) => {
        reads.push({ position, length });
        return Uint8Array.from({ length }, (_, i) => (position + i) % 251);
      },
      close: () => {
        closed = true;
      },
    },
    "large.dsf",
  );
  for (let i = 0; i < 100; i++) {
    const buffer = new Uint8Array(4);
    await tokenizer.readBuffer(buffer);
    assert.deepEqual(
      [...buffer],
      Array.from({ length: 4 }, (_, j) => (i * 4 + j) % 251),
    );
  }
  assert.deepEqual(reads, [{ position: 0, length: 16384 }]);
  tokenizer.setPosition(size - 16);
  const tail = new Uint8Array(16);
  await tokenizer.readBuffer(tail);
  assert.deepEqual(reads[1], { position: size - 16, length: 16 });
  assert.deepEqual(
    [...tail],
    Array.from({ length: 16 }, (_, i) => (size - 16 + i) % 251),
  );
  assert.equal(
    await tokenizer.peekBuffer(new Uint8Array(4), { mayBeLess: true }),
    0,
  );
  await assert.rejects(
    tokenizer.readBuffer(new Uint8Array(1)),
    EndOfStreamError,
  );
  await tokenizer.close();
  assert.equal(closed, true);
});

test("cache boundaries and large cover reads return exact bytes without retaining the cover", async () => {
  const bytes = Uint8Array.from({ length: 200000 }, (_, i) => i % 251);
  const reads: number[] = [];
  const tokenizer = new RangeTokenizer(
    {
      size: bytes.length,
      read: async (position, length) => {
        reads.push(length);
        return bytes.subarray(position, position + length);
      },
      close: () => {},
    },
    "cover.flac",
  );
  for (const [position, length] of [
    [0, 4],
    [16378, 16],
    [16394, 100000],
    [116394, 8],
  ]) {
    const target = new Uint8Array(length);
    await tokenizer.readBuffer(target, { position });
    assert.deepEqual(target, bytes.subarray(position, position + length));
  }
  assert.deepEqual(reads, [16384, 16384, 100000, 16384]);
  await tokenizer.close();
});

test("short native reads still report EOF instead of returning stale cached bytes", async () => {
  const tokenizer = new RangeTokenizer(
    {
      size: 100,
      read: async () => new Uint8Array([1, 2]),
      close: () => {},
    },
    "truncated.wav",
  );
  await assert.rejects(
    tokenizer.readBuffer(new Uint8Array(4)),
    EndOfStreamError,
  );
  const target = new Uint8Array(4);
  assert.equal(await tokenizer.readBuffer(target, { mayBeLess: true }), 2);
  assert.deepEqual([...target], [1, 2, 0, 0]);
  await tokenizer.close();
});
