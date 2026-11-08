# LS2-mv QA plan: terrain movement B + set-piece catalogue (2026-11-07)

Story type: Logic + Integration (automated) and Visual/UI (manual, retained screenshots). Output locations:
`tests/unit/terrainb.test.ts`, `setdraw.test.ts`, `runsave.test.ts`, `biomebeats.test.ts`; screenshots in
`production/qa/evidence/ls2-mv/`. Gate: BLOCKING for the automated cases, ADVISORY for the screenshot cases.
Companion: `production/levels/ls2-mv/qa-tester.md` (review, mutations, recommended tests R1-R10).
Hardware note: heavy jobs (probes, harness, shots) one at a time, below ~80 C.

Terms: band = `beatPlan().moveB` (breath 1 end + 100 .. breath 2 start + 200, 200 px blend each side); slot 0 / slot 1 = the two
biome stages on long4; gate = `G.bx[slot]`; B0 first visit, B1 remix (or D2+ first visit at p .5); Fold = Galaxy Fold.

## A. Critical path

## Test Case: MV-C01 -- Descent 1 ice, full stage, B0
**Precondition**: long4 layout, new run, seed S, Descent 1; route to ice in slot 0 (first visit).
**Steps**:
  1. Fly to the fork, pick ice, fly breath 1 (p .335-.41).
  2. Fly into the band; note the terrain change from the signature shape (tighter, taller teeth).
  3. Fly to breath 2, past it, to the run-up (arena) and the boss.
**Expected Result**: B0 Crevasse is the only movement-B terrain; icicles fall about 1/0.7 = 1.4x as often as outside the band; three set pieces fire at p ~.23/.53/.86; the terrain fades into the arena (C) with gap >= 150 at the boss.
**Pass Criteria**: min gap in band >= 108 px (probe); icicle spacing inside band / outside = 0.7 +- 0.15 over >= 20 spawns; exactly 3 `set:` entries fire, none inside a breath.

## Test Case: MV-C02 -- Remix flies B1
**Precondition**: as C01, then reach the same biome a second time in the same run (visit 2).
**Steps**: 1. Complete visit 1. 2. Route into the same biome again. 3. Fly the band.
**Expected Result**: B1 (ice: shelf stairs, acid: folds, fire: chimney, snot: polyps); set pieces are the two unused plus one refill, none repeating within the stage.
**Pass Criteria**: `G.picks[stage].mv === 1`; the three pieces differ; both pieces unused in visit 1 are among them; ice treads are 120 px apart.

## Test Case: MV-C03 -- Checkpoint resume reproduces the stage
**Precondition**: long4 run, in slot 0 past its gate (picks already drawn).
**Steps**: 1. Note terrain at 5 sampled x in the band, the set-piece order, and `G.spUsed`. 2. Die and retry from the checkpoint, or reload the page and Continue. 3. Compare.
**Expected Result**: identical terrain, identical set order, `G.spUsed` and `G.picks` unchanged; no second draw.
**Pass Criteria**: FLOOR/CEIL equal at the samples, to the float; `spUsed` array deep-equal; `tools/resume-check.mjs` reports no diff.

## Test Case: MV-C04 -- Short layout is untouched
**Precondition**: short layout (default).
**Steps**: 1. `npm run test:regress`. 2. Layout parity.
**Expected Result**: short scenarios match the baseline exactly; only `breath2` and the documented long4 shifts moved.
**Pass Criteria**: harness exit 0; the re-baselined entries each have a sentence in the commit message; `G.picks` and `G.spUsed` are undefined throughout a short run.

## B. Edge cases

## Test Case: MV-E01 -- Resume mid-band
**Precondition**: long4, slot 0; the ship is inside the fully blended band (moveAt non-null).
**Steps**: 1. Force a save (death retry, or page reload via Continue). 2. Resume. 3. Watch the first 5 s.
**Expected Result**: the ship respawns at the checkpoint (the gate), not in the band; the band rebuilds identically; the hazard timer resets sanely (`hazT` 90); no hazard spawns on the ship.
**Pass Criteria**: no console error; terrain equals pre-save; `moveAt` returns the same band object values.

## Test Case: MV-E02 -- Resume with the used set moved
**Precondition**: slot 1 visited; `G.spUsed` contains pieces from slot 0's stage.
**Steps**: 1. Save inside slot 1. 2. Edit nothing; Continue. 3. Check slot 1's three pieces.
**Expected Result**: slot 1's pieces equal the pieces before the save (read from `G.picks`, not redrawn against the changed `spUsed`).
**Pass Criteria**: the `set:` order printed before and after is identical.

