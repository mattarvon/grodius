# LS1-A: layout table (sprint 1, lane a)

Branch `ls1-a`, off main `f2f9c03`. Owners: lead-programmer and tools-programmer. Spec: `design/content-expansion.md` §2.2 and §3.2. Plan: `production/content-build-plan.md` §0 and §2, row A.

## Commits

| Commit | What |
|---|---|
| `4f3206f` | `tools/layout-parity.mjs` and its **before** dump `tools/layout-parity.baseline.json`, recorded on `f2f9c03`'s code. One src change: a read-only test hook (see below) |
| `6cec897` | The refactor: `src/layout.ts`, consumers wired to it, `tests/unit/layout.test.ts`, `tests/integration/layout-literals.test.ts`, two probe fixes, two screenshots |
| (this file) | The report |

## What changed

**`src/layout.ts` (new).** It is pure and imports nothing, so tests and `core.ts` can load it without a DOM. It holds one entry, `short`, which is today's descent as stage rows:

| Stage | Kind | x0 → x1 | bossX | Other |
|---|---|---|---|---|
| 0 | orbit | 0 → 2300 | 2120 (the Maw) | `warnX` 2000 ("SOMETHING IS COMING"); drift `ufo` at 800, gapEnd 1840, exitLead 60 |
| 1 | biome slot 0, fork | 2300 → 5150 | 4950 | `end` 5050 (the old SEG.x1) |
| 2 | biome slot 1, fork | 5150 → 8300 | 8020 | `end` 8200; `breathAfterMid` 260 (the legacy shift for the old mid-stage Maw) |
| 3 | drive | 8300 → 10000 | 9300 (BOSS_AT) | `warnX` 9060 |

The entry also carries:
- `tEnd` [8300, 8600]
- the beat fractions: pad 220/160, breath ending at .55 with length .1, sets .3/.75, remix sets .22/.62, warnLead 210
- the bands: AMT hull/corr/core/space, the `drawInterior` fade, the buildTerrain fT/cT/kT/zT bands and block range
- the hell bands
- the HUD depth marks

