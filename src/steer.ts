export function steer(stuckT: number, sideT: number, moved: number, step: number, distance: number, dt: number) {
  if (distance < 1.3) return [0, 0];
  if (sideT > 0) return [0, Math.max(0, sideT - dt)];
  stuckT = step > 0 && moved < step * 0.3 ? stuckT + dt : 0;
  return stuckT >= 0.3 ? [0, 0.6] : [stuckT, 0];
}
