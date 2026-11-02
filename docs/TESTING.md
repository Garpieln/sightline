# Testing

## Automated

`npm test` runs the generator, music-model and harmony tests.

## Hardware checks (open)

These need a real MIDI keyboard and can't be checked in the automated browser tests. First tested on a Yamaha P-105.

- [ ] **Keyboard playback.** With Sound → Play through set to Auto or Keyboard, clicking a chord plays it through the keyboard's speakers. If it's silent, switch to Browser and report it.
- [ ] **Echo filter.** After clicking a chord in the Chords tab, the readout doesn't name a chord you didn't play. If it does, the keyboard is sending the app's notes back and the filter in `src/input.js` needs adjusting.
- [ ] **Sustain pedal.** Holding the pedal keeps released notes in the chord; releasing it clears them.
- [ ] **Voice change.** Picking a voice in the Voices tab (Single mode) changes what your keys sound like. If only clicked chords change, report it: the keyboard may not apply program changes to its own keys.
- [ ] **Layer and split.** Ballad Layer plays piano and strings together. Jazz Trio plays bass below C3 and piano above. No noticeable delay.
- [ ] **Return to normal.** Closing the tab during a split, then pressing keys: the keyboard plays normally. If silent, Reset keyboard or power-cycle it.
- [ ] **Effects.** Changing reverb type asks for Chrome's MIDI permission once, then Room vs Hall 2 sound different.
- [ ] **Panel sync.** Pressing a voice button on the keyboard updates the Voices tab.
- [ ] **Playback channel.** Clicked chords still sound through the keyboard (now on channel 16).
- [ ] **Note-off.** Releasing keys clears the Chords tab readout to "Last played". No stuck notes.
