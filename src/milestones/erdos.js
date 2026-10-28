// 2026.05.20 — OpenAI disproves the Erdős unit distance conjecture.
// A 15x15 lattice where the "unit" is sqrt(65) lattice steps: 65 = 1^2+8^2 = 4^2+7^2,
// so every point sees 16 others at exactly unit distance (the circle through 16
// lattice points is drawn first). Erdős's number-theoretic constructions give
// n^(1+c/loglog n) unit pairs; the 2026 counterexample beats every such bound.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines, Dots } from '../core/lines.js';
import { clamp, ease, TAU } from '../core/math.js';

const RED = new THREE.Color(1, 0.14, 0.09);

export function erdos(ctx) {
  const m = base(ctx, 'erdos');
  const B = ctx.B;
  const G = 7, S = 0.33;
  // disc perpendicular to the (vertical) line: local axes N and B
  const P = (i, j) => new THREE.Vector3(0, i * S, j * S);
  const vecs = [[1, 8], [-1, 8], [8, 1], [8, -1], [4, 7], [-4, 7], [7, 4], [7, -4]];
  const dots = [];
  for (let i = -G; i <= G; i++) for (let j = -G; j <= G; j++) {
    dots.push({ p: P(i, j), size: 3.2, t0: B('b19.1') + (Math.hypot(i, j) / (G * 1.42)) * 0.45, gain: 3.2 });
  }
  const edges = [];
  const t0 = B('b19.3');
  for (const [dx, dy] of vecs) for (let i = -G; i <= G; i++) for (let j = -G; j <= G; j++) {
    const i2 = i + dx, j2 = j + dy;
    if (Math.abs(i2) > G || Math.abs(j2) > G) continue;
    const mid = Math.hypot((i + i2) / 2, (j + j2) / 2) / (G * 1.2);
    const ts = t0 + mid * 1.8 + (vecs.indexOf(vecs.find((v) => v[0] === dx && v[1] === dy)) % 4) * 0.05;
    edges.push({ pts: [P(i, j), P(i2, j2)], t0: ts, t1: ts + 0.25, gain: 0.55, width: 1.0 });
  }
  m.count = edges.length;
  // the 16-point unit circle around the centre
  const circle = [];
  for (let k = 0; k < 128; k++) circle.push(new THREE.Vector3(0, Math.cos((k / 128) * TAU) * Math.sqrt(65) * S, Math.sin((k / 128) * TAU) * Math.sqrt(65) * S));
  const all16 = [];
  for (const [dx, dy] of vecs) { all16.push([dx, dy], [-dx, -dy]); }
  const spokes = all16.map(([dx, dy], k) => ({ pts: [P(0, 0), P(dx, dy)], t0: B('b19.2') + k * 0.02, t1: B('b19.2') + k * 0.02 + 0.2, color: RED, gain: 2.6, width: 1.8 }));
  const ring = new FatLines([{ pts: circle, closed: true, t0: B('b19.2'), t1: B('b19.2', 0.7), color: RED, gain: 2.2, width: 1.6 }, ...spokes]);
  const ring16 = new Dots(all16.map(([dx, dy]) => ({ p: P(dx, dy), size: 5.5, color: RED, gain: 5, t0: B('b19.2', 0.6) })));
  const graph = new FatLines(edges);
  const pts = new Dots(dots);
  const disc = new THREE.Group();
  disc.add(graph.mesh, pts.mesh, ring.mesh, ring16.mesh);
  m.group.add(disc);

  m.update = (t, st) => {
    const life = m.alive(st);
    const on = t > m.tIn - 1 ? life : 0;
    disc.rotation.x = (t - m.tIn) * 0.12;
    graph.set(t, ctx, on * (1 - 0.45 * clamp((t - B('b20.4')) / 1.5)));
    pts.set(t, ctx, on);
    ring.set(t, ctx, on * (1 - 0.7 * clamp((t - B('b20.1')) / 1)));
    ring16.set(t, ctx, on);
  };

  m.labels = (t, hud, project) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    const shown = Math.round(m.count * ease.inOutCubic(clamp((t - t0) / 2.2)));
    if (t > t0) hud.text(`${shown.toLocaleString('en-US')} unit distances among 225 points`, 540, 588, { family: 'JBM', size: 26, alpha: fade * 0.9 });
    const tOld = B('b19.4'), tStrike = B('b20.2'), tNew = B('b20.3');
    const aOld = clamp((t - tOld) / 0.3) * fade;
    hud.tex(ctx.assets.tex.erdos_old, 540, 656, 44, { alpha: aOld * (t > tNew ? 0.45 : 1), reveal: clamp((t - tOld) / 0.4) });
    if (t > tStrike) {
      const k = ease.outCubic(clamp((t - tStrike) / 0.25));
      const c = hud.ctx;
      c.globalAlpha = fade; c.strokeStyle = '#ff2a1a'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(540 - 190, 658); c.lineTo(540 - 190 + 380 * k, 654); c.stroke(); c.globalAlpha = 1;
    }
    hud.tex(ctx.assets.tex.erdos_new, 540, 1420, 56, { alpha: clamp((t - tNew) / 0.3) * fade, reveal: clamp((t - tNew) / 0.4) });
  };
  return m;
}
