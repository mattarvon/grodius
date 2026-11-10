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

### D36 ls2-mv's four questions: the recommendations — 2026-11-07 (Matt)

Matt: "go with the recommendations".
1. **Set-piece repeats (60% same-biome against ≤50%):** each biome grows to 7 set pieces once D31 has fixed the slot count. That is a follow-up content lane after the D31 merge, with level-designer, art-director and technical-artist.
2. **Signature piece:** not guaranteed. On a biome's first visit in a run, its signature piece is weighted ×2. Owner: the D31 tune lane, because the change moves long4 picks and D31 re-baselines long4 anyway.
3. **Icicles ×.7:** read as the interval, as built.
4. **Snot throat walls:** static, as built.

Also started on Matt's say-so: the LS1 fix lane (`ls1-audit`) and the D31 tune lane (`ls2-d31`).

### D38 "Still very linear": the fork becomes a decision, builds get trade-offs — 2026-11-07 (Matt)

Matt played a full run on the wave 1 build (`abf85c1`, long4, before D31): "its getting more challanging and a little more rewarding, but still very linear".

**The crew.** Nine roles diagnosed it: game-designer, level-designer, systems-designer, economy-designer, narrative-director, ux-designer, ai-programmer, art-director and audio-director. Then creative-director and producer combined their reports. Their reports are kept in the LS2 wave 2 crew notes.

**Diagnosis.** Wave 1 added variety that the run draws for you, not choices the player makes:
- The fork is blind and nearly forced. A gate shows only a name, unvisited biomes are offered first, and the ship auto-picks after 15 s.
- Power arrives unchosen. 22 of the 24 perks are pure upside, grafts and seals come on a schedule, and pods apply themselves.
- Every biome stage is one corridor with the same beat template.
- Nothing records the player's choices, on screen or in sound.
- Every Descent 1 meets all 4 midbosses.

