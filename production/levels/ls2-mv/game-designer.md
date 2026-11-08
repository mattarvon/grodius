# LS2-mv design audit: game-designer (domain lead)

Health summary: CONCERNS. No BLOCKING item. One acceptance metric is read in the most favourable way (Q1), and one rule produces a Pillar 4 repeat (Q2).

Scope and limits. I read:
- the shared brief
- `src/setdraw.ts` and `src/terrainb.ts` in full
- the `src/biomes.ts` hunks (lines 150-180, 226-262, 262-361, 440-515)
- the lane report `production/qa/evidence/ls2-mv.md`
- spec §10 (lines 539-555), plus §8 and §9 for context
- decision-log D19-D22

I did not read the diff file, the raw outputs under `production/qa/evidence/ls2-mv/`, the screenshots or `layout.ts`. The set-share, route-probe and harness numbers below are the lane's, not mine. My shell and grep tools were unavailable, so I ran no probes. The Build B numbers (gap x1.1, double chance base - .1) come from the brief.

Pillars cited are those in `design/game-brief.md` as the spec quotes them: Pillar 4 ("never the same twice", which D19 keeps) and Pillar 3. The §9 phone rule on punishing shooting is untouched by this lane.

---

## 1. Freshness: is "3 of 5, no replacement per run, refill when exhausted" right?

**The rule is a sound mechanism and the wrong size.**

What the rule does well (`src/setdraw.ts:25-35`):
- It matches spec §10 lever 2 ("5 per biome, 3 per stage, drawn without replacement per run").
- Two visits to one biome in a run cover all five pieces (3, then 2 plus a refill), so a within-run repeat is a bug it avoids.
- Uniform draws are already the minimum-overlap distribution for a given catalogue size. **Weighting cannot fix the share.** Any weight that favours some pieces raises the expected overlap. Weights only help when they come from cross-run memory (the `meta.mb` pattern, spec §6.3 step 4), and that needs a save bump.

**The lane's reading of the metric is not the honest one.** Spec §10's target is "Two consecutive runs share at most 50% of wave signatures **per stage**". The brief's "<= 50% of set pieces shared between seeds" does not say per stage or whole run.
- The lane's "worst whole-run 18%" divides a handful of shared pieces by every set piece in the run. That includes every stage where the two seeds took different biomes, which share 0 by construction.
- Route diversity comes from the fork. The catalogue does not provide it.
- The question the catalogue answers is: given the same biome in the same stage, how alike are two runs? That is the 60% figure, which the lane filed under "open risks" while the checklist row says PASS.
- 60% is not a tuning miss. It is arithmetic. For a uniform draw of 3 from N, expected overlap is 9/N, so the share is 3/N: N=5 gives 60%, N=6 gives 50%, N=7 gives 43%, N=8 gives 37.5%. The minimum overlap at N=5 is 1 piece (33%), and the distribution is 10% / 60% / 30% for 1 / 2 / 3 shared. Only the 10% case meets the target.
- On the per-stage reading, the acceptance row should read FAIL (60% against 50%), not PASS. Both readings should be shown in the checklist. Honest wording: "whole-run 18% PASS; same-biome same-stage 60% FAIL by construction".
- The playtest's 7-17% pairwise share is also a whole-run figure. It does not answer the per-stage question.

