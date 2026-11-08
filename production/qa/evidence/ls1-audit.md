# LS1 audit · the studio over what LS1 shipped, and the fixes (lane `ls1-audit`)

Lane `ls1-audit`, branch `ls1-audit` off main `abf85c1`, with the parent's D36 commit `15397da` kept on top. Owner: producer, who coordinated; the specialists below did the reviewing and building as subagents. Brief: the parent's `ls2/ls1-audit.md` and `common.md`. Work list: the parent's audit `SUMMARY.md` and its 18 role reports.

**Two merges:**
- **Fix merge 1:**
  - `ab78198`: the fixes.
  - `6ac31b3`: the spec wording the creative-director required.
  - `0ff2e13`: probes leave the loop shop with two presses.
  - `f30cc3c` and `25b61af`: the fm1 review S2s, items 1-8.
  - This report's merge-1 commit, which changes no code.

  Merge 1's gates ran on `25b61af`.
- **Fix merge 2:** `e21a22c` plus the follow-ups after it (see "Merge 2 follow-ups").

## Agents used (37 spawns over 24 roles)

| Role | Plan / build / check | What it did |
|---|---|---|
| producer | coordinate | triage, rulings, a few one-line fixes (`scripts.ts` Drive WARNING flag, the comment fixes in `update.ts`/`ufo.ts`/`fx/spawn.ts`, the KILLS counter y, the probe two-press fix, the build plan carry-forward), gates |
| systems-designer | plan, 2nd pass | the #15/#16 spec; second pass F/H/D (decoder gaps, spec drift) |
| game-designer | decide, doc | backdraft `later(20)`, the rear-filler landing check; spec §6.3/§10 wording |
| gameplay-programmer (×4) | build, 2nd pass | #15/#16; the rear-wave clamp; H resume and checkpoint fixes plus D32 and the decoder bounds; the audio voice cap; second pass F/D |
| level-designer (×2) | plan, build | the rear-wave clamp plan; the dead filler branch, comments, NO REWARD; A/E second pass |
| ux-designer (×2) | plan, 2nd pass | the back-controls flow spec (found the root cause); checked the build against the spec |
| ui-programmer (×2) | build, 2nd pass | the back controls, Android back, DESCEND confirm, D33 LAB, the `#ps` hide; second pass HUD |
| tools-programmer (×2) | build, 2nd pass | harness #8/#9/FLAKY; probes default long4 (D33); `parseRuns`/`simState`; resume-check `--death` for D32; perf-probe flag; the dist grep |
| devops-engineer | build, 2nd pass | D33 CI (typecheck blocking, timeouts, cancel-in-progress PR-only); row I CI time |
| lead-programmer (×2) | build, check | registry hardening; merge 2 code review |
| engine-programmer | build, 2nd pass | the explicit WARNING flag, the warmLog cap, `routeArt` short-only, behavioural warm-up tests; row K second pass |
| technical-artist | build, 2nd pass | vent glow out of the HUD band, the snot throat lip, the HUD backing strip and midboss plate; row F art second pass |
| sound-designer | check | merge 2 audio review (the Drive death `prio`, voice lines never evicted) |
| web-specialist (×2) | check, 2nd pass | merge 1 review (Capacitor back API, `exitApp` catch); second pass B1/P0/K/H |
| accessibility-specialist | check | back controls: thumb size, contrast, the `#ps` overlap |
| qa-tester (×3) | check, 2nd pass, build | merge 1 review; `/regression-suite` + `/test-evidence-review` pass; added the missing regression tests |
| security-engineer | 2nd pass | H decoder gaps (xp hang), main-loop catch, the jump gate |
| ai-programmer | 2nd pass | F/bot/E: the `bandFit` band crossing, m0 per draw, filler findings |
| creative-director | 2nd pass | brief row; endorsed the picker change with a spec condition |
| narrative-director | 2nd pass | brief and copy; the copy fixes listed |
| writer | build | brief, spec §4 and build plan copy fixes; PRESS BACK AGAIN TO DESCEND |
| art-director | check | merge 2 art on the evidence shots (see "Merge 2 art check") |

## Gates

See "Gate results" at the end.

---

## Row F · midboss picker, two per stage

