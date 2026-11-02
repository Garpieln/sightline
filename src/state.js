// Shared app state: settings and progress. Objects are mutated in place so every
// module that imported them sees the same data.
import { load, save } from "./storage.js";

const DEFAULTS = {
  key: "C", range: "five", rhythm: "q", bars: "8", mode: "tempo", bpm: 60, feedback: "live",
  metro: true, countin: true, offset: 0,
  fkey: "C", frange: "oct", fsec: 4, fcount: "20", fsound: true, fanyoct: false, fname: true,
  ckey: "0M", cauto: true, cnotes: false, cwindow: 1.5, csev: false,
};

export const CFG = Object.assign({}, DEFAULTS, load("cfg", {}));
export const saveCfg = () => save("cfg", CFG);

export const app = { tab: "read" };

// Progress: per-note counters and a session log.
// notes[midi] = { rs: read seen, ro: read ok, fs: flash seen, fo: flash ok, frt: flash ms total }
export const ST = Object.assign({ notes: {}, sessions: [] }, load("stats", {}));
export const saveStats = () => save("stats", ST);

export function nstat(m) {
  return ST.notes[m] || (ST.notes[m] = { rs: 0, ro: 0, fs: 0, fo: 0, frt: 0 });
}

// Smoothed miss rate; unseen notes get a moderate prior so they get sampled.
export function missRate(m) {
  const n = ST.notes[m];
  if (!n) return 0.3;
  const seen = n.rs + n.fs, ok = n.ro + n.fo;
  return (seen - ok + 0.6) / (seen + 2);
}

export function addSession(s) {
  ST.sessions.push(s);
  if (ST.sessions.length > 400) ST.sessions.splice(0, ST.sessions.length - 400);
  saveStats();
}

export function replaceStats(data) {
  ST.notes = data && typeof data.notes === "object" ? data.notes : {};
  ST.sessions = data && Array.isArray(data.sessions) ? data.sessions : [];
  saveStats();
}
