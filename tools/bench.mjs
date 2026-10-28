// Profile per-component GPU cost of a frame inside headless Chromium.
//   node tools/bench.mjs --w 540 --h 960 --frame 330
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') && acc.push([x.slice(2), arr[i + 1]]), acc), []));
const W = +(a.w || 540), H = +(a.h || 960), F = +(a.frame || 330);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream'); fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?render&w=${W}&h=${H}&msaa=${a.msaa ?? 4}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
const res = await page.evaluate(async (F) => {
  const film = window.film, gl = film.r.getContext(), r = film.r;
  const one = new Uint8Array(4);
  const sync = () => { r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, one); };
  const time = (fn, n = 2) => { fn(); sync(); const t0 = performance.now(); for (let i = 0; i < n; i++) { fn(); sync(); } return +((performance.now() - t0) / n).toFixed(0); };
  const out = {};
  const sc = film.scene, t = F / 30;
  film.evaluate(t);
  const sceneOnly = () => { film.post.beginFrame(); film.post.addSubframe(sc, film.camera, 1); };
  out.full_frame = time(() => film.renderFrame(F, { subframes: 1 }));
  out.scene_all = time(sceneOnly);
  const toggle = (obj, v) => { obj.visible = v; };
  toggle(film.stars.mesh, false); out.scene_no_stars = time(sceneOnly); toggle(film.stars.mesh, true);
  toggle(film.trail.mesh, false); out.scene_no_trail = time(sceneOnly); toggle(film.trail.mesh, true);
  toggle(film.head.mesh, false); out.scene_no_head = time(sceneOnly); toggle(film.head.mesh, true);
  const ms = film.milestones.map((m) => m.group);
  ms.forEach((g) => (g.visible = false)); out.scene_no_milestones = time(sceneOnly); ms.forEach((g) => (g.visible = true));
  sc.children.forEach((c) => (c._v = c.visible, c.visible = false)); out.scene_empty = time(sceneOnly); sc.children.forEach((c) => (c.visible = c._v));
  const g = film.stars.mesh.geometry, all = g.instanceCount;

  const u = film.stars.material.uniforms;
  const prev = u.uVPPrev.value.clone(); u.uVPPrev.value.copy(u.uVP.value); out.stars_no_streak = time(sceneOnly); u.uVPPrev.value.copy(prev);
  out.bloom = time(() => film.post.bloom());
  out.composite = time(() => { r.setRenderTarget(null); film.post.composite.render(r); });
  out.hud_draw_upload = time(() => { film.hud.begin(); film.script.drawHud(t, film.hud, (v) => film.project(v, film.camera), film.state); film.hud.end(); film.post.u.tHud.value = film.hud.texture; r.setRenderTarget(null); film.post.composite.render(r); });
  const px = new Uint8Array(film.W * film.H * 4);
  out.readpixels_full = time(() => gl.readPixels(0, 0, film.W, film.H, gl.RGBA, gl.UNSIGNED_BYTE, px));
  return out;
}, F);
console.log(JSON.stringify(res, null, 1));
await browser.close(); server.close();
