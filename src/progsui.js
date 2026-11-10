// Progressions tab: library list, detail view, editor (type, click a palette, or record
// from the keyboard), generator, and the entry point to practice.
import { $ } from "./dom.js";
import { CFG, saveCfg } from "./state.js";
import { ALL_KEYS, keyById, keyName, sigShort, diatonic, realize, identify, makeKey, spName } from "./theory.js";
import { parseProgression, toText, toChord, numeral, voicingFor, fromChord, generateMany, fromPlayed, MOODS, STYLES } from "./progmodel.js";
import * as store from "./progstore.js";
import { playChord, playSequence, stopAll } from "./sound.js";
import * as practice from "./practice.js";

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const S = {
  view: "detail", // detail | edit | gen | practice
  sel: CFG.pgSel || "s-axis", q: "", tag: null, viewKey: null,
  draft: null, draftText: "", draftErrors: [], confirmDel: false,
  rec: false, held: new Map(), recTimer: 0, recLast: "", playing: false,
  gen: { key: "0M", style: "pop", mood: "bright", length: 4, results: [] },
};

const keyOptions = (sel, auto = false) => (auto ? `<option value="auto"${sel === "auto" ? " selected" : ""}>Detect from chords</option>` : "")
  + ALL_KEYS.map((k) => `<option value="${k.id}"${k.id === sel ? " selected" : ""}>${keyName(k)} (${sigShort(k) === "0" ? "no ♯/♭" : sigShort(k)})</option>`).join("");
const originLabel = { local: "Mine", repo: "From videos", starter: "Starter" };

// ---------- list ----------
function renderList() {
  const q = S.q.trim().toLowerCase();
  const items = store.all().filter((p) => (!S.tag || (p.tags || []).includes(S.tag))
    && (!q || p.name.toLowerCase().includes(q) || (p.tags || []).some((t) => t.includes(q)) || (p.credit && (p.credit.name || "").toLowerCase().includes(q))));
  const groups = [["local", "My progressions"], ["repo", "From videos"], ["starter", "Starter progressions"]];
  let h = "";
  for (const [o, title] of groups) {
    const list = items.filter((p) => p.origin === o);
    h += `<div class="pg-group"><div class="eyebrow">${title}</div>`;
    if (!list.length) h += `<p class="hint">${o === "local" ? "Nothing saved yet. Use New, Generate, or Save as progression in the Chords tab." : o === "repo" ? "Send Claude a video in chat and its progressions land here." : "No matches."}</p>`;
    h += list.map((p) => {
      const k = keyById(p.key);
      return `<button class="pg-item${p.id === S.sel && S.view !== "gen" ? " here" : ""}" data-sel="${esc(p.id)}"><b>${esc(p.name)}</b>
        <span class="pg-preview">${esc(p.chords.slice(0, 6).map((c) => toChord(c, k).sym).join(" "))}${p.chords.length > 6 ? " …" : ""}</span>
        <span class="pg-meta">${esc(keyName(k))}${p.credit && p.credit.name ? " · " + esc(p.credit.name) : ""}</span></button>`;
    }).join("");
    h += `</div>`;
  }
  $("#pgItems").innerHTML = h;
  $("#pgTags").innerHTML = store.tags().map((t) => `<button class="tagchip${S.tag === t ? " here" : ""}" data-tag="${esc(t)}">${esc(t)}</button>`).join("");
}

// ---------- timeline (shared by detail, editor, generator) ----------
export function timeline(chords, key, { hideNames = false, cls = "", id = "" } = {}) {
  const total = chords.reduce((a, c) => a + c.beats, 0) || 1;
  let prev = null;
  return `<div class="tlwrap ${cls}" ${id ? `id="${id}"` : ""}><div class="tl">${chords.map((c, i) => {
    const ch = toChord(c, key), notes = voicingFor(c, key, prev);
    prev = notes;
    return `<button class="tl-chord playable" style="flex-grow:${c.beats}" data-i="${i}" data-play="${notes.join(" ")}" title="${esc(ch.sym)} · ${c.beats} beat${c.beats === 1 ? "" : "s"}">
      ${hideNames ? "" : `<b>${esc(ch.sym)}</b>`}<small>${esc(numeral(c, key))}</small>${c.v ? `<span class="vtag" title="Recorded voicing">voicing</span>` : ""}</button>`;
  }).join("")}</div><div class="tl-beats">${total} beats</div></div>`;
}

