# LS1-E: long Open Orbit and the Drive approach (sprint 2, lane e)

Branch `ls1-e`, off main `8ff9ba4`. Owner role: level-designer. Spec: `design/content-expansion.md` §3.4 ("Authoring method"), §3.1 (wall time), §3.2 rule 1. Plan: `production/content-build-plan.md` §2 Sprint 2, row E. Rulings: `production/decision-log.md` D20 and D21.

**State: built and measured, not yet wired to a real `long4` entry.** Item D (`origin/ls1-d`) had not been pushed when this lane finished, so there was nothing to rebase onto. The generator, cells and rows are done and unit-tested. They are exported for D's entry to place (see "Stubs"). The long numbers below come from a **scratch `long4` entry** that was never committed. It is described under "How long4 was measured".

## Commits

| Commit | What |
|---|---|
| `13addc9` | The generator: `src/cellpick.ts` (new), the cells and `buildPlanned` in `src/enemies/scripts.ts`, `StagePlan`, `LONG4_ORBIT` and `long4Drive` in `src/layout.ts`, and `tests/unit/cellpick.test.ts` |
| `77258c7` | Long Orbit grows from 3600 to 4380 px to reach its wall-time band, plus a 13th Orbit cell. `buildPlanned` is split into `pickPlanned` (draws) and `placePlanned` (no draws), to match lane C's split |
| `df28905` | Tools: the `pod-probe` tally clock, and the cross-seed signature report in `playtest.mjs` (`--compare`) |
| (this file) | Lane report and two retained screenshots |

## What changed

| File | Change |
|---|---|
| `src/cellpick.ts` (new, pure) | `pickCells`/`noteCells` move `pickV`'s rules down to the cell (see the rules below). Also: an optional fixed Descent 1 opener; `genFiller` (a beat every `gap` px, ±15% jitter) over two mix tables. `INTERIOR_MIX` is the spec's table: drones .30, sentry .14, corpse .14, flayer .12, hatch .10, mutant .06, crawler .06, womb .04, eyes .04. `ORBIT_MIX` is the same table without the terrain kinds, because Orbit has no terrain |
| `src/enemies/scripts.ts` | `ORBIT_CELLS` (13), `ORBIT_OPENER`, `DRIVE_CELLS` (13), `pickPlanned`, `placePlanned`, and `fillSpawn` (filler kind → spawn call). `buildScript` takes the planned path **only when the row has a `plan`**. The `short` rows have none, so their sections, `R()` draws and x values are untouched |
| `src/layout.ts` | `StageRow.plan` (`StagePlan`: tagged cell slots, filler windows, opener count). `LONG4_ORBIT` and `long4Drive(x0, x1)`. **Neither is registered in `LAYOUTS`**: D owns the entry, and the J tripwire forbids a second entry while the aliases exist |
| `src/enemies/ufo.ts` | Comment only. The Saucer already read `ufoAt()`/`ufoGapEnd()`/`exitLead` from its row (row A), and `$.G.eat` already follows `ufoGapEnd()` (`ufoWarn`). Nothing in its logic had to change |
| `tools/pod-probe.mjs` | `tally_s`: each stage's tally clock, from STAGE card to boss kill. This is spec §3.1's wall time. The existing `dur` runs from label to label, so it also counts the tally card and the fork or shop |
| `tools/playtest.mjs` | Writes `<outDir>/sig.json` per run. `--compare <dirs…>` gives the cross-seed signature report |
| `tests/unit/cellpick.test.ts` (new) | 25 tests |
| `production/qa/evidence/ls1-e-*.png` | Retained screenshots (long4, seed 1): the Saucer WARNING on long Orbit, and the long Drive corridor |

### The cell rules (spec §3.4: "pickV's rules move down to the cell level")

