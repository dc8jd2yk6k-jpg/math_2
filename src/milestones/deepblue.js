// 1997 — IBM Deep Blue beats Kasparov. The real final position of Game 6
// (Caro-Kann, 8.Nxe6!) on a Staunton set; the last five plies play on the beat
// (17.Bf5 exf5 18.Rxe7 Bxe7 19.c4, 1-0) while an alpha-beta search tree bursts
// from the board: brute force, with most branches pruned as fast as they appear.

import * as THREE from 'three';
import { Chess } from 'chess.js';
import { base } from './common.js';
import { pieceGeometry } from './pieces.js';
import { FatLines } from '../core/lines.js';
import { clamp, ease, mulberry32, TAU } from '../core/math.js';

const PGN = `1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Ng5 Ngf6 6. Bd3 e6 7. N1f3 h6 8. Nxe6 Qe7 9. O-O fxe6
10. Bg6+ Kd8 11. Bf4 b5 12. a4 Bb7 13. Re1 Nd5 14. Bg3 Kc8 15. axb5 cxb5 16. Qd3 Bc6 17. Bf5 exf5 18. Rxe7 Bxe7 19. c4`;
const SHOWN = 5; // final plies animated on the beat
const SQ = 0.62, LIFT = 1.32; // square size; the line runs this far above the board surface

function boardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const rng = mulberry32(64);
  g.fillStyle = '#1b130e'; g.fillRect(0, 0, 1024, 1024);
  const m = 40, s = (1024 - 2 * m) / 8;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const light = (r + f) % 2 === 1;
    g.fillStyle = light ? '#b7a68a' : '#4a3a2e';
    g.fillRect(m + f * s, m + r * s, s, s);
    g.globalAlpha = 0.07;
    for (let k = 0; k < 18; k++) { // grain
      g.fillStyle = rng() < 0.5 ? '#000' : '#fff';
      g.fillRect(m + f * s, m + r * s + rng() * s, s, 1 + rng() * 2);
    }
    g.globalAlpha = 1;
  }
  g.strokeStyle = 'rgba(220,200,170,0.35)'; g.lineWidth = 3; g.strokeRect(m - 2, m - 2, 1024 - 2 * m + 4, 1024 - 2 * m + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function deepblue(ctx) {
  const m = base(ctx, 'deepblue');
  const B = ctx.B;
  const chess = new Chess();
  chess.loadPgn(PGN);
  const moves = chess.history({ verbose: true });
  const start = new Chess();
  moves.slice(0, moves.length - SHOWN).forEach((mv) => start.move(mv.san));
  const shown = moves.slice(moves.length - SHOWN);
  const beats = ['b7.2', 'b7.4', 'b8.2', 'b8.4', 'b9.2'].map((l) => B(l));

  const board = new THREE.Group();
  board.position.set(0, -LIFT, 0);
  m.group.add(board);
  const size = 8 * SQ + 0.5;
  const top = new THREE.Mesh(new THREE.BoxGeometry(size, 0.2, size), [
    new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.55 }),
    new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.38, envMap: ctx.envMap, envMapIntensity: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x24170f }), new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.55 }),
    new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.55 }),
  ]);
  top.position.y = -0.1;
  board.add(top);

  const mats = {
    w: new THREE.MeshPhysicalMaterial({ color: 0xcfc6b6, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, envMap: ctx.envMap, envMapIntensity: 0.55 }),
    b: new THREE.MeshPhysicalMaterial({ color: 0x1d1d21, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15, envMap: ctx.envMap, envMapIntensity: 0.7 }),
  };
  const geos = {};
  const sqPos = (sq) => {
    const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1;
    return new THREE.Vector3((r - 3.5) * SQ, 0, (f - 3.5) * SQ);
  };
  const pieces = new Map(); // square -> mesh
  for (const row of start.board()) for (const p of row) {
    if (!p) continue;
    geos[p.type] ||= pieceGeometry(p.type);
    const mesh = new THREE.Mesh(geos[p.type], mats[p.color]);
    mesh.scale.setScalar(SQ);
    mesh.position.copy(sqPos(p.square));
    // knights face the opponent
    if (p.type === 'n') mesh.rotation.y = p.color === 'w' ? 0 : Math.PI;
    board.add(mesh);
    pieces.set(p.square, mesh);
  }
  // resolve which mesh moves / gets captured at each shown ply
  const anim = [];
  const occ = new Map(pieces);
  shown.forEach((mv, i) => {
    const mover = occ.get(mv.from), victim = occ.get(mv.to);
    occ.delete(mv.from); occ.set(mv.to, mover);
    anim.push({ mover, from: sqPos(mv.from), to: sqPos(mv.to), victim, tEnd: beats[i], san: mv.san, color: mv.color });
  });

  // lights for the board only
  const key = new THREE.SpotLight(0xfff3e6, 34, 14, 0.75, 0.85, 1.6);
  key.position.set(-1.5, 6.5, 2.5);
  key.target.position.set(0, 0, 0);
  board.add(key, key.target);
  const rim = new THREE.PointLight(0x9fb4ff, 6, 10, 1.8);
  rim.position.set(4.2, 1.6, -3.5);
  board.add(rim);

  // alpha-beta search tree blooming from the board
  const rng = mulberry32(1997);
  const keep = [], pruned = [];
  const tS = B('b8.1');
  const grow = (p, dir, depth, t0) => {
    if (depth > 4) return;
    const kids = [11, 5, 4, 3][depth - 1];
    for (let i = 0; i < kids; i++) {
      const d = dir.clone().add(new THREE.Vector3(rng() - 0.5, rng() * 0.7 - 0.15, rng() - 0.5).multiplyScalar(depth === 1 ? 2.2 : 0.95)).normalize();
      if (d.y < 0.05) d.y = 0.05 + rng() * 0.2;
      d.normalize();
      const len = [1.5, 1.15, 0.85, 0.6][depth - 1];
      const q = p.clone().addScaledVector(d, len);
      const t1 = t0 + 0.11;
      const isPruned = depth >= 2 && rng() < 0.62;
      (isPruned ? pruned : keep).push({ pts: [p, q], t0, t1, gain: isPruned ? 0.6 : 0.95, width: depth === 1 ? 1.4 : 1.0 });
      if (!isPruned) grow(q, d, depth + 1, t1 + rng() * 0.05);
    }
  };
  grow(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, 1, 0), 1, tS);
  const treeKeep = new FatLines(keep), treePruned = new FatLines(pruned, { color: new THREE.Color(1, 0.55, 0.5) });
  board.add(treeKeep.mesh, treePruned.mesh);
  m.treeTop = new THREE.Vector3(0.2, -LIFT + 3.6, -1.8);

  m.update = (t, st) => {
    const life = m.alive(st);
    const r = m.reveal(t, 1.2, 1.0);
    const vis = r > 0.001 && life > 0.001;
    board.visible = vis;
    key.visible = rim.visible = vis;
    if (!vis) return;
    board.scale.setScalar(Math.max(0.001, ease.outCubic(r) * life));
    // replay the final plies
    for (const a of anim) {
      const u = clamp((t - (a.tEnd - 0.42)) / 0.42);
      const e = ease.inOutCubic(u);
      a.mover.position.lerpVectors(a.from, a.to, e);
      a.mover.position.y = Math.sin(Math.PI * e) * 0.35;
      if (a.victim) {
        const k = clamp((t - a.tEnd + 0.05) / 0.25);
        a.victim.scale.setScalar(SQ * (1 - ease.inCubic(k)));
        a.victim.position.y = k * 0.6;
        a.victim.visible = k < 0.999;
      }
    }
    treeKeep.set(t, ctx, life * (1 - 0.6 * clamp((t - tS - 2.5) / 2)));
    treePruned.set(t, ctx, life * Math.max(0, 1 - clamp((t - tS - 0.35) / 0.5)));
    key.intensity = 34 * life;
  };

  m.labels = (t, hud, project) => {
    if (!m.onStage(t, 0.5, 0.9)) return;
    const a = clamp((t - m.tIn + 0.2) / 0.4) * (1 - clamp((t - m.tOut) / 0.6));
    const plies = anim.filter((an) => t >= an.tEnd - 0.1).map((an, i) => (i % 2 === 0 ? `${17 + i / 2}. ${an.san}` : an.san));
    if (plies.length) {
      const txt = plies.join('  ') + (plies.length === SHOWN ? '   1–0' : '');
      hud.text(txt, 540, 1470, { family: 'JBM', size: 27, weight: 400, alpha: a * 0.85, color: '#e8e8e8' });
    }
    const tp = project(m.local(m.treeTop));
    const ta = clamp((t - (B('b8.1') + 0.3)) / 0.4) * (1 - clamp((t - m.tOut) / 0.5));
    if (tp.visible) hud.tex(ctx.assets.tex.deepblue, tp.x, tp.y, 38, { alpha: ta, align: 'center' });
  };
  return m;
}
