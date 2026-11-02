// Voices tab: presets, the 88-key zone strip, zone/layer editors and effects.
import { $ } from "./dom.js";
import { CFG } from "./state.js";
import { midiOutputs, requestSysex, sysexOutput } from "./input.js";
import * as V from "./voices.js";
import { midiName } from "./music.js";

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const kv = () => CFG.kv;
const lit = new Set();
let capture = null, saving = false, effMsg = "";

// ---------- keyboard strip ----------
const LO = 21, HI = 108, WW = 20;
const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
const whiteIndex = (m) => { let n = 0; for (let k = LO; k < m; k++) if (!isBlack(k)) n++; return n; };
const keyX = (m) => (isBlack(m) ? whiteIndex(m) * WW - 6 : whiteIndex(m) * WW);
const keyEnd = (m) => (isBlack(m) ? keyX(m) + 12 : keyX(m) + WW);
const zoneOf = (m) => kv().zones.findIndex((z) => m >= z.lo && m <= z.hi);

function strip() {
  const W = whiteIndex(HI + 1) * WW || 52 * WW;
  let s = `<svg viewBox="0 0 ${W} 132" role="img" aria-label="Keyboard zones">`;
  kv().zones.forEach((z, i) => {
    const x0 = keyX(isBlack(z.lo) ? z.lo - 1 : z.lo), x1 = keyEnd(isBlack(z.hi) ? z.hi + 1 : z.hi);
    s += `<rect class="zband z${i}" x="${x0}" y="0" width="${x1 - x0}" height="30" rx="4"/>`;
    s += `<text class="zlabel" x="${(x0 + x1) / 2}" y="15">${esc(z.layers.map((l) => V.voiceName(l.v) + (l.oct ? ` (${l.oct > 0 ? "+" : ""}${l.oct} oct)` : "")).join(" + "))}</text>`;
  });
  for (let m = LO; m <= HI; m++) if (!isBlack(m)) {
    const zi = zoneOf(m);
    s += `<rect class="wk z${zi}${lit.has(m) ? " on" : ""}" x="${keyX(m)}" y="34" width="${WW}" height="96" rx="2"/>`;
    if (m % 12 === 0) s += `<text class="kname" x="${keyX(m) + WW / 2}" y="122">C${m / 12 - 1}</text>`;
  }
  for (let m = LO; m <= HI; m++) if (isBlack(m)) s += `<rect class="bk${lit.has(m) ? " on" : ""}" x="${keyX(m)}" y="34" width="12" height="58" rx="1.5"/>`;
  kv().zones.slice(1).forEach((z) => { const x = keyX(isBlack(z.lo) ? z.lo - 1 : z.lo); s += `<line class="split" x1="${x}" x2="${x}" y1="0" y2="132"/>`; });
  return s + `</svg>`;
}

// ---------- mode shortcuts ----------
function mode() {
  const z = kv().zones;
  return z.length === 3 ? "three" : z.length === 2 ? "split" : z[0].layers.length === 2 ? "layer" : "single";
}
function setMode(m) {
  const main = kv().zones.find((z) => z.lo <= 60 && z.hi >= 60) || kv().zones[0];
  const L0 = { ...main.layers[0] }, L1 = main.layers[1] ? { ...main.layers[1] } : { v: "strings", oct: 0, vol: 70 };
  const low = kv().zones.length > 1 ? { ...kv().zones[0].layers[0] } : { v: "woodbass", oct: 0, vol: 100 };
  if (m === "single") kv().zones = [{ lo: 21, hi: 108, layers: [L0] }];
  if (m === "layer") kv().zones = [{ lo: 21, hi: 108, layers: [L0, L1] }];
  if (m === "split") kv().zones = [{ lo: 21, hi: 47, layers: [low] }, { lo: 48, hi: 108, layers: [L0] }];
  if (m === "three") kv().zones = [{ lo: 21, hi: 47, layers: [low] }, { lo: 48, hi: 83, layers: [L0] }, { lo: 84, hi: 108, layers: [{ v: "vibes", oct: 0, vol: 90 }] }];
  V.changed();
}

// ---------- rendering ----------
function voiceOptions(sel) {
  let h = "", fam = "";
  for (const v of V.VOICES) {
    if (v.family !== fam) { if (fam) h += "</optgroup>"; fam = v.family; h += `<optgroup label="${fam}">`; }
    h += `<option value="${v.id}"${v.id === sel ? " selected" : ""}>${esc(V.voiceName(v.id))}</option>`;
  }
  return h + "</optgroup>";
}

