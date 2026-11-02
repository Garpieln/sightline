// Chords tab: names what you play, places it on the circle of fifths, and suggests
// what to play next, how to enrich the chord, and progressions that contain it.
import { $ } from "./dom.js";
import { CFG, saveCfg } from "./state.js";
import { identify, analyze, diatonic, detectKeys, keyById, keyName, sigText, sigList, sigAcc, relativeOf, suggestNext, suggestColor, suggestProgressions, spName } from "./theory.js";
import { grandStaff, GRAND_H } from "./staff.js";
import { circleSVG } from "./circle.js";

const S = {
  held: new Map(), pedal: false, sustained: new Set(), group: [], maxSimul: 0, lastOn: 0,
  sig: "", result: null, last: null, timer: 0, tick: 0, history: [], released: true,
  key: keyById(CFG.ckey), auto: CFG.cauto, ranked: null,
};
const win = () => CFG.cwindow * 1000;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- note tracking ----------
function currentNotes(now) {
  const set = new Set([...S.held.keys(), ...S.sustained]);
  if (CFG.cwindow > 0) for (const g of S.group) if (g.t >= now - win()) set.add(g.m);
  return [...set];
}

export function handleNote(m, t) {
  const sounding = S.held.size + S.sustained.size;
  // A new attack after a released block chord, or after a pause, starts a new group.
  if (sounding === 0 && (S.maxSimul >= 3 || t - S.lastOn > win())) { S.group = []; S.maxSimul = 0; }
  S.held.set(m, t);
  S.group.push({ m, t });
  S.lastOn = t;
  S.maxSimul = Math.max(S.maxSimul, S.held.size + S.sustained.size);
  update();
}
export function handleNoteOff(m) {
  if (S.held.delete(m) && S.pedal) S.sustained.add(m);
  update();
}
export function handlePedal(down) {
  S.pedal = down;
  if (!down) S.sustained.clear();
  update();
}

function update() {
  const notes = currentNotes(performance.now()).sort((a, b) => a - b);
  const sig = notes.join(",");
  if (sig === S.sig) return;
  S.sig = sig;
  clearTimeout(S.timer);
  if (!notes.length) { S.result = null; S.released = true; render(); return; }
  S.result = identify(notes, S.key);
  S.last = S.result;
  if (S.result.kind === "chord") S.timer = setTimeout(() => commit(notes), 350);
  render();
}

function commit(midis) {
  const res = identify(midis, S.key);
  const prev = S.history[S.history.length - 1];
  if (prev && !S.released && identify(prev.midis, S.key).sym === res.sym) return;
  S.history.push({ midis });
  if (S.history.length > 12) S.history.shift();
  S.released = false;
  if (S.auto) detect();
  render();
}

function detect() {
  const events = S.history.slice(-8).map((h) => ({ chord: identify(h.midis, S.key) })).filter((e) => e.chord.kind === "chord");
  if (!events.length) return;
  S.ranked = detectKeys(events);
  const best = S.ranked[0], cur = S.ranked.find((r) => r.key.id === S.key.id);
  // Switch only on solid evidence: three or more chords, or recent chords that don't fit the current key.
  const misfit = events.slice(-2).some((e) => [...e.chord.pcs].some((p) => !S.key.pcs.has(p)));
  if (best.key.id !== S.key.id && best.score > cur.score + 0.5 && (events.length >= 3 || misfit)) setKey(best.key, true);
}

function setKey(k, auto) {
  S.key = k;
  S.auto = auto;
  CFG.ckey = k.id; CFG.cauto = auto; saveCfg();
  if (S.result) S.result = identify(currentNotes(performance.now()), S.key);
  if (S.last && S.last.notes) S.last = identify(S.last.notes.map((n) => n.m), S.key);
}

// ---------- rendering ----------
const notesText = (ch) => ch.tones.map(spName).join(" ");

function staffFor(res) {
  const notes = res ? res.notes.map((n) => ({ step: n.sp.l + 7 * (n.oct - 4), acc: n.sp.a, staff: n.m >= 60 ? "t" : "b" })) : [];
  return `<svg viewBox="-4 0 368 ${GRAND_H}" role="img" aria-label="Notes on the grand staff">${grandStaff(notes, sigList(S.key), sigAcc(S.key), 360)}</svg>`;
}