Accessors: `layout()`, `setLayout(id)` (D's flag will call it), `row`, `kindOf`, `slotOf`, `nSlots`, `slotRow`, `forkAfter`, `lastStage`, `rowOfKind`, `bossAt`, `ufoAt`, `ufoGapEnd`, `BANDS`, `innerBand`, `hellCorr`, `hellCore`, `segs`, `parityAnchors`. Everything reads the active entry when called, never a copy taken at import.

**Consumers:**

| File | Change |
|---|---|
| `src/core.ts` | `LEVEL`/`BOSS_AT` are now `@deprecated` boot-time aliases of the layout, kept only because probes import them (item J repoints the probes) |
| `src/world.ts` | `AMT = BANDS`; `buildTerrain` reads `layout().terrain` and `.level` |
| `src/biomes.ts` | `SEG` is a `@deprecated` boot-time alias (game code uses `slotRow`/`nSlots`); `T_END0/1` come from `layout().tEnd`; beats come from `layout().beats`; `biomeExit(slot)`; `G.bx`/`G.visitNo` are sized by `nSlots()` |
| `src/stages.ts` | `STAGES` becomes `STAGE_NAMES` keyed by kind; `stageInfo` uses the row's kind and slot; `clearStage` uses `forkAfter`, `lastStage`, `r.kind === 'biome'` and `biomeExit(r.slot)` |
| `src/flow.ts` | `G.route = Array(nSlots()).fill(null)` |
| `src/enemies/scripts.ts` | Script x is stage-relative. The Drive values moved by −8300 onto the Drive row's x0; the Orbit x0 is 0. The Maw, banner, WARNING and startBoss read `bossX`/`warnX`. `pickV` memory is now `G.remixV` |
| `src/enemies/ufo.ts` | Uses `ufoAt()`, `ufoGapEnd()` and `exitLead`. `UFO_AT`/`UFO_GAP_END` remain as `@deprecated` aliases for the probes |
| `src/music.ts` | `TRACKS` keys `stage0..3`/`boss0`/`boss3` become `orbit`/`orbitBoss`/`biome[slot]`/`drive`/`driveBoss`; `curBiome` and the '+' mix use `slotOf` and `G.visitNo` |
| `src/depth.ts` | The Orbit Maw check is `kindOf(stage) === 'orbit'` |
| `src/fx/update.ts` | The hellFlash roll and its glitch branch read `hellCorr`/`hellCore`. This is the neutral re-key: in `short` they are exactly the AMT corr/core curves |
| `src/render/terrain.ts` | `drawInterior` uses `innerBand` |
| `src/render/hud.ts` | The depth bar uses `bossAt()` and `layout().hudMarks` |
| `src/enemies/spawn.ts` | Dropped an unused `BOSS_AT` import. The unused `UFO_AT, ufoWarn` import was **left on purpose**, because removing it could change ESM init order in the spawn/ufo cycle |

**`G.remix` split.** It was one field doing two jobs:
- `pickV`'s per-section variant memory (an object kept across descents) is now `G.remixV`.
- `choose()`'s per-slot visit number is now `G.visitNo`. The music reads it.

Before the split, `choose()` wrote keys `0`/`1` into `pickV`'s object. Both parity and the harness show the behaviour is unchanged.

**Probes.** `tools/playtest.mjs` and `tools/elite-shots.mjs` read `G.visitNo` where they read `G.remix`. Without that, playtest would silently report every biome visit as "first visit".

**Test hook (commit 1).** `music.ts`'s mix expression moved into `mixWanted()`. It is the same expression, and `musicUpdate` calls it. It is exposed as `window.__musicPlan` so the parity dump can see the music choice with audio off. The harness passed on that commit.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Harness `st` byte-identical | **PASS** vs baseline @ 1e20b36, both after commit 1 and after the refactor |
| Full-descent parity identical on 5 seeds | **PASS**: seeds 1, 3, 5, 7, 11 × 2 descents, identical to the `f2f9c03` dump |
| `npm test` green | `npm run test:unit`: **66/66 pass** (55 existing + 7 layout + 4 grep). `test:regress`: PASS. `npm run typecheck`: clean. `npm run build`: clean |
| No literal world x outside `layout.ts` (grep test) | **PASS**. `tests/integration/layout-literals.test.ts` was watched failing: against `f2f9c03`'s `src` (`LAYOUT_LITERALS_ROOT=…`) all 4 checks fail and name every leftover (biomes/world/core/scripts/ufo/terrain/hud numbers) |
| `layout.test.ts` for every entry: stages contiguous | PASS (`short`) |
| … breaths ≥ 300 px from set pieces and bossX | `short`: **two legacy exceptions, pinned** (see risks). Breath to bossX passes |
| … every DRIFT forced exit ≥ 300 px before the next WARNING | PASS. The Saucer's forced exit is 1780 (gapEnd 1840 − 60) and the next G.mini write is the Maw at 2120: 340 px |
| Parity tool built first and the before recorded on unmodified code | Yes, commit `4f3206f`, before any refactor |

## Test and probe output

**Harness:** `PASS vs baseline @ 1e20b36`. It also prints `note: 6/6 canvas hashes differ (advisory)`. That note shows on the **unmodified** tree in this worktree too, with the same six hashes before and after the refactor (`3b358a5e13 … 0c21666de8`). It is environmental: the worktree's `node_modules` symlink puts the @fontsource files outside Vite's allow list, so the fonts don't load. It is not caused by this change.

**Parity:** each line is seed, gates, end condition, stages, play frames, errors.

```
seed 1  gates 1001: shop 2, 8 stages, 39638 play frames, errors 0
seed 3  gates 1101: shop 2, 8 stages, 33253 play frames, errors 0
seed 5  gates 1011: shop 2, 8 stages, 30450 play frames, errors 0
seed 7  gates 1111: shop 2, 8 stages, 32768 play frames, errors 0
seed 11 gates 1100: shop 2, 8 stages, 38646 play frames, errors 0
PARITY PASS vs baseline @ f2f9c03: 5 seeds x 2 descents identical
```

- **Coverage:** all 4 biomes, both slots, Descent 2, and repeat visits (the '+' music mixes appear in Descent 2 slot 1 on seeds 1, 3, 7 and 11).
- **Route checks in the dump:** min gap 122.7-138.1 px, 0 slams, 0 bad hazards.
- **The tool is deterministic:** two runs were byte-identical.
- **The tool catches a moved anchor:** a deliberate `tEnd` 8600 → 8610 made it fail, naming `anchors.tEnd`, `playFrames`, `minGap` and the hazard counts.

**Screenshots:** `production/qa/evidence/ls1-a-drive-corridor.png` and `ls1-a-biome-slot1-hud.png`. They show the corridor backdrop (`innerBand`), the terrain and the HUD depth bar with its marks, all rendering after the refactor. The bands themselves are pinned bit for bit in the unit test.

## Stubs, open risks, decisions for review

1. **The short layout breaks the D19 300 px breath rule on repeat visits.** On a remix, the set piece sits 158.9 px after the breath in slot 0 and 38.8 px after it in slot 1, because slot 1's breath is shifted by `breathAfterMid`. The short layout must stay byte-identical, so `layout.test.ts` pins exactly these two as `LEGACY.short` exceptions: they cannot drift, and a fix fails the test until the pin is removed. Every other entry must be clean. **Decision for the leads:** accept this as the documented legacy state of `short`. It is deleted one milestone after the flip.
2. **"Next WARNING" for the DRIFT rule is read as the next G.mini write.** For Orbit's Maw that is its spawn at 2120, not the 2000 "SOMETHING IS COMING" banner, which does not write G.mini. Measured against 2000 the gap would be 220 px. The reason for this reading is that the rule exists to stop G.mini being overwritten (spec §3.2).
3. **The hellFlash re-key is neutral by construction.** `layout().hell` is its own table, documented as keyed to stage kinds (last biome slot + Drive approach, and Drive chamber). In `short` it equals the AMT curves. Real per-kind values for `long4` are D/E's to set.
4. **Compat aliases.** `core.LEVEL`/`BOSS_AT`, `biomes.SEG` and `ufo.UFO_AT`/`UFO_GAP_END` are boot-time values. If D's flag switches the layout after import, probes reading them would be stale. Game code does not read them. Item J repoints the probes and should delete the aliases. With the aliases in place, every probe keeps working unchanged.
5. **`perks.ts:48` (`stageXP`) was not re-keyed.** It is an ordinal formula, and G0 (`stageXP(ord)` in `economy.ts`) and G (wiring at `perks.ts:48`) own it in the plan.
6. **Beats live in the layout now** (`beats`, `breathAfterMid`) so the invariant test can see them. D's `BREATHS` table should replace `beats.breath` and remove `breathAfterMid` for long entries.
7. **Parity tool limits:**
   - Seed 2 is excluded: its bot kit can't kill the Gravity Drive, which has no escape clock, so the run times out.
   - Rendering is stubbed. Canvas no-ops still run render JS, so its R() draws are kept, but the look is not compared.
   - Audio is off, so the music check compares *wanted* track and mix, not playback.
8. **The decision log is not edited.** It is a shared hotspot across six lanes. Items 1-3 above are the decisions to record when the batch is reviewed.

## Merge-order notes

- **A owns `src/stages.ts` and `src/flow.ts` first.** Everything else rebases on A.
- **B1 (render RNG split):** either order. Whichever lands second re-runs the harness **and the parity check**, because B1 moves the RNG stream. B1's single harness re-baseline also needs `node tools/layout-parity.mjs --update` in the same commit, with the reason. A touched only `render/hud.ts` (depth bar) and `render/terrain.ts:514` (one line) in B1's area, so conflicts should be trivial.
- **H0 (run save):** `G.remix` is gone. The allowlist should carry `remixV` (object, persists across descents) and `visitNo` (array by slot), plus `route` and `bx` sized by `nSlots()`.
- **D, E, J and later lanes:** read `layout()` and the accessors, add `long4` to `LAYOUTS`, and remove the compat aliases in J. `tests/unit/layout.test.ts` checks every entry automatically.
- **Every later refactor that must keep `short` identical** runs `node tools/layout-parity.mjs` (about 4 min, self-starts Vite) next to the harness.
