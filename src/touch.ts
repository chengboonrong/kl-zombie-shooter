import { player, game } from './player';

export const input = { touch: false, forward: 0, side: 0, fire: false, jump: false };
export const hasFocus = () => game.state === 'play' && (input.touch || !!document.pointerLockElement);
const pointers = new Map<number, { kind: string; x: number; y: number; ox: number; oy: number }>();
let stick: HTMLElement;

export function clearTouch() {
  pointers.clear();
  input.forward = input.side = 0;
  input.fire = input.jump = false;
  if (stick) stick.style.display = 'none';
}

export function initTouch(pause: () => void, changed: () => void, reload: () => void, weapon: () => void) {
  const controls = document.createElement('div');
  controls.id = 'touch-controls';
  controls.innerHTML = '<button id="pause" data-action="pause">PAUSE</button><div id="touch-buttons"><button data-action="weapon">GUN</button><button data-action="reload">RELOAD</button><button data-action="jump">JUMP</button><button id="fire" data-action="fire">FIRE</button></div><div id="stick"><div></div></div>';
  document.body.append(controls);
  controls.querySelector('#pause')!.addEventListener('click', e => { e.stopPropagation(); pause(); });
  stick = document.getElementById('stick')!;
  const enable = () => {
    if (input.touch) return;
    input.touch = true;
    document.body.classList.add('touch');
    changed();
  };
  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener('touchstart', enable, { passive: true });
  addEventListener('contextmenu', e => { if (input.touch) e.preventDefault(); });
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    enable();
    if (!hasFocus()) return;
    const el = e.target as HTMLElement;
    const action = el.closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action === 'pause') return;
    const kind = action ?? (e.clientX < innerWidth / 2 ? 'move' : 'look');
    if (kind === 'move' && [...pointers.values()].some(p => p.kind === 'move')) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { kind, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
    if (kind === 'move') {
      stick.style.display = 'block';
      stick.style.left = e.clientX + 'px';
      stick.style.top = e.clientY + 'px';
      stick.firstElementChild!.setAttribute('style', 'transform: translate(0, 0)');
    }
    if (kind === 'fire') input.fire = true;
    if (kind === 'jump') input.jump = true;
    if (kind === 'reload') reload();
    if (kind === 'weapon') weapon();
  });
  addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId);
    if (!p || !hasFocus()) return;
    if (p.kind === 'move') {
      const dx = e.clientX - p.ox, dy = e.clientY - p.oy, len = Math.max(50, Math.hypot(dx, dy));
      input.side = dx / len;
      input.forward = -dy / len;
      (stick.firstElementChild as HTMLElement).style.transform = `translate(${input.side * 50}px, ${-input.forward * 50}px)`;
    } else if (p.kind === 'look' || p.kind === 'fire') {
      player.yaw -= (e.clientX - p.x) * 0.005;
      player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - (e.clientY - p.y) * 0.005));
    }
    p.x = e.clientX;
    p.y = e.clientY;
  });
  const release = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (p?.kind === 'move') { input.forward = input.side = 0; stick.style.display = 'none'; }
    input.fire = [...pointers.values()].some(p => p.kind === 'fire');
    input.jump = [...pointers.values()].some(p => p.kind === 'jump');
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('lostpointercapture', release);
}
