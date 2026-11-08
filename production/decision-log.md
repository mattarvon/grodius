# Decision Log

Project-level decisions for Grodius: open questions only Matt can settle, and what
was decided. Source of the open list: `production/studio-roadmap.md` §3 (studio
onboarding, 2026-10-31). Per-session autonomous-mode decisions go to
`production/session-logs/decision-log.md` (gitignored) — this file is the durable
record.

Fields follow the framework's decision-log format (`.claude/docs/effects-map.md`,
"Decision log format"). An OPEN entry has no **Chosen** yet. When one is decided,
fill **Chosen**, **Reason** and the date, and move it to "Decided".

---

## Decided

### D5 Framework adoption — 2026-10-31

**Decision point:** How to apply Claude Code Game Studios to an engine-less TypeScript game.
**Options considered:** fork every skill for a fourth engine; configure an engine-less profile through `project.yaml` (roadmap §4).
**Chosen:** Roadmap §4 settings — `modes.rigor: minimal`, `modes.automation: guided`, `testing.strict` logic-only, `engine.name` unset with `specialists` → `web-specialist` and explicit `commands`, typed in-code tuning tables instead of external config, screenshot evidence advisory. Unit tests run on **vitest** (`npm run test:unit`, `tests/unit/*.test.ts`) instead of `node --test`: `src/` uses extensionless TS imports that plain Node cannot load, and vitest reuses the Vite pipeline.
**Reason:** Matt, 2026-10-31: "apply the framework to Grodius, make it great."
**Category:** schema_changes

### Delegated batch — 2026-10-31

Matt, 2026-10-31: "do it all and commit to the main and let me play it when we get to certain milestones."
Claude took the studio's recommended option wherever the roadmap named one, and a conservative option elsewhere.
Each is **provisional until Matt plays the milestone it ships in** — overrule any of them and it gets reverted.
Not decided (Matt only): D7 licensing/consent, D9 recordings, D12 WARD, D13-D14, D15 distribution (except
localization), D16-D18, and the signing keystore half of D6.

