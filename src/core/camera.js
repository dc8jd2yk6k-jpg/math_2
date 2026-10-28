// Camera language. A shot is a pure function t -> pose; a track blends consecutive
// shots with an eased cross-fade of position / aim / up / fov, so the whole move is
// one continuous take. No shake, no punches: a steadicam filter smooths whatever is
// left of the corners between shots.

import * as THREE from 'three';
import { clamp, ease, lerp } from './math.js';

export const pose = (pos, look, up = new THREE.Vector3(0, 1, 0), fov = 50, roll = 0) => ({ pos, look, up, fov, roll });

export function blendPose(a, b, u) {
  if (u <= 0) return a;
  if (u >= 1) return b;
  // swing the eye along an arc around the (moving) aim point rather than straight
  // through it: slerp the offset direction, interpolate its length in log space
  const look = new THREE.Vector3().lerpVectors(a.look, b.look, u);
  const oa = a.pos.clone().sub(a.look), ob = b.pos.clone().sub(b.look);
  const la = Math.max(1e-6, oa.length()), lb = Math.max(1e-6, ob.length());
  oa.divideScalar(la); ob.divideScalar(lb);
  const dot = clamp(oa.dot(ob), -1, 1), om = Math.acos(dot);
  let dir;
  if (om < 1e-4) dir = oa.clone().lerp(ob, u).normalize();
  else if (om > Math.PI - 1e-3) dir = oa.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * u);
  else {
    const so = Math.sin(om);
    dir = oa.clone().multiplyScalar(Math.sin((1 - u) * om) / so).addScaledVector(ob, Math.sin(u * om) / so);
  }
  const pos = look.clone().addScaledVector(dir, Math.exp(lerp(Math.log(la), Math.log(lb), u)));
  const up = new THREE.Vector3().lerpVectors(a.up, b.up, u);
  if (up.lengthSq() < 1e-6) up.set(0, 1, 0);
  return { pos, look, up: up.normalize(), fov: lerp(a.fov, b.fov, u), roll: lerp(a.roll, b.roll, u) };
}

// Pose in the moving frame of the curve at the head: offset = (along T, along N, along B).
export function follow(curve, s, { back = 8, up = 2.5, side = 5, lookAhead = 3, lookUp = 0, fov = 50, roll = 0, upMode = 'world', orbit = 0 } = {}) {
  const a = curve.at(s);
  const c = Math.cos(orbit), sn = Math.sin(orbit);
  // orbit rotates the (up, side) offset around the tangent
  const oN = up * c - side * sn, oB = up * sn + side * c;
  const pos = a.p.clone().addScaledVector(a.T, -back).addScaledVector(a.N, oN).addScaledVector(a.B, oB);
  const look = a.p.clone().addScaledVector(a.T, lookAhead).addScaledVector(a.N, lookUp);
  const upv = upMode === 'curve' ? a.N.clone() : new THREE.Vector3(0, 1, 0);
  return { pos, look, up: upv, fov, roll };
}

export function orbit(center, { radius = 12, az = 0, el = 0.3, fov = 45, roll = 0, up = new THREE.Vector3(0, 1, 0), frame = null, look = null } = {}) {
  // frame: optional {T, N, B} basis; az around N (frame) or world Y
  const ce = Math.cos(el), se = Math.sin(el);
  const local = new THREE.Vector3(Math.cos(az) * ce, se, Math.sin(az) * ce).multiplyScalar(radius);
  let off = local;
  if (frame) off = frame.T.clone().multiplyScalar(local.x).addScaledVector(frame.N, local.y).addScaledVector(frame.B, local.z);
  return { pos: center.clone().add(off), look: (look || center).clone(), up: frame ? frame.N.clone() : up.clone(), fov, roll };
}

export class Track {
  constructor() { this.shots = []; }
  // shot active from t0; blends in from the previous shot over `blend` seconds
  add(t0, fn, { blend = 0.8, e = ease.inOutCubic } = {}) {
    this.shots.push({ t0, fn, blend, e });
    this.shots.sort((x, y) => x.t0 - y.t0);
    return this;
  }
  at(t) {
    const S = this.shots;
    let i = 0;
    while (i + 1 < S.length && S[i + 1].t0 <= t) i++;
    return this.poseOf(i, t);
  }
  // shot i at time t including its own blend in from i-1 (recursively, so a shot that
  // starts while the previous one is still blending in does not pop)
  poseOf(i, t) {
    const cur = this.shots[i];
    const p = cur.fn(t);
    if (i > 0 && t < cur.t0 + cur.blend) return blendPose(this.poseOf(i - 1, t), p, cur.e(clamp((t - cur.t0) / cur.blend)));
    return p;
  }
}

// Steadicam: Gaussian-weighted average of a pose function over [t - 2.5 sigma, t + 2.5 sigma].
// sigma(t) may vary (0 = pass-through); time is wrapped so the filter runs across the seam.
export function steady(fn, { sigma = () => 0.12, taps = 9, wrap = (t) => t } = {}) {
  return (t) => {
    const sg = sigma(t);
    if (sg <= 1e-4) return fn(wrap(t));
    const pos = new THREE.Vector3(), look = new THREE.Vector3(), up = new THREE.Vector3();
    let fov = 0, roll = 0, W = 0;
    for (let k = 0; k < taps; k++) {
      const x = (k / (taps - 1)) * 2 - 1; // -1 .. 1
      const w = Math.exp(-0.5 * (x * 2.5) * (x * 2.5));
      const p = fn(wrap(t + x * 2.5 * sg));
      pos.addScaledVector(p.pos, w); look.addScaledVector(p.look, w); up.addScaledVector(p.up, w);
      fov += p.fov * w; roll += (p.roll || 0) * w; W += w;
    }
    pos.multiplyScalar(1 / W); look.multiplyScalar(1 / W);
    if (up.lengthSq() < 1e-8) up.set(0, 1, 0);
    return { pos, look, up: up.normalize(), fov: fov / W, roll: roll / W };
  };
}

export function applyPose(camera, p, aspect) {
  camera.position.copy(p.pos);
  camera.up.copy(p.up);
  camera.lookAt(p.look);
  if (p.roll) camera.rotateZ(p.roll);
  camera.fov = p.fov;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
