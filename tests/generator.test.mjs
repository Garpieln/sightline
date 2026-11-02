// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { genExercise } from "../src/generator.js";
import { KEYS, letterOf, midiOf, midiName, rangeFor, stepOfMidi } from "../src/music.js";

test("key signatures produce correct pitches", () => {
  assert.equal(midiOf(0, "C"), 60);          // C4
  assert.equal(midiOf(3, "G"), 66);          // F#4 in G
  assert.equal(midiOf(6, "F"), 70);          // Bb4 in F
  assert.equal(midiOf(2, "Bb"), 63);         // Eb4 in Bb
  assert.equal(midiName(70, "Bb"), "B♭4");
  assert.equal(midiName(66, "G"), "F♯4");
  assert.equal(stepOfMidi(61, "C"), 0);      // C#4 drawn on C's line
});

test("exercises stay in range, fill every bar, and end on the tonic", () => {
  for (const key of Object.keys(KEYS))
    for (const range of ["five", "oct", "staff", "wide"])
      for (const rhythm of ["q", "mix"])
        for (const bars of ["4", "8", "16"])
          for (let t = 0; t < 40; t++) {
            const ex = genExercise({ key, range, rhythm, bars });
            const [lo, hi] = rangeFor(range, key);
            for (const n of ex.notes) {
              assert.ok(n.d >= lo && n.d <= hi, `${key}/${range}: step ${n.d} out of range`);
              assert.equal(n.midi, midiOf(n.d, key));
            }
            const last = ex.notes.at(-1);
            assert.equal(letterOf(last.d), KEYS[key].tonic, `${key}/${range}: doesn't end on tonic`);
            const beats = ex.notes.reduce((a, n) => Math.max(a, n.beat + n.dur), 0);
            assert.equal(beats, +bars * 4);
          }
});

test("weak notes are served more often", () => {
  const weak = midiOf(2, "C"); // E4
  const count = (miss) => {
    let c = 0;
    for (let i = 0; i < 300; i++) c += genExercise({ key: "C", range: "five", rhythm: "q", bars: "8" }, miss).notes.filter((n) => n.midi === weak).length;
    return c;
  };
  const base = count(() => 0.1);
  const boosted = count((m) => (m === weak ? 0.9 : 0.1));
  assert.ok(boosted > base * 1.2, `expected boost: base ${base}, boosted ${boosted}`);
});
