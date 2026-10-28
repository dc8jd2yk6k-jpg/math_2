// Musical clock. Wraps data/beatmap.json (built by tools/build_soundtrack.py).
// Cue times are written against SOURCE score positions ("b15.1" = the drop),
// which are unique inside the edit, and resolved here to video seconds.

export class Beat {
  constructor(bm) {
    this.bm = bm;
    this.T = bm.duration;
    this.fps = bm.fps;
    this.frames = bm.frames;
    this.spb = bm.beat_sec;
    this.beats = bm.beats;
    this.byLabel = new Map();
    this.beats.forEach((b, i) => this.byLabel.set(`b${b.bar}.${b.beat}`, i));
    this.hits = bm.hits;
    this.env = bm.envelope;
  }

  // "b15" or "b15.3", optional extra beats (may be fractional / negative)
  t(label, beats = 0) {
    const key = label.includes('.') ? label : `${label}.1`;
    const i = this.byLabel.get(key);
    if (i === undefined) throw new Error(`cue ${label} is not in the edit`);
    return this.beats[i].t + beats * this.spb;
  }

  wrap(t) { return ((t % this.T) + this.T) % this.T; }

  // continuous beat position (index + phase) at time t, for pulses
  beatPos(t) {
    t = this.wrap(t);
    const b = this.beats;
    let lo = 0, hi = b.length - 1;
    if (t < b[0].t) return 0;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (b[mid].t <= t) lo = mid; else hi = mid - 1; }
    const next = lo + 1 < b.length ? b[lo + 1].t : this.T + b[0].t;
    return lo + (t - b[lo].t) / (next - b[lo].t);
  }

  // per-frame envelope, linearly interpolated, circular
  e(name, t) {
    const arr = this.env[name];
    const x = this.wrap(t) * this.fps;
    const i = Math.floor(x), f = x - i;
    return arr[i % arr.length] * (1 - f) + arr[(i + 1) % arr.length] * f;
  }

  // Sum of decaying impulses from events (hits or accented beats) before t.
  // Circular: events near the end ring into the start of the loop.
  impulse(t, { min = 0.5, attack = 0.012, decay = 0.22, from = 'hits', window = null } = {}) {
    const ev = from === 'hits' ? this.hits : this.beats.map((b) => ({ t: b.t, strength: b.accent }));
    let s = 0;
    const T = this.T;
    for (const h of ev) {
      if (h.strength < min) continue;
      if (window && (h.t < window[0] || h.t > window[1])) continue;
      for (const off of [0, -T, T]) {
        const dt = t - (h.t + off);
        if (dt < 0 || dt > decay * 8) continue;
        const a = attack > 0 ? 1 - Math.exp(-dt / attack) : 1;
        s += ((h.strength - min) / (1 - min + 1e-6)) * a * Math.exp(-dt / decay);
      }
    }
    return s;
  }

  // 1 on a beat, decaying to 0 before the next one (for strobes / pulses)
  pulse(t, sharp = 6) {
    const p = this.beatPos(t);
    return Math.exp(-sharp * (p - Math.floor(p)));
  }
}

export async function loadBeat(url) {
  const bm = await (await fetch(url)).json();
  return new Beat(bm);
}
