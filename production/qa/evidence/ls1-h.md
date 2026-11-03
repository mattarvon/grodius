# LS1-H: the resume point

Lane h of LS1 sprint 3 (`production/content-build-plan.md` §2, row H; spec `design/content-expansion.md` §4). Owner roles: engine-programmer + ui-programmer. Branch `ls1-h` off main `61197f6`.

## What changed

| File | Change |
|---|---|
| `src/checkpoint.ts` (new) | The triggers. `cp1X(i)`: the CP1 scroll x per stage kind. `cpSafe()`: no fight, fork, hold, tally, open pick, death or descent end. `cpView()`: the stored view of G (seal as earned, stage clock as frames into the stage). `writeCp(n, x)`. `cpStep()`: CP0, then CP1, at the first safe step past each. `CP` tuning table: `after` 150, `lead` 120, `inv` 280 |
| `src/runsave.ts` | `RUN_V` 1 → 2. New fields: `cpN`, `stT`, `pickQ`, `boostReq`. `decodeRun` bounds `stage` by `lastStage()`. **`decodeRunAs(s, keep)`** switches to the blob's layout *before* validating (`setLayout(blob.layout)`), then switches back unless `keep`. `readRun` uses it, so a valid long4 save is never cleared on a short boot. The slot has an in-memory copy (`lastRun`, `runInfo`, `rewriteRun`), so the title and the Android pause never read storage. Plus `encodeRun`/`storeRun` |
| `src/stagebuild.ts` | `rebuildAt(cpX)`: `buildTerrain(loop)`; each committed slot up to this stage via `biomeStage(s, G.bx[s])` with the **stored** gate x, in slot order; then `buildStage(stage)` for Orbit or the Drive; then skips entries `x <= cpX` |
| `src/flow.ts` | `resumeRun(d)`: a fresh G (`baseG()`, factored out of `newGame` with the same draw order), `perksReset`, `biomeReset`, **`resetPlayer(false)` before `applyRun`**, live state reset, `rebuildAt`, scroll `cpX - 120`, i-frames, stage banner. `resumeLast()` for the title. `respawn()`: **option b** (`cpTrigger() === 'b'`) calls `deathRestart()`. Clears the run save in `newGame`, `gameOver` and `endLoop` |
| `src/stages.ts` | `sealFor(cleared)`; `startStage` sets `G.cpWant = 0`; the stage banner is factored into `stageBanner(i)` for the resume |
| `src/step.ts` | `cpStep()` once per sim step in play. It reads the sim and never draws |
| `src/main.ts` | `readRun()` at boot. The Android `pause` calls `rewriteRun()`, which writes the last checkpoint again, never live state. `window.__cp` test hook |
| `src/menus.ts` | **RESUME** is title row 0 (`STAGE n-m`, plus the layout name when it differs from the active one) while a checkpoint exists. DESCEND restores the pre-resume layout before applying the LAB/URL choice |
| `tools/resume-check.mjs` (new) | The Playwright end-to-end check (below) |
| `tests/unit/checkpoint.test.ts` (new) | 23 tests: reads under the blob's layout (long4 on short, short on long4, a 3-slot 5-stage layout on short), stage bound, CP positions, triggers and their guards, pending rewards, the pause re-write |
| `tests/unit/resume.test.ts` (new) | 4 tests: the rebuild gives the same script still to fire, on both layouts, all 4 stages, Descents 1 and 2, with a core mock that **throws on any sim RNG call**; a late gate keeps its own script; a slot not reached yet is not built |
| `design/content-expansion.md` §4 | "As built (LS1-H)": the entry-criterion decisions and the choices below |
| `production/qa/evidence/ls1-h/` | Screenshots and JSON reports from `resume-check.mjs` |

## H entry criteria

1. **Pending rewards at CP0: stored, never lost.**
   - The seal is serialized as `max(seal, sealFor(cleared))`, which covers a seal still queued in `G.sealQ` or `G.pend`.
   - `G.pickQ` and `G.boostReq` are stored as fields.
   - No checkpoint is written while a pick is open: `cpSafe` waits for it to close, so the open pick's guaranteed card is never stranded.
   - Tests: "stores the seal the clears have earned…" (both the fork and non-fork queues) and "stores queued level-up picks and the biome boost offer".
