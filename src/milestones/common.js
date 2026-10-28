// Shared scaffolding for milestone objects: placement on the curve frame, reveal
// timing from the cue sheet, and the end-of-loop dissolve.
import * as THREE from 'three';
import { YEARS } from '../core/curve.js';
import { CUES } from '../timeline/cues.js';
import { clamp, smoothstep } from '../core/math.js';

export function base(ctx, id, { yearOffset = 0, sOffset = 0 } = {}) {
  const s = ctx.curve.sOfYear(YEARS[id] + yearOffset) + sOffset;
  const frame = ctx.curve.at(s);
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  ctx.curve.matrixAt(s, group.matrix);
  group.matrixWorldNeedsUpdate = true;
  const [inL, outL] = CUES[id];
  const tIn = ctx.B(inL), tOut = ctx.B(outL, 1);
  return {
    id, s, frame, group, tIn, tOut,
    // 0 -> 1 as the object assembles around tIn (lead in seconds)
    reveal(t, lead = 0.6, dur = 0.9) { return t > ctx.beat.T - 4.2 ? 1 : clamp((t - (tIn - lead)) / dur); },
    // 1 -> 0 during the closing dissolve
    alive(st) { return 1 - (st.dissolve || 0); },
    local(v) { return v.clone().applyMatrix4(group.matrix); },
    onStage(t, pre = 0.4, post = 0.6) { return t >= tIn - pre && t <= tOut + post; },
  };
}

export const WHITE = new THREE.Color(0.95, 0.93, 0.95);

export function lineMat(color = WHITE, intensity = 1.6, opts = {}) {
  return new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(intensity), transparent: true, opacity: 1, depthWrite: false, ...opts });
}
