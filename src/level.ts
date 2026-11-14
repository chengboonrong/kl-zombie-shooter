import * as THREE from 'three';
import { toon, canvasTex, INK } from './toon';
import { addWall } from './nav';

export const scene = new THREE.Scene();
export const solids: THREE.Box3[] = [];   // block movement (checked in XZ only)
export const blockers: THREE.Box3[] = []; // block bullets

const geo = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map<number, THREE.Material>();
const hulls: THREE.Matrix4[] = [];
const INK_T = 0.05;

interface Opt { y?: number; solid?: boolean; glow?: boolean; mat?: THREE.Material; wall?: boolean }

// x, z: centre. w, d: size along x, z. h: height. o.y: bottom (default 0).
// Boxes resting on the ground are solid unless told otherwise.
function box(x: number, z: number, w: number, d: number, h: number, color: number, o: Opt = {}) {
  const y0 = o.y ?? 0;
  const key = color + (o.glow ? 0x1000000 : 0);
  let mat = o.mat ?? mats.get(key);
  if (!mat) {
    mat = o.glow ? new THREE.MeshBasicMaterial({ color }) : toon(color);
    mats.set(key, mat);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y0 + h / 2, z);
  mesh.scale.set(w, h, d);
  scene.add(mesh);
  hulls.push(new THREE.Matrix4().compose(
    mesh.position, mesh.quaternion,
    new THREE.Vector3(w + 2 * INK_T, h + 2 * INK_T, d + 2 * INK_T),
  ));
  const b = new THREE.Box3().setFromCenterAndSize(mesh.position, mesh.scale);
  blockers.push(b);
  if (o.solid ?? y0 === 0) solids.push(b);
  if (o.wall) addWall(b.min.x, b.min.z, b.max.x, b.max.z);
}

const FONT = '"Arial Black", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

// Unlit two-line signboard. ry: 0 faces +z, PI faces -z, PI/2 faces +x, -PI/2 faces -x.
function sign(main: string, sub: string, bg: string, fg: string, x: number, y: number, z: number, w: number, h: number, ry: number) {
  const H = Math.round((512 * h) / w);
  const tex = canvasTex(512, H, c => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, H);
    c.lineWidth = 12;
    c.strokeRect(0, 0, 512, H);
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `900 ${H * 0.36}px ${FONT}`;
    c.fillText(main, 256, H * 0.34, 470);
    c.font = `900 ${H * 0.3}px ${FONT}`;
    c.fillText(sub, 256, H * 0.72, 470);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z);
  m.rotation.y = ry;
  scene.add(m);
}

function buildSky() {
  const MX = 2048 / 942, MY = 512 / 120, H0 = 469; // px per metre (x, y) and the horizon row
  const INKY = '#0d0b1e';
  const tex = canvasTex(2048, 512, c => {
    const g = c.createLinearGradient(0, 0, 0, H0);
    g.addColorStop(0, '#1b1464');
    g.addColorStop(0.6, '#6a2c91');
    g.addColorStop(1, '#ff6b6b');
    c.fillStyle = g;
    c.fillRect(0, 0, 2048, 512);
    c.fillStyle = '#fff';
    for (let i = 0; i < 150; i++) c.fillRect(Math.random() * 2048, Math.random() * 300, 2, 2);
    c.fillStyle = '#ffe9a0'; // moon
    c.beginPath();
    c.ellipse(620, 150, 14 * MX, 14 * MY, 0, 0, 7);
    c.fill();

    // generic city blocks with a few lit windows
    for (let x = 0; x < 2048;) {
      const w = 25 + Math.random() * 50, h = 8 + Math.random() * 28;
      c.fillStyle = INKY;
      c.fillRect(x, H0 - h * MY, w, 512);
      c.fillStyle = '#ffd75e';
      for (let i = 0; i < 6; i++) c.fillRect(x + 3 + Math.random() * (w - 8), H0 - Math.random() * h * MY + 4, 3, 4);
      x += w;
    }

    // twin towers with skybridge (seen looking down the lane, -z)
    c.fillStyle = INKY;
    for (const x of [512 - 26, 512 + 26]) {
      for (const [w, h] of [[13, 50], [11, 58], [8, 64], [5, 69], [1.2, 82]]) {
        c.fillRect(x - (w * MX) / 2, H0 - h * MY, w * MX, 512);
      }
    }
    c.fillRect(512 - 26, H0 - 33 * MY, 52, 2.5 * MY);

    // telecom tower (seen the other way, +z, under the viaduct)
    c.fillRect(1536 - 1.5 * MX, H0 - 60 * MY, 3 * MX, 512);
    c.beginPath();
    c.ellipse(1536, H0 - 60 * MY, 6 * MX, 4.5 * MY, 0, 0, 7);
    c.fill();
    c.fillRect(1536 - 0.5 * MX, H0 - 80 * MY, MX, 25 * MY);
  });

  const sky = new THREE.Mesh(
    new THREE.CylinderGeometry(150, 150, 120, 48, 1, true),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }),
  );
  sky.position.y = 50;
  sky.rotation.y = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.CircleGeometry(150, 48), new THREE.MeshBasicMaterial({ color: 0x1b1464 }));
  cap.position.y = 110;
  cap.rotation.x = Math.PI / 2;
  scene.add(sky, cap);
}

