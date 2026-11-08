# LS2-mv level-design audit (level-designer)

Scope: `src/terrainb.ts`, `src/setdraw.ts`, the `src/biomes.ts` hunks, `src/layout.ts`, `src/render/moveprops.ts`, and the `move/` screenshots (s0 ice B0, B0hold, B1; acid A, B0; fire B0, B0hold, B1; snot B0, B1hold). I did not run any heavy job. The `rg`-based Grep and Glob tools are broken in this shell, so I read files directly. I did not view the slot-1 shots, the C/AtoC shots or the 12 set-piece shots, so the set-piece verdicts come from the script lines in the diff, not from pixels.

Numbers used below: W = 480, long4 slot span L ~ 3150 px (a = gate-160, z = bossX-60), scroll ~ 60 px/s.

## Geometry of the band (for context, not a finding)

`moveB.a = breath1.z + 100` = P(.41) + 100 = **p .442**. `moveB.z = breath2.a + 200` = P(.65) + 200 = **p .714**. With the 200 px blend each side, the *fully-on* part is P(.505) .. P(.65), **~456 px = 14% of the stage, ~7.6 s**. The ramps add ~200 px each side. The spec row is .36-.62 (26%, ~13 s). As built, the band's centre is p .575, not ~.49. The set pieces and the hazard and prop gates all key off the fully-blended part (`moveAt`, `fade`), so the *experienced* gimmick is the 14% core.

---

## 1. Gimmick vs spec §3.3 (8 checks)

| Gimmick | Verdict | Evidence |
|---|---|---|
| ice B0 Crevasse | Matches. Teeth 36 px apart vs 52 (tighter) and 26-62 tall vs 10-40 (taller). | Screenshot s0-ice-B0 reads clearly as a fanged ceiling. |
| ice B0 "icicles every x.7 as often" | **Correct direction.** `moveHazMul` returns .7 and `stepBiome` multiplies the *interval* `G.hazT = hazEvery * ... * .7`, so the interval shrinks and icicles come ~1.43x as often. Spec wording is "every x.7", which is also the interval reading. | `terrainb.ts:84`, `biomes.ts` stepBiome hazT line. |
| ice B1 Shelf stairs | Matches the letter (floor step every 120 px). **Weak as a threat**: 20 px steps, 60 px total relief, no hazard change. | `terrainb.ts:59-60`. See S-1. |
| acid B0 Flooded tank | Matches (rise 30, swell +-9). Reads well in screenshot (lake line high, tank rungs). A lake is a floor-only squeeze: the gap goes from ~150-180 to ~120-150, so it is the mildest of the B0s. | `terrainb.ts:63`; s0-acid-B0 vs s0-acid-A. |
| acid B1 Folds | Matches ("ceiling drops in folds", 42-72 deep, floor yields to hold 108). Not seen in a still of the fold motion (the lane flagged this as unmeasured). | `terrainb.ts:64-65`. |
| fire B0 Spire field | Matches. In the shots the tallest spires are ~100 px of a ~240 px gap, so they fill the bottom third only; the ceiling stays high. Reads, but it is not a squeeze. | s0-fire-B0, B0hold. See N-2. |
| fire B1 Chimney "ceiling vents with downward jets" | **Correct direction.** `spawnHazard` sets `up = (vent \|\| R()<.5) && c>4` and the hazard gets `y: c, dir: 1`. The jet's hit box is `y0 = h.y, y1 = h.y + reach` (downward from the ceiling), and the sparks go `+dir`. The vent snap fixes x at `ventNear`. Good. Two weaknesses: rate (S-2) and the blend ramps (S-3). | `biomes.ts` spawnHazard ~134-143, stepBiome jet branch. |
| snot B0 Peristalsis "narrows march toward the player" | **Partly.** The collision is a static train of narrows (108-150 gap, 170 px period) that approach at scroll speed, which is the honest reading under noise-only terrain. The *render-only* bands move at t*.7 and are on an 85 px lattice that is **not phase-locked to the real narrows** (narrows are at gap minima x = 85 + 170k; bands drift through every phase). So the picture says "walls squeeze here" where they do not, and misses where they do. | `terrainb.ts:75-78` vs `moveprops.ts:319-329`. See S-4. |
| snot B1 Polyps | Matches (round bulges r 30-56, 15% bare). Reads in s0-snot-B1hold. | `terrainb.ts:79-80`. |

