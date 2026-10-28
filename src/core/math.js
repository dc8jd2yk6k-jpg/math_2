// Deterministic helpers: seeded RNG, easing, monotone interpolation.
// Every frame of the film is a pure function of time, so nothing here keeps state
// across calls except the explicit RNG closures used at build time.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smoothstep = (e0, e1, x) => { const t = invLerp(e0, e1, x); return t * t * (3 - 2 * t); };
export const smootherstep = (e0, e1, x) => { const t = invLerp(e0, e1, x); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = (x) => x - Math.floor(x);
export const TAU = Math.PI * 2;

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

// window: 0 before a, ramps to 1 over [a, a+inDur], holds, ramps down over [b-outDur, b]
export function envelope(t, a, b, inDur, outDur, e = ease.inOutCubic) {
  if (t <= a || t >= b) return 0;
  const up = inDur > 0 ? e(clamp((t - a) / inDur)) : 1;
  const down = outDur > 0 ? e(clamp((b - t) / outDur)) : 1;
  return Math.min(up, down);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash1(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function gaussian(rng) {
  const u = Math.max(1e-12, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// Fritsch–Carlson monotone cubic Hermite through (xs, ys). Returns f(x) and df(x).
export function pchip(xs, ys) {
  const n = xs.length;
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n).fill(0);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  const seg = (x) => {
    let lo = 0, hi = n - 2;
    if (x <= xs[0]) return 0;
    if (x >= xs[n - 1]) return n - 2;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid - 1; }
    return lo;
  };
  const f = (x) => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    const i = seg(x), t = (x - xs[i]) / h[i];
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
  const df = (x) => {
    if (x <= xs[0]) return m[0];
    if (x >= xs[n - 1]) return m[n - 1];
    const i = seg(x), t = (x - xs[i]) / h[i];
    const t2 = t * t;
    return ((6 * t2 - 6 * t) * ys[i] + (3 * t2 - 4 * t + 1) * h[i] * m[i] + (-6 * t2 + 6 * t) * ys[i + 1] + (3 * t2 - 2 * t) * h[i] * m[i + 1]) / h[i];
  };
  return { f, df, xs, ys, m, h };
}

// Piecewise keyframes [{t, v}] with per-key easing into the key; returns v(t).
export function keyframes(keys, e = ease.inOutCubic) {
  return (t) => {
    if (t <= keys[0].t) return keys[0].v;
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        const a = keys[i - 1], b = keys[i];
        const u = (t - a.t) / (b.t - a.t);
        return lerp(a.v, b.v, (b.e || e)(u));
      }
    }
    return keys[keys.length - 1].v;
  };
}
