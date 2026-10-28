// The timeline curve: x is linear time, y explodes.
//
//   x = SX * (year - 1950)     (2.5 world units per year)
//   y = monotone cubic through (year, height) knots, tuned so the tangent is
//       ~4 deg at Deep Blue, ~37 deg at AlphaGo, ~70-80 deg through the IMO years and
//       vertical across 2026, where breakthroughs days apart stack ~30 units apart.
//   z = a slow weave that dies out by 2019: from oblique angles the path reads as a
//       3D trajectory; seen head-on in the final pull-back it straightens into the
//       clean exponential.
//
// Above the last event the curve continues straight up: the asymptote the head
// escapes along at the singularity.

import * as THREE from 'three';
import { pchip, smoothstep, TAU } from './math.js';

export const SX = 2.5;
export const YEAR0 = 1950;

// day-of-year fractions for 2026 (non-leap): May 20 = 140, Jul 20 = 201, Aug 28 = 240,
// Sep 8 = 251, Oct 6 = 279, Oct 27 = 300
export const YEARS = {
  shannon: 1950.0,
  deepblue: 1997.36,
  alphago: 2016.19,
  imo2024: 2024.56,
  imo2025: 2025.55,
  erdos: 2026 + 140 / 365,
  jacobian: 2026 + 201 / 365,
  percolation: 2026 + 240 / 365,
  navierstokes: 2026 + 251 / 365,
  manuscripts: 2026 + 279 / 365,
  yangmills: 2026 + 300 / 365,
  eth_openai: 2026 + 300.25 / 365,
  eth_claude: 2026 + 300.5 / 365,
};
const TOP_YEAR = 2026 + 300.75 / 365;

const KNOTS = [
  [1950.0, 0], [1975, 0.9], [YEARS.deepblue, 3.2], [2008, 9], [YEARS.alphago, 20], [2021, 33],
  [YEARS.imo2024, 50], [YEARS.imo2025, 60], [2026.0, 70],
  [YEARS.erdos, 85], [YEARS.jacobian, 115], [YEARS.percolation, 145], [YEARS.navierstokes, 175],
  [YEARS.manuscripts, 205], [YEARS.yangmills, 235], [YEARS.eth_openai, 262], [YEARS.eth_claude, 289],
  [TOP_YEAR, 330],
];

export const TOP_Y = 330;
export const ASYMPTOTE = 520; // straight segment above the last knot

export class Curve {
  constructor({ ds = 0.04, weave = 3.5, weavePeriod = 26 } = {}) {
    this.ds = ds;
    const xs = KNOTS.map((k) => SX * (k[0] - YEAR0));
    const ys = KNOTS.map((k) => k[1]);
    const sp = pchip(xs, ys);
    const zOf = (year) => weave * Math.sin((TAU * (year - YEAR0)) / weavePeriod) * (1 - smoothstep(1985, 2019, year));

    // oversample each knot interval, then resample uniformly in arc length
    const raw = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const chord = Math.hypot(xs[i + 1] - xs[i], ys[i + 1] - ys[i]);
      const n = Math.max(16, Math.ceil((chord * 1.3) / (ds / 4)));
      for (let k = 0; k < n; k++) {
        const x = xs[i] + ((xs[i + 1] - xs[i]) * k) / n;
        const year = YEAR0 + x / SX;
        raw.push([x, sp.f(x), zOf(year), year]);
      }
    }
    const xt = xs[xs.length - 1];
    const na = Math.ceil(ASYMPTOTE / (ds / 4));
    for (let k = 0; k <= na; k++) raw.push([xt, TOP_Y + (ASYMPTOTE * k) / na, 0, TOP_YEAR + k * 1e-9]);

