# LS1-F: wire the midboss picker

*Lane f, branch `ls1-f` off main `61197f6`, 2026-11-02. Owner roles: gameplay-programmer + systems-designer. Spec: `design/content-expansion.md` §3.2 (breath-2 safety), §6.3-6.5. Plan row: `production/content-build-plan.md` §2 Sprint 3, row F.*

## What changed

Everything new is gated on a new layout flag, `picker` (set on `long4` only). On `short`, each biome stage still gets its own home midboss on a 1400 f clock, and nothing else changes.

| File | Change |
|---|---|
| `src/layout.ts` | `LayoutEntry.picker` and `Beats.driftLead` (long4: 300) added. On long4, breath 2 now holds a midboss (`mid: true`). `beatPlan()` also returns `warns` (one WARNING x per midboss breath; `warn` is still slot A's) and `driftExit` (by slot: where a DRIFT midboss there is forced out, `driftLead` before the next WARNING, or before `bossX` for the last slot). |
| `src/biomes.ts` | `B.mid`/`B.midName` became `B.mids: [{ k, name, tag }]`. New exports: `MID_NAMES` (kind → name, which crossovers keep) and `SPAWN_KINDS` (test hook). `biomeScript(..., mids)`: with no picks it builds the short path, byte for byte as before. With picks, it places one WARNING per midboss breath. Slot B's WARNING and its spawn are wrapped in `whenNoMini`. `biomeStage` passes `stageMids(i, b)` on picker layouts. New: `stageMids` (picks once per stage from `midStream(i)` and stores them in `G.mb[i]`), `fixedMids` (the Orbit Saucer counts as met), `midSlot` (held kinds go through `midboss()` on the slot clock; a DRIFT kind gets the breath plan's `driftExit`). `openFork` applies the acid/snot rule on picker layouts. `biomeReset` clears `G.mb`/`G.mbUsed` each descent and keeps `G.mbLast`. |
| `src/midslot.ts` (new) | Run-time guards. `whenNoMini(f)` re-checks every frame while `G.mini` is non-null (rule 2). `miniUp`. `isFiller`/`fillerQuiet`: biome spawn rolls and `fill:*` generator filler are skipped while a midboss is up, on picker layouts only. `meetMid` writes `$.meta.mb`. A DRIFT spawner registry lets `ufo.ts` register the Saucer, so `biomes.ts` does not import `ufo.ts` and the boot module order is unchanged. Imports only `state` and `layout`. |
| `src/midpick.ts` | New: `MID_CLOCK` (slot A 1080, slot B 1260, RACE 900), `slotClock()`, `MAW_BIOMES` and `forkAllows()` (spec §6.5 interim). Header and `HOME` comment updated: the picker is now wired. |
| `src/enemies/spawn.ts` | `midboss(k, title, host, leave = 1400)` takes the clock and calls `meetMid(k)`. `runScript` skips filler when `fillerQuiet(s.k)` is true. |
| `src/enemies/ufo.ts` | `spawnUfo(exitX = gapEnd - exitLead, maxLeave = 1400)` stores `e.exitX`, and `updUfo` forces the exit at `e.exitX`. The Orbit numbers are bit-identical (the leave arithmetic is written so the Orbit case is still `gapEnd - scroll - 70`). Registers itself as a DRIFT midboss. `meetMid('ufo')`. On picker layouts `ufoWarn` passes slot A's 1080 f clock; the forced exit comes first (~800 f), so long4 does not move. |
| `src/stagebuild.ts` | On picker layouts, `buildStage` calls `fixedMids` for a non-biome row's drift midbosses: Open Orbit's Saucer, in every descent and therefore always in Descent 1. |
| `tools/midboss-probe.mjs` | New `--leave <frames>` option (slot clocks). Uses `MID_NAMES`. |
| `tools/perf-probe.mjs`, `tools/rng-probe.mjs` | `B.midName` → `MID_NAMES[k]` (same titles). |
| `tools/midslot-shots.mjs` (new) | Evidence rig: a long4 biome stage flown through its real script, with shots of slot B's WARNING and of midboss B. |
| `tests/unit/midslot.test.ts` (new, 20 tests) | Covered below. |
| `tests/unit/layout.test.ts` | Updated: long4 has two midboss breaths. New: the DRIFT forced-exit invariant for both biome slots at both gates, first visit and remix; short has no picker and no `driftExit`. The invariant scan counts every midboss WARNING (`warns`). |
| `tests/unit/biomebeats.test.ts` | Updated: two midboss WARNINGs on long4 with a pair; one with no picks. |
| `tests/unit/midhost.test.ts` | Reads `mids: [{ k: ... }]` instead of `mid:`. |