**Agents:** systems-designer, game-designer, gameplay-programmer (build, 2nd pass), ai-programmer, qa-tester, creative-director.

| Finding | Triage | What changed |
|---|---|---|
| #15 S2: `1/(1+met)` on raw lifetime counts gives a new kind ~95% of picks | **fixed (merge 1)** | weight by the gap to the least-met candidate, capped at 2 (`MID_PICK.cap`), with corrupt counts treated as 0. Sweep test: recent-pair rate 0.983 → 0.257 (bound ≤ 0.33); a fresh kind's share in runs 1-20 is .75 |
| #16 S2: step 3 drops every member of the last pair | **fixed (merge 1)** | exact-pair ban (order ignored); relaxes only when the last pair is the only full set. 3-member pool repeat rate 0.326 → 0 |
| Spec §6.3 "first 2 visits share no midboss" and §10 "no pair repeats within 3 runs" are now false | **fixed (merge 1, `6ac31b3`)** | creative-director endorsed on condition; game-designer reworded §6.3 steps 3, 4, 6 and made §10 a measured rate (about 1 in 5 within 3 visits). The LS2 exit line follows it |
| m0 taken once over the level, not "the candidates still in the draw" (ai, gameplay 2nd pass) | **fixed (merge 2 follow-up)** | m0 per draw |
| `MID_CLOCK` comment states the old 10-15 s slot B band; the header says short is the default | **fixed (merge 1)** | comment restated (D27 band, probe named) |
| #14: seeded runs depend on `meta.mb` | **no-action** | D10 decided "not a goal"; the `ignoreMeta` hook exists; one rng call per draw keeps the stream. The decision log's Open list still names D10: **for Matt**, confirm or delete |
| DRIFT `leave` hook never fires (gameplay review) | **fixed (merge 1)** | the Saucer's withdraw calls it; behavioural test `midleave-drift.test.ts` |
| `bandFit`: the eased band side can cross the hard side on a slope and push the body into the floor (ai 2nd pass) | **fixed (merge 2)** | clamp after the eases; `bandfit.test.ts` (fails without it). Brood is `homeFit` on short too: see the short harness/parity result |
| `midSlot` throws untested (qa) | **fixed (merge 2)** | 2 tests |
| held leave clock runs while dead; the DRIFT exit uses the Orbit row's `exitLead` in a biome slot (`ufo.ts:59`); slot A has no rule-2 guard; the real `spawnUfo` leave formula is untested; the `layout.test` exit should count the ~110 f slide-off | **backlog** | build plan carry-forward 3, 6 |
| Furnace name invisible on brick (tech-art) | **fixed (merge 2)** | midboss name plate |

## Row H · resume point and checkpoints

**Agents:** ux-designer, ui-programmer, gameplay-programmer, security-engineer, systems-designer, qa-tester, web-specialist.

