"""Contact sheets and seam strips for reviewing renders without watching them.

    python3 -I tools/review.py sheet work/stills work/sheets 5x2
"""
import os
import subprocess
import sys


def sheet(src, dst, grid="6x2", w=216, h=384):
    os.makedirs(dst, exist_ok=True)
    files = sorted(f for f in os.listdir(src) if f.endswith(".png"))
    cols, rows = map(int, grid.split("x"))
    per = cols * rows
    for k in range(0, len(files), per):
        chunk = files[k:k + per]
        inputs = []
        for f in chunk:
            inputs += ["-i", os.path.join(src, f)]
        n = len(chunk)
        filt = "".join(f"[{i}:v]scale={w}:{h}[s{i}];" for i in range(n))
        pads = "".join(f"[s{i}]" for i in range(n))
        layout = "|".join(f"{(i % cols) * w}_{(i // cols) * h}" for i in range(n))
        filt += f"{pads}xstack=inputs={n}:layout={layout}:fill=black[out]"
        out = os.path.join(dst, f"sheet_{k // per:02d}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", filt, "-map", "[out]", out], check=True)
        print(out, chunk[0], "..", chunk[-1])


if __name__ == "__main__" and sys.argv[1] == "sheet":
    if sys.argv[1] == "sheet":
        sheet(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "6x2")


def frames_gray(video, w=72, h=128):
    import numpy as np
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={w}:{h},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1, h, w).astype(np.float32)


def sync(video, beatmap_path="data/beatmap.json"):
    """Cross-correlate picture change with the soundtrack's onsets: the peak lag
    (in frames) should be ~0 if cuts, punches and flashes land on the music."""
    import json
    import numpy as np
    bm = json.load(open(beatmap_path))
    F = frames_gray(video)
    d = np.abs(np.diff(F, axis=0)).mean(axis=(1, 2))
    d = np.concatenate([[d[0]], d])
    # high-pass the visual energy so slow camera drift doesn't dominate
    k = 9
    vis = d - np.convolve(d, np.ones(k) / k, mode="same")
    on = np.array(bm["envelope"]["onset"][: len(vis)])
    acc = np.zeros(len(vis))
    for b in bm["beats"]:
        i = int(round(b["t"] * bm["fps"]))
        if i < len(acc):
            acc[i] = b["accent"]
    def xc(a, b, lag):
        if lag >= 0:
            a2, b2 = a[lag:], b[: len(b) - lag]
        else:
            a2, b2 = a[:lag], b[-lag:]
        a2 = (a2 - a2.mean()) / (a2.std() + 1e-9)
        b2 = (b2 - b2.mean()) / (b2.std() + 1e-9)
        return float((a2 * b2).mean())
    for name, ref in [("onset envelope", on), ("beat accents", acc)]:
        lags = list(range(-8, 9))
        cs = [xc(vis, ref, L) for L in lags]
        best = lags[int(np.argmax(cs))]
        print(f"{name:15s}: peak correlation {max(cs):.3f} at lag {best:+d} frames  (lag 0: {cs[8]:.3f})")


def seam(video):
    """Compare the wrap (last frame -> first frame) with ordinary consecutive frames."""
    import numpy as np
    F = frames_gray(video, 144, 256)
    d = np.abs(np.diff(F, axis=0)).mean(axis=(1, 2))
    wrap = float(np.abs(F[0] - F[-1]).mean())
    print(f"frames {len(F)}  median consecutive diff {np.median(d):.2f}  p90 {np.percentile(d, 90):.2f}  "
          f"max {d.max():.2f}  wrap diff {wrap:.2f}  -> wrap is at the {100 * (d < wrap).mean():.0f}th percentile")


if __name__ == "__main__" and sys.argv[1] in ("sync", "seam"):
    {"sync": sync, "seam": seam}[sys.argv[1]](*sys.argv[2:])
