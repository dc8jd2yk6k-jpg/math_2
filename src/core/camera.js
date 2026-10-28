// Camera language. A shot is a pure function t -> pose; a track blends consecutive
// shots with an eased cross-fade of position / aim / up / fov, so the whole move is
// one continuous take. Beat-driven punches and shake are layered on top.

import * as THREE from 'three';
import { clamp, ease, lerp } from './math.js';

export const pose = (pos, look, up = new THREE.Vector3(0, 1, 0), fov = 50, roll = 0) => ({ pos, look, up, fov, roll });

const _v = new THREE.Vector3();

export function blendPose(a, b, u) {
  if (u <= 0) return a;
  if (u >= 1) return b;
  // swing the eye along an arc around the aim point rather than straight through it
  const pos = new THREE.Vector3().lerpVectors(a.pos, b.pos, u);
  const look = new THREE.Vector3().lerpVectors(a.look, b.look, u);
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
    const cur = S[i];
    const p = cur.fn(t);
    if (i > 0 && t < cur.t0 + cur.blend) {
      const u = cur.e(clamp((t - cur.t0) / cur.blend));
      return blendPose(S[i - 1].fn(t), p, u);
    }
    return p;
  }
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

// small deterministic noise for handheld shake
export function shake(t, amp, seed = 0) {
  const n = (f, o) => Math.sin(t * f + o + seed) * 0.6 + Math.sin(t * f * 2.31 + o * 1.7 + seed) * 0.4;
  return _v.set(n(17.3, 0.1), n(13.1, 2.3), n(11.7, 4.1)).multiplyScalar(amp).clone();
}
