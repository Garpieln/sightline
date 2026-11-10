# Sightline: notes for Claude

A static web app (no build step, no backend) for learning piano with a MIDI keyboard. Hosted on GitHub Pages from `main`. Owner: Big G (Nathan), learning on a Yamaha P-105.

## Conventions

- Keep docs current at every milestone: `docs/CHANGELOG.md` (new version entry), `docs/ROADMAP.md`, `README.md` (features and file map), `docs/TESTING.md` (hardware checks that need a real keyboard). Bump `package.json` version.
- Explain the rationale and ask clarifying questions before building larger features. The owner prefers concise, direct communication.
- Run `npm test` before every commit. Test UI changes in headless Chromium with a simulated MIDI keyboard (stub `navigator.requestMIDIAccess`).
- Public-ready: no tracking, only permissively licensed assets (credit them in `LICENSES/` and the README), public-domain music only.
- Never show which piano key to press (no Synthesia-style keyboard hints). Chord names, Roman numerals and staff notation are fine.

## Layout

- `src/theory.js`: harmony engine (keys, chord recognition and spelling, analysis, suggestions, voicing). Pure.
- `src/progmodel.js`: progression parsing, key-relative storage, transposition, grading, generator. Pure.
- `src/*ui.js`, `src/read.js`, `src/flash.js`, `src/chords.js`, `src/practice.js`: tabs.
- `src/input.js` (MIDI in/out), `src/sound.js` (playback, channel 16 to the keyboard), `src/voices.js` (keyboard voices, layers/splits on channels 2–7).
- `content/lessons/`: Learn tab content. `content/progressions/library.json`: the "From videos" library.

## Adding progressions from videos

Follow `docs/VIDEO-PIPELINE.md`. Always propose the entry and wait for the owner's approval before adding it.
