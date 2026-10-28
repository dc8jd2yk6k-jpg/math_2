// A ruler along the early, nearly flat stretch: ticks every two years, labelled
// decades, so the 1950 -> 1997 flight reads as time rushing past.
import * as THREE from 'three';
import { FatLines } from '../core/lines.js';
import { clamp } from '../core/math.js';

export function decades(ctx) {
  const { curve, B } = ctx;
  const lines = [], labels = [];
  for (let yr = 1952; yr <= 1994; yr += 2) {
    const a = curve.at(curve.sOfYear(yr));
    const big = yr % 10 === 0;
    const h = big ? 0.75 : 0.28;
    lines.push({ pts: [a.p.clone().addScaledVector(a.N, -h), a.p.clone().addScaledVector(a.N, -0.12)], gain: big ? 1.3 : 0.7, width: big ? 1.6 : 1.1 });
    if (big) labels.push({ yr, p: a.p.clone().addScaledVector(a.N, -h - 0.55) });
  }
  const ruler = new FatLines(lines);
  const group = new THREE.Group();
  group.add(ruler.mesh);
  const m = { id: 'decades', group, ownClock: true };
  m.update = (t) => ruler.set(t, ctx, t > B('b5.1') && t < B('b55.1') ? 1 : 0.6);
  m.labels = (t, hud, project) => {
    if (t < B('b5.1') || t > B('b7.1')) return;
    for (const l of labels) {
      const p = project(l.p);
      if (!p.visible || p.depth > 45) continue;
      hud.text(String(l.yr), p.x, p.y, { family: 'JBM', size: 28, alpha: clamp((45 - p.depth) / 15) * 0.85, color: '#dcdcdc' });
    }
  };
  return m;
}
