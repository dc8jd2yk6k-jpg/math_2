// 2026.10.27 — OpenAI: existence of 4D quantum Yang-Mills theory (with fermions),
// announced with a Kakeya proof in all dimensions; the mass gap remains open.
// Visual: the Hopf fibration S^3 -> S^2, the SU(2) bundle behind instantons. Fibers
// over latitude circles of S^2 sweep out nested tori of linked circles; one fiber
// is a straight line, so the film's own trajectory threads the whole bundle.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines } from '../core/lines.js';
import { clamp, lerp, TAU } from '../core/math.js';

const SEG = 120;
const LATS = [0.12, 0.2, 0.28, 0.36, 0.44];
const PER = 18;

function fiber(phi, theta, out) {
  const c = Math.cos(phi / 2), s = Math.sin(phi / 2);
  for (let i = 0; i < SEG; i++) {
    const psi = (i / SEG) * TAU;
    const x1 = c * Math.cos(psi + theta), x2 = c * Math.sin(psi + theta);
    const x3 = s * Math.cos(psi), x4 = s * Math.sin(psi);
    const k = 1 / (1 - x4 + 1e-6);
    // stereographic projection; x3 becomes the axis of the bundle (local x = the line)
    out[i].set(x3 * k, x1 * k, x2 * k);
  }
}

export function yangmills(ctx) {
  const m = base(ctx, 'yangmills');
  const B = ctx.B;
  const fibers = [];
  LATS.forEach((lat, li) => {
    for (let j = 0; j < PER; j++) {
      const pts = Array.from({ length: SEG }, () => new THREE.Vector3());
      const col = new THREE.Color().setHSL(0.0, lerp(0.0, 0.9, li / (LATS.length - 1)), lerp(0.92, 0.55, li / (LATS.length - 1)));
      fibers.push({ phi: lat * Math.PI, theta0: (j / PER) * TAU, pts, closed: true, color: col, gain: li === LATS.length - 1 ? 2.2 : 1.4, width: 1.3,
        t0: B('b51.1', li * 0.6) + j * 0.012, t1: B('b51.1', li * 0.6 + 0.5) + j * 0.012 });
    }
  });
  const SC = 2.0;
  fibers.forEach((f) => { fiber(f.phi, f.theta0, f.pts); f.pts.forEach((p) => p.multiplyScalar(SC)); });
  const lines = new FatLines(fibers);
  m.group.add(lines.mesh);
  const attr = lines.mesh.geometry.attributes;
  let lastT = null;

  m.update = (t, st) => {
    const life = m.alive(st);
    const on = t > m.tIn - 1 ? life : 0;
    lines.set(t, ctx, on);
    if (!on) return;
    const rot = (t - m.tIn) * 0.22;
    if (rot === lastT) return;
    lastT = rot;
    let v = 0;
    for (const f of fibers) {
      fiber(f.phi, f.theta0 + rot, f.pts);
      for (let k = 0; k < SEG; k++) {
        const a = f.pts[k], b = f.pts[(k + 1) % SEG];
        for (let c = 0; c < 4; c++, v++) {
          attr.aA.array.set([a.x * SC, a.y * SC, a.z * SC], v * 3);
          attr.aB.array.set([b.x * SC, b.y * SC, b.z * SC], v * 3);
        }
      }
    }
    attr.aA.needsUpdate = attr.aB.needsUpdate = true;
  };

  m.labels = (t, hud) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    hud.tex(ctx.assets.tex.ym, 540, 1410, 74, { alpha: fade * clamp((t - B('b51.3')) / 0.3), reveal: clamp((t - B('b51.3')) / 0.5) });
    hud.text('existence ✓      mass gap: open', 540, 1500, { family: 'JBM', size: 26, alpha: fade * 0.85 * clamp((t - B('b52.2')) / 0.3) });
  };
  return m;
}
