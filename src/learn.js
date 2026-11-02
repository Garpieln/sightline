// Learn: lesson index and bodies are content files under content/lessons/.
// Add a lesson by adding an HTML fragment and an entry in index.json.
import { $ } from "./dom.js";
import { load, save } from "./storage.js";

let lessons = [];
const cache = {};
let current = load("lesson", "practice");

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

function renderToc() {
  let html = "", group = "";
  for (const l of lessons) {
    if (l.group !== group) { group = l.group; html += `<div class="grp">${group}</div>`; }
    html += `<button data-id="${l.id}" aria-current="${l.id === current}">${l.title}</button>`;
  }
  $("#toc").innerHTML = html;
}

async function show(id, scroll) {
  const i = Math.max(0, lessons.findIndex((l) => l.id === id));
  const l = lessons[i];
  current = l.id;
  save("lesson", current);
  renderToc();
  try {
    cache[l.id] ??= await fetchText(`content/lessons/${l.file}`);
  } catch (e) {
    $("#lesson").innerHTML = `<h2>${l.title}</h2><p>This lesson couldn't load. Check your connection and reload the page.</p>`;
    return;
  }
  const prev = lessons[i - 1], next = lessons[i + 1];
  $("#lesson").innerHTML = `<h2>${l.title}</h2><p class="src">${l.group} · lesson ${i + 1} of ${lessons.length}</p>${cache[l.id]}
    <div class="pager">${prev ? `<button class="btn" data-id="${prev.id}">← ${prev.title}</button>` : "<span></span>"}${next ? `<button class="btn" data-id="${next.id}">${next.title} →</button>` : ""}</div>`;
  if (scroll) { $("#lesson").scrollIntoView({ block: "start" }); scrollBy(0, -80); }
}

export async function initLearn() {
  document.addEventListener("click", (e) => {
    const b = e.target.closest("#toc button, #lesson .pager button");
    if (b) show(b.dataset.id, true);
  });
  try {
    lessons = JSON.parse(await fetchText("content/lessons/index.json"));
    await show(current, false);
  } catch (e) {
    $("#lesson").innerHTML = `<h2>Lessons unavailable</h2><p>The lesson files couldn't load. Open Sightline through its web address or a local server, not by double-clicking the file.</p>`;
  }
}
