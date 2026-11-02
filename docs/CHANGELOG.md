# Changelog

## 0.3.0 — 2026-11-01

New **Chords** tab for building chord and key-signature knowledge around the circle of fifths.

- Names what you play: triads, 7ths, sus, 6, add9, power chords and 9ths, with inversions and slash names. Ambiguous sets (C6 / Am7) show both readings. Two notes show the interval.
- Counts held notes, broken chords within an adjustable window (default 1.5 s), and the sustain pedal.
- Spells notes correctly for the key (B♭ in C major, G♯°7 in A minor) and draws them on a grand staff with the key signature.
- Interactive circle of fifths: majors outside, relative minors inside, key signatures around the edge. Highlights the key's six chords, the chord you're playing, and numbered next-chord suggestions. Click a key to lock it.
- Key detection from your recent chords, with an Auto / Locked switch.
- Roman-numeral analysis, including secondary dominants (V7/vi), secondary leading-tone chords and borrowed chords (iv, ♭VI, ♭VII).
- Suggestions with a reason for each:
  - Next chord, ranked Strong / Common / Color, with circle movement and shared notes.
  - Add color: in-key 7ths, add9, 6 and sus versions of the chord.
  - Progressions: named patterns (pop axis, ii–V–I, Andalusian and more) that contain the chord.
- Names-only by default so you work out the notes. A Show notes toggle reveals them.
- Diatonic chord row for the current key, as triads or sevenths.
- New lesson: The circle of fifths.
- Input now handles note-off and the sustain pedal. Computer keys can be held together to play chords.
- Added a grand staff renderer with bass clef. Read & play still uses treble only.
- Added chord-recognition, analysis and key-detection tests.

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
