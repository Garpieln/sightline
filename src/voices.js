// Keyboard voices: choose which of the keyboard's own sounds your keys play, with
// layers (two voices per zone) and splits (up to three zones).
//
// Single voice: a program change on the keyboard's channel; the keyboard plays as normal.
// Layers/splits: Local Control goes off and Sightline routes each key to one MIDI channel
// per (zone, layer), each set to its own voice. The sound still comes from the keyboard.
//
// Channels (0-based): keys arrive on 0. Zones/layers use 1–6. App playback uses 15.
import { CFG, saveCfg } from "./state.js";
import { midiOutputs, onRaw, sysexOutput } from "./input.js";

export const PLAYBACK_CH = 15;
const ZONE_CH0 = 1;

// Voice ids shared by every profile, so presets work on any keyboard.
export const VOICES = [
  { id: "grand", family: "Piano" }, { id: "grand2", family: "Piano" },
  { id: "ep1", family: "Electric piano" }, { id: "ep2", family: "Electric piano" }, { id: "ep3", family: "Electric piano" }, { id: "ep4", family: "Electric piano" },
  { id: "jazzorgan", family: "Organ" }, { id: "rockorgan", family: "Organ" }, { id: "pipeorgan", family: "Organ" },
  { id: "vibes", family: "Other" }, { id: "harpsi", family: "Other" }, { id: "strings", family: "Other" },
  { id: "woodbass", family: "Bass" }, { id: "ebass", family: "Bass" },
];

// [bank MSB, bank LSB, program (0-based), name]
export const PROFILES = {
  p105: {
    label: "Yamaha P-105",
    v: {
      grand: [0, 122, 0, "Grand Piano 1"], grand2: [0, 112, 0, "Grand Piano 2"],
      ep1: [0, 122, 5, "E. Piano 1"], ep2: [0, 123, 5, "E. Piano 2"], ep3: [0, 122, 4, "E. Piano 3"], ep4: [0, 123, 4, "E. Piano 4"],
      jazzorgan: [0, 122, 16, "Jazz Organ"], rockorgan: [0, 122, 18, "Rock Organ"], pipeorgan: [0, 123, 19, "Pipe Organ"],
      vibes: [0, 122, 11, "Vibraphone"], harpsi: [0, 122, 6, "Harpsichord"], strings: [0, 122, 48, "Strings"],
      woodbass: [0, 122, 32, "Wood Bass"], ebass: [0, 122, 33, "E. Bass"],
    },
    effects: true,
  },
  gm: {
    label: "General MIDI",
    v: {
      grand: [0, 0, 0, "Acoustic Grand Piano"], grand2: [0, 0, 1, "Bright Piano"],
      ep1: [0, 0, 4, "Electric Piano 1"], ep2: [0, 0, 5, "Electric Piano 2"], ep3: [0, 0, 4, "Electric Piano 1"], ep4: [0, 0, 5, "Electric Piano 2"],
      jazzorgan: [0, 0, 16, "Drawbar Organ"], rockorgan: [0, 0, 18, "Rock Organ"], pipeorgan: [0, 0, 19, "Church Organ"],
      vibes: [0, 0, 11, "Vibraphone"], harpsi: [0, 0, 6, "Harpsichord"], strings: [0, 0, 48, "String Ensemble"],
      woodbass: [0, 0, 32, "Acoustic Bass"], ebass: [0, 0, 33, "Finger Bass"],
    },
    effects: false,
  },
};

// XG effect types (Yamaha). [MSB, LSB]
export const REVERBS = { off: [0, 0, "Off"], room: [2, 16, "Room"], hall1: [1, 16, "Hall 1"], hall2: [1, 17, "Hall 2"], stage: [3, 16, "Stage"] };
export const EFFECTS = { off: [0, 0, "Off"], chorus: [65, 8, "Chorus"], phaser: [72, 17, "Phaser"], tremolo: [119, 0, "Tremolo"], rotary: [66, 18, "Rotary speaker"] };

