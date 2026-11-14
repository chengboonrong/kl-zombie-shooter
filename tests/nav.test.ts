import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addWall, clearLine, navTarget } from '../src/nav.ts';

for (const [x0, z0, x1, z1] of [[-48, -31, -6, 34], [6, -31, 48, -10], [6, 2, 48, 34], [17, -10, 18, 2], [-48, 46, -6, 67], [6, 46, 48, 67], [-6, -31, 6, -30], [-6, 66, 6, 67], [-43, 34, -42, 46], [42, 34, 43, 46]]) addWall(x0, z0, x1, z1);

test('clear line targets the destination', () => {
  assert.deepEqual(navTarget(0, -20, 0, 20), [0, 20]);
});
test('west to south goes through the crossroads', () => {
  assert.deepEqual(navTarget(-36, 40, 0, -24), [0, 40]);
});
test('following targets reaches another arm without crossing walls', () => {
  let x = -36, z = 40;
  for (let i = 0; i < 1000 && Math.hypot(x, z + 24) > 0.01; i++) {
    const [tx, tz] = navTarget(x, z, 0, -24);
    const d = Math.hypot(tx - x, tz - z);
    assert.ok(d > 0);
    const step = Math.min(0.5, d), nx = x + (tx - x) / d * step, nz = z + (tz - z) / d * step;
    assert.ok(clearLine(x, z, nx, nz));
    x = nx; z = nz;
  }
  assert.ok(Math.hypot(x, z + 24) < 0.01);
});

test('a start or destination just inside body clearance still moves', () => {
  assert.notDeepEqual(navTarget(0, 20, -5.6000001, 0), [0, 20]);
  assert.notDeepEqual(navTarget(5.6000001, 20, 0, 0), [5.6000001, 20]);
  assert.ok(clearLine(0, 20, -5.6000001, 0));
  assert.ok(clearLine(5.6000001, 20, 0, 0));
});
test('an unreachable route falls back to the destination', () => {
  assert.deepEqual(navTarget(0, 20, -8, 0), [-8, 0]);
});
test('both lane arms can route into the mamak pocket', () => {
  for (const start of [[0, -20], [0, 55]]) {
    let [x, z] = start;
    for (let i = 0; i < 1000 && Math.hypot(x - 16, z + 9) > 0.01; i++) {
      const [tx, tz] = navTarget(x, z, 16, -9), d = Math.hypot(tx - x, tz - z);
      assert.ok(d > 0);
      const step = Math.min(0.5, d), nx = x + (tx - x) / d * step, nz = z + (tz - z) / d * step;
      assert.ok(clearLine(x, z, nx, nz));
      x = nx; z = nz;
    }
    assert.ok(Math.hypot(x - 16, z + 9) < 0.01);
  }
});