| ID | Chosen | Milestone |
|----|--------|-----------|
| D1 | Power shows up as enemy fire and density only; HP comes from depth (and loop) alone. The Gravity Drive loses its rank HP term too, unless boss-probe shows its fight collapsing. | M2 |
| D2 | All perks and bolted contraptions count toward power from Descent 1 (one weight table). Drone `(1+loop)` double scaling removed. pow-2 fire compression kept. | M1 (drone), M2 |
| D3 | Flashes stay ON by default but a first-launch prompt asks; OFF removes white/red washes, glitch tear and flicker entirely; a ≤3 flashes/s limiter applies in both modes. | M1 |
| D4 | A red `verify` blocks both Pages and the APK. `workflow_dispatch` still exists for manual builds. Work commits straight to main (Matt's call), gated locally by `npm test`. | M1 |
| D5b | DESCEND DEEPER keeps the run-wide double pay but is described honestly as a Descent 2 start. An escaped boss pays no biomass (matches README) but the stage still counts toward seals. Grade pay and the biomass sink are left for a later pass. | M2 |
| D6 | Save hardening plus save export/import ship first; the stable-signing switch waits for Matt's keystore. | M1 |
| D8 | No-crosses covers all cross and halo imagery on player-facing surfaces; logs and stage cards stay deadpan. | M3 |
| D10 | Daily seeds and replays are not a goal; the RNG split is hygiene, done only where it serves the harness. | — |
| D11 | Shared Maw body with biome-specific attack sets for acid and snot. | M3 |
| D15 | Localization: English-only for now. | — |

**M2 amendments (2026-10-31, studio review of the integrated branch):**
- **D1:** the Gravity Drive keeps its rank/over HP terms as the one documented exception. Without them a stacked Descent 1 build kills it in 9.8 s (boss-probe; `design/progression.md`). M3 replaces them with phase structure if both instruments pass (milestone plan Q3). The loop HP weights absorbed the old `over()` term (fodder/mid .8→1.12, boss 1.1→1.5), so light builds and DESCEND DEEPER starts pay ~+18% HP at Descent 2 while typical builds hold. To be measured in the M2 re-measure (bare and rigged kits).
- **D2:** cooldowns are centralised in `src/enemies/cadence.ts`, but **Matt's per-kind depth curves (cb50d04) are kept exactly**. The first pass dropped them and softened Descent 3 fire by ~22%. The creative director blocked that as beyond D2's mandate. Whether deep fire should be softer is offered to Matt in the art-direction picker ("deep fire").
- **D5b:** DESCEND DEEPER's final wording is offered to Matt in the picker (variants that keep "pays double"); the code ships the honest interim text.

---

### D19 Content scale — 2026-11-01 (Matt)

- **Phone:** the game no longer has to be catered to phone sessions, but it must stay playable on a phone (touch controls, readable at phone size, holds frame rate on the reference device).
- **Stage length:** ~90–120 s per stage, classic Gradius length (was ~35 s). A mid-stage checkpoint follows from this.
- **More levels:** all three kinds: new biomes, more stages per descent, and ship-interior stages (non-biome, like Open Orbit and the Drive).
- **Mini bosses:** a pool of 3–4 per biome; a long stage meets two different ones, and repeat runs meet different ones.
- **Supersedes:** game-brief Pillar 4's "phone-sized, about 35 s stages" and the pacing.md stage-length targets. The "never the same twice" half of the pillar stands.

### D19-Q19 Old best grades — 2026-11-01 (default; Matt to confirm)

- Save v3 (LS1-H0) applies spec Q19's recommended default: best grades move to stage-kind keys (`1-orbit`, `1-ice`, `1-drive`); v2's `N-1` becomes `N-orbit`, `N-4` becomes `N-drive`, and the biome-slot grades `N-2`/`N-3` leave `meta.best`.
- **Reversible:** the dropped slot grades are kept in `meta.bestV2` (written, never read), so a different answer to Q19 can still restore them. Asked for by the game-designer in the H0 Studio review; Matt chose "keep them in bestV2" on 2026-11-01.
- Player-visible: a returning player's next clear of a biome stage reads FIRST CLEAR. Carried as a CHANGELOG line when H0 reaches main.
- **Removing `bestV2`:** owner lead-programmer. Trigger: Matt confirms Q19 at the LS1 playtest (build plan item L); then a save v4 drops `meta.bestV2` (or maps it, if he answers otherwise). Caveat: reverting `main` to a build from before H0 drops `meta.bestV2` and `meta.mb` on that build's next save, the one way this stops being reversible.
- **Backlog (not an H0 regression, found in its review):** older load code in `src/save.ts` coerces imported values with `+` (`+d.hi`, `+(d.meta.bio)`, `+(m.cl[id])`) and spreads `d.meta.lv` unchecked; an imported object there can throw mid-load like S3 did. Owner: a later save-hardening pass (engine-programmer).

### D20 LS1-A layout table: rulings — 2026-11-01 (studio review; Matt approved running it)

**Decision point:** Three questions the layout table (`src/layout.ts`, branch `ls1-a`) raised against spec `design/content-expansion.md` §2.2/§3.2.
**Chosen:**
- **The DRIFT forced-exit rule is measured to the next WARNING the player sees** (a miniWarn banner, a row's `warnX` banner, another drift's WARNING), not to the later `G.mini` write. Game-designer ruling; spec wording stands. `tests/unit/layout.test.ts` measures it that way, breath WARNINGs included.
- **The `short` layout keeps its gaps as pinned legacy exceptions**, because it must stay byte-identical:
  - the Saucer's exit is 220 px before "SOMETHING IS COMING" (about 3.7 s);
  - repeat-visit set pieces are 158.9 px and 38.8 px after the breath with the gate taken early;
  - with the gate taken late they are 144.9 px, 280.0 px and 0.0 px.
  - In play, the slot-1 repeat-visit set piece fires within a second of the midboss kill, with no release beat.
  - The pins are known short-layout debt. Matt may ask for a separate short tune story; otherwise `short` is deleted one milestone after the long flip.
- **Beat invariants are checked at both the earliest and the latest gate** (`gateLate` per biome row). Long entries are authored against the late case.
- **hellFlash re-key is neutral:** `layout().hell` is its own kind-keyed table. In `short` it equals the AMT corr/core curves (pinned bit for bit). Real per-kind values come with the long rows (items D/E).
- **Scope deviation:** row A's `perks.ts:48` (`stageXP`) was not re-keyed. It moves to G0/G, which own the economy and list `perks.ts:48`.
- **The parity check stays a manual pre-merge gate** (about 7 min with its third-descent and mortal-bot runs), not a CI job. It is required for any lane touching layout, stages, biomes or scripts. A lane that moves the RNG re-records the baseline with `--update` in the same commit and explains it.

**Reason:** Studio Hierarchy review of LS1-A (3 specialists, 8 leads: all APPROVE WITH NOTES). Evidence: `production/qa/evidence/ls1-a.md`.
**Category:** design_rules

### D21 Short-layout tune — 2026-11-01 (Matt)

**Decision point:** Tune the `short` layout's known pacing debt (D20: no release beat after a slot-2 repeat-visit midboss; the Saucer leaves about 3.7 s before "SOMETHING IS COMING")?
**Chosen:** No. `short` stays byte-identical until it is deleted one milestone after the long flip; the long layouts build in the Release beat (spec §3.2).
**Reason:** Matt, 2026-11-01: "no".
**Category:** design_rules

### D22 long4 Open Orbit length — 2026-11-02 (Matt)

**Decision point:** Lane E measured long4's Open Orbit at 3600 px on 65-66 s for every seed, under the LS1 band of 75-90 s: the drifting Saucer never holds the scroll. Lengthen it, or keep the spec's 3600?
**Chosen:** 4380 px (`src/layout.ts:186`). With E's content it measures 76-80 s. The spec's §2.2/§3.4 lengths and §3.2 breaths are amended to match. The `long5` Orbit is re-derived at LS3-0, not assumed to be 4380: a held midboss there holds the scroll.
**Reason:** Matt accepted the recommendation (sprint 2 studio review).
**Category:** design_rules

### D23 LAB row ships visible — 2026-11-02 (Matt)

**Decision point:** The LAB row on the title screen (`src/menus.ts:58-61`) lets any Pages or APK player switch to the unfinished `long4`. Hide it, or ship it visible?
**Chosen:** Ship it visible. The default stays `short`, and the LAB is how the APK reaches `long4` for playtests (`src/lab.ts`). Its labels are dev copy, not reviewed copy (D8).
**Reason:** Matt, sprint 2 studio review.
**Category:** release

### D24 Long is the default layout — 2026-11-02 (Matt)

**Decision point:** Flip the default from `short` to `long4` now, ahead of the sprint 3 closeout?
**Chosen:** Yes. With no `?layout=` flag and no LAB key, a run flies `long4` (`src/lab.ts` `DEFAULT_LAYOUT`, applied at boot). `short` stays reachable through the LAB and `?layout=short` until it is deleted. The harness and the parity tool pin `?layout=short`, so their baselines stay the short layout's.
**Accepted open items** (Matt chose this over waiting): one midboss per stage (slot B and the held Orbit midboss are sprint 3 F / LS2); biome spawns about 1.3x against the spec's 1.7x and the Drive fight 38-51 s (item G); 8 draft log lines and dev-copy LAB labels (D8 writer's pass); provisional `hell` and `hudMarks` art. The creative-director's sprint 2 note (not acceptable "once long becomes the default") is overridden by Matt.
**Reason:** Matt, 2026-11-02: "this long looks good to merge into the main".
**Category:** design_rules