"The terrain is the threat": reads strongly for ice B0, fire B0, snot B1 (polyps are big), acid B1; weakly for ice B1, acid B0, snot B0 and fire B1 (the last two because the *band is short* and the hazards are sparse).

## 2. Band placement and blends

- **Band shifted ~.09 late vs the spec row (p .442-.714 vs .36-.62), core only 14%.** That follows from D22 placing the breaths (.335-.41 and .65-.725) and from the `lead` choices. The lane's comment says "~475 px (~8 s)", which is the honest number; the spec's `.36-.62` is ~800 px of full effect. The blend length (200) is spec-fixed; the only free parameters are the leads. See B-1.
- **End side is right.** `z = breath2.a + 200`. The held screen for midboss B starts ~216 px into the breath (breath is .075 L = ~236 px), so k reaches 0 at 200 and the fight is pure A with 16 px margin. That margin is thin: a longer or shorter span changes it. Longer spans (`L` up to 3330 on slot 1) give 250 px breaths and more margin; there is no span where it shrinks below 16 px at L >= 3150. OK.
- **Midboss A hold previews B, and then some.** Held screen = scroll z-20 .. z+460. Band start z+100 means screen x 120 is k=0, x 220 k=.5, x 320 k=1. The right ~160 px of the screen, where the midboss normally sits, is **fully gimmick**. s0-fire-B0hold shows spires 60-100 px tall rising under the right half. That is a preview, but it is also a boss fight on a terrain the boss's pathing was not authored against. The lane's comment ("coming on the right") is accurate; the risk is the boss, not the player. See S-5.
- **S2 at .53 / remix .515** falls at the very start of the fully-on core (core starts .5055). The enemies appear when the scroll reaches P(.53), and the set is fought across the core's first ~third. Acceptable (terrain is already fully on when the piece arrives), but there is almost no core *before* the set to teach the gimmick: the player meets the gimmick and S2 together. If the band is widened (B-1), S2 would land in the middle of the core, as the spec intends (S2 at .48 in a .36-.62 band).

## 3. Flyability and pacing

Min gaps all hold 108 by construction (`centre`, `keepFloor`, `keepCeil`, and lerps of two >=108 gaps). I re-derived each on the numbers (PH ~ 250):

- ice B0: ceiling worst 18+10+62 = 90, floor ~220: gap 130. Fine.
- acid B0: floor worst PH-18-30-9-10 = ~183, ceiling ~30: gap ~150. Fine.
- fire B0: spire floor worst PH-24-80-6 = ~140, ceiling ~30-40: ~100-110, so `centre` flattens the very tallest tips slightly (both edges give way). Fine, and ceiling stays on screen.
- fire B1: vent mouth y=16, hood drops to base+24 = ~64; floor from A. Fine.
- snot B0: m +- 54..75, so gap 108-150, ceiling >=53. Fine.
- snot B1 / ice B1 / acid B1: the free edge yields, so the 108 gap is held. Fine.

