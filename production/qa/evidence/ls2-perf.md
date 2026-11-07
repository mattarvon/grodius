# LS2 wave 1, lane ls2-perf: the S2-K1 frame-time fix (D30)

Owner roles: performance-analyst + engine-programmer, with technical-artist for the gib sprites. Branch `ls2-perf`, off main `7391234`.

## Result

| Item | Status |
|---|---|
| **Fix 1: gib shapes baked to sprites** | **Done.** The heavy-kill frame (230 gibs) renders 29% faster. The look matches (technical-artist). |
| **Fix 2: floor cost** | **Done.** Empty-biome render is 35-45% faster. Fire's heat shimmer has fewer blits. flushLo is explained (see below). |
| **Fix 3: S3-K2, the Drive's `buildMass`** | **Done.** 37 slices, max 23.9-28.9 ms at 4×. It was 1 slice of 504-640 ms. The art is pixel-identical. |
| **Fix 4: warm-up gaps** | **Done.** The gate now holds through Orbit's "SOMETHING IS COMING" and through the Drive's WARNING-to-boss frames. A behavioural test covers the Maw single rupture. |
| **p95 ≤ 16.7 ms at 4×** | **Still MISSED in every cell and every pair.** Mid8 p95 is down about 17-21% (pairs 23.9-32.4 → 20.4-27.8 ms). Next named fixes and the Fold steps are below. |
| Harness, parity | **Identical.** No re-baseline. `layout-parity.mjs` needed a stub fix to finish its 3×3 run; the reasoning is below. |

## What changed

| File | Change |
|---|---|
| `src/render/gibart.ts` (new) | The gib atlas. Every solid gib shape is painted once into one canvas: 2× supersampled, 6 size buckets, 4 polygon variants, one blood-coloured cell set per gore palette, and 2 skull sizes. `gibCell(q, pal)` maps a gib to its cell using spawn fields only. A colour that was never baked falls back to a flesh cell, so it can't crash a frame. |
| `src/fx/gibcols.ts` (new) | `GIB_FLESH` and `GIB_METAL`: one colour list shared by `gib()` and the atlas. The spick order is unchanged, so the render stream is unchanged. |
| `src/render/gore.ts` | `drawGibs`: chunk, skin, metal, skull, tooth, bone and limb gibs are one `setTransform` + `drawImage` each. Image smoothing is on only while sprites draw. Ropes, eye tails, eyeballs and split halves stay vector. The split half moved into `drawHalf()` unchanged. |
| `src/fx/spawn.ts` | `gib()` reads its colours from `gibcols.ts`. |
| `src/biomes.ts` | `C0` (the default gore palette) is exported for the atlas. |
| `src/render/warmup.ts` | `startWarm()` builds the atlas in the first idle slot (logged as `gibs`). `UNITS` is untouched. |
| `src/render/terrain.ts` | `drawBG`: when a biome is at full strength its sky is opaque, so the stars, JWST sky, Neptune, Triton and derelict under it are skipped. |
| `src/render/biomeart.ts` | Fire heat shimmer: neighbouring strips with the same offset blit as one run. Same pixels. |
| `src/render/gross/drive.ts` | `buildMass` became `massSteps()`, a generator that yields every 16 rows of mottling. `stepMass()` carries the render RNG position across slices; `warmDrive()` steps it. |
| `src/warmplan.ts` | `warmBlocked` also holds while the scroll is in a stage's lead-in: `row.warnX ≤ scroll < row.bossX`. That covers Orbit's "SOMETHING IS COMING" to the Maw, and the Drive's WARNING to `startBoss`. |
| `tools/layout-parity.mjs` | The canvas stub also no-ops `setTransform`, `save`, `restore`, `translate`, `rotate`, `scale`, `clip` and `transform`. **Shared gate; see "Parity tool change".** |
| `tools/gore-shots.mjs` (new) | A rig that shoots the same seeded heavy kill and Maw death on every run. |
| `tests/unit/gibart.test.ts`, `mawrupture.test.ts`, `fakecanvas.ts` (new) | Atlas coverage, palettes and packing. The behavioural Maw test. A do-nothing DOM for tests that must import canvas code. |
| `tests/unit/warmplan.test.ts`, `rng-split.test.ts` | Lead-in gate cases on long4 and short. The source-regex Maw test is replaced by `mawrupture.test.ts`. rng-split now pins `gibart.ts` into its scan. |

