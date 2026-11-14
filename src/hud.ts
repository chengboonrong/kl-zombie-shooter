// Pure HUD logic, no DOM: unit-tested in tests/hud.test.ts.

// Floating stick: full deflection at `radius` px, clamped to the unit circle.
export function stickVector(dx: number, dy: number, radius: number) {
  const len = Math.max(radius, Math.hypot(dx, dy));
  return { side: dx / len, forward: -dy / len };
}

// Matches the forward-only sprint rule in player.ts.
export const sprinting = (forward: number) => forward > 0.9;

type Gun = { mag: number; size: number; reserve: number };

// Reload button state: busy (reloading), need (empty, can reload), off (nothing to do), or ''.
export function reloadState(w: Gun, reloadT: number) {
  if (reloadT > 0) return 'busy';
  if (w.mag === w.size || w.reserve === 0) return 'off';
  return w.mag === 0 ? 'need' : '';
}

export const dry = (w: Gun) => w.mag === 0 && w.reserve === 0;
export const lowAmmo = (w: Gun) => w.mag <= Math.floor(w.size / 4);
