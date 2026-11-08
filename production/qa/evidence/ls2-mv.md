# LS2-mv · terrain movement B and the set-piece catalogue

Lane `ls2-mv`, branch `ls2-mv` off main `7391234`. Spec: `design/content-expansion.md` §3.2 (`.36-.62`, Terrain movement B) and §3.3. Raw outputs are in `production/qa/evidence/ls2-mv/`. The first build was `ffd6b77`. The studio pass (last section) reworked it, and every number below is from the reworked build.

## What changed

**Movement B gimmicks (B0 / B1 per biome).** These apply on long layouts only, in the band from breath 1's end (lead 0) to breath 2's start +200, with a 200 px blend at each edge. That gives a full-strength core of about 556 px. The band comes from `beatPlan(...).moveB`, and short has no `moveB`. All values are in `MOVE` / `MOVE_HAZ` in `src/terrainb.ts`.

| biome | B0 | B1 |
|---|---|---|
| ice | crevasse teeth every 36 px, flat 3 px tips; icicle interval ×.7 | stairs: rise 22 every 120 px, walk 0-1-2-3-4-3-2-1; interval ×.85 |
| acid | lake: floor rises 30, swell ±12 over a ~380 px wave | folds: hanging ceiling drapes |
| fire | spires: floor needles with flat 3 px tips | chimney: ceiling vents every 150 px, mouth at y 34. Jets snap to a vent where the band is ≥.5 blended and get a 3 px glow telegraph. Interval ×.6 |
| snot | throat: gap 108-150, narrows at 85 + 170n | polyps: floor domes |

Hazard intervals inside a band never drop below 50 f (`MOVE_HAZ_MIN`).

**Picks.** The B0/B1 choice and the 3 set pieces are drawn once per stage from their own salted stream `pickSeedOf(seed, loop, i)` (`PICK_SALT`), separate from the script and midboss streams. They are stored in `G.picks`, and a rebuild or resume reads them back, so neither the build stream nor the script stream ever shifts. On a first visit, D1 flies B0 and D2+ rolls B1 at .5. On a remix the run flies the variant this biome hasn't flown yet (`G.mvSeen`, saved in the run save). It flies B1 once both have been seen.

**Set pieces.** 12 new pieces, 3 per biome: ice thaw/vigil/pack, acid slurry/vats/lining, fire meatline/backdraft/cinders, snot sneeze/clot/congestion. Each biome's catalogue is now 5. A stage plays 3, drawn without replacement per run (`G.spUsed`). When the catalogue runs out it refills, keeping out the pieces this stage already holds.

- **S2 order:** of the three drawn, the lightest (`SETW`) moves to S2, the slot inside movement B. This costs no extra draw.
- **Placement:** on long layouts each piece now fires at exactly its planned x. Before, the beat generator could shift it up to 68 px.
- **Spawn heights:** fixed set-piece heights, and hatchling heights, are clamped inside the walls wherever a band has moved them (`bandClamp`). Outside a band, which on short is everywhere, nothing changes.

**Props.** `src/render/moveprops.ts` holds 8 procedural props, one per gimmick. They are render-only (hash and `$.T`, no RNG), sit inside the terrain mass, add no collision, and run inside `ctx.save()`/`restore()`. This is interim art and waits on the round-2 art pass.

### Files

- New:
  - `src/terrainb.ts`: `MOVE`, `MOVE_HAZ`, `gimmick`, `MOVES`/`moveK`/`moveAt`, `snapVent`, `hazInterval`, `bandClamp`
  - `src/setdraw.ts`: catalogue, `SETW`, `drawSets`, `moveRoll`, `drawPicks`
  - `src/render/moveprops.ts`