export function buildLevel() {
  // lights: purple ambient, blue moon, warm lantern pools, cool mamak tube
  scene.add(new THREE.AmbientLight(0x8877cc, 0.9));
  const moon = new THREE.DirectionalLight(0xaabbff, 2);
  moon.position.set(-6, 10, 3);
  scene.add(moon);
  for (const [x, z, c] of [[0, -19, 0xffa24a], [0, -3, 0xffa24a], [0, 21, 0xffa24a], [11.5, -4, 0xbfe8ff]]) {
    const l = new THREE.PointLight(c, 40, 22);
    l.position.set(x, 4.3, z);
    scene.add(l);
  }

  buildSky();
  box(0, 18, 90, 100, 1, 0x4a4466, { y: -1 }); // asphalt

  // shop-lot facade: shuttered ground floor, two windows upstairs, one lit
  const facade = canvasTex(256, 256, c => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#000';
    c.fillRect(0, 14, 256, 5);
    c.fillRect(0, 112, 256, 5);
    c.lineWidth = 5;
    for (const x of [36, 150]) {
      c.fillStyle = '#8d99ae';
      c.fillRect(x, 34, 70, 64);
      c.strokeRect(x, 34, 70, 64);
    }
    c.fillStyle = '#b8bcc8';
    c.fillRect(28, 156, 200, 100);
    c.strokeRect(28, 156, 200, 100);
    c.fillStyle = '#000';
    for (let y = 168; y < 256; y += 12) c.fillRect(28, y, 200, 2);
  });
  const glow = canvasTex(256, 256, c => {
    c.fillStyle = '#000';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#ffd75e';
    c.fillRect(39, 37, 64, 58);
    c.fillStyle = '#000';
    c.fillRect(69, 37, 4, 58);
  });
  const LOTS = [0xffd166, 0xef767a, 0x49beaa, 0xf7a8b8, 0x7d8cff].map(color => {
    const m = toon(color, facade);
    m.emissive.set(0xffffff);
    m.emissiveMap = glow;
    return m;
  });
  for (let i = 0; i < 12; i++) box(-9, -27.5 + i * 5, 6, 5, 6.5 + (i % 3) * 0.5, 0, { wall: true, mat: LOTS[i % 5] });           // west row
  for (let i = 0; i < 4; i++) box(11.5, -27.5 + i * 5, 11, 5, 7.5 - (i % 3) * 0.5, 0, { wall: true, mat: LOTS[(i + 2) % 5] });   // east, south of mamak
  for (let i = 0; i < 5; i++) box(11.5, 4.8 + i * 5.6, 11, 5.6, 6.5 + (i % 3) * 0.5, 0, { wall: true, mat: LOTS[(i + 1) % 5] }); // east, north of mamak

  // shop signs: [side, z, main line, second line]
  const SHOPS: [number, number, string, string][] = [
    [-1, -22.5, 'KEDAI KOPI BINTANG', '星星茶室'],
    [-1, -12.5, 'KEDAI UBAT NAGA EMAS', '金龙药行'],
    [-1, -2.5, 'LUCKY WATCH & CLOCK', '好运钟表'],
    [-1, 7.5, 'TUKANG JAHIT MAJU', '美珠裁缝'],
    [-1, 17.5, 'PAJAK GADAI SENTOSA', '顺利当店'],
    [-1, 27.5, 'KEDAI ELEKTRIK CAHAYA', '光明电器'],
    [1, -22.5, 'DURIAN RUNTUH', '榴莲大平卖'],
    [1, -12.5, 'BEG · KASUT · JAM MURAH', 'CHEAP CHEAP! 便宜'],
    [1, 4.8, 'AIR MATA KUCING SEJUK', '冰凉龙眼水'],
    [1, 16, 'SATAY PANAS', '沙爹 · HOT SATAY'],
    [1, 27.2, 'KEDAI RUNCIT MURNI', '杂货店'],
  ];
  const COLS = [['#e63946', '#fff'], ['#ffd60a', '#111'], ['#1d3557', '#ffd60a'], ['#2a9d8f', '#fff'], ['#f77f00', '#111'], ['#7b2cbf', '#fff']];
  SHOPS.forEach(([s, z, a, b], i) => sign(a, b, COLS[i % 6][0], COLS[i % 6][1], s * 5.93, 3.4, z, 4.2, 0.9, (-s * Math.PI) / 2));

  // lane ends: hoardings
  box(0, -30.5, 12, 1, 3, 0xffc300, { wall: true });
  box(0, 66.5, 12, 1, 3, 0xffc300, { wall: true });
  sign('JALAN DITUTUP · ROAD CLOSED', '此路不通', '#111', '#ffd60a', 0, 1.9, -29.93, 6, 1.2, 0);
  sign('JALAN DITUTUP · ROAD CLOSED', '此路不通', '#111', '#ffd60a', 0, 1.9, 65.93, 6, 1.2, Math.PI);

  // Lots meet at the corners so the street boundary has no gaps.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = 48.5 + i * 5;
      box(side * 9, z, 6, 5, 7, 0, { wall: true, mat: LOTS[i % 5] });
      sign(['KEDAI ROTI BULAN', 'DOBI BERSIH', 'KEDAI BUKU RIMBA', 'KOPI PAGI'][i], 'OPEN DAILY · 每日营业', '#2a9d8f', '#fff', side * 5.93, 3.4, z, 4.2, 0.9, -side * Math.PI / 2);
    }
    for (const edge of [-1, 1]) for (let i = 0; i < 6; i++) {
      if (edge > 0 && i === 0) continue;
      const x = side * (9 + i * 6), z = edge < 0 ? 32 : 49;
      box(x, z, 6, edge < 0 ? 4 : 6, 7 + i % 2, 0, { wall: true, mat: LOTS[(i + 1) % 5] });
      sign(['KEDAI EMAS MANGGIS', 'PASAR SAYUR SEGAR', 'KEDAI KAIN PELANGI', 'BENGKEL JAYA', 'KEDAI TEH WANGI', 'ROTI NAGA'][i], 'JALAN PASAR · MARKET STREET', '#ffd60a', '#111', x, 3.4, 40 + edge * 5.93, 5, 0.9, edge < 0 ? 0 : Math.PI);
    }
    box(side * 42.5, 40, 1, 12, 3, 0xffc300, { wall: true });
    sign('JALAN DITUTUP', 'ROAD CLOSED · 此路不通', '#111', '#ffd60a', side * 41.93, 1.9, 40, 6, 1.2, -side * Math.PI / 2);
  }
  sign('JALAN PASAR', '巴刹街', '#1d3557', '#fff', 0, 5, 46, 6, 1, Math.PI);
  // A durian monument sits off the centre lines, leaving all four routes open.
  box(3.5, 43.5, 1.8, 1.8, 0.5, 0x9999aa);
  box(3.5, 43.5, 1.2, 1.2, 1.4, 0x9bc53d, { y: 0.5, solid: true });
  for (const dx of [-0.5, 0, 0.5]) for (const dz of [-0.5, 0, 0.5]) box(3.5 + dx, 43.5 + dz, 0.18, 0.18, 0.3, 0xffd166, { y: 1.9 });

  // hawker stalls: counter, tarp, poles, goods
  const TARPS = [0xe63946, 0x1d7cf2, 0xffd60a, 0x2a9d8f], GOODS = [0xff9f1c, 0x9bc53d, 0xc77dff];
  let n = 0;
  const stall = (x: number, z: number, cross = false) => {
    const s = cross ? Math.sign(z - 40) : Math.sign(x);
    const put = (a: number, b: number, w: number, d: number, h: number, c: number, o: Opt = {}) =>
      cross ? box(x + b, z + a, d, w, h, c, o) : box(x + a, z + b, w, d, h, c, o);
    put(0, 0, 1.5, 3, 1, 0xf1e3c6);
    put(-s * 0.2, 0, 1.9, 3.4, 0.12, TARPS[n % 4], { y: 2.6 });
    put(-s * 0.7, -1.6, 0.08, 0.08, 2.6, 0x333344, { solid: false });
    put(-s * 0.7, 1.6, 0.08, 0.08, 2.6, 0x333344, { solid: false });
    put(0, -0.7, 0.6, 0.6, 0.35, GOODS[n % 3], { y: 1 });
    put(0, 0.6, 0.5, 0.8, 0.25, GOODS[(n + 1) % 3], { y: 1 });
    n++;
  };
  for (const z of [-24, -16, -8, 0, 18, 25]) stall(-5.25, z);
  for (const z of [-25, -17, 6, 15, 23]) stall(5.25, z);

  for (const z of [51, 60]) { stall(-5.25, z); stall(5.25, z); }
  for (const x of [-34, -22, 22, 34]) stall(x, 45.25, true);

  for (const x of [-32, -20, 20, 32]) {
    box(x, 40, 0.04, 12, 0.04, 0x111111, { y: 5.4 });
    for (let z = 36; z <= 44; z += 2) box(x, z, 0.45, 0.45, 0.55, 0xff3b30, { y: 4.8, glow: true });
  }

  // lantern strings across the lane
  for (const z of [-24, -15, 1, 17, 25, 51, 60]) {
    box(0, z, 12, 0.04, 0.04, 0x111111, { y: 5.4 });
    for (let x = -4; x <= 4; x += 2) box(x, z, 0.45, 0.45, 0.55, 0xff3b30, { y: 4.8, glow: true });
  }

  // market banner, readable from both sides
  sign('PASAR MALAM JALAN LAMA', '老街夜市 · NIGHT MARKET', '#e63946', '#ffd60a', 0, 5.9, 4, 8, 1.3, Math.PI);
  sign('PASAR MALAM JALAN LAMA', '老街夜市 · NIGHT MARKET', '#e63946', '#ffd60a', 0, 5.9, 4.02, 8, 1.3, 0);

  // LRT viaduct with a parked train
  box(0, 10, 40, 5, 1.5, 0x9aa0b4, { y: 8 });
  box(-3, 10, 1.2, 1.2, 8, 0x9aa0b4);
  box(3, 10, 1.2, 1.2, 8, 0x9aa0b4);
  box(2, 10, 24, 2.6, 2.6, 0xf4f4f8, { y: 9.5 });
  box(2, 10, 24.1, 2.7, 0.6, 0xffe9a0, { y: 10.7, glow: true });
  box(2, 10, 24.15, 2.72, 0.25, 0xe63946, { y: 9.9 });
  sign('LRT · STESEN PASAR LAMA', '老街站', '#fff', '#1d3557', 0, 8.75, 7.44, 9, 1.1, Math.PI);
  sign('LRT · STESEN PASAR LAMA', '老街站', '#fff', '#1d3557', 0, 8.75, 12.56, 9, 1.1, 0);

  // mamak corner
  box(17.5, -4, 1, 12, 7, 0xf1faee, { wall: true });
  sign('RESTORAN MAMAK SELERA MALAM', 'TEH TARIK · ROTI CANAI · 24 JAM · 嘛嘛档', '#2a9d8f', '#fff', 16.93, 4.2, -4, 9, 1.5, -Math.PI / 2);
  for (const [x, z] of [[9, -7], [13, -7], [9, -1], [13, -1]]) {
    box(x, z, 0.15, 0.15, 0.75, 0x333344, { solid: false });
    box(x, z, 1.2, 1.2, 0.08, 0xe63946, { y: 0.75, solid: true });
  }
  box(15.8, -4, 1.4, 5, 1.1, 0xb8c4d0);                          // serving counter
  box(15.8, -5, 0.9, 1.2, 0.1, 0x222233, { y: 1.1 });            // roti griddle
  box(15.8, -2.6, 0.5, 0.5, 0.6, 0xffd60a, { y: 1.1 });          // teh tarik urn
  box(16.9, -4, 0.1, 4, 0.12, 0xdff6ff, { y: 5.4, glow: true }); // fluorescent tube

  // every box's outline hull in one draw call
  const ink = new THREE.InstancedMesh(geo, INK, hulls.length);
  hulls.forEach((m, i) => ink.setMatrixAt(i, m));
  ink.frustumCulled = false;
  scene.add(ink);
}

// Push a circle (centre p, radius r) out of all solids, in the XZ plane.
export function collide(p: THREE.Vector3, r: number) {
  for (const b of solids) {
    const cx = Math.max(b.min.x, Math.min(p.x, b.max.x));
    const cz = Math.max(b.min.z, Math.min(p.z, b.max.z));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x += (dx / d) * (r - d);
      p.z += (dz / d) * (r - d);
    } else {
      // centre is inside the box: exit through the nearest face
      const l = p.x - b.min.x, rt = b.max.x - p.x, n = p.z - b.min.z, f = b.max.z - p.z;
      const m = Math.min(l, rt, n, f);
      if (m === l) p.x = b.min.x - r;
      else if (m === rt) p.x = b.max.x + r;
      else if (m === n) p.z = b.min.z - r;
      else p.z = b.max.z + r;
    }
  }
}

// Distance along the ray to the nearest level geometry (Infinity if none).
const hit = new THREE.Vector3();
export function rayLevel(ray: THREE.Ray): number {
  let best = Infinity;
  for (const b of blockers) {
    if (ray.intersectBox(b, hit)) best = Math.min(best, hit.distanceTo(ray.origin));
  }
  return best;
}
