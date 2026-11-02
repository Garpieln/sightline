// Harmony engine: spelling, keys, the circle of fifths, chord recognition,
// Roman-numeral analysis, key detection and suggestions. Pure functions, no DOM.
//
// A spelled note is { l, a }: l = letter index (0 = C ... 6 = B), a = accidental (-2..2).

export const LETTERS = "CDEFGAB";
const NAT = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };
const mod = (n, m) => ((n % m) + m) % m;

export const pcOf = (sp) => mod(NAT[sp.l] + sp.a, 12);
export const spName = (sp) => LETTERS[sp.l] + ACC[sp.a];
export function spellLetter(l, pc) {
  l = mod(l, 7);
  return { l, a: mod(pc - NAT[l] + 6, 12) - 6 };
}
const sameSp = (x, y) => x.l === y.l && x.a === y.a;

// ---------- keys and the circle of fifths ----------
// Clockwise from C. Index 6 is spelled F♯ / D♯m (six sharps); G♭ / E♭m is the same key.
const CIRCLE_MAJ = [[0, 0], [4, 0], [1, 0], [5, 0], [2, 0], [6, 0], [3, 1], [1, -1], [5, -1], [2, -1], [6, -1], [3, 0]];
const CIRCLE_MIN = [[5, 0], [2, 0], [6, 0], [3, 1], [0, 1], [4, 1], [1, 1], [6, -1], [3, 0], [0, 0], [4, 0], [1, 0]];
const CIRCLE_SIG = [0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1];
const SHARP_ORDER = "FCGDAEB", FLAT_ORDER = "BEADGCF";
const MAJOR_IV = [0, 2, 4, 5, 7, 9, 11], MINOR_IV = [0, 2, 3, 5, 7, 8, 10];

export function makeKey(ci, mode) {
  ci = mod(ci, 12);
  const [l, a] = (mode === "major" ? CIRCLE_MAJ : CIRCLE_MIN)[ci];
  const tonic = { l, a }, tpc = pcOf(tonic);
  const iv = mode === "major" ? MAJOR_IV : MINOR_IV;
  const scale = iv.map((s, i) => spellLetter(l + i, tpc + s));
  const pcs = new Set(scale.map(pcOf));
  if (mode === "minor") pcs.add(mod(tpc + 11, 12)); // raised 7th (harmonic minor)
  return { id: ci + (mode === "major" ? "M" : "m"), ci, mode, tonic, tpc, scale, pcs, sig: CIRCLE_SIG[ci] };
}
export const ALL_KEYS = [...Array(12)].flatMap((_, i) => [makeKey(i, "major"), makeKey(i, "minor")]);
export const keyById = (id) => ALL_KEYS.find((k) => k.id === id) || ALL_KEYS[0];
export const keyName = (k) => spName(k.tonic) + (k.mode === "major" ? " major" : " minor");
export const relativeOf = (k) => makeKey(k.ci, k.mode === "major" ? "minor" : "major");
export const circleIndexOfPc = (pc) => mod(pc * 7, 12); // position of a major root on the circle

export function sigText(k) {
  if (k.sig === 0) return "No sharps or flats";
  const n = Math.abs(k.sig), list = (k.sig > 0 ? SHARP_ORDER : FLAT_ORDER).slice(0, n).split("").map((c) => c + (k.sig > 0 ? "♯" : "♭"));
  return `${n} ${k.sig > 0 ? (n > 1 ? "sharps" : "sharp") : n > 1 ? "flats" : "flat"}: ${list.join(" ")}`;
}
export const sigShort = (k) => (k.sig === 0 ? "0" : Math.abs(k.sig) + (k.sig > 0 ? "♯" : "♭"));
// Accidental the key signature applies to each letter (for staff drawing).
export function sigAcc(k) {
  const acc = [0, 0, 0, 0, 0, 0, 0];
  const n = Math.abs(k.sig), order = k.sig > 0 ? SHARP_ORDER : FLAT_ORDER;
  for (let i = 0; i < n; i++) acc[LETTERS.indexOf(order[i])] = k.sig > 0 ? 1 : -1;
  return acc;
}
export function sigList(k) {
  const n = Math.abs(k.sig), order = k.sig > 0 ? SHARP_ORDER : FLAT_ORDER;
  return order.slice(0, n).split("").map((c) => [k.sig > 0 ? "s" : "f", c]);
}

// Spell a pitch class in a key: scale notes as written; chromatic notes by their
// distance from the tonic (♭3, ♭6, ♭7, ♯4 ...), so B♭ in C, E natural in F♯, etc.
const CHROMA_LETTER = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
export function spellInKey(pc, key) {
  const hit = key.scale.find((s) => pcOf(s) === pc);
  if (hit) return hit;
  const sp = spellLetter(key.tonic.l + CHROMA_LETTER[mod(pc - key.tpc, 12)], pc);
  if (Math.abs(sp.a) <= 1) return sp;
  const sharp = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6][pc], flat = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][pc];
  return spellLetter(key.sig < 0 ? flat : sharp, pc);
}