### D25 Screen-space blood splats removed — 2026-11-02 (Matt)

**Chosen:** `splat()` and the biome bosses' lens splats are off (`src/fx/spawn.ts` `SPLATS_ON`, `src/render/gross/biomebosses.ts` `LENS_ON`). World gore stays.
**Reason:** Matt: "it disturbs gameplay".
**Category:** art

### D26 S grade and extra lives for long4 — 2026-11-02 (Matt)

**Decision point:** Spec Q9 (S grade on ~2-minute stages) and Q11 (extra lives), before LS1 item G wires the `long4` economy while long is the default (D24).
**Chosen:** Q9: S needs ≤ 1 hit and 0 deaths, with a length-normalised hit penalty clamped so a stage shorter than 35 s never grades harder than today. Q11: not on `long4`; Q10-Q12 stay with `long5` at LS3-0.
**Reason:** Matt took both recommendations (sprint 3 kickoff).
**Category:** design_rules

### D27 Midboss TTK bands per kind, not per slot — 2026-11-02 (Matt; from the LS1-F studio review)

**Decision point:** LS1-F's `midboss-probe` evidence (STAGE 1 kit: Choir 10.0, Womb 8.7, Apprentice 6.8, Brood 9.4 s) meets spec §6.2's slot-B band (10-15 s) only for the Choir. With D1 (HP only from depth) and the picker putting any kind in either slot, slot B can never be slower than slot A at the same kit.
**Chosen:** Replace the per-slot bands with one band per kind, **8-11 s at the stage-1 kit**, tuned by each kind's base HP. DRIFT kinds are exempt (their forced exit sets the fight length). Spec §3.1's median "Midboss B 12 s" becomes ~10 s; slot B's longer 1260 f clock is its only slot difference. The Apprentice (6.8 s) moves to ~200 HP (~9.1 s), in G or a P0 follow-up, not F. If base HP is shared with `short`, that change either is gated per layout or moves the parity baseline with the reason given.
**Reason:** systems-designer recommendation, accepted by the game-designer lead, **confirmed by Matt 2026-11-02**. No per-slot HP term, so D1 needs no new ruling. Owner: an LS1-F follow-up (Matt); G declined it as not economy.
**Done 2026-11-03 (branch `ls1-f-d27`):** `src/midslot.ts` `MID_HP` sets the Apprentice to 200 base HP on picker layouts only, so `short` keeps 150 and layout parity holds. midboss-probe (long4, `--leave 1080`, STAGE 1 kit) puts it at 10.2 s, in the band. Spec §3.1 and §6.2 are updated to match.
**Category:** balance

