# Changelog

## 0.5.0 — 2026-11-01

New **Voices** tab: control your keyboard's own sounds.

- Choose any of the keyboard's voices. The Yamaha P-105's 14 voices are built in, and a General MIDI set covers other keyboards. Auto-detected, with a manual override.
- Layers: two voices on the same keys, each with its own volume and octave.
- Splits: two or three zones with different voices. Set a split point by clicking Set start and pressing a key.
- 8 presets (Concert Grand, Pop Grand, Ballad Layer, Jazz Trio, '70s Rhodes, Church Organ, Rock Split, Three Zones), plus your own saved presets.
- 88-key strip showing zones and voices, with keys lighting up as you play.
- Reverb (Off, Room, Hall 1, Hall 2, Stage) and effect (Chorus, Phaser, Tremolo, Rotary speaker) with amounts. Changing the type asks for Chrome's MIDI device permission once.
- Pressing a voice button on the keyboard's panel updates the app.
- Layers and splits turn off the keyboard's Local Control and route keys through Sightline on channels 2–7. The keyboard returns to normal when the tab closes, and Reset keyboard recovers stuck or silent keys.
- App playback (clicked chords, Hear it) now uses channel 16 with the main voice. Echoed notes are filtered by channel instead of timing, so fast repeated notes are never dropped.
- Training tabs still read the keys you physically press, not routed or octave-shifted notes.

## 0.4.0 — 2026-11-01

Sound. Click any chord, note or example to hear it.

- Plays through your MIDI keyboard's own speakers when one is connected, otherwise a sampled grand piano in the browser (Salamander Grand Piano, CC BY 3.0, about 1 MB, loaded on first use). Falls back to a simple synth if the samples can't load.
- Sound settings in the top bar: volume, mute, play through Auto / Keyboard / Browser, broken-chord clicks, progression tempo, and a test chord.
- Chords tab: every chord is clickable (your chord, the diatonic row, suggestions, color chords, progression chips, recent chords). Click plays the chord together; Shift+click plays it broken.
- Suggested chords play in the inversion closest to the chord you just played, so you hear smooth voice leading.
- Progressions have a Play button that plays them one bar per chord and highlights the chord that's sounding.
- Circle of fifths: clicking a key now plays its chord and selects it. A Lock key button makes it the key.
- Learn: play buttons for intervals, scales and modes, chord qualities and inversions, cadences, progressions, and the voice leading, circle and emotion examples.
- Flashcards: hear the correct note after a miss (on by default).
- Read & play: Hear it button after a run plays the exercise at your tempo and highlights each note.
- Keyboards that echo received notes back are filtered so playback is never graded as your playing.
- Wider key-signature spacing on the grand staff.

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
