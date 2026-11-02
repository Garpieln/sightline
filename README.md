# Sightline

A sight-reading trainer for MIDI keyboards. The music stays still on the page while a highlighted band moves at your tempo. You play each note as the band reaches it, and every note is graded on pitch and timing.

It also includes timed note flashcards, music theory lessons, and progress tracking.

## Features

- **Read & play**: generated melodies that follow musical rules, in C, G, D, F and B♭ major. Tempo mode (30–160 bpm) or Wait mode. Live color feedback or summary only. End-of-run report with tempo suggestions.
- **Flashcards**: one note at a time with an adjustable timer, a penalty on misses, and reaction-time tracking.
- **Learn**: 15 lessons on practice science, technique, reading, theory, harmony, ear playing, improvisation and composition. Each claim is tagged Evidence, Convention or Opinion.
- **Progress**: accuracy trend, per-note accuracy, session history, and backup export/import.
- **Adaptive**: notes you miss come up more often in both exercises and flashcards.

## Requirements

- A browser with Web MIDI: **Chrome, Edge or Firefox** on Mac, Windows, Linux or ChromeOS. Safari, iPhone and iPad aren't supported.
- Any USB MIDI keyboard. Most digital pianos with a "USB to Host" port work without drivers.
- No keyboard? Computer keys work: `A`–`;` are the white keys from middle C, `W E T Y U O P` are the black keys, and `Z` / `X` shift the octave.

## Running it

Sightline is a static site with no build step and no server code.

**Hosted:** open the GitHub Pages address (see the repository's About section).

**Locally:** browsers block JavaScript modules on `file://` pages, so serve the folder:

```sh
python3 -m http.server 5173      # or: npm start
```

Then open <http://localhost:5173>. Localhost counts as a secure page, so MIDI works.

## Development

```sh
npm test        # generator and music-model tests (Node 20+)
```

| Path | What's there |
|---|---|
| `index.html`, `css/styles.css` | Page markup and styles |
| `src/main.js` | Entry point: settings, tabs, shortcuts, input routing |
| `src/music.js` | Keys, pitches, note names, ranges |
| `src/generator.js` | Exercise generator |
| `src/staff.js`, `src/glyphs.js` | SVG staff and notation drawing |
| `src/read.js`, `src/flash.js` | Read & play and Flashcards |
| `src/learn.js`, `content/lessons/` | Lesson loader and lesson content |
| `src/progress.js`, `src/state.js`, `src/storage.js` | Stats, settings, storage and backups |
| `src/input.js`, `src/audio.js` | MIDI and computer-key input, metronome sounds |
| `docs/` | Roadmap and changelog |

To add a lesson, add an HTML fragment to `content/lessons/` and an entry in `content/lessons/index.json`.

## Privacy

Progress is stored only in your browser. Nothing is sent anywhere. Use **Progress → Export progress** to back it up or move it.

## Licenses

- Code and lesson text: MIT (see `LICENSE`).
- Music symbols are outlines from the Noto Music font, under the SIL Open Font License 1.1 (see `LICENSES/NotoMusic-OFL.txt`).
- Built-in music will be public domain only. Copyrighted songs are only ever loaded from files users import themselves.
