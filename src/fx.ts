import * as THREE from 'three';
import { scene } from './level';
import { canvasTex } from './toon';

// Onomatopoeia: a spiky burst with a word on it, cached per word.
const cache = new Map<string, THREE.Texture>();
function wordTex(text: string, color: string) {
  const key = text + color;
  let t = cache.get(key);
  if (!t) {
    t = canvasTex(256, 128, c => {
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
      c.font = 'italic 900 46px Impact, "Arial Black", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 8;
      c.strokeText(text, 0, 2, 150);
      c.fillStyle = color;
      c.fillText(text, 0, 2, 150);
    });
    cache.set(key, t);
  }
  return t;
}

const LIFE = 0.35;
const live: { s: THREE.Sprite; t: number; size: number }[] = [];

export function pop(text: string, color: string, pos: THREE.Vector3, size: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordTex(text, color), depthTest: false, transparent: true }));
  s.position.copy(pos);
  s.material.rotation = (Math.random() - 0.5) * 0.5;
  s.scale.set(size * 0.6, size * 0.3, 1);
  scene.add(s);
  live.push({ s, t: 0, size });
}

export function updateFx(dt: number) {
  for (let i = live.length - 1; i >= 0; i--) {
    const f = live[i];
    f.t += dt;
    const w = f.size * (0.6 + 0.4 * Math.min(1, f.t / 0.08)); // pop in
    f.s.scale.set(w, w / 2, 1);
    f.s.material.opacity = Math.min(1, (LIFE - f.t) / 0.1);   // fade out
    if (f.t >= LIFE) {
      scene.remove(f.s);
      f.s.material.dispose();
      live.splice(i, 1);
    }
  }
}
