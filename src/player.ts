import * as THREE from 'three';
import { collide } from './level';
import { sfx } from './audio';
import { input } from './touch';

export const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
camera.rotation.order = 'YXZ';

export const keys = new Set<string>();
export const player = { pos: new THREE.Vector3(), vy: 0, yaw: 0, pitch: 0, kick: 0, hp: 100, hurtT: 0 };
export const game = { state: 'start' as 'start' | 'play' | 'pause' | 'over', wave: 0, kills: 0, lastShot: '-' };

const EYE = 1.65, RADIUS = 0.4;

export function resetPlayer() {
  player.pos.set(0, 0, 0);
  player.vy = player.yaw = player.pitch = player.kick = player.hurtT = 0;
  player.hp = 100;
}

export function hurt(dmg: number) {
  player.hp = Math.max(0, player.hp - dmg);
  player.hurtT = 0.3;
  sfx.hurt();
}

addEventListener('keydown', e => keys.add(e.code));
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousemove', e => {
  if (!document.pointerLockElement) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * 0.0022));
});

export function updatePlayer(dt: number) {
  const f = input.forward + (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const s = input.side + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const len = Math.hypot(f, s);
  if (len > 0) {
    const sprint = f > 0 && (keys.has('ShiftLeft') || keys.has('ShiftRight') || input.forward > 0.9); // forward only
    const step = ((sprint ? 7.5 : 4.5) / Math.max(1, len)) * dt;
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    player.pos.x += (-sin * f + cos * s) * step;
    player.pos.z += (-cos * f - sin * s) * step;
  }

  if (player.pos.y <= 0 && (keys.has('Space') || input.jump)) player.vy = 6;
  player.vy -= 20 * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) { player.pos.y = 0; player.vy = 0; }

  collide(player.pos, RADIUS);

  player.kick *= Math.exp(-12 * dt); // recoil recovery
  player.hurtT = Math.max(0, player.hurtT - dt);
  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch + player.kick, player.yaw, 0);
}
