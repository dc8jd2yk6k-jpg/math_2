// The cue sheet. Every time is written against the score ("b15.1" = the drop) and
// resolved through the beatmap, so picture is locked to the edit frame-accurately.
//
// Loop: the film ends by diving into the Navier–Stokes vortex (2026.09.08) and opens
// inside it. Navier–Stokes is invariant under u(x,t) -> λu(λx, λ²t), so the dive is an
// approach to the blow-up time T*, and the loop point is T*. From frame 0 the picture
// runs backwards: the camera pulls out of the eye, the head rewinds down the line, the
// date rolls back to 1950, and Shannon's game tree ignites on the b5 downbeat.

import * as THREE from 'three';
import { YEARS } from '../core/curve.js';
import { Track, orbit, pose, steady } from '../core/camera.js';
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

const Y = new THREE.Vector3(0, 1, 0);
const W = (x, y, z) => new THREE.Vector3(x, y, z);

// a camera on a sphere around `c`: azimuth around world Y, elevation above the
// horizon, with an up vector that stays defined when looking straight down
function sphere(c, d, az, el, fov, look = c, roll = 0) {
  const h = W(Math.sin(az), 0, Math.cos(az));
  const dir = h.clone().multiplyScalar(Math.cos(el)).addScaledVector(Y, Math.sin(el));
  const up = Y.clone().multiplyScalar(Math.cos(el)).addScaledVector(h, -Math.sin(el)).normalize();
  return pose(c.clone().addScaledVector(dir, d), look.clone(), up, fov, roll);
}

