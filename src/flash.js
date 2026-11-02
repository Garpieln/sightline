// Flashcards: one note on an empty staff, play it before the timer runs out.
import { $ } from "./dom.js";
import { CFG, nstat, missRate, saveStats, addSession } from "./state.js";
import { midiOf, midiName, rangeFor } from "./music.js";
import { VH, staffLines, clefAndKey, noteHead } from "./staff.js";
import { pickWeighted } from "./generator.js";
import { audio, buzz } from "./audio.js";

const F = { running: false, card: null, phase: "idle", n: 0, ok: 0, streak: 0, best: 0, rts: [], res: [], raf: 0, deadline: 0, shown: 0, prevD: null };
export const isRunning = () => F.running;

export function draw(state) {
  const W = 420, ck = clefAndKey(CFG.fkey), x = ck.x0 + (W - ck.x0) / 2;
  const note = F.card ? `<g class="note ${state || ""}">${noteHead(x, F.card.d, 4)}</g>` : "";
  $("#flashStaff").innerHTML = `<svg viewBox="0 0 ${W} ${VH}" role="img" aria-label="Flashcard staff">${staffLines(W)}${ck.svg}${note}</svg>`;
}

export function clearCard() { if (!F.running) { F.card = null; draw(); } }

export function toggle() {
  if (F.running) { end(); return; }
  audio();
  Object.assign(F, { running: true, n: 0, ok: 0, streak: 0, best: 0, rts: [], res: [], prevD: null });
  $("#flashSummary").hidden = true;
  $("#flashStart").firstChild.textContent = "Stop ";
  update();
  next();
}

function next() {
  const max = +CFG.fcount;
  if (max && F.n >= max) { end(); return; }
  const [lo, hi] = rangeFor(CFG.frange, CFG.fkey);
  const choices = [];
  for (let d = lo; d <= hi; d++) if (d !== F.prevD) choices.push({ v: d, w: 0.3 + missRate(midiOf(d, CFG.fkey)) * 3 });
  const d = pickWeighted(choices);
  F.prevD = d;
  F.card = { d, midi: midiOf(d, CFG.fkey) };
  F.n++;
  F.phase = "await";
  F.shown = performance.now();
  F.deadline = F.shown + CFG.fsec * 1000;
  $("#fVerdict").textContent = "";
  $("#fVerdict").className = "verdict";
  $("#flashSheet").classList.remove("redwash");
  $("#fTimer").classList.remove("danger");
  draw(); update();
  cancelAnimationFrame(F.raf);
  F.raf = requestAnimationFrame(loop);
}

function loop(now) {
  if (!F.running || F.phase !== "await") return;
  const left = Math.max(0, F.deadline - now), frac = left / (CFG.fsec * 1000);
  $("#fBar").style.transform = `scaleX(${frac})`;
  $("#fTimer").classList.toggle("danger", frac < 0.25);
  if (left <= 0) { resolve(false, null, null); return; }
  F.raf = requestAnimationFrame(loop);
}

export function handleNote(m, ts) {
  if (!F.running || F.phase !== "await") return;
  const hit = CFG.fanyoct ? (((m - F.card.midi) % 12) + 12) % 12 === 0 : m === F.card.midi;
  resolve(hit, m, ts - F.shown);
}

function resolve(hit, played, rt) {
  F.phase = "result";
  cancelAnimationFrame(F.raf);
  const c = F.card, s = nstat(c.midi), name = midiName(c.midi, CFG.fkey), v = $("#fVerdict");
  s.fs++;
  if (hit) {
    F.ok++; F.streak++; F.best = Math.max(F.best, F.streak); F.rts.push(rt);
    s.fo++; s.frt += rt;
    draw("ok");
    v.className = "verdict ok";
    v.textContent = (CFG.fname ? name + " · " : "") + (rt / 1000).toFixed(2) + " s";
    F.res.push({ name, ok: true, rt });
    setTimeout(() => F.running && next(), CFG.fname ? 550 : 300);
  } else {
    F.streak = 0;
    draw("bad");
    const sh = $("#flashSheet");
    sh.classList.remove("shake"); void sh.offsetWidth; sh.classList.add("shake", "redwash");
    if (CFG.fsound) buzz();
    v.className = "verdict bad";
    v.textContent = played == null ? `Time's up. It was ${name}.` : `You played ${midiName(played, CFG.fkey)}. It was ${name}.`;
    F.res.push({ name, ok: false });
    setTimeout(() => F.running && next(), 1300);
  }
  saveStats();
  update();
}

