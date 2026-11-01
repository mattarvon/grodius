# LS1-A: layout table (sprint 1, lane a)

Branch `ls1-a`, off main `f2f9c03`. Owners: lead-programmer and tools-programmer. Spec: `design/content-expansion.md` §2.2 and §3.2. Plan: `production/content-build-plan.md` §0 and §2, row A. Rulings from review: `production/decision-log.md` D20.

## Commits

| Commit | What |
|---|---|
| `4f3206f` | `tools/layout-parity.mjs` and its first **before** dump, recorded on `f2f9c03`'s code. The one src change is a read-only test hook (`window.__musicPlan`), described below |
| `6cec897` | The refactor: `src/layout.ts`, every consumer wired to it, `tests/unit/layout.test.ts`, and `tests/integration/layout-literals.test.ts` (the grep test) |
| `46c74ec` | First lane report; `biomes.SEG` kept as a deprecated alias for the probes |
| `f529b1c` | Specialist-review fixes, and the parity tool upgrade. The **before** dump was re-recorded with the upgraded tool against `4f3206f`'s code, served from a temporary worktree |
| `ddd3c29` | Lead-review fixes and rulings: invariant test v2, `gateLate`, `layout-kinds.test.ts`, decision log D20 |
| (this file) | Refreshed report and the Studio review record |

## What changed

### `src/layout.ts` (new)

It is pure and imports nothing. Its `short` entry is today's descent:

| Stage | Kind | x0 → x1 | bossX | Other |
|---|---|---|---|---|
| 0 | orbit | 0 → 2300 | 2120 (the Maw) | `warnX` 2000 ("SOMETHING IS COMING"); drift `ufo` at 800, gapEnd 1840, exitLead 60 |
| 1 | biome slot 0, fork | 2300 → 5150 | 4950 | `end` 5050; `gateLate` 2660 |
| 2 | biome slot 1, fork | 5150 → 8300 | 8020 | `end` 8200; `breathAfterMid` 260 (legacy); `gateLate` 5640 |
| 3 | drive | 8300 → 10000 | 9300 | `warnX` 9060 |

The entry also holds:
- `tEnd` [8300, 8600]
- the beat fractions
- the bands: AMT, the buildTerrain bands, `drawInterior`'s band, the hell bands
- the HUD depth marks

Accessors read the active entry when they are called: `layout`, `setLayout` (contract: only before `newGame`), `row`, `kindOf`, `slotOf`, `stageOfSlot`, `nSlots`, `slotRow`, `forkAfter`, `lastStage`, `rowOfKind`, `bossAt`, `ufoRow`/`ufoDrift`/`ufoAt`/`ufoGapEnd`, `BANDS`, `innerBand`, `hellCorr`/`hellCore`, `segs`, `parityAnchors`.

### Consumers

| File | Change |
|---|---|
| `core.ts`, `biomes.ts`, `enemies/ufo.ts` | `LEVEL`/`BOSS_AT`, `SEG` and `UFO_AT`/`UFO_GAP_END` became `@deprecated` boot-time aliases. They exist only for the probes; item J deletes them |
| `world.ts` | `AMT = BANDS`. `buildTerrain` reads `layout().terrain` |
| `biomes.ts` | Slots come from `slotRow`; `tEnd` and the beats come from the layout. Adds `biomeExit(slot)` and `startStage(stageOfSlot(seg))`. `biomeK` loops over `G.route`, so it allocates nothing per frame. An `// LS3:` marker sits at the `G.bx` adjacency assumption |
| `stages.ts` | `STAGE_NAMES` is keyed by kind. `clearStage` uses `forkAfter`, `lastStage` and `biomeExit(r.slot)` |
| `flow.ts` | `G.route` is sized by `nSlots()` |
| `enemies/scripts.ts` | Script x is stage-relative (Drive x0 is 8300). The Maw, banner, WARNING and startBoss come from `bossX`/`warnX`. The Saucer's WARNING is placed by its own row. `pickV` memory is now `G.remixV` |
| `music.ts` | `TRACKS` is keyed by kind (`orbit`, `orbitBoss`, `biome[slot]`, `drive`, `driveBoss`). The `'+'` mix reads `G.visitNo[slotOf(stage)]` |
| `depth.ts` | The orbit-Maw check uses `kindOf` |
| `fx/update.ts` | The hellFlash roll reads `hellCorr`/`hellCore` |
| `render/terrain.ts` | Uses `innerBand` |
| `render/hud.ts` | Uses `bossAt()` and `hudMarks` |

