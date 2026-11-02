// Exercise generator: musical melodies, not random notes.
// Rules: stay in key and range, mostly steps, recover after leaps, chord tones on
// downbeats, start and end on the tonic, and weight weak notes (missRate) higher.
import { KEYS, letterOf, midiOf, rangeFor } from "./music.js";

// Relative weight by interval size in steps (0 = repeat ... 7 = octave).
const INTERVAL_W = [0.07, 0.29, 0.12, 0.05, 0.045, 0.02, 0.012, 0.015];
const PATTERNS = [[1, 1, 1, 1], [1, 1, 1, 1], [2, 1, 1], [1, 1, 2], [2, 2], [1, 2, 1]];

export function pickWeighted(items, rand = Math.random) {
  let total = 0;
  for (const i of items) total += i.w;
  let r = rand() * total;
  for (const i of items) { r -= i.w; if (r <= 0) return i.v; }
  return items[items.length - 1].v;
}

export function genExercise(c, missRate = () => 0.3, rand = Math.random) {
  const k = c.key, t = KEYS[k].tonic, [lo, hi] = rangeFor(c.range, k), nb = +c.bars;
  const isTonic = (d) => letterOf(d) === t;
  const chordTone = (d) => [0, 2, 4].includes((letterOf(d) - t + 7) % 7);

  const bars = [];
  for (let i = 0; i < nb - 1; i++) bars.push(c.rhythm === "q" ? [1, 1, 1, 1] : PATTERNS[Math.floor(rand() * PATTERNS.length)]);
  bars.push(c.rhythm === "q" ? [1, 1, 2] : rand() < 0.5 ? [4] : [2, 2]);

  const notes = [];
  bars.forEach((b, bi) => {
    let beat = bi * 4;
    b.forEach((dur) => { notes.push({ beat, dur, bar: bi, down: beat % 4 === 0 }); beat += dur; });
  });

  const all = [];
  for (let d = lo; d <= hi; d++) all.push(d);
  const N = notes.length;
  let prev = null, lastInt = 0;

  for (let i = 0; i < N; i++) {
    let d;
    if (i === 0) {
      d = pickWeighted(all.map((x) => ({ v: x, w: (isTonic(x) ? 5 : chordTone(x) ? 2 : 0.15) * (1 + 2 * missRate(midiOf(x, k))) })), rand);
    } else if (i === N - 1) {
      const tonics = all.filter(isTonic);
      d = (tonics.length ? tonics : all.filter(chordTone)).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0];
    } else {
      d = pickWeighted(all.map((x) => {
        const iv = x - prev, a = Math.abs(iv);
        let w = INTERVAL_W[Math.min(a, 7)];
        if (a === 0 && i > 1 && notes[i - 2].d === prev) w = 0; // no triple repeats
        if (Math.abs(lastInt) >= 3 && a >= 1 && a <= 2 && Math.sign(iv) === -Math.sign(lastInt)) w *= 3; // leap recovery
        if (notes[i].down && chordTone(x)) w *= 1.6;
        if (i === N - 2 && !all.some((z) => isTonic(z) && Math.abs(z - x) <= 2)) w *= 0.3; // approach the final tonic
        w *= 1 + 2.2 * missRate(midiOf(x, k));
        return { v: x, w };
      }), rand);
    }
    if (prev !== null) lastInt = d - prev;
    prev = d;
    notes[i].d = d;
    notes[i].midi = midiOf(d, k);
  }
  return {
    key: k, range: c.range, rhythm: c.rhythm, bars: nb, notes, total: nb * 4,
    id: Math.floor(rand() * 36 ** 5).toString(36).toUpperCase().padStart(5, "0"),
  };
}
