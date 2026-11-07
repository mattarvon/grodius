# LS2-mv · terrain movement B and the set-piece catalogue

Lane `ls2-mv`, branch `ls2-mv` off main `7391234`. Spec: `design/content-expansion.md` §3.2 (`.36-.62`, Terrain movement B) and §3.3. Raw outputs are in `production/qa/evidence/ls2-mv/`.

## What changed

**Movement B gimmicks (B0 / B1 per biome).** These apply on long layouts only, in the band from breath 1's end +100 to breath 2's start +200, with a 200 px blend at each edge. The band comes from `beatPlan(...).moveB`, and short has no `moveB`.

| biome | B0 | B1 |
|---|---|---|
| ice | crevasse teeth (ceiling fangs, icicle rate ×.7) | stairs (rise 20 every 120 px, walk 0-1-2-3-2-1) |
| acid | lake (floor rises 30, swell 9) | fold (hanging ceiling sacs) |
| fire | spires (floor spike train) | chimneys (ceiling vents every 150 px; geysers snap to the vents) |
| snot | throat (gap 108-150 every 170 px) | polyps (floor domes) |

The B0/B1 choice and the 3 set pieces are drawn once per stage from a **fresh** `stageStream(i)` instance and stored in `G.picks`. On a rebuild or resume they are read back and not drawn again, so the script stream never shifts. `B1_FIRST_VISIT = .5`, so D1 is all B0, as the spec requires, and the B1 share rises on later visits.

**Set pieces.** 12 new pieces, 3 per biome, added to `SET`: ice thaw/vigil/pack, acid slurry/vats/lining, fire meatline/backdraft/cinders, snot sneeze/clot/congestion. Each biome's catalogue is now 5, and a stage plays 3 of them, drawn without replacement per run (`G.spUsed`). When the catalogue runs out it refills, keeping out the pieces this stage just used. Set delays are ≤60 f, so every piece finishes before the run-up at p .9.

**Props.** `src/render/moveprops.ts` holds 8 procedural props, one per gimmick. They are render-only (hash and `$.T`, no RNG), sit inside the terrain mass, and add no collision. This is interim art and waits on the round-2 art pass.

### Files

- New: `src/terrainb.ts` (MOVE tuning table, `gimmick`, `moveHazMul`, `ventNear`), `src/setdraw.ts` (catalogue, `drawSets`, `drawPicks`), `src/render/moveprops.ts`
- `src/layout.ts`: `Beats.moveB`; LONG4 `moveB: { between: [0,1], lead: [100,200], blend: 200 }`; `beatPlan` returns `moveB`
- `src/biomes.ts` (see hunks below), `src/runsave.ts` (validators for `spUsed` and `picks`, both already reserved fields, so no RUN_V bump), `src/render/biomeart.ts` (one call)
- Tests: new `tests/unit/terrainb.test.ts` and `tests/unit/setdraw.test.ts`; `tests/unit/biomebeats.test.ts` gains the drawn-set-piece D20 case; `tests/unit/runsave.test.ts` gains rejection and round-trip cases
- Tools: new `tools/set-share.mjs` and `tools/set-shots.mjs`; `tools/movement-shots.mjs` (B0/B1 and hold shots, gap table), `tools/playtest.mjs` (records picks, `--compare` set-piece rows), `tools/resume-check.mjs` (compares `picks` and `spUsed`)
- Baseline: `tools/harness.breath2.baseline.json`

### Hunks in `src/biomes.ts` (for the LS2-0 rebase)

All of them are in the terrain, set-piece, stage-build and hazard sections. None touches a `mids` table.

1. Imports (`setdraw`, `terrainb`), line ~24
2. `MOVES` + `moveAt(wx)` after `arena()`, line ~157
3. `rewriteTerrain(seg, b, from, mv = null)`: band lerp, lines ~170-181
4. `SET`: 12 new pieces, plus `export const SET_KINDS`, lines ~229-244
5. `biomeScript(..., mids = null, setIds = null)`: **one signature line next to `mids`** (one parameter added after it), plus the set-piece line, lines ~271 and ~304
6. `stagePicks(i, b, v)` after `midStream`, line ~343; `biomeStage` passes the picks, line ~358
7. `biomeReset`: clears `MOVES` and `G.picks` (`G.spUsed` is kept across descents), lines ~448-450
8. `spawnHazard`: chimney vent snap, lines ~457-464; `stepBiome`: hazard timer × `moveHazMul`, line ~506