2. **`stage` is bounded by the restored layout's stage count.** `decodeRun` runs under `decodeRunAs`'s layout switch. Test: "discards … one whose stage that layout lacks".
3. **`resetPlayer()` runs before `applyRun()`** in `resumeRun`. The end-to-end check confirms the loadout, lives and level come back.

Sprint 2 carry-forward 1 (`setLayout(blob.layout)` before validation) is done.
- Tests: "keeps a long4 checkpoint read on a short boot", "keeps a short checkpoint read on a long4 boot", and "keeps a checkpoint from a layout with more biome slots and stages".
- **Note:** short and long4 both have 2 slots and 4 stages. With the switch removed, the first two tests still pass, because the bug cannot show between these two layouts. Only the third test, which registers a test-only 3-slot, 5-stage entry (the long5 shape), fails without the switch. I watched it fail.

## Acceptance checklist (row H)

| Acceptance | Result |
|---|---|
| Kill at CP1 → resume gives the same terrain | **PASS.** In all 7 end-to-end runs, FLOOR/CEIL hashes are equal and terrain-only renders show 0 px difference at 6 scroll x from the lead-in to the boss |
| …the same midboss pair and set pieces, and the same script x and kind list | **PASS.** Every entry still to fire (`x:k`, including `mid:*`, `set:*`, `boss:*`, `log`, filler) is identical. The midboss pair is the biome's own until F wires `B.mids` (see Stubs) |
| Spawn-time rolls are not reproduced | By design: `rebuildAt` only builds |
| A resumed run never draws build `R()` beyond the build | **PASS.** In-game: the RESUME press drew the sim RNG **0 times** in every run (Math.random counted). Unit: the rebuild under a throwing `R` |
| Option b restarts at the last CP with one life spent | **PASS** (long4 stage 2 CP1). Died 300 px past the CP, restarted at `cpX - 120` with lives 2 → 1 and the stage's deaths at 1. A reload then resumed with lives still 1 (the CP is re-written) |
| CP0/CP1 triggers, `pause` re-write, RESUME on the title, cleared on game over or a new game | Done. Unit tests cover the triggers and the re-write; the end-to-end run covers RESUME. Clearing on game over, new game and descent end is in `flow.ts` (`clearRun()`) |
| Short layout behaviour-identical | **PASS.** Harness and parity are both identical |

## Output

```
npm run typecheck      clean
npx vitest run         23 files, 429 tests passed (402 before H; +27)
npm run build          built (the existing chunk-size notice only)
npm run test:regress   PASS vs baseline @ 8ff9ba4; PASS (long4) vs baseline @ 88d9525. st byte-identical, no re-baseline.
                       6/6 canvas hashes differ (advisory): clean main 61197f6 in a temporary worktree gives the
                       same 6 hashes (8528a52ed6 …), i.e. the symlinked-node_modules font fallback, not this lane
layout-parity          PARITY PASS: runs 3, 6, 7, 11, 15, 3x3, 7m identical
```

Neither harness pass moved. The checkpoint code only reads the sim (plus `G.cpWant`/`cp1X`/`cpX`/`cpN`/`layout` bookkeeping fields) and writes localStorage. `flow.ts` imports `checkpoint`/`runsave`/`lab` after its existing imports, and none of them draws `R()` at import, so boot order is unchanged. The harness confirms this.

### `tools/resume-check.mjs` (seed 7; reload 300 frames past the checkpoint, mid-stage)

