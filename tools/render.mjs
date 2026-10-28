// Offline renderer: headless Chromium (SwiftShader WebGL2) -> raw RGBA over HTTP
// -> ffmpeg. Frames are pure functions of time, so workers render disjoint ranges
// in parallel and the parts are concatenated losslessly before the final encode.
//
//   node tools/render.mjs --preset preview              # 540x960, 1 subframe, x264 parts
//   node tools/render.mjs --preset final --workers 2    # 1080x1920, motion blur, FFV1 parts
//   node tools/render.mjs --stills 0,300,900 --w 1080 --h 1920 --sub 4   # PNGs in work/stills
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // preinstalled; never npm-install it (browser build must match)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return acc;
}, []));
const PRESETS = {
  preview: { w: 540, h: 960, sub: 1, msaa: 4, workers: 2, codec: 'x264', out: 'work/preview.mp4' },
  final: { w: 1080, h: 1920, sub: 5, msaa: 4, workers: 2, codec: 'ffv1', out: 'dist/the-curve_1080x1920.mp4' },
};
const cfg = { ...(PRESETS[args.preset] || PRESETS.preview), ...Object.fromEntries(Object.entries(args).filter(([k]) => k !== 'preset')) };
const W = +cfg.w, H = +cfg.h, SUB = +cfg.sub, WORKERS = +cfg.workers;
const beatmap = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/beatmap.json'), 'utf8'));
const FRAMES = beatmap.frames, FPS = beatmap.fps;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wav': 'audio/wav',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.sgf': 'text/plain', '.pgn': 'text/plain' };

const sinks = new Map(); // worker id -> async (buffer) => void

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      try { await sinks.get(url.searchParams.get('w'))(Buffer.concat(chunks)); res.end('ok'); } catch (e) { res.statusCode = 500; res.end(String(e)); }
    });
    return;
  }
  const p = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; res.end(); return; }
  res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

function ffmpegSink(file, codec) {
  const enc = codec === 'ffv1'
    ? ['-c:v', 'ffv1', '-level', '3', '-pix_fmt', 'bgr0']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p'];
  const vf = codec === 'ffv1' ? 'vflip' : 'vflip,scale=out_color_matrix=bt709:out_range=tv';
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', vf, ...enc, file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  const write = (buf) => new Promise((resolve) => { if (ff.stdin.write(buf)) resolve(); else ff.stdin.once('drain', resolve); });
  return { write, close: async () => { ff.stdin.end(); await done; } };
}

function pngSink(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return (i) => async (buf) => {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', '-vf', 'vflip',
      path.join(dir, `f${String(i).padStart(5, '0')}.png`)], { input: buf });
    if (r.status !== 0) throw new Error('png encode failed');
  };
}

async function worker(id, frames, onFrame) {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1280), height: Math.min(H, 1280) }, deviceScaleFactor: 1 });
  let failed = null;
  page.on('pageerror', (e) => { console.error(`[w${id}] pageerror`, e); failed = e; });
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) console.error(`[w${id}] ${m.type()}: ${m.text()}`); });
  const q = `render&w=${W}&h=${H}&msaa=${cfg.msaa}${cfg.debug ? '&debug' : ''}`;
  await page.goto(`http://127.0.0.1:${PORT}/index.html?${q}`);
  for (let k = 0; k < 600 && !failed; k++) {
    if (await page.evaluate(() => window.__ready === true)) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (failed) throw failed;
  const t0 = Date.now();
  for (let k = 0; k < frames.length; k++) {
    const i = frames[k];
    sinks.set(String(id), onFrame(i));
    const tm = await page.evaluate(([i, o]) => window.renderFrame(i, o), [i, { subframes: SUB, shutter: +(cfg.shutter ?? 0.5), upload: `/frame?w=${id}` }]);
    if (k % 25 === 0 || k === frames.length - 1) {
      const el = (Date.now() - t0) / 1000;
      console.log(`[w${id}] ${k + 1}/${frames.length} frame ${i}  ${(el / (k + 1)).toFixed(2)} s/frame  eta ${((el / (k + 1)) * (frames.length - k - 1) / 60).toFixed(1)} min  [render ${tm[0].toFixed(0)} read ${tm[1].toFixed(0)} upload ${tm[2].toFixed(0)} ms]`);
    }
  }
  await browser.close();
}

const t0 = Date.now();
if (cfg.stills) {
  const list = String(cfg.stills).split(',').map(Number);
  const dir = path.join(ROOT, cfg.dir || 'work/stills');
  const mk = pngSink(dir);
  const per = Math.ceil(list.length / WORKERS);
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => list.slice(w * per, (w + 1) * per)).filter((l) => l.length)
    .map((l, w) => worker(w, l, (i) => mk(i))));
  console.log(`stills -> ${dir} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} else {
  const from = +(cfg.from ?? 0), to = +(cfg.to ?? FRAMES), step = +(cfg.step ?? 1);
  const all = []; for (let i = from; i < to; i += step) all.push(i);
  const per = Math.ceil(all.length / WORKERS);
  fs.mkdirSync(path.join(ROOT, 'work/parts'), { recursive: true });
  const ext = cfg.codec === 'ffv1' ? 'mkv' : 'mp4';
  const parts = [];
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => all.slice(w * per, (w + 1) * per)).filter((l) => l.length).map(async (l, w) => {
    const file = path.join(ROOT, `work/parts/part${w}.${ext}`);
    parts[w] = file;
    const sink = ffmpegSink(file, cfg.codec);
    await worker(w, l, () => sink.write);
    await sink.close();
  }));
  const list = path.join(ROOT, 'work/parts/list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const out = path.join(ROOT, cfg.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const rate = step === 1 ? [] : ['-r', String(FPS / step)];
  const audio = step === 1 && !cfg.noaudio ? ['-i', path.join(ROOT, 'assets/audio/soundtrack.wav')] : [];
  const vq = cfg.codec === 'ffv1'
    ? ['-vf', 'scale=out_color_matrix=bt709:out_range=tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(cfg.crf ?? 17), '-profile:v', 'high', '-tune', 'film']
    : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18'];
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', ...rate, '-i', list, ...audio,
    ...vq, '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    ...(audio.length ? ['-c:a', 'aac', '-b:a', '320k', '-map', '0:v', '-map', '1:a', '-shortest'] : []), '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('final encode failed');
  console.log(`-> ${cfg.out}  (${all.length} frames, ${((Date.now() - t0) / 60000).toFixed(1)} min)`);
}
server.close();
