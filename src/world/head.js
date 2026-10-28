// The comet head: a small white-hot core inside a tight red halo, billboarded, HDR.
// Its on-screen size is clamped between a pixel floor (still a spark in the full-curve
// pull-back) and a ceiling (never a blob filling the frame in close-ups).

import * as THREE from 'three';

const VERT = /* glsl */`
uniform float uSize; uniform float uMinPx; uniform float uMaxPx; uniform float uFocal;
varying vec2 vP;
void main() {
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float dist = max(0.05, -c.z);
  float px = clamp(uSize * uFocal / dist, uMinPx, uMaxPx);
  c.xy += position.xy * px * dist / uFocal;
  vP = position.xy;
  gl_Position = projectionMatrix * c;
}`;

const FRAG = /* glsl */`
uniform vec3 uHalo; uniform float uCore; uniform float uGlow; uniform float uAlpha;
varying vec2 vP;
void main() {
  float r = length(vP);
  float core = exp(-r * r / 0.012) * uCore;
  float halo = exp(-r * r / 0.07) * 0.9 + exp(-r / 0.22) * 0.18;
  vec3 col = vec3(1.0, 0.82, 0.74) * core + uHalo * halo * uGlow;
  col *= smoothstep(1.0, 0.75, r) * uAlpha;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Head {
  constructor({ color = new THREE.Color(1.0, 0.09, 0.05) } = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uSize: { value: 0.35 }, uMinPx: { value: 22 }, uMaxPx: { value: 52 }, uFocal: { value: 1000 },
        uHalo: { value: color }, uCore: { value: 6 }, uGlow: { value: 1.4 }, uAlpha: { value: 1 },
      },
      transparent: true, depthWrite: false, depthTest: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.light = new THREE.PointLight(color, 0, 9, 1.6);
    this.light.position.set(0, 0, 0);
  }

  // size: world radius; minPx / maxPx: on-screen half-size limits at 1920 px height
  set(p, camera, H, { size = 0.35, glow = 1.4, core = 6, minPx = 22, maxPx = 52, alpha = 1, light = 2 } = {}) {
    this.mesh.position.copy(p);
    this.light.position.copy(p);
    this.light.intensity = light * alpha;
    const u = this.material.uniforms;
    u.uSize.value = size;
    u.uGlow.value = glow;
    u.uCore.value = core;
    u.uAlpha.value = alpha;
    u.uMinPx.value = minPx * (H / 1920);
    u.uMaxPx.value = maxPx * (H / 1920);
    u.uFocal.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.mesh.visible = alpha > 0.001;
  }
}