- `src/layout.ts`: `Beats.moveB`; LONG4 `moveB: { between: [0,1], lead: [0,200], blend: 200 }`; `beatPlan` returns `moveB`
- `src/rng.ts`: `PICK_SALT`, `pickSeedOf`
- `src/biomes.ts` (hunks below)
- `src/enemies/spawn.ts`: `hatch()` clamps its y with `bandClamp` after its draws (1 import + 2 lines)
- `src/runsave.ts`: validators for `spUsed`, `picks` (3 distinct catalogue ids) and the new `mvSeen`. `spUsed` and `picks` were already reserved. `mvSeen` is a new allowlist entry, and an old save without it loads as `{}`, so no RUN_V bump is needed
- `src/render/biomeart.ts`: the vent-jet telegraph fill and the props call
- Tests:
  - new `tests/unit/terrainb.test.ts` and `tests/unit/setdraw.test.ts`
  - `biomebeats.test.ts`: the D20 placed-x case
  - `runsave.test.ts`: rejections and round trip with `mvSeen`
  - `buildstream.test.ts`: pins `PICK_SALT`
- Tools:
  - new `tools/set-share.mjs` (whole-run and same-biome readings) and `tools/set-shots.mjs` (plain pass plus the band pass with its buried-spawn count)
  - `tools/movement-shots.mjs`, `tools/playtest.mjs` (`--compare` set-piece rows), `tools/resume-check.mjs` (compares `picks` and `spUsed`)
- Baseline: `tools/harness.breath2.baseline.json`

### Hunks in `src/biomes.ts` (for the LS2-0 rebase)

All are in the terrain, set-piece, stage-build and hazard sections. None touches a `mids` table.

1. Imports: `setdraw`, `terrainb` (`MOVES`, `bandClamp`, `gimmick`, `hazInterval`, `moveAt`, `snapVent`), `pickSeedOf`
2. `rewriteTerrain(seg, b, from, mv = null)`: band lerp, publishes `MOVES[slot]`
3. `bandY(y)`, then `SET`: 12 new pieces, `bandY` around every fixed height, the clot redesign, slurry/backdraft/congestion retimed, `export const SET_KINDS`
4. `biomeScript(..., mids = null, setIds = null)`: **one signature line next to `mids`** (one parameter added after it), plus the set-piece line. That line now places piece n at exactly `sets[n]` on long layouts (`setN`)
5. `pickStream(i)`, `stagePicks(i, b, v)` (with `G.mvSeen`) after `midStream`; `biomeStage` passes the picks
6. `biomeReset`: clears `MOVES` and `G.picks`. `G.spUsed` and `G.mvSeen` are run-long
7. `spawnHazard`: `snapVent` and `h.vent`; `stepBiome`: `hazInterval(...)`

Hunk 4 is the only one LS2-0 could plausibly touch at the same time.

## Acceptance checklist

| requirement | result |
|---|---|
| B0 and B1 per biome in each long biome stage's movement-B band, read through layout accessors | PASS: `beatPlan().moveB`. The unit test "band-only change" proves terrain outside the band is byte-identical |
| 3 new set pieces per biome, drawn without replacement per run from a per-stage stream, never `R()` at render | PASS: `setdraw.test.ts`, plus `terrainb.test.ts` "picks from the salted stream". Props have no RNG |
| gap ≥108 everywhere | PASS in all terrain this lane writes: band min 108.0 (snot throat), A min 108.0, C ≥153 (`movement-shots.txt`). Unit tests check both gates and naked-ship flyability over 60 offsets × 5 movement-A gaps. **Pre-existing exception:** route-probe `minGap 104.0 @13860` is in the Drive stage, which this lane does not touch. Main `7391234` gives the identical value (`route-probe-main-7391234.txt`). Not fixed: the Drive terrain is shared with short |
| no set piece in a breath; D20 (breaths ≥300 px from set pieces) | PASS on **placed** x. Set pieces now fire at exactly their planned x on long layouts, so placed = planned ≥300 px from every breath edge. `biomebeats.test.ts` checks every catalogue piece in every set slot × 4 biomes × 2 slots × 2 visits × 2 descents. Every piece's last spawn lands before the run-up from S3's planned x. The longest delay is kiln's 80 f, a pre-existing piece; no new piece waits past 60 f. The first build placed pieces up to 68 px off their plan (263 px from a breath); that is fixed |
| set-piece spawns not inside the terrain a band has moved | PASS: set-shots band pass, all 20 pieces × B0/B1 in S2: **0** enemies (11 before the hatch clamp, all snot hatchlings; see Studio pass) first seen inside the walls (`set-shots.txt`). Hatchlings and fixed heights are clamped with `bandClamp` |
| short identical | PASS: short harness PASS; `layout-parity` PASS (7 runs) |
| long4 re-baselined, every crossing scenario explained, deterministic ×3 | see Harness moves |
| route-probe 0 bad hazards, all routes | PASS: 10 routes × 2 descents, `bad []`, hazHitFrames 0, deaths 0, slams 0 |
| world shots, one per movement per biome, all looked at | PASS: 48 shots in `ls2-mv/move/`, 12 plain set shots in `ls2-mv/sets/`, 40 band set shots in `ls2-mv/sets/band/`. Contact sheets looked at (see Studio pass, art-director) |
| cross-seed signature ≤50% of set pieces shared | PASS on whole runs: worst 18% (200 seeds). **Same-biome reading FAILS by construction: 60%** (see risks). Played seeds 3/6/7/11/15: `signature-compare.txt` |

