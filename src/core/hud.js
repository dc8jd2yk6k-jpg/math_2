// Screen-space typography, drawn with Canvas2D into a texture composited after
// tonemapping (crisp, never blooms).
// Layout is authored in a 1080x1920 design space and scaled to the render size.

import * as THREE from 'three';
import { clamp, ease, fract } from './math.js';

export class Hud {
  constructor(W, H) {
    this.W = W; this.H = H;
    this.k = H / 1920;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.premultiplyAlpha = true;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.NoColorSpace;
  }

  begin() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.W, this.H);
    c.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  end() { this.texture.needsUpdate = true; }

  font(family, size, weight = 400, style = 'normal') {
    this.ctx.font = `${style} ${weight} ${size}px ${family}`;
  }

  text(str, x, y, { family = 'Inter', size = 30, weight = 400, style = 'normal', color = '#f2f2f2', alpha = 1,
    align = 'center', baseline = 'middle', tracking = 0, glow = 0, glowColor = 'rgba(255,255,255,0.35)' } = {}) {
    if (alpha <= 0.002 || !str) return 0;
    const c = this.ctx;
    this.font(family, size, weight, style);
    c.letterSpacing = `${tracking}px`;
    c.textAlign = align; c.textBaseline = baseline;
    c.globalAlpha = clamp(alpha);
    if (glow > 0) { c.shadowColor = glowColor; c.shadowBlur = glow * this.k; }
    c.fillStyle = color;
    c.fillText(str, x, y);
    c.shadowBlur = 0;
    c.globalAlpha = 1;
    return c.measureText(str).width;
  }

  chip(str, x, y, { alpha = 1, size = 19, color = 'rgba(214,218,226,0.82)', border = 'rgba(214,218,226,0.38)' } = {}) {
    if (alpha <= 0.002) return;
    const c = this.ctx;
    this.font('JBM', size, 400);
    c.letterSpacing = '2.2px';
    const w = c.measureText(str).width + 34, h = size + 18;
    c.globalAlpha = clamp(alpha);
    c.strokeStyle = border; c.lineWidth = 1.4;
    c.beginPath();
    c.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    c.stroke();
    c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(str, x, y + 1);
    c.globalAlpha = 1;
  }

  // Odometer-style date. cells: [{from, to, u, alpha}] (single characters);
  // digits roll vertically through the intermediate values, others cross-fade.
  odometer(cells, cx, cy, { size = 92, color = '#ededed', alpha = 1, glow = 22 } = {}) {
    if (alpha <= 0.002) return;
    const c = this.ctx;
    this.font('JBM', size, 300);
    c.letterSpacing = '0px';
    const adv = c.measureText('0').width + size * 0.04;
    const widthCells = cells.reduce((acc, cl) => acc + clamp(cl.alpha ?? 1), 0);
    let x = cx - (widthCells * adv) / 2;
    const cellH = size * 1.05;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,255,255,0.28)'; c.shadowBlur = glow * this.k;
    c.fillStyle = color;
    for (const cl of cells) {
      const a = clamp(cl.alpha ?? 1) * alpha;
      const w = clamp(cl.alpha ?? 1) * adv;
      if (a > 0.002) {
        const mid = x + w / 2;
        const isD = (ch) => ch >= '0' && ch <= '9';
        c.save();
        c.beginPath();
        c.rect(mid - adv * 0.6, cy - cellH * 0.55, adv * 1.2, cellH * 1.1);
        c.clip();
        if (isD(cl.from) && isD(cl.to) && cl.from !== cl.to && cl.u > 0 && cl.u < 1) {
          let a0 = +cl.from, b0 = +cl.to;
          if (cl.back) { if (b0 > a0) a0 += 10; } else if (b0 < a0) b0 += 10;
          const v = a0 + (b0 - a0) * cl.u;
          const d0 = Math.floor(v), f = v - d0;
          for (let k = 0; k < 2; k++) {
            const digit = (((d0 + k) % 10) + 10) % 10;
            const yy = cy + (k - f) * cellH;
            const fade = 1 - Math.abs(k - f) * 0.65;
            c.globalAlpha = a * clamp(fade);
            c.fillText(String(digit), mid, yy);
          }
        } else if (cl.roll !== undefined) {
          // continuous odometer value (e.g. a running year digit)
          const v = cl.roll, d0 = Math.floor(v), f = v - d0;
          for (let k = 0; k < 2; k++) {
            c.globalAlpha = a * clamp(1 - Math.abs(k - f) * 0.65);
            c.fillText(String((d0 + k) % 10), mid, cy + (k - f) * cellH);
          }
        } else {
          const u = cl.from === cl.to ? 1 : clamp(cl.u);
          if (cl.from && cl.from !== cl.to && u < 1) { c.globalAlpha = a * (1 - u); c.fillText(cl.from, mid, cy); }
          if (cl.to) { c.globalAlpha = a * u; c.fillText(cl.to, mid, cy); }
        }
        c.restore();
      }
      x += w;
    }
    c.shadowBlur = 0;
    c.globalAlpha = 1;
  }

  // pre-rendered MathJax equation (see tools/tex2svg.mjs); reveal wipes left -> right
  tex(eq, x, y, height, { alpha = 1, align = 'center', reveal = 1, glow = 14 } = {}) {
    if (!eq || alpha <= 0.002 || reveal <= 0) return;
    const c = this.ctx;
    const w = (height * eq.wEx) / eq.hEx;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const y0 = y - height / 2;
    c.save();
    c.globalAlpha = clamp(alpha);
    if (reveal < 1) { c.beginPath(); c.rect(x0 - 6, y0 - height, (w + 12) * clamp(reveal), height * 3); c.clip(); }
    c.shadowColor = 'rgba(255,255,255,0.35)';
    c.shadowBlur = glow * this.k;
    c.drawImage(eq.img, x0, y0, w, height);
    c.restore();
  }

  label(str, sx, sy, { size = 30, family = 'Inter', weight = 500, style = 'normal', alpha = 1, dot = true, dx = 26, dy = 0,
    color = '#f4f4f4', align = 'left', dotColor = 'rgba(255,255,255,0.95)', glow = 10 } = {}) {
    if (alpha <= 0.002) return;
    const c = this.ctx;
    if (dot) {
      c.globalAlpha = clamp(alpha);
      c.fillStyle = dotColor;
      c.beginPath(); c.arc(sx, sy, 4.5, 0, Math.PI * 2); c.fill();
    }
    this.text(str, sx + dx, sy + dy, { size, family, weight, style, alpha, align, color, glow, glowColor: 'rgba(0,0,0,0.6)' });
  }
}