// ---------- chord types ----------
// iv = semitones above root, deg = letter steps above root (for spelling), pr = simplicity rank.
export const TYPES = [
  { id: "maj", sym: "", name: "major", iv: [0, 4, 7], deg: [0, 2, 4], pr: 0 },
  { id: "min", sym: "m", name: "minor", iv: [0, 3, 7], deg: [0, 2, 4], pr: 0 },
  { id: "dim", sym: "°", name: "diminished", iv: [0, 3, 6], deg: [0, 2, 4], pr: 0.8 },
  { id: "aug", sym: "+", name: "augmented", iv: [0, 4, 8], deg: [0, 2, 4], pr: 1.8 },
  { id: "sus4", sym: "sus4", name: "suspended 4th", iv: [0, 5, 7], deg: [0, 3, 4], pr: 1.6 },
  { id: "sus2", sym: "sus2", name: "suspended 2nd", iv: [0, 2, 7], deg: [0, 1, 4], pr: 2 },
  { id: "5", sym: "5", name: "power chord", iv: [0, 7], deg: [0, 4], pr: 1 },
  { id: "7", sym: "7", name: "dominant seventh", iv: [0, 4, 7, 10], deg: [0, 2, 4, 6], pr: 0.9, opt5: true },
  { id: "maj7", sym: "maj7", name: "major seventh", iv: [0, 4, 7, 11], deg: [0, 2, 4, 6], pr: 1.1, opt5: true },
  { id: "m7", sym: "m7", name: "minor seventh", iv: [0, 3, 7, 10], deg: [0, 2, 4, 6], pr: 1.1, opt5: true },
  { id: "m7b5", sym: "m7♭5", name: "half-diminished seventh", iv: [0, 3, 6, 10], deg: [0, 2, 4, 6], pr: 1.4 },
  { id: "dim7", sym: "°7", name: "diminished seventh", iv: [0, 3, 6, 9], deg: [0, 2, 4, 6], pr: 1.5 },
  { id: "mmaj7", sym: "m(maj7)", name: "minor-major seventh", iv: [0, 3, 7, 11], deg: [0, 2, 4, 6], pr: 2.6, opt5: true },
  { id: "6", sym: "6", name: "major sixth", iv: [0, 4, 7, 9], deg: [0, 2, 4, 5], pr: 1.9 },
  { id: "m6", sym: "m6", name: "minor sixth", iv: [0, 3, 7, 9], deg: [0, 2, 4, 5], pr: 2.1 },
  { id: "add9", sym: "add9", name: "major add 9", iv: [0, 2, 4, 7], deg: [0, 1, 2, 4], pr: 2 },
  { id: "madd9", sym: "m(add9)", name: "minor add 9", iv: [0, 2, 3, 7], deg: [0, 1, 2, 4], pr: 2.2 },
  { id: "7sus4", sym: "7sus4", name: "dominant seventh sus4", iv: [0, 5, 7, 10], deg: [0, 3, 4, 6], pr: 2.3 },
  { id: "maj9", sym: "maj9", name: "major ninth", iv: [0, 2, 4, 7, 11], deg: [0, 1, 2, 4, 6], pr: 2.4, opt5: true },
  { id: "9", sym: "9", name: "dominant ninth", iv: [0, 2, 4, 7, 10], deg: [0, 1, 2, 4, 6], pr: 2.3, opt5: true },
  { id: "m9", sym: "m9", name: "minor ninth", iv: [0, 2, 3, 7, 10], deg: [0, 1, 2, 4, 6], pr: 2.4, opt5: true },
];
const TYPE = Object.fromEntries(TYPES.map((t) => [t.id, t]));
export const typeById = (id) => TYPE[id];
const MINORISH = new Set(["min", "dim", "m7", "m7b5", "dim7", "mmaj7", "m6", "madd9", "m9"]);
const MAJORISH = new Set(["maj", "maj7", "6", "add9", "maj9", "7", "9", "sus2", "sus4", "5", "7sus4", "aug"]);
const INTERVAL_NAMES = ["unison", "minor 2nd", "major 2nd", "minor 3rd", "major 3rd", "perfect 4th", "tritone", "perfect 5th", "minor 6th", "major 6th", "minor 7th", "major 7th"];

// Build a chord from a spelled root and type id.
export function makeChord(root, tid, bassSp = null) {
  const t = TYPE[tid], rpc = pcOf(root);
  const tones = t.iv.map((s, i) => spellLetter(root.l + t.deg[i], rpc + s));
  const bass = bassSp || root;
  const sym = spName(root) + t.sym + (sameSp(bass, root) ? "" : "/" + spName(bass));
  return { root, tid, t, tones, bass, sym, rootSym: spName(root) + t.sym, rpc, pcs: new Set(tones.map(pcOf)) };
}

