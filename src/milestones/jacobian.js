// 2026.07.20 — Claude (Anthropic) and the Jacobian conjecture (Keller, 1939).
// The published counterexample, exactly:
//   F(x,y,z) = ( z(1+xy)^3 + y^2(1+xy)(4+3xy),  y + 3x(1+xy)^2 z + 3xy^2(4+3xy),
//                2x - 3x^2 y - x^3 z ),      det J_F = -2 everywhere,
// yet F(0,0,-1/4) = F(1,-3/2,13/2) = (-1/4,0,0): locally invertible everywhere,
// not invertible globally. On screen the straight tube from p to q morphs into its
// image, which closes into a loop: both ends land on the same point. Small cubes
// ride along the tube and map through the Jacobian J(v): each is sheared into a
// different parallelepiped, but every one has exactly twice the volume, flipped.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines, Dots } from '../core/lines.js';
import { clamp, ease, lerp } from '../core/math.js';

const RED = new THREE.Color(1, 0.12, 0.08);
const F = (x, y, z) => {
  const u = 1 + x * y;
  return [z * u ** 3 + y * y * u * (4 + 3 * x * y), y + 3 * x * u * u * z + 3 * x * y * y * (4 + 3 * x * y), 2 * x - 3 * x * x * y - x ** 3 * z];
};

