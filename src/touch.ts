import { player, game } from './player';
import { stickVector, sprinting } from './hud';

export const input = { touch: false, forward: 0, side: 0, fire: false, jump: false };
export const hasFocus = () => game.state === 'play' && (input.touch || !!document.pointerLockElement);
const STICK_R = 50; // px of thumb travel for full deflection
const pointers = new Map<number, { kind: string; el: Element; x: number; y: number; ox: number; oy: number }>();
const TAP_SLOP = 12; // px a weapon-chip touch may move and still count as a tap
let stick: HTMLElement, knob: HTMLElement, travel = STICK_R;

function resetStick() {
  stick.className = '';
  stick.style.left = stick.style.top = knob.style.transform = '';
}

export function clearTouch() {
  for (const p of pointers.values()) p.el.classList.remove('down');
  pointers.clear();
  input.forward = input.side = 0;
  input.fire = input.jump = false;
  if (stick) resetStick();
}

export function initTouch(pause: () => void, changed: () => void, reload: () => void, weapon: () => void) {
  document.getElementById('pause')!.addEventListener('click', e => { e.stopPropagation(); pause(); });
  stick = document.getElementById('stick')!;
  knob = stick.firstElementChild as HTMLElement;
  const enable = () => {
    if (input.touch) return;
    input.touch = true;
    document.body.classList.add('touch');
    changed();
  };
  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener('touchstart', enable, { passive: true });
  addEventListener('contextmenu', e => { if (input.touch) e.preventDefault(); });
  // iOS Safari ignores user-scalable=no: block double-tap and pinch zoom.
  let lastTap = 0;
  addEventListener('touchend', e => {
    if (e.timeStamp - lastTap < 300) e.preventDefault();
    lastTap = e.timeStamp;
  }, { passive: false });
  addEventListener('dblclick', e => e.preventDefault());
  addEventListener('gesturestart', e => e.preventDefault());
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    enable();
    if (!hasFocus()) return;
    const button = (e.target as Element).closest<HTMLElement>('[data-action]');
    const action = button?.dataset.action;
    if (action === 'pause') return;
    const kind = action ?? (e.clientX < innerWidth / 2 ? 'move' : 'look');
    if (kind === 'move' && [...pointers.values()].some(p => p.kind === 'move')) return;
    e.preventDefault();
    const el = button ?? (e.target as Element);
    el.setPointerCapture(e.pointerId);
    button?.classList.add('down');
    pointers.set(e.pointerId, { kind, el, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    if (kind === 'move') {
      stick.className = 'live';
      stick.style.left = e.clientX + 'px';
      stick.style.top = e.clientY + 'px';
      knob.style.transform = '';
      travel = Math.min(STICK_R, (stick.offsetWidth - knob.offsetWidth) / 2); // keep the knob inside the ring
    }
    if (kind === 'fire') input.fire = true;
    if (kind === 'jump') input.jump = true;
    if (kind === 'reload') reload();
  });
  addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p || !hasFocus()) return;
    if (p.kind === 'move') {
      const v = stickVector(e.clientX - p.ox, e.clientY - p.oy, STICK_R);
      input.side = v.side;
      input.forward = v.forward;
      knob.style.transform = `translate(${v.side * travel}px, ${-v.forward * travel}px)`;
      stick.classList.toggle('sprint', sprinting(v.forward));
    } else if (p.kind === 'weapon' && Math.hypot(e.clientX - p.ox, e.clientY - p.oy) > TAP_SLOP) {
      p.kind = 'look'; // a drag that starts on the chip is an aim, not a weapon swap
      p.el.classList.remove('down');
    }
    if (p.kind === 'look' || p.kind === 'fire') {
      player.yaw -= (e.clientX - p.x) * 0.005;
      player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - (e.clientY - p.y) * 0.005));
    }
    p.x = e.clientX;
    p.y = e.clientY;
  });
  const release = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (p && ![...pointers.values()].some(q => q.el === p.el)) p.el.classList.remove('down');
    if (p?.kind === 'weapon' && e.type !== 'pointercancel') weapon(); // swap on release, so drags can become aim
    if (p?.kind === 'move') { input.forward = input.side = 0; resetStick(); }
    input.fire = [...pointers.values()].some(p => p.kind === 'fire');
    input.jump = [...pointers.values()].some(p => p.kind === 'jump');
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('lostpointercapture', release);
}
