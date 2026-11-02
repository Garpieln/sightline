// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { identify, makeKey, keyName, sigText, analyze, diatonic, detectKeys, suggestNext, suggestColor, suggestProgressions, spName, ALL_KEYS } from "../src/theory.js";

const C = makeKey(0, "major"), Am = makeKey(0, "minor"), D = makeKey(2, "major"), Eb = makeKey(9, "major"), Fs = makeKey(6, "major");
const id = (ms, k = C) => identify(ms, k);

test("recognizes triads, sevenths and inversions", () => {
  assert.equal(id([60, 64, 67]).sym, "C");
  assert.equal(id([60, 64, 67]).desc, "C major");
  assert.equal(id([64, 67, 72]).sym, "C/E");
  assert.equal(id([64, 67, 72]).inversion, "1st inversion");
  assert.equal(id([55, 60, 64]).inversion, "2nd inversion");
  assert.equal(id([57, 60, 64]).sym, "Am");
  assert.equal(id([59, 62, 65]).sym, "B°");
  assert.equal(id([55, 59, 62, 65]).sym, "G7");
  assert.equal(id([48, 52, 59]).sym, "Cmaj7");
  assert.equal(id([48, 52, 59]).no5, true);
  assert.equal(id([62, 65, 69, 72]).sym, "Dm7");
  assert.equal(id([60, 62, 67]).sym, "Csus2");
  assert.equal(id([60, 67]).sym, "C5");
  assert.equal(id([60, 64]).kind, "interval");
  assert.equal(id([60, 64]).label, "Major 3rd");
  assert.equal(id([60, 61, 62]).kind, "cluster");
});

test("ambiguous sets pick by bass and list the alternative", () => {
  const c6 = id([48, 57, 64, 67]);
  assert.equal(c6.sym, "C6");
  assert.ok(c6.alts.some((a) => a.sym === "Am7/C"));
  assert.equal(id([45, 60, 64, 67]).sym, "Am7");
});

test("spells notes for the key", () => {
  assert.equal(id([66, 70, 73], Fs).sym, "F♯");
  assert.deepEqual(id([66, 70, 73], Fs).tones.map(spName), ["F♯", "A♯", "C♯"]);
  assert.equal(id([63, 67, 70], Eb).sym, "E♭");
  assert.deepEqual(id([58, 62, 65], C).tones.map(spName), ["B♭", "D", "F"]);
  assert.equal(id([59, 62, 65, 68], Am).sym, "G♯°7/B");
  assert.deepEqual(id([59, 62, 65, 68], Am).tones.map(spName), ["G♯", "B", "D", "F"]);
});

test("key names and signatures", () => {
  assert.equal(keyName(D), "D major");
  assert.equal(sigText(D), "2 sharps: F♯ C♯");
  assert.equal(sigText(Eb), "3 flats: B♭ E♭ A♭");
  assert.equal(keyName(Am), "A minor");
  assert.equal(ALL_KEYS.length, 24);
});

test("diatonic chords", () => {
  assert.deepEqual(diatonic(C).map((c) => c.sym), ["C", "Dm", "Em", "F", "G", "Am", "B°"]);
  assert.deepEqual(diatonic(C).map((c) => c.numeral), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  assert.deepEqual(diatonic(C, true).map((c) => c.sym), ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7♭5"]);
  assert.deepEqual(diatonic(Am).map((c) => c.numeral), ["i", "ii°", "III", "iv", "V", "VI", "VII", "vii°"]);
  assert.deepEqual(diatonic(D).map((c) => c.sym), ["D", "Em", "F♯m", "G", "A", "Bm", "C♯°"]);
});

test("analysis: numerals, secondary dominants, borrowed chords", () => {
  const a = (ms, k = C) => analyze(id(ms, k), k);
  assert.equal(a([67, 71, 74]).numeral, "V");
  assert.equal(a([67, 71, 74, 77]).numeral, "V7");
  assert.equal(a([64, 68, 71, 74]).numeral, "V7/vi");
  assert.equal(a([62, 66, 69]).numeral, "V/V");
  assert.equal(a([65, 68, 72]).kind, "borrowed");
  assert.equal(a([65, 68, 72]).numeral, "iv");
  assert.equal(a([70, 74, 77]).numeral, "♭VII");
  assert.equal(a([64, 68, 71], Am).numeral, "V");
  assert.equal(a([67, 71, 74], Am).numeral, "VII");
});

test("suggestions follow functional harmony", () => {
  const g = id([67, 71, 74]);
  const next = suggestNext(g, analyze(g, C), C);
  assert.equal(next[0].chord.sym, "C");
  assert.equal(next[0].strength, "Strong");
  const dm = id([62, 65, 69]);
  assert.equal(suggestNext(dm, analyze(dm, C), C)[0].chord.sym, "G");
  const e7 = id([64, 68, 71, 74]);
  assert.equal(suggestNext(e7, analyze(e7, C), C)[0].chord.sym, "Am");
  const c = id([60, 64, 67]);
  const color = suggestColor(c, analyze(c, C), C).map((x) => x.chord.sym);
  assert.ok(color.includes("Cmaj7") && color.includes("Cadd9"));
  const gc = suggestColor(g, analyze(g, C), C).map((x) => x.chord.sym);
  assert.equal(gc[0], "G7");
  const progs = suggestProgressions(analyze(c, C), C);
  assert.ok(progs.length >= 2 && progs[0].matched);
  assert.deepEqual(progs[0].chords.map((x) => x.chord.sym), ["C", "G", "Am", "F"]);
});

test("detects the key from a progression", () => {
  const ev = (ms) => ({ chord: id(ms) });
  assert.equal(keyName(detectKeys([ev([62, 66, 69]), ev([67, 71, 74]), ev([64, 67, 71]), ev([62, 66, 69])])[0].key), "D major");
  assert.equal(keyName(detectKeys([ev([57, 60, 64]), ev([62, 65, 69]), ev([64, 68, 71]), ev([57, 60, 64])])[0].key), "A minor");
  assert.equal(keyName(detectKeys([ev([60, 64, 67]), ev([65, 69, 72]), ev([67, 71, 74]), ev([60, 64, 67])])[0].key), "C major");
});

test("a dominant outside the key resolves to a major chord unless only minor fits", () => {
  const D = makeKey(2, "major");
  const g7 = identify([67, 71, 74, 77], D);
  assert.equal(suggestNext(g7, analyze(g7, D), D)[0].chord.sym, "C");
});
