import * as THREE from 'three';
import { rayLevel } from './level';
import { camera, player, game } from './player';
import { rayZombies, damageZombie } from './zombies';
import { toon, inked, canvasTex } from './toon';
import { pop } from './fx';
import { sfx } from './audio';
import { spawnPickup } from './pickups';

export const weapons = [
  { name: 'PISTOL', dmg: 25, pellets: 1, spread: 0.004, size: 12, mag: 12, rate: 0.25, reload: 1.2, kick: 0.03 },
  { name: 'SHOTGUN', dmg: 13, pellets: 8, spread: 0.07, size: 6, mag: 6, rate: 0.9, reload: 2.0, kick: 0.09 },
];
export const ws = { cur: 0, cd: 0, reloadT: 0, firing: false };
const reserve = () => (ws.cur === 0 ? Infinity : player.shells);

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
  barrel.scale.set(i ? 1.5 : 1, 1, i ? 1.8 : 1);
  flash.position.z = -(0.2 * barrel.scale.z + 0.05);
}

export function resetWeapons() {
  for (const w of weapons) w.mag = w.size;
  selectWeapon(0);
  ws.reloadT = 0;
}

function startReload() {
  const w = weapons[ws.cur];
  if (ws.reloadT > 0 || w.mag === w.size || reserve() === 0) return;
  ws.reloadT = w.reload;
  sfx.reload();
}

const ray = new THREE.Ray(), dir = new THREE.Vector3(), tmp = new THREE.Vector3();
const jitter = (s: number) => (Math.random() - 0.5) * 2 * s;

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
  if (ws.cur) sfx.shotgun(); else sfx.pistol();

  ray.origin.copy(camera.position);
  camera.getWorldDirection(dir);
  pop(ws.cur ? 'BOOM!' : 'BANG!', '#e63946', tmp.set(0.5, -0.12, -1.6).applyMatrix4(camera.matrixWorld), 0.5);

  let result = 'miss', pow = false;
  for (let i = 0; i < w.pellets; i++) {
    ray.direction.set(dir.x + jitter(w.spread), dir.y + jitter(w.spread), dir.z + jitter(w.spread)).normalize();
    const hit = rayZombies(ray, rayLevel(ray));
    if (!hit) continue;
    const p = hit.z.g.position;
    p.x += dir.x * 0.15; // knockback
    p.z += dir.z * 0.15;
    const killed = damageZombie(hit.z, w.dmg * (hit.head ? 2 : 1));
    if (killed) {
      game.kills++;
      sfx.splat();
      pop('SPLAT!', '#2a9d8f', tmp.set(p.x, 1.6, p.z), 1.8);
      if (Math.random() < 0.1) spawnPickup('ammo', p);
    } else if (!pow) {
      pow = true; // one hit word per shot
      pop(hit.head ? 'CRACK!' : 'POW!', '#f77f00', ray.at(hit.d, tmp), 0.9);
    }
    result = (hit.head ? 'head' : 'body') + (killed ? ' KILL' : '');
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
      if (ws.cur === 1) player.shells -= n;
    }
  } else if (ws.firing && ws.cd <= 0) {
    shoot();
  }

  recoil *= Math.exp(-14 * dt);
  flashT -= dt;
  flash.visible = flashT > 0;
  flashLight.intensity = flashT > 0 ? 20 : 0;
  gun.position.z = -0.5 + recoil * 0.08;
  gun.rotation.x = recoil * 0.25 - (ws.reloadT > 0 ? 0.9 : 0); // dips while reloading
}

addEventListener('mousedown', e => { if (e.button === 0 && document.pointerLockElement) ws.firing = true; });
addEventListener('mouseup', e => { if (e.button === 0) ws.firing = false; });
addEventListener('wheel', () => { if (ws.cd <= 0) selectWeapon(1 - ws.cur); });
addEventListener('keydown', e => {
  if (e.code === 'Digit1') selectWeapon(0);
  if (e.code === 'Digit2') selectWeapon(1);
  if (e.code === 'KeyR') startReload();
});
