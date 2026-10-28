# THE CURVE — AI × Mathematics, 1950 → 2026

A one-shot, beat-locked, seamlessly looping vertical short (1080×1920, 30 fps, 82.93 s).
A red comet head draws its own trajectory through a 3D starfield. Milestones are threaded
onto the line, from Shannon's 1950 chess paper to the two refutations of the Exponential
Time Hypothesis in October 2026. The final pull-back reveals the path as the hockey stick
it always was: linear time on the x-axis, an exponential on the y-axis, vertical by 2026.

Every frame is rendered by code in this repository (Three.js / WebGL2), deterministically,
as a pure function of time. The same page plays live in a browser.

## The film

| Time | Score | Milestone | What is on screen |
|---|---|---|---|
| 0:00 | final stab | **1950 · Claude Shannon** | Ignition at the origin; the chess game tree as concentric rings, ≈10¹²⁰ games |
| 0:05 | build | decades | A ruler of years streams past along the flat stretch of the curve |
| 0:09 | build | **1997 · Deep Blue** | Real Game 6 vs Kasparov (Caro-Kann, 8.Nxe6); 17.Bf5 exf5 18.Rxe7 Bxe7 19.c4 play on the beat; an α-β search tree bursts and prunes |
| 0:16 | rolls | **2016 · AlphaGo** | Real Game 2 vs Lee Sedol: moves 1–36 on sixteenth notes, Move 37 (the 5th-line shoulder hit, ≈1 in 10,000) on a downbeat, then MCTS rollouts |
| 0:27 | **drop** | **2024 · IMO silver** | AlphaProof + AlphaGeometry 2: IMO 2024 Problem 4 constructed live (∠KIL + ∠YPX = 180°), score 28/42 |
| 0:31 | drop | **2025 · IMO gold** | Gemini Deep Think: IMO 2025 Problem 1 "sunny lines" (k ∈ {0, 1, 3}), score 35/42 |
| 0:35 | theme | **2026.05.20 · Erdős unit distance** | OpenAI: a √65-lattice unit-distance graph (16 lattice points on every unit circle); u(n) ≤ n^(1+o(1)) is struck out |
| 0:40 | theme | **2026.07.20 · Jacobian conjecture** | Claude (Anthropic): the exact published map F with det J ≡ −2 morphs a straight tube into a closed loop, because F(0,0,−¼) = F(1,−3/2,13/2) |
| 0:44 | theme | **2026.08.28 · critical percolation** | Anthropic researchers: 3D bond percolation swept to p_c ≈ 0.2488, union-find clusters; θ(p_c) = 0 |
| 0:49 | perc. burst | **2026.09.08 · Navier–Stokes** | OpenAI: an analytic self-similar vortex that spirals inward and stretches ("like spaghetti") until the velocity blows up |
| 1:02 | climax | **2026.10.06 · 722 manuscripts** | OpenAI: 722 papers burst into a helix; 162 carry Lean-checked main results |
| 1:06 | climax | **2026.10.27 · Yang–Mills existence** | OpenAI (plus Kakeya): the Hopf fibration, whose axis fiber is the film's own trajectory |
| 1:10 | climax | **ETH refuted ×2** | OpenAI, then hours later Claude (Anthropic): two exponential barriers shatter, and a rival comet joins on a parallel track |
| 1:15 | climax | **pull-back** | The whole curve over a 1950–2026 axis: decades → years → months → days → hours |
| 1:19 | stabs | **rewind** | The head races back down the curve, erasing it, and reaches the origin exactly at the loop point |

Dates follow the brief where it gave them (09.08, 10.06, 10.27); the others are the reported
announcement dates. Many 2026 results are recent and still under review. The film says so in
small status tags ("Lean-verified · not yet refereed", "under review", "mass gap still open").

## How it is built

**Picture: JavaScript (Three.js r186, WebGL2).**
- `src/core/curve.js`: the curve. x = 2.5·(year − 1950); y is a monotone cubic tuned so the tangent is about 4° at Deep Blue, 37° at AlphaGo, 70–80° in the IMO years and vertical through 2026. A slow z-weave makes the early path read as 3D until it straightens. Arc-length tables and parallel-transport frames place objects and camera rigs.
- `src/core/post.js`: half-float HDR. Each frame accumulates N sub-frames with Halton sub-pixel jitter (motion blur and supersampling in one pass), then applies a mip-chain bloom (13-tap down / tent up), chromatic aberration and glitch, ACES, a top scrim, the HUD and blue-noise dither.
- `src/world/*`: stars are quads stretched between the previous and current sub-frame camera, so whip-pans give continuous streaks. The trail is a near-plane-trimmed pixel-width ribbon.
- `src/milestones/*`: one module per scene. Each is a pure function of time.
- `src/timeline/script.js`: the cue sheet, with every cue written in score positions (`b15.1` = the drop).