Pacing and triviality:
- **Throat cadence.** One narrow per 170 px (~2.8 s) with a 108-150 oscillation and +-14 wander. In a 456 px core that is **under 3 full narrows**; with the ramps ~5. That is a pulse, not a march. Shallow wander (period ~1630 px) means the corridor is nearly straight. Not a trap, but near-trivial for a 108-wide gap. See N-1.
- **Spires.** One per 40 px, tallest up to 80+6. The ship rides over them and the ceiling is far, so there is no way to be trapped and little pressure. No trapped-ship spot.
- **Stairs.** The ice B1 total relief is 60 px with 20 px faces: trivial; it is the only B variant that changes neither the gap nor any hazard rate.
- **Chimney jets.** Fire `hazEvery` is 125 f; over a 456 px core (~7.6 s = ~456 f) that is **3-4 jets total** (x rr(.7,1.3)). With 3 vents on screen and 1-2 inside the spawn window `W*.45..W*.9`, a jet is rarely on the ship's row of travel. The "chimney" is mostly decor.
- No place found where a naked ship can be trapped.

## 4. Set pieces (the 12 new)

Idea per piece, and fit:

| Piece | Idea | Verdict |
|---|---|---|
| ice thaw | 3 corpses at y .2/.5/.8, 25 f apart (a column thawing top to bottom) | Clear, good ice voice, light. Fine for S1/S2. |
| ice vigil | eyes on both shelves + a body | Clear, light. Fine for S2. Shares bones with acid `lining`. |
| ice pack | 2 hulks + a flayer | Clear but = fire `kiln` minus the hooks. Heavy for ice's "slow and heavy". S3. |
| acid slurry | two 3-formations + a crawler | Clear, light/mid. Good S1/S2. |
| acid vats | 2 wombs + 1 eye | Clear, light. Fine. Shares bones with snot `clot`. |
| acid lining | 2 eyes + hatch(4-6) | Clear, mid. Shares bones with ice `vigil`. |
| fire meatline | 3 hooks in sequence + a flayer | Clear. Near-duplicate of `kiln` (hooks + flayer + hulks). |
| fire backdraft | 2 rear waves + a hulk | Clear and the most distinct fire piece; fights nothing. S3. |
| fire cinders | 3-dive + flayer | Clear, light. Fine for S2. |
| snot sneeze | rear hatch 6-8 + front 3-5 | Clear and heavy. S3 only. |
| snot clot | womb + 2 slimes simultaneously | **Not distinct from `drip`** (slime(1), slime(-1), then slime + womb). Same enemies, same wall pairing, `clot` is just `drip` without the delays. |
| snot congestion | 2 bodies block, hatchlings through | Clear, good idea. Mid. |

Observations:
- **No piece fights the terrain gimmick by construction**, but I could not verify the floor/ceiling-attached ones on the gimmicks: `mutant`, `crawler`, `eyeT(+-1)`, `hookE`, `womb`, `slime` all attach to a wall. `pack`/`backdraft`/`kiln` spawn hulks on the *spire field* (fire B0, 80 px spikes every 40 px) and `vigil`/`vats` spawn wall eyes on the *tooth ceiling* (ice B0). I could not check from the diff whether those attach at `floorAt/ceilAt` of the spawn x (so on a tip) or at a fixed y (so inside the terrain). That is the item to verify (S-6).
- **Slot fit is not controlled.** `drawSets` returns three uniform draws in play order, so S1 (build), S2 (the lighter "terrain is the threat" slot) and S3 (peak) get whichever order the stream gives. Seeds will produce `sneeze` at S2 (the slot the spec wants light) or `thaw` at S3 (the peak). See S-7.
- **Signature dilution.** The first visit's signature piece (`morgue`, `walls`, `pincer`, `flood`) is no longer guaranteed; one in ~2.5 first-visit stages will omit it (P(a given piece is in the 3-of-5 draw) = .6). That changes each biome's identity beat. If the spec means the catalogue to *replace* the signature, fine; if not, anchor it. Flagged as a question for Matt (S-8).
- **Density.** All new pieces finish within 60 f, and none exceeds ~8 bodies (sneeze, 9-13). `sneeze` is the only one denser than existing pieces; rear waves cost more in the code's own words, and the lane trimmed it already. Fine for S3.

