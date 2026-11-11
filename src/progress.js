// Progress view: trend chart, per-note grid, session history, backup/restore.
import { $ } from "./dom.js";
import { ST, replaceStats } from "./state.js";
import { KEYS, midiOf, midiName } from "./music.js";
import { buildExport, parseExport } from "./storage.js";
import { exportLocal, importLocal } from "./progstore.js";
import { exportArpStats, importArpStats } from "./technique.js";
import { keyById, keyName } from "./theory.js";

export function renderStats() {
  const ss = ST.sessions, reads = ss.filter((s) => s.m === "read"), flashes = ss.filter((s) => s.m === "flash");
  const vals = Object.values(ST.notes);
  const totNotes = vals.reduce((a, n) => a + n.rs + n.fs, 0), totOk = vals.reduce((a, n) => a + n.ro + n.fo, 0);
  const fr = vals.reduce((a, n) => [a[0] + n.frt, a[1] + n.fo], [0, 0]);
  let h = `<div class="tiles">
   <div class="tile"><div class="k">Sessions</div><div class="v">${ss.length}</div><div class="s">${reads.length} tempo · ${ss.filter((s) => s.m === "wait").length} wait · ${flashes.length} flash · ${ss.filter((s) => s.m === "prog").length} progression · ${ss.filter((s) => s.m === "arp").length} arpeggio</div></div>
   <div class="tile"><div class="k">Notes played</div><div class="v">${totNotes}</div></div>
   <div class="tile"><div class="k">Overall accuracy</div><div class="v">${totNotes ? Math.round((100 * totOk) / totNotes) + "%" : "–"}</div></div>
   <div class="tile"><div class="k">Flashcard avg</div><div class="v">${fr[1] ? (fr[0] / fr[1] / 1000).toFixed(2) + " s" : "–"}</div></div></div>`;

  const pts = reads.slice(-30);
  h += `<div class="section"><h3>Tempo runs, last ${pts.length}</h3>`;
  if (pts.length < 2) h += `<p class="hint">Complete two or more Tempo runs to see a trend.</p>`;
  else {
    const W = 760, H = 220, L = 40, Rr = 14, T = 12, B = 28, iw = W - L - Rr, ih = H - T - B;
    const X = (i) => L + (i * iw) / (pts.length - 1), Y = (v) => T + ih * (1 - v);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Accuracy trend">`;
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => (s += `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v * 100}%</text>`));
    const line = (k, col) =>
      `<polyline fill="none" stroke="${col}" stroke-width="2.2" points="${pts.map((d, i) => `${X(i)},${Y(d[k] ?? 0)}`).join(" ")}"/>` +
      pts.map((d, i) => `<circle cx="${X(i)}" cy="${Y(d[k] ?? 0)}" r="3" fill="${col}"><title>${new Date(d.t).toLocaleDateString()} · ${d.bpm} bpm · ${Math.round((d[k] ?? 0) * 100)}%</title></circle>`).join("");
    s += line("ot", "var(--warn)") + line("acc", "var(--ok)");
    s += `<text class="axis" x="${L}" y="${H - 8}">${new Date(pts[0].t).toLocaleDateString()}</text><text class="axis" x="${W - Rr}" y="${H - 8}" text-anchor="end">${new Date(pts[pts.length - 1].t).toLocaleDateString()}</text></svg>`;
    h += `<div class="chartbox">${s}</div><div class="legend"><span style="--c:var(--ok)">Correct notes</span><span style="--c:var(--warn)">On time</span></div>`;
  }
  h += `</div>`;

  const mids = new Set();
  for (let d = -2; d <= 14; d++) mids.add(midiOf(d, "C"));
  Object.keys(ST.notes).forEach((m) => mids.add(+m));
  const cells = [...mids].sort((a, b) => a - b).map((m) => {
    const n = ST.notes[m], seen = n ? n.rs + n.fs : 0, ok = n ? n.ro + n.fo : 0, a = seen ? ok / seen : null;
    const col = a == null ? "" : a >= 0.9 ? "var(--ok)" : a >= 0.7 ? "var(--warn)" : "var(--bad)";
    return `<div class="ncell${seen ? "" : " none"}" style="${col ? `--c:${col}` : ""}"><b>${midiName(m)}</b>${seen ? Math.round(a * 100) + "% of " + seen : "no data"}${n && n.fo ? `<br>${(n.frt / n.fo / 1000).toFixed(2)} s` : ""}</div>`;
  }).join("");
  h += `<div class="section"><h3>Accuracy by note</h3><p class="hint">Reading and flashcards combined. Second line is your average flashcard time.</p><div class="stat-grid">${cells}</div></div>`;

  const recent = ss.slice(-12).reverse();
  const mode = { read: "Tempo", wait: "Wait", flash: "Flash", prog: "Progression", arp: "Arpeggio" };
  h += `<div class="section"><h3>Recent sessions</h3>${recent.length ? `<div class="tbl"><table class="hist"><thead><tr><th>Date</th><th>Mode</th><th>Key</th><th>Tempo/timer</th><th>Notes</th><th>Accuracy</th><th>On time</th></tr></thead><tbody>${recent.map((s) => `<tr><td>${new Date(s.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td><td>${mode[s.m] || s.m}</td><td>${s.m === "arp" ? (s.name || "–") : s.m === "prog" ? keyName(keyById(s.key)) : KEYS[s.key] ? KEYS[s.key].label.split(" ")[0] : s.key}</td><td>${s.bpm ? s.bpm + " bpm" : s.sec ? s.sec + " s" : "–"}</td><td>${s.n}</td><td>${Math.round(s.acc * 100)}%</td><td>${s.ot != null ? Math.round(s.ot * 100) + "%" : "–"}</td></tr>`).join("")}</tbody></table></div>` : `<p class="hint">No sessions yet.</p>`}</div>`;
  h += `<div class="section"><div class="confirm" id="resetBox"><button class="btn" id="resetBtn">Reset all progress</button></div></div>`;

  $("#statsBody").innerHTML = h;
  $("#resetBtn").onclick = () => {
    $("#resetBox").innerHTML = `<span>Delete all saved sessions and note stats? This can't be undone.</span><button class="btn" id="rsYes" style="border-color:var(--bad);color:var(--bad)">Delete everything</button><button class="btn" id="rsNo">Cancel</button>`;
    $("#rsYes").onclick = () => { replaceStats({}); renderStats(); };
    $("#rsNo").onclick = renderStats;
  };
}

const msg = (t) => { $("#dataMsg").textContent = t; };

function exportProgress() {
  const blob = new Blob([JSON.stringify(buildExport({ notes: ST.notes, sessions: ST.sessions, progressions: exportLocal(), arpeggios: exportArpStats() }), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sightline-progress-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  msg(`Exported ${ST.sessions.length} sessions.`);
}

async function importProgress(file) {
  try {
    const data = parseExport(await file.text());
    replaceStats(data);
    if (data.progressions) importLocal(data.progressions);
    if (data.arpeggios) importArpStats(data.arpeggios);
    renderStats();
    msg(`Imported ${ST.sessions.length} sessions. This replaced the progress that was here.`);
  } catch (e) {
    msg(e instanceof SyntaxError ? "This file isn't valid JSON." : e.message);
  }
}

export function initProgress() {
  $("#exportBtn").onclick = exportProgress;
  $("#importFile").onchange = (e) => { const f = e.target.files[0]; if (f) importProgress(f); e.target.value = ""; };
}
