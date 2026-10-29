// The film: one scene, one camera, one clock. evaluate(t) poses everything for a
// time t in [0, T); renderFrame(i) accumulates motion-blurred sub-frames, draws the
// HUD at the frame centre and runs the post pipeline.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Curve } from './core/curve.js';
import { Post } from './core/post.js';
import { Hud } from './core/hud.js';
import { applyPose } from './core/camera.js';
import { Starfield } from './world/starfield.js';
import { Trail } from './world/trail.js';
import { Head } from './world/head.js';
import { createMilestones } from './milestones/index.js';
import { buildScript } from './timeline/script.js';

export class Film {
  constructor({ renderer, W, H, beat, assets, opts = {} }) {
    this.r = renderer; this.W = W; this.H = H; this.beat = beat; this.opts = opts;
    this.T = beat.T; this.fps = beat.fps;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(50, W / H, 0.06, 9000);
    this.hudCamera = this.camera.clone();
    this.prevVP = new THREE.Matrix4();

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.curve = new Curve();
    this.stars = new Starfield(this.curve);
    this.trail = new Trail(this.curve);
    this.head = new Head();
    this.scene.add(this.stars.mesh, this.trail.mesh, this.head.mesh, this.head.light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.06));

    this.ctx = { THREE, curve: this.curve, beat, scene: this.scene, renderer, W, H, envMap: this.envMap, assets, film: this, B: (l, k = 0) => beat.t(l, k) };
    this.milestones = createMilestones(this.ctx);
    for (const m of this.milestones) if (m.group) this.scene.add(m.group);
    this.ctx.milestones = Object.fromEntries(this.milestones.map((m) => [m.id, m]));
    this.script = buildScript(this.ctx);

