// 2016 — AlphaGo vs Lee Sedol, Game 2 (record: data/alphago_leesedol_game2.sgf).
// Moves 1-36 fall on sixteenth notes; Move 37, AlphaGo's fifth-line shoulder hit
// that its own policy network rated ~1 in 10,000 for a human, lands on a downbeat,
// followed by Monte-Carlo tree-search rollouts arcing across the board.

import * as THREE from 'three';
import { base } from './common.js';
import { FatLines } from '../core/lines.js';
import { clamp, ease, mulberry32, TAU } from '../core/math.js';

const SP = 0.36, LIFT = 0.62;

function goTexture() {
  const N = 2048, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const rng = mulberry32(19);
  const grd = g.createLinearGradient(0, 0, N, N);
  grd.addColorStop(0, '#d8b06a'); grd.addColorStop(1, '#c99a55');
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 260; i++) { // kaya grain
    g.strokeStyle = `rgba(${rng() < 0.5 ? '120,80,30' : '250,220,160'},${0.05 + rng() * 0.06})`;
    g.lineWidth = 1 + rng() * 4;
    const y = rng() * N;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= N; x += 64) g.lineTo(x, y + Math.sin(x * 0.004 + i) * 10);
    g.stroke();
  }
  const m = N * 0.05, s = (N - 2 * m) / 18;
  g.strokeStyle = 'rgba(25,15,5,0.9)'; g.lineWidth = 3.2;
  for (let i = 0; i < 19; i++) {
    g.beginPath(); g.moveTo(m, m + i * s); g.lineTo(N - m, m + i * s); g.stroke();
    g.beginPath(); g.moveTo(m + i * s, m); g.lineTo(m + i * s, N - m); g.stroke();
  }
  g.fillStyle = 'rgba(25,15,5,0.95)';
  for (const a of [3, 9, 15]) for (const b of [3, 9, 15]) { g.beginPath(); g.arc(m + a * s, m + b * s, 9, 0, TAU); g.fill(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, frac: (N - 2 * m) / N };
}

// Moves 1-37 with their placement times (also read by tools/sfx_events.mjs, so the
// stone sounds land on the very frames the stones do).
export function stoneSchedule(B, sgf) {
  const moves = [...sgf.matchAll(/;([BW])\[([a-s]{2})\]/g)].map((x) => ({ c: x[1], x: x[2].charCodeAt(0) - 97, y: x[2].charCodeAt(1) - 97 }));
  const t37 = B('b12.1');
  const tA = B('b9.4'), tB = t37 - 0.22;
  return moves.slice(0, 37).map((mv, i) => ({ ...mv, n: i + 1, t: i < 36 ? tA + ((tB - tA) * i) / 35 : t37 }));
}