function update() {
  $("#fCard").textContent = F.n + (+CFG.fcount ? "/" + CFG.fcount : "");
  $("#fOk").textContent = F.ok;
  $("#fStreak").textContent = F.streak;
  $("#fRt").textContent = F.rts.length ? (F.rts.reduce((a, b) => a + b, 0) / F.rts.length / 1000).toFixed(2) + " s" : "–";
}

export function end() {
  F.running = false;
  F.phase = "idle";
  cancelAnimationFrame(F.raf);
  $("#flashStart").firstChild.textContent = "Start ";
  if (!F.res.length) { F.card = null; draw(); return; }
  const acc = F.ok / F.res.length;
  const avg = F.rts.length ? F.rts.reduce((a, b) => a + b, 0) / F.rts.length : null;
  addSession({ t: Date.now(), m: "flash", key: CFG.fkey, n: F.res.length, acc: +acc.toFixed(3), rt: avg ? Math.round(avg) : null, sec: CFG.fsec });

  const per = {};
  F.res.forEach((r) => { const p = per[r.name] || (per[r.name] = { n: 0, ok: 0, rt: 0 }); p.n++; if (r.ok) { p.ok++; p.rt += r.rt; } });
  const slow = Object.entries(per).filter(([, p]) => p.ok).map(([k, p]) => [k, p.rt / p.ok]).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const missed = Object.entries(per).filter(([, p]) => p.ok < p.n);
  const advice = acc >= 0.95 && avg && avg < CFG.fsec * 500
    ? `Fast and accurate. Cut the timer to ${Math.max(1, CFG.fsec - 1)} s or widen the range.`
    : acc < 0.8 ? "Lengthen the timer a little. Recognition has to be right before it can be fast."
    : "Good. Repeat this setting until your average time is under half the timer.";

  const el = $("#flashSummary");
  el.hidden = false;
  el.innerHTML = `<h3>Session summary</h3><div class="tiles">
    <div class="tile"><div class="k">Accuracy</div><div class="v ${acc >= 0.9 ? "good" : acc >= 0.7 ? "mid" : "low"}">${Math.round(acc * 100)}%</div><div class="s">${F.ok} of ${F.res.length}</div></div>
    <div class="tile"><div class="k">Avg time</div><div class="v">${avg ? (avg / 1000).toFixed(2) + " s" : "–"}</div><div class="s">Correct cards only</div></div>
    <div class="tile"><div class="k">Best streak</div><div class="v">${F.best}</div></div></div>
    <div class="advice">${advice}</div>
    ${missed.length ? `<p class="hint" style="margin-bottom:6px">Missed:</p><div class="chips">${missed.map(([k, p]) => `<span class="chip badc">${k} ${p.n - p.ok}/${p.n}</span>`).join("")}</div>` : ""}
    ${slow.length ? `<p class="hint" style="margin:10px 0 6px">Slowest correct:</p><div class="chips">${slow.map(([k, t]) => `<span class="chip">${k} ${(t / 1000).toFixed(2)} s</span>`).join("")}</div>` : ""}`;
  F.card = null;
  draw();
  $("#fVerdict").textContent = "Session complete.";
  $("#fVerdict").className = "verdict";
}

export function initFlash() {
  $("#flashStart").onclick = toggle;
  draw();
}
