// Read & play: static page, moving cursor band, pitch + timing grading.
import { $, $$ } from "./dom.js";
import { CFG, saveCfg, nstat, missRate, addSession } from "./state.js";
import { KEYS, midiName, stepOfMidi } from "./music.js";
import { VW, VH, BOT, yOf, staffLines, clefAndKey, noteHead } from "./staff.js";
import { genExercise } from "./generator.js";
import { audio, click } from "./audio.js";
import { playSequence, stopAll } from "./sound.js";

const BARS_PER_SYSTEM = 4;
let EX = null, LAY = null;
const R = { running: false, mode: "tempo", t0: 0, beatMs: 1000, win: 400, raf: 0, judge: 0, idx: 0, clickBeat: 0, stray: 0, curAt: 0, lastSys: -1 };
export const isRunning = () => R.running;

const goodWindow = () => Math.max(80, 0.15 * R.beatMs); // "on time" tolerance in ms
const noteTime = (n) => R.t0 + n.beat * R.beatMs;

function setStatus(b, a, t) { $("#stBeat").textContent = b; $("#stAcc").textContent = a; $("#stTime").textContent = t; }

function renderScore() {
  const ex = EX, sysCount = Math.ceil(ex.bars / BARS_PER_SYSTEM);
  const ck = clefAndKey(ex.key), x0 = ck.x0, beatW = (VW - 6 - x0) / (BARS_PER_SYSTEM * 4);
  LAY = { x0, beatW, sysCount };
  ex.notes.forEach((n) => {
    n.sys = Math.floor(n.bar / BARS_PER_SYSTEM);
    n.x = x0 + (n.beat - n.sys * BARS_PER_SYSTEM * 4 + 0.5) * beatW;
    n.state = null; n.dt = null; n.played = null; n.tries = 0; n.rt = null;
  });
  let html = "";
  for (let s = 0; s < sysCount; s++) {
    const barsHere = Math.min(BARS_PER_SYSTEM, ex.bars - s * BARS_PER_SYSTEM);
    const end = x0 + barsHere * 4 * beatW;
    let svg = `<svg viewBox="0 0 ${VW} ${VH}" id="sys${s}" role="img" aria-label="Staff line ${s + 1}">`;
    svg += `<rect class="cursor" id="cur${s}" x="0" y="18" width="${beatW}" height="98" rx="6" opacity="0"/>`;
    svg += staffLines(end) + ck.svg;
    for (let b = 1; b <= barsHere; b++) {
      const x = x0 + b * 4 * beatW;
      const last = s === sysCount - 1 && b === barsHere;
      svg += last
        ? `<line class="barline" x1="${x - 5}" x2="${x - 5}" y1="40" y2="${BOT}"/><rect class="glyph" x="${x - 3}" y="40" width="4" height="48"/>`
        : `<line class="barline" x1="${x}" x2="${x}" y1="40" y2="${BOT}"/>`;
    }
    if (s === 0) svg += `<text class="countin" id="countin" x="${VW / 2}" y="80" text-anchor="middle"></text>`;
    ex.notes.forEach((n, i) => { if (n.sys === s) svg += `<g class="note" id="n${i}">${noteHead(n.x, n.d, n.dur)}<g class="fb"></g></g>`; });
    html += svg + "</svg>";
  }
  $("#score").innerHTML = html;
  $("#exTitle").textContent = `Exercise ${ex.id}`;
  $("#exMeta").textContent = `${KEYS[ex.key].label} · ${ex.bars} bars · ${ex.notes.length} notes · 4/4`;
  $("#readSummary").hidden = true;
  setStatus("–", "–", "–");
}

