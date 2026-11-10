# Sightline

A sight-reading trainer for MIDI keyboards. The music stays still on the page while a highlighted band moves at your tempo. You play each note as the band reaches it, and every note is graded on pitch and timing.

It also includes timed note flashcards, music theory lessons, and progress tracking.

## Features

- **Read & play**: generated melodies that follow musical rules, in C, G, D, F and B♭ major. Tempo mode (30–160 bpm) or Wait mode. Live color feedback or summary only. End-of-run report with tempo suggestions.
- **Flashcards**: one note at a time with an adjustable timer, a penalty on misses, and reaction-time tracking.
- **Chords**: names any chord you play, shows it on the grand staff and an interactive circle of fifths, detects the key, and suggests next chords, richer voicings and progressions with the reason for each.
- **Learn**: 16 lessons on practice science, technique, reading, theory, harmony, ear playing, improvisation and composition. Each claim is tagged Evidence, Convention or Opinion.
- **Progress**: accuracy trend, per-note accuracy, session history, and backup export/import.
- **Sound**: click any chord or example to hear it, through your keyboard's speakers or a sampled piano in the browser. Progressions play back with smooth voice leading.
- **Progressions**: a library of chord progressions (yours, ones added from videos, and starters). Type them, click them from a palette, record them from your keyboard, or generate ideas, then practice in play-along or wait mode in any or all 12 keys.
- **Voices**: switch your keyboard's built-in voices, layer two voices, or split the keyboard into up to three zones, with presets, reverb and effects. Built-in voice list for the Yamaha P-105, General MIDI for other keyboards.
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
npm test        # generator, music-model, harmony and progression tests (Node 20+)
```

| Path | What's there |
|---|---|
| `index.html`, `css/styles.css` | Page markup and styles |
| `src/main.js` | Entry point: settings, tabs, shortcuts, input routing |
| `src/music.js` | Keys, pitches, note names, ranges |
| `src/generator.js` | Exercise generator |
| `src/staff.js`, `src/glyphs.js` | SVG staff and notation drawing |
| `src/read.js`, `src/flash.js` | Read & play and Flashcards |
| `src/theory.js` | Harmony engine: keys, chord recognition, analysis, key detection, suggestions |
| `src/chords.js`, `src/circle.js` | Chords tab and circle of fifths |
| `src/progmodel.js` | Progressions: parsing, key-relative storage, transposition, grading, generator |
| `src/progstore.js`, `src/progsui.js`, `src/practice.js` | Progression library, Progressions tab, practice mode |
| `content/progressions/library.json` | Progressions added from videos |
| `tools/` | Video pipeline (`video/frames.sh`, `video/audio_chords.py`) and `library.mjs` |
| `src/learn.js`, `content/lessons/` | Lesson loader and lesson content |
| `src/progress.js`, `src/state.js`, `src/storage.js` | Stats, settings, storage and backups |
| `src/input.js` | MIDI and computer-key input, MIDI output |
| `src/voices.js`, `src/voicesui.js` | Keyboard voices: program changes, layer/split routing, effects, Voices tab |
| `src/sound.js`, `src/audio.js`, `audio/piano/` | Playback to keyboard or browser piano, metronome, piano samples |
| `docs/` | Roadmap, changelog, testing checklist and video pipeline guide |

To add a lesson, add an HTML fragment to `content/lessons/` and an entry in `content/lessons/index.json`.

## Privacy

Progress is stored only in your browser. Nothing is sent anywhere. Use **Progress → Export progress** to back it up or move it.

## Licenses

- Code and lesson text: MIT (see `LICENSE`).
- Music symbols are outlines from the Noto Music font, under the SIL Open Font License 1.1 (see `LICENSES/NotoMusic-OFL.txt`).
- Piano sound: Salamander Grand Piano V3 by Alexander Holm, CC BY 3.0 (see `LICENSES/Salamander-Piano.txt`). Samples were trimmed and converted to mono MP3.
- Built-in music will be public domain only. Copyrighted songs are only ever loaded from files users import themselves.
