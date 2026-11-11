// Treble staff drawing in SVG. Units: 6px per staff step, bottom line at y=88.
import { GLYPH } from "./glyphs.js";
import { KEYS, SHARP_POS, FLAT_POS } from "./music.js";

export const HALF = 6, BOT = 88, VH = 136, VW = 1000;
const GS = 0.048; // glyph scale: 1000-unit em -> staff height

export const yOf = (d) => BOT - (d - 2) * HALF;

function glyph(path, x, yBase) {
  return `<path class="glyph" d="${path}" transform="translate(${x} ${yBase}) scale(${GS} ${-GS})"/>`;
}

export function staffLines(width) {
  let s = "";
  for (let i = 0; i < 5; i++) {
    const y = BOT - i * 12;
    s += `<line class="staffline" x1="0" x2="${width}" y1="${y}" y2="${y}"/>`;
  }
  return s;
}

// Clef + key signature. Returns the SVG and the x where notes may start.
export function clefAndKey(key) {
  let s = glyph(GLYPH.clef, 6, BOT);
  let x = 50;
  for (const [type, letter] of KEYS[key].sig) {
    const y = yOf(type === "s" ? SHARP_POS[letter] : FLAT_POS[letter]);
    s += type === "s" ? glyph(GLYPH.sharp, x, y + 131 * GS) : glyph(GLYPH.flat, x, y + 100 * GS);
    x += 13;
  }
  return { svg: s, x0: x + 14 };
}

// Note head, ledger lines and stem. dur in beats: 4 = whole, 2 = half, 1 = quarter.
export function noteHead(x, d, dur) {
  const y = yOf(d);
  let s = "";
  if (d <= 0) for (let L = 0; L >= d; L -= 2) s += `<line x1="${x - 12}" x2="${x + 12}" y1="${yOf(L)}" y2="${yOf(L)}"/>`;
  if (d >= 12) for (let L = 12; L <= d; L += 2) s += `<line x1="${x - 12}" x2="${x + 12}" y1="${yOf(L)}" y2="${yOf(L)}"/>`;
  const hollow = dur >= 2;
  s += `<ellipse class="head${hollow ? " hollow" : ""}" cx="${x}" cy="${y}" rx="${hollow ? 6.6 : 7.1}" ry="${hollow ? 4.6 : 5.1}" transform="rotate(-20 ${x} ${y})"/>`;
  if (dur < 4) {
    s += d < 6
      ? `<line x1="${x + 6.4}" x2="${x + 6.4}" y1="${y - 1.5}" y2="${y - 36}"/>`
      : `<line x1="${x - 6.4}" x2="${x - 6.4}" y1="${y + 1.5}" y2="${y + 36}"/>`;
  }
  return s;
}

// ---------- grand staff (for chords) ----------
// Treble bottom line E4 = step 2; bass bottom line G2 = step -10. Notes at or above
// middle C go on the treble staff. Steps count letters from middle C (C4 = 0).
const G = { tBot: 92, bBot: 188, space: 12 };
const tY = (d) => G.tBot - (d - 2) * HALF;
const bY = (d) => G.bBot - (d + 10) * HALF;
const BASS_S = 12 / 220; // bass clef glyph: 220 font units per staff space

const ACC_GLYPH = { "-2": ["dflat", 100], "-1": ["flat", 100], 0: ["natural", 132], 1: ["sharp", 131], 2: ["dsharp", 131] };

// notes: [{ step, acc, staff: "t" | "b" }]; sig: [["s"|"f", letter]]; sigAcc: accidental per letter index
export function grandStaff(notes, sig, sigAcc, width = 360) {
  let s = "";
  for (let i = 0; i < 5; i++) {
    s += `<line class="staffline" x1="14" x2="${width}" y1="${G.tBot - i * 12}" y2="${G.tBot - i * 12}"/>`;
    s += `<line class="staffline" x1="14" x2="${width}" y1="${G.bBot - i * 12}" y2="${G.bBot - i * 12}"/>`;
  }
  s += `<line class="barline" x1="14" x2="14" y1="${G.tBot - 48}" y2="${G.bBot}"/><line class="barline" x1="${width}" x2="${width}" y1="${G.tBot - 48}" y2="${G.bBot}"/>`;
  s += `<path class="glyph" d="M10 ${G.tBot - 48} C -2 ${G.tBot - 20}, 10 ${G.tBot + 8}, 1 ${(G.tBot + G.bBot - 48) / 2} C 10 ${G.bBot - 56}, -2 ${G.bBot - 28}, 10 ${G.bBot} C 3 ${G.bBot - 28}, 14 ${G.bBot - 56}, 4 ${(G.tBot + G.bBot - 48) / 2} C 14 ${G.tBot + 8}, 3 ${G.tBot - 20}, 10 ${G.tBot - 48}Z"/>`;
  s += glyph(GLYPH.clef, 20, G.tBot);
  s += `<path class="glyph" d="${GLYPH.bass}" transform="translate(22 ${G.bBot - 36 + 644 * BASS_S}) scale(${BASS_S} ${-BASS_S})"/>`;
  let x = 64;
  for (const [type, letter] of sig) {
    const d = type === "s" ? SHARP_POS[letter] : FLAT_POS[letter];
    const [g, c] = type === "s" ? ["sharp", 131] : ["flat", 100];
    s += glyph(GLYPH[g], x, tY(d) + c * GS) + glyph(GLYPH[g], x, bY(d - 14) + c * GS);
    x += 13;
  }
  const nx = Math.max(x + 60, width / 2 + 10);
  for (const staff of ["t", "b"]) {
    const ns = notes.filter((n) => n.staff === staff).sort((a, b) => a.step - b.step);
    const Y = staff === "t" ? tY : bY, bot = staff === "t" ? 2 : -10, top = bot + 8;
    // ledger lines
    const lo = Math.min(...ns.map((n) => n.step), bot), hi = Math.max(...ns.map((n) => n.step), top);
    const wide = ns.some((n, i) => i && n.step - ns[i - 1].step === 1) ? 26 : 12;
    for (let d = bot - 2; d >= lo; d -= 2) s += `<line class="ledger" x1="${nx - 12}" x2="${nx + wide}" y1="${Y(d)}" y2="${Y(d)}"/>`;
    for (let d = top + 2; d <= hi; d += 2) s += `<line class="ledger" x1="${nx - 12}" x2="${nx + wide}" y1="${Y(d)}" y2="${Y(d)}"/>`;
    // seconds sit on alternate sides of the stem position
    let prev = null, flip = false;
    const accCols = [];
    ns.forEach((n) => {
      flip = prev !== null && n.step - prev === 1 ? !flip : false;
      prev = n.step;
      const x0 = nx + (flip ? 13.5 : 0), y = Y(n.step);
      s += `<ellipse class="head" cx="${x0}" cy="${y}" rx="7.4" ry="5.2" transform="rotate(-20 ${x0} ${y})"/>`;
      const shown = n.acc !== sigAcc[((n.step % 7) + 7) % 7];
      if (shown) {
        let col = 0;
        while (accCols.some((a) => a.col === col && Math.abs(a.step - n.step) < 6)) col++;
        accCols.push({ col, step: n.step });
        const [g, c] = ACC_GLYPH[n.acc];
        s += glyph(GLYPH[g], nx - 22 - col * 12, y + c * GS);
      }
    });
  }
  return s;
}
export const GRAND_H = 214;

