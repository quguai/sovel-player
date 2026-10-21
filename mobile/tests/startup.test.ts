import { test } from "node:test";
import assert from "node:assert/strict";
import { StartupAttempt } from "../src/core/startup";

test("startup timeout is recoverable and a late result cannot publish", async () => {
  const attempt = new StartupAttempt();
  let finish!: (value: string) => void;
  let published = false;
  const pending = attempt
    .step(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
      10,
    )
    .then(() => {
      published = true;
    });
  await assert.rejects(pending, /耗时过长/);
  attempt.cancel();
  const retry = new StartupAttempt();
  assert.equal(await retry.step(async () => "ready"), "ready");
  finish("late");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(published, false);
});

test("unmount cancels waiting startup; task errors remain actionable", async () => {
  const attempt = new StartupAttempt();
  const pending = attempt.step(() => new Promise(() => {}));
  attempt.cancel();
  await assert.rejects(pending, /取消/);
  await assert.rejects(
    attempt.step(async () => "late"),
    /取消/,
  );
  await assert.rejects(
    new StartupAttempt().step(async () => {
      throw new Error("database unavailable");
    }),
    /database unavailable/,
  );
});
