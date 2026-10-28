# THE CURVE — AI × Mathematics, 1950 → 2026

A one-shot, beat-locked, seamlessly looping vertical short (1080×1920, 30 fps, 82.93 s).
A red comet head draws its own trajectory through a 3D starfield. Milestones are threaded
onto the line, from Shannon's 1950 chess paper to the two refutations of the Exponential
Time Hypothesis in October 2026. The final pull-back reveals the path as the hockey stick
it always was: linear time on the x-axis, an exponential on the y-axis, vertical by 2026.

**The loop is a singularity.** The film ends by diving into the Navier–Stokes vortex
(2026.09.08) and opens inside it. Navier–Stokes is invariant under
u(x, t) → λ·u(λx, λ²t): zooming in by λ is the same as running time λ² faster. So the
vortex is built scale-free (log-uniform radii, logarithmic spiral arms, swirl ∝ 1/r²),
the closing dive is an approach to the blow-up time T*, and the loop point *is* T*. From
frame 0 the picture runs backwards: the camera rises out of the eye, the head rewinds
down the whole line while the date rolls back, and Shannon's game tree ignites in 1950 on
the next downbeat.

Every frame is rendered by code in this repository (Three.js / WebGL2), deterministically,
as a pure function of time. The same page plays live in a browser.

## The film

| Time | Score | Milestone | What is on screen |
|---|---|---|---|
| 0:00 | final stab | **inside the vortex** | The dive continues into the eye of the Navier–Stokes vortex, the same picture at every scale; "2026.09.08" |
| 0:02 | roll | **rewind** | The camera rises out; the head drops back through the vortex and races down the line, erasing it, as the date rolls back to 1950 and every milestone flashes past |
| 0:05 | build | **1950 · Claude Shannon** | Ignition on the downbeat: the chess game tree as concentric rings, ≈10¹²⁰ games |
| 0:06 | build | chess era | An avenue of giant Staunton pieces rises on eighth notes as the head flies to Deep Blue |
| 0:09 | build | **1997 · Deep Blue** | Real Game 6 vs Kasparov (Caro-Kann, 8.Nxe6); 17.Bf5 exf5 18.Rxe7 Bxe7 19.c4 play on the beat; an α-β search tree bursts and prunes |
| 0:16 | rolls | **2016 · AlphaGo** | Real Game 2 vs Lee Sedol: moves 1–36 on sixteenth notes, Move 37 (the 5th-line shoulder hit, ≈1 in 10,000) on a downbeat, then MCTS rollouts |
| 0:24 | lull | 2017 → 2023 | One gate per year around the steepening line |
| 0:27 | **drop** | **2024 · IMO silver** | AlphaProof + AlphaGeometry 2: IMO 2024 Problem 4 constructed live (∠KIL + ∠YPX = 180°), score 28/42 |
| 0:31 | drop | **2025 · IMO gold** | Gemini Deep Think: IMO 2025 Problem 1 "sunny lines" (k ∈ {0, 1, 3}), score 35/42 |
| 0:35 | theme | **2026.05.20 · Erdős unit distance** | OpenAI: a √65-lattice unit-distance graph (16 lattice points on every unit circle); u(n) ≤ n^(1+o(1)) is struck out |
| 0:40 | theme | **2026.07.20 · Jacobian conjecture** | Claude (Anthropic): the exact published map F morphs a straight tube into a closed loop, because F(0,0,−¼) = F(1,−3/2,13/2); small cubes along it map through J into parallelepipeds of exactly twice the volume (det J ≡ −2) |
| 0:44 | theme | **2026.08.28 · critical percolation** | Anthropic researchers: 3D bond percolation swept to p_c ≈ 0.2488, union-find clusters; θ(p_c) = 0 |
| 0:49 | perc. burst | **2026.09.08 · Navier–Stokes** | OpenAI: the vortex spirals inward and stretches; the camera rides inside its eye, scale-locked, as the core collapses toward T*; the head reaches the singular point on the downbeat and the core bursts |
| 1:02 | climax | **2026.10.06 · 722 manuscripts** | OpenAI: 722 papers burst into a helix tunnel; 162 carry Lean-checked main results |
| 1:06 | climax | **2026.10.27 · Yang–Mills existence** | OpenAI (plus Kakeya): the Hopf fibration, whose axis fiber is the film's own trajectory |
| 1:10 | climax | **ETH refuted ×2** | OpenAI, then hours later Claude (Anthropic): two exponential barriers shatter, and a rival comet joins on a parallel track |
| 1:14 | climax | **escape** | The head leaves the top of the frame for good |
| 1:15 | climax | **pull-back** | The whole curve over a 1950–2026 axis: decades → years → months → days → hours |
| 1:19 | stabs | **the dive** | Back into the Navier–Stokes vortex, one zoom surge per stab: u(x,t) → λu(λx, λ²t), t → T* |

