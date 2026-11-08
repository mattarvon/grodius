# LS2-mv: qa-tester testability review (2026-11-07)

Story type: Logic + Integration (terrain shape, draw, save validation) with Visual/UI props. Gate: BLOCKING for the unit
layer, ADVISORY for the screenshot layer (`testing.strict.visual/.ui: false`).
Reviewed: `tests/unit/terrainb.test.ts`, `setdraw.test.ts`, the D20 case in `biomebeats.test.ts`, the new `runsave.test.ts`
cases; against `src/terrainb.ts`, `src/setdraw.ts`, the `src/biomes.ts` hunks, `src/runsave.ts`.
Baseline: `npx vitest run` = 719 passed, in a throwaway copy (the worktree was not touched).

## 1. Verdict

The lane's tests are good on the draw and the save layer, and good on the gap in the unit-level sense. They are
**blind to everything in `spawnHazard` / `stepBiome`** (hazard timer, vent snap), they test the 108 floor against a constant
imported from the code under test, and they do not prove the blend actually blends. No BLOCKING defect in the code was found by
this review; there are 3 SHOULD FIX test gaps that let real regressions through (hazards, blend, gap constant).

## 2. Requirement-by-requirement

| Brief requirement | Asserted? | Where / weakness |
|---|---|---|
| gap >= 108 across the band, blend edges included | Yes, but circular | `terrainb.test.ts` `gap >= 108 ...` measures `from+300 .. bossX`, so the blend edges are inside. The threshold is `MOVE_GAP`, **imported from `src/terrainb.ts`** (mutation M6: set it to 90 and the keepFloor/centre floors follow it; all 719 pass). Use the literal `108` (the spec number is the point of the test, so the "no magic numbers" exception applies). |
| gap holds on every terrain offset | Weak | `o = (loop+1)*37.1 + seg*11` ignores the run seed, so the matrix `{loop 0,1,3} x {seg 0,1}` is only 6 offsets per gimmick. I fuzzed `gimmick()` over 292 offsets x 3000 x-steps x 7 base gaps in the copy: min gap 107.99999999999999 for ice/fire/acid-B1, 108.01 snot B0, 125.6 acid B0. The code is right; the test sample is thin. Float rounding gives 108 - 1e-14, so a strict `>= 108` must keep a 1e-6 epsilon (the lane's 1e-3 is fine). |
| short untouched | Yes | `describe('short')` asserts moveB null, no MOVES, `picks`/`spUsed` undefined, only `set:morgue`. Killed M12. Behaviour parity itself rests on the harness + layout parity (heavy, not unit). |
| picks drawn once, read back on rebuild | Yes | `draws once` test; killed M7 (13 failures) and M25. Does not check that the draw uses `stageStream(i)` (M24 survives). |
| no replacement per run / refill rule | Yes | 200 seeds x 4 biomes; killed M8, M9, M10. The "long run" test (>200 of 1500 draws per piece) is statistically loose: it passes for a draw that is uniform with replacement per stage but never refills correctly. M8/M10 are killed by the other two tests, so acceptable. |
| refill cycle across 3 descents | Partly | the second-visit test covers visit 2; nothing asserts the used set across 3 consecutive stages of one biome in one run (3x3 = 9 draws over 5 pieces: the 2nd stage refills mid-stage). Add it (R5 below). |
| D20 / no set piece in a breath | Yes | `biomebeats.test.ts` loops every catalogue piece through the three slots, both slots, both visits, 3 loops: plan >= 300, entry not inside a breath, entry >= 250 px, spawn not in a breath and before the run-up. Strong. Note the entry bound is 250, the plan bound 300, and the measured closest is 263: a 13 px margin that is a magic number tied to one measurement. Keep, but say so in the test name. |
| runsave rejects malformed `spUsed` / `picks` | Mostly | 5 negatives + 1 round trip. Killed M20, M21, M22. Missing negatives: `picks` value where `sp` is a non-array, `sp` of length != 3, `mv: "1"` (string), `mv: 0.5`, `spUsed` value not an array, null entries, and an array in place of the object. `isSpUsed`'s `__proto__` guard (M23) is an **equivalent mutant**: `isBiome` uses `Object.hasOwn(HOME, k)` and already rejects `__proto__`; the guard is dead defence, harmless. A mid-version blob (old save with `picks: {}` or without `spUsed`) is not tested for load: old saves wrote `plain` for spUsed. Add the "old save has no picks/spUsed" and "old save with spUsed: {} loads" cases. |
| refill rule / `moveRoll` | Yes | Killed M2, M2b. |
| hazard cadence x `moveHazMul` | **No** | M1 (inverted) and M1b (always 1) both survive. `moveHazMul` is exported and pure, and it is the whole of the spec's "icicles every x.7 as often". |
| chimney vents snap geyser/jet hazards | **No** | M18 (not snapped) and M5 (extra `R()` draw) survive. `spawnHazard` is not exported. |
| the blend | **No** | M4 (k forced to 1, no blend: a hard cliff at the band edge) survives. |

## 3. Test-quality findings

SHOULD FIX
1. `terrainb.test.ts:gap >= 108` and `:holds snot B0's throat` assert against the code's own constants (`MOVE_GAP`, `MOVE.throat.min/max`). Literal 108 / 150 (spec §3.3). The throat test did kill M6b only because the global gap test has a different path; the throat bound itself is circular.
2. Nothing asserts `moveHazMul`. Add a three-line pure test (R1). Without it the Descent-1 ice hazard rate is unguarded, and short's behaviour for hazards depends on `moveAt` returning null (no test of that path at all: `stepBiome` is not unit-reachable; see R8 for the extraction).
3. No continuity test at the band edges (M4). A hard cliff of up to ~60 px between tiles at `M.a` would pass every current test, and a naked ship cannot fly a 60 px wall; the "naked ship can fly it" test starts at `moveB.a` and so sees k ~ 0 only at its first tile, and its climb rule (5 px per tile) would catch a cliff inside the band but not **at `a` coming from movement A**, because `lo`/`hi` initialise at `i0` rather than carrying in from before the band. Start the reachability walk at `a - 600`.
4. `raises acid B0's lake about 30 px` is one point (x=1000, o=40) with a loose `<` bound: M16 (rise 0) survives. Replace with a band-mean test (R3).
5. `plays the drawn pieces in order` and `keeps the used set across descents` use `$.G.spUsed.ice` length 3 only: it would pass if descent 2 had also reset a different biome. Minor.

NICE TO HAVE
6. `gives the same picks ... different ones across seeds` asserts `size > 10` of 39 seeds: with C(5,3) x 3! = 60 outcomes the threshold is arbitrary; comment the rationale (expected distinct of 39 draws from 60 is ~30).
7. Test-file header says "core's hash and vnoise are the real arithmetic" but they are copied into a `vi.mock`; a change to the real `hash`/`vnoise` in `core.ts` would not be seen. Import the real ones with `vi.importActual` if `core.ts` has no DOM at import, otherwise add a one-line equality test between the copy and `core.ts` source (or accept and comment).
8. Order dependence: `describe('movement B on long4')` uses `beforeAll(setLayout('long4'))` and the next describe repeats it; `'the catalogue against the game'` sets long4 inside the `it` and resets to short at the end, so a failing expect leaves long4 set for later tests in the file. Wrap in try/finally or `afterEach(() => L.setLayout('short'))`. `fly()` also mutates the module-level `MOVES` array; `biomeReset` is only called in one test.
9. Every vitest case sets `R: () => .5` and `pick`/`ri` constants: the unit run exercises one RNG path through the SET functions. That is intended (determinism), but state it.
10. Gap tests start from a synthetic 234 px base corridor. The real level corridor is >= 104. The brief's "everywhere in the band" holds because `w = 1` across the band; assert it (R4): `moveB.z <= layout().tEnd[0]` and `moveB.a >= gate + 300` for both gates, otherwise a layout edit could put the band in the fade-in where only 104 is guaranteed.

## 4. Mutation results

Run in a throwaway copy (`.../scratchpad/qa`, script `.../scratchpad/mut.py`); full 719-test suite per mutation.

| # | Mutation | Result |
|---|---|---|
| M1 | `moveHazMul` inverted (`mv` instead of `!mv`) | **SURVIVES** |
| M1b | `moveHazMul` always 1 | **SURVIVES** |
| M2 | B1 on a Descent-1 first visit (`loop >= 0`) | killed |
| M2b | first visit in D2+ never rolls B1 | killed |
| M3 | `spUsed` reset per descent | killed |
| M4 | gimmick ignores the band edge (no blend, k = 1) | **SURVIVES** |
| M4b | band starts 200 px early | equivalent (k = 0 there); not a defect |
| M5 | vent snap draws an extra `R()` (reordered `R() < .5 \|\| vent`) | **SURVIVES** (sim-determinism hazard, see below) |
| M6 | `MOVE_GAP` 108 -> 90 | **SURVIVES** (circular constant) |
| M6b | throat min 96 | killed |
| M7 | `stagePicks` redraws every call | killed |
| M8 | refill forgets this stage's pieces | killed |
| M9 | draw never records the used set | killed |
| M10 | pool ignores the used set | killed |
| M11 | `picks` not cleared on a new descent | killed |
| M12 | `stagePicks` runs on short | killed |
| M13 | set ids played in reverse order | killed |
| M14 | vent mouth 3 (inside `c > 4` guard) | killed |
| M15 | stair every 100 | killed |
| M16 | acid lake rise 0 | **SURVIVES** |
| M17 | hazard timer ignores `moveAt` | **SURVIVES** |
| M18 | vents not snapped | **SURVIVES** |
| M19 | `MOVES` not cleared on `biomeReset` | killed |
| M20-M22 | runsave `mv` check / `spUsed` / `picks` loosened | killed (M23, the `__proto__` guard, is equivalent) |
| M24 | picks drawn from `stageStream(i+1)` instead of `stageStream(i)` | **SURVIVES** |
| M25 | `spUsed` not threaded into the draw | killed |
| M26 | B1 rendered as B0 | killed |
| M27 | hazard lookup at `sc` not `sc + W/2` | **SURVIVES** (hazards sample the band at the wrong x; also untested) |
| M28 | stair rise 40 | killed |
| M29 | band lead 0 (band begins in breath 1) | killed |

Survivors that matter: M1/M1b, M4, M5, M6, M16, M17, M18, M24, M27.

M5 note: on short the extra draw cannot occur (`moveAt` is null so `vent` is falsy and `||` short-circuits identically), so the
parity harness does not see it either way; on long4 the order `R() < .5 || vent` would burn one sim `R()` per vent hazard
and shift the harness stream. The code as written (`vent || R() < .5`) is correct and deliberately skips the draw inside a vent.
That is a sim-determinism choice that is currently held only by the author's care.

## 5. Recommended new / changed tests (test name + assertion)

File: `tests/unit/terrainb.test.ts` unless stated. Ref numbers are used in the cases file.

R1 `moveHazMul` (pure, no mock needed; `describe('moveHazMul')`):
- `it('thins ice B0 hazards to 0.7 of their spacing and leaves every other biome and variant at 1')`: `expect(moveHazMul('ice',0)).toBe(0.7)`; the other seven `(b,mv)` pairs `toBe(1)`. Kills M1, M1b. (Literal .7: spec "x.7".)

R2 `gap >= 108` literal and wide offset fuzz (`describe('gimmick')`):
- `it.each(biomes x variants)('%s B%s holds a 108 px gap for any terrain offset and any movement-A gap >= 108')`: loop o over `Array.from({length:150},(_, i)=>i*2.7)`, x every 4 px over 0..6000, and base `[ce,fl]` pairs `[[4,112],[10,244],[30,140],[60,200],[8,160],[20,128]]`; `expect(f - c).toBeGreaterThanOrEqual(108 - 1e-6)`. Needs only `PH`/`hash`/`vnoise` from core (mock as the file does). Kills M6. Runs ~10 s for the full sweep at 2 px: use x step 4 and o step 2.7 to stay under 2 s.
- In `it.each(cases)('... gap >= 108 ...')` replace `MOVE_GAP - 1e-3` with `108 - 1e-3`.

R3 acid B0 lake (replaces `raises acid B0's lake about 30 px`):
- `it('raises acid B0\'s floor by 30 +- 12 px on average across the fully blended band')`: fly acid B0, fly acid B1 with picks mv=1 and take A as `fly` with mv forced off-band... simplest: build once with B0, once with the same terrain but `moveB` outside (compute A as `FLOOR` from a build with `from` past the band), average `A.floor - B0.floor` over `[a+blend, z-blend]`, `expect(mean).toBeGreaterThan(18)`, `toBeLessThan(42)`. Kills M16.

R4 band sits fully in w = 1 (`describe('movement B on long4')`):
- `it('keeps the band after the gate blend and before the tEnd fade, so the 108 floor is the only floor that applies')`: for both slots and both gates, `expect(M.a).toBeGreaterThanOrEqual(from + 300)`; `expect(M.z).toBeLessThanOrEqual(L.layout().tEnd[0])`.

R5 blend continuity (kills M4):
- `it.each(KEYS x [0,1])('%s B%s has no cliff at either band edge: no tile-to-tile floor or ceiling step over 6 px in the first and last blend/4 of the band, and none within 8 px outside it')`: fly it, then for tiles from `a-8` to `a+blend/4` and from `z-blend/4` to `z+8` assert `Math.abs(FLOOR[i+1]-FLOOR[i]) <= 6` and the same for CEIL. Failure = a hard step at an edge (M4 gives 20-60 px). Rationale: stairs and polyps only reach full height after `blend/2`; the 6 px bound is shape()'s own worst tile step plus slack (measure it and comment the figure).
- Extend the naked-ship reachability walk to start at `P.moveB.a - 600` rather than `a` (the existing assertion otherwise ignores the way in).

R6 picks come from the stage's own stream (kills M24):
- `it('draws stage i\'s picks from stageStream(i): the same as drawPicks on a fresh stage stream')`: `$.G = {loop:0, seed:11, pend:[], picks:{}, spUsed:{}}`; `const a = stagePicks(1,'ice',0)`; `expect(a).toEqual(drawPicks('ice',0,0,{},stageStream(1)))`; and `stagePicks(2,...)` equals `drawPicks(..., stageStream(2))` under a fresh G. Needs `stageStream`, `drawPicks` imports.

R7 refill over a run (`setdraw.test.ts`):
- `it.each(BIOMES)('%s: three consecutive stages draw all five pieces within the first two and never repeat inside a stage')`: one `used`, one stream, three `drawSets`; `expect(new Set([...s1,...s2]).size).toBe(5)`; each of s1/s2/s3 has 3 distinct ids; `expect(s3.filter(id => s2.includes(id)).length).toBeLessThanOrEqual(...)`: the refill puts stage 2's pieces back in play only after the pool empties, so assert `used.b` is a subset of CATALOG[b] and `used.b.length` is in {1,2,3,4,5} after each stage (never > 5, never duplicates: `new Set(used.b).size === used.b.length`). Duplicates in `used` are a refill bug (M8-like).
- `it('does not mutate the catalogue')`: `Object.isFrozen`-style check: `CATALOG.ice.length` is 5 after 100 draws (the type is `readonly` but it is a plain array).
- `it('draws exactly the same pieces when drawSets is replayed from a copy of the used set')` (resume equivalence).

R8 hazard path: extract the two decisions so they are unit-testable (this is a code request for the lane owner, not a test edit):
- `export const ventSnapX = (x, scroll, W) => ...` (the `ventNear` + `W - 20` clamp) and test `it('puts every snapped jet mouth within the screen and on a vent')`: for x in 0..W, scroll in a 0..600 sweep, `Math.abs(((r + scroll) - ventNear(r + scroll))) < 1e-9` and `r <= W - 20`. Kills M18 and M27's neighbour.
- and `moveAt` is exercised with the hazard lookup x: `it('moveAt reads the live band at the hazard\'s own world x')` using `moveAt(a+blend+1)` non-null, `moveAt(a)` null, both already present; add the stepBiome sample point as a constant so M27 shows up via a stepBiome-level test (see harness note).
- Harness: `tools/harness.mjs` does not reach a biome stage on long4, so M5/M17/M18/M27 cannot be caught there either. `tools/playtest.mjs` / `tools/route-probe` are the probes; a retained `hazard-trace` (frames between hazard spawns inside the ice B0 band vs outside, expected ratio 0.7 +- .15) is the only evidence available until `stepBiome` is split.

R9 runsave (`runsave.test.ts`, extend the `it.each` of bad blobs):
- negatives (each `decodeRun` returns null and does not throw): `picks: {1:{mv:0, sp:'thaw'}}` (sp a string), `picks:{1:{mv:'1', sp:[]}}`, `picks:{1:{mv:0.5, sp:['thaw']}}`, `picks:{1:null}`, `picks:[]`, `picks:{1:{mv:0}}` (no sp), `spUsed:{ice:'thaw'}`, `spUsed:{ice:[null]}`, `spUsed:[]`, `spUsed:{"__proto__":["thaw"]}` (via raw JSON text, so it is an own key).
- positives: `picks:{}` and `spUsed:{}` load (an empty descent state is valid: a fresh G after `biomeReset`); a blob without either key loads (an old v1 save).
- `it('rejects a pick whose set count is not 3')`: today `isStagePick` accepts `sp: []` and `sp: ['morgue']`; `stageStream` replay would then index `setIds[...]` undefined in `biomeScript` (`'set:' + id` becomes `set:undefined`, `SET[undefined]` is not a function when it fires). That is a **code change** for the lane owner (`isSetArr(v.sp) && v.sp.length === 3`); on layouts where `beats.sets` is 3 only. CONCERN, see below.
- `it('rejects a pick naming a piece of another biome than its stage')` is not possible without the route; note only.

R10 pick/stage coherence (`terrainb.test.ts`, `describe('a resumed stage')`):
- `it('rebuilds the same terrain and the same script from stored picks after the used set has moved')`: call `biomeStage(0, gate)`, snapshot `CEIL/FLOOR` and `script.map(e=>e.x+e.k)`, then `stagePicks` mutate `$.G.spUsed.ice = ['morgue']`, rebuild via `biomeStage` again with `G.script = []`, assert both snapshots equal. This is the actual checkpoint contract and nothing tests it end to end (resume-check.mjs does, in a browser).

Keep: biomebeats D20 test, runsave round trip, setdraw `moveRoll` tests, `short` describe.

## 6. BLOCKING / CONCERNS

- BLOCKING: none found in the code. The tests that exist pass and the mutations that matter to the brief's hard requirements (gap, short untouched, picks once, no replacement, refill, D20, runsave) are killed, with the exception of M6.
- CONCERN (SHOULD FIX, test): M1/M1b/M17/M18/M27/M5 survive; `spawnHazard` and the hazard timer have no unit coverage and the harness does not reach them. R1 (pure) and R8 (extract) fix this.
- CONCERN (SHOULD FIX, test): M6 `MOVE_GAP` imported from the code under test; make the 108 a literal (R2).
- CONCERN (SHOULD FIX, test): M4 survives, no continuity check at band edges (R5).
- CONCERN (SHOULD FIX, test): M16 survives, acid lake 30 px is asserted at a single point (R3).
- CONCERN (SHOULD FIX, test): M24 survives, the stage-stream choice is unguarded; brief says `stageStream(i)` (R6).
- CONCERN (SHOULD FIX, code, small): `isStagePick` accepts `sp` of any length, including `[]`; a hand-edited or truncated save then yields `set:undefined` and throws at the set beat. Require `sp.length === 3` (R9). The runsave round trip also never loads an old save, which `qa-tester` rules require for anything that saves data.
- CONCERN (note): `tests/unit/biomebeats.test.ts` 250 px entry bound vs measured 263 px leaves a 13 px margin; fine, but any change to the generator's snap will trip it. Intentional; keep the comment.
- CONCERN (note): the 108 gap in the unit run rests on a synthetic 234 px corridor; the real-level assertion is carried by the lane's route-probe (0 bad hazards, min band gap 108.0), which is heavy and not part of `npm test`.