function playProg(chords, key, tempo, meter, tlSel, btn) {
  if (S.playing) { stopAll(); S.playing = false; if (btn) btn.textContent = "▶ Play"; document.querySelectorAll(".tl-chord.playing").forEach((x) => x.classList.remove("playing")); return; }
  let prev = null;
  const steps = chords.map((c, i) => {
    const midis = voicingFor(c, key, prev); prev = midis;
    return { midis, beats: c.beats, onStart: () => { document.querySelectorAll(`${tlSel} .tl-chord`).forEach((x, j) => x.classList.toggle("playing", j === i)); } };
  });
  S.playing = true;
  if (btn) btn.textContent = "■ Stop";
  playSequence(steps, { bpm: tempo, onEnd: () => { S.playing = false; if (btn) btn.textContent = "▶ Play"; document.querySelectorAll(".tl-chord.playing").forEach((x) => x.classList.remove("playing")); } });
}

// ---------- detail ----------
function renderDetail() {
  const p = store.byId(S.sel) || store.STARTER[0];
  S.sel = p.id;
  const k = keyById(S.viewKey || p.key);
  const cr = p.credit;
  $("#pgMain").innerHTML = `<div class="sheet pg-detail">
    <div class="pg-head"><div><span class="badge-o ${p.origin}">${originLabel[p.origin]}</span><h2>${esc(p.name)}</h2>
      ${cr && cr.name ? `<p class="hint">From ${cr.url ? `<a href="${esc(cr.url)}" target="_blank" rel="noopener">${esc(cr.name)}</a>` : esc(cr.name)}${cr.platform ? " on " + esc(cr.platform) : ""}</p>` : ""}
      ${(p.tags || []).length ? `<div class="pg-tags">${p.tags.map((t) => `<span class="tagchip static">${esc(t)}</span>`).join("")}</div>` : ""}</div>
      <div class="btns">
        <button class="btn primary" data-act="practice">Practice</button>
        <button class="btn" data-act="play" id="pgPlayBtn">▶ Play</button>
        ${p.origin === "local" ? `<button class="btn" data-act="edit">Edit</button>` : `<button class="btn" data-act="copy">Copy to my library</button>`}
      </div></div>
    <div class="pg-controls">
      <label class="field"><span class="lbl">Key</span><select id="pgViewKey">${keyOptions(k.id)}</select></label>
      <span class="hint">Original key: ${esc(keyName(keyById(p.key)))} · ${p.tempo} bpm · ${p.meter}/4</span>
    </div>
    ${timeline(p.chords, k, { id: "pgTl" })}
    ${p.notes ? `<p class="pg-notes">${esc(p.notes)}</p>` : ""}
    <p class="hint">Click a chord to hear it.${p.chords.some((c) => c.v) ? " Chords marked “voicing” play the exact notes that were recorded." : ""}</p>
    ${p.origin === "local" ? `<div class="pg-danger">${S.confirmDel ? `<span>Delete “${esc(p.name)}”? This can't be undone.</span><button class="btn danger" data-act="del-yes">Delete</button><button class="btn" data-act="del-no">Cancel</button>` : `<button class="btn" data-act="del">Delete</button>`}</div>` : ""}
  </div>`;
}

// ---------- editor ----------
function draftKey() { return S.draft.key === "auto" ? (S.draft._detected || makeKey(0, "major")) : keyById(S.draft.key); }

function reparse() {
  const d = S.draft;
  const res = parseProgression(S.draftText, d.key === "auto" ? null : keyById(d.key), d.meter);
  d._detected = res.key;
  // Keep recorded voicings where the chord at that position didn't change.
  res.chords.forEach((c, i) => { const o = d.chords[i]; if (o && o.v && o.r === c.r && o.t === c.t && o.l === c.l) c.v = o.v; });
  d.chords = res.chords;
  S.draftErrors = res.errors;
}

function startEdit(p, fresh = false) {
  S.draft = JSON.parse(JSON.stringify({ id: p.id || store.newId(), name: p.name || "", key: p.key || "auto", tempo: p.tempo || 80, meter: p.meter || 4, chords: p.chords || [], tags: p.tags || [], notes: p.notes || "", credit: p.credit || null }));
  S.draftText = S.draft.chords.length ? toText(S.draft.chords, keyById(S.draft.key === "auto" ? "0M" : S.draft.key), S.draft.meter) : "";
  S.draftErrors = [];
  S.fresh = fresh;
  S.view = "edit";
  render();
}

