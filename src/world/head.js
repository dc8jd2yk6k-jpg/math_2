// The comet head: a white-hot core inside a red halo, billboarded, HDR so the bloom
// does the rest. Its world size keeps a pixel floor so it still reads as a spark in
// the full-curve pull-back.

import * as THREE from 'three';

const VERT = /* glsl */`
uniform float uSize; uniform float uMinPx; uniform float uFocal;
varying vec2 vP;
void main() {
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float dist = max(0.05, -c.z);
  float size = max(uSize, uMinPx * dist / uFocal);
  c.xy += position.xy * size;
  vP = position.xy;
  gl_Position = projectionMatrix * c;
}`;

const FRAG = /* glsl */`
uniform vec3 uHalo; uniform float uCore; uniform float uGlow; uniform float uFlare; uniform float uAlpha;
varying vec2 vP;
void main() {
  float r = length(vP);
  float core = exp(-r * r / 0.0045) * uCore;
  float halo = exp(-r * r / 0.05) * 1.2 + exp(-r / 0.16) * 0.35;
  float flare = exp(-abs(vP.y) / 0.008) * exp(-abs(vP.x) / 0.55) * uFlare;
  vec3 col = vec3(1.0, 0.86, 0.78) * core + uHalo * (halo * uGlow + flare);
  col *= smoothstep(1.0, 0.7, r) * uAlpha;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Head {
  constructor({ color = new THREE.Color(1.0, 0.09, 0.05) } = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uSize: { value: 2.2 }, uMinPx: { value: 26 }, uFocal: { value: 1000 },
        uHalo: { value: color }, uCore: { value: 9 }, uGlow: { value: 2.4 }, uFlare: { value: 0.6 }, uAlpha: { value: 1 },
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

  set(p, camera, H, { size = 2.2, glow = 2.4, core = 9, minPx = 26, alpha = 1, light = 6 } = {}) {
    this.mesh.position.copy(p);
    this.light.position.copy(p);
    this.light.intensity = light * alpha;
    const u = this.material.uniforms;
    u.uSize.value = size;
    u.uGlow.value = glow;
    u.uCore.value = core;
    u.uAlpha.value = alpha;
    u.uMinPx.value = minPx * (H / 1920);
    u.uFocal.value = H / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    this.mesh.visible = alpha > 0.001;
  }
}