## Harness moves

- **`breath2` moved twice in this lane.**
  - **ffd6b77**, `24ea3cef14` → `876cbb6535`. The scenario starts about 124 px before breath 2, inside the tail of stage 1's ice B0 band. The crevasse terrain and its icicle rate change the bot's flight. With `gimmick` returning its inputs and `moveHazMul` at 1, it matched the old baseline exactly.
  - **studio pass**, `876cbb6535` → `95c5d0a33e` (`score 1500→0, py 109.565→82.065, gibs 37→30, drops 26→20, caps 3→0`). Why: the accessibility fix gave the crevasse teeth a 3 px flat tip and raised the span 36→42 to keep their height, which reshapes the same ice B0 terrain.
  - **Attribution:** with the span set back to 36 and no plateau, breath2 gives `876cbb6535` exactly. None of the other rework (lead 0, picks stream, hazard floor, set placement, bandY, hatch clamp) moves it.
  - `--runs 3`: identical sig and canvas hashes three times (`breath2-runs3.txt`).
- **`long4` did not move.** Its 3600 frames are Open Orbit and never reach a biome stage. **short did not move.**
- The other 11 scenarios pass unchanged. The crux/butcher ones start at the stage-1 run-up (scroll ~7997), after the band. `drive` is not a biome stage.

## Test, probe and harness output

- `npm run typecheck`: clean. `npx vitest run`: 31 files, **757 tests passed**. `npm run build`: built (`build.txt`).
- `npm run test:regress` (`regress.txt`): 12/12 PASS after the breath2 re-baseline. `regress-before-rebaseline.txt` is the first build's pre-baseline run.
- Watch-fail: every new regression test was seen failing against the unfixed code. Mutants:
  - bandY
  - set snap
  - picks stream
  - remix rule
  - S2 reorder
  - pick length
  - needle tips
  - interval floor
  - vent ramp
  - lead 100
  - mouth 16
  - `bandClamp` → identity, which fails two tests. In game, the band set-shots read 11 buried before the hatch clamp.
  - band blend → 1 (qa-tester M4), which fails 16 tests.
- `layout-parity` (`parity.txt`): PASS. Parity's own note: the bots for seeds 2 and 3 cannot kill the Gravity Drive (pre-existing).
- route-probe (`route-probe.txt`): 10 routes × 2 descents, 0 hazard hits, 0 deaths, 0 slams. 9 routes are `bad []`. **acid,ice flagged one `state:geyser`** in the final gate run, a geyser first seen while a fork, tally or death state was up. `stepBiome` cannot spawn in those states (it gates on all of them), so the probe saw a spawn and a state change between two of its samples; the probe is not frame-locked. That run also had an unusually long 310 s D1 Drive fight. A re-run of acid,ice (`route-probe-acid-ice-rerun.txt`) is `bad []`, as was the gate run before it. Not a lane change: the hazard gate is untouched, and `hazInterval` only changes the interval.
- density (`density.txt`): every breath 0.0.
- resume-check long4 S1 CP1 and S2 CP0: PASS.
- jump-check: ALL PASS.
- playtests, seeds 3/6/7/11/15, long4, 2 descents, 12-minute cap: errors none, would-be hits 0.3-1.0/min. The bot killed the Gravity Drive in both descents on every seed (D1 36-56 s, D2 25-36 s), so nothing here needs a "bot can't kill the Drive" note
- set-share, B0/B1 split by stage:

  | stage | B0/B1 |
  |---|---|
  | 1-2 | 200/0 |
  | 1-3 | 200/0 |
  | 2-2 | 50/150 |
  | 2-3 | 47/153 |
  | 3-2 | 48/152 |
  | 3-3 | 59/141 |

