// The chess era, 1950 -> 1997: Shannon's question answered piece by piece. An avenue
// of giant Staunton pieces on a dark chessboard road; each piece rises out of the
// board on an eighth note as the head approaches, so the flight to Deep Blue's board
// runs through a crowd of chess.

import * as THREE from 'three';
import { pieceGeometry } from './pieces.js';
import { clamp, ease, mulberry32, smoothstep, TAU } from '../core/math.js';
import { SX, YEAR0 } from '../core/curve.js';

const FLOOR_Y = -1.7;

function checker() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  const n = 64, m = 8, w = c.width / n, h = c.height / m;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    g.fillStyle = (i + j) % 2 ? '#6e5e50' : '#16120f';
    g.fillRect(i * w, j * h, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function chessera(ctx) {
  const { curve, B } = ctx;
  const rng = mulberry32(1957);
  const group = new THREE.Group();
  const m = { id: 'chessera', group };

  // the road: a long chessboard strip under the line, fading out at its edges
  const x0 = SX * (1951 - YEAR0), x1 = SX * (1996 - YEAR0);
  const fade = new THREE.ShaderMaterial({
    uniforms: { map: { value: checker() }, uAlpha: { value: 1 }, uLen: { value: x1 - x0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uAlpha; varying vec2 vUv;
      void main(){ vec3 c = texture2D(map, vUv).rgb; float e = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y) * smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
        gl_FragColor = vec4(pow(c, vec3(2.2)) * 1.6 * e * uAlpha, 1.0); }`,
    depthWrite: true,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 15), fade);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((x0 + x1) / 2, FLOOR_Y, 0);
  group.add(floor);

  const mats = {
    w: new THREE.MeshPhysicalMaterial({ color: 0xd8d0c2, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMap: ctx.envMap, envMapIntensity: 0.7 }),
    b: new THREE.MeshPhysicalMaterial({ color: 0x17171b, roughness: 0.26, clearcoat: 0.9, clearcoatRoughness: 0.12, envMap: ctx.envMap, envMapIntensity: 0.9 }),
  };
  const geos = {};
  const types = 'pppnbrqkpnbr';
  const pieces = [];
  let side = 1;
  for (let yr = 1953.2; yr < 1993.5; yr += 1.45 + rng() * 0.5) {
    const s = curve.sOfYear(yr);
    const a = curve.at(s);
    const type = types[Math.floor(rng() * types.length)];
    geos[type] ||= pieceGeometry(type);
    const color = side > 0 ? 'w' : 'b';
    const mesh = new THREE.Mesh(geos[type], mats[color]);
    const scale = 2.4 + rng() * 1.3;
    mesh.position.set(a.p.x + (rng() - 0.5) * 1.2, FLOOR_Y, a.p.z + side * (2.3 + rng() * 1.7));
    mesh.rotation.y = rng() * TAU;
    if (type === 'n') mesh.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(mesh);
    pieces.push({ mesh, s, scale, year: yr });
    side = -side;
  }
  // each piece rises on the eighth note before the head reaches it
  const hs = (t) => ctx.headS(t);
  const tOf = (s) => { // first time the head passes arc length s (bisection on the forward leg)
    let lo = B('b5.1'), hi = B('b8.1');
    for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (hs(mid) < s) lo = mid; else hi = mid; }
    return lo;
  };
  const eighth = ctx.beat.spb / 2;
  const b0 = B('b5.1');
  let timed = false; // the head schedule exists only once the script is built
  const timeRises = () => {
    for (const p of pieces) {
      const tArrive = tOf(Math.max(0, p.s - 11));
      p.tUp = b0 + Math.round((tArrive - b0) / eighth) * eighth;
    }
    timed = true;
  };

  const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
  key.position.set(-30, 40, 30);
  const fill = new THREE.DirectionalLight(0x8fa8ff, 0.6);
  fill.position.set(40, 10, -30);
  group.add(key, fill, key.target, fill.target);
  key.target.position.set(60, 0, 0); fill.target.position.set(60, 0, 0);

  const sStart = curve.sOfYear(1952), sEnd = curve.sOfYear(1994);
  m.update = (t, st) => {
    if (!timed) timeRises();
    const life = (st.rewind ? smoothstep(sStart, sEnd, st.s) : 1) * (1 - (st.focus || 0));
    const on = t > b0 - 0.1;
    group.visible = on && life > 0.001;
    if (!group.visible) return;
    fade.uniforms.uAlpha.value = life * clamp((t - b0) / 0.8);
    for (const p of pieces) {
      const k = ease.outBack(clamp((t - p.tUp) / 0.38));
      p.mesh.visible = k > 0.001;
      p.mesh.scale.setScalar(Math.max(0.001, p.scale * k * life));
    }
    const lit = t < B('b9.4') || t > ctx.beat.T - 1 ? 1 : 0;
    key.intensity = 2.2 * lit * life; fill.intensity = 0.6 * lit * life;
  };
  return m;
}
