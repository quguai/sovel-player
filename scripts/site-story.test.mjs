import test from 'node:test';
import assert from 'node:assert/strict';
import { storyPosition } from '../site/story.js';

test('scroll presentation holds both ends and gives every screen an equal segment', () => {
  assert.deepEqual(storyPosition(-500, 4900, 7), { progress: 0, index: 0 });
  for (let index = 0; index < 7; index++) {
    assert.equal(storyPosition(index * 700 + 350, 4900, 7).index, index);
  }
  assert.deepEqual(storyPosition(9000, 4900, 7), { progress: 1, index: 6 });
  assert.deepEqual(storyPosition(100, 0, 7), { progress: 0, index: 0 });
});
test('scroll position is reversible and independent of past frames or jump distance', () => {
  for (const index of [6, 2, 5, 1, 0, 4, 3]) {
    assert.equal(storyPosition(index * 700 + 200, 4900, 7).index, index);
    assert.equal(storyPosition((index * 700 + 200) / 2, 2450, 7).index, index);
  }
});
