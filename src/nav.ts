export type Wall = { minX: number; maxX: number; minZ: number; maxZ: number };
const walls: Wall[] = [];
export const waypoints = [[0, 40], [0, -24], [0, 16], [0, 60], [-36, 40], [36, 40], [0, -4]];
let dist: number[][] = [], next: number[][] = [];

export function addWall(minX: number, minZ: number, maxX: number, maxZ: number) {
  walls.push({ minX, minZ, maxX, maxZ });
  dist = [];
}

export function clearLine(ax: number, az: number, bx: number, bz: number) {
  for (const w of walls) {
    let lo = 0, hi = 1;
    for (const [a, d, min, max] of [[ax, bx - ax, w.minX - 0.3, w.maxX + 0.3], [az, bz - az, w.minZ - 0.3, w.maxZ + 0.3]]) {
      if (Math.abs(d) < 1e-9) { if (a <= min || a >= max) { hi = -1; break; } }
      else {
        const t0 = (min - a) / d, t1 = (max - a) / d;
        lo = Math.max(lo, Math.min(t0, t1));
        hi = Math.min(hi, Math.max(t0, t1));
      }
    }
    if (lo < hi) return false;
  }
  return true;
}

// Hand-placed waypoints suit a few straight streets; use a grid or navmesh for a more complex map.
export function navTarget(ax: number, az: number, bx: number, bz: number) {
  if (clearLine(ax, az, bx, bz)) return [bx, bz];
  const n = waypoints.length;
  if (!dist.length) {
    dist = waypoints.map(([x, z], i) => waypoints.map(([xx, zz], j) => i === j ? 0 : clearLine(x, z, xx, zz) ? Math.hypot(xx - x, zz - z) : Infinity));
    next = dist.map(row => row.map((d, j) => d < Infinity ? j : -1));
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (dist[i][k] + dist[k][j] < dist[i][j]) {
        dist[i][j] = dist[i][k] + dist[k][j];
        next[i][j] = next[i][k];
      }
    }
  }
  let best = Infinity, target = [bx, bz];
  for (let i = 0; i < n; i++) {
    const [x, z] = waypoints[i];
    if (!clearLine(ax, az, x, z)) continue;
    for (let j = 0; j < n; j++) {
      const [xx, zz] = waypoints[j];
      if (!clearLine(xx, zz, bx, bz)) continue;
      const d = Math.hypot(x - ax, z - az) + dist[i][j] + Math.hypot(bx - xx, bz - zz);
      if (d < best) {
        best = d;
        target = Math.hypot(x - ax, z - az) < 0.1 && next[i][j] >= 0 ? waypoints[next[i][j]] : waypoints[i];
      }
    }
  }
  return target;
}
