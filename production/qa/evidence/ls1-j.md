# LS1-J: probes read `layout()`, aliases deleted (sprint 2, lane j)

Branch `ls1-j`, off main `8ff9ba4`. Owner: tools-programmer. Plan: `production/content-build-plan.md` §2 Sprint 2, row J. Spec: `design/content-expansion.md` §2.2. Rulings: `production/decision-log.md` D20. Review: none run in this lane; the coordinator runs one batched Studio review of the sprint.

**Merge order:** J merges **first** in sprint 2, and D rebases on it. The tripwire in `tests/integration/layout-literals.test.ts` enforces that order: it fails if a second `LAYOUTS` entry exists while any alias does.

## Commits

| Commit | What |
|---|---|
| `620d35d` | `tools/layout-arg.mjs` (new). 37 probes and rigs wired to `--layout`, with hard-coded world x and stage indices repointed to the layout accessors. The commit message says "39 tools"; the right count is 37 |
| `ec4d17a` | The aliases are deleted, the test mocks dropped, and the tripwire widened |
| `e976a2a` | Fix: depth-probe was missing its `LY` import (one of my substitutions in `620d35d` did not apply) |
| `868242b`, `4d0a368`, `3e715f6` | Fix: a **pre-existing** title-screen break in 8 probes (below), and a world-shots slip from `620d35d` |
| (this file) | Lane report |

## What changed

### `tools/layout-arg.mjs` (new): the shared `--layout` flag

