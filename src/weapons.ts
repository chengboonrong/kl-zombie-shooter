import * as THREE from 'three';
import { rayLevel } from './level';
import { camera, player, game } from './player';
import { zombies, rayZombies, hitZombie, type Zombie } from './zombies';
import { toon, inked, canvasTex } from './toon';
import { pop, damageNumber, burst, blast, hitStop, shake } from './fx';
import { sfx } from './audio';
import { spawnPickup } from './pickups';
import { input, hasFocus } from './touch';

// push: knockback impulse per pellet, in m/s
export const weapons = [
  { name: 'PISTOL', dmg: 25, pellets: 1, spread: 0.004, size: 12, mag: 12, rate: 0.25, reload: 1.2, kick: 0.03, push: 3, reserve: Infinity, stock: Infinity, topup: 0, barrel: [1, 1, 1], color: 0x3d4a66, sound: sfx.pistol, word: 'BANG!' },
  { name: 'SHOTGUN', dmg: 13, pellets: 8, spread: 0.07, size: 6, mag: 6, rate: 0.9, reload: 2.0, kick: 0.09, push: 1.6, reserve: 12, stock: 12, topup: 4, barrel: [1.5, 1, 1.8], color: 0x3d4a66, sound: sfx.shotgun, word: 'BOOM!' },
  { name: 'SMG', dmg: 14, pellets: 1, spread: 0.025, size: 30, mag: 30, rate: 0.08, reload: 1.8, kick: 0.012, push: 1, reserve: 90, stock: 90, topup: 30, barrel: [1.4, 1.6, 1.2], color: 0x222233, sound: sfx.smg, word: 'BRRRT!' },
  { name: 'RIFLE', dmg: 90, pellets: 1, spread: 0.001, size: 5, mag: 5, rate: 1.1, reload: 2.4, kick: 0.12, push: 6, reserve: 10, stock: 10, topup: 5, barrel: [0.8, 0.8, 2.6], color: 0x69844a, sound: sfx.rifle, word: 'KRAK!' },
  { name: 'MERCUN', dmg: 250, pellets: 1, spread: 0, size: 1, mag: 1, rate: 1.2, reload: 2.2, kick: 0.15, push: 8, reserve: 3, stock: 3, topup: 1, barrel: [1.8, 1.5, 1.5], color: 0xe63946, sound: sfx.mercun, word: 'THUMP!' },
];
export const ws = { cur: 0, cd: 0, reloadT: 0, firing: false };
const reserve = () => weapons[ws.cur].reserve;

// View model lives in its own scene, drawn after a depth clear, so it never clips into walls.
export const gunScene = new THREE.Scene();
export const gunCam = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
gunScene.add(new THREE.AmbientLight(0xffffff, 1.5));
const key = new THREE.DirectionalLight(0xffffff, 2);
key.position.set(-1, 2, 1);
gunScene.add(key);

const barrel = inked(0.06, 0.08, 0.4, toon(0x3d4a66), 0, 0.008);
const grip = inked(0.06, 0.16, 0.08, toon(0xb5651d), 0, 0.008);
grip.position.set(0, -0.1, 0.14);
const flash = new THREE.Sprite(new THREE.SpriteMaterial({
  map: canvasTex(64, 64, c => {
    c.translate(32, 32);
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? 12 : 30;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = '#ffe93b';
    c.fill();
    c.lineWidth = 3;
    c.stroke();
  }),
}));
flash.scale.set(0.3, 0.3, 1);
flash.position.z = -0.25;
const gun = new THREE.Group();
gun.add(barrel, grip, flash);
gun.position.set(0.25, -0.22, -0.5);
gunScene.add(gun);

// the flash also lights the world
const flashLight = new THREE.PointLight(0xffcc66, 0, 12);
camera.add(flashLight);

let recoil = 0, flashT = 0;

export function selectWeapon(i: number) {
  if (i === ws.cur) return;
  ws.cur = i;
  ws.reloadT = 0;
  ws.cd = 0.3;
  const w = weapons[i];
  barrel.scale.set(w.barrel[0], w.barrel[1], w.barrel[2]);
  (barrel.material as THREE.MeshToonMaterial).color.setHex(w.color);
  flash.position.z = -(0.2 * barrel.scale.z + 0.05);
}

export function resetWeapons() {
  for (const w of weapons) { w.mag = w.size; w.reserve = w.stock; }
  selectWeapon(0);
  ws.reloadT = ws.cd = 0;
  ws.firing = false;
}

export function startReload() {
  const w = weapons[ws.cur];
  if (ws.reloadT > 0 || w.mag === w.size || reserve() === 0) return;
  ws.reloadT = w.reload;
  sfx.reload();
}

const ray = new THREE.Ray(), dir = new THREE.Vector3(), back = new THREE.Vector3(), tmp = new THREE.Vector3();
const jitter = (s: number) => (Math.random() - 0.5) * 2 * s;
const hits = new Map<Zombie, { dmg: number; head: boolean; killed: boolean }>();

