# LS1-B1: render RNG split (M2 #13)

*engine-programmer, 2026-11-01. Branch `ls1-b1` off main `f2f9c03`. Code commit `98adeb4`.*

## What changed

Render and fx draw their randomness from a separate render stream, `srnd()`. The sim RNG `R()` (that is, `Math.random`, which the harness seeds) is now drawn only by the sim. Before this change, every particle, flicker and hell-flash scribble also pulled from the sim stream. So the sim depended on:

- the frame rate (`render()` runs once per animation frame, not once per step);
- which render paths ran (sprite load timing, HELL FLASHES);
- how many gibs happened to land.

| File | Change |
|---|---|
| `src/srnd.ts` (new) | Pure module: `srnd()` (the existing xorshift32, same seed), plus `srr`, `sri` and `spick`, the srnd versions of core's `rr`, `ri` and `pick` |
| `src/sprites.ts` | Its local `srnd` becomes `export { srnd } from './srnd'`, so there is still a single render stream and existing callers are untouched |
| `src/render/{bullets,enemies,hell,hud,screens,ship,shipparts}.ts`, `src/fx/{gunfx,spawn,update}.ts` | 180 call sites move from `R/rr/ri/pick/Math.random()` to `srnd/srr/sri/spick`. These are the plan's 11 files with `fx/fxsprites.ts`, which was already on srnd. The plan estimated ~106 draws; the real count is 180 |
| `src/audio.ts` | **Outside the row's file list** (roadmap #13 names `audio.ts:213`). Its 9 `R/rr` draws move to audio's existing `ar()` stream. See "Why audio" below |
| `tests/unit/rng-split.test.ts` (new) | The required test |
| `tools/rng-probe.mjs` (new) | Runtime proof across every boss and midboss fight |
| `tools/harness.mjs` | New `--flashes off` option. The harness now also errors if the setting didn't reach `SET.flashes` |
| `tools/harness.baseline.json` | The single re-baseline (below) |
| `.claude/rules/sim-determinism.md` | "The one random stream" becomes "Two random streams"; the list of known offenders is gone |

**Why audio.** The first after-run of the probe still had 4 of 10 fights differ between rendered and unrendered play. A Math.random trace found **no** draws inside `render()`. A per-frame diff then showed the sim stream shifting at a hatch spawn. The cause:

- `sfx.drip()`, `sfx.gore()` and `sfx.chain()` evaluate `rr(...)` as `tone()`/`nz()` arguments *before* those return early with no AudioContext.
- Drips and gib landings are fx, now timed by srnd, and srnd is shared with render.
- So render timing reached the sim through audio.

Without the audio fix, the "render/fx can't reach the sim" claim would be false.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Test fails if render or fx imports the sim RNG | **PASS.** `tests/unit/rng-split.test.ts` scans every `.ts` under `src/render` and `src/fx`, plus `src/audio.ts`. It fails on a named import of `R`/`rr`/`ri`/`pick` from core, a namespace import of core, or any `Math.random`. A self-test shows each form is flagged. **I watched it fail on the old code**: 17 hits across all 10 files. It passes on the new code |
| `st` identical between flashes ON and OFF | **PASS.** `node tools/harness.mjs --flashes off` gives `PASS vs baseline` with `st` byte-identical to the flashes-on baseline. The 60 s harness never reaches a corridor, core or boss, though, so the probe below covers what the harness can't: all 10 fights give identical ON/OFF signatures |
| One harness re-baseline, explained, with a per-boss before/after | **PASS.** Covered in the next two sections |
| Short layout otherwise behaviour-identical; `npm run test:unit`, `typecheck`, `test:regress` | **PASS.** Vitest 60/60 (9 files); `tsc --noEmit` clean; `vite build` OK; harness PASS against the new baseline, flashes on and off |
| Matt's fire curves and depth HP rule untouched | **PASS.** No change to `src/enemies/cadence.ts` or `src/depth.ts`; their pinned tests pass |

## The re-baseline (one, in `98adeb4`)

| `st` field | Before (`1e20b36` baseline) | After | Why |
|---|---|---|---|
| state | over | over | — |
| score | 2282 | 4885 | The sim stream no longer carries render/fx draws, so every later spawn and roll changes |
| scroll | 2168 | 2168 | The bot dies at the same point |
| lives | 0 | 0 | — |
| px / py | 50 / 123.25 | 50 / 173.25 | The final y of the up/down script differs with the roll sequence |
| en | 1 | 1 | — |
| gibs / drops | 0 / 112 | 9 / 98 | Fx counts. Their lifetimes are now srnd draws |
| caps | 0 | 0 | — |

**Is a score of 4885 plausible?** I ran the same scripted run on 5 seeds (scratch copies of the harness, seed only changed):

- Old code: 1342, 2259, 2282, 5027, 5985.
- New code: 3211, 3977, 4347, 4769, 4885.

The canonical seed's move is inside run-to-run spread. Scroll (2168) is identical on every seed, before and after.

Canvas hashes all moved too. They're advisory, as before: the first hash also varies between runs with sprite decode timing.

## Per-boss before/after (`tools/rng-probe.mjs`, ON column)

Setup: the harness seed, boss-probe's STAGE 1 kit, an invincible bot at x=90 tracking the target, 40 s cap. **Same?** = identical sim signature rendered every frame (ON), flashes off (OFF) and never rendered (BARE).