### D28 Quit-to-resume undo accepted as known — 2026-11-03 (Matt; from the LS1-H studio review)

**Decision point:** with H's resume point, quitting (ABANDON SHIP or an app kill) and pressing RESUME puts you back at the last checkpoint. Under option a, the default (and long is the default layout, D24), that gives back the checkpoint's lives. Under LAB option b, it is a free undo, cheaper than a death. An app kill and a rage-quit can't be told apart.
**Chosen:** accept it as a known exploit for now. No resume cost and no dirty flag. Revisit if playtests show players doing it. The fallback options stay on record: a resume after a quit costs a life, or the spec §4 dirty-flag mitigation.
**Reason:** single-player, no leaderboards; surviving an app kill matters more on a phone (creative-director). **Confirmed by Matt 2026-11-03.** Q2 itself (a or b) stays open; the ABANDON SHIP wording was settled by D34 (SURFACE). Same class, noted at the LS1-G review: a resume to before a first kill loses that +100 from the run's `G.bio` (the profile keeps it).
**Category:** design

### D29 Midboss HP is exempt from intra-descent depth — 2026-11-03 (Matt; raised by lane G)

**Decision point:** G wires spec §7's intra-descent depth (`dep = loop + 0.35 × ord/(N−1)`, N = 4 on long4) into `depthHP`. Applied to midbosses, it adds ×~1.13 HP in a biome stage's slot A and ×~1.26 in slot B, even in Descent 1. That pushes D27's single 8-11 s band out: an estimated Choir 11.3 / 12.6 s, the Apprentice ~226 / ~252 HP, and the Womb and the Brood long in slot B.
**Chosen:** option (a). **Midboss HP uses the integer loop only**; the intra-descent term doesn't apply to it. D27's one band per kind holds in either slot. Not chosen: (b) re-band per slot, which reintroduces the slot difference D27 removed; (c) lower the base HPs.
**Scope:** midboss HP (`depthHP` for `mid` kinds) only. Regular enemies keep intra-descent depth. Midboss fire rate and cooldowns (`firem`, `cdm`) are unchanged by this ruling. Stage bosses aren't covered.
**Reason:** keeps D27 (Matt, 2026-11-02) intact with no re-tuning; the probe figures stay valid. **Confirmed by Matt 2026-11-03.** Owner: lane G (it implements intra-descent depth), with a midboss-probe check of slots A and B on its branch.
**Category:** balance

### D30 S2-K1 perf: carry into LS2, judged by the Fold reading — 2026-11-06 (Matt; from the LS1 I+K studio review)

