// Note input from any Web MIDI keyboard, with computer keys as a fallback.
// Everything downstream receives (midiNumber, timestampMs) and doesn't care about the source.
const listeners = [], offListeners = [], pedalListeners = [];
export const onNote = (fn) => listeners.push(fn);
export const onNoteOff = (fn) => offListeners.push(fn);
export const onPedal = (fn) => pedalListeners.push(fn);
const emit = (m, ts) => listeners.forEach((fn) => fn(m, ts));
const emitOff = (m, ts) => offListeners.forEach((fn) => fn(m, ts));
const emitPedal = (down, ts) => pedalListeners.forEach((fn) => fn(down, ts));

// Outputs: the app can play notes on the keyboard itself (see sound.js).
let outputs = [];
export const midiOutputs = () => outputs;
const outputListeners = [];
export const onOutputsChange = (fn) => outputListeners.push(fn);

// Some keyboards echo notes they receive back to the computer. Ignore an incoming
// note that matches one we sent within the last moment, so playback isn't graded.
const sentAt = new Map();
export const markSent = (m, t) => sentAt.set(m, t);
const isEcho = (m, ts) => sentAt.has(m) && Math.abs(ts - sentAt.get(m)) < 80;

export async function initMIDI(setStatus) {
  if (!navigator.requestMIDIAccess) {
    setStatus("off", "This browser has no MIDI support. Use Chrome, Edge or Firefox. Computer keys still work.");
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    const bind = () => {
      const names = [];
      access.inputs.forEach((inp) => {
        inp.onmidimessage = (e) => {
          const [status, note, vel] = e.data, type = status & 0xf0, ts = e.timeStamp || performance.now();
          if ((type === 0x90 || type === 0x80) && isEcho(note, ts)) return;
          if (type === 0x90 && vel > 0) emit(note, ts);
          else if (type === 0x80 || (type === 0x90 && vel === 0)) emitOff(note, ts);
          else if (type === 0xb0 && note === 64) emitPedal(vel >= 64, ts); // sustain pedal
        };
        names.push(inp.name);
      });
      outputs = [...access.outputs.values()];
      outputListeners.forEach((fn) => fn(outputs));
      setStatus(names.length ? "on" : "off",
        names.length ? names.join(", ") : "No keyboard found. Check the USB cable. Computer keys work meanwhile.");
    };
    bind();
    access.onstatechange = bind;
  } catch (e) {
    setStatus("off", "MIDI access was blocked. Allow it in the browser's site settings.");
  }
}

// A–; = white keys from middle C, W E T Y U O P = black keys, Z / X = octave down / up.
const KEYMAP = { KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7, KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14, KeyP: 15, Semicolon: 16, Quote: 17 };
let octave = 0;
const down = new Map(); // key code -> MIDI note, so release matches the press after an octave shift

// Returns true if the key event was consumed as a note.
export function handleComputerKey(e) {
  if (e.code === "KeyZ") { octave = Math.max(-2, octave - 1); return true; }
  if (e.code === "KeyX") { octave = Math.min(2, octave + 1); return true; }
  if (e.code in KEYMAP) {
    e.preventDefault();
    const m = 60 + 12 * octave + KEYMAP[e.code];
    down.set(e.code, m);
    emit(m, performance.now());
    return true;
  }
  return false;
}

export function handleComputerKeyUp(e) {
  if (!down.has(e.code)) return;
  emitOff(down.get(e.code), performance.now());
  down.delete(e.code);
}

// Release every computer key, e.g. when the window loses focus mid-press.
export function releaseAllComputerKeys() {
  for (const m of down.values()) emitOff(m, performance.now());
  down.clear();
}
