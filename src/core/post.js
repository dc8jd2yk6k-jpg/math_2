// HDR pipeline: 4x MSAA half-float scene -> temporal accumulation (real motion blur)
// -> physically based mip-chain bloom (13-tap down / tent up, Jimenez 2014)
// -> composite (chromatic aberration, glitch, flash, ACES, vignette, HUD, dither).

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const quad = (frag, uniforms, extra = {}) => new FullScreenQuad(new THREE.ShaderMaterial({
  vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra,
}));

const DOWN = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uPrefilter; uniform float uThreshold; uniform float uKnee;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 c) { return c / (1.0 + luma(c) * 0.25); }
void main() {
  vec3 a = tap(vec2(-2, 2)), b = tap(vec2(0, 2)), c = tap(vec2(2, 2));
  vec3 d = tap(vec2(-2, 0)), e = tap(vec2(0, 0)), f = tap(vec2(2, 0));
  vec3 g = tap(vec2(-2, -2)), h = tap(vec2(0, -2)), i = tap(vec2(2, -2));
  vec3 j = tap(vec2(-1, 1)), k = tap(vec2(1, 1)), l = tap(vec2(-1, -1)), m = tap(vec2(1, -1));
  vec3 col;
  if (uPrefilter > 0.5) {
    vec3 g0 = karis((a + b + d + e) * 0.25), g1 = karis((b + c + e + f) * 0.25);
    vec3 g2 = karis((d + e + g + h) * 0.25), g3 = karis((e + f + h + i) * 0.25), g4 = karis((j + k + l + m) * 0.25);
    col = g4 * 0.5 + (g0 + g1 + g2 + g3) * 0.125;
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-5);
    col *= max(soft, br - uThreshold) / max(br, 1e-5);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const UP = /* glsl */`
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius; uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 r = uTexel * uRadius;
  vec3 s = texture2D(tSrc, vUv + vec2(-r.x, r.y)).rgb + texture2D(tSrc, vUv + vec2(0.0, r.y)).rgb * 2.0 + texture2D(tSrc, vUv + r).rgb
         + texture2D(tSrc, vUv + vec2(-r.x, 0.0)).rgb * 2.0 + texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv + vec2(r.x, 0.0)).rgb * 2.0
         + texture2D(tSrc, vUv - r).rgb + texture2D(tSrc, vUv + vec2(0.0, -r.y)).rgb * 2.0 + texture2D(tSrc, vUv + vec2(r.x, -r.y)).rgb;
  gl_FragColor = vec4(s / 16.0 * uWeight, 1.0);
}`;

const ACCUM = /* glsl */`
uniform sampler2D tSrc; uniform float uWeight; varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`;

const COMPOSITE = /* glsl */`
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tHud;
uniform vec2 uRes; uniform float uBloom; uniform float uExposure; uniform float uCA; uniform float uGlitch;
uniform float uSeed; uniform float uFlash; uniform vec3 uFlashColor; uniform float uVignette; uniform float uFade;
uniform float uHudGlitch; uniform float uSaturation; uniform float uScrim;
varying vec2 vUv;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 uv = vUv;
  vec2 hudUv = vUv;
  if (uGlitch > 0.001) {
    float rows = 28.0 + 30.0 * hash(uSeed * 3.1);
    float row = floor(uv.y * rows);
    float r = hash(row * 1.7 + uSeed * 13.3);
    if (r < uGlitch * 0.55) {
      float sh = (hash(row * 9.13 + uSeed) - 0.5) * 0.12 * uGlitch;
      uv.x += sh; hudUv.x += sh * uHudGlitch;
    }
  }
  vec2 d = uv - 0.5;
  float ca = uCA + uGlitch * 0.012;
  vec2 off = d * ca * (0.4 + dot(d, d) * 2.5);
  vec3 col;
  col.r = texture2D(tScene, uv - off).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv + off).b;
  vec3 bl;
  bl.r = texture2D(tBloom, uv - off * 1.5).r;
  bl.g = texture2D(tBloom, uv).g;
  bl.b = texture2D(tBloom, uv + off * 1.5).b;
  col += bl * uBloom;
  col = col * uExposure + uFlash * uFlashColor;
  col = aces(col);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSaturation);
  float v = smoothstep(1.25, 0.25, length(d * vec2(1.0, 0.82)) * 1.35);
  col *= mix(1.0, v, uVignette);
  col = toSRGB(col);
  col *= 1.0 - uScrim * smoothstep(0.62, 0.92, vUv.y) * (1.0 - smoothstep(0.985, 1.0, vUv.y) * 0.3);
  vec4 h = texture2D(tHud, hudUv);
  if (uGlitch > 0.001 && uHudGlitch > 0.0) {
    float hr = texture2D(tHud, hudUv + vec2(0.004 * uGlitch, 0.0)).a;
    float hb = texture2D(tHud, hudUv - vec2(0.004 * uGlitch, 0.0)).a;
    h.rgb += vec3(hr - h.a, 0.0, hb - h.a) * 0.6 * uHudGlitch;
  }
  col = h.rgb + col * (1.0 - h.a);
  col *= uFade;
  col += (ign(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Post {
  constructor(renderer, W, H, { samples = 4, mips = 6 } = {}) {
    this.r = renderer;
    this.W = W; this.H = H;
    const hf = { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { ...hf, depthBuffer: true, samples });
    this.accumRT = new THREE.WebGLRenderTarget(W, H, hf);
    this.mipRT = [];
    let w = W, h = H;
    for (let i = 0; i < mips; i++) {
      w = Math.max(1, Math.round(w / 2)); h = Math.max(1, Math.round(h / 2));
      this.mipRT.push(new THREE.WebGLRenderTarget(w, h, hf));
    }
    this.accum = quad(ACCUM, { tSrc: { value: null }, uWeight: { value: 1 } },
      { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true });
    this.down = quad(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrefilter: { value: 0 }, uThreshold: { value: 0.85 }, uKnee: { value: 0.6 } });
    this.up = quad(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uWeight: { value: 1 } },
      { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation, transparent: true });
    this.hudTex = null;
    this.composite = quad(COMPOSITE, {
      tScene: { value: this.accumRT.texture }, tBloom: { value: this.mipRT[0].texture }, tHud: { value: null },
      uRes: { value: new THREE.Vector2(W, H) }, uBloom: { value: 0.9 }, uExposure: { value: 1 }, uCA: { value: 0.002 },
      uGlitch: { value: 0 }, uSeed: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color(1, 0.85, 0.8) },
      uVignette: { value: 0.55 }, uFade: { value: 1 }, uHudGlitch: { value: 1 }, uSaturation: { value: 1 }, uScrim: { value: 0.38 },
    });
    this.u = this.composite.material.uniforms;
  }

  beginFrame() {
    this.r.setRenderTarget(this.accumRT);
    this.r.setClearColor(0x000000, 1);
    this.r.clear(true, false, false);
  }

  // render one subframe of the scene and add it into the accumulator with weight w
  addSubframe(scene, camera, w) {
    this.r.setRenderTarget(this.sceneRT);
    this.r.setClearColor(0x000000, 1);
    this.r.clear(true, true, false);
    this.r.render(scene, camera);
    this.accum.material.uniforms.tSrc.value = this.sceneRT.texture;
    this.accum.material.uniforms.uWeight.value = w;
    this.r.setRenderTarget(this.accumRT);
    this.accum.render(this.r);
  }

  bloom() {
    let src = this.accumRT.texture, sw = this.W, sh = this.H;
    for (let i = 0; i < this.mipRT.length; i++) {
      const m = this.down.material.uniforms;
      m.tSrc.value = src; m.uTexel.value.set(1 / sw, 1 / sh); m.uPrefilter.value = i === 0 ? 1 : 0;
      this.r.setRenderTarget(this.mipRT[i]);
      this.down.render(this.r);
      src = this.mipRT[i].texture; sw = this.mipRT[i].width; sh = this.mipRT[i].height;
    }
    for (let i = this.mipRT.length - 1; i > 0; i--) {
      const m = this.up.material.uniforms;
      m.tSrc.value = this.mipRT[i].texture;
      m.uTexel.value.set(1 / this.mipRT[i].width, 1 / this.mipRT[i].height);
      m.uWeight.value = 1.0;
      this.r.setRenderTarget(this.mipRT[i - 1]);
      this.up.render(this.r);
    }
  }

  finish(hudTexture) {
    this.bloom();
    this.u.tHud.value = hudTexture;
    this.r.setRenderTarget(null);
    this.composite.render(this.r);
  }
}
