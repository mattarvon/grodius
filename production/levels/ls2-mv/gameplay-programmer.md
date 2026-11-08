# LS2-mv gameplay-programmer review

Scope: determinism and rebuild, MOVES lifetime, hazards, the gap clamp, runsave validators, edge cases. Read the diff
(`7391234..HEAD`), `biomes.ts`, `layout.ts beatPlan`, `runsave.ts`, `setdraw.ts`, `terrainb.ts`, `flow.ts`, `stagebuild.ts`,
`jump.ts`. Ran the four lane suites (319 pass) and two scratch experiments (gimmick bounds scan and band widths; scratchpad
`x.test.ts`, `out.json`, `out2.json`). Nothing under src/tests/tools was edited.

## Verdict
No BLOCKING bug found in determinism, resume or short-layout identity. One brief requirement is met only by a loosened test
(set pieces vs the 300 px rule), and the picks validator accepts a blob that crashes later. Both are SHOULD FIX.

## BLOCKING
None.

## SHOULD FIX

### S1. Placed set pieces sit 263 px from a breath; the brief's hard requirement is >= 300 and the test was loosened to 250
- `tests/unit/biomebeats.test.ts:81` asserts `>= 250` on the placed entry; the planned-x assertion at :79 is the real 300.
  The lane notes "closest placed entry 263 px, largest snap 67.75 px".
- Cause: `src/biomes.ts:304` `if (sets.length && x + st / 2 > sets[0])` fires the set at the first spawn slot whose x is
  within st/2 BEFORE the planned x, so it can land up to ~70 px closer to a breath that follows it (e.g. S1 planned 5276,
  breath 5612 gives 336 planned, ~263 placed). Brief: "no set piece in a breath, and D20 holds (breaths >= 300 px from set
  pieces)". The piece itself is outside the breath, but D20 is stated on the piece.
- Fix (keeps short identical): in the long-layout branch only (`!legacy`), snap forward: `x >= sets[0]` instead of
  `x + st / 2 > sets[0]`. Short (`legacy`) keeps the old test, so its script and the harness do not move. Then put the
  assertion back to 300 on the placed x. Alternative with no generator change: pull S1 and S3 in long4 `sets`/`remixSets`
  by ~.01-.015 p so planned distance is >= 370. Forward snapping is smaller and local. Note a forward snap can push S2/S3
  toward the next breath or the run-up; re-run the D20 case, it already checks both.

### S2. `isStagePick` accepts a pick that crashes when it fires
- `src/runsave.ts:42`: `isStagePick = isObj(v) && (v.mv === 0 || v.mv === 1) && isSetArr(v.sp)`. `isSetArr` is `every(isSetId)`, so
  `sp: []` passes (vacuously true), as does a 1-element array, 4 elements, duplicates, or ids from another biome.
- Consequence: `src/biomes.ts:304` reads `setIds[setIds.length - sets.length - 1]`; with `sp: []` that is `undefined`, so
  `SET[undefined]` is undefined and `el(undefined)` is undefined when the elite chance is 0, and the script entry throws
  `f is not a function` when it fires (mid-stage, after the resume "succeeded"). The same index arithmetic silently mislabels
  with 1-2 ids. The brief asks for "reject malformed data". The game only writes length-3 distinct arrays, so nothing the game
  writes is rejected by the fix below.
- Fix: in `isStagePick` require `v.sp.length === SETS_PER_STAGE && new Set(v.sp).size === v.sp.length` (import the constant from
  setdraw). Also cheap: key the stage pick to its biome in `rebuildAt`'s caller is not possible in a field validator, so add a
  defence in `biomeScript`: take the id by a running counter and `?? X.set` when it is missing (see N1). Add test rows for
  `sp: []`, `sp: ['morgue']` and a duplicate triple.

