// Chord progressions: parsing, key-relative storage, transposition, grading, generation.
// Pure functions, no DOM.
//
// A stored chord is key-relative so a progression works in any key:
//   { r: semitones above the tonic, l: letter steps above the tonic, t: chord type id,
//     b?: { r, l } slash bass, beats, v?: recorded voicing as offsets from the key's reference pitch }
// A progression: { id, name, key: "0M", tempo, meter: 4|3, chords: [...], tags: [], notes,
//                  credit?: { name, platform, url }, origin: "local"|"repo"|"starter" }

import { makeKey, keyById, makeChord, spellLetter, pcOf, numeralFor, analyze, identify, detectKeys, diatonic, realize, suggestNext, typeById, isMinorish, voice } from "./theory.js";

const mod = (n, m) => ((n % m) + m) % m;
const NAT = [0, 2, 4, 5, 7, 9, 11];

// ---------- key-relative storage ----------
export const refPitch = (key) => { const r = 60 + key.tpc; return r > 66 ? r - 12 : r; };

export function toChord(c, key) {
  const root = spellLetter(key.tonic.l + c.l, key.tpc + c.r);
  const bass = c.b ? spellLetter(key.tonic.l + c.b.l, key.tpc + c.b.r) : null;
  const ch = makeChord(root, c.t, bass && (bass.l !== root.l || bass.a !== root.a) ? bass : null);
  ch.kind = "chord";
  return ch;
}

export function fromChord(ch, key, beats = 4, midis = null) {
  const c = { r: mod(ch.rpc - key.tpc, 12), l: mod(ch.root.l - key.tonic.l, 7), t: ch.tid, beats };
  if (ch.bass && (ch.bass.l !== ch.root.l || ch.bass.a !== ch.root.a)) c.b = { r: mod(pcOf(ch.bass) - key.tpc, 12), l: mod(ch.bass.l - key.tonic.l, 7) };
  if (midis && midis.length) c.v = [...midis].sort((a, b) => a - b).map((m) => m - refPitch(key));
  return c;
}

// Notes to play for a stored chord in a key: the recorded voicing (moved to the key),
// or a voice-led voicing from the previous chord.
export function voicingFor(c, key, prev = null) {
  if (c.v) return c.v.map((o) => o + refPitch(key));
  return voice(toChord(c, key), prev);
}

export function numeral(c, key) {
  const ch = toChord(c, key);
  const an = analyze(ch, key);
  let n = an && an.kind === "secondary" ? an.numeral : numeralFor(ch.root, ch.t.id, key);
  if (c.b) n += "/" + ch.sym.split("/")[1];
  return n;
}

// ---------- parsing ----------
const Q = {
  "": "maj", M: "maj", maj: "maj", m: "min", min: "min", "-": "min", mi: "min",
  "°": "dim", o: "dim", dim: "dim", "+": "aug", aug: "aug", "5": "5",
  "7": "7", dom7: "7", "9": "9", "13": "13", "11": "9sus4", "7b9": "7b9", "7(b9)": "7b9", "7#9": "7#9", "7(#9)": "7#9",
  maj7: "maj7", M7: "maj7", ma7: "maj7", "Δ": "maj7", "Δ7": "maj7", "^7": "maj7", maj9: "maj9", M9: "maj9", "Δ9": "maj9",
  "maj7#11": "maj7#11", "maj7(#11)": "maj7#11", "Δ#11": "maj7#11",
  m7: "m7", min7: "m7", "-7": "m7", mi7: "m7", m9: "m9", "-9": "m9", m11: "m11", "-11": "m11",
  m7b5: "m7b5", "m7(b5)": "m7b5", "ø": "m7b5", "ø7": "m7b5", "-7b5": "m7b5",
  dim7: "dim7", "°7": "dim7", o7: "dim7",
  mmaj7: "mmaj7", "m(maj7)": "mmaj7", mM7: "mmaj7", "-maj7": "mmaj7",
  "6": "6", m6: "m6", "-6": "m6", "6/9": "69", "69": "69",
  add9: "add9", add2: "add9", "2": "add9", madd9: "madd9", "m(add9)": "madd9", "m(add2)": "madd9",
  sus: "sus4", sus4: "sus4", sus2: "sus2", "7sus": "7sus4", "7sus4": "7sus4", "9sus": "9sus4", "9sus4": "9sus4",
};
const norm = (s) => s.replace(/♭/g, "b").replace(/♯/g, "#").replace(/\s+/g, "");
const LETTER = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const accOf = (s) => (s === "b" ? -1 : s === "#" ? 1 : s === "bb" ? -2 : s === "##" ? 2 : 0);

