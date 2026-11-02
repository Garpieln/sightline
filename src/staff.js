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