### S3. `moveHazMul` is a new ad-hoc hazard multiplier, applied from a point sample
- `src/biomes.ts:506`: `G.hazT = B.hazEvery * (G.mini ? 1.6 : 1) * (m ? moveHazMul(m.b, m.mv) : 1) * rr(.7, 1.3) / (1 + .3 * G.loop)`.
- Direction is right: the timer is an interval, so x.7 gives shorter intervals, 1/.7 = 1.43x the icicle rate (spec "every x.7 as
  often" is ambiguous English; the brief reads it as more often, and the arithmetic does that). Short is identical:
  `moveAt` is null with empty MOVES, the factor is the literal 1 in the same left-to-right product, so the float is
  unchanged. The `rr` draw count is unchanged.
- Two issues. (a) It stacks with the depth term: at descent 3 the ice interval is .7/1.6 = .44 of base, 2.3x the D1 base rate in
  a crevasse already 108 px tall with ceiling teeth to y 78. `gameplay-code.md` says to check D1's power rule before adding
  density scaling. Please have game-designer confirm x.7 holds at depth, or cap it (e.g. `Math.max(.5, mul / (1 + .3 * loop))`
  is not what is asked; simplest is to confirm in the decision log that x.7 compounds). (b) `moveAt(sc + W / 2)` is sampled at
  the moment the previous hazard spawns, so the first interval after entering the band is x1 and the first after leaving it
  is x.7. Harmless at ~1 hazard per 2-3 s, but say so in a comment, or sample at the spawn's own world x
  (`x + G.scroll`, available in `spawnHazard`).

## NICE TO HAVE

### N1. Set id lookup depends on `setIds.length === sets.length`
`src/biomes.ts:304` `setIds[setIds.length - sets.length - 1]` is right only when the layout's `sets` count equals
`SETS_PER_STAGE`. Today long4 has 3 `sets` and 3 `remixSets`; short (2 sets) never passes setIds. A future layout with moveB and
2 or 4 sets would index wrongly. Use a counter: `let si = 0; ... const id = setIds ? setIds[si++] ?? X.set : X.set`. Also fix the doc
comment on `biomeScript` ("the visit's one signature piece, three times (short)": short places 2).

### N2. Gap lands at 107.99999999999999
Scan of `gimmick` over 6 offsets x 9000 px: acid B1 (`keepCeil`) minimum gap `107.99999999999999`; ice B0 and snot B0 exactly 108.0 /
108.014. `fl - ce >= MOVE_GAP` in `centre` is a float compare, `keepCeil`/`keepFloor` use `ce + 108` / `fl - 108`, so a
subtraction can round 1 ulp under. Nothing reads strict `< 108` today (the lane's gap tests clearly allow an epsilon and the
route-probe minGap is 108.0), but a future `< 108` check would flag it. Fix if anyone cares: in `keepCeil` return
`ce + MOVE_GAP` exactly when it clamps, or have the tests state `>= 108 - 1e-9`.

### N3. The gap clamp: confirmed correct, no off-by-one
Answering brief item 4. The clamp is not a post-lerp clamp; it holds by convexity. `shape()` floors its gap at 108
(`biomes.ts:129`), every `gimmick` return has gap >= 108, `lerp(ce)` and `lerp(fl)` with the same k give a gap that is the lerp of
two gaps >= 108, and `floorAt`/`ceilAt` interpolate linearly between TS=4 columns, so no value between columns is lower. The
band test `x > M.a && x < M.z` plus `k = sstep(a, a+blend) * (1 - sstep(z-blend, z))` is 0 at both edges, so the first/last
column gets pure shape(). The later movement-C lerp (`xC` = 7420 and 11157) sits after band end (6820 / 10524) so the two
never lerp against each other. Band widths from `beatPlan` (long4, both gates, both remix flags): 856-899 px, full-strength
interior 456-499 px (the layout.ts comment's "~475 at the shortest span" is right). The base-level lerp `w` is 1 across the band
(gate +300 px is far earlier). One more note: ice B0 ceiling goes as high as y 8 (`18 + a*10` minus nothing) and the jet/icicle code
needs `c > 4`, which holds.

### N4. The catalogue's signature pieces are no longer guaranteed per visit
`remix()` still returns `set: B.set` / `X.set`, but with setIds the drawn 3-of-5 may exclude the biome's signature (index 0) and
remix signature (index 1) entirely. Before this lane every long stage showed its signature piece 3 times. This is a
design change by construction (brief: "2 existing + 3 new, drawn without replacement"); flag to game-designer that the
visit's identity piece can be absent, or pin catalogue[0] / [1] (first visit / remix) into slot S1 and draw the other two.

### N5. Chimney snap can leave the fully-blended band
`src/biomes.ts:441-443`: `moveAt(x + G.scroll)` tests the pre-snap x; the snap moves it up to +-75 px and can land in the 200 px
blend zone, where the vent mouth is only partly carved (the jet then starts at a partly lowered ceiling). Fix: test `moveAt`
again on the snapped world x, and fall back to the unsnapped x (or skip the hazard) if it is null.

## Answers to the review questions

1. **Determinism and rebuild: correct.** `stagePicks` draws from a fresh `stageStream(i)` (own stream; the script stream
   `rs` is independent, so script rolls cannot shift) and caches in `G.picks[i]` (`biomes.ts:346-350`). Paths checked:
   - `rebuildAt` loops slots ascending and calls `biomeStage` for each committed slot: cached picks are read, no draw, spUsed
     untouched. A jump (`jump.ts` builds `g` with no picks/spUsed) draws in slot order inside `rebuildAt`, the same order a natural
     run draws in, so a jump run, then its first checkpoint, then resume is consistent (picks are saved after the draw).
   - Resume: `resumeRun` does `baseG` (fresh, no spUsed), `biomeReset` (picks `{}`), then `applyRun` deep-clones the blob's
     picks and spUsed over it (`applyRun` uses `clone`, so `lastCp()`'s cached blob is never aliased or mutated by later draws:
     I checked this, it is the usual way to desync repeated death-restarts, and it does not happen).
   - Checkpoint before the gate (CP0 of a biome stage): blob has neither pick nor the draw; `choose()` redraws from the same
     spUsed and stream, the same result. `deathRestart` only resumes the same stage's checkpoint anyway.
   - D2+: `biomeReset` (called by `startLoop`) clears picks and keeps spUsed: a new descent redraws (stream is keyed on
     `G.loop`), a resume restores both, a new run starts from `baseG` with no spUsed. Correct for all three.
   - `choose()` runs once per fork (`G.fork` cleared), so no double draw. The fork picker and forced-gate path use sim `R()`
     (pre-existing, unchanged).
   - The only wrinkle: an old pre-LS2-mv save resumed mid-stage on long4 would rebuild terrain/sets the run never had. The fields
     were `plain`/`isObj` and never written, so no shipped blob carries them. `RUN_V` unchanged is justified (the allowlist
     already named both fields; a forward/back read by another build still passes its old validator), provided long4 is not a
     shipped layout with live saves; if it is, say so in the decision log.
2. **MOVES / moveAt: correct.** Reset by `biomeReset` (`MOVES.length = 0`) on every new run/descent/resume; rebuilt by
   `rewriteTerrain` in `rebuildAt`. Sparse slot indexing is handled (`m &&`). The two slots' bands are disjoint (6.0k-6.8k and
   9.6k-10.5k), so first match wins is safe. `pk && pk.mv` keeps `mv = 0` (B0) distinct from null. `moveAt` excludes the blend
   zones on purpose; hazard and prop effects therefore apply only on the ~456-499 px full interior.
3. **Hazards.** Short identical: `moveAt` is null on short, `mv = b === 'jet' && moveAt(...)` is falsy, so `(vent || R() < .5)`
   still draws R() exactly as before; the `rr(W*.45, W*.9)` draws are before the snap and unchanged. Only a Chimney vent skips the
   `R() < .5` draw, and that condition is deterministic from `MOVES` (rebuilt exactly on resume), so no sim desync, but note it
   shifts the R() stream by one per vent jet in B1 fire, a deliberate long-only move. The `x > W - 20` correction cannot go
   negative (snapped x >= 141). Jets scroll with `h.x -= ss`, so a vent snapped in world x stays on its vent. Timer
   direction: see S3.
4. **Gap:** see N2 and N3.
5. **runsave:** `spUsed` and `picks` accept everything the game writes (stage-keyed digit keys, `mv` 0/1, catalogue ids, biome
   keys, `__proto__` refused, unknown biome/set/mv/key refused: tests at runsave.test.ts:163-167). Gaps: S2 (length, duplicates,
   cross-biome ids). `RUN_V` unchanged: justified above.
6. **Edge cases.**
   - mv null (no `moveB`, i.e. short): `stagePicks` skipped, `rewriteTerrain(.., null)` leaves `M = null`, `MOVES` untouched. Fine.
   - Remix: `beatPlan(.., false)` in `rewriteTerrain` is correct because breaths do not depend on `remix`; only `sets` does
     (`layout.ts:351`). Remix moveRoll gives B1 always, first visit in D2+ gives B1 at .5 (`bvis` is run-wide, so a biome
     seen in D1 is a remix v>0 in D2 and always B1, which matches the spec's "first visit").
   - A biome with no gimmick entry: `gimmick`'s last branch is the snot code, so an unknown biome silently flies Peristalsis, and
     `drawSets` throws on `CATALOG[b]` undefined. There are exactly four biomes (`BIOME_KEYS`), so unreachable today; a
     `CATALOG[b]` guard in `stagePicks` (skip picks, use `X.set`) would make a fifth biome degrade rather than crash.
   - Catalogue refill: on exhaustion `seen` is cleared and seeded with the stage's already-drawn pieces, so the 3 in a stage are
     always distinct (traced: pool 2 left, takes both, refill, third is one of the other 3). Across 3 descents a piece from
     before the refill can repeat, which "without replacement per run" allows only until refill; fine. spUsed round-trips
     through the save.
