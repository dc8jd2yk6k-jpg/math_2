// 2016 -> 2024, the lull before the drop: one gate per year around the steepening
// line. Each ring lights up as the head passes through it, so the years visibly
// arrive faster as the curve bends upward.
import * as THREE from 'three';
import { FatLines } from '../core/lines.js';
import { clamp, smoothstep, TAU } from '../core/math.js';

export function gates(ctx) {
  const { curve, B } = ctx;
  const group = new THREE.Group();
  const m = { id: 'gates', group };
  const rings = [];
  const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
  const polys = years.map((yr) => {
    const s = curve.sOfYear(yr);
    const a = curve.at(s);
    const R = 2.6 + (yr - 2017) * 0.25;
    const pts = [];
    for (let i = 0; i < 96; i++) {
      const th = (i / 96) * TAU;
      pts.push(a.p.clone().addScaledVector(a.N, Math.cos(th) * R).addScaledVector(a.B, Math.sin(th) * R));
    }
    rings.push({ yr, s, a, R });
    return { pts, closed: true, gain: 1.3, width: 1.6 };
  });
  const lines = rings.map((r, i) => new FatLines([polys[i]]));
  for (const l of lines) group.add(l.mesh);

  m.update = (t, st) => {
    const show = st.rewind || (t > B('b12.1') && t < B('b16.1')) ? 1 : 0;
    rings.forEach((r, i) => {
      const life = st.rewind ? smoothstep(r.s - 2, r.s + 6, st.s) : 1;
      // flare as the head goes through, then settle to a dim ring
      const d = st.s - r.s;
      const hot = d > 0 ? Math.exp(-d / 6) : Math.exp(d / 1.5);
      const appear = st.rewind ? 1 : clamp((st.s - (r.s - 22)) / 6);
      lines[i].mesh.material.uniforms.uTint.value.setRGB(1, 1 - 0.75 * hot, 1 - 0.8 * hot);
      lines[i].set(1e9, ctx, show * life * appear * (0.35 + 1.6 * hot) * (1 - (st.focus || 0)));
    });
  };
  m.labels = (t, hud, project, st) => {
    if (t < B('b13.1') || t > B('b15.2')) return;
    for (const r of rings) {
      const p = project(r.a.p.clone().addScaledVector(r.a.N, r.R + 0.6));
      const a = clamp((st.s - (r.s - 18)) / 5) * (1 - clamp((t - B('b15.1')) / 0.3));
      if (p.visible && p.depth < 80) hud.text(String(r.yr), p.x + 18, p.y, { family: 'JBM', size: 30, alpha: a * 0.9, align: 'left' });
    }
  };
  return m;
}
