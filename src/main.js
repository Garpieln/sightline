// Entry point: settings controls, tab routing, keyboard shortcuts, input dispatch.
import { $, $$ } from "./dom.js";
import { CFG, saveCfg, app } from "./state.js";
import { midiName, RANGE_TEXT } from "./music.js";
import { initMIDI, onNote, onNoteOff, onPedal, handleComputerKey, handleComputerKeyUp, releaseAllComputerKeys } from "./input.js";
import * as read from "./read.js";
import * as flash from "./flash.js";
import * as chords from "./chords.js";
import { initLearn } from "./learn.js";
import { renderStats, initProgress } from "./progress.js";
import * as sound from "./sound.js";
import { onOutputsChange } from "./input.js";
import { audio } from "./audio.js";
import { initVoicesUI, renderVoices, noteOn as vNoteOn, noteOff as vNoteOff } from "./voicesui.js";

const TABS = ["read", "flash", "chords", "voices", "learn", "stats"];

// ---- settings controls ----
function bindSegments(attr, prefix) {
  $$(`[${attr}]`).forEach((seg) => {
    const name = prefix + seg.getAttribute(attr);
    const sync = () => seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === String(CFG[name]))));
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      CFG[name] = b.dataset.v;
      saveCfg(); sync(); onSetting(name);
    });
    sync();
  });
}

function onSetting(name) {
  if (name === "mode") {
    $("#bpmField").style.opacity = CFG.mode === "wait" ? 0.45 : 1;
    $("#modeHint").textContent = CFG.mode === "tempo"
      ? "The band keeps moving. Keep going through mistakes, like real sight-reading."
      : "The band waits on each note until you play it. No timing grade.";
  }
  if (name === "range") $("#rangeHint").textContent = RANGE_TEXT[CFG.range];
  if (["key", "range", "rhythm", "bars"].includes(name) && !read.isRunning()) read.newExercise();
  if (name.startsWith("f")) flash.clearCard();
}

function syncInputs() {
  $("#bpm").value = CFG.bpm; $("#bpmOut").textContent = CFG.bpm + " bpm";
  $("#offset").value = CFG.offset; $("#offOut").textContent = (CFG.offset > 0 ? "+" : "") + CFG.offset + " ms";
  $("#metro").checked = CFG.metro; $("#countin").checked = CFG.countin;
  $("#fsec").value = CFG.fsec; $("#fsecOut").textContent = CFG.fsec + " s";
  $("#fsound").checked = CFG.fsound; $("#fanyoct").checked = CFG.fanyoct; $("#fname").checked = CFG.fname; $("#fhear").checked = CFG.fhear;
}

for (const id of ["bpm", "offset", "fsec"]) $("#" + id).addEventListener("input", (e) => { CFG[id] = +e.target.value; saveCfg(); syncInputs(); });
for (const id of ["metro", "countin", "fsound", "fanyoct", "fname", "fhear"]) $("#" + id).addEventListener("change", (e) => { CFG[id] = e.target.checked; saveCfg(); });

// ---- tabs ----
function route() {
  const t = (location.hash || "#read").slice(1);
  app.tab = TABS.includes(t) ? t : "read";
  $$("#tabs a").forEach((a) => a.setAttribute("aria-current", a.dataset.tab === app.tab ? "page" : "false"));
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + app.tab));
  if (app.tab !== "read" && read.isRunning()) read.stop(true);
  if (app.tab !== "flash" && flash.isRunning()) flash.end();
  if (app.tab === "stats") renderStats();
  if (app.tab === "voices") renderVoices();
  if (app.tab === "chords") chords.activate(); else chords.deactivate();
}
addEventListener("hashchange", route);