function markNote(i, force) {
  const n = EX.notes[i], g = document.getElementById("n" + i);
  if (!g) return;
  if (CFG.feedback === "summary" && !force && R.running) return;
  g.classList.remove("ok", "off", "bad", "miss");
  if (n.state) g.classList.add(n.state);
  let fb = "";
  if (n.played != null && n.played !== n.midi) {
    const y = yOf(stepOfMidi(n.played, EX.key));
    fb += `<ellipse class="ghost" cx="${n.x + 16}" cy="${y}" rx="6.4" ry="4.6" transform="rotate(-20 ${n.x + 16} ${y})"/>`;
  }
  if (n.dt != null && R.mode === "tempo") {
    const off = Math.max(-0.5, Math.min(0.5, n.dt / R.beatMs)) * LAY.beatW;
    fb += `<line class="ref" x1="${n.x}" x2="${n.x}" y1="120" y2="132"/><line class="tick" stroke="currentColor" x1="${n.x + off}" x2="${n.x + off}" y1="122" y2="130"/>`;
  }
  g.querySelector(".fb").innerHTML = fb;
}

export function newExercise() {
  if (R.running) stop(true);
  EX = genExercise(CFG, missRate);
  renderScore();
}

export function retry() {
  if (R.running) stop(true);
  if (EX) { renderScore(); toggle(); }
}

export function toggle() {
  if (R.running) { stop(true); return; }
  audio();
  stopAll();
  hearing = false;
  renderScore();
  R.mode = CFG.mode;
  R.beatMs = 60000 / CFG.bpm;
  R.win = Math.min(0.5 * R.beatMs, 450);
  R.judge = 0; R.idx = 0; R.stray = 0; R.lastSys = -1;
  const countBeats = R.mode === "tempo" && CFG.countin ? 4 : 0;
  R.t0 = performance.now() + 250 + countBeats * R.beatMs;
  R.clickBeat = -countBeats;
  R.curAt = performance.now();
  R.running = true;
  $("#readStart").firstChild.textContent = "Stop ";
  cancelAnimationFrame(R.raf);
  R.raf = requestAnimationFrame(loop);
}

export function stop(user) {
  R.running = false;
  cancelAnimationFrame(R.raf);
  $("#readStart").firstChild.textContent = "Start ";
  $$(".cursor").forEach((c) => c.setAttribute("opacity", "0"));
  const ci = $("#countin");
  if (ci) ci.textContent = "";
  if (user) setStatus("stopped", "–", "–");
}

function placeCursor(sys, x) {
  if (sys !== R.lastSys) {
    $$(".cursor").forEach((c) => c.setAttribute("opacity", "0"));
    R.lastSys = sys;
    const svg = document.getElementById("sys" + sys);
    if (svg) {
      const r = svg.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight) svg.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }
  const c = document.getElementById("cur" + sys);
  if (c) { c.setAttribute("opacity", "1"); c.setAttribute("x", x - LAY.beatW / 2); }
}

const pct = (f) => { const j = EX.notes.filter((n) => n.state); return j.length ? Math.round((100 * j.filter(f).length) / j.length) + "%" : "–"; };
const liveAcc = () => pct((n) => n.state === "ok" || n.state === "off");
const liveTime = () => pct((n) => n.state === "ok");

function loop(now) {
  if (!R.running) return;
  const notes = EX.notes, hide = CFG.feedback === "summary";
  if (R.mode === "tempo") {
    const beat = (now - R.t0) / R.beatMs;
    while (R.clickBeat < EX.total && R.t0 + R.clickBeat * R.beatMs < now + 120) {
      const b = R.clickBeat;
      if (CFG.metro || b < 0) click(R.t0 + b * R.beatMs, ((b % 4) + 4) % 4 === 0);
      R.clickBeat++;
    }
    const ci = $("#countin");
    if (ci) ci.textContent = beat < 0 ? String(Math.ceil(-beat)) : "";
    const b = Math.max(-0.5, Math.min(beat, EX.total - 0.5));
    const sys = Math.min(LAY.sysCount - 1, Math.max(0, Math.floor(Math.max(b, 0) / (BARS_PER_SYSTEM * 4))));
    placeCursor(sys, LAY.x0 + (b - sys * BARS_PER_SYSTEM * 4 + 0.5) * LAY.beatW);
    if (beat >= 0) setStatus(`${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`, hide ? "–" : liveAcc(), hide ? "–" : liveTime());
    while (R.judge < notes.length && now - CFG.offset > noteTime(notes[R.judge]) + R.win) {
      const n = notes[R.judge];
      if (!n.state) { n.state = "miss"; markNote(R.judge); }
      R.judge++;
    }
    if (R.judge >= notes.length) { finish(); return; }
  } else {
    const n = notes[R.idx];
    placeCursor(n.sys, n.x);
    setStatus(`${R.idx + 1}/${notes.length}`, hide ? "–" : liveAcc(), "–");
  }
  R.raf = requestAnimationFrame(loop);
}

