// 1950 — Claude Shannon, "Programming a Computer for Playing Chess".
// The big bang of the film: the head ignites at the origin and the chess game tree
// blooms as a radial tree on concentric rings — about 30 moves per ply, rings
// multiplying outward toward Shannon's estimate of ~10^120 games.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines, Dots } from '../core/lines.js';
import { clamp, ease, mulberry32, TAU } from '../core/math.js';

const RED = new THREE.Color(1.0, 0.1, 0.06);

export function shannon(ctx) {
  const m = base(ctx, 'shannon');
  const rng = mulberry32(1950);
  // disc tilted toward the viewer so the rings read as ellipses, pierced by the line
  const alpha = THREE.MathUtils.degToRad(68);
  const n = new THREE.Vector3(Math.sin(alpha), 0.1, Math.cos(alpha)).normalize();
  const e1 = new THREE.Vector3(0, 1, 0).sub(n.clone().multiplyScalar(n.y)).normalize();
  const e2 = new THREE.Vector3().crossVectors(n, e1).normalize();
  const disc = (r, th) => e1.clone().multiplyScalar(Math.cos(th) * r).addScaledVector(e2, Math.sin(th) * r);

  const RINGS = 12, R0 = 0.45, DR = 0.27;
  const rings = [];
  for (let k = 1; k <= RINGS; k++) {
    const r = R0 + DR * k;
    const pts = [];
    for (let i = 0; i < 160; i++) pts.push(disc(r, (i / 160) * TAU));
    rings.push({ pts, closed: true, color: RED, gain: 2.4 - k * 0.1, width: 1.7 });
  }
  const ringLines = new FatLines(rings, { width: 1.6 });

  // radial game tree on the inner rings: ~30 moves per ply, sub-sampled
  const edges = [], dots = [];
  const ply1 = 30;
  const nodes1 = [];
  for (let i = 0; i < ply1; i++) {
    const th = (i / ply1) * TAU + 0.05;
    const p = disc(R0 + DR, th);
    nodes1.push({ th, p });
    edges.push({ pts: [new THREE.Vector3(), p], t0: 0.12 + i * 0.004, t1: 0.3 + i * 0.004, gain: 0.9, width: 1.1 });
    dots.push({ p, size: 3.2, t0: 0.3 + i * 0.004, gain: 3 });
  }
  const nodes2 = [];
  nodes1.forEach((a, i) => {
    for (let j = 0; j < 5; j++) {
      const th = a.th + ((j - 2) / 5) * (TAU / ply1) * 0.9;
      const p = disc(R0 + DR * 2, th);
      nodes2.push({ th, p });
      edges.push({ pts: [a.p, p], t0: 0.32 + i * 0.003, t1: 0.46 + i * 0.003, gain: 0.7, width: 1.0 });
      dots.push({ p, size: 2.2, t0: 0.46 + i * 0.003, gain: 2.4 });
    }
  });
  nodes2.forEach((a, i) => {
    for (let j = 0; j < 3; j++) {
      if (rng() < 0.25) continue;
      const th = a.th + ((j - 1) / 3) * (TAU / (ply1 * 5)) * 0.9;
      const p = disc(R0 + DR * 3, th);
      edges.push({ pts: [a.p, p], t0: 0.48 + (i % 40) * 0.004, t1: 0.6 + (i % 40) * 0.004, gain: 0.5, width: 0.9 });
      dots.push({ p, size: 1.5, t0: 0.6 + (i % 40) * 0.004, gain: 2 });
    }
  });
  // outer plies: dense dust of positions on each ring
  for (let k = 4; k <= RINGS; k++) {
    const count = Math.min(900, 60 * Math.pow(1.45, k));
    for (let i = 0; i < count; i++) {
      const p = disc(R0 + DR * k + (rng() - 0.5) * 0.05, rng() * TAU);
      dots.push({ p, size: 0.9 + rng() * 0.8, t0: 0.5 + k * 0.05 + rng() * 0.2, gain: 1.1 + rng() });
    }
  }
  const tree = new FatLines(edges, { width: 1 });
  const nodeDots = new Dots(dots, { size: 2 });

  const spin = new THREE.Group();
  spin.add(ringLines.mesh, tree.mesh, nodeDots.mesh);
  m.group.add(spin);
  m.outer = disc(R0 + DR * RINGS, -0.35);

  m.update = (t, st) => {
    const T = ctx.beat.T;
    const local = t;                      // ignition at t = 0 (the final stab)
    const life = m.alive(st);
    const grow = ease.outExpo(clamp(local / 1.1));
    spin.scale.setScalar(Math.max(0.001, 0.15 + 0.85 * grow));
    spin.setRotationFromAxisAngle(n, local * 0.06);
    const fadeAfter = 1 - 0.55 * clamp((local - 5) / 3);
    const a = life * fadeAfter * (t < T - 4.5 ? 1 : 0) * clamp(local / 0.18) * (0.35 + 0.65 * grow);
    ringLines.set(local, ctx, a);
    tree.set(local, ctx, a);
    nodeDots.set(local, ctx, a);
  };

  m.labels = (t, hud, project) => {
    if (t > 5.5) return;
    const p = project(m.local(m.outer));
    const a = clamp((t - 0.7) / 0.5) * (1 - clamp((t - 4.6) / 0.6));
    if (p.visible) hud.tex(ctx.assets.tex.shannon, p.x + 70, p.y + 40, 44, { alpha: a, align: 'left', reveal: clamp((t - 0.7) / 0.6) });
  };
  return m;
}
