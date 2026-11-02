# Changelog

## 0.2.0 — 2026-11-01

Restructured for public hosting. No change to how training works.

- Split the single file into modules under `src/`, with styles in `css/`.
- Moved the 15 lessons into editable content files under `content/lessons/`.
- Added progress export and import (versioned JSON backups) on the Progress tab.
- Made setup messages device-neutral instead of specific to one keyboard.
- Header no longer sticks to the top on phone-width screens.
- Added generator and music-model tests (`npm test`).
- Added README, roadmap, changelog, MIT license, and the Noto Music font license.

## 0.1.0 — 2026-10-28

First prototype, as one HTML file.

- Read & play: static staff with a moving tempo band, Tempo and Wait modes, pitch and timing grading, live or summary-only feedback, run summaries.
- Flashcards with an adjustable timer and miss penalties.
- Learn tab with 15 lessons.
- Progress tab with trend chart, per-note accuracy and session history.
- Adaptive weighting toward missed notes.