export function jacobian(ctx) {
  const m = base(ctx, 'jacobian');
  const B = ctx.B;
  const p = new THREE.Vector3(0, 0, -0.25), q = new THREE.Vector3(1, -1.5, 6.5);
  const axis = q.clone().sub(p).normalize();
  const tmp = Math.abs(axis.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u1 = new THREE.Vector3().crossVectors(axis, tmp).normalize(), u2 = new THREE.Vector3().crossVectors(axis, u1);
  const W = 0.16;
  // polylines in the domain: centre line, 4 tube lines, cross sections, two cubes
  const domainLines = [];
  const N = 140;
  const along = (s, a, b) => p.clone().lerp(q, s).addScaledVector(u1, a).addScaledVector(u2, b);
  domainLines.push({ kind: 'core', pts: Array.from({ length: N + 1 }, (_, i) => along(i / N, 0, 0)) });
  for (const [a, b] of [[W, W], [W, -W], [-W, W], [-W, -W]]) domainLines.push({ kind: 'tube', pts: Array.from({ length: N + 1 }, (_, i) => along(i / N, a, b)) });
  for (let k = 1; k < 14; k++) {
    const s = k / 14;
    domainLines.push({ kind: 'rib', pts: [[W, W], [W, -W], [-W, -W], [-W, W], [W, W]].map(([a, b]) => along(s, a, b)) });
  }
  const cube = (c) => {
    const h = 0.12, out = [];
    const V = (x, y, z) => c.clone().add(new THREE.Vector3(x, y, z));
    for (const [a, b] of [[[-h, -h, -h], [h, -h, -h]], [[-h, h, -h], [h, h, -h]], [[-h, -h, h], [h, -h, h]], [[-h, h, h], [h, h, h]],
      [[-h, -h, -h], [-h, h, -h]], [[h, -h, -h], [h, h, -h]], [[-h, -h, h], [-h, h, h]], [[h, -h, h], [h, h, h]],
      [[-h, -h, -h], [-h, -h, h]], [[h, -h, -h], [h, -h, h]], [[-h, h, -h], [-h, h, h]], [[h, h, -h], [h, h, h]]]) {
      out.push(Array.from({ length: 9 }, (_, i) => V(...a.map((v, j) => lerp(v, b[j], i / 8)))));
    }
    return out;
  };
  cube(p).forEach((pts) => domainLines.push({ kind: 'cubeP', pts }));
  cube(q).forEach((pts) => domainLines.push({ kind: 'cubeQ', pts }));
  // volume cells along the tube; their images use the exact Jacobian at the centre
  const jac = (v) => {
    const h = 1e-5;
    return [0, 1, 2].map((j) => {
      const d = [0, 0, 0]; d[j] = h;
      const a = F(v.x + d[0], v.y + d[1], v.z + d[2]), b = F(v.x - d[0], v.y - d[1], v.z - d[2]);
      return a.map((x, i) => (x - b[i]) / (2 * h)); // column j
    });
  };
  const CELLS = 22, CH = 0.085;
  for (let k = 1; k < CELLS; k++) {
    const c = along(k / CELLS, 0, 0);
    const J = jac(c);
    const Fc = F(c.x, c.y, c.z);
    cube(c).forEach((pts) => {
      const img = pts.map((v) => {
        const d = v.clone().sub(c).multiplyScalar(CH / 0.12);
        return new THREE.Vector3(Fc[0] + J[0][0] * d.x + J[1][0] * d.y + J[2][0] * d.z, Fc[1] + J[0][1] * d.x + J[1][1] * d.y + J[2][1] * d.z, Fc[2] + J[0][2] * d.x + J[1][2] * d.y + J[2][2] * d.z);
      });
      domainLines.push({ kind: 'cell', pts: pts.map((v) => c.clone().add(v.clone().sub(c).multiplyScalar(CH / 0.12))), imgRaw: img });
    });
  }

  // display transforms: domain centred & aligned with the line; image centred
  const mid = p.clone().add(q).multiplyScalar(0.5);
  const toLocal = new THREE.Matrix4().makeBasis(u1, axis, u2).invert(); // axis -> local +y (the curve's N?) handled below
  const domainXf = (v) => v.clone().sub(mid).applyMatrix4(toLocal);
  const imgAll = domainLines.filter((l) => !l.imgRaw).flatMap((l) => l.pts.map((v) => new THREE.Vector3(...F(v.x, v.y, v.z))));
  const bb = new THREE.Box3().setFromPoints(imgAll);
  const imgC = bb.getCenter(new THREE.Vector3());
  const imgScale = 6.2 / Math.max(...bb.getSize(new THREE.Vector3()).toArray());
  const imageXf = (v) => new THREE.Vector3(...F(v.x, v.y, v.z)).sub(imgC).multiplyScalar(imgScale);
  // the group frame has T along the vertical line: map local (x,y,z) so the domain axis runs along T
  const reorder = (v) => new THREE.Vector3(v.y, v.x, v.z);

  const meshes = [];
  const build = (kind, color, gain, width) => {
    const ls = domainLines.filter((l) => l.kind === kind);
    const A = ls.map((l) => ({ pts: l.pts.map((v) => reorder(domainXf(v))), color, gain, width }));
    const fl = new FatLines(A);
    // morph target stored as a second position set
    const aA = fl.mesh.geometry.attributes.aA, aB = fl.mesh.geometry.attributes.aB;
    const imgA = new Float32Array(aA.array.length), imgB = new Float32Array(aB.array.length);
    let v = 0;
    for (const l of ls) {
      const img = l.imgRaw ? l.imgRaw.map((v) => reorder(v.clone().sub(imgC).multiplyScalar(imgScale))) : l.pts.map((x) => reorder(imageXf(x)));
      for (let k = 0; k < img.length - 1; k++) for (let c = 0; c < 4; c++, v++) {
        imgA.set([img[k].x, img[k].y, img[k].z], v * 3);
        imgB.set([img[k + 1].x, img[k + 1].y, img[k + 1].z], v * 3);
      }
    }
    meshes.push({ fl, srcA: aA.array.slice(), srcB: aB.array.slice(), imgA, imgB });
    return fl;
  };
  const parts = [
    build('core', new THREE.Color(1, 0.96, 0.95), 2.8, 2.6), build('tube', new THREE.Color(1, 1, 1), 1.0, 1.4),
    build('rib', new THREE.Color(1, 1, 1), 0.6, 1.1), build('cell', new THREE.Color(1, 0.55, 0.48), 1.5, 1.4),
    build('cubeP', new THREE.Color(1, 1, 1), 2.6, 2.0), build('cubeQ', RED, 3.2, 2.2),
  ];
  const holder = new THREE.Group();
  parts.forEach((fl) => holder.add(fl.mesh));
  const pP = reorder(domainXf(p)), pQ = reorder(domainXf(q)), pImg = reorder(imageXf(p));
  const hit = new Dots([{ p: pImg, size: 9, color: new THREE.Color(1, 0.6, 0.5), gain: 7 }]);
  holder.add(hit.mesh);
  m.group.add(holder);
  m.anchor = { pP, pQ, pImg };
  let lastL = -1;

  const tM0 = B('b21.3'), tM1 = B('b22.2');
  m.lambda = (t) => ease.inOutCubic(clamp((t - tM0) / (tM1 - tM0)));
  m.update = (t, st) => {
    const life = m.alive(st);
    const on = t > m.tIn - 1 ? life : 0;
    const L = m.lambda(t);
    if (L !== lastL) {
      for (const g of meshes) {
        const aA = g.fl.mesh.geometry.attributes.aA, aB = g.fl.mesh.geometry.attributes.aB;
        for (let i = 0; i < aA.array.length; i++) {
          aA.array[i] = g.srcA[i] + (g.imgA[i] - g.srcA[i]) * L;
          aB.array[i] = g.srcB[i] + (g.imgB[i] - g.srcB[i]) * L;
        }
        aA.needsUpdate = true; aB.needsUpdate = true;
      }
      lastL = L;
    }
    const reveal = clamp((t - (m.tIn - 0.6)) / 0.9);
    holder.scale.setScalar(Math.max(0.001, ease.outCubic(reveal)));
    holder.rotation.y = (t - m.tIn) * 0.35;
    for (const fl of parts) fl.set(1e9, ctx, on);
    const hk = t - tM1;
    hit.set(t, ctx, hk > 0 ? on * Math.exp(-hk / 0.9) * 1.5 + on * 0.35 : 0);
    hit.material.uniforms.uPop.value = 1;
  };

  m.labels = (t, hud, project) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    const L = m.lambda(t);
    const wp = (v0, v1) => m.local(v0.clone().lerp(v1, L).applyMatrix4(new THREE.Matrix4().makeRotationY((t - m.tIn) * 0.35)));
    const lp = project(wp(m.anchor.pP, m.anchor.pImg)), lq = project(wp(m.anchor.pQ, m.anchor.pImg));
    const a = clamp((t - m.tIn) / 0.4) * fade;
    if (lp.visible) hud.text('p', lp.x - 26, lp.y - 18, { family: 'Crimson', style: 'italic', size: 40, alpha: a });
    if (lq.visible) hud.text('q', lq.x + 24, lq.y - 18, { family: 'Crimson', style: 'italic', size: 40, alpha: a, color: '#ff8a7a' });
    hud.tex(ctx.assets.tex.jac_F, 540, 1470, 104, { alpha: clamp((t - m.tIn - 0.2) / 0.4) * fade * (1 - 0.6 * clamp((t - tM1) / 0.5)) });
    hud.tex(ctx.assets.tex.jac_det, 540, 590, 44, { alpha: clamp((t - B('b21.3')) / 0.3) * fade });
    hud.tex(ctx.assets.tex.jac_eq, 540, 1572, 42, { alpha: clamp((t - tM1) / 0.3) * fade, reveal: clamp((t - tM1) / 0.45) });
  };
  return m;
}
