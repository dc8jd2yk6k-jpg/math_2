// Stars and dust. Each particle is an instanced quad stretched between its screen
// positions under the previous and current sub-frame cameras, so accumulated
// sub-frames merge into continuous streaks during whip-pans instead of dotted trails.
// Size is physical (world radius / distance); far stars dim instead of shrinking
// below a pixel, near ones swell into soft bokeh discs with conserved energy.

import * as THREE from 'three';
import { mulberry32, gaussian, TAU } from '../core/math.js';

const VERT = /* glsl */`
attribute vec2 corner;
attribute vec3 iPos;
attribute vec4 iData; // size, brightness, phase, twinkle cycles per loop
uniform mat4 uVP; uniform mat4 uVPPrev;
uniform vec2 uRes; uniform float uFocal; uniform float uLoop; uniform float uMaxPx; uniform float uGain; uniform float uTwinkle;
varying vec2 vLocal; varying float vLen; varying float vRad; varying float vBright;
void main() {
  vec4 c1 = uVP * vec4(iPos, 1.0);
  vec4 c0 = uVPPrev * vec4(iPos, 1.0);
  if (c1.w < 0.2 || c0.w < 0.2) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 s1 = (c1.xy / c1.w * 0.5 + 0.5) * uRes;
  vec2 s0 = (c0.xy / c0.w * 0.5 + 0.5) * uRes;
  float rad = iData.x * uFocal / c1.w;
  float b = iData.y;
  if (rad < 0.75) { b *= (rad / 0.75) * (rad / 0.75); rad = 0.75; }
  if (rad > 3.0) { b *= 9.0 / (rad * rad) * mix(1.0, rad / 3.0, 0.55); }
  rad = min(rad, uMaxPx);
  vec2 dir = s1 - s0; float len = length(dir);
  if (len > uRes.y * 0.35) { len = 0.0; s0 = s1; }
  vec2 ax = len > 1e-3 ? dir / len : vec2(1.0, 0.0);
  vec2 nr = vec2(-ax.y, ax.x);
  float R = rad * 2.2 + 1.0;
  vec2 p = mix(s0, s1, corner.x) + ax * (corner.x * 2.0 - 1.0) * R + nr * corner.y * R;
  vLocal = vec2(dot(p - s0, ax), dot(p - s0, nr));
  vLen = len; vRad = rad;
  float tw = 1.0 - uTwinkle * 0.5 * (1.0 + sin(6.2831853 * uLoop * iData.w + iData.z));
  vBright = b * tw * uGain * (rad / (rad + len * 0.5));
  gl_Position = vec4((p / uRes * 2.0 - 1.0) * c1.w, c1.z, c1.w);
}`;

const FRAG = /* glsl */`
uniform vec3 uColor;
varying vec2 vLocal; varying float vLen; varying float vRad; varying float vBright;
void main() {
  float dx = max(0.0, max(-vLocal.x, vLocal.x - vLen));
  float d2 = dx * dx + vLocal.y * vLocal.y;
  float a = exp(-d2 / (vRad * vRad * 0.9));
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * vBright * a, 1.0);
}`;

export class Starfield {
  constructor(curve, { seed = 7, field = 12000, dust = 10000, sky = 3000 } = {}) {
    const rng = mulberry32(seed);
    const pos = [], data = [];
    const push = (x, y, z, size, bright) => {
      pos.push(x, y, z);
      data.push(size, bright, rng() * TAU, 2 + Math.floor(rng() * 9));
    };
    // volumetric field around the whole figure and the camera paths
    for (let i = 0; i < field; i++) {
      const x = -260 + rng() * 720, y = -260 + rng() * 1240, z = -500 + rng() * 1150;
      push(x, y, z, 0.05 + Math.pow(rng(), 3) * 0.32, 0.35 + Math.pow(rng(), 2) * 2.2);
    }
    // dust hugging the trajectory: what makes the near field feel inhabited
    for (let i = 0; i < dust; i++) {
      const s = Math.pow(rng(), 0.85) * curve.length;
      const a = curve.at(s);
      const r = 3 + Math.abs(gaussian(rng)) * 26;
      const th = rng() * TAU;
      const off = a.N.clone().multiplyScalar(Math.cos(th) * r).add(a.B.clone().multiplyScalar(Math.sin(th) * r));
      off.addScaledVector(a.T, (rng() - 0.5) * 8);
      push(a.p.x + off.x, a.p.y + off.y, a.p.z + off.z, 0.02 + Math.pow(rng(), 4) * 0.12, 0.3 + Math.pow(rng(), 3) * 1.6);
    }
    // distant sky shell for parallax depth
    for (let i = 0; i < sky; i++) {
      const u = rng() * 2 - 1, th = rng() * TAU, r = 2600 + rng() * 900;
      const q = Math.sqrt(1 - u * u);
      push(96 + r * q * Math.cos(th), 200 + r * u, r * q * Math.sin(th), 2.0 + Math.pow(rng(), 3) * 9, 0.25 + Math.pow(rng(), 3) * 1.3);
    }
    // Plain (non-instanced) quads: SwiftShader pays a large per-instance cost, so the
    // four corners of every particle are baked into one static vertex buffer.
    const n = pos.length / 3;
    const P = new Float32Array(n * 12), D = new Float32Array(n * 16), C = new Float32Array(n * 8);
    const idx = new Uint32Array(n * 6);
    const corners = [0, -1, 1, -1, 1, 1, 0, 1];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 4; k++) {
        P.set(pos.slice(i * 3, i * 3 + 3), (i * 4 + k) * 3);
        D.set(data.slice(i * 4, i * 4 + 4), (i * 4 + k) * 4);
        C[(i * 4 + k) * 2] = corners[k * 2]; C[(i * 4 + k) * 2 + 1] = corners[k * 2 + 1];
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('iPos', new THREE.BufferAttribute(P, 3));
    g.setAttribute('iData', new THREE.BufferAttribute(D, 4));
    g.setAttribute('corner', new THREE.BufferAttribute(C, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.instanceCount = n;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uVP: { value: new THREE.Matrix4() }, uVPPrev: { value: new THREE.Matrix4() },
        uRes: { value: new THREE.Vector2(1080, 1920) }, uFocal: { value: 1000 }, uLoop: { value: 0 },
        uMaxPx: { value: 26 }, uGain: { value: 1 }, uTwinkle: { value: 0.35 }, uColor: { value: new THREE.Color(0.92, 0.94, 1.0) },
      },
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.count = g.instanceCount;
  }

  setCameras(camera, prevVP, W, H, loopPhase) {
    const u = this.material.uniforms;
    u.uVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    u.uVPPrev.value.copy(prevVP);
    u.uRes.value.set(W, H);
    u.uFocal.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    u.uLoop.value = loopPhase;
    u.uMaxPx.value = 26 * (H / 1920);
  }
}