// A chord symbol like "Cmaj7", "F#m7b5", "Bb/D", "C6/9". Returns { root, tid, bass } or null.
export function parseSymbol(tok) {
  const s = norm(tok);
  const m = s.match(/^([A-G])(bb|##|b|#)?(.*?)(?:\/([A-G])(bb|##|b|#)?)?$/);
  if (!m) return null;
  const tid = Q[m[3]];
  if (!tid) return { error: `"${tok}": unknown chord type "${m[3]}"` };
  const l = LETTER[m[1]], root = { l, a: accOf(m[2]) };
  const bass = m[4] ? { l: LETTER[m[4]], a: accOf(m[5]) } : null;
  return { root, tid, bass };
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const ROMAN_RE = "(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)";

// A Roman numeral like "vi7", "bVII", "V7/vi", "iiø7", "IVmaj7", relative to `key`.
export function parseRoman(tok, key) {
  const s = norm(tok).replace(/^♭/, "b");
  const m = s.match(new RegExp(`^(b|#)?${ROMAN_RE}(.*?)(?:/(b|#)?${ROMAN_RE})?$`));
  if (!m) return null;
  const upper = m[2] === m[2].toUpperCase();
  let suf = m[3];
  const map = upper
    ? { "": "maj", "7": "7", maj7: "maj7", M7: "maj7", "Δ7": "maj7", "9": "9", maj9: "maj9", "13": "13", "6": "6", "6/9": "69", add9: "add9", "+": "aug", "°": "dim", o: "dim", "°7": "dim7", o7: "dim7", sus4: "sus4", sus2: "sus2", "7sus4": "7sus4", "11": "9sus4", "7b9": "7b9", "7#9": "7#9", "maj7#11": "maj7#11" }
    : { "": "min", "7": "m7", "9": "m9", "11": "m11", "6": "m6", add9: "madd9", maj7: "mmaj7", "°": "dim", o: "dim", "°7": "dim7", o7: "dim7", "ø": "m7b5", "ø7": "m7b5", m7b5: "m7b5", sus4: "sus4", sus2: "sus2" };
  const tid = map[suf];
  if (!tid) return { error: `"${tok}": unknown numeral suffix "${suf}"` };
  // Degree within a scale: the key itself, or the target chord for secondary numerals (V7/vi).
  const degree = (acc, rom, base, scale) => {
    const d = ROMAN.indexOf(rom.toUpperCase());
    return spellLetter(base.l + d, pcOf(base) + scale[d] + accOf(acc));
  };
  const keyScale = key.scale.map((sp) => mod(pcOf(sp) - key.tpc, 12));
  let root;
  if (m[5]) {
    const target = degree(m[4], m[5], key.tonic, keyScale);
    root = degree(m[1], m[2], target, NAT);
  } else root = degree(m[1], m[2], key.tonic, m[1] ? NAT : keyScale); // ♭VI, ♭VII: measured from the major scale
  return { root, tid, bass: null };
}

// Text to progression chords. Separate chords with spaces, commas, arrows or " - ";
// use "|" for bar lines (chords in one bar share its beats). "Am7:2" sets beats explicitly.
// key: a key object, or null to detect it from the chords (symbols only).
export function parseProgression(text, key, meter = 4) {
  const errors = [];
  const raw = text.replace(/[→,]/g, " ").replace(/\s[-–—]\s/g, " ").replace(/–/g, " ").trim();
  if (!raw) return { chords: [], key: key || makeKey(0, "major"), errors };
  const hasBars = raw.includes("|");
  const bars = hasBars ? raw.split("|").map((b) => b.trim()).filter(Boolean) : raw.split(/\s+/).map((t) => t);
  const items = [];
  for (const bar of bars) {
    const toks = hasBars ? bar.split(/\s+/).filter(Boolean) : [bar];
    const each = meter / toks.length;
    toks.forEach((tok) => {
      const [name, beatStr] = tok.split(":");
      const beats = beatStr ? Math.max(0.5, +beatStr || meter) : hasBars ? each : meter;
      items.push({ tok: name, beats });
    });
  }
  // Resolve symbols first (key-independent), then pick the key.
  const parsed = items.map((it) => {
    const sym = /^[A-G]/.test(it.tok) ? parseSymbol(it.tok) : null;
    return { ...it, sym };
  });
  let k = key;
  if (!k) {
    const events = parsed.filter((p) => p.sym && !p.sym.error).map((p) => ({ chord: makeChord(p.sym.root, p.sym.tid) }));
    k = events.length ? detectKeys(events)[0].key : makeKey(0, "major");
  }
  const chords = [];
  for (const p of parsed) {
    let r = p.sym || parseRoman(p.tok, k);
    if (!r) { errors.push(`"${p.tok}" isn't a chord symbol or Roman numeral`); continue; }
    if (r.error) { errors.push(r.error); continue; }
    const ch = makeChord(r.root, r.tid, r.bass);
    chords.push(fromChord(ch, k, p.beats));
  }
  return { chords, key: k, errors };
}

// Text form of a progression in a key, for editing ("Cmaj7 Am7 | Dm7 G7").
export function toText(chords, key, meter = 4) {
  const syms = chords.map((c) => toChord(c, key).sym);
  if (chords.every((c) => c.beats === meter)) return syms.join(" ");
  const bars = [];
  let bar = [], acc = 0;
  const flush = () => {
    if (!bar.length) return;
    const even = bar.every((x) => Math.abs(x.beats - meter / bar.length) < 1e-9);
    bars.push(bar.map((x) => (even ? x.sym : `${x.sym}:${x.beats}`)).join(" "));
    bar = []; acc = 0;
  };
  chords.forEach((c, i) => {
    if (c.beats >= meter) { flush(); bars.push(c.beats === meter ? syms[i] : `${syms[i]}:${c.beats}`); return; }
    if (acc + c.beats > meter + 1e-9) flush();
    bar.push({ sym: syms[i], beats: c.beats });
    acc += c.beats;
    if (acc >= meter - 1e-9) flush();
  });
  flush();
  return bars.join(" | ");
}

// ---------- transposition ----------
// Keys in circle-of-fifths order starting from `key`. Counter-clockwise (down a fifth) is the
// common practice order ("around the circle of fourths").
export function circleKeys(key, dir = -1) {
  return [...Array(12)].map((_, i) => makeKey(mod(key.ci + dir * i, 12), key.mode));
}

// ---------- grading ----------
// A played chord counts if it contains the chord's essential tones (root, 3rd or sus tone,
// 6th/7th) and nothing outside the chord except an added 9th. 5ths and extensions are optional.
export function matches(midis, c, key) {
  if (!midis.length) return false;
  const ch = toChord(c, key), t = ch.t;
  const played = new Set(midis.map((m) => mod(m, 12)));
  const all = new Set(t.iv.map((x) => mod(ch.rpc + x, 12)));
  const core = t.iv.filter((x) => x < 12 && (x !== 7 || t.id === "5")).map((x) => mod(ch.rpc + x, 12));
  if (!core.every((p) => played.has(p))) return false;
  const ninth = mod(ch.rpc + 2, 12);
  return [...played].every((p) => all.has(p) || p === ninth || (c.b && p === mod(key.tpc + c.b.r, 12)));
}

// ---------- generation ----------
export const MOODS = { bright: "Bright", dreamy: "Dreamy", soulful: "Soulful", melancholy: "Melancholy", tense: "Tense", epic: "Epic" };
export const STYLES = { pop: "Pop", jazz: "Jazz", neosoul: "Neo-soul / gospel", classical: "Classical", cinematic: "Cinematic", rock: "Rock" };

// Styles that use seventh chords start from each chord's in-key seventh quality (so V stays
// dominant), then extend it.
const SEVENTH_STYLES = { jazz: {}, neosoul: { maj7: "maj9", m7: "m9", 7: "13", dim7: "dim7", m7b5: "m7b5" } };

function pick(items, rand) {
  let t = 0;
  for (const i of items) t += i.w;
  let r = rand() * t;
  for (const i of items) { r -= i.w; if (r <= 0) return i; }
  return items[items.length - 1];
}

// Walk the same next-chord rules the Chords tab uses, then color the chords for the style.
export function generate({ key, style = "pop", mood = "bright", length = 4, rand = Math.random }) {
  const minorMood = mood === "melancholy" || mood === "epic" || mood === "tense";
  const k = minorMood && key.mode === "major" ? makeKey(key.ci, "minor") : !minorMood && key.mode === "minor" && mood !== "soulful" ? makeKey(key.ci, "major") : key;
  const tonic = diatonic(k)[0];
  const seq = [tonic];
  let cur = tonic;
  for (let i = 1; i < length; i++) {
    const last = i === length - 1;
    let opts = suggestNext(cur, analyze(cur, k), k).filter((s) => s.chord && !(s.chord.rpc === k.tpc && !last));
    if (style === "classical" || style === "jazz") opts = opts.filter((s) => !/Borrowed/.test(s.chord.func || ""));
    if (mood === "epic" || style === "cinematic") opts.forEach((s) => { if (/Borrowed|Subtonic/.test(s.chord.func || "") || s.chord.numeral === "VI" || s.chord.numeral === "VII") s.w *= 2; });
    if (mood === "tense") opts.forEach((s) => { if (/Dominant|Secondary/.test(s.chord.func || "")) s.w *= 1.8; });
    if (style === "classical" && i >= length - 2) {
      // Classical phrases end with an authentic cadence: dominant, then home.
      const dom = diatonic(k).find((c) => c.degree === 4);
      seq.push(i === length - 2 ? dom : tonic);
      cur = seq[seq.length - 1];
      continue;
    }
    if (last) {
      opts = opts.filter((s) => s.chord.rpc !== k.tpc);
      // End on a chord that leads back to the start so the progression loops.
      const back = opts.filter((s) => { const n = suggestNext(s.chord, analyze(s.chord, k), k); return n.some((x) => x.chord.rpc === k.tpc && x.w >= 0.75); });
      if (back.length) opts = back;
    }
    if (!opts.length) break;
    const nxt = pick(opts.map((s) => ({ ...s, w: Math.pow(s.w, 1.5) + 0.05 })), rand).chord;
    seq.push(nxt);
    cur = nxt;
  }
  const sevenths = diatonic(k, true);
  const chords = seq.map((ch, i) => {
    let tid = ch.tid;
    if (SEVENTH_STYLES[style]) {
      const d = sevenths.find((x) => x.rpc === ch.rpc && (x.tid === "m7b5" || x.tid === "dim7") === (ch.tid === "dim"));
      if (ch.tid === "7" || ch.func === "Secondary dominant") tid = "7";
      else if (d && (isMinorish(d.tid) === isMinorish(ch.tid) || ch.tid === "dim")) tid = d.tid;
      else tid = { maj: ch.func === "Borrowed" && ch.numeral === "♭VII" ? "7" : "maj7", min: "m7", dim: "m7b5" }[ch.tid] || ch.tid;
      tid = SEVENTH_STYLES[style][tid] || tid;
    }
    if (style === "cinematic" && tid === "maj") tid = "add9";
    if (style === "pop" && mood === "dreamy" && tid === "maj") tid = i % 2 ? "add9" : "maj7";
    if (style === "pop" && mood === "bright" && tid === "maj" && i === seq.length - 1 && rand() < 0.4) tid = "sus4";
    if (style === "classical" && ch.func === "Dominant" && ch.tid === "maj" && i === seq.length - 1) tid = "7";
    if (style === "neosoul" && ch.func === "Secondary dominant") tid = rand() < 0.5 ? "7#9" : "13";
    return fromChord(makeChord(ch.root, tid), k, 4);
  });
  return { key: k, chords };
}

// Several distinct ideas at once.
export function generateMany(opts, n = 3) {
  const out = [], seen = new Set();
  for (let tries = 0; out.length < n && tries < 40; tries++) {
    const g = generate(opts);
    const sig = g.chords.map((c) => `${c.r}${c.t}`).join(",");
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(g);
  }
  return out;
}

// From a list of played chords (MIDI note sets), e.g. the Chords tab history.
export function fromPlayed(midiSets, key = null) {
  const ids = midiSets.map((ms) => identify(ms, key || makeKey(0, "major"))).filter((c) => c && c.kind === "chord");
  const k = key || (ids.length ? detectKeys(ids.map((chord) => ({ chord })))[0].key : makeKey(0, "major"));
  return { key: k, chords: midiSets.map((ms) => { const ch = identify(ms, k); return ch && ch.kind === "chord" ? fromChord(ch, k, 4, ms) : null; }).filter(Boolean) };
}

export { keyById, typeById, isMinorish };