**`stages.ts` is untouched.** Lane G has no `stages.ts` conflict with F. `flow.ts` is untouched too: the per-descent reset lives in `biomeReset`.

## Acceptance checklist (row F)

| Acceptance / item | Result |
|---|---|
| `B.mid` → `B.mids` with tags | **Done.** Tags agree with `midpick.ts MIDS`, and `HOME[b] === B.mids[0].k` (test). |
| Two `miniWarn` per long biome stage | **PASS.** biomebeats: 32 cases (4 biomes × 2 slots × 2 visits × 2 descents) each have `[warnA, warnB, bossX]`. The rig observed both in play. |
| Crossover rule | **PASS.** Phase-1 pool: home preferred, crossover from the other three, host tint via `host = b` (P0). Observed: Brood Mother in the Cryovault, Apprentice in the Sinus (shots). |
| Leave clocks 1080 / 1260 | **PASS.** Unit test (`choir.leave` 1260 in slot B; the DRIFT stub 1080 in slot A). The rig observed `leave=1080` and `leave=1260` in play. RACE cap 900 is tested with a stub RACE def. |
| `meta.mb` updated on meet | **PASS.** `meetMid` on every `midboss()`/`spawnUfo()` (unit test). `save.ts` already loads and cleans `meta.mb` (H0). |
| Saucer guaranteed in Descent 1 | **PASS.** It is the Orbit row's drift entry in every descent, recorded in `G.mb[0]` (test). stage-clock: `ufo@1229` in every seed. |
| Fork rule: acid and snot never together | **PASS.** `forkAllows` test, 50 `openFork` draws, and 0 of 200 descents in the sweep. |
| Filler suppressed while `G.mini` is up | **Done** (`fillerQuiet`, tested by kind: filler yes; set pieces, cells, pods, logs, WARNINGs and bosses no). "Up" excludes a withdrawing (`gone`) midboss, so a hand-made cell right after the Saucer's exit still plays. |
| Every long biome stage meets 2 different bodies; 0 repeated bodies per descent | **PASS.** 200-descent sweep through the real `openFork` + `stageMids`: 400 stages, 0 bad, 0 repeats. stage-clock long4: 8 biome stages, 8 pairs, all different, 0 repeats per descent. |
| Breath 2's WARNING never fires while `G.mini` is up, incl. a DRIFT midboss (the Saucer stub) in slot A | **PASS.** Four tests: held A pushed past breath 2 (deferred, fires once clear); DRIFT A (fires on time, `G.mini` clear, because rule 1 cleared it); DRIFT A that ignores its exit (the backstop holds it); and the guard itself, held and DRIFT, re-checked per frame. **Watched failing:** with `whenNoMini` made a pass-through, 4 tests fail. With `driftLead: 0`, 3 fail. |
| Forced-exit invariant | **PASS.** Biome slots: exit ≥ 300 px before the next WARNING and ≥ 300 px after landing, both gates, first visit and remix (layout.test). The Orbit row's existing invariant is unchanged. |
| `midboss-probe` TTK: A 8-11 s, B 10-15 s (stage-1 kit) | **A: 3 of 4 in band; B: 1 of 4 in band. See the finding below.** |

### midboss-probe (long4, STAGE 1 kit, `--leave 1080` and `--leave 1260`)

```
                 MAW(mid)  NAIL CHOIR  DISS. WOMB  APPRENTICE   BROOD MOM SQUID SAUCER
1080 STAGE 1 kit      9.1        10.0         8.7         6.8         9.4          5.4
1260 STAGE 1 kit      9.1        10.0         8.7         6.8         9.4          5.4
(NAKED: choir/prentice/brood esc at 1080; brood 19.2 s at 1260)  errors: none
```

**Finding (needs game-designer / systems-designer).** Slot B's 10-15 s band is met only by the Choir (10.0 s). The Womb (8.7), the Apprentice (6.8) and the Brood (9.4) die faster. Spec §6.2 says "no per-slot HP multiplier: HP comes only from depth" (D1), and the depth HP rule is pinned. TTK is the same in either slot with the same kit, so with the stage-1 kit B cannot be slower than A. In play, slot B also arrives later, when the player has more kit, so it will be faster still. Either the B band was meant for a later kit, or slot B needs its own HP term, which would need a D1 ruling. I did not change any HP. The Apprentice under A's band is P0's known note.