Render-only throughout. No sim file draws differently, `gib()` makes the same `srnd()` calls in the same order, and the gate reads run state only.

## Perf tables

Host: Ryzen 9 8945HS, Radeon 780M (ANGLE GL), 4× CPU throttle, `WARM_MS=20000`, long4. These are K's scenes and kit. **Before** is a copy of main `7391234` and **after** is this branch. Each had its own no-watch Vite server, they ran back to back in the same session, and every heavy job ran under the lock with a heat check.

**Frozen-frame A/B: the most reliable number.** The same staged frame is rendered 150× and the table shows median / p95 render ms. Two sessions, with the run order reversed between them.

| frame | before | after | before (2nd) | after (2nd) |
|---|---|---|---|---|
| heavy kill, 230 gibs | 15.1 / 20.8 | 11.9 / 16.9 | 14.9 / 19.1 | 10.6 / 13.7 |
| empty ice | 4.4 / 6.8 | 3.0 / 4.3 | 4.6 / 6.5 | 2.6 / 3.8 |
| empty acid | 3.4 / 5.5 | 1.9 / 3.2 | 3.5 / 5.0 | 2.0 / 3.3 |
| empty fire | 4.9 / 7.5 | 3.1 / 4.8 | 5.1 / 7.7 | 3.1 / 4.7 |
| empty snot | 4.9 / 7.1 | 2.9 / 4.9 | 5.0 / 7.0 | 2.9 / 4.6 |

**"Midboss + 8 incoming", p95 step+render ms (target 16.7).** K is K's ls1-k table. Run 1 and run 2 are this lane's two back-to-back before/after pairs; run 2 ran the after build first.

| cell | K | before r1 | after r1 | before r2 | after r2 |
|---|---|---|---|---|---|
| choir@ice | 35.2 | 33.0 | 24.9 | 32.3 | 27.0 |
| choir@acid | 30.9 | 26.5 | 22.2 | 25.3 | 22.6 |
| choir@fire | 36.2 | 29.7 | 27.4 | 27.4 | 27.1 |
| choir@snot | 35.5 | 38.0 | 26.3 | 32.6 | 25.8 |
| cyst@ice | 33.1 | 29.2 | 22.1 | 27.7 | 21.0 |
| cyst@acid | 27.4 | 26.4 | 24.2 | 28.3 | 21.0 |
| cyst@fire | 30.1 | 29.3 | 22.3 | 25.4 | 23.8 |
| cyst@snot | 33.7 | 34.9 | 27.7 | 30.0 | 23.7 |
| prentice@ice | 30.6 | 31.5 | 22.7 | 28.2 | 23.5 |
| prentice@acid | 26.3 | 27.4 | 20.4 | 25.8 | 19.9 |
| prentice@fire | 36.2 | 29.2 | 22.0 | 29.1 | 22.3 |
| prentice@snot | 32.6 | 29.8 | 22.5 | 31.4 | 24.2 |
| brood@ice | 28.0 | 27.9 | 24.4 | 27.7 | 22.7 |
| brood@acid | 24.8 | 27.2 | 19.1 | 23.2 | 22.3 |
| brood@fire | 30.3 | 30.4 | 23.2 | 27.5 | 23.3 |
| brood@snot | 36.1 | 32.3 | 32.1 | 31.0 | 29.2 |
| **mean** | 31.7 | 30.2 | 24.0 | 28.3 | 23.7 |
| **pairs (24)** | 25.5-36.2 | 26.5-35.8 | 20.1-31.0 | 23.9-32.4 | 20.4-27.8 |

Every cell and every pair is still a MISS.

**Empty biome (`floor`): avg / p95 ms.** Floor p95 is the 15th-worst of 300 back-to-back frames, which makes it GC-sensitive. Read the average.

