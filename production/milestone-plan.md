<!-- Generated 2026-10-31 by the Grodius studio (full hierarchy) against main @ 090764d. -->

# Grodius Milestone Plan: now to a releasable build

*Producer, 2026-10-31, revision 2 (after 8 lead and 2 director reviews). This is a draft for `production/milestone-plan.md`. It builds on the direction brief "Where Matt's head is at" (commits up to 39bb121), `production/studio-roadmap.md` (#1-14), `production/decision-log.md` and `docs/status.md`. Branch state was read from `m2-power` (879112e), `m2-economy` (5c20a14) and `m2-loopfire` (6ba335e). **Matt's direction outranks the studio's audit.** Disagreements are recorded in §6.*

## 0. The shape of it

Matt spent his last 9 days on four things: gross art, naming, sound, and pressure that changes the **shape** of fights. He checked that work with bots (48eb7cb, d0115f4). This plan does three things in order:

1. Close the accounting in M2.
2. Make the bots trustworthy (deterministic, able to reach bosses) before anything is retuned against them.
3. Put most of the remaining effort into what Matt was heading for: rank-shaped boss patterns (pacing.md §3.6), ALC (§3.5), a Drive that lands in his window, biome Maws, hell glimpses, and new uses for his sprite picks.

The Event Horizon "straight man" gets one beat in **every** content milestone (M3 to M5), so it can't all slip to v1.1.

**Release target:** v1.0 for Matt and friends: a Pages build plus a sideload APK with a stable key. It goes to itch only if Matt says so (D15). M1 is done (cb67b3e) but hasn't been played.

**Pipeline fact:** every push to main already ships. It deploys gh-pages and recreates the rolling `latest` debug APK (build.yml:73, :97, :115-124). Provisional studio calls (D3, D8, D11) therefore reach friends as soon as they merge. That is acceptable for this audience, and it is stated here so nobody assumes a separate release step.

| M | Name | One-line goal | Est. (solo + agents) |
|---|------|---------------|---------------|
| M2 | One power rule (close) + trustworthy instruments | Merge, re-measure, render/sim RNG split, stable signing, write docs to match the game, hell-flash A/B | 5-7 days |
| M3 | Fights change shape | Pressure module, rank-shaped patterns, ALC, Drive phases (the "door"); jump switch and boss harness scenarios; voice priority | 2-2.5 weeks |
| M4 | The Meridian's biomes | Acid and snot Maw attack sets with their own SFX (D11), remaining audio correctness, inverted-cross audit | 1-1.5 weeks |
| M5 | Glimpses of hell | Inventory, then a look-book, then Matt picks: hell glimpses, crew plead-then-burst, sprite picks, biomass sink, recordings | 2 weeks (time-boxed) |
| M6 | Hardening | Harness reaches midbosses, forks and biomes; perf enforcement and the 38 MB music load; bug backlog verified empty; opportunistic typing | 1 week |
| M7 | v1.0 release | Signing verified, LICENSE and credits, non-rolling v1.0 release, Pages-at-tag rule, checklists | 2-3 days |

---

## 1. Milestones

### M2 "One power rule": close it, and make the instruments trustworthy

**Drive numbers (corrected).** The draft's "Drive too short" finding compared figures from different instruments. There are three current numbers, and they can't be compared with each other:

| Instrument and kit | D1 Drive kill time | Source |
|---|---|---|
| `playtest.mjs` seeds 7/11, natural kit | 51 s | hub:117 |
| End-of-D1 kit | 32.0 s | pacing.md:163 |
| `boss-probe` STRONG kit | 14.3 s (9.8 s without rank terms) | m2-power `design/progression.md` §4 |

m2-power kept the Drive's rank and over HP terms (`driveMul` reads `$.G.rank`, depth.ts:48). They stay for now as a **logged fallback**. M3 targets replacing them with phase structure.

| Item | # | Owner | Size | Depends on | Gate |
|------|---|-------|------|-----------|------|
| Integrate the 3 branches; they touch disjoint src files. Must pass: `npm test`, `npm run build`, green CI verify/android/web jobs. Run `cadence.test.ts` and `fire-probe` on the **merged** branch to catch double scaling between depth.ts/spawn.ts and cadence.ts | #5, #9 | lead-programmer | S | none | none |
| Run `test:regress` on the merged branch. Either regenerate `harness.baseline.json` and explain every field change in the commit, or record that the 3600-frame gate never reaches M2 systems (baseline last set at ebec69d) | #1 | qa-lead | S | integrate | none |
| Full hierarchy review (specialists → leads → 3 directors), batched per milestone branch | CLAUDE.md | producer | S | integrate | Director block |
| Decision log: **D1 amended** (all three Drive numbers with instruments; HP terms kept as fallback); **D8 amended** to Matt's literal rule, no inverted crosses (hub:84, done in 145a0f0); **D3 marked provisional** on flash look and OFF content | none | producer | S | review | none |
| **Narrow RNG split:** move `makeHell()` and the ~106 `R()`/`rr(`/`ri(` draws in src/render and src/fx (10 files) to `srnd()` (src/sprites.ts:45); add a test that fails if any src/render or src/fx module draws from the sim RNG. Render draws consume the same seeded stream as the sim today, so the split **shifts harness `st` and the seeded `playtest.mjs` 7/11 runs once, by construction**. Re-baseline `harness.baseline.json` in that commit with a per-boss before/after. Proof it worked: afterwards, `st` is byte-identical between two harness runs that differ only in render paths (flashes ON vs OFF, or GROSS at two values) (TD sign-off fix) | #13 | engine-programmer | M-L | integrate | none |
| Split harness evidence into two classes: `st` sim fields are a strict gate; canvas `hashes` are re-baselined per art commit, with screenshots | #1 | tools-programmer | S | RNG split | none |
| Re-measure on merged main: the boss, midboss, depth, kind, pod and fire probes, plus `playtest.mjs` over 5 seeds (median with spread) and hits/min next to d0115f4's 1.1 | #6 | economy + level designer | S | split | none |
| Rewrite `docs/pacing.md` §2, README progression and stages (drop THE HULL/CORRIDORS and the 3-pod reward), and the CHANGELOG for 39bb121 + M2. Start from the merged text, because m2-economy already edits README and CHANGELOG | #6 | game-designer + writer | M | re-measure | none |
| **Direction one-pagers**, descriptive only and citing commits: art (his deliberate bitmap/code mix, 6a870f7), audio (the Void soundtrack, biome filter remixes, gross-generated SFX, family voices as comms; D16), canon (the existing strings only; D18). They are briefs so agents can imitate Matt, **never gates** | D16-18 | art-dir, audio-dir, narrative-dir | S | none | none |
| Creative-director proposes three edits to the game-brief Touchstone paragraph: "dread sets up, gross pays off"; the crew is present as bodies, remains, logs **and voices**; "the ship catches it too" (the hull pillar); plus the one restraint, no inverted crosses. Matt confirms | none | creative-director | S | none | Matt (light) |
| **Hell-flash A/B build:** 39bb121 render vs main (M1 replaced the per-frame `rr()` jitter and random inversion with a 10-step cadence), plus a variant that restores per-frame jitter within a glimpse while keeping ≤3 onsets/s, plus a proposed **non-flashing OFF** (hell image fades in and out at low alpha, no inversion). Pair it with a flashes-ON flash-rate trace | D3 | technical-artist + qa-tester | S | none | Q4 |
| Playwright evidence into `production/qa/evidence/m1/`: flash prompt, OPTIONS, save export/import | none | qa-tester | S | none | none |
| Bug and playtest loop. `production/qa/bugs.md` severities: **S1** crash, save loss, or APK won't install; **S2** unfair damage (unreadable, offscreen or rear hit, bullet under a wash), softlock, or HELL FLASHES not firing; **S3** tuning or visual; **S4** cosmetic. Playtest template in `production/qa/playtests/` holds 4-6 yes/no or 1-5 questions; Matt answers by voice or text and the studio transcribes. Each report records build hash, CI run number, device, and the bot numbers for that build | none | qa-lead | S | none | none |
| **Stable signing**, done in one commit: keystore plus the 4 `GRODIUS_*` secrets, the debug-vs-release build type decision, and a versionCode offset, so friends reinstall once. Do a guided export → reinstall → import on the Fold first. Keystore backed up outside the repo | #7 / D6 | devops-engineer | S | keystore | **Matt: keystore** |
| Desktop `perf-probe` (warm and cold) plus one rough Fold reading, as the pre-art baseline | D15 | performance-analyst | S | none | none |

**Exit:**
- Merged with `Studio review:`.
- Probes and bot numbers recorded with the commit hash.
- The RNG split is re-baselined once (an expected `st` shift) and proven: `st` is identical between flashes ON and OFF runs, and the no-sim-RNG-in-render test passes.
- The hub:117 Drive 51 s and d0115f4 1.1 hits/min figures are marked **pre-split references**. The M3 Drive and hits/min bands are judged only against post-split numbers.
- `pacing.md`, README and CHANGELOG describe the game as it ships.
- Merged main deploys green and the APK installs on the Fold.

**Matt plays (10 min on the Fold, M1 and M2 together; the report records the run number):**
- [ ] First launch and OPTIONS. Does the title still feel like his?
- [ ] Hell-flash A/B with flashes ON: old, new, or jitter-restored? With flashes OFF, does the proposed fade plus whisper still sell it? (Q4)
- [ ] One full descent: is the tune-pressure v2 fire fun or just mean? (Q1)
- [ ] During a heavy fight and a boss kill, did Matty's lines play every time? Does the game start with sound?
- [ ] Gravity Drive at D1: too long, about right, or a sponge? (Q3)

**Run by:** `/code-review`, `/balance-check`, `/playtest-report`, `/gate-check`.

### M3 "Fights change shape"

This is the payoff Matt wrote down next (pacing.md §3.6, "still to do", pacing.md:219, and §3.5), and the next step after 48eb7cb. **The order below is mandatory.** No shape term lands before the pressure module exists.

| Item | # | Owner | Size | Depends on | Gate |
|------|---|-------|------|-----------|------|
| `design/combat-rank.md`: shape table per boss at rank 0, 0.5, 1 and 2 (arms, fan width, speed, wait); ALC formula and constants; Drive phase mechanism; **readability budget** (bullet cap, speed cap, minimum telegraph at rank 1 + D3) | §3.5-3.6 | game-designer + systems-designer | S | M2 | Q2 |
| Dev jump switch `?at=&loop=&kit=`, plus harness boss scenarios at fixed rank (Maw, Drive, Crux, Butcher at D1 and D3) with baselines | #12, #1 | tools-programmer | S-M | none | none |
| Replace `every()`'s `e.t % n === 0` with per-entity countdown timers (a period that varies per frame double-fires or skips); rewrite `every.test.ts` | §3.6 | gameplay-programmer | S | spec | none |
| `src/enemies/pressure.ts`: the **only** reader of `G.pow`, `G.rank` and `G.perf` for enemy fire. Returns cadence, shape and density. depth.ts keeps depth constants and HP only. Unit tested, no `@ts-nocheck` | §3.6 | ai-programmer + systems-designer | S-M | timers | none |
| Shape terms on the Maw, Crux and Butcher (through pressure.ts), with an **audible tell** per shape change and tests in the same PR | §3.6 | ai-programmer + sound-designer | M | module | none |
| Drive timer refactor (boss/update.ts, 330 lines of its own timers) into phases or guarded windows. A late phase is **"the door"**: hell bleeds through the gate via `hellFlash` and `makeHell` (no new system). Check that the `void-13-finale` arc and loop fit the longer fight | hub:117 | level-designer + gameplay-programmer | M | module | **Q3** |
| ALC **last**: `G.perf` EMA ±0.15, 10 s breather after a death. perf is read only by pressure.ts. Tests: `driveMul` is invariant under perf, and the perf trace is deterministic | §3.5 | systems-designer | S-M | Drive | Q2 |
| `playtest.mjs` damage mode or scripted death, so the ALC breather can be measured; perf trace; `fire-probe` reports bullets on screen, speed and telegraph | #8 | tools-programmer | S | none | none |
| Voice priority in `sample()`: voice categories (hype, babe, bossreward, corpsevoice, startgame) are never culled; steal the oldest splat instead (audio.ts:127). Add an RNG-neutral `audio-probe` that counts culls per category | #10 (part) | audio-programmer | S | none | none |
| Help text for escaped bosses, written against the **merged** m2-economy rule (pays 0, counts toward seals), not §4.5's wording | none | writer | S | M2 | Matt picks wording |

**Exit.** Every window names its instrument. Each band below is a studio default; Matt's M2 answers can move them.

- **Drive:** `playtest.mjs` seeds 7/11, natural kit, median **30-45 s**, AND `boss-probe` STRONG **≥ ~20 s** with `driveRank = driveO = 0`. If both pass, delete the HP terms (D1 restored). If not, keep them as the logged fallback.
- **Midboss and biome-boss windows:** 8-15 s and 12-25 s (pacing.md:336-340). Other bosses: current probe ±20%.
- **Hits/min:** 0.9-1.4, median over 5 seeds.
- **Readability:** within budget at rank 1 + D3.
- **ALC:** swing visible in the trace and ≤ ±0.15.
- **Pods:** `pod-probe` rate per biome reported (ALC changes formation size).
- **Audio:** `audio-probe` shows 0 voice-category culls.
- **Harness:** baseline move explained.

**Matt plays:**
- [ ] Strong build and naked build: do the bosses *look* different at high rank?
- [ ] Any death you couldn't read or dodge?
- [ ] Die once: does the breather register without feeling like charity?
- [ ] Drive: did it feel like the door, and like you'd earned the power, not like a sponge?

**Run by:** `/prototype` (ALC spike), `/team-combat`, `/balance-check`, `/playtest-report`, `/gate-check`.

### M4 "The Meridian's biomes"

The bosses are **already named by Matt**: THE DISSOLVED MAW / THE DISSOLVING WOMB, and THE MUCUS MAW / THE BROOD MOTHER (src/biomes.ts:45,68). M4 adds new attack sets to the shared Maw body (D11). Throughout, agents propose and Matt picks every new player-facing string.

| Item | # | Owner | Size | Depends on | Gate |
|------|---|-------|------|-----------|------|
| Acid Maw (`lob()` geysers) and snot Maw (litters plus slowing strands), rank-shaped through pressure.ts. They should read as the ship digesting you (machinery gone organic) | #14 | level-designer + gameplay-programmer + technical-artist | M | M3 | D11 (provisional) |
| SFX for each attack and death roar, built with Matt's generators (`gen_bossgross_sfx.py`, `gen_gross_sfx.py`) and shipped **in the same commit** as the attack; check the biome music filter slot | #10 | sound-designer | S-M | attacks | none |
| Kill banners for the new attacks: a proposal list Matt picks from | none | writer | S | attacks | Matt picks (not a gate) |
| Remaining audio correctness: browser TTS sets `en-US` (audio.ts:721), hype caption wiring (fx/update.ts:237-248), game-time scheduling, saved mute | #10 | audio-programmer | S | none | none |
| Inverted-cross **audit only**, expecting zero edits. UNCRUCIFIED (enemies/update.ts:739), the crucify remix copy (biomes.ts:38) and HALO RIPPLE (shipparts.ts:391) stay | #11 / D8 | writer | S | none | Q5 (confirm) |
| One noun per system: a **proposal list** for Matt (mutations, perks, grafts, contraptions; KEYSTER vs KEISTER). Nothing gets renamed | #11 | narrative-director | S | none | Matt picks |
| String guardrail (a review note, not a gate): no grammar concatenation, and one screenshot per new card or banner (wrapTxt drops lines past 4) | none | writer | S | none | none |

**Exit:**
- Each biome boss can be recognised blind from a `biome-tour` screenshot.
- Enemy bullets stay above every new effect (screens.ts:474 rule).
- Banners fit the biome palette.
- The new attacks are audible.
- `audio-probe` shows 0 voice culls across seeds 7/11 at D1-D3.
- TTS speaks English on a non-English locale.

**Matt plays:**
- [ ] One acid run and one snot run via `?at=`. Do they read as the ship eating you?
- [ ] Pick the banners.
- [ ] Ear check: any lines missing?

**Run by:** `/team-level`, `/team-audio`, `/team-narrative`, `/design-review`, `/playtest-report`.

### M5 "Glimpses of hell" (Matt picks; the studio supplies defaults)

The flow is **inventory → look-book/picker (2-4 pre-selected options per slot, in the style of the f6fa99a picker) → Matt approves or changes.** Matt chooses from options; he never has to write briefs from scratch.

| Item | # | Owner | Size | Depends on | Gate |
|------|---|-------|------|-----------|------|
| Inventory of the existing crew and hell content: biome decor (hub:42-45), gambrel carcasses, zombie-crew corpses (6a870f7), the corpse plea (145a0f0), `hellFlash` call sites, biome logs | none | narrative-director | S | none | none |
| Sync `assets-raw/upgrade/upgrade-choices.json` and the leftover picks from the Windows box (the folder is gitignored and not on this laptop) | none | Matt / technical-artist | S | Matt | **Matt** |
| Look-book: hell-glimpse frames, corridor crew, **new uses** for the picks he left out (Alien Boss Set, TM ships, horned skull) | none | art-director | M | inventory | Q7, Q9 select |
| Crew plead-then-burst, built on the existing corpse plea and crew decor (no new system) | none | writer + gameplay-programmer | S-M | inventory | Q8 (rec. yes) |
| Option for Q7: deadpan log ladders per descent and remix (b1179cc) | deferred | writer | S | none | Q7 |
| Biomass sink after the Infirmary. Options: (a) cosmetic hull mutations, each with look **and** sound (46e7746), M-L, readable at 14-30 px; (b) one-run mutation picks; (c) nothing | D5b | economy-designer + art + sound | M-L | M2 | **Q10** |
| New Matty/Lesley recordings, using the **existing 20 s hype cooldown** (145a0f0) | #10 / D9 | sound-designer | S | recordings | Q11, D7 |
| GROSS knob stays **internal** and only trims excess (1f2dcc9) | D13 | technical-artist | S | none | Q6 |

All new art uses `srnd()`, prebuilds at idle, and passes `perf-probe` WARM_MS (the dc6baef/dba41c0 lessons).

**Exit:**
- Every picked option is in the game or marked cut.
- The sink exists or is decided as "nothing".
- New lines are captioned.
- Harness `st` is unchanged by the art commits.
- Desktop perf is within the M2 baseline.

**Matt plays:**
- [ ] Two descents: does the hell land, is it gross enough, does the crew read?
- [ ] Do the logs still play straight man while the gross lands?
- [ ] Spend biomass after the Infirmary buy-out (the save now persists).

**Run by:** `/team-polish`, `/team-narrative`, `/team-audio`, `/asset-audit`, `/playtest-report`.

### M6 "Hardening"

| Item | # | Owner | Size | Depends on | Gate |
|------|---|-------|------|-----------|------|
| Harness extended to a midboss, a fork and a biome | #1 ext. | tools-programmer | M | M3 jump switch | none |
| RNG lint confirmed clean; one final baseline (sim plus hashes) | #13 | engine-programmer | S | M5 | none |
| Fold perf: pow 2 at D3+, 60 fps / 16.7 ms, cold and warm on new boss scenes (the 576 ms Drive hitch class, hub:90); set `performance.enforce` | D15 | performance-analyst | S | none | Reference device |
| First load of the 38 MB `src/music` payload on Pages and the Fold: lazy-load or bitrate decision | D16 | audio-programmer + devops | S | none | none |
| Bug backlog **verified** empty of S1/S2. Triage runs from M2 onward: each playtest's S1/S2 bugs are fixed or deferred with a reason before the next milestone starts | none | qa-lead | S | loop | none |
| Typing: new modules are already typed; hot files are typed opportunistically. **First cut** if time runs short | deferred | lead-programmer | S-M | none | none |
| `resolvePlayerDamage()` + WARD | deferred | gameplay-programmer | M | D12 | **D12**, else defer past v1.0 |

**Exit:**
- Harness covers boss, midboss, fork and biome.
- The Fold holds at D3.
- No open S1/S2 bugs.

**Matt plays:**
- [ ] A 15-minute regression run on the Fold.

**Run by:** `/team-qa`, `/perf-profile`, `/soak-test`, `/regression-suite`, `/bug-triage`.

### M7 "v1.0"

| Item | # | Owner | Size | Depends on | Gate |
|------|---|-------|------|-----------|------|
| `apksigner` verified across 2 builds; install over the previous signed build on the Fold and check that the save survives; `/smoke-check` | #7 | devops-engineer | S | M2 signing | none |
| LICENSE at the root (none exists today); voice-performer line in CREDITS.md; title-screen credit line | #11 / D7 | release-manager | S | none | **D7** |
| Release mechanics: v1.0 git tag; a non-rolling `v1.0` GitHub release (separate from `latest`); a Pages-at-tag rule (deploy on `v*`, or main frozen until v1.0.1); README tells friends which link to use; build stamp | deferred | devops-engineer | S | none | none |
| README re-sync; content warning adds STRONG LANGUAGE, with a screenshot text-fit check (screens.ts:133) | #6 | writer | S | none | none |
| Patch notes compiled from CHANGELOG via `/patch-notes`. Release and launch checklists, 1 page each, for friends + Pages. Flag rating/locale exposure if D15 changes | none | release-manager | S | all | D15 |

**Exit:**
- v1.0 tag, an immutable release with the signed APK, and Pages built at the tag.
- The save survives an update.
- Credits are complete.
- Both checklists are green.

**Matt plays:**
- [ ] Update over the previous build.
- [ ] Credits read right.
- [ ] One full run, then sign-off.

**Run by:** `/team-release`, `/release-checklist`, `/launch-checklist`, `/smoke-check`, `/gate-check`.

---

## 2. Missing studio practices: where each lands

| Practice | Lands in | Tie to Matt |
|----------|----------|-------------|
| Playtest reports | M2 onward. Transcribed from his voice or text notes, paired with bot numbers for the same build | He measures rather than going by feel |
| Bug triage (S1-S4; fairness = S2) | Set up in M2, runs every milestone, verified in M6 | He fixes fairness bugs on sight |
| Art, audio and canon direction | M2, one page each, **descriptive, never gates** | Briefs so agents imitate him (6a870f7, d45d31d, ~20 strings) |
| Deterministic instruments (RNG split, harness classes, boss scenarios) | M2-M3 | Bots are his instrument (32c0350) |
| Perf baseline | Desktop at every exit; Fold reading in M2; enforced in M6 | The Fold is where he plays |
| Stable signing | M2 | Saves survive his playtests |
| Accessibility | Flashes (M1, plus the non-flashing OFF in M2); touch targets (D14) in M6 | No proactive a11y appetite; bullets stay sacred |
| Localization | None. D15 English-only is already decided (decision-log:44) | Brief §5 |
| Typing | New modules typed; the rest opportunistic | Kept off his path |
| Licensing (D7) | Consent asked now; LICENSE in M7 | Family voices |

## 3. Critical path

`M2 merge → RNG split + re-measure → M3 spec → timers → pressure module → shape terms → Drive phases → ALC → M4 Maws → M5 picks → M6 harness ext + perf → M7 tag`

- **Parallel from M2:** signing, perf baseline, direction one-pagers, bug loop, and the jump switch plus voice priority (early M3).
- **Matt answers re-scope work but never stall it.** Studio defaults are given in brackets.
- **Hard Matt dependencies:**
  - Keystore (M2 signing)
  - D7 consent (M7 credits)
  - Assets-raw sync (M5 picks)
  - Q10 (sink form)

**Front-loaded questions (asked at the M2 playtest; defaults in brackets):**
1. **Q1/Q4:** Tune-pressure v2 feel, and which hell-flash variant plus the OFF behaviour. [Keep v2; jitter-restored variant; non-flashing fade for OFF.]
2. **Q2:** Is §3.6/§3.5 next? [Yes, as M3.]
3. **Q3:** Drive. [Phases to 30-45 s; delete the rank HP terms if both instruments pass.]
4. **Q5:** No-crosses. [No change, done in 145a0f0; UNCRUCIFIED, crucify copy and HALO RIPPLE stay.] One confirmation line.
5. **Q6:** Gross dial and audience. [Internal only; friends.]
6. **Q7-Q11:** M5 picks from the look-book. [Q8 yes; Q10 offered as a/b/c.]
7. **Q11 / D7:** Lesley's "yeah baby" has been **public since 0072992 (10-07)**. Is that OK? A "no" means removal plus a history decision, not just an M7 gate.

## 4. Sizing sanity check

- **Total:** about 8-10 working weeks. At Matt's pace (late-night bursts, parallel worktrees merged the same night), M2-M4 is about 4 weeks of evenings.
- **M3 is the big one** (countdown timers, pressure module, the 330-line Drive refactor). Plan for 2-2.5 weeks with its buffer used up. **Don't cut the module to save time**; that is how the m2-loopfire double-scaling bug was born.
- **Hierarchy review costs about 0.5 day per merge.** Batch reviews per milestone branch. One-file typing PRs are rejected for this reason.
- **Matt bottleneck:** each milestone needs a 10-15 minute Fold session, with screenshots and traces prepared in advance. At most two unplayed milestones; **don't start M4 with M3 unplayed.**
- **M5** is time-boxed to 2 weeks. Overflow slips to v1.1, but the M3 "door" and M4 "digesting" beats keep the straight man in v1.0 regardless.
- **Buffer:** 20% per milestone. The first cuts are M6 typing and WARD (D12).

## 5. How this follows Matt's direction

- **His next thing comes next:** M3 is §3.6/§3.5. Rank changes shape, never toughness. perf never reaches HP, and the Drive aims to drop its HP-from-rank (48eb7cb).
- **Measure, not feel:** the instruments are made deterministic and boss-reaching *before* they're used for retuning. Every exit band names its tool and kit.
- **Fair but brutal:** a readability budget and fairness defects ranked S2.
- **His calls stay his:** names, banners, nouns, the crosses rule and the flash look. Agents propose; Matt picks.
- **Look, sound, gross:** every new attack ships with its own SFX. Family voices are protected from culling. The 20 s cooldown is his.
- **Process stays light:** direction docs describe him and never gate him. No TAME build. No i18n.

## 6. Recorded disagreements: roadmap and draft vs Matt's direction (Matt wins)

| Topic | Roadmap / studio | This plan | Source |
|-------|------------------|-----------|--------|
| What follows M2 | Biome bosses, copy, audio | Rank-shaped patterns + ALC; biome Maws move to M4 | pacing §3.5-3.6; 48eb7cb |
| Drive rank HP | D1 remove; draft "keep for now" | Phases in M3; HP terms deleted if both instruments pass; logged fallback | 48eb7cb; 46e7746; hub:117 |
| D8 no-crosses | All cross and halo imagery; draft "text only" | Inverted crosses only, already done. Rack (de-crossed in 145a0f0), UNCRUCIFIED and HALO RIPPLE untouched | hub:84; biomebosses.ts:407 |
| D3 HELL FLASHES | Rate limit plus fixed cadence; OFF removes the image | A/B against 39bb121; jitter-restored variant; non-flashing OFF proposed; D3 provisional | `git diff 39bb121 cb67b3e -- src/render/hell.ts` |
| D13 gross dial | Player-facing TAME considered | Internal only | 0e1ca06→665c94d |
| Art bible, canon, audio note | Late deliverables | Early, descriptive, never gates | 6a870f7 |
| Biome boss naming | Draft gated M4 on Matt naming | Already named; banners only, offered as picks | biomes.ts:45,68 |

---

## Review log

- **game-designer**, approve_with_changes. Accepted: combat-rank spec first; one pressure helper; perf never feeds HP (with a test); Drive default switched to phases with named instruments; all three Drive numbers in D1; readability budget; pod-probe; fairness and "sponge" playtest questions; default hits/min band; help text on the merged rule; Q10 as a/b/c.
- **lead-programmer**, approve_with_changes. Accepted: full build gate plus harness step at merge; countdown-timer refactor; Drive refactor sized separately; ALC last; new modules typed; RNG split moved to M2 with no harness dependency; Fold baseline moved to M2; one-file typing PRs dropped.
- **art-director**, approve_with_changes. Accepted: hell-flash A/B with the jitter variant; D3 OFF made provisional; the rack correction; Q9 reworded as new uses; assets-raw sync; look-book default; srnd and idle-prebuild for new art; M4 readability and palette exits; sink sized M-L. **Rejected:** the Q5 HALO RIPPLE question (the creative-director endorsed "no change").
- **audio-director**, approve_with_changes. Accepted: voice priority and audio-probe moved to M3; exit rewritten as 0 voice culls; Maw SFX in the same commit; audible tells; Drive music check; ear-check playtest bullets; 20 s cooldown kept; D16 note descriptive; 38 MB music in M6.
- **narrative-director**, approve_with_changes. Accepted: the naming gate removed (bosses already named); Q5 default "no change, 145a0f0"; glossary as a proposal list; "agents propose, Matt picks" applied to all copy; inventory first; plead-then-burst on the corpse plea (S-M); log ladders as a Q7 option; canon records strings only; D8 amendment logged.
- **qa-lead**, approve_with_changes. Accepted: jump switch and boss harness scenarios in M3; harness step at merge; S1-S4 definitions; transcribed playtests; M1 evidence screenshots; flash-rate trace; 5-seed median bands; tests in the same PR; determinism test; bot damage mode; running triage; save test. **Changed:** the RNG split goes ahead of harness coverage (the technical-director overruled); hits/min band 0.9-1.4 per the technical-director.
- **release-manager**, approve_with_changes. Accepted all: signing, build type and versionCode moved to M2 in one commit; non-rolling v1.0 plus a Pages-at-tag rule; consent framed as "already public"; auto-ship stated; keystore backup; 1-page checklists; patch notes from CHANGELOG.
- **localization-lead**, approve. Accepted: en-US TTS exit, English-only row in §2, string-fit guardrail, text-fit check on the content warning.
- **creative-director**, approve_with_changes. Accepted all: an Event Horizon beat in M3 (the Drive as "the door") and M4 (digesting); direction docs early and descriptive; the Touchstone paragraph edits proposed to Matt; the non-flashing OFF; touchstone questions in playtests; the Q5, naming, look-book and Drive resolutions; Q8 recommended yes.
- **technical-director**, approve_with_changes. Accepted all: RNG split at M2 end (re-baseline once, lint, makeHell moved); harness `st`/hash split; `pressure.ts` as the only rank reader; `G.perf` separate from HP; the Drive dual-instrument rule; audio-probe must not consume RNG; music first-load and cold/warm perf; signing in M2; release semantics.
- **No blocks remain.** Unresolved items are escalated as Matt decisions in §3 and in the blocker list.
- **technical-director sign-off block, resolved 2026-10-31**: the RNG split expects a one-time `st` shift and re-baseline (render draws share the seeded stream), sized M-L (~106 draws in 10 files), with render-path invariance (flashes ON vs OFF) as the proof; the pre-split Drive 51 s and 1.1 hits/min figures are marked as references. Applied to the M2 item and exit.