// ---------- recognition ----------
const setEq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const INV_NAMES = ["root position", "1st inversion", "2nd inversion", "3rd inversion"];

export function identify(midis, key) {
  const notes = [...new Set(midis)].sort((a, b) => a - b);
  if (!notes.length) return null;
  const pcs = new Set(notes.map((m) => mod(m, 12))), bassPc = mod(notes[0], 12);
  const spelledNotes = (spellFor) => notes.map((m) => { const sp = spellFor(mod(m, 12)); return { m, sp, oct: octaveOf(m, sp) }; });
  const keySpell = (pc) => spellInKey(pc, key);

  if (pcs.size === 1) return { kind: "note", notes: spelledNotes(keySpell), label: spName(keySpell(bassPc)), desc: "Single note" };

  const cands = [];
  for (const root of pcs) {
    const rel = new Set([...pcs].map((p) => mod(p - root, 12)));
    for (const t of TYPES) {
      const full = new Set(t.iv);
      const variants = [[full, false]];
      if (t.opt5) variants.push([new Set(t.iv.filter((x) => x !== 7)), true]);
      for (const [v, no5] of variants) {
        if (!setEq(v, rel)) continue;
        let score = t.pr + (no5 ? 0.6 : 0) + (root === bassPc ? 0 : 1.1);
        if ([...pcs].every((p) => key.pcs.has(p))) score -= 0.1;
        // Symmetric chords (°7, +) read the same from any root: prefer the root whose
        // spelling matches the key, e.g. G♯°7 rather than B°7 in A minor.
        if (t.id === "dim7" || t.id === "aug") {
          const ch = makeChord(spellInKey(root, key), t.id);
          if (ch.tones.every((s) => sameSp(s, spellInKey(pcOf(s), key)))) score -= 1.3;
        }
        cands.push({ root, t, no5, score });
      }
    }
  }
  if (!cands.length) {
    if (pcs.size === 2) {
      const [a, b] = [...pcs];
      const iv = mod(mod(notes[notes.length - 1], 12) - bassPc, 12);
      const name = INTERVAL_NAMES[iv];
      const n = spelledNotes(keySpell);
      return { kind: "interval", notes: n, label: name[0].toUpperCase() + name.slice(1), desc: `${spName(n[0].sp)} to ${spName(n[n.length - 1].sp)}. Add a third note to make a chord.`, pcs: [a, b] };
    }
    return { kind: "cluster", notes: spelledNotes(keySpell), label: "No standard chord", desc: "This combination doesn't match a common chord shape." };
  }
  cands.sort((a, b) => a.score - b.score);
  const build = (c) => {
    const rootSp = spellInKey(c.root, key);
    const ch = makeChord(rootSp, c.t.id);
    const spByPc = new Map(ch.tones.map((s) => [pcOf(s), s]));
    const bassSp = spByPc.get(bassPc) || spellInKey(bassPc, key);
    const chord = makeChord(rootSp, c.t.id, bassSp);
    const bi = c.t.iv.indexOf(mod(bassPc - c.root, 12));
    chord.inversion = bi <= 0 ? INV_NAMES[0] : c.t.iv[bi] === 2 ? "9th in the bass" : INV_NAMES[Math.min(bi, 3)];
    chord.no5 = c.no5;
    chord.notes = spelledNotes((pc) => spByPc.get(pc) || spellInKey(pc, key));
    chord.kind = "chord";
    chord.label = chord.sym;
    chord.desc = `${spName(rootSp)} ${c.t.name}${bi > 0 ? ", " + chord.inversion : ""}${c.no5 ? " (no 5th)" : ""}`;
    return chord;
  };
  const primary = build(cands[0]);
  const seen = new Set([primary.sym]);
  primary.alts = [];
  for (const c of cands.slice(1)) {
    const ch = build(c);
    if (!seen.has(ch.sym)) { seen.add(ch.sym); primary.alts.push(ch); }
    if (primary.alts.length >= 2) break;
  }
  return primary;
}

// Octave number for a spelled note at a MIDI pitch (handles B♯ / C♭ crossings).
export function octaveOf(m, sp) {
  return Math.round((m - NAT[sp.l] - sp.a) / 12) - 1;
}

// ---------- analysis in a key ----------
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const NUM_SUFFIX = { maj: "", min: "", dim: "°", aug: "+", sus2: "sus2", sus4: "sus4", 5: "5", maj7: "maj7", 7: "7", m7: "7", m7b5: "ø7", dim7: "°7", mmaj7: "(maj7)", 6: "6", m6: "6", add9: "add9", madd9: "add9", "7sus4": "7sus4", maj9: "maj9", 9: "9", m9: "9" };
const FUNC = {
  major: ["Tonic", "Predominant", "Tonic", "Predominant", "Dominant", "Tonic", "Dominant"],
  minor: ["Tonic", "Predominant", "Tonic", "Predominant", "Dominant", "Tonic", "Dominant"],
};

