# LS1-C: build each stage on entry (C) and per-stage build streams (B2)

Branch `ls1-c`, off main `8ff9ba4`. Owner: engine-programmer. Plan: `production/content-build-plan.md` §2 Sprint 2, rows C and B2. Spec: `design/content-expansion.md` §4 (checkpoint rebuild) and §6.3 (the picker draws from `Rs`). Rulings: `production/decision-log.md` D20.

## Commits

| Commit | What |
|---|---|
| `662699c` | **C.** `buildStage(i, fromX)` replaces startLoop's up-front `buildScript`. Both gates at diff 0 |
| `f76e438` | **B2.** `src/rng.ts`, the run seed in `G.seed`, every build draw on its stage stream, Orbit and the Drive built at their own entry. **One** parity re-baseline, plus the parity seed swap 1x3 → 9x3. The harness did not move |
| (this file) | Evidence |

## What changed

### C (`662699c`)

| File | Change |
|---|---|
| `src/stagebuild.ts` (new) | `buildStage(i, fromX)`: one builder per stage. A biome stage goes to `biomeStage(slot, fromX)`; other kinds insert `stageScript(i)` |
| `src/enemies/scripts.ts` | `buildScript(L)` is split in two. `pickStageVariants(L)` makes the R() draws, in the old order and at the old moment (oA, oC, oD, dE, dF). `stageScript(i)` only places; it reads the pick from `G.remixV[key].last` |
| `src/biomes.ts` | `biomeStage(seg, from)` = `rewriteTerrain` + `insertScript(biomeScript(...))`, reading `G.route[seg]` and `G.visitNo[seg]`. `choose()` calls it directly. `insertScript` is exported |
| `src/flow.ts` | startLoop: the picks, then `buildStage` for each non-biome stage |
| `src/enemies/spawn.ts` | The re-export follows the rename |
| `tests/unit/stagebuild.test.ts` (new) | Descent 1's x list equals the old build's (35 entries, pinned from the parity baseline) and a biome stage goes to its slot. It also checks the merge into the live script (sorted, played part untouched) and that entries stay inside their row |

### B2 (`f76e438`)

| File | Change |
|---|---|
| `src/rng.ts` (new, pure) | `seedOf(runSeed, loop, stageIdx)` (fmix32), `stream(seed)` (xorshift32, modelled on `srnd.ts`), `rsInt`, `newRunSeed(R)` |
| `src/flow.ts` | `newGame` sets `G.seed = newRunSeed(R)`: one sim R() draw per run. startLoop no longer builds; stage 0 is built by `startStage(0)` |
| `src/stages.ts` | `startStage(i)` builds non-biome stage i (`buildStage`): the stage's real entry |
| `src/biomes.ts` | `stageStream(i)` = `stream(seedOf(G.seed, G.loop, i))`, fresh each call. `remix(..., rs)` and every `biomeScript` build roll (kind, signature, extras) use it. Entries carry `k` |
| `src/enemies/scripts.ts` | `pickV(key, vs, L, rs)` draws from the stream, and is idempotent per descent (`h.L`): a second build returns the same variant without drawing. `stageScript(i, rs)` picks, then places; entries carry `k` (section + variant, or the fixed beat) |
| `src/stagebuild.ts` | Passes `stageStream(i)` |
| `tests/unit/buildstream.test.ts` (new) | See the acceptance list |
| `tests/unit/{economy,layout-kinds,stages}.test.ts` | One `vi.mock('../../src/stagebuild')` line each, because `startStage` now builds |
| `tools/layout-parity.mjs` | 1x3 → 9x3 (seed swap, below) |
| `tools/layout-parity.baseline.json` | The one B2 re-baseline |

`src/runsave.ts` was not changed: it already allowlists `seed: isNum`, so the run save writes `G.seed` once newGame sets it.

## Acceptance

