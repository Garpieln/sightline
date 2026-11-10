#!/usr/bin/env python3
"""Estimate a chord timeline from audio.

Beat-synchronous chroma (harmonic part only) matched against chord templates, plus a
separate bass chroma for slash chords. Output is a draft for a human (or Claude) to check
against on-screen labels and the pianist's hands: audio alone is reliable for roots and
basic qualities, less so for extensions (9, 11, 13) and fast changes.

Usage: audio_chords.py audio.wav [--start SEC] [--end SEC] [--json out.json]
Requires: pip install librosa==0.10.2.post1
"""
import argparse, json, sys
import numpy as np
import librosa

NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
# quality -> (intervals, symbol suffix, prior weight). Richer chords need clearer evidence.
QUAL = {
    "maj": ([0, 4, 7], "", 1.00), "min": ([0, 3, 7], "m", 1.00),
    "7": ([0, 4, 7, 10], "7", 0.96), "maj7": ([0, 4, 7, 11], "maj7", 0.96), "m7": ([0, 3, 7, 10], "m7", 0.96),
    "m7b5": ([0, 3, 6, 10], "m7b5", 0.92), "dim": ([0, 3, 6], "dim", 0.90), "sus4": ([0, 5, 7], "sus4", 0.90),
    "sus2": ([0, 2, 7], "sus2", 0.88), "maj9": ([0, 2, 4, 7, 11], "maj9", 0.90), "m9": ([0, 2, 3, 7, 10], "m9", 0.90),
    "9": ([0, 2, 4, 7, 10], "9", 0.90), "6": ([0, 4, 7, 9], "6", 0.86), "add9": ([0, 2, 4, 7], "add9", 0.90),
    # Extended voicings as pianists usually play them (5th left out)
    "13": ([0, 4, 10, 9, 2], "13", 0.88), "7#9": ([0, 4, 10, 3], "7#9", 0.86), "m11": ([0, 3, 10, 5, 2], "m11", 0.86),
}
BASS_BONUS = 0.12   # the left hand usually plays the root
CHANGE_PENALTY = 0.10  # discourages one-beat flickers between chords

def templates():
    out = []
    for r in range(12):
        for q, (iv, suf, w) in QUAL.items():
            t = np.zeros(12)
            for i, x in enumerate(iv):
                t[(r + x) % 12] = 1.0 if i in (0, 1) else 0.8  # root and 3rd weigh most
            out.append((r, q, suf, w, t / np.linalg.norm(t)))
    return out

def key_estimate(chroma_mean):
    major = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
    best = None
    for r in range(12):
        for mode, prof in (("major", major), ("minor", minor)):
            c = np.corrcoef(chroma_mean, np.roll(prof, r))[0, 1]
            if best is None or c > best[0]:
                best = (c, NAMES[r] + (" major" if mode == "major" else " minor"))
    return best[1], round(float(best[0]), 2)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio"); ap.add_argument("--start", type=float, default=0); ap.add_argument("--end", type=float)
    ap.add_argument("--json")
    a = ap.parse_args()
    y, sr = librosa.load(a.audio, sr=22050, mono=True, offset=a.start, duration=None if a.end is None else a.end - a.start)
    harm = librosa.effects.harmonic(y, margin=3.0)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="frames", tightness=120)
    tempo = float(np.atleast_1d(tempo)[0])
    hop = 512
    chroma = librosa.feature.chroma_cqt(y=harm, sr=sr, hop_length=hop, fmin=librosa.note_to_hz("C2"), n_octaves=5)
    bass = librosa.feature.chroma_cqt(y=harm, sr=sr, hop_length=hop, fmin=librosa.note_to_hz("C1"), n_octaves=2)
    if len(beats) < 4:  # no clear beat: use half-second frames
        beats = np.arange(0, chroma.shape[1], int(0.5 * sr / hop))
    sync = librosa.util.sync(chroma, beats, aggregate=np.median)
    bsync = librosa.util.sync(bass, beats, aggregate=np.median)
    times = librosa.frames_to_time(np.concatenate([[0], beats]), sr=sr, hop_length=hop) + a.start
    T = templates()
    M = np.stack([t for *_, t in T])                      # templates x 12
    W = np.array([w for _, _, _, w, _ in T])
    R = np.array([r for r, *_ in T])
    n = sync.shape[1]
    S = np.full((n, len(T)), -1.0)
    basses = np.argmax(bsync, axis=0)
    bass_strength = bsync.max(axis=0) / (bsync.sum(axis=0) + 1e-9)
    for i in range(n):
        v = sync[:, i]; nv = np.linalg.norm(v)
        if nv < 1e-6: continue
        S[i] = (M @ (v / nv)) * W + BASS_BONUS * (R == basses[i]) * min(1.0, bass_strength[i] * 3)
    # Viterbi: best label path with a fixed cost per chord change.
    dp = S[0].copy(); back = np.zeros((n, len(T)), dtype=int)
    for i in range(1, n):
        stay, jump = dp, dp.max() - CHANGE_PENALTY
        back[i] = np.where(stay >= jump, np.arange(len(T)), dp.argmax())
        dp = np.maximum(stay, jump) + S[i]
    path = [int(dp.argmax())]
    for i in range(n - 1, 0, -1): path.append(int(back[i][path[-1]]))
    path.reverse()
    rows = []
    for i, j in enumerate(path):
        r, q, suf, w, t = T[j]
        others = np.delete(S[i], j)
        rows.append({"root": r, "q": q, "suf": suf, "score": float(S[i][j]), "margin": float(S[i][j] - others.max()), "bass": int(basses[i])})
    # Merge consecutive beats with the same chord.
    segs = []
    for i, r in enumerate(rows):
        t0 = float(times[i]) if i < len(times) else float(times[-1])
        if segs and segs[-1]["root"] == r["root"] and segs[-1]["q"] == r["q"]:
            s = segs[-1]; s["beats"] += 1; s["scores"].append(r["score"]); s["margins"].append(r["margin"]); s["basses"].append(r["bass"])
        else:
            segs.append({**r, "start": round(t0, 2), "beats": 1, "scores": [r["score"]], "margins": [r["margin"]], "basses": [r["bass"]]})
    out = []
    for s in segs:
        b = max(set(s["basses"]), key=s["basses"].count)
        iv, _, _ = QUAL[s["q"]]
        chord_pcs = [(s["root"] + x) % 12 for x in iv]
        sym = NAMES[s["root"]] + s["suf"] + (f"/{NAMES[b]}" if b != s["root"] and b in chord_pcs else "")
        m = float(np.mean(s["margins"])); sc = float(np.mean(s["scores"]))
        conf = "high" if sc > 0.85 and m > 0.04 else "medium" if sc > 0.75 else "low"
        out.append({"chord": sym, "start": s["start"], "beats": s["beats"], "confidence": conf, "score": round(sc, 3)})
    key, kc = key_estimate(np.mean(chroma, axis=1))
    result = {"tempo": round(tempo), "key": key, "key_confidence": kc, "segments": out,
              "text": " ".join(f"{s['chord']}:{s['beats']}" for s in out if s["beats"] >= 2)}
    if a.json:
        with open(a.json, "w") as f: json.dump(result, f, indent=2)
    print(f"tempo ≈ {result['tempo']} bpm   key ≈ {key} ({kc})")
    for s in out:
        flag = "" if s["confidence"] == "high" else f"   [{s['confidence']}]"
        print(f"{s['start']:7.2f}s  {s['chord']:<10} {s['beats']:>2} beats{flag}")
    print("\ndraft (2+ beats):", result["text"])

if __name__ == "__main__":
    sys.exit(main())
