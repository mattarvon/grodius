<!-- Generated 2026-10-31 by the Claude Code Game Studios hierarchy against main @ 8ce8bdd (read-only audit). -->

# Grodius Studio Roadmap

*Producer synthesis of the reports from 8 departments plus the creative and technical directors. Measured against main @ 8ce8bdd (2026-10-31). Read-only review: no code was run, and every claim cites the department report that made it.*

> **Before anything else:** the memory notes say the canonical Grodius checkout is on the Windows box (`E:\projects\grodius`). Before starting sprint 1, `git pull` this laptop clone so both machines are at 8ce8bdd or later. The harness baseline will be captured on this laptop, so record the machine and OS next to it. Pixel hashes differ between Windows and Linux.

## 0. The one-paragraph status

The game is in good creative and technical shape. Production has three problems.

1. **Nothing checks a change before it ships.** `.github/workflows/build.yml:3-6, 24-25, 87-88` builds and deploys every push to main. `npm run test:regress` cannot run, because `package.json:11` passes no URL and `tools/harness.mjs:23` then calls `goto(undefined)`. The harness never fails (`harness.mjs:37`), and playwright is not declared as a dependency.
2. **The last balance merge (39bb121 = 48eb7cb + d0115f4) shipped unmeasured, with live regressions.** At pow 2 the Nail Choir never fires (`enemies/update.ts:396-397` vs `spawn.ts:369`). Drone fire scales with loop twice (`enemies/update.ts:51` vs `depth.ts:48`). The Drive still scales HP with rank (`boss/update.ts:21-22`). The docs and the CHANGELOG baseline (`CHANGELOG.md:9, 26`; `docs/pacing.md`; `README.md:99`) now describe a game that no longer exists.
3. **Player safety and trust.** Turning flashes OFF does not stop full-screen flashing (`render/hell.ts:66-87`, `fx/update.ts:316-317`; the default is ON at `save.ts:6`). Post-FX draws over enemy bullets (`render/screens.ts:470-474`). Every APK update wipes the save (throwaway signing key, `README.md:35`, `build.yml:34-37`).

Order of work: **build the gate, fix the confirmed bugs, take one re-baseline, settle the power rule, retune, and only then add content.** Never mix intended baseline moves with unintended ones.

---

## 1. Ranked work items (de-duplicated across departments)

