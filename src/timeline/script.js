// The cue sheet. Every time is written against the score ("b15.1" = the drop) and
// resolved through the beatmap, so picture is locked to the edit frame-accurately.

import * as THREE from 'three';
import { YEARS } from '../core/curve.js';
import { Track, follow, orbit, pose, shake } from '../core/camera.js';
import { DateTrack } from '../core/hud.js';
import { clamp, ease, envelope, lerp, pchip, smoothstep } from '../core/math.js';

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
    // the rewind: the head races back down the whole curve, erasing its trail, and
    // reaches the origin exactly at the loop point, where frame 0 ignites it again
    [B('b57.1'), endS], [B('b57.3'), topS + 40], [B('b58.1'), sY(2024.5)], [B('b58.2'), sY(2012)], [B('b58.3'), sY(1975)],
    [T - 0.12, 0.6], [T, 0],
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
  const seamKeysT = [tau0 - 1.5, tau0, tau0 + 1.3, tau0 + 2.6, -0.6, 0, 1.3, B('b60.1'), B('b60.3')];
  const seamLogD = [560, 560, 240, 60, 22, 13, 11.5, 10.5, 9.8].map(Math.log);
  const seamD = pchip(seamKeysT, seamLogD);
  const pullCenter = new THREE.Vector3(96, 150, 0);
  const seam = (t) => {
    const tau = t > T / 2 ? t - T : t;
    const d = Math.exp(seamD.f(tau));
    const u = smoothstep(Math.log(560), Math.log(14), Math.log(d)); // 0 far .. 1 near
    const origin = new THREE.Vector3(0.3, 0, 0);
    let target;
    if (tau < 0) {
      // follow the rewinding head down the curve, converging on the origin
      const hp = curve.at(headS(t)).p;
      const w = ease.inOutCubic(clamp((tau - tau0) / 0.9));
      const chase = new THREE.Vector3(hp.x, Math.min(hp.y, 420), 0).lerp(origin, ease.inQuad(clamp((tau + 0.9) / 0.9)));
      target = new THREE.Vector3().lerpVectors(pullCenter, chase, w);
    } else target = origin;
    const az = lerp(0, -0.38, ease.inOutCubic(clamp((tau + 1.0) / 4.2)));
    const el = lerp(0.0, 0.12, ease.inOutCubic(clamp((tau + 1.5) / 4.5)));
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    return pose(target.clone().addScaledVector(dir, d), target, new THREE.Vector3(0, 1, 0), lerp(40, 50, u), 0);
  };

  const F = (opts) => (t) => follow(curve, headS(t), typeof opts === 'function' ? opts(t) : opts);
  const at = (id) => curve.at(sY(YEARS[id]));
  const P = (id) => at(id).p.clone();
  const S = (a, b, t) => smoothstep(B(a), B(b), t);
  const W = (x, y, z) => new THREE.Vector3(x, y, z);
  // orbit about a world point (az around world Y, el above the horizon); d interpolated in log space
  const orb = (center, { d0, d1 = d0, az0, az1 = az0, el0, el1 = el0, fov = 46, look = null, k = (t) => 0 }) => (t) => {
    const u = k(t);
    const d = Math.exp(lerp(Math.log(d0), Math.log(d1), u)), az = lerp(az0, az1, u), el = lerp(el0, el1, u);
    const c = typeof center === 'function' ? center(t) : center;
    const dir = W(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    return pose(c.clone().addScaledVector(dir, d), (look ? (typeof look === 'function' ? look(t) : look) : c).clone(), W(0, 1, 0), fov, 0);
  };
  const frameOrb = (id, center, { radius, az0, az1 = az0, el0, el1 = el0, fov = 46, k, lookOff = W(0, 0, 0) }) => (t) => {
    const a = at(id), u = k(t);
    return orbit(center, { radius, az: lerp(az0, az1, u), el: lerp(el0, el1, u), fov, frame: a, look: center.clone().add(lookOff) });
  };
  const db = at('deepblue'), ag = at('alphago');
  const dbBoard = db.p.clone().addScaledVector(db.N, -1.32);
  const agBoard = ag.p.clone().addScaledVector(ag.N, -0.62);

  const track = new Track()
    .add(0, seam, { blend: 0 })
    // 1950 -> 1997: chase cam, the decades stream past
    .add(B('b60.2'), F((t) => ({ back: lerp(9, 6.5, S('b60.2', 'b6.1', t)), up: 1.3, side: lerp(3.5, 1.6, S('b60.2', 'b6.1', t)), lookAhead: 6, fov: lerp(50, 56, S('b5.1', 'b6.3', t)) })), { blend: 1.8 })
    // Deep Blue: skim just above the pieces
    .add(B('b7.1', -1.5), F((t) => ({ back: 3.6, up: -0.28, side: lerp(1.1, 0.6, S('b7.1', 'b8.1', t)), lookAhead: 5, lookUp: -0.05, fov: 58 })), { blend: 1.3 })
    // ... then rise to see the search tree burst
    .add(B('b8.1'), frameOrb('deepblue', dbBoard, { radius: 8.5, az0: Math.PI + 0.55, az1: Math.PI + 1.25, el0: 0.32, el1: 0.72, fov: 48, k: (t) => ease.inOutCubic(S('b8.1', 'b9.4', t)), lookOff: W(0, 1.4, 0) }), { blend: 1.1 })
    .add(B('b9.4'), F({ back: 7, up: 1.6, side: 1.4, lookAhead: 8, fov: 58 }), { blend: 1.0 })
    // AlphaGo: high over the board
    .add(B('b10.3'), frameOrb('alphago', agBoard, { radius: 10, az0: Math.PI + 0.35, az1: Math.PI + 0.95, el0: 1.05, el1: 0.82, fov: 46, k: (t) => ease.inOutSine(S('b10.3', 'b13.4', t)) }), { blend: 1.4 })
    // the lull before the drop: whip around the head as the slope steepens
    .add(B('b14.1'), F((t) => ({ back: 7.5, up: 1.4, side: 2.5, lookAhead: 7, fov: 52, orbit: lerp(0, Math.PI * 0.9, ease.inOutExpo(S('b14.2', 'b15.1', t))) })), { blend: 1.0 })
    // IMO 2024: square-on to the construction
    .add(B('b15.1', -0.12), orb((t) => P('imo2024').add(W(2.1, -1.64, 0)), { d0: 19.5, d1: 18.5, az0: 0.06, az1: -0.05, el0: 0.03, el1: -0.02, fov: 46, k: (t) => S('b15.1', 'b17.1', t) }), { blend: 0.3, e: ease.outCubic })
    // IMO 2025
    .add(B('b17.1', -0.4), orb((t) => P('imo2025').add(W(2.2, 1.0, 0)), { d0: 20, d1: 19, az0: -0.06, az1: 0.06, el0: -0.03, el1: 0.03, fov: 46, k: (t) => S('b17.1', 'b19.1', t) }), { blend: 0.55 })
    // below the line, looking up the vertical: 2026 begins
    .add(B('b18.4'), F({ back: 10, up: -2.6, side: 2.4, lookAhead: 12, fov: 58 }), { blend: 0.8 })
    .add(B('b19.1', -0.25), orb(P('erdos'), { d0: 11.5, d1: 10, az0: 0.5, az1: 1.4, el0: 0.66, el1: 0.5, fov: 46, k: (t) => S('b19.1', 'b21.1', t), look: P('erdos').add(W(0, 0.4, 0)) }), { blend: 0.8 })
    .add(B('b21.1', -0.4), orb(P('jacobian'), { d0: 15, d1: 13.5, az0: 1.7, az1: 2.5, el0: 0.14, el1: 0.06, fov: 46, k: (t) => S('b21.1', 'b23.1', t), look: P('jacobian').add(W(0, 2.2, 0)) }), { blend: 0.8 })
    .add(B('b23.1', -0.4), orb(P('percolation'), { d0: 30, d1: 21, az0: 2.8, az1: 3.7, el0: 0.42, el1: 0.18, fov: 44, look: P('percolation').add(W(0, 1.6, 0)), k: (t) => ease.inOutQuad(S('b23.1', 'b24.4', t)) }), { blend: 0.8 })
    // Navier-Stokes: from below, looking up at the forming vortex ...
    .add(B('b33.1', -0.3), orb((t) => P('navierstokes').add(W(0, -6, 0)), { d0: 30, d1: 17, az0: 0.3, az1: 0.85, el0: -0.32, el1: -0.42, fov: 50, k: (t) => S('b33.1', 'b34.4', t), look: P('navierstokes').add(W(0, 2, 0)) }), { blend: 0.9 })
    // ... then swoop inside the tunnel on the pickup and corkscrew up it
    .add(B('b34.4'), F((t) => ({ back: 5, up: 0.22, side: 0.18, lookAhead: 10, fov: 66, upMode: 'curve', orbit: (t - B('b35.1')) * 0.95 })), { blend: 0.55, e: ease.inOutExpo })
    // 722 manuscripts: outside the helix, then inside it
    .add(B('b49.1', -0.4), orb(P('manuscripts'), { d0: 26, d1: 17, az0: 0.9, az1: 1.5, el0: 0.12, el1: 0.05, fov: 48, k: (t) => S('b49.1', 'b50.3', t), look: P('manuscripts').add(W(0, -2, 0)) }), { blend: 0.6 })
    .add(B('b50.3'), F({ back: 7, up: 0.4, side: 1.4, lookAhead: 9, fov: 58, upMode: 'curve' }), { blend: 0.7 })
    // Yang-Mills: around the bundle
    .add(B('b51.1', -0.4), orb(P('yangmills'), { d0: 14, d1: 12.5, az0: 2.0, az1: 2.9, el0: 0.2, el1: 0.42, fov: 46, k: (t) => S('b51.1', 'b53.1', t) }), { blend: 0.7 })
    // ETH: under the barriers looking up as the two comets break through
    .add(B('b53.1', -0.7), orb(P('eth_openai').add(W(0, -5, 0)), { d0: 12, d1: 14, az0: 0.55, az1: 0.95, el0: -0.5, el1: -0.42, fov: 52, k: (t) => S('b53.1', 'b54.4', t), look: P('eth_openai').add(W(0, 7, 0)) }), { blend: 0.6 })
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

  // beat-locked camera FX: FOV punch-in on accents, a touch of shake on hits
  const camera = (t) => {
    const p = track.at(t);
    const punch = beat.impulse(t, { from: 'beats', min: 0.62, decay: 0.16, attack: 0.02 });
    p.fov = p.fov * (1 - 0.06 * Math.min(1.5, punch));
    const sh = beat.impulse(t, { from: 'hits', min: 0.7, decay: 0.12 });
    if (sh > 0.001) p.pos = p.pos.clone().add(shake(t, 0.035 * Math.min(1.5, sh) * p.pos.distanceTo(p.look) * 0.1));
    return p;
  };

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
    { t: B('b57.1'), text: '2026.10.27', roll: 0.01 },
    { t: B('b57.2'), value: (t) => Math.max(1950, Math.min(2026.999, yearOfHead(t))), suffix: '' },
    { t: T - 0.01, text: '1950', roll: 0.01 },
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
    // section downbeats: the drop, the second burst, the climax, the rewind
    let hitFx = 0;
    for (const g of [B('b15.1'), B('b35.1'), B('b49.1'), B('b57.1')]) {
      const d = t - (Math.round(g * beat.fps) - 0.5) / beat.fps;
      if (d >= 0 && d < 0.6) hitFx = Math.max(hitFx, Math.exp(-d / 0.12));
    }
    return {
      bloom: 0.16 + punch * 0.04 + ign * 0.25 + hitFx * 0.35,
      exposure: 1.0 + hitFx * 0.25,
      ca: 0.0016 + punch * 0.002 + hitFx * 0.012,
      glitch,
      flash: hitFx * 0.06,
      flashColor: new THREE.Color(1.0, 0.42, 0.36),
      vignette: 0.55,
      fade: 1,
      saturation: 1,
    };
  };

  // ------------------------------------------------------------------- state
  const state = (t, s) => {
    const tau = t > T / 2 ? t - T : t;
    const rewind = t >= B('b57.1');
    const escape = rewind ? 1 - smoothstep(B('b57.1'), B('b57.2'), t) : smoothstep(B('b54.4'), B('b55.3'), t);
    const flare = tau >= 0 ? Math.exp(-tau / 0.35) : Math.exp(tau / 0.07); // peaks on the stab at frame 0
    return {
      t, s,
      head: { size: 0.55 + flare * 0.9, glow: 2.2 + flare * 1.2 + 0.45 * beat.pulse(t, 7), core: 7, minPx: 20, alpha: 1 - escape, light: 5 },
      trailWidth: 2.4,
      trailFade: 1,
      trailDissolve: 0,
      rewind,
      trailGain: 1,
      starGain: 1 + beat.e('onset', t) * 0.35,
      dissolve: smoothstep(B('b57.1'), B('b58.2'), t),
      fx: fx(t),
    };
  };

  // ------------------------------------------------------------------- HUD
  const drawHud = (t, hud, project, st) => {
    const dateAlpha = 1 - envelope(t, B('b55.1'), B('b57.3'), 0.4, 0.35);
    hud.odometer(date.cells(t), 540, 238, { size: 92, alpha: dateAlpha });
    for (const b of blocks) {
      if (t < b.t0 - 0.05 || t > b.t1 + 0.6) continue;
      const pin = clamp((t - b.t0) / 0.28), pout = 1 - clamp((t - b.t1) / 0.35);
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

  return { headS, state, camera, drawHud, blocks, date };
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
