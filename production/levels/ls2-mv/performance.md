# LS2-mv: movement-B prop cost (performance-analyst)

Verdict: **OK** (one SHOULD FIX, two NICE TO HAVE). Nothing BLOCKING. The Fold reading under D30 / S2-K1 is not taken here and still decides.

Scope: `src/render/moveprops.ts` (8 props), its call at `src/render/biomeart.ts:619`, and the terrain side (`src/terrainb.ts`, `rewriteTerrain` in `src/biomes.ts:172`).

## 1. Static cost per prop, per frame (W = 480, worst case = whole band on screen)

Columns are cells in view. Allocations: none in any loop (no arrays, closures, gradients or objects). `glow()` is a cached 64 px sprite `drawImage` (`util.ts:23-40`), not a gradient per call. `for (const q of [-22, 0, 22])` in `folds` allocates one 3-element array per column (see hot spots).

| Prop | Cells | Per cell | Frame total (worst) | Notes |
|---|---|---|---|---|
| crevasse (ice B0) | 480/36 = 14 | 2 beginPath, 2 stroke, 6 path verbs, 2 style sets | 28 strokes | strokes are the dear op; `ceilAt` and `hash` per cell |
| stairs (ice B1) | 4-5 | 7 fillRect, 3 fillStyle | ~35 fillRect | cheap |
| tank (acid B0) | 480/58 = 9 | 8 fillRect, 3 fillStyle, `Math.sin` | ~72 fillRect | the highest rect count |
| folds (acid B1) | 4-5 | 3 beginPath + quadraticCurve + stroke, 4 `ceilAt`, 1 fillRect, 1 array | ~14 strokes | |
| spires (fire B0) | 12 | 1 glow drawImage + 2 fillRect, 2 composite swaps | 12 drawImage, 24 fillRect, 24 `globalCompositeOperation` writes | composite switches cost more than the rects |
| chimney (fire B1) | 3-4 vents | 1 glow + ~8 rects (grille loop, 5 bars) | ~4 drawImage, ~40 fillRect | |
| throat (snot B0) | 480/85 + 1 = 7 | 4 fillRect, 2 style sets, `ceilAt` and `floorAt` | ~28 fillRect | no band cull but `fade()` returns 0 off band |
| polyps (snot B1) | 480/130 = 4 | 2 ellipse fill, 1 arc stroke, 3 beginPath | ~8 ellipse, 4 arc stroke | |

Zero `save`/`restore`, zero `createGradient`, zero `clip`. Worst prop is about 70 path-less rects or 28 strokes per frame.

Versus the existing decor (`drawBiomeDecor`, `biomeart.ts:462` to ~620): the fire branch alone draws a floor-seam polyline of 122 `lineTo` points (strokes twice), 18 slots of ellipse/glow/flame per 28 px column, and per-slot `save/translate/rotate/restore`; snot has a per-14 px column of strokes, ellipses and `pustule()` calls. The file has 125 `fill/stroke/beginPath` call sites. A movement-B prop adds roughly 5-15% to the decor's op count in the band and replaces nothing: the underlying decor still draws (lane did not skip it). Order of magnitude: decor several hundred canvas calls per frame, prop 30-100.

Terrain side: `rewriteTerrain` runs at stage build (`biomeStage`, `biomes.ts:359`), once per slot, over `FLOOR`/`CEIL` tiles from `from` to `tEnd`. It is not per frame. `gimmick()` adds 2 `vnoise` + a few `hash` per tile inside the band only (about 860 px band; tile step `TS`), well under a millisecond once. The per-frame readers are `ceilAt`/`floorAt` (unchanged table lookups). No steady-state terrain cost. Note `MOVES.length = 0` at `biomes.ts:448` resets on rebuild, fine.

## 2. Measured

No probe scene reaches a movement-B band: `tools/perf-probe.mjs` scenes sit at biome slot 0 stage-relative x 1000 (`floor`), or the densest 1500 px of the script (`peak`), and none take a scroll argument. So I wrote a scratch rig on the `floor` model (empty world, fork into the biome through `openFork`/`warmPump`, as `tools/movement-shots.mjs` does) that parks the scroll mid-band (world x 6165 to 6645 of band 5976-6834, long4, slot 0), forces the variant via `G.picks` (the forced-variant route the movement-shots rig uses), then times 300 frames of `step()` + `render()` after 30 discarded. It also times `drawMoveProps` alone (500 calls). Rig: `/tmp/claude-1000/-home-matt-Projects-grodius-ls2-mv/87314c23-b067-46e5-a6c4-ad42f07d8cc9/scratchpad/perf/band-probe.mjs`. Not `perf-probe.mjs` itself: it has no way to reach the band, so the rig is mine and its numbers are not comparable to ls1-k.md's `floor` table (11.5-13.7 ms; this rig reads about 5 ms for an empty frame because its world is emptier and JIT is warmer).