**C**
- [x] Short layout, harness identical: **PASS**. `st` is byte-identical. Canvas hash 0 differs from the baseline (advisory), and clean main `8ff9ba4` gives the same `aa9d7ee9c0`, run twice in a temporary worktree. This is environmental: the `@fontsource` files sit outside Vite's allow list when `node_modules` is a symlink.
- [x] Full-descent parity identical: **PASS**. Runs 1, 5, 6, 7, 11, 1x3 and 7m are identical to the `8ff9ba4` baseline.
- [x] Same `R()` draws, in the same order, at the same moments: the picks stay at startLoop, placement draws nothing, and the biome draws stay at the gate.
- [x] Committed on its own, with both gates green, before B2.

**B2**
- [x] Building stage i twice gives the same script x list and kinds (`tests/unit/buildstream.test.ts`). Covered: all 4 biomes × first and repeat visit × both slots, and Orbit and the Drive in Descents 1-4. The test's `core` mock **throws on any sim R/rr/ri/pick call**, so a build that still drew the sim RNG fails. All 7 of its build and save tests were seen failing against C's code before B2 went in. C's builds draw the sim RNG and take no stream, so a failure there doesn't by itself isolate the throwing mock.
- [x] A different loop, stage or run seed gives a different list (three tests). Descent 1 still plays the classic variants whatever the seed.
- [x] The run seed is drawn once per run at `newGame()` and stored in `G`. The round-trip test runs `serializeRun → decodeRun → applyRun` into a fresh G; the seed comes back and rebuilds the same biome stage.
- [x] The sim R() is unchanged for spawn-time rolls: side, y, formation, in-flight behaviour and elite status (below).
- [x] Short-layout anchors in the parity dump are unchanged (diff below).
- [x] **One** parity re-baseline, in the same commit as the code, every moved field explained.
- [x] Harness: **no re-baseline**, because nothing moved. `st` and all 6 canvas hashes equal `tools/harness.baseline.json`. The 60 s Open Orbit run reaches no biome build, and Descent 1's Orbit picks draw nothing. The one new draw (the run seed) left this run's sim state unchanged. The brief expected one harness re-baseline; re-recording an unmoved baseline would only have written this machine's hashes into it.

## Output

```
npm run test:unit   18 files, 222 tests passed
npm run typecheck   clean
npm run build       clean (only the existing chunk-size notice)

# C, 662699c
npm run test:regress   PASS vs baseline @ f2f9c03 (st identical; 1/6 canvas hashes differ, advisory, same on clean main)
layout-parity          PARITY PASS: runs 1, 5, 6, 7, 11, 1x3, 7m identical

# B2, f76e438 (--update run)
run 1 (seed 1, 2 descents) gates 0111: shop 2, 8 stages, 33547 play frames, deaths 0, errors 0
run 5 (seed 5, 2 descents) gates 0101: shop 2, 8 stages, 32845 play frames, deaths 0, errors 0
run 6 (seed 6, 2 descents) gates 1100: shop 2, 8 stages, 30902 play frames, deaths 0, errors 0
run 7 (seed 7, 2 descents) gates 1010: shop 2, 8 stages, 32723 play frames, deaths 0, errors 0
run 11 (seed 11, 2 descents) gates 0100: shop 2, 8 stages, 35058 play frames, deaths 0, errors 0
run 9x3 (seed 9, 3 descents) gates 1010: shop 3, 12 stages, 48299 play frames, deaths 0, errors 0
run 7m (seed 7, 2 descents, mortal) gates 1010: game over, 2 stages, 5722 play frames, deaths 3, errors 0
npm run test:regress   PASS vs baseline @ f2f9c03 (st and all 6 canvas hashes identical)

# re-checked on the committed f76e438 tree
npm run test:regress   PASS vs baseline @ f2f9c03
layout-parity          PARITY PASS vs baseline @ 662699c-dirty: runs 1, 5, 6, 7, 11, 9x3, 7m identical
```

The baseline's `commit` field reads `662699c-dirty`: it was recorded from B2's working tree just before `f76e438` was committed. The code is the same.

