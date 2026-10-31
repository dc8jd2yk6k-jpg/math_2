// Entry point. ?render -> deterministic frame server for tools/render.mjs
//              (default) -> live real-time playback synced to the soundtrack.
import * as THREE from 'three';
import { loadBeat } from './core/beat.js';
import { Film } from './film.js';
import { loadTex } from './core/hud.js';

const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 1080), H = +(P.get('h') || 1920);
const RENDER = P.has('render');

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, stencil: false, powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.autoClear = false;
renderer.toneMapping = THREE.NoToneMapping;

await Promise.all([
  '300 92px JBM', '400 20px JBM', '500 20px JBM', '400 27px Inter', '500 30px Inter', '600 50px Inter', '700 50px Inter',
  'italic 400 38px Crimson', 'italic 400 40px Instrument',
].map((f) => document.fonts.load(f)));

const beat = await loadBeat('data/beatmap.json');
const assets = { tex: await loadTex(), sgf: await (await fetch('data/alphago_leesedol_game2.sgf')).text() };
const film = new Film({ renderer, W, H, beat, assets, opts: { debug: P.has('debug'), samples: +(P.get('msaa') ?? 4) } });
window.film = film;

if (RENDER) {
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  window.renderFrame = async (i, opts = {}) => {
    const t0 = performance.now();
    film.renderFrame(i, opts);
    const t1 = performance.now();
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t2 = performance.now();
    if (opts.upload) {
      const r = await fetch(opts.upload, { method: 'POST', body: px });
      if (!r.ok) throw new Error(`upload failed ${r.status}`);
    }
    return [t1 - t0, t2 - t1, performance.now() - t2, film.lastSubframes];
  };
  window.__ready = true;
} else {
  canvas.style.cssText = 'height:100vh;width:auto;display:block;margin:0 auto;';
  // the score with the sound effects (tools/build_sfx.py), falling back to the score alone
  const audio = new Audio('assets/audio/soundtrack_mix.wav');
  audio.addEventListener('error', () => { audio.src = 'assets/audio/soundtrack.wav'; }, { once: true });
  audio.loop = true;
  const t0 = performance.now();
  const hint = document.createElement('div');
  hint.textContent = 'click to play with sound';
  hint.style.cssText = 'position:fixed;bottom:16px;left:0;right:0;text-align:center;color:#888;font:14px Inter,sans-serif';
  document.body.appendChild(hint);
  addEventListener('click', () => { audio.currentTime = 0; audio.play(); hint.remove(); }, { once: true });
  const tick = () => {
    const t = audio.paused ? ((performance.now() - t0) / 1000) % film.T : audio.currentTime;
    film.renderFrame(t * film.fps, { subframes: 1 });
    requestAnimationFrame(tick);
  };
  tick();
}
