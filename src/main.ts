import * as THREE from 'three';
import { scene, buildLevel, solids } from './level';
import { camera, player, game, keys, resetPlayer, updatePlayer } from './player';
import { zombies, spawnZombie, updateZombies, clearZombies, MAX_ZOMBIES } from './zombies';
import { weapons, ws, selectWeapon, startReload, updateWeapons, resetWeapons, gunScene, gunCam } from './weapons';
import { spawnPickup, updatePickups, clearPickups } from './pickups';
import { feel, updateFx } from './fx';
import { initAudio, sfx } from './audio';
import { input, initTouch, clearTouch } from './touch';
import { reloadState, dry, lowAmmo } from './hud';

const DEBUG = new URLSearchParams(location.search).has('debug');

const renderer = new THREE.WebGLRenderer();
renderer.autoClear = false;
const canvas = renderer.domElement;
document.body.prepend(canvas);

scene.add(camera);
buildLevel();

// --- halftone post-process: scene -> render target -> full-screen quad ---
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: rt.texture } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec3 c = pow(clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 1.0), vec3(0.4545)); // linear -> display
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / 7.0;    // 45-degree dot grid
      float d = length(fract(p) - 0.5);
      float r = 0.48 * (1.0 - l);                                                // darker tone, bigger dot
      c *= 1.0 - 0.3 * (1.0 - smoothstep(r - 0.12, r, d));
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
}));
quad.frustumCulled = false;
const postScene = new THREE.Scene();
postScene.add(quad);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function resize() {
  // Cap rows regardless of display density, with a lower budget on phones.
  const pr = Math.min(devicePixelRatio, (input.touch ? 720 : 1080) / innerHeight);
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  rt.setSize(Math.round(innerWidth * pr), Math.round(innerHeight * pr));
  camera.aspect = gunCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  gunCam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// --- HUD and screens ---
const $ = (id: string) => document.getElementById(id)!;
const overlay = $('overlay'), title = $('title'), body = $('body'), dbg = $('debug');
const waveEl = $('wave'), killsEl = $('kills'), hpEl = $('hp'), hpBar = $('hp-bar');
const weaponEl = $('weapon'), ammoEl = $('ammo'), hurtEl = $('hurt'), bannerEl = $('banner');
const gunEl = $('p-gun'), hpPanel = $('p-hp'), fireBtn = $('fire'), reloadBtn = $('reload'), ring = reloadBtn.querySelector('circle')!;
dbg.hidden = !DEBUG;
if (DEBUG) (window as unknown as { dbg: object }).dbg = { player, game, zombies, weapons, ws, solids, camera };

const shown = new Map<HTMLElement, string>();
function put(el: HTMLElement, text: string) {
  if (shown.get(el) !== text) { shown.set(el, text); el.textContent = text; }
}

// HUD classes and styles are written only when they change.
let reloadS = '', ringOff = '', hpScale = '';
function updateHud(w: (typeof weapons)[number]) {
  const rs = reloadState(w, ws.reloadT);
  if (rs !== reloadS) {
    if (reloadS) reloadBtn.classList.remove(reloadS);
    if (rs) reloadBtn.classList.add(rs);
    reloadS = rs;
  }
  if (rs === 'busy') {
    const off = (100 * ws.reloadT / w.reload).toFixed(0); // ring fills as the reload completes
    if (off !== ringOff) { ringOff = off; ring.style.strokeDashoffset = off; }
  }
  fireBtn.classList.toggle('off', dry(w));
  gunEl.classList.toggle('low', lowAmmo(w));
  hpPanel.classList.toggle('low', player.hp <= 30);
  const sx = `scaleX(${player.hp / 100})`;
  if (sx !== hpScale) { hpScale = sx; hpBar.style.transform = sx; }
}

function banner(text: string) {
  bannerEl.textContent = text;
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth; // restart the CSS animation
  bannerEl.classList.add('show');
}

const CONTROLS = 'WASD move · SHIFT sprint · SPACE jump<br>MOUSE shoot · R reload · 1–5 weapons · ESC pause';
function showScreen() {
  const s = game.state;
  const controls = input.touch ? 'LEFT THUMB move · push up to sprint<br>RIGHT THUMB aim · drag on FIRE to aim while shooting<br>TAP the weapon to switch' : CONTROLS;
  const verb = input.touch ? 'TAP' : 'CLICK';
  document.body.classList.toggle('playing', s === 'play');
  overlay.style.display = s === 'play' ? 'none' : 'flex';
  if (s === 'start') { title.innerHTML = 'PASAR MALAM<br>ZOMBI!'; body.innerHTML = `${controls}<br>${verb} TO START`; }
  if (s === 'pause') { title.innerHTML = 'PAUSED'; body.innerHTML = `${controls}<br>${verb} TO RESUME`; }
  if (s === 'over') {
    title.innerHTML = 'GAME OVER!';
    body.innerHTML = `WAVES SURVIVED: ${Math.max(0, game.wave - 1)}<br>KILLS: ${game.kills}<br>${verb} TO PLAY AGAIN`;
  }
}

// --- waves ---
let toSpawn = 0, spawnT = 0, breakT = 0;

function newGame() {
  resetPlayer();
  resetWeapons();
  clearZombies();
  clearPickups();
  game.wave = 0;
  game.kills = 0;
  feel.stop = feel.shake = 0;
  toSpawn = 0;
  breakT = 2;
}

function updateWaves(dt: number) {
  if (breakT > 0) {
    breakT -= dt;
    if (breakT <= 0) {
      game.wave++;
      toSpawn = 4 + game.wave * 3;                                    // wave size
      spawnT = 0;
      banner(`WAVE ${game.wave}!`);
      sfx.wave();
    }
  } else if (toSpawn > 0) {
    spawnT -= dt;
    if (spawnT <= 0 && zombies.length < MAX_ZOMBIES) {
      spawnZombie(
        Math.random() < Math.min(0.6, (game.wave - 1) * 0.1),         // runner share
        1 + (game.wave - 1) * 0.07,                                   // speed multiplier
      );
      toSpawn--;
      spawnT = Math.max(0.4, 1.6 - game.wave * 0.15);                 // spawn interval
    }
  } else if (zombies.length === 0) {
    breakT = 8;
    banner('WAVE CLEARED!');
    spawnPickup('health');
    spawnPickup('ammo');
  }
}

// --- start and pause ---
let clickGuard = 0;
overlay.addEventListener('click', () => {
  if (performance.now() < clickGuard) return;
  initAudio();
  if (input.touch) {
    if (game.state !== 'pause') newGame();
    game.state = 'play';
    showScreen();
    return;
  }
  // Chrome rejects the promise if you re-lock too soon after Esc; ignore that
  (canvas.requestPointerLock() as unknown as Promise<void> | undefined)?.catch(() => {});
});
function pause() {
  ws.firing = false;
  keys.clear();
  clearTouch();
  if (game.state === 'play') game.state = 'pause';
  if (document.pointerLockElement) document.exitPointerLock();
  showScreen();
}
initTouch(pause, () => { resize(); showScreen(); }, startReload, () => selectWeapon((ws.cur + 1) % weapons.length));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('blur', pause);
document.addEventListener('pointerlockchange', () => {
  if (input.touch) return;
  if (document.pointerLockElement) {
    if (game.state !== 'pause') newGame();
    game.state = 'play';
  } else {
    ws.firing = false;
    keys.clear();
    clearTouch();
    if (game.state === 'play') game.state = 'pause';
  }
  showScreen();
});

if (DEBUG) addEventListener('keydown', e => {
  if (e.code === 'Backquote') dbg.hidden = !dbg.hidden;
  if (e.code === 'KeyZ') for (let i = 0; i < 30; i++) spawnZombie(i % 3 === 0); // fills to the cap of 30
});

resetPlayer();
updatePlayer(0);
showScreen();

let last = performance.now(), frames = 0, fpsT = 0, fps = 0;

function frame(now: number) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  const dt = Math.min(raw, 0.05);

  if (game.state === 'play') {
    if (feel.stop > 0) {
      feel.stop -= raw; // hit stop: hold the world on the impact frame
    } else {
      updatePlayer(dt);
      updateWeapons(dt);
      updateZombies(dt);
      updatePickups(dt);
      updateWaves(dt);
      updateFx(dt); // last: applies shake on top of the camera pose
      if (player.hp <= 0) {
        game.state = 'over';
        clickGuard = performance.now() + 800; // don't restart on a panicked click
        sfx.over();
        ws.firing = false;
        clearTouch();
        document.exitPointerLock();
        showScreen();
      }
    }
  }

  const w = weapons[ws.cur];
  put(waveEl, String(game.wave));
  put(killsEl, String(game.kills));
  put(hpEl, String(player.hp));
  put(weaponEl, w.name);
  put(ammoEl, ws.reloadT > 0 ? 'RELOADING…' : `${w.mag} / ${Number.isFinite(w.reserve) ? w.reserve : '∞'}`);
  updateHud(w);
  const hurtO = (player.hurtT / 0.3).toFixed(2);
  if (hurtEl.style.opacity !== hurtO) hurtEl.style.opacity = hurtO;

  if (DEBUG) {
    frames++;
    fpsT += raw;
    if (fpsT >= 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
    const p = player.pos;
    put(dbg,
      `fps ${fps} | zombies ${zombies.length} | wave ${game.wave} | ` +
      `pos ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} | last shot ${game.lastShot}`);
  }

  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(gunScene, gunCam);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}
requestAnimationFrame(frame);
