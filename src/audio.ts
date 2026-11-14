let ctx: AudioContext | null = null;
let out: GainNode;
let noise: AudioBuffer;

// Must be called from a user gesture.
export function initAudio() {
  if (ctx) { void ctx.resume(); return; }
  ctx = new AudioContext();
  out = ctx.createGain();
  out.gain.value = 0.5;
  out.connect(ctx.createDynamicsCompressor()).connect(ctx.destination); // layers stack without clipping
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

function hiss(vol: number, dur: number, freq: number, type: BiquadFilterType = 'lowpass', at = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
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

// Impact sounds stack three layers: low = weight, mid = body, high = snap.
export const sfx = {
  pistol: () => {
    tone('sine', 160, 45, 0.9, 0.14);
    hiss(0.6, 0.11, 1400, 'bandpass');
    hiss(0.5, 0.035, 5000, 'highpass');
  },
  shotgun: () => {
    tone('sine', 95, 28, 1.2, 0.4);
    hiss(1, 0.32, 700);
    hiss(0.7, 0.07, 3500, 'highpass');
  },
  smg: () => {
    tone('sine', 180, 60, 0.6, 0.08);
    hiss(0.45, 0.07, 1800, 'bandpass');
    hiss(0.4, 0.025, 6000, 'highpass');
  },
  rifle: () => {
    tone('sine', 120, 30, 1.1, 0.35);
    hiss(0.8, 0.2, 1100, 'bandpass');
    hiss(0.9, 0.05, 6500, 'highpass');
  },
  mercun: () => {
    tone('sine', 150, 45, 0.9, 0.15);
    hiss(0.5, 0.12, 700, 'bandpass');
    hiss(0.3, 0.03, 3500, 'highpass');
    tone('sine', 70, 20, 1.3, 0.6, 0.04);
    hiss(1, 0.5, 900, 'lowpass', 0.04);
    hiss(0.9, 0.12, 5000, 'highpass', 0.04);
  },
  hit: () => {
    tone('sine', 130, 55, 0.6, 0.09);
    hiss(0.5, 0.08, 800, 'bandpass');
    tone('square', 2400, 1200, 0.12, 0.025);
  },
  splat: () => {
    tone('sine', 110, 32, 0.9, 0.28);
    hiss(0.7, 0.25, 500);
    hiss(0.4, 0.06, 3000, 'highpass');
  },
  hurt: () => { tone('sine', 90, 40, 0.8, 0.2); tone('sawtooth', 260, 90, 0.4, 0.25); },
  empty: () => tone('square', 1200, 900, 0.15, 0.03),
  reload: () => { tone('square', 700, 500, 0.2, 0.04); tone('square', 900, 600, 0.2, 0.04, 0.25); },
  groan: () => tone('sawtooth', 70 + Math.random() * 40, 50, 0.12, 0.7),
  pickup: () => { tone('triangle', 520, 780, 0.3, 0.1); tone('triangle', 780, 1040, 0.3, 0.15, 0.1); },
  wave: () => { tone('square', 220, 220, 0.25, 0.15); tone('square', 330, 330, 0.25, 0.3, 0.18); },
  over: () => tone('sawtooth', 300, 40, 0.5, 1.2),
};
