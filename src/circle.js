// Circle of fifths as SVG. Outer ring: major keys. Inner ring: relative minors.
// Highlights the active key's six diatonic chords, the chord being played, and
// numbered suggestion badges.
import { makeKey, spName, sigShort, numeralFor, keyName, circleIndexOfPc } from "./theory.js";

const SIZE = 420, CX = 210, CY = 210;
const R = { out: 186, mid: 132, inn: 84 };
const MAJ_LABEL = { 6: "F♯/G♭" }, MIN_LABEL = { 6: "D♯m/E♭m" };
const MINOR_FAMILY = new Set(["min", "m7", "m6", "madd9", "m9", "mmaj7"]);
const MAJOR_FAMILY = new Set(["maj", "maj7", "7", "6", "add9", "maj9", "9", "sus2", "sus4", "7sus4", "5", "aug"]);

const pt = (r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; };
function sector(r1, r2, i) {
  const a0 = i * 30 - 15, a1 = i * 30 + 15;
  const [x1, y1] = pt(r2, a0), [x2, y2] = pt(r2, a1), [x3, y3] = pt(r1, a1), [x4, y4] = pt(r1, a0);
  return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
}

// Where a chord sits on the circle, or null (diminished and other chords aren't on it).
export function cellOf(chord) {
  if (!chord || chord.kind === "interval") return null;
  if (MAJOR_FAMILY.has(chord.tid)) return { ring: "M", i: circleIndexOfPc(chord.rpc) };
  if (MINOR_FAMILY.has(chord.tid)) return { ring: "m", i: circleIndexOfPc(chord.rpc + 3) };
  return null;
}

export function circleSVG({ key, current, suggestions = [], auto, selected = null }) {
  // A minor key sits at the same position as its relative major, so the wedge is the same.
  const inKey = new Set([-1, 0, 1].map((d) => (key.ci + d + 12) % 12));
  const cur = cellOf(current);
  const badges = new Map();
  suggestions.forEach((s, n) => { const c = cellOf(s.chord); if (c) { const k = c.ring + c.i; if (!badges.has(k)) badges.set(k, n + 1); } });

  let s = `<svg viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="Circle of fifths, ${keyName(key)} highlighted">`;
  for (let i = 0; i < 12; i++) {
    for (const ring of ["M", "m"]) {
      const k = makeKey(i, ring === "M" ? "major" : "minor");
      const isTonic = key.ci === i && (ring === "M") === (key.mode === "major");
      const isCur = cur && cur.ring === ring && cur.i === i;
      const cls = ["cell", ring === "M" ? "maj" : "min", inKey.has(i) ? "in-key" : "", isTonic ? "tonic" : "", isCur ? "current" : "", selected === k.id ? "selected" : ""].join(" ");
      const [r1, r2] = ring === "M" ? [R.mid, R.out] : [R.inn, R.mid];
      const label = ring === "M" ? MAJ_LABEL[i] || spName(k.tonic) : MIN_LABEL[i] || spName(k.tonic) + "m";
      const numeral = inKey.has(i) ? numeralFor(k.tonic, ring === "M" ? "maj" : "min", key) : "";
      const [lx, ly] = pt(ring === "M" ? 166 : 116, i * 30);
      const [nx, ny] = pt(ring === "M" ? 146 : 96, i * 30);
      s += `<g class="${cls}" data-key="${k.id}" tabindex="0" role="button" aria-label="${keyName(k)}${numeral ? ", " + numeral : ""}">`;
      s += `<path d="${sector(r1, r2, i)}"/>`;
      s += `<text class="clbl ${label.length > 4 ? "small" : ""}" x="${lx}" y="${ly}">${label}</text>`;
      if (numeral) s += `<text class="numl" x="${nx}" y="${ny}">${numeral}</text>`;
      const b = badges.get(ring + i);
      if (b) { const [bx, by] = pt(ring === "M" ? 177 : 124, i * 30 + (ring === "M" ? 10 : 11)); s += `<circle class="badge" cx="${bx}" cy="${by}" r="8"/><text class="badge-t" x="${bx}" y="${by}">${b}</text>`; }
      s += `</g>`;
    }
    const [sx, sy] = pt(199, i * 30);
    s += `<text class="sigl" x="${sx}" y="${sy}">${sigShort(makeKey(i, "major"))}</text>`;
  }
  s += `<circle class="hub" cx="${CX}" cy="${CY}" r="${R.inn - 4}"/>`;
  s += `<text class="hub-k" x="${CX}" y="${CY - 8}">${keyName(key)}</text>`;
  s += `<text class="hub-s" x="${CX}" y="${CY + 14}">${sigShort(key) === "0" ? "no ♯ or ♭" : sigShort(key)}</text>`;
  s += `<text class="hub-m" x="${CX}" y="${CY + 32}">${auto ? "auto-detected" : "locked"}</text>`;
  return s + `</svg>`;
}