const Z = (lo, hi, ...layers) => ({ lo, hi, layers: layers.map(([v, oct = 0, vol = 100]) => ({ v, oct, vol })) });
export const PRESETS = [
  { id: "concert", name: "Concert Grand", zones: [Z(21, 108, ["grand"])], reverb: "hall2", rdepth: 50, effect: "off", edepth: 0 },
  { id: "pop", name: "Pop Grand", zones: [Z(21, 108, ["grand2"])], reverb: "room", rdepth: 35, effect: "off", edepth: 0 },
  { id: "ballad", name: "Ballad Layer", zones: [Z(21, 108, ["grand"], ["strings", 0, 70])], reverb: "hall1", rdepth: 55, effect: "off", edepth: 0 },
  { id: "jazz", name: "Jazz Trio", zones: [Z(21, 47, ["woodbass"]), Z(48, 108, ["grand"])], reverb: "room", rdepth: 30, effect: "off", edepth: 0 },
  { id: "rhodes", name: "'70s Rhodes", zones: [Z(21, 108, ["ep1"])], reverb: "room", rdepth: 30, effect: "phaser", edepth: 50 },
  { id: "church", name: "Church Organ", zones: [Z(21, 108, ["pipeorgan"])], reverb: "hall2", rdepth: 70, effect: "off", edepth: 0 },
  { id: "rock", name: "Rock Split", zones: [Z(21, 47, ["ebass"]), Z(48, 108, ["rockorgan"])], reverb: "stage", rdepth: 30, effect: "rotary", edepth: 60 },
  { id: "three", name: "Three Zones", zones: [Z(21, 47, ["ebass"]), Z(48, 83, ["ep1"], ["strings", 0, 60]), Z(84, 108, ["vibes"])], reverb: "hall1", rdepth: 40, effect: "chorus", edepth: 30 },
];

const clone = (o) => JSON.parse(JSON.stringify(o));
export const KV = () => CFG.kv;
export const saveKV = () => saveCfg();

// ---------- profile ----------
export function profileId() {
  if (CFG.kv.profile !== "auto") return CFG.kv.profile;
  const out = midiOutputs()[0];
  return out && /p-?105/i.test(out.name) ? "p105" : "gm";
}
export const profile = () => PROFILES[profileId()];
export const voiceName = (id) => (profile().v[id] || PROFILES.gm.v[id])[3];

// ---------- setup helpers ----------
export const isRouted = (kv = CFG.kv) => !(kv.zones.length === 1 && kv.zones[0].layers.length === 1 && kv.zones[0].layers[0].oct === 0);
export const mainVoice = (kv = CFG.kv) => (kv.zones.find((z) => z.lo <= 60 && z.hi >= 60) || kv.zones[0]).layers[0].v;
function channels(kv = CFG.kv) {
  const out = [];
  let ch = ZONE_CH0;
  kv.zones.forEach((z, zi) => z.layers.forEach((l, li) => out.push({ zi, li, ch: ch++, ...l })));
  return out;
}

export function loadPreset(p) {
  Object.assign(CFG.kv, clone({ zones: p.zones, reverb: p.reverb, rdepth: p.rdepth, effect: p.effect, edepth: p.edepth }), { preset: p.id, touched: true });
  saveKV();
  apply();
}
export function changed() { CFG.kv.preset = null; CFG.kv.touched = true; saveKV(); apply(); }

// ---------- sending ----------
const send = (data) => { const out = midiOutputs()[0]; if (out) out.send(data); };
const cc = (ch, n, v) => send([0xb0 | ch, n, v]);
function program(ch, id) {
  const [msb, lsb, pc] = profile().v[id] || PROFILES.gm.v[id];
  cc(ch, 0, msb); cc(ch, 32, lsb); send([0xc0 | ch, pc]);
}
const vol127 = (v) => Math.max(0, Math.min(127, Math.round(v * 1.27)));

function allOff() { for (const ch of [0, 1, 2, 3, 4, 5, 6, PLAYBACK_CH]) { cc(ch, 64, 0); cc(ch, 123, 0); } held.clear(); }

let lastSysex = "";
function sendEffects() {
  if (!profile().effects) return;
  const out = sysexOutput();
  if (!out) return;
  const [rm, rl] = REVERBS[CFG.kv.reverb], [em, el] = EFFECTS[CFG.kv.effect];
  const key = `${rm},${rl},${em},${el}`;
  if (key === lastSysex) return;
  lastSysex = key;
  out.send([0xf0, 0x43, 0x10, 0x4c, 0x02, 0x01, 0x00, rm, rl, 0xf7]);
  out.send([0xf0, 0x43, 0x10, 0x4c, 0x02, 0x01, 0x20, em, el, 0xf7]);
}

