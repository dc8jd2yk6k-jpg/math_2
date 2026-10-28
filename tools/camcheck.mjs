// Camera smoothness check, run in Node against the real cue sheet (no browser).
// For every frame it measures the view direction's angular velocity and
// acceleration, and counts "reversals" (the rotation axis flipping between
// consecutive frames while turning), which is what shake looks like. The loop
// seam is included (frame 2487 -> 0).
//
//   node tools/camcheck.mjs [--max-speed 2.2] [--max-acc 30]
import fs from 'node:fs';
import * as THREE from 'three';
import { Curve } from '../src/core/curve.js';
import { Beat } from '../src/core/beat.js';
import { buildScript } from '../src/timeline/script.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
  return acc;
}, []));
const MAX_SPEED = +(args['max-speed'] ?? 2.2); // rad/s
const MAX_ACC = +(args['max-acc'] ?? 30);      // rad/s^2

const beat = new Beat(JSON.parse(fs.readFileSync(new URL('../data/beatmap.json', import.meta.url))));
const curve = new Curve();
const ctx = { curve, beat, B: (l, k = 0) => beat.t(l, k), film: { camera: new THREE.PerspectiveCamera() } };
const script = buildScript(ctx);
const N = beat.frames, fps = beat.fps;

const dirs = [], ups = [];
for (let i = 0; i < N; i++) {
  const p = script.camera(i / fps);
  dirs.push(p.look.clone().sub(p.pos).normalize());
  ups.push(p.up.clone().normalize());
}
const at = (arr, i) => arr[((i % N) + N) % N];
let worstSpeed = { v: 0 }, worstAcc = { v: 0 }, reversals = [];
const omega = []; // rotation vector per frame step
for (let i = 0; i < N; i++) {
  const a = at(dirs, i), b = at(dirs, i + 1);
  const ang = Math.acos(Math.min(1, a.dot(b)));
  const axis = new THREE.Vector3().crossVectors(a, b);
  if (axis.lengthSq() > 1e-12) axis.normalize();
  // roll: change of up projected around the view axis
  // roll: the up hint orthogonalised against the view direction (what lookAt uses)
  const ortho = (u, d) => u.clone().addScaledVector(d, -u.dot(d)).normalize();
  const ua = ortho(at(ups, i), a), ub = ortho(at(ups, i + 1), b);
  const roll = Math.acos(Math.min(1, Math.max(-1, ua.dot(ub)))) - ang * 0; // includes the turn's own share

  omega.push(axis.multiplyScalar(ang * fps));
  const speed = Math.hypot(ang, roll) * fps;
  if (speed > worstSpeed.v) worstSpeed = { v: speed, i };
}
for (let i = 0; i < N; i++) {
  const w0 = omega[i], w1 = omega[(i + 1) % N];
  const acc = w1.clone().sub(w0).length() * fps;
  if (acc > worstAcc.v) worstAcc = { v: acc, i };
  // shake: the turn reverses direction between frames while actually turning
  if (w0.length() > 0.08 && w1.length() > 0.08 && w0.dot(w1) < -0.3 * w0.length() * w1.length()) reversals.push(i);
}
const fmt = (o) => `${o.v.toFixed(2)} at frame ${o.i} (t=${(o.i / fps).toFixed(2)} s)`;
console.log(`max angular speed  ${fmt(worstSpeed)}  [cap ${MAX_SPEED}]`);
console.log(`max angular accel  ${fmt(worstAcc)}  [cap ${MAX_ACC}]`);
console.log(`direction reversals: ${reversals.length}${reversals.length ? '  frames ' + reversals.slice(0, 20).join(', ') : ''}`);
// list the frames above the caps, grouped into runs
const over = [];
for (let i = 0; i < N; i++) {
  const w0 = omega[i], w1 = omega[(i + 1) % N];
  const acc = w1.clone().sub(w0).length() * fps;
  if (w0.length() > MAX_SPEED || acc > MAX_ACC) over.push(i);
}
const runs = [];
for (const i of over) { const r = runs[runs.length - 1]; if (r && i === r[1] + 1) r[1] = i; else runs.push([i, i]); }
const peak = ([a, b]) => { let m = 0; for (let i = a; i <= b; i++) m = Math.max(m, omega[i].length()); return m; };
console.log(`frames over caps: ${over.length}`);
for (const r of runs.slice(0, 20)) console.log(`  ${(r[0] / fps).toFixed(2)}-${(r[1] / fps).toFixed(2)} s  peak ${peak(r).toFixed(2)} rad/s`);
process.exit(reversals.length ? 1 : 0);
