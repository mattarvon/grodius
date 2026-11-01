<!-- Generated 2026-10-31 by the Grodius studio (full hierarchy) against main @ 090764d. -->

# Direction brief: where Matt's head is at

*Producer, 2026-10-31. Evidence comes only from commits up to and including 39bb121 (2026-10-30), Matt's hub notes, and the build as it renders today. Commits after 39bb121 are studio work and are not treated as Matt's taste.*

## 1. What he's building, and why, in his words
- **"Gradius-style horizontal shooter with an Event Horizon aesthetic"**: he wrote that himself into README:3 on day two (463db504).
- **"Grodius = Gross Gradius: pus, vomit, snot, maggots, farts on every boss"**: since 10-25 the identity is "ultimate gross-out" (hub:9, CHANGELOG 2026-10-25, 127e8f7).
- **The ship's hull mutates as you power up.** "Every in-run upgrade is a felt jump in power, look and sound" (46e7746, e9ef2fa).
- **Event Horizon plays the straight man.** It shows up as deadpan system text ("LOST 7 YEARS. BACK 9 DAYS.", "THE MERIDIAN KEEPS WHAT IT CATCHES"). The punchline is juvenile comms comedy ("STOP KILLING ME WITH YOUR SPACESHIP, SIR").
- **It's personal.** His family's voices are in it: Matty's recordings (8bc41dc, 06dcb49) and Lesley's "yeah baby" (0072992).

## 2. What he cares about, ranked
1. **Gross-out comedy and naming.** He went "Gore x10" (0bf9d1a), ran a 26-commit gross pass as six parallel worktrees (add2b62), and named the bosses himself: BLOATED BITCH (cf377b0), SQUIDFUCKED SAUCER / CALAMARI SERVED (30a6480, "Matt's calls"). He also trims excess: Gore -40% (1f2dcc9). Naming and voice belong to him.
2. **How it looks and sounds.** About 16k lines changed in `src/render`, against under 1k for every gameplay-system file. The title eyeball was redone 3 times (0f4ae01, 6074873, 9f93b56). Music was replaced twice (5321977 → 8f47163 → d45d31d). He did a 29-slot sprite picker on 10-28.
3. **Fights that feel strong and quick.** In 48eb7cb he reversed his own 10-03 rule (140c0ac): rank should change a fight's **shape** (cadence, density, bullet speed), not make enemies tankier. In d0115f4 he pushed the pressure up because hits/min had dropped from 1.1 to 0.4.
4. **Fair, but brutal.** He keeps asking for "readable enemy fire", "fair rear spawns", "fair laser" and "no first-sight build hitch". Fairness never means softer: the saucer went from 90 to 80 HP only because "90 was unkillable naked".
5. **Variety.** Unmistakable biomes, remixes per descent (b1179cc), elites, and drones cut to about 30% (7260ba1, 3897e56).
6. **Measuring balance, not going by feel.** hub:109-114 and pacing.md §5. He built probes, `depth.ts` and the playtest bot (32c0350). His last two commits were tuned against a bot.
7. **Personal audio.** He polished it 5+ times: the corner badge (c80e913), clipping fixes (00832a6), a 20 s cooldown (145a0f0), and the trimmed keister line (71971b0).

## 3. Where he's been heading
- **10-02 to 10-07:** he invented systems every few hours (pods, seals, biomes, perks, contraptions, Infirmary).
- **Since 10-25:** almost no new systems. He has been dressing what exists (JWST skies, tissue textures, CC0 sprites, gross redraws) and tuning against bots.
- **Commit wording moved** from "add X" to "measured, retuned".
- **How he works:** late-night bursts across about 9 days, directing parallel Claude worktrees and merging the same night. He makes the taste calls and lets agents implement them.
- **His last stated intent (48eb7cb, d0115f4):** pressure that changes shape, harder fire, and depth HP kept on purpose after D1.

## 4. Open threads and wishlist he wrote down
- **Zanac-style ALC** (pacing.md §3.5): rank reacts to how you're playing, with a breather after a death. Not built.
- **Rank-shaped boss patterns** (pacing.md §3.6): rRootage/Taisei style, extending `every()` to the Maw and the Drive. "Still to do." This is the natural next step after 48eb7cb.
- **Descent-1 Drive fight runs 51 s** against his 30-45 s target (hub:117).
- **Escaped Maw costs nothing.** pacing.md §4.5 says it's "probably intended; note it in the help text".
- **Biome pod-rate swing** of 2.8 to 12 per minute (§3.4). Pity timers were shelved.
- **The README is stale** (still lists THE HULL/THE CORRIDORS and a 3-pod boss reward). Stable keystore not made.
- **The Infirmary gets bought out** and there's nothing later to spend biomass on (dfa0c30 only raised prices).
- **Sprite picks may be unused:** 20 picks across 29 slots, about 8 groups built (10-28).
- **Nobody has played tune-pressure v2** (d0115f4). Only the bot has.