## Test Case: MV-E03 -- D2 / D3 first visit rolls B1
**Precondition**: Descent 2 (loop 1), then Descent 3 (loop 2); 20 seeds.
**Steps**: 1. For each seed and descent, reach a first visit to a biome. 2. Record `G.picks[stage].mv`.
**Expected Result**: B1 on about half of D2+ first visits; B0 always in D1.
**Pass Criteria**: D1: 20/20 are B0. D2+: between 25% and 75% B1 over >= 40 first visits (binomial 99% bounds for p .5); the roll is deterministic per seed (same seed, same result on a rerun).

## Test Case: MV-E04 -- D2/D3 B1 gap and hazards
**Precondition**: loop 1 and 3, each biome B1 (force `picks.mv = 1`).
**Steps**: Run `tools/route-probe` on all 10 routes at descents 2 and 4.
**Expected Result**: gap >= 108 in the band, hazard cadence faster (x1/(1+.3 loop)) but 0 bad hazards, ice B1 does not apply the 0.7 multiplier.
**Pass Criteria**: probe `bad: []`, 0 hazard hits, 0 deaths, band min gap >= 108.0.

## Test Case: MV-E05 -- Catalogue exhaustion over three descents
**Precondition**: one run, same biome forced every descent (route fixed), 3 descents x 2 slots.
**Steps**: 1. Log `G.spUsed[b]` and each stage's three pieces across all 6 stages (or 3 when one slot per descent). 2. Reset nothing between descents.
**Expected Result**: `spUsed` persists across `biomeReset` (new descent); `G.picks` is cleared at each descent; within any stage the three pieces differ; the pool refills when it empties and the refill stage still holds 3 distinct pieces; no piece appears 3 times before every piece has appeared twice over the first 4 stages.
**Pass Criteria**: after 2 stages (6 draws, 5 pieces) all five pieces have appeared; `used.length <= 5` and has no duplicates after every stage; `G.picks` is `{}` right after a new descent starts.

## Test Case: MV-E06 -- Forced-gate routes
**Precondition**: the parity bots' gates (`gateLate`: 4750 / 8500) and the earliest gate (`x0`).
**Steps**: 1. Build slot 0 and slot 1 from `x0` and from `gateLate`. 2. Read the band and the gap.
**Expected Result**: the band is the same x range at both gates; the gap holds at both; the three set pieces stay >= 300 px (planned) from the breaths.
**Pass Criteria**: `terrainb.test.ts` gap and reachability cases and the D20 case pass for both gates; route-probe on every forced gate shows no bad hazard.

## Test Case: MV-E07 -- Jump switch into a band
**Precondition**: long4, jump switch enabled (LS1 row I); a debug jump places the ship at the band's start, mid-band, and the last blend tile.
**Steps**: 1. Trigger the jump into slot 0 at `moveB.a`, `(a+z)/2`, `z - 10`. 2. Let the stage run 20 s.
**Expected Result**: the stage's picks exist (drawn on entry if not already), the terrain is built, hazards use the band, set pieces ahead of the ship still fire in order, and none already behind it replays.
**Pass Criteria**: `G.picks[stage]` defined; no `set:undefined`; no console error; a second jump to the same stage does not change `G.spUsed`.

## Test Case: MV-E08 -- Corrupt and old saves
**Precondition**: a valid run save in localStorage.
**Steps**: 1. Replace `g.picks` with each of: unknown set id, `mv: 2`, `sp: 'thaw'`, a non-numeric key, an array. 2. Replace `g.spUsed` with unknown biome, unknown id, a string, an array, a raw `__proto__` key. 3. Load an older blob with neither field. 4. Load a blob with `picks: {}` and `spUsed: {}`. 5. Overwrite an existing save by finishing a descent.
**Expected Result**: cases 1-2 discard the whole blob to a fresh start without throwing; 3-4 load; 5 stores the new picks and used set.
**Pass Criteria**: `decodeRun` returns null for every bad blob and an object for 3-4; no exception; after 5 the stored `spUsed` equals the live one.

## Test Case: MV-E09 -- Chimney vents and jets
**Precondition**: fire B1, a hazard spawns inside the band.
**Steps**: Watch 30 jet spawns (or run `tools/playtest.mjs`).
**Expected Result**: every jet comes down a vent mouth, never from a vent beyond x = W - 20, never on the ship; jets outside the band are unchanged.
**Pass Criteria**: 30/30 jets originate within 14 px of a `ventNear` x; none spawn at screen x > 460; the sim `R()` count per frame is identical to a run without vents on non-vent hazards (harness determinism).