## Gates

- `npm run typecheck`: clean.
- `npx vitest run`: **22 files, 424 passed** (midslot: 20 new).
- `npm run build`: built.
- `npm run test:regress`: **short PASS vs baseline @ 8ff9ba4; long4 PASS vs baseline @ 88d9525. No re-baseline.** The 6/6 canvas hashes differ (advisory): this worktree's `node_modules` symlink makes Vite refuse the `@fontsource` files, the same note F0 and earlier lanes recorded.
  - **The long4 pass did not move**, although the brief expected it to. Its bot dies in Open Orbit at scroll 3538 (carry-forward 10). Everything F changes on long4 sits after that point (forks, biome stages) or gives the same numbers in Orbit: the Saucer's leave is ~800 f, under 1080; the filler in its window is already eaten by `G.eat`; `meetMid` writes meta, not sim state. So there was nothing to re-baseline. F's long4 behaviour has no harness coverage; the unit tests, stage-clock and the rig cover it instead.
- `node tools/layout-parity.mjs`: **PARITY PASS**, short layout identical (below).

### Parity

```
run 3 / 6 / 7 / 11 / 15 (2 descents each), 3x3 (3 descents), 7m (mortal, game over): deaths 0/0/0/0/0/0/3, errors 0
PARITY PASS vs baseline @ ls1-s2 after J + B1FIX + C/B2: runs 3, 6, 7, 11, 15, 3x3, 7m identical (5 seeds x 2 descents + 3x3 + 7m)
```

**My mistake on the first parity run:** it showed a diff in `route.haz*` (hazard counts 0) on the last two runs only (3x3, 7m). The stage, spawn and terrain data were identical. I had edited `src/enemies/ufo.ts` while that run's Vite server was live, so the last two pages loaded a re-evaluated module graph and the observer's `__biome` hook read an empty hazard list. After the edit, I re-ran parity and the harness with no source changes in flight: both pass. Don't edit `src/` while parity is running.

### stage-clock, long4 (invincible bot, natural kit, seeds 1/5/6/7; the 900 s timeout cut seed 11)

```
D1 s1 biome fire  wall 103.2 s  prentice@5813 killed@5861 cyst@6809
D1 s2 biome acid  wall  82.5 s  brood@9563 killed@9611 choir@10559
D1 s1 biome snot  wall  85.9 s  brood@5813 ... choir@6809
D1 s2 biome fire  wall  86.0 s  prentice@9563 ... cyst@10559
D1 s1 biome ice   wall  88.6 s  choir@5813 ... prentice@6809
D1 s2 biome fire  wall  78.4 s  brood@9563 ... cyst@10559      <- fire's home taken earlier: two crossovers
D1 s1 biome ice   wall 102.1 s  choir@5813 ... cyst@6809
D1 s2 biome fire  wall  79.0 s  prentice@9563 ... brood@10559
Orbit: ufo@1229 every seed. Biome scroll 59.4 s (band 58-62) unchanged.
```

Seed 5's Drive timed out (691 s): this is the known Gravity Drive the bot cannot kill, not F. Biome wall times with two midbosses are 78-103 s against the LS1 exit band of 90-120 s. That band is measured by `playtest.mjs` with a mortal bot, which I did not run (G re-measures wall times, carry-forward 5).

### Evidence shots (`production/qa/evidence/ls1-f/`)

`node tools/midslot-shots.mjs <url> production/qa/evidence/ls1-f <biome>`:
- `ls1-f-ice-slotB-warning.png`: WARNING / THE BROOD MOTHER in the Cryovault's breath 2. `G.mini` was clear when it fired.
- `ls1-f-ice-slotB-midboss.png`: the Brood Mother crossover fighting in the Cryovault (picks `choir, brood`; leave 1260, host ice).
- `ls1-f-snot-slotB-warning.png`, `ls1-f-snot-slotB-midboss.png`: the Apprentice in the Sinus (picks `brood, prentice`).

## Not measured