function readout(res, live) {
  const head = live ? "You're playing" : res ? "Last played" : "Play two or more notes";
  if (!res) {
    return `<div class="eyebrow">${head}</div><div class="ch-sym muted">—</div>
      <p class="ch-desc">Hold a chord on your keyboard, or use computer keys (A S D F G … are white keys from middle C). Broken chords and the sustain pedal count too.</p>`;
  }
  let h = `<div class="eyebrow">${head}</div><div class="ch-sym${live ? "" : " muted"}">${esc(res.label)}</div><p class="ch-desc">${esc(res.desc)}</p>`;
  if (res.kind === "chord") {
    const an = analyze(res, S.key);
    h += `<div class="ch-chips"><span class="pill num">${esc(an.numeral)}</span><span class="pill ${an.kind}">${esc(an.func)}</span></div>`;
    if (an.note) h += `<p class="hint">${esc(an.note)}</p>`;
    if (res.alts && res.alts.length) h += `<p class="hint">Also reads as ${res.alts.map((a) => `<b>${esc(a.sym)}</b>`).join(" or ")}.</p>`;
  }
  h += `<p class="ch-notes">${res.notes.map((n) => `<span>${spName(n.sp)}<sub>${n.oct}</sub></span>`).join("")}</p>`;
  return h;
}

function focusChord(res) {
  if (res && res.kind === "chord") return { chord: res, example: false };
  if (S.last && S.last.kind === "chord") return { chord: S.last, example: false };
  const tonic = diatonic(S.key)[0];
  tonic.kind = "chord";
  return { chord: tonic, example: true };
}

