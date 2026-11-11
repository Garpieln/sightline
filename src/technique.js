// Technique tab: arpeggio practice in every key and type, with wait or tempo grading.
import { $ } from "./dom.js";
import { CFG, saveCfg, addSession } from "./state.js";
import { load, save } from "./storage.js";
import { ARP_TYPES, CIRCLE_PCS, exercise, arpName, defaultPerBeat, evenness, typeName, rootFor } from "./arpmodel.js";
import { spName } from "./theory.js";
import { seqStaff } from "./staff.js";
import { audio, click } from "./audio.js";
import { playSequence, stopAll } from "./sound.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DEF = { pc: 0, tid: "maj", order: "single", types: ["maj", "min"], octaves: 2, dir: "updown", inversion: 0, hands: "rh", mode: "wait", bpm: 60, perBeat: "auto", notation: false, fingers: true, metro: true };
const O = () => (CFG.arp = Object.assign({}, DEF, CFG.arp || {}));
let STATS = load("arps", {}); // "pc:tid" -> { n, ok, sd, runs }
const saveStats = () => save("arps", STATS);
export const exportArpStats = () => STATS;
export function importArpStats(s) { if (s && typeof s === "object") { STATS = s; saveStats(); } }

const T = {
  running: false, queue: [], qi: 0, ex: null, si: 0, states: [], raf: 0, t0: 0, noteMs: 300, clickAt: 0, clickEnd: 0,
  events: [], got: new Set(), wrongStep: false, wrong: 0, stray: 0, stepAt: 0, results: [], pause: 0, hearing: false, summary: "",
};

// ---------- queue ----------
function buildQueue() {
  const o = O(), types = o.types.length ? o.types : [o.tid];
  if (o.order === "single") return [{ pc: o.pc, tid: o.tid }];
  if (o.order === "circle") { const i = CIRCLE_PCS.indexOf(o.pc); return [...Array(12)].map((_, k) => ({ pc: CIRCLE_PCS[(i + k) % 12], tid: o.tid })); }
  const all = types.flatMap((tid) => [...Array(12)].map((_, pc) => ({ pc, tid })));
  if (o.order === "random") return all.sort(() => Math.random() - 0.5).slice(0, 12);
  // weakest: lowest accuracy first; unpracticed ones count as half-known
  const score = (x) => { const s = STATS[`${x.pc}:${x.tid}`]; return s ? s.ok / s.n : 0.5; };
  return all.sort((a, b) => score(a) - score(b) || Math.random() - 0.5).slice(0, 8);
}

const opts = () => { const o = O(); return { octaves: +o.octaves, dir: o.dir, inversion: +o.inversion, hands: o.hands }; };
const perBeat = (tid) => (O().perBeat === "auto" ? defaultPerBeat(tid) : +O().perBeat);
const handLabel = { rh: "right hand", lh: "left hand", both: "hands together" };
const invLabel = ["root position", "1st inversion", "2nd inversion", "3rd inversion"];

// ---------- rendering ----------
function cols(ex) {
  const hands = Object.keys(ex.parts);
  return ex.steps.map((_, i) => ({
    notes: hands.map((h) => { const n = ex.parts[h].notes[i]; return { m: n.m, step: n.sp.l + 7 * (n.oct - 4), acc: n.sp.a, hand: h, staff: hands.length > 1 ? (h === "rh" ? "t" : "b") : null }; }),
    fingers: Object.fromEntries(hands.map((h) => [h, ex.parts[h].fingers[i]])),
    state: T.states[i],
  }));
}

function drawExercise() {
  const o = O(), ex = T.ex;
  if (!ex) return;
  const c = cols(ex), cur = T.running ? T.si : -1;
  $("#tqName").textContent = ex.name;
  $("#tqSub").textContent = `${o.octaves} octave${o.octaves > 1 ? "s" : ""} · ${o.dir === "updown" ? "up and down" : "up"} · ${handLabel[o.hands]} · ${invLabel[Math.min(+o.inversion, ex.groupSize - 1)]}${o.mode === "tempo" ? ` · ${perBeat(ex.tid)} notes per beat` : ""}`;
  $("#tqProg").textContent = T.queue.length > 1 ? `${T.qi + 1} of ${T.queue.length}` : "";
  if (o.notation) $("#tqView").innerHTML = `<div class="tq-staff">${seqStaff(c, { fingering: o.fingers, current: cur })}</div>`;
  else $("#tqView").innerHTML = `<div class="tq-dots">${c.map((col, i) => `<div class="tq-col${col.state ? " " + col.state : ""}${i === cur ? " cur" : ""}">
      ${o.fingers && col.fingers.rh ? `<span class="fing-t">${col.fingers.rh}</span>` : ""}<span class="dot-n"></span>${o.fingers && col.fingers.lh ? `<span class="fing-t">${col.fingers.lh}</span>` : ""}</div>`).join("")}</div>
      <p class="hint">One dot per note${o.hands === "both" ? " (both hands together)" : ""}. ${o.fingers ? "Numbers are suggested fingering: 1 = thumb, 5 = little finger." : ""}</p>`;
}