**Decision point:** p95 at 4× throttle misses 16.7 ms in every "midboss + 8" scene (24.8-36.2 ms) and on real long4 flights (30.1 / 37.4 ms). The cost is CPU-side: `drawGibs` 22%, `flushLo` 15%, `drawBG` 7% (`production/qa/evidence/ls1-k.md`). Row K and the LS1 exit allowed a miss as an S2 bug only "while the long layout is behind the flag", and since D24 it isn't.
**Chosen:** option (a). S2-K1 stays an open S2 bug carried into LS2. It is judged by Matt's Fold reading against the short-layout Fold baseline, not by the absolute 16.7 ms, which stays with D15/M6. The named fix (bake gibs to sprites, then cut `drawBG`/`flushLo`) is LS2 work. Not chosen: (b) make the fix an LS1 exit requirement; (c) revert the default to short until the Fold reading.
**Reason:** recommended by the leads and directors. The merge improved WARNING worst frames (81.9 to 61.0 and 94.0 to 71.0 ms), and 4× on this laptop is not a measured stand-in for the Fold. **Owner:** performance-analyst + engine-programmer in LS2. Matt takes the Fold reading (`ls1-k.md`, Fold steps). S3-K2, the Drive's 504 ms `buildMass` boot slice, goes with it.

**D30 note, 2026-11-07 (Matt):** no "before" Fold reading. The perf meter (`?perf`) runs only in Chrome on Pages, and Pages keeps one build, so the before reading would have held up wave 1. Since D30 compares long against short on the same build, S2-K1 is decided by one Fold session on the wave 1 build. Steps and the pass rule: `production/qa/fold-reading.md` (performance-analyst). The ~10% noise margin is still a proposal. Take that session before the D31 tune lane stretches long4.

### D31 Long4 power-ups cut, stages stretched — 2026-11-07 (Matt; from his Descent 1 playtest)

**Decision point:** Matt played Descent 1 on long4: "plays nice", but it is "a little over saturated with power ups, I get over powered quick, and the levels are short." Measured on main (`production/qa/evidence/ls1-g.md`): the median run ends Descent 1 at LV 14, and a STRONG kit kills a midboss in 1-3.5 s. Stages run 78-104 s, so Descent 1 takes about 6 minutes.
**Chosen:** (1) **moderate power-up cut.** Fewer pod drops, so the median run ends Descent 1 at about LV 10-11 and the strongest kit arrives in Descent 2. Not chosen: a light cut to LV 12-13, or a heavy cut to LV 8-9. (2) **Stretch each long4 stage** to about 120-150 s, with more scroll and more spawn sections, in `src/layout.ts`. Four stages stay. Not chosen: a fifth stage, both changes, or leaving length alone.
**Reason:** Matt's playtest. Long4 only; short is untouched. Both changes move the long4 harness on purpose. Owner: an LS2 tune lane after wave 1 merges, because it shares `layout.ts` and the terrain with ls2-mv. Measure with pod-probe, midboss-probe and route-probe, and keep the D20 and D27 bands.

**Amended 2026-11-07 (Matt, after the studio D31 plans in the audit):**
- **The cut is kill XP and pods.** Pods don't drive LV; only kill XP does.
  - Kill XP is cut to land the median at LV 10-11.
  - Formation and carrier pods drop about 30-40% fewer pickups.
  - Midboss, Maw and stage-boss reward pods stay as they are.
  - The cut is fitted on the stretched build.
