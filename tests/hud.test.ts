import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, sprinting, reloadState, dry, lowAmmo } from '../src/hud.ts';

test('stick deflection scales inside the radius and clamps outside it', () => {
  assert.deepEqual(stickVector(25, 0, 50), { side: 0.5, forward: -0 });
  assert.deepEqual(stickVector(0, -50, 50), { side: 0, forward: 1 });
  const far = stickVector(300, -400, 50);
  assert.ok(Math.abs(Math.hypot(far.side, far.forward) - 1) < 1e-9);
  assert.deepEqual(stickVector(0, 0, 50), { side: 0, forward: -0 });
});

test('only a near-full forward push sprints', () => {
  assert.equal(sprinting(stickVector(0, -50, 50).forward), true);
  assert.equal(sprinting(stickVector(30, -40, 50).forward), false);
  assert.equal(sprinting(stickVector(0, 50, 50).forward), false);
});

test('reload button state follows the magazine and reserve', () => {
  assert.equal(reloadState({ mag: 3, size: 12, reserve: 20 }, 0.5), 'busy');
  assert.equal(reloadState({ mag: 12, size: 12, reserve: 20 }, 0), 'off');
  assert.equal(reloadState({ mag: 3, size: 12, reserve: 0 }, 0), 'off');
  assert.equal(reloadState({ mag: 0, size: 12, reserve: Infinity }, 0), 'need');
  assert.equal(reloadState({ mag: 5, size: 12, reserve: 20 }, 0), '');
});

test('dry and low-ammo flags', () => {
  assert.equal(dry({ mag: 0, size: 1, reserve: 0 }), true);
  assert.equal(dry({ mag: 0, size: 1, reserve: 2 }), false);
  assert.equal(lowAmmo({ mag: 3, size: 12, reserve: 0 }), true);
  assert.equal(lowAmmo({ mag: 4, size: 12, reserve: 0 }), false);
  assert.equal(lowAmmo({ mag: 0, size: 1, reserve: 3 }), true);
});