// ---------------------------------------------------------------- date track
// keys: [{t, text}] or [{t, value: (t)=>number, digits: 4}] for running years.
export class DateTrack {
  constructor(keys, { roll = 0.42, stagger = 0.05 } = {}) {
    this.keys = keys; this.roll = roll; this.stagger = stagger;
  }

  cells(t) {
    const K = this.keys;
    let i = 0;
    while (i + 1 < K.length && K[i + 1].t <= t) i++;
    const cur = K[i];
    if (cur.value) {
      const v = cur.value(t);
      return runningDigits(v, cur.suffix || '');
    }
    const prev = i > 0 ? K[i - 1] : null;
    const dur = cur.roll ?? this.roll;
    const u0 = prev ? (t - cur.t) / dur : 1;
    const fromText = prev ? (prev.value ? formatYear(prev.value(cur.t)) : prev.text) : cur.text;
    const toText = cur.text;
    const n = Math.max(fromText.length, toText.length);
    const out = [];
    for (let j = 0; j < n; j++) {
      const f = fromText[j] || '', to = toText[j] || '';
      const changed = f !== to;
      const local = changed ? ease.outCubic(clamp((u0 - (n - 1 - j) * this.stagger * (1 / dur)) / 1)) : 1;
      let alpha = 1;
      if (!f) alpha = local; else if (!to) alpha = 1 - local;
      out.push({ from: f, to: to || f, u: to ? local : 0, alpha, back: !!cur.back });
    }
    return out;
  }
}

export function formatYear(v) { return String(Math.floor(v)); }

// odometer digits for a continuously increasing value (lower digits carry upward)
function runningDigits(v, suffix) {
  const s = String(Math.floor(v));
  const cells = [];
  const frac = fract(v);
  for (let j = 0; j < s.length; j++) {
    const place = s.length - 1 - j;
    const unit = Math.pow(10, place);
    const digit = Math.floor(v / unit) % 10;
    // mechanical counter: the ones digit turns in the last fifth of each unit, and a
    // higher digit only turns while every lower digit rolls over from 9 to 0
    const ones = clamp((frac - 0.8) / 0.2);
    const carry = place === 0 ? ones : clamp(((v % unit) - (unit - 1) - 0.8) / 0.2);
    cells.push({ from: String(digit), to: String(digit), u: 1, roll: digit + carry, alpha: 1 });
  }
  for (const ch of suffix) cells.push({ from: ch, to: ch, u: 1, alpha: 1 });
  return cells;
}

export async function loadTex(url = 'assets/tex/index.json') {
  const man = await (await fetch(url)).json();
  const out = {};
  await Promise.all(Object.entries(man).map(([k, v]) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { out[k] = { ...v, img }; res(); };
    img.onerror = rej;
    img.src = v.file;
  })));
  return out;
}
