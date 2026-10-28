// 2026.09.08 — OpenAI: finite-time singularity for 3D incompressible Navier–Stokes,
// "a vortex that spirals inward and gets increasingly elongated, like spaghetti".
//
// This vortex is also the world the film loops through. Navier–Stokes is invariant
// under u(x,t) -> λ u(λx, λ²t): zooming in by λ is running time λ² faster. The
// particle field is built to share that symmetry. Radii are log-uniform, so every
// scale holds the same number of particles. The axial extent is proportional to the
// radius, giving an elongated spindle around the singular point. The arms are
// logarithmic spirals, which look the same at every zoom. A dive into the core
// therefore keeps finding the same picture: a bright eye, spiral streaks, the line
// through the middle.
//
// The swirl is ω(r) ∝ 1/r² (time ~ length²), seen at the viewer's scale. Phases are
// integrated once over the whole loop per log-radius bin, then closed to whole
// turns while the vortex is off screen, so the seam is exact.

import * as THREE from 'three';
import { base } from './common.js';
import { clamp, mulberry32, TAU } from '../core/math.js';

const K = 48;               // log-radius bins for the swirl phase
const RMIN = 0.004, RMAX = 6;
const LNR = Math.log(RMAX / RMIN);
const ELONG = 3.2;          // axial half-extent / radius

const VERT = /* glsl */`
attribute vec4 aP; // u (log-radius 0..1), theta0, zf (-1..1), seed
uniform float uPhase[${K}];
uniform float uC; uniform float uBurst; uniform float uPx; uniform float uFocal; uniform float uLv;
varying vec3 vCol; varying float vB;
float phaseAt(float u) {
  float x = clamp(u, 0.0, 1.0) * ${K - 1}.0;
  int i = int(min(floor(x), ${K - 2}.0));
  return mix(uPhase[i], uPhase[i + 1], x - float(i));
}
void main() {
  float u = aP.x, sd = aP.w;
  float r0 = ${RMIN.toFixed(4)} * exp(u * ${LNR.toFixed(5)});
  float r = r0 * uC * (1.0 + uBurst * (0.6 + 1.4 * sd));
  // self-similar inside, an elongated ellipsoid outside: |z| <= ZMAX * sqrt(1 - (r0/RMAX)^2)
  float zmax = ${(ELONG * RMAX * 1.1).toFixed(2)} * sqrt(max(0.0, 1.0 - (r0 / ${RMAX.toFixed(1)}) * (r0 / ${RMAX.toFixed(1)})));
  float z0 = clamp(aP.z * ${ELONG.toFixed(2)} * r0, -zmax, zmax);
  float z = z0 * uC * (0.55 + 0.45 / max(uC, 0.05)) * (1.0 + uBurst * 0.5);
  float th = aP.y + phaseAt(u);
  vec3 p = vec3(z, r * cos(th), r * sin(th));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 c = projectionMatrix * mv;
  float dist = max(1e-4, -mv.z);
  float rad = 0.014 * r * uFocal / dist;     // world size proportional to radius: scale-free
  float b = 0.55 + 0.9 * sd;
  if (rad < 0.7) { b *= (rad / 0.7) * (rad / 0.7); rad = 0.7; }
  rad = min(rad, 5.0 * uPx);
  // colour by scale relative to the viewer: eye white-hot, near shells cyan, far shells deep blue
  float s = log(r / max(uLv, 1e-4));
  vec3 deep = vec3(0.16, 0.32, 1.0), mid = vec3(0.45, 0.85, 1.0), hot = vec3(1.0, 0.95, 0.9);
  vCol = s < -1.2 ? mix(hot, mid, smoothstep(-3.0, -1.2, s)) : mix(mid, deep, smoothstep(-0.6, 1.8, s));
  vB = b * (1.0 + 0.8 * smoothstep(-1.0, -4.0, s));
  gl_PointSize = rad * 2.0;
  gl_Position = c;
}`;

const FRAG = /* glsl */`
uniform float uAlpha;
varying vec3 vCol; varying float vB;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = exp(-dot(d, d) * 16.0);
  gl_FragColor = vec4(vCol * vB * a * uAlpha, 1.0);
}`;

// screen-space haze: when the camera is inside the vortex, the fluid itself glows
const HAZE_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;
const HAZE_FRAG = /* glsl */`
uniform vec2 uEye; uniform float uAmt; uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - uEye) * vec2(uAspect, 1.0);
  float r2 = dot(d, d);
  vec3 col = vec3(0.006, 0.019, 0.062) * (0.6 + 0.4 * vUv.y) + vec3(0.02, 0.05, 0.15) * exp(-r2 * 3.0);
  gl_FragColor = vec4(col * uAmt, 1.0);
}`;