function degreeOf(root, key) {
  const dl = mod(root.l - key.tonic.l, 7);
  let diff = mod(pcOf(root) - pcOf(key.scale[dl]) + 6, 12) - 6;
  let raised = false;
  if (key.mode === "minor" && dl === 6 && diff === 1) { diff = 0; raised = true; }
  return { dl, diff, raised };
}

export function numeralFor(root, tid, key) {
  const { dl, diff } = degreeOf(root, key);
  const base = NUMERALS[dl];
  const pre = diff < 0 ? "♭".repeat(-diff) : diff > 0 ? "♯".repeat(diff) : "";
  return pre + (MINORISH.has(tid) ? base.toLowerCase() : base) + NUM_SUFFIX[tid];
}

// Diatonic triads (and sevenths) of a key. Minor keys use the raised 7th for V and vii°.
export function diatonic(key, sevenths = false) {
  const out = [];
  const pool = key.scale.slice();
  for (let i = 0; i < 7; i++) {
    let tones = [0, 2, 4, 6].map((s) => pool[(i + s) % 7]);
    if (key.mode === "minor" && (i === 4 || i === 6)) {
      const lt = spellLetter(key.scale[6].l, key.tpc + 11);
      tones = tones.map((t) => (sameSp(t, key.scale[6]) ? lt : t));
    }
    const rpc = pcOf(tones[0]);
    const ivs = tones.map((t) => mod(pcOf(t) - rpc, 12));
    const tri = TYPES.find((t) => t.iv.length === 3 && t.iv.every((x, j) => x === ivs[j]) && t.deg[1] === 2);
    const sev = TYPES.find((t) => t.iv.length === 4 && t.iv.every((x, j) => x === ivs[j]) && t.deg[3] === 6);
    const tid = sevenths ? sev.id : tri.id;
    const ch = makeChord(tones[0], tid);
    ch.degree = i;
    ch.numeral = numeralFor(tones[0], tid, key);
    ch.func = FUNC[key.mode][i];
    out.push(ch);
    if (key.mode === "minor" && i === 6) {
      // natural VII (subtonic) is common too
      const nat = makeChord(key.scale[6], sevenths ? "7" : "maj");
      nat.degree = 6; nat.numeral = numeralFor(key.scale[6], nat.tid, key); nat.func = "Subtonic";
      out.splice(out.length - 1, 0, nat);
    }
  }
  return out;
}

const fitsKey = (chord, key) => [...chord.pcs].every((p) => key.pcs.has(p));

export function analyze(chord, key) {
  if (!chord || chord.kind !== "chord") return null;
  const numeral = numeralFor(chord.root, chord.tid, key);
  const { dl, diff } = degreeOf(chord.root, key);
  const res = { numeral, role: null, kind: "chromatic", func: "Outside the key", note: "" };
  if (fitsKey(chord, key) && diff === 0) {
    res.kind = "diatonic";
    res.role = String(dl);
    res.func = FUNC[key.mode][dl];
    if (key.mode === "minor" && dl === 6 && mod(pcOf(chord.root) - key.tpc, 12) === 10) { res.role = "6n"; res.func = "Subtonic"; }
    return res;
  }
  // Secondary dominant: major or dominant-7 chord a fifth above a diatonic chord (not I).
  if (["maj", "7", "9"].includes(chord.tid)) {
    const target = mod(chord.rpc - 7, 12);
    const d = diatonic(key).find((c) => c.rpc === target && c.tid !== "dim");
    if (d && d.degree !== 0) {
      res.kind = "secondary"; res.role = "sec:" + d.degree; res.target = d;
      res.numeral = (chord.tid === "maj" ? "V" : "V7") + "/" + d.numeral;
      res.func = "Secondary dominant";
      res.note = `Borrowed dominant that pulls toward ${d.sym}.`;
      return res;
    }
  }
  // Secondary leading-tone: diminished chord a half step below a diatonic chord.
  if (["dim", "dim7", "m7b5"].includes(chord.tid)) {
    const target = mod(chord.rpc + 1, 12);
    const d = diatonic(key).find((c) => c.rpc === target && c.tid !== "dim");
    if (d && d.degree !== 0) {
      res.kind = "secondary"; res.role = "sec:" + d.degree; res.target = d;
      res.numeral = "vii" + NUM_SUFFIX[chord.tid] + "/" + d.numeral;
      res.func = "Secondary leading-tone chord";
      res.note = `Leads up by half step into ${d.sym}.`;
      return res;
    }
  }
  // Borrowed from the parallel key.
  const par = makeKey(key.mode === "major" ? mod(key.ci - 3, 12) : mod(key.ci + 3, 12), key.mode === "major" ? "minor" : "major");
  if (pcOf(par.tonic) === key.tpc && fitsKey(chord, par)) {
    res.kind = "borrowed";
    res.func = `Borrowed from ${keyName(par)}`;
    const off = mod(chord.rpc - key.tpc, 12);
    res.role = { 5: "iv", 8: "b6", 10: "b7", 3: "b3", 1: "b2" }[off] || null;
    if (key.mode === "minor") res.role = off === 5 ? "IVmaj" : off === 0 ? "Imaj" : null;
    return res;
  }
  res.note = "Not in this key. It may be a passing chord or a sign the key is changing.";
  return res;
}