Dates follow the brief where it gave them (09.08, 10.06, 10.27); the others are the reported
announcement dates. Many 2026 results are recent and still under review. The film says so in
small status tags ("Lean-verified · not yet refereed", "under review", "mass gap still open").

## How it is built

**Picture: JavaScript (Three.js r186, WebGL2).**
- `src/core/curve.js`: the curve. x = 2.5·(year − 1950); y is a monotone cubic tuned so the tangent is about 4° at Deep Blue, 37° at AlphaGo, 70–80° in the IMO years and vertical through 2026. A slow z-weave makes the early path read as 3D until it straightens. Arc-length tables and parallel-transport frames place objects and camera rigs.
- `src/core/post.js`: half-float HDR. Each frame accumulates N sub-frames with centred Halton sub-pixel jitter (motion blur and supersampling in one pass), then applies a mip-chain bloom (13-tap down / tent up), a fixed chromatic aberration, ACES, a top scrim, the HUD and blue-noise dither.
- `src/core/camera.js`: shots are pure functions of time; consecutive shots blend along an arc around the aim point, and a steadicam filter (Gaussian over ±0.27 s, wrap-aware) removes any remaining corner. There is no shake, no FOV punch and no glitch: the beat lives in the objects (moves, stones, cards, rising pieces, shattering barriers) and the HUD. `tools/camcheck.mjs` checks every frame and the seam for angular speed, acceleration and direction reversals.
- `src/world/*`: stars are quads stretched between the previous and current sub-frame camera, so whip-pans give continuous streaks. The trail is a near-plane-trimmed pixel-width ribbon.
- `src/milestones/*`: one module per scene. Each is a pure function of time.
- `src/timeline/script.js`: the cue sheet, with every cue written in score positions (`b15.1` = the drop).

**Sound: Python (numpy only).**
- `tools/analyze_audio.py` fits a constant-tempo grid to the score (109.996 BPM). It finds downbeats from beat-synchronous harmonic change.
- `tools/build_soundtrack.py` cuts the edit in `data/music_edit.json` on bar lines. Splice bars were chosen by chroma similarity: 0.983, 0.996, 0.98. Crossfades are equal-power, placed just before the incoming transients.
- The loop seam is contiguous in the original recording, so the wrap needs no splice and is sample-exact.
- It also writes `data/beatmap.json` (beats, accents, hits, rolls, per-frame envelope); the zoom surges of the closing dive land on its hits.

**Render:** `tools/render.mjs` drives headless Chromium (SwiftShader) with parallel workers. Raw RGBA frames go over HTTP into ffmpeg (FFV1 intermediates), then into x264 with BT.709 tags and AAC.

## Master

`dist/the-curve_1080x1920.mp4`: H.264 High, 1080×1920, 30 fps, 2488 frames, two-pass 8.6 Mbps,
BT.709, AAC 256 kbps; video and audio are both 82.933 s. Rendered in 120 min on 4 CPU cores
(SwiftShader). Loop wrap difference sits at the 82nd percentile of ordinary frame changes;
`node tools/camcheck.mjs` reports no direction reversals over all frames and the seam.

## Reproduce

```bash
npm install
# put the score at assets/audio/source/f1_theme.m4a (not committed; see Credits)
python3 -I tools/analyze_audio.py assets/audio/source/f1_theme.m4a data/source_analysis.json
python3 -I tools/build_soundtrack.py          # -> assets/audio/soundtrack.wav, data/beatmap.json
node tools/tex2svg.mjs                         # equations -> assets/tex (already committed)
node tools/render.mjs --preset preview         # 540x960 preview, ~25 min on 4 CPU cores
node tools/render.mjs --preset final           # 1080x1920, 4-16 adaptive sub-frames of motion blur
node tools/camcheck.mjs                        # camera smoothness over every frame and the seam
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
