import { test } from "node:test";
import assert from "node:assert/strict";
import { lyricMetrics, lyricFocus } from "../src/core/lyricPresentation";

test("compact lyrics keep 30pt breathing room and respect accessibility font size", () => {
  for (const width of [320, 375, 390, 768]) {
    for (const large of [false, true]) {
      for (const scale of [1, 1.5, 2]) {
        const metrics = lyricMetrics(width, scale, large);
        assert.ok(metrics.minRowHeight >= metrics.lineHeight * scale + 30);
        assert.ok(metrics.fontSize >= 25);
      }
    }
  }
});

test("dragging clears blur without highlighting every lyric", () => {
  for (const browsing of [false, true]) {
    assert.deepEqual(lyricFocus(0, true, browsing), { opacity: 1, blur: 0 });
    for (const distance of [1, 2, 3, 100]) {
      const focus = lyricFocus(distance, true, browsing);
      assert.ok(focus.opacity < 1);
      if (browsing) assert.equal(focus.blur, 0);
    }
  }
  const near = lyricFocus(1, true),
    far = lyricFocus(3, true);
  assert.ok(near.opacity > far.opacity);
  assert.ok(near.blur < far.blur);
  assert.deepEqual(lyricFocus(0, false), { opacity: 0.72, blur: 0 });
  assert.equal(lyricFocus(2, true, false, true).opacity, 0.56);
});
