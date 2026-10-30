# Grodius pacing bible

How fast things should happen, compared with games that get it right. Numbers are at 60 steps/s and 1 px of scroll per frame at full speed, so **60 px ≈ 1 s**.

The open-source references are cloned outside the repo, in `E:\projects\grodius-refs\`. They are third-party code (MIT / GPL-2 / BSD), and this public repo must never contain them; read them there.

| Ref | License | Read this |
|---|---|---|
| Taisei | MIT (+ CC-BY/CC0 assets) | `taisei/src/stages/stage*/timeline.c`, frame-timed stage scripts |
| OpenTyrian | GPL-2 | `opentyrian/src/mainint.c` `weapon_upgrade_cost`, the shop economy |
| rRootage | BSD | `rrootage/{normal,morph,...}/*.xml`, 68 BulletML boss patterns with `$rank` |
| bulletml.js | no license file | reference only, do not copy |

Gradius and Zanac notes come from general knowledge of the games, not from source code. Treat them as design intent, not exact numbers.

---

## 1. What the references do

### Taisei (Touhou-style, vertical): one stage ≈ 2.5 min
Stage 1 timeline (`stage1/timeline.c:699-800`), in frames:

| t (f) | t (s) | Beat |
|---|---|---|
| 100–660 | 1.7–11 | Five small waves, each a different enemy behavior, introduced one at a time |
| 900–2200 | 15–37 | Mixed waves, density rising |
| 2500 | 42 | Bookmark *pre-midboss*: a short breath |
| **2700** | **45** | **Midboss** |
| after midboss | +36 | **Filler shortened by the midboss fight time** (`time_ofs = -midboss_time`) |
| ... | ... | Three more filler sections, each adding one new idea |
| +2560 | ~43 | **Boss**, with several attacks of ~20 s and ~26k–30k HP each |

Stages 2–5 use the same skeleton: midboss at 2700–3200 f (45–53 s), boss about 2.5 min in.

What to take from it:
1. **Introduce one enemy idea per wave**, and mix only after each idea has been seen alone.
2. **Midboss at ~45 s, boss at ~2.5 min.** The midboss splits the stage into two halves of about one minute each.
3. **The time after the midboss is fixed.** A fast midboss kill doesn't make the stage longer or shorter.
4. **Every drop is placed by hand.** `ITEMS(.power = 2, .points = 4)` sits on specific enemies, with no random roll. Power arrives on a schedule the designer chose.
5. **Boss = a list of attacks, each with its own HP bar and timer.** The timer ends a phase even if you don't break it.

### Gradius (side-scroller): the capsule economy
- **Capsules are predictable.** Red enemies and **whole formations** always drop one. Players learn where power comes from, and full-formation kills reward accuracy.
- **A rising power meter** (SPEED, MISSILE, DOUBLE, LASER, OPTION, ?). The player decides when to cash in, so power is a decision, not luck.
- **Stage shape:** intro wave, terrain gimmick (volcanoes, Moai, cells), a dense gauntlet, then a Core boss. Typically the boss's barrier walls must be broken before its core can be hit, and **the boss leaves if you take too long**.
- **Death costs everything,** with a checkpoint restart. Grodius uses in-place respawn plus salvage instead, which is gentler and suits a run-based game.

### Zanac (vertical): adaptive difficulty, "ALC"
- The game watches **your firepower and how well you're doing** (accuracy, how fast things die, survival) and raises or lowers enemy aggression to match. Strong players get swarmed; struggling players get room to breathe.
- **Timed fortress sections** in the middle of an area: destroy the core before the timer runs out.
- Takeaway: the difficulty curve is a dial that reacts to the player, not a fixed script.

### OpenTyrian: shop prices
`weapon_upgrade_cost(base, power) = base × (1, 3, 6, 10, 15, 21, …)` (triangular numbers, up to level 11). Early levels are cheap, so a new weapon is fun right away. Later levels cost a lot, so you save up and choose.

### rRootage / BulletML: boss patterns that scale
Patterns are XML, and difficulty lives inside the pattern: `<times>1+$rank*1.5</times>`, `<wait>50-$rank*10</wait>`. Grodius already has a rank value (§3.5); BulletML shows how to let rank change a pattern's **shape** (more arms, shorter waits), not just its HP.

---

## 2. Grodius today

One descent = 10000 px = 4 stages (9400 before §3.3). Spawns are keyed to scroll position, and the scroll holds during boss, midboss and fork.

| Stage | Span | Scroll time | Boss |
|---|---|---|---|
| 0 OPEN ORBIT | 0 → 2120 px | **~35 s** | Maw, 120 HP, leaves after 28 s |
| fork | — | up to 15 s | — |
| 1 biome | ~2720 → 4790 | **~35 s** | Biome midboss (§3.2), then biome boss (Crux 145 / Butcher 300 / Maw 120), 2.5 s WARNING |
| fork | — | up to 15 s | — |
| 2 biome | ~5700 → 7860 | **~36 s** | Biome midboss (§3.2), then the biome boss |
| 3 GRAVITY DRIVE | ~8370 → 9300 | **~17 s** (was ~6 s, 8370 → 8700) | Gravity Drive, 560 + 3×48 HP × m |

A full descent runs roughly 4–6 minutes, including fights, tally cards and forks.

### Side by side

| | Taisei stage | Gradius stage | Grodius stage |
|---|---|---|---|
| Time before boss | ~2.5 min | ~2–3 min | **~35 s** |
| Midboss | every stage, ~45 s in | some stages | **stage 2 only** |
| Density shape within a stage | ramps up, with breaths | intro → gimmick → gauntlet | **flat** (biome spawner rolls the same odds for the whole span) |
| Calm stretches | bookmarked before midboss and boss | after the gimmick | **none inside biome stages** |
| Power source | placed by hand | placed by hand (red / formation) | **mostly random** (per-enemy chance × 35%) plus formation pods |
| Run-up to the final boss | full stage | full stage | **~17 s** (was ~6 s, §3.3) |

Grodius stages are shorter and hit harder than either reference. That suits a run-based game on a phone: descents are meant to be repeated. The problems are not the length but the **shape**: a stage has no rise and fall, there's only one midboss, and the final boss arrives almost immediately.

---

## 3. Recommendations
Ordered by how much they help for the effort. Each lists the code to touch and how to measure it.

### 3.1 Give biome stages a shape (highest impact)
`src/biomes.ts:160-176` spreads slots evenly with the same `gap` and `dbl`. Make both depend on how far through the span you are, `p = (x - a) / (z - a)`:

| p | Beat | gap × | dbl | Notes |
|---|---|---|---|---|
| 0–0.20 | **Intro** | 1.4 | 0.2 | Weight the mix toward the biome's signature enemy, introduced alone |
| 0.20–0.45 | **Build** | 1.0 | base | Normal mix; set piece at 0.30 (already there) |
| 0.45–0.55 | **Breath** | no spawns | — | Show off a terrain or hazard; one guaranteed pod formation |
| 0.55–0.90 | **Peak** | 0.8 | base + 0.15 | Set piece at 0.75 (already there); more enemies from behind |
| 0.90–1.0 | Pre-boss | — | — | Already empty (spawns stop at bossX − 160) |

The total spawn count stays about the same; it just bunches up. Measure with `route-probe.mjs`, which needs no new checks, and add a spawns-per-second histogram per stage to `progression.mjs`.

**Done (branch `pacing-pass`).** What shipped differs from the table above in three ways:
- **Peak gap is ×0.75, not ×0.8.** At 0.8 the slow intro cost more spawns than the peak gave back.
- **The intro rolls the signature enemy 60% of the time,** and the very first slot is always the signature enemy, alone.
- **Stage 2's breath is a 10% window ending just past the mid-stage Maw.** The real start point after the fork puts the Maw at p ≈ 0.59, not 0.5.

Results from `node tools/density-probe.mjs <url>`, averaged over 400 rolls:
- **Intro:** about 0.5 spawns/s (was 0.8–1.0).
- **Breath:** 0 in stage 2, one pod formation in stage 1.
- **Peak:** 1.0–1.7 spawns/s (was 0.6–1.1).
- **Total per biome:** −2% to −4%.
- `route-probe` passed on all 4 gate routes.

### 3.2 A midboss in every biome stage (done)
At the moment only stage 2 gets the mid-stage Maw (`src/biomes.ts:172`). Give each biome its own **cheaper version of its boss**, for example an ice "Nail Choir" (2 nailbars and an eye) or fire "Butcher's Apprentice" (cleaver only), at **p = 0.5**, where the breath beat from §3.1 lands. Keep the Maw's escape rule (a time limit of about 20–28 s, and escaping costs nothing) so a weak build isn't stuck.

Because Grodius spawns are keyed to scroll position and the scroll holds during `G.mini`, stage length in pixels is already fixed. The Taisei trick of shortening the filler only matters if you later add time-based events.

**Done (branch `biome-midbosses`).** Each biome has its own midboss (`midboss()` in `src/enemies/spawn.ts`, `case 'choir'/'cyst'/'prentice'/'brood'` in `src/enemies/update.ts`). It appears in **both** biome stages and replaces the stage-1 breath formation and the stage-2 generic Maw:

| Biome | Midboss | HP (×mk) | Attacks (each telegraphed) |
|---|---|---|---|
| ice | THE NAIL CHOIR | 80 + 2 nailbars × 26 | Glare 40f → spike fan of 5 (7 once both nails are gone); nails glint 36f → 3-spike fan each; ring under 50% |
| acid | THE DISSOLVING WOMB | 135 | Crown bubbles 45f → geyser of globs lobbed onto the ship; bloats 30f → ring; longer sprays under 50% |
| fire | THE BUTCHER'S APPRENTICE | 150 | Lunges behind the Butcher's sweep cone (50f, r 84) → cleaver; mouth glows 24f → 2 ember fans; ring under 50%. No hook |
| snot | THE BROOD MOTHER | 105 | Heaves 44f → litter of 3–5 hatchlings (+2 under 50%, max 10 alive); nostrils flare 26f → 3 volleys of snot globs |

- The WARNING goes out 210 px before the breath ends, so the midboss lands about 60 px before the breath ends and the scroll coasts to a stop inside it. That's at p ≈ 0.52 in stage 1 and p ≈ 0.59 in stage 2, where the shifted breath window is unchanged.
- **Escape:** it leaves at t = 1400f (about 23 s, entrance included) at no cost. The phase fuse in the HUD shows the time left. A kill drops 2 pods. (The generic `maw(false)` actually dropped 3: its `cap` flag plus 2.)
- The Brood Mother's litter is tagged `kid`. It doesn't count toward `spawned` or stage kills, so the grade isn't affected, and it doesn't feed graft counters. Midboss kills count as Maw kills for GLUTTONY.
- Measured with `tools/midboss-probe.mjs` (bot time, each fight in its real biome), TTK in seconds, esc = left first:

| Loadout | Maw (mid) | Nail Choir | Diss. Womb | Apprentice | Brood Mother |
|---|---|---|---|---|---|
| Naked | esc | 20.7 | 15.9 | 22.2 | 19.2 |
| Stage 1 kit | 13.1 | 15.8 | 12.6 | 10.4 | 14.2 |
| End descent 1 | 7.7 | 9.6 | 8.2 | 6.4 | 6.2 |
| Strong D1 | 4.9 | 2.4 | 3.3 | 4.3 | 2.9 |

- The stage bosses are unchanged (`boss-probe`: Maw 12.9, Crucifer 36.0, Butcher 29.7 s with a stage-1 kit). `route-probe` passed on all 4 gate routes over 2 descents, plus a forced fire → snot run: every biome's midboss spawned in both stages, with no errors, no slams and no bad hazards. `density-probe` shows breath = 0 everywhere now.

#### Open Orbit midboss: THE SQUIDFUCKED SAUCER (branch `up-midboss`)
A wrecked saucer gone to meat (`src/enemies/ufo.ts`, art `src/render/gross/ufo.ts`). WARNING at Open Orbit x 800, lands ~950 (about 45% in). Unlike the biome midbosses it **does not hold the scroll**: from its WARNING until it dies or leaves, the Open Orbit script's filler is skipped (`$.G.eat`, in `runScript`), and it is forced out by x 1840, so the last filler (1880, 1900) and the Maw's run-up always come. That's the Taisei trick ("filler shortened by the midboss time") done in scroll space: the stage stays the same length. The cost is the eaten filler's kills and pods, so it pays out as it breaks up: a pod at 66% and 33% HP, a pod for killing a whole litter, 2 on the kill.

- 80 HP (×mk; 90 was unkillable naked, Matt picked 80 on 2026-10-28). Attacks: LASH (42f, a dashed line tracks you then locks; a tentacle whips ~220 px along it), VOLLEY (tumours swell 36f, then aimed 3-fans of globs), BROOD (belly hatch dilates 40f, a litter of 3+ hatchlings). Under 50%: second lash, second volley, a ring every ~2.3 s.
- `midboss-probe` TTK (s): naked esc, stage-1 kit 9.3, end D1 5.3, strong 2.3 (others in the table above).
- `pod-probe` seeds 1-3, Descent 1 (before → after): 1-1 53.6/54.1/54.1 → 55.6/62.1/71.0 s; whole descent 278.6/281.8/295.2 → 282.4/291.1/292.6 s (mean +3.5 s, ~1%); level at end of D1 11/14/12 → 11/11/11. Open Orbit runs longer when a weak kit makes the Maw slower; the descent barely moves.

### 3.3 Lengthen the Gravity Drive run-up
Stage 3 is about 500 px, roughly 8 s. That's too short to feel like arriving at the last boss. Options:
- **A (cheap):** script a 300 px gauntlet before 8300, with the WARNING banner over it and the music change starting early. Total length stays the same.
- **B:** raise `LEVEL` to 10000 and `BOSS_AT` to 9300 (`src/core.ts:533-538`) to make a 15–20 s approach. This touches the biome terrain handoff (`biomes.ts:122`), so re-run `route-probe.mjs` afterwards.

**Done (branch `stage-scripts`), option B.** Measured, stage 3 really started at ~8370, not 8200: the stage 2 boss's WARNING lets the scroll coast to ~8170, and the next stage starts 200 steps after the kill. So the old approach was **6.0–6.6 s**.
- `LEVEL` 10000, `BOSS_AT` 9300. Everything keyed to the chamber moved +600 px in `world.ts` (`AMT.corr`/`core`, the `fT`/`cT`/`kT` fade-outs, `zT`) and in `render/terrain.ts` (`drawInterior`). The biome handoff `T_END0/1` stays at 8300–8600, so the biome hands back to the MERIDIAN corridor, which then opens into the chamber over 8900–9300.
- `buildScript` PHASE 4 (8430–9150) as first shipped (now remixed per descent, below): sine + crew, two divers from opposite sides, wall eyes, a behind wave, zig + flayer, a wall, a flayer pair (Descent 2+: hatchlings and an extra diver), then **WARNING: GRAVITY WELL CRITICAL** at 9060 and a ~4 s breath of drifting corpses before the boss.
- **Approach (stage 3 start → boss): 16.5–17.6 s, mean 17.0** (`pod-probe` seeds 1–5). The "approach" track now plays for that long before the `boss3` track.
- Stage 1-4 is 67.9 s on average (53.5–82.4), up from 58.0 s. Gravity Drive TTK with an end-of-Descent-1 kit is 32.0 s (was 32.2). `route-probe` passes on all 4 gate routes over 2 descents: minGap 114.7–138.1, 0 slams, hazards bad=[], errors none. One run in six logged a single `state:icicle`, a hazard spawned in the same frame a stage 2 tally began. It didn't repeat in two reruns of that route, and it's in biome code this change doesn't touch.

#### Open Orbit and the Drive approach, remixed (branch `tune-remix`)
A bot playtest (`tools/playtest.mjs`) showed stage x-1 and x-4 replaying the same script every descent (100% of kinds and the same wave order; only the drone count grew 5 → 8 with rank) and drones making up 54–75% of their spawns. The two scripts now live in `src/enemies/scripts.ts` (`spawn.ts` re-exports `buildScript`) and are cut into sections, each with hand-made variants:

| Section | Scroll | Variants (0 = Descent 1's classic; D3+ = unlocks in Descent 3) |
|---|---|---|
| Orbit A, intro/build (always plays) | 200–760 | 0 classic (sine, sine, crew, lone sentry, hatchling swarm, divers) · 1 debris field (crew first, a sine weaving through, sentry pair, flayer, swarm) · 2 ambush (opens with a rear wave, crew, swarm head-on, sentries high and low) · 3 sentry picket, D3+ (two pods park high/low, a zig runs the gap, crew, flayer, swarm from behind) |
| Saucer WARNING | 800 | fixed (`UFO_AT`); the filler up to `UFO_GAP_END` 1840 is still eaten while it's up |
| Orbit C, peak (eaten while the Saucer is up) | 980–1780 | 0 classic · 1 brood swarm (floods from both sides, sentry cover, one sine, one dive) · 2 flayer alley (flayer pair over a drone wall, rear wave, swarm, late sentry) · 3 hull breach, D3+ (logline, a cascade of six corpses under a sentry, divers top and bottom, flayer pair, sentry pair) |
| Orbit D, run-up (always plays) | 1880, 1900 | 0 hatch 8 + flayer · 1 sentry over a small zig, swarm from behind · 2 rear wave, flayer + corpse |
| breath, Maw | 2000, 2120 | fixed |
| Drive E, corridor gauntlet | 8430–8700 | 0 classic (the first mutant, alone; high sine, crew, swarm from behind) · 1 the hulk (mutant on the floor, ceiling crawlers, a sine down the middle, crew, sentry, swarm) · 2 crew drift (mutant, a womb on the ceiling, four corpses pulled aft, zig, flayer, swarm) · 3 lockdown, D3+ (sentry pair, drone wall, swarm from behind, crew; no meat) |
| wall eyes | 8730 | fixed |
| Drive F, rising pressure | 8760–8995 | 0 classic (sentry, rear wave, flayer, swarm, flayer pair) · 1 meat in the wind (rear wave, swarm through crew, sentry pair, flayer pair) · 2 gauntlet (swarm from behind, drone wall, sentry over a flayer, late sine) · 3 the crew wakes, D3+ (logline, crew, flayer pair, swarm + sentry, zig) |
| WARNING: GRAVITY WELL CRITICAL, breath, Drive | 9060, 9150, 9300 | fixed |

- **Picking:** Descent 1 always plays variant 0, and variant 0 never comes back. From Descent 2 each section picks a remix with the gameplay RNG at build time (`pickV`, so a seed replays the same run), preferring one this run hasn't played and never last descent's. Descents 1, 2 and 3 therefore never share a section's variant.
- **Mutants and the corridor floor:** the floor gives out over world x ~8980–9200 (the drop into the chamber), and `mutant()` spawns at scroll + 504, so mutants (and floor/ceiling crawlers, wombs) only fit at scroll ~8430–8470. Open Orbit has no terrain, so its kinds can't change across descents (drone, corpse, sentry, flayer, hatch); its variety is in the formations, mixes and order.
- **Drone budget:** `formation()` adds `round(3·rank)` drones per wave, so a remix wave is a base 3 (Orbit) or 4 (Drive). Each script keeps to about three drone waves.
- **Descent 1 changes:** the 420 sine is 4 drones; the corpses move to 500, the lone sentry to 580, a 5-hatchling swarm takes 660 and the dive (4) moves to 730 (the old 820 dive was always eaten by the Saucer). In the peak, the 1220 sine became crew, a sentry joined at 1400 and the 1760 dive became a swarm. The Drive approach starts with the first mutant at 8440, trades the 8600/8670 dives for a swarm from behind, drops the 8850 zig and the 8920 wall for a hatchling swarm.

`playtest.mjs`, seeds 11 and 7, 3 descents, before (`s11.txt`/`s7.txt` at `32c0350`) → after (`assets-raw/playtest/remix/v4-*`). Drone share of spawns, and the top wave signature:

| Stage | Seed 11 before → after | Seed 7 before → after |
|---|---|---|
| 1-1 | 60% → 32% | 54% → 40% |
| 1-4 | 75% → 36% | 75% → 31% |
| 2-1 | 70% (top dronex8 ×5) → 48% (sentry ×2) | 70% (dronex8 ×5) → 35% (corpsex3 ×2) |
| 2-4 | 72% → 40% | 71% → 31% |
| 3-1 | 73% (dronex8 ×5) → 37% (sentry ×2) | 72% (dronex8 ×5) → 41% (sentry ×2) |
| 3-4 | 73% → 30% | 71% → 41% |

- Distinct wave signatures per stage: x-1 9–10 → 12–13, x-4 6 → 8–9. The 8-drone formation is no longer the top wave in any of these stages.
- Kinds shared with last descent's stage: x-4 100% → 88% (crawlers in one remix, a womb in another). x-1 stays 100%: Open Orbit has no terrain for anything new.
- Would-be hits per minute (invincible bot, whole run): seed 11 0.4 → 1.0, seed 7 0.2 → 0.4. Hatchling swarms and the mutant's lobs add body contact; still low.
- `route-probe` 0 1 2 and 1 0 2: every boss and midboss spawns in both descents, 0 slams, hazards bad=[], 0 deaths, no page errors (only the worktree's `@fs` font 403s). `harness.mjs` st: `{"state":"over","score":1332,"scroll":3509,...}`, identical over two runs (was score 2869, scroll 2168: the build-time RNG calls shift the stream).

### 3.4 Power you can predict
> **Baseline update (2026-10-15):** pods are *not* scarce. The first pod lands at 5.7 s and the rate is about 2× the targets below (§5), so **skip the guaranteed drops and the pity timer**. If anything, the open question is whether biome stages, at 7.7/min with a range of 2.8–12, are too swingy. The real problem in the baseline is **biome bosses running long with a stage-1 kit** (Crucifer 36 s, Butcher 30 s, bot time; real fights take about twice as long), so §3.6's timed phases matter more.

Typed pods come from `cap` flags that are kept only 35% of the time (`spawn.ts:160`). Effective drop rates are 5–12% per tough enemy, so pod timing is mostly luck.
- Add Taisei-style **guaranteed drops** on a few scripted enemies in stage 0 (for example, the formations at 200, 700 and 1380 px always drop a pod), so **the first pod lands within about 10 s** and the second by about 25 s.
- Keep the random drops in biomes, but add a **pity timer**: if no pod has dropped in the last N seconds (start with 20 s), the next `cap` roll always succeeds.
- **Tension to resolve:** formation size grows by `round(3·rank)` drones (`spawn.ts:202`), so strong builds need more kills to get a pod. That's Zanac-like, and probably intended. Check with `meter-probe.mjs` that METER mode doesn't stall at high rank.
- Target, measured with `progression.mjs`: ~LV3 after stage 1 and ~LV10–11 at the end of descent 1. These are already written down in `perks.ts:45`; record the measured values in this doc.

### 3.5 Make rank react to how the player is doing, not just their gear (Zanac ALC)
Rank is currently `(gear power + perkPower)/14` (`step.ts:357-360`). Add a small term for how the player is doing:
- `perf` = an exponential moving average over about 20 s of (kills per second, normalized) minus (hits taken × k), clamped to ±0.15.
- `rank = clamp(gearRank + perf, 0, 1)`.
- After a death, `perf` is set to −0.15 for 10 s; your guns are gone, so give some breathing room on top of the rank drop you already get.

The effect: dominating players see bigger formations sooner, and struggling players get a short break. Keep it small. The player should feel it, not notice it.

### 3.6 Bosses: phases with timers, patterns that scale with rank
> **Timers done (`pacing-pass`):** `phaseClock()` in `src/enemies/update.ts`. The Crucifer and the Butcher get 25 s per half. When the first half runs out the boss is forced into its second half; when the second runs out it retreats (grade C, no reward). A fuse in the HUD shows the time left. The Maw keeps its own 28 s escape rule. Rank-shaped patterns are still to do.

- Biome bosses have one HP pool and a phase change at 50%. Borrow Taisei's **list of attacks, each with a timer**: if a phase isn't broken in about 20 s, the boss moves on to the next one anyway. Long fights stop dragging, and every player sees the whole boss.
- Use rank to change **pattern shape** the way rRootage does (more arms in the spiral, shorter waits), instead of only HP ×(1+rank). At the moment `every()` scales the gaps between attacks, and only Crux and Butcher use it; extend that to the Maw and the Gravity Drive.

### 3.7 Shop prices
Current Infirmary prices already sit near Tyrian's triangular curve. For example, gland 80/200/400/750 is ≈ 80 × (1, 2.5, 5, 9.4), against Tyrian's (1, 3, 6, 10). Contraption level-ups go up linearly (+80, +160 over the buy price). That's fine, because there are only 3 levels.

Bio income is about 270 per full-kill stage 0 and about 900–1200 per descent. That means the first purchase comes after 1 run, and BLACK BOX or DESCEND DEEPER take 1–3 runs. That's healthy, but see bug 1 below.

### 3.8 Biome variety: mixes, elites, repeat-biome remix (branch `tune-variety`)
The `tools/playtest.mjs` bot showed three problems. Drones (wasps) were 50–80% of biome-stage spawns, and 131 of about 150 in one Furnace stage. The new enemies barely showed up: about 1 mutant per Cryovault or Furnace stage and 4–6 slimes per Sinus stage. A biome you'd already visited (descent 3 always repeats; 4 biomes, 2 per descent) replayed its last visit exactly: 100% of the same kinds and the same music.

**Mixes** (`BIOMES[b].mix` / `SET` in `src/biomes.ts`). In biome stages a formation is a size smaller: `FM = 4` drones, plus rank as everywhere else (Open Orbit keeps 5). Drone patterns are only a small weight in each mix, so each biome's own creatures carry the stage:

| Biome | sig | Mix (weight) | SET piece |
|---|---|---|---|
| ice | corpse | corpse 4, cross 3, **mutant 2.5**, flayer 2, eye 2, hook 2, sine 2 | morgue: 3 corpses + a mutant under them |
| acid | **crawler** (was wall) | crawler 4, womb 3, eye 2, hatch 1, wall .7, dive .3; **Descent 2+: slime 2.5** | walls: a double wall of 2(+rank) each, crawler on floor and ceiling |
| fire | flayer | flayer 3, hook 3, **mutant 2.5**, crawler 2, dive .6, behind .4 | pincer: flayers top and bottom, a 2(+rank) rear wave |
| snot | hatch | **slime 5**, hatch 3, womb 3, corpse 2, sine 1.5, crawler 1, eye 1 | flood: hatch flood (7–9 + 4–6 from behind) + a floor and a ceiling slime |

The mutant's and slime's own terrain checks (`mutant()`: floor with 70 px of headroom; `slime()`: floor or ceiling on screen) still apply. Every biome keeps both a gap of at least 108 px and a floor, so they rarely fail.

**Repeat-biome remix** (`remix(b, v, loop)` in `src/biomes.ts`). `choose()` counts visits per biome in `G.bvis` (run-wide). A visit with `v >= 1` earlier visits gets these changes:
- **A second signature and SET.** Ice: mutant + *crucify* (crucifixes on floor and ceiling, a mutant, then another cross). Acid: womb + *gutter* (a womb, two waves of crawler pairs, an eye). Fire: mutant + *kiln* (a mutant under hooks, a flayer, a second mutant). Snot: slime + *drip* (three waves of slimes on both surfaces, a womb).
- **The set pieces move** from p .30/.75 to .22/.62.
- **`drop`**: 2–3 of its kinds are gone, and **`add`** swaps its drone pattern. Ice and snot lose sine and get zig; fire loses dive and gets zig; acid loses dive and hatch and gets a little sine.
- **Crossovers**: 2 kinds from the biome's `pool`, picked fresh with the gameplay RNG each visit. Ice: crawler, womb, slime, hatch. Acid: mutant, hook, flayer, cross. Fire: cross, eye, corpse, slime. Snot: mutant, hook, cross, flayer.
- **More elites** (below).
- **Music**: the same track with a different filter (`BIOME_MIX['ice+']` etc. in `src/music.ts`, chosen through `G.remix[seg]`).

**Elites** (`src/enemies/elite.ts`). From Descent 2 on, every spawn a biome slot makes rolls `eliteChance(loop, v)`: 10% on a first visit in Descent 2, +4% per descent after that, +10% on a repeat visit, and a 34% cap. Drones and hatchlings roll at 0.45× that chance. The roll runs **after** `mk()`, through a wrapper in `biomeScript`, and rear waves and staggered set pieces are wrapped too. `mk()`, `ET`, base HP and fire rates are untouched. An elite gets:
- HP ×1.8.
- Score and bio ×2.5.
- Its own fire cooldown ticks an extra step every 2nd frame, about 1.5× fire rate. Wombs are excluded, since a faster womb only makes more hatchlings.
- A **pustule shot** every 150–210 frames: its pustules swell for 32 frames (they flash white), then it fires an aimed glob, or a 3-glob fan from Descent 3.
- A look: a dark halo plus a pulsing violet aura (`glow()`, cached sprites) behind the body, and 3–5 throbbing violet pustules drawn on the body inside `drawEnemy`'s transform, so the hit flash covers them too. The art is render-only: the layout comes from `e.eid`, rolled at eliteify time, and motion from `$.T`.
- A violet burst on death.

Hooks into shared code: one line each in `updEnemy` (`eliteTick`), `killEnemy` (`eliteKill`) and `drawEnemy` (aura + pustules).

**Knobs:** `ELITE` (hp, pay, fast, pz, tel, swarm) and `eliteChance()` in `elite.ts`. `FM`, the mix weights, `remix` (sig/set/drop/add/pool), `late`, and `remix().sets` in `biomes.ts`.

**Measured.** `tools/kind-probe.mjs` (new) walks the real inserted script of each biome without stepping the game, at rank 0.9, averaged over 30 rolls. The table shows the drone share of biome-stage spawns:

| | ice | acid | fire | snot |
|---|---|---|---|---|
| before | 51–53% | 74–78% | 81–83% | 12–14% |
| after, first visit | 26–30% | 25–31% | 27–33% | 8–10% |
| after, repeat (D3) | 13–15% | 17–18% | 19–21% | 8–12% |

The Sinus was never drone-heavy: its hatchling flood is its own creature. Mutants went from about 1.2–2.7 per Cryovault or Furnace stage to about 5–8 (10–15 on a remix), and slimes from 3.4–5 per Sinus stage to 10–13 (about 21 on a remix). Elites per biome stage: 4–7 on a first visit in Descent 2, 11–14 on a repeat visit. Total spawns per biome stage went down, by about 20% in ice and about 50% in fire. HP to chew through went up, because singles replaced 1-HP drones.

The `playtest.mjs` bot played 3 descents per seed. Before is the bot's run on `32c0350`, the files `assets-raw/playtest/s*.txt`. After is in `assets-raw/playtest/variety/`. The bot now also prints per stage the drone share, the elite count, first visit or REMIX, and kinds and wave signatures shared with the last visit to the *same* biome:

| | seed 11 | seed 7 |
|---|---|---|
| drones in biome stages, before | 52% (fire 1-3: 131/146) | 76% (fire 3-2: 141/167) |
| drones in biome stages, after | **29%** of 457 | **17%** of 408 (3 Sinus stages; non-Sinus stages 12–40%) |
| mutants per ice/fire stage, before → after | 0–1 → 5–11 | 1–5 → 7–9 |
| slimes per Sinus stage, before → after | 4–6 → 7–17 | none visited → 11–22 |
| repeat biome vs its last visit, before | 100% same kinds, same music | 100% same kinds, same music |
| repeat biome vs its last visit, after | snot: kinds 78%, wave signatures 47%, 11 elites, `snot+` mix; fire: 75% / 38%, 12 elites, `fire+` | snot: 75% / 39%, 12 elites; acid: 70% / 47%, 11 elites, `acid+` |

Single stages still swing a lot: a first-visit Cryovault ran 38% and 47% drones in two runs, against 26–30% in the probe. Escapes went up in some stages, up to 26% in an ice stage with 6 mutants, because the singles are tougher than drones. Would-be hits: 1.0 and 0.2 per minute (before: 0.4 and 0.2).

`route-probe` gates 0 1 and 1 0 over 2 descents, including an ice → ice repeat: minGap 135.4 / 128.2, 0 slams, hazards bad=[], no deaths, no page errors. The only console errors are the worktree's fontsource 403s, which are outside Vite's allow list and happen on base too.

`perf-probe` (4× CPU throttle, `WARM_MS=20000`), render avg/p95 ms:
- Base: prentice 9.1/12.9, brood 11.1/16.7.
- After, no elites: 9.5/13.2 and 10.3/13.6.
- With 8 non-elite enemies streaming in (`ELITE=2`): 12.4/17.0 and 14.8/22.0.
- The same 8 as elites (`ELITE=1`): 12.9/19.2 and 15.9/23.0.

So the elite look and attacks cost about 0.5–1.1 ms per frame with 8 elites on screen, which is far more than a real stage has at once.

`harness` is unchanged (Open Orbit only, never reaches a biome): st `{state: over, score: 2869, scroll: 2168}`, identical across runs. Its canvas hashes between frames 1200 and 2400 differ run to run on base too, from render-side randomness.

---

## 4. Bugs and inconsistencies found while mapping
1. ~~**DESCEND DEEPER promises "every stage pays double"** but no code doubled bio.~~ **Fixed (`pacing-pass`):** from Descent 2 on, stage grade bio and the +30 boss choice bio are ×2 (`deepPay()` in `src/stages.ts`), and the tally card shows `DEEP x2`. Kill-orb bio is unchanged.
2. **Hatchlings that come out of wombs count toward `spawned`** (`spawn.ts:159`). That lowers kill% and the stage grade in womb-heavy biomes (acid, snot) for enemies the player never saw arrive. Only count enemies spawned by the script.
3. ~~**Stage 0 is the same in every descent.** `const hard = L > 0` in `spawn.ts:400` is computed and never used.~~ **Fixed (`stage-scripts`):** from Descent 2 on, the sine waves at 420 and 1220 become zig waves, a 4-drone rear wave comes in at 900, and a flayer pair arrives at 1550. Descent 1 is unchanged: seeded `pod-probe` runs match the pre-change code exactly through stage 1-2 (same pod times, first pod 5.7 s). Stage 2-1 averages 48.1 s (45.1–51.6), against 49.4 s before; the stage length is scroll-fixed, so the extra waves show up as kills, not time. `route-probe` 2-1 kills: 99–104 out of 100–104 spawned. **Superseded (`tune-remix`):** Descent 2+ now plays remixed sections instead (see "Open Orbit and the Drive approach, remixed" in §3.3).
4. **Perk count:** `perks.ts` defines 24 perks; CHANGELOG says 26.
5. Escaping the stage 0 Maw grades the stage C and pays no reward, but the mid-stage Maw's escape costs nothing. Probably intended (the first boss teaches you to kill fast); note it in the help text.

---

## 5. Measuring
Every recommendation above should be checked with a probe, not by feel. The probes print to stdout and nothing is saved, so record the results here after each balance pass:

| Metric | Probe | Target | Measured |
|---|---|---|---|
| First pod time (stage 0) | `pod-probe.mjs` | ≤ 10 s | **5.7 s** (seeds 1–5); pods 2 and 3 at ~9 s and ~12–15 s |
| Pods per minute, stage 0 / biome | `pod-probe.mjs` | 4–6 / 3–4 | **10.3** (7.6–12.3) / **7.7** (2.8–12.0), about 2× target |
| Ship level after stage 1 / end of descent 1 | `perk-pace.mjs`, `pod-probe.mjs` | 3 / 10–11 | **LV3** / **LV10.2** (10–11), on target |
| Gravity Drive time-to-kill, end of descent 1 kit (bot; real ≈ 2×) | `boss-probe.mjs` | 25–35 s | **32.2 s** (32.1–32.3) |
| Biome boss time-to-kill, stage 1 kit | `boss-probe.mjs` | 15–25 s | **Crucifer 36.0 s, Butcher 29.7 s**, over target (Maw 12.9 s) |
| Biome midboss time-to-kill, stage 1 kit | `midboss-probe.mjs` | ~13 s (the Maw's) | Choir 15.8, Womb 12.6, Apprentice 10.4, Brood 14.2 s (`biome-midbosses`) |
| Spawns per second by beat | `density-probe.mjs` | intro < build < peak, breath = 0 | after 3.1: intro ~0.5, peak 1.0–1.7, breath 0 (or 1 formation) |
| Bio per descent, harvest bot | `pod-probe.mjs` | 900–1200 | **1109** (867–1283) |

Baseline is commit `5e76336`, measured 2026-10-15; the spawn row is from `pacing-pass`.

**After the 3.1 density shape** (`pacing-pass`, `pod-probe.mjs` seeds 1–5):
- **First pod:** 5.7 s, unchanged (stage 0 is untouched).
- **Biome pods/min:** 8.5 (2.9–15.8), was 7.7.
- **Level at end of descent 1:** 10.2, unchanged.
- **Bio per descent:** 1122 (977–1331), was 1109.
- **Page errors:** none.

The shape changed and the economy didn't, which was the intent. The harvest bot plays a full descent in about 4.3–5.1 min of game time: stages 1-1 ≈ 57 s, 1-2 ≈ 69 s, 1-3 ≈ 86 s, 1-4 ≈ 62 s, including fights, tally and forks.

**After §3.3 + bug 3** (`stage-scripts`, `pod-probe.mjs` seeds 1–5 to the end of Descent 2, with the before numbers re-measured on `8f47163` against a fresh Vite):
- **First pod:** 5.7 s, unchanged.
- **Gravity Drive approach:** 6.0–6.6 s → **16.5–17.6 s**. Stage 1-4: 58.0 s → 67.9 s.
- **Stage 2-1:** 49.4 s → 48.1 s.
- **Level at end of Descent 1:** 12.0 → 12.0 (11–14). On current `main` this was already 12.0, above the 10.2 measured at `5e76336`.
- **Bio at end of Descent 1:** 1304 → 1432 (+10%), from the stage 3 gauntlet's kills and pods.
- **Page errors:** none.

**Probe caveats:** `progression.mjs`, `perk-pace.mjs` and `rig-probe.mjs` can't handle pick screens or forks, or they idle when the boss is off to the right, so they stall partway through a descent. `pod-probe.mjs` is the seeded version that handles both. The probes need `playwright`, which isn't in `package.json`; install it with `npm i --no-save playwright`. Seeded `pod-probe` runs are only comparable against the same fresh Vite session: the first runs on a cold server (while deps are being optimized) came out differently for the same seed and code.