| Fight | Before | After | Same? before | Same? after |
|---|---|---|---|---|
| GRAVITY DRIVE | cap @ 40.0 s, hp 294.72, score 9300, gibs 53 | cap @ 40.0 s, hp 294.72, score 9300, gibs 45 | DIFF | SAME |
| MAW (stage) | dead @ 9.4 s, hp -0.646, score 18000, gibs 105 | dead @ 9.4 s, hp -0.646, score 18000, gibs 107 | DIFF | SAME |
| CRUCIFER | dead @ 25.4 s, hp -1.01, score 30240, gibs 174 | dead @ 25.4 s, hp -1.01, score 30240, gibs 173 | DIFF | SAME |
| BUTCHER | dead @ 20.5 s, hp -0.608, score 30000, gibs 184 | dead @ 20.5 s, hp -0.608, score 30000, gibs 186 | DIFF | SAME |
| MAW (mid) | dead @ 9.6 s, hp -0.377, score 6000, gibs 107 | dead @ 9.6 s, hp -0.377, score 6000, gibs 107 | DIFF | SAME |
| NAIL CHOIR | dead @ 10.4 s, hp -1.191, score 8255, gibs 79 | dead @ 10.4 s, hp -1.191, score 7640, gibs 82 | DIFF | SAME |
| DISS. WOMB | dead @ 9.1 s, hp -0.274, score 6000, gibs 74 | dead @ 9.1 s, hp -0.274, score 6000, gibs 78 | DIFF | SAME |
| APPRENTICE | dead @ 7.2 s, hp -0.304, score 6000, gibs 88 | dead @ 7.2 s, hp -0.304, score 6450, gibs 101 | DIFF | SAME |
| BROOD MOM | dead @ 10.0 s, hp -0.615, score 10192, gibs 203 | dead @ 10.0 s, hp -1.286, score 9956, gibs 189 | DIFF | SAME |
| SQUID SAUCER | dead @ 6.0 s, hp -0.52, score 6000, gibs 67 | dead @ 6.0 s, hp -0.52, score 6000, gibs 62 | DIFF | SAME |

- **Time to kill and remaining HP are identical for every fight**, so no balance moved.
- Scores move only where adds die (choir nails, apprentice sparks, brood litter), from which roll each add gets.
- Before: all 10 fights changed their sim depending on whether frames were rendered. After: none do.

Raw output: `ls1-b1/rng-probe-before.txt` and `ls1-b1/rng-probe-after.txt`.

## Look check

The fx rig (`tools/fx-shots.mjs`) ran on the new build. Explosions, gore splats, sparks, gibs and the title eye all render as before (same art, different random layout). Kept in `ls1-b1/`:

- `boom-big-full.png`
- `sparks-orbit-fight-full.png`
- `eye-title-full.png`

## Commands

```
npx vitest run                                   # 60/60
npm run typecheck                                # clean
npm run build                                    # ok
node tools/harness.mjs                           # PASS vs baseline
node tools/harness.mjs --flashes off             # PASS vs baseline (st identical)
node tools/rng-probe.mjs                         # PASS: all 10 fights identical ON / OFF / BARE  (~7 min)
node tools/rng-probe.mjs --only brood --trace    # debugging: render-time Math.random call sites + sim fields render writes
```

## Stubs and open risks

- **No stubs.**
- **`src/textures.ts`** still draws `R()`. It does so only while building textures at boot: a fixed count, before the first frame, so it's harmless to the gate. It's listed in the determinism rule. Moving it would shift the baseline again, so it was left alone.
- **Sim code calling fx with `R()` arguments** (e.g. `gore(x, y, rr(...))` in `boss/update.ts`) stays on the sim stream. That's correct: the sim decides those draws, at a fixed count per step.
- **`step.ts` screen-shake offsets** (`$.G.shx/shy` from `R()`) are presentation values drawn in sim code. The draw count depends only on `$.G.shake`, which is sim state, so it's deterministic. Moving it would be a separate re-baseline (not in this row).
- **The render stream is shared by render and fx.** So particle layouts depend on how often render ran, and fx counts (`gibs`, `drops`, which are in harness `st`) can differ between the harness and a real device. That's deterministic under the harness (one render per step), and it's presentation only. If a future gate wants fx counts render-independent too, fx needs its own stream.
- **The audio change sits outside the row's file list.** audio-director and web-specialist should look at it. It's a pure stream swap: same distributions, and `ar()` was already the audio stream.
- **`HUD dScore`** is a display counter written by `render/hud.ts`; the probe's `--trace` shows it. The sim never reads it.

## Merge-order notes

- **B1 vs A:** they may land in either order (plan §2), but **each must re-run the harness against the other's result**. A also touches `src/fx/update.ts` (re-keying `hellFlash` at the old line 316, which B1 left at the same place) and `src/render/terrain.ts`, which B1 doesn't touch. Expect a small textual conflict in `fx/update.ts`'s import line and the `hellFlash`/`updateAmbient` lines (`ri`→`sri`, `R`→`srnd`). Whichever lands second re-records the baseline in its own commit and explains it.
  - If A lands first, its parity check needs re-running after B1: the sim stream moves, so A's `layout-parity.mjs` "before" must be re-recorded on top of B1. The parity check compares layout anchors, so it should be unaffected, but `route-probe` output may move.
- **P0** edits `render/gross/midbosses.ts`, which B1 doesn't touch (that file has its own local rnd). No conflict.
- **New render or fx code from any lane** must use `srnd`/`srr`/`sri`/`spick` from `src/srnd.ts`; `rng-split.test.ts` fails otherwise. G0, F0 and H0 (new pure files outside render/fx) are unaffected.
- **Before merging to main**, re-run `node tools/rng-probe.mjs`. It isn't in CI: about 7 minutes and 30 page loads.