## 5. What he has NOT shown interest in (don't push it)
- **Toning the game down for an audience.** He built a coworker-safe share edition and reverted it "byte-for-byte" (0e1ca06 → 665c94d). His only restraint is no upside-down crosses (hub:84, 145a0f0).
- **Lore as story.** There's no canon doc. The Event Horizon world lives in about 20 terse strings, and no commit deals with crew or story beyond corpses (ecc5f96) and MERIDIAN plating (a4dbceb).
- **Faithful Gradius for its own sake.** The power meter is an option, and PODS stays the default (7b3b8ba).
- **Process, typing, CI, release engineering, distribution, store presence, localization, seeded runs.** Phone play shows up only as infrastructure (dba41c0, the POWER button), never as a goal.
- **Art-grammar consistency.** He mixes bitmap and code art on purpose (6a870f7). An art bible would be the studio's idea, not his.
- **Accessibility as a feature.** He kept the flashes toggle working as a rule, but did no proactive a11y work.

## 6. Tensions with the studio's roadmap
- **The studio has been deciding for him.** D1, D2, D3, D5b and D11 were set by the studio under "do it all" (decision-log:27-29) and are provisional until Matt plays. M1 and M2 are both unplayed, so the studio is stacking provisional calls on top of provisional calls.
- **M1 "safe and fair" is studio-shaped, not Matt-shaped.** Flash prompt and limiter, OPTIONS menu, save export. All defensible, but his last 6 days were gross art and pressure tuning. Check that the flash limiter (D3, ≤3/s) hasn't flattened HELL FLASHES, his main "glimpse of hell" device.
- **M2 "one power rule" is accounting work.** The weight tables follow 48eb7cb, but what he actually wrote next was §3.5/§3.6: patterns that change shape with rank, and ALC. Those aren't on the roadmap at all. The roadmap fixes the bookkeeping and skips the payoff he was after.
- **Drive rank HP.** Under D1 the studio removes it. His own data says the D1 Drive is already 51 s, too *long*, so removal goes his way. But he never ruled on the Drive specifically. 48eb7cb left it alone.
- **Deferred list vs his taste.** The roadmap defers the GROSS tier dial (D13) and talks about a player-facing TAME option. He has only ever used GROSS knobs to dial *down* excess, and he killed the tame build. Don't ship TAME without asking.
- **The no-crosses pass (D8) may overreach.** The "all cross and halo imagery" recommendation goes further than his rule, and THE BLOATED BITCH sits on a crucifix rack (bboss/crux-2-exposed.png). Clear the scope with him before touching his boss art.
- **Weighting.** The roadmap spends most of its effort on gates, RNG split, typing and licensing, which he has shown no appetite for. M3 biome bosses (D11), the Drive timing and authored hell imagery are closer to what he cares about. An art bible and canon doc are fine as reference, but not as gates on his content.
- **He has never used a human playtest loop.** The studio's "Matt plays each milestone" plan asks him to play-feel when his habit is "measure, not feel". Make the playtest short and pointed (see Q1).

## 7. Questions for Matt
1. **Play tune-pressure v2 and M1 on the Fold for 10 minutes.** Is the uncapped fire fun, or just mean? Are hits/min where you want them?
2. **Is §3.6 (rank-shaped boss patterns) and §3.5 (ALC) your next thing?** If so, should it replace or come before the rest of M2's accounting?
3. **Gravity Drive.** Drop its rank HP (D1) and aim for 30-45 s in D1? Or keep it as the one tank fight?
4. **Did the D3 flash prompt and limiter take the punch out of the HELL FLASHES** for you with flashes ON?
5. **No-crosses scope.** Player-facing text only, or all imagery, including the Bloated Bitch rack?
6. **Gross dial.** Internal only, or do you want a player-facing TAME/GROSS/ULTIMATE? And who is the game for (D15): you and friends, coworkers, or itch?
7. **Event Horizon.** Do you want more on-screen "glimpses of hell" and changed crew (authored hell art, crew in the corridor)? Or should the lore stay as terse strings?
8. **Should dread and gross land in the same moment** (e.g. a crew member who pleads, then bursts), or keep taking turns?
9. **Sprite picks.** Which of the 20 assets you picked still aren't in the game, and do you want them?
10. **Biomass sink after the Infirmary.** Cosmetic hull mutations, options, or nothing?
11. **More recordings** from Matty and Lesley (D9)? And does Lesley consent to her voice being public (D7)?
