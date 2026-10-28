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


if __name__ == "__main__":
    if sys.argv[1] == "sheet":
        sheet(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "6x2")
