// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { exercise, handNotes, fingering, arpName, rootFor, evenness, CIRCLE_PCS } from "../src/arpmodel.js";
import { spName } from "../src/theory.js";

const names = (ns) => ns.map((n) => spName(n.sp) + n.oct);
const fing = (pc, tid, hand, o = {}) => { const e = exercise(pc, tid, { octaves: 2, dir: "up", hands: hand, ...o }); return e.parts[hand].fingers.join(""); };

test("names use the usual spellings", () => {
  assert.equal(arpName(1, "min"), "C♯ minor");
  assert.equal(arpName(1, "maj"), "D♭ major");
  assert.equal(arpName(8, "min"), "G♯ minor");
  assert.equal(arpName(10, "m7b5"), "A♯ half-diminished");
  assert.equal(CIRCLE_PCS.length, 12);
});

test("notes: octaves, direction, inversions, hands", () => {
  assert.deepEqual(names(handNotes(0, "min", { octaves: 1, dir: "up" })), ["C4", "E♭4", "G4", "C5"]);
  assert.equal(handNotes(0, "maj", { octaves: 2, dir: "updown" }).length, 13);
  assert.deepEqual(names(handNotes(0, "maj", { octaves: 1, dir: "up", inversion: 1 })), ["E4", "G4", "C5", "E5"]);
  assert.deepEqual(names(handNotes(7, "7", { octaves: 1, dir: "up" })), ["G4", "B4", "D5", "F5", "G5"]);
  assert.equal(handNotes(0, "maj", { octaves: 1, hand: "lh", dir: "up" })[0].m, 48);
  assert.ok(handNotes(11, "maj", { octaves: 4, dir: "up" }).at(-1).m <= 108);
  const e = exercise(0, "maj", { octaves: 1, dir: "up", hands: "both" });
  assert.deepEqual(e.steps[0], [36, 60]);
});

test("fingering follows the standard patterns", () => {
  assert.equal(fing(0, "maj", "rh"), "1231235");          // C major
  assert.equal(fing(0, "maj", "lh"), "5421421");          // C major LH
  assert.equal(fing(0, "maj", "rh", { inversion: 1 }), "1241245");
  assert.equal(fing(0, "maj", "lh", { inversion: 2 }), "5321321");
  assert.equal(fing(3, "maj", "rh"), "2124124");          // E♭ major: thumb on G
  assert.equal(fing(10, "maj", "rh"), "2124124");         // B♭ major: thumb on D
  assert.equal(fing(0, "min", "rh"), "1231235");          // C minor
  assert.equal(fing(0, "maj7", "rh"), "123412345");       // seventh: 4-finger groups
  // never a thumb on a black key except all-black shapes
  for (let pc = 0; pc < 12; pc++) for (const t of ["maj", "min", "7", "dim7"]) for (const h of ["rh", "lh"]) {
    const e = exercise(pc, t, { octaves: 2, dir: "updown", hands: h });
    const black = (m) => [1, 3, 6, 8, 10].includes(m % 12);
    const allBlack = e.parts[h].notes.slice(0, e.groupSize).every((n) => black(n.m));
    if (!allBlack) e.parts[h].notes.forEach((n, i) => assert.ok(!(e.parts[h].fingers[i] === 1 && black(n.m)), `${e.name} ${h}: thumb on black at ${i}`));
  }
});

test("down uses the same fingers on the same notes", () => {
  const e = exercise(0, "maj", { octaves: 1, dir: "updown", hands: "rh" });
  assert.equal(e.parts.rh.fingers.join(""), "1235321");
});

test("evenness", () => {
  assert.equal(evenness([10, 10, 10]), 0);
  assert.ok(evenness([0, 40, -40]) > 30);
});
