// IMO 2024 (silver) and IMO 2025 (gold).
//  2024: Problem 4, the geometry problem AlphaGeometry 2 proved in 19 seconds —
//        incircle tangents parallel to the sides, the arc midpoint P, and the
//        claim  angle KIL + angle YPX = 180 degrees, constructed on the beat.
//  2025: Problem 1, "sunny lines": lattice points a+b <= n+1 covered by n lines;
//        three diagonal non-sunny lines take the outer layers and three sunny
//        lines (slopes -1/2, -2, 1) cover the inner six points, so k = 3 works.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines, Dots } from '../core/lines.js';
import { clamp, ease, TAU } from '../core/math.js';

const V2 = (x, y) => new THREE.Vector2(x, y);
const WHITE = new THREE.Color(1, 0.95, 0.97);
const GOLD = new THREE.Color(1.0, 0.72, 0.28);
const RED = new THREE.Color(1, 0.12, 0.08);

function medal(ctx, color, metal) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.22, envMap: ctx.envMap, envMapIntensity: 1.4 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 64), mat);
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.05, 12, 64), mat);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.025, 8, 64), mat);
  inner.position.z = 0.06;
  const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x1b2a6b, roughness: 0.6, envMap: ctx.envMap, envMapIntensity: 0.3 });
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.3, 0.02), ribbonMat);
  r1.position.set(-0.2, 1.35, -0.05); r1.rotation.z = -0.22;
  const r2 = r1.clone(); r2.position.x = 0.2; r2.rotation.z = 0.22;
  g.add(disc, rim, inner, r1, r2);
  const light = new THREE.PointLight(0xffffff, 14, 6, 1.6);
  light.position.set(0.8, 1.2, 2.2);
  g.add(light);
  g.userData.metal = metal;
  g.userData.light = light;
  return g;
}

// 2D diagram helpers in the plane spanned by e1, e2 around an origin
function plane(origin, e1, e2, scale) {
  return (v) => origin.clone().addScaledVector(e1, v.x * scale).addScaledVector(e2, v.y * scale);
}
const circlePts = (c, r, n = 128) => Array.from({ length: n }, (_, i) => V2(c.x + r * Math.cos((i / n) * TAU), c.y + r * Math.sin((i / n) * TAU)));
const lineThrough = (p, d, a, b) => [p.clone().addScaledVector(d, a), p.clone().addScaledVector(d, b)];

function scoreRow(hud, x, y, scores, t0, t, alpha) {
  const cell = 64, gap = 12;
  const total = scores.length * cell + (scores.length - 1) * gap;
  let x0 = x - total / 2;
  const c = hud.ctx;
  let sum = 0;
  scores.forEach((s, i) => {
    const a = clamp((t - (t0 + i * 0.09)) / 0.15) * alpha;
    if (a <= 0) return;
    c.globalAlpha = a;
    c.strokeStyle = s > 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)';
    c.lineWidth = 2;
    c.beginPath(); c.roundRect(x0, y - cell / 2, cell, cell, 10); c.stroke();
    if (s > 0) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill(); sum += s; }
    hud.text(`P${i + 1}`, x0 + cell / 2, y - 14, { family: 'JBM', size: 17, alpha: a * 0.7 });
    hud.text(String(s), x0 + cell / 2, y + 12, { family: 'JBM', size: 26, weight: 500, alpha: a, color: s > 0 ? '#ffffff' : '#777777' });
    x0 += cell + gap;
  });
  c.globalAlpha = 1;
  return sum;
}