## What I did not measure

- Hits/min per band: density-probe counts set pieces as one call and has no band split.
- `rng-probe` was not run; unit rng-split passes.
- Fold contraction and Peristalsis motion in stills.
- Descent 2+ terrain offsets in the shots. Set-shots covers only S2 over the band; S1 and S3 sit on movement A and C.
- Enemies that fly into a wall after spawning: their own patterns, as on main.
- Cross-run memory: the draw is per run.
- **Perf:** props cost 0.014-0.097 ms per frame at 4× CPU throttle (`production/levels/ls2-mv/performance.md`). The branch-vs-main frame delta (~+0.6 ms) is within noise. One main run crashed in the rig. S2-K1 stays open and is judged on the Fold (D30).

## Stubs and open risks

- **Same-biome share is 60%** (Jaccard 46%, placed 20%) by construction: 3 of 5 drawn uniformly share 1.8 pieces on average. Whole runs pass (worst 18%). Getting the same-biome reading under 50% needs 6 or 7 pieces per biome, or cross-run memory. **For Matt:** which reading counts, and the catalogue size.
- **Signature guarantee:** a stage may not draw its biome's signature piece. The game-designer and level-designer asked whether one should be guaranteed. **For Matt / narrative.**
- **Spec reading, "icicles x.7":** read as the interval (~1.43× the rate). **For Matt** if it meant the rate.
- **Spec reading, Peristalsis:** spec §3.3 requires noise-only terrain, so the walls are a static train of narrows, and render-only contraction bands carry the march toward the player, phase-locked to the real narrows. **For Matt** if moving walls were meant. The narrative director notes the word overlaps "Folds"; it is the spec's term and is kept.
- **Out of lane, flagged:**
  - The general jet/geyser telegraph is a 1 px line. Only the chimney's vent jets got the 3 px fill here; the rest is shared with short.
  - The BEHIND marker's position, its blink rate, and haptics are pre-existing UI.
- **Idiom risk (world-builder):** grille, rungs and treads read as hardware. Chimney jets fire down (a burner, not a flue). Round 2 should not reuse the throat sphincter motif.
- **Interim art:** the movement-B props and the 12 new pieces' looks wait on round 2.
- **Pre-existing:** the Drive stage's base terrain has a 104 px minimum gap. Fixing it would move short and long4.
- A fifth biome with no `MOVE`/`PROP` row would get no gimmick. Props guard on `PROP[m.b]`, and `MOVE_HAZ` defaults to 1, but `gimmick` falls through to snot's.

## Merge-order notes

- `src/biomes.ts` overlaps LS2-0. Hunk 4 (the `biomeScript` signature) is the only line next to `mids`. Keep both parameters, `mids` then `setIds`.
- `src/enemies/spawn.ts`: 3 lines in `hatch()` and 1 import. Any lane editing `hatch()` keeps the clamp after its draws.
- `src/runsave.ts`: `spUsed`, `picks` and `mvSeen` are in the same validator table. If another lane adds entries, keep both lanes' entries.
- Merge this after any lane that changes `beatPlan`'s return shape. `moveB` is additive and `null` on short.
- Only the `breath2` baseline is re-baselined here. A lane that also moves breath2 needs it re-taken after both merge.

## Studio pass

