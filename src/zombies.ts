import * as THREE from 'three';
import { scene, collide } from './level';
import { player, hurt } from './player';
import { toon, inked, canvasTex } from './toon';
import { shake } from './fx';
import { sfx } from './audio';

export interface Zombie {
  g: THREE.Group;
  parts: THREE.Mesh[];                         // torso, head, leg L, leg R, arm L, arm R
  mats: (THREE.Material | THREE.Material[])[]; // their real materials, restored after a hit flash
  runner: boolean;
  base: number;   // resting x/z scale
  hp: number;
  speed: number;
  dmg: number;
  cd: number;     // attack cooldown
  t: number;      // walk-cycle phase
  flash: number;  // seconds of white left
  squash: number; // 1 = fully squashed, decays to 0
  kx: number;     // knockback velocity
  kz: number;
}

export const zombies: Zombie[] = [];
const dying: { z: Zombie; t: number }[] = [];
export const MAX_ZOMBIES = 30;

const WHITE = new THREE.MeshBasicMaterial({ color: 0xffffff });

const face = (skin: string) => toon(0xffffff, canvasTex(64, 64, c => {
  c.fillStyle = skin;
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#fff';
  c.lineWidth = 4;
  for (const x of [20, 44]) { c.beginPath(); c.arc(x, 24, 9, 0, 7); c.fill(); c.stroke(); }
  c.fillStyle = '#000';
  c.fillRect(18, 22, 5, 5);
  c.fillRect(44, 23, 5, 5);
  c.beginPath(); // jagged mouth
  c.moveTo(14, 46);
  for (let i = 1; i <= 6; i++) c.lineTo(14 + i * 6, i % 2 ? 54 : 46);
  c.stroke();
}));

const look = (skin: number, skinCss: string, shirt: number, pants: number) => {
  const s = toon(skin);
  return { skin: s, shirt: toon(shirt), pants: toon(pants), head: [s, s, s, s, face(skinCss), s] };
};
const LOOKS = [
  look(0x8bd450, '#8bd450', 0x3a6ea5, 0x4b3f72), // walker
  look(0xc9a0ff, '#c9a0ff', 0xe63946, 0x222233), // runner
];

export function spawnZombie(runner = false, speedMul = 1) {
  if (zombies.length >= MAX_ZOMBIES) return;
  const L = LOOKS[runner ? 1 : 0];
  const g = new THREE.Group();
  g.rotation.order = 'YXZ'; // so rotation.x tips it over relative to its facing
  const add = (m: THREE.Mesh, x: number, y: number) => {
    m.position.set(x, y, 0);
    g.add(m);
    return m;
  };
  const parts = [
    add(inked(0.6, 0.7, 0.35, L.shirt), 0, 1.15),
    add(inked(0.42, 0.42, 0.42, L.head), 0, 1.72),
    add(inked(0.24, 0.8, 0.26, L.pants, -0.4), -0.16, 0.8),
    add(inked(0.24, 0.8, 0.26, L.pants, -0.4), 0.16, 0.8),
    add(inked(0.18, 0.7, 0.18, L.skin, -0.35), -0.4, 1.45),
    add(inked(0.18, 0.7, 0.18, L.skin, -0.35), 0.4, 1.45),
  ];
  const base = runner ? 0.85 : 1;
  g.scale.set(base, 1, base);

  // spawn at a lane end, the far one if the player is close
  let z = Math.random() < 0.5 ? -28 : 28;
  if (Math.abs(z - player.pos.z) < 12) z = -z;
  g.position.set((Math.random() - 0.5) * 8, 0, z);

  scene.add(g);
  zombies.push({
    g, parts, mats: parts.map(m => m.material), runner, base,
    hp: runner ? 60 : 100,
    speed: (runner ? 4 : 1.6) * speedMul,
    dmg: runner ? 8 : 10,
    cd: 0, t: Math.random() * 6,
    flash: 0, squash: 0, kx: 0, kz: 0,
  });
}

export function clearZombies() {
  for (const z of zombies) scene.remove(z.g);
  for (const d of dying) scene.remove(d.z.g);
  zombies.length = 0;
  dying.length = 0;
}