| Finding | Triage | What changed |
|---|---|---|
| **Matt's armory bug.** On the phone, `< RETURN` in the Infirmary does nothing; Android back then closes the game | **fixed (merge 1)** | Root cause (ux-designer): a shop row is select-then-act, so a touch tap only selected RETURN. On desktop the mouse hover had selected it first, which hid the bug. Matt's path: buy (the selection moves to the item), tap RETURN (highlight only), press back (swallowed by the 40 f `shopLock`, or to the title, where the next press exits). Now there is a 96×32 game px first-tap button (`< RETURN` / `DESCEND >`), back is honoured during `shopLock`, and the loop shop needs two back presses |
| #2 S2: Android back exits the app from OPTIONS/LAB; Esc/B do nothing there | **fixed (merge 1)** | every back source goes through the pure `backStep()`; Android back steps up one level and exits only at the title root; `< BACK` first-tap buttons on OPTIONS/LAB |
| #1 S2: one mistap on DESCEND wipes the checkpoint | **fixed (merge 1)** | DESCEND/DESCEND DEEPER arm on the first tap while a save exists ("ENDS SAVED RUN"); the second tap fires; disarms after 180 f or on a move. Keys and pad fire at once |
| #3: LAB LAYOUT wipes the save | **fixed (merge 1, D33)** | `clearRun()` removed; test |
| pause II (`#ps`) shows on every screen after a touch and covers BIOMASS on the phone (a11y, web) | **fixed (merge 1)** | shown only in play/pause; the rig asserts it hidden on every menu scene |
| game over: X/pad B are also POWER, so mashing them through a death SURFACEd (qa) | **fixed (merge 1)** | on game over only Esc, Backspace and Android back count as back |
| phone canvas clipped 8 px by the body margin | **fixed (merge 1)** | `body{margin:0}` |
| #4 S2: CP1 is written after midboss A's release pod | **fixed (merge 2)** | biome CP1 at release − 20 (`CP.preRelease`), falling back to +150; tests incl. "resume replays the release once" |
| D32: an option-b death costs the normal death penalty | **fixed (merge 2)** | shared `deathCost`; `deathRestart` applies guns stripped, grafts −1, cursor reset, and keeps the higher hit count; re-written checkpoint carries it; resume-check `--death` expects it |
| #13: resume never draws build `R()` untested | **fixed (merge 2)** | `resumeguard.test.ts` counts sim draws in `resumeLast` (0); resume-check already asserts the press |
| decoder bounds (security, gameplay, systems 2nd pass) | **fixed (merge 2)** | bounded: loadout (`LOAD_MAX`), lives, `pickQ < lvl`, `xp < xpNeed(lvl)` (the `xp: 1e30` hang), `cpX`/`cpN` required and in range, `visitNo`/`remix`/`remixV` typed, `route`/`bx` non-null up to the stage, `bx` in range, `loop ≤ 99`, `seal ≤ 3`, `cleared` bounded. Each has a bad-blob test; restated constants have sync tests |
| IMPORT SAVE keeps the old checkpoint | **fixed (merge 2)** | `clearRun()` before reload; test |
| `clearRun` on gameOver/newGame/endLoop untested | **fixed (merge 2)** | `flowclear.test.ts` |
| main loop has no catch, so a throwing resume freezes and RE-ENTER stays offered; refused `removeItem` leaves a stale save; picker layouts don't require `seed`/`mb`/`picks`; Orbit/Drive CP1 still after the release; DRIFT midboss A's CP1 falls back past the release (recorded in spec §4) | **backlog** | carry-forward 5 |
| `checkMids()` throws at boot in a release APK (black screen) | **for Matt** | keep fatal, or DEV-only throw |
| X/Backspace/pad B also unpause, so mashing POWER at a pause resumes | **backlog** (ux) | carry-forward 3 |

## Row I · jump switch, 12 scenarios

**Agents:** tools-programmer, devops-engineer, qa-tester, security-engineer.

| Finding | Triage | What changed |
|---|---|---|
| #8 S2: `breath2` slot-B check skipped silently | **fixed (merge 1)** | an unresolved `want` is a `harness:` error |
| #9 S2: `--update` records a failed run | **fixed (merge 1)** | refused for any run with a `harness:` error |
| D33: FLAKY fails CI | **fixed (merge 1)** | FLAKY exits 1 (local opt-out `HARNESS_ALLOW_FLAKY=1`, ignored under `CI`) |
| D33: typecheck blocks CI | **fixed (merge 1)** | `continue-on-error` removed (0 errors); `timeout-minutes` 20/10/10; `cancel-in-progress` on PRs only |
| a failed jump throws a raw TypeError; `--runs 0`/`abc` run once silently | **fixed (merge 2)** | `simState`/`parseRuns` in `harness-rules.mjs`, tested |
| #12: jump `DEV` gate untested | **fixed (merge 2)** | `vi.stubEnv` tests, plus a `verify` step that greps `dist/` for two jump-only markers |
| #7: `sig` omits `G.boss`, eshots, midboss fields | **D31 lane** (its first commit) | none here |
| CI time: `verify` ~385 s with 12 scenarios; one FLAKY now fails the gate with no auto-rerun | **for Matt (awareness)**; the shard/cache/`dist` items are backlog | carry-forward 6 |
| scenarios end on the last life; `jumpBlob` zeroes `visitNo` | **backlog** | carry-forward 6 |

## Row K · per-route warm-up, the Maw rupture

**Agents:** engine-programmer, technical-artist, sound-designer, gameplay-programmer (audio build), web-specialist, qa-tester.