function renderEditor() {
  const d = S.draft, k = draftKey();
  const pal = diatonic(k, CFG.pgPal7);
  const extras = (k.mode === "major" ? ["iv", "b6", "b7", "b3", "sec:1", "sec:3", "sec:4", "sec:5"] : ["IVmaj", "sec:2", "sec:3", "sec:5"]).map((r) => realize(r, k, CFG.pgPal7)).filter(Boolean);
  $("#pgMain").innerHTML = `<form class="sheet pg-edit" id="pgForm" autocomplete="off">
    <div class="pg-head"><h2>${S.fresh ? "New progression" : "Edit progression"}</h2>
      <div class="btns"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" data-act="cancel">Cancel</button></div></div>
    <div class="pg-form-grid">
      <label class="field wide"><span class="lbl">Name</span><input id="pgName" required maxlength="60" value="${esc(d.name)}" placeholder="e.g. Late-night neo-soul turnaround"></label>
      <label class="field"><span class="lbl">Key</span><select id="pgKey">${keyOptions(d.key, true)}</select></label>
      <label class="field"><span class="lbl">Tempo</span><input id="pgTempo" type="number" min="30" max="220" value="${d.tempo}"></label>
      <div class="field"><span class="lbl">Time</span><div class="seg" id="pgMeter"><button type="button" data-v="4" aria-pressed="${d.meter === 4}">4/4</button><button type="button" data-v="3" aria-pressed="${d.meter === 3}">3/4</button></div></div>
    </div>
    <label class="field"><span class="lbl">Chords</span><input id="pgText" class="pg-text" value="${esc(S.draftText)}" placeholder="Cmaj7 Am7 | Dm7 G7    or    ii7 V7 Imaj7"></label>
    <p class="hint">Chord symbols or Roman numerals. Each chord gets a bar; use <code>|</code> for bar lines when a bar has two chords, or <code>Am7:2</code> to set beats.${d.key === "auto" ? ` Detected key: <b id="pgDetected">${esc(keyName(k))}</b>.` : ""}</p>
    ${S.draftErrors.length ? `<p class="pg-err">${S.draftErrors.map(esc).join("<br>")}</p>` : ""}
    ${d.chords.length ? timeline(d.chords, k, { id: "pgEditTl" }) : `<p class="hint pg-empty">Your chords will appear here.</p>`}
    ${d.chords.some((c) => c.v) ? `<p class="hint">Chords marked “voicing” keep the notes you recorded. <button class="linkbtn" type="button" data-act="clearv">Clear recorded voicings</button></p>` : ""}

    <div class="pg-add">
      <div class="ch-row-head"><h3>Add chords</h3><label class="check"><input type="checkbox" id="pgPal7"${CFG.pgPal7 ? " checked" : ""}> Seventh chords</label></div>
      <div class="pal">${pal.map((c) => `<button type="button" class="dchip" data-add="${esc(c.sym)}"><span class="num">${esc(c.numeral)}</span><b>${esc(c.sym)}</b></button>`).join("")}</div>
      <div class="pal pal-x"><span class="eyebrow">Color</span>${extras.map((c) => `<button type="button" class="dchip small" data-add="${esc(c.sym)}"><span class="num">${esc(c.numeral)}</span><b>${esc(c.sym)}</b></button>`).join("")}
        <button type="button" class="btn small" data-act="undo"${d.chords.length ? "" : " disabled"}>Remove last</button></div>
      <div class="pg-rec">
        <button type="button" class="btn${S.rec ? " rec-on" : ""}" data-act="rec">${S.rec ? "■ Stop recording" : "● Record from keyboard"}</button>
        <span class="hint" id="pgRecHint">${S.rec ? "Play each chord and hold it briefly. Each new chord is added with your exact voicing." : "Play chords on your keyboard to add them with your exact voicing."}</span>
      </div>
    </div>

    <details class="pg-more"${d.notes || (d.tags || []).length || d.credit ? " open" : ""}><summary>Tags, notes and source</summary>
      <div class="pg-form-grid">
        <label class="field wide"><span class="lbl">Tags</span><input id="pgTags2" value="${esc((d.tags || []).join(", "))}" placeholder="neo-soul, ballad"></label>
        <label class="field wide"><span class="lbl">Notes</span><textarea id="pgNotes" rows="2">${esc(d.notes)}</textarea></label>
        <label class="field"><span class="lbl">Credit</span><input id="pgCredit" value="${esc(d.credit ? d.credit.name : "")}" placeholder="@creator"></label>
        <label class="field"><span class="lbl">Link</span><input id="pgLink" type="url" value="${esc(d.credit ? d.credit.url || "" : "")}" placeholder="https://"></label>
      </div>
    </details>
  </form>`;
}