1. A cell is eligible when it has the slot's tag and `min <= L`.
2. **Never a cell already placed this descent.** This rule is never relaxed. A slot with no candidate stays empty, the way `midpick` handles it.
3. Prefer cells that were not in last descent's set.
4. Among those, prefer cells not seen this run.
5. Draw uniformly from the best tier that is not empty. `relaxed` counts the picks that fell back past rule 3.

Each tag's pool holds at least twice that tag's slots per descent. The test runs the real pools over 8 descents × 200 seeds and asserts `relaxed == 0`, so "never last descent's" holds in practice.

### Long Open Orbit (`LONG4_ORBIT`; Orbit is stage 0, so stage x = world x)

| x | Beat |
|---|---|
| 200, 500, 800 | 3 intro cells. In Descent 1 these are the **fixed teaching opener** (`o.drones`, `o.sentry`, `o.swarm`: ORBIT_A's classic, one idea per wave, about 15 s) |
| 1100 | Saucer WARNING (drift `at`) |
| 1150-2100 | Orbit-mix filler, gap 80. This is the Saucer's window: eaten while it is up |
| 2040 | The Saucer's forced exit (`gapEnd` 2100 − `exitLead` 60) |
| 2100, 2700 | Build cells |
| 2400-2700, 3000-3300 | Filler, gap 70 |
| 3300 | Peak cell |
| 3600-4000 | Filler, gap 55 |
| 4080 | "SOMETHING IS COMING" (`warnX`) |
| 4200 | The Maw (`bossX`) |
| 4380 | `x1` |

- **Cells:** 3 teaching cells (`min` 2, so after Descent 1 they come back only as ordinary intro cells, from Descent 3), plus 3 intro, 4 build and 3 peak.
- **Where they come from:** ORBIT_A's four variants (split), ORBIT_C's classic, brood, flayer alley and hull breach, and ORBIT_D's run-up.
- **No cell sits in the Saucer window.** Hand-made cells always play; only generator filler can be eaten.

### Long Drive approach (`long4Drive(x0, x1)`, x relative to `x0`)

| x | Beat |
|---|---|
| 130 | Log line |
| 140 | `floor` cell |
| 430 | Wall eyes |
| 460 | Intro cell |
| 800, 1120 | Build cells |
| 1440-1740 | Interior-mix filler, gap 65 |
| 1760, 2080 | Peak cells |
| 2460 | WARNING: GRAVITY WELL CRITICAL (`warnX`) |
| 2550 | The drifting crew |
| 2700 | `startBoss` (`bossX`) |

- **The 13 cells:**

  | Tag | Cells | Where they come from |
  |---|---|---|
  | floor | 3 | DRIVE_E's three mutant variants. Only the first slot has a corridor floor |
  | intro | 2 | E3 lockdown, and the new sentinel |
  | build | 4 | DRIVE_F 0-2, and the new press |
  | peak | 4 | F3 (Descent 2+), and the new cascade, bulkhead and flood (Descent 2+) |

- A test checks that only the floor cells use mutants, crawlers or wombs.
- The Drive has no fixed opener: the brief only fixes Orbit's.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Orbit 75-90 s wall time (LS1, Saucer only) | **PASS on scratch long4:** 78, 81, 78, 79, 78 s (seeds 1, 3, 5, 7, 11; tally clock). At the spec's 3600 px it measured 65-67 s (FAIL), so the row is 4380 px. See decision 1 |
| Drive stage 80-95 s (no midboss) | **3 of 5 seeds in band:** 100, 95, 87, 89, 100 s (mean 94.2). The 2700 px approach is a fixed 45 s. What varies is the bot's Gravity Drive fight: 57.1, 51.9, 43.4, 46.0 and 56.5 s (playtest), against the M3 fight target of 30-45 s. The two 100 s runs are the 57 s fights. The Drive's own tuning is not this lane's; see risk 1 |
| Descent 1 opener identical across seeds | **PASS.** Unit test over 20 streams, plus the in-game report over 5 seeds: `IDENTICAL across seeds, 9 waves: 200:drone 340:drone 450:corpse 520:sentry 630:corpse 740:flayer 800:hatch 920:drone 1040:sentry` |
| The rest of the stage differs across seeds | **PASS:** stage 1-1 after the opener has 5/5 distinct signatures, with 8% mean pairwise wave overlap. Drive 1-4: 5/5 distinct, 19% |
| No cell repeats within a descent | **PASS:** `cellpick.test.ts`. The real Orbit and Drive pools over 8 descents × 200 seeds: no repeat, no cell from last descent, no empty slot |
| Saucer forced exit ≥ 300 px before the next WARNING the player sees (D20) | **PASS:** the exit is at 2040 and the Maw banner at 4080, a 2040 px gap (unit test). `layout.test.ts` will also check it once D registers `long4`, with no legacy pin |
| Filler window (`$.G.eat`) follows `ufoGapEnd()` | **PASS:** unchanged code path (`ufoWarn` sets `$.G.eat = ufoGapEnd()`). It reads the row, so on long4 the window is 2100 |
| Short layout identical | **PASS:** harness byte-identical, and the parity check identical (below) |
| `npm run test:unit`, `typecheck`, `build` | **PASS:** 233/233 tests, typecheck clean, build clean (only the existing chunk-size notice) |

## Test, probe, harness and parity output

**Unit tests:** `cellpick.test.ts` has 25 tests, and the full suite passes 233/233.

**Mutation checks** (each mutation was reverted afterwards):

| Mutation | Tests that failed |
|---|---|
| Drop rule 2 (`!cur.has`) | 7 |
| Collapse the tiers to "any eligible" | 5 |

**Harness:** run after each commit's source:

```
{"st":{"state":"over","score":4885,"scroll":2168,"lives":0,"px":50,"py":173.25,"en":1,"gibs":9,"drops":98,"caps":0},...,"errs":[]}
PASS vs baseline @ f2f9c03
```

The note "1/6 canvas hashes differ (advisory)" also appears on unmodified code in the lane worktrees (the `@fs` font 403s, see `ls1-a.md`).

**Parity** (`node tools/layout-parity.mjs`, on `13addc9` and again on the final source):

```
run 1 (seed 1, 2 descents) gates 0111: shop 2, 8 stages, 33523 play frames, deaths 0, errors 0
run 5 (seed 5, 2 descents) gates 0101: shop 2, 8 stages, 31765 play frames, deaths 0, errors 0
run 6 (seed 6, 2 descents) gates 1100: shop 2, 8 stages, 33120 play frames, deaths 0, errors 0
run 7 (seed 7, 2 descents) gates 1010: shop 2, 8 stages, 31008 play frames, deaths 0, errors 0
run 11 (seed 11, 2 descents) gates 0100: shop 2, 8 stages, 30701 play frames, deaths 0, errors 0
run 1x3 (seed 1, 3 descents) gates 0111: shop 3, 12 stages, 54104 play frames, deaths 0, errors 0
run 7m (seed 7, 2 descents, mortal) gates 1010: game over, 2 stages, 7105 play frames, deaths 3, errors 0
not measured: render-only output (canvas stubbed); deaths after the mortal run's game over; seeds 2 and 3 (their bots cannot kill the Gravity Drive)
PARITY PASS vs baseline @ sprint-1 merge (A+H0+G0+F0+P0+B1): ... runs 1, 5, 6, 7, 11, 1x3, 7m identical
```

**`pod-probe` on scratch long4** (`tally_s`: STAGE card to boss kill, in s; `dur`: label to label):

| Seed | 1-1 Orbit | 1-2 biome | 1-3 biome | 1-4 Drive | Errors |
|---|---|---|---|---|---|
| 1 | 78 (88.2) | 70 | 79 | 100 (112.6) | 0 |
| 3 | 81 (89.1) | 63 | 61 | 95 (107.8) | 0 |
| 5 | 78 (86.6) | 75 | 69 | 87 (98.8) | 0 |
| 7 | 79 (88.1) | 63 | 60 | 89 (102.4) | 0 |
| 11 | 78 (87.1) | 75 | 65 | 100 (111.1) | 0 |

The same 5 seeds on **short**, for reference, have Orbit at 46-65 s and the Drive at 46-87 s. The biome columns on long4 are short's biome rows shifted (item D's beats are not in), so they say nothing about D.