// ---------- key detection ----------
// events: [{ chord }] oldest first. Returns ranked keys with scores.
export function detectKeys(events) {
  const scores = ALL_KEYS.map((k) => {
    let s = 0;
    events.forEach((e, i) => {
      const w = Math.pow(0.85, events.length - 1 - i);
      const out = [...e.chord.pcs].filter((p) => !k.pcs.has(p)).length;
      s += w * (out === 0 ? 1 : -0.8 * out);
      const isTonic = e.chord.rpc === k.tpc && (k.mode === "major" ? MAJORISH.has(e.chord.tid) && e.chord.tid !== "7" : MINORISH.has(e.chord.tid) && e.chord.tid !== "dim");
      if (isTonic) s += 0.9 * w + (i === events.length - 1 ? 0.15 : 0) + (i === 0 ? 0.25 : 0);
      const next = events[i + 1];
      if (next && e.chord.rpc === mod(k.tpc + 7, 12) && ["maj", "7", "9"].includes(e.chord.tid) && next.chord.rpc === k.tpc) s += 0.6 * w;
    });
    s += (k.mode === "major" ? 0.02 : 0) - 0.004 * Math.abs(k.sig);
    return { key: k, score: s };
  });
  return scores.sort((a, b) => b.score - a.score);
}

// ---------- suggestions ----------
// Roles: "0".."6" diatonic degrees, "V7", "sec:N" secondary dominant of degree N,
// "iv" "b6" "b7" "b3" borrowed (major keys), "6n" natural VII and "IVmaj" (minor keys).
const C = "Convention";
const NEXT = {
  major: {
    0: [["3", 0.9, "Moves from home to the predominant. The root climbs a fourth, one step counter-clockwise on the circle."], ["4", 0.9, "Builds tension that wants to return home. One step clockwise on the circle."], ["5", 0.8, "The relative minor shares two notes with I, so it darkens the mood smoothly."], ["1", 0.6, "A softer predominant that sets up V."], ["sec:5", 0.5, "Secondary dominant: a strong pull into vi."], ["b7", 0.4, "Borrowed chord with a big rock and anthem sound."]],
    1: [["4", 1, "ii–V: the root falls a fifth, the strongest move in tonal music."], ["V7", 0.85, "Same move with the 7th added for extra pull home."], ["6", 0.4, "vii° also leads home, but sounds tenser."], ["0", 0.35, "Skips the dominant. Sounds gentle and open."]],
    2: [["5", 0.9, "Root falls a fifth along the circle into the relative minor."], ["3", 0.75, "Moves on to the predominant."], ["1", 0.4, "Steps down to ii."]],
    3: [["4", 0.9, "Predominant to dominant: the standard way to build toward home."], ["0", 0.85, "Plagal 'amen' cadence. A soft, settled return home."], ["iv", 0.65, "Borrowed minor iv. A bittersweet color before returning to I."], ["1", 0.55, "Relative minor of IV. Same function, darker."], ["5", 0.4, "Drops back to the relative minor."]],
    4: [["0", 1, "Authentic cadence: dominant resolves home. The most final-sounding move."], ["5", 0.75, "Deceptive cadence: sets up home, then lands on vi instead."], ["3", 0.35, "Steps back to IV. Common in rock and blues."]],
    5: [["1", 0.85, "Root falls a fifth, continuing around the circle toward V."], ["3", 0.85, "A staple pop move (vi–IV)."], ["4", 0.55, "Heads straight to the dominant."], ["0", 0.45, "Back to the relative major. Shares two notes."]],
    6: [["0", 1, "The leading tone rises a half step to the tonic."], ["5", 0.35, "Less common, softer landing."]],
    V7: [["0", 1, "The tritone in V7 resolves inward to the tonic. Strongest cadence there is."], ["5", 0.7, "Deceptive cadence: dominant to vi."]],
    iv: [["0", 0.9, "Minor plagal cadence. The lowered 6th sinks to the 5th of I."], ["4", 0.6, "Continues to the dominant."]],
    b6: [["b7", 0.85, "♭VI–♭VII–I: the 'epic' cadence used in film and game music."], ["4", 0.5, "Resolves to the dominant."], ["0", 0.5, "Lands home with a dramatic shift."]],
    b7: [["0", 0.9, "Mixolydian or 'backdoor' cadence. Sounds triumphant rather than final."], ["3", 0.55, "Rocks between ♭VII and IV."]],
    b3: [["3", 0.6, "Common in rock: ♭III–IV."], ["b7", 0.5, "Stays in borrowed territory."]],
  },
  minor: {
    0: [["3", 0.9, "i–iv: moves to the predominant, one step counter-clockwise on the circle."], ["4", 0.85, "Dominant with the raised leading tone builds strong tension."], ["5", 0.8, "VI shares two notes with i and opens the sound up."], ["6n", 0.7, "The natural VII gives a modal, folk or rock sound."], ["2", 0.55, "The relative major. Shares two notes."]],
    1: [["4", 1, "iiø–V: root falls a fifth into the dominant."], ["V7", 0.85, "Adds the 7th for more pull."]],
    2: [["5", 0.85, "Root falls a fifth around the circle."], ["3", 0.6, "Moves to the predominant."], ["6n", 0.55, "Steps down to VII."]],
    3: [["4", 0.9, "Predominant to dominant."], ["0", 0.75, "Minor plagal return."], ["6n", 0.55, "Heads to the subtonic."]],
    4: [["0", 1, "Authentic cadence in minor."], ["5", 0.75, "Deceptive cadence: V to VI."]],
    5: [["6n", 0.85, "VI–VII–i: a rising, epic progression."], ["3", 0.7, "Moves to the predominant."], ["2", 0.55, "Down a third to the relative major."], ["4", 0.5, "Straight to the dominant."]],
    "6n": [["2", 0.85, "Root falls a fifth: VII acts as the dominant of the relative major."], ["0", 0.75, "Rises a whole step home. Modal sound."], ["5", 0.5, "Steps back to VI."]],
    6: [["0", 1, "The raised leading tone resolves up to the tonic."]],
    V7: [["0", 1, "V7 resolves home."], ["5", 0.7, "Deceptive cadence."]],
    IVmaj: [["0", 0.7, "Dorian IV returning home."], ["4", 0.5, "On to the dominant."]],
    Imaj: [["3", 0.6, "Major tonic leading to iv."]],
  },
};