Hunk 5 is the only one LS2-0 could plausibly touch at the same time.

## Acceptance checklist

| requirement | result |
|---|---|
| B0 and B1 per biome in each long biome stage's movement-B band, read through layout accessors | PASS: `beatPlan().moveB`; unit test "band-only change" proves terrain outside the band is byte-identical |
| 3 new set pieces per biome, without replacement per run, from `stageStream(i)`, never `R()` at render | PASS: `setdraw.test.ts`; props have no RNG |
| gap ≥108 everywhere | PASS in all terrain this lane writes: band min 108.0 (snot throat), A min 108.0, C ≥153.4 (`movement-shots.txt`); unit test checks both gates and naked-ship flyability. **Pre-existing exception:** route-probe `minGap 104.0 @13860` is in the Drive stage, which this lane does not touch. Main `7391234` gives the identical 104.0 @13860 (`route-probe-main-7391234.txt`). Not fixed here: the Drive base terrain is shared with short, and short must not move |
| no set piece in a breath; D20 (breaths ≥300 px from set pieces) | PASS as D20 is defined (the layout invariant on planned set x, `layout.test.ts`). New test in `biomebeats.test.ts` builds every catalogue piece in every set slot for 4 biomes × 2 slots × 2 visits × 2 descents and asserts: planned set x ≥300 px from both edges of every breath; no placed set entry and no enemy spawn inside a breath or past the run-up; placed entry ≥250 px from a breath edge. **Finding:** the beat generator snaps a piece to a nearby spawn slot, so the *placed* entry sits up to 67.75 px from its plan, and the closest placed entry is **263 px** from a breath edge (gutter/drip, which are pre-existing pieces). Placement doesn't depend on which piece is drawn, so this is main's generator, shared with short. Not changed here: fixing it would move every long4 biome scenario. **For Matt:** decide whether D20 should hold on placed x |
| short identical | PASS: short harness PASS vs `8ff9ba4`; `layout-parity` PASS (7 runs) |
| long4 re-baselined and every crossing scenario explained, deterministic ×3 | see the next section |
| route-probe 0 bad hazards, all routes | PASS: 10 routes × 2 descents, `bad []`, hazHitFrames 0, deaths 0, slams 0 on every route |
| world-shots, one per movement per biome, all looked at | PASS: 48 shots in `ls2-mv/move/` (A, B0, B1, C for both slots, B0/B1 hold, A→C) plus 12 set pieces in `ls2-mv/sets/`. I looked at every one. Two fixes came out of that: fire chimney mouth 8→16 (the grille was hidden under the HUD) and the sneeze rear wave 8-10→6-8. The rig now clears a stale banner |
| cross-seed signature ≤50% of set pieces shared | PASS: whole-run worst 18% (200 seeds, `set-share.txt`); played seeds 3/6/7/11/15 mean pairwise share 7-17% (`signature-compare.txt`) |

## Harness moves

- **`breath2` moved.** Old `{score 1000, py 84.565, gibs 30, drops 75, caps 0, pow .065, sig 24ea3cef14}` → new `{score 1500, py 109.565, gibs 37, drops 26, caps 3, pow 0, sig 876cbb6535}`. Why: the scenario starts about 124 px before breath 2, inside the tail of stage 1's movement-B band (ice B0). The crevasse teeth change the terrain the bot flies through, and B0 also scales the icicle timer by ×.7. Attribution: with `gimmick` returning its inputs and `moveHazMul` at 1, breath2 matched the *old* baseline exactly, so the move comes only from the movement-B terrain and hazard rate. Re-baselined with `--update`. Running `--runs 3` gave the identical sig `876cbb6535` and canvas hashes three times (`breath2-runs3.txt`).
- **`long4` did not move**, even though the brief expected it to. The long4 harness scenario is 3600 frames of Open Orbit and never reaches a biome stage, so movement B and the set pieces are not in its window. It passes unchanged vs `88d9525`. No re-baseline was needed, and none was made.
- The other 11 scenarios pass unchanged (orbit, saucer, drive, maw/drive/crux/butcher ×d1/d3). The crux/butcher ones start at the stage-1 run-up (scroll ~7997), after the band. `drive` is not a biome stage.

