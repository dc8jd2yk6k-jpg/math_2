// The cue sheet. Every time is written against the score ("b15.1" = the drop) and
// resolved through the beatmap, so picture is locked to the edit frame-accurately.

import * as THREE from 'three';
import { YEARS, SX } from '../core/curve.js';
import { Track, follow, orbit, pose } from '../core/camera.js';
import { DateTrack } from '../core/hud.js';
import { clamp, ease, envelope, lerp, pchip, smoothstep, keyframes } from '../core/math.js';

export const COPY = {
  shannon: { title: 'Claude Shannon', sub: 'Programming a Computer for Playing Chess · game tree ≈ 10¹²⁰', chip: '' },
  deepblue: { title: 'Deep Blue', sub: 'IBM · brute-force search + hand-tuned heuristics · 200 million positions per second', chip: 'DEFEATS KASPAROV 3½–2½' },
  alphago: { title: 'AlphaGo', sub: 'Google DeepMind · deep reinforcement learning + tree search', chip: '4–1 VS LEE SEDOL · MOVE 37' },
  imo2024: { title: 'IMO · Silver', sub: 'AlphaProof + AlphaGeometry 2 (Google DeepMind) · 4 of 6 problems', chip: '28 / 42' },
  imo2025: { title: 'IMO · Gold', sub: 'Gemini Deep Think (Google DeepMind) · natural language, within the 4.5-hour limit', chip: '35 / 42 · OFFICIALLY GRADED' },
  erdos: { title: 'Erdős unit distance conjecture', sub: 'OpenAI · n points with ≥ n^(1+δ) unit distances: the 1946 conjecture falls', chip: 'VERIFIED BY MATHEMATICIANS' },
  jacobian: { title: 'Jacobian conjecture', sub: 'Claude (Anthropic) · a counterexample in 3D and up: det J ≡ −2, yet not invertible', chip: 'CHECKABLE BY COMPUTER ALGEBRA' },
  percolation: { title: 'Critical percolation', sub: 'Anthropic researchers · no infinite cluster at p꜀ in dimension d ≥ 3', chip: 'LEAN-VERIFIED · NOT YET REFEREED' },
  navierstokes: { title: 'Navier–Stokes', sub: 'OpenAI · finite-time singularity for 3D incompressible flow', chip: 'LEAN-FORMALIZED · UNDER REVIEW' },
  manuscripts: { title: '722 manuscripts', sub: 'OpenAI · released in a single day · 162 with Lean-checked main results', chip: 'UNDER REVIEW' },
  yangmills: { title: 'Yang–Mills existence', sub: 'OpenAI · 4D quantum gauge theory exists (mass gap still open) · plus Kakeya, all dimensions', chip: 'ARTIFACTS NOT YET PUBLIC' },
  eth_openai: { title: 'Exponential Time Hypothesis', sub: 'OpenAI · refuted: satisfiability in subexponential time', chip: 'LEAN-CHECKED · UNDER REVIEW' },
  eth_claude: { title: '…refuted again, hours later', sub: 'Claude (Anthropic) · “A 2^o(n) Time Algorithm for 3-SAT”', chip: 'INDEPENDENT RESULT' },
};

