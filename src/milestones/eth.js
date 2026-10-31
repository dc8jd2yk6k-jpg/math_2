// 2026.10.27 — the Exponential Time Hypothesis (3-SAT needs 2^(delta n) time) is
// refuted twice within hours: first by OpenAI, then by Claude (Anthropic), "A 2^o(n)
// Time Algorithm for 3-SAT". Each result is an exponential barrier across the line,
// a glowing lattice labelled 2^(delta n), that the head breaks on the hit.

import * as THREE from 'three';
import { base } from './common.js';
import { clamp, mulberry32 } from '../core/math.js';

const SHARD_VERT = /* glsl */`
attribute vec3 aC; attribute vec4 aR; // cell centre, random dir + spin
uniform float uT; uniform float uHit;
varying float vEdge; varying vec2 vUv;
void main() {
  float a = max(0.0, uT - uHit);
  vec3 dir = normalize(vec3(aR.x * 0.6 + 0.4 * sign(aR.x), aR.y, aR.z));
  vec3 off = (aC - vec3(0.0)) * 0.0 + dir * a * (6.0 + aR.w * 10.0) / (1.0 + a * 0.6);
  float sp = a * (3.0 + aR.w * 6.0);
  vec3 p = position - aC;
  float c = cos(sp), s = sin(sp);
  p = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(aC + p + off, 1.0);
  vUv = uv;
}`;
const SHARD_FRAG = /* glsl */`
uniform float uAlpha; uniform float uT; uniform float uHit; uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 d = min(vUv, 1.0 - vUv);
  float edge = 1.0 - smoothstep(0.0, 0.07, min(d.x, d.y));
  float a = max(0.0, uT - uHit);
  float glow = 0.006 + edge * (0.32 + exp(-a * 5.0) * step(0.0, uT - uHit) * 1.2);
  gl_FragColor = vec4(uColor * glow * uAlpha * exp(-a * 1.7), 1.0);
}`;

function barrier(seed, color) {
  const rng = mulberry32(seed);
  const n = 12, size = 1.7, half = (n * size) / 2;
  const pos = [], uv = [], cen = [], rnd = [], idx = [];
  let v = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x0 = -half + i * size, z0 = -half + j * size;
    const c = [0, x0 + size / 2, z0 + size / 2];
    const r = [rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1, rng()];
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      pos.push(0, x0 + a * size, z0 + b * size); uv.push(a, b); cen.push(...c); rnd.push(...r);
    }
    idx.push(v, v + 1, v + 2, v, v + 2, v + 3); v += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(cen, 3));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 4));
  g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: SHARD_VERT, fragmentShader: SHARD_FRAG,
    uniforms: { uT: { value: 0 }, uHit: { value: 0 }, uAlpha: { value: 1 }, uColor: { value: color } },
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// The two labs' names beside their barriers: OpenAI on the left, Claude (Anthropic) on
// the right, both held through the second hit. Positions follow the barrier on screen
// but are kept inside the frame, clear of the titles and the equation.
function labLabel(hud, project, m, name, side, alpha) {
  if (alpha <= 0.002) return;
  const p = project(m.local(new THREE.Vector3(0, 0, 0)));
  const px = p.visible ? p.x : 540, py = p.visible ? p.y : 900;
  const x = side < 0 ? clamp(px - 230, 170, 480) : clamp(px + 230, 600, 910);
  const y = clamp(py, 660, 1300);
  hud.label(name, x, y, { size: 30, weight: 600, alpha, dot: false, dx: 0, align: side < 0 ? 'right' : 'left' });
}

export function ethOpenAI(ctx) {
  const m = base(ctx, 'eth_openai');
  const B = ctx.B;
  const wall = barrier(53, new THREE.Color(0.95, 0.97, 1.0));
  m.group.add(wall);
  const hit = B('b53.1');
  m.update = (t, st) => {
    const life = m.alive(st);
    wall.visible = t > m.tIn - 2.5 && life > 0.001;
    const u = wall.material.uniforms;
    u.uT.value = t; u.uHit.value = hit;
    u.uAlpha.value = life * clamp((t - (m.tIn - 2.5)) / 1.0);
  };
  const until = B('b54.4', 1); // the label stays until the second result's block ends
  m.labels = (t, hud, project) => {
    labLabel(hud, project, m, 'OpenAI', -1, clamp((t - m.tIn + 0.5) / 0.3) * (1 - clamp((t - until) / 0.3)));
    if (t < m.tIn - 1.5 || t > m.tOut + 0.4) return;
    const p = project(m.local(new THREE.Vector3(0, 0, 5.2)));
    const a = clamp((t - (m.tIn - 1.5)) / 0.4) * (1 - clamp((t - hit) / 0.5));
    if (p.visible) hud.tex(ctx.assets.tex.eth_wall, p.x, p.y - 40, 56, { alpha: a });
    const fade = 1 - clamp((t - m.tOut) / 0.3);
    hud.tex(ctx.assets.tex.eth, 540, 1480, 64, { alpha: fade * clamp((t - hit - 0.2) / 0.3), reveal: clamp((t - hit - 0.2) / 0.4) });
  };
  return m;
}

export function ethClaude(ctx) {
  const m = base(ctx, 'eth_claude');
  const B = ctx.B;
  const wall = barrier(54, new THREE.Color(1.0, 0.82, 0.78));
  m.group.add(wall);
  const hit = B('b54.1');
  m.update = (t, st) => {
    const life = m.alive(st);
    wall.visible = t > m.tIn - 2.5 && life > 0.001;
    const u = wall.material.uniforms;
    u.uT.value = t; u.uHit.value = hit;
    u.uAlpha.value = life * clamp((t - (m.tIn - 2.5)) / 1.0);
  };
  m.labels = (t, hud, project) => {
    if (t < m.tIn - 1.2 || t > m.tOut + 0.4) return;
    const fade = 1 - clamp((t - m.tOut) / 0.3);
    labLabel(hud, project, m, 'Claude (Anthropic)', 1, fade * clamp((t - (m.tIn - 1)) / 0.3));
    hud.tex(ctx.assets.tex.eth, 540, 1480, 64, { alpha: fade * clamp((t - hit) / 0.2) });
  };
  return m;
}
