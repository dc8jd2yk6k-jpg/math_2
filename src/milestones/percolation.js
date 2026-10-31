// 2026.08.28 — Anthropic researchers: no percolation at criticality, theta(p_c) = 0,
// in dimension d >= 3 (Lean-verified, not yet refereed). Bond percolation on a 16^3
// cubic lattice: each bond carries a uniform random U and opens when p sweeps past
// it, up to the 3D threshold p_c ~ 0.2488. Clusters are found with union-find and
// tinted by size: at criticality the largest cluster is a huge fractal, yet finite.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines } from '../core/lines.js';
import { clamp, mulberry32 } from '../core/math.js';

const PC = 0.2488;

const L = 16;

// The seeded bonds open at p = PC * (time fraction), union-find gives cluster rank.
// Pure, so tools/sfx_events.mjs can crackle exactly when each bond appears.
export function percolationBonds(B) {
  const rng = mulberry32(2488);
  const id = (x, y, z) => x + L * (y + L * z);
  const parent = new Int32Array(L * L * L).map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const bonds = [];
  for (let z = 0; z < L; z++) for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) {
    for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const X = x + dx, Y = y + dy, Z = z + dz;
      if (X >= L || Y >= L || Z >= L) continue;
      const u = rng();
      if (u < PC) bonds.push({ a: id(x, y, z), b: id(X, Y, Z), u, p: [x, y, z], q: [X, Y, Z] });
    }
  }
  for (const bd of bonds) { const ra = find(bd.a), rb = find(bd.b); if (ra !== rb) parent[ra] = rb; }
  const size = new Map();
  for (const bd of bonds) { const r = find(bd.a); size.set(r, (size.get(r) || 0) + 1); }
  const ranked = [...size.entries()].sort((a, b) => b[1] - a[1]);
  const rank = new Map(ranked.map(([r], i) => [r, i]));
  const tS = B('b23.1'), tE = B('b24.1');
  for (const bd of bonds) { bd.rank = rank.get(find(bd.a)); bd.t0 = tS + (bd.u / PC) * (tE - tS); }
  return { bonds, largest: ranked[0][1], tS, tE };
}

export function percolation(ctx) {
  const m = base(ctx, 'percolation');
  const B = ctx.B;
  const S = 0.44, half = ((L - 1) * S) / 2;
  const { bonds, largest, tS, tE } = percolationBonds(B);
  m.largest = largest;
  m.open = bonds.length;

  const W = (v) => new THREE.Vector3(v[1] * S - half, v[0] * S - half, v[2] * S - half);
  const lines = bonds.map((bd) => {
    const r = bd.rank, t0 = bd.t0;
    const color = r === 0 ? new THREE.Color(1, 0.16, 0.1) : r < 6 ? new THREE.Color(1, 0.92, 0.88) : new THREE.Color(0.55, 0.6, 0.7);
    const gain = r === 0 ? 1.9 : r < 6 ? 0.6 : 0.12;
    return { pts: [W(bd.p), W(bd.q)], t0, t1: t0 + 0.1, color, gain, width: r === 0 ? 1.8 : 1.2 };
  });
  const net = new FatLines(lines);
  // faint cage of the box
  const c = half + 0.3, corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push(new THREE.Vector3(sx * c, sy * c, sz * c));
  const edges = [];
  corners.forEach((a, i) => corners.forEach((b, j) => { if (j > i && a.distanceTo(b) <= 2 * c + 1e-6) edges.push({ pts: [a, b], gain: 0.35, width: 1 }); }));
  const cage = new FatLines(edges);
  const holder = new THREE.Group();
  holder.add(net.mesh, cage.mesh);
  m.group.add(holder);
  m.pAt = (t) => PC * clamp((t - tS) / (tE - tS));

  m.update = (t, st) => {
    const life = m.alive(st);
    const on = t > m.tIn - 1 ? life : 0;
    holder.rotation.x = (t - m.tIn) * 0.18;
    net.set(t, ctx, on);
    cage.set(t, ctx, on * clamp((t - (m.tIn - 0.8)) / 0.6));
  };

  m.labels = (t, hud) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    const p = m.pAt(t);
    hud.text(`p = ${p.toFixed(4)}`, 540, 590, { family: 'JBM', size: 34, alpha: fade * clamp((t - tS) / 0.3) });
    hud.tex(ctx.assets.tex.perc_pc, 540, 652, 38, { alpha: fade * clamp((t - tE) / 0.3) });
    hud.tex(ctx.assets.tex.perc, 540, 1430, 60, { alpha: fade * clamp((t - B('b24.2')) / 0.3), reveal: clamp((t - B('b24.2')) / 0.4) });
  };
  return m;
}