// ---- input ----
onNote((m, ts) => {
  $("#heard").textContent = midiName(m, app.tab === "flash" ? CFG.fkey : CFG.key);
  if (app.tab === "read") read.handleNote(m, ts);
  else if (app.tab === "flash") flash.handleNote(m, ts);
  else if (app.tab === "chords") chords.handleNote(m, ts);
});
onNote((m) => vNoteOn(m));
onNoteOff((m) => { chords.handleNoteOff(m); vNoteOff(m); });
onPedal((down) => chords.handlePedal(down));
document.addEventListener("keyup", handleComputerKeyUp);
addEventListener("blur", releaseAllComputerKeys);

document.addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t.tagName === "INPUT" && t.type !== "range" && t.type !== "checkbox") return;
  const playing = ["read", "flash", "chords", "voices"].includes(app.tab);
  if (e.code === "Space" && (app.tab === "read" || app.tab === "flash")) {
    e.preventDefault();
    if (!e.repeat) app.tab === "read" ? read.toggle() : flash.toggle();
    return;
  }
  if (e.repeat) return;
  if (app.tab === "read" && !read.isRunning()) {
    if (e.code === "KeyN") { read.newExercise(); return; }
    if (e.code === "KeyR") { read.retry(); return; }
  }
  if (playing) handleComputerKey(e);
});

// ---- sound ----
function syncSound() {
  $("#vol").value = CFG.vol; $("#volOut").textContent = Math.round(CFG.vol * 100) + "%";
  $("#muted").checked = CFG.muted; $("#broken").checked = CFG.broken;
  $("#pbpm").value = CFG.pbpm; $("#pbpmOut").textContent = CFG.pbpm + " bpm";
  $$("#soundSrc button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === CFG.sound)));
  $("#soundStatus").textContent = sound.outputLabel();
  $("#soundBox").classList.toggle("muted", CFG.muted || CFG.vol === 0);
}
$("#vol").addEventListener("input", (e) => { sound.setSound({ vol: +e.target.value }); syncSound(); });
$("#muted").addEventListener("change", (e) => { sound.setSound({ muted: e.target.checked }); syncSound(); });
$("#broken").addEventListener("change", (e) => { sound.setSound({ broken: e.target.checked }); });
$("#pbpm").addEventListener("input", (e) => { sound.setSound({ pbpm: +e.target.value }); syncSound(); });
$("#soundSrc").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { sound.setSound({ sound: b.dataset.v }); syncSound(); } });
$("#soundTest").onclick = () => sound.playNotes([48, 60, 64, 67], { gap: 120, dur: 1.6 });
$("#soundBox").addEventListener("toggle", syncSound);
document.addEventListener("click", (e) => { const box = $("#soundBox"); if (box.open && !box.contains(e.target)) box.open = false; });
onOutputsChange(syncSound);
const voicesConnected = initVoicesUI();
onOutputsChange(voicesConnected);
// Start loading the browser piano at the first interaction so the first click plays promptly.
addEventListener("pointerdown", () => { audio(); if (sound.route() === "browser") sound.preload(); }, { once: true });

// Anything with data-play is clickable sound. data-mode: chord (default), melodic,
// interval (melodic then together), scale, or seq (chords separated by "|").
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-play]");
  if (!el) return;
  const mode = el.dataset.mode || "chord";
  const groups = el.dataset.play.split("|").map((g) => g.trim().split(/\s+/).map(Number));
  if (mode === "seq") sound.playSequence(groups.map((midis) => ({ midis, beats: 2 })));
  else if (mode === "melodic") sound.playMelodic(groups[0]);
  else if (mode === "scale") sound.playNotes(groups[0], { gap: 260, dur: 0.45 });
  else if (mode === "interval") { sound.playMelodic(groups[0]); sound.playNotes(groups[0], { delay: 1100, dur: 1.4 }); }
  else sound.playChord(groups[0], e);
});

// ---- boot ----
bindSegments("data-set", "");
bindSegments("data-fset", "f");
syncInputs();
onSetting("mode");
onSetting("range");
read.initRead(syncInputs);
flash.initFlash();
initProgress();
chords.initChords();
initLearn();
syncSound();
sound.applyVolume();
route();
initMIDI((state, text) => { $("#midi").dataset.state = state; $("#midiText").textContent = text; });
