// Headless Chromium never grants pointer lock, so the game can't leave the
// title screen. Emulate the API the way a real browser behaves: lock on
// request, unlock on exit or Esc, fire pointerlockchange each time.
// Not emulated: Chrome refusing a re-lock right after Esc (main.ts ignores it).
(() => {
  let locked = null;
  Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => locked });
  const change = el => { locked = el; queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange'))); };
  Element.prototype.requestPointerLock = function () { change(this); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { if (locked) change(null); };
  addEventListener('keydown', e => { if (e.code === 'Escape') document.exitPointerLock(); }, true);
})();
