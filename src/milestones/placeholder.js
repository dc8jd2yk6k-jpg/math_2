import * as THREE from 'three';
import { base, lineMat } from './common.js';
import { ease } from '../core/math.js';

// v0 stand-in: a wireframe icosahedron threaded on the line, plus a label.
export function placeholder(ctx, id, label) {
  const m = base(ctx, id);
  const geo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(2.4, 1));
  const mat = lineMat();
  const mesh = new THREE.LineSegments(geo, mat);
  m.group.add(mesh);
  m.update = (t, st) => {
    const r = ease.outBack(m.reveal(t)) * m.alive(st);
    mesh.scale.setScalar(Math.max(1e-3, r));
    mesh.rotation.y = t * 0.3;
    mesh.visible = r > 0.01;
    mat.opacity = Math.min(1, r);
  };
  m.labels = (t, hud, project) => {
    if (!m.onStage(t)) return;
    const p = project(m.frame.p.clone().addScaledVector(m.frame.N, 3.2));
    if (p.visible) hud.label(label, p.x, p.y, { size: 28, alpha: 0.85 });
  };
  return m;
}