`G.remix` was split in two: `G.remixV` (the per-section variant memory, kept across descents) and `G.visitNo` (the repeat-visit count per biome slot). `tools/playtest.mjs` and `tools/elite-shots.mjs` now read `visitNo`.

The test hook in commit 1 is `music.ts` `mixWanted()`. It is the same expression as before, extracted, and `window.__musicPlan` exposes it so the parity check can see the music choice with audio off.

### Parity tool

`tools/layout-parity.mjs` runs 5 seeds × 2 descents with a seeded, invincible bot. It stubs rendering and audio, fakes the clock, and steps once per rAF. Per stage it dumps:
- scroll at stage start and end
- the script x list, and each entry that fired with the kinds it spawned
- a spawn-trace hash
- midboss arrivals and exits (killed or withdrew, scroll, frames)
- the fork and its `bx`
- the tally
- terrain hashes
- the sequence of music switches

Per run it dumps:
- the anchors, with AMT sampled every 10 px
- the gap, slam and hazard checks, plus a hazard hash

The gate at each fork is hashed from the seed, so over the default seeds every fork position takes both gates. Every run prints what it did not measure.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Harness `st` byte-identical | **PASS** vs baseline @ 1e20b36 on every commit |
| Full-descent parity identical on 5 seeds | **PASS**: seeds 1, 3, 5, 7, 11 × 2 descents identical to the pre-refactor dump |
| `npm test` green | **74/74** unit and integration tests; harness PASS; typecheck and build clean |
| No literal world x outside `layout.ts` (grep test) | **PASS**. Watched failing: all 4 checks fail on `f2f9c03`'s `src` |
| `layout.test.ts`: stages contiguous | PASS |
| `layout.test.ts`: breaths ≥ 300 px from set pieces and bossX | PASS, with `short`'s legacy gaps pinned (accepted by the game-designer lead, D20). Checked at the earliest gate and the latest gate (`gateLate`) |
| `layout.test.ts`: DRIFT exit ≥ 300 px before the next WARNING | PASS, with one pinned legacy gap: the Saucer exits at 1780, 220 px before "SOMETHING IS COMING". Measured to what the player sees, per D20, including breath WARNINGs. A negative test covers a drift midboss in a biome slot |
| Parity tool built first; before recorded on unmodified code | Yes (`4f3206f`). Re-recorded on that same code with the upgraded tool in `f529b1c` |

## Test and probe output

**Parity** (second review round: 5 seeds × 2 descents, plus `1x3` and `7m`):

```
run 1 (seed 1, 2 descents) gates 0111: shop 2, 8 stages, 31846 play frames, deaths 0, errors 0
run 3 (seed 3, 2 descents) gates 1001: shop 2, 8 stages, 31385 play frames, deaths 0, errors 0
run 5 (seed 5, 2 descents) gates 0101: shop 2, 8 stages, 35177 play frames, deaths 0, errors 0
run 7 (seed 7, 2 descents) gates 1010: shop 2, 8 stages, 33796 play frames, deaths 0, errors 0
run 11 (seed 11, 2 descents) gates 0100: shop 2, 8 stages, 30441 play frames, deaths 0, errors 0
run 1x3 (seed 1, 3 descents) gates 0111: shop 3, 12 stages, 47126 play frames, deaths 0, errors 0
run 7m (seed 7, 2 descents, mortal) gates 1010: game over, 2 stages, 5781 play frames, deaths 3, errors 0
not measured: render-only output (canvas stubbed); deaths after the mortal run's game over; seed 2 (its bot cannot kill the Gravity Drive)
PARITY PASS vs baseline @ 4f3206f (...): runs 1, 3, 5, 7, 11, 1x3, 7m identical
```