    this.post = new Post(renderer, W, H, { samples: opts.samples ?? 4 });
    this.hud = new Hud(W, H);
  }

  wrap(t) { return ((t % this.T) + this.T) % this.T; }

  cameraAt(t, cam) {
    const p = this.script.camera(this.wrap(t));
    applyPose(cam, p, this.W / this.H);
    return p;
  }

  evaluate(t) {
    t = this.wrap(t);
    const S = this.script;
    const s = S.headS(t);
    this.cameraAt(t, this.camera);
    const st = S.state(t, s);
    this.state = st;
    if (st.near && st.near !== this.camera.near) {
      this.camera.near = st.near;
      this.camera.far = Math.min(9000, st.near * 2e5);
      this.camera.updateProjectionMatrix();
    }
    const a = this.curve.at(s);
    this.head.set(a.p, this.camera, this.H, st.head);
    this.trail.set(s, this.W, this.H, this.camera.near, st.trailWidth * (this.H / 1920));
    const tu = this.trail.material.uniforms;
    tu.uFade.value = st.trailFade; tu.uDissolve.value = st.trailDissolve; tu.uGain.value = st.trailGain;
    this.trail.mesh.visible = st.trailFade > 0.002;
    this.stars.material.uniforms.uGain.value = st.starGain;
    // during the opening rewind the objects show their end-of-loop state (time t + T),
    // so everything threaded on the line continues across the seam
    const tm = st.milestoneTime ?? t;
    for (const m of this.milestones) m.update(m.ownClock ? t : tm, st);
  }

  // On-screen motion across the shutter, in pixels: how far a point on the line at the
  // head and a point far down the view axis travel between shutter open and close.
  motionPx(t, span) {
    const cam = this.hudCamera;
    const p0 = this.cameraAt(t - span / 2, cam);
    const far = p0.pos.clone().add(p0.look.clone().sub(p0.pos).normalize().multiplyScalar(40));
    const near = this.curve.at(this.script.headS(this.wrap(t))).p.clone();
    const a = [near.clone().project(cam), far.clone().project(cam)];
    this.cameraAt(t + span / 2, cam);
    const b = [near.project(cam), far.project(cam)];
    let m = 0;
    for (let k = 0; k < 2; k++) m = Math.max(m, Math.hypot((b[k].x - a[k].x) * this.W / 2, (b[k].y - a[k].y) * this.H / 2));
    return m;
  }

  renderFrame(i, { subframes = 1, shutter = 0.5, adaptive = false } = {}) {
    const t = i / this.fps;
    const span = shutter / this.fps;
    let N = Math.max(1, subframes | 0);
    // thin lines strobe when copies are far apart: add sub-frames for fast moves. The
    // motion is the max over neighbouring frames, so N changes gradually.
    if (adaptive && N > 1) {
      let m = 0;
      for (const d of [-2, -1, 0, 1, 2]) m = Math.max(m, this.motionPx(t + d / this.fps, span));
      N = Math.min(16, Math.max(N, Math.ceil(m / (5 * (this.H / 1920)))));
      for (const d of [-2, 0, 2]) N = Math.max(N, this.script.minSub(this.wrap(t + d / this.fps)));
    }
    this.lastSubframes = N;
    const cam = this.hudCamera;
    this.post.beginFrame();
    for (let k = 0; k < N; k++) {
      const ts = N === 1 ? t : t + ((k + 0.5) / N - 0.5) * span;
      const tPrev = ts - (N === 1 ? span : span / N);
      this.cameraAt(tPrev, cam);
      this.prevVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      this.evaluate(ts);
      if (N > 1) this.jitter(this.camera, k, N);
      this.stars.setCameras(this.camera, this.prevVP, this.W, this.H, this.wrap(ts) / this.T);
      this.post.addSubframe(this.scene, this.camera, 1 / N);
    }
    // HUD + grading at the frame centre
    this.evaluate(t);
    this.cameraAt(t, cam);
    this.hud.begin();
    this.script.drawHud(this.wrap(t), this.hud, (v) => this.project(v, cam), this.state);
    if (this.opts.debug) this.drawDebug(t);
    this.hud.end();
    const fx = this.state.fx;
    const u = this.post.u;
    u.uBloom.value = fx.bloom; u.uExposure.value = fx.exposure; u.uCA.value = fx.ca;
    u.uFlash.value = fx.flash; u.uVignette.value = fx.vignette;
    u.uFade.value = fx.fade; u.uSaturation.value = fx.saturation ?? 1;
    if (fx.flashColor) u.uFlashColor.value.copy(fx.flashColor);
    this.post.finish(this.hud.texture);
  }

  // Sub-pixel projection jitter per sub-frame (Halton 2,3): accumulation then gives
  // supersampled anti-aliasing together with the motion blur. The N offsets are
  // centred on zero, so changing N between frames never shifts the image.
  jitter(cam, k, N) {
    const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
    let mx = 0, my = 0;
    for (let j = 1; j <= N; j++) { mx += halton(j, 2); my += halton(j, 3); }
    const jx = halton(k + 1, 2) - mx / N, jy = halton(k + 1, 3) - my / N;
    cam.projectionMatrix.elements[8] += (jx * 2) / this.W;
    cam.projectionMatrix.elements[9] += (jy * 2) / this.H;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  project(v, cam) {
    const p = v.clone().project(cam);
    const z = v.clone().applyMatrix4(cam.matrixWorldInverse).z;
    return { x: (p.x * 0.5 + 0.5) * 1080, y: (1 - (p.y * 0.5 + 0.5)) * 1920, visible: z < -cam.near && Math.abs(p.x) < 1.3 && Math.abs(p.y) < 1.3, depth: -z };
  }

  drawDebug(t) {
    const bp = this.beat.beatPos(t);
    const b = this.beat.beats[Math.floor(bp) % this.beat.beats.length];
    this.hud.text(`t ${t.toFixed(2)}  f ${Math.round(t * this.fps)}  b${b.bar}.${b.beat}  acc ${b.accent.toFixed(2)}`, 30, 1880,
      { family: 'JBM', size: 26, align: 'left', color: '#7fffd4', alpha: 0.9 });
  }
}
