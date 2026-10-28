// Line art for the diagrams: constant-pixel-width ribbons (baked quads, near-plane
// trimmed) with per-segment draw-on timing, and soft round dots. Additive HDR so
// the bloom gives the reference's glowing hairline look.

import * as THREE from 'three';

const LINE_VERT = /* glsl */`
attribute vec3 aA; attribute vec3 aB; attribute vec2 aW; attribute vec4 aC;
uniform vec2 uRes; uniform float uNear; uniform float uTime; uniform float uWidthScale;
varying vec3 vColor; varying float vSide;
void main() {
  float f = clamp((uTime - aW.x) / max(1e-5, aW.y - aW.x), 0.0, 1.0);
  if (f <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 a = modelViewMatrix * vec4(aA, 1.0);
  vec4 b = modelViewMatrix * vec4(mix(aA, aB, f), 1.0);
  if (a.z > -uNear && b.z > -uNear) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (a.z > -uNear) a = mix(a, b, (a.z + uNear) / (a.z - b.z));
  if (b.z > -uNear) b = mix(b, a, (b.z + uNear) / (b.z - a.z));
  vec4 ca = projectionMatrix * a, cb = projectionMatrix * b;
  vec2 d = (cb.xy / cb.w - ca.xy / ca.w) * uRes;
  float l = length(d);
  vec2 dir = l > 1e-5 ? d / l : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool atB = position.x > 0.5;
  vec4 c = atB ? cb : ca;
  float w = aC.w * uWidthScale;
  vec2 offPx = nrm * position.y * w * 0.5 + dir * (atB ? 1.0 : -1.0) * w * 0.35;
  c.xy += offPx / uRes * 2.0 * c.w;
  gl_Position = c;
  vColor = aC.rgb;
  vSide = position.y;
}`;

const LINE_FRAG = /* glsl */`
uniform float uAlpha; uniform vec3 uTint;
varying vec3 vColor; varying float vSide;
void main() {
  float edge = 1.0 - smoothstep(0.5, 1.0, abs(vSide));
  gl_FragColor = vec4(vColor * uTint * uAlpha * (0.45 + 0.55 * edge), 1.0);
}`;

const additive = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation };

