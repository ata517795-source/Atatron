/**
 * All sound effects are synthesized with WebAudio — no copyrighted audio assets.
 */
import { useGame } from '../store/gameStore';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!useGame.getState().soundOn) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  ac: AudioContext,
  {
    freq,
    to = freq,
    at = 0,
    dur = 0.15,
    type = 'sine' as OscillatorType,
    gain = 0.12,
  }: { freq: number; to?: number; at?: number; dur?: number; type?: OscillatorType; gain?: number },
) {
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(ac: AudioContext, { at = 0, dur = 0.2, gain = 0.15 } = {}) {
  const t = ac.currentTime + at;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g).connect(ac.destination);
  src.start(t);
}

export const sfx = {
  click() {
    const ac = audio();
    if (ac) tone(ac, { freq: 620, to: 780, dur: 0.06, type: 'triangle', gain: 0.07 });
  },
  whoosh() {
    const ac = audio();
    if (!ac) return;
    tone(ac, { freq: 180, to: 950, dur: 0.45, type: 'sawtooth', gain: 0.05 });
    noise(ac, { dur: 0.5, gain: 0.09 });
  },
  step() {
    const ac = audio();
    if (ac) noise(ac, { dur: 0.07, gain: 0.045 });
  },
  shutter() {
    const ac = audio();
    if (!ac) return;
    noise(ac, { dur: 0.05, gain: 0.2 });
    tone(ac, { freq: 1400, to: 900, at: 0.03, dur: 0.07, type: 'square', gain: 0.06 });
  },
  chime() {
    const ac = audio();
    if (!ac) return;
    tone(ac, { freq: 660, dur: 0.18, type: 'triangle' });
    tone(ac, { freq: 880, at: 0.12, dur: 0.22, type: 'triangle' });
  },
  fanfare() {
    const ac = audio();
    if (!ac) return;
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) =>
      tone(ac, { freq: f, at: i * 0.13, dur: 0.3, type: 'triangle', gain: 0.14 }),
    );
    noise(ac, { at: 0.9, dur: 0.6, gain: 0.05 });
  },
};