**Decided** (Matt: "sounds good" to creative-director's recommendation):
1. **Now, render and audio only (lane `ls2-read`):**
   - gate plates show the stakes: the biome perk the gate unlocks, and a REVISIT/REMIX tag;
   - remix visits look damaged ("wound states");
   - midboss and boss music intensity in biome stages, and kill sounds per biome;
   - paper specs for the choice lane.
2. **After D31 merges, as one "choice" lane:**
   - perks with costs;
   - build-aware perk offers;
   - a midboss pod pick of 1 from 2;
   - choosing your seal unlock;
   - fork pay.

   Nothing is folded into D31, which keeps short identical and keeps the Fold reading clean.
3. **The gate midboss preview** follows fix merge 1, and ships with the first new midboss kinds.
4. **In-stage structure waits:** split lanes, pockets, beat variants and reactive midboss attacks come after D31 and the pool lanes.
5. **The pool lanes go breadth first,** starting with kinds that can appear in Descent 1 (`min: 0`): Cryosleeper, Reclaimer, Kindling or Spit, and Sniffer. Then every Descent 1 stops meeting the same 4.

**The crew's shared "don'ts":** no more forks or gates while the plates show nothing; no random content as the answer to "linear"; no more free upside; no hidden director; and keep each biome tied to its boss.

**Open, for game-designer then Matt:**
- The Orbit tug is ANGLE, so `min: 1`. Give it a `min: 0` exception for the Orbit slot, or build the tethered crewman (LINE) first? Otherwise Descent 1 Orbit never gets its slot B (D37).
- Does slot A's home preference still hold once a biome has two pool members?
- At-risk biomass, where unbanked biomass is lost on death, needs a decision.

### D39 Tone: evil, not cartoonish; gore and darkness — 2026-11-07 (Matt)

Matt: "it should be more evil and not cartoonish", then "need gore, and darkness". He approved creative-director's tone note (LS2 wave 2 crew notes, `tone.md`).

**Pillar 5: "comedy in comms only".** The MERIDIAN, its creatures, bosses, gore, art, sound, music and log text play malevolent body horror straight: dark, wet, anatomical, never cartoonish. The one release valve is deadpan gallows humour in the comms callers and kill banners. `design/game-brief.md` :35 and :83 rewritten, with follow-ons at :21, :76, :78 and :84.

**Voice:**
- Keep `stop-killing-me` (CREWMAN #5 // DECEASED) and `lesley-yeah-baby` (LESLEY, MISSION CONTROL).
- Shelve `hell-yeah` (SGT. RAMROD SLAB) and `sfriend` (SURF CONTROL) to `src/sfx-shelved/`. Cut the surfer flyby and its "EXCELLENT WORK, BABY!" bubble. The VOICE rows stay so a clip can be un-shelved. An empty voice bank is silent, with no TTS fallback.

**Approved strings:**
- Kill banners: 10 THAT ONE / HAD A NAME; 20 CLEAN-UP CREW / IS NOT COMING; 35 WE WILL NEED / A BIGGER BAG; 50 FILE IT / UNDER LOSSES; 75 THE GATE / KNOWS YOUR NAME; 100 YOU ARE / PART OF IT NOW. CARN: MESSY becomes OPENED.
- Names: THE DROWNED LANDER (was the Squid Saucer), THE BLOAT, SEVERED, TAKEN DOWN.
  - *Later (Matt, 2026-11-09):* the Saucer is SQUID SAUCER 2000 (D48) with kill word CALAMARI SERVED (D49). It is the single pun exception, Matt's call, and no precedent: every other name and kill word stays in this register. *Amended in D52: CALAMARI SERVED is still the only pun kill word, and also one line in SLAB's quip pool.*
- LS2 names, in docs and specs only for now: THE EXPECTORANT (Spit), THE SCENT ORGAN (Sniffer), CHARON-6 (the tug), CREWMAN #2 // TETHERED.
- Log, perk and menu lines as listed in the tone note §4(A) item 9.

**Worklist A (render, audio and copy; lane `ls2-read`):** greybox rebuilt as a dark angular mass with a lit split; lime out of the cyst and pink out of gore; `silly` shelved; pick, power, alarm, hype and UI sounds re-voiced darker; Jello clips out of `snot`; fart menu nav replaced; interim music lowpass, drive and rate .94; the voice list above; the kill banners and copy. **Midboss, boss and banner renames wait for fix merge 2** (the warm-up WARNING gate keys off banner text today, and parity records midboss titles).

**Worklist B (a later tone lane, in this order):** the darkness pass with a new Orbit backdrop (highest perf risk, profile on the Fold); the gore pass (anatomical gibs, spatter, persistence); the core midboss rebuild with a motion pass; the music replacement.

**Stays:** D25 (no screen-space splats over the play field). **Inviolable:** enemy bullets and hazards stay lime with a dark outline, unlit and on top, and must read on the phone outdoors. Darkness, gore and fog never dim, cover, move or recolour them.

### D40 LS1 fix merge 1 merged — 2026-11-08 (parent; Matt authorized parent merges)

**What merged** (ls1-audit, `abf85c1..5fa8663`):
- the midboss picker fixes: gap-to-least-met weighting capped at 3:1 (#15), with only the exact previous pair excluded (#16);
- the harness tool fixes: `breath2` slot B no longer skips silently (#8), and `--update` refuses failed runs (#9);
- D33 in CI: FLAKY fails it, typecheck blocks it, and cancel-in-progress applies to PRs only;
- the backdraft and pincer rear-wave clamp, sampled over the whole flight (closes D35 accepted S2 #1);
- Matt's bug: the touch back controls, plus Android back stepping one level, with a two-press exit at the title root ("PRESS BACK AGAIN TO LEAVE");
- registry hardening: `import './enemies/mid'`, the top-level rule in `src/CLAUDE.md`, and the DRIFT leave hook;
- D36.

**Gates on `25b61af`:**
- typecheck: clean.
- vitest: pass, plus 1 expected fail.
- short harness: PASS; parity: 7 of 7 identical.
- scen: 12 of 12 PASS; long4: PASS, with no re-baseline.
- build: OK.
- resume ×3: PASS.
- back-check: PASS.
- set-shots: 0 buried, 0 crossed.
- The first scen and long4 runs crashed on a Vite reload from the dependency cache shared between worktrees. It was not a sim diff. The rerun passed.
- Fixup 27d699c (exit prompt moved under LAB, menuBlip): back-check ok with the shots re-taken; short PASS; parity 7 of 7 identical; typecheck clean; vitest 888 plus 1 expected fail.

**Studio review:**
- 5 specialists (web-specialist, ux-designer, systems-designer, qa-tester, level-designer), all 8 leads and all 3 directors gave APPROVE WITH NOTES. No blocks.
- Two S2s were fixed before the push: the exit prompt overlapped the credits (art-director, localization-lead), and a CHANGELOG entry was missing (release-manager).

**Rollback point:** tag `pre-ls1-fm1` on `abf85c1`.

**Owned items:**
1. The rear hatch filler lands about 20 px into breath 1 (acid, snot) and about 60 px into snot's run-up (`biomebeats.test.ts` `it.fails`). **Owner:** game-designer, before any LS2 lane builds on the breaths.
2. long4 dies in Orbit before any fire stage, so set-shots is the only evidence for the rear clamp. **Owner:** qa-lead. D31's re-baseline must include a run that reaches the fire stages.
3. Set a per-worktree Vite `cacheDir`. **Owner:** devops-engineer, before parallel lanes run gates again. Also make the harness name a mid-run reload (`harness.mjs:132`).
4. Matt to check the two-press exit on the Fold, in the same session as the Fold reading; record the build sha in `fold-reading.md`. The two-press exit was built before Matt decided ux Decision 2. It is cheap to revert.
5. The title's fart cursor samples go against D39. ls2-read replaces them.
6. Backlog:
   - one shared REAR constant (lead-programmer);
   - the spec's "about 1 in 5" against the measured 0.257 (systems-designer);
   - the rough `bigBtn` edge, with amber kept for warnings that cost something (art-director);
   - a string table with a 340 px footer limit (localization-lead).

**Merge order from here:** ls2-read (rebased), then fix merge 2 (audio-director re-reviews `audio.ts` after its rebase onto ls2-read), then D31 after the Fold reading.

### D41 Title eye is ROT; Matt's head is an easter egg; eye kit baked — 2026-11-08 (Matt)

**Decision:** concept #7 ROT replaces the title's bloodshot eye ("we have to use #7 ROT for the title screen"). Matt's self-portrait head goes on the title, ending as a tiny easter egg that peeks in at the edges ("much smaller, like an easter egg floating around the corners"), with the gross eye fully covering his real left eye. He approved the capture ("looks cool merge it").

**Why:** D39. The old lime iris and pink veins read as cartoon. ROT plays the eye straight, and a blind cataract that still follows you is the evil version.

**Consequences:**
- ROT is an explicit exception to the tone note's "no single big eye". It is for the title only: an in-game eye is a part of a body, or small fodder (art-director).
- The head went big with heavy blood first, then Matt shrank it. The pool, gush and "tons of blood" rulings are withdrawn, so no drip cap above 24 was needed.
- The eye moved to x 396, r 88, so the wordmark's S now reads. The title's old `hangSpine` calls are gone.
- Five kit sprites are baked and wired into nothing, because Matt picks the in-game uses. Candidates are ranked in `production/qa/evidence/ls2-eye.md`.
- Render only: harness and parity do not move.
- The head's source photo and its generator stay out of the repo; only the baked PNG ships.

**Open:** Matt's in-game kit picks.

### D42 LS2-read merged — 2026-11-08 (parent; Matt authorized parent merges)

**What merged** (ls2-read, `93e595b..939d5f3`):
- gate plates that show the stakes (D38 item 1);
- remix wound states;
- music intensity, the per-biome kill layer and the drone bed;
- `design/choice-spec.md`;
- tone worklist A (D39);
- the review fixes.
The held renames are not in it.

**Gates on the fixed tree:** typecheck, vitest and build pass. The full harness passes with no `--update`: short @8ff9ba4, long4 @88d9525 and all 12 scenarios. Parity is 7/7 identical, including `musicPlan`. The logs are `production/qa/evidence/ls2-read/fix-*.txt`.

**Studio review:**
- 2 independent specialists (web-specialist, technical-artist), all 8 leads and all 3 directors gave APPROVE WITH NOTES. Nothing blocked.
- 5 S2s were fixed before the push:
  - the kill-layer throttle key;
  - the `fart_ok` swaps, with `fart_nav` and `fart_ok` shelved;
  - the HYPE[20] line re-voiced;
  - the dead babe and nativeSay code removed;
  - the cheap S3s.
- The reports are in the parent scratchpad, `review/read/`.

**Rollback point:** tag `pre-ls2-read` on `93e595b`.

**Owned items:**
1. **The held-rename commit.** It follows fix merge 2 and must not slip. Owners: narrative-director, then a parity re-baseline. It carries all of these:
   - THE BLOAT (now visible on a choice plate);
   - the remaining HYPE banners (HELL YEAH / BROTHER! at 10);
   - the SGT. RAMROD SLAB fallback face on the 20-chain caption (show no face);
   - CARN MESSY → OPENED;
   - SEVERED;
   - TAKEN DOWN;
   - THE DROWNED LANDER;
   - snot `sub`.
2. **Merge 2 (ls1-audit) is blocked until its rebase onto this is fixed** (technical-director). VOICE_CAP removes `voices`, which the kill layer reads, and that throws inside the update on device. The rebase must:
   - use `LIVE.length <= KILL_LAYER.maxVoices` (10);
   - keep the kill layer non-prio with no `fb`;
   - add a Vitest that stubs AudioContext and calls `sfx.gore` in each biome;
   - re-run the full harness and parity;
   - get audio-director's re-review of `audio.ts`.
3. **TTS dependency removal:** its own commit after the renames, with `npm uninstall` and `cap sync`, a CI APK build and a device boot check. Owners: web-specialist and devops-engineer.
4. **For Matt:**
   - an ear check before merge 2 lands: intensity, the kill layers, the fart replacements (`drivegut`, `gross_gargle`, `gross_slosh`), whether the boss bed pumps the SFX, the sour sting, and the title pops;
   - the choice-spec §7 questions;
   - SNOT ROCKET, SHAMALAMA and KEYSTER;
   - "Does ALTERED look more dangerous?" (creative-director: keep the damage, add one threat light per wound in worklist B).
5. **Worklist B,** proposed after D31: the darkness pass with a new Orbit backdrop, then the gore pass, then the midboss rebuild, then music.
6. **D38 ("still very linear") stays open** until the choice lane's fork pay lands.

### D43 LS2-eye merged — 2026-11-08 (parent; Matt: "looks cool merge it")

**What merged** (ls2-eye, `586b183..bf076a5`). It is render-only:
- the ROT title eye (D41), as four baked layers with a hitching gaze and a membrane blink;
- Matt's self-portrait as a tiny bleeding easter-egg head that drifts along the title's edges;
- `src/titlelayout.ts`, the single source of the title's no-go rects;
- the eye kit, baked into `src/sprites/kit/`, not shipped and wired to nothing;
- `tools/gen_eyes.py`.

The head's generator and source photo are kept outside the repo, at `~/Pictures/grodius-head/` on Matt's machine.

**Gates on bf076a5.** These ran on the `src` and `tests` trees stamped in the logs:
- typecheck: clean;
- vitest: 985 pass, plus 1 expected fail;
- short harness: PASS;
- parity: 7 of 7 identical.

The parent built the merged tree before the push: `vite build` exit 0, `dist` 44,814,542 bytes.

**Studio review.** All APPROVE or APPROVE WITH NOTES, with no blocks:
- 2 specialists (web-specialist, ux-designer);
- all 8 leads;
- all 3 directors.

S2s fixed before the push:
- the gate logs on the rebased tip;
- the shared title layout and no-go rects;
- the head generator given a durable home;
- the measured build (technical-director).

**Wordmark.** The shipped title keeps the house blackletter, as on main. Matt's preview had shown a serif fallback by mistake. Matt was shown the real frame; he hadn't replied at push time, and creative-director and art-director prefer the blackletter.

**Rollback point:** tag `pre-ls2-eye` on `586b183`.

**Owned items:**
1. **Kit picks.** Matt picks. art-director and game-designer write one sheet first, and eyes 3-5 must sit embedded in flesh. If none is picked by the end of LS2, delete the kit.
2. **Help/credits overlap** (START PAUSE vs SPRITES:). This predates the lane. ux-designer files it, and it is fixed through `titlelayout.ts`.
3. **ROT reads as a planet and moon in stills.** art-director adds a faint pupil, or rim of meat, before any marketing capture. The head's eye should also shift toward ROT's tallow.
4. **Fold reading checklist** (producer): the title, the armed prompt, ROT memory (about 0.5 MB more than before), merge 2's items, and S2-K1. Due before D31.
5. **Typed-in text widths and rail ends.** Re-measure them whenever title copy changes.

## Open

- **Movement-B terrain varies by seed?** It is the same across seeds today (level-designer).
- **D31 Orbit stretch: +2400 or +2700 px** (producer), while the derelict tug is WIP-gated.
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

### D44 LS1 fix merge 2 merged — 2026-11-08 (parent; Matt authorized parent merges)

**What merged** (ls1-audit, `547926e..b153400`):
- the resume contract: biome CP1 is written just before midboss A's release pod; the run-save decoder bounds every
  field; IMPORT SAVE clears the run save;
- D32: an option-b death pays the normal death cost. Lives come off the checkpoint's count; BLACK BOX and
  boss-lifeline pods drop again by the restored ship; when the checkpoint has no life to take, the player respawns
  in place (option a) so a re-picked spare can't loop the run (systems-designer delta review);
- no biomass re-bank on a replay after RE-ENTER (bankBio high-water mark per run seed);
- voice priority (VOICE_CAP, LIVE list; priority cues evict the oldest ordinary voice); the kill layer proved against
  the cap;
- the WARNING flag on banner(); warm-up hardening;
- HUD text outlined instead of a strip and plate; HI/STAGE/DEPTH at #cfd9e3; KILLS counter below the LV row;
  vent/chimney glow out of the HUD band; the snot throat lip pulses;
- picker m0 per draw (spec §6.3); bandFit clamp; copy NO REWARD and PRESS BACK AGAIN TO DESCEND;
- tools: probes default to long4, resume-check, bio-replay-check, biome-kill-check.

**Gates.** On a675dd5/b153400: typecheck 0; vitest 1113 + 1 expected fail; short and long4 harness PASS (canvas
hashes differ, advisory: the HUD colour); 12/12 scenarios; resume-check PASS; option-b page rig PASS. Parity, back,
bio-replay and biome-kill checks last passed on b127be3 (only flow.ts and tests changed since). The parent built the
merged tree before the push: `vite build` exit 0, `dist` 44,817,798 bytes.

**Studio review.** All APPROVE or APPROVE WITH NOTES, no blocks: specialists, all 8 leads, delta reviews
(art-director on the HUD colour, systems-designer on the lives clamp: its block fixed in a675dd5), and all 3
directors.

**Rollback point:** tag `pre-ls1-fm2` on `547926e`.

**Owned items:**
1. technical-director: rerun parity once on main; before any harness re-baseline, confirm only the HUD rows' pixels
   changed. The bandFit clamp, picker m0 and CP1 anchor are a known harness coverage gap.
2. creative-director S3s: rename the combo counter CHAIN (KILLS means two things); the tone debt on main (acid vat
   skeletons, yellow snot orbs, orange-white jets) goes to the tone lane.
3. Matt: on the Fold, the HUD colour and outline, phone profiling, RE-ENTER of a pre-merge save, an option-b death;
   by ear, the Maw and Drive deaths, siren + stinger, WARNING.
4. The held-rename commit (D42) owns the midboss-title parity re-baseline.

### D45 Every boss gets a realistic, gross repaint; Maw and Saucer picked — 2026-11-08 (Matt)

Matt, playing through: the Maw and the Squidfucked Saucer "look vector and generic"; then "have the art dept look at
all of the bosses. need to upgrade all of them. more realistic, more gross shit".
- From a 7-and-7 concept picker, Matt picked **Maw c1 Lamprey Disc** (a lamprey oral disc of hooked teeth, eyes in
  the gill pores) with a CC0 vintage dental-plate teeth source (rawpixel 6266016) for its tooth rings, and
  **Saucer c3 Natural-History Plate** (an ivory scratchboard specimen engraving on black, blood the only colour;
  George Shaw's cuttlefish, CC0).
- The LS2-bossart lane (art-director leading) audits all ten bosses and midbosses, offers 6 directions per remaining
  boss (one in the engraving style), then builds Matt's picks as baked sprites, render-only, gameplay unchanged.

### D46 Boss picks built; content cut in the repaint — 2026-11-09 (Matt)

Matt picked the remaining seven bosses from the LS2-bossart picker: **crux c5 Engorged Frost Leech, butcher c1 The Split
Side, drive c3 Spine Wheel, choir c3 The Enucleated Eye, cyst c2 The Torn Placenta, prentice c2 Grown Into the Blade, brood
c3 Tapeworm Knot** (Maw and Saucer: D45). All nine are built as baked, animated art, render only (LS2-bossart report:
`production/qa/evidence/ls2-bossart.md`).

Content, Matt: "cut it in the repaint" (no hotfix on main):
- the Womb's child figure and kicking limb removed (the new Womb is placenta, cord and membrane only);
- the Butcher's breasts removed (the old art deleted);
- the small figure in the snot-biome egg pods replaced by a dark clot;
- the child-sized skeletons in the acid tanks replaced by one adult body per tank; adult corpses and gore stay;
- Matt's call **b** ("b, looks cool merge it"): the acid-tank bodies fade out while THE DISSOLVING WOMB is up and back after
  it dies, because a tank skull over the placenta read as the boss's head (art-director block, cleared on recheck).

**D46 addendum (parent, 2026-11-09).** To clear art-director's recheck block, call b was extended: the hanging acid
corpses (hooks and the gantry crewman, full and drained visits) also fade while THE DISSOLVING WOMB is up, and the
Womb's cord lip was re-baked as dark meat (a pale stump read as a face). Only while the Womb is up; told to Matt.

### D47 LS2-bossart merged — 2026-11-09 (parent; Matt: "b, looks cool merge it")

**What merged** (ls2-bossart, `eede936..01736aa`): all nine boss picks (D45, D46) as baked, animated atlases in
`src/sprites/boss/`, drawn by `src/render/gross/baked.ts` and per-boss modules; the old `gross/biomebosses.ts` deleted;
the D46 cuts; the Womb tank fade (`src/render/tankfade.ts`, tested); the painters in `tools/bossart/` (the committed PNGs
are the source of truth; photos stay in git-ignored `assets-raw/`). Render only: no sim file changed.

**Gates** on code tip 03d041c, clean tree: unit 1117 pass; harness short and long4 PASS; 12 scenarios PASS; layout-parity
PASS; rng-probe 11/11 fights identical. Option-b proof retained: `production/qa/evidence/ls2-bossart/d46-womb-fade.jpg`.
The parent built the merged tree before the push: `vite build` exit 0, `dist` 46,178,713 bytes (APK about +1.4 MB).

**Studio review.** In-lane art-director and technical-artist sign-off (the frame-time block fixed). All 8 leads
APPROVE or APPROVE WITH NOTES except qa-lead, whose BLOCK (gates on the rebased tip; no option-b proof) closed in
95fa2e5/03d041c/01736aa. creative-director, technical-director and producer APPROVE WITH NOTES. Licensing:
91 photos (CC BY 2.0/4.0, CC0, PDM) plus 3 sources, all in CREDITS.md, no NC/ND.

**Rollback point:** tag `pre-ls2-bossart` on `eede936`.

**Owned items (backlog, S3):**
1. art: the Saucer reads clean and dry; keep the current flesh-and-tentacle art and push it darker with rim grime in
   Worklist B (restated in D48: "waterlogged" came from the dropped DROWNED LANDER name); the emoji-like
   round skulls in `biomeart.ts`; Butcher and Apprentice value lift against the fire biome; the acid Maw's belly too
   pink; the shared kill burst hides the first death frames.
2. Matt decides: the Nail Choir's single eye against D41's no-single-big-eye rule (narrative-director, creative-director).
3. tech: atlas onerror retry and a bounded ready-wait at the boss gate (a slow phone can open on the fallback mass);
   pin PIL and hash the photos; crux and gravity frame time on the perf backlog before release.
4. release: spot-check ~5 Flickr CC BY rows and the 4 creatorless rawpixel rows before a tagged release.
5. Matt on the Fold: does any boss open on the fallback mass.

### D48 Held renames and SQUID SAUCER 2000 merged — 2026-11-09 (Matt: "start the held renames and change the squidfucked saucer to Squid Saucer 2000"; parent merge)

**What merged** (ls2-names, `44890d2..22c803c`): D42 owned item 1, all of it, with one swap on Matt's instruction.
- The Open Orbit midboss is SQUID SAUCER 2000 (roster `name`; the 12-character probe `label` stays SQUID SAUCER; code key
  `ufo` unchanged). Its kill word is SEVERED, per D39.
- THE BLOAT (gate plate FROZEN // BLOAT, HP bar); TAKEN DOWN for both stage bosses; OPENED at a 5-chain; HYPE 10/35/50/
  75/100 to the D39 lines; the chain caption with no voice shows no face and no tag; the Sinus sub IT IS BREATHING. YOU
  ARE IN THE AIRWAY; CREDITS.md, README, docs, tool docstrings and tests follow. Old QA evidence is left as history.
- `tests/unit/warngate.test.ts`: the warm-up WARNING gate keys off the banner `warn` flag, not its text.

**Naming exception.** SQUID SAUCER 2000 is Matt's named exception to Pillar 5 for this one name only. It overrides D39's
THE DROWNED LANDER, does not reopen D39, and is not precedent for THE EXPECTORANT, THE SCENT ORGAN, CHARON-6 or any later
name. Later lanes must not "fix" it. Read "2000" as a MERIDIAN model number; the fight, art, sound and death stay straight
horror. SEVERED stays unless Matt asks for a kill word to match. *Closed in D49: Matt asked for CALAMARI SERVED.*

**Gates** on 22c803c: typecheck 0; vitest 1122 pass plus the 1 known `it.fails` (qa-lead re-ran both); build 0; harness
short, long4 and 12 scenarios PASS with no `--update`; layout-parity 7/7 against a baseline edited for the two titles
only (19 values; qa-lead proved the old file with the names swapped is byte-identical to the new one). The parent
build-checked the merged tree. Evidence: `production/qa/evidence/ls2-names.md` and `ls2-names/`.

**Studio review.** In-lane narrative-director, web-specialist and qa-lead. All 8 leads and all 3 directors APPROVE WITH
NOTES; no block. The S2s (CHANGELOG closes the 2026-11-08 known issue; this exception record; D47 item 1 restated) are
done in this merge.

**Rollback point:** tag `pre-ls2-names` on `44890d2`.

**Owned items (backlog, S3):**
1. README: the pre-D39 audio text at :111 and the Orbit midboss in the Mini-bosses list, folded into the D42 item 3 TTS
   commit (web-specialist). The TTS removal is next.
2. Screenshots (qa-lead, next pass): the 75- and 100-chain captions (shrunk to fit), THE BLOAT on HP bar and plate, the
   Sinus card, the SQUID SAUCER 2000 HP-bar title beside the score.
3. Playtest reads (game-designer): OPENED as an unlock, FILE IT / UNDER LOSSES as "you are losing". Change only on a
   real misread.
4. Hype window polish (web-specialist; art-director, audio-director spec; after D31): a dead-feed mark on the faceless
   window ($.T only, no srnd()), a plate or outline behind the caption, the caption jitter off when blind, a comms-open
   static tick, the stale comments at `hype.ts`:166-172 and :188.
5. The VOICE `hell-yeah` -> SGT. RAMROD SLAB row (`hype.ts`:173): retag or drop when the hype bank is re-recorded.
6. qa hygiene from the next lane: export BANNER_T; gate logs start with the commit and `git status`; keep the vitest
   tail; build logs keep only the tail. Evidence size: smaller shots (WebP/JPEG) before the first tagged release.
7. Glossary, when a string table exists: "2000" stays literal digits; each HYPE pair translates as one unit.
8. tools (lead-programmer; tell localization-lead): key the layout-parity dump's `minis` on the roster `k`, not the
   display title, so copy changes stop moving the parity baseline; note the 22c803c title substitution in the
   baseline's `commit` field when it is next touched.

### D49 LS2-tts merged — 2026-11-09 (Matt: "yes and keep CALAMARI SERVED"; "stop killing me ... too often", picked once per stage on corpses; parent merge)

**What merged** (ls2-tts, `1f7f142..d7ad788`):
- SQUID SAUCER 2000's kill word is CALAMARI SERVED again (`src/enemies/mid/ufo.ts`:168). Matt's override of D39's SEVERED for
  this one enemy; the code comment says so. No other kill word follows it.
- D42 owned item 3 closed: `@capacitor-community/text-to-speech` removed from package.json, the lockfile and the two gradle
  files (hand-edited to match what `cap sync` generates; CI runs `npm ci` + `cap sync`). A guard test fails if it returns.
  README audio text and Mini-bosses list brought up to date (D48 item 1); the plugin also dropped from the two studio stack
  docs (`.claude/agents/web-specialist.md`, `.claude/docs/technical-preferences.md`) by the parent in the merge.
- The corpse plea ("stop killing me") plays at most once per stage, on corpse kill 1-5 picked by an integer hash of stage
  and loop (`src/enemies/corpsevoice.ts`; no R()/srnd() draw). `corpseN`/`corpseVo` live in `G.st`: reset per stage, kept
  through checkpoints, RE-ENTER and death restarts. Quiet stages are accepted (game-designer, creative-director).

**Gates** on 54f574f (logs start with the sha): typecheck 0; vitest 1132 pass + the known `it.fails`; build 0; harness
short, long4 and 12 scenarios PASS with no `--update`, `st` identical; parity 7/7. qa-lead re-ran typecheck and vitest.
The parent build-checked the merged tree.

**Studio review.** In-lane web-specialist x2 and devops-engineer. All 8 leads and all 3 directors APPROVE WITH NOTES; no
block. S2s fixed in the merge: the README corpse line, the lane report's popup-overlap sentence (SEVERED did not overlap;
CALAMARI SERVED covers "FIR" of FIRST KILL +100) and its `cap sync` claim, boot-check step 8, the CHANGELOG entry.

**Open:** Matt's device boot check of the CI APK (`production/qa/evidence/ls2-tts.md`, steps 1-8, including whether once a
stage still feels too often). In the main checkout first: `git pull`, `npm ci`, `npx cap sync android`, expect a clean
`git status android/`. If the APK fails to boot, revert 86a639f on its own.

**Rollback point:** tag `pre-ls2-tts` on `1f7f142`.

**Owned items (backlog, S3):**
1. ui-programmer: move the score popup clear of the kill-word banner; a measureText shrink-to-fit in `banner()` (hud.ts:225).
2. game-designer: per-stage corpse counts in a probe, the measured quiet-stage rate, a 3-6 range comment on
   `CORPSE_VOICE.span`; mixing `G.seed` into the hash is optional. Next lever if still too often: a per-descent cap.
3. sound-designer: spend the stage's plea only when the clip actually sounds (audio-side only, never via `G.st`); add the
   plea to the prio-cue comment at audio.ts:139.
4. qa-tester: a vi.mock test that a corpse kill calls `corpseKilled` with `prio: true`; a RE-ENTER-after-restart check.
5. web-specialist: extend the TTS guard to package-lock.json and add `speechSynthesis` to the bundle grep.
6. gameplay-programmer: move the inline comment above update.ts:670. writer: README :85-86 mixes stage bosses into the
   Mini-bosses heading.
7. localization-lead, once i18n is scoped: kill-word keys (CALAMARI SERVED: "rewrite the joke") and voice-line captions.

### D50 Matt is SGT. RAMROD SLAB; the voice booth — merged 2026-11-09 (parent; Matt: "I am RAMROD SLAB", "ramrod slab, through the comms", "laptop mic for now and booth")

**Decisions (Matt, 2026-11-09):**
- **SLAB returns as Matt's own caller.** This reverses D39's shelving of SGT. RAMROD SLAB as a caller. He speaks every new
  recorded line: hype10-100, bossreward (TAKEN DOWN), the midboss kill words (`kill-ufo/brood/choir/cyst/prentice`) and
  OPENED (`carn5`), in a flat, low, gallows-deadpan register, never a hype yell (creative-director). The kill words and
  OPENED play through the comms window, which keeps them inside Pillar 5's release valve. The old `hell-yeah` clip stays
  shelved; its VOICE row maps to SLAB (settles D48 item 5).
- **His face** is Matt's 8-bit head (picker take 2, option 2, 48x52, eye straightened; "I like it"), a separate sprite
  `src/sprites/slab@3.png`; the six aliens stay for other callers. Only the baked sprite is in the repo; the generator and
  the source photo stay outside it. Canon: SLAB and the title easter-egg head (D41/D43) are one man.
- **D9 closed: record.** Recording moves from RecForge -> Google Drive to a dev-only booth (`tools/booth/`, `npm run dev`,
  `/booth.html`): the script comes from the game's strings, takes are cleaned with ffmpeg to -12 LUFS and saved as
  `src/sfx/<folder>/<line>-matty-<n>.ogg`, raw takes go to git-ignored `assets-raw/voice/`, and a dev-only `?vox=` hook
  plays a line in game. Nothing of the booth reaches dist or the APK (dist grep: 0 hits).
- **Game over** drops voice lines still waiting and lets the talking one finish; a new game or the title stops all voice
  (game-designer and audio-director's recommendation, told to Matt).

**What merged** (ls2-slab `a70bddf..6e85b81` and ls2-booth on top, tip `a889b75`, off `c8ed43b`): one voice at a time
(a kill word waits 0.45 s after the death and queues behind a talking line; OPENED at most every 20 s and skipped when the
comms is busy); voice lines pass the 15-sound cap by evicting an ordinary sound; voice gain jitter 0.95-1.05; empty
folders stay silent with no window. No sim change: `sample()` draws only the audio RNG.

**Gates** on 8e6319a (logs start with the sha): typecheck, vitest 1195 + the known `it.fails`, build + dist grep, harness
short/long4/12 scenarios with no `--update`, parity PASS (a first parity run failed from a stale dev server after a booth
keep in `src/sfx/`; it passed on a fresh server). The parent re-ran build, typecheck and vitest on the merged tree.

**Studio review.** In-lane art-director, technical-artist, web-specialist x2, qa-tester x2, security-engineer,
tools-programmer, ux-designer, audio-director. All 8 leads and all 3 directors APPROVE WITH NOTES; no block. The lead S2s
were fixed in 35720c3; this record is the directors' S2.

**Rollback point:** tag `pre-ls2-voice` on `c8ed43b`.

**Next (Matt's time):** record the 13 SLAB lines in the booth from the main checkout (check PipeWire isn't running its own
echo-cancel or noise module first); then audio-director's listen-check (pumping, hiss, length, "is it deadpan?") and
`git status src/sfx` before the takes are committed as one batch with a hierarchy pass; then qa-lead's real midboss-death
check (jaw open and shut, the real caption font, gore masking on the Fold speaker). No SLAB line is done until that passes.

**Owned items (backlog, S3):**
1. Matt decides after hearing dry takes: a runtime radio filter on SLAB (band-pass ~250 Hz-4 kHz, light saturation, never
   baked into takes) (audio-director).
2. A max wait (~1-1.5 s) for queued ordinary lines, with a test; measure lateness first (audio-director, game-designer).
3. Gore masking the kill word: listen first, then an SFX bus and dip only if needed (audio-director).
4. Booth: export and test `realDir()` and the POST/DELETE paths; 4xx for client faults; flag stale takes whose slug no
   longer matches the text; typecheck `tools/booth`; test every wired slot against VOICE_CAT (qa-tester,
   tools-programmer, lead-programmer).
5. Slab art in the off-repo generator: 2-3 darker gore values, a 1 px frame gutter (technical-artist; art-director signs).
6. Delete the dead vector `drawSlab` (hype.ts:9-60, hell.ts:112); caption/audio mismatches (a kill word under a HYPE
   caption, a banner ending before its queued word) with D48 item 4 (gameplay-programmer, ux-designer).
7. D18 canon: Matt's face is both the title head and SLAB (narrative-director, writer).
8. Strip $HOME paths from committed gate logs; smaller evidence PNGs (release-manager).


### D51 Voice booth chain after Matt's first takes — merged 2026-11-09 (parent; Matt: "yes set the levels and do the booth change")

**Why.** Matt's first three takes clipped: the laptop mic had +60 dB of gain (Internal Mic Boost +30, Capture +30, source
100%). audio-director's listen verdict: redo all three; the input was the cause, and the chain also lifted room noise into
the gaps. The parent set the source to 40% (about -24 dB); PipeWire drives the boost on this path and set it to 0.

**What merged** (ls2-booth2, `98d07f2..7ad5725`, tools/booth and tests only; no game code, nothing in dist): an expander
between phrases (room average + 15 dB, capped 8 dB under speech, 150 ms release; gaps land about -37 to -41 dBFS); a raw
clip guard at -0.5 dBFS per channel (the raw is still saved); a length warning (target + 0.5 s; never refuses); a pause
squeeze (pauses over 0.4 s to 0.25 s, per-take checkbox, default on, the choice saved with the take); meter band -10..-6 with
HOT at -3 and CLIP at -0.5; reprocess (booth button and `node tools/booth/reprocess.mjs`) over kept raws, skipping clipped
raws and deleted takes. README: the real input level and "unhurried, fewer pauses, not a faster read".

**Ruling (creative-director):** on CALAMARI SERVED the joke wins over the length target: untick the squeeze and keep the
beat before SERVED, LONG warning accepted. Squeeze default on is right for SLAB's other lines.

**Gates** on e012f37: typecheck, vitest 1235 + the known `it.fails`, build + dist grep 0 hits. The parent re-ran all three
on the merged tree. Harness not needed (no src/ change).

**Studio review.** In-lane audio-director, tools-programmer, qa-tester. All 8 leads (localization: no impact) and all 3
directors APPROVE WITH NOTES; no block. Lead S2s fixed in e012f37.

**Rollback point:** tag `pre-ls2-booth2` on `98d07f2`.

**Next (Matt):** restart the dev server; one test line to confirm peaks land -10..-6 at 40%; re-record the clipped slots;
audio-director listen (expander tails on real voice) and narrative-director listen (deadpan, one hype line squeeze on/off)
before the keepers are committed as one batch with their own studio pass. Reprocessed .ogg files always get their own
commit.

**Owned items (backlog, S3):** B1 meter readability (art-director spec, tools-programmer); B2 flat-top clip warning
(audio-director); B3 squeeze rules: cap long pauses at 0.4 s, default off for slots with no length target, the ufo note
says untick (decide after the listen); B4 quiet-take expander release; B5 a 4-pole lowpass if hiss is heard; B6 code health
(extract processTake, skipWhy coupling, RAW_RE match, brittle source pins, queue/422 test; one writeTake() if a third caller
appears); B7 kill-word timing probe and proportional slack (game-designer); B8 smaller spectrogram PNGs; B9 per-locale voice
limits if dubbing is ever in scope.

### D52 SLAB's quips — merged 2026-11-10 (parent; Matt: "add calamari served and some other random cheesy one liners I can customize as needed in the sound booth"; picked "On big moments")

**Ruling (creative-director, narrative-director).** SLAB's quips are puns Matt authorized: flavour inside Pillar 5's comms
valve, not a tone exception. A line is a quip only if all four hold: Matt's own voice as SLAB; the comms window with the SLAB
tag; only after a midboss or stage-boss kill; never over the player's death. A deadpan (D50 register) line in
`src/voice/quips.json` that meets those is in tone, and later tone lanes must not "fix" it. Matt may add, edit or delete quips
in the booth without a studio pass on the text; the takes still need the D50/D51 audio and narrative listen. No precedent for
names, kill words, banners, HUD, log or lore text. CALAMARI SERVED stays the Saucer's kill word (D49, the only pun kill word)
and is also a quip. This amends D39 and D48's "single pun exception".

**What merged** (ls2-quips, `ae0d137..f020135`): `src/voice/quips.json` (CALAMARI SERVED plus 8 seed lines with delivery
notes; ids stay stable when the words change, and old takes are flagged stale); a booth Quips section (add, edit, delete,
record into `src/sfx/quip-<id>/`, squeeze off by default); the trigger: after a midboss kill word (chance .3) or a stage-boss
kill (.5, GATE SEALED included), a shuffle bag (each quip once before repeats), never the kill word just said, skipped when
the comms is busy or it would start more than 2.5 s (midboss) / 3.6 s (stage boss) after the death, dropped by any other
voice line, silent with no takes. **Death cut** (the parent's default, told to Matt; all leads and directors agreed): a quip
talking when the player loses a life or at game over fades out; kill words still finish (D50). Audio RNG only; harness and
parity unchanged. `?vox=quip` test hook (dev only).

**Gates** on 50b8e00: typecheck, vitest 1324 + the known `it.fails`, build + dist grep, harness short/long4/12 scenarios,
parity, all with no `--update`. The parent re-ran typecheck, vitest and build on the merged tree.

**Studio review.** In-lane writer, narrative-director, audio-director, security-engineer, qa-tester, tools-programmer,
gameplay-programmer. All 8 leads and all 3 directors APPROVE WITH NOTES; no block. Lead S2s fixed in 50b8e00.

**Rollback point:** tag `pre-ls2-quips` on `ae0d137`.

**Next (Matt):** restart the dev server; record quips in the same SLAB session as the other open lines; one audio + narrative
listen (-12 LUFS, deadpan, quip level against the kill word); booth stale count 0; one batch commit with a studio pass. That
batch is the documented playtest: a real midboss kill and a real stage-boss kill into a quip, shot in a real build and once on
the Fold. "SLAB quips" goes into the player changelog only with that batch.

**Owned items (backlog, S3):** a shared SLAB_MIX, quip no louder than the kill word (audio-director); un-duck the music when a
quip is dropped (audio-director, gameplay-programmer); BOSS_READOUTS from one source or pinned (lead-programmer); stubbed-AU
tests for the busy/lateness branches and `?vox=quip` (qa-lead, qa-tester); a pre-push stale-take check if quips are edited
often (release-manager, tools-programmer); playtest watch: DEAD WEIGHT / LEAVE IT read as "skip the pod", the real heard rate
(game-designer); an optional per-quip "after" list so CALAMARI SERVED follows tentacled kills (narrative-director, if Matt
wants it); i18n when scoped: quips.json in the inventory, the no-repeat rule keyed on ids, transcreation, captions vs
subtitles (localization-lead).