## Test, probe and harness output

- `npm run typecheck`: clean. `npx vitest run`: 31 files, **719 tests passed** (687 before the D20 placement test added 32 cases). `npm run build`: built (`build.txt`).
- `npm run test:regress` (`regress.txt`): short PASS, long4 PASS, 12/12 scenarios PASS after the breath2 re-baseline. The run before the re-baseline (`regress-before-rebaseline.txt`) shows breath2 as the only regression.
- `node tools/layout-parity.mjs` (`parity.txt`): PASS. Parity's own note: the bots for seeds 2 and 3 cannot kill the Gravity Drive (pre-existing).
- route-probe (`route-probe.txt`): routes ice,acid · ice,fire · ice,snot · acid,ice · acid,fire · fire,ice · fire,acid · fire,snot · snot,ice · snot,fire, all `bad []`, 0 hazard hits, 0 deaths, 0 slams.
- density (`density.txt`): every breath is 0.0 in all 16 stage/biome rows.
- resume-check long4 S1 CP1 and S2 CP0: PASS, terrain renders differ by 0 px after resume (so picks are read back, not redrawn).
- jump-check: ALL PASS.
- playtests on seeds 3/6/7/11/15, long4, 2 descents, 12-minute cap: errors none, 0.3-0.7 would-be hits/min. The bot killed the Gravity Drive in D1 on every seed, and in D2 on every seed except 11, where the 12-minute cap hit mid-fight ("unfinished"). **In the first gate run, seeds 3 and 6 died with "Execution context was destroyed … navigation".** A rerun of both passed cleanly (the logs now in evidence are the reruns). The game's only `location.reload` is the save import in `menus.ts`, which the bot never touches, so I believe the cause was an external dev-server reload (the `node_modules` symlink and Vite cache are shared with the other lanes). I did not confirm that.
- set-share: movement-B split B0/B1 per stage: 1-2 200/0, 1-3 200/0, 2-2 44/156, 2-3 45/155, 3-2 26/174, 3-3 27/173.

## What I did not measure

- Performance of the props: `perf-probe` was not run. S2-K1 perf stays open and is judged on the Fold (D30).
- `rng-probe` was not run (unit rng-split passes).
- density-probe counts a set piece as one call and calls `biomeScript` without `setIds`, so its counts don't reflect which pieces were drawn.
- Fold contraction motion and Peristalsis motion in stills. Descent 2+ terrain seeds in the movement shots (the shots are D1 seeds; set-share and playtests cover D2/D3 picks).
- Cross-run memory: the draw is per run, so two runs can repeat a set.

## Stubs and open risks

- **Same-biome share is 60% by raw count** (Jaccard 46%, same pieces in the same place 20%). The ≤50% target passes on whole runs (worst 18%), but two seeds that visit the *same* biome play 3 of the same 5 pieces 60% of the time, by construction: uniform 3-of-5 shares 1.8 pieces on average. Getting under 50% there needs a larger catalogue or cross-run (meta) memory, which is out of scope. **For Matt.**
- **Spec reading, §3.3 Peristalsis:** spec §3.3 requires noise-only terrain, so the snot "march" is a static train of narrows with render-only contraction bands moving at `t*.7`, not moving collision. **For Matt** if moving walls were meant.
- Movement-B props and the 12 new set pieces' looks are interim procedural art and wait on round 2.
- Placed set entries can sit 263 px from a breath (planned ≥300; see the checklist). Main's generator, flagged for Matt.
- The Drive stage's base terrain has a 104 px minimum gap (pre-existing, see the checklist). Fixing it would move short and long4.

## Merge-order notes

- `src/biomes.ts` overlaps LS2-0. Hunk 5 (the `biomeScript` signature) is the only line next to `mids`, so a rebase either way is a one-line merge. Keep both parameters, `mids` then `setIds`.
- `src/runsave.ts`: this lane fills in the reserved `spUsed` and `picks` validators. If another lane also adds allowlist entries, the conflict is in the same validator table, and both lanes' entries should be kept.
- Merge this after any lane that changes `beatPlan`'s return shape. `moveB` is additive and `null` on short.
- Only the `breath2` baseline is re-baselined here. A lane that also moves breath2 needs it re-taken after both have merged.