| Finding | Triage | What changed |
|---|---|---|
| #5/#6 S2: the voice cap drops a sound but returns true, so the Maw dies silent and WARNING loses its fallback | **fixed (merge 2)** | `VOICE_CAP` with a `LIVE` list. `prio` cues (siren, stinger, forkOpen, the Maw and Drive deaths) evict the oldest ordinary voice, never a voice line. `fb` calls return false at the cap so the synth fallback runs. Gore stays swallowed (producer ruling: synth gore under load is mud). 10 tests |
| S2 item 5 / `spawn.ts:425`: the warm-up gate keys off the banner text | **fixed (merge 2)** | `banner(..., warn)` flag on both WARNING callers; `warnbanner.test.ts` guards every future caller; perf-probe keys off the flag |
| `warmLog` cap truncates silently | **fixed (merge 2)** | a `cut (log full)` entry with a count |
| long4 `routeArt` fallback warms the home midboss | **fixed (merge 2)** | short-only |
| K wiring tests match source text | **fixed (merge 2)** | `warmpump.test.ts`, 8 behavioural tests |
| warm-up drop→rebuild thrash path | **no-action** | ruled out: `G.mini` holds until the body is dead off screen |
| Maw death plays from render; boss `roar` and player `die` unmarked; the crux `EYEC` canvases are never evicted | **backlog** | carry-forward 2, 7 |
| Maw death is the thin one-splat sound: did Matt approve the old stacked splats? | **for Matt's listen** | plus: Maw/Drive death in a crowded frame, siren+stinger loudness, WARNING with the bank unloaded |
| S2-K1 perf, S3-K2 `buildMass` | **out of scope** (ls2-perf / D30) | none |

## Row bot · mortal pod-probe pilot

**Agents:** tools-programmer, ai-programmer, qa-tester.

| Finding | Triage | What changed |
|---|---|---|
| #24: `safe` misses whips and orb shots | **backlog** | readings labelled "pilot-biased" (carry-forward 6) |
| pilot ignores the speed perk; 5 seeds too few; no stopped-scroll self-check; no automated test (evidence INCOMPLETE) | **backlog** | carry-forward 6 |
| `pod-probe` dead `metaBio` field | **fixed (merge 2)** | removed |
| D33: probes default to long4, where the plain bot dies in the first biome | **fixed (merge 2) + backlog note** | read pod-probe with `--pilot` |

## Row brief · game brief refresh

**Agents:** creative-director, narrative-director, writer.

