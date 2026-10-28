// The reveal: a time axis under the whole curve, 1950 -> 2026, with the present in red.
import * as THREE from 'three';
import { FatLines } from '../core/lines.js';
import { SX, YEAR0 } from '../core/curve.js';
import { clamp } from '../core/math.js';

export function pullback(ctx) {
  const B = ctx.B;
  const y = -16, x = (yr) => SX * (yr - YEAR0);
  const t0 = B('b55.1');
  const lines = [{ pts: [new THREE.Vector3(x(1947), y, 0), new THREE.Vector3(x(2029), y, 0)], t0, t1: t0 + 0.9, gain: 1.2, width: 1.6 }];
  for (let yr = 1950; yr <= 2020; yr += 10) {
    const big = (yr - 1950) % 20 === 0;
    lines.push({ pts: [new THREE.Vector3(x(yr), y, 0), new THREE.Vector3(x(yr), y + (big ? 3.2 : 1.8), 0)], t0: t0 + ((yr - 1950) / 80) * 0.9, t1: t0 + ((yr - 1950) / 80) * 0.9 + 0.15, gain: 1.2, width: 1.4 });
  }
  lines.push({ pts: [new THREE.Vector3(x(2026.8), y, 0), new THREE.Vector3(x(2026.8), y + 3.2, 0)], t0: t0 + 0.9, t1: t0 + 1.05, color: new THREE.Color(1, 0.15, 0.1), gain: 3, width: 2 });
  const axis = new FatLines(lines);
  const group = new THREE.Group();
  group.add(axis.mesh);
  const m = { id: 'pullback', group };
  m.update = (t, st) => axis.set(t, ctx, (t > t0 - 0.1 ? 1 : 0) * (1 - (st.dissolve || 0)));
  m.labels = (t, hud, project) => {
    if (t < t0) return;
    const a = clamp((t - t0 - 0.5) / 0.5) * (1 - (ctx.film.state.dissolve || 0));
    for (const yr of [1950, 1970, 1990, 2010, 2026]) {
      const p = project(new THREE.Vector3(x(yr === 2026 ? 2026.8 : yr), y - 7, 0));
      if (p.visible) hud.text(String(yr), p.x, p.y, { family: 'JBM', size: 30, weight: 400, alpha: a, color: yr === 2026 ? '#ff4a3a' : '#e6e6e6', align: 'center' });
    }
  };
  return m;
}