function setupChannel(ch, id, vol) {
  program(ch, id);
  cc(ch, 7, vol127(vol));
  cc(ch, 91, CFG.kv.reverb === "off" ? 0 : vol127(CFG.kv.rdepth));
  cc(ch, 93, CFG.kv.effect === "off" ? 0 : vol127(CFG.kv.edepth));
}

// Push the whole setup to the keyboard.
export function apply() {
  if (!midiOutputs().length) return;
  allOff();
  const kv = CFG.kv;
  if (isRouted(kv)) {
    cc(0, 122, 0); // Local Control off: Sightline plays the keys
    for (const c of channels(kv)) setupChannel(c.ch, c.v, c.vol);
  } else {
    cc(0, 122, 127); // Local Control on: keys play directly
    setupChannel(0, kv.zones[0].layers[0].v, kv.zones[0].layers[0].vol);
  }
  setupChannel(PLAYBACK_CH, mainVoice(kv), 100);
  sendEffects();
  routing = isRouted(kv);
}

// Put the keyboard back to normal: keys play directly, with the main voice.
export function restore() {
  if (!midiOutputs().length) return;
  allOff();
  cc(0, 122, 127);
  setupChannel(0, mainVoice(), 100);
  routing = false;
}

// Full reset for when something gets stuck.
export function resetKeyboard() {
  if (!midiOutputs().length) return;
  for (let ch = 0; ch < 16; ch++) { cc(ch, 123, 0); cc(ch, 121, 0); }
  held.clear();
  cc(0, 122, 127);
  program(0, "grand");
  routing = false;
}

// ---------- routing ----------
let routing = false;
const held = new Map(); // physical note -> [[ch, note], ...]
let bankMsb = 0, bankLsb = 0;
const listeners = [];
export const onVoicesChange = (fn) => listeners.push(fn);

function route(data) {
  const [status, a, b] = data, type = status & 0xf0;
  if ((type === 0x90 && b > 0)) {
    if (!routing) return;
    const outs = [];
    for (const c of channels()) {
      const z = CFG.kv.zones[c.zi];
      if (a < z.lo || a > z.hi) continue;
      const n = a + 12 * c.oct;
      if (n < 0 || n > 127) continue;
      send([0x90 | c.ch, n, b]);
      outs.push([c.ch, n]);
    }
    held.set(a, outs);
  } else if (type === 0x80 || type === 0x90) {
    const outs = held.get(a);
    if (outs) { outs.forEach(([ch, n]) => send([0x80 | ch, n, 0])); held.delete(a); }
  } else if (type === 0xb0) {
    if (a === 0) bankMsb = b;
    else if (a === 32) bankLsb = b;
    else if (routing && [1, 64, 66, 67].includes(a)) for (const c of channels()) cc(c.ch, a, b);
  } else if (type === 0xc0 && !routing) {
    // A voice button was pressed on the keyboard: show it in the app.
    const p = profile();
    const id = Object.keys(p.v).find((k) => p.v[k][0] === bankMsb && p.v[k][1] === bankLsb && p.v[k][2] === a)
      || Object.keys(p.v).find((k) => p.v[k][2] === a);
    if (id && CFG.kv.zones[0].layers[0].v !== id) {
      CFG.kv.zones[0].layers[0].v = id;
      CFG.kv.preset = null;
      saveKV();
      setupChannel(PLAYBACK_CH, id, 100);
      listeners.forEach((fn) => fn());
    }
  }
}

export function initVoices() {
  onRaw(route);
  // When the keyboard connects, send the saved setup if the user has made one.
  // Otherwise leave the keyboard's own panel choice alone and only set the playback channel.
  let connected = false;
  const onConnect = () => {
    const has = midiOutputs().length > 0;
    if (has && !connected) {
      if (CFG.kv.touched) apply();
      else setupChannel(PLAYBACK_CH, mainVoice(), 100);
    }
    connected = has;
    listeners.forEach((fn) => fn());
  };
  return onConnect;
}

// Restore normal keyboard behavior when the page closes mid-split.
addEventListener("pagehide", () => { if (routing) restore(); });

export const isRouting = () => routing;
export const ensureEffects = () => { lastSysex = ""; sendEffects(); };