- **The stretch uses the recommended defaults:**
  - a rest breath before each biome climax (amends spec §3.2's two breaths);
  - movement B grows to about 18 s;
  - biome CP1 stays after midboss A;
  - a long4-only layout revision drops old long4 resume saves, and short saves survive.
- **Each Orbit and Drive stage gets 4 new cells,** so a pool holds twice its slots.

### D32 Option-b death costs the normal death penalty — 2026-11-07 (Matt; from the LS1 studio audit)

**Decision point:** the game-designer audit found that under checkpoint option b (restart at the checkpoint), a death restores the checkpoint's full loadout. That makes b gentler than option a, the reverse of spec §4's "harder, more Gradius", so Q2 would be judged on a false premise. The audit also found that an option-b restart keeps the stage's deaths but drops its hits from the grade.
**Chosen:** an option-b death restarts at the checkpoint and then applies the normal death cost:
- guns stripped;
- grafts down one level;
- the power cursor reset;
- the stage keeps the higher hit count for its grade.

**Reason:** keeps option b honest for the Q2 playtest. Owner: the LS1 fix lane.

### D33 Studio audit approvals — 2026-11-07 (Matt)

- **The LAB LAYOUT toggle keeps the run save:** remove its `clearRun()`, since RESUME flies the save's own layout. This reverses one line of the D2 plan.
- **Probe tools default to long4,** matching D24. `--layout short` is still available.
- **Typecheck blocks CI:** remove `continue-on-error` from `verify`.
- **A FLAKY harness result fails CI,** instead of passing with a warning.

Owner: the LS1 fix lane, with devops-engineer for the CI changes. Source: `production/qa/evidence/ls1-audit.md`, written by the fix lane.

### D34 Copy changes from the studio audit — 2026-11-07 (Matt)

**Chosen** (all four from the narrative-director audit):
1. The game brief's Pillar 4 now gives 120-150 s stages (D31), up from 90-120 s.
2. The pause menu's ABANDON SHIP is now **SURFACE**. Since H it keeps the run, and SURFACE is already the game-over word for returning to the title.
3. The title's RESUME is now **RE-ENTER**. The pause menu's RESUME means carry on from here, so the two no longer clash.
4. The Brood Mother's kill word STILLBORN is now **LANCED**. STILLBORN sat too close to the crude-not-cruel line.

**Not chosen yet:** one style for all kill words, and a smaller WARNING header for midbosses.

### D35 LS2 wave 1 merged — 2026-11-07 (parent; Matt authorized parent merges)

**What merged:**
- **ls2-0:** the midboss registry, one file per kind, plus the WIP flag.
- **ls2-perf:** the S2-K1 render fixes: the gib atlas, the floor cut, Drive mass slicing, and the warm-up lead-in gate.
- **ls2-mv:** terrain movement B (B0/B1 per biome) and 3 new set pieces per biome.
- **The parent commits:** D31-D34, the shelved voice lines, the Fold reading steps, and the qa fixes.

**Gates on the combined tip `b0316d1`:**
- typecheck: clean.
- vitest: 819 of 819 pass.
- build: OK.
- harness: 14 of 14 PASS, with no new re-baseline. `breath2` reads ls2-mv's explained `95c5d0a33e`.
- parity: 7 of 7 identical.
- `resume-check` long4 S1 CP1 and S2 CP0: PASS, with 0 RNG draws and 0 px.

**Studio review:**
- 10 specialists and all 8 leads gave APPROVE or APPROVE WITH NOTES.
- The creative-director, technical-director and producer all gave SIGN-OFF WITH CONDITIONS; every condition was met before the push.
- One must-fix was found and fixed: resume-check still looked for RESUME (200fc34).
- The reports are kept in the parent scratchpad. The lane reports are `production/qa/evidence/ls2-{0,perf,mv}.md`.

**Rollback point:** tag `pre-ls2-w1` on `7391234`. Reverting drops only in-flight runs saved under wave 1, because `valid()` rejects the new `mvSeen` field. Meta saves are safe.

**Accepted S2s, owners and order:**
1. `backdraft`'s rear wave flies through the fire B0 spires. The clamp goes in `rearLane`/`behindWave` for every rear wave. **Owner:** the LS1 fix lane, in its first merge. **Expiry (creative-director):** if wave 2 would push without the fix, take `backdraft` out of the fire pool; it must not ship a second wave.
2. The fire chimney's vent glow sits inside the HUD band. **Owner:** the fix lane.
3. The snot throat reads like movement A in stills. **Owner:** the fix lane, plus a motion check before the round-2 sign-off.
4. The movement-B hazard multipliers have no target and no per-band measurement. **Owner:** the D31 tune lane, before the stretch.
5. The warm-up WARNING gate keys off the banner text. **Owner:** the fix lane: an explicit `warn` flag and a test, before any banner-copy or i18n change.
6. The perf next-fix ranking needs one more profile. **Owner:** performance-analyst, in one heat-lock slot alongside Matt's Fold reading.

**ls2-mv design calls, recorded as built** (game-designer):
- Descent 1 flies B0. From Descent 2 on, a revisit flies the variant it hasn't flown yet (`mvSeen`).
- Set pieces are drawn without replacement, from their own salted per-stage pick stream.
- The lightest piece moves to slot S2.
- Ice B0 shortens the icicle interval to ×.7, so more icicles fall.
- Snot throat walls are static; the squeeze is drawn only.
- The movement-B terrain offset is the same across seeds. Movement A already works that way.
- D20 holds on planned x; placed entries can sit as close as 263 px.

**D30 status:** S2-K1 is still open. Midboss+8 p95 at 4× is down 16-21% but still misses 16.7 ms. It is decided by Matt's Fold reading of this build (`production/qa/fold-reading.md`), which comes before the D31 merge.

### D37 Orbit stretch +2400 px — 2026-11-07 (Matt)

**Decision point:** the long4 Open Orbit stretch in `d31-stretch.md` (the D31 tune lane): +2400 px, sized for the derelict tug's held slot B, or +2700 px, sized for an Orbit with no held midboss while the tug is WIP-gated (producer).
**Chosen:** +2400 px (`src/layout.ts` `STRETCH.orbit`). The stretch is sized for the derelict tug's held slot B (~10 s of hold, LS2-orbit). Until the tug ships out of `?mids=wip`, default players get a shorter Orbit, about 116-120 s, under the 120 s floor.
**Reason:** Matt.
**Category:** design_rules

## Open

- **ls2-mv's four questions (Matt).** game-designer's recommendation is in brackets.
  1. A 60% same-biome set-piece share against the ≤50% target [grow each biome to 7 pieces, after D31 fixes the slot count].
  2. A guaranteed signature piece [no; weight it ×2 on a first visit].
  3. Icicles ×.7: the interval or the rate [the interval, as built].
  4. Snot throat walls: static or moving [static, as built].
- **Movement-B terrain varies by seed?** It is the same across seeds today (level-designer).
- **The Calving Shelf's leave clock under the D31 stretch** (wave-2 DRIFT kind).
- **Where the shelved voice lines go.** audio-director and creative-director back KEYSTER on an S-grade boss clear and SHAMALAMA on a new best chain.

- **Where to use the shelved voice lines (Matt, 2026-11-07).** BROTHER SHAMALAMA (10-kill hype) and THE KEYSTER (boss reward) are in `src/sfx-shelved/`. Matt will pick rare triggers for them; the audio-director can propose some. Until then a boss kill plays no voice line.

### Now — blocks sprint 1 or the critical path

- *(delegated 2026-10-31, see the batch above)* **D1 Power rule.** Power only as fire and density, HP only from depth (recommended, matches 48eb7cb) — or rank also raises HP? Does the Gravity Drive keep its rank HP term (`src/boss/update.ts:22`)?
- *(delegated 2026-10-31, see the batch above)* **D2 One power accounting.** Count all 24 perks and the contraptions toward difficulty in Descent 1? Is the pow-2 fire compression intended? Is the drone `(1+loop)` factor a leftover (recommended: remove)?
- **D3 Photosensitivity.** Flashes default OFF, or ON behind a first-launch prompt? Does OFF remove washes, glitch and flicker (recommended) or cap them?
- **D4 Gate policy.** Does a red `verify` block Pages only, or the APK too (recommended: both, plus manual dispatch for debug builds)? Move tune work to PRs?

### Soon — before sprint 2/3


- *(delegated 2026-10-31, see the batch above)* **D5b Economy.** What DESCEND DEEPER gives (`deepPay` ignores `lv('deep')`, `src/stages.ts:28`; pinned as current behaviour in `tests/unit/stages.test.ts`). Does an escaped boss pay and count toward seals? Should grade pay more? Which biomass sink?
- **D19 economy defaults (spec `design/content-expansion.md` §12 Q9-Q12).** `src/economy.ts` (LS1 G0) carries the recommended defaults, unwired. **Q9 S grade** (≤ 1 hit, no deaths, length-normalised penalty, or keep no-hit S) is player-visible in `long4` and needs an answer **before LS1 item G wires it**; with it: should the normalised hit penalty be clamped so a stage shorter than 35 s never grades harder than today (game-designer review, recommended clamp)? **Q10 seals** `{1,3,5}` at `long5`, **Q11 lives** +1 per Drive kill capped at 5, **Q12 biomass** kill bio x0.6 affect `long5` only and can wait for LS3-0. Also for LS3-0's playtest: the spec's optional `long5` Descent 1 elite (.05 from stage 4). Before item G ships `long4` even behind the flag, Matt also approves the spec §13 Pillar 4 text, since `design/game-brief.md` still says "phone-sized, about 35 s stages" (creative-director, G0 sign-off).
- **Q2 Checkpoint (still open; the undo part is decided, D28).** Option a (resume point only, the default) or b (also restart from the checkpoint on death)? Answered at the LS1 playtest (build plan §6). Also open: does ABANDON SHIP need different wording, or a separate path that ends the run, now that it keeps the run?
- **LS1 exit, hits/min (from the LS1-G studio review, 2026-11-03): carried forward, not waived.** G could not show hits/min within ±30% of spec §8 per biome slot, because its mortal bot dies in long4's first biome. Owner: systems-designer + qa-lead, before LS2 banding and the LS1 exit. Matt may waive it instead. Build plan: LS1-G carry-forward 1. **LS1-bot (2026-11-06):** the pilot now survives (`pod-probe --pilot`), but the §8 targets are defined on the invincible bot, so this still needs a ≥ 10-seed-per-kind `playtest.mjs` sweep. Matt: fund it (systems-designer + qa-lead) or waive it. The creative-director recommends funding it in LS2 rather than waiving.
- **LS1 exit, band instrument (LS1-bot, 2026-11-06; game-designer).** Which instrument owns the economy, grade and wall-time bands: the mortal pilot (`pod-probe --pilot`), the invincible bot or `playtest.mjs`? The two bots disagree: D1 biomass 1213 against 1434, and the Drive fight 40-55 s against 37-53 s. The creative-director recommends the invincible bot keep the economy and time bands, and the pilot own survival and grades. Owner: Matt. Build plan: LS1-G carry-forwards 2 and 9.
- **LS1 exit, biomass baseline (LS1-bot, 2026-11-06; game-designer).** Are the D1-D3 biomass targets read on a steady-state profile (first-kill pay removed) or a fresh one? This decides whether the D1 median of 1213 is a miss. The creative-director recommends writing both targets down. Owner: Matt, before the economy-designer tunes `killBio`.
- **Maw death sound (LS1-K, 2026-11-06; audio-director, art-director).** K fixed a dead Maw rupturing every frame. A death is now one rupture, one `splat_l` and one `fart_ok`, where before it was stacked splats up to the voice cap. Is that the intended death, or should a layered death sound be authored on purpose? Matt listens on the deployed build.
- **Row I scope (LS1-I, 2026-11-06; qa-lead).** The jump scenarios cover fight arrivals and openings, not forks or kills. Accept that row I closes only the midboss and biome parts of M6's goal, with fork coverage carried forward (recommended)?
- **D6 Saves.** One final save-wiping uninstall for stable signing, or ship save export first (recommended)?
- **D7 Licensing.** Licence for code, art, voice; second voice performer's consent and credit; CC BY credits vs CC0 swap; which README asset rule is current.
- **D8 Copy rules.** No-crosses scope; deadpan logs and stage cards; one noun per progression system; banner and spelling fixes.
- **D9 Hype man.** Record the missing takes or go text-only; captions; 20-chain cooldown.
- **D10 Seeded runs.** Are daily seeds or replays a goal? Sets whether the RNG split is required or hygiene.
- **D12 WARD.** One pip absorbs one bullet with i-frames, or keep the 16px soak ring?

### Later — before content or release work

- **D11 Biome bosses.** Shared Maw body with biome attacks (recommended) or distinct bosses?
- **D13 Gross dial.** Internal knob or player-facing option; colour-blind bullet palette?
- **D14 Shop input.** Two-tap buy intended? Desktop click behaviour; confirm on permanent buys?
- **D15 Distribution and target.** Sideload + Pages, or itch/Play; reference device and frame budget (then set `performance.enforce`).
- **D16 Audio direction.** Drone under music, UI synth pass, sliders vs VOICE toggle, music size (38 MB).
- **D17 Art direction.** Bitmap strips vs vector enemies; public `assets-raw` provenance manifest.
- **D18 Canon.** The descent/time-loop explanation, the missing 7 years, the Infirmary in the fiction.
