// Music model. A note is addressed by its diatonic step `d` (0 = middle C, 1 = D4, 7 = C5)
// plus a key; the key's signature decides the actual pitch (MIDI number).

export const LETTERS = "CDEFGAB";
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

export const KEYS = {
  C: { label: "C major", acc: {}, tonic: 0, sig: [] },
  G: { label: "G major", acc: { F: 1 }, tonic: 4, sig: [["s", "F"]] },
  D: { label: "D major", acc: { F: 1, C: 1 }, tonic: 1, sig: [["s", "F"], ["s", "C"]] },
  F: { label: "F major", acc: { B: -1 }, tonic: 3, sig: [["f", "B"]] },
  Bb: { label: "B♭ major", acc: { B: -1, E: -1 }, tonic: 6, sig: [["f", "B"], ["f", "E"]] },
};

// Staff step where each key-signature accidental is drawn (treble clef).
export const SHARP_POS = { F: 10, C: 7, G: 11, D: 8, A: 5, E: 9, B: 6 };
export const FLAT_POS = { B: 6, E: 9, A: 5, D: 8, G: 4, C: 7, F: 3 };

export const letterOf = (d) => ((d % 7) + 7) % 7;

export function midiOf(d, key) {
  const l = letterOf(d);
  return 60 + 12 * Math.floor(d / 7) + NATURAL[l] + (KEYS[key].acc[LETTERS[l]] || 0);
}

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function midiName(m, key) {
  const flats = key && Object.values(KEYS[key].acc).some((a) => a < 0);
  return (flats ? FLAT_NAMES : SHARP_NAMES)[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

// Staff position for a played pitch (used to draw the "ghost" of a wrong note).
export function stepOfMidi(m, key) {
  for (let d = -14; d <= 28; d++) if (midiOf(d, key) === m) return d;
  for (let d = -14; d <= 28; d++) if (midiOf(d, key) === m - 1) return d;
  return 0;
}

export function rangeFor(id, key) {
  const t = KEYS[key].tonic;
  if (id === "five") return [t, t + 4];
  if (id === "oct") return [t, t + 7];
  if (id === "staff") return [0, 11];
  return [-2, 14];
}

export const RANGE_TEXT = {
  five: "Tonic up a fifth, one hand position",
  oct: "One octave from the tonic",
  staff: "Middle C to G above the staff",
  wide: "Adds ledger lines: A below middle C to high C",
};