function shoot() {
  const w = weapons[ws.cur];
  if (w.mag === 0) {
    if (reserve() > 0) startReload();
    else { sfx.empty(); ws.cd = 0.4; }
    return;
  }
  w.mag--;
  ws.cd = w.rate;
  player.kick += w.kick;
  recoil = 1;
  flashT = 0.06;
  flash.material.rotation = Math.random() * 6;
  w.sound();
  shake(ws.cur ? 0.02 : 0.004);

  ray.origin.copy(camera.position);
  camera.getWorldDirection(dir);
  back.copy(dir).negate();
  pop(w.word, '#e63946', tmp.set(0.5, -0.12, -1.6).applyMatrix4(camera.matrixWorld), 0.5);

  // Damage and knockback land per pellet; the rest is tallied per zombie.
  hits.clear();
  const tally = (z: Zombie, dmg: number, head: boolean, dx = dir.x, dz = dir.z) => {
    const killed = hitZombie(z, dmg, dx, dz, w.push);
    const e = hits.get(z) ?? { dmg: 0, head: false, killed: false };
    e.dmg += dmg;
    e.head ||= head;
    e.killed ||= killed;
    hits.set(z, e);
  };
  for (let i = 0; i < w.pellets; i++) {
    ray.direction.set(dir.x + jitter(w.spread), dir.y + jitter(w.spread), dir.z + jitter(w.spread)).normalize();
    const wall = rayLevel(ray);
    let hit = rayZombies(ray, wall);
    if (w.name === 'MERCUN') {
      const ground = ray.direction.y < 0 ? -ray.origin.y / ray.direction.y : Infinity;
      const impact = ray.at(Math.min(wall, hit?.d ?? Infinity, ground, 100), new THREE.Vector3());
      pop('KABOOM!', '#e63946', impact, 10);
      blast(impact);
      for (const color of [0xffd60a, 0xff3b30, 0xffffff, 0x4cc9f0]) burst(impact, tmp.set(0, 0, 0), color, 20, 15);
      shake(0.06);
      hitStop(0.12);
      for (const z of [...zombies]) {
        const p = z.g.position, dx = p.x - impact.x, dz = p.z - impact.z;
        const d = Math.hypot(dx, 1 - impact.y, dz), len = Math.hypot(dx, dz) || 1;
        if (d < 4) tally(z, w.dmg * (1 - d / 4), false, dx / len, dz / len);
      }
    } else {
      const passed = new Set<Zombie>();
      while (hit) {
        tally(hit.z, w.dmg * (hit.head ? 2 : 1), hit.head);
        if (w.name !== 'RIFLE') break;
        passed.add(hit.z);
        hit = rayZombies(ray, wall, passed);
      }
      if ((!hit || w.name === 'RIFLE') && wall < Infinity) burst(ray.at(wall - 0.05, tmp), back, 0xffe93b, 3, 5);
    }
  }

  let result = 'miss';
  for (const [z, e] of hits) {
    const p = z.g.position;
    tmp.set(p.x, e.head ? 1.75 : 1.2, p.z);
    burst(tmp, dir, 0xd4ff3b, e.killed ? 12 : 6, 7); // goo flies the way the bullet went
    damageNumber(Math.round(e.dmg), e.head, tmp);
    if (e.killed) {
      game.kills++;
      sfx.splat();
      hitStop(ws.cur ? 0.09 : 0.06);
      shake(0.02);
      pop('SPLAT!', '#2a9d8f', tmp, 1.8);
      if (Math.random() < 0.1) spawnPickup('ammo', p);
    } else {
      sfx.hit();
      hitStop(0.025);
      shake(0.008);
      pop(e.head ? 'CRACK!' : 'POW!', '#f77f00', tmp, 0.9);
    }
    result = (e.head ? 'head' : 'body') + (e.killed ? ' KILL' : '');
  }
  game.lastShot = result;
}

export function updateWeapons(dt: number) {
  const w = weapons[ws.cur];
  ws.cd -= dt;
  if (ws.reloadT > 0) {
    ws.reloadT -= dt;
    if (ws.reloadT <= 0) {
      ws.reloadT = 0;
      const n = Math.min(w.size - w.mag, reserve());
      w.mag += n;
      w.reserve -= n;
    }
  } else if ((ws.firing || input.fire) && hasFocus() && ws.cd <= 0) {
    shoot();
  }

  recoil *= Math.exp(-14 * dt);
  flashT -= dt;
  flash.visible = flashT > 0;
  flashLight.intensity = flashT > 0 ? 20 : 0;
  gun.position.z = -0.5 + recoil * 0.08;
  gun.rotation.x = recoil * 0.25 - (ws.reloadT > 0 ? 0.9 : 0); // dips while reloading
}

addEventListener('mousedown', e => { if (e.button === 0 && hasFocus()) ws.firing = true; });
addEventListener('mouseup', e => { if (e.button === 0) ws.firing = false; });
addEventListener('wheel', e => { if (ws.cd <= 0) selectWeapon((ws.cur + (e.deltaY < 0 ? weapons.length - 1 : 1)) % weapons.length); });
addEventListener('keydown', e => {
  if (/^Digit[1-5]$/.test(e.code)) selectWeapon(Number(e.code.slice(-1)) - 1);
  if (e.code === 'KeyR') startReload();
});
