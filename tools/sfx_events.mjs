// The sound-effect cue list, computed from the same code that times the picture:
// stone placements, chess plies, ring draws, bond openings, construction strokes,
// the head's travels, the vortex swirl, the blow-up and the barrier hits.
//
//   node tools/sfx_events.mjs        -> data/sfx_events.json   (then tools/build_sfx.py)
import fs from 'node:fs';
import * as THREE from 'three';
import { Curve } from '../src/core/curve.js';
import { Beat } from '../src/core/beat.js';
import { buildScript } from '../src/timeline/script.js';
import { stoneSchedule } from '../src/milestones/alphago.js';
import { plySchedule } from '../src/milestones/deepblue.js';
import { ringTimes } from '../src/milestones/shannon.js';
import { percolationBonds } from '../src/milestones/percolation.js';
import { jacobianTimes } from '../src/milestones/jacobian.js';
import { imoStrokes } from '../src/milestones/imo.js';

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const beat = new Beat(JSON.parse(read('data/beatmap.json')));
const B = (l, k = 0) => beat.t(l, k);
const curve = new Curve();
const ctx = { curve, beat, B, film: { camera: new THREE.PerspectiveCamera() } };
const script = buildScript(ctx);
const ev = script.events;
const T = beat.T, fps = beat.fps;
const out = [];
const push = (e) => out.push({ ...e, t: +e.t.toFixed(5) });

// AlphaGo: 36 stones on sixteenths, then Move 37 on the downbeat
for (const s of stoneSchedule(B, read('data/alphago_leesedol_game2.sgf'))) {
  push({ t: s.t, type: s.n === 37 ? 'move37' : 'stone', color: s.c, pan: (s.x - 9) / 9 * 0.6, n: s.n });
}
// Deep Blue: the last five plies of Game 6, captures included
for (const p of plySchedule(B).shown) push({ t: p.t, type: 'chess', capture: p.capture, san: p.mv.san });
// Shannon: a tick as each ring starts to draw, then the ignition
ringTimes(B, beat.spb).forEach((t, k) => push({ t, type: 'tick', k }));
push({ t: ev.ignition, type: 'bloom' });
// the opening rewind
push({ t: ev.rewind[0], type: 'rewind', dur: ev.rewind[1] - ev.rewind[0] });
// the head's travels: a whoosh shaped by its speed (sampled at 100 Hz)
for (const [t0, t1] of ev.travels) {
  const n = Math.max(2, Math.round((t1 - t0) * 100));
  const speed = Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n;
    return Math.abs(script.headS(t + 0.005) - script.headS(t - 0.005)) / 0.01;
  });
  push({ t: t0, type: 'whoosh', dur: t1 - t0, speed: speed.map((v) => +v.toFixed(2)) });
}
// IMO constructions: a pencil stroke per line
const st = imoStrokes(B);
for (const [t0, t1] of st.y2024.concat(st.y2025)) push({ t: t0, type: 'pencil', dur: t1 - t0 });
// Jacobian: both witness points land on one image point
push({ t: jacobianTimes(B).tM1, type: 'ding' });
// percolation: each bond crackles as it opens; the giant cluster's bonds a touch louder
for (const bd of percolationBonds(B).bonds) push({ t: bd.t0, type: 'crackle', big: bd.rank === 0 });
// Navier–Stokes: the swirl as wind (sampled at 50 Hz over the event and around the loop),
// then the blow-up
const windCurve = (t0, t1) => {
  const n = Math.round((t1 - t0) * 50);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = beat.wrap(t0 + ((t1 - t0) * i) / n);
    const sw = ctx.nsSwirl(t);
    const cam = script.camera(t);
    const d = cam.pos.distanceTo(curve.at(curve.sOfYear(2026 + 251 / 365)).p);
    const near = 1 - Math.min(1, Math.max(0, (d - 4) / 60));
    return [+(sw.vis * near).toFixed(3), +sw.Omega.toFixed(3)];
  });
};
push({ t: B('b33.1', -1), type: 'wind', dur: B('b38.4', 1) - B('b33.1', -1), curve: windCurve(B('b33.1', -1), B('b38.4', 1)) });
push({ t: ev.loopWindow[0], type: 'wind', dur: ev.loopWindow[1] + T - ev.loopWindow[0], curve: windCurve(ev.loopWindow[0], ev.loopWindow[1] + T) });
push({ t: ev.tStar, type: 'boom' });
// 722 manuscripts: paper flicks as the cards launch, ticks as the Lean marks flip
const tBurst = B('b49.1');
for (let i = 0; i < 722; i += 6) push({ t: tBurst + (i / 722) * 1.7, type: 'paper', i });
push({ t: B('b50.1'), type: 'lean' });
// ETH: the head breaks each barrier
ev.ethHits.forEach((t, i) => push({ t, type: 'shatter', i }));

out.sort((a, b) => a.t - b.t);
const counts = {};
for (const e of out) counts[e.type] = (counts[e.type] || 0) + 1;
fs.writeFileSync(new URL('../data/sfx_events.json', import.meta.url), JSON.stringify({ duration: T, fps, events: out }));
console.log(`${out.length} events -> data/sfx_events.json`, counts);
const m37 = out.find((e) => e.type === 'move37');
console.log(`Move 37 at ${m37.t.toFixed(4)} s = frame ${(m37.t * fps).toFixed(2)} (b12.1 = ${B('b12.1').toFixed(4)})`);
