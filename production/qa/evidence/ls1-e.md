# LS1-E: long Open Orbit and the Drive approach (sprint 2, lane e)

Branch `ls1-e`. Owner role: level-designer.

- **Spec:** `design/content-expansion.md` §3.4 ("Authoring method"), §3.1 (wall time), §3.2 rule 1.
- **Plan:** `production/content-build-plan.md` §2 Sprint 2, row E.
- **Rulings:** `production/decision-log.md` D20, D21.

**State: merged with `origin/ls1-s2` and wired into D's `long4`.**
- `origin/ls1-s2` at `7f0c775` holds J, B1FIX, C/B2 and D. It came in as a normal merge, with no rebase and no force-push, at the coordinator's request.
- The cells are wired into D's `long4` Orbit and Drive rows and measured on the real entry with `?layout=long` / `--layout long4`.
- **One change goes beyond the brief: long Orbit is 4380 px, not D's 3600.** At 3600 px the Orbit missed its wall-time band on every seed. The change is a separate commit, so the coordinator can revert it (see decision 1).

## Commits

| Commit | What |
|---|---|
| `7876c6e` | The generator. `src/cellpick.ts`, the cells in `src/enemies/scripts.ts`, `StagePlan` in `src/layout.ts`, `tests/unit/cellpick.test.ts` |
| `9ec05f2` | A 13th Orbit cell. Cell picking (`pickPlanned`) split from placement (`placePlanned`) |
| `41b626e` | Tools: the `pod-probe` tally clock, and the `playtest.mjs` cross-seed signature report (`--compare`) |
| `4594a3e`, `0e63df9` | First lane report, written before D existed. Superseded by this file |
| `c6f4072` | **Merge of `origin/ls1-s2`, plus the wiring** (see below) |
| `7aee0af` | **Long Orbit 3600 → 4380 px.** Rows and bands after it move +780 |
| (this file) | Lane report, probe output in `ls1-e/`, two screenshots |

## What changed

### Files