| Finding | Triage | What changed |
|---|---|---|
| #22: brief says 90-120 s | **already fixed** (D34, parent) | none |
| header stamp, the "wave 1" naming clash, D35/D31/D36 status, the stage line (movement B, set pieces), the Drive fight figure, SURFACE settled, the Pillar 4 set-piece gap | **fixed (merge 2)** | writer |
| spec §4 (RE-ENTER, D32, CP1) and §3.2 drift notes | **fixed (merge 2)** | writer |
| build plan stale ABANDON/RESUME lines | **fixed (merge 2)** | annotated "(D34: …)" |
| copy: NOTHING LOST is false on long4 (#21) | **fixed (merge 2)** | NO REWARD (an escape pays no reward on either layout); the stage-boss IT GOT AWAY subline uses the same words. NO BIOMASS is proposed to ls2-read, which owns strings |
| copy: "BACK AGAIN TO DESCEND" reads as two actions | **fixed (merge 2)** | PRESS BACK AGAIN TO DESCEND |
| spec still says 90-120 s in 5 places; LS1 goal/exit lines | **for Matt** | rewrite, or keep as the LS1 record |
| `< RETURN` vs `< BACK` (one noun); a BACK row plus a BACK button | **backlog** | carry-forward 8 |
| adding the D31 lane to the brief's priority list | **for Matt** | none |

## Rows A, E · long layout, Orbit and the Drive approach

**Agents:** level-designer, art-director, accessibility-specialist, technical-artist, ui-programmer.

| Finding | Triage | What changed |
|---|---|---|
| S2 item 2: `backdraft` and `pincer` rear waves fly through terrain; set-shots stop at 90 f | **fixed (merge 1)** | `rearY` clamps into the opening over the whole flight (identity on short); `behindWave` takes a `fit`. The corrected run-up test found backdraft's second wave 13 px into the run-up: game-designer moved it from 40 f to 20 f. Fire's rear `behind` filler is now checked where it lands (long only). set-shots runs until `pend` drains and counts `buried`/`crossed` |
| S2 item 1: fire chimney vent glow inside the HUD band | **fixed (merge 2)** | `HUD_TOP` 30; the chimney glow and grille and the roof-vent glow stay below it |
| S2 item 3: the snot throat reads as movement A in stills | **fixed (merge 2)** | the bands swell a 0-4 px lip into the gap per pulse (≤ 6 px; walls stay static, D35); the bright strand is the strand hazard (no change) |
| #20: top HUD unreadable over long4 ceilings; F carry-forward 6 | **fixed (merge 2)** | a top gradient strip (#050608, 70% to y 20, 0 at y 32) and a 62% midboss name plate; dim HUD text one step brighter |
| the KILLS counter overprints the LV/XP row | **fixed (merge 2 follow-up)** | moved from y 28 to y 31 |
| filler from-behind branch can't trigger (`scripts.ts`) | **fixed (merge 2)** | dead branch removed; same draws, no move |
| stale "short is the default" comments | **fixed** (`lab.ts`, `cellpick.ts`, `scripts.ts`, `midpick.ts`, `ufo.ts`) / **D31** (`layout.ts`) | |
| #18, #19, the depth-bar Drive tick, `StageRow` held-midboss field, Drive floor slot | **D31 lane** | |
| cell picker alternates from D2 (S2) | **for Matt** | grow pools to 3× or dual-tag; is the D1 opener as the D3 intro acceptable? |
| title help line 3 overprints the credits on the root title | **backlog** (a layout call) | carry-forward 8 |
| Infirmary exit button ~9 CSS px above the Android gesture strip | **backlog** | carry-forward 6 |

## Registry hardening (lead-programmer; merge 1)

- `import './enemies/mid'` is now in `main.ts`. It is a no-op for module order: `update.ts`/`spawn.ts` already imported it, and a DFS of 83 modules gives the same order.
- The `src/CLAUDE.md` recipe now has:
  - kind files' top level calls `defineMid` with literals only;
  - wip rows count for the tag rule;
  - a `DEPTH.w` entry only for a measured reason;
  - DRIFT kinds call the `leave` hook themselves.

## Merge 2 art check

PENDING: art-director and accessibility-specialist on `ls1-audit-art/` shots.

## Decisions for Matt

1. **Back in the between-descents shop:** the producer took two presses (the first selects `DESCEND >` and shows "PRESS BACK AGAIN TO DESCEND"). Alternative: one press continues, as before.
2. **Android back at the title root:** per the fm1 review, it now takes two presses. The first shows "PRESS BACK AGAIN TO LEAVE" and the second leaves within 120 f (`EXIT_ARM_T`). Still to do: a device check on the Fold, and ux to confirm the placement at (28,252).
3. **Exact-pair midboss exclusion** is in (creative-director endorsed), so one member may come back on a revisit. Spec §10 is now a measured rate (about 1 in 5 within 3 visits).
4. **`checkMids()`** at boot: fatal in release builds too (black screen on a bad registry), or DEV-only?
5. **Spec "90-120 s"** in 5 places and the LS1 goal/exit lines: rewrite to D31, or keep as the LS1 record?
6. **The cell picker alternates from D2** (level-designer S2): grow the pools to 3× slots or dual-tag cells? Is the D1 opener returning as the whole D3 intro acceptable?
7. **D10 (seeded runs)** is decided in the log but still listed as Open. Confirm or delete.
8. **For your listen:**
   - the Maw death (the thin one-splat sound; was the old stacked sound approved?);
   - the Drive and Maw deaths in a crowded frame;
   - siren+stinger loudness;
   - WARNING with the sound bank unloaded.
9. **Beat density:** long4 builds measure 0.50-0.81 spawns/s against the spec's ~1.0/s, and acid/snot have no intro-to-build ramp (systems-designer). This goes to the D31 lane's re-measure.
10. **Awareness:** a FLAKY harness run now fails CI with no auto-rerun, so a red main needs a manual re-trigger.

## Gate results

### Merge 1, final (`25b61af`)

Each heavy job ran one at a time under `flock /tmp/grodius-heavy.lock`, from a separate worktree checked out at `25b61af` (the `ls1-audit-m1fix` branch).

| Gate | Result |
|---|---|
| typecheck (`tsc --noEmit`) | exit 0, 0 errors |
| vitest | 41 files, 887 passed and 1 expected fail (`it.fails`: the hatch filler landing in breath 1, game-designer backlog) |
| short harness | PASS vs baseline @ `8ff9ba4` |
| 12 scenarios | 12/12 PASS (rerun, see below) |
| long4 harness | PASS vs baseline @ `88d9525` (rerun, see below) |
| parity (short) | PARITY PASS: runs 3, 6, 7, 11, 15, 3x3 and 7m identical, 0 errors |
| build | OK |
| resume-check | PASS: long4 S1 CP1, S2 CP0, and S1 CP1 with option b (D32). The RESUME press drew the sim RNG 0 times, and terrain differed by 0 px at every sample |
| back-check (phone + desktop) | ok, `fails: []`. `#ps` was hidden by computed style and bbox on every menu scene, and the shots were re-taken into `ls1-audit-back/` |
| set-shots (long4) | band total: buried 0, crossed 0. Fire B0 and B1 pincer: 4 enemies to frame 383, crossed 0. Fire B0 and B1 backdraft: 7 seen to frame 411, crossed 0. No page errors |

**Why scen and long4 ran twice.** In the first run (m1c, 22:55) both exited 1 with `page.evaluate: Execution context was destroyed, most likely because of a navigation` (harness.mjs:132). That was a page reload, not a sim diff:
- Every lane worktree's `node_modules` is a symlink into the main checkout, so every lane's Vite dev server shares one dependency pre-bundle cache, `node_modules/.vite/deps`.
- When another lane's server re-optimises dependencies, it rewrites that cache. A server that is mid-run sees the change and reloads its page.
- The shared cache is still being rewritten today (09:57 and 11:35 on 2026-11-08), during other lanes' runs.
- Nothing in the gate worktree changed during the run.

The fix gave the gate worktree a private `node_modules` directory: a symlink to each package, so its `.vite` cache belongs to it alone. With that, scen and long4 were rerun on the same `25b61af` (m1d, 10:09-10:27), and both passed: 12/12 scenarios in 156 s, and long4 PASS. Lanes that run gates in parallel should do the same, or set Vite's `cacheDir` to a per-worktree path.

**Why long4 did not move.** The merge-1 changes are:
- the fire `behind` filler drop;
- the `rearY` window and pad;
- backdraft at 40→20 f;
- the picker and the back controls, which are menus.

The long4 harness game-overs in Orbit at scroll 3538, before any fire stage. None of these changes can reach it there, and long4 stays PASS on its old baseline. The 12 scenarios are likewise unchanged. The short harness and parity are identical too, which matches what we expected, since short runs leave `rearY` as the identity.

### Merge 1, first pass (`ab78198`/`0ff2e13`)

- typecheck clean; vitest 874.
- short PASS; 12/12 scenarios; long4 PASS; build OK; back-check pass; resume S1 CP1, S2 CP0 and option b PASS.
- Parity failed on `ab78198`: six runs timed out in the loop shop, because the bots pressed back once and the shop now needs two presses. `0ff2e13` presses at frames 56 and 60, so the bots still leave on frame 60. After that, parity was identical over 7/7 runs.

### Merge 2

PENDING.

## What was not measured

PENDING.

## Merge-order notes

- Merge 1 (ending at this report's merge-1 commit on top of `25b61af`) is what the pool lanes and D31's re-baseline wait on. It carries #15/#16, #8/#9 and FLAKY, so D31's mass re-baseline runs on a harness that refuses failed runs.
- `checkpoint.ts`/`runsave.ts` changes are in merge 2. D31's `cp1` override rebases onto them: `cp1X` is now `bZ - CP.preRelease` on biome stages with a release breath.
- Untouched for other lanes: `layout.ts` (D31) and `src/enemies/mid/*` / `render/gross/mid/*` kinds (pool lanes). The exceptions are `ufo.ts`'s withdraw line (the leave hook; the subline stays NO REWARD, since strings belong to ls2-read) and two comments.
- Probes leave the between-descents shop with two back presses since `0ff2e13`. A lane with its own shop-leaving rig must do the same.
