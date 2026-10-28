"""Small numpy-only DSP helpers shared by the audio tools.

Everything here is deterministic and dependency-free (numpy + the ffmpeg CLI),
so the soundtrack and beatmap can be rebuilt bit-for-bit on any machine.
"""
import subprocess
import numpy as np

SR = 48000


def load(path, sr=SR, mono=False):
    """Decode any audio file to float32 via ffmpeg. Returns (samples, sr).
    Stereo arrays are shaped (n, 2)."""
    ch = 1 if mono else 2
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", str(ch), "-ar", str(sr), "-f", "f32le", "-"],
        capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    return (x if mono else x.reshape(-1, 2)), sr


def write_wav(path, x, sr=SR):
    """Write float32 stereo as 24-bit PCM WAV through ffmpeg."""
    x = np.ascontiguousarray(x, dtype=np.float32)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(sr), "-ac", str(x.shape[1]), "-i", "-",
         "-c:a", "pcm_s24le", path], input=x.tobytes(), check=True)


def mel_fb(sr, n_fft, n_mels=64, fmin=30.0, fmax=11000.0):
    def hz2mel(h):
        return 2595 * np.log10(1 + h / 700)

    def mel2hz(m):
        return 700 * (10 ** (m / 2595) - 1)

    mels = np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2)
    bins = np.floor((n_fft + 1) * mel2hz(mels) / sr).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1), np.float32)
    for m in range(1, n_mels + 1):
        lo, c, hi = bins[m - 1], bins[m], bins[m + 1]
        for k in range(lo, c):
            fb[m - 1, k] = (k - lo) / max(1, c - lo)
        for k in range(c, hi):
            fb[m - 1, k] = (hi - k) / max(1, hi - c)
    return fb


def stft_frames(x, n_fft, hop, fn, chunk=2048):
    """Apply fn(|STFT| chunk) over Hann-windowed frames without holding the full STFT."""
    w = np.hanning(n_fft).astype(np.float32)
    n = 1 + (len(x) - n_fft) // hop
    out = []
    for s in range(0, n, chunk):
        e = min(n, s + chunk)
        idx = np.arange(n_fft)[None, :] + hop * np.arange(s, e)[:, None]
        out.append(fn(np.abs(np.fft.rfft(x[idx] * w, axis=1))))
    return np.concatenate(out, axis=0)


def onset_envelope(x, sr, hop=256, n_fft=2048, circular=False):
    """Log-mel spectral flux with local-mean removal; std-normalised.
    With circular=True the signal is treated as a loop (used on the final edit)."""
    if circular:
        pad = n_fft
        x = np.concatenate([x[-pad:], x, x[:pad]])
    fb = mel_fb(sr, n_fft)
    M = stft_frames(x, n_fft, hop, lambda S: np.log1p(10 * (S @ fb.T)))
    flux = np.concatenate([[0], np.maximum(0, np.diff(M, axis=0)).sum(axis=1)])
    fps = sr / hop
    k = max(1, int(fps * 0.4))
    lm = np.convolve(flux, np.ones(k) / k, mode="same")
    on = np.maximum(0, flux - lm)
    # Frame i analyses samples [i*hop, i*hop + n_fft); a transient produces its largest
    # flux when it crosses the window centre, so re-index frames to the window centre.
    on = np.concatenate([np.zeros(n_fft // (2 * hop)), on])
    if circular:
        drop = n_fft // hop
        on = on[drop: drop + int(round((len(x) - 2 * n_fft) / hop))]
    return (on / (on.std() + 1e-9)).astype(np.float32), fps


def band_energy_db(x, sr, hop, n_fft, bands):
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    masks = [(freqs >= a) & (freqs < b) for (a, b) in bands]
    E = stft_frames(x, n_fft, hop, lambda S: np.stack([(S[:, m] ** 2).sum(axis=1) for m in masks], axis=1))
    return 10 * np.log10(E + 1e-10)


def beat_chroma(x, sr, beat_times):
    """Beat-synchronous, L2-normalised 12-bin chroma (55 Hz - 2 kHz)."""
    n_fft, hop = 8192, 1024
    freqs = np.fft.rfftfreq(n_fft, 1 / sr)
    valid = (freqs > 55) & (freqs < 2000)
    pc = np.round(12 * np.log2(freqs[valid] / 440.0)).astype(int) % 12
    C = stft_frames(x, n_fft, hop, lambda S: np.stack([S[:, valid][:, pc == k].sum(axis=1) for k in range(12)], axis=1))
    C /= np.linalg.norm(C, axis=1, keepdims=True) + 1e-9
    fps = sr / hop
    out = []
    for i in range(len(beat_times) - 1):
        a = int(beat_times[i] * fps)
        b = max(a + 1, int(beat_times[i + 1] * fps))
        out.append(C[a:b].mean(axis=0))
    B = np.array(out)
    return B / (np.linalg.norm(B, axis=1, keepdims=True) + 1e-9)


def true_peak_db(x, oversample=4):
    """Approximate true peak (dBTP) by FFT oversampling in blocks."""
    peak = 0.0
    n = 1 << 16
    for ch in range(x.shape[1]):
        s = x[:, ch]
        for i in range(0, len(s), n):
            blk = s[max(0, i - 64): i + n + 64]
            F = np.fft.rfft(blk)
            up = np.fft.irfft(F, len(blk) * oversample) * oversample
            peak = max(peak, float(np.abs(up).max()))
    return 20 * np.log10(peak + 1e-12)
