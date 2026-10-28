// Pre-render every on-screen equation to a self-contained white SVG (MathJax,
// glyphs as paths) plus a manifest with intrinsic sizes, so the browser can draw
// them at any scale without fonts or a TeX engine at render time.
//
//   node tools/tex2svg.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/tex');

export const EQUATIONS = {
  shannon: String.raw`\approx 10^{120}`,
  ns: String.raw`\partial_t u + (u\cdot\nabla)\,u = -\nabla p + \nu\,\Delta u,\qquad \nabla\cdot u = 0`,
  ns_blow: String.raw`\lVert u(t)\rVert_{\infty} \longrightarrow \infty \quad \text{as } t \to T^{*}`,
  ns_scale: String.raw`u(x,t)\;\longmapsto\;\lambda\,u(\lambda x,\,\lambda^{2} t)`,
  ns_tstar: String.raw`t \to T^{*}`,
  jac_F: String.raw`F(x,y,z)=\begin{pmatrix} z(1+xy)^3 + y^2(1+xy)(4+3xy) \\ y + 3x(1+xy)^2 z + 3xy^2(4+3xy) \\ 2x - 3x^2 y - x^3 z \end{pmatrix}`,
  jac_det: String.raw`\det J_F \equiv -2`,
  jac_eq: String.raw`F\!\left(0,0,-\tfrac14\right) = F\!\left(1,-\tfrac32,\tfrac{13}{2}\right) = \left(-\tfrac14,0,0\right)`,
  perc: String.raw`\theta(p_c) = 0`,
  perc_pc: String.raw`p_c \approx 0.2488`,
  erdos_old: String.raw`u(n) \le n^{1+o(1)}\ ?`,
  erdos_new: String.raw`u(n) \ge n^{1+\delta}`,
  ym: String.raw`S[A]=\frac{1}{4g^{2}}\int \operatorname{tr}\,F_{\mu\nu}F^{\mu\nu}\,d^{4}x`,
  eth: String.raw`\text{3-SAT} \in \mathrm{TIME}\!\left(2^{o(n)}\right)`,
  eth_wall: String.raw`2^{\delta n}`,
  imo24: String.raw`\angle KIL + \angle YPX = 180^{\circ}`,
  imo25: String.raw`k \in \{0,\,1,\,3\}`,
  alphago: String.raw`p \approx \tfrac{1}{10\,000}`,
  deepblue: String.raw`2\times 10^{8}\ \text{positions/s}`,
};

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const html = mathjax.document('', { InputJax: new TeX({ packages: AllPackages }), OutputJax: new SVG({ fontCache: 'none' }) });

fs.mkdirSync(OUT, { recursive: true });
const manifest = {};
for (const [name, tex] of Object.entries(EQUATIONS)) {
  const node = html.convert(tex, { display: true });
  let svg = adaptor.innerHTML(node);
  svg = svg.replace(/currentColor/g, '#ffffff');
  if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  const vb = svg.match(/viewBox="([-\d.\s]+)"/)[1].split(/\s+/).map(Number);
  const wEx = parseFloat(svg.match(/width="([\d.]+)ex"/)[1]);
  const hEx = parseFloat(svg.match(/height="([\d.]+)ex"/)[1]);
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  manifest[name] = { file: `assets/tex/${name}.svg`, wEx, hEx, viewBox: vb };
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(manifest, null, 1));
console.log(`${Object.keys(manifest).length} equations -> assets/tex`);
