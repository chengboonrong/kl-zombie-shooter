import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steer } from '../src/steer.ts';

test('blocked movement starts a short sidestep, then returns to normal', () => {
  let stuck = 0, side = 0;
  for (let i = 0; i < 3; i++) [stuck, side] = steer(stuck, side, 0.01, 0.1, 10, 0.1);
  assert.deepEqual([stuck, side], [0, 0.6]);
  [stuck, side] = steer(stuck, side, 0.1, 0.1, 10, 0.3);
  assert.deepEqual([stuck, side], [0, 0.3]);
  assert.deepEqual(steer(stuck, side, 0.1, 0.1, 10, 0.3), [0, 0]);
});
test('progress, no intended step, or attack range clears stuck time', () => {
  assert.deepEqual(steer(0.2, 0, 0.03, 0.1, 10, 0.1), [0, 0]);
  assert.deepEqual(steer(0.2, 0, 0, 0, 10, 0.1), [0, 0]);
  assert.deepEqual(steer(0.2, 0.4, 0, 0.1, 1, 0.1), [0, 0]);
});
