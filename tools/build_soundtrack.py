"""Build the seamlessly looping soundtrack and the beatmap the renderer syncs to.

    python3 -I tools/build_soundtrack.py [data/music_edit.json]

Outputs
  assets/audio/soundtrack.wav  24-bit / 48 kHz, exactly frames/fps seconds long
  data/beatmap.json            beats, bars, segments, hits, rolls, per-frame envelope (video time)

The edit is bar-accurate on the source grid from tools/analyze_audio.py. Each
segment is copied sample-exactly; internal cuts use short equal-power crossfades
placed just before the incoming downbeat transient. The loop seam (last segment ->
first segment) is contiguous in the source recording, so the wrap is the original
performance with no splice. Everything is mixed circularly, so the file loops
without a click.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from audio_lib import load, write_wav, onset_envelope, band_energy_db, true_peak_db  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def rel(p):
    return os.path.join(ROOT, p)


def main(edit_path):
    E = json.load(open(edit_path))
    A = json.load(open(rel(E["analysis"])))
    sr, fps, frames = E["sample_rate"], E["fps"], E["frames"]
    per, phase, dm = A["beat_sec"], A["phase"], A["downbeat_mod4"]
    total = int(round(frames / fps * sr))
    src, _ = load(rel(E["source"]), sr)

    def bidx(bar_beat):
        bar, beat = bar_beat
        return dm + 4 * bar + (beat - 1)

    def bt(bi):
        return phase + bi * per

    segs = []
    for s in E["segments"]:
        b0, b1 = bidx(s["from"]), bidx(s["to"])
        segs.append(dict(name=s["name"], b0=b0, b1=b1, s0=int(round(bt(b0) * sr)), s1=int(round(bt(b1) * sr)),
                         pad=bool(s.get("pad_to_frame_grid"))))
    if segs[-1]["b1"] != segs[0]["b0"]:
        sys.exit("loop seam must be contiguous in the source (last 'to' == first 'from')")
    lengths = [s["s1"] - s["s0"] for s in segs]
    pad = total - sum(lengths)
    padded = [i for i, s in enumerate(segs) if s["pad"]]
    if len(padded) != 1:
        sys.exit("exactly one segment must carry pad_to_frame_grid")
    lengths[padded[0]] += pad
    offs = np.concatenate([[0], np.cumsum(lengths)[:-1]]).astype(int)

    cut_of = {}
    for c in E["cuts"]:
        cut_of[tuple(c["between"])] = {k: int(round(c[k] * sr / 1000)) for k in ("out_fade_ms", "in_fade_ms", "lead_ms")}

    out = np.zeros((total, 2), np.float64)
    n_seg = len(segs)
    for k, s in enumerate(segs):
        prev_cut = cut_of.get((segs[k - 1]["name"], s["name"]))
        next_cut = cut_of.get((s["name"], segs[(k + 1) % n_seg]["name"]))
        o, L = offs[k], lengths[k]
        start = -prev_cut["lead_ms"] if prev_cut else 0
        end = L - next_cut["lead_ms"] + next_cut["out_fade_ms"] if next_cut else L
        n = np.arange(start, end)
        g = np.ones(len(n))
        if prev_cut:
            u = np.clip((n - start) / prev_cut["in_fade_ms"], 0, 1)
            g *= np.sin(0.5 * np.pi * u)
        if next_cut:
            ws = L - next_cut["lead_ms"]
            u = np.clip((n - ws) / next_cut["out_fade_ms"], 0, 1)
            g *= np.cos(0.5 * np.pi * u)
        seg_audio = src[s["s0"] + start: s["s0"] + end].astype(np.float64)
        if len(seg_audio) != len(n):
            sys.exit(f"segment {s['name']} runs past the end of the source")
        np.add.at(out, (o + n) % total, seg_audio * g[:, None])

    tp = true_peak_db(out.astype(np.float32))
    gain_db = min(0.0, E["headroom_dbtp"] - tp)
    out *= 10 ** (gain_db / 20)
    out32 = out.astype(np.float32)
    os.makedirs(rel("assets/audio"), exist_ok=True)
    write_wav(rel("assets/audio/soundtrack.wav"), out32, sr)

    # ---------------------------------------------------------------- checks
    print(f"length {total} samples = {total / sr:.6f}s = {frames} frames @ {fps}; pad {pad} samples "
          f"({pad / sr * 1000:.1f} ms) in {segs[padded[0]]['name']}")
    print(f"true peak before gain {tp:.2f} dBTP -> gain {gain_db:+.2f} dB -> {true_peak_db(out32):.2f} dBTP")
    g = 10 ** (gain_db / 20)
    K = sr // 2
    ref = src[segs[-1]["s1"] - K: segs[-1]["s1"] + K].astype(np.float64) * g
    got = np.concatenate([out[-K:], out[:K]])
    print(f"seam: max |edit - contiguous source| over +-0.5 s = {np.abs(got - ref).max():.2e} (0 = sample-exact)")
    d = np.abs(np.diff(out[:, 0]))
    med = np.median(d)
    mono = out.mean(axis=1)
    for k in range(n_seg):
        c = offs[k]
        w = mono[np.arange(c - int(0.2 * sr), c + int(0.2 * sr)) % total]
        rms = [20 * np.log10(np.sqrt((w[i:i + 480] ** 2).mean()) + 1e-9) for i in range(0, len(w), 4800)]
        jump = d[np.arange(c - 2400, c + 2400) % (total - 1)].max() / (med + 1e-12)
        print(f"cut into {segs[k]['name']:20s} @ {c / sr:8.4f}s  10ms-RMS every 100ms around cut: "
              f"{' '.join(f'{v:5.1f}' for v in rms)}  max|dx|/median {jump:6.1f}")

    # -------------------------------------------------------------- beatmap
    beats = []
    for k, s in enumerate(segs):
        for bi in range(s["b0"], s["b1"]):
            t = offs[k] / sr + (bi - s["b0"]) * per + (bt(s["b0"]) - s["s0"] / sr)
            q = bi - dm
            beats.append({"t": round(t, 5), "bar": q // 4, "beat": q % 4 + 1, "seg": s["name"][0]})
    hop = 128
    on, ofps = onset_envelope(mono.astype(np.float32), sr, hop=hop, circular=True)
    hi_db = band_energy_db(np.concatenate([mono[-2048:], mono, mono[:2048]]).astype(np.float32), sr, hop, 1024,
                           [(2500, 10000)])[:, 0]
    hi_db = hi_db[2048 // hop: 2048 // hop + len(on)]
    hi_flux = np.maximum(0, np.diff(hi_db, prepend=hi_db[0]))
    bands = band_energy_db(np.concatenate([mono[-2048:], mono, mono[:2048]]).astype(np.float32), sr, 512, 2048,
                           [(20, 120), (2000, 8000)])
    bands = bands[2048 // 512: 2048 // 512 + int(np.ceil(total / 512))]
    bfps = sr / 512

    env = {"rms_db": [], "onset": [], "low": [], "high": []}
    on_norm = np.percentile(on, 99.5)
    lo_rng = np.percentile(bands[:, 0], [5, 99.5])
    hi_rng = np.percentile(bands[:, 1], [5, 99.5])
    for f in range(frames):
        t = f / fps
        i = int(t * sr)
        win = mono[np.arange(i - 1200, i + 1200) % total]
        env["rms_db"].append(round(float(20 * np.log10(np.sqrt((win ** 2).mean()) + 1e-9)), 2))
        a, b = int((t - 0.5 / fps) * ofps), int((t + 0.5 / fps) * ofps) + 1
        env["onset"].append(round(float(min(1.0, on[np.arange(a, b) % len(on)].max() / on_norm)), 3))
        j = int(t * bfps) % len(bands)
        env["low"].append(round(float(np.clip((bands[j, 0] - lo_rng[0]) / (lo_rng[1] - lo_rng[0]), 0, 1)), 3))
        env["high"].append(round(float(np.clip((bands[j, 1] - hi_rng[0]) / (hi_rng[1] - hi_rng[0]), 0, 1)), 3))

    # accents: onset strength at every beat (attack lands ~5 ms after the grid line)
    acc_raw = []
    for bb in beats:
        i = int(bb["t"] * ofps)
        acc_raw.append(float(on[np.arange(i - 2, i + int(0.06 * ofps)) % len(on)].max()))
    acc_raw = np.array(acc_raw)
    accents = np.round(np.clip(acc_raw / acc_raw.max(), 0, 1), 3)
    for bb, a in zip(beats, accents):
        bb["accent"] = float(a)

    # hits: prominent onset peaks anywhere (brass stabs, snare cracks), >= 0.2 s apart
    peak_norm = np.percentile(on, 99.9)
    hits = []
    order = np.argsort(on)[::-1]
    taken = np.zeros(len(on), bool)
    gap = int(0.2 * ofps)
    for i in order:
        strength = on[i] / peak_norm
        if strength < 0.45:
            break
        if taken[max(0, i - gap): i + gap].any():
            continue
        taken[i] = True
        t = i / ofps
        nb = min(beats, key=lambda bb: abs(bb["t"] - t))
        hits.append({"t": round(t, 4), "frame": int(round(t * fps)) % frames, "strength": round(float(min(1.0, strength)), 3),
                     "near_beat": f"b{nb['bar']}.{nb['beat']}", "offset_ms": round((t - nb["t"]) * 1000, 1)})
    hits.sort(key=lambda h: h["t"])

    # rolls: sustained 16th/32nd-note activity in the high band (snare / timpani rolls)
    pk = (hi_flux > 1.5) & (hi_flux >= np.roll(hi_flux, 1)) & (hi_flux >= np.roll(hi_flux, -1))
    pk_t = np.nonzero(pk)[0] / ofps
    dens = []
    for j, bb in enumerate(beats):
        t0 = bb["t"] + 0.03
        t1 = beats[j + 1]["t"] if j + 1 < len(beats) else total / sr
        dens.append(int(((pk_t >= t0) & (pk_t < t1)).sum()))
    rolls = []
    j = 0
    while j < len(beats):
        if dens[j] >= 4:
            k = j
            while k + 1 < len(beats) and dens[k + 1] >= 4:
                k += 1
            if k > j:
                t1 = beats[k + 1]["t"] if k + 1 < len(beats) else total / sr
                rolls.append({"t0": beats[j]["t"], "t1": round(t1, 5), "from": f"b{beats[j]['bar']}.{beats[j]['beat']}",
                              "to": f"b{beats[k]['bar']}.{beats[k]['beat']}", "intensity": round(float(np.mean(dens[j:k + 1])), 2)})
            j = k + 1
        else:
            j += 1

    beatmap = {
        "fps": fps, "frames": frames, "duration": round(total / sr, 6), "sample_rate": sr,
        "bpm": A["bpm"], "beat_sec": per,
        "note": "Times are video seconds. 'bar'/'beat' are SOURCE score positions (each source bar occurs once in the edit), "
                "so cues can be written as e.g. b15.1 = the drop.",
        "segments": [{"name": s["name"], "t0": round(offs[k] / sr, 6), "t1": round((offs[k] + lengths[k]) / sr, 6),
                      "src_from": E["segments"][k]["from"], "src_to": E["segments"][k]["to"]} for k, s in enumerate(segs)],
        "beats": beats, "hits": hits, "rolls": rolls, "envelope": env,
    }
    with open(rel("data/beatmap.json"), "w") as f:
        json.dump(beatmap, f, separators=(",", ":"))
    print(f"beats {len(beats)}  hits {len(hits)}  rolls {len(rolls)}: " +
          ", ".join(f"{r['from']}..{r['to']}({r['t0']:.2f}-{r['t1']:.2f}s, {r['intensity']})" for r in rolls))
    top = sorted(beats, key=lambda bb: -bb["accent"])[:12]
    print("strongest accents: " + ", ".join(f"b{bb['bar']}.{bb['beat']}@{bb['t']:.2f}({bb['accent']})" for bb in top))
    for s in beatmap["segments"]:
        print(f"  {s['name']:20s} video {s['t0']:8.4f} -> {s['t1']:8.4f}   src bars {s['src_from']} -> {s['src_to']}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else rel("data/music_edit.json"))