| File | Change |
|---|---|
| `src/cellpick.ts` (new, pure) | `pickCells`/`noteCells` (rules below). `genFiller` places a filler beat every `gap` px, ±15% jitter. `INTERIOR_MIX` is the spec's table: drones .30, sentry .14, corpse .14, flayer .12, hatch .10, mutant .06, crawler .06, womb .04, eyes .04. `ORBIT_MIX` drops the terrain kinds, since Orbit has no terrain |
| `src/enemies/scripts.ts` | `ORBIT_CELLS` (13), `ORBIT_OPENER`, `DRIVE_CELLS` (13), `pickPlanned`, `placePlanned`, `fillSpawn`. Built on C/B2's `stageScript(i, rs)` (details below) |
| `src/layout.ts` | `StageRow.plan` / `StagePlan`, `LONG4_ORBIT_PLAN`, `LONG4_DRIVE_PLAN`. D's `long4` Orbit and Drive rows carry them. The Saucer's provisional window is now set: `at` 1080 (D's), `gapEnd` 2100, `exitLead` 60. The Orbit length change is in its own commit |
| `src/enemies/ufo.ts` | Comment only. The Saucer reads its row; `$.G.eat = ufoGapEnd()` was already in place |
| `tests/unit/cellpick.test.ts` (new) | 27 tests, reading the rows from `LAYOUTS.long4` |
| `tests/unit/layout.test.ts` | D's two pins updated for the 4380 px Orbit: Orbit length, and LEVEL ≤ 15200 |
| `tools/pod-probe.mjs` | `tally_s`: each stage's time from STAGE card to boss kill (spec §3.1). `dur` still runs label to label, so it includes the tally card, a fork or the shop |
| `tools/playtest.mjs` | Writes `<outDir>/sig.json`. `--compare <dirs…>` produces the cross-seed signature report. The layout comes from J's `--layout`; stage x0 and the Saucer's x come from `window.__LY` |

### How the cells sit on C/B2's `stageScript(i, rs)`

- **Stream:** a row with a `plan` picks its cells and filler from `rs`, the stage's own build stream (`stageStream(i)`), never the sim `R()`. B2 was available, so this lane uses it.
- **Rebuilds:** `pickPlanned` keeps the pick per descent in `G.remixV['c:<kind>']`, the same way `pickV` does for sections. Building the stage again (a resume, item H) places the same cells and filler without drawing. A test covers this.
- **Tags:** every entry carries `k`, its cell id or `fill:<kind>`.
- **Short:** rows without a plan go through today's section path, unchanged.

### The cell rules (spec §3.4: "pickV's rules move down to the cell level")

1. A cell is eligible if it has the slot's tag and `min <= L`.
2. **Never a cell already placed this descent.** This rule is never relaxed: a slot with no candidate stays empty.
3. Prefer cells that were not in last descent's set.
4. Then prefer cells not yet seen this run.
5. Draw uniformly from the best tier that is not empty.

Each tag's pool holds at least twice its slots per descent. A test runs the real pools over 8 descents × 200 seeds with no fallback.

### Long Open Orbit (stage x = world x)

| x | Beat |
|---|---|
| 180, 480, 780 | 3 intro cells. **In Descent 1 these are the fixed teaching opener** (`o.drones`, `o.sentry`, `o.swarm`): ORBIT_A's classic, one idea per wave, about 15 s |
| 1080 | Saucer WARNING |
| 1150-2100 | Orbit-mix filler (gap 80). The Saucer's window; eaten while it is up. No cell sits in it |
| 2040 | The Saucer's forced exit |
| 2100, 2700 | Build cells |
| 2400-2700, 3000-3300 | Filler, gap 70 |
| 3300 | Peak cell |
| 3600-4000 | Filler, gap 55 |
| 4080 | SOMETHING IS COMING (the Maw's banner) |
| 4200 | The Maw |
| 4380 | `x1` |

**The 13 cells:**

| Kind | Count | Notes |
|---|---|---|
| Teaching | 3 | `min` 2: from Descent 3 they return as ordinary intro cells |
| Intro | 3 | |
| Build | 4 | |
| Peak | 3 | |

Their content comes from ORBIT_A (four variants, split), ORBIT_C (classic, brood, flayer alley, hull breach) and ORBIT_D (the run-up).

### Long Drive approach (x relative to the row's x0)

| x | Beat |
|---|---|
| 130 | Log line |
| 140 | Floor cell |
| 430 | Wall eyes |
| 460 | Intro cell |
| 800, 1120 | Build cells |
| 1440-1740 | Interior-mix filler, gap 65 |
| 1760, 2080 | Peak cells |
| 2460 | WARNING (D's) |
| 2550 | The drifting crew |
| 2700 | `startBoss` |

**The 13 cells:**

| Kind | Count | Notes |
|---|---|---|
| Floor | 3 | DRIVE_E's mutant variants. These are the only cells that spawn mutants, crawlers or wombs (test) |
| Intro | 2 | |
| Build | 4 | |
| Peak | 4 | 5 of the Drive cells overall are new |

## Acceptance checklist (measured on D's real long4, `?layout=long --layout long4`, seeds 1, 3, 5, 7, 11)

| Criterion | Result |
|---|---|
| Orbit 75-90 s wall time (LS1, Saucer only) | **PASS: 80, 76, 78, 78, 78 s.** At D's 3600 px it was 65, 65, 65, 66, 66 s (FAIL) |
| Drive stage 80-95 s (no midboss) | **PASS: 93, 80, 92, 86, 88 s.** The bot's Drive fight took 51.0, 38.1, 50.7, 44.5 and 45.7 s. At 3600 px (same Drive row): 105, 79, 87, 99, 79 s. The Drive's time is mostly the fight, so it varies by run |
| Descent 1 opener identical across seeds | **PASS:** `IDENTICAL across seeds, 9 waves: 180:drone 320:drone 430:corpse 500:sentry 610:corpse 720:flayer 780:hatch 900:drone 1020:sentry`. A unit test also covers it over 20 streams |
| The rest differs across seeds | **PASS:** 5/5 distinct signatures in every stage. Mean pairwise wave overlap: Orbit after the opener 12%, Drive 18% |
| No cell repeats within a descent | **PASS:** the real pools over 8 descents × 200 seeds, with no repeat, no cell from last descent and no empty slot |
| Saucer forced exit ≥ 300 px before the next WARNING (D20) | **PASS:** exit at 2040, the Maw banner at 4080. `layout.test.ts` runs its invariants on `long4` with **no legacy pins** |
| `$.G.eat` follows `ufoGapEnd()` | **PASS** (unchanged code path; reads the row) |
| Cell picks on B2's stream | **PASS:** `stageScript(i, rs)`; rebuild-safe (test) |
| Short layout identical to `ls1-s2` | **PASS:** harness and parity (below) |
| unit, typecheck, build | **PASS:** 365/365 tests, typecheck clean, build clean (the existing chunk-size notice only) |

## Gate output (final source, the 4380 px commit)

**Harness:**

```
{"st":{"state":"over","score":1243,"scroll":3538,"lives":0,...,"errs":[]}
PASS vs baseline @ 8ff9ba4
```

**Parity** (`node tools/layout-parity.mjs`, no `--update`):

```
run 7m (seed 7, 2 descents, mortal) gates 1010: game over, 2 stages, 5414 play frames, deaths 3, errors 0
not measured: render-only output (canvas stubbed); deaths after the mortal run's game over; seeds 2 and 3 (their bots cannot kill the Gravity Drive)
PARITY PASS vs baseline @ ls1-s2 after J + B1FIX + C/B2: B2 re-baseline re-taken on top of B1FIX (anchors and terrain unchanged): runs 3, 6, 7, 11, 15, 3x3, 7m identical (5 seeds x 2 descents + 3x3 + 7m)
```

**A failed parity run I'm reporting:**
- An earlier parity run, started on the merge commit `c6f4072`, reported a diff in run `3x3` (stage 2's fired kinds from x 3493 on).
- That run overlapped my edit of `src/layout.ts`, and the parity tool serves the live worktree through Vite, so the page reloaded mid-run.
- The run on the settled final source (above) is identical on every run, including `3x3`.
- I did not re-run parity on `c6f4072` by itself. The final commit's source is a superset of it, and the short path is the same code in both.

## Probe output

The full output is in `production/qa/evidence/ls1-e/`:
- `long4-4380-probes.txt` and `long4-3600-probes.txt`: pod-probe and the signature report;
- `playtest-long4-seed*.txt`: per-stage kills, bosses, variety and drones.

**`pod-probe` on long4, 4380 px Orbit.** `tally_s` is STAGE card to boss kill, in s; `dur` in brackets is label to label.

| Seed | 1-1 Orbit | 1-2 biome | 1-3 biome | 1-4 Drive | Errors |
|---|---|---|---|---|---|
| 1 | 80 (88.6) | 87 | 73 | 93 (105.3) | 0 |
| 3 | 76 (84.6) | 82 | 67 | 80 (91.6) | 0 |
| 5 | 78 (86.1) | 88 | 70 | 92 (104.0) | 0 |
| 7 | 78 (87.2) | 79 | 74 | 86 (98.4) | 0 |
| 11 | 78 (87.1) | 71 | 69 | 88 (99.5) | 0 |

The biome columns are D's stages, which this lane did not change. They are listed for completeness only.

**Playtest** (5 seeds, Descent 1):

| | Saucer TTK | Maw TTK | Drones (share of regular spawns) |
|---|---|---|---|
| Orbit | 9.3-9.9 s | 5.7-9.6 s | 32-53% |
| Drive | | | 40-50% |

- **Drone share:** the mix's 30% weight is per beat. `formation()` adds `round(3·pow)` drones per wave, so per spawn the share rises with power, as the `scripts.ts` header already notes for short (35-40%).
- **Would-be hits:** 0.2-0.5/min.
- **Errors:** none.

**Screenshots** (long4, seed 3):
- `ls1-e-long-orbit-saucer-warning.png`: the Saucer WARNING about 20 s into long Orbit.
- `ls1-e-long-drive-approach.png`: the long Drive corridor.

## Not measured

- Descent 2+ in game. The picker's rules for later descents are covered by the unit test only.
- Phone/Fold timing, and render-only output.
- `route-probe` on long4 with the new content. The Orbit has no terrain hazards; the Drive's terrain is D's, unchanged apart from the +780 shift.
- A full re-run of D's own biome probes after the +780 shift. The shift moves every row, gate offset and band by the same amount, and `layout.test.ts`'s long4 timing and beat tests pass on the shifted entry.

## Decisions this brief did not settle (each took the safest default; the coordinator or Matt may revisit)

1. **The long Orbit is 4380 px, and everything after it moves +780** (LEVEL 14370 → 15150).
   - **Why:** the spec's 3600 px and its LS1 band of 75-90 s can't both hold, because the drift Saucer holds no scroll. On D's real entry, 3600 px measured 65-66 s on all five seeds.
   - **What it touches:** I shifted D's rows and bands uniformly, so the biome timing relative to each gate is unchanged, and updated D's two test pins. That is outside the Orbit row, which is why it is a separate commit: reverting it restores D's 3600 px exactly.
   - **LS2:** a slot-B held midboss adds about 10 s, so Orbit would land around 88-92 s, inside the spec's 85-100 s with both midbosses.
2. **The Saucer window is 1080-2100.** The WARNING stays at D's 1080, because 1100 is a short-script literal and the grep test flags it. The window keeps today's ~1000 px, so the Saucer fight and its tuned pods carry over.
   - **LS2-orbit's slot-B WARNING must sit at x ≥ 2340** (D20 rule 1). `layout.test.ts` enforces it.
3. **13 Orbit cells**, one over the spec's 10-12, for the second build slot.
4. **The opener cells come back from Descent 3** as ordinary intro cells.
5. **No `$.meta` cross-run memory** (it was optional). `save.ts` is untouched.

## Open risks

1. **The Drive's stage time is mostly the Drive fight** (38-51 s here, against the M3 target of 30-45 s). All 5 seeds landed in 80-95 s this time. At 3600 px, with the same Drive row, two seeds ran 99-105 s. Expect occasional runs over 95 s with a weak kit.
2. **The floor cell assumes the corridor has a floor near Drive x 140, and wall eyes at 430,** as in short. On long4 this holds: mutants and crawlers spawned in the playtests.
3. **For H (checkpoint):** the cell picks live in `G.remixV['c:orbit' | 'c:drive']` (`used`, `last`, `L`, `pick`), inside `remixV`, which is already on the run-save allowlist. Restore needs no extra field.

## Merge notes

- `ls1-e` merges `origin/ls1-s2` at `7f0c775` as a normal merge. The branch is pushed with a plain `git push`.
- **To drop the 4380 px Orbit:** revert the commit "feat: long4 Open Orbit 3600 -> 4380 px". The Orbit plan then needs its 3600 px form: one build slot, peak at 2700, filler to 3220. That is the layout in `c6f4072`.