**Sound: Python (numpy only).**
- `tools/analyze_audio.py` fits a constant-tempo grid to the score (109.996 BPM). It finds downbeats from beat-synchronous harmonic change.
- `tools/build_soundtrack.py` cuts the edit in `data/music_edit.json` on bar lines. Splice bars were chosen by chroma similarity: 0.983, 0.996, 0.98. Crossfades are equal-power, placed just before the incoming transients.
- The loop seam is contiguous in the original recording, so the wrap needs no splice and is sample-exact.
- It also writes `data/beatmap.json` (beats, accents, hits, rolls, per-frame envelope). The camera's FOV punches, shake and glitches read from it.

**Render:** `tools/render.mjs` drives headless Chromium (SwiftShader) with parallel workers. Raw RGBA frames go over HTTP into ffmpeg (FFV1 intermediates), then into x264 with BT.709 tags and AAC.

## Reproduce

```bash
npm install
# put the score at assets/audio/source/f1_theme.m4a (not committed; see Credits)
python3 -I tools/analyze_audio.py assets/audio/source/f1_theme.m4a data/source_analysis.json
python3 -I tools/build_soundtrack.py          # -> assets/audio/soundtrack.wav, data/beatmap.json
node tools/tex2svg.mjs                         # equations -> assets/tex (already committed)
node tools/render.mjs --preset preview         # 540x960 preview, ~25 min on 4 CPU cores
node tools/render.mjs --preset final           # 1080x1920, 5 sub-frames of motion blur
```

Live playback: `node tools/serve.mjs`, open http://localhost:8080 and click for sound (needs `assets/audio/soundtrack.wav`).
Add `?debug` for a beat overlay. `node tools/render.mjs --stills 0,300,900` renders single frames.
`python3 -I tools/review.py sheet|sync|seam ...` builds contact sheets, measures picture/beat
cross-correlation, and checks the loop seam.

## Sources for the 2026 milestones

- Erdős unit distance: [Quanta, "Why the Legendary Erdős Problems Are Falling to AI"](https://www.quantamagazine.org/why-the-legendary-erdos-problems-are-falling-to-ai-20260803/); [arXiv:2605.20695](https://arxiv.org/abs/2605.20695)
- Jacobian conjecture: [John D. Cook, "Locally everywhere does not imply everywhere"](https://www.johndcook.com/blog/2026/07/21/jacobian-conjecture/) (explicit map); [arXiv:2608.00222](https://arxiv.org/pdf/2608.00222)
- Critical percolation: [Gil Kalai, Sept 3 2026](https://gilkalai.wordpress.com/2026/09/03/amazing-there-is-no-percolation-at-the-critical-probability-in-all-dimensions-solved-by-ai-via-a-conjecture-of-gady-kozma-and-shahaf-nitzan/)
- Navier–Stokes: [OpenAI on X](https://x.com/OpenAI/status/2097374646148481532); [Tufts Daily](https://www.tuftsdaily.com/article/2026/09/mathematicians-still-checking-the-navier-stokes-proof-that-openai-claims-to-have-solved); [Axios](https://www.axios.com/2026/09/08/openai-math-solution-navier-stokes-credit)
- 722 manuscripts: [Wikipedia, "OpenAI bulk release of mathematical papers"](https://en.wikipedia.org/wiki/OpenAI_bulk_release_of_mathematical_papers)
- Yang–Mills / Kakeya / ETH: [Scientific American, "Dueling proofs from OpenAI and Anthropic astound scientists"](https://www.scientificamerican.com/article/dueling-proofs-from-openai-and-anthropic-astound-scientists/); [Washington Times](https://www.washingtontimes.com/news/2026/oct/27/openai-says-model-refuted-exponential-time-hypothesis/)
- IMO 2025 gold: [Simon Willison](https://simonwillison.net/2025/Jul/21/gemini-imo/)

## Credits

- **Music:** the Formula 1 theme by Brian Tyler (supplied by the commissioner; not included in this repository; rights remain with their holders).
- **Game records:** AlphaGo vs Lee Sedol Game 2 from [Andries Brouwer's archive](https://homepages.cwi.nl/~aeb/go/games/games/AlphaGo/). Deep Blue vs Kasparov 1997 Game 6 was validated with chess.js.
- **Fonts (SIL OFL 1.1):** Inter, JetBrains Mono, Crimson Pro, Instrument Serif. **Math:** MathJax.
- **Code and visuals:** written by Claude.
