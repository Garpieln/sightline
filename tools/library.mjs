#!/usr/bin/env node
// Add or list entries in content/progressions/library.json (the "From videos" library).
// Uses the app's own parser, so entries are stored exactly as the app expects.
//
//   node tools/library.mjs add --name "Sunday turnaround" --key "Eb major" \
//        --chords "Abmaj7 Gm7 | Fm7 Bb13 | Ebmaj9" --tempo 72 --tags "gospel,neo-soul" \
//        --credit "@creator" --platform TikTok --url "https://..." --notes "..."
//   node tools/library.mjs list
//   node tools/library.mjs remove <id>
//
// --key accepts "Eb major", "C# minor", or "auto" (detect from the chords).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALL_KEYS, keyName } from "../src/theory.js";
import { parseProgression, toChord } from "../src/progmodel.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = path.join(root, "content/progressions/library.json");
const lib = JSON.parse(fs.readFileSync(file, "utf8"));
const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith("--")) args[rest[i].slice(2)] = rest[i + 1] ?? "", i++; else args._ = rest[i];

const norm = (s) => s.replace(/♭/g, "b").replace(/♯/g, "#").toLowerCase().trim();
function findKey(s) {
  if (!s || s === "auto") return null;
  const k = ALL_KEYS.find((k) => norm(keyName(k)) === norm(s));
  if (!k) throw new Error(`Unknown key "${s}". Use e.g. "Eb major" or "F# minor".`);
  return k;
}
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

if (cmd === "add") {
  if (!args.name || !args.chords) throw new Error("--name and --chords are required");
  const meter = +(args.meter || 4);
  const p = parseProgression(args.chords, findKey(args.key), meter);
  if (p.errors.length) { console.error("Parse errors:\n  " + p.errors.join("\n  ")); process.exit(1); }
  let id = "v-" + slug(args.name), n = 2;
  while (lib.progressions.some((x) => x.id === id)) id = "v-" + slug(args.name) + "-" + n++;
  const entry = {
    id, name: args.name, key: p.key.id, tempo: +(args.tempo || 80), meter, chords: p.chords,
    tags: (args.tags || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
    notes: args.notes || "",
    credit: args.credit || args.url ? { name: args.credit || "", platform: args.platform || "", url: args.url || "" } : null,
    added: new Date().toISOString().slice(0, 10),
  };
  lib.progressions.unshift(entry);
  fs.writeFileSync(file, JSON.stringify(lib, null, 2) + "\n");
  console.log(`Added ${id}: ${p.chords.map((c) => toChord(c, p.key).sym).join(" ")} in ${keyName(p.key)}`);
} else if (cmd === "remove") {
  const before = lib.progressions.length;
  lib.progressions = lib.progressions.filter((x) => x.id !== args._);
  fs.writeFileSync(file, JSON.stringify(lib, null, 2) + "\n");
  console.log(before === lib.progressions.length ? "Not found" : `Removed ${args._}`);
} else {
  for (const p of lib.progressions) {
    const k = ALL_KEYS.find((k) => k.id === p.key);
    console.log(`${p.id}  ${p.name}  [${keyName(k)}]  ${p.chords.map((c) => toChord(c, k).sym).join(" ")}${p.credit && p.credit.name ? "  · " + p.credit.name : ""}`);
  }
  if (!lib.progressions.length) console.log("(library is empty)");
}
