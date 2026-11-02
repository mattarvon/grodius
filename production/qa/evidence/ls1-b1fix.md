# LS1-B1fix: close the render-gated sim RNG draws

*engine-programmer, 2026-11-01. Branch `ls1-b1fix` off main `8ff9ba4`. Fix commit `86a6603`. Follow-up to LS1-B1 (M2 #13); the leaks came from the B1 web-specialist review.*

## What changed

LS1-B1 moved render and fx onto `srnd()`, but three paths still let render decide how many sim draws `R()` made:

| Leak | Why it reached the sim | Fix |
|---|---|---|
| `src/shipform.ts` `sproutFX` / `witherFX` (and `shipShed`) drew `rr` and `pick` | `trackForm` runs inside `drawShip` (`render/ship.ts:104`) and diffs the ship form each rendered frame. If a frame renders twice the steps, two pickups fold into one sprout; a frame that never renders makes no sprout draws at all. `shipShed` (called on death from `flow.ts`) walks the same render-built diff | The whole module is presentation: 24 draws move to `srr`/`spick`. Added to the scanned files |
| `src/shots.ts:75`: `if (g) g.burning = ri(70, 150)` | `gib()` returns null above 720 live gibs. The gib count follows srnd, which render shares, so near the cap the number of `ri` draws depended on render | Changed to `sri` (a gib's burn time is fx-only) |
| `src/step.ts:94-95`: screen-shake offsets `$.G.shx`/`shy` drew `R()` only while `shake > .3` | `shake` is written by fx and by shipform's sprouts, i.e. by render. `shx`/`shy` are read only by render (`screens.ts`, `hype.ts`) | Changed to `srnd` |

The third leak wasn't in the review. It showed up when the new FORM CHANGE probe fight still differed with shipform fixed: the probe's `--trace` showed render writing `G.shake`.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Presentation draws on `srnd()`; no sim draw count depends on fx or render state | **PASS.** All three leaks above are closed. `tools/rng-probe.mjs`: **all 11 fights identical ON / OFF / BARE**, including the new FORM CHANGE fight |
| A test fails for this class of leak; watched failing on the unfixed code first | **PASS.** `tests/unit/rng-split.test.ts` gets four new checks (below). Each one failed on the unfixed code, then passed after the fix |
| Re-baseline once each, in the same commit, explained | **PASS.** `tools/harness.baseline.json` and `tools/layout-parity.baseline.json` are both in `86a6603`. Details below |
| `rng-probe` still identical across ON/OFF/BARE | **PASS.** 11/11 |
| If a parity seed's bot can't kill the Gravity Drive, swap it (both gates at every fork position, keep a slot-1 repeat visit) | **Done.** Seeds 1 and 5 began timing out, so the set is now `3,6,7,11,15`. Details below |
| `npm run test:unit`, typecheck, build | **PASS.** 215/215 (16 files); `tsc` clean; `vite build` ok |
| Harness passes; flashes OFF identical | **PASS.** Both give `PASS vs baseline @ 8ff9ba4` with identical `st` |
| Parity passes | **PASS.** A fresh run after the update: `PARITY PASS ... runs 3, 6, 7, 11, 15, 3x3, 7m identical` |
| Matt's fire curves / depth HP rule | Untouched; their pinned tests pass |

### New tests

All are in `tests/unit/rng-split.test.ts`, and each has a self-test with fixtures so it can't pass vacuously.

1. **Render reachability.** For every function that `src/render/**` or `src/fx/**` imports from another module, the test follows that function and any same-module helpers it calls, to any depth. It fails on any sim draw. A value built once at import by an IIFE, like `textures.ts`'s `DERE`, is not counted as a function render calls.
   - On the unfixed code it caught `render/ship.ts -> shipform.ts sproutFX: rr(), pick()` and `witherFX: rr()`.
2. **The import scan now includes `src/shipform.ts`,** and also matches `'../core.js'` (a gap the B1 qa-tester found).
   - It caught `shipform.ts: imports rr/pick from core`.
3. **fx-gated draws.** The test finds every fx spawner that can return null, by its source (today only `gib`). It then fails on a sim draw inside `if (v)` or `v &&`, where `v` holds such a spawner's result.
   - It caught `src/shots.ts: gib() -> g: ri()`.
4. **Presentation-gated draws.** The test fails on a sim draw in a statement that reads `$.G.shake/white/red/glitch/hell/flick/shx/shy`, or a local computed from one. A plain write to those fields doesn't count.
   - It caught `step.ts`'s two `shx`/`shy` lines.
   - My first version passed vacuously: its local-variable capture stopped at the comma in `Math.min(9, $.G.shake)`. The self-test exposed this, and I fixed it before relying on the check.

Runtime: `rng-probe` gains **FORM CHANGE**, the Crucifer fight with pods growing at 1, 3 and 5 s and one withering at 7 s. The changes are made on the sim side, identically in every mode. With only `shipform.ts` reverted it reports **DIFF** (BARE ≠ ON); with the fix, **SAME**.

## Re-baselines (both in `86a6603`)

### Harness `st`

| Field | Before (B1 merge) | After |
|---|---|---|
| state | over | over |
| score | 4885 | 1243 |
| scroll | 2168 | 3538 |
| py | 173.25 | 143.25 |
| en | 1 | 0 |
| gibs / drops | 9 / 98 | 0 / 0 |
| lives, px, caps | 0, 50, 0 | unchanged |

**Why.** The sim stream no longer carries these draws, so later rolls move. With the canonical seed, the scripted bot now dies about 24 s in, after 10 kills (`overT` 2165 at frame 3600). That is before the Open Orbit midboss arrives.

- On a game-over screen the world keeps stepping but the script doesn't run. With no midboss to hold the scroll, the scroll carries on to 3538 and the fx pools drain (hence en, gibs and drops all 0).
- In the B1 baseline, and on four other seeds of this build, the bot dies after the midboss lands: scroll 2168, scores 2358, 3693, 4481 and 4919.

So the canonical run is now an unlucky early death, not a broken gate. The canonical seed doesn't need swapping either: the harness passes and flashes OFF is identical.

### Layout parity

- **What moved:** every run's rolls (fork offers, spawn trace hashes, tallies, script x lists in biome stages, music timings).
- **What didn't move:** the static anchors (`LEVEL`, `BOSS_AT`, `SEG`, `T_END0/1`, UFO, AMT). The change touches no layout.

**Seed swap.** After the change, seeds 1 and 5 time out: their bot kits can't kill the Gravity Drive in Descent 1, so they stop after 3 stages. I scanned candidate seeds over 3 descents:

| Seed | Gates | 3 descents | D1 / D2 / D3 routes |
|---|---|---|---|
| 3 | 1001 | complete | snot,acid / ice,**snot** / **acid**,fire |
| 6 | 1100 | complete | ice,snot / acid,fire / acid,snot |
| 7 | 1010 | complete | snot,fire / acid,**fire** / ice,snot |
| 8 | 0011 | complete | snot,ice / fire,acid / fire,acid |
| 10 | 1111 | timeout | — |
| 11 | 0100 | complete | snot,acid / fire,ice / acid,snot |
| 14 | 0001 | complete (slow, 99.7k frames) | acid,snot / ice,fire / snot,fire |
| 15 | 0111 | complete | fire,acid / snot,ice / ice,acid |
| 17 | 0011 | complete (slow, 138.8k frames) | ice,acid / fire,snot / fire,snot |

The new default set is **3, 6, 7, 11, 15**:

- **Both gates at every fork position.** Gate per position across the five seeds:
  - position 0: 1,1,1,0,0
  - position 1: 0,1,0,1,1
  - position 2: 0,0,1,0,1
  - position 3: 1,0,0,0,1

  (Gates are a hash of the seed only, so this doesn't depend on the sim.)
- **Slot-1 repeat visit in Descent 2:** seed 3 (snot, from D1) and seed 7 (fire, from D1). Seed 6, the previous carrier, no longer repeats.
- **The 3-descent run** moves from seed 1 to seed 3, renamed `1x3` → `3x3`. It completes, and its Descent 3 slot-0 gate is a revisit (acid, first flown in D1).
- **The mortal run `7m`** is unchanged in shape: game over, 2 stages, 3 deaths.

The tool's header comment records the swap and why. Historical evidence files that name `1x3` (`ls1-a.md`, `content-build-plan.md`) are left as written.

```
run 3 (seed 3, 2 descents) gates 1001: shop 2, 8 stages, 30700 play frames, deaths 0, errors 0
run 6 (seed 6, 2 descents) gates 1100: shop 2, 8 stages, 31042 play frames, deaths 0, errors 0
run 7 (seed 7, 2 descents) gates 1010: shop 2, 8 stages, 30667 play frames, deaths 0, errors 0
run 11 (seed 11, 2 descents) gates 0100: shop 2, 8 stages, 35251 play frames, deaths 0, errors 0
run 15 (seed 15, 2 descents) gates 0111: shop 2, 8 stages, 32688 play frames, deaths 0, errors 0
run 3x3 (seed 3, 3 descents) gates 1001: shop 3, 12 stages, 47847 play frames, deaths 0, errors 0
run 7m (seed 7, 2 descents, mortal) gates 1010: game over, 2 stages, 6541 play frames, deaths 3, errors 0
PARITY PASS vs baseline @ 8ff9ba4-dirty: runs 3, 6, 7, 11, 15, 3x3, 7m identical (5 seeds x 2 descents + 3x3 + 7m)
```

The baseline's recorded commit reads `8ff9ba4-dirty` because I re-baselined before committing. The baseline content is what `86a6603` contains.

## Per-fight before/after (`rng-probe`, ON column)

| Fight | B1 merge | After | ON/OFF/BARE |
|---|---|---|---|
| GRAVITY DRIVE | cap @ 40.0 s, hp 294.72, score 9300 | cap @ 40.0 s, hp 294.72, score 9300 | SAME |
| MAW (stage) | dead @ 9.4 s, hp -0.646, score 18000 | same | SAME |
| CRUCIFER | dead @ 25.4 s, hp -1.01, score 30240 | same | SAME |
| BUTCHER | dead @ 20.5 s, hp -0.608, score 30000 | same | SAME |
| MAW (mid) | dead @ 9.6 s, hp -0.377, score 6000 | same | SAME |
| NAIL CHOIR | dead @ 10.4 s, hp -1.191, score 7640 | same | SAME |
| DISS. WOMB | dead @ 9.1 s, hp -0.274, score 6000 | same | SAME |
| APPRENTICE | dead @ 7.2 s, hp -0.304, score 6450 | same | SAME |
| BROOD MOM | dead @ 10.0 s, hp -1.286, score 9956 | dead @ 10.1 s, hp -1.018, score 9956 | SAME |
| SQUID SAUCER | dead @ 6.0 s, hp -0.52, score 6000 | same | SAME |
| FORM CHANGE (new) | — | dead @ 14.6 s, hp -2.15, score 30320 | SAME |

## Not done / open

- **No new screenshots.** The three fixes swap the random stream at the same call sites with the same distributions (`srr`/`spick`/`sri`/`srnd` bounds match `rr`/`pick`/`ri`/`R`, as B1's technical-artist confirmed). Sprouts, the pyre gib and screen shake look the same, with different random layout. That's not visually verified on this branch.
- **The reachability test is static.** It follows calls within one module, not across modules. A render function calling a helper in a third module that draws `R()` would only be caught by `rng-probe --trace`. That tool is hand-run, about 8 min for 11 fights, and not in CI.
- **The presentation-field list (`PRES`) in the test is hand-kept.** A new render-only `$.G` field needs adding there.
- **`textures.ts`** still draws `R()` at boot, as in B1: a fixed count, before the first frame.
- **I ran no Studio review of this branch,** per the brief.

## Merge notes

- `86a6603` re-baselines both gates, so any lane merging after it re-runs both and re-baselines in its own commit if it moves them.
- `tools/layout-parity.mjs` default seeds changed to `3,6,7,11,15` and its extra run is now `3x3`, so callers passing `--seeds` explicitly should update. CI doesn't run parity (`production/content-build-plan.md` is the only other reference).