**The bot in the long stages** (playtest, 5 seeds):

| Stage | Saucer TTK | Maw TTK | Drones, share of regular spawns |
|---|---|---|---|
| Orbit | 6.0-10.6 s | 7.7-10.5 s | 35-51% |
| Drive | — | — | 40-53% |

- **Why drones run above the mix's 30%:** that weight is per beat, and `formation()` adds `round(3·pow)` drones to every wave, so per spawn the share rises with power. The `scripts.ts` header records the same effect for short (35-40%).
- **Would-be hits:** 0.2-0.9/min.
- **Page errors:** none.

**Cross-seed signature report** (`node tools/playtest.mjs --compare …`, long4, 1 descent each):

```
cross-seed signature report: 5 runs (seeds 1, 3, 5, 7, 11), layout long4
Descent 1 opener (Open Orbit, before the Saucer WARNING at 1100): IDENTICAL across seeds, 9 waves: 200:drone 340:drone 450:corpse 520:sentry 630:corpse 740:flayer 800:hatch 920:drone 1040:sentry
stage 1-1 after the opener: 5/5 distinct signatures, mean pairwise wave overlap 8%
stage 1-2: 5/5 distinct signatures, mean pairwise wave overlap 7%
stage 1-3: 5/5 distinct signatures, mean pairwise wave overlap 12%
stage 1-4: 5/5 distinct signatures, mean pairwise wave overlap 19%
stage 2-1: no spawns recorded in any run (not measured)
not measured: spawn-time rolls (y, side, elite) are left out of the signature on purpose; a stage a run never reached is missing from its row
```

