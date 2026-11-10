# Video → progression library

How chord progressions from social-media videos get into the **From videos** section of the Progressions tab.

## For you (sharing a video)

1. Save the video to your phone or Mac. On TikTok or Instagram, use **Save video** / **Download** if offered; otherwise screen-record it.
2. Attach the file in a chat with Claude and say something like "add this to my progression library". Trim long videos first. Uploads have a size limit, and only the part with the progression matters.
3. Claude replies with a proposed entry: name, key, chords, tempo, credit, and a confidence note for anything uncertain. You can listen to the chords in the app before agreeing.
4. Say yes (or correct it). Claude adds it to `content/progressions/library.json` and pushes. It appears in the app after a reload.

Links alone don't work: Claude can't open TikTok, Instagram or YouTube pages.

## For Claude (processing a video)

Setup in a fresh session (once):

```sh
pip install --break-system-packages librosa==0.10.2.post1   # audio analysis
which ffmpeg                                                   # frames and audio
```

1. **Extract frames and audio** into the scratchpad, never into the repo:
   ```sh
   tools/video/frames.sh <video> <scratch>/vid 1      # 1 frame/s + scene changes, contact sheets, audio.wav
   ```
2. **Read the frames.** Open `sheet-*.jpg` and `first.jpg`. Look for:
   - on-screen chord labels (the most reliable source; note the exact spelling: Cmaj9, 7♯9, slash chords, Roman or Nashville numbers)
   - the creator's handle (watermark, usually the first frame or a corner) and platform
   - the pianist's hands, when visible: which keys, to confirm voicings and catch labels that are simplified or wrong
   Open individual `frames/f*.jpg` for detail.
3. **Analyze the audio:**
   ```sh
   python3 tools/video/audio_chords.py <scratch>/vid/audio.wav [--start S --end E]
   ```
   Trust it for tempo, roots, bass notes and chord timing. Treat qualities as approximate: it often reports G for G13 or A7 for A7♯9.
4. **Cross-check.** Labels give names; audio gives roots, timing and the key; hands settle disagreements. If the sources conflict and nothing settles it, say so in the proposal.
5. **Propose the entry to the user and wait for approval:** name, key, chords with beats (bars with `|` when chords share a bar), tempo, tags, credit (handle + platform; URL only if the user gave one), notes on anything uncertain.
6. **Add and publish after approval:**
   ```sh
   node tools/library.mjs add --name "…" --key "Eb major" --chords "Abmaj7 Gm7 | Fm7 Bb13 | Ebmaj9" \
        --tempo 72 --tags "gospel,neo-soul" --credit "@handle" --platform TikTok --notes "…"
   npm test && git add content/progressions/library.json && git commit -m "Library: add …" && git push
   ```
   `--key auto` detects the key from the chords. `node tools/library.mjs list` / `remove <id>` manage entries.

## Accuracy

| Source | Good at | Weak at |
|---|---|---|
| On-screen labels | Exact chord names | Creators sometimes simplify or mislabel |
| Hands | Exact voicing, inversions | Camera angle, hands blocking keys, fast playing |
| Audio (`audio_chords.py`) | Roots, bass notes, timing, tempo, key | Extensions (9/11/13), altered chords, talking or music over the piano, very fast changes |

Tested on a synthetic clip (Dm9 G13 Cmaj9 A7♯9 at 84 bpm): the labels and handle read exactly from the frames, and the audio got every root and change right but simplified the qualities (Dm, G, Cmaj7/9, A7).

## Rights

Chord progressions aren't copyrightable, and each entry credits the creator. Video files stay in the session's scratch space and are never committed.