Conditions: headless desktop Chromium, ANGLE GL (Radeon 780M), 4x CPU throttle, 960x540, long4, empty world, one lock-held run at a time (flock, Tctl <= 80). Runs used: 4 of 4 (branch #1; main #1 crashed on `BI.MOVES` being undefined on main, a rig bug, fixed; main #2; branch #2 as a repeat for noise). **This is a proxy, not the Fold.** Raster time on the GPU thread is not in these numbers; they are JS plus canvas command recording.

Mean `step + render` ms per frame (avg of 300), branch is the mean of its two runs:

| cell | main | branch run 1 | branch run 2 | branch mean | delta |
|---|---|---|---|---|---|
| ice B0 | 5.05 | 5.63 | 6.12 | 5.88 | +0.83 |
| ice B1 | 4.90 | 4.87 | 5.00 | 4.94 | +0.04 |
| acid B0 | 4.41 | 5.95 | 5.22 | 5.59 | +1.18 |
| acid B1 | 4.09 | 4.74 | 5.06 | 4.90 | +0.81 |
| fire B0 | 5.54 | 5.83 | 6.28 | 6.06 | +0.52 |
| fire B1 | 4.98 | 5.33 | 5.87 | 5.60 | +0.62 |
| snot B0 | 4.81 | 5.38 | 5.44 | 5.41 | +0.60 |
| snot B1 | 4.95 | 4.79 | 5.34 | 5.07 | +0.12 |

p95 on branch 6.7-9.4 ms; on main 5.8-8.4 ms. Max frames 15.8-29.9 ms on branch and 16.0-24.4 ms on main (one-off spikes, no band signature).

Mean delta about +0.6 ms at 4x; the two branch runs differ from each other by up to 0.9 ms in a cell (ice B0 5.63 vs 6.12), so the delta is of the order of the run-to-run noise. Main was run once, so I can't bound its noise. Read it as "no visible cost, at most about 1 ms at 4x". Part of the delta is not the props: the gimmick terrain is different (a deeper acid lake, 36 px ice teeth, and so on), so the decor's per-column work on the edge changes with it.

Direct cost of `drawMoveProps` alone (avg per call, 4x throttle, mid-band, branch):

| cell | ms | cell | ms |
|---|---|---|---|
| ice B0 crevasse | 0.046 | fire B0 spires | 0.092-0.097 |
| ice B1 stairs | 0.016 | fire B1 chimney | 0.058 |
| acid B0 tank | 0.057-0.060 | snot B0 throat | 0.014-0.016 |
| acid B1 folds | 0.021-0.022 | snot B1 polyps | 0.018 |

Worst: fire spires, under 0.1 ms at 4x, so under 0.025 ms at 1x. Against 16.7 ms that is under 0.6% (at 4x: 0.6% of 16.7 ms). This agrees with the static count: the props are small. The caveat is that recording cost on a GPU-rasterised canvas understates fill cost; the fire props' additive glows and the full-height chimney `fillRect(x - half, 0, 28, c)` are the only fill-rate-visible items (a 28 x ~16 px rect, trivially small).

Not measured: a movement-B scene with enemies, elites and gibs (the S2-K1 scenes), the first-frame of band entry, Descent 2+, any real device. The prop adds a fixed 0.01-0.1 ms recording cost to a frame, so on top of S2-K1's 25-36 ms p95 (all misses, already open) it moves nothing that matters, and it will not change the Fold verdict.

## 3. Hot spots and fixes

1. **SHOULD FIX (cheap, hygiene): `folds()` allocates `[-22, 0, 22]` per cell per frame** (`moveprops.ts:68`). Violates `.claude/rules/engine-code.md` "no allocations in hot paths", though V8 usually keeps a literal array loop off the heap. Fix: hoist to a module `const FOLD_Q = [-22, 0, 22]` or unroll. Owner: engine-programmer. Cost: one line.
2. **NICE TO HAVE: `spires` swaps composite op twice per cell** (`moveprops.ts:81`, `lit()`/`flat()`, 24 writes per frame for 12 spires, the worst prop at about 0.09 ms). Fix: two passes, first all glows under one `lit()`, then all rects, or fold the glow into one `lit()` around the loop. Saves about half of the prop's cost; irrelevant unless the S2-K1 floor work wants every 0.1 ms. Owner: engine-programmer.
3. **NICE TO HAVE: `crevasse` does 2 `stroke()` per cell (28 per frame)** and recomputes `hash` and `ceilAt` each frame (`moveprops.ts:29-31`). If the S2-K1 floor cut (cache or lower-rate decor) goes ahead, the five static props (crevasse, stairs, tank, spires' rects, polyps) can bake with the biome decor; folds, throat, chimney, bead and glow motion are time-varying. Not worth doing on their own.
4. Culling: `fade()` zero-skips off-band cells and loops bound themselves to `[sc, sc + W]` and `[m.a, m.z]`. `throat` bounds by screen only (loop starts at `sc`, off band `fade` returns 0 so it only wastes a `fade` call). No culling work needed.
5. `drawMoveProps` itself iterates `MOVES` (at most 2 slots) per frame. Negligible. It also resets `globalAlpha = a` at the end; the loops leave `globalCompositeOperation` as `source-over` (checked: `flat()` after every `lit()`), so no state leak into later layers.

## Memory / budgets

No new canvases, sprites or caches; `glowSpr` entries reuse the existing colours cache (a new key per distinct colour string: `'255,110,20'` and `'255,90,20'` are two small 64x64 canvases, 32 KB, built on first use if no other fire draw has used those exact strings yet. That is a one-off build of well under 1 ms. I did not check whether `warmplan` or the fire decor already make them). NICE TO HAVE: if they are new, warm those two glow colours at boot.

## Method summary

Static op count from the source; terrain from `biomes.ts` and `terrainb.ts` (build-time only); measured with a scratch rig (4 probe runs, all under the shared lock), headless Chromium, 4x throttle, long4, empty world, main 7391234 export vs branch. Proxy for a phone, not the Fold. Raw run outputs in `/tmp/claude-1000/-home-matt-Projects-grodius-ls2-mv/87314c23-b067-46e5-a6c4-ad42f07d8cc9/scratchpad/perf/` (`br1.txt`, `br2.txt`, `main2.txt`).