### How long4 was measured (scratch, not committed)

- **Where:** a temporary detached worktree of this branch, served by Vite on its own port.
- **What was patched in, uncommitted:** a `LAYOUTS.long4` entry, activated at import when `?layout=long` is set.
- **What the entry holds:**
  - `LONG4_ORBIT` and `long4Drive(10380, 13780)`;
  - short's two biome rows, shifted by +2080;
  - short's bands, terrain and hell bands, shifted by +2080 after Orbit and by +3780 at the Drive chamber.
- Under that terrain the corridor floor lasts most of the Drive approach. D's terrain may differ (risk 2).
- **What the Orbit and Drive figures depend on:** only this lane's rows. The scroll to `bossX` is fixed, and the fights are the same code.

## Not measured

- Any of this on **D's real `long4` entry**, because it does not exist yet. That includes the invariant test `layout.test.ts` on `long4` and the route-probe.
- Descent 2+ in-game. The picker rules for later descents are covered by the unit test only; the in-game runs stopped at the end of Descent 1.
- Seeds 2 and 3 have a known bot limit in parity (their bots cannot kill the Gravity Drive). On long4, seed 3's bot killed it, in 51.9 s.
- Phone or Fold timing, and anything render-only.

## Stubs and open risks

**Stubs**
- **`long4` is not registered.** D's entry should use `LONG4_ORBIT` as stage 0 and `long4Drive(x0, x1)` as the Drive row. Long Orbit is **4380 px**, not 3600, which moves everything after it by 780 px compared with a 3600 px plan (decision 1).
- **`?layout=long` is D's flag.** This lane did not touch `main.ts`. `buildScript` picks the planned path from `row.plan`, so it needs no flag of its own.