export function buildScript(ctx) {
  const { curve, beat } = ctx;
  const B = (l, k = 0) => beat.t(l, k);
  const T = beat.T, fps = beat.fps;
  const sY = (y) => curve.sOfYear(y);
  const topS = curve.topS;
  const endS = curve.length - 0.5;
  const sNS = sY(YEARS.navierstokes);
  const PS = curve.at(sNS).p.clone(); // the singular point
  const tau = (t) => (t > T / 2 ? t - T : t);

  // ------------------------------------------------------------ head schedule
  // Travel and hold: at every milestone the head lands on a downbeat and stays put
  // while the camera explores; between milestones it travels in one eased move.
  // Repeated values make the monotone spline flat, so a hold is exactly still.
  const sM = (id) => sY(YEARS[id]);
  const r0 = B('b59.4');
  const hold = (t0, t1, sv) => [[t0, sv], [t1, sv]];
  const anchors = [
    // opening: escaped above the frame, the head drops back through the vortex and
    // rewinds the whole line in about 1.3 s, coming to rest at the origin
    [0, endS], [B('b59.3'), endS - 5],
    [r0 + 0.06, sNS], [r0 + 0.42, sNS - 90], [r0 + 0.77, 160], [r0 + 1.07, 80], [r0 + 1.27, 25], [r0 + 1.44, 4],
    ...hold(B('b60.3'), B('b6.2'), 0),                  // 1950: rings gather, ignite on b5.1
    ...hold(B('b7.1'), B('b9.4'), sM('deepblue')),     // 1950 -> 1997 on the roll
    ...hold(B('b10.2'), B('b13.4'), sM('alphago')),
    ...hold(B('b15.1'), B('b16.4'), sM('imo2024')),    // up the slope through the lull
    ...hold(B('b17.1'), B('b18.4'), sM('imo2025')),
    ...hold(B('b19.1'), B('b20.4'), sM('erdos')),
    ...hold(B('b21.1'), B('b22.4'), sM('jacobian')),
    ...hold(B('b23.1'), B('b24.4'), sM('percolation')),
    ...hold(B('b33.1'), B('b38.4'), sNS),              // at the singular point through T*
    ...hold(B('b49.1'), B('b50.4'), sM('manuscripts')),
    ...hold(B('b51.1'), B('b52.4'), sM('yangmills')),
    ...hold(B('b53.1'), B('b53.4'), sM('eth_openai')), // breaks the first barrier on the hit
    ...hold(B('b54.1'), B('b54.4'), sM('eth_claude')), // and the second
    // the escape: up the asymptote and out of the top of the frame, for good
    [B('b55.2'), topS + 170], [B('b56.1'), endS], [T, endS],
  ];
  const headSpline = pchip(anchors.map((a) => a[0]), anchors.map((a) => a[1]));
  const headS = (t) => clamp(headSpline.f(t), 0, curve.length);
  const headP = (t) => curve.at(headS(t)).p.clone();
  ctx.headS = headS;
  ctx.B = B;

  // --------------------------------------------- the vortex: loop dive + event
  // Closing dive and opening pull-out, as log-distance to the singular point.
  // Velocity = steady drift + a surge on each stab (so the zoom lands on the beat
  // without ever stopping), then the opening keeps gliding inward before the pull-out.
  const stabs = beat.hits.filter((h) => h.t > B('b57.1', -0.2)).map((h) => h.t - T);
  stabs.push(0); // the final stab is frame 0
  const tauA = B('b57.1') - T - 0.3; // dive start (relative to the seam)
  const tauB = 4.6;                  // end of the opening table
  const D_PULL = 900, D_EYE = 0.11;
  const diveTable = (() => {
    const dt = 1 / 600, n = Math.ceil((tauB - tauA) / dt) + 1;
    const g = (x, s) => Math.exp(-0.5 * (x / s) * (x / s));
    const inward = (x) => {
      let v = 0.32 * smoothstep(tauA, tauA + 0.8, x);
      for (const s of stabs) v += 1.25 * g(x - s, 0.2);
      return v * (1 - smoothstep(0.15, 0.8, x));        // the glide inside the eye settles
    };
    const outward = (x) => 8.8 * g(x - 1.55, 0.28);      // the pull-out, ~x500 in half a second
    // scale the inward drift so the dive spans exactly D_PULL -> D_EYE at the seam
    let I = 0;
    for (let j = 0; j < n; j++) { const x = tauA + j * dt; if (x < 0) I += inward(x) * dt; }
    const kIn = (Math.log(D_PULL) - Math.log(D_EYE)) / I;
    const out = new Float64Array(n);
    out[0] = Math.log(D_PULL);
    for (let j = 1; j < n; j++) {
      const x0 = tauA + (j - 1) * dt, x1 = tauA + j * dt;
      const v = (x) => -kIn * inward(x) + outward(x);
      out[j] = out[j - 1] + 0.5 * (v(x0) + v(x1)) * dt;
    }
    return { dt, n, out };
  })();
  const logD = (x) => {
    const { dt, n, out } = diveTable;
    const u = clamp((x - tauA) / dt, 0, n - 1.000001), j = Math.floor(u), f = u - j;
    return out[j] * (1 - f) + out[j + 1] * f;
  };
  const loopWindow = (t) => t >= B('b57.1', -0.4) || t < B('b60.4');
  const diveD = (t) => Math.exp(logD(tau(t)));

  // centre of the full-curve pull-back
  const pullC = W(98, 152, 0);

  // the camera while diving: straight in from the full view, aiming at the vortex at
  // once; only when close does it swing over the top to look down the axis into the eye
  const diveEl = (d) => 1.36 * smoothstep(Math.log(70), Math.log(1.5), Math.log(d));
  const dive = (t) => {
    const x = tau(t);
    const d = Math.exp(logD(x));
    const w = ease.inOutCubic(clamp((x - tauA) / 1.3));
    const c = new THREE.Vector3().lerpVectors(pullC, PS, w);
    const look = new THREE.Vector3().lerpVectors(pullC.clone().add(W(0, 6, 0)), PS, w);
    const az = 0.32 * x * (x < 0 ? smoothstep(Math.log(60), Math.log(3), Math.log(d)) : 1 - smoothstep(0.6, 2.0, x));
    return sphere(c, d, az, x > 0 ? 1.36 : diveEl(d), lerp(40, 58, smoothstep(Math.log(120), Math.log(2), Math.log(d))), look);
  };

  // the opening fall: chase the rewinding head down the line, backing off with speed;
  // as it slows into 1950 the camera eases round to the front, ready for the ignition
  const fall = (t) => {
    const s = headS(t);
    // distance and side-swing by time (not by head speed), so they change monotonically
    const f = 1 - smoothstep(r0 + 0.95, r0 + 1.7, t);
    const d = lerp(7, 22, f);
    // the early weave is ignored (point and tangent projected to z = 0) so nothing wobbles
    const a = curve.at(s);
    const p = W(a.p.x, a.p.y, 0), tan = W(a.T.x, a.T.y, 0).normalize();
    const pos = p.clone().addScaledVector(tan, d * 0.35 * f).add(W(0, d * 0.3, d * 0.75 + 6.5 * (1 - f)));
    const look = p.clone().addScaledVector(tan, -d * 0.04 * f);
    return pose(pos, look, Y.clone(), 50, 0);
  };
  // 1950: the head rests at the centre of Shannon's rings; the camera swings from the
  // side round toward the rings' axis, so the ellipses open into a portal
  const p0 = curve.at(0).p.clone();
  const ignite = (t) => {
    const u = ease.inOutSine(smoothstep(B('b60.3'), B('b6.2'), t));
    return sphere(p0.clone().add(W(0.3, 0, 0)), lerp(10.5, 8.0, u), lerp(-0.25, 0.75, u), lerp(0.12, 0.2, u), lerp(46, 50, u), p0.clone().add(W(0.3, 0, 0)));
  };
  // travel shots: follow the moving head along the line, a little behind. phi places
  // the camera around the line: 0 = the +z side, pi = the -z side, pi/2 = above the curve
  const travel = ({ back = 6, side = 9, up = 2, ahead = 5, fov = 52, phi = () => 0 } = {}) => (t) => {
    const a = curve.at(headS(t));
    const p = W(a.p.x, a.p.y, 0), tan = W(a.T.x, a.T.y, 0).normalize();
    const nrm = W(-tan.y, tan.x, 0), f = phi(t);
    const off = W(0, 0, Math.cos(f) * side).addScaledVector(nrm, Math.sin(f) * side).add(W(0, up, 0));
    return pose(p.clone().addScaledVector(tan, -back).add(off), p.clone().addScaledVector(tan, ahead), Y.clone(), fov, 0);
  };

  // Navier–Stokes event: collapse to T* on the b37 downbeat, then the burst
  const tStar = B('b37.1');
  const t33 = B('b33.1');
  const collapse = (t) => {
    if (t < t33 || t > tStar + 3) return 1;
    if (t <= tStar) return Math.sqrt(Math.max(1 - (t - t33) / (tStar - t33), 0.003));
    return 0.055 + 0.945 * (1 - Math.exp(-(t - tStar) / 0.35));
  };
  const burst = (t) => { if (t < tStar) return 0; const x = (t - tStar) / 0.32; return 1.1 * x * Math.exp(1 - x); };
  const nsFlash = (t) => (t >= tStar ? Math.exp(-(t - tStar) / 0.2) : 0);
  // camera distance to the singular point during the event (inside: scale-locked)
  const eventD = (t) => {
    const outside = Math.exp(lerp(Math.log(36), Math.log(26), smoothstep(t33 - 0.4, B('b34.4'), t)));
    const inside = 1.5 * collapse(t) * (1 + 0.8 * burst(t));
    const k = smoothstep(B('b34.4', -0.2), B('b35.1', 0.2), t);
    const back = smoothstep(tStar + 0.2, B('b38.4'), t);
    return Math.exp(lerp(lerp(Math.log(outside), Math.log(inside), k), Math.log(28), back));
  };
  const eventEl = (t) => lerp(lerp(0.12, 0.3, smoothstep(t33, B('b34.4'), t)), 1.36, smoothstep(B('b34.4', -0.2), B('b35.1', 0.3), t)) - 1.0 * smoothstep(tStar + 0.3, B('b38.4'), t);
  const nsEvent = (t) => {
    const az = 3.45 + 0.28 * (t - t33); // continues the percolation orbit's azimuth
    return sphere(PS, eventD(t), az, eventEl(t), lerp(50, 58, smoothstep(B('b34.4'), B('b35.1'), t)), PS.clone().add(W(0, 2 * smoothstep(tStar, B('b38.4'), t), 0)));
  };

  // swirl schedule shared with the vortex (viewer scale, spin rate, collapse, burst)
  ctx.nsSwirl = (t) => {
    let L = 5, Omega = 0.45;
    if (loopWindow(t)) {
      const x = tau(t);
      L = Math.min(5, diveD(t));
      Omega = 0.6 + 3.6 * Math.exp(-0.5 * (x / 1.4) * (x / 1.4));
    } else if (t > t33 - 1.5 && t < B('b49.1')) {
      L = Math.min(5, eventD(t));
      Omega = t <= tStar ? lerp(0.6, 4.5, Math.pow(clamp((t - t33) / (tStar - t33)), 2)) : lerp(4.5, 0.5, smoothstep(tStar, tStar + 2.5, t));
    }
    const vis = t < B('b5.1') ? 1 : smoothstep(t33 - 1.6, t33 - 0.2, t);
    return { L, Omega, C: collapse(t), burst: burst(t), flash: 2 * nsFlash(t), vis };
  };
  ctx.nsSwirlClose = [B('b9.1'), B('b13.1')];

  // ------------------------------------------------------------- shots
  const at = (id) => curve.at(sY(YEARS[id]));
  const P = (id) => at(id).p.clone();
  const S = (a, b, t) => smoothstep(B(a), B(b), t);
  const orb = (center, { d0, d1 = d0, az0, az1 = az0, el0, el1 = el0, fov = 46, look = null, k = () => 0 }) => (t) => {
    const u = k(t);
    const d = Math.exp(lerp(Math.log(d0), Math.log(d1), u)), az = lerp(az0, az1, u), el = lerp(el0, el1, u);
    const c = typeof center === 'function' ? center(t) : center;
    const dir = W(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    return pose(c.clone().addScaledVector(dir, d), (look ? (typeof look === 'function' ? look(t) : look) : c).clone(), Y.clone(), fov, 0);
  };
  const frameOrb = (id, center, { radius, az0, az1 = az0, el0, el1 = el0, fov = 46, k, lookOff = W(0, 0, 0) }) => (t) => {
    const a = at(id), u = k(t);
    return orbit(center, { radius, az: lerp(az0, az1, u), el: lerp(el0, el1, u), fov, frame: a, look: center.clone().add(lookOff) });
  };
  const db = at('deepblue'), ag = at('alphago');
  const dbBoard = db.p.clone().addScaledVector(db.N, -1.32);
  const agBoard = ag.p.clone().addScaledVector(ag.N, -0.62);

  const track = new Track()
    // opening: inside the eye, pull out, then fall with the rewinding head
    .add(0, dive, { blend: 0 })
    .add(B('b59.4', 0.05), fall, { blend: 0.6 })
    .add(r0 + 1.3, ignite, { blend: 0.9 })
    // 1950 -> 1997: chase the head on the roll, landing over Deep Blue's board
    .add(B('b6.2', -0.4), travel({ back: 1, side: 9, up: 2.2, ahead: 3, fov: 54 }), { blend: 1.0 })
    // Deep Blue: low over the pieces, then rise to see the search tree burst
    .add(B('b7.1', -0.4), (t) => {
      const u = S('b7.1', 'b8.1', t);
      return pose(dbBoard.clone().add(W(lerp(-5.6, -4.2, u), lerp(1.7, 1.5, u), lerp(3.6, 3.0, u))), dbBoard.clone().add(W(0.6, 0.6, -0.2)), Y.clone(), 52, 0);
    }, { blend: 0.8 })
    .add(B('b8.1'), frameOrb('deepblue', dbBoard, { radius: 7.2, az0: Math.PI + 0.55, az1: Math.PI + 1.15, el0: 0.32, el1: 0.66, fov: 50, k: (t) => ease.inOutCubic(S('b8.1', 'b9.4', t)), lookOff: W(0, 1.4, 0) }), { blend: 1.6 })
    // 1997 -> 2016
    .add(B('b9.4', -0.2), travel({ back: 7, side: 9, up: 2.5, ahead: 6, phi: () => Math.PI }), { blend: 1.0 })
    // AlphaGo: high over the board
    .add(B('b10.2', -0.3), frameOrb('alphago', agBoard, { radius: 13, az0: Math.PI + 0.35, az1: Math.PI + 0.85, el0: 1.0, el1: 0.8, fov: 46, k: (t) => ease.inOutSine(S('b10.2', 'b13.4', t)) }), { blend: 1.0 })
    // 2016 -> 2024: follow the head up the steepening slope through the lull
    // (the camera swings over the line from the -z side to the +z side the IMO faces)
    .add(B('b13.4', -0.3), travel({ back: 9, side: 7, up: 1, ahead: 2, fov: 50, phi: (t) => Math.PI * (1 - ease.inOutSine(S('b13.4', 'b15.1', t))) }), { blend: 1.2 })
    // IMO 2024: square-on to the construction, close
    .add(B('b15.1', -0.2), orb(() => P('imo2024').add(W(2.1, -1.64, 0)), { d0: 17.5, d1: 16.4, az0: 0.06, az1: -0.05, el0: 0.03, el1: -0.02, fov: 46, k: (t) => S('b15.1', 'b17.1', t) }), { blend: 0.6, e: ease.inOutSine })
    // IMO 2025
    .add(B('b17.1', -0.4), orb(() => P('imo2025').add(W(2.2, 1.0, 0)), { d0: 17.5, d1: 16.6, az0: -0.06, az1: 0.06, el0: -0.03, el1: 0.03, fov: 46, k: (t) => S('b17.1', 'b19.1', t) }), { blend: 0.8 })
    .add(B('b19.1', -0.25), orb(P('erdos'), { d0: 9.2, d1: 8.2, az0: 0.5, az1: 1.2, el0: 0.66, el1: 0.5, fov: 46, k: (t) => S('b19.1', 'b21.1', t), look: P('erdos').add(W(0, 0.4, 0)) }), { blend: 0.9 })
    .add(B('b21.1', -0.4), orb(P('jacobian'), { d0: 14.2, d1: 12.6, az0: 1.7, az1: 2.4, el0: 0.14, el1: 0.06, fov: 46, k: (t) => S('b21.1', 'b23.1', t), look: P('jacobian').add(W(0, 1.6, 0)) }), { blend: 0.9 })
    .add(B('b23.1', -0.4), orb(P('percolation'), { d0: 18, d1: 9, az0: 2.8, az1: 3.6, el0: 0.42, el1: 0.2, fov: 48, look: P('percolation').add(W(0, 0.8, 0)), k: (t) => ease.inOutQuad(S('b23.1', 'b24.4', t)) }), { blend: 0.9 })
    // Navier–Stokes: outside, then inside the eye as it collapses to T*, then the burst
    .add(B('b24.4', 0.2), nsEvent, { blend: 1.0 })
    // 722 manuscripts: the card storm, then inside the helix tunnel
    .add(B('b49.1', -0.6), orb(P('manuscripts').add(W(0, -2, 0)), { d0: 26, d1: 19, az0: 0.9, az1: 1.3, el0: 0.1, el1: 0.05, fov: 50, k: (t) => S('b49.1', 'b49.4', t) }), { blend: 1.0 })
    .add(B('b49.4'), (t) => {
      const u = S('b49.4', 'b50.4', t);
      const c = P('manuscripts');
      return pose(c.clone().add(W(1.6, lerp(-15, -8, u), 0.8)), c.clone().add(W(0, 6, 0)), W(0.96, 0, 0.27), lerp(70, 64, u), 0);
    }, { blend: 1.5 })
    // Yang–Mills: around the bundle, close
    .add(B('b50.4', -0.6), orb(P('yangmills'), { d0: 11, d1: 8.5, az0: 0.2, az1: 0.8, el0: 0.2, el1: 0.12, fov: 48, k: (t) => S('b51.1', 'b53.1', t) }), { blend: 1.8 })
    // ETH: under the barriers looking up as the comets break through and escape
    .add(B('b52.4', -0.8), orb(P('eth_openai').add(W(0, -5, 0)), { d0: 12, d1: 14, az0: 0.55, az1: 0.85, el0: -0.5, el1: -0.44, fov: 54, k: (t) => S('b53.1', 'b55.1', t), look: P('eth_openai').add(W(0, 7, 0)) }), { blend: 1.6 })
    // pull back to the whole curve
    .add(B('b55.1', -0.2), (t) => {
      const u = ease.inOutCubic(smoothstep(B('b55.1', -0.2), B('b55.4'), t));
      const from = P('eth_openai').add(W(0, 6, 0));
      const c = new THREE.Vector3().lerpVectors(from, pullC, ease.inOutQuad(u));
      const d = Math.exp(lerp(Math.log(30), Math.log(D_PULL), u));
      const az = lerp(0.7, 0, u), el = lerp(-0.25, 0, u);
      return pose(c.clone().add(W(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(d)), c.clone().add(W(0, 6 * u, 0)), Y.clone(), lerp(52, 40, u), 0);
    }, { blend: 0.9 })
    .add(B('b57.1', -0.3), dive, { blend: 0.5 });

  // steadicam over everything except the analytic loop moves
  const camera = steady((t) => track.at(t), {
    sigma: (t) => 0.11 * smoothstep(B('b60.4'), B('b60.4', 0.5), t) * (1 - smoothstep(B('b57.1', -1.0), B('b57.1', -0.5), t)),
    wrap: (t) => beat.wrap(t),
  });
  // extra sub-frames whenever the camera is in or near the vortex (fast swirl)
  const minSub = (t) => (camera(t).pos.distanceTo(PS) < 12 ? 6 : 0);

  // ---------------------------------------------------------------- HUD: date
  const yearOfHead = (t) => curve.yearAt(headS(t));
  const date = new DateTrack([
    { t: 0, text: '2026.09.08' },
    { t: B('b59.4', -0.6), text: '2026', roll: 0.3 },
    { t: r0, value: (t) => Math.max(1950, Math.min(2026.68, yearOfHead(t))) },
    { t: B('b60.3'), text: '1950', roll: 0.01 },
    { t: B('b6.2'), value: (t) => Math.min(1996.999, Math.max(1950, yearOfHead(t))) },
    { t: B('b7.1', -0.5), text: '1997.05', roll: 0.5 },
    { t: B('b9.4'), value: (t) => Math.min(2015.999, Math.max(1997, yearOfHead(t))) },
    { t: B('b10.2', -0.5), text: '2016.03', roll: 0.5 },
    { t: B('b13.4'), value: (t) => Math.min(2023.999, Math.max(2016, yearOfHead(t))) },
    { t: B('b15.1', -0.5), text: '2024.07', roll: 0.5 },
    { t: B('b17.1', -0.5), text: '2025.07', roll: 0.5 },
    { t: B('b19.1', -0.5), text: '2026.05.20', roll: 0.5 },
    { t: B('b21.1', -0.5), text: '2026.07.20', roll: 0.5 },
    { t: B('b23.1', -0.5), text: '2026.08.28', roll: 0.5 },
    { t: B('b33.1', -0.5), text: '2026.09.08', roll: 0.5 },
    { t: B('b49.1', -0.5), text: '2026.10.06', roll: 0.5 },
    { t: B('b51.1', -0.5), text: '2026.10.27', roll: 0.5 },
    { t: B('b57.1'), text: '2026.09.08', roll: 0.01 },
  ], { roll: 0.5, stagger: 0.03 });

  const blocks = [
    ['shannon', B('b5.1'), B('b6.1')], ['deepblue', B('b7.1'), B('b9.4')], ['alphago', B('b10.2'), B('b13.4')],
    ['imo2024', B('b15.1'), B('b16.4')], ['imo2025', B('b17.1'), B('b18.4')], ['erdos', B('b19.1'), B('b20.4')],
    ['jacobian', B('b21.1'), B('b22.4')], ['percolation', B('b23.1'), B('b24.4')], ['navierstokes', B('b33.1'), B('b38.4')],
    ['manuscripts', B('b49.1'), B('b50.4')], ['yangmills', B('b51.1'), B('b52.4')], ['eth_openai', B('b53.1'), B('b53.4', 0.6)],
    ['eth_claude', B('b54.1'), B('b54.4', 0.6)],
  ].map(([id, t0, t1]) => ({ id, t0, t1, ...COPY[id] }));

  // ------------------------------------------------------------------- FX
  // No glitches, no flashes on beats: only slow bloom swells on the section downbeats
  // and the light of the blow-up itself.
  const swells = [B('b15.1'), B('b35.1'), B('b49.1')].map((g) => (Math.round(g * fps) - 0.5) / fps);
  const fx = (t) => {
    let swell = 0;
    for (const g of swells) { const d = t - g; if (d >= 0 && d < 2) swell = Math.max(swell, Math.exp(-d / 0.4)); }
    const ign = t >= B('b5.1') ? Math.exp(-(t - B('b5.1')) / 0.5) : 0;
    const f = nsFlash(t);
    return {
      bloom: 0.13 + swell * 0.08 + f * 0.3 + ign * 0.12,
      exposure: 1.0 + f * 0.15,
      ca: 0.0012,
      flash: 0,
      flashColor: new THREE.Color(1.0, 0.42, 0.36),
      vignette: 0.55,
      fade: 1,
      saturation: 1,
    };
  };

  // ------------------------------------------------------------------- state
  const state = (t, s) => {
    const rewind = t < B('b60.3');
    const ign = t >= B('b5.1') ? Math.exp(-(t - B('b5.1')) / 0.35) : smoothstep(B('b60.3'), B('b5.1'), t) * 0.25;
    // near plane follows the distance to the singular point while inside the vortex
    const dS = ctx.film.camera.position.distanceTo(PS);
    const near = clamp(dS * 0.02, 0.0012, 0.06);
    // no lines inside the vortex: around the loop the line and dot fade well before the
    // eye; during the event only once the camera is inside
    const inLoop = t >= B('b57.1', -0.4) || t < r0 + 1.0;
    const lineVis = inLoop ? smoothstep(45, 90, dS) : smoothstep(4, 14, dS);
    return {
      t, s,
      head: { size: 0.35 + ign * 0.3, glow: 1.4 + ign * 1.2, core: 6 + ign * 4, minPx: 22, maxPx: 52 + ign * 30, alpha: inLoop ? lineVis : 1, light: 2 },
      trailWidth: 2.2,
      trailFade: lineVis,
      trailDissolve: 0,
      rewind,
      milestoneTime: rewind ? t + T : t,
      trailGain: 1,
      starGain: 1,
      near,
      focus: 1 - smoothstep(3, 10, dS),
      fx: fx(t),
    };
  };

  // ------------------------------------------------------------------- HUD
  const drawHud = (t, hud, project, st) => {
    const dateAlpha = smoothstep(0.6, 1.1, t) * (1 - smoothstep(B('b55.1'), B('b55.1', 0.8), t));
    hud.odometer(date.cells(t), 540, 238, { size: 92, alpha: dateAlpha });
    for (const b of blocks) {
      if (t < b.t0 - 0.05 || t > b.t1 + 0.6) continue;
      const pin = ease.outCubic(clamp((t - b.t0) / 0.35)), pout = 1 - clamp((t - b.t1) / 0.35);
      const a = Math.min(pin, pout);
      if (a <= 0) continue;
      const rise = (1 - pin) * 14;
      hud.text(b.title, 540, 336 + rise, { family: 'Inter', size: 50, weight: 600, alpha: a, glow: 16 });
      wrap(hud, b.sub, 540, 394 + rise, 900, 27, a * clamp((t - b.t0 - 0.15) / 0.35), 38);
      if (b.chip) hud.chip(b.chip, 540, b.sub.length > 62 ? 492 : 454, { alpha: a * clamp((t - b.t0 - 0.35) / 0.3) });
    }
    // milestone annotations
    for (const m of ctx.film.milestones) if (m.labels) m.labels(t, hud, project, st);
    // pull-back copy
    const pa = envelope(t, B('b55.2'), B('b57.2'), 0.5, 0.45);
    if (pa > 0) {
      const pin = ease.outCubic(clamp((t - B('b55.2')) / 0.6));
      hud.text('1950 → 2026', 540, 238 + (1 - pin) * 14, { family: 'JBM', size: 76, weight: 300, alpha: pa, glow: 20 });
      hud.text('decades → years → months → days → hours', 540, 318, { family: 'Inter', size: 30, weight: 500, alpha: pa * 0.9 * clamp((t - B('b55.3')) / 0.5) });
      hud.text('Every frame rendered from code written by Claude', 540, 1640, { family: 'Inter', size: 26, weight: 400, alpha: pa * 0.72 * clamp((t - B('b55.4')) / 0.6) });
    }
    // the dive: the scaling law, then t -> T* as the eye closes in
    const x = tau(t);
    const da = envelope(x, -3.1, 0.35, 0.4, 0.3);
    if (da > 0) {
      hud.tex(ctx.assets.tex.ns_scale, 540, 1440, 50, { alpha: da * (1 - smoothstep(-1.6, -1.3, x)) });
      // t -> T* leads up to the loop point but is gone for its last frames and never
      // shows after it, so the seam itself is clean
      hud.tex(ctx.assets.tex.ns_tstar, 540, 1440, 54, { alpha: da * smoothstep(-1.4, -1.1, x) * (1 - smoothstep(-0.65, -0.35, x)) });
    }
  };

  return { headS, state, camera, drawHud, blocks, date, minSub };
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