// ---------- note sequence on a grand staff (arpeggios) ----------
// cols: [{ notes: [{ step, acc, hand }], fingers: { rh, lh }, state }]. No key signature:
// every sharp or flat is written. RH fingering above the treble staff, LH below the bass.
export function seqStaff(cols, { fingering = true, current = -1 } = {}) {
  const X0 = 80, DX = 30, W = X0 + cols.length * DX + 16;
  const onTreble = (n) => (n.staff ? n.staff === "t" : n.m >= 60);
  const yOfNote = (n) => (onTreble(n) ? tY(n.step) : bY(n.step));
  const ys = cols.flatMap((c) => c.notes.map(yOfNote));
  const top = Math.min(G.tBot - 60, ...ys.map((y) => y - 10)) - (fingering ? 18 : 0);
  const bottom = Math.max(G.bBot + 12, ...ys.map((y) => y + 10)) + (fingering ? 20 : 0);
  let s = `<svg viewBox="0 ${top} ${W} ${bottom - top}" role="img" aria-label="Arpeggio notation">`;
  for (let i = 0; i < 5; i++) {
    s += `<line class="staffline" x1="14" x2="${W - 4}" y1="${G.tBot - i * 12}" y2="${G.tBot - i * 12}"/>`;
    s += `<line class="staffline" x1="14" x2="${W - 4}" y1="${G.bBot - i * 12}" y2="${G.bBot - i * 12}"/>`;
  }
  s += `<line class="barline" x1="14" x2="14" y1="${G.tBot - 48}" y2="${G.bBot}"/><line class="barline" x1="${W - 4}" x2="${W - 4}" y1="${G.tBot - 48}" y2="${G.bBot}"/>`;
  s += glyph(GLYPH.clef, 20, G.tBot);
  s += `<path class="glyph" d="${GLYPH.bass}" transform="translate(22 ${G.bBot - 36 + 644 * BASS_S}) scale(${BASS_S} ${-BASS_S})"/>`;
  cols.forEach((c, i) => {
    const x = X0 + i * DX;
    s += `<g class="sq${c.state ? " " + c.state : ""}${i === current ? " cur" : ""}">`;
    if (i === current) s += `<rect class="sq-cur" x="${x - 14}" y="${top + 2}" width="28" height="${bottom - top - 4}" rx="5"/>`;
    for (const n of c.notes) {
      const treble = onTreble(n), Y = treble ? tY : bY, lo = treble ? 2 : -10, hi = lo + 8, y = Y(n.step);
      for (let d = lo - 2; d >= n.step; d -= 2) s += `<line class="ledger" x1="${x - 10}" x2="${x + 10}" y1="${Y(d)}" y2="${Y(d)}"/>`;
      for (let d = hi + 2; d <= n.step; d += 2) s += `<line class="ledger" x1="${x - 10}" x2="${x + 10}" y1="${Y(d)}" y2="${Y(d)}"/>`;
      s += `<ellipse class="head" cx="${x}" cy="${y}" rx="6.6" ry="4.7" transform="rotate(-20 ${x} ${y})"/>`;
      if (n.acc) { const [g, cc] = ACC_GLYPH[n.acc]; s += glyph(GLYPH[g], x - 17, y + cc * GS); }
    }
    if (fingering) {
      if (c.fingers.rh) s += `<text class="fing" x="${x}" y="${top + 13}">${c.fingers.rh}</text>`;
      if (c.fingers.lh) s += `<text class="fing" x="${x}" y="${bottom - 6}">${c.fingers.lh}</text>`;
    }
    s += `</g>`;
  });
  return s + `</svg>`;
}
