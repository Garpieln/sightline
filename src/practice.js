// Practice a progression: play-along at tempo or wait mode, optionally through all 12 keys
// around the circle of fifths, with chord names or Roman numerals only.
import { $ } from "./dom.js";
import { CFG, saveCfg, addSession } from "./state.js";
import { keyName, sigShort, identify } from "./theory.js";
import { toChord, numeral, matches, circleKeys } from "./progmodel.js";
import { audio, click } from "./audio.js";
import { stopAll } from "./sound.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const P = {
  prog: null, baseKey: null, keys: [], ki: 0, running: false, raf: 0, t0: 0, beatMs: 750, clickBeat: 0,
  starts: [], total: 0, idx: 0, results: [], held: new Map(), heardAt: 0, wrongTimer: 0, lastWrong: "",
  onExit: null, summary: null,
};
const opt = () => CFG.pr || (CFG.pr = { mode: "tempo", all12: false, dir: -1, hide: false, metro: true, tempo: null });

export function init({ onExit }) { P.onExit = onExit; }

export function open(prog, key) {
  stop();
  P.prog = prog;
  P.baseKey = key;
  P.summary = null;
  opt().tempo = null;
  render();
}

const tempo = () => opt().tempo || P.prog.tempo;
const curKey = () => P.keys[P.ki] || P.baseKey;

// ---------- view ----------
export function render() {
  const o = opt(), p = P.prog;
  if (!p) return;
  const k = curKey();
  $("#pgMain").innerHTML = `<div class="sheet pr">
    <div class="pg-head"><div><span class="eyebrow">Practice</span><h2>${esc(p.name)}</h2></div>
      <div class="btns"><button class="btn primary" data-pr="start">${P.running ? "■ Stop" : "▶ Start"}</button><button class="btn" data-pr="exit">Back</button></div></div>
    <div class="pr-opts">
      <div class="field"><span class="lbl">Mode</span><div class="seg" id="prMode"><button data-v="tempo" aria-pressed="${o.mode === "tempo"}">Play-along</button><button data-v="wait" aria-pressed="${o.mode === "wait"}">Wait</button></div></div>
      <div class="field"><span class="lbl">Tempo <output>${tempo()} bpm</output></span><input type="range" id="prTempo" min="40" max="200" step="2" value="${tempo()}"${o.mode === "wait" ? " disabled" : ""}></div>
      <label class="check"><input type="checkbox" id="prAll"${o.all12 ? " checked" : ""}> All 12 keys</label>
      <label class="check"><input type="checkbox" id="prDir"${o.dir === 1 ? " checked" : ""}${o.all12 ? "" : " disabled"}> Go clockwise (up a fifth)</label>
      <label class="check"><input type="checkbox" id="prHide"${o.hide ? " checked" : ""}> Roman numerals only</label>
      <label class="check"><input type="checkbox" id="prMetro"${o.metro ? " checked" : ""}> Metronome</label>
    </div>
    <div class="pr-key"><span class="eyebrow">Key</span><b id="prKeyName">${esc(keyName(k))}</b><span class="hint">${sigShort(k) === "0" ? "no sharps or flats" : sigShort(k)}${P.keys.length > 1 ? ` · key ${P.ki + 1} of 12` : ""}</span><span class="pr-count" id="prCount"></span></div>
    <div class="pr-tl" id="prTl">${track(k)}</div>
    <div class="pr-status"><span id="prNow" class="pr-now"></span><span id="prHeard" class="hint"></span></div>
    <div id="prSummary">${P.summary || ""}</div>
    <p class="hint">${o.mode === "tempo" ? "Play each chord as the cursor reaches it. Any inversion counts, and 5ths are optional. Green: on time. Amber: late. Red: missed." : "Take your time. The cursor waits until you play the chord."}</p>
  </div>`;
}

function track(k) {
  const p = P.prog, o = opt();
  const total = p.chords.reduce((a, c) => a + c.beats, 0);
  let s = `<div class="pr-cursor" id="prCursor"></div><div class="tl">`;
  p.chords.forEach((c, i) => {
    const ch = toChord(c, k), r = P.results[i];
    s += `<div class="tl-chord pr-chord${r ? " " + r.state : ""}${P.running && P.idx === i && o.mode === "wait" ? " playing" : ""}" style="flex-grow:${c.beats}" id="prc${i}">
      ${o.hide ? "" : `<b>${esc(ch.sym)}</b>`}<small>${esc(numeral(c, k))}</small></div>`;
  });
  return s + `</div><div class="tl-beats">${total} beats · ${P.prog.meter}/4</div>`;
}

// ---------- engine ----------
function layout() {
  P.starts = [];
  let b = 0;
  for (const c of P.prog.chords) { P.starts.push(b); b += c.beats; }
  P.total = b;
  P.results = P.prog.chords.map(() => null);
}