export function handleNote(m, ts) {
  if (!R.running || !EX) return;
  const notes = EX.notes;
  if (R.mode === "tempo") {
    const t = ts - CFG.offset;
    let best = -1, bd = 1e9;
    for (let i = R.judge; i < notes.length && i < R.judge + 4; i++) {
      const n = notes[i];
      if (n.state) continue;
      const dt = t - noteTime(n);
      if (Math.abs(dt) <= R.win && Math.abs(dt) < bd) { bd = Math.abs(dt); best = i; }
    }
    if (best < 0) { R.stray++; return; }
    const n = notes[best];
    n.dt = t - noteTime(n);
    n.played = m;
    n.state = m === n.midi ? (Math.abs(n.dt) <= goodWindow() ? "ok" : "off") : "bad";
    markNote(best);
  } else {
    const n = notes[R.idx];
    if (m === n.midi) {
      n.state = n.tries ? "bad" : "ok";
      n.rt = ts - R.curAt;
      markNote(R.idx);
      R.idx++; R.curAt = ts;
      if (R.idx >= notes.length) finish();
    } else {
      n.tries++;
      n.played = n.played ?? m;
      const g = document.getElementById("n" + R.idx);
      if (g && CFG.feedback === "live") { g.classList.remove("flash"); void g.getBBox(); g.classList.add("flash"); }
    }
  }
}

