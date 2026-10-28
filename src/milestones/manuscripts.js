// 2026.10.06 — OpenAI releases 722 mathematical manuscripts at once (162 with Lean
// formalizations of their main result). 722 procedural paper cards burst from the
// head and settle into a helix tunnel around the line; the formalized ones carry a
// check mark.

import * as THREE from 'three';
import { base } from './common.js';
import { clamp, mulberry32, TAU } from '../core/math.js';

const VERT = /* glsl */`
attribute vec2 aUv; attribute vec4 aD; // index, lean flag, rnd1, rnd2
uniform float uTime; uniform float uT0; uniform float uSpread; uniform float uN;
varying vec2 vUv; varying float vLean; varying float vA; varying float vR;
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
void main() {
  float i = aD.x;
  float f = i / uN;
  float tStart = uT0 + f * uSpread;
  float k = clamp((uTime - tStart) / 0.9, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - k, 3.0);
  float th = i * 2.39996;                       // golden-angle phyllotaxis around the axis
  float h = (f - 0.5) * 24.0;                   // along the line (local x)
  float rad = 5.2 + aD.z * 1.0;
  vec3 home = vec3(h, cos(th) * rad, sin(th) * rad);
  vec3 from = vec3(-6.0 + aD.w * 2.0, 0.0, 0.0);
  vec3 c = mix(from, home, e) + vec3(0.0, sin(th * 3.0 + uTime) * 0.08, 0.0);
  // card faces the axis; spins in while flying
  vec3 n = normalize(vec3(0.0, -cos(th), -sin(th)));
  vec3 up = vec3(1.0, 0.0, 0.0);
  vec3 rt = normalize(cross(up, n));
  float spin = (1.0 - e) * 6.0 * (aD.z - 0.5);
  vec2 q = (aUv - 0.5) * vec2(0.46, 0.62);
  q = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * q;
  vec3 p = c + rt * q.x + up * q.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vUv = aUv; vLean = aD.y; vA = k > 0.0 ? 1.0 : 0.0; vR = aD.z;
}`;

const FRAG = /* glsl */`
uniform float uAlpha; uniform float uTime; uniform float uLeanT;
varying vec2 vUv; varying float vLean; varying float vA; varying float vR;
float box(vec2 p, vec2 a, vec2 b) { return step(a.x, p.x) * step(p.x, b.x) * step(a.y, p.y) * step(p.y, b.y); }
void main() {
  if (vA < 0.5) discard;
  vec2 p = vUv;
  float border = 1.0 - box(p, vec2(0.04, 0.03), vec2(0.96, 0.97));
  float ink = 0.0;
  ink += box(p, vec2(0.14, 0.86), vec2(0.86, 0.9)) * 0.9;                // title
  ink += box(p, vec2(0.3, 0.8), vec2(0.7, 0.82)) * 0.5;                   // authors
  for (int k = 0; k < 11; k++) {
    float y = 0.72 - float(k) * 0.055;
    float len = 0.82 - 0.25 * step(0.6, fract(vR * 17.0 + float(k) * 0.37));
    ink += box(p, vec2(0.1, y), vec2(len, y + 0.018)) * 0.45;
  }
  float lean = 0.0;
  if (vLean > 0.5 && uTime > uLeanT) {
    vec2 c = p - vec2(0.8, 0.12);
    float d1 = abs(dot(c - vec2(-0.03, 0.0), normalize(vec2(1.0, -1.0)))) - 0.012;
    float d2 = abs(dot(c - vec2(0.02, 0.0), normalize(vec2(1.0, 1.6)))) - 0.012;
    lean = (step(d1, 0.0) * step(-0.07, c.x) * step(c.x, -0.01) * step(-0.05, c.y) * step(c.y, 0.02) +
            step(d2, 0.0) * step(-0.02, c.x) * step(c.x, 0.08) * step(-0.05, c.y) * step(c.y, 0.09));
  }
  vec3 paper = vec3(0.07, 0.07, 0.08);
  vec3 col = paper + vec3(0.32) * ink + vec3(0.9) * border * 0.22 + vec3(1.0, 0.3, 0.2) * clamp(lean, 0.0, 1.0) * 3.0;
  gl_FragColor = vec4(col * uAlpha, 1.0);
}`;

export function manuscripts(ctx) {
  const m = base(ctx, 'manuscripts');
  const B = ctx.B;
  const N = 722, LEAN = 162;
  const rng = mulberry32(722);
  const leanSet = new Set();
  while (leanSet.size < LEAN) leanSet.add(Math.floor(rng() * N));
  const uv = [], d = [], idx = [], pos = [];
  for (let i = 0; i < N; i++) {
    const r1 = rng(), r2 = rng();
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { uv.push(u, v); d.push(i, leanSet.has(i) ? 1 : 0, r1, r2); pos.push(0, 0, 0); }
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aD', new THREE.Float32BufferAttribute(d, 4));
  g.setIndex(idx);
  const tBurst = B('b49.1');
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uT0: { value: tBurst }, uSpread: { value: 1.7 }, uN: { value: N }, uAlpha: { value: 1 }, uLeanT: { value: B('b50.1') } },
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const cards = new THREE.Mesh(g, mat);
  cards.frustumCulled = false;
  m.group.add(cards);
  m.count = (t) => Math.round(N * clamp((t - tBurst) / (1.7 + 0.9)));

  m.update = (t, st) => {
    const life = m.alive(st);
    cards.visible = t > tBurst - 0.1 && life > 0.001;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uAlpha.value = 0.62 * life * (1 - 0.5 * clamp((t - m.tOut - 1) / 2));
  };
  m.labels = (t, hud) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    const n = m.count(t);
    hud.text(`${String(n).padStart(3, '0')} / 722`, 540, 600, { family: 'JBM', size: 60, weight: 300, alpha: fade, glow: 16 });
    const lean = Math.round(LEAN * clamp((t - B('b50.1')) / 1.2));
    hud.text(`${lean} with Lean-checked main results`, 540, 668, { size: 26, weight: 500, alpha: fade * clamp((t - B('b50.1')) / 0.3) * 0.85, color: '#ffb3a8' });
  };
  return m;
}