export function imo2024(ctx) {
  const m = base(ctx, 'imo2024');
  const B = ctx.B;
  // construction (numbers in diagram units)
  const Bp = V2(0, 0), Cp = V2(7, 0), Ap = V2(2.2, 4.6);
  const a = Bp.distanceTo(Cp), b = Cp.distanceTo(Ap), c = Ap.distanceTo(Bp);
  const I = Ap.clone().multiplyScalar(a).add(Bp.clone().multiplyScalar(b)).add(Cp.clone().multiplyScalar(c)).divideScalar(a + b + c);
  const r = I.y;
  const nAC = V2(Cp.y - Ap.y, Ap.x - Cp.x).normalize(); // normal of AC
  if (nAC.dot(I.clone().sub(Cp)) > 0) nAC.negate();
  // I lies on the negative side of AC (n.I = n.C - r); the other tangent parallel to
  // AC is n.P = n.I - r, and it meets line BC (y = 0) at X.
  const Xs = V2((nAC.dot(I) - r) / nAC.x, 0);
  const nAB = V2(Ap.y - Bp.y, Bp.x - Ap.x).normalize();
  if (nAB.dot(I.clone().sub(Bp)) > 0) nAB.negate();
  const Ys = V2((nAB.dot(I) - r) / nAB.x, 0);
  // circumcircle
  const D = 2 * (Ap.x * (Bp.y - Cp.y) + Bp.x * (Cp.y - Ap.y) + Cp.x * (Ap.y - Bp.y));
  const ux = ((Ap.lengthSq()) * (Bp.y - Cp.y) + Bp.lengthSq() * (Cp.y - Ap.y) + Cp.lengthSq() * (Ap.y - Bp.y)) / D;
  const uy = ((Ap.lengthSq()) * (Cp.x - Bp.x) + Bp.lengthSq() * (Ap.x - Cp.x) + Cp.lengthSq() * (Bp.x - Ap.x)) / D;
  const O = V2(ux, uy), R = O.distanceTo(Ap);
  const dAI = I.clone().sub(Ap);
  const tP = -2 * Ap.clone().sub(O).dot(dAI) / dAI.lengthSq();
  const P = Ap.clone().addScaledVector(dAI, tP);
  const K = Ap.clone().add(Cp).multiplyScalar(0.5), L = Ap.clone().add(Bp).multiplyScalar(0.5);

  const f = m.frame;
  const origin = new THREE.Vector3(-2.2, -4.6, 0).multiplyScalar(0.9); // A sits on the line
  const map = plane(origin, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), 0.9);
  // the group is oriented by the curve frame; undo its rotation so the diagram faces +z (the camera)
  const rot = new THREE.Matrix4().makeBasis(f.T, f.N, f.B).invert();
  const P3 = (v) => map(v).applyMatrix4(rot);
  const bt = (l, k = 0) => B(l, k);
  const lines = [];
  const add = (pts2, t0, t1, opts = {}) => lines.push({ pts: pts2.map(P3), t0, t1, ...opts });
  add([Ap, Bp, Cp, Ap], bt('b15.1'), bt('b15.1', 0.8), { gain: 1.8 });
  add(circlePts(I, r), bt('b15.2'), bt('b15.2', 0.8), { closed: false });
  const dAC = Cp.clone().sub(Ap).normalize(), dAB = Ap.clone().sub(Bp).normalize();
  add(lineThrough(Xs, dAC, -1.6, 4.2), bt('b15.3'), bt('b15.3', 0.5), { gain: 1.0 });
  add(lineThrough(Ys, dAB, -1.4, 4.4), bt('b15.3', 0.25), bt('b15.3', 0.75), { gain: 1.0 });
  add([V2(-0.8, 0), V2(7.8, 0)], bt('b15.3'), bt('b15.3', 0.4), { gain: 0.9 });
  add(circlePts(O, R, 160), bt('b15.4'), bt('b15.4', 0.8), { gain: 1.2 });
  add([Ap, P], bt('b15.4', 0.3), bt('b15.4', 0.8), { gain: 1.1 });
  add([I, K], bt('b16.1'), bt('b16.1', 0.4), { gain: 1.6 });
  add([I, L], bt('b16.1'), bt('b16.1', 0.4), { gain: 1.6 });
  add([P, Xs], bt('b16.1', 0.4), bt('b16.1', 0.8), { gain: 1.6 });
  add([P, Ys], bt('b16.1', 0.4), bt('b16.1', 0.8), { gain: 1.6 });
  const arc = (ctr, u, v, rad, col) => {
    const a0 = Math.atan2(u.y - ctr.y, u.x - ctr.x), a1 = Math.atan2(v.y - ctr.y, v.x - ctr.x);
    let d = a1 - a0; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    return Array.from({ length: 40 }, (_, i) => V2(ctr.x + rad * Math.cos(a0 + (d * i) / 39), ctr.y + rad * Math.sin(a0 + (d * i) / 39)));
  };
  add(arc(I, K, L, 0.55, RED), bt('b16.2'), bt('b16.2', 0.5), { color: RED, gain: 3, width: 2.6 });
  add(arc(P, Ys, Xs, 0.75, RED), bt('b16.2', 0.3), bt('b16.2', 0.8), { color: RED, gain: 3, width: 2.6 });
  const art = new FatLines(lines, { color: WHITE, width: 1.7, gain: 1.4 });
  const pts = { A: Ap, B: Bp, C: Cp, I, X: Xs, Y: Ys, P, K, L };
  const when = { A: 'b15.1', B: 'b15.1', C: 'b15.1', I: 'b15.2', X: 'b15.3', Y: 'b15.3', P: 'b15.4', K: 'b16.1', L: 'b16.1' };
  const dots = new Dots(Object.entries(pts).map(([k, v]) => ({ p: P3(v), size: 7, t0: bt(when[k], 0.4) })), { gain: 4 });
  m.group.add(art.mesh, dots.mesh);
  const md = medal(ctx, 0xd9dde3, 'silver');
  md.position.copy(P3(V2(5.6, 7.4)));
  m.group.add(md);

  m.update = (t, st) => {
    const life = m.alive(st);
    const vis = t > m.tIn - 1 && life > 0.001;
    art.set(t, ctx, vis ? life : 0);
    dots.set(t, ctx, vis ? life : 0);
    const k = clamp((t - bt('b16.4')) / 0.4);
    md.visible = k > 0 && life > 0.001;
    md.userData.light.visible = md.visible && t < m.tOut + 3;
    md.scale.setScalar(Math.max(0.001, 1.7 * ease.outBack(k) * life));
    md.rotation.set(0, Math.sin(t * 0.9) * 0.5 + (1 - k) * 3, 0);
  };
  m.labels = (t, hud, project) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    for (const [k, v] of Object.entries(pts)) {
      const a = clamp((t - bt(when[k], 0.4)) / 0.3) * fade;
      const p = project(m.local(P3(v)));
      if (p.visible) hud.text(k, p.x + 16, p.y - 20, { family: 'Crimson', style: 'italic', size: 36, alpha: a, glow: 8, align: 'left' });
    }
    const pi = project(m.local(P3(V2(I.x - 0.2, I.y - 0.75))));
    if (pi.visible) hud.text('ω', pi.x, pi.y + 60, { family: 'Crimson', style: 'italic', size: 34, alpha: clamp((t - bt('b15.2', 0.6)) / 0.3) * fade });
    hud.tex(ctx.assets.tex.imo24, 540, 664, 40, { alpha: clamp((t - bt('b16.2', 0.5)) / 0.3) * fade, reveal: clamp((t - bt('b16.2', 0.5)) / 0.4) });
    const pa = project(m.local(P3(P)));
    if (pa.visible) hud.text('P4 · AlphaGeometry 2 · 19 s', pa.x + 40, pa.y + 4, { size: 25, weight: 500, alpha: clamp((t - bt('b16.3')) / 0.3) * fade * 0.9, align: 'left' });
    scoreRow(hud, 540, 588, [7, 7, 0, 7, 0, 7], bt('b16.3'), t, fade);
  };
  return m;
}