- No mortal-bot wall times (`playtest.mjs`) and no hits/min with two midbosses per stage: G's measurement.
- Slot B in play on biome slot 1 or on a repeat visit, other than in the unit tests and the stage-clock text. The rig shots are slot 0, first visit.
- The DRIFT-in-a-biome-slot path in normal play: no phase-1 biome pool member is DRIFT. **Checked in-page after the review** with the real `enemies/ufo.ts` spawner and pre-set picks (`node tools/midslot-shots.mjs <url> production/qa/evidence/ls1-f fire 3 drift`): `ufo@5892 leave=495 exitX=6397 (driftExit 6397) withdrew@6387 gone@6496`, slot B WARNING at 6697 with `G.mini` clear, then the Apprentice on 1260 f. Shots `ls1-f-fire-drift-slotB-*.png`.
- Perf with two midboss warm-ups per stage: item K.
- The first-kill +100 biomass (spec §6.4) is **not** wired. It is economy (G or LS2) and is not in F's row.
- Fold APK: not run.

## Stubs and open risks

1. **Slot B TTK band:** see the finding above.
2. **Run save (H):** `G.mb`, `G.mbUsed` and `G.mbLast` are new run state. `stageMids` picks once and reads `G.mb[i]` back, so H must serialize all three for "the same midboss pair" on resume, or re-picking will see a different `mbUsed`/`mbLast`.
3. **`fillerQuiet` treats a withdrawing midboss as not up.** It only matters for DRIFT midbosses: a held one holds the scroll anyway. Cells are never filler, so this choice does not affect them (systems-designer review corrected an earlier reason given here). K decides whether withdrawals should count for perf; it is a one-token change in `miniUp`.
4. **The Orbit pick is fixed, not drawn.** The Saucer is the row's drift entry. When LS2-orbit adds the tug, Orbit needs a real `pickMids` call (pool of 2, Saucer forced in Descent 1).
5. **The short layout keeps a 1400 f clock and no guards,** by design (brief: behaviour-identical).
6. `layout().picker` gates the fork rule. If D24's short fallback is deleted (row M), the flag can go.

## Merge-order notes

- F merges before G. **F does not touch `stages.ts`**, so G sees no conflict there.
- Files G is likely to touch alongside F: none that I know of. `midpick.ts` and `layout.ts` are F's; G edits `depth.ts`, `perks.ts` and `mutations.ts`.
- K's precondition (filler suppression while `G.mini` is up) lands with F.
- H must add `G.mb` / `G.mbUsed` / `G.mbLast` to the run save (risk 2).

## Studio review, round 1 (specialists)

- **web-specialist: APPROVE WITH NOTES.** No change to ESM order (midslot/midpick are leaf modules, as are their imports state/layout); the Orbit `spawnUfo` arithmetic is bit-identical; short paths are unchanged. Notes:
  - `whenNoMini` allocates one closure per frame while it waits (only in the backstop case).
  - If the scroll ever reached `bossX` while slot B was still waiting, slot B could follow the boss. That is unreachable today.
  - Suites that mock `ufo.ts` see no DRIFT registration.
  - `meta.mb` is now written on short too; harmless, and save v3 already cleans it.
- **qa-tester: APPROVE WITH NOTES.**
  - The slot-A DRIFT clock test checked the stub, not `ufo.ts`. Addressed with the in-page drift run above.
  - The stripped `play()` loop is a simplification: the scroll stops instantly, and the held case is constructed.
  - The sweep copies `choose()` by hand, and `mbLast` carries over across runs.
  - Not covered: no mortal wall times, no shots of slot 1 or a repeat visit, and H must save `G.mb`/`G.mbUsed`/`G.mbLast`.
- **systems-designer: APPROVE WITH NOTES.** Picks, clocks, the forced exit and the fork rule all match the spec. Notes:
  - Rule 2 covers slot B but not the stage boss WARNING (safe today; follow-up).
  - The silent `driftExit` fallback should throw. **Fixed:** `midSlot` now throws if `driftLead` is missing.
  - `meta.mb` counts meetings, so §6.4's first-kill +100 needs its own kill record (`meta.mbK`). It is owned by neither F nor G: assign it.
  - **TTK recommendation:** replace the per-slot bands with one band per kind, 8-11 s at the stage-1 kit, tuned through each kind's base HP (D1 allows this). The Apprentice to ~200 HP (6.8 s → ~9.1 s) is the only one out of band; DRIFT members are exempt. This is a game-designer spec amendment plus a decision-log entry; the HP change goes to G or a P0 follow-up, not F.