export function navierstokes(ctx) {
  const m = base(ctx, 'navierstokes');
  const rng = mulberry32(908);
  const N = 160000;
  const data = new Float32Array(N * 4);
  const ARMS = 5, TWIST = 1.15; // logarithmic spiral arms: theta = arm + TWIST * ln r
  for (let i = 0; i < N; i++) {
    const u = rng();
    const lnr = u * LNR;
    let th;
    if (rng() < 0.55) th = (Math.floor(rng() * ARMS) / ARMS) * TAU + TWIST * lnr + (rng() - 0.5) * 0.35;
    else th = rng() * TAU;
    // heavy-tailed along the axis: the eye is a tunnel of rings converging on the core
    const zf = Math.sign(rng() - 0.5) * Math.min(5, -0.42 * Math.log(Math.max(1e-6, rng())));
    data.set([u, th, zf, rng()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  g.setAttribute('aP', new THREE.BufferAttribute(data, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: {
      uPhase: { value: new Float32Array(K) }, uC: { value: 1 }, uBurst: { value: 0 }, uPx: { value: 1 }, uFocal: { value: 1000 },
      uLv: { value: 4 }, uAlpha: { value: 1 },
    },
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const cloud = new THREE.Points(g, mat);
  cloud.frustumCulled = false;
  m.group.add(cloud);

  const hazeMat = new THREE.ShaderMaterial({
    vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG,
    uniforms: { uEye: { value: new THREE.Vector2(0.5, 0.5) }, uAmt: { value: 0 }, uAspect: { value: ctx.W / ctx.H } },
    depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hazeMat);
  haze.frustumCulled = false;
  haze.renderOrder = -20;
  ctx.scene.add(haze);

  // ---- swirl phase table, built on first use (the script supplies the swirl schedule)
  let table = null;
  const DT = 1 / 480;
  const binR = Array.from({ length: K }, (_, k) => RMIN * Math.exp((k / (K - 1)) * LNR));
  const build = () => {
    const T = ctx.beat.T;
    const n = Math.ceil(T / DT) + 1;
    const ph = new Float32Array(n * K);
    const acc = new Float64Array(K);
    for (let j = 0; j < n; j++) {
      const t = Math.min(T, j * DT);
      const sw = ctx.nsSwirl(t);
      for (let k = 0; k < K; k++) {
        const r = binR[k] * sw.C;
        const L2 = sw.L * sw.L;
        const w = sw.Omega * L2 / (r * r + L2) + 0.22 * 2.25 / (r * r + 2.25) + 0.04;
        if (j > 0) acc[k] += w * DT;
        ph[j * K + k] = acc[k];
      }
    }
    // close every bin to whole turns over [c0, c1], when the vortex is off screen
    const [c0, c1] = ctx.nsSwirlClose;
    for (let k = 0; k < K; k++) {
      const total = ph[(n - 1) * K + k];
      let d = total % TAU; if (d > Math.PI) d -= TAU;
      for (let j = 0; j < n; j++) {
        const t = j * DT;
        ph[j * K + k] -= d * clamp((t - c0) / (c1 - c0));
      }
    }
    table = { ph, n };
  };
  m.phaseAt = (t, out) => {
    if (!table) build();
    const x = clamp(t / DT, 0, table.n - 1.000001), j = Math.floor(x), f = x - j;
    for (let k = 0; k < K; k++) out[k] = table.ph[j * K + k] * (1 - f) + table.ph[(j + 1) * K + k] * f;
    return out;
  };

  const tmp = new THREE.Vector3();
  m.update = (t, st) => {
    const life = m.alive(st, 40, 25, false);
    const sw = ctx.nsSwirl(ctx.beat.wrap(t));
    const vis = sw.vis * life;
    cloud.visible = vis > 0.001;
    const u = mat.uniforms;
    if (cloud.visible) {
      m.phaseAt(ctx.beat.wrap(t), u.uPhase.value);
      u.uC.value = sw.C;
      u.uBurst.value = sw.burst;
      u.uLv.value = sw.L;
      u.uPx.value = ctx.H / 1920;
      u.uFocal.value = ctx.H / (2 * Math.tan(THREE.MathUtils.degToRad(ctx.film.camera.fov) / 2));
      u.uAlpha.value = vis * (1 + sw.flash);
    }
    // haze from the camera's distance to the singular point (scale-free once inside)
    const cam = ctx.film.camera;
    const D = cam.position.distanceTo(m.frame.p);
    const R = RMAX * sw.C;
    const inside = 1 - clamp((D - 0.5 * R) / (1.6 * R));
    hazeMat.uniforms.uAmt.value = inside * inside * (3 - 2 * inside) * vis;
    haze.visible = hazeMat.uniforms.uAmt.value > 0.001;
    if (haze.visible) {
      tmp.copy(m.frame.p).project(cam);
      hazeMat.uniforms.uEye.value.set(tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5);
      if (tmp.z > 1) hazeMat.uniforms.uEye.value.set(0.5, 1.6);
    }
  };

  m.labels = (t, hud) => {
    if (t < m.tIn - 0.2 || t > m.tOut) return;
    const B = ctx.B;
    const tStar = B('b37.1');
    const fade = 1 - clamp((t - (m.tOut - 0.4)) / 0.35);
    hud.tex(ctx.assets.tex.ns, 540, 596, 34, { alpha: fade * clamp((t - m.tIn - 0.3) / 0.3), reveal: clamp((t - m.tIn - 0.3) / 1.6) });
    hud.tex(ctx.assets.tex.ns_scale, 540, 1420, 46, { alpha: fade * clamp((t - B('b35.1')) / 0.3) * (1 - clamp((t - tStar + 0.4) / 0.3)), reveal: clamp((t - B('b35.1')) / 0.5) });
    hud.tex(ctx.assets.tex.ns_blow, 540, 1420, 46, { alpha: fade * clamp((t - tStar) / 0.2), reveal: clamp((t - tStar) / 0.4) });
    if (t > m.tIn + 1.5) hud.text('10,000 agents · 88 hours · Lean formalization', 540, 1492, { size: 25, weight: 500, alpha: fade * 0.75 * clamp((t - B('b38.1')) / 0.4) });
  };
  return m;
}