**Ruling for Matt: grow the catalogue to 7 per biome (2 more per biome, 8 pieces).**
- 3 of 7 gives a 43% same-biome share, which is under target with no save change.
- Cost: each of the 12 new pieces is a one-line composition of existing spawn helpers (`biomes.ts:231-242`), so 8 more is a modest edit. The real limit is perceived novelty. Several pieces reuse the same vocabulary (`corpse`, `eyeT`, `mutant`, `flayer`), so a piece shared by count is not always one the player would notice, and a piece that is new by count may not look new. Call this out when the 8 are chosen, and push each new piece to use a different enemy mix from the current five.
- Cross-run memory (store last run's 3 picks per biome in `meta`, exclude them from the next draw) is the right second step. It needs N >= 7 to work: with N=5 the exclusion leaves 2 of 5, which cannot fill 3 slots. At N=7 it gives zero overlap with the previous run, which is exactly §10's "consecutive runs" wording. It belongs with item F's `meta.mb` save work, not in this lane.
- Do not pick weighting as the fix.

**Question for Matt: which reading of the target is binding?** If whole-run is binding, the lane passes as built and a larger catalogue is optional. If per-stage / consecutive-run (spec §10) is binding, the lane fails by arithmetic and needs 7.

**Identity cost of the draw (a silent decision, line 304 of `biomes.ts`).** With `setIds`, `X.set` (the biome signature or the remix signature) is no longer guaranteed. A first visit can play the remix piece (`crucify`) and a remix can play none of its own. The remix's "its own second signature + set" (`biomes.ts:246-247`) is not honoured for the set. This weakens the recognisable-biome and recognisable-remix reads.
- A guaranteed anchor makes the share worse, about 67% by count at N=5.
- Fix once N=7 lands: either a x2 weight on the visit's signature piece, or accept that the signature is a catalogue member like any other. Log whichever is chosen.

## 2. The B0/B1 roll

**p = .5 is acceptable. The roll rule is wrong, and a bug sits under it.**

Measured splits: D2 44/156, D3 26/174. With `moveRoll` (`setdraw.ts:39`), `v > 0` is forced to B1 and a D2+ first visit rolls B1 with .5. Working back, about 44% of D2 stages are first visits and the other 56% are remixes. B0 therefore falls to 22% of D2 stages and 13% of D3 stages. B0 is under-seen after D1, but the cause is the forced-B1 remix, not the .5.

**The rule produces a repeat (Pillar 4, "never the same twice").**
- A D2+ first visit that rolls B1, followed by a remix in the same run, gives B1 and B1 on that biome.
- The run may never show that biome's B0. `moveRoll` ignores what the earlier visit flew.
- The spec's wording ("a first visit may also roll B1") permits this by the letter. The intent of the table (B1 = the remix) does not.

Fix (SHOULD FIX, `setdraw.ts:39`, `biomes.ts:346-350`):
- Keep .5 for first visits.
- For `v > 0`, take the variant the biome has not flown this run. If both have flown, flip the last one.
- Needs a run-level field (for example `G.mvSeen[b]`), plus a `runsave.ts` validator and an allowlist entry in the same table `spUsed` and `picks` use.
- Alternative with no new save field: derive it from `G.picks` of the earlier stage. This does not work, because `biomeReset` clears `G.picks` each descent (`biomes.ts:450`).
- Test: a run that visits one biome three times never repeats a variant until both have been flown.

Expected effect: D2 B0 rises from 22% to about 40%. Re-measure with `tools/set-share.mjs`.

## 3. Difficulty: stacking, and the breath2 move

**Stacking terrain threat over Build B is the spec's own design, not an error.** "Lighter spawns, so the terrain is the threat" is a balance claim, so it needs a per-band measurement. The lane has none.

- The lane's playtest figure (0.3-0.7 would-be hits/min over a whole run) is below the spec §8 per-stage targets (D1 .5 / .8 / 1.1 / 1.3). It says nothing about the movement-B band against the Build A band next to it. That is the number that tests the claim.
- Asymmetry: only ice B0 gets a hazard multiplier (`terrainb.ts:84`, `moveHazMul`). Ice B0 is therefore the harshest B, and it is most likely to appear in Descent 1, the newest players' descent. At D3 its icicle interval is `hazEvery x .7 / 1.6`, so about 2.3x the D1-base rate.
- Silent reading, log it: the spec says "icicles every x.7 as often". Read literally that is fewer icicles. The lane implemented interval x .7 (1.43x the rate, `biomes.ts:506`). That matches "terrain is the threat", but "x.7 as often" in the brief reads the other way. Record the reading.
- Minor: the multiplier is read at `moveAt(sc + W/2)` (screen centre), but hazards spawn at x = W*.45-.9. Icicles drop on the pre-gimmick side of the edge until the band is fully blended at centre. A one-line comment is enough, not a fix.
- Possible stack: S2 sits at p .53, inside the band for all gimmicks. A set piece plus a gimmick plus Build B density stack in the same 200 px. Several catalogue pieces use fixed screen-fraction y values (`thaw` corpse at `PH*.2`, `slurry` at `PH*.3`/`.7`, `cinders` at `PH*.3`). Ice B0 teeth reach about y 90 (`MOVE.tooth`: 18 + 10 + 26 + 36), and fire spires reach 80+ up from the floor. The lane's set shots (frame 90) show the pieces on ordinary terrain, not inside a band. **Verify, do not assume,** that no enemy spawns embedded in a gimmick, with a shot of each catalogue piece over each B0/B1 in the S2 slot.

**The breath2 move is not by itself a sign of anything off.**
- breath2 starts about 124 px before the breath, so it flies through the tail of the ice B0 band. The lane's attribution experiment (gimmick identity function, `moveHazMul` at 1, matches the old baseline exactly) is good: it proves the cause.
- Because `sig` hashes the whole live sim, any terrain tick perturbation changes every later number. The size of the field deltas after the first divergence is chaos, not signal. A single deterministic scenario cannot show whether the band is harder.
- The direction is not alarming. Score up, gibs up, and 3 capsules where there were 0 read as more progress, not a punishing band. `drops` falling 75 to 26 is the odd one. Ask the lane to say what `drops`, `caps` and `pow` count in the report, and whether the bot took a hit in the crevasse.
- The right gate is a per-band hits/min measurement (see the first finding below), not the harness.

## 4. Peristalsis as static narrows plus render-only bands

**Acceptable reading. Not a design miss. Say so to Matt and keep it.**
- Spec §3.3 requires noise-only terrain so it rebuilds exactly for the checkpoint. Terrain is read as a function of world x (`ceilAt`/`floorAt`). A time-varying wall would need per-frame writes plus a new resume contract. The spec itself lists "time-varying collision" as extra code for the Scrubbers (§5.1), so it already prices it as expensive.
- Scroll already carries static narrows toward the player. The gap 108-150, one narrow every 170 px, with the ±14 wander (`terrainb.ts:29-30,75-77`) delivers "the terrain is the threat".
- Risk to watch: a render-only squeeze on a wall that does not move is a readability lie in one direction. A band that looks like it is closing may make the player avoid space that is safe. The lane says the props sit inside the terrain mass and never in the corridor (report line 20). Confirm in the Fold reading that the contraction bands never read as a collision.
- If Matt wanted moving collision, it is a separate row (time term, resume contract, probe). Do not fold it in here.

## 5. Brief hard requirements and silent decisions

Against the brief:
- Gap >= 108 in everything the lane writes: PASS per the lane (band min 108.0, A min 108.0, C >= 153.4). The 104 px Drive minimum is pre-existing on main and outside the brief's wording for this lane. Fine to leave; track it in the decision log.
- Short identical: the lane reports PASS.
- No set piece in a breath, D20: the planned set x holds >= 300 px. The placed entry can sit 263 px from a breath edge (the generator snaps a piece to a spawn slot, up to 67.75 px). This is main's generator, shared with short, and fixing it would move every long4 biome scenario. Ruling: keep 250 px as the placed tolerance (the lane's test asserts it) and log it as a known deviation. The clean fix is to snap only away from the breath, done when the long4 biome scenarios are next re-baselined.
- `mids` untouched: the lane reports yes.

