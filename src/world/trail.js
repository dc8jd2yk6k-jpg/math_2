// The trail: the curve drawn behind the head as a constant-pixel-width ribbon.
// One instanced quad per arc-length sample; segments are trimmed against the near
// plane in view space (so the camera can sit on the line and look along it), and
// fragments ahead of the head are discarded. Colour runs hot red at the head ->
// warm white -> cool grey with distance behind it, like the reference.

import * as THREE from 'three';

const VERT = /* glsl */`
attribute vec3 iA; attribute vec3 iB; attribute vec2 iS;
uniform vec2 uRes; uniform float uWidth; uniform float uHeadS; uniform float uNear;
varying float vS; varying float vSide;
void main() {
  vec4 a = modelViewMatrix * vec4(iA, 1.0);
  vec4 b = modelViewMatrix * vec4(iB, 1.0);
  float sA = iS.x, sB = iS.y;
  if (min(sA, sB) > uHeadS + 0.05 || (a.z > -uNear && b.z > -uNear)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > -uNear) { float f = (a.z + uNear) / (a.z - b.z); a = mix(a, b, f); sA = mix(sA, sB, f); }
  if (b.z > -uNear) { float f = (b.z + uNear) / (b.z - a.z); b = mix(b, a, f); sB = mix(sB, sA, f); }
  vec4 ca = projectionMatrix * a, cb = projectionMatrix * b;
  vec2 na = ca.xy / ca.w, nb = cb.xy / cb.w;
  vec2 d = (nb - na) * uRes;
  float l = length(d);
  vec2 dir = l > 1e-5 ? d / l : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool atB = position.x > 0.5;
  vec4 c = atB ? cb : ca;
  float w = uWidth;
  vec2 offPx = nrm * position.y * w * 0.5 + dir * (atB ? 1.0 : -1.0) * w * 0.5;
  c.xy += offPx / uRes * 2.0 * c.w;
  gl_Position = c;
  vS = atB ? sB : sA;
  vSide = position.y;
}`;

const FRAG = /* glsl */`
uniform float uHeadS; uniform float uFade; uniform float uDissolve; uniform float uHotLen;
uniform vec3 uHot; uniform vec3 uWarm; uniform vec3 uCool; uniform float uGain;
varying float vS; varying float vSide;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
void main() {
  if (vS > uHeadS) discard;
  float age = uHeadS - vS;
  if (uDissolve > 0.0 && hash(floor(vS * 3.0)) < uDissolve) discard;
  vec3 col = mix(uHot, uWarm, smoothstep(0.0, uHotLen, age));
  col = mix(col, uCool, smoothstep(uHotLen * 1.5, uHotLen * 14.0, age));
  float inten = mix(4.5, 1.15, smoothstep(0.0, uHotLen * 1.2, age));
  float edge = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  gl_FragColor = vec4(col * inten * uGain * uFade * (0.55 + 0.45 * edge), 1.0);
}`;

export class Trail {
  constructor(curve) {
    const M = curve.count - 1;
    const A = new Float32Array(M * 3), B = new Float32Array(M * 3), S = new Float32Array(M * 2);
    for (let i = 0; i < M; i++) {
      A.set(curve.pos.subarray(i * 3, i * 3 + 3), i * 3);
      B.set(curve.pos.subarray(i * 3 + 3, i * 3 + 6), i * 3);
      S[i * 2] = i * curve.ds; S[i * 2 + 1] = (i + 1) * curve.ds;
    }
    // Non-instanced: four baked corners per segment (SwiftShader instancing is slow).
    const corner = [0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0];
    const P = new Float32Array(M * 12), A4 = new Float32Array(M * 12), B4 = new Float32Array(M * 12), S4 = new Float32Array(M * 8);
    const idx = new Uint32Array(M * 6);
    for (let i = 0; i < M; i++) {
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        P.set(corner.slice(k * 3, k * 3 + 3), v * 3);
        A4.set(A.subarray(i * 3, i * 3 + 3), v * 3);
        B4.set(B.subarray(i * 3, i * 3 + 3), v * 3);
        S4[v * 2] = S[i * 2]; S4[v * 2 + 1] = S[i * 2 + 1];
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('iA', new THREE.BufferAttribute(A4, 3));
    g.setAttribute('iB', new THREE.BufferAttribute(B4, 3));
    g.setAttribute('iS', new THREE.BufferAttribute(S4, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.segments = M;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uRes: { value: new THREE.Vector2(1080, 1920) }, uWidth: { value: 2.4 }, uHeadS: { value: 0 }, uNear: { value: 0.06 },
        uFade: { value: 1 }, uDissolve: { value: 0 }, uHotLen: { value: 9 }, uGain: { value: 1 },
        uHot: { value: new THREE.Color(1.0, 0.07, 0.04) }, uWarm: { value: new THREE.Color(1.0, 0.72, 0.62) },
        uCool: { value: new THREE.Color(0.78, 0.8, 0.86) },
      },
      // additive like the rest of the line art: a faded trail only dims, it never
      // turns into a dark line occluding whatever glows behind it
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.ds = curve.ds;
  }

  set(headS, W, H, near, widthPx) {
    const u = this.material.uniforms;
    u.uHeadS.value = headS;
    u.uRes.value.set(W, H);
    u.uNear.value = near * 1.01;
    u.uWidth.value = widthPx;
    // draw only the segments behind the head
    this.mesh.geometry.setDrawRange(0, Math.min(this.segments, Math.ceil(headS / this.ds) + 2) * 6);
  }
}