function saveDraft() {
  const d = S.draft;
  const k = draftKey();
  const credit = $("#pgCredit").value.trim(), link = $("#pgLink").value.trim();
  const p = {
    id: d.id, name: $("#pgName").value.trim() || "Untitled", key: k.id, tempo: Math.max(30, Math.min(220, +$("#pgTempo").value || 80)), meter: d.meter,
    chords: d.chords, notes: $("#pgNotes").value.trim(),
    tags: $("#pgTags2").value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
    credit: credit || link ? { name: credit, url: link, platform: d.credit ? d.credit.platform : "" } : null,
  };
  if (!p.chords.length) { S.draftErrors = ["Add at least one chord."]; render(); return; }
  store.upsert(p);
  S.sel = p.id; S.viewKey = null; S.view = "detail"; S.rec = false;
  remember();
  render();
}

// Record mode: a chord held steady for 300 ms is added (once) with its exact notes.
export function handleNote(m, ts) {
  if (S.view === "practice") return practice.handleNote(m, ts);
  if (!S.rec) return;
  S.held.set(m, ts);
  recCheck();
}
export function handleNoteOff(m) {
  if (S.view === "practice") return practice.handleNoteOff(m);
  S.held.delete(m);
  if (!S.held.size) S.recLast = "";
}
function recCheck() {
  clearTimeout(S.recTimer);
  const notes = [...S.held.keys()].sort((a, b) => a - b);
  if (notes.length < 2) return;
  S.recTimer = setTimeout(() => {
    const now = [...S.held.keys()].sort((a, b) => a - b);
    if (now.join() !== notes.join()) return;
    const k = draftKey(), ch = identify(notes, k);
    if (!ch || ch.kind !== "chord") { const h = $("#pgRecHint"); if (h) h.textContent = "That isn't a chord Sightline recognizes. Try again."; return; }
    if (ch.sym === S.recLast) return;
    S.recLast = ch.sym;
    // In "detect" mode, settle the key from the first recorded chords.
    if (S.draft.key === "auto" && !S.draft.chords.length) S.draft._detected = fromPlayed([notes]).key;
    S.draft.chords.push(fromChord(ch, draftKey(), S.draft.meter, notes));
    S.draftText = toText(S.draft.chords, draftKey(), S.draft.meter);
    if (S.draft.key === "auto") { const d = fromPlayed(S.draft.chords.map((c) => voicingFor(c, draftKey()))); S.draft._detected = d.key; }
    render();
  }, 300);
}

// ---------- generator ----------
function renderGen() {
  const g = S.gen, k = keyById(g.key);
  const segs = (id, map, cur) => `<div class="seg" id="${id}">${Object.entries(map).map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join("")}</div>`;
  $("#pgMain").innerHTML = `<div class="sheet pg-gen">
    <div class="pg-head"><h2>Generate progressions</h2><button class="btn" data-act="cancel">Close</button></div>
    <p class="hint">Uses the same rules as the Chords tab's suggestions, then colors the chords for the style.</p>
    <div class="pg-form-grid">
      <label class="field"><span class="lbl">Key</span><select id="pgGenKey">${keyOptions(g.key)}</select></label>
      <div class="field"><span class="lbl">Length</span>${segs("pgGenLen", { 4: "4 chords", 8: "8 chords" }, g.length)}</div>
      <div class="field wide"><span class="lbl">Style</span>${segs("pgGenStyle", STYLES, g.style)}</div>
      <div class="field wide"><span class="lbl">Mood</span>${segs("pgGenMood", MOODS, g.mood)}</div>
    </div>
    <button class="btn primary" data-act="generate">Generate 3 ideas</button>
    <div class="gen-results">${g.results.map((r, i) => `<div class="gen-card"><div class="pg-head"><b>${esc(keyName(r.key))}</b><div class="btns"><button class="btn small" data-act="genplay" data-i="${i}">▶ Play</button><button class="btn small primary" data-act="gensave" data-i="${i}">Save</button></div></div>${timeline(r.chords, r.key, { id: "pgGen" + i })}</div>`).join("")}</div>
  </div>`;
}

// ---------- render ----------
function render() {
  renderList();
  if (S.view === "edit") renderEditor();
  else if (S.view === "gen") renderGen();
  else if (S.view === "practice") practice.render();
  else renderDetail();
}
function remember() { CFG.pgSel = S.sel; saveCfg(); }

export function openDraft({ key, chords, name = "" }) {
  location.hash = "#progs";
  startEdit({ name, key: key.id, chords }, true);
}

