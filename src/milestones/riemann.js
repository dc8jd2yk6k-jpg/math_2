// 2026.11.20 — Levent Alpöge (Anthropic), working with Claude, announces a proof of the
// Riemann Hypothesis (and GRH), released as Lean code; not yet independently verified.
//
// The scene is the critical strip itself. Here the curve is vertical, so the line is
// the critical line Re(s) = 1/2, with t running up it. Around it rises the landscape
// log|ζ(σ + it)| for -1/4 <= σ <= 5/4 and 0 <= t <= 52, computed exactly by
// Euler–Maclaurin (src/core/zeta.js). Every well that reaches zero sits on the line.
// The first ten zeros light up on eighth notes as the head comes to rest above them.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines, Dots } from '../core/lines.js';
import { zeta, ZEROS } from '../core/zeta.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

const T_MAX = 52, SIG0 = -0.25, SIG1 = 1.25;
const KX = 0.5, KY = 10, KZ = 1.9;          // world units per t, per σ, per log|ζ|
const RED = new THREE.Color(1.0, 0.16, 0.08);

// When each zero lights (also read by tools/sfx_events.mjs for the tones).
export function zeroTimes(B) { return ZEROS.map((t, k) => ({ t: B('b53.1', k * 0.5), im: t, k })); }

export function riemann(ctx) {
  const m = base(ctx, 'riemann');
  const B = ctx.B;
  // local frame: x up the line (t), y across it (σ, increasing to screen right), z = height
  const P = (sig, t, h = 0) => new THREE.Vector3(-(T_MAX - t) * KX, -(sig - 0.5) * KY, h * KZ);
  const H = (sig, t) => { const z = zeta(sig, t); return clamp(Math.log(Math.hypot(z[0], z[1]) + 1e-9), -3.4, 2.2); };

  // the landscape: lines of constant σ drawn bottom-up, lines of constant t across
  const tDraw0 = B('b52.4', -0.4), tDraw1 = B('b53.1', 0.6);
  const drawAt = (t) => lerp(tDraw0, tDraw1, t / T_MAX);
  // colour by height, piecewise: only the wells (where |ζ| -> 0) glow red
  const heat = (h) => (h < -0.9 ? RED.clone().lerp(new THREE.Color(1, 0.72, 0.55), clamp((h + 3.4) / 2.5)) : new THREE.Color(0.74, 0.8, 1.0));
  const gainOf = (h) => (h < -0.9 ? 1.6 : 0.42);
  const lines = [];
  // split a sampled polyline into short runs, each coloured by its own height
  const runs = (pts, hs, t0, t1, width, edge) => {
    const R = 6;
    for (let a = 0; a < pts.length - 1; a += R) {
      const b = Math.min(pts.length - 1, a + R);
      const h = Math.min(...hs.slice(a, b + 1));
      const f0 = a / (pts.length - 1), f1 = b / (pts.length - 1);
      lines.push({ pts: pts.slice(a, b + 1), t0: lerp(t0, t1, f0), t1: lerp(t0, t1, f1), color: edge ? new THREE.Color(1, 1, 1) : heat(h), gain: edge ? 1.4 : gainOf(h), width });
    }
  };
  const NS = 30, NT = 416;
  for (let i = 0; i <= NS; i++) {
    const sig = SIG0 + ((SIG1 - SIG0) * i) / NS;
    const edge = Math.abs(sig) < 1e-6 || Math.abs(sig - 1) < 1e-6; // the strip's walls
    const pts = [], hs = [];
    for (let j = 0; j <= NT; j++) { const t = (T_MAX * j) / NT; const h = H(sig, t); hs.push(h); pts.push(P(sig, t, h)); }
    runs(pts, hs, tDraw0, tDraw1, edge ? 1.5 : 1.0, edge);
  }
  for (let j = 1; j <= T_MAX * 2; j++) {
    const t = j / 2;
    const pts = [], hs = [];
    for (let i = 0; i <= 60; i++) { const sig = SIG0 + ((SIG1 - SIG0) * i) / 60; const h = H(sig, t); hs.push(h); pts.push(P(sig, t, h)); }
    const ta = drawAt(t);
    runs(pts, hs, ta, ta + 0.18, 1.0, false);
  }
  const land = new FatLines(lines);
  // the zeros: one point each on the critical line
  const zt = zeroTimes(B);
  const zeros = new Dots(zt.map((z) => ({ p: P(0.5, z.im, 0), size: 8, color: RED, gain: 6, t0: z.t })), { size: 8 });
  zeros.material.uniforms.uPop.value = 1;
  m.group.add(land.mesh, zeros.mesh);

  m.update = (t, st) => {
    const life = m.alive(st);
    const on = t > tDraw0 - 0.1 ? life : 0;
    land.set(t, ctx, on);
    zeros.set(t, ctx, on);
  };

  m.labels = (t, hud, project) => {
    if (t < m.tIn - 0.6 || t > m.tOut + 0.4) return;
    const fade = 1 - clamp((t - m.tOut) / 0.35);
    // the formula line at the bottom: first the series that defines ζ, then on b54.1 the
    // statement itself
    const tClaim = B('b54.1');
    const series = fade * clamp((t - m.tIn - 0.2) / 0.3) * (1 - clamp((t - tClaim + 0.25) / 0.25));
    const claim = fade * clamp((t - tClaim) / 0.3);
    // labels keep clear of the title block above and of the formula line below
    const clear = (y) => smoothstep(540, 610, y) * (1 - (1 - smoothstep(70, 120, Math.abs(y - 1440))) * Math.max(series, claim));
    // each zero's height on the line, as it lights
    for (const z of zt) {
      const p = project(m.local(P(0.5, z.im, 0)));
      const a = clamp((t - z.t) / 0.15) * fade * (p.visible ? clear(p.y) : 0);
      if (a > 0.002) hud.text(`½ + ${z.im.toFixed(4)} i`, p.x + 22, p.y, { family: 'JBM', size: 22, alpha: a * 0.9, align: 'left', color: '#ffd0c8' });
    }
    const top = project(m.local(P(0.5, T_MAX + 1.5, 0)));
    if (top.visible) hud.text('Re(s) = ½', top.x, top.y - 16, { family: 'Crimson', style: 'italic', size: 34, alpha: fade * clamp((t - m.tIn + 0.3) / 0.4) * clear(top.y - 16) });
    hud.tex(ctx.assets.tex.rh_series, 540, 1440, 76, { alpha: series, reveal: clamp((t - m.tIn - 0.2) / 0.6) });
    hud.tex(ctx.assets.tex.rh_claim, 540, 1440, 44, { alpha: claim, reveal: clamp((t - tClaim) / 0.5) });
  };
  return m;
}