Silent decisions to log in `production/decision-log.md`:
- the first-visit B1 roll p = .5 (D2+), and the remix-forced B1;
- the icicle "x.7" reading;
- set-piece signature identity no longer guaranteed;
- the 60% same-biome share and which reading of §10 binds;
- Peristalsis reading (static plus render-only);
- D20 placed vs planned 263 px.

Stream correlation. `stagePicks` (`biomes.ts:346-350`) draws from a fresh `stageStream(i)`, and `biomeScript` is called with another fresh `stageStream(i)` (`biomes.ts:360`). Same seed, so the same number sequence. The comment says "a fresh stream of its own, not the script's", but the numbers are the same. The first draw of `moveRoll` (the B1 roll) is the same number that `remix()` or the first `roll()` uses (`biomes.ts:253,275`). Determinism holds; the statistics are mildly correlated (the roll that picks B1 also steers the first kind). `midStream` exists precisely to avoid this (`biomes.ts:338-341`).

---

## Ranked findings

### BLOCKING
- None.

### SHOULD FIX
1. **A B1-then-B1 repeat on a biome in one run** (`src/setdraw.ts:39`, `src/biomes.ts:346-350`). A D2+ first visit rolls B1, then the remix is forced to B1. Fix: for a remix, take the variant not yet flown this run (flip the last if both have). Add a run-level `mvSeen` with a `runsave.ts` validator, plus a unit test.
2. **Same-biome share is 60% by construction, and the checklist reports PASS on the whole-run figure** (`production/qa/evidence/ls2-mv.md:58,88`, `src/setdraw.ts:8-13`). Show both readings in the row. Ask Matt which reading binds. Recommended fix: 2 more pieces per biome (N=7).
3. **Picks share the script's random sequence** (`src/biomes.ts:337,346-350`). Add a pick stream with its own seed domain (a `pickSeedOf`, as `midSeedOf` does for midbosses). Update the comment that calls it independent. No baseline moves, because long4 never reaches a biome.
4. **No per-band difficulty measure** (report lines 75-76). Add would-be hits/min for the movement-B band vs the neighbouring Build A band, per biome and descent, to `tools/playtest.mjs`. This tests "the terrain is the threat" and exposes ice B0's asymmetry in Descent 1.
5. **Set pieces were only shot on ordinary terrain** (`production/qa/evidence/ls2-mv/sets/`, S2 at p .53 is inside the band). Shoot each catalogue piece in the S2 slot over each B0/B1, and check for enemies spawning embedded in terrain (ice teeth, fire spires, acid lake). Fix any `PH*` fixed-y spawn that lands inside terrain.
6. **Log the silent decisions listed above** in `production/decision-log.md`, including the Peristalsis reading and the D20 placed/planned deviation.

### NICE TO HAVE
- `SETS_PER_STAGE` is a constant of 3 (`src/setdraw.ts:15`), but the layout owns the count (`BT.sets`, `biomes.ts:251,288`). With a layout of 4 sets and 3 ids, line 304's `setIds[setIds.length - sets.length - 1]` indexes -1 and `SET[undefined]` throws at run time (long5 is the D19 target). Derive the count from `layout().beats.sets.length`, or assert equality at build. Add a unit test.
- Refill order (`src/setdraw.ts:29`): after exhaustion the pool can hand back a piece played in the previous visit. Prefer the least recently used piece. Rare (a third visit to a biome in one run).
- Weight the signature piece x2 on the visit it belongs to, once N=7 gives room (identity vs freshness).
- A one-line comment on `moveHazMul`'s read at screen centre (`src/biomes.ts:506`).
- Have the lane print what `drops`, `caps` and `pow` count in the harness field list, next to the `--update` message.

Conflicts to flag for the Creative Director: none between pillars. The only tension is Pillar 4 freshness (more catalogue, no signature guarantee) against biome identity (a signature piece every first visit); recommendation above is N=7 plus a x2 weight, Matt's call.