| Run | Checkpoint | Entries still to fire | Terrain px diff (6 x) | RESUME draws | Result |
|---|---|---|---|---|---|
| long4 stage 0 (Orbit) CP1 | cpX 2250.0 | 30 = 30 | 0 | 0 | PASS |
| long4 stage 1 (ice) CP0 | cpX 4260.3, bx 4738 | 36 = 36 | 0 | 0 | PASS |
| long4 stage 1 (ice) CP1 | cpX 6024.7, bx 4738 | 21 = 21 | 0 | 0 | PASS |
| long4 stage 2 (fire) CP1, **option b** | cpX 9774.7, bx 4738/8487 | 20 = 20 | 0 | 0 | PASS |
| long4 stage 3 (Drive) CP1 | cpX 12989.0, bx 4738/8487/12237 | 18 = 18 | 0 | 0 | PASS |
| short stage 1 (snot) CP1 | cpX 4007.7 | 12 = 12 | 0 | 0 | PASS |
| short stage 2 (ice) CP0 | cpX 5159.3, bx 2658/5637 | 31 = 31 | 0 | 0 | PASS |

**I watched the gate fail.**
- With `rebuildAt` given `bx + 50`, the check FAILED: the script list shifted 50 px, the FLOOR/CEIL hashes differed, and 2597, 3632 and 129 px differed at three scroll positions.
- Its first version also failed honestly on Orbit, but the fault was in the tool, not the game. It polled every 30 frames, so the "original" snapshot was taken after an entry at 2270 > cpX 2250 had fired. The tool now stops on the exact frame the checkpoint is written, and all six runs above use that fixed version.
- Unit sabotage: each of these makes its targeted test fail:
  - no layout switch;
  - no stage bound;
  - a recomputed bx;
  - building a slot not reached yet;
  - an `R()` call in the rebuild;
  - no seal max;
  - CP1 ignoring `G.pend`.

Evidence: `production/qa/evidence/ls1-h/`.
- At the top level is the option-b run: `title-resume.png` (RESUME as row 0, `STAGE 1-3`), `resumed-play.png` (the first frames after RESUME: the stage banner over the Furnace), terrain pairs `terrain-<x>-{orig,resumed}.png`, and `resume-check-long4-s2cp1-death.json`.
- Each other run has a subfolder with its JSON report and the terrain pair at its cpX.

## Fold APK app-kill check (Matt)

1. Install the APK built from this branch (or from main once merged). On the title, open **LAB**: set LAYOUT LONG, leave CHECKPOINT QUIT ONLY. Back out. The title's LAB row reads `LONG`.
2. DESCEND. Fly Open Orbit past the Saucer (its WARNING, then about 15 s after it drifts off). CP1 is written there.
   - For a biome CP1: take a gate, then fly past the midboss's breath and the pod release that follows it.
3. Fly on a few seconds past that point, then press **Home**. Open **recents** and swipe Grodius away (an app kill).
4. Reopen Grodius. The title's row 0 should be **RESUME — STAGE 1-n**. Press it.
5. Expect:
   - the same stage, a ~2 s empty lead-in just before where CP1 was, then the same terrain;
   - the same enemy kinds at the same places (positions, sides and elite status may differ, by design);
   - the same loadout, level, lives and score as at the checkpoint;
   - the next midboss or boss as before.
6. Kill the app again mid-stage, **while the pause menu is up** (the `pause` handler re-writes the last checkpoint). RESUME should land at the same checkpoint, not at the pause point.
7. Optional, Q2: set LAB CHECKPOINT to **ON DEATH**. Die after a checkpoint. The run restarts at that checkpoint with one life fewer.
8. Lose all lives: the title no longer offers RESUME. ABANDON SHIP from pause: RESUME is still offered.

## Not measured

- The Fold APK app kill itself (Matt, above). The Capacitor `pause` path is tested only as the unit test of `rewriteRun`.
- Resume from a **repeat visit** (`visitNo` 1) in-game. The unit rebuild covers slot 1 as a repeat visit; the end-to-end runs are all Descent 1 first visits.
- Descent 2+ resumes in-game (the unit test covers loop 1).
- Option b on short, at CP0, and a death before CP0.
- Perf: a checkpoint write is one `JSON.stringify` of an allowlisted object (about 1-2 KB) plus a `localStorage.setItem`, twice per stage. Not profiled on the Fold.

## Decisions taken (safest default; also in spec §4 "As built")

