// Staunton chess pieces from lathe profiles (radius, height) in units of one
// board square; the knight's head is an extruded, bevelled silhouette.
import * as THREE from 'three';

const V = (r, h) => new THREE.Vector2(r, h);
const baseProfile = [V(0, 0), V(0.39, 0), V(0.4, 0.03), V(0.39, 0.07), V(0.34, 0.09), V(0.35, 0.12), V(0.31, 0.15)];

const PROFILES = {
  p: [...baseProfile, V(0.22, 0.2), V(0.15, 0.32), V(0.13, 0.46), V(0.2, 0.5), V(0.21, 0.53), V(0.13, 0.56),
    V(0.17, 0.6), V(0.19, 0.67), V(0.17, 0.75), V(0.1, 0.8), V(0, 0.82)],
  r: [...baseProfile, V(0.27, 0.2), V(0.23, 0.3), V(0.21, 0.62), V(0.27, 0.66), V(0.29, 0.7), V(0.29, 0.86), V(0.22, 0.86), V(0.22, 0.8), V(0, 0.8)],
  b: [...baseProfile, V(0.24, 0.2), V(0.15, 0.38), V(0.12, 0.6), V(0.22, 0.64), V(0.23, 0.67), V(0.14, 0.7), V(0.17, 0.78),
    V(0.2, 0.9), V(0.17, 1.02), V(0.1, 1.1), V(0.05, 1.13), V(0.07, 1.16), V(0.06, 1.2), V(0, 1.21)],
  q: [...baseProfile, V(0.26, 0.2), V(0.17, 0.42), V(0.13, 0.78), V(0.24, 0.82), V(0.25, 0.86), V(0.15, 0.89), V(0.18, 0.96),
    V(0.27, 1.16), V(0.24, 1.2), V(0.12, 1.22), V(0.09, 1.26), V(0.08, 1.3), V(0, 1.31)],
  k: [...baseProfile, V(0.27, 0.2), V(0.18, 0.44), V(0.14, 0.84), V(0.25, 0.88), V(0.26, 0.92), V(0.15, 0.95), V(0.18, 1.0),
    V(0.24, 1.18), V(0.2, 1.24), V(0.08, 1.27), V(0, 1.28)],
};

function knightHead() {
  const s = new THREE.Shape();
  s.moveTo(-0.24, 0.0);
  s.lineTo(0.22, 0.0);
  s.bezierCurveTo(0.26, 0.18, 0.12, 0.3, 0.2, 0.42);
  s.bezierCurveTo(0.27, 0.5, 0.38, 0.5, 0.42, 0.56);
  s.bezierCurveTo(0.45, 0.62, 0.36, 0.7, 0.24, 0.74);
  s.lineTo(0.12, 0.84);
  s.lineTo(0.08, 0.92);
  s.lineTo(0.0, 0.84);
  s.bezierCurveTo(-0.2, 0.8, -0.3, 0.6, -0.28, 0.4);
  s.bezierCurveTo(-0.27, 0.25, -0.2, 0.14, -0.24, 0.0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.06, bevelSegments: 5, curveSegments: 14 });
  g.translate(0, 0.0, -0.06);
  return g;
}

export function pieceGeometry(type) {
  const k = type.toLowerCase();
  if (k === 'n') {
    const parts = [new THREE.LatheGeometry([...baseProfile, V(0.27, 0.2), V(0.25, 0.26), V(0, 0.26)], 40), knightHead().translate(0, 0.24, 0)];
    return mergeSimple(parts);
  }
  const g = new THREE.LatheGeometry(PROFILES[k], 48);
  if (k === 'k') {
    const v = new THREE.BoxGeometry(0.07, 0.26, 0.07).translate(0, 1.4, 0);
    const h = new THREE.BoxGeometry(0.2, 0.07, 0.07).translate(0, 1.42, 0);
    return mergeSimple([g, v, h]);
  }
  if (k === 'r') {
    const parts = [g];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(new THREE.BoxGeometry(0.1, 0.1, 0.12).translate(Math.cos(a) * 0.24, 0.9, Math.sin(a) * 0.24));
    }
    return mergeSimple(parts);
  }
  return g;
}

// minimal geometry merge (positions + normals), avoiding addon dependencies
function mergeSimple(geos) {
  const pos = [], nor = [];
  for (let g of geos) {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.push(...g.attributes.position.array);
    nor.push(...g.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