export function buildScript(ctx) {
  const { curve, beat } = ctx;
  const B = (l, k = 0) => beat.t(l, k);
  const T = beat.T;
  const sY = (y) => curve.sOfYear(y);
  const topS = curve.topS;
  const endS = curve.length - 0.5;

  // ------------------------------------------------------------ head schedule
  const anchors = [
    [0, 0], [B('b59.1'), 0.08], [B('b60.1'), 0.5], [B('b60.3'), 1.6],
    [B('b5.1'), sY(1956)], [B('b6.1'), sY(1976)], [B('b7.1'), sY(1995.7)],
    [B('b8.1'), sY(YEARS.deepblue)], [B('b9.1'), sY(1998.9)],
    [B('b10.1'), sY(2013.2)], [B('b11.1'), sY(2015.6)], [B('b12.1'), sY(YEARS.alphago)], [B('b13.1'), sY(2016.8)],
    [B('b14.1'), sY(2019.6)], [B('b15.1'), sY(2024.35)], [B('b15.3'), sY(YEARS.imo2024)], [B('b16.3'), sY(2024.8)],
    [B('b17.1'), sY(2025.32)], [B('b17.3'), sY(YEARS.imo2025)], [B('b18.3'), sY(2025.78)],
    [B('b19.1'), sY(2026.25)], [B('b19.3'), sY(YEARS.erdos)], [B('b20.3'), sY(YEARS.erdos) + 9],
    [B('b21.1'), sY(YEARS.jacobian) - 6], [B('b21.3'), sY(YEARS.jacobian)], [B('b22.3'), sY(YEARS.jacobian) + 9],
    [B('b23.1'), sY(YEARS.percolation) - 6], [B('b23.3'), sY(YEARS.percolation)], [B('b24.3'), sY(YEARS.percolation) + 8],
    [B('b33.1'), sY(YEARS.percolation) + 13], [B('b34.1'), sY(YEARS.navierstokes) - 13],
    [B('b35.1'), sY(YEARS.navierstokes) - 8], [B('b37.1'), sY(YEARS.navierstokes)], [B('b38.3'), sY(YEARS.navierstokes) + 9],
    [B('b49.1'), sY(YEARS.manuscripts) - 7], [B('b49.3'), sY(YEARS.manuscripts)], [B('b50.3'), sY(YEARS.manuscripts) + 8],
    [B('b51.1'), sY(YEARS.yangmills) - 6], [B('b51.3'), sY(YEARS.yangmills)], [B('b52.3'), sY(YEARS.yangmills) + 8],
    [B('b53.1'), sY(YEARS.eth_openai) - 4], [B('b53.3'), sY(YEARS.eth_openai)],
    [B('b54.1'), sY(YEARS.eth_claude) - 4], [B('b54.3'), sY(YEARS.eth_claude)],
    [B('b54.4'), topS], [B('b55.2'), topS + 120], [B('b55.4'), endS],
  ];
  const headSpline = pchip(anchors.map((a) => a[0]), anchors.map((a) => a[1]));
  const headS = (t) => clamp(headSpline.f(t), 0, curve.length);
  ctx.headS = headS;
  ctx.B = B;

  // ------------------------------------------------------------- the seam shot
  // One function across the loop point: tau < 0 is the closing dive, tau >= 0 the
  // opening. Distance to the origin is interpolated in log space (an exponential
  // zoom), so the move decelerates continuously through frame 0.
  const tau0 = B('b57.1') - T; // ~ -3.82 s
  const seamKeysT = [tau0 - 1.5, tau0, tau0 + 1.3, tau0 + 2.6, -0.6, 0, 1.3, B('b60.1')];
  const seamLogD = [Math.log(560), Math.log(560), Math.log(240), Math.log(42), Math.log(12), Math.log(8.2), Math.log(7.0), Math.log(6.6)];
  const seamD = pchip(seamKeysT, seamLogD);
  const pullCenter = new THREE.Vector3(96, 150, 0);
  const seam = (t) => {
    const tau = t > T / 2 ? t - T : t;
    const d = Math.exp(seamD.f(tau));
    const u = smoothstep(Math.log(560), Math.log(9), Math.log(d)); // 0 far .. 1 near
    const target = new THREE.Vector3().lerpVectors(pullCenter, new THREE.Vector3(0.35, 0, 0), ease.inOutCubic(u));
    const az = lerp(0, -0.42, ease.inOutCubic(clamp((tau + 1.2) / 4)));
    const el = lerp(0.0, 0.16, ease.inOutCubic(clamp((tau + 1.5) / 4)));
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const fov = lerp(40, 52, u);
    return pose(target.clone().addScaledVector(dir, d), target, new THREE.Vector3(0, 1, 0), fov, 0);
  };

  const F = (opts) => (t) => follow(curve, headS(t), typeof opts === 'function' ? opts(t) : opts);
  const at = (id) => curve.at(sY(YEARS[id]));

  const track = new Track()
    .add(0, seam, { blend: 0 })
    .add(B('b60.2'), F((t) => ({ back: 6.5, up: 1.4, side: lerp(6.5, 4.5, smoothstep(B('b60.2'), B('b6.1'), t)), lookAhead: 5, fov: 50 })), { blend: 2.0 })
    // Deep Blue: skim low over the board
    .add(B('b7.1', -1), F((t) => ({ back: 4.2, up: 0.75, side: lerp(1.6, 0.8, smoothstep(B('b7.1'), B('b8.3'), t)), lookAhead: 4, lookUp: -0.3, fov: 52 })), { blend: 1.6 })
    .add(B('b9.1'), F((t) => ({ back: 7, up: 3.2, side: 4.5, lookAhead: 1.5, fov: 48, orbit: lerp(0, 0.5, smoothstep(B('b9.1'), B('b10.1'), t)) })), { blend: 1.2 })
    // AlphaGo: high over the board, then the slope steepens
    .add(B('b10.3'), (t) => {
      const a = at('alphago');
      return orbit(a.p, { radius: 11, az: lerp(-1.2, -0.4, smoothstep(B('b10.3'), B('b13.4'), t)), el: lerp(1.0, 0.75, smoothstep(B('b11.1'), B('b13.4'), t)), fov: 46, frame: null, look: a.p.clone().addScaledVector(a.T, lerp(-1.5, 1.5, smoothstep(B('b10.3'), B('b13.4'), t))) });
    }, { blend: 1.6 })
    // the lull before the drop: whip around the head and look up the slope
    .add(B('b14.1'), F((t) => ({ back: 7, up: 1.5, side: 4, lookAhead: 8, fov: 50, orbit: lerp(0, Math.PI * 1.15, ease.inOutExpo(smoothstep(B('b14.2'), B('b15.1'), t))) })), { blend: 0.9 })
    // IMO 2024: front-on to the construction
    .add(B('b15.1'), (t) => {
      const a = at('imo2024');
      return orbit(a.p.clone().addScaledVector(a.N, 1.5), { radius: 15, az: lerp(1.42, 1.62, smoothstep(B('b15.1'), B('b17.1'), t)), el: 0.08, fov: 46 });
    }, { blend: 0.35, e: ease.outCubic })
    // IMO 2025: below, looking up the rising line
    .add(B('b17.1', -0.5), F((t) => ({ back: 10, up: -1.0, side: 4.5, lookAhead: 9, fov: 50, orbit: lerp(-0.3, 0.3, smoothstep(B('b17.1'), B('b19.1'), t)) })), { blend: 1.0 })
    // 2026: the vertical stack
    .add(B('b19.1', -0.5), (t) => {
      const a = at('erdos');
      return orbit(a.p, { radius: 17, az: lerp(0.4, 1.4, smoothstep(B('b19.1'), B('b21.1'), t)), el: 0.55, fov: 44 });
    }, { blend: 1.0 })
    .add(B('b21.1', -0.5), (t) => {
      const a = at('jacobian');
      return orbit(a.p, { radius: 16, az: lerp(1.6, 2.6, smoothstep(B('b21.1'), B('b23.1'), t)), el: 0.25, fov: 44 });
    }, { blend: 1.0 })
    .add(B('b23.1', -0.5), F((t) => ({ back: 9, up: 0.6, side: 1.2, lookAhead: 6, fov: 56, orbit: lerp(0, 1.2, smoothstep(B('b23.1'), B('b24.4'), t)) })), { blend: 1.0 })
    .add(B('b33.1'), (t) => {
      const a = at('navierstokes');
      const c = a.p.clone().addScaledVector(a.T, -12);
      return orbit(c, { radius: lerp(34, 20, smoothstep(B('b33.1'), B('b34.4'), t)), az: lerp(0.3, 0.9, smoothstep(B('b33.1'), B('b35.1'), t)), el: 0.12, fov: 42 });
    }, { blend: 1.0 })
    // into the vortex tunnel
    .add(B('b35.1', -0.6), F((t) => ({ back: 6, up: 0.35, side: 0.25, lookAhead: 12, fov: 62, upMode: 'curve', orbit: (t - B('b35.1')) * 0.6 })), { blend: 0.6, e: ease.inOutExpo })
    .add(B('b49.1', -0.5), (t) => {
      const a = at('manuscripts');
      return orbit(a.p, { radius: lerp(22, 14, smoothstep(B('b49.1'), B('b51.1'), t)), az: lerp(0.8, 2.2, smoothstep(B('b49.1'), B('b51.1'), t)), el: 0.3, fov: 46 });
    }, { blend: 0.8 })
    .add(B('b51.1', -0.5), F((t) => ({ back: 10, up: 1.0, side: 6, lookAhead: 2, fov: 46, orbit: lerp(0.4, 1.4, smoothstep(B('b51.1'), B('b53.1'), t)) })), { blend: 0.9 })
    .add(B('b53.1', -0.3), F((t) => ({ back: 12, up: -1.5, side: 7, lookAhead: 6, fov: 48, orbit: lerp(-0.5, 0.2, smoothstep(B('b53.1'), B('b55.1'), t)) })), { blend: 0.6 })
    // pull back to the whole curve
    .add(B('b54.4'), (t) => {
      const u = ease.inOutCubic(smoothstep(B('b54.4'), B('b56.3'), t));
      const top = curve.at(topS).p;
      const target = new THREE.Vector3().lerpVectors(top, pullCenter, ease.inOutQuad(u));
      const d = Math.exp(lerp(Math.log(26), Math.log(560), u));
      const az = lerp(0.65, 0, u), el = lerp(-0.2, 0, u);
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
      return pose(target.clone().addScaledVector(dir, d), target, new THREE.Vector3(0, 1, 0), lerp(52, 40, u), 0);
    }, { blend: 0.8 })
    .add(B('b57.1'), seam, { blend: 0.0 });

  // ---------------------------------------------------------------- HUD: date
  const yearOfHead = (t) => curve.yearAt(headS(t));
  const date = new DateTrack([
    { t: 0, text: '1950' },
    { t: B('b60.3'), value: (t) => Math.min(1996.999, Math.max(1950, yearOfHead(t))) },
    { t: B('b7.1', -0.8), text: '1997.05', roll: 0.8 },
    { t: B('b9.3'), value: (t) => Math.min(2015.999, Math.max(1997, yearOfHead(t))) },
    { t: B('b11.1', -0.8), text: '2016.03', roll: 0.8 },
    { t: B('b14.1'), value: (t) => Math.min(2023.999, Math.max(2016, lerp(2016, 2024, smoothstep(B('b14.1'), B('b15.1', -0.5), t)))) },
    { t: B('b15.1', -0.5), text: '2024.07', roll: 0.5 },
    { t: B('b17.1', -0.5), text: '2025.07', roll: 0.5 },
    { t: B('b19.1', -0.5), text: '2026.05.20', roll: 0.5 },
    { t: B('b21.1', -0.5), text: '2026.07.20', roll: 0.5 },
    { t: B('b23.1', -0.5), text: '2026.08.28', roll: 0.5 },
    { t: B('b33.1', -0.5), text: '2026.09.08', roll: 0.5 },
    { t: B('b49.1', -0.5), text: '2026.10.06', roll: 0.5 },
    { t: B('b51.1', -0.5), text: '2026.10.27', roll: 0.5 },
    { t: B('b57.1'), text: '1950', roll: 3.0, back: true },
  ], { roll: 0.5, stagger: 0.03 });

  const blocks = [
    ['shannon', 0, B('b5.2')], ['deepblue', B('b7.1'), B('b9.4')], ['alphago', B('b11.1'), B('b13.4')],
    ['imo2024', B('b15.1'), B('b16.4')], ['imo2025', B('b17.1'), B('b18.4')], ['erdos', B('b19.1'), B('b20.4')],
    ['jacobian', B('b21.1'), B('b22.4')], ['percolation', B('b23.1'), B('b24.4')], ['navierstokes', B('b33.1'), B('b38.4')],
    ['manuscripts', B('b49.1'), B('b50.4')], ['yangmills', B('b51.1'), B('b52.4')], ['eth_openai', B('b53.1'), B('b53.4', 0.6)],
    ['eth_claude', B('b54.1'), B('b54.4', 0.6)],
  ].map(([id, t0, t1]) => ({ id, t0, t1, ...COPY[id] }));

  // ------------------------------------------------------------------- FX
  const glitchAt = [B('b15.1'), B('b35.1'), B('b49.1'), B('b53.1'), B('b54.1'), B('b57.1')];
  const fx = (t) => {
    const tau = t > T / 2 ? t - T : t;
    const ign = tau >= 0 ? Math.exp(-tau / 0.35) : Math.exp(tau / 0.22) * 0.0; // flash on the stab at frame 0
    const pre = tau < 0 ? smoothstep(-0.5, 0, tau) * 0.6 : 0;
    let glitch = 0;
    for (const g of glitchAt) { const d = t - g; if (d >= -0.03 && d < 0.14) glitch = Math.max(glitch, 1 - d / 0.14); }
    const punch = beat.impulse(t, { from: 'beats', min: 0.55, decay: 0.18 });
    return {
      bloom: 0.16 + punch * 0.04 + ign * 0.25,
      exposure: 1.0,
      ca: 0.0016 + punch * 0.002,
      glitch,
      flash: ign * 0.22 + pre * 0.25,
      flashColor: new THREE.Color(1.0, 0.55, 0.45),
      vignette: 0.55,
      fade: 1,
      saturation: 1,
    };
  };

  // ------------------------------------------------------------------- state
  const state = (t, s) => {
    const tau = t > T / 2 ? t - T : t;
    const escape = smoothstep(B('b54.4'), B('b55.3'), t);
    const ignite = tau >= 0 ? clamp(tau / 0.06) : 0;
    return {
      t, s,
      head: { size: 0.55 + Math.exp(-Math.max(0, tau) / 0.45) * 1.6 * ignite, glow: 2.2, core: 7, minPx: 20, alpha: (1 - escape) * (tau >= 0 ? ignite : 1), light: 5 },
      trailWidth: 2.4,
      trailFade: 1 - smoothstep(B('b57.1'), B('b58.3'), t),
      trailDissolve: smoothstep(B('b57.1'), T, t),
      trailGain: 1,
      starGain: 1 + beat.e('onset', t) * 0.35,
      dissolve: smoothstep(B('b57.1'), B('b58.3'), t),
      fx: fx(t),
    };
  };

  // ------------------------------------------------------------------- HUD
  const drawHud = (t, hud, project, st) => {
    const dateAlpha = 1 - envelope(t, B('b55.1'), B('b57.1'), 0.4, 0.4);
    hud.odometer(date.cells(t), 540, 238, { size: 92, alpha: dateAlpha });
    for (const b of blocks) {
      if (t < b.t0 - 0.05 || t > b.t1 + 0.6) continue;
      const pin = clamp((t - b.t0) / 0.45), pout = 1 - clamp((t - b.t1) / 0.35);
      const a = Math.min(1, pout);
      if (a <= 0) continue;
      hud.font('Inter', 50, 600);
      hud.ctx.letterSpacing = '0px';
      const tw = hud.ctx.measureText(b.title).width;
      hud.text(hud.decode(b.title, pin), 540 - tw / 2, 336, { family: 'Inter', size: 50, weight: 600, alpha: a, glow: 16, align: 'left' });
      wrap(hud, b.sub, 540, 394, 900, 27, a * clamp((t - b.t0 - 0.15) / 0.35), 38);
      if (b.chip) hud.chip(b.chip, 540, b.sub.length > 62 ? 492 : 454, { alpha: a * clamp((t - b.t0 - 0.35) / 0.3) });
    }
    // milestone annotations
    for (const m of ctx.film.milestones) if (m.labels) m.labels(t, hud, project, st);
    // pull-back reveal copy
    const pa = envelope(t, B('b55.2'), B('b57.2'), 0.5, 0.5);
    if (pa > 0) {
      hud.text('1950 → 2026', 540, 238, { family: 'JBM', size: 76, weight: 300, alpha: pa, glow: 20 });
      hud.text(hud.decode('decades → years → months → days → hours', clamp((t - B('b55.2')) / 0.9)), 540, 318, { family: 'Inter', size: 30, weight: 500, alpha: pa * 0.9 });
      hud.text('Every frame rendered from code written by Claude', 540, 1580, { family: 'Inter', size: 26, weight: 400, alpha: pa * 0.72 * clamp((t - B('b55.4')) / 0.6) });
    }
  };

  return { headS, state, camera: (t) => track.at(t), drawHud, blocks, date };
}

function wrap(hud, text, x, y, maxW, size, alpha, lh) {
  if (alpha <= 0) return;
  const c = hud.ctx;
  hud.font('Inter', size, 400);
  c.letterSpacing = '0px';
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => hud.text(l, x, y + i * lh, { family: 'Inter', size, weight: 400, color: 'rgba(222,224,230,0.86)', alpha }));
}