| biome | K p95 | before r1 | after r1 | before r2 | after r2 |
|---|---|---|---|---|---|
| ice | 13.7 | 7.2 / 11.0 | 5.4 / 8.0 | 6.8 / 9.7 | 4.6 / 7.0 |
| acid | 11.7 | 6.9 / 10.0 | 6.3 / 13.6 | 6.2 / 9.3 | 4.1 / 5.9 |
| fire | 12.9 | 8.3 / 12.1 | 5.4 / 7.8 | 7.8 / 10.8 | 5.1 / 8.5 |
| snot | 11.5 | 7.3 / 11.0 | 4.7 / 6.9 | 6.6 / 9.4 | 4.9 / 7.4 |

**Peak density with elites (`peak`): p95 / avg.**

| biome | K | before r1 | after r1 | before r2 | after r2 |
|---|---|---|---|---|---|
| ice | 36.3 / 23.5 | 33.7 / 20.3 | 23.5 / 16.3 | 25.2 / 17.4 | 22.5 / 14.6 |
| acid | 31.4 / 20.0 | 28.2 / 19.3 | 23.0 / 15.8 | 23.2 / 16.9 | 25.5 / 16.2 |
| fire | 34.8 / 22.3 | 35.7 / 23.7 | 25.5 / 16.9 | 24.8 / 18.0 | 23.3 / 16.1 |
| snot | 30.1 / 19.5 | 29.9 / 19.1 | 20.7 / 14.5 | 21.1 / 15.0 | 19.6 / 13.7 |

**Real long4 flights (`route`): p95 / avg / max.** Three flights per build, alternating.

| | ice+acid before | ice+acid after | fire+snot before | fire+snot after |
|---|---|---|---|---|
| flight 1 | 33.8 / 22.3 / 173.9 | 27.3 / 17.9 / 89.1 | 36.5 / 23.6 / 203.0 | 35.7 / 22.7 / 116.5 |
| flight 2 | 28.4 / 19.5 / 100.0 | 30.7 / 20.3 / 96.1 | 33.2 / 22.0 / 87.7 | 30.9 / 20.6 / 92.2 |
| flight 3 | 30.0 / 20.8 / 96.0 | 27.8 / 19.1 / 97.0 | 30.7 / 21.8 / 93.9 | 29.8 / 20.2 / 81.7 |
| WARNING p95 (range) | 24.4-30.8 | 23.1-25.1 | 26.1-36.6 | 25.4-27.6 |
| slices in a WARNING | 0 | 0 | 0 | 0 |
| canvases, boot → peak | 11.1 → 14.8 MB | 17.0 → 20.3 MB | 11.1 → 14.7 MB | 17.0 → 20.5 MB |

On real flights the gain is smaller and within flight-to-flight spread. A flight spends most frames in moderate scenes, and the big wins are in gib-heavy frames.

**The Maw's first 60 frames: an unexplained rise, flagged.** first60max, in ms, from the same flights:
- ice+acid Maw: before 36.9, 78.3, 60.3; after 69.4, 75.1, 33.1.
- fire+snot Maw: before 60.6, 31.7, 42.2; after 106.2, 68.5, 74.0.
- Median of all six: before about 51, after about 72.

It is the max of 60 frames, so one GC or compile spike sets it, and the routes' midboss picks vary between flights (see caveats). Even so, five of six after-readings sit at the top of the before range. Nothing in the diff touches Maw art. The atlas and the route art are built long before the Maw arrives (boot log and slice log). **Not located.** The Fold steps add a Maw arrival check.

**Boot slices at 4× (after):**

| slice | count | total ms | max ms |
|---|---|---|---|
| gibs (atlas, new) | 1 | 14.7-27.5 | |
| hero | 1 | 0.4 | |
| eyes | 7 | 100 | 34.6 |
| derelict | 1 | 14.7 | |
| maw:orbit | 1 | 2.9 | |
| ufo | 5 | 3.3 | |
| **drive** | **37** | **526** | **23.9** |

Before, the Drive was 6 slices with a max of 503.8 (K) / 639.9 ms.

**The gib atlas costs 5.9 MB of canvas** (11.1 → 17.0 MB at boot). Peak is 20.5 MB against the proposed 64 MB, and decoded images are still not counted. If the Fold is short on memory, two cheap cuts: build only the default palette plus the route's palettes (about -40%), or use 3 variants (-25%).

