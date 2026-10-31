"""Synthesize the sound effects and mix them under the score.

Every sound is generated here (modal/physical models in numpy, seeded): no samples.
Cue times come from data/sfx_events.json (tools/sfx_events.mjs), which reads them from
the same code that times the picture. Effects are added into a circular buffer exactly
one loop long, so tails ring across the seam just like the music does.

    node tools/sfx_events.mjs
    python3 -I tools/build_sfx.py      -> assets/audio/sfx.wav, assets/audio/soundtrack_mix.wav
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from audio_lib import load, write_wav, true_peak_db, limit  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SR = 48000


def rel(p):
    return os.path.join(ROOT, p)


def db(x):
    return 10 ** (x / 20)


# ------------------------------------------------------------------ building blocks
def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def modes(freqs, amps, decays, dur, rng, detune=0.0):
    """Sum of exponentially damped sinusoids (struck-object modes)."""
    t = t_axis(dur)
    y = np.zeros_like(t)
    for f, a, d in zip(freqs, amps, decays):
        f = f * (1 + detune * (rng.random() * 2 - 1))
        y += a * np.exp(-t / d) * np.sin(2 * np.pi * f * t + rng.random() * 2 * np.pi)
    return y


def band(x, lo, hi, soft=0.15):
    """FFT band-pass with soft (log-frequency) edges."""
    n = len(x)
    F = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR) + 1e-3
    lf = np.log(f)
    m = 1 / (1 + np.exp(-(lf - np.log(lo)) / soft)) * (1 / (1 + np.exp((lf - np.log(hi)) / soft)))
    return np.fft.irfft(F * m, n)


def burst(dur, decay, rng, lo=None, hi=None):
    """A noise burst with an exponential decay, optionally band-limited."""
    t = t_axis(dur)
    y = rng.standard_normal(len(t)) * np.exp(-t / decay)
    if lo or hi:
        y = band(y, lo or 20, hi or 20000)
    return y


def norm(y, peak=1.0):
    m = np.abs(y).max() + 1e-12
    return y * (peak / m)


def pan(y, p):
    """Constant-power pan, p in [-1, 1]; mono -> stereo."""
    a = (p + 1) * np.pi / 4
    return np.stack([y * np.cos(a), y * np.sin(a)], axis=1)


def reverb(y, rt60=1.4, wet=0.35, rng=None, tone=4000):
    """Convolve with a synthetic exponentially decaying stereo noise tail."""
    rng = rng or np.random.default_rng(7)
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt60)
    irs = [band(rng.standard_normal(n) * env, 80, tone) for _ in range(2)]
    irs = [ir / np.sqrt((ir ** 2).sum()) for ir in irs]
    mono = y if y.ndim == 1 else y.mean(axis=1)
    L = len(mono) + n
    out = np.zeros((L, 2))
    Fm = np.fft.rfft(mono, L)
    for c in range(2):
        out[:, c] = np.fft.irfft(Fm * np.fft.rfft(irs[c], L), L)
    dry = np.zeros((L, 2))
    dry[: len(mono)] = (y if y.ndim == 2 else pan(y, 0))
    return dry + wet * out * 3.0


def tv_band(noise, centers, width_oct=0.9, hop=256, nfft=1024):
    """Time-varying band-pass of a noise signal: centers[i] (Hz) per hop."""
    win = np.hanning(nfft)
    n = len(noise)
    out = np.zeros(n + nfft)
    wsum = np.zeros(n + nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR) + 1e-3
    lf = np.log2(f)
    for i, start in enumerate(range(0, n, hop)):
        seg = np.zeros(nfft)
        chunk = noise[start: start + nfft]
        seg[: len(chunk)] = chunk
        c = centers[min(i, len(centers) - 1)]
        m = np.exp(-0.5 * ((lf - np.log2(c)) / width_oct) ** 2)
        y = np.fft.irfft(np.fft.rfft(seg * win) * m, nfft) * win
        out[start: start + nfft] += y
        wsum[start: start + nfft] += win ** 2
    return out[:n] / np.maximum(wsum[:n], 1e-3)


def curve_at(values, dur, n):
    """Resample a control curve (evenly spaced over dur) to n points."""
    v = np.asarray(values, float)
    return np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(v)), v)


# ------------------------------------------------------------------ the sounds
def stone(rng, color="B", hero=False):
    """A Go stone on a thick kaya board: a sub-millisecond click, the board's modes,
    a short ring from the stone itself. Slate (black) is a touch darker than shell."""
    k = 1.0 if color == "B" else 1.08
    dur = 1.0 if hero else 0.35
    sl = 1.7 if hero else 1.0
    y = modes([182 * k, 1120 * k, 2390 * k, 3920 * k, 5600 * k], [0.55, 0.9, 0.65, 0.42, 0.22],
              [0.09 * sl, 0.05 * sl, 0.032 * sl, 0.02 * sl, 0.012 * sl], dur, rng, detune=0.03)
    y += 0.25 * modes([7200 * k], [1], [0.008], dur, rng)
    click = burst(0.004, 0.0004, rng, lo=2500)
    y[: len(click)] += 1.6 * norm(click)
    return norm(y)


def move37(rng):
    y = stone(rng, "B", hero=True)
    t = t_axis(1.0)
    thump = np.sin(2 * np.pi * (72 - 18 * t) * t) * np.exp(-t / 0.16)
    y = y + 0.55 * thump
    return reverb(norm(y), rt60=1.6, wet=0.32, rng=rng, tone=5000)


def chess(rng, capture=False):
    """A felted wooden Staunton piece set down on a wooden board."""
    y = modes([430, 1350, 2150, 3300], [0.9, 0.7, 0.45, 0.25], [0.05, 0.03, 0.02, 0.012], 0.3, rng, detune=0.04)
    t = t_axis(0.3)
    y += 0.6 * np.sin(2 * np.pi * 118 * t) * np.exp(-t / 0.04)
    att = np.clip(t / 0.0015, 0, 1)
    y = norm(y * att)
    if capture:  # the captured piece lifted off just before
        pre = int(0.11 * SR)
        lift = 0.35 * norm(modes([2600, 4100], [1, 0.5], [0.01, 0.006], 0.05, rng))
        z = np.zeros(pre + len(y))
        z[: len(lift)] += lift
        z[pre:] += y
        return z, -pre
    return y, 0


def tick(rng, k):
    """A fine escapement tick, rising a little with each ring."""
    r = 1 + 0.03 * k
    y = modes([3100 * r, 6500 * r], [1, 0.5], [0.004, 0.0025], 0.03, rng)
    y[:96] += 0.5 * norm(burst(0.002, 0.0003, rng, lo=3000))[:96]
    return norm(y)


def bloom(rng):
    """The ignition: a sub swell under a soft air bloom."""
    t = t_axis(2.0)
    sub = np.sin(2 * np.pi * (78 * np.exp(-t / 1.2) + 40) * t) * np.exp(-t / 0.7) * np.clip(t / 0.03, 0, 1)
    air = band(rng.standard_normal(len(t)), 250, 2200) * np.exp(-t / 0.5) * np.clip(t / 0.06, 0, 1)
    return norm(sub) * 0.9 + norm(air) * 0.35


def rewind(rng, dur):
    """Tape rewinding: a whirring band of noise and a motor tone that spin up, race,
    and wind down as the head lands, with a little capstan flutter."""
    t = t_axis(dur + 0.25)
    u = t / dur
    spin = np.clip(u / 0.12, 0, 1) * np.clip((1.08 - u) / 0.35, 0, 1)
    f = 260 + 1500 * spin ** 1.3
    phase = 2 * np.pi * np.cumsum(f) / SR
    flutter = 1 + 0.25 * np.sin(2 * np.pi * 17 * t)
    tone = (np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.15 * np.sin(3 * phase)) * flutter
    hop = 256
    centers = curve_at(f * 2.2, dur, int(np.ceil(len(t) / hop)) + 1)
    hiss = tv_band(rng.standard_normal(len(t)), centers, width_oct=0.7, hop=hop)
    y = (0.45 * norm(tone) + norm(hiss)) * spin
    return norm(y)


def whoosh(rng, dur, speed):
    """Air past the moving head: band noise whose pitch and level follow its speed."""
    t = t_axis(dur + 0.2)
    v = curve_at(speed, dur, len(t))
    v = v / (max(speed) + 1e-6)
    hop = 256
    centers = curve_at(300 + 2600 * v ** 0.8, dur, int(np.ceil(len(t) / hop)) + 1)
    y = tv_band(rng.standard_normal(len(t)), centers, width_oct=0.8, hop=hop) * v ** 1.3
    yl = y
    yr = np.roll(tv_band(rng.standard_normal(len(t)), centers, width_oct=0.8, hop=hop) * v ** 1.3, 0)
    s = np.stack([yl, yr], axis=1)
    return s / (np.abs(s).max() + 1e-9)


def pencil(rng, dur):
    """Graphite on paper: grainy high band noise for as long as the line draws."""
    t = t_axis(dur + 0.08)
    grain = np.abs(band(rng.standard_normal(len(t)), 30, 120, soft=0.3))
    y = band(rng.standard_normal(len(t)), 2200, 7000) * (0.4 + grain / (grain.max() + 1e-9))
    env = np.clip(t / 0.02, 0, 1) * np.clip((dur + 0.06 - t) / 0.06, 0, 1)
    return norm(y * env)


def ding(rng):
    """A small bell: inharmonic partials of a struck bar, long decay."""
    f0 = 880
    y = modes([f0, 2.76 * f0, 5.40 * f0, 8.93 * f0], [1, 0.5, 0.25, 0.12], [1.8, 1.0, 0.6, 0.35], 2.4, rng)
    return reverb(norm(y), rt60=1.8, wet=0.25, rng=rng)


def crackle_click(rng, big):
    """One bond opening: a tiny filtered snap."""
    y = burst(0.003, 0.00025 + rng.random() * 0.0004, rng, lo=1500 + rng.random() * 2500)
    return norm(y) * (0.3 + 0.7 * rng.random()) * (1.7 if big else 1.0)


def wind(rng, dur, curve):
    """The vortex: two decorrelated band-noise channels, brightening with the swirl
    rate and swelling in gusts as the spiral arms sweep past."""
    c = np.asarray(curve, float)
    t = t_axis(dur)
    amp = curve_at(c[:, 0], dur, len(t))
    om = curve_at(c[:, 1], dur, len(t))
    phase = np.cumsum(om) / SR
    gust = 0.65 + 0.35 * np.sin(5 * phase)  # five spiral arms
    hop = 256
    centers = curve_at(220 + 260 * c[:, 1], dur, int(np.ceil(len(t) / hop)) + 1)
    chans = [tv_band(rng.standard_normal(len(t)), centers, width_oct=1.1, hop=hop) for _ in range(2)]
    rot = np.sin(phase * 0.8)
    s = np.stack([chans[0] * (1 - 0.3 * rot), chans[1] * (1 + 0.3 * rot)], axis=1)
    s *= (amp * gust)[:, None]
    return s / (np.abs(s).max() + 1e-9) * (amp.max())


def boom(rng):
    """The blow-up: a falling sub, a burst of air, and a long dark tail."""
    t = t_axis(2.5)
    sub = np.sin(2 * np.pi * np.cumsum(30 + 32 * np.exp(-t / 0.35)) / SR) * np.exp(-t / 0.9) * np.clip(t / 0.004, 0, 1)
    air = band(rng.standard_normal(len(t)), 60, 1600) * np.exp(-t / 0.45)
    y = norm(sub) + 0.5 * norm(air)
    return reverb(norm(y), rt60=2.2, wet=0.3, rng=rng, tone=1800)


def paper(rng):
    """One card flicked into the air: a crinkly short band of noise."""
    d = 0.025 + rng.random() * 0.03
    t = t_axis(d)
    crinkle = (rng.random(len(t)) < 0.08) * rng.standard_normal(len(t)) * 3
    y = band(rng.standard_normal(len(t)) + crinkle, 1400, 7500) * np.sin(np.pi * t / d) ** 0.7
    return norm(y)


def lean(rng):
    """162 Lean marks flipping: a soft spray of ticks over a third of a second."""
    out = np.zeros(int(0.45 * SR))
    for _ in range(24):
        y = tick(rng, rng.random() * 8) * (0.4 + 0.6 * rng.random())
        o = int(rng.random() * 0.33 * SR)
        out[o: o + len(y)] += y[: len(out) - o]
    return norm(out)


def shatter(rng):
    """A barrier breaking: a glass burst, a shower of high pings, a low thud."""
    t = t_axis(1.2)
    y = band(rng.standard_normal(len(t)), 2000, 12000) * np.exp(-t / 0.12)
    for _ in range(46):
        o = int(rng.random() * 0.25 * SR)
        p = modes([2500 + rng.random() * 7000], [1], [0.02 + rng.random() * 0.18], 0.4, rng)
        y[o: o + len(p)] += (0.25 + 0.5 * rng.random()) * p[: len(y) - o]
    y += 0.8 * np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.08)
    left = norm(y)
    right = norm(np.roll(y, 37) + 0.3 * band(rng.standard_normal(len(t)), 3000, 11000) * np.exp(-t / 0.1))
    return np.stack([left, right], axis=1)


# ------------------------------------------------------------------ mixing
# peak level of each effect type (dBFS, before the limiter); the score peaks near -1 dBTP
LEVEL = {
    "stone": -15, "move37": -5, "chess": -12, "tick": -24, "bloom": -15, "rewind": -17, "whoosh": -25,
    "pencil": -31, "ding": -18, "crackle": -33, "wind": -21, "boom": -5, "paper": -27, "lean": -22, "shatter": -9,
}


def main():
    cue = json.load(open(rel("data/sfx_events.json")))
    T = cue["duration"]
    n = int(round(T * SR))
    bus = np.zeros((n, 2))

    def place(t, y, level, p=0.0, offset=0):
        s = y if y.ndim == 2 else pan(y, p)
        s = s * db(level)
        start = int(round(t * SR)) + offset
        idx = (start + np.arange(len(s))) % n  # circular: tails wrap across the seam
        np.add.at(bus, idx, s)

    for i, e in enumerate(cue["events"]):
        rng = np.random.default_rng(1000 + i)
        k, t = e["type"], e["t"]
        L = LEVEL[k]
        if k == "stone":
            place(t, stone(rng, e["color"]) * (0.85 + 0.3 * rng.random()), L, e["pan"])
        elif k == "move37":
            place(t, move37(rng), L, e["pan"])
        elif k == "chess":
            y, off = chess(rng, e["capture"])
            place(t, y, L, 0.1, off)
        elif k == "tick":
            place(t, tick(rng, e["k"]), L, -0.2 + 0.04 * e["k"])
        elif k == "bloom":
            place(t, bloom(rng), L)
        elif k == "rewind":
            place(t, rewind(rng, e["dur"]), L)
        elif k == "whoosh":
            place(t, whoosh(rng, e["dur"], e["speed"]), L)
        elif k == "pencil":
            place(t, pencil(rng, e["dur"]), L, rng.random() * 0.6 - 0.3)
        elif k == "ding":
            place(t, ding(rng), L)
        elif k == "crackle":
            place(t, crackle_click(rng, e["big"]), L, rng.random() * 1.4 - 0.7)
        elif k == "wind":
            place(t, wind(rng, e["dur"], e["curve"]), L)
        elif k == "boom":
            place(t, boom(rng), L)
        elif k == "paper":
            place(t, paper(rng), L, rng.random() * 1.6 - 0.8)
        elif k == "lean":
            place(t, lean(rng), L, 0.15)
        elif k == "shatter":
            place(t, shatter(rng), L)

    music, sr = load(rel("assets/audio/soundtrack.wav"))
    if sr != SR or len(music) != n:
        sys.exit(f"soundtrack is {len(music)} samples @ {sr}, expected {n} @ {SR}")
    os.makedirs(rel("assets/audio"), exist_ok=True)
    write_wav(rel("assets/audio/sfx.wav"), (bus * 0.5).astype(np.float32))
    mix = music.astype(np.float64) + bus
    tp_raw = true_peak_db(mix.astype(np.float32))
    mix = limit(mix, ceiling_db=-1.5, lookahead=96, release_s=0.08, circular=True)
    tp = true_peak_db(mix.astype(np.float32))
    write_wav(rel("assets/audio/soundtrack_mix.wav"), mix.astype(np.float32))
    rms = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-12)  # noqa: E731
    print(f"{len(cue['events'])} effects; bus rms {rms(bus):.1f} dB vs music rms {rms(music):.1f} dB")
    print(f"mix true peak {tp_raw:.2f} dBTP before limiting -> {tp:.2f} dBTP")
    print(f"wrap continuity: |last - first| = {np.abs(mix[-1] - mix[0]).max():.4f} (typical step {np.median(np.abs(np.diff(mix[:, 0]))):.4f})")


if __name__ == "__main__":
    main()