## Test Case: MV-E10 -- Snot Peristalsis reading
**Precondition**: snot B0.
**Steps**: Fly the throat; watch the contraction bands.
**Expected Result**: gap stays 108-150 everywhere in the throat; the render-only bands move at t*.7 but do not change the collision terrain.
**Pass Criteria**: floor/ceiling at a fixed x is constant over 600 frames (the collision is static); gap in [108, 150] over the throat. Flag to Matt: "narrows march toward the player" is rendered, not simulated.

## Test Case: MV-E11 -- Phone and Fold
**Precondition**: Android build or 960x540 and a narrow 360x640-class viewport; naked ship (no upgrades).
**Steps**: Fly all 8 gimmicks with touch input only.
**Expected Result**: every band is flyable at the naked ship speed; props do not hide hazards at 390 px width.
**Pass Criteria**: 0 deaths in 3 naked runs per gimmick by terrain alone (pilot: the 1.25 px/f reachability test passes for the same band, 10 px clearance); prop outlines visible at the narrow viewport.

## C. Manual playtest checklist: 8 gimmicks

Per gimmick: capture one screenshot at the band's middle (`production/qa/evidence/ls2-mv/move/`), fly it once naked, once mid-power. Record pass / fail and the screenshot name. Tick = visible and flyable, gap never looks under ~108 px at 960x540.

| # | Gimmick | Look for | Fail when |
|---|---|---|---|
| 1 | ice B0 Crevasse | teeth every ~36 px, taller than the signature teeth (26-62 vs 10-40), icicle rate x1.4 | teeth the same as A; icicles unchanged |
| 2 | ice B1 Shelf stairs | floor steps every 120 px, 20 px per step, up three then down three | a step over 24 px; steps not 120 px apart |
| 3 | acid B0 Flooded tank | floor visibly 30 px higher, +-9 swell, tank prop | lake no higher than A; swell causes a wall |
| 4 | acid B1 Folds | ceiling drapes every ~110 px, 42-72 deep, floor gives way | gap < 108 under a fold; fold with no prop |
| 5 | fire B0 Spire field | spires every 40 px, up to 80 tall, narrower than signature | same density as A; a spire pair closing the gap |
| 6 | fire B1 Chimney | vents every 150 px, jets come down only at vents, mouth readable under the HUD strip | jets from nowhere; vent past the right edge fires; mouth hidden by HUD |
| 7 | snot B0 Peristalsis | narrows every 170 px, gap 108-150, bands drift toward the ship | gap outside 108-150; bands move the collision |
| 8 | snot B1 Polyps | round bulges every 130 px, radius 30-56, ~15% bare | flat sections longer than 2 cells; sharp corner on a bulge |

For all 8: blend in over 200 px with no cliff at the band edge, blend out the same; the band sits clear of breath 1 and ends before midboss B's held screen; terrain is identical after a resume.

## D. Manual playtest checklist: 12 new set pieces

Fire each at frame 90 from `production/qa/evidence/ls2-mv/sets/` or via `tools/set-shots.mjs`. For each: the enemy list reads as the comment in `SET`, it finishes within 60 frames, does not overlap a breath, and the screenshot shows it entering from the stated side.

| Biome | Piece | Expect | Fail when |
|---|---|---|---|
| ice | thaw | three corpses, top to bottom, 25 f apart | all three at once; one off-screen |
| ice | vigil | eye turrets on both shelves, a corpse between | eyes both on one shelf |
| ice | pack | two mutants walking, a flayer over them | flayer first; mutants stacked |
| acid | slurry | two thin sine streams, a crawler at 40 f | streams overlap in y |
| acid | vats | wombs on the lining, eye above | no eye; wombs spawn mid-air |
| acid | lining | eyes either side, hatchlings from behind | hatchlings from the front |
| fire | meatline | hooks swing in at 0/25/50 f, a flayer at mid height | hooks together |
| fire | backdraft | two behind-waves at 30% / 70% height, a mutant at the front | waves in the same lane |
| fire | cinders | short dive at 30%, flayer at 70% at 40 f | dive longer than 3 |
| snot | sneeze | large wave from behind, small from the front | wave from the front only |
| snot | clot | womb plus a slime on each wall | slimes on one wall |
| snot | congestion | two corpses block, hatchlings press at 30 f | hatchlings spawn before bodies |

