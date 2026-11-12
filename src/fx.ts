import * as THREE from 'three';
import { scene } from './level';
import { camera } from './player';
import { canvasTex } from './toon';

// --- hit stop and screen shake ---
export const feel = { stop: 0, shake: 0 };
export function hitStop(seconds: number) { feel.stop = Math.max(feel.stop, seconds); }
export function shake(amount: number) { feel.shake = Math.min(0.06, feel.shake + amount); }

// --- sprites: onomatopoeia bursts and damage numbers ---
const FONT = 'Impact, "Arial Black", sans-serif';
const cache = new Map<string, THREE.Texture>();
function tex(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  let t = cache.get(key);
  if (!t) { t = canvasTex(w, h, draw); cache.set(key, t); }
  return t;
}

const pops: { s: THREE.Sprite; t: number; size: number; life: number; rise: number }[] = [];

function sprite(map: THREE.Texture, pos: THREE.Vector3, size: number, life: number, rise: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }));
  s.position.copy(pos);
  s.scale.set(size * 0.6, size * 0.3, 1);
  scene.add(s);
  pops.push({ s, t: 0, size, life, rise });
  return s;
}

// A spiky burst with a word on it.
export function pop(text: string, color: string, pos: THREE.Vector3, size: number) {
  const map = tex(text + color, 256, 128, c => {
    c.translate(128, 64);
    c.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, r = i % 2 ? 0.66 : 1;
      c.lineTo(Math.cos(a) * 122 * r, Math.sin(a) * 60 * r);
    }
    c.closePath();
    c.fillStyle = '#ffe93b';
    c.fill();
    c.lineJoin = 'round';
    c.lineWidth = 5;
    c.strokeStyle = '#000';
    c.stroke();
    c.rotate(-0.08);
    c.font = `italic 900 46px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 8;
    c.strokeText(text, 0, 2, 150);
    c.fillStyle = color;
    c.fillText(text, 0, 2, 150);
  });
  sprite(map, pos, size, 0.35, 0).material.rotation = (Math.random() - 0.5) * 0.5;
}

// A number that floats up from the hit. Crits are red with a "!".
export function damageNumber(n: number, crit: boolean, pos: THREE.Vector3) {
  const text = n + (crit ? '!' : '');
  const map = tex('#' + text, 128, 64, c => {
    c.font = `900 46px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 8;
    c.strokeText(text, 64, 34, 120);
    c.fillStyle = crit ? '#ff3b30' : '#fff';
    c.fillText(text, 64, 34, 120);
  });
  const s = sprite(map, pos, crit ? 1 : 0.7, 0.6, 1.5);
  s.position.x += (Math.random() - 0.5) * 0.4;
  s.position.y += 0.35;
}

// --- sparks: streaks thrown along a direction, each aligned to its own velocity ---
const sparkGeo = new THREE.BoxGeometry(0.04, 0.04, 0.3);
const sparkMats = new Map<number, THREE.MeshBasicMaterial>();
const sparks: { m: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
const SPARK_LIFE = 0.3;
const tmp = new THREE.Vector3();
const spread = () => (Math.random() - 0.5) * 0.9;

export function burst(pos: THREE.Vector3, dir: THREE.Vector3, color: number, n: number, speed: number) {
  let mat = sparkMats.get(color);
  if (!mat) { mat = new THREE.MeshBasicMaterial({ color }); sparkMats.set(color, mat); }
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(sparkGeo, mat);
    m.position.copy(pos);
    scene.add(m);
    const v = new THREE.Vector3(dir.x + spread(), dir.y + spread() + 0.2, dir.z + spread())
      .normalize().multiplyScalar(speed * (0.5 + Math.random()));
    sparks.push({ m, v, t: 0 });
  }
}

// Call last each frame: it also applies shake on top of the camera pose.
export function updateFx(dt: number) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const f = pops[i];
    f.t += dt;
    const w = f.size * (0.6 + 0.4 * Math.min(1, f.t / 0.08)); // pop in
    f.s.scale.set(w, w / 2, 1);
    f.s.position.y += f.rise * dt;
    f.s.material.opacity = Math.min(1, (f.life - f.t) / 0.1); // fade out
    if (f.t >= f.life) {
      scene.remove(f.s);
      f.s.material.dispose();
      pops.splice(i, 1);
    }
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const p = sparks[i];
    p.t += dt;
    p.v.y -= 14 * dt;
    p.m.position.addScaledVector(p.v, dt);
    p.m.lookAt(tmp.copy(p.m.position).add(p.v));
    p.m.scale.setScalar(Math.max(0.01, 1 - p.t / SPARK_LIFE));
    if (p.t >= SPARK_LIFE) {
      scene.remove(p.m);
      sparks.splice(i, 1);
    }
  }

  // shake: short, sharp, gone in about 0.15 s
  feel.shake *= Math.exp(-22 * dt);
  camera.rotation.x += (Math.random() - 0.5) * 2 * feel.shake;
  camera.rotation.y += (Math.random() - 0.5) * 2 * feel.shake;
  camera.rotation.z += (Math.random() - 0.5) * feel.shake;
}