export class FatLines {
  // polylines: [{ pts:[Vector3], t0, t1, color:Color, width:px, gain, closed }]
  constructor(polylines, { width = 2, color = new THREE.Color(1, 1, 1), gain = 1.6, depthTest = true } = {}) {
    let nseg = 0;
    for (const pl of polylines) nseg += pl.pts.length - 1 + (pl.closed ? 1 : 0);
    const P = new Float32Array(nseg * 12), A = new Float32Array(nseg * 12), Bv = new Float32Array(nseg * 12);
    const Wt = new Float32Array(nseg * 8), C = new Float32Array(nseg * 16), idx = new Uint32Array(nseg * 6);
    const corner = [0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0];
    let s = 0;
    for (const pl of polylines) {
      const pts = pl.closed ? [...pl.pts, pl.pts[0]] : pl.pts;
      const n = pts.length - 1;
      const t0 = pl.t0 ?? -1e9, t1 = pl.t1 ?? -1e9;
      const col = (pl.color || color).clone().multiplyScalar(pl.gain ?? gain);
      const w = pl.width ?? width;
      // draw-on proportional to arc length
      const cum = [0];
      for (let k = 0; k < n; k++) cum.push(cum[k] + pts[k].distanceTo(pts[k + 1]));
      const L = cum[n] || 1;
      for (let k = 0; k < n; k++, s++) {
        const ta = t0 + (t1 - t0) * (cum[k] / L), tb = t0 + (t1 - t0) * (cum[k + 1] / L);
        for (let v = 0; v < 4; v++) {
          const i = s * 4 + v;
          P.set(corner.slice(v * 3, v * 3 + 3), i * 3);
          A.set([pts[k].x, pts[k].y, pts[k].z], i * 3);
          Bv.set([pts[k + 1].x, pts[k + 1].y, pts[k + 1].z], i * 3);
          Wt.set([ta, Math.max(tb, ta + 1e-4)], i * 2);
          C.set([col.r, col.g, col.b, w], i * 4);
        }
        idx.set([s * 4, s * 4 + 1, s * 4 + 2, s * 4, s * 4 + 2, s * 4 + 3], s * 6);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aA', new THREE.BufferAttribute(A, 3));
    g.setAttribute('aB', new THREE.BufferAttribute(Bv, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(Wt, 2));
    g.setAttribute('aC', new THREE.BufferAttribute(C, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
      uniforms: {
        uRes: { value: new THREE.Vector2(1080, 1920) }, uNear: { value: 0.06 }, uTime: { value: 0 }, uWidthScale: { value: 1 },
        uAlpha: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) },
      },
      depthTest, ...additive,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.segments = nseg;
  }

  set(t, ctx, alpha = 1) {
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uRes.value.set(ctx.W, ctx.H);
    u.uNear.value = ctx.film.camera.near * 1.01;
    u.uWidthScale.value = ctx.H / 1920;
    u.uAlpha.value = alpha;
    this.mesh.visible = alpha > 0.002;
  }
}

const DOT_VERT = /* glsl */`
attribute vec3 aP; attribute vec4 aC; attribute vec2 aT;
uniform vec2 uRes; uniform float uTime; uniform float uScale; uniform float uPop;
varying vec2 vUv; varying vec3 vColor; varying float vA;
void main() {
  float age = uTime - aT.x;
  if (age < 0.0 || (aT.y > 0.0 && uTime > aT.y)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec4 c = projectionMatrix * modelViewMatrix * vec4(aP, 1.0);
  if (c.w < 0.05) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float pop = 1.0 + uPop * 2.2 * exp(-age * 9.0);
  float r = aC.w * uScale * pop;
  c.xy += position.xy * r / uRes * 2.0 * c.w;
  gl_Position = c;
  vUv = position.xy; vColor = aC.rgb; vA = min(1.0, age * 12.0);
}`;

const DOT_FRAG = /* glsl */`
uniform float uAlpha;
varying vec2 vUv; varying vec3 vColor; varying float vA;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 5.0) * (1.0 - r2);
  gl_FragColor = vec4(vColor * a * uAlpha * vA, 1.0);
}`;

export class Dots {
  // dots: [{ p:Vector3, size:px, color:Color, gain, t0, t1 }]
  constructor(dots, { size = 5, color = new THREE.Color(1, 1, 1), gain = 3 } = {}) {
    const n = dots.length;
    const P = new Float32Array(n * 12), AP = new Float32Array(n * 12), C = new Float32Array(n * 16), T = new Float32Array(n * 8);
    const idx = new Uint32Array(n * 6);
    const corner = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
    dots.forEach((d, i) => {
      const col = (d.color || color).clone().multiplyScalar(d.gain ?? gain);
      for (let v = 0; v < 4; v++) {
        const k = i * 4 + v;
        P.set(corner.slice(v * 3, v * 3 + 3), k * 3);
        AP.set([d.p.x, d.p.y, d.p.z], k * 3);
        C.set([col.r, col.g, col.b, d.size ?? size], k * 4);
        T.set([d.t0 ?? -1e9, d.t1 ?? -1], k * 2);
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('aP', new THREE.BufferAttribute(AP, 3));
    g.setAttribute('aC', new THREE.BufferAttribute(C, 4));
    g.setAttribute('aT', new THREE.BufferAttribute(T, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.material = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT, fragmentShader: DOT_FRAG,
      uniforms: { uRes: { value: new THREE.Vector2(1080, 1920) }, uTime: { value: 0 }, uScale: { value: 1 }, uAlpha: { value: 1 }, uPop: { value: 1 } },
      depthTest: true, ...additive,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  set(t, ctx, alpha = 1) {
    const u = this.material.uniforms;
    u.uTime.value = t;
    u.uRes.value.set(ctx.W, ctx.H);
    u.uScale.value = ctx.H / 1920;
    u.uAlpha.value = alpha;
    this.mesh.visible = alpha > 0.002;
  }
}
