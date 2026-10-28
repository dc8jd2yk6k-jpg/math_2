// 2026.10.27 — the Exponential Time Hypothesis (3-SAT needs 2^(delta n) time) is
// refuted twice within hours: first by OpenAI, then by Claude (Anthropic), "A 2^o(n)
// Time Algorithm for 3-SAT". Each result is an exponential barrier across the line,
// a glowing lattice labelled 2^(delta n), that shatters on the hit. The second
// arrives as a rival comet on a parallel track.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines } from '../core/lines.js';
import { Head } from '../world/head.js';
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
  m.labels = (t, hud, project) => {
    if (t < m.tIn - 1.5 || t > m.tOut + 0.4) return;
    const p = project(m.local(new THREE.Vector3(0, 0, 5.2)));
    const a = clamp((t - (m.tIn - 1.5)) / 0.4) * (1 - clamp((t - hit) / 0.5));
    if (p.visible) hud.tex(ctx.assets.tex.eth_wall, p.x, p.y - 40, 56, { alpha: a });
    const fade = 1 - clamp((t - m.tOut) / 0.3);
    hud.tex(ctx.assets.tex.eth, 540, 1480, 64, { alpha: fade * clamp((t - hit - 0.2) / 0.3), reveal: clamp((t - hit - 0.2) / 0.4) });
    const ph = project(ctx.film.curve.at(ctx.headS(t)).p);
    if (ph.visible) hud.label('OpenAI', ph.x, ph.y, { size: 28, alpha: fade * clamp((t - m.tIn + 0.5) / 0.3), dot: false, dx: -34, align: 'right' });
  };
  return m;
}

export function ethClaude(ctx) {
  const m = base(ctx, 'eth_claude');
  const B = ctx.B;
  const wall = barrier(54, new THREE.Color(1.0, 0.82, 0.78));
  m.group.add(wall);
  const hit = B('b54.1');
  // the rival comet: its own track, parallel to the main line, offset sideways
  const off = 3.2;
  const track = [];
  for (let k = 0; k <= 160; k++) track.push(new THREE.Vector3(-46 + (k / 160) * 52, 0, off));
  const tStart = B('b53.3'), tArrive = hit;
  const speed = 46 / (tArrive - tStart); // reaches its barrier (local x = 0) exactly on the hit
  const trail = new FatLines([{ pts: track, t0: tStart, t1: tStart + 52 / speed, color: new THREE.Color(1, 0.35, 0.22), gain: 2.6, width: 2.2 }]);
  m.group.add(trail.mesh);
  const head = new Head({ color: new THREE.Color(1.0, 0.32, 0.12) });
  ctx.scene.add(head.mesh, head.light);
  const pos = new THREE.Vector3();
  m.update = (t, st) => {
    const life = m.alive(st);
    wall.visible = t > m.tIn - 2.5 && life > 0.001;
    const u = wall.material.uniforms;
    u.uT.value = t; u.uHit.value = hit;
    u.uAlpha.value = life * clamp((t - (m.tIn - 2.5)) / 1.0);
    trail.set(t, ctx, life * (t > tStart ? 1 : 0) * (1 - clamp((t - B('b56.1')) / 1.5)));
    pos.set(Math.min(6, -46 + speed * Math.max(0, t - tStart)), 0, off).applyMatrix4(m.group.matrix);
    const alive = t > tStart && t < B('b55.2') ? 1 : 0;
    head.set(pos, ctx.film.camera, ctx.H, { size: 0.3, glow: 1.3, core: 5, minPx: 18, alpha: alive * life * (1 - clamp((t - B('b54.4')) / 0.6)), light: 0 });
    head.light.visible = false;
  };
  m.labels = (t, hud, project) => {
    if (t < m.tIn - 1.2 || t > m.tOut + 0.4) return;
    const fade = 1 - clamp((t - m.tOut) / 0.3);
    const pp = project(pos);
    if (pp.visible) hud.label('Claude (Anthropic)', pp.x, pp.y, { size: 28, alpha: fade * clamp((t - (m.tIn - 1)) / 0.3), dot: false, dx: 34 });
    hud.tex(ctx.assets.tex.eth, 540, 1480, 64, { alpha: fade * clamp((t - hit) / 0.2) });
  };
  return m;
}