**Profile, brood@snot** (ELITE=2, XHOST=snot, long4, both builds in the same session). Inclusive share of the frame, with step and render ms:

| function | before | after |
|---|---|---|
| render avg / p95 | 25.4 / 34.9 | 19.2 / 26.4 |
| drawGibs | 22.2% | 15.6% (includes drawHalf 6.6%, booms, mist) |
| flushLo | 14.6% | 16.8% |
| drawBG | 7.1% | under 1% (not in the top list) |
| drawHUD | 6.8% | 8.6% |
| drawShots | 6.3% | 8.2% |
| drawShip | 5.6% | 7.1% |
| drawTerrain | 4.8% | 6.2% |
| present | 4.6% | 5.3% |

Shares rise for what was not touched, because the frame shrank.

**flushLo.** `flushLo` draws `lo` onto the display canvas. That forces Chrome to flush every 2D op recorded on `lo` so far, so the frame's recorded drawing is billed to `flushLo`. Its share is the same in empty and heavy frames (15-18%), so it scales with the op count rather than the blit. It has no separate fix, and every cut above shrinks it too.

## Look (art) and pixel checks

- Retained before/after screenshots, same seeded scene. Before is main; after is this branch with the final atlas:
  - `ls2-perf-heavy-f40-{before,after}.png`
  - `ls2-perf-heavy-f240-{before,after}.png`
  - `ls2-perf-maw-f30-{before,after}.png`
  - `ls2-perf-maw-f90-{before,after}.png`

  I looked at all of them, and so did technical-artist at 3-8× zoom.
- `drawBG` skip and fire shimmer: a pixel diff against base on 4 biomes × 2 frames shows **0 differing pixels**. Under screen shake only, a 3-game-px edge strip (6 display px) shows black where stray sky used to show.
- Drive mass slicing: Drive fight frame against base, **0 of 518,400 pixels differ** (`ls2-perf-drive-sliced-mass.png`).
- Remaining look changes, all small and accepted by technical-artist:
  - 4 polygon variants per colour/size, not a unique polygon per gib;
  - a fading gib fades as one sprite;
  - 1 px details scale with the size bucket (at most 1/1.3);
  - gibs over size 7.4 would upscale; none spawns that large.

## Acceptance

| Criterion | Result |
|---|---|
| Fix 1: drawGibs does no per-gib vector work for solid gibs; the look matches | **Met.** Ropes, eye tails and split halves stay vector by design. Halves are the next fix. |
| Fix 2: floor cut; flushLo looked at | **Met.** Floor render 35-45% lower (frozen A/B). flushLo explained above. |
| Fix 3: S3-K2 sliced | **Met.** 37 slices, max 23.9 ms at 4×. Pixel-identical art. |
| Fix 4: gate holds on "SOMETHING IS COMING" and through the Drive's ~40-frame gap; Maw rupture test | **Met.** `warmplan.test.ts` (long4 + short, pause, null guard). `mawrupture.test.ts` fails with the old bug (31 ruptures vs 1) and with the off-screen check removed. `warngate`: 0 slices in 170 frames. Real flights: 0 slices in 6 × ~1,025 WARNING frames. |
| Render-only: harness and parity identical | **Met.** Gates below; no re-baseline. |
| No RNG leaks | **Met.** rng-split covers `gibart.ts`. `gib()` draws the same `srnd()` sequence. A 400-frame render-stream fingerprint (srnd state + fx counts per frame) is identical to base. |
| K's table re-taken, before/after side by side | **Done**, above. |
| p95 ≤ 16.7 ms | **MISSED** in all 16 cells and all 24 pairs. See next fixes. D30 judges it on the Fold. |