function start() {
  const o = opt();
  audio();
  stopAll();
  P.keys = o.all12 ? circleKeys(P.baseKey, o.dir) : [P.baseKey];
  P.ki = 0;
  P.allResults = [];
  P.summary = null;
  P.running = true;
  beginPass(true);
}

function beginPass(first) {
  layout();
  P.idx = 0;
  P.beatMs = 60000 / tempo();
  const countBeats = opt().mode === "tempo" ? P.prog.meter : 0;
  P.t0 = performance.now() + (first ? 300 : 120) + countBeats * P.beatMs;
  P.clickBeat = -countBeats;
  P.waitStart = performance.now();
  render();
  cancelAnimationFrame(P.raf);
  P.raf = requestAnimationFrame(loop);
}

export function stop() {
  if (!P.running) return;
  P.running = false;
  cancelAnimationFrame(P.raf);
}

function mark(i, state, dt = null) {
  P.results[i] = { state, dt };
  const el = document.getElementById("prc" + i);
  if (el) { el.classList.remove("ok", "late", "miss", "playing"); el.classList.add(state); }
}

function loop(now) {
  if (!P.running) return;
  const o = opt(), chords = P.prog.chords, k = curKey();
  const cur = $("#prCursor"), count = $("#prCount");
  if (o.mode === "tempo") {
    const beat = (now - P.t0) / P.beatMs;
    while (P.clickBeat < P.total && P.t0 + P.clickBeat * P.beatMs < now + 120) {
      const b = P.clickBeat;
      if (o.metro || b < 0) click(P.t0 + b * P.beatMs, ((b % P.prog.meter) + P.prog.meter) % P.prog.meter === 0);
      P.clickBeat++;
    }
    if (count) count.textContent = beat < 0 ? String(Math.ceil(-beat)) : "";
    if (cur) cur.style.left = `${(Math.max(0, Math.min(beat, P.total)) / P.total) * 100}%`;
    // Close any chord whose window has passed without a match.
    for (let i = 0; i < chords.length; i++) {
      const end = P.starts[i] + chords[i].beats;
      if (!P.results[i] && beat > end - 0.35) mark(i, "miss");
    }
    const active = chords.findIndex((c, i) => beat >= P.starts[i] - 0.35 && beat < P.starts[i] + c.beats - 0.35);
    P.idx = active;
    const now$ = $("#prNow");
    if (now$) now$.textContent = active >= 0 ? (o.hide ? numeral(chords[active], k) : `${toChord(chords[active], k).sym}  ·  ${numeral(chords[active], k)}`) : "";
    check(now);
    if (beat >= P.total) { endPass(); return; }
  } else {
    if (cur) cur.style.left = `${(P.starts[P.idx] / P.total) * 100}%`;
    const now$ = $("#prNow");
    if (now$) now$.textContent = o.hide ? numeral(chords[P.idx], k) : `${toChord(chords[P.idx], k).sym}  ·  ${numeral(chords[P.idx], k)}`;
  }
  P.raf = requestAnimationFrame(loop);
}

// Grade the notes currently held against the active chord.
function check(now) {
  const o = opt(), i = P.idx, chords = P.prog.chords;
  if (i < 0 || i >= chords.length || P.results[i]) return;
  const held = [...P.held.keys()];
  if (!held.length) return;
  if (matches(held, chords[i], curKey())) {
    if (o.mode === "tempo") {
      const beat = (now - P.t0) / P.beatMs, dt = beat - P.starts[i];
      mark(i, dt <= 0.5 ? "ok" : "late", dt);
    } else {
      mark(i, "ok", (now - P.waitStart) / 1000);
      P.idx++;
      P.waitStart = now;
      if (P.idx >= chords.length) { endPass(); return; }
      const el = document.getElementById("prc" + P.idx); if (el) el.classList.add("playing");
    }
    $("#prHeard").textContent = "";
  }
}

export function handleNote(m, ts) {
  if (!P.running) return;
  P.held.set(m, ts);
  check(ts);
  // Say what was played if it's wrong and held steady.
  clearTimeout(P.wrongTimer);
  P.wrongTimer = setTimeout(() => {
    const i = P.idx, chords = P.prog.chords;
    if (!P.running || i < 0 || i >= chords.length || P.results[i] || P.held.size < 2) return;
    const ch = identify([...P.held.keys()], curKey());
    const h = $("#prHeard");
    if (h && ch) h.textContent = `You're playing ${ch.label}`;
  }, 280);
}
export function handleNoteOff(m) {
  P.held.delete(m);
  if (!P.held.size) { const h = $("#prHeard"); if (h) h.textContent = ""; }
}