export function realize(role, key, sevenths = false) {
  const D = diatonic(key, sevenths);
  const deg = (i) => D.find((c) => c.degree === i && (key.mode === "major" || i !== 6 || c.tid.startsWith("dim") || c.tid === "m7b5"));
  if (/^\d$/.test(role)) return deg(+role);
  if (role === "6n") return D.find((c) => c.degree === 6 && c.func === "Subtonic");
  const tpc = key.tpc, tl = key.tonic.l;
  const mk = (l, off, tid, numeral, func) => { const c = makeChord(spellLetter(tl + l, tpc + off), tid); c.numeral = numeral; c.func = func; return c; };
  if (role === "V7") return mk(4, 7, "7", "V7", "Dominant");
  if (role.startsWith("sec:")) {
    const t = deg(+role.slice(4));
    const c = makeChord(spellLetter(t.root.l + 4, t.rpc + 7), "7");
    c.numeral = "V7/" + t.numeral.replace(/7|maj7|ø7|°7/g, ""); c.func = "Secondary dominant"; c.target = t;
    return c;
  }
  const map = {
    iv: [3, 5, sevenths ? "m7" : "min", "iv", "Borrowed"], b6: [5, 8, sevenths ? "maj7" : "maj", "♭VI", "Borrowed"],
    b7: [6, 10, sevenths ? "7" : "maj", "♭VII", "Borrowed"], b3: [2, 3, sevenths ? "maj7" : "maj", "♭III", "Borrowed"],
    IVmaj: [3, 5, sevenths ? "7" : "maj", "IV", "Borrowed"], Imaj: [0, 0, "maj", "I", "Borrowed"],
  }[role];
  if (map) {
    const c = mk(map[0], map[1], map[2], map[3], map[4]);
    if (sevenths) c.numeral = numeralFor(c.root, c.tid, key);
    return c;
  }
  return null;
}

const commonTones = (a, b) => [...a.tones].filter((x) => b.pcs.has(pcOf(x)));

function circleMove(from, to) {
  const d = mod(circleIndexOfPc(to.rpc) - circleIndexOfPc(from.rpc), 12);
  if (d === 0) return from.rpc === to.rpc ? "Same root" : "";
  if (d === 1) return "1 step clockwise";
  if (d === 11) return "1 step counter-clockwise";
  return d <= 6 ? `${d} steps clockwise` : `${12 - d} steps counter-clockwise`;
}

