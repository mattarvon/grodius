# Grodius content expansion (D19): build plan

*Producer, 2026-11-01, revision 2 (director reviews applied; the spec's Review log lists each change). A draft that goes with `content-expansion.md` (the design spec). Code refs are relative to `/home/matt/Projects/grodius`. Nothing in the repo was changed. Sizes: S ≤ 1 day, M 2-4 days, L 5-8 days.*

## 0. Ground rules

- **Main must stay shippable after every merge.** Every push to main deploys to Pages and rebuilds the APK (`build.yml:73,97,115`). The long layout therefore ships **behind a flag** until it passes its exit and Matt has played it. Only then does it become the default. The flag is `?layout=long` on the web and a **persisted in-app LAB toggle** on the APK (item D2), because the Capacitor APK loads its bundled page with no query string.
- **The harness plus a full-descent parity check are the safety net.**
  - The default harness runs 3600 frames (`tools/harness.mjs:16`): 60 s of Open Orbit. It never reaches a fork, a biome or the Drive, so on its own it proves nothing about moved anchors (SEG, `T_END0/1`, the AMT bands, `BOSS_AT`, the Drive).
  - So every refactor that must not change the short layout passes **two** gates: the harness `st` byte-identical, **and** a new short-layout **parity check** (`tools/layout-parity.mjs`, built in row A). On 5 fixed seeds it dumps, per stage of a full descent under the seeded autopilot: scroll x at stage start and end, the script x/kind list, `bossX`, SEG, `T_END0/1`, the AMT bands, and `route-probe` output. Before and after must be identical.
  - Each intended baseline shift happens once, in its own commit, with every changed field explained.
- **Reference device: the Fold, provisional pending D15.** Fold readings are recorded and compared; `performance.enforce` is not set on it until D15 is settled.
- **Parallel work runs as one herdr pane and one git worktree per lane** (`~/Projects/grodius-<lane>`), each with its own branch. The **merge order** below is mandatory where lanes touch the same files.
- **Every change gets the full Studio Hierarchy review** (specialist → lead → director) before main. Reviews are batched per milestone branch, at about 0.5 day per merge.
- **Tests ship in the same PR as the code** (`npm test`, `npm run build`). Probe output goes in the commit message or `production/qa/evidence/`, together with the build hash.
- **Matt bottleneck.** M1 and M2 are both unplayed. The plan's rule is at most two unplayed milestones. So **LS1 merges to main but stays behind the flag** until Matt has played M1+M2 and the long layout (one combined session, §6).

**Shared-file hotspots and who owns them first:**

| File | Owned first by | Others wait on |
|---|---|---|
| `src/stages.ts`, `src/flow.ts` | LS1-A layout | everything else |
| `src/biomes.ts` | LS1-D beats | LS1-F picker wiring merges after D |
| `src/enemies/update.ts`, `spawn.ts`, `render/enemies.ts`, `render/gross/midbosses.ts` | LS2-0 midboss registry | all new-midboss lanes |
| `src/save.ts` | LS1-H (save v3) | the `meta.mb` field rides in the same v3 bump |

## 1. Where this slots against the existing milestone plan

```
M2 closeout ──> LS1 "Long stages" (engine) ──> M3 "Fights change shape" ──> M4 biome Maws ──> M5 hell ──> M6 ──> M7 v1.0
                     │                           ║ in parallel:
                     │                           ╠═ LS2 "Midboss pools" wave 1 (from LS1 sprint 3)
                     │                           ╚═ LS3 "Ship interiors" (Skin first; art gated on meridian)
                     └─ M2 render RNG split runs as an LS1 sprint 1 lane
LS4 "New biomes" (Keel, then Loom): gated on round 2 (meridian, idiom, sound); v1.1 by default (spec Q18)
```

**M2 closeout** (merged to main at `6e0599f`). Open items:
- **Narrow render RNG split (#13).** This becomes LS1 lane B1. 11 render/fx files still draw from the sim RNG.
- **Re-measure on merged main.** Do it **now**, on the short layout. It is the "before" numbers for LS1.
- **pacing.md / README / CHANGELOG rewrite.** Do it **once, at the LS1 flip**, not twice. The M2-only parts (the power rule) can go now.
- **Signing.** Unchanged; it waits for Matt's keystore.
- **Matt's M1+M2 playtest.** Folded into the LS1 session (§6).

**M3:**
- Its jump switch (`?at=&loop=&kit=`) and harness boss scenarios **move into LS1** (lane I). They are built on the checkpoint rebuild path.
- M3's rank-shaped patterns and the Drive phase refactor **start after LS1 merges**, because LS1 moves every Drive and stage x. The Drive refactor reads `layout()`.
- M3's other targets are unchanged: Drive 30-45 s, ALC with its death breather, pressure.ts as the only rank reader. New midboss fire goes through `cadence`/`depth`, and through pressure.ts once it exists.

**M4 (biome Maws):**
- Unchanged.
- Runs alongside LS2: it touches `maw.ts`, while LS2 works in the new midboss registry.
- The spec's §6.5 fork rule (acid and snot never offered together) lands in LS1 and is revisited in M4 with D11.

**M5 (hell):**
- `hellFlash` is re-keyed to stage kind in LS1 (neutrally).
- The Bridge interior (LS3) is M5's natural hell-glimpse site, so build it with or after M5.

**M6:**
- "Harness reaches a midboss, fork and biome" is **delivered by LS1-I**.
- M6 adds:
  - the 20-minute Fold soak;
  - verification of per-route warm-up memory;
  - the 38 MB music decision (now weighed against new tracks);
  - the save v2 → v3 upgrade test on the Fold.

**M7:**
- Unchanged.
- The release checklist adds: "an in-progress resume survives an update, or is discarded cleanly".

**Schedule impact.** LS1 is about 3-3.5 weeks. LS2 wave 1 is 2-3 weeks, in parallel with M3/M4. LS3's first interior is about 2 weeks, plus art. Together that pushes v1.0 out by roughly 4-6 weeks if v1.0 = LS1 + LS2 wave 1 + the Skin (spec Q18). Each LS4 biome adds about 2-3 weeks including its midbosses.

---

## 2. LS1 "Long stages" (engine work, phase 1)

**Goal:** Matt can play 90-120 s stages, **every biome stage with two different midbosses**, resume after an app kill (on the Fold, via the LAB toggle), and the bots can measure all of it.

**Content:** existing biomes only, the existing 4 biome midbosses used as crossovers, and the Saucer. The descent stays at **4 stages** (the spec's `long4` layout entry, §2.2); the 5th (interior) slot and the `long5` entry come in LS3. Every LS1 band is a `long4` band.

**Said plainly, so the LS1 playtest holds no surprise:** in phase 1, Open Orbit has **one** midboss (the Saucer, which doesn't hold the scroll) and the Drive approach has **none**. D19's "two per long stage" is fully met for those stages only after LS2-orbit and LS2-ship. That is why the default flip (item M) waits for LS2-orbit's tug unless Matt accepts the interim (spec Q20).

### Sprint 1: foundations (6 parallel lanes)

| ID | Item | Owner | Files | Acceptance | Evidence | Size |
|---|---|---|---|---|---|---|
| **A** | **Layout table.** New `src/layout.ts` with stage kinds; the `short` layout reproduces today exactly. Replace the literal x anchors: `core.ts:7-12`, `SEG` and `T_END0/1` (`biomes.ts:23,131`), `AMT` and the `buildTerrain` bands (`world.ts:45-92`), `drawInterior` (`render/terrain.ts:514`), `UFO_AT`/`UFO_GAP_END` (`src/enemies/ufo.ts`). `scripts.ts` x values become stage-relative. Index checks become `kindOf(stage)`: `stages.ts:12-17,34,87-98`, `music.ts:19-24,149,179-180`, `depth.ts:44`, `perks.ts:48`, `G.route`/`G.bx`. Split `G.remix` into `remixV` and `visitNo`. Re-key `hellFlash` (`fx/update.ts:316`) to stage kind. **Build `tools/layout-parity.mjs` first** (run on today's main to record the "before") | lead-programmer + tools-programmer | listed | Harness `st` **byte-identical**; **full-descent parity check identical on 5 seeds** (§0); `npm test` green; no literal world x left outside `layout.ts` (grep test) | Harness diff = 0; parity diff = 0; new `tests/unit/layout.test.ts` for every entry (stages contiguous; breaths ≥ 300 px from set pieces and `bossX`; **every DRIFT forced-exit x ≥ 300 px before the next WARNING**) | L |
| **B1** | **Render RNG split** (M2 #13): ~106 draws in 11 `src/render` and `src/fx` files move to `srnd()` | engine-programmer | `src/render/**`, `src/fx/**`, `src/render/hell.ts` | Test fails if render or fx imports the sim RNG; `st` identical between flashes ON and OFF | One harness re-baseline with a per-boss before/after | M-L |
| **G0** | **Economy tables as pure functions** of the layout entry: seals, `gradePts(Ts)`, `stageXP(ord)`, `killBio`, intra-descent depth, GLUTTONY `n`, hits/min targets by stage kind. Entries `short`, `long4`, `long5`. The short entry returns today's values | economy-designer + systems-designer | new `src/economy.ts`, `tests/unit/economy.test.ts`. **No wiring yet** | Short entry equals today's numbers (pinned); `long4` and `long5` match their spec §7 columns | Unit tests | M |
| **F0** | **Midboss picker** as a pure module `src/midpick.ts`: gates, body exclusion, tag rule, `meta.mb` weighting, fallback order, and an `ignoreMeta` flag as a no-op hook for D10 | systems-designer | new file + `tests/unit/midpick.test.ts`. **No wiring yet** | 10k simulated descents: 0 repeated bodies within a descent; slot B tag ≠ slot A; the step-2 relaxation never happens; **when biome A's crossover is biome B's home midboss, biome B gets two different crossovers** (no home midboss is promised) | Unit tests | S-M |
| **H0** | **Run-save serializer:** allowlisted `G` → JSON → `G` (allowlist per spec §4, **including `bx`, all three entries**), save key `grodius.run`, save v3 (adds `meta.mb`; a separate `gradeKey()` by stage kind with a 1-based loop part, e.g. `1-orbit`; migration **`N-1`→`N-orbit`, `N-4`→`N-drive`, drop `N-2`/`N-3`**; `stageLabel()` stays for the banner and `tally.id`) | engine-programmer | new `src/runsave.ts`, `src/save.ts:41-71`, `src/stages.ts:68-71`, `tests/unit/save.test.ts` | Round trip is lossless, **including `bx` for a fork taken late and one taken early**; a **real v2 blob** loads into v3 with Orbit and Drive best grades under the new keys and the biome-slot keys dropped; a bad or old blob is discarded without throwing | Unit tests | M |
| **P0** | **Midboss hygiene and crossover-proofing:** fix choir's per-frame `e.bars.filter` (`update.ts:383`); brood alive cap 10 → 8 (the CROWD alive cap, a precondition of K); make cyst (lake y) and prentice (fire sparks) work outside their home biome; host-biome tint for crossovers | gameplay-programmer + technical-artist | `src/enemies/update.ts` (cases 380-480), `render/gross/midbosses.ts` | Each of the 4 renders and behaves in all 4 biomes; no per-frame allocation | `midboss-probe` across a 4×4 biome matrix; `perf-probe` brood scene p95 not worse than 22.0 ms | M |

- **Merge order:** B1 and A may land in either order, but each re-runs the harness against the other's result. G0, F0 and H0 are new files with no conflicts.
- **Parallel lanes:** 6 (A, B1, G0, F0, H0, P0).
- **Also in sprint 1 (S, qa-lead):** re-measure on the short layout. Boss, midboss, depth, kind, pod and fire probes, plus `playtest.mjs` over 5 seeds. These are the before numbers.

### Sprint 2: the long layout behind a flag (5-6 lanes)

| ID | Item | Owner | Files | Acceptance | Evidence | Size |
|---|---|---|---|---|---|---|
| **C** | **Build each stage on entry:** `buildStage(i, fromX)` replaces the up-front build in `startLoop` | engine-programmer | `flow.ts:57-89`, `stages.ts`, `scripts.ts`, `biomes.ts:237-253` | Short layout: harness identical **and full-descent parity identical** | Harness diff = 0; parity diff = 0 | M |
| **B2** | **Per-stage build streams:** `Rs = stream(hash(runSeed, loop, stageIdx))` for `pickV`, `biomeScript`, `remix`, the midboss pick and build-time elite rolls. **Introduces a production run seed:** today `R = Math.random` (`core.ts:33`) and only the tools reseed it; B2 draws one seed per run at `newGame()` (saved in the checkpoint, spec §4). The sim `R()` is unchanged for spawn-time rolls | engine-programmer | `src/rng` (new) or `core.ts`, `scripts.ts:27-38`, `biomes.ts`, `elite.ts`, `flow.ts` | Building stage i twice gives the same script x list and kinds; short-layout anchors in the parity dump (SEG, `T_END0/1`, AMT, `bossX`, stage scroll x) unchanged | `tests/unit/buildstream.test.ts`; **one** harness re-baseline and **one** parity re-baseline (script lists only), both explained | M |
| **D** | **Long layout plus beat template v2** for biome stages (3600 px): the `BREATHS` table, intro B, 3 set pieces, 3 log lines, arena run-up, terrain movements A and C. Flag `?layout=long` | level-designer + gameplay-programmer | `layout.ts`, `biomes.ts:110-221`, `main.ts` (flag parse) | Biome stage scroll 58-62 s; breaths empty; no set piece within 150 px of a WARNING; arena gap ≥ 150 | `density-probe` (beats per p band), `route-probe` on all routes with **0 bad hazards**, `world-shots` of movements A and C | M |
| **D2** | **In-app layout toggle (LAB):** a persisted dev row (localStorage `grodius.lab`, outside the run save) shown on the title screen: layout `short`/`long`, `mids=wip` (for LS2), and the checkpoint trigger (spec §4 option a/b, for Matt's Q2 playtest). URL flags still override it. Changing the layout discards any checkpoint (its layout id no longer matches) | ui-programmer + engine-programmer | `main.ts` (flag parse), `screens.ts`/`menus.ts`, `src/perf.ts:5`/`input.ts:196` pattern | Fold APK: toggle to long, kill the app, reopen: still long; the title shows which layout is active | Fold screenshot of the title with LAB set; Playwright: toggle persists across reload | S |
| **E** | **Long Orbit and Drive approach:** generator with an interior mix table plus cells built from today's `ORBIT_*`/`DRIVE_*` variants; fixed 15 s Descent 1 opener; Saucer at the stage-relative x, with `UFO_GAP_END` as its stage-relative forced exit ≥ 300 px before Orbit's slot B WARNING; Drive approach 2700 px | level-designer | `scripts.ts`, `src/enemies/ufo.ts`, `layout.ts` | LS1 (Saucer only): Orbit 75-90 s wall; Drive stage (no midboss) 80-95 s; Descent 1 opener identical across seeds; no cell repeats within a descent | `pod-probe` stage times; new cross-seed signature report in `playtest.mjs` | M |
| **J** | **Repoint every probe with a hard-coded x to `layout()`:** density, route:103, midboss, perf, biomeboss/walls/maw/fx/upgrade/newenemy shots, world-shots:32, hazard, depth, gun | tools-programmer | `tools/*.mjs` | Every probe runs on both layouts and says which one it ran on | Probe output for both layouts | S-M |

- **Merge order:** C → B2 → D → E. J goes in any time after A. D2 goes in any time after D's flag parse.
- **Parallel lanes:** C/B2 (one lane, sequential), D, E (rebases on D's `biomes.ts` only where needed; mostly `scripts.ts`), J, D2.

### Sprint 3: midbosses ×2, economy, resume, measurement (5 lanes)

| ID | Item | Owner | Files | Acceptance | Evidence | Size |
|---|---|---|---|---|---|---|
| **F** | **Wire the picker:** `B.mid` becomes `B.mids` with tags; two `miniWarn` calls per biome stage; crossover rule; leave clocks 1080/1260; `meta.mb` updated on meet; Saucer guaranteed in Descent 1; fork rule (acid and snot never together). **Filler suppressed while `G.mini` is up** (precondition of K). **Breath-2 safety (spec §3.2):** every DRIFT midboss gets its stage-relative forced-exit x; slot B's `miniWarn` and `midboss()` **defer while `G.mini` is non-null** | gameplay-programmer + systems-designer | `biomes.ts`, `spawn.ts:320-324`, `src/enemies/ufo.ts`, `stages.ts` | Every long biome stage meets 2 different bodies; 0 repeated bodies per descent; breath 2's WARNING never fires while `G.mini` is up, **including with a DRIFT midboss (the Saucer, a stub DRIFT member on a biome stage) in slot A** | `midboss-probe` TTK: A 8-11 s, B 10-15 s (stage-1 kit); unit tests for the defer guard (held and DRIFT cases) and the forced-exit invariant; 200-descent route sweep | M |
| **G** | **Wire the economy** for the **`long4`** entry (spec §7 `long4` column): seals `{2,4,6}` (unchanged), normalised grades, S ≤ 1 hit, XP, kill bio ×0.75 start, intra-descent depth .35 (N = 4), GLUTTONY `[3,6]`; best grades by kind via `gradeKey()` (from H0) | economy-designer | `stages.ts:19-102`, `perks.ts:48`, `depth.ts`, `mutations.ts:76-121` | Short layout unchanged (harness and parity identical); `stages.test.ts` and `depth.test.ts` updated in the same PR for `long4` | `pod-probe` on `long4`: **LV 13±1 at the end of Descent 1; D1 biomass 1.3-1.5k**; hits/min **by stage kind** within ±30% of spec §8 (biome slots 0 and 1; Orbit and Drive measured, banded from LS2) | M |
| **H** | **Resume point:** CP0/CP1 triggers, rebuild-from-`cpX` (`runScript` skip, the `G.eat` pattern), terrain restore with the **stored `bx[seg]`**, `pause` re-write (`main.ts:107-110`), RESUME on the title, cleared on game over or a new game. The trigger is one switch: app kill/quit only (spec §4 option a, default) or also on death in `respawn()` (`flow.ts:181-204`, option b), exposed in the D2 LAB row for Matt's Q2 | engine-programmer + ui-programmer | `runsave.ts`, `flow.ts`, `stages.ts`, `spawn.ts:420-426`, `screens.ts`/`menus.ts` | Kill the app at CP1 → resume gives the same terrain, the same midboss pair and set pieces, and the **same script x and kind list** (exact after B2). Spawn-time rolls (side, y, formation, elite status, in-flight behaviour) are **not** reproduced, by design. A resumed run never draws build `R()` beyond the build. Option b restarts at the last CP with one life spent | Playwright: reload mid-stage → RESUME → screenshot diff of terrain, plus a script-list diff; **Fold APK with the D2 toggle set to long:** kill the app from recents and resume | L |
| **I** | **Jump switch** `?stage=<kind>&x=<rel>&loop=&kit=` on H's rebuild path (pulled forward from M3). Harness scenarios: Orbit start (default), long biome breath 2, long Orbit Saucer, Drive start; M3's fixed-rank boss scenarios added on top | tools-programmer + qa-lead | `main.ts`, `tools/harness.mjs`, new baselines | Each scenario is deterministic across 3 runs | New `harness.*.baseline.json` files; this closes M6's "midboss, fork, biome" goal | M |
| **K** | **Perf and warm-up:** warm per route (boot: hero + Orbit + Drive; at `choose()`/stage build: the picked pair + boss; drop on clear); `perf-probe` scenes "midboss + 8 incoming" for all 4 midbosses in their crossover tints, plus the long-layout scenes (two midboss warm-ups per stage, peak density with elites). **Preconditions, not fallbacks:** the CROWD alive caps (6-8; brood at 8 from P0) and filler suppression while `G.mini` is up (F) are merged before K is measured | performance-analyst + engine-programmer | `main.ts:72`, `render/gross/midbosses.ts:896`, `tools/perf-probe.mjs` | No warm-up inside a WARNING window; p95 ≤ 16.7 ms at 4× throttle with `WARM_MS=20000` for every pair. **While the long layout is behind the flag**, a miss may be filed as an S2 bug with the fix named; it cannot carry the flip (M). Cold hitch on the first midboss < 100 ms | perf-probe table in the commit; a Fold reading on the short layout (baseline) and on the long-layout scenes | M |

- **Merge order:** F → G (both touch `stages.ts`); H after C, B2 and D2; I after H; K after P0 and F.
- **H entry criteria (from the LS1-H0 Studio review, 2026-11-01):** (1) decide in H's spec whether CP0 stores the rewards still pending when it is written after the tally: queued level-up picks (`G.pickQ`, plus 1 if `G.pick` is open), the boost offer (`G.boostReq`; `seenV` is stored already advanced) and a pending seal (a closure in `G.sealQ`/`G.pend`, while `cleared` is stored already incremented). Store them as fields, or serialize `seal = max(seal, SEAL_AT[cleared])`; a resume must not lose an earned reward. (2) Bound the restored `stage` by the restored layout's stage count (`runsave.ts` checks only ≥ 0). (3) The restore calls `resetPlayer()` before `applyRun()`, or the loadout is skipped. (4) LS1-A's `kindOf` emits exactly the `stageKind()` strings (`orbit`, `drive`, the biome ids), or live best grades stop matching (pinned in `save.test.ts`).

### Sprint 3 closeout: flip the default

| ID | Item | Owner | Acceptance | Size |
|---|---|---|---|---|
| **L** | **Matt playtest** of M1+M2 on the short layout, then the long layout on the Fold APK **via the D2 LAB toggle** (§6). Answer the spec's Q1-Q3, Q7, Q9-Q12, Q17 and Q20 | producer + qa-lead | Transcribed report in `production/qa/playtests/` | S |
| **M** | **Flip the default to long:** re-baseline the default harness once (explained); rewrite `pacing.md` §2, README stages, CHANGELOG; game-brief Pillar 4 and the matching edits **only after Matt approves the wording**. **Two gates before the flip:** (1) **LS2-orbit's derelict tug has landed** (Orbit meets two midbosses), **or** Matt has explicitly accepted one Orbit midboss as an interim (spec Q20, §6 checklist); (2) **a Fold reading** (pending D15) on the long-layout scenes (two midboss warm-ups per stage, peak density with elites, per-route warm-up) shows **no regression against the short-layout Fold baseline and no cold hitch over 100 ms inside a WARNING**. An open S2 perf bug does not satisfy gate 2. The absolute 16.7 ms enforcement stays with D15/M6 | producer + writer + qa-lead + performance-analyst | Exit below met, plus both gates; the short layout stays available as `?layout=short` (and in the LAB row) for one milestone, then is deleted | S |

With the recommended Q20 answer, M lands early in LS2 rather than at LS1 closeout.

**LS1 exit** (all bands are `long4` bands; each names its instrument):
- **Stage wall time:** `playtest.mjs`, 5 seeds, natural kit: biome-stage median **90-120 s**; Orbit (Saucer only) **75-90 s**; Drive stage (no approach midboss) **80-95 s**. The 85-100 s Orbit and 90-110 s Drive bands move to the LS2-orbit and LS2-ship exits. Descent ~7.5-8.5 min.
- **Variety:** 0 repeated midboss bodies per descent over a 200-descent sweep, and every long biome stage has 2 different ones.
- **Fairness:** `route-probe` all routes, 0 bad hazards.
- **Density:** peak ≤ 1.7 spawns/s (`density-probe`).
- **Difficulty:** hits/min by stage kind within the spec §8 band ±30% for both biome slots; Orbit and Drive recorded.
- **Economy:** `long4` targets (spec §7): LV 13±1 at the end of Descent 1, D1 biomass 1.3-1.5k. Grades: the bot's median stage grade with the stage-1 kit is no worse than the short layout's. (The `long5` targets, LV 14±1 and seals `{1,3,5}`, are the LS3-0 exit.)
- **Resume:** the Fold APK app-kill test passes (via D2). A real v2 save upgrades and keeps Orbit and Drive best grades.
- **Perf:** within budget, or S2 bugs filed **while behind the flag only**; the flip needs M's gate 2.
- **Harness:** scenario baselines committed, short-layout parity identical, and every re-baseline explained.

**Size:** about 3-3.5 weeks with 5-6 lanes in sprint 1, about 4 in sprint 2, about 5 in sprint 3. **Does not depend on any round-2 answer.**

---

## 3. LS2 "Midboss pools", wave 1 (then wave 2)

**Starts:** in LS1 sprint 3, once F is merged. Runs alongside M3 and M4.

**Goal:** every biome pool has 3 members, Orbit gets its second midboss, and the ship pool has 2 members ready for LS3.

**Art gate.** A new body's **identity** waits on round-2 **cast**, and its **art route** waits on **idiom**. The **mechanics** don't, so each midboss is built in two passes:
- **Pass 1 (mechanics).** A greybox body (a procedural blob in the biome tint) behind `?mids=wip` on the web and the `mids=wip` LAB row on the APK (D2), so main stays shippable and nothing unfinished reaches friends.
- **Pass 2 (art and name).** Once cast and idiom are answered, the art goes in, Matt names it, and the flag comes off for that kind.

| ID | Item | Owner | Files | Acceptance | Evidence | Size |
|---|---|---|---|---|---|---|
| **LS2-0** | **Midboss registry** so lanes don't collide: one file per kind (`src/enemies/mid/<kind>.ts` for the ET row, update, kill word and warm; `src/render/gross/mid/<kind>.ts` for draw), registered in one index. Move the existing 4 plus the Saucer into it | lead-programmer | `spawn.ts:142-147`, `update.ts:380-604,747-756`, `render/enemies.ts:907-926,1097-1107`, `midbosses.ts` | Harness identical; existing `midboss-probe` numbers unchanged | Harness diff = 0 | M |
| **LS2-ice** | Cryosleeper (WINDOW), Hanging Spine (ANGLE) | gameplay-programmer (+ technical-artist in pass 2) | `mid/cryosleeper.ts`, `mid/spine.ts` + render | Spec §6.2 mechanic; telegraphs ≥ 36/44 f and ≥ 3 px; nothing punishes shooting | `midboss-probe` TTK in its slot window; `perf-probe` "+8 incoming" p95 ≤ 16.7 ms; `depth-probe` D1-D3 | M (pass 1) + M (pass 2, procedural) |
| **LS2-acid** | Reclaimer (WINDOW), Floater (ANGLE) | gameplay-programmer | as above | as above | as above | M + M |
| **LS2-fire** | Kindling (CROWD, max 6 alive, `kid` tag), Spit (LINE) | ai-programmer | as above | as above; Kindling adds don't count toward grade or GLUTTONY | as above | M + M |
| **LS2-snot** | Sniffer (SPACE, pull ≤ 0.35 px/f), Polyp (ANGLE) | ai-programmer | as above | as above; a naked ship out-flies the pull (probe) | as above | M + M |
| **LS2-orbit** | Derelict tug (ANGLE) as Orbit slot B, **first in LS2** (it gates the default flip, item M), then the tethered crewman (LINE) | gameplay-programmer | `mid/tug.ts`, `mid/tether.ts`; Orbit table | Long Orbit has 2 midbosses; **Orbit 85-100 s**; the Saucer (DRIFT, slot A) is always gone before the tug's WARNING (forced-exit test from F, now with a real slot B) | `pod-probe` stage time; `ufo-shots` plus new shots; the F defer-guard test re-run on long Orbit | M + M |
| **LS2-ship** | Escape shuttle (WINDOW), hull crawler (RANGE) for the ship pool; the Drive approach gets its 1 midboss | gameplay-programmer | `mid/shuttle.ts`, `mid/crawler.ts`; Drive table | **Drive stage 90-110 s**; Drive fight window unchanged | `boss-probe` and `drive-shots` | M + M |
| **LS2-mv** | **Terrain movement B** gimmicks (B0/B1 per biome) and the **set-piece catalogue** (3 new per biome, drawn without replacement per run) | level-designer | `biomes.ts:110-179`, `render/biomeart.ts` (props) | Gap ≥ 108 everywhere; no set piece in a breath | `route-probe` 0 bad hazards; `world-shots` per movement; cross-seed signature report (≤ 50% shared) | M |
| **LS2-logs** | Log pools, 6 per biome (waits on **type** and **arc** for voice; the count and draw rule don't) | writer | `biomes.ts` `B.logs` | String-fit screenshot per line | Screens | S |
| **LS2-tests** | Picker coverage after each pool grows; `meta.mb` round trip; DEPTH.w shares by tag | qa-lead | `tests/unit/midpick.test.ts` | No pool member unreachable in a 1k-run sweep | Unit tests | S |

- **Parallel lanes after LS2-0:** 6 (ice, acid, fire, snot, orbit+ship, mv). Each owns its own new files, and the only shared edits are one-line registry entries (trivial rebases).
- **Exit:**
  - Every pool has ≥ 3 members, all shipped with art and Matt's names.
  - No repeated midboss pair over 3 consecutive bot runs.
  - All perf scenes are within budget.
  - Matt plays one descent ("two different midbosses every stage; did any of them feel unfair on touch?").
- **Size:** about 2-3 weeks for pass 1 across 6 lanes. Pass 2 depends on idiom: about 1-2 weeks procedural, more for bitmap strips.
- **Wave 2 (follows on):** Calving Shelf (DRIFT: needs `G.eat` in biome scripts and a stage-relative forced exit that passes the `layout.test.ts` invariant), Solvent, Kiln Door, Catarrh; Galley and Bunk Stack; the Descent 3+ extra move and phase-2 thresholds by descent; the first-kill bounty. About 2 weeks.

---

## 4. LS3 "Ship interiors"

**Starts:** after LS1. The core-lock system and the stage kind can start at any time. **The look is gated on meridian.**

**Goal:** the 5-stage descent (Orbit, biome, interior, biome, Drive).

| ID | Item | Owner | Files | Acceptance | Evidence | Size |
|---|---|---|---|---|---|---|
| **LS3-0** | **Interior stage kind:** the 5th table slot, the interior rotation (per run without replacement, Bridge from Descent 2), the interior mix table, the cell slot system, `TRACKS` entry/filter; wire the **`long5`** economy entry (spec §7 `long5` column: seals `{1,3,5}` with `SEAL_TXT`, HUD `hud.ts:101` and `stages.test.ts`; stage XP `40 + 35×ord`; kill bio ×0.6; GLUTTONY `[3,7]`; depth N = 5; +1 ship per Drive kill if Q11 agrees) | lead-programmer + level-designer + economy-designer | `layout.ts`, `scripts.ts`, `music.ts`, `stages.ts`, `perks.ts`, `mutations.ts`, `hud.ts` | 5-stage descent wall time 9.5-11 min (bot); seals break after Orbit, the interior and the Drive; **LV 14±1 at the end of Descent 1; D1 biomass 1.3-1.5k; hits/min by stage kind within ±30% of spec §8, Interior column included** | `pod-probe`; `route-probe` thresholds now read from the table | M |
| **LS3-core** | **Core lock:** shared shielded-core system with a 1500 f fuse, a C grade with no pay on seal, HUD fuse, plates | gameplay-programmer | new `src/boss/corelock.ts`, `boss/update.ts` (the phaseClock pattern) | Fuse readable on the phone; 20-30 s target with the stage-1 kit | `boss-probe` scenario; harness scenario | M |
| **LS3-skin** | **THE SKIN** (working title; was "the Hull"): floor-only terrain band, peel-up plates, the searchlight gimmick, the Battery dressing, 14-16 cells, Neptune/Derelict backdrops reused | level-designer + gameplay-programmer + technical-artist | `world.ts` band, `scripts.ts` cells, `render/terrain.ts` | 100-120 s wall; reads as distinct from Orbit (it has a floor, structures and turrets) | `world-shots`, `biome-tour`, `pod-probe`, cross-seed signature report | L |
| **LS3-crew** | **THE CREW DECK:** shutters, lights-out vignette (bullets at full brightness), the Muster, crew logs. **Waits on cast, hell and D18** | level-designer + writer + technical-artist | as above | Vignette costs no per-frame lighting; bullets pass the screens.ts:474 rule; **flashes OFF and the photosensitivity setting (D3) honoured** by the lights-out section | perf-probe; screenshots (flashes ON and OFF) | L |
| **LS3-bridge** | **THE BRIDGE:** viewscreen backdrop (the hell-glimpse site), the Helm. **Waits on hell and meridian; build with or after M5** | technical-artist + art-director + level-designer | as above, plus `render/hell.ts` | Flash limiter respected; flashes OFF honoured | Flash-rate trace; screenshots | L |

- **Parallel lanes:** LS3-0 and LS3-core in parallel. Then the Skin, which needs both. The Crew Deck and the Bridge each get their own lane once their round-2 answers exist.
- **Exit:**
  - The 5-stage descent is the default.
  - Descents 1-3 never repeat an interior (once 3 exist; until then the rotation uses whichever kinds are built and never repeats back to back).
  - Matt plays a full 5-stage descent on the Fold, plus a resume test.
- **Size:** LS3-0 + core + Skin is about 2 weeks. The Crew Deck and Bridge are about 1.5 weeks each, plus art.

---

## 5. LS4 "New biomes" (art-gated)

**Hard gates:**
- **meridian:** if the answer is hell-bleeding, re-concept first.
- **idiom:** photo tissue tile or pure code.
- **sound:** track or filter.
- **D8:** no-crosses scope for bone imagery.

**Order:** THE KEEL, then measure, then THE LOOM (spec Q13).

| ID | Item | Owner | Files | Acceptance | Evidence | Size |
|---|---|---|---|---|---|---|
| **LS4-keel-a** | Biome data: the `shape()` rib slalom, `splinter` hazard, 2 + 3 set pieces, ambient, palette, `BIOME_COL`, `MOTIF`/`PREV` gate entries | level-designer + gameplay-programmer | `biomes.ts`, `hud.ts:560` | Gap ≥ 108 everywhere; ribs vertical only; palette values provisional until the idiom colour lock is set; **contrast:** player fire, lime enemy bullets and UI-red-on-plate stay distinguishable on the biome ground at phone size | `route-probe`; `world-shots`; `hazard-probe`; `biome-tour` screenshot at 1x on the Fold | M |
| **LS4-keel-b** | Biome art: `biomePat`, parallax layers, BG, edge sprites, decor, hazard FX; a **foreground tissue tile built per the idiom rule (photo-derived or pixel)** and `hit_keel@8.png`. The RODA marrow source is a candidate for the back layer only | technical-artist + art-director | `render/biomeart.ts`, `src/img`, `src/sprites`, `fx/fxsprites.ts:21` | Recognised blind in `biome-tour`; **contrast:** player fire, lime enemy bullets and UI-red-on-plate distinguishable on ivory and on the marrow at phone size | `biome-tour` screenshots at 1x on the Fold; perf-probe | L |
| **LS4-keel-c** | Signature enemy, the rattler (rebuilds once unless the skull is shot) | ai-programmer | new enemy file, `ET`, `cadence.ts` | The two-step kill reads on the phone | `kind-probe`, `newenemy-shots` | M |
| **LS4-keel-d** | Midboss pool: Ribcage, Marrow Sow, Gnawer (+ a 4th in wave 2) via the registry | gameplay-programmer | `mid/*` | As LS2 | As LS2 | M ×3 |
| **LS4-keel-e** | Stage boss, the Ossuary (plates, then the skull core; no T silhouette) | gameplay-programmer + technical-artist | `boss/`, `render/gross/biomebosses.ts` | Boss window 12-25 s with the stage-1 kit | `boss-probe`, `biomeboss-shots` | L |
| **LS4-keel-f** | Music: a `BIOME_MIX` filter variant (default) or a track; biome perk optional | sound-designer + audio-programmer | `music.ts:30-46` | No new download unless the sound answer asks for one | `audio-probe` | S |

- **Parallel lanes:** a, b, c, d, e, f can all run at once after `a`'s data entry exists. That is up to 6 lanes.
- **Size:** about 2-3 weeks per biome.
- **The Loom repeats the pattern,** contrast acceptance lines included (its `#c9b8ff` sits close to the pale-blue player fire, so its a/b rows must show the two apart). Its tether hazard is a new class (M). The Ganglion must be redesigned before it is built.
- **Exit per biome:**
  - It is offered at forks.
  - `route-probe` passes on all routes, now including routes with 6 biomes.
  - Descents 1-3 never repeat a biome (once 2 new biomes exist).
  - Matt plays it.

---

## 6. Matt's touchpoints (short, pointed; the report records the run number and build hash)

**LS1 (one session, about 20 min on the Fold):**
- [ ] M1 + M2 on the short layout: the existing M2 questions (fire fun or mean, Drive length, hell-flash A/B).
- [ ] Set LAB → layout LONG on the title screen (D2), one descent. Does a stage feel like a Gradius stage or like padding? Two midbosses per biome stage: too many fights? (Orbit has only the Saucer and the Drive approach none in this build.)
- [ ] Kill the app after the first midboss, then reopen and RESUME. Did you land where you expected?
- [ ] **Q2, the checkpoint:** optionally set LAB → checkpoint RESTART and die once. Resume point only (a), or Gradius restart on death (b)?
- [ ] **Q20:** flip long to the default now with one Orbit midboss, or wait for the derelict tug?
- [ ] Answer the spec's Q1, Q3, Q7, Q9-Q12 and Q17. Approve or edit the Pillar 4 text.

**LS2:**
- [ ] Name the new midbosses and pick kill words, from a list offered.
- [ ] One descent: did any midboss feel unfair on touch?

**LS3:**
- [ ] A full 5-stage descent. Does the interior read as a cold stretch or as filler?

**LS4:**
- [ ] One run through the new biome. Name its bosses.

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Layout refactor isn't byte-identical (hidden x literals) | Medium | Blocks LS1 | A grep test for literal world x; the harness gate plus the full-descent parity check (the harness alone never leaves Orbit); probes repointed in the same sprint |
| A DRIFT midboss still up when slot B's WARNING fires (overwrites `G.mini`) | Medium without the rule | A midboss silently vanishes | Forced-exit invariant in `layout.test.ts` plus the `G.mini` defer guard (F) |
| Long layout untestable on the phone (APK has no query string) | Certain without D2 | LS1 exit can't run | D2 LAB toggle in sprint 2 |
| Two midbosses + a boss feel like too many fights | Medium | Pacing | Measured at the LS1 playtest; fallback: slot A on a 50% roll in Descent 1 |
| Perf: two warm-ups per stage, and peak density with elites | Medium | Phone frame rate | CROWD caps and filler suppression land before K; warm per route in the fork window; perf-probe gate per midboss; the flip (M) needs a Fold reading with no regression, never just a filed bug |
| Grades and economy feel off after the retune | Medium | Feel | Values in tables per layout; the short layout kept for A/B for one milestone |
| Content bill (18+ midbosses, interiors, biomes) outruns capacity | High | Schedule | Variety from the crossover rule first; waves; greybox mechanics ahead of art; v1.0 scope fixed at Q18 |
| Round-2 answers invalidate concepts (hell-bleeding) | Low-Medium | LS4 rework | Biome code waits for meridian; LS1-LS3 systems are answer-independent |
| M3 rebases on moved Drive x | High if M3 starts first | Rework | M3 shape work starts after LS1 merges |
| Resume exploit (app-kill rewind) | Certain | Low (single player) | Accepted by default; dirty-flag mitigation offered (spec Q2) |
| Third unplayed milestone | High | Provisional calls stack up | LS1 stays behind a flag until Matt plays M1 + M2 + long |