1. **CP0 waits for the first safe step**, which is ~30 frames after a tally (`cpSafe`), rather than writing inside `startStage`. If the ship is dead at the moment the stage starts, a checkpoint written then would store the dead ship's guns.
2. **CP1 waits until `G.pend` is empty**, so no queued WARNING, set piece or reward closure is ever lost.
3. **Resume skips `x <= cpX`** (the spec says `< cpX`): `runScript` fires `x <= scroll`, so an entry exactly at cpX had fired. Scroll restarts at `cpX - 120` (the spec's 120 f lead-in; its "cpX − W" would replay a whole screen of skipped scroll).
4. **Orbit CP1 = `x0 + gapEnd + 150`**, after the Saucer's filler window. **Drive CP1 = midpoint of `x0`-`warnX`.**
5. **ABANDON SHIP keeps the checkpoint** (it is the "quit" the spec resumes after). DESCEND, DESCEND DEEPER and DESCEND AGAIN drop it.
6. **Option b** restarts only at the *current stage's* checkpoint. A death before the stage's CP0 respawns in place, rather than replaying the previous stage's boss. The stage's deaths are kept for the grade.
7. **RESUME flies the checkpoint's layout** even when the URL or LAB names another (the LAB layout toggle already discards the checkpoint). The next DESCEND flies the chosen layout again.
8. **`RUN_V` 2**: the allowlist gained fields and `seal` changed meaning. No v1 blob was ever written in production (H0 was not wired).

## Stubs and open risks

- **F (midboss picker) + H: the pick must be stored, not re-rolled.**
  - Today a biome stage's midboss is its own (`mid:<kind>` in the script), so the rebuild is exact.
  - F weights the pick by `meta.mb`, which changes when a midboss is met. A rebuild that re-runs `pickMids` after a resume could therefore pick a different pair.
  - F should write the pair into `G.picks` (already allowlisted in `runsave.ts`) at build time, and `biomeStage` should read `G.picks` when it is set. Alternatively, F can pick with `ignoreMeta` on a rebuild. The end-to-end check's script-list diff (`mid:*`) will catch a mismatch.
- **`mbUsed`/`mbSeen`/`spUsed`/`intRot`** are reserved in the allowlist and stored once their owners (F, D, LS3) create them.
- **Biomass farming.** `$.meta.bio` is persisted live, so biomass from kills between a checkpoint and an app kill (option a) or a death (option b) is earned again on the replay. This is the spec's accepted "known exploit" in a small form; Matt may want it mitigated (Q2).
- **Hi score.** It updates at game over, descent end or abandon, so an app kill keeps the run's score but not a new hi until the resumed run ends. Unchanged behaviour.
- **Descent end clears the checkpoint** (spec). An app kill in the Infirmary between descents loses the run. Open for Matt. The fix is a checkpoint at the shop.
- **Copy (writer, D8).** The RESUME row (`RESUME` / `STAGE n-m`) and the resume reuses the stage banner (`STAGE 1-3 // THE FURNACE …`). There is no "RESUMED" wording.
- The shell's `grep` wrapper broke mid-session (a missing helper binary in this environment); `/usr/bin/grep` was used. This is not a project issue.
- Untracked, regenerable PNGs from the full end-to-end runs remain in `production/qa/evidence/ls1-h/` subfolders; only the trimmed set is committed. Removing the folder was denied.

## Merge-order notes

- The plan says **H after C, B2 and D2** (all on main), and **I after H**. I builds its jump switch on `resumeRun`/`rebuildAt`.
- `src/stages.ts`:
  - H touches `startStage` (one line plus the `stageBanner` factor-out) and adds `sealFor` next to `SEAL_AT`.
  - **F and G also edit `stages.ts`.** If G moves the seal table to `economy.ts`, `sealFor` should read that table.
  - Expect small textual conflicts.
- `src/flow.ts`:
  - H edits `newGame` (`baseG`), `respawn`, `gameOver` and `endLoop`.
  - F's filler suppression doesn't touch these.
- `src/runsave.ts` is H's.
- `src/menus.ts` touches only the title items and `startRun`.
- If F merges first, add `G.picks` to the rebuild as above before H merges, or as an H follow-up.
- The Studio Hierarchy review is the parent's (not run here).