export function alphago(ctx) {
  const m = base(ctx, 'alphago');
  const B = ctx.B;
  const first = stoneSchedule(B, ctx.assets.sgf);
  const pos = (mv, h = 0) => new THREE.Vector3((9 - mv.y) * SP, h, (mv.x - 9) * SP);

  const board = new THREE.Group();
  board.position.set(0, -LIFT, 0);
  m.group.add(board);
  const { tex, frac } = goTexture();
  const side = (18 * SP) / frac;
  const wood = new THREE.MeshStandardMaterial({ color: 0xb98a4c, roughness: 0.5, envMap: ctx.envMap, envMapIntensity: 0.25 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(side, 0.5, side), [wood, wood,
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42, envMap: ctx.envMap, envMapIntensity: 0.3 }), wood, wood, wood]);
  top.rotation.y = Math.PI / 2; // texture rows run along +T
  top.position.y = -0.25;
  board.add(top);

  const stoneGeo = new THREE.SphereGeometry(0.168, 32, 14);
  stoneGeo.scale(1, 0.42, 1);
  const mats = {
    B: new THREE.MeshPhysicalMaterial({ color: 0x101012, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2, envMap: ctx.envMap, envMapIntensity: 0.8 }),
    W: new THREE.MeshPhysicalMaterial({ color: 0xf1ede4, roughness: 0.34, clearcoat: 0.5, envMap: ctx.envMap, envMapIntensity: 0.6 }),
  };
  const t37 = B('b12.1');
  const stones = first.map((mv) => {
    const s = new THREE.Mesh(stoneGeo, mats[mv.c]);
    s.position.copy(pos(mv, 0.07));
    board.add(s);
    return { s, t: mv.t };
  });

  // shock ring for Move 37
  const ringPts = [];
  for (let i = 0; i < 96; i++) ringPts.push(new THREE.Vector3(Math.cos((i / 96) * TAU), 0, Math.sin((i / 96) * TAU)));
  const ring = new FatLines([{ pts: ringPts, closed: true, color: new THREE.Color(1, 0.12, 0.08), gain: 3, width: 2.2 }]);
  const ringG = new THREE.Group();
  ringG.position.copy(pos(first[36], 0.03));
  ringG.add(ring.mesh);
  board.add(ringG);

  // Monte-Carlo rollouts arcing from the move
  const rng = mulberry32(37);
  const arcs = [];
  for (let k = 0; k < 16; k++) {
    const target = { x: Math.floor(rng() * 19), y: Math.floor(rng() * 19) };
    const a = pos(first[36], 0.08), b = pos(target, 0.08);
    const h = 0.6 + a.distanceTo(b) * 0.35;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      pts.push(new THREE.Vector3().lerpVectors(a, b, u).add(new THREE.Vector3(0, Math.sin(Math.PI * u) * h, 0)));
    }
    const t0 = t37 + 0.25 + k * 0.11;
    arcs.push({ pts, t0, t1: t0 + 0.35, gain: 1.0 + rng() * 0.6, width: 1.2 });
  }
  const rollouts = new FatLines(arcs);
  board.add(rollouts.mesh);

  const key = new THREE.SpotLight(0xfff1dd, 34, 16, 0.85, 0.9, 1.5);
  key.position.set(-2, 7, 1.5);
  key.target.position.set(0, 0, 0);
  board.add(key, key.target);

  m.update = (t, st) => {
    const life = m.alive(st);
    const r = m.reveal(t, 1.6, 1.0);
    board.visible = r > 0.001 && life > 0.001;
    key.visible = board.visible && t < m.tOut + 1.5;
    if (!board.visible) return;
    board.scale.setScalar(Math.max(0.001, ease.outCubic(r) * life));
    for (const { s, t: ts } of stones) {
      const age = t - ts;
      s.visible = age >= 0;
      if (age >= 0) {
        const k = clamp(age / 0.12);
        s.scale.setScalar(1 + (1 - ease.outCubic(k)) * 0.6);
        s.position.y = 0.07 + (1 - ease.outCubic(k)) * 0.25;
      }
    }
    const ra = t - t37;
    ringG.scale.setScalar(Math.max(0.001, ease.outExpo(clamp(ra / 0.9)) * 3.2 + 0.05));
    ring.set(t, ctx, ra >= 0 ? life * (1 - clamp(ra / 1.2)) : 0);
    rollouts.set(t, ctx, life * (1 - clamp((t - (t37 + 3.5)) / 1.5)));
    key.intensity = 34 * life;
  };

  m.labels = (t, hud, project) => {
    if (!m.onStage(t, 0.2, 0.8)) return;
    const a = clamp((t - t37) / 0.3) * (1 - clamp((t - m.tOut) / 0.6));
    const p = project(m.local(new THREE.Vector3(0, -LIFT, 0).add(pos(first[36], 0.1))));
    if (p.visible && a > 0) {
      hud.label('Move 37', p.x, p.y, { size: 34, weight: 600, alpha: a, dx: 30, dy: -6 });
      hud.tex(ctx.assets.tex.alphago, p.x + 30, p.y + 46, 40, { alpha: a * clamp((t - t37 - 0.4) / 0.4), align: 'left' });
    }
  };
  return m;
}