The B2 baseline was recorded twice: before and after the seed swap. Runs 1, 5, 6, 7, 11 and 7m came out identical both times, so the recording is deterministic.

### The parity re-baseline: what moved and why

Diff of `8ff9ba4`'s baseline against B2's, over the six runs present in both (1x3 and 9x3 are different runs):

| Field | Paths moved | Why |
|---|---|---|
| `script[]`, `si`, `scriptLen` | 1230 / 25 / 41 | Orbit and the Drive are placed at their own entry. Stage 0-0 starts with Orbit's 21 entries, not 35; the Drive's 14 arrive at 0-3. Where the route moved, the biome lists moved too |
| `fork.opts`, `route`, `route.forks[]` | 13 / 19 / 14 | `openFork` shuffles with the sim R(), whose values shifted (the run-seed draw, and the build draws gone from the stream) |
| `fired[]`, `kinds{}`, `spawns`, `spawnHash`, `minis[]`, `tally`, `frames`, `music[]`, `boss`, `scroll1`, `deaths[]`, `playFrames` | 891 / 256 / 38 / 39 / 81 / 38 / 39 / 91 / 1 / 3 / 4 / 6 | Different biomes, remixes and spawn rolls make different fights |
| `route.haz*`, `minGap*` | 32 / 6 | Hazards and terrain follow the route |
| `terrain0`, `terrain1` | 19 / 26 | **Only where the route moved.** Each stage's two terrain hashes were checked against the route at that point: 84 of 84 hashes on an unchanged route are unchanged (108 of 108 including the 3-descent run before the swap). The fork x (`bx`) did not move in any run |
| `scroll0` | 1 | Run 7, the Drive start: 8368.744 → 8367.916, which is now the value every other run has. No other stage start moved |
| `anchors` (level, bossAt, seg, tEnd, ufoAt, ufoGapEnd, amt) | **0** | Unchanged in every run |

Totals: 2913 paths moved with anchors, terrain hashes and `scroll0` included, and 2867 with them filtered out. The 46-path difference is the 45 terrain hashes and the one `scroll0` above, each explained. No anchor moved. The scripts are `pdiff.mjs` and `tcheck.mjs` in the lane's scratchpad; they diff two baseline JSONs field by field.

### Seed swap (1x3 → 9x3)

- **What broke:** after B2, seed 1's Descent 3 took acid at slot 0, which was fresh, so the 3-descent run lost the slot-0 repeat visit it exists to cover.
- **The sweep:** 3 descents each on seeds 4, 8, 9, 10, 12 and 13.
  - Seeds 8, 9 and 10 revisit at slot 0 in Descent 3.
  - **Seed 9** also revisits at slot 1 in Descent 2, so it was chosen: Descent 3 is ice at slot 0 (first flown in Descent 1) and fire at slot 1.
  - Seed 13 times out at the Gravity Drive (Drive stage reached, scroll pinned at 9348). That is the known bot-kit limit, like seeds 2 and 3.
- **Coverage after the swap:**
  - Both gates are still taken at every fork position: the bot's gate indices are hashes of the seed, unchanged.
  - Runs 1 and 5 fly a slot-1 repeat visit in Descent 2 (ice and acid).
  - No run times out.

## Decisions the brief did not settle (safest default taken)