| # | Item | Merged from | Owner role | Size | Gated on decision? |
|---|------|-------------|------------|------|--------------------|
| 1 | **Make the harness a real gate.** Add playwright to devDependencies. Have harness.mjs start `vite preview` itself, or default the URL. Commit `tools/harness.baseline.json` holding `st` + `errs` only. Exit 1 on a diff. Add an `--update` flag. Keep canvas hashes advisory. Pull the shared clock/RNG stub into `tools/lib/rig.mjs`. | QA P1, Prog P2, Release P2, Design P6(2) | tools-programmer (qa-tester assists) | S-M | No |
| 2 | **Confirmed bug bundle, then one re-baseline.** (a) The capsule purge uses order-unsafe `swapRm`: a chosen capsule is collected twice and an unrelated capsule is deleted (`shots.ts:354-363`, `core.ts:55`). (b) Choir nailbars never fire at high pow (`update.ts:396-397`). (c) Drone fire applies `(1+loop)` twice (`update.ts:51`). (d) Womb hatchlings lack the `kid` flag (`update.ts:138-141`). (e) `openFork` can fail to offer an unvisited biome (`biomes.ts:224-226`). (f) Stale comments at `perks.ts:255-257` and `boss/update.ts:21`. (g) Release-notes quoting at `build.yml:77`. The Drive HP term is excluded until decision D1. | Prog P1, Design P2, TD risks 2/4 | gameplay-programmer (ai-programmer for b, c) | S | (c) needs Matt to confirm the double scaling is unintended |
| 3 | **CI verify job.** Runs `npm ci`, build, Playwright chromium, harness vs baseline, and one asserting route-probe. Both `android` and `web` jobs get `needs: verify`. Add a `pull_request` trigger. `npm run typecheck` runs but does not block (only 2 of 54 files are actually type-checked). | QA P2, Release P2, Prog P2 | devops-engineer | M | D4 (what a red gate blocks) |
| 4 | **Photosensitivity and bullet readability pass.** Move `drawEShots()` after `postFX()`. With flashes OFF, really remove the white wash, red wash, glitch tear and corridor flicker (`hell.ts:66-87`, `fx/update.ts:316-317`). Add a ≤3/s flash limiter in postFX. Make the warning legible (`screens.ts:130`). Set the default or add a first-launch prompt. Remove the `SET.flashes && R()` RNG coupling at `boss/update.ts:99` and `fx/update.ts:316`. | Art P1+P3, QA P5, UX, CD Pillar 2 | technical-artist (accessibility-specialist signs off) | S-M | D3 (default ON/OFF and cap vs remove). The bullet-draw-order part is not gated. |
| 5 | **Settle the power rule and write it down.** Write `design/progression.md` (a brief-level Formulas note, not an 8-section GDD) covering: rank vs HP, the Drive exception, whether all 24 perks and the contraptions count in Descent 1 (`step.ts:25-26`, `perks.ts:255`, `depth.ts:29-30`), the flat-damage scaling rule (`player.ts:322`, `mutations.ts:233`), and holding set-piece layouts fixed in `formation()` (`spawn.ts:215`). Then implement one `powerBudget()` table shared by difficulty and ship art. | Design P1, CD Pillar 1/3, Prog decisions | systems-designer (level-designer for set pieces) | M | **D1, D2** (critical path for all balance work) |
| 6 | **Re-measure and re-document.** Re-run boss/midboss/depth/kind/pod probes and playtest seeds 7/11 on post-#2 main, plus a pow-2 / Descent 3+ frame-time check. Rewrite `docs/pacing.md` §2, `README.md:88-99` progression and stages, and add a CHANGELOG entry for tune-pressure with the commit hash it was measured on. | Design P4, Release P3, QA P3 | game-designer (docs), level- and economy-designer run probes | M | Runs after #2, then again after #5 |
| 7 | **Protect saves.** Stable signing: Matt creates the keystore and adds the 4 `GRODIUS_*` secrets. Fix the step-level `if` at `build.yml:34-37`. Make Gradle fail in CI when the keystore is missing. Check with `apksigner verify --print-certs` across 2 builds. Harden `save.ts:21-61`: per-field try, a backup key, and no write-back of defaults after a failed load. Add a save export before the one forced uninstall. | Release P1, Prog risk, TD risk 3 | devops-engineer (+ gameplay-programmer for save.ts) | S-M | D6 (accept one wipe vs export first) |
| 8 | **Node unit tests for pure formulas.** Use `node --test` in `tests/unit/` for `every()`/`BS()`/`formation()`, depth multipliers (=1 in Descent 1), `deepPay`, `xpNeed`/`critMul`, contraption cost monotonicity, and v1→v2 save fixtures plus corrupt JSON. Put them in the CI verify job. | QA P6, Design P6(4), Prog P5, TD decision | qa-tester | M | Formula tests that pin *rules* wait for #5. Save and every() tests can go now. |
| 9 | **Economy contradictions.** `deepPay` ignores `lv('deep')` (`stages.ts:28`). An escaped boss still pays and counts toward seals (`stages.ts:59-69` vs `README.md:93`). Grade is worth little (`stages.ts:20-25`). Includes save migration or refund if DESCEND DEEPER changes. | Design P3, CD Pillar 3 | economy-designer (gameplay-programmer implements) | S | **D5** |
| 10 | **Audio and comms correctness.** The voice cap returns `true` when it culls a sound (`audio.ts:127`): add priorities and stealing. TTS needs `u.lang='en-US'` (`audio.ts:715-731`). Fix the hype caption wiring (dead `HYPE[20]`, shamalama playing under the "HELL YEAH" caption; `fx/update.ts:237-248`). Replace setTimeout with game-time scheduling. Save the mute state and ramp it (`audio.ts:730-733`). | Audio P2/P3/P6, Narrative P4, Loc P2 | audio-programmer | S-M | D9 (what to record vs text-only) only for the content part |
| 11 | **Licensing and copy hygiene.** Ship CC BY attribution in-game (`screens.ts:132`). Fix the CREDITS Alt row and the gen-* provenance. Resolve README:110 "CC0 only". Add a LICENSE. Finish the no-crosses pass on player-facing strings (`enemies/update.ts:738`, `mutations.ts:51`, `shipparts.ts:391`, `biomes.ts:38,173`; internal kind keys stay). Settle one noun per system (glossary). | Audio P4, Release risk, Narrative P1/P3 | sound-designer + writer (producer signs off) | S | D7 (licence), D8 (crosses scope, nouns) |
| 12 | **Dev jump-to-scenario switch.** `?at=&loop=&kit=` behind `import.meta.env.DEV`, so the Drive or a Descent 3 biome can be reached in seconds rather than about 2.5 min. | Design P6(1), Prototyper | prototyper | S | No |
| 13 | **Split the RNG.** The seeded sim `R` stays separate from a render/audio `srnd()` module. Start with the timing-dependent callers (sprite fallbacks, the eyes iris queue, title render pushing drops at `screens.ts:81-92`, `audio.ts:213`), then the ~40 render sites. Add a lint grep. One deliberate re-baseline. | Prog P3, Art P6, QA risk, TD risk 5 | engine-programmer + technical-artist | M | D10 sets priority only |
| 14 | **Biome-specific Maw attack sets.** Acid uses `lob()` geysers. Snot uses litters plus slowing strands. The body and escape clock stay shared. Cadence comes from `every()` (`biomes.ts:45,68`; `update.ts:509-558`). | Design P5, CD Pillar 4 | level-designer (gameplay-programmer implements) | L→M | D11, and needs #5 settled |

