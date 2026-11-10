// Progression library: starter set (built in), the repo library (content/progressions/
// library.json, maintained from videos you send), and your own (saved in this browser).
import { load, save } from "./storage.js";
import { makeKey } from "./theory.js";
import { parseProgression } from "./progmodel.js";

const C = makeKey(0, "major"), Am = makeKey(0, "minor");
const starter = (id, name, text, key, tags, notes = "", tempo = 80, meter = 4) => {
  const p = parseProgression(text, key, meter);
  return { id: "s-" + id, name, key: p.key.id, tempo, meter, chords: p.chords, tags, notes, origin: "starter" };
};

export const STARTER = [
  starter("axis", "Pop axis", "I V vi IV", C, ["pop"], "The most common progression in modern pop."),
  starter("axis-minor", "Axis from the minor", "vi IV I V", C, ["pop", "emotional"]),
  starter("fifties", "'50s progression", "I vi IV V", C, ["doo-wop", "ballad"]),
  starter("cadence", "Classic cadence", "I IV V I", C, ["folk", "classical"]),
  starter("251", "ii–V–I", "ii7 V7 Imaj7 Imaj7", C, ["jazz"], "The core move of jazz harmony. Practice it in all 12 keys.", 100),
  starter("circle", "Circle progression", "vi7 ii7 V7 Imaj7", C, ["jazz"], "Each root falls a fifth: one step counter-clockwise on the circle.", 100),
  starter("royal", "Royal road", "IVmaj7 V7 iii7 vi7", C, ["j-pop", "anime"], "", 90),
  starter("neosoul", "Neo-soul ii–V", "ii9 V13 Imaj9 vi9", C, ["neo-soul"], "Extended chords. Leave out the 5ths so the voicings stay compact.", 72),
  starter("gospel", "Gospel walk-down", "IVmaj7 iii7 ii7 Imaj7", C, ["gospel", "neo-soul"], "", 70),
  starter("pachelbel", "Pachelbel", "I V vi iii IV I IV V", C, ["classical", "wedding"]),
  starter("bittersweet", "Bittersweet plagal", "I IV iv I", C, ["ballad", "film"], "The borrowed minor iv adds a bittersweet turn."),
  starter("epic", "Epic cadence", "I bVI bVII I", C, ["film", "games"]),
  starter("andalusian", "Andalusian cadence", "i bVII bVI V", Am, ["flamenco", "rock"]),
  starter("minorpop", "Minor pop", "i VI III VII", Am, ["pop", "edm"]),
  starter("blues", "12-bar blues", "I7 | I7 | I7 | I7 | IV7 | IV7 | I7 | I7 | V7 | IV7 | I7 | V7", C, ["blues"], "One chord per bar. Swing the rhythm.", 96),
];

let repo = [];
let local = load("progs", []);
const listeners = [];
export const onLibraryChange = (fn) => listeners.push(fn);
const changed = () => { save("progs", local); listeners.forEach((fn) => fn()); };

export async function loadRepo() {
  try {
    const r = await fetch("content/progressions/library.json", { cache: "no-cache" });
    if (r.ok) {
      const data = await r.json();
      repo = (data.progressions || []).map((p) => ({ ...p, origin: "repo" }));
      listeners.forEach((fn) => fn());
    }
  } catch (e) { /* offline or missing: library still works with local and starter */ }
}

export const all = () => [...local.map((p) => ({ ...p, origin: "local" })), ...repo, ...STARTER];
export const byId = (id) => all().find((p) => p.id === id);
export const localList = () => local;

export function upsert(p) {
  const clean = JSON.parse(JSON.stringify({ ...p, origin: undefined }));
  const i = local.findIndex((x) => x.id === p.id);
  if (i >= 0) local[i] = clean; else local.unshift(clean);
  changed();
  return clean.id;
}
export function remove(id) { local = local.filter((p) => p.id !== id); changed(); }
export const newId = () => "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);

// Backups (Progress tab export/import)
export const exportLocal = () => local;
export function importLocal(list) {
  if (!Array.isArray(list)) return;
  const ids = new Set(local.map((p) => p.id));
  for (const p of list) if (p && p.id && Array.isArray(p.chords) && !ids.has(p.id)) local.push(p);
  changed();
}

export const tags = () => [...new Set(all().flatMap((p) => p.tags || []))].sort();
export const keyOf = (p) => p.key;
export { makeKey };