export function initProgs() {
  store.onLibraryChange(() => { if (S.view !== "edit" && S.view !== "practice") render(); else renderList(); });
  store.loadRepo();
  practice.init({ onExit: () => { S.view = "detail"; render(); } });
  const view = $("#view-progs");

  view.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sel) { S.sel = b.dataset.sel; S.viewKey = null; S.view = "detail"; S.confirmDel = false; S.rec = false; practice.stop(); remember(); render(); return; }
    if (b.dataset.tag) { S.tag = S.tag === b.dataset.tag ? null : b.dataset.tag; renderList(); return; }
    if (b.dataset.add) { const t = S.draftText.trim(); S.draftText = t ? t + (t.includes("|") ? " | " : " ") + b.dataset.add : b.dataset.add; reparse(); render(); return; }
    const p = store.byId(S.sel);
    switch (b.dataset.act || b.id) {
      case "pgNew": S.rec = false; startEdit({}, true); return;
      case "pgGenOpen": S.view = "gen"; render(); return;
      case "practice": S.view = "practice"; practice.open(p, keyById(S.viewKey || p.key)); return;
      case "play": playProg(p.chords, keyById(S.viewKey || p.key), p.tempo, p.meter, "#pgTl", b); return;
      case "edit": startEdit(p); return;
      case "copy": { const id = store.newId(); store.upsert({ ...p, id, name: p.name, origin: undefined }); S.sel = id; remember(); render(); return; }
      case "del": S.confirmDel = true; render(); return;
      case "del-no": S.confirmDel = false; render(); return;
      case "del-yes": store.remove(p.id); S.sel = "s-axis"; S.confirmDel = false; remember(); render(); return;
      case "cancel": S.rec = false; S.view = "detail"; render(); return;
      case "undo": S.draft.chords.pop(); S.draftText = toText(S.draft.chords, draftKey(), S.draft.meter); S.recLast = ""; render(); return;
      case "clearv": S.draft.chords.forEach((c) => delete c.v); render(); return;
      case "rec": S.rec = !S.rec; S.recLast = ""; S.held.clear(); render(); return;
      case "generate": { const g = S.gen; g.results = generateMany({ key: keyById(g.key), style: g.style, mood: g.mood, length: +g.length }, 3); render(); return; }
      case "genplay": { const r = S.gen.results[+b.dataset.i]; playProg(r.chords, r.key, 80, 4, "#pgGen" + b.dataset.i, b); return; }
      case "gensave": { const r = S.gen.results[+b.dataset.i]; startEdit({ name: `${STYLES[S.gen.style]} · ${MOODS[S.gen.mood]} in ${keyName(r.key)}`, key: r.key.id, chords: r.chords, tags: [S.gen.style] }, true); return; }
    }
    if (b.closest("#pgMeter")) { S.draft.meter = +b.dataset.v; reparse(); render(); return; }
    for (const [id, f] of [["#pgGenLen", "length"], ["#pgGenStyle", "style"], ["#pgGenMood", "mood"]]) if (b.closest(id)) { S.gen[f] = b.dataset.v; render(); return; }
  });
  view.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "pgSearch") { S.q = t.value; renderList(); }
    if (t.id === "pgText") {
      S.draftText = t.value; reparse();
      const det = $("#pgDetected"); if (det) det.textContent = keyName(draftKey());
      // Update the preview without rebuilding the input (keeps the cursor in place).
      const k = draftKey();
      const err = view.querySelector(".pg-err");
      if (err) err.remove();
      if (S.draftErrors.length) t.closest("label").insertAdjacentHTML("afterend", `<p class="pg-err">${S.draftErrors.map(esc).join("<br>")}</p>`);
      const old = view.querySelector("#pgEditTl, .pg-empty");
      if (old) old.outerHTML = S.draft.chords.length ? timeline(S.draft.chords, k, { id: "pgEditTl" }) : `<p class="hint pg-empty">Your chords will appear here.</p>`;
    }
    if (t.id === "pgName") S.draft.name = t.value;
    if (t.id === "pgTempo") S.draft.tempo = +t.value;
  });
  view.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "pgViewKey") { S.viewKey = t.value; render(); }
    if (t.id === "pgKey") { S.draft.key = t.value; reparse(); render(); }
    if (t.id === "pgPal7") { CFG.pgPal7 = t.checked; saveCfg(); render(); }
    if (t.id === "pgGenKey") { S.gen.key = t.value; }
  });
  view.addEventListener("submit", (e) => { if (e.target.id === "pgForm") { e.preventDefault(); saveDraft(); } });
  render();
}

export const renderProgs = () => { if (S.view !== "practice") render(); };
export const leaveProgs = () => { S.rec = false; practice.stop(); stopAll(); S.playing = false; };