function render() {
  const o = O();
  const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join("")}</div>`;
  const roots = [...Array(12)].map((_, pc) => [pc, spName(rootFor(pc, o.tid))]);
  $("#tqPanel").innerHTML = `
    <div class="field"><div class="lbl">Root</div>${seg("tqRoot", roots, o.pc)}</div>
    <div class="field"><div class="lbl">Type</div>${seg("tqType", ARP_TYPES.map((t) => [t.id, t.name]), o.tid)}</div>
    <div class="field"><div class="lbl">Order</div>${seg("tqOrder", [["single", "This one"], ["circle", "12 keys"], ["random", "Random"], ["weak", "Weakest"]], o.order)}
      ${o.order === "random" || o.order === "weak" ? `<div class="tq-types">${ARP_TYPES.map((t) => `<label class="check small"><input type="checkbox" data-type="${t.id}"${o.types.includes(t.id) ? " checked" : ""}> ${t.name}</label>`).join("")}</div>` : ""}
      <p class="hint">${{ single: "Repeat the selected arpeggio.", circle: "The selected type in all 12 keys, around the circle of fifths from the selected root.", random: "12 random arpeggios from the types you check.", weak: "Your 8 weakest arpeggios from the types you check." }[o.order]}</p></div>
    <div class="field"><div class="lbl">Octaves</div>${seg("tqOct", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], o.octaves)}</div>
    <div class="field"><div class="lbl">Direction</div>${seg("tqDir", [["up", "Up"], ["updown", "Up and down"]], o.dir)}</div>
    <div class="field"><div class="lbl">Start from</div>${seg("tqInv", [[0, "Root"], [1, "1st inv."], [2, "2nd inv."], [3, "3rd inv."]], o.inversion)}<p class="hint">3rd inversion applies to seventh arpeggios only.</p></div>
    <div class="field"><div class="lbl">Hands</div>${seg("tqHands", [["rh", "Right"], ["lh", "Left"], ["both", "Both"]], o.hands)}</div>
    <div class="field"><div class="lbl">Mode</div>${seg("tqMode", [["wait", "Wait"], ["tempo", "Tempo"]], o.mode)}</div>
    <div class="field"${o.mode === "wait" ? ' style="opacity:.45"' : ""}><div class="lbl">Tempo <output>${o.bpm} bpm</output></div><input type="range" id="tqBpm" min="30" max="160" step="2" value="${o.bpm}">
      <div class="lbl" style="margin-top:6px">Notes per beat</div>${seg("tqPer", [["auto", "Auto"], [3, "3"], [4, "4"]], o.perBeat)}<p class="hint">Auto: 3 for triads (triplets), 4 for sevenths.</p></div>
    <label class="check"><input type="checkbox" id="tqNotation"${o.notation ? " checked" : ""}> Show notation</label>
    <label class="check"><input type="checkbox" id="tqFingers"${o.fingers ? " checked" : ""}> Show fingering</label>
    <label class="check"><input type="checkbox" id="tqMetro"${o.metro ? " checked" : ""}> Metronome</label>`;
  if (!T.running) { T.ex = exercise(o.pc, o.tid, opts()); T.states = []; }
  $("#tqStart").firstChild.textContent = T.running ? "Stop " : "Start ";
  drawExercise();
  $("#tqSummary").innerHTML = T.summary;
  renderGrid();
}

function renderGrid() {
  const rows = ARP_TYPES.map((t) => `<tr><th>${esc(t.name)}</th>${CIRCLE_PCS.map((pc) => {
    const s = STATS[`${pc}:${t.id}`], f = s ? s.ok / s.n : null;
    const c = f == null ? "" : f >= 0.9 ? "g" : f >= 0.7 ? "m" : "l";
    return `<td><button class="hm ${c}" data-pick="${pc}:${t.id}" title="${esc(arpName(pc, t.id))}${s ? `: ${Math.round(f * 100)}% over ${s.runs} run${s.runs > 1 ? "s" : ""}` : ": not practiced"}">${esc(spName(rootFor(pc, t.id)))}</button></td>`;
  }).join("")}</tr>`).join("");
  $("#tqGrid").innerHTML = `<div class="tbl"><table class="heat"><tbody>${rows}</tbody></table></div>`;
}

// ---------- engine ----------
function startDrill() {
  const o = O(), d = T.queue[T.qi];
  T.ex = exercise(d.pc, d.tid, opts());
  T.si = 0; T.states = T.ex.steps.map(() => null); T.got = new Set(); T.wrongStep = false; T.wrong = 0; T.stray = 0;
  T.stepTimes = []; T.stepAt = performance.now();
  if (o.mode === "tempo") {
    const beatMs = 60000 / o.bpm, pb = perBeat(d.tid);
    T.noteMs = beatMs / pb;
    T.t0 = performance.now() + 250 + 4 * beatMs;
    T.events = T.ex.steps.flatMap((ms, i) => ms.map((m) => ({ i, m, t: T.t0 + i * T.noteMs, state: null, dt: null })));
    T.clickAt = -4; T.beatMs = beatMs;
    T.clickEnd = Math.ceil(T.ex.steps.length / pb);
  }
  drawExercise();
  cancelAnimationFrame(T.raf);
  T.raf = requestAnimationFrame(loop);
}

function toggle() {
  if (T.running) { stopRun(); render(); return; }
  audio(); stopAll(); T.hearing = false;
  T.queue = buildQueue(); T.qi = 0; T.results = []; T.summary = ""; T.running = true;
  render();
  startDrill();
}
export function stopRun() { T.running = false; cancelAnimationFrame(T.raf); clearTimeout(T.pause); }

function setState(i, st) { T.states[i] = st; const el = document.querySelectorAll("#tqView .tq-col, #tqView .sq")[i]; if (el) { el.classList.remove("ok", "bad", "miss"); el.classList.add(st); } }
function setCur(i) { document.querySelectorAll("#tqView .cur").forEach((e) => e.classList.remove("cur")); const el = document.querySelectorAll("#tqView .tq-col, #tqView .sq")[i]; if (el) el.classList.add("cur"); if (O().notation) drawExercise(); }

function loop(now) {
  if (!T.running) return;
  const o = O();
  if (o.mode === "tempo") {
    while (T.clickAt < T.clickEnd && T.t0 + T.clickAt * T.beatMs < now + 120) {
      if (o.metro || T.clickAt < 0) click(T.t0 + T.clickAt * T.beatMs, T.clickAt % 4 === 0);
      T.clickAt++;
    }
    const cd = $("#tqCount");
    if (cd) cd.textContent = now < T.t0 ? String(Math.ceil((T.t0 - now) / T.beatMs)) : "";
    const win = Math.max(70, T.noteMs * 0.5);
    for (const e of T.events) if (!e.state && now > e.t + win) { e.state = "miss"; stepDone(e.i); }
    const cur = Math.max(0, Math.min(T.ex.steps.length - 1, Math.round((now - T.t0) / T.noteMs)));
    if (now >= T.t0 && cur !== T.si) { T.si = cur; setCur(cur); }
    if (T.events.every((e) => e.state)) { finishDrill(); return; }
  }
  T.raf = requestAnimationFrame(loop);
}

function stepDone(i) {
  const evs = T.events.filter((e) => e.i === i);
  if (evs.some((e) => !e.state)) return;
  setState(i, evs.every((e) => e.state === "ok") ? "ok" : evs.some((e) => e.state === "ok") ? "bad" : "miss");
}

export function handleNote(m, ts) {
  if (!T.running || !T.ex) return;
  const o = O();
  if (o.mode === "wait") {
    const want = T.ex.steps[T.si];
    if (want.includes(m)) {
      T.got.add(m);
      if (want.every((x) => T.got.has(x))) {
        T.stepTimes.push(ts - T.stepAt); T.stepAt = ts;
        setState(T.si, T.wrongStep ? "bad" : "ok");
        T.si++; T.got = new Set(); T.wrongStep = false;
        if (T.si >= T.ex.steps.length) { finishDrill(); return; }
        setCur(T.si);
      }
    } else {
      T.wrong++; T.wrongStep = true;
      const el = document.querySelectorAll("#tqView .tq-col, #tqView .sq")[T.si];
      if (el) { el.classList.remove("flash"); void el.getBoundingClientRect(); el.classList.add("flash"); }
    }
    return;
  }
  // tempo: match the nearest unplayed note of this pitch within half a note's length
  const win = Math.max(70, T.noteMs * 0.5);
  let best = null;
  for (const e of T.events) if (!e.state && e.m === m && Math.abs(ts - e.t) <= win && (!best || Math.abs(ts - e.t) < Math.abs(ts - best.t))) best = e;
  if (best) { best.state = "ok"; best.dt = ts - best.t; stepDone(best.i); }
  else if (ts > T.t0 - win) {
    T.wrong++;
    const near = T.events.find((e) => !e.state && Math.abs(ts - e.t) <= win);
    if (near) { near.state = "bad"; stepDone(near.i); }
  }
}

function finishDrill() {
  cancelAnimationFrame(T.raf);
  const o = O(), d = T.queue[T.qi], ex = T.ex;
  let r;
  if (o.mode === "wait") {
    const ok = T.states.filter((s) => s === "ok").length, n = T.states.length;
    const avg = T.stepTimes.length ? T.stepTimes.reduce((a, b) => a + b, 0) / T.stepTimes.length : null;
    r = { name: ex.name, acc: ok / n, n, wrong: T.wrong, avg, sd: evenness(T.stepTimes.slice(1)) };
  } else {
    const n = T.events.length, okE = T.events.filter((e) => e.state === "ok");
    const dts = okE.map((e) => e.dt), mean = dts.length ? dts.reduce((a, b) => a + b, 0) / dts.length : 0;
    r = { name: ex.name, acc: okE.length / n, n, wrong: T.wrong, sd: evenness(dts), mean, onTime: okE.filter((e) => Math.abs(e.dt) <= Math.max(40, T.noteMs * 0.25)).length / n };
  }
  T.results.push(r);
  const k = `${d.pc}:${d.tid}`, s = STATS[k] || (STATS[k] = { n: 0, ok: 0, runs: 0 });
  s.n += r.n; s.ok += Math.round(r.acc * r.n); s.runs++;
  saveStats();
  if (T.qi < T.queue.length - 1) {
    T.qi++;
    const next = T.queue[T.qi];
    $("#tqCount").textContent = "";
    $("#tqSub").textContent = `${Math.round(r.acc * 100)}% · Next: ${arpName(next.pc, next.tid)}`;
    T.pause = setTimeout(() => T.running && startDrill(), o.mode === "tempo" ? 1400 : 900);
    return;
  }
  T.running = false;
  summarize();
  render();
}

function summarize() {
  const o = O(), rs = T.results;
  const acc = rs.reduce((a, r) => a + r.acc * r.n, 0) / rs.reduce((a, r) => a + r.n, 0);
  const sds = rs.map((r) => r.sd).filter((x) => x != null), sd = sds.length ? sds.reduce((a, b) => a + b, 0) / sds.length : null;
  addSession({ t: Date.now(), m: "arp", key: "", n: rs.reduce((a, r) => a + r.n, 0), acc: +acc.toFixed(3), ot: o.mode === "tempo" ? +(rs.reduce((a, r) => a + r.onTime * r.n, 0) / rs.reduce((a, r) => a + r.n, 0)).toFixed(3) : null, bpm: o.mode === "tempo" ? o.bpm : null, name: rs.length === 1 ? rs[0].name : `${rs.length} arpeggios` });
  const cls = (v) => (v >= 0.9 ? "good" : v >= 0.7 ? "mid" : "low");
  let advice;
  const mean = o.mode === "tempo" ? rs.reduce((a, r) => a + (r.mean || 0), 0) / rs.length : 0;
  if (acc < 0.8) advice = o.mode === "tempo" ? "Notes are slipping. Drop the tempo or go back to Wait mode until the shape is automatic." : "Learn the shape slowly first: say the chord tones aloud and watch the thumb crossings.";
  else if (o.mode === "wait") advice = "Accurate. Switch to Tempo mode and start slow, around 50 bpm.";
  else if (sd != null && sd > Math.max(35, 60000 / o.bpm / perBeat(T.queue[0].tid) * 0.2)) advice = "Correct notes, uneven timing. Practice at a slower tempo, and listen for the notes around each thumb crossing, where unevenness usually happens.";
  else advice = Math.abs(mean) > 30 ? `Even, but you tend to play ${mean > 0 ? "late" : "early"}. Lock onto the metronome clicks.` : "Clean and even. Raise the tempo by 4–6 bpm, or add an octave.";
  T.summary = `<div class="summary"><h3>Results</h3><div class="tiles">
    <div class="tile"><div class="k">Correct notes</div><div class="v ${cls(acc)}">${Math.round(acc * 100)}%</div><div class="s">${rs.length} arpeggio${rs.length > 1 ? "s" : ""}</div></div>
    ${o.mode === "tempo" ? `<div class="tile"><div class="k">Evenness</div><div class="v">${sd != null ? "±" + Math.round(sd) + " ms" : "–"}</div><div class="s">Spread of timing. Lower is smoother.</div></div>
      <div class="tile"><div class="k">Tempo</div><div class="v">${o.bpm}</div><div class="s">bpm</div></div>`
    : `<div class="tile"><div class="k">Time per note</div><div class="v">${(() => { const a = rs.map((r) => r.avg).filter(Boolean); return a.length ? (a.reduce((x, y) => x + y, 0) / a.length / 1000).toFixed(2) + " s" : "–"; })()}</div></div>`}
    <div class="tile"><div class="k">Wrong notes</div><div class="v">${rs.reduce((a, r) => a + r.wrong, 0)}</div></div></div>
    ${rs.length > 1 ? `<div class="chips">${rs.map((r) => `<span class="chip${r.acc >= 0.9 ? "" : r.acc >= 0.7 ? " mid" : " badc"}">${esc(r.name)} ${Math.round(r.acc * 100)}%</span>`).join("")}</div>` : ""}
    <div class="advice">${advice}</div></div>`;
}

function hear(btn) {
  if (T.hearing) { stopAll(); T.hearing = false; btn.textContent = "Hear it"; return; }
  const o = O(), ex = exercise(o.pc, o.tid, opts());
  T.ex = ex; T.states = ex.steps.map(() => null); drawExercise();
  T.hearing = true; btn.textContent = "Stop";
  const pb = perBeat(o.tid);
  playSequence(ex.steps.map((midis, i) => ({ midis, beats: 1 / pb, onStart: () => setCur(i) })), {
    bpm: o.mode === "tempo" ? o.bpm : 72, legato: 1.6,
    onEnd: () => { T.hearing = false; btn.textContent = "Hear it"; document.querySelectorAll("#tqView .cur").forEach((e) => e.classList.remove("cur")); },
  });
}

// ---------- events ----------
export function initTechnique() {
  const view = $("#view-tech");
  const segMap = { tqRoot: "pc", tqType: "tid", tqOrder: "order", tqOct: "octaves", tqDir: "dir", tqInv: "inversion", tqHands: "hands", tqMode: "mode", tqPer: "perBeat" };
  view.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "tqStart") { toggle(); return; }
    if (b.id === "tqHear") { hear(b); return; }
    if (b.dataset.pick) { const [pc, tid] = b.dataset.pick.split(":"); Object.assign(O(), { pc: +pc, tid, order: "single" }); saveCfg(); stopRun(); render(); return; }
    const seg = b.closest(".seg");
    if (seg && segMap[seg.id]) {
      const v = b.dataset.v;
      O()[segMap[seg.id]] = ["pc", "octaves", "inversion"].includes(segMap[seg.id]) ? +v : v;
      saveCfg(); stopRun(); T.summary = ""; render();
    }
  });
  view.addEventListener("change", (e) => {
    const t = e.target, o = O();
    if (t.dataset.type) { o.types = ARP_TYPES.map((x) => x.id).filter((id) => (id === t.dataset.type ? t.checked : o.types.includes(id))); saveCfg(); return; }
    const map = { tqNotation: "notation", tqFingers: "fingers", tqMetro: "metro" };
    if (map[t.id]) { o[map[t.id]] = t.checked; saveCfg(); drawExercise(); }
  });
  view.addEventListener("input", (e) => {
    if (e.target.id !== "tqBpm") return;
    O().bpm = +e.target.value; saveCfg();
    e.target.previousElementSibling.querySelector("output").textContent = e.target.value + " bpm";
  });
  render();
}

export const renderTechnique = () => { if (!T.running) render(); };
export const leaveTechnique = () => { stopRun(); if (T.hearing) { stopAll(); T.hearing = false; } };
export const isRunning = () => T.running;
export { typeName };