**Decisions this brief did not settle (each took the safest default; the coordinator or Matt may revisit)**
1. **Orbit length is 4380 px, not 3600.**
   - The spec gives both "3600 px" and "75-90 s" for LS1 Orbit, and at 3600 px the two disagree: the Saucer is a drift midboss and holds no scroll. I took the acceptance band.
   - In LS2 the slot-B held midboss adds about 10 s, so Orbit would land around 88-92 s, against the spec's 85-100 s with both midbosses.
   - The alternative is to keep 3600 px and accept 65-67 s until LS2.
2. **The Saucer window is 1100-2100**, today's 1000 px, so its tuned fight length and pods carry over.
   - Its forced exit at 2040 means **LS2-orbit's slot-B WARNING must sit at x ≥ 2340**, by D20 rule 1. The beat template's p .62 breath would put it at about 2080 on a 3600 px row.
   - The `layout.test.ts` invariant will catch a violation automatically.
3. **13 Orbit cells, one over the spec's 10-12.** The 4380 px Orbit has two build slots, and rule 3 needs 4 build cells.
4. **Opener cells return in Descent 3+** as ordinary intro cells (`min` 2). The old `pickV` never brought variant 0 back. With 3 intro slots, rule 3 needs 6 intro-capable cells, so I reused the opener rather than writing 3 more.
5. **No `$.meta` cross-run memory.** It was optional in the brief. `save.ts` is untouched.

**Risks**
1. **The Drive stage overshoots 95 s in 2 of 5 seeds** because the bot's Drive fight takes 52-57 s.
   - Shortening the approach below 2700 px would break the brief's length.
   - The lever is the Drive fight (M3 target 30-45 s), or a stronger end-of-Descent-1 kit.
2. **The floor cell assumes the corridor has a floor near Drive x 140, and wall eyes at 430.** The same holds in short.
   - On long4 that depends on D's `tEnd` and `fT`/`kT` bands.
   - The spawn helpers skip quietly where there is no floor, but the cell would then lose its mutant.
   - **D should keep the corridor floor through at least Drive x 400.**
3. **Rebuilding a stage must not pick again.**
   - `pickPlanned` commits cell memory on every call, so calling it twice in a descent would shift the picks.
   - C's `buildStage` and H's checkpoint restore must **call `pickPlanned` once per descent and store the result** (see the merge notes).
   - `placePlanned` draws nothing and is safe to repeat; a test covers this.
4. **B2:** `pickPlanned(…, rnd = R)` takes the stream as a parameter, so B2 passes `Rs`. Until then the long path draws the sim `R()` at build time, as `pickV` does. Short is unaffected.

## Merge-order notes (C → B2 → D → E)

- **C (`origin/ls1-c`, pushed) conflicts in `src/enemies/scripts.ts`.**
  - C splits `buildScript` into `pickStageVariants(L)` (draws) and `stageScript(i)` (no draws). This lane split the same way, so the resolution is mechanical:
    - In `pickStageVariants`: for a row with `plan`, set `$.G.cellPick[kind] = pickPlanned(r, cells, opener, L)` instead of the `pickV` calls. Keep short's draw order exactly.
    - In `stageScript(i)`: for a row with `plan`, call `placePlanned(r, cells, $.G.cellPick[r.kind], at)`. Place the Saucer, banner, Maw, log line, eyes, WARNING, breath and `startBoss` as today.
  - `G.cellPick` (or wherever C stores picks) should join the run-save allowlist with `remixV`, for H.
- **B2:** pass `Rs` as `pickPlanned`'s `rnd`.
- **D:** register `long4` with these rows (see Stubs). Then `layout.test.ts`'s invariants and `layout-kinds.test.ts` cover the rows automatically.
- **J must land before D:** it is the tripwire. This lane adds no `LAYOUTS` entry and no `setLayout` caller.
- **When E rebases onto D:**
  1. Re-run `pod-probe` and `playtest --compare` on D's real long4 with `?layout=long`.
  2. Replace this file's scratch-entry numbers.
  3. Add a `buildScript` dispatch test on the real entry.
