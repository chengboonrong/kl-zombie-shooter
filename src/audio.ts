let ctx: AudioContext | null = null;
let out: GainNode;
let noise: AudioBuffer;

// Must be called from a user gesture.
export function initAudio() {
  if (ctx) { void ctx.resume(); return; }
  ctx = new AudioContext();
  out = ctx.createGain();
  out.gain.value = 0.4;
  out.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(vol: number, t: number, dur: number) {
  const g = ctx!.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  g.connect(out);
  return g;
}

function hiss(vol: number, dur: number, cutoff: number, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  src.connect(f).connect(env(vol, t, dur));
  src.start(t);
  src.stop(t + dur);
}

function tone(type: OscillatorType, f0: number, f1: number, vol: number, dur: number, at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  o.connect(env(vol, t, dur));
  o.start(t);
  o.stop(t + dur);
}

export const sfx = {
  pistol: () => { hiss(0.7, 0.12, 2500); tone('square', 300, 60, 0.4, 0.1); },
  shotgun: () => { hiss(1, 0.4, 1200); tone('sawtooth', 140, 35, 0.7, 0.3); },
  empty: () => tone('square', 1200, 900, 0.15, 0.03),
  reload: () => { tone('square', 700, 500, 0.2, 0.04); tone('square', 900, 600, 0.2, 0.04, 0.25); },
  splat: () => { hiss(0.6, 0.25, 600); tone('sine', 200, 50, 0.4, 0.2); },
  hurt: () => tone('sawtooth', 260, 90, 0.5, 0.25),
  groan: () => tone('sawtooth', 70 + Math.random() * 40, 50, 0.12, 0.7),
  pickup: () => { tone('triangle', 520, 780, 0.3, 0.1); tone('triangle', 780, 1040, 0.3, 0.15, 0.1); },
  wave: () => { tone('square', 220, 220, 0.25, 0.15); tone('square', 330, 330, 0.25, 0.3, 0.18); },
  over: () => tone('sawtooth', 300, 40, 0.5, 1.2),
};