1. **C placed Orbit and the Drive at startLoop, not at their entry.** `tools/layout-parity.mjs` records each stage's whole remaining script (`script`, `si`, `scriptLen`) at stage start. Placing the Drive at stage 3's entry would show up as a parity diff even with play unchanged, and C's gate is diff 0. C instead keeps the picks at startLoop (the brief's example) and makes placement draw-free. B2 then moves both stages to their real entry, where it costs nothing, inside its one re-baseline.
2. **Elite rolls stay on the sim R().** The brief lists "build-time elite rolls (`eliteRoll` inside `biomeScript`)" for Rs, and also lists elite status among the spawn-time rolls that stay on R(). There is no build-time elite roll today: `el()` calls `eliteRoll` at spawn time on the enemies the spawn produced, and their number depends on rank. Spec §4 says elite status is not reproduced after a resume, and that making it exact "is optional and not in LS1". So `elite.ts` is untouched.
3. **The harness was not re-baselined** (see Acceptance).
4. **The base terrain stays a descent-level build at startLoop.** A biome stage's terrain blend runs into the next row, up to `tEnd`, so the base can't be laid stage by stage after it. Terrain is noise-only, so it rebuilds exactly; a resume calls `buildTerrain(L)` and then `biomeStage(seg, bx[seg])` for each committed slot.
5. **`choose()` calls `biomeStage` directly, not `buildStage`.** That way `biomes.ts` gains no import of `stagebuild.ts`, and the boot-time module order is unchanged (`textures.ts` draws the sim R() at import). For the same reason `flow.ts` keeps a bare `import './enemies/spawn'` where the old `buildScript` import was.

## Stubs and open risks

- **Midboss pick (item F) is not wired.** F should pass the same stage stream to `midpick.ts pickMids({ rng })` at build time: `biomes.ts stageStream(stageOfSlot(seg))` inside `biomeStage`, and `stageStream(i)` in `buildStage` for the other kinds. Draw it in a fixed position relative to `biomeScript`, either always before or always after, so rebuilds stay exact.
- **Resume (item H)** can rebuild a stage with `buildTerrain(L)`, then `biomeStage(seg, G.bx[seg])` for each committed slot, and `buildStage(i)` for the stage it resumes in, then skip entries below `cpX`. It needs `G.seed`, `G.loop`, `G.route`, `G.visitNo` and `G.remixV`, all already allowlisted. `pickV`'s `h.L` makes the Orbit/Drive picks rebuild exactly from the restored `remixV`.
- **The Drive is placed at its entry with a 62 px margin.** Stage 3 starts at scroll 8367.9 in every parity run, and its first entry is at 8430. If a future change started the Drive stage after scroll 8430, its first entries would fire at once on entry; they are not skipped. The long layout (D/E) should keep each row's first entry clear of its stage start.
- **`ls1-b1fix` is pushed but not on main.** It replaces the parity seed set (3, 6, 7, 11, 15 and 3x3), edits `tools/layout-parity.mjs`, and moves both baselines. Once it lands, this branch needs:
  1. a rebase, taking b1fix's tool and baselines over mine at C;
  2. C's gates re-run against b1fix's baselines (expected diff 0: C draws nothing new);
  3. B2's parity re-baseline re-recorded on top, with the seed coverage re-checked (b1fix's 3x3 may need a swap like the one above);
  4. the field-by-field explanation above refreshed.

  None of this was done here: the brief says to rebase after it lands, and it hadn't.
- `production/content-build-plan.md` line 110 still says `1x3`. That is the producer's document, so it is left for the coordinator.
- **Not measured:**
  - render-only output (the parity tool stubs the canvas);
  - deaths after the mortal run's game over;
  - seeds 2, 3 and 13 (Gravity Drive timeouts);
  - the long layout (it doesn't exist until D).
- **No screenshot:** nothing player-observable changed. The run seed only moves which remix a seed plays, and a real run's sim RNG was already unseeded.

## Merge order

C and B2 are on one branch, C first. Merge order is C → B2 → D → E. D and E rebase on `src/flow.ts`, `src/stages.ts`, `src/enemies/scripts.ts`, `src/biomes.ts` and the new `src/stagebuild.ts`/`src/rng.ts`.
- D's new biome beat template should keep every build roll on the `rs` parameter of `biomeScript`.
- E's Orbit/Drive generator should draw from the `rs` that `stageScript(i, rs)` receives, never from R().
- Both get the "build twice, same list" test for free if they extend `buildstream.test.ts`.

J and D2 do not touch these files. **`tools/layout-parity.baseline.json` and `tools/layout-parity.mjs` conflict with `ls1-b1fix`** (above).
