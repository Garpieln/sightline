// Single storage interface. Today: localStorage. Later: IndexedDB or a sync backend
// can replace these two functions without touching feature code.
const PREFIX = "sl.";

export function load(key, fallback) {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? JSON.parse(v) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    /* storage full or blocked: run without persistence */
  }
}

// Versioned backup format so future releases can migrate old exports.
export const EXPORT_VERSION = 1;

export function buildExport(data) {
  return { app: "sightline", version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data };
}

export function parseExport(text) {
  const obj = JSON.parse(text);
  if (!obj || obj.app !== "sightline" || typeof obj.version !== "number" || !obj.data) {
    throw new Error("This file isn't a Sightline progress backup.");
  }
  if (obj.version > EXPORT_VERSION) {
    throw new Error("This backup is from a newer version of Sightline. Update the app and try again.");
  }
  return obj.data;
}