// Apply a hit: damage, white flash, squash, knockback along (dx, dz). Returns true if it died.
export function hitZombie(z: Zombie, dmg: number, dx: number, dz: number, force: number): boolean {
  z.hp -= dmg;
  z.flash = 0.05;
  z.squash = 1;
  for (const m of z.parts) m.material = WHITE;
  z.kx += dx * force;
  z.kz += dz * force;
  if (z.hp > 0) return false;
  z.kx += dx * 4; // the killing blow throws the body
  z.kz += dz * 4;
  zombies.splice(zombies.indexOf(z), 1);
  dying.push({ z, t: 0 });
  return true;
}

// Per-frame hit reaction, shared by the living and the dying.
function react(z: Zombie, dt: number) {
  const p = z.g.position;
  p.x += z.kx * dt;
  p.z += z.kz * dt;
  const k = Math.exp(-10 * dt);
  z.kx *= k;
  z.kz *= k;
  if (z.flash > 0) {
    z.flash -= dt;
    if (z.flash <= 0) z.parts.forEach((m, i) => { m.material = z.mats[i]; });
  }
  z.squash *= Math.exp(-14 * dt);
  const wide = z.base * (1 + 0.3 * z.squash);
  z.g.scale.set(wide, 1 - 0.2 * z.squash, wide);
}

export function updateZombies(dt: number) {
  for (const z of zombies) {
    react(z, dt);
    const p = z.g.position;
    const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    z.g.rotation.y = Math.atan2(dx, dz);

    if (d > 0.9) {
      p.x += (dx / d) * z.speed * dt;
      p.z += (dz / d) * z.speed * dt;
      z.t += dt * (3 + z.speed * 2);
    } else if (d < 0.7) {
      // player walked into us: get shoved back
      p.x -= (dx / d) * (0.7 - d);
      p.z -= (dz / d) * (0.7 - d);
    }

    const sw = Math.sin(z.t) * 0.6;
    z.parts[2].rotation.x = sw;
    z.parts[3].rotation.x = -sw;
    // walkers reach forward, runners pump their arms
    z.parts[4].rotation.x = z.runner ? -sw * 1.5 : -1.4 + sw * 0.2;
    z.parts[5].rotation.x = z.runner ? sw * 1.5 : -1.4 - sw * 0.2;

    z.cd -= dt;
    if (d < 1.3 && z.cd <= 0) { hurt(z.dmg); shake(0.035); z.cd = 1; }
  }

  // keep zombies from stacking
  for (let i = 0; i < zombies.length; i++) {
    for (let j = i + 1; j < zombies.length; j++) {
      const a = zombies[i].g.position, b = zombies[j].g.position;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8 && d > 1e-4) {
        const k = (0.8 - d) / 2 / d;
        a.x -= dx * k; a.z -= dz * k;
        b.x += dx * k; b.z += dz * k;
      }
    }
  }

  for (const z of zombies) collide(z.g.position, 0.4);

  // the dead: thrown back, knocked flat, then shrink away
  for (let i = dying.length - 1; i >= 0; i--) {
    const d = dying[i];
    d.t += dt;
    react(d.z, dt);
    collide(d.z.g.position, 0.4);
    d.z.g.rotation.x = -1.5 * Math.min(1, d.t / 0.25);
    if (d.t > 0.3) d.z.g.scale.multiplyScalar(Math.max(0.01, (0.45 - d.t) / 0.15));
    if (d.t >= 0.45) {
      scene.remove(d.z.g);
      dying.splice(i, 1);
    }
  }

  if (zombies.length && Math.random() < dt * 0.4) sfx.groan();
}

// Nearest zombie hit by the ray within maxDist. Head box is tested first.
const hb = new THREE.Box3(), hp = new THREE.Vector3();
export function rayZombies(ray: THREE.Ray, maxDist: number): { z: Zombie; head: boolean; d: number } | null {
  let best = maxDist;
  let res: { z: Zombie; head: boolean; d: number } | null = null;
  for (const z of zombies) {
    const p = z.g.position;
    let head = true;
    hb.min.set(p.x - 0.25, 1.5, p.z - 0.25);
    hb.max.set(p.x + 0.25, 1.95, p.z + 0.25);
    let h = ray.intersectBox(hb, hp);
    if (!h) {
      head = false;
      hb.min.set(p.x - 0.4, 0, p.z - 0.4);
      hb.max.set(p.x + 0.4, 1.5, p.z + 0.4);
      h = ray.intersectBox(hb, hp);
    }
    if (!h) continue;
    const d = hp.distanceTo(ray.origin);
    if (d < best) { best = d; res = { z, head, d }; }
  }
  return res;
}