## Gates (final source)

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npx vitest run` | 31 files, 561 tests pass |
| `npm run build` | pass (exit 0) |
| `npm run test:regress` | 14 × PASS: short `vs baseline @ 8ff9ba4`, `(long4) @ 88d9525`, and all 12 scenarios `@ 5c8c3eb`. No re-baseline. Canvas hashes differ (advisory), as on K's base. |
| `node tools/layout-parity.mjs` | `PARITY PASS`: runs 3, 6, 7, 11, 15, 3x3 and 7m identical, exit 0. The patched tool against base `7391234` also passes, exit 0. |

## Parity tool change (shared gate: read this)

**What.** `layout-parity.mjs` stubs canvas draw calls (`fill`, `drawImage`, and the rest). It now also stubs the transform and state ops: `setTransform`, `save`, `restore`, `translate`, `rotate`, `scale`, `clip` and `transform`. It is a 3-line diff, and the comment explains it.

**Why.** With every draw stubbed, Chrome never flushes the canvas recording, so state ops accumulate for the whole run. I measured this with a memory-logging copy of the tool on the 3×3 run (seed 3, 3 descents):

| build | renderer memory at the end | outcome |
|---|---|---|
| base, old stub | 2627 MB | passes, near the limit |
| this branch, old stub | 3239 MB | tab crashed ("Target crashed") in Descent 3, twice |
| this branch, new stub | 397 MB, flat | passes |

The atlas's per-gib `setTransform` added enough to tip a pre-existing build-up over the edge. This is a tool artefact: **it is not a game memory leak.** In the game, draws flush the recording.

**Why it can't hide a sim change.** The tool compares sim state, spawn traces, terrain hashes and the music plan, and none of them reads canvas state. The stubbed methods all return `undefined` natively. The only behaviour change is that `getTransform()` stays at identity, and only render/fx read it (`eyes.ts`, `gore.ts`, `fxsprites.ts`), which rng-split keeps off the sim RNG.

Verdicts were unchanged:
- **Base:** PARITY PASS with the patched tool.
- **This branch:** all seven runs identical.

**Harness.** `tools/harness.mjs` draws for real and reads pixels, so it does not have this problem. Any future tool that stubs draws but not state ops will.

qa-lead and devops-engineer should see this in the batched review.

## Studio agents on this lane

| Agent | What it reviewed | What it changed (applied by me) |
|---|---|---|
| **performance-analyst** | The tables, profile, method and flushLo | **Block:** gate evidence was missing from the review pack. I re-ran every gate on the final source, plus parity of the patched tool against base. **Should-fix:** route picks differed between before and after. They come from the unseeded probe: base itself flew different fire+snot picks on two flights, so this is not a leak; it is now a stated caveat. **Should-fix:** before/after profiles were not like-for-like (short vs long4); both are now long4 in the same session. **Notes acted on:** three alternating route flights per build; frozen A/B with the run order reversed; floor read by average; the translate-only invariant commented in `drawGibs`; atlas memory and the gibs boot slice recorded; next named fixes; Fold steps. |
| **technical-artist** | The 8 before/after screenshots and `gibart.ts` | The look matches; no block. **Should-fix:** bones under size 2.5 were drawn too long, so they now bake from 1.5. **Should-fix:** the skull was baked at one size, so a spinning size-3 skull could lose its teeth; it now bakes at 3.4 and 4.2. **Notes acted on:** the buckets comment now gives the measured 5.9 maximum; a header says only `C.blood`/`C.bloodD` vary per palette; tests require every biome to have a unique `blood[0]`; one shared colour list (`gibcols.ts`); unknown colours fall back to flesh instead of crashing. |
| **qa-tester** | `mawrupture`/`fakecanvas`, the gibart and warmplan tests, the parity change, rng-split | No block. **Should-fix:** the escape test passed for the wrong reason. It is renamed, and a new off-screen-kill case fails when the `x` check is removed. **Should-fix:** test setup moved into `beforeEach`. **Should-fix:** the brittle source-string colour test is replaced by `gibcols.ts`. **Should-fix:** all 3 metal colours are now checked. **Should-fix:** the parity stub had an unused `const o`, now removed, and its comment says which render code reads `getTransform`. **Notes acted on:** `unstubAllGlobals` in `afterAll`; a fakecanvas header on why it uses `stubGlobal` and what not to assert through it; `try/finally` around the `C.blood` swap; the overlap test walks every cell (`gibCells()`); warmplan pause, null and short-layout cases; rng-split pins `gibart.ts`. |

## Next named fixes (from the after profile)

1. **`drawHalf`, about 6.6%.** Snapshot each split corpse once at split time into an offscreen canvas holding both clipped halves plus the edge, then blit it. A dead body's art is frozen anyway. Owner: engine-programmer; technical-artist signs off. It touches how midboss halves draw (`DRAW[e.k]` through `gore.ts`), so it should follow LS2-0's `render/gross/mid/<kind>.ts` move. The midboss draw files need no change.
2. **`drawHUD`, about 8.6%.** Cache slow-changing HUD text in a canvas and redraw it only when its value changes. Owner: ui-programmer.
3. **`drawShots` (8.2%) and `drawDecals` (5.4%).** Batch by colour into one path, or bake shot sprites.

performance-analyst estimates these three together at 15-20% of render: p95 in the high teens to about 20 ms. **Render trimming alone may not reach 16.7 ms at 4× on this host**, and 4× has never been validated as a stand-in for the Fold. If the Fold reads well, D30 can close S2-K1 on the Fold number and keep the 4× table as a tracking metric.

## Fold reading (Matt): updated steps

Use `ls1-k.md`'s steps (deployed page in Chrome with `?perf`, `__perf()` through `chrome://inspect`), and add:
1. **The same day, before and after.** Read the current Pages build first, then this build once deployed, both on `?layout=short` (D30's comparison) and on long. Note both build hashes, and note the phone's temperature or the time since unlock.
2. **Gib-heavy stretch, twice on each build:** a midboss death plus a big chain kill. Note p95 and max.
3. **Maw arrival and death in Orbit:** the readout max in the first second after it appears and in the 2 s after the kill. This checks the unexplained first-60-frame rise above.
4. **`__warm()` after boot:** the `gibs` and `drive` slices should finish before Orbit's lead-in. Record their ms on the phone; the atlas cost on ARM is unmeasured.
5. **A biome fade:** watch the sky through one fade-in and fade-out for a pop when the skip switches on at full strength, and look for a black edge during screen shake.
6. **Memory:** in `chrome://inspect`, check the tab's memory after one descent to put a number next to the 6 MB atlas.

## What I did not measure

- Anything on the Fold, and any GPU or compositor time: the probe times main-thread step + render only.
- Run-to-run spread past 2 runs per build for mid8, floor and peak, and 3 flights for route. Spread in a single cell is wide: base brood@snot read 31.0-45.5 across four runs today.
- The cause of the Maw first-60-frame rise.
- Biome slot 1 in mid8, peak and floor (staged at slot 0, as in K). Descent 2+ and the resume path through the new gate.
- Real-device memory for the atlas, and boss deaths other than the Maw in screenshots.

## Caveats on the tables

- **Route picks vary between flights**, because the perf probe doesn't seed `Math.random`. Base flew fire+snot with two different pick sets.
- **Mid8, floor and peak ran base first in r1 and after first in r2.** Frozen A/B ran in both orders.
- **The earliest base run of the day** (`before-mid8`) had broken fonts on a strict Vite server, so it is not in the table.

## Stubs and open risks

- **No stubs.**
- **The Maw first-60-frame rise** (above) is open.
- **The gib atlas only follows `C.blood` and `C.bloodD`.** An LS4 biome that recolours bone or flesh needs a new palette axis in `gibart.ts`; its header says so. A biome without a `blood` array fails a unit test.
- **The parity tool change** needs qa-lead and devops-engineer eyes in the batched review.
- **On every source edit, restart Vite** (or use a no-watch server) before trusting a probe. A hot reload served `?t=` module copies, so the probe's input module was a different instance and the ship stopped firing. That cost a false "sim moved" scare early in this lane. `perf-probe.mjs`'s header already warns about this.

## Merge-order notes

- After LS2-0, as the brief says. No midboss draw file and no `UNITS` entry is touched.
- `warmup.ts` changes only `startWarm()` and one import. The gate change is in `warmplan.ts`.
- The registry lane's per-kind warm entries go in `UNITS`. The gib atlas is not a `UNITS` entry, so they don't collide.
- `layout-parity.mjs`'s stub list is the only shared-tool edit. A lane that re-records the parity baseline should take it first.
