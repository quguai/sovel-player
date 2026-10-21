import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldDismissPlayer } from "../src/core/playerDismiss";

test("dismissal requires actual downward distance, not a short flick or proximity to the bottom", () => {
  assert.equal(shouldDismissPlayer(0, 40, 667), false);
  assert.equal(shouldDismissPlayer(0, 222, 667), false);
  assert.equal(shouldDismissPlayer(0, 223, 667), true);
  assert.equal(shouldDismissPlayer(0, -200, 667), false);
  assert.equal(shouldDismissPlayer(200, 180, 667), false);
});

test("dismissal requires one third of the screen at every screen height", () => {
  assert.equal(shouldDismissPlayer(0, 124, 375), false);
  assert.equal(shouldDismissPlayer(0, 125, 375), true);
  assert.equal(shouldDismissPlayer(0, 399, 1200), false);
  assert.equal(shouldDismissPlayer(0, 400, 1200), true);
});