**Deferred: valuable, but not in the top 14.** Single `resolvePlayerDamage()` and WARD semantics (M, needs D12). Incremental typing, starting with player/shots/save/menus (L, ongoing, one file per PR behind the harness). GROSS tier dial replacing the 6 constants (M, D13). Art bible and canon/voice doc in `design/` (M each; write them after #5 so they don't record inconsistencies as intent). Biomass sink (D5b). Touch hit-target and confirm-buy pass plus the pause overlap (S-M, needs the shop ruling D14). Build stamp and versionCode offset (S). Immutable per-build release plus the Pages artifact deploy (M). Bus mix and limiter (M; capture a reference first). Narrative log ladders (M). Text-fit pseudolocale check in the shots rigs (M). Mobile on-device perf baseline (needs D15).

**Explicitly out of scope until decided otherwise:** i18n layer, store and IARC work, daily seeds and replays, telemetry, engine-reference docs.

### Critical path
`#1 harness gate → #2 bug bundle (re-baseline 1) → #3 CI verify → D1/D2 → #5 power rule → #6 re-measure → #9 economy / #14 content`. `#13` RNG split slots in after #3, as re-baseline 2, and before the #5 retune lands.

---

## 2. Sprint 1: "Make main safe" (2 weeks, solo, 20% buffer)

### Goals
- A broken or regressed build can no longer reach Pages without a red check.
- The confirmed regressions from 39bb121 are fixed and measured against one recorded baseline.
- Flashes OFF means off, and enemy bullets always draw on top.

### Tasks
| ID | Task | Owner | Est. | Depends on | Acceptance |
|----|------|-------|------|------------|------------|
| S1-1 | Harness gate (#1): playwright devDep, self-start preview, `st`+`errs` baseline JSON, exit 1, `--update`, `tools/lib/rig.mjs` | tools-programmer | 2d | none | `npm run test:regress` passes on a clean tree. Hand-mutating one coefficient makes it exit 1 (watch the gate fail, then restore). Baseline records commit and OS. |
| S1-2 | Bug bundle (#2 a, b, d, e, f, g; c once Matt confirms) in one PR, then re-baseline 1 | gameplay-programmer | 2d | S1-1 | Each fix has a probe or hand-trace note in the PR. Baseline updated once with `--update` and the diff explained in the CHANGELOG. |
| S1-3 | CI verify job (#3): `needs: verify` on web (and android per D4), `pull_request` trigger, typecheck non-blocking | devops-engineer | 1.5d | S1-1 | A deliberately broken branch shows red on its PR and deploys nothing. |
| S1-4 | Bullets over post-FX, plus flashes-OFF removes or caps every wash, glitch and flicker (#4), plus a legible warning | technical-artist | 2d | S1-1 (re-baseline in the same PR as S1-2 if hashes move) | Screens rig captures boss phase 2 with flashes ON and OFF. No full-screen fill with flashes OFF. Bullets visible over the hell image. |
| S1-5 | Housekeeping: narrow `tools/vault_mirror.py` INCLUDE so framework docs don't pollute `Mirrors/`; configure `project.yaml` per section 4; record decisions D1-D4 in `production/decision-log.md` | producer | 0.5d | Matt answers D-Now | The next vault sync dry-run (add a `--dry-run` flag) lists only README/CHANGELOG/pacing. |

Capacity is about 8 dev-days of 10, leaving roughly 2 days of buffer. If Matt adds the signing secrets during the sprint, pull in **#7 signing only**, which is about 0.5d of CI work.

### Risks
| Risk | Prob. | Impact | Mitigation |
|------|-------|--------|------------|
| Baseline captured on Linux disagrees with the Windows box | M | M | Gate on `st` only. Hashes stay advisory. Record the OS in the baseline. |
| The S1-4 render-order change moves canvas hashes | H | L | Hashes are advisory. Explain the move in the PR. |
| Playwright in CI adds about 2 min and flakes | M | L | Pin the chromium version and retry once. If it flakes twice, fall back to a Pages-only block. |
| Matt keeps pushing tune work straight to main mid-sprint | M | H | D4: move tune work to PRs from S1-3 onward. |

---

## 3. Decisions Matt must make (consolidated)

### Now: blocks sprint 1 or the critical path
- **D1 Power rule.** Power shows up only as fire and density, and HP comes only from depth (recommended; matches 48eb7cb). Or rank also raises HP. Does the Gravity Drive keep its rank HP term (`boss/update.ts:22`) as a deliberate exception? *(Design, Prog, CD, TD all raised this.)*
- **D2 One power accounting.** Should all 24 perks and the contraptions count toward difficulty in Descent 1, so the ship's look and the difficulty agree (recommended)? Also: is the pow-2 fire compression (Crux fan 85→18f) intended, or should `every()` get a higher floor? And is the drone `(1+loop)` factor a leftover (recommended: remove it)?
- **D3 Photosensitivity.** Should flashes default to OFF, or stay ON behind a first-launch prompt? Should OFF *remove* the washes, glitch and flicker (recommended), or cap them?
- **D4 Gate policy.** Should a red verify block Pages only, or the APK as well (recommended: Pages and APK, plus manual `workflow_dispatch` for debug builds)? Should tune work move to PRs?
- **D5 Framework adoption.** Accept the settings in section 4 (minimal rigor, Node tests in `tests/`, typed in-code tables instead of external config, visual evidence advisory)?

### Soon: before sprint 2/3 (balance, economy, saves)
- **D6 Saves.** Accept one final save-wiping uninstall to move to stable signing, or ship save export first (recommended: export first, it is small)?
- **D5b Economy.** What does DESCEND DEEPER give: exclusive double pay, a starter kit, or an honestly described skip? Does an escaped boss pay and count toward seals (fix the code or fix `README.md:93`)? Should grade pay noticeably more? Which "options, not power" biomass sink?
- **D7 Licensing.** Licence for the code, art and voice (all rights reserved vs open code with assets excluded). Consent and credit from the second voice performer (commit 0072992). Use a fuller in-game credits screen, or swap the CC BY tracks for CC0? Which README asset rule is current?
- **D8 Copy rules.** Does the no-crosses scope cover all cross and halo imagery (recommended)? Should ship logs and stage cards stay deadpan (recommended)? One noun each for perks, kill grafts, Infirmary buys and contraptions. Replacement BLOATED BITCH banner. KEYSTER vs KEISTER.
- **D9 Hype man.** Record 35/50/75/100 plus a separate babe20 take, or go text-only and drop TTS? Captions for every clip? Does the 20-chain get its own cooldown?
- **D10 Seeded runs.** Are daily seeds or replays a product goal? This sets whether the RNG split is a hard requirement or hygiene only.
- **D12 WARD.** Should one pip absorb exactly one bullet with i-frames, or keep the current 16px soak ring? Blocks the damage-path refactor.

### Later: before content or release work
- **D11 Biome bosses.** Shared Maw body with biome-specific attacks (recommended, M), or fully distinct bosses (L)?
- **D13 Gross dial.** Internal knob only, or a player-facing TAME/GROSS/ULTIMATE option? Lime stays the hazard colour at every level. Add a colour-blind bullet palette?
- **D14 Shop input.** Is two-tap buy intended? On desktop, should clicking select only? Add a confirm step on permanent buys?
- **D15 Distribution and target.** Sideload plus Pages forever, or itch/Play? This decides the release build/AAB, debug hooks (`window.__G`, WebView debugging), ratings, adding "STRONG LANGUAGE" to the content warning, and localization scope (recommended now: English-only, Latin-script if ever). Name a reference device (Fold 7?) and a frame budget.
- **D16 Audio direction.** Is the always-on drone under the music deliberate? Should the clean UI synths get a gross pass? Sliders, or a VOICE toggle plus a saved mute? Re-export the Void loops? Lower the music bitrate or lazy-load it (38 MB)?
- **D17 Art direction.** Move the remaining code-drawn enemies to bitmap strips, or keep the vector contrast? Is it OK to commit an `assets-raw` provenance manifest to the public repo?
- **D18 Canon.** Is the descent and time loop the MERIDIAN pulling the tug back? How much of the 7 missing years gets revealed? Where is the Infirmary in the fiction?

---

## 4. Recommended framework settings (`project.yaml`)

Per `project.yaml`'s own header, set only `modes.rigor` and `modes.automation` in a `modes:` block. Do **not** seed the six knobs that rigor fronts.

| Key | Value | Rationale |
|-----|-------|-----------|
| `modes.rigor` | `minimal` | Expands to workflow `minimal`, density `terse`, qa `minimal`, granularity `coarse`, review `solo`, team `individual`. That fits a solo, probe-driven project. `design/game-brief.md` plus `design/progression.md` become the design record instead of 8-section GDDs. |
| `modes.automation` | `guided` | Keeps agents proposing before writing, without the full Q→O→D ceremony on every small tuning edit. Use `autonomous` locally in `project.local.yaml` only if Matt wants it. |
| `modes.automation_always_ask` | `[scope_changes, file_deletions, schema_changes, architecture_decisions]` | Keeps the always-ask stops on changes that are hard to undo: save schema, project.yaml, system boundaries. |
| `testing.strict` | `{logic: true, integration: false, visual: false, ui: false, config: false}` | Unit tests for pure formulas block. Screenshot evidence stays advisory, because `production/qa/evidence/` PNG retention is heavy for a solo developer and the shots rigs already exist. With `qa.level: minimal` this mostly takes effect once rigor is raised. |
| `testing.framework` | `node-test` (custom) plus the Playwright harness | The framework enum is engine-only. Record the real runners so `/test-helpers` doesn't scaffold gdUnit4. |
| `engine.name` | leave **unset**, documented in CLAUDE.md as "None (TS canvas)" | Valid values are only Godot/Unity/Unreal. Any value would mis-route specialists and the code root (`src/` = Godot row). |
| `platform.multiplayer` / `platform.online` | `false` / `false` | No networking. This keeps network and security routing from producing irrelevant reviews. |
| `platform.cert_tier` | `none` | Sideload plus Pages. Revisit when D15 is decided (`itch`). |
| `performance.target_framerate` / `frame_budget_ms` | `60` / `16.7` | Matches the fixed 60 Hz step (`main.ts:42-59`). Enforce after D15 names a reference device. |
| `performance.enforce` | `false` | There is no on-device baseline yet, so enforcing would block on desktop-throttle numbers. |
| Coding-standard waivers (a CLAUDE.md / `src/CLAUDE.md` note) | Typed in-code tables (DEPTH-style) instead of "external config"; no DI mandate; no `docs/engine-reference/`; `prototypes/` may import `src/` | The current standards would block one-line tuning fixes and produce wrong artifacts in an engine-less TS codebase. |
| `vault_mirror.py` scope | README, CHANGELOG, pacing.md only (plus `design/*.md` if Matt wants) | The framework docs now match the `docs/*.md` glob, and the script deletes unknown files in Mirrors/. |