**Set-share recommendation (same-biome 60%).** Accept. The brief's measure ("<= 50% of set pieces shared between seeds") passes on whole runs (worst 18%), and what a player perceives is the same piece in the same slot (20%). The 60% is arithmetic: three uniform picks from five share 1.8 on average. If Matt wants it lower, the cheapest levers, in order: (1) add a sixth piece per biome (3-of-6 gives 1.5 shared = 50% by count, 7 pieces gives 43%); (2) the weight ordering proposed in S-7 is free for the share-by-set number but *raises* same-slot matches, so budget for that. Do not use cross-run memory for this row.

## 5. Brief hard requirements

- gap >= 108: pass in the lane's own terrain (I re-derived it above); the Drive's 104 @13860 is pre-existing on main. Agreed with the lane.
- No set piece in a breath, D20: planned x >= 300 px; placed x down to **263 px** because the generator snaps to a spawn slot. This is a real (small) miss against D20 as written ("breaths >= 300 px from set pieces") on the placed x. It is pre-existing, shared with short, and flagged for Matt by the lane. My view: leave it; 37 px at 60 px/s is 0.6 s, and the pieces finish in <= 60 f.
- Short identical: not checked by me; the lane's evidence is harness + parity PASS.
- `biomes.ts` mids tables untouched: the hunks I read are outside `mids`.
- `rewriteTerrain`'s lerp argument holds (k in [0,1], both gaps >= 108).

---

## Ranked findings

### BLOCKING

**B-1. The band is ~.09 late and its full-effect core is 14% (456 px, ~7.6 s) vs the spec's .36-.62 (~13 s). The "terrain is the threat" beat is too short to register, and S2 lands at its first third.**
- `src/layout.ts:238` (`moveB: { between: [0,1], lead: [100,200], blend: 200 }`), consequences in `biomes.ts` `moveAt`.
- Fix (numbers): the end cannot move (midboss B's held screen). Start earlier: `lead: [-40, 200]`, i.e. **a = breath1.z - 40**. The core is then P(.41)+160 .. P(.65) = **~596 px (~10 s, 19%)**, and the held screen of midboss A has k = .5 at x ~ 80 and k = 1 at x ~ 180 (i.e. the boss at x 330-440 is fully on terrain B). That *worsens* S-5, so pair it with the S-5 fix (hold the boss's own band on A with a `k` cap, or accept it by verifying the four midbosses). Alternative with no boss exposure: keep `lead[0]` at 100 and move the *set* S2 later so it sits mid-core: `sets[1]` from .53 to **.575** (remix .56) — D20 still holds (breath 2 starts at .65, 236 px = .075 away: **P(.575) to breath2.a = .075 L = 236 px < 300, so this alternative fails D20**; do not use it). So the only viable fix is the earlier start with the S-5 guard. If the lane owner rejects it, the decision to accept a 7.6 s core must go to Matt/creative-director as a spec deviation, not stay silent.

### SHOULD FIX

