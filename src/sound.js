// Note playback. Sends notes to a connected MIDI keyboard so it plays them on its own
// speakers; otherwise plays sampled piano in the browser (Salamander Grand Piano,
// CC BY 3.0, Alexander Holm), with a simple synth if the samples can't load.
import { audio, masterOut, setVolume } from "./audio.js";
import { CFG, saveCfg } from "./state.js";
import { midiOutputs } from "./input.js";
import { PLAYBACK_CH } from "./voices.js";

// ---------- settings ----------
export function applyVolume() { setVolume(CFG.muted ? 0 : CFG.vol); }
export function setSound(patch) { Object.assign(CFG, patch); saveCfg(); applyVolume(); }

export function route() {
  if (CFG.muted) return "off";
  const outs = midiOutputs();
  if (CFG.sound !== "browser" && outs.length) return "keyboard";
  return "browser";
}
export function outputLabel() {
  const r = route();
  if (r === "off") return "Muted";
  if (r === "keyboard") return `Playing through ${midiOutputs()[0].name}`;
  return CFG.sound === "keyboard" ? "No keyboard output found. Playing in the browser." : "Playing in the browser";
}

// ---------- browser piano ----------
const SAMPLES = [];
for (let m = 21; m <= 108; m += 3) SAMPLES.push(m); // A0, C1, D#1, F#1 ... C8
const fileOf = (m) => ["C", "", "", "Ds", "", "", "Fs", "", "", "A", "", ""][m % 12] + (Math.floor(m / 12) - 1);
const buffers = new Map();
let loading = null, failed = false;

function loadSamples() {
  if (loading) return loading;
  const ac = audio();
  if (!ac) return Promise.reject(new Error("no audio"));
  loading = Promise.all(SAMPLES.map(async (m) => {
    const r = await fetch(`audio/piano/${fileOf(m)}.mp3`);
    if (!r.ok) throw new Error(r.status);
    buffers.set(m, await ac.decodeAudioData(await r.arrayBuffer()));
  })).catch((e) => { failed = true; throw e; });
  return loading;
}
export const preload = () => loadSamples().catch(() => {});

const active = new Set();

function sampleVoice(m, t, dur, vel) {
  const ac = audio();
  let best = SAMPLES[0];
  for (const s of SAMPLES) if (Math.abs(s - m) < Math.abs(best - m)) best = s;
  const src = ac.createBufferSource(), g = ac.createGain();
  src.buffer = buffers.get(best);
  src.playbackRate.value = Math.pow(2, (m - best) / 12);
  const peak = 0.25 + 0.75 * vel;
  g.gain.setValueAtTime(peak, t);
  g.gain.setValueAtTime(peak, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.6);
  src.connect(g).connect(masterOut());
  src.start(t);
  src.stop(t + dur + 0.65);
  const v = { g, src };
  active.add(v);
  src.onended = () => active.delete(v);
}

function synthVoice(m, t, dur, vel) {
  const ac = audio(), f = 440 * Math.pow(2, (m - 69) / 12);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.18 * (0.4 + vel), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  g.connect(masterOut());
  for (const [type, mult, amp] of [["triangle", 1, 1], ["sine", 2, 0.25]]) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = type; o.frequency.value = f * mult; og.gain.value = amp;
    o.connect(og).connect(g);
    o.start(t); o.stop(t + dur + 0.55);
  }
  const v = { g, src: null };
  active.add(v);
  setTimeout(() => active.delete(v), (t - ac.currentTime + dur + 0.6) * 1000);
}

// ---------- keyboard output ----------
const sounding = new Set(); // notes we turned on at the keyboard, for stopAll

function midiVoice(m, atPerf, durMs, vel) {
  const out = midiOutputs()[0];
  const v = Math.max(20, Math.min(127, Math.round((0.3 + 0.7 * vel) * CFG.vol * 127)));
  out.send([0x90 | PLAYBACK_CH, m, v], atPerf);
  out.send([0x80 | PLAYBACK_CH, m, 0], atPerf + durMs);
  sounding.add(m);
  setTimeout(() => sounding.delete(m), atPerf + durMs - performance.now() + 50);
}

// ---------- public API ----------
// Play notes now (or after `delay` ms). gap > 0 spreads them low to high (broken chord).
// browser: true forces the browser piano, e.g. for pitches between keys (pure-ratio demos).
export async function playNotes(midis, { delay = 0, dur = 1.4, gap = 0, vel = 0.7, browser = false } = {}) {
  const r = browser && route() !== "off" ? "browser" : route();
  if (r === "off" || !midis.length) return;
  const notes = [...midis].sort((a, b) => a - b);
  if (r === "keyboard") {
    const t0 = performance.now() + delay + 5;
    notes.forEach((m, i) => midiVoice(m, t0 + i * gap, dur * 1000, vel));
    return;
  }
  const ac = audio();
  if (!ac) return;
  if (!failed && buffers.size < SAMPLES.length) { try { await loadSamples(); } catch (e) { /* fall back to synth */ } }
  const t0 = ac.currentTime + delay / 1000 + 0.01;
  const voice = buffers.size === SAMPLES.length ? sampleVoice : synthVoice;
  notes.forEach((m, i) => voice(m, t0 + (i * gap) / 1000, dur, vel));
}

// A click on a chord: together, or broken with Shift (swapped by the "broken" setting).
export function playChord(midis, e) {
  const broken = CFG.broken !== !!(e && e.shiftKey);
  return playNotes(midis, broken ? { gap: 140, dur: 1.6 } : { dur: 1.4 });
}

export const playMelodic = (midis, browser = false) => playNotes(midis, { gap: 480, dur: 0.6, browser });

let seqTimers = [];
// Play a list of steps in time. Each step: { midis, beats = 1, onStart() }.
export function playSequence(steps, { bpm = CFG.pbpm, gap = 0, legato = 0.95, onEnd, browser = false } = {}) {
  stopAll();
  const beatMs = 60000 / bpm;
  let t = 60;
  steps.forEach((s) => {
    const len = (s.beats || 1) * beatMs;
    seqTimers.push(setTimeout(() => {
      if (s.onStart) s.onStart();
      playNotes(s.midis, { dur: (len * legato) / 1000, gap, browser });
    }, t));
    t += len;
  });
  seqTimers.push(setTimeout(() => onEnd && onEnd(), t));
  return { stop: stopAll };
}

export function stopAll() {
  seqTimers.forEach(clearTimeout);
  seqTimers = [];
  const ac = audio();
  for (const v of active) {
    try { v.g.gain.cancelScheduledValues(ac.currentTime); v.g.gain.setTargetAtTime(0, ac.currentTime, 0.03); } catch (e) { /* already stopped */ }
  }
  const out = midiOutputs()[0];
  if (out) for (const m of sounding) out.send([0x80 | PLAYBACK_CH, m, 0]);
  sounding.clear();
}