Per `redo.md`, step 1 (design audit) ran level-designer, game-designer and technical-artist on the brief, the spec and `git diff 7391234..HEAD`. Step 2 (build review) ran `/code-review` (web-specialist for the stack, gameplay-programmer, qa-tester) and `/team-level` at studio size (systems-designer, art-director with the contact sheets, accessibility-specialist, narrative-director, world-builder), plus performance-analyst. Each agent's full report is in `production/levels/ls2-mv/<agent>.md`; the qa-tester's cases are in `production/qa/test-cases/ls2-mv-cases.md`. The leads/directors Studio Hierarchy review was **not** run in this lane; the parent runs the batched review.

| agent | raised | changed / why not |
|---|---|---|
| level-designer | **BLOCKING:** band core too short. Also: stairs too tame (S-1); chimney too quiet (S-2); vent snap in the ramp (S-3); throat bands not on the narrows (S-4); midboss A hold (S-5); embedded spawns (S-6); S2 should be lightest (S-7); signature guarantee (S-8); clot ≈ drip (S-9); D20 on placed x | Lead [100,200] → [0,200]: core ~556 px. The suggested -40 was rejected because it puts midboss A's hold inside the blend; the ship sits at ~35% blend there (S-5, hold shots). S-1: rise 22, walk to 4, interval ×.85. S-2: ×.6. S-3: snap only at ≥.5 blend, with a ramp test. S-4: phase-locked to `narrowNear`. S-6: band set-shots. S-7: `SETW` reorder. S-9: clot redesigned (womb first, slimes, then its brood). D20: exact placement. S-8 left to Matt |
| game-designer | Same-biome share 60% (wants both readings reported, a Matt ruling, and 6-7 pieces); B1-then-B1 repeat on a remix; picks share the script's stream; no per-band hits/min; set pieces never shot over the band; silent decisions; `SETS_PER_STAGE` derived; signature guarantee | Remix flies the unflown variant (`mvSeen`). Picks moved to the salted `pickSeedOf` stream. Band set-shots added. Both share readings reported. **Not done:** catalogue stays at 5 (scope; Matt decides 6 or 7); per-band hits/min not measured; decisions recorded here rather than in `decision-log.md` (shared file, the parent merges it); signature guarantee for Matt |
| technical-artist | Throat bars inert; composite switched per item; fold array allocated per frame; chimney grille under the HUD; stairs and polyps invisible; tip skip at PH-50; tank dash floating; no `PROP` guard | All done: pulse bands, batched 'lighter' passes, hoisted `PROP_K.fold`, mouth to y 34, riser shadow `#16304a`, polyp crown rim, waterline clamped to the floor, guard and `save`/`restore`. Not done: crevasse grid alignment (a nicety) |
| web-specialist (`/code-review`) | **CHANGES REQUIRED:** R1 no `save`/`restore` in props; R2 magic numbers outside `MOVE`; R3 saved pick length unchecked. Also `MOVES` import cycle; set-shots cleanup; set-share duplicates `stagePicks`; per-frame spread in `playtest.mjs` | R1-R3 done. `MOVES`/`moveAt` moved into `terrainb` (typed, no cycle). set-shots `try`/`finally`. **Not done:** set-share's duplication (it mirrors `stagePicks`' exact call and is pinned by the same stream; Node-only tool); the `playtest.mjs` spread (tool, not the game) |
| gameplay-programmer (`/code-review`) | D20 snap; pick length; `moveHazMul` × depth reaches .44 at D3; lag at band edges; acid float 107.99999; a fifth biome would crash | D20: exact placement. Pick length validated. Hazard floor 50 f. **Not changed:** band-edge lag (the blend is the design); acid B1's 107.99999999999999 is float rounding in `keepCeil`'s `ce + 108`, 1e-14 px under the gap, not a flyable difference; fifth biome noted in risks |
| systems-designer (`/team-level`) | **BLOCKING:** S2 slot weight. Spawns at fixed y land inside band terrain; "delays ≤60" claim false; constants not hoisted; no interval floor; density probe has no band split; slurry, congestion and backdraft timing; lining; lake too flat | S2 lightest (`SETW`). `bandY` on every fixed height, then `bandClamp` for hatchlings too (the band set-shots found 11 buried, all hatchlings). Claim corrected: kiln 80, crucify/gutter/drip 70 (pre-existing, used by short, unchanged), now proven by test to end before the run-up. Constants hoisted. Floor 50. Retimed slurry, congestion, backdraft. Lake swell 12 / wave 60. **Not done:** density split; lining unchanged (it reads in the shots) |
| art-director (`/team-level`, contact sheets) | No BLOCKING. SHOULD: Peristalsis bands don't read; chimney vents under the HUD with no telegraph; snot narrows not seen in frame; hold-ice/acid and s1 sheets unchecked. NICE: polyp shine, fold crease, spire core line, lining/cinders anchors | Throat: dark `#2a1208` band plus pale `#f4e49a` rim, pulsing toward the player. Chimney: mouth at y 34, dark `#3a0c04` mouth with orange bars, 3 px vent-jet glow telegraph. Snot narrows: checked in the full-size `s0-snot-B0hold.png`: the walls pinch to the narrow, with the band notch on both walls. A capture-position question, not a terrain bug. The pale pulse still reads modestly at 960×540; a brighter treatment waits on round 2. Hold and s1 shots: looked at by me (all 4 biomes' B0/B1 hold shots, and s1 shots, on contact sheets: no regressions; tips plateau, chimney mouth clear of the HUD, hatchlings in the gap in the band set shots). NICE items wait on round 2 |
| accessibility-specialist (`/team-level`) | **BLOCKING:** collision tips under 3 px (crevasse, spires). Jet telegraph 1 px; vent mouth too high; BEHIND marker position and blink, haptics; throat bands as a false cue | `TIP_W` 3 px plateau with span compensation (tested: mid and mid+1.4 equal). Vent mouth 34. 3 px telegraph for vent jets. Throat bands now sit only on real narrows. **Not done:** the general jet/geyser telegraph, BEHIND and haptics are pre-existing code shared with short; out of lane, flagged |
| performance-analyst | OK: props 0.014-0.097 ms/frame at 4× throttle; branch vs main within noise; one main run crashed (rig) | Fold array hoist and spire batching landed from the technical-artist items. Nothing else needed |
| qa-tester (`/code-review`) | Mutation survivors M1, M1b, M4, M5, M6, M16, M17, M18, M24, M27; test cases in `ls2-mv-cases.md` | New tests: `moveHazMul` (M1/M1b), literal 108 (M6), lake mean (M16), `hazInterval` (M17), `snapVent` (M18), picks stream (M24). M4 (no blend, a hard cliff at the band edge): new test "blends in without a cliff at either band edge", 16 cases (4 biomes × B0/B1 × 2 slots). Edge step ≤ max(movement A's nearby worst, 12 px): measured 2.3-11.2 px; the mutant gives 14-89 px and fails all 16. **No dedicated test:** M5 (an extra `R()` in the snap: `snapVent` draws nothing, the call site is one line, and on short `vent` is false so the draw order is unchanged; the qa-tester rates it a determinism hazard, not a live bug) and M27 (`stepBiome` samples the band at `sc + W/2`; `stepBiome` isn't exported, and `hazInterval` is tested at its own x) |
| narrative-director (`/team-level`) | No BLOCKING. "Peristalsis" overlaps "Folds"; pieces share backdrops | Spec term kept, noted. Backdrops are round 2. Checked: the diff adds no player-facing strings |
| world-builder (`/team-level`) | No BLOCKING. Chimney jets fire down (a burner, not a flue); hardware idiom (grille, rungs, treads); don't reuse the sphincter motif | Noted in risks for round 2. Nothing changed in code |

After the fixes, the gates were re-run under the lock:

- typecheck, vitest 757, build
- test:regress 12/12, after the explained breath2 re-baseline
- layout-parity PASS
- movement-shots and set-shots
- route-probe on 10 routes
- density
- playtests on 5 seeds, plus `--compare`
- set-share
- resume-check ×2
- jump-check

The M4 band-edge test was added after that run. It is test-only, so no shipped code changed and the gates were not re-run for it.