**S-1. ice B1 stairs change neither the gap nor any hazard rate; near-trivial.** `terrainb.ts:18-20, 59-60`. Fix: raise to `rise: 26, walk: [0,1,2,3,4,3,2,1]` (relief 104 px, the faces are 26 px) AND use `moveHazMul('ice', 1) = .85` so icicles also feel the stairs; keep faces <= 26 px (a naked ship's climb is still ~21 f).

**S-2. fire B1 has 3-4 jets across the whole core; a chimney should pour.** `biomes.ts` stepBiome hazT line and `terrainb.ts:84`. Fix: `moveHazMul` returns **.55** for `fire` mv 1 (fire interval 125 f -> ~69 f, so ~7 jets in the core, roughly one per vent pass), still on the 60 f telegraph.

**S-3. Chimney jets are random up/down in both blend ramps while vents are already rendered/shaped there.** `biomes.ts` spawnHazard: `moveAt` only returns the fully-blended core. Fix: in the vent branch use a `moveNear(wx)` that includes the ramps for the fire B1 case only (when `k > .5`), so the vents the player sees are the vents that fire.

**S-4. Snot Peristalsis bands are not phase-locked to the real narrows, so the picture lies.** `moveprops.ts:319-329`; narrows at `terrainb.ts:76` are minima of `cos(2*pi*x/170)` at x = 85 + 170k. Fix: draw the bands at world x = 85 + 170k (not the 85 px drifting lattice) and animate *intensity* (lip brightness / width) with a pulse phase `(t*.7/170 - k/ ...)` running toward the player, so the "march" reads as a wave along the true narrows. Keep it render-only. Separately flag to Matt: true moving walls need a sim-owned offset (a time-dependent function; not noise-only), which the checkpoint rebuild forbids.

**S-5. Midboss A's held screen has the boss on a fully-on gimmick (right 160 px).** `layout.ts:238`; evidence s0-fire-B0hold. I could not verify the four midbosses (choir, cyst, prentice, brood) against 100 px spires, 90 px teeth, 56 px polyps. Fix: either verify each at the hold (screenshot with the boss in) or cap k in the held screen: add `hold` to `moveB` so terrain is lerped at most 40% inside `[breath1.a, breath1.z+460]`, which keeps a preview but not the full shape.

**S-6. Verify wall-attached set pieces on the gimmick terrain.** `biomes.ts` SET `pack`/`kiln`/`backdraft` on fire B0 spires; `vigil`/`vats`/`lining` eyes on ice B0 teeth; floor crawlers and mutants on snot B1 polyps. The unit D20 test places each piece but does not check embedding. Fix: a probe rig that places every piece on every B0/B1 and asserts each enemy spawns with `floorAt/ceilAt`-relative y (not inside terrain). Cost: one small rig, no src changes.

**S-7. Set order ignores slot intent.** `src/setdraw.ts:422-432`. Fix: tag each id with a weight (light = thaw, vigil, slurry, vats, cinders, clot; mid = lining, congestion, meatline; heavy = pack, backdraft, sneeze), then **order the three drawn ids** light -> mid -> heavy at S2, S1, S3 (S2 lightest). The set drawn does not change, so `spUsed` and the share statistic are unchanged; order is a deterministic sort and is stored in `G.picks.sp`.

**S-8. Decide whether the signature piece is guaranteed on a first visit.** `src/setdraw.ts:405-410`, `biomes.ts` set line. Either the catalogue replaces it (fine) or anchor the visit's signature (`morgue`/`walls`/`pincer`/`flood` for v=0, remix signature for v>0) as one of the three and draw the other two from the other four. Needs Matt/narrative-director.

**S-9. `clot` is not distinct from `drip`.** `biomes.ts` SET `clot`. Fix: make `clot` a clump, not a pair: `womb(); later(20, womb); slime(1)` with the slime on the floor only; or swap it for a different idea (a "sneeze-aftermath": 4 slimes dropping from the ceiling in one 30 f burst).

### NICE TO HAVE

**N-1. Throat is a pulse, not a march.** `terrainb.ts:30`. Make `every: 130` (3.5 narrows in the core, ~6 with ramps) and `wander: 20`; the minimum stays 108.

**N-2. Fire spires fill only the bottom third.** `terrainb.ts:26`. `span: 62 -> 74` (tallest ~92+6) keeps gap >= 108 via `centre` and makes the field a pressure read.

**N-3. Acid B0 hazard.** `terrainb.ts:84`: `moveHazMul('acid', 0) = .85` so geysers rise more often in the flooded tank; the lake alone squeezes only ~30 px.

**N-4. Overlap of bones across biomes.** `pack`/`kiln`/`meatline` (hulks + hooks + flayer), `vigil`/`lining` (eyes + something), `vats`/`clot` (wombs + slimes). Differentiate later through art round 2 (tint, entry direction) rather than recoding.

**N-5. Chimney vents the player cannot see off the right edge.** `biomes.ts` spawnHazard snaps x > W-20 back by 150; the first vent can then sit left of `W*.45`. Harmless; clamp with a second check if telegraph visibility matters.
