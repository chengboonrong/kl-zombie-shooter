import * as THREE from 'three';

// 3-step lighting ramp
const ramp = new THREE.DataTexture(new Uint8Array([50, 140, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

export const toon = (color: number, map: THREE.Texture | null = null) =>
  new THREE.MeshToonMaterial({ color, map, gradientMap: ramp });

// inverted-hull outline material
export const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

export function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Box mesh with an outline hull child. py shifts the pivot, t is ink thickness.
const geos = new Map<string, [THREE.BoxGeometry, THREE.BoxGeometry]>();
export function inked(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], py = 0, t = 0.03) {
  const key = [w, h, d, py, t].join();
  let g = geos.get(key);
  if (!g) {
    g = [
      new THREE.BoxGeometry(w, h, d).translate(0, py, 0),
      new THREE.BoxGeometry(w + 2 * t, h + 2 * t, d + 2 * t).translate(0, py, 0),
    ];
    geos.set(key, g);
  }
  const m = new THREE.Mesh(g[0], mat);
  m.add(new THREE.Mesh(g[1], INK));
  return m;
}