function render() {
  const outs = midiOutputs(), connected = outs.length > 0, p = V.profile();
  $("#vStatus").innerHTML = connected
    ? `<span class="dot on"></span> Connected to <b>${esc(outs[0].name)}</b> · voice set: ${esc(p.label)}`
    : `<span class="dot"></span> No keyboard connected. You can set things up now; they're sent when a keyboard connects.`;
  $("#vProfile").value = kv().profile;
  $("#vProfileAuto").textContent = `Auto (${connected ? PROFILESHORT() : "detect"})`;

  // presets
  const all = [...V.PRESETS, ...kv().custom];
  $("#vPresets").innerHTML = all.map((pr) => `<span class="preset-wrap"><button class="preset${kv().preset === pr.id ? " here" : ""}" data-preset="${esc(pr.id)}">${esc(pr.name)}</button>${pr.custom ? `<button class="preset-x" data-del="${esc(pr.id)}" aria-label="Delete ${esc(pr.name)}">×</button>` : ""}</span>`).join("")
    + (saving ? `<form class="save-form" id="vSaveForm"><input id="vSaveName" maxlength="30" placeholder="Preset name" required><button class="btn primary">Save</button><button type="button" class="btn" id="vSaveCancel">Cancel</button></form>`
      : `<button class="btn" id="vSave">Save current as preset</button>`);

  $("#vStrip").innerHTML = strip();
  document.querySelectorAll("#vMode button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === mode())));

  // zones
  $("#vZones").innerHTML = kv().zones.map((z, zi) => `<div class="zone z${zi}">
    <div class="zone-head"><span class="swatch z${zi}"></span><b>${kv().zones.length > 1 ? `Zone ${zi + 1} · ` : ""}${midiName(z.lo)}–${midiName(z.hi)}</b>
      ${zi > 0 ? `<button class="btn small" data-act="split" data-z="${zi}">${capture === zi ? "Press a key on your keyboard…" : "Set start"}</button>` : ""}</div>
    ${z.layers.map((l, li) => `<div class="layer">
      <label class="vsel-wrap"><span class="sr">Voice</span><select class="vsel" data-z="${zi}" data-l="${li}">${voiceOptions(l.v)}</select></label>
      <div class="oct"><span class="lbl-s">Octave</span><button class="btn small" data-act="oct" data-d="-1" data-z="${zi}" data-l="${li}" aria-label="Octave down">−</button><output>${l.oct > 0 ? "+" : ""}${l.oct}</output><button class="btn small" data-act="oct" data-d="1" data-z="${zi}" data-l="${li}" aria-label="Octave up">+</button></div>
      <label class="vol"><span class="lbl-s">Volume</span><input type="range" min="0" max="100" step="5" value="${l.vol}" data-act="vol" data-z="${zi}" data-l="${li}"></label>
      ${z.layers.length > 1 ? `<button class="btn small" data-act="rmlayer" data-z="${zi}" data-l="${li}">Remove</button>` : ""}
    </div>`).join("")}
    ${z.layers.length < 2 ? `<button class="btn small add" data-act="addlayer" data-z="${zi}">+ Add a layer</button>` : ""}
  </div>`).join("");

  // effects
  const segs = (id, map, cur) => { $(id).innerHTML = Object.entries(map).map(([k, v]) => `<button data-v="${k}" aria-pressed="${k === cur}">${v[2]}</button>`).join(""); };
  segs("#vReverb", V.REVERBS, kv().reverb);
  segs("#vEffect", V.EFFECTS, kv().effect);
  $("#vRdepth").value = kv().rdepth; $("#vRdepthOut").textContent = kv().rdepth + "%";
  $("#vEdepth").value = kv().edepth; $("#vEdepthOut").textContent = kv().edepth + "%";
  $("#vEffNote").textContent = effMsg || (p.effects ? "" : "Reverb and effect types are set for Yamaha keyboards only. Amounts work on most keyboards.");

  $("#vRouted").hidden = !V.isRouted();
  const qs = $("#qsVoice");
  if (qs) qs.textContent = (all.find((pr) => pr.id === kv().preset) || {}).name || "Custom";
}
const PROFILESHORT = () => V.PROFILES[(() => { const o = midiOutputs()[0]; return o && /p-?105/i.test(o.name) ? "p105" : "gm"; })()].label;

// ---------- events ----------
export function noteOn(m) {
  if (capture !== null) {
    const zs = kv().zones, zi = capture;
    const min = zs[zi - 1].lo + 1, max = zi + 1 < zs.length ? zs[zi + 1].lo - 1 : 108;
    const lo = Math.max(min, Math.min(max, m));
    zs[zi].lo = lo; zs[zi - 1].hi = lo - 1;
    capture = null;
    V.changed();
    lit.add(m);
    render();
    return;
  }
  lit.add(m);
  if (!$("#view-voices").hidden) $("#vStrip").innerHTML = strip();
}
export function noteOff(m) {
  lit.delete(m);
  if (!$("#view-voices").hidden) $("#vStrip").innerHTML = strip();
}

export function initVoicesUI() {
  const onConnect = V.initVoices();
  V.onVoicesChange(render);
  const view = $("#view-voices");

  view.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const zs = kv().zones, zi = +b.dataset.z, li = +b.dataset.l;
    if (b.dataset.preset) { const pr = [...V.PRESETS, ...kv().custom].find((p) => p.id === b.dataset.preset); if (pr) { V.loadPreset(pr); if (pr.effect !== "off" || pr.reverb !== "hall1") await askEffects(); } }
    else if (b.dataset.del) { kv().custom = kv().custom.filter((p) => p.id !== b.dataset.del); if (kv().preset === b.dataset.del) kv().preset = null; V.saveKV(); }
    else if (b.id === "vSave") { saving = true; render(); $("#vSaveName").focus(); return; }
    else if (b.id === "vSaveCancel") { saving = false; }
    else if (b.closest("#vMode")) setMode(b.dataset.v);
    else if (b.closest("#vReverb")) { kv().reverb = b.dataset.v; V.changed(); await askEffects(); }
    else if (b.closest("#vEffect")) { kv().effect = b.dataset.v; if (kv().effect !== "off" && !kv().edepth) kv().edepth = 40; V.changed(); await askEffects(); }
    else if (b.dataset.act === "split") { capture = capture === zi ? null : zi; }
    else if (b.dataset.act === "oct") { const l = zs[zi].layers[li]; l.oct = Math.max(-2, Math.min(2, l.oct + +b.dataset.d)); V.changed(); }
    else if (b.dataset.act === "addlayer") { zs[zi].layers.push({ v: "strings", oct: 0, vol: 70 }); V.changed(); }
    else if (b.dataset.act === "rmlayer") { zs[zi].layers.splice(li, 1); V.changed(); }
    else if (b.id === "vReset") { V.resetKeyboard(); kv().zones = [{ lo: 21, hi: 108, layers: [{ v: "grand", oct: 0, vol: 100 }] }]; kv().preset = "concert"; kv().touched = false; V.saveKV(); }
    else return;
    render();
  });
  view.addEventListener("submit", (e) => {
    if (e.target.id !== "vSaveForm") return;
    e.preventDefault();
    const name = $("#vSaveName").value.trim();
    if (!name) return;
    const id = "c" + Date.now().toString(36);
    const k = kv();
    k.custom.push(JSON.parse(JSON.stringify({ id, name, custom: true, zones: k.zones, reverb: k.reverb, rdepth: k.rdepth, effect: k.effect, edepth: k.edepth })));
    k.preset = id; saving = false; V.saveKV(); render();
  });
  view.addEventListener("change", (e) => {
    const t = e.target;
    if (t.classList.contains("vsel")) { kv().zones[+t.dataset.z].layers[+t.dataset.l].v = t.value; V.changed(); render(); }
    if (t.id === "vProfile") { kv().profile = t.value; V.saveKV(); V.apply(); render(); }
  });
  view.addEventListener("input", (e) => {
    const t = e.target;
    if (t.dataset.act === "vol") { kv().zones[+t.dataset.z].layers[+t.dataset.l].vol = +t.value; V.changed(); }
    if (t.id === "vRdepth") { kv().rdepth = +t.value; $("#vRdepthOut").textContent = t.value + "%"; V.changed(); }
    if (t.id === "vEdepth") { kv().edepth = +t.value; $("#vEdepthOut").textContent = t.value + "%"; V.changed(); }
  });
  render();
  return () => { onConnect(); render(); };
}

// Changing reverb/effect *type* needs the browser's system-exclusive permission.
async function askEffects() {
  if (!V.profile().effects || !midiOutputs().length) return;
  if (!sysexOutput()) {
    effMsg = "Chrome will ask to let Sightline control your MIDI device. Allow it to change reverb and effect types.";
    render();
    const ok = await requestSysex();
    effMsg = ok ? "" : "Permission wasn't granted, so the keyboard keeps its current reverb and effect type. Amounts still work.";
  }
  V.ensureEffects();
  render();
}

export const renderVoices = render;