// Next-chord ideas for `chord` analysed as `an` in `key`.
export function suggestNext(chord, an, key) {
  const table = NEXT[key.mode];
  let role = an && an.role;
  if (role && chord.tid === "7" && role === "4") role = "V7";
  let rules = role && table[role];
  if (!rules && role && role.startsWith("sec:")) {
    const t = an.target;
    rules = [[String(t.degree), 1, `Resolves to its target, ${t.sym}: the root falls a fifth.`]];
    const after = table[String(t.degree)];
    if (after && after[0]) rules.push([after[0][0], 0.45, "Skips the resolution for a surprise."]);
  }
  let out = [];
  if (rules) {
    out = rules.map(([r, w, why]) => ({ chord: realize(r, key), w, why, tag: C }));
  } else {
    // Outside the key: resolve down a fifth if it sounds like a dominant, otherwise move to
    // the diatonic chords that share the most notes.
    if (["maj", "7", "9"].includes(chord.tid)) {
      const root = spellLetter(chord.root.l - 4, chord.rpc - 7);
      const tgt = makeChord(root, !fitsKey(makeChord(root, "maj"), key) && fitsKey(makeChord(root, "min"), key) ? "min" : "maj");
      tgt.numeral = numeralFor(tgt.root, tgt.tid, key);
      out.push({ chord: tgt, w: 0.9, why: "Treat it as a dominant: drop the root a fifth.", tag: C });
    }
    diatonic(key).map((d) => ({ d, n: commonTones(chord, d).length })).filter((x) => x.n > 0 && x.d.rpc !== chord.rpc)
      .sort((a, b) => b.n - a.n || (a.d.degree === 0 ? -1 : 1)).slice(0, 3)
      .forEach((x) => out.push({ chord: x.d, w: 0.5 + 0.1 * x.n, why: `Shares ${x.n} note${x.n > 1 ? "s" : ""} with your chord, so the change is smooth and pulls back into the key.`, tag: C }));
  }
  const seen = new Set();
  return out.filter((s) => s.chord && s.chord.rootSym !== chord.rootSym && !seen.has(s.chord.rootSym) && seen.add(s.chord.rootSym))
    .slice(0, 5)
    .map((s) => ({ ...s, strength: s.w >= 0.85 ? "Strong" : s.w >= 0.6 ? "Common" : "Color", common: commonTones(chord, s.chord).map(spName), circle: circleMove(chord, s.chord) }));
}

// Ways to enrich the chord by adding notes that stay in the key.
export function suggestColor(chord, an, key) {
  const out = [];
  const tri = ["maj", "min", "dim"].includes(chord.tid);
  const sev = ["maj7", "7", "m7"].includes(chord.tid);
  const scalePc = (n) => { const sp = spellLetter(chord.root.l + n, 0); const hit = key.scale.find((s) => s.l === sp.l); return hit ? pcOf(hit) : null; };
  const add = (tid, why) => {
    const c = makeChord(chord.root, tid);
    const added = c.tones.filter((t) => !chord.pcs.has(pcOf(t)));
    const removed = chord.tones.filter((t) => !c.pcs.has(pcOf(t)));
    if (!added.length) return;
    c.numeral = numeralFor(c.root, tid, key);
    out.push({ chord: c, why, add: added.map(spName), remove: removed.map(spName), tag: C });
  };
  const inKey = an && an.kind === "diatonic";
  if (tri && inKey) {
    const s7 = mod(scalePc(6) - chord.rpc, 12);
    const tid = chord.tid === "maj" ? (s7 === 11 ? "maj7" : "7") : chord.tid === "min" ? "m7" : s7 === 10 ? "m7b5" : "dim7";
    const why = { maj7: "Soft and dreamy. Common in ballads, jazz and lo-fi.", 7: "Adds a tritone that pulls hard toward the chord a fifth below.", m7: "Mellow and smooth. A staple of soul, R&B and jazz.", m7b5: "Dark and unstable. Leads naturally into V.", dim7: "Maximum tension. Resolves up a half step." }[tid];
    add(tid, why);
    if (chord.tid !== "dim" && mod(scalePc(1) - chord.rpc, 12) === 2) add(chord.tid === "maj" ? "add9" : "madd9", "Adds shimmer without changing the chord's role. Very common in pop piano.");
    if (chord.tid === "maj" && mod(scalePc(5) - chord.rpc, 12) === 9) add("6", "Sweet, vintage sound heard in old pop and swing.");
    if (chord.tid !== "dim" && mod(scalePc(3) - chord.rpc, 12) === 5) add("sus4", "Replaces the 3rd so the chord floats. Resolve back to the plain chord for release.");
    if (chord.tid !== "dim" && mod(scalePc(1) - chord.rpc, 12) === 2) add("sus2", "Open and airy. Common in modern pop and worship music.");
  } else if (tri && chord.tid === "maj") {
    add("7", "Turns it into a dominant that wants to resolve a fifth down.");
  } else if (sev) {
    const ninth = scalePc(1);
    if (!inKey || mod(ninth - chord.rpc, 12) === 2) add({ maj7: "maj9", 7: "9", m7: "m9" }[chord.tid], "Adds the 9th on top for a richer, jazzier sound.");
  }
  return out.slice(0, 4);
}