function finish() {
  stop(false);
  const ns = EX.notes, N = ns.length, tempo = R.mode === "tempo";
  ns.forEach((n, i) => markNote(i, true));
  const right = ns.filter((n) => n.state === "ok" || n.state === "off").length;
  const onTime = ns.filter((n) => n.state === "ok").length;
  const miss = ns.filter((n) => n.state === "miss").length;
  const timed = ns.filter((n) => n.dt != null && n.played === n.midi);
  const meanAbs = timed.length ? timed.reduce((a, n) => a + Math.abs(n.dt), 0) / timed.length : null;
  const meanSigned = timed.length ? timed.reduce((a, n) => a + n.dt, 0) / timed.length : null;
  const acc = right / N, ot = onTime / N;
  ns.forEach((n) => { const s = nstat(n.midi); s.rs++; if (n.state === "ok" || n.state === "off") s.ro++; });
  const rts = ns.filter((n) => n.rt).map((n) => n.rt);
  const avgRt = rts.length ? rts.reduce((a, b) => a + b, 0) / rts.length : null;
  addSession({ t: Date.now(), m: tempo ? "read" : "wait", key: EX.key, bpm: tempo ? CFG.bpm : null, n: N, acc: +acc.toFixed(3), ot: tempo ? +ot.toFixed(3) : null, abs: meanAbs ? Math.round(meanAbs) : null });

  const trouble = {};
  ns.filter((n) => n.state === "bad" || n.state === "miss").forEach((n) => { const k = midiName(n.midi, EX.key); trouble[k] = (trouble[k] || 0) + 1; });
  const cls = (v) => (v >= 0.9 ? "good" : v >= 0.7 ? "mid" : "low");

  let advice, sugg = null;
  if (!tempo) advice = acc >= 0.9 ? "Accurate in Wait mode. Switch to Tempo mode to add the time pressure of real sight-reading." : "Keep working in Wait mode. Say each note name out loud before you play it.";
  else if (acc >= 0.9 && ot >= 0.8) { sugg = Math.min(160, CFG.bpm + 6); advice = `Strong run. Raise the tempo to ${sugg} bpm, or widen the range.`; }
  else if (acc < 0.7) { sugg = Math.max(30, CFG.bpm - 8); advice = `Too fast to read cleanly. Drop to ${sugg} bpm. Accuracy first, speed later.`; }
  else if (ot < 0.6) advice = meanSigned > 0 ? "Pitches are mostly right but you're late. Look one or two notes ahead of the band instead of at it." : "Pitches are mostly right but you're early. Let the band reach each note before you play it.";
  else advice = "Solid. Run a new exercise at this tempo, aiming to keep going through mistakes without stopping.";

  const lean = meanSigned == null ? "" : Math.abs(meanSigned) < 25 ? "Centered on the beat" : meanSigned > 0 ? `Tends late by ${Math.round(meanSigned)} ms` : `Tends early by ${Math.round(-meanSigned)} ms`;
  const el = $("#readSummary");
  el.hidden = false;
  el.innerHTML = `<h3>Run summary</h3>
  <div class="tiles">
    <div class="tile"><div class="k">Correct notes</div><div class="v ${cls(acc)}">${Math.round(acc * 100)}%</div><div class="s">${right} of ${N}${miss ? ` · ${miss} missed` : ""}</div></div>
    ${tempo ? `<div class="tile"><div class="k">On time</div><div class="v ${cls(ot)}">${Math.round(ot * 100)}%</div><div class="s">within ±${Math.round(goodWindow())} ms</div></div>
    <div class="tile"><div class="k">Avg timing error</div><div class="v">${meanAbs == null ? "–" : Math.round(meanAbs) + " ms"}</div><div class="s">${lean}</div></div>
    <div class="tile"><div class="k">Extra presses</div><div class="v">${R.stray}</div><div class="s">Notes played outside any beat</div></div>`
    : `<div class="tile"><div class="k">Avg response</div><div class="v">${avgRt ? (avgRt / 1000).toFixed(2) + " s" : "–"}</div><div class="s">From cursor arrival to correct note</div></div>`}
  </div>
  <div class="advice">${advice}</div>
  ${Object.keys(trouble).length ? `<p class="hint" style="margin-bottom:6px">Notes to review (they'll appear more often):</p><div class="chips">${Object.entries(trouble).map(([k, v]) => `<span class="chip badc">${k} ×${v}</span>`).join("")}</div>` : ""}
  <div class="btns" style="margin-top:14px"><button class="btn primary" data-act="retry">Retry same <kbd>R</kbd></button><button class="btn" data-act="new">New exercise <kbd>N</kbd></button><button class="btn" data-act="hear">Hear it</button>${sugg ? `<button class="btn" data-act="tempo" data-v="${sugg}">Set tempo to ${sugg}</button>` : ""}</div>`;
  setStatus("done", Math.round(acc * 100) + "%", tempo ? Math.round(ot * 100) + "%" : "–");
}

// Play the exercise back at the current tempo, after a run, highlighting each note.
let hearing = false;
function hear(btn) {
  const unmark = () => document.querySelectorAll("#score .note.hear").forEach((g) => g.classList.remove("hear"));
  const done = () => { hearing = false; unmark(); btn.textContent = "Hear it"; };
  if (hearing) { stopAll(); done(); return; }
  hearing = true;
  btn.textContent = "Stop";
  playSequence(EX.notes.map((n, i) => ({
    midis: [n.midi], beats: n.dur,
    onStart: () => { unmark(); const g = document.getElementById("n" + i); if (g) g.classList.add("hear"); },
  })), { bpm: CFG.bpm, legato: 0.9, onEnd: done });
}

export function initRead(syncInputs) {
  $("#readStart").onclick = toggle;
  $("#readNew").onclick = newExercise;
  $("#readRetry").onclick = retry;
  $("#readSummary").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const a = b.dataset.act;
    if (a === "retry") retry();
    if (a === "new") newExercise();
    if (a === "hear") hear(b);
    if (a === "tempo") { CFG.bpm = +b.dataset.v; saveCfg(); syncInputs(); b.textContent = "Tempo set"; }
  });
  newExercise();
}
