# Testing

## Automated

`npm test` runs the generator, music-model and harmony tests.

## Hardware checks (open)

These need a real MIDI keyboard and can't be checked in the automated browser tests. First tested on a Yamaha P-105.

- [ ] **Keyboard playback.** With Sound → Play through set to Auto or Keyboard, clicking a chord plays it through the keyboard's speakers. If it's silent, switch to Browser and report it.
- [ ] **Echo filter.** After clicking a chord in the Chords tab, the readout doesn't name a chord you didn't play. If it does, the keyboard is sending the app's notes back and the filter in `src/input.js` needs adjusting.
- [ ] **Sustain pedal.** Holding the pedal keeps released notes in the chord; releasing it clears them.
- [ ] **Note-off.** Releasing keys clears the Chords tab readout to "Last played". No stuck notes.