Per piece also check: nothing spawns inside a breath, none after the run-up (p .9), three distinct pieces in the stage, and across two visits of the same biome the first stage's pieces are not all repeated.

## E. Acceptance criteria

All binary. A = automated, M = manual with evidence.

1. (A) `npm run test:unit` passes; `npm run typecheck` passes; `npm run build` passes.
2. (A) For every biome, variant, slot, descent in {1,2,4} and both gates, the terrain gap from gate+300 to bossX is >= 108 - 1e-3 (literal 108, not `MOVE_GAP`), and `gimmick()` holds 108 over >= 100 offsets and 6 base gaps.
3. (A) Terrain outside `[moveB.a, moveB.z]` is bit-identical between B0 and B1 builds; inside it differs on > 100 tiles; no step > 6 px per tile in the first/last blend/4 and within 8 px outside the band (R5).
4. (A) The band lies in w = 1: `moveB.a >= gate + 300` and `moveB.z <= tEnd[0]` (R4).
5. (A) Short: no `picks`, no `spUsed`, `moveB` null, MOVES empty, set piece only `morgue`; harness short scenarios and layout parity unchanged.
6. (A) `stagePicks` draws once per stage from `stageStream(i)`; a rebuild after `spUsed` has changed gives the same terrain and script (R6, R10).
7. (A) `drawSets`: three distinct per stage, deterministic per stream, no replacement until exhausted, refill excludes the stage's own pieces, `used` has no duplicates; `moveRoll` B0 in D1 first visit with no draw, B1 on every remix with no draw, B1 on D2+ first visit when `rs() < .5`.
8. (A) `moveHazMul('ice', 0) === .7` and 1 for the other seven pairs (R1).
9. (A) D20: every catalogue piece, in every set slot, planned >= 300 px and placed >= 250 px from each breath edge, no spawn in a breath, none after the run-up.
10. (A) `decodeRun` returns null for each malformed `picks` / `spUsed` listed in R9 without throwing, returns an object for old saves without the fields and for `{}`; `sp` length other than 3 is refused.
11. (A) Hazards: `ventSnap` puts every jet on a vent and inside the screen (R8); the hazard timer reads the band at the on-screen centre (`sc + W/2`); no sim `R()` is drawn from a vent snap.
12. (M) Route-probe 10 routes x 2 descents: `bad: []`, 0 hazard hits, 0 deaths, band min gap 108.0.
13. (M) world-shots: one screenshot per movement per biome (8) at `production/qa/evidence/ls2-mv/move/` and the 12 set pieces at `.../sets/`, reviewed against sections C and D; no cliff at any band edge.
14. (M) `tools/set-share.mjs`: across seeds, <= 50% of set pieces shared between two seeds for different-biome runs; worst whole-run share <= 20%; same-biome pair share 60% by count is accepted (3 of 5 by construction, documented).
15. (M) `tools/resume-check.mjs`: terrain, script and `spUsed` identical after resume at the gate, mid-band and in the arena.
16. (M) Harness re-baselines: each moved entry (breath2) has a one-line reason in the commit message; long4 unmoved is explained (its scenario never reaches a biome).

Ambiguous criteria flagged: the brief's "lighter spawns, so the terrain is the threat" (spec §3.2 beat row) is not measurable as written. Propose: (a) spawn count in the band <= 80% of the count in an equal-length stretch of the movement-A section; (b) double chance in the band = base - .1 (read from `biomeScript` tables); (c) deaths attributable to terrain >= deaths to enemies in 10 bot runs. Escalate to qa-lead for a ruling before writing it. "Reads as peristalsis" for snot B0 is also subjective: propose "the render-only contraction bands cross the screen in 4-6 s at t*.7 and the collision terrain is constant over 600 frames".

## F. Regression checklist: LS2-mv, terrain / draw / save, 2026-11-07

- Short run to the boss, ice then fork: no `picks`, no `spUsed`; fail = either defined.
- Long4 D1 ice B0 then D2 same biome: B1 and the unused pieces; fail = repeat of B0 or a repeated piece.
- Continue after a mid-stage reload: same set order; fail = different pieces.
- New game after a long run: `G.spUsed` empty (a new `G`); fail = pieces carried over.
- Midboss picker and breath placement unchanged (`biomebeats` midboss WARNING cases pass).
- `src/biomes.ts` `mids` tables untouched (LS2-0 shares the file): `git diff 7391234..HEAD -- src/biomes.ts` shows no `mids` hunk.
