# Roadmap

Guiding constraints, from the project's goals:

- **Public-ready, not monetized.** Free static hosting, no accounts required, no tracking.
- **Static first.** Add a backend only for a feature that can't work without one (cross-device sync).
- **Evidence-based learning design.** Error-focused practice, spacing, interleaving, retrieval, fading feedback.
- **Not Synthesia.** Never show which key to press. Train reading notation.
- **Licensing.** Only bundle permissively licensed code and public-domain music.

## Done

- **v0.1**: single-file prototype with Read & play, Flashcards, Learn, Progress.
- **v0.2**: modular project, lessons as content files, progress export/import, tests, docs.

## Next

1. **Bass clef and grand staff.** Bass-only and both-hands exercises. Separate stats per clef.
2. **GitHub Pages hosting.** Public URL, HTTPS, installable as an app.
3. **First-run setup.** Detect the keyboard and calibrate input latency by tapping along to clicks.
4. **Song import (MusicXML).** Load pieces exported from MuseScore and play them with the same cursor and grading. Practice tools: loop a section, slow down, hands separately.
5. **Built-in public-domain library.** Graded pieces such as Bach minuets, Burgmüller, Clementi sonatinas and folk tunes.

## Later

- Rhythm expansion: eighth notes, dotted rhythms, rests, 3/4 and 6/8.
- Intervals and chords in exercises (two or more notes at once).
- Fading feedback mode that gradually reduces live colors as accuracy rises.
- Chord and progression trainer: name a chord or Roman numeral, play it, check the voicing.
- Ear training: intervals, chord qualities, and melodic dictation played back by the app.
- Improvisation and composition tools: backing progressions, record and loop, export MIDI.
- Practice planner: suggested session plan from your stats, following the weekly key cycle.
- More keys, including minor keys.
- Offline support.

## Open decisions

- Raw MIDI file import: possible, but quantizing to clean notation is approximate.
- Cross-device sync: needs accounts and a backend. Deferred until there's a clear need.
- iPhone and iPad: no Web MIDI in any iOS browser. Options are microphone pitch detection or an on-screen keyboard.
- Custom domain name.
