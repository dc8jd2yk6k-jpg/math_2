// 2026.09.08 — OpenAI: finite-time singularity for 3D incompressible Navier-Stokes,
// "a vortex that spirals inward and gets increasingly elongated, like spaghetti".
// Particles follow analytic self-similar pathlines toward the blow-up time T*:
// radius ~ (T*-t)^(1/2), swirl ~ 1/r^2, axial stretching as the core thins (volume
// is conserved). The camera flies inside the tube; at T* the velocity blows up.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines } from '../core/lines.js';
import { clamp, ease, mulberry32, TAU } from '../core/math.js';

const VERT = /* glsl */`
attribute vec4 aP; // r0, theta0, z0, seed
uniform float uTime; uniform float uT0; uniform float uTs; uniform float uScale; uniform float uBurst; uniform float uPx;
varying float vB;
void main() {
  float r0 = aP.x, th0 = aP.y, z0 = aP.z, sd = aP.w;
  float prog = clamp((uTime - uT0) / (uTs - uT0), 0.0, 1.0);    // 0 -> 1 toward blow-up
  float L = sqrt(max(1.0 - prog, 0.0006));                        // self-similar scale
  float r = r0 * (0.06 + 0.94 * L);
  float z = z0 / (0.32 + 0.68 * L);                               // stretching
  float swirl = (1.0 / L - 1.0) * 0.55 / (r0 * r0 + 0.25);
  float th = th0 + uTime * (0.35 + 0.6 / (r0 + 0.4)) + swirl;
  // after T*: the singular core detonates outward
  float after = max(0.0, uTime - uTs);
  r += uBurst * after * (1.8 + 4.0 * sd) / (1.0 + after * 0.8);
  z *= 1.0 + uBurst * after * 0.35;
  vec3 p = vec3(z, r * cos(th), r * sin(th)) * uScale;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float speed = (0.6 + swirl * 0.15) / (0.3 + r);
  vB = clamp(0.45 + speed * 0.5, 0.25, 4.0) * (0.6 + 0.4 * sd);
  gl_PointSize = clamp(uPx * 22.0 / c.w, 1.0, 5.0 * uPx);
  gl_Position = c;
}`;

const FRAG = /* glsl */`
uniform float uAlpha; uniform float uFlash;
varying float vB;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 14.0);
  vec3 col = mix(vec3(0.62, 0.74, 1.0), vec3(1.0, 0.95, 0.9), clamp(vB / 2.5, 0.0, 1.0));
  gl_FragColor = vec4(col * vB * a * uAlpha * (1.0 + uFlash), 1.0);
}`;

export function navierstokes(ctx) {
  const m = base(ctx, 'navierstokes');
  const B = ctx.B;
  const rng = mulberry32(908);
  const N = 90000;
  const data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const r0 = 1.0 + Math.pow(rng(), 1.3) * 3.6;
    data.set([r0, rng() * TAU, (rng() - 0.5) * 34, rng()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(data, 4));
  const tStart = B('b35.1'), tStar = B('b37.1');
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uT0: { value: tStart }, uTs: { value: tStar }, uScale: { value: 1 }, uBurst: { value: 1 }, uPx: { value: 1 }, uAlpha: { value: 1 }, uFlash: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const cloud = new THREE.Points(g, mat);
  cloud.frustumCulled = false;
  m.group.add(cloud);

  // the spaghetti: a helical core filament that thins and stretches
  const H = 420;
  const helixPts = Array.from({ length: H }, () => new THREE.Vector3());
  const filament = new FatLines([{ pts: helixPts, color: new THREE.Color(1, 0.9, 0.85), gain: 3.2, width: 2.2 }]);
  m.group.add(filament.mesh);
  const fa = filament.mesh.geometry.attributes;

  m.update = (t, st) => {
    const life = m.alive(st);
    const vis = t > m.tIn - 1.2 && life > 0.001;
    cloud.visible = filament.mesh.visible = vis;
    if (!vis) return;
    const u = mat.uniforms;
    u.uTime.value = t;
    u.uPx.value = ctx.H / 1920;
    const after = t - tStar;
    u.uAlpha.value = life * clamp((t - (m.tIn - 1.2)) / 1.2) * (after > 0 ? Math.max(0.15, 1 - after / 4) : 1);
    u.uFlash.value = after > 0 ? 3 * Math.exp(-after / 0.25) : 0;
    // filament
    const prog = clamp((t - tStart) / (tStar - tStart));
    const L = Math.sqrt(Math.max(1 - prog, 0.0006));
    const rad = 0.9 * L, stretch = 1 / (0.32 + 0.68 * L);
    const turns = 6 + (1 / L - 1) * 0.8;
    for (let i = 0; i < H; i++) {
      const s = i / (H - 1) - 0.5;
      const th = s * turns * TAU + t * 2.5;
      helixPts[i].set(s * 10 * stretch, Math.cos(th) * rad, Math.sin(th) * rad);
    }
    let v = 0;
    for (let k = 0; k < H - 1; k++) for (let c = 0; c < 4; c++, v++) {
      fa.aA.array.set([helixPts[k].x, helixPts[k].y, helixPts[k].z], v * 3);
      fa.aB.array.set([helixPts[k + 1].x, helixPts[k + 1].y, helixPts[k + 1].z], v * 3);
    }
    fa.aA.needsUpdate = fa.aB.needsUpdate = true;
    filament.set(1e9, ctx, life * clamp((t - tStart + 0.5) / 0.8) * (after > 0 ? Math.exp(-after / 0.4) : 1));
  };

  m.labels = (t, hud) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    hud.tex(ctx.assets.tex.ns, 540, 596, 34, { alpha: fade * clamp((t - m.tIn - 0.3) / 0.3), reveal: clamp((t - m.tIn - 0.3) / 1.6) });
    hud.tex(ctx.assets.tex.ns_blow, 540, 1420, 46, { alpha: fade * clamp((t - tStar) / 0.2), reveal: clamp((t - tStar) / 0.4) });
    if (t > m.tIn + 1.5) hud.text('10,000 agents · 88 hours · Lean formalization', 540, 1492, { size: 25, weight: 500, alpha: fade * 0.75 * clamp((t - B('b38.1')) / 0.4) });
  };
  return m;
}