export function imo2025(ctx) {
  const m = base(ctx, 'imo2025');
  const B = ctx.B;
  const n = 6, S = 0.95;
  const f = m.frame;
  const rot = new THREE.Matrix4().makeBasis(f.T, f.N, f.B).invert();
  const origin = new THREE.Vector3(-1.2, -3.0, 0);
  const P3 = (v) => new THREE.Vector3(origin.x + v.x * S, origin.y + v.y * S, 0).applyMatrix4(rot);
  const pts = [];
  for (let a = 1; a <= n; a++) for (let b = 1; a + b <= n + 1; b++) pts.push(V2(a, b));
  const dots = new Dots(pts.map((p, i) => ({ p: P3(p), size: 8, t0: B('b17.1') + i * 0.025 })), { gain: 4 });
  const lines = [];
  // non-sunny diagonals x + y = 7, 6, 5
  [7, 6, 5].forEach((s, i) => lines.push({ pts: [P3(V2(s - 0.4, 0.4)), P3(V2(0.4, s - 0.4))], t0: B('b17.2', i), t1: B('b17.2', i + 0.4), gain: 1.5 }));
  // sunny lines through the inner six points
  const sunny = [[V2(1, 2), V2(3, 1)], [V2(2, 1), V2(1, 3)], [V2(1, 1), V2(2, 2)]];
  sunny.forEach(([p, q], i) => {
    const d = q.clone().sub(p).normalize();
    lines.push({ pts: [P3(p.clone().addScaledVector(d, -1.1)), P3(q.clone().addScaledVector(d, 1.1))], t0: B('b18.1', i * 0.66), t1: B('b18.1', i * 0.66 + 0.45), color: GOLD, gain: 3.2, width: 2.6 });
  });
  // axes
  lines.push({ pts: [P3(V2(0, 0)), P3(V2(n + 1.3, 0))], t0: B('b17.1'), t1: B('b17.1', 0.6), gain: 0.5 });
  lines.push({ pts: [P3(V2(0, 0)), P3(V2(0, n + 1.3))], t0: B('b17.1'), t1: B('b17.1', 0.6), gain: 0.5 });
  const art = new FatLines(lines, { width: 1.8 });
  m.group.add(dots.mesh, art.mesh);
  const md = medal(ctx, 0xf0c35a, 'gold');
  md.position.copy(P3(V2(5.4, 7.0)));
  m.group.add(md);

  m.update = (t, st) => {
    const life = m.alive(st);
    const vis = t > m.tIn - 1 && life > 0.001;
    art.set(t, ctx, vis ? life : 0);
    dots.set(t, ctx, vis ? life : 0);
    const k = clamp((t - B('b18.4')) / 0.4);
    md.visible = k > 0 && life > 0.001;
    md.userData.light.visible = md.visible && t < m.tOut + 3;
    md.scale.setScalar(Math.max(0.001, 1.7 * ease.outBack(k) * life));
    md.rotation.set(0, Math.sin(t * 0.9) * 0.5 + (1 - k) * 3, 0);
  };
  m.labels = (t, hud, project) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    hud.tex(ctx.assets.tex.imo25, 540, 664, 44, { alpha: clamp((t - B('b18.3', 0.3)) / 0.3) * fade, reveal: clamp((t - B('b18.3', 0.3)) / 0.4) });
    const ps = project(m.local(P3(V2(2.6, 2.4))));
    if (ps.visible) hud.text('sunny', ps.x + 10, ps.y, { family: 'Crimson', style: 'italic', size: 34, alpha: clamp((t - B('b18.1', 0.5)) / 0.3) * fade, color: '#ffd27a', align: 'left' });
    scoreRow(hud, 540, 588, [7, 7, 7, 7, 7, 0], B('b18.2'), t, fade);
  };
  return m;
}