What the runs cover:
- All 4 biomes, both slots, and both gates at every fork.
- Descent 2 with a slot-1 repeat visit (seed 3).
- Descent 3 with a slot-0 repeat visit (`1x3`: acid, with the `'+'` mix).
- A mortal run (`7m`) with three deaths in the Cryovault, respawns, lives running out and the game over.

The baseline was re-recorded with this tool against `4f3206f`'s code, served from a temporary worktree. Two tool fixes went in along the way: Backspace is now always released, so a third Infirmary visit no longer gets stuck; and deaths are recorded with the last stage closed at game over.

**Mutation checks** (current tool, each change reverted afterwards):

| Mutation | Caught by |
|---|---|
| `tEnd` 8600 → 8610 | `anchors.tEnd`, plus seed 1's run changes completely: hazards 112 → 47, and the bot now stalls at the Drive |
| Drive script x 130 → 131 (a log line, no spawn) | `stages.*.script` and `fired`: 8430 → 8431 |
| AMT hull band 2700 → 2710 (render and ambience only) | `anchors.amt.hull`: "first differs at sample 241 (x = 2210)" |

**Harness:** `PASS vs baseline @ 1e20b36`. Its advisory note that the canvas hashes differ also shows on unmodified code in this worktree, with identical hashes before and after. The cause is the environment: fonts sit outside Vite's allow list via the `node_modules` symlink.

**Screenshots:** `production/qa/evidence/ls1-a-drive-corridor.png` and `ls1-a-biome-slot1-hud.png` (corridor backdrop, terrain, HUD depth bar). The art director checked them.

## Studio Hierarchy review (full; Matt asked for it)