    const cum = new Float64Array(raw.length);
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1], b = raw[i];
      cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    this.length = cum[cum.length - 1];
    const M = Math.floor(this.length / ds) + 1;
    this.count = M;
    this.pos = new Float32Array(M * 3);
    this.year = new Float64Array(M);
    let j = 0;
    for (let i = 0; i < M; i++) {
      const s = i * ds;
      while (j < cum.length - 2 && cum[j + 1] < s) j++;
      const f = (s - cum[j]) / Math.max(1e-12, cum[j + 1] - cum[j]);
      const a = raw[j], b = raw[j + 1];
      this.pos[i * 3] = a[0] + (b[0] - a[0]) * f;
      this.pos[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
      this.pos[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
      this.year[i] = a[3] + (b[3] - a[3]) * f;
    }

    // tangents + parallel-transport frames (double reflection, Wang et al. 2008)
    this.T = new Float32Array(M * 3);
    this.N = new Float32Array(M * 3);
    this.B = new Float32Array(M * 3);
    const P = (i) => new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    const tans = [];
    for (let i = 0; i < M; i++) {
      const a = P(Math.max(0, i - 2)), b = P(Math.min(M - 1, i + 2));
      tans.push(b.sub(a).normalize());
    }
    let n = new THREE.Vector3(0, 1, 0);
    n.sub(tans[0].clone().multiplyScalar(n.dot(tans[0]))).normalize();
    const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), rL = new THREE.Vector3(), tL = new THREE.Vector3();
    for (let i = 0; i < M; i++) {
      if (i > 0) {
        v1.copy(P(i)).sub(P(i - 1));
        const c1 = v1.dot(v1);
        if (c1 > 1e-12) {
          rL.copy(n).sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(n)));
          tL.copy(tans[i - 1]).sub(v1.clone().multiplyScalar((2 / c1) * v1.dot(tans[i - 1])));
          v2.copy(tans[i]).sub(tL);
          const c2 = v2.dot(v2);
          n = c2 > 1e-12 ? rL.sub(v2.clone().multiplyScalar((2 / c2) * v2.dot(rL))) : rL.clone();
          n.normalize();
        }
      }
      const t = tans[i], b = new THREE.Vector3().crossVectors(t, n).normalize();
      this.T.set([t.x, t.y, t.z], i * 3);
      this.N.set([n.x, n.y, n.z], i * 3);
      this.B.set([b.x, b.y, b.z], i * 3);
    }
    this.topS = this.sOfYear(TOP_YEAR);
  }

  // Interpolated sample at arc length s (clamped). Returns plain objects of Vector3s.
  at(s, out = { p: new THREE.Vector3(), T: new THREE.Vector3(), N: new THREE.Vector3(), B: new THREE.Vector3() }) {
    const x = Math.min(this.count - 1.000001, Math.max(0, s / this.ds));
    const i = Math.floor(x), f = x - i;
    const L = (arr, v) => v.set(
      arr[i * 3] + (arr[i * 3 + 3] - arr[i * 3]) * f,
      arr[i * 3 + 1] + (arr[i * 3 + 4] - arr[i * 3 + 1]) * f,
      arr[i * 3 + 2] + (arr[i * 3 + 5] - arr[i * 3 + 2]) * f);
    L(this.pos, out.p);
    L(this.T, out.T).normalize();
    L(this.N, out.N).normalize();
    L(this.B, out.B).normalize();
    out.year = this.year[i] + (this.year[i + 1] - this.year[i]) * f;
    out.s = s;
    return out;
  }

  sOfYear(year) {
    const Y = this.year;
    if (year <= Y[0]) return 0;
    let lo = 0, hi = this.count - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (Y[mid] <= year) lo = mid; else hi = mid - 1; }
    if (lo >= this.count - 1) return this.length;
    const f = (year - Y[lo]) / Math.max(1e-15, Y[lo + 1] - Y[lo]);
    return (lo + Math.min(1, Math.max(0, f))) * this.ds;
  }

  yearAt(s) { return this.at(s).year; }

  // world-space frame matrix (columns T, N, B) positioned at arc length s
  matrixAt(s, m = new THREE.Matrix4()) {
    const a = this.at(s);
    return m.makeBasis(a.T, a.N, a.B).setPosition(a.p);
  }
}
