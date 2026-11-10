// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeKey, keyName } from "../src/theory.js";
import { parseProgression, parseSymbol, toChord, toText, numeral, matches, circleKeys, generate, generateMany, fromPlayed, voicingFor, fromChord } from "../src/progmodel.js";

const C = makeKey(0, "major"), D = makeKey(2, "major"), Am = makeKey(0, "minor");
const syms = (p, k) => p.chords.map((c) => toChord(c, k).sym);

test("parses chord symbols in many spellings", () => {
  const p = parseProgression("Cmaj7 Am7 Dm7 G7", C);
  assert.deepEqual(syms(p, C), ["Cmaj7", "Am7", "Dm7", "G7"]);
  assert.deepEqual(syms(parseProgression("CΔ7 A-7 D-7 G7", C), C), ["Cmaj7", "Am7", "Dm7", "G7"]);
  assert.deepEqual(syms(parseProgression("Bø7 E7b9 Am9 F#m7b5", Am), Am), ["Bm7♭5", "E7♭9", "Am9", "F♯m7♭5"]);
  assert.deepEqual(syms(parseProgression("C/E F6/9 G13 Dm11", C), C), ["C/E", "F6/9", "G13", "Dm11"]);
  assert.equal(parseSymbol("Cxyz").error.includes("unknown chord type"), true);
});

test("parses Roman numerals, including secondary and borrowed chords", () => {
  assert.deepEqual(syms(parseProgression("I V vi IV", D), D), ["D", "A", "Bm", "G"]);
  assert.deepEqual(syms(parseProgression("ii7 V7 Imaj7", C), C), ["Dm7", "G7", "Cmaj7"]);
  assert.deepEqual(syms(parseProgression("I V7/vi vi bVII", C), C), ["C", "E7", "Am", "B♭"]);
  assert.deepEqual(syms(parseProgression("i bVI bVII V", Am), Am), ["Am", "F", "G", "E"]);
  assert.deepEqual(syms(parseProgression("i VI VII", Am), Am), ["Am", "F", "G"]);
});

test("detects the key when none is given", () => {
  assert.equal(keyName(parseProgression("G D Em C", null).key), "G major");
  assert.equal(keyName(parseProgression("Am F C G Am", null).key), "A minor");
  assert.equal(parseProgression("Am F C G", null).chords.length, 4);
});

test("bars and beats", () => {
  const p = parseProgression("C | Am | Dm7 G7 | C", C);
  assert.deepEqual(p.chords.map((c) => c.beats), [4, 4, 2, 2, 4]);
  assert.equal(toText(p.chords, C), "C | Am | Dm7 G7 | C");
  const q = parseProgression("C:3 G:1 | F", C);
  assert.deepEqual(q.chords.map((c) => c.beats), [3, 1, 4]);
  assert.equal(toText(q.chords, C), "C:3 G:1 | F");
  assert.equal(toText(parseProgression("C G Am F", C).chords, C), "C G Am F");
  const w = parseProgression("C | F G | C", C, 3);
  assert.deepEqual(w.chords.map((c) => c.beats), [3, 1.5, 1.5, 3]);
});

test("reports unknown tokens", () => {
  const p = parseProgression("C Q7 G", C);
  assert.equal(p.chords.length, 2);
  assert.equal(p.errors.length, 1);
});

test("transposes by key and keeps numerals", () => {
  const p = parseProgression("ii7 V7 Imaj7", C);
  assert.deepEqual(syms(p, makeKey(10, "major")), ["Cm7", "F7", "B♭maj7"]);
  assert.deepEqual(p.chords.map((c) => numeral(c, D)), ["ii7", "V7", "Imaj7"]);
  assert.deepEqual(circleKeys(C).map((k) => keyName(k)).slice(0, 4), ["C major", "F major", "B♭ major", "E♭ major"]);
});

test("grading accepts any inversion, omitted 5ths and added 9ths, not wrong notes", () => {
  const [cmaj7] = parseProgression("Cmaj7", C).chords;
  assert.equal(matches([60, 64, 67, 71], cmaj7, C), true);
  assert.equal(matches([52, 59, 60], cmaj7, C), true);       // E B C, no 5th
  assert.equal(matches([48, 64, 71, 74], cmaj7, C), true);   // with 9th
  assert.equal(matches([60, 64, 67], cmaj7, C), false);      // missing 7th
  assert.equal(matches([60, 63, 67, 71], cmaj7, C), false);  // wrong 3rd
  const [g7] = parseProgression("G7", C).chords;
  assert.equal(matches([53, 59, 62, 67], g7, C), true);
  assert.equal(matches([55, 59, 62, 65, 69], parseProgression("G9", C).chords[0], C), true);
});

test("recorded voicings move with the key", () => {
  const c = fromChord(toChord(parseProgression("Am7", C).chords[0], C), C, 4, [57, 60, 64, 67]);
  assert.deepEqual(voicingFor(c, C), [57, 60, 64, 67]);
  assert.deepEqual(voicingFor(c, D), [59, 62, 66, 69]);
});

test("generator produces loopable progressions in the style", () => {
  let seed = 1; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const style of ["pop", "jazz", "neosoul", "classical", "cinematic", "rock"])
    for (const mood of ["bright", "dreamy", "soulful", "melancholy", "tense", "epic"]) {
      const g = generate({ key: C, style, mood, length: 4, rand });
      assert.ok(g.chords.length >= 3, `${style}/${mood} too short`);
      assert.equal(g.chords[0].r, 0, "starts on the tonic");
    }
  for (let n = 0; n < 30; n++) {
    const jazz = generate({ key: C, style: "jazz", mood: "bright", length: 4, rand });
    assert.ok(jazz.chords.every((c) => ["maj7", "m7", "7", "m7b5"].includes(c.t)), "jazz uses sevenths");
    assert.ok(jazz.chords.every((c) => c.r !== 7 || c.t === "7"), "V stays dominant");
    const neo = generate({ key: C, style: "neosoul", mood: "soulful", length: 4, rand });
    assert.ok(neo.chords.every((c) => c.r !== 7 || ["13", "7", "7#9"].includes(c.t)), "neo-soul V is a dominant");
    const pop = generate({ key: C, style: "pop", mood: "bright", length: 4, rand });
    assert.notEqual(pop.chords.at(-1).r, 0, "loops: doesn't end on the tonic");
    const cl = generate({ key: C, style: "classical", mood: "bright", length: 4, rand });
    assert.equal(cl.chords.at(-1).r, 0, "classical ends home");
  }
  assert.equal(generateMany({ key: C, style: "pop", mood: "bright", length: 4, rand }, 3).length, 3);
});

test("builds a progression from played chords", () => {
  const p = fromPlayed([[50, 54, 57], [55, 59, 62], [52, 55, 59], [50, 54, 57]]);
  assert.equal(keyName(p.key), "D major");
  assert.deepEqual(syms(p, p.key), ["D", "G", "Em", "D"]);
  assert.deepEqual(voicingFor(p.chords[1], p.key), [55, 59, 62]);
});

test("extended dominants read as secondary dominants", () => {
  const p = parseProgression("Cmaj9 E7#9 Am9 A13 Dm9", C);
  assert.deepEqual(p.chords.map((c) => numeral(c, C)), ["Imaj9", "V7♯9/vi", "vi9", "V13/ii", "ii9"]);
});