function endPass() {
  const k = curKey();
  P.allResults.push({ key: k, results: P.results.slice() });
  if (P.ki < P.keys.length - 1) {
    P.ki++;
    beginPass(false);
    return;
  }
  P.running = false;
  cancelAnimationFrame(P.raf);
  summarize();
  render();
}

function summarize() {
  const o = opt(), all = P.allResults.flatMap((r) => r.results);
  const n = all.length, ok = all.filter((r) => r && r.state === "ok").length, late = all.filter((r) => r && r.state === "late").length;
  const got = ok + late;
  // Which numerals gave trouble, across keys.
  const trouble = {};
  P.allResults.forEach(({ key, results }) => results.forEach((r, i) => { if (!r || r.state === "miss") { const nm = numeral(P.prog.chords[i], key); trouble[nm] = (trouble[nm] || 0) + 1; } }));
  const perKey = P.allResults.length > 1 ? `<div class="pr-keys">${P.allResults.map(({ key, results }) => { const g = results.filter((r) => r && r.state !== "miss").length; const f = g / results.length; return `<span class="chip ${f >= 0.9 ? "" : f >= 0.6 ? "mid" : "badc"}">${esc(keyName(key).replace(" major", "").replace(" minor", "m"))} ${g}/${results.length}</span>`; }).join("")}</div>` : "";
  const waitTimes = o.mode === "wait" ? all.filter((r) => r && r.dt != null).map((r) => r.dt) : [];
  const avgWait = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : null;
  addSession({ t: Date.now(), m: "prog", key: P.baseKey.id, n, acc: +(got / n).toFixed(3), ot: o.mode === "tempo" ? +(ok / n).toFixed(3) : null, bpm: o.mode === "tempo" ? tempo() : null, name: P.prog.name });
  const cls = (v) => (v >= 0.9 ? "good" : v >= 0.7 ? "mid" : "low");
  let advice;
  if (o.mode === "wait") advice = avgWait && avgWait < 1.5 ? "Quick and accurate. Try Play-along mode next." : "Keep going in Wait mode until each change takes under about 1.5 seconds.";
  else if (got / n >= 0.9 && ok / n >= 0.8) advice = o.all12 ? "Strong in every key. Raise the tempo." : "Solid. Try All 12 keys, or turn on Roman numerals only.";
  else if (got / n < 0.7) advice = "Too fast for now. Lower the tempo or switch to Wait mode.";
  else advice = "Mostly there. Look ahead to the next chord while holding the current one.";
  P.summary = `<div class="summary"><h3>Results</h3><div class="tiles">
    <div class="tile"><div class="k">Chords played</div><div class="v ${cls(got / n)}">${Math.round((100 * got) / n)}%</div><div class="s">${got} of ${n}</div></div>
    ${o.mode === "tempo" ? `<div class="tile"><div class="k">On time</div><div class="v ${cls(ok / n)}">${Math.round((100 * ok) / n)}%</div><div class="s">${late} late</div></div>` : `<div class="tile"><div class="k">Avg change time</div><div class="v">${avgWait ? avgWait.toFixed(2) + " s" : "–"}</div></div>`}
    ${P.allResults.length > 1 ? `<div class="tile"><div class="k">Keys</div><div class="v">${P.allResults.length}</div></div>` : ""}</div>
    ${perKey}
    ${Object.keys(trouble).length ? `<p class="hint" style="margin-bottom:6px">Chords to review:</p><div class="chips">${Object.entries(trouble).map(([k, v]) => `<span class="chip badc">${esc(k)} ×${v}</span>`).join("")}</div>` : ""}
    <div class="advice">${advice}</div></div>`;
}

// ---------- controls ----------
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-pr], #prMode button");
  if (!b || !b.closest("#pgMain")) return;
  const o = opt();
  if (b.dataset.pr === "start") { if (P.running) { stop(); render(); } else start(); }
  else if (b.dataset.pr === "exit") { stop(); P.onExit && P.onExit(); }
  else if (b.closest("#prMode")) { o.mode = b.dataset.v; saveCfg(); stop(); render(); }
});
document.addEventListener("change", (e) => {
  const t = e.target, o = opt();
  if (!t.closest || !t.closest("#pgMain")) return;
  const map = { prAll: "all12", prHide: "hide", prMetro: "metro" };
  if (map[t.id]) { o[map[t.id]] = t.checked; saveCfg(); if (!P.running) render(); }
  if (t.id === "prDir") { o.dir = t.checked ? 1 : -1; saveCfg(); }
});
document.addEventListener("input", (e) => {
  if (e.target.id !== "prTempo") return;
  opt().tempo = +e.target.value;
  e.target.previousElementSibling.querySelector("output").textContent = e.target.value + " bpm";
});