function render() {
  const live = !!S.result;
  const res = S.result || S.last;
  const { chord, example } = focusChord(S.result);
  const an = analyze(chord, S.key);
  const next = suggestNext(chord, an, S.key);
  const color = suggestColor(chord, an, S.key);
  const progs = suggestProgressions(an, S.key);
  const showNotes = CFG.cnotes;

  $("#chReadout").innerHTML = readout(res, live);
  $("#chStaff").innerHTML = staffFor(res);

  // key panel
  const alt = S.ranked && S.ranked[1] && S.ranked[0].key.id === S.key.id ? S.ranked[1].key : relativeOf(S.key);
  $("#chKey").innerHTML = `<b>${keyName(S.key)}</b> <span class="hint">· ${sigText(S.key)}</span>`;
  $("#chKeyAlt").textContent = S.auto ? `Detected from your recent chords. Could also be ${keyName(alt)}. Click any key on the circle to lock it.` : "Locked. Switch to Auto to follow what you play.";
  $$seg("#chMode", S.auto ? "auto" : "lock");
  $("#chCircle").innerHTML = circleSVG({ key: S.key, current: S.result && S.result.kind === "chord" ? S.result : null, suggestions: next, auto: S.auto });

  // diatonic row
  const row = diatonic(S.key, CFG.csev);
  $("#chDiatonic").innerHTML = row.map((c) => {
    const here = an && an.kind === "diatonic" && (an.role === String(c.degree) && c.func !== "Subtonic" || an.role === "6n" && c.func === "Subtonic");
    return `<div class="dchip${here ? " here" : ""}" title="${esc(c.func)}${showNotes ? ": " + esc(notesText(c)) : ""}"><span class="num">${esc(c.numeral)}</span><b>${esc(c.sym)}</b>${showNotes ? `<small>${esc(notesText(c))}</small>` : ""}</div>`;
  }).join("");
  $("#chDiaTitle").textContent = `Chords in ${keyName(S.key)}`;

  // suggestions
  $("#chFor").textContent = example ? `Ideas for ${chord.sym}, the home chord of ${keyName(S.key)}. Play something to update.` : `Ideas for ${chord.sym} in ${keyName(S.key)}.`;
  $("#chNext").innerHTML = next.length ? next.map((s, i) => `<li>
      <span class="badge-n">${i + 1}</span>
      <div class="sug-body"><div class="sug-head"><b class="sym">${esc(s.chord.sym)}</b><span class="num">${esc(s.chord.numeral || "")}</span><span class="str ${s.strength.toLowerCase()}">${s.strength}</span></div>
      <p>${esc(s.why)}</p>
      <p class="meta">${[s.circle && "Circle: " + s.circle, s.common.length ? "Shares " + s.common.join(", ") : "No shared notes"].filter(Boolean).join(" · ")}${showNotes ? ` · Notes: ${esc(notesText(s.chord))}` : ""}</p></div></li>`).join("")
    : `<li class="empty">No suggestions for this chord.</li>`;
  $("#chColor").innerHTML = color.length ? color.map((s) => `<li><div class="sug-body"><div class="sug-head"><b class="sym">${esc(s.chord.sym)}</b><span class="num">${esc(s.chord.numeral)}</span></div>
      <p>${esc(s.why)}</p><p class="meta">${showNotes ? `Add ${esc(s.add.join(", "))}${s.remove.length ? `, remove ${esc(s.remove.join(", "))}` : ""}` : `${s.add.length} note${s.add.length > 1 ? "" : ""} to add${s.remove.length ? `, ${s.remove.length} to remove` : ""}. Work out which, or turn on Show notes.`}</p></div></li>`).join("")
    : `<li class="empty">${chord.kind === "chord" && !["maj", "min", "dim", "maj7", "7", "m7"].includes(chord.tid) ? "This chord is already colored. Try a plain triad to see options." : "No in-key additions for this chord."}</li>`;
  $("#chProgs").innerHTML = progs.map((p) => `<li><div class="prog-head"><b>${esc(p.name)}</b><span class="hint">${esc(p.style)}</span></div>
      <div class="prog">${p.chords.map((c) => `<span class="pchip${c.here ? " here" : ""}"${showNotes && c.chord ? ` title="${esc(notesText(c.chord))}"` : ""}><b>${esc(c.chord ? c.chord.sym : "?")}</b><small>${esc(c.chord ? c.chord.numeral : "")}</small></span>`).join('<span class="arrow">→</span>')}</div></li>`).join("")
    + (progs.length && !progs[0].matched ? `<li class="hint">None of these contain ${esc(chord.sym)}, but they're common in ${keyName(S.key)}.</li>` : "");

  // history
  $("#chHistory").innerHTML = S.history.length ? S.history.map((h) => {
    const c = identify(h.midis, S.key), a = analyze(c, S.key);
    return `<span class="hchip"><b>${esc(c.sym)}</b><small>${a ? esc(a.numeral) : ""}</small></span>`;
  }).join('<span class="arrow">→</span>') : `<span class="hint">Chords you play appear here. The key is detected from them.</span>`;
}

function $$seg(sel, v) { document.querySelectorAll(`${sel} button`).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v))); }

// ---------- lifecycle ----------
export function activate() {
  clearInterval(S.tick);
  S.tick = setInterval(update, 120); // lets broken-chord notes age out of the window
  render();
}
export function deactivate() { clearInterval(S.tick); }

export function initChords() {
  $("#chCircle").addEventListener("click", (e) => {
    const g = e.target.closest("[data-key]");
    if (g) { setKey(keyById(g.dataset.key), false); render(); }
  });
  $("#chCircle").addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-key]");
    if (g && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setKey(keyById(g.dataset.key), false); render(); }
  });
  $("#chMode").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.v === "auto") { S.auto = true; CFG.cauto = true; saveCfg(); detect(); } else { setKey(S.key, false); }
    render();
  });
  $("#chClear").onclick = () => { S.history = []; S.ranked = null; S.last = null; render(); };
  const chk = (id, k) => { const el = $("#" + id); el.checked = CFG[k]; el.onchange = () => { CFG[k] = el.checked; saveCfg(); render(); }; };
  chk("chShowNotes", "cnotes");
  chk("chSev", "csev");
  const w = $("#chWindow"), wo = $("#chWindowOut");
  const syncW = () => { w.value = CFG.cwindow; wo.textContent = CFG.cwindow ? CFG.cwindow + " s" : "Off"; };
  w.oninput = () => { CFG.cwindow = +w.value; saveCfg(); syncW(); };
  syncW();
  render();
}