// Named progressions containing the chord's role.
const PROGS = {
  major: [
    { name: "Pop axis", r: ["0", "4", "5", "3"], style: "Pop, rock" },
    { name: "Axis from the minor", r: ["5", "3", "0", "4"], style: "Emotional pop" },
    { name: "'50s progression", r: ["0", "5", "3", "4"], style: "Doo-wop, ballads" },
    { name: "Classic cadence", r: ["0", "3", "4", "0"], style: "Folk, hymns, rock" },
    { name: "ii–V–I", r: ["1", "4", "0"], style: "Jazz", sev: true },
    { name: "Circle progression", r: ["5", "1", "4", "0"], style: "Jazz standards", sev: true },
    { name: "Royal road", r: ["3", "4", "2", "5"], style: "J-pop, anime", sev: true },
    { name: "Pachelbel", r: ["0", "4", "5", "2", "3", "0", "3", "4"], style: "Baroque, weddings" },
    { name: "Mixolydian rock", r: ["0", "b7", "3", "0"], style: "Rock anthems" },
    { name: "Bittersweet plagal", r: ["0", "3", "iv", "0"], style: "Ballads, film" },
    { name: "Epic cadence", r: ["0", "b6", "b7", "0"], style: "Film, games" },
    { name: "Secondary dominant", r: ["0", "sec:5", "5", "3"], style: "Pop, musicals" },
  ],
  minor: [
    { name: "Andalusian cadence", r: ["0", "6n", "5", "4"], style: "Flamenco, rock" },
    { name: "Minor pop", r: ["0", "5", "2", "6n"], style: "Pop, EDM" },
    { name: "Minor cadence", r: ["0", "3", "4", "0"], style: "Classical, folk" },
    { name: "Minor ii–V–i", r: ["1", "4", "0"], style: "Jazz", sev: true },
    { name: "Epic minor", r: ["0", "5", "6n", "0"], style: "Film, metal" },
    { name: "Dorian vamp", r: ["0", "IVmaj"], style: "Funk, soul" },
  ],
};

export function suggestProgressions(an, key) {
  const role = an && an.role ? (an.role === "V7" ? "4" : an.role) : null;
  const list = PROGS[key.mode];
  const hits = role ? list.filter((p) => p.r.includes(role)) : [];
  const chosen = (hits.length ? hits : list).slice(0, 3);
  return chosen.map((p) => ({
    name: p.name, style: p.style, matched: hits.length > 0,
    chords: p.r.map((r) => ({ role: r, chord: realize(r, key, !!p.sev), here: r === role })),
  }));
}

// ---------- voicing for playback ----------
// Right hand: close-position chord in the inversion nearest the previous chord
// (smooth voice leading). Left hand: the bass note (root, or slash bass) below it.
export function voice(chord, prev = null) {
  const pcs = chord.tones.map(pcOf), n = pcs.length;
  const cands = [];
  for (let inv = 0; inv < n; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
    for (let base = 55; base <= 67; base++) {
      if (mod(base, 12) !== order[0]) continue;
      const notes = [base];
      for (let i = 1; i < n; i++) { let m = notes[i - 1] + 1; while (mod(m, 12) !== order[i]) m++; notes.push(m); }
      cands.push(notes);
    }
  }
  const prevRH = prev ? prev.filter((m) => m >= 55) : [];
  const dist = (a, b) => a.reduce((s, x) => s + Math.min(...b.map((y) => Math.abs(x - y))), 0) + b.reduce((s, y) => s + Math.min(...a.map((x) => Math.abs(x - y))), 0);
  const cost = (c) => (prevRH.length ? dist(c, prevRH) : Math.abs((c[0] + c[c.length - 1]) / 2 - 64) * 2) + (c[c.length - 1] > 79 ? 6 : 0);
  const rh = cands.sort((a, b) => cost(a) - cost(b))[0];
  const bassPc = pcOf(chord.bass || chord.root);
  const prevBass = prev && prev.length && Math.min(...prev) < 55 ? Math.min(...prev) : 45;
  let bass = 36;
  for (let m = 36; m <= 54; m++) if (mod(m, 12) === bassPc && Math.abs(m - prevBass) < Math.abs(bass - prevBass)) bass = m;
  return [bass, ...rh];
}