- **Parsing.** Importing it takes `--layout <id>` (default `short`) out of `process.argv`, so every tool's positional arguments parse as before.
- **Early check.** It checks the id against `src/layout.ts` `LAYOUTS` in Node (Node 25/26 type stripping), before any browser or Vite starts. An unknown id exits **2** with `unknown layout long4 (src/layout.ts has: short)`; it never falls back silently to `short`.
- **In the page.** `useLayout(p, tool, { limits })` imports `/src/layout.ts` and calls `setLayout(id)`. It runs after `window.__started`, on the title screen, before the tool's first `newGame()` or Enter. If the game has already left the title it refuses, honouring the `setLayout` contract. It also leaves the module on `window.__LY` for a tool's synchronous in-page code.
- **Output.** It prints `<tool>: layout short (orbit, biome, biome, drive)` once per tool. Off `short`, it also prints the tool's own `NOT MEASURED on <id>: …` note. `ranOn(tool)` prints the closing `<tool>: ran on <id>`.
- **Node side.** `LY` is `src/layout.ts` in Node with the chosen layout active, for world x a tool computes outside the page (world-shots' shot lists).

### Probes repointed (world x and stage indices)

| Tool | Before | Now |
|---|---|---|
| boss-probe, depth-probe, perf-probe, rng-probe, drive-shots | `C.BOSS_AT`; biome fights at 3000 | `bossAt()`; `slotRow(0).x0 + 700` |
| depth-probe | stage index 1 / 3 for biome / Drive fights | `stageOfSlot(0)` / `lastStage()` |
| midboss-probe, perf-probe, rng-probe, ufo-shots | `UF.UFO_AT` / `UF.UFO_GAP_END`, 950 | `ufoAt()` / `ufoGapEnd()`, `ufoAt() + 150` |
| density-probe | `SEG`, hand-copied 220/160/.55/.1/+260, `FROM [2658, 5637]` | `slotRow(s)`, `layout().beats`, `breathAfterMid`, `gateLate`; loops over `nSlots()` |
| kind-probe | `BI.SEG[seg]`, `seg of [0, 1]`, `route = [null, null]` | `slotRow(seg)`, `nSlots()`, `Array(nSlots())` |
| playtest | `stage === 1 \|\| 2`, `route[stage - 1]` | `slotOf(stage)` |
| biome-tour | `route[stage - 1]`, `stage === 1 && k > 3100 \|\| stage === 2 && k > 6000`, `stage >= 3` | `slotOf`, `row(stage).x0 + 800`, `lastStage()` |
| route-probe | `[0, 3300, 6400, 8500][stage]`, `> 1200` (shots only) | `row(stage).x0` + 1000 (biome) / 200 (Drive) / 1200 (orbit) |
| midboss, perf, rng, biomeboss, walls, maw, fx, upgrade, newenemy, elite shots | `scroll = 2300 … 3300` (and 3400/3600) | `slotRow(0).x0` + stage-relative 1000 (1100/1300); matrix `AT` is stage-relative |
| maw-shots | Open Orbit Maw at 2000 | `rowOfKind('orbit').warnX` |
| world-shots | orbit 300/1300/2000, ice 3000-4400, corridor 5600-8600 | orbit row x0 + those values, `slotRow(0).x0` + 700…2100, `slotRow(1).x0` + 450/1250/2050 and the Drive row x0 + 300 |
| hazard-probe | `G.scroll = 2100` | `rowOfKind('orbit').warnX + 100` |
| dps-probe, gun-shots | `3000` | `slotRow(0).x0 + 700` |

**Same values on `short`, except three:**

1. **density-probe `FROM`.** It moves from 2658 / 5637 to `gateLate` 2660 / 5640, as the brief directs. Spawn spans start 2-3 px later, so density numbers can shift slightly against old saved runs.
2. **route-probe `fly2` shot trigger.** It moves from 6400 to 6150. It only times a `shots=` screenshot.
3. **biome-tour slot-1 shot trigger.** It moves from 6000 to 5950. It only times a screenshot.

Every other value equals the literal it replaced. World-shots file names are unchanged (`ice-3400.png`, `corridor-8600.png` …).

**Not wired, on purpose:**
- `harness.mjs`, the short-layout regression gate.
- `layout-parity.mjs`, lane A's short-parity tool. Its `C.LEVEL`/`BI.SEG`/`UF.UFO_AT` branch only runs on a pre-table tree that lacks `parityAnchors()`, so no alias forced a change and I did not touch it.
- `openverse.mjs`, `sprite-scout.mjs` and `upgrade-picker.mjs`, asset scouts that never load the game.

**`NOT MEASURED` notes off `short`** (rule: report what was not measured):
- boss-, depth-, midboss-, perf- and rng-probe stage their fights in Open Orbit, biome slot 0 and the Drive only.
- world-shots covers Open Orbit and slots 0 and 1 only.
- hazard-probe enters slot 0 only.

The other tools generalise through `nSlots()`, `slotOf()` and `lastStage()`, or play the real flow.

### Aliases deleted

- **Deleted:** `core.ts` `LEVEL`/`BOSS_AT`, `biomes.ts` `SEG` and `enemies/ufo.ts` `UFO_AT`/`UFO_GAP_END`, with their now-unused imports. `layout.ts` imports nothing, so module order is unchanged.
- **No readers left:** `grep -rnE "\b(LEVEL|BOSS_AT|SEG|UFO_AT|UFO_GAP_END)\b" src tests tools` finds only comments, test names, UI strings ("SHIP LEVEL") and the parity tool's pre-table fallback branch.
- **Test mocks:** `tests/unit/every.test.ts` and `formation.test.ts` no longer mock `BOSS_AT`/`UFO_AT`.
- **Tripwire:** kept and widened. It now flags any declaration or assignment of the five names anywhere in `src/` (`\b(LEVEL|BOSS_AT|SEG|UFO_AT|UFO_GAP_END)\s*=(?!=)`), not only the `= layout()` alias shape. It still checks that it trips for a second entry. **Watched fail** against `8ff9ba4`'s `src/` (`LAYOUT_LITERALS_ROOT`): it lists `biomes.ts: SEG =`, `core.ts: LEVEL =`, `core.ts: BOSS_AT =`, `enemies/ufo.ts: UFO_AT =` and `enemies/ufo.ts: UFO_GAP_END =`.
- **Comments:** the `setLayout` contract comment in `layout.ts` no longer cites the aliases.

### Pre-existing probe breaks fixed along the way

Running every probe exposed 8 that could not start a run on current main:

| Probe(s) | Cause | Fix |
|---|---|---|
| hazard, meter, perk-input, perk-verify, rig-fx, progression, ship | They clear or seed `localStorage` without `asked`, so the title first asks the one-time **HELL FLASHES** question (`menus.ts` `titleItems`). Their single Enter answered it and never started a run. Most then died on a null `$.G`; progression exited 0 having sat on the title for its whole run | Press Enter until the game leaves the title. meter and progression also press a key first to drop the audio gate |
| shop | Same prompt | Its seeded save carries `asked: true` |

`8ff9ba4`'s own `hazard-probe.mjs` fails identically on a fresh server, so the break is not from this lane.

## Acceptance

| Criterion | Result |
|---|---|
| Every probe runs on `short` with `--layout short` and says so | **PASS**: 37 of 37, table below |
| `--layout long4` errors cleanly until D lands | **PASS**: all 37 exit 2 with `unknown layout long4 (src/layout.ts has: short)` before starting a browser |
| No alias left | **PASS**: deleted; the widened tripwire watched failing on the old src |
| `npm run test:unit` | **PASS**: 16 files, 209 tests |
| `npm run typecheck` | **PASS** |
| `npm run build` | **PASS**: built clean; only the chunk-size advisory |
| Harness `st` byte-identical | **PASS**: `PASS vs baseline @ f2f9c03`, `st` `{"state":"over","score":4885,"scroll":2168,…}`. 1/6 canvas hashes differ (advisory; see risks) |
| Layout parity identical | **PASS**: `PARITY PASS … runs 1, 5, 6, 7, 11, 1x3, 7m identical`, exit 0 |

The harness and parity ran on the src change (`ec4d17a`'s tree). The later commits touch only `tools/` probes, which neither gate imports.

## Probe output on `short`

Probes ran against a Vite dev server started **after** the src edits, with small run lengths. Logs are in the lane scratchpad, not retained. Each line below is the tool's own `layout` / `ran on` output.

| Tool | Args | Ran on | Result |
|---|---|---|---|
| biome-tour | `out` | short | ice / acid shot; ice shot at scroll 5979 in stage 2; ended at the Drive; errors none |
| biomeboss-shots | `out` | short | all shots; errors none |
| boss-probe | default cap | short | STAGE 1 kit: MAW 9.0, CRUCIFER 25.0, BUTCHER 20.0, DRIVE 55.3 s; errors none |
| density-probe | `20` | short | 16 rows (2 loops × 2 slots × 4 biomes); breath p .45-.55 / .52-.62 |
| depth-probe | default cap | short | all 10 fights × 4 kits; e.g. D1 mid-run gravity 55.3 s / 697 HP; errors none |
| dps-probe | `60` | short | errors none |
| drive-shots | `out` | short | errors none |
| elite-shots | `out` | short | no page errors |
| fire-probe | `3` | short | errors none |
| flyer-shots | `out` | short | no page errors |
| fx-shots | `out` | short | no page errors |
| gun-shots | `out` | short | errors none |
| hazard-probe | `ice` | short | in biome ice at scroll 2415; errors none |
| kind-probe | `2` | short | all biomes × 2 slots × 3 visits; errors none |
| maw-shots | `out` | short | errors none |
| meter-probe | `60` | short | PODS / METER rows at 30 and 60 s; errors none |
| midboss-probe | — | short | STAGE 1 kit: Maw 9.1, Choir 10.0, Womb 8.7, Apprentice 6.8, Brood 9.9, Saucer 5.4 s; errors none |
| midboss-probe | `matrix out` | short | 4×4 crossover matrix at 4 stage positions; errors none |
| newenemy-shots | `out` | short | no page errors |
| perf-probe | throttle `1` | short | 10 scenes; errors none |
| perk-input | — | short | errors none |
| perk-pace | `2` | short | final LV6; errors none |
| perk-shot | `out` | short | errors none |
| perk-verify | — | short | errors none |
| playtest | `out 1 7 3` | short | 3.0 min; errors none |
| pod-probe | `7 2` | short (JSON `"layout":"short"`) | stdout stays one JSON object; its "ran on" line goes to stderr |
| progression | `60` | short | in play, scroll 1861 at 60 s |
| rig-fx | `out` | short | every rig captured; errors none |
| rig-probe | `none 1 20` | short | errors none |
| rng-probe | `--frames 300` | short | **PASS: all 10 fights identical ON / OFF / BARE** |
| route-probe | `0 1 1` | short | minGap 128.2, slams 0, hazards bad [], deaths 0; console 403s (see risks) |
| screens-shot | `out` | short | errors none |
| ship-probe | `out` | short | errors none |
| shop-probe | `out` | short | errors none |
| ufo-shots | `out` | short | errors none |
| upgrade-shots | `out` | short | no page errors |
| walls-shots | `out` | short | no page errors |
| world-shots | `out` | short | 12 shots, same file names as before; no page errors |

I spot-checked two shots by eye: `world-shots/ice-3400.png` (ice terrain) and `biomeboss-shots/butcher-2-spit.png` (the Butcher in the Furnace, mid-attack). Both frame the same scene the old x did.

**Long-layout runs are D's to record.** Only `short` exists until item D adds `long4`.

## Not measured, and open risks

- **No before/after numeric diff of each probe.** Most probes seed nothing (only the clock is faked), so their numbers vary run to run. The repoint is checked value by value instead: the table above lists the three values that move on `short`. A pre-J probe can't be run against this tree anyway: it reads the deleted aliases, and e.g. `8ff9ba4`'s midboss-probe now dies on a `NaN` scroll.
- **Perf numbers were taken under load.** Four other lanes were running parity and pod probes on the same machine, so this perf-probe run proves only that the probe runs. Don't compare its ms.
- **Short runs only.** playtest ran 3 min, pod-probe 2 min, perk-pace 2 min and progression 60 s; the full-length defaults were not run.
- **Dev-server caveat.** A Vite server that was running while `src/` changed serves the changed modules as `?t=` URLs. A probe's `import('/src/…')` then gets a second module instance, and `setLayout` lands on the wrong copy. My first probe pass hit this (every midboss "esc") and I re-ran everything on a fresh server. perf-probe's header already warns about this; restart Vite after src edits.
- **Font 403s.** In this worktree, `node_modules` is a symlink outside Vite's allow list. The bundled fonts 403 and route-probe logs the console errors. The fonts are the likely cause of the one differing harness canvas hash, but I did not confirm that. Canvas hashes are advisory, and this change touches no render code.
- **Stubs:** none. Nothing here depends on another lane.

## Merge-order notes

- **J goes first.** Item D's second `LAYOUTS` entry fails `layout-literals.test.ts` until J is on main.
- **After D lands:** every probe takes `--layout long4`. Tools that stage fights in fixed rows print a `NOT MEASURED on long4` line saying which stages they skip.
- **`ls1-b1fix`:** if it lands first, J has no conflict. J touches no sim code and neither baseline. Rebasing J onto it only changes which baselines the two gates compare against.
