import * as THREE from 'three';
import { scene } from './level';
import { player } from './player';
import { toon, inked, canvasTex } from './toon';
import { pop } from './fx';
import { sfx } from './audio';
import { weapons } from './weapons';

type Kind = 'health' | 'ammo';

const label = (bg: string, draw: (c: CanvasRenderingContext2D) => void) =>
  toon(0xffffff, canvasTex(64, 64, c => { c.fillStyle = bg; c.fillRect(0, 0, 64, 64); draw(c); }));

const MATS = {
  health: label('#ffffff', c => { c.fillStyle = '#e63946'; c.fillRect(24, 8, 16, 48); c.fillRect(8, 24, 48, 16); }),
  ammo: label('#f77f00', c => {
    c.fillStyle = '#111';
    c.font = '900 30px Impact, sans-serif';
    c.textAlign = 'center';
    c.fillText('12G', 32, 43);
  }),
};

const SPOTS = [[0, -18], [-2, -6], [2, 3], [0, 20], [11, -4], [-2, 14], [0, 54], [0, 63], [-18, 40], [-36, 40], [18, 40], [36, 40]];
const pickups: { m: THREE.Mesh; kind: Kind }[] = [];

// With no position, picks a random fixed spot (health and ammo sit side by side).
export function spawnPickup(kind: Kind, at?: THREE.Vector3) {
  const s = SPOTS[Math.floor(Math.random() * SPOTS.length)];
  const m = inked(0.5, 0.5, 0.5, MATS[kind], 0, 0.04);
  if (at) m.position.set(at.x, 0.7, at.z);
  else m.position.set(s[0] + (kind === 'ammo' ? 0.7 : -0.7), 0.7, s[1]);
  scene.add(m);
  pickups.push({ m, kind });
}

export function clearPickups() {
  for (const p of pickups) scene.remove(p.m);
  pickups.length = 0;
}

export function updatePickups(dt: number) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.m.rotation.y += dt * 2;
    p.m.position.y = 0.7 + Math.sin(p.m.rotation.y * 1.5) * 0.1;
    if (Math.hypot(p.m.position.x - player.pos.x, p.m.position.z - player.pos.z) > 1) continue;
    if (p.kind === 'health') {
      if (player.hp >= 100) continue; // leave it for later
      player.hp = Math.min(100, player.hp + 35);
    } else {
      for (const w of weapons) w.reserve += w.topup;
    }
    pop(p.kind === 'health' ? '+HP!' : '+AMMO!', '#2a9d8f', p.m.position, 1.2);
    sfx.pickup();
    scene.remove(p.m);
    pickups.splice(i, 1);
  }
}