| Tier | Reviewer | Verdict | What came of it |
|---|---|---|---|
| Specialist | web-specialist | APPROVE WITH NOTES | It found no behaviour difference. `biomeK` allocation fixed; deprecated import dropped |
| Specialist | tools-programmer | APPROVE WITH NOTES | Parity coverage upgrades made (gates, midboss exits, hazards, music order, AMT diff, not-measured line, commit label). DRIFT and late-gate questions sent to game-designer |
| Specialist | gameplay-programmer | APPROVE WITH NOTES | `stageOfSlot` fixes the long5 `seg + 1` trap; the Saucer is placed by its own row. `G.bx` adjacency carried with an LS3 marker |
| Lead | game-designer | APPROVE WITH NOTES | Ruled the DRIFT rule is measured to the WARNING, accepted the legacy pins, and required the late-gate check. All applied (D20) |
| Lead | lead-programmer | APPROVE WITH NOTES | `setLayout` contract, typed `LAYOUTS`, LS3 marker done. Rename suggestions (`segs` → `slotSpans`, a generic `driftsOf`) left to lanes C/E, which add the callers |
| Lead | qa-lead | APPROVE WITH NOTES | Report refreshed (this file); mutation checks repeated on the current tool; gaps recorded below |
| Lead | art-director | APPROVE WITH NOTES | No look change. `hudMarks` becomes an art decision once long rows exist; recheck hell-flash timing then |
| Lead | audio-director | APPROVE WITH NOTES | Track choice identical. Comments, `pacing.md` and the `musicPlan` note fixed; the `interior` track is guarded by `layout-kinds.test.ts` |
| Lead | narrative-director | APPROVE WITH NOTES | No text change. The `interior` name is guarded by `layout-kinds.test.ts`; the writer drafts it when long5 lands |
| Lead | release-manager | APPROVE WITH NOTES | No CI, Pages or APK risk. Parity stays a manual gate. Louder init-order comment in `spawn.ts` |
| Lead | localization-lead | APPROVE WITH NOTES | Strings unchanged. Keying names by kind helps a future string table |
| Director | technical-director | APPROVE WITH CONDITIONS | Sound as the LS1 foundation; main stays shippable (only `short` exists, nothing calls `setLayout`). C1: no non-`short` entry until J deletes the aliases. Enforced now by a tripwire test in `layout-literals.test.ts`, with the plan saying J before D. C2: mortal-bot or 3rd-descent coverage, or a written gap acceptance, before D/E merge (added to the plan). C3: long5 waits for the `G.bx` fix (added to the LS3-0 row). C4: parity is a required merge-checklist item for layout/stages/biomes/scripts lanes (D20; owner release-manager) |
| Director | creative-director | APPROVE WITH CONDITIONS | Accepting the short debt fits the game's identity; both rulings serve the pillars. C1: the short tune becomes an explicit open question for Matt, added as **D21** (default no tune; trigger: the long flip slips). C2: `interior` names a slot kind, not a look, and the per-kind `hell` values are authored with D/E after round 2, never copied from AMT. Per-row overrides may be needed if meridian picks distinct rooms (owner: art-director with narrative-director) |
| Director | producer | APPROVE WITH CONDITIONS | Row A is **Done** (all Acceptance and Evidence columns met; deviations recorded in D20). Scope about +5%, no creep. Plan text amended in this commit: row A (`perks.ts:48` → G, `G.bx` → LS3-0), Sprint 1 merge order (parity re-run, B1 re-baselines, H0 rebases on A), H0 allowlist (`remixV`, `visitNo`), J before D and J deletes the aliases, coverage before D/E, the LS3-0 row. Coordinator notes: B1 conflicts on `fx/update.ts:316`, `render/hud.ts` and `render/terrain.ts`; keep A's `hellCorr`/`hellCore` and B1's `srnd()`, then re-run the harness and parity on the merged tree. P0, G0 and F0 are clean |

**Outcome:** no block at any tier. Row A is Done and ready for the coordinator to merge, after B1 per the notes above. The lane does not merge to main.

## Carried items (not fixed in row A, each with an owner)

1. **`G.bx` assumes the biome slots are adjacent.** long5's interior between them would hand back terrain and the biome look wrongly. Owner: LS3, marked at `biomes.ts` "where are we".
2. **The deprecated boot-time aliases go stale if `setLayout` runs after import.** Item J deletes them **before** item D lets a long layout activate.
3. **~~Hits, deaths, respawn and game over are covered by neither gate~~: closed in the second round** (`1x3` and `7m` runs). Still open: deaths after the mortal run's game over, and seed 2, which is excluded.
4. **`perks.ts:48` `stageXP`.** Moved to G0/G (D20).
5. **`hell` bands are literal copies of AMT in `short`.** Per-kind values come with the long rows (D/E). Art re-checks the mood timing then.

## Merge-order notes

- **A owns `src/stages.ts` and `src/flow.ts` first.** Everything else rebases on A. Later lanes that add world-x numbers to the anchor files fail `layout-literals.test.ts` and must route them through `src/layout.ts`.
- **B1 (render RNG split) can land before or after A.** Whichever lands second re-runs the harness **and** `node tools/layout-parity.mjs` against the merged tree. B1 moves the RNG, so it re-records the parity baseline with `--update` in the same commit, with the reason; it must not re-baseline silently.
- **H0 (run save):** the allowlist carries `remixV` (an object kept across descents) and `visitNo` (an array by slot), plus `route` and `bx` sized by `nSlots()`. `G.remix` is gone.
- **D, E and J** build on `layout()` and the accessors. They add `long4` to `LAYOUTS`; `layout.test.ts` and `layout-kinds.test.ts` check every entry automatically. J deletes the aliases.
