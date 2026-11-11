// Arpeggios: which notes, in what order, with which fingers. Pure functions, no DOM.
import { makeChord, spellLetter, pcOf, spName, octaveOf } from "./theory.js";

const mod = (n, m) => ((n % m) + m) % m;

export const ARP_TYPES = [
  { id: "maj", name: "major", group: "Triads" },
  { id: "min", name: "minor", group: "Triads" },
  { id: "dim", name: "diminished", group: "Triads" },
  { id: "aug", name: "augmented", group: "Triads" },
  { id: "maj7", name: "major 7th", group: "Sevenths" },
  { id: "7", name: "dominant 7th", group: "Sevenths" },
  { id: "m7", name: "minor 7th", group: "Sevenths" },
  { id: "m7b5", name: "half-diminished", group: "Sevenths" },
  { id: "dim7", name: "diminished 7th", group: "Sevenths" },
];
export const typeName = (id) => ARP_TYPES.find((t) => t.id === id).name;

// Root spellings musicians normally use for each family (C♯ minor, not D♭ minor).
const MAJOR_ROOTS = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
const MINOR_ROOTS = [[0, 0], [0, 1], [1, 0], [2, -1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [6, -1], [6, 0]];
const DIM_ROOTS = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const MAJORISH = new Set(["maj", "aug", "maj7", "7"]);

// pc 0–11 -> spelled root for this type
export function rootFor(pc, tid) {
  const table = MAJORISH.has(tid) ? MAJOR_ROOTS : tid === "min" || tid === "m7" ? MINOR_ROOTS : DIM_ROOTS;
  const [l, a] = table[mod(pc, 12)];
  return { l, a };
}
export const arpName = (pc, tid) => `${spName(rootFor(pc, tid))} ${typeName(tid)}`;

// Circle-of-fifths order of roots (C, G, D, … , F) for "all 12 keys".
export const CIRCLE_PCS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (m) => BLACK.has(mod(m, 12));

// The notes of one hand. opts: { octaves 1–4, inversion 0–3, dir "up"|"updown", hand "rh"|"lh" }
// Returns [{ m, sp, oct }]: MIDI number plus spelling for notation.
export function handNotes(pc, tid, { octaves = 2, inversion = 0, dir = "updown", hand = "rh" } = {}) {
  const ch = makeChord(rootFor(pc, tid), tid);
  const tones = ch.tones;                      // spelled, root position
  const n = tones.length, inv = Math.min(inversion, n - 1);
  const order = [...tones.slice(inv), ...tones.slice(0, inv)];
  // Start: right hand from middle C upward; left hand an octave lower.
  const startPc = pcOf(order[0]);
  let start = (hand === "rh" ? 60 : 48) + mod(startPc - 0, 12);
  if (hand === "lh" && octaves >= 3) start -= 12;
  if (hand === "rh" && start + 12 * octaves > 108) start -= 12;
  const up = [];
  let m = start;
  for (let i = 0; i <= n * octaves; i++) {
    const sp = order[i % n];
    if (i > 0) { m++; while (mod(m, 12) !== pcOf(sp)) m++; }
    up.push({ m, sp, oct: octaveOf(m, sp) });
  }
  const seq = dir === "updown" ? [...up, ...up.slice(0, -1).reverse()] : up;
  return seq;
}

// Suggested fingering (1 = thumb … 5 = little finger), following the usual teaching rules:
// the thumb goes on a white key, groups of 3 (triads) or 4 (sevenths) fingers repeat each
// octave, a wider gap (a 4th) takes finger 4 in the right hand or 3 in the left, and the
// outermost note takes 5. Teachers vary; this is a sound default, not the only answer.
export function fingering(notes, hand, groupSize) {
  const asc = [];
  const top = notes.findIndex((x, i) => i > 0 && x.m < notes[i - 1].m);
  const upLen = top < 0 ? notes.length : top;
  const up = notes.slice(0, upLen);
  const cycle = up.slice(0, groupSize).map((x) => mod(x.m, 12));
  const allBlack = cycle.every((p) => BLACK.has(p));
  const gap = (a, b) => mod(b - a, 12);

  if (hand === "rh") {
    // Thumb on the first white note at or after the start (or the root if all are black).
    let t = allBlack ? 0 : cycle.findIndex((p) => !BLACK.has(p));
    const fingersFrom = []; // finger for cycle position (t, t+1, ...)
    for (let k = 0; k < groupSize; k++) {
      if (k === 0) fingersFrom.push(1);
      // root-position shapes (all 3rds) use 1-2-3; any 4th in the hand shape needs 1-2-4
      else if (groupSize === 3 && k === 2) fingersFrom.push(gap(cycle[t], cycle[(t + 1) % 3]) >= 5 || gap(cycle[(t + 1) % 3], cycle[(t + 2) % 3]) >= 5 ? 4 : 3);
      else fingersFrom.push(k + 1);
    }
    up.forEach((x, i) => {
      const pos = mod(i - t, groupSize);
      let f = fingersFrom[pos];
      if (i < t) f = i === t - 1 ? 2 : 3; // notes before the first thumb
      if (i === up.length - 1 && f === 1 && i > 0) f = 5;
      asc.push(f);
    });
  } else {
    // Left hand going up ends each group on the thumb: thumb on the last white note of the cycle
    // counting back from the start (the start itself when it's white).
    const startWhite = !BLACK.has(cycle[0]);
    let t = allBlack ? 0 : startWhite ? 0 : groupSize - 1 - [...cycle].reverse().findIndex((p) => !BLACK.has(p));
    // finger crossing over the thumb: 3 when it has to reach a 4th, otherwise 4
    const group = groupSize === 3 ? [gap(cycle[t], cycle[(t + 1) % 3]) >= 5 ? 3 : 4, 2, 1] : [4, 3, 2, 1];
    up.forEach((x, i) => {
      // position within the group that ends on a thumb at cycle index t
      const pos = mod(i - (t + 1), groupSize);
      let f = group[pos];
      if (i === 0 && startWhite) f = 5;
      if (i === up.length - 1 && f !== 1 && !BLACK.has(mod(x.m, 12))) f = 1;
      asc.push(f);
    });
  }
  // Coming down uses the same fingers on the same notes.
  const down = notes.slice(upLen).map((_, j) => asc[upLen - 2 - j]);
  return [...asc, ...down];
}

// Full exercise: notes per hand, fingering, and the step list for grading.
export function exercise(pc, tid, opts = {}) {
  const { hands = "rh" } = opts;
  const groupSize = ["maj", "min", "dim", "aug"].includes(tid) ? 3 : 4;
  const want = hands === "both" ? ["lh", "rh"] : [hands];
  const parts = {};
  for (const h of want) {
    let notes = handNotes(pc, tid, { ...opts, hand: h === "lh" && hands === "both" ? "rh" : h });
    // Hands together: the left hand plays the same notes two octaves lower.
    if (h === "lh" && hands === "both") notes = notes.map((n) => ({ ...n, m: n.m - 24, oct: n.oct - 2 }));
    parts[h] = { notes, fingers: fingering(notes, h, groupSize) };
  }
  const len = parts[want[0]].notes.length;
  const steps = [...Array(len)].map((_, i) => want.map((h) => parts[h].notes[i].m));
  return { pc, tid, name: arpName(pc, tid), groupSize, parts, steps, opts: { ...opts } };
}

// Default subdivision: 3 notes per beat for triads, 4 for sevenths.
export const defaultPerBeat = (tid) => (["maj", "min", "dim", "aug"].includes(tid) ? 3 : 4);

// Evenness: spread of timing errors in milliseconds (lower is more even).
export function evenness(dts) {
  if (dts.length < 2) return null;
  const mean = dts.reduce((a, b) => a + b, 0) / dts.length;
  return Math.sqrt(dts.reduce((a, b) => a + (b - mean) ** 2, 0) / dts.length);
}
