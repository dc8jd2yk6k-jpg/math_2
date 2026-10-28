"""Analyse the source score: constant-tempo beat grid, downbeat phase, per-bar features.

    python3 -I tools/analyze_audio.py assets/audio/source/f1_theme.m4a data/source_analysis.json

The F1 theme is recorded to a click, so a single (bpm, phase) grid fits the whole
cue; downbeats are found where beat-synchronous harmonic change peaks (chords move
on beat 1, while the backbeat snare dominates beats 2 and 4).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from audio_lib import load, onset_envelope, band_energy_db, beat_chroma  # noqa: E402


def fit_grid(on, fps, t0, t1):
    best = (-1, 0, 0)
    lo, hi = int(t0 * fps), int(t1 * fps)
    for bpm in np.arange(109.90, 110.06, 0.002):
        per = 60.0 / bpm
        n = int((t1 - t0) / per)
        for ph in np.arange(0, per, 0.001):
            first = np.ceil((t0 - ph) / per)
            t = ph + (first + np.arange(n)) * per
            idx = np.round(t * fps).astype(int)
            idx = idx[(idx >= lo + 2) & (idx < hi - 2)]
            v = np.maximum(np.maximum(on[idx - 1], on[idx]), on[idx + 1]).mean()
            if v > best[0]:
                best = (v, bpm, ph)
    return best


def main(src, out):
    x, sr = load(src, mono=True)
    on, fps = onset_envelope(x, sr, hop=128)
    score, bpm, phase = fit_grid(on, fps, 11.0, 129.0)
    per = 60.0 / bpm
    beats = np.arange(phase, len(x) / sr - per, per)
    chroma = beat_chroma(x, sr, beats)
    chg = np.concatenate([[0], 1 - np.sum(chroma[1:] * chroma[:-1], axis=1)])
    sel = (beats[:-1] > 12) & (beats[:-1] < 128)
    mod_change = [float(chg[sel & (np.arange(len(chroma)) % 4 == m)].mean()) for m in range(4)]
    down_mod = int(np.argmax(mod_change))

    hop = 512
    bands = band_energy_db(x, sr, hop, 2048, [(20, 120), (120, 500), (500, 2000), (2000, 8000)])
    efps = sr / hop

    def at(arr, t):
        i = int(round(t * fps))
        return float(arr[max(0, i - 2): i + 3].max()) if i < len(arr) else 0.0

    bars = []
    b = 0
    while True:
        i0 = down_mod + 4 * b
        if i0 + 4 >= len(beats):
            break
        t = float(beats[i0])
        seg = bands[int(t * efps): int(beats[i0 + 4] * efps)]
        bars.append({
            "bar": b, "beat_index": int(i0), "t": round(t, 4),
            "onsets": [round(at(on, beats[i0 + k]), 2) for k in range(4)],
            "sub_db": round(float(seg[:, 0].mean()), 1), "hi_db": round(float(seg[:, 3].mean()), 1),
        })
        b += 1

    res = {
        "source": os.path.basename(src), "sr": sr, "duration": round(len(x) / sr, 4),
        "bpm": round(float(bpm), 4), "beat_sec": per, "phase": round(float(phase), 4),
        "grid_score": round(float(score), 3), "downbeat_mod4": down_mod,
        "harmonic_change_by_mod4": [round(v, 4) for v in mod_change],
        "bar_formula": f"t(bar b, beat k) = {phase:.4f} + ({down_mod} + 4*b + k - 1) * {per:.6f}",
        "bars": bars,
    }
    with open(out, "w") as f:
        json.dump(res, f, indent=1)
    print(f"bpm {bpm:.3f}  phase {phase:.4f}s  grid score {score:.3f}  downbeat beat%4={down_mod}  "
          f"change by mod4 {['%.4f' % v for v in mod_change]}")
    for bar in bars:
        if bar["bar"] in (5, 7, 15, 19, 33, 35, 39, 47, 58, 59):
            print(f"  bar {bar['bar']:3d} @ {bar['t']:8.3f}s  onsets {bar['onsets']}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
