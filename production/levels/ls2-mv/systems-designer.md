# LS2-mv systems-designer review

Reviewer: systems-designer. Scope: `src/terrainb.ts`, `src/setdraw.ts`, the `SET` / `spawnHazard` / `stepBiome` / `rewriteTerrain` hunks in `src/biomes.ts`, `docs/pacing.md` §3, `src/depth.ts` table style. No source edited. Constants: PH = 254, W = 480, TS = 4 (`src/core.ts:7-10`); 1 px of scroll = 1 frame at full speed.

Every number marked "derived" is arithmetic from the code or the evidence files. Numbers marked "proxy" rest on a threat weighting I assumed, because I did not read `src/enemies/*` HP or fire data. Treat proxy figures as ordering, not magnitude.

## Band geometry (derived, used throughout)

Slot 0, late gate: a = 4590, z = 7740, span 3150 px. `moveB` runs from breath 1 end + 100 to breath 2 start + 200 (`layout.ts:362`), so it covers about 5981 to 6837, an 856 px band. The 200 px blends take 400 of it, which leaves about 456 px of full gimmick (7.6 s). That is the "~475 px" in `layout.ts:237`. The blends are the biggest share of the band and `moveAt()` ignores them. The full-gimmick region sits at p .504-.65. S2 (.53 first visit, .515 remix) therefore lands inside the full gimmick.

## Ranked findings

### BLOCKING

**B1. The draw ignores slot weight, so S2 can receive the heaviest piece. This contradicts the spec ("Build B: lighter spawns, so the terrain is the threat. S2 at .48").**
- `src/setdraw.ts:25-34` returns the trio in draw order and `src/biomes.ts:304` plays it in that order. Nothing ties a piece to a slot.
- Nominal spawn counts, from the `SET` bodies (`biomes.ts:219-242`):

  | Biome | Piece | Spawns |
  |---|---|---|
  | ice | morgue / crucify / thaw / vigil / pack | 4 / 4 / 3 / 3 / 3 |
  | acid | walls / gutter / slurry / vats / lining | 6 / 6 / 7 / 3 / 6-8 |
  | fire | pincer / kiln / meatline / backdraft / cinders | 4 / 5 / 4 / 5 / 4 |
  | snot | flood / drip / sneeze / clot / congestion | 13-17 / 6 / 9-13 / 3 / 6-8 |

- Proxy threat points, with weights hatch .4, drone .5, corpse/crawler/slime 1, eye/womb/hook/cross 1.5, flayer 2, mutant 3:

  | Biome | Piece | Points |
  |---|---|---|
  | ice | pack | 8 |
  | ice | crucify | 7.5 |
  | ice | morgue | 6 |
  | ice | vigil | 4 |
  | ice | thaw | 3 |
  | fire | kiln | 9.5 |
  | fire | meatline | 6.5 |
  | fire | backdraft | 5 |
  | fire | pincer | 5 |
  | fire | cinders | 3.5 |
  | snot | flood | 8 |
  | snot | drip | 6.5 |
  | snot | congestion | 4 |
  | snot | sneeze | 4 |
  | snot | clot | 3.5 |
  | acid | gutter | 7 |
  | acid | lining | 5 |
  | acid | vats | 4.5 |
  | acid | walls | 4 |
  | acid | slurry | 4 |

- A first-visit ice stage can put `pack` or `crucify` (7.5-8) in the full-gimmick S2, with a mutant walking the ice stairs, while `thaw` (3) sits in S1. That is the opposite of the spec's intent.
- **Fix (no catalogue change, no extra RNG draw).** Keep the draw. Then place the lightest drawn piece in S2 and leave the other two in drawn order. The stream is untouched, so `G.picks` and the save format do not change.
  - `S2 = argmin W(sp)`. S1 and S3 keep their drawn relative order.
  - `SETW` is a typed table in `setdraw.ts`, one value per id, in the `DEPTH` style. Use the proxy points above until enemy data replaces them.
- Side effects:
  - The set-share "placed" metric (20% same piece in the same slot) will rise, because lightest-to-S2 correlates slot with piece. The count metric (60% same-biome, 15-18% whole-run) is unchanged. Re-run `tools/set-share.mjs` and quote both.
  - A revisit's S3 is always a recycled piece (see section 4). The rule above leaves that intact because S3 keeps its drawn position.

### SHOULD FIX

**S1. The set pieces use fixed y fractions that ignore the movement-B terrain, and S2 plays inside the full gimmick.**
Floor y per variant, derived from `terrainb.ts`:

| Variant | Floor y (px) |
|---|---|
| ice stairs (`terrainb.ts:60`) | 224 / 204 / 184 / 164 |
| acid lake (`:63`) | 186-206 |
| fire spires (`:70`) | 144-230 |

Piece spawn y values in S2 against that:

| Piece | Spawn y | Problem |
|---|---|---|
| `thaw` (`biomes.ts:231`) | PH*.8 = 203 | Below the floor at step 2 (184) and step 3 (164). |
| `slurry` (`:234`) | PH*.7 = 178 | Sits at or under the lake floor (186-206) once the sine amplitude is added. |
| `cinders` (`:239`) | flayer PH*.7 = 178 | Near spire tips (144-230). |
| `morgue` (existing) | PH*.75 = 190 | Same issue. |

- I could not confirm whether `corpse()`, `formation()` and `flayer()` clamp to terrain. The set-shots rig captured at default terrain, not inside a band, so this was never observed.
- **Fix.** Either clamp spawn y to `[ceilAt(wx) + 28, floorAt(wx) - 28]` in the set helpers, or cap S2-eligible y fractions at ≤ .65 (165 px).
- **Evidence needed.** Extend `tools/set-shots.mjs` to shoot S2 pieces on the B0 and B1 terrain at p .53. If a spawn lands inside the terrain mass, escalate this to BLOCKING.

**S2. The "delays ≤ 60 f, finish before the run-up" claim is not true for the whole catalogue.**
- `ls2-mv.md:18` and the comment at `biomes.ts:229-230` state it. The new pieces do satisfy it: max delay 50 (thaw, meatline).
- The catalogue also contains the old remix pieces, and they now draw on first visits:

  | Piece | Delay | Line |
  |---|---|---|
  | kiln | 80 f | `biomes.ts:227` |
  | crucify | 70 f | `biomes.ts:225` |
  | gutter | 70 f | `biomes.ts:226` |
  | drip | 70 f | `biomes.ts:228` |

- Before this lane they appeared only at the remix slots (.83); now they can sit in S3 at .86.
- Worst case, derived: .86 -> 4590 + 2709 = 7299, plus a placed offset of up to 67.75 px (the lane's own measurement), plus 80 px of scroll = 7447. The run-up starts at .9 -> 7425. That is a 22 px overrun for kiln. For a 60 f piece it is about 3 px.
- The D20 test in `biomebeats.test.ts` reports no spawn past the run-up. I could not tell whether it checks script `x` only or also the `pend` timers.
- **Fix.** Make the test assert on `pend` fire frames, or cap every catalogue delay at ≤ 45 f. Moving S3 from .86 to .85 buys 31 px if the pieces cannot be changed. Do not change the existing pieces' behaviour for short (`X.set` repeats three times there).

**S3. `moveHazMul`: direction is right, effect is small, and it lags.**
- Direction: the factor multiplies the hazard interval (`biomes.ts:152`), so .7 means more icicles. The spec text is ambiguous. "Icicles every x.7 as often" can mean interval x.7 (more icicles, which the lane built) or rate x.7 (fewer). **Question for Matt:** which?
- Scope is correct. `moveHazMul` returns `.7` only for `b === 'ice' && !mv` (`terrainb.ts:84`), `moveAt` only matches the full-blend part, and the sample is the screen centre at the moment the timer resets (`biomes.ts:152`).
- Lag: hazards spawn at x = scroll + 216-432 (`biomes.ts:133`), while `moveAt` samples scroll + 240. That is about 84 px (1.4 s) early, plus up to one interval (77 f) late on exit. The multiplier therefore applies to roughly the right 456 px but shifted.
- Magnitude (derived), hazEvery 110 over 456 px (7.6 s):

  | Descent | Interval (base / ×.7) | Icicles over the band |
  |---|---|---|
  | D1 | 110 f / 77 f | 4.1 -> 5.9 (+1.8) |
  | D3 (loop 2) | 69 f / 48 f | 6.6 -> 9.4 (+2.8) |

  At D3 the jittered interval `rr(.7, 1.3)` reaches 34 f (.57 s) inside a crevasse whose gap bottoms at 108.
- **Recommendation.** Keep .7. Add a floor so stacking cannot get silly: `interval = max(50, ...)` frames when `m` is set. Re-run route-probe at loop 2 and read `hazHitFrames` for ice B0. The lane's probe shows 0, but the bot is not a stress test.

**S4. Tuning table convention.**
- Only a blanket comment (`terrainb.ts:12`: "measured by tools/movement-shots.mjs and tests/unit/terrainb.test.ts"). The project rule (`.claude/rules/gameplay-code.md`, `coding-standards.md`) asks each value to carry its rationale and the probe that measures it. `movement-shots.mjs` measures the gap table. It measures nothing per value, and the unit test checks the gap floor.
- Most rows have a rationale, with these gaps:
  - `fold` (`:24`): no why for 110 / 42 / 30.
  - `spire` (`:26`): no why for the 40 px spacing and 80 px height.
  - `polyp` (`:32`): no why for radius 30-56 and the 15% bare share.
  - `lake.wave` 70 (`:22`): no why.
- Anonymous constants buried in `gimmick()`, against the "no magic numbers in logic" rule:
  - ice B0 base 18, a*10, exponent 1.6 (`:57`)
  - stair base `PH - 30` (`:60`)
  - lake base 18, 1.5, 10, sin(x/9) (`:63`)
  - fold base 16, a*8, exponent .7 (`:65`)
  - spire base 24, exponent 2.4, n*6 (`:70`)
  - vent base 30, a*10 (`:72`)
  - throat n*4 (`:76`)
  - polyp base 34, n*6, hash factor 3.1 (`:80`)
- **Fix.** Hoist the bases into each `MOVE` row (`{ base, noise, ... }`), and give each row its own measurement note, for example "gap min: movement-shots gap table; feel: world-shots B0/B1". Mark the interface with a type so the table is typed like the rule says.

**S5. Variant roll lever and B0 exposure.**
Derived from `set-share.txt:8` (B0/B1 per 200 seeds): D1 0% B1; D2 78% (156/200); D3 87% (174/200). Per run that is about 3.3 B1 stages out of 6.
- The dominant driver is the forced B1 on any revisit (`moveRoll`: `v > 0`), not `B1_FIRST_VISIT`. Solving the D2 numbers gives a revisit rate of about 56%. The marginal effect of the lever is 0.44 per unit of p. Moving .5 to .35 changes D2 B1 only from 78% to 71%.
- Consequence: B0 is effectively a once-per-biome-per-run gimmick, and D3 is 87% B1. That is consistent with the spec's reading ("a first visit may also roll B1"), so the lever is working as written. Flagging because the table comment at `setdraw.ts:16` implies a bigger knob than it is.
- **Suggestion (nice to have, Matt's call):** if more B0 is wanted in D2/D3, the lever is the revisit rule, for example B1 on a revisit with p .75. `B1_FIRST_VISIT` will not do it.

### NICE TO HAVE

**N1. The pick stream is correlated with the script stream.** `stagePicks` draws from a fresh `stageStream(i)` (`biomes.ts:100-104`), and `biomeScript` defaults to another `stageStream(stageOfSlot(seg))`. Same seed, so the first values are identical. On a revisit the mv roll is skipped, so the first set pick is `floor(u0 * 5)` and the script's first remix cross pick is `floor(u0 * 4)`: perfectly correlated. The effect is small and nothing breaks, but it ties set choice to the borrowed kinds. Fix: burn a fixed count (say 8) at the start of `stagePicks`, or salt the seed. Changes only long layouts.

**N2. Chimney vent snap can land on a vent outside the full band.** `biomes.ts:136` tests `moveAt(x + scroll)` before the snap; `ventNear` can move x by up to 75 px, so a jet can come out of a ceiling that is not yet (or no longer) vent-shaped. Fix: re-test `moveAt(ventNear(...))` after snapping.

**N3. Acid lake (B0) is the softest band.** Floor 186-206 against an acid ceiling of about 14-40 gives a gap of about 145-190. That is above the 108 floor with 40+ px of slack, and the geyser hazard is the only pressure. Option: swell 9 -> 14 and wave 70 -> 55 (period 440 -> 345 px) to use some of that slack. Not required by the spec ("rises 30 px and swells").

**N4. Ice B1 stairs: the cycle is longer than the band.** The walk `[0,1,2,3,2,1]` has a 720 px period against a 456 px full band, so depending on the random phase the player sees either a full 0-60 climb or just a dip. Cell count is about 3.8. `[0,1,2,1]` (480 px period) at rise 28 gives every B1 stage exactly one peak of 56 px, same squeeze, and a 28 px face that is still 22 f of climb at 1.25 px/f (the lane's own figure). Gap at the top step: floor 164 -> corridor 56-164, exactly 108 when the ceiling reaches 56. That is a real squeeze, not trivial.

**N5. Density probe cannot see this lane's changes.** See section 5.

## 1. MOVE table, per value

| Value | Verdict | Note |
|---|---|---|
| tooth 36 / 26-62 (ice B0) | Coherent | vs shape() 52 / 10-40: pitch x.69, mean height x1.76. `centre()` guarantees 108; at max tooth over a high floor it clamps. |
| iceHaz .7 | Coherent, small | See S3. |
| stair 20 / 120 / `[0,1,2,3,2,1]` | Fair, not trivial | Max 60 px over 360 px (9.5 degrees). Top step corridor 108 px. See N4. |
| lake 30 / 9 / 70 | Easy | Gap 145-190. See N3. |
| fold 110 / 42-72 | Coherent | Ceiling to about 96; floor gives way via `keepCeil` (floor max `ce + 108` <= 204 < PH). |
| spire 40 / 18-80 | Coherent | Tallest tip at 144; with ceiling about 30 the gap is about 114, close to the floor. No unfair case found: cell heights are hash-varied. |
| vent 150 / 14 / 16 / 26 / 24 | Coherent | Footprint 80 of 150 px. Mouth 16 raises the ceiling at the vent. Hood drop 24 -> ceiling at most 64. |
| throat 108-150 / 170 / 14 | Coherent | Sampling at TS = 4 can never hit x = 85 + 170k exactly (odd), so the min is never at exactly 108.0 in the array. |
| polyp 130 / 30-56 / 15% bare | Fair | Bulge up to 56 px; `keepFloor` holds 108. |

Gap guarantee: every return keeps `MOVE_GAP`, and a lerp of two gaps >= 108 stays >= 108, so the blends are safe. I agree with `terrainb.ts:6`.

Comment and probe convention: see S4. Rationale present for 9 of 9 rows, per-value probe named for 0 of 9.

## 2. `moveHazMul`

- Direction: interval multiplier, .7 = more frequent. Matches the lane's reading; see the S3 question.
- Applied to the right timer: `G.hazT` reset (`biomes.ts:152`). Inside the band only: `moveAt` returns non-null only between a + blend and z - blend. Right biome and variant only: ice and `mv === 0`, nothing else returns anything but 1.
- Magnitude and lag: S3.

## 3. Set-piece composition

Slot weight conventions (spec): S1 .23 build A, S2 .53 build B (lighter), S3 .86 peak. Delay column: latest `later(...)` in the piece.

| Piece | Spawns | Delay | Proxy pts | Frame-90 count | Verdict |
|---|---|---|---|---|---|
| thaw | 3 corpses | 50 | 3 | 3 | Light. Fine for S2. y 203 problem (S1 above). |
| vigil | 2 eyes + corpse | 40 | 4 | 3 | Light. |
| pack | 2 mutants + flayer | 45 | 8 | 3 | Heaviest new ice piece, with the fewest spawns. Count is misleading; this is an S3 piece. |
| slurry | 6 drones + crawler | 40 | 4 | 7 | Not heavy, but the highest simultaneous count. See retune below. |
| vats | 2 wombs + eye | 45 | 4.5 | 4 | Fine. |
| lining | 2 eyes + 4-6 rear hatchlings | 0 | 5 | 2 | Not an outlier (frame-90 count excludes rear spawns). |
| meatline | 3 hooks + flayer | 50 | 6.5 | 4 | Medium. S1 or S3. |
| backdraft | 4 rear drones (2 + 2) + mutant | 0 | 5 | 1 | Weakest on screen. See retune below. |
| cinders | 3 dive drones + flayer | 40 | 3.5 | 4 | Light. |
| sneeze | 6-8 rear + 3-5 front hatchlings | 0 | 4 | 4 | 9-13 spawns, below flood's 13-17. Matches the comment. |
| clot | womb + 2 slimes | 0 | 3.5 | 4 | Light. |
| congestion | 2 corpses + 4-6 front hatchlings | 30 | 4 | 8 | Front-loaded: everything on screen in 30 f. See retune below. |

Note on the frame-90 metric: it counts living entities on screen. Rear waves (`behindWave`, `hatch(..., true)`) are mostly not yet in view or already past, so backdraft (1), lining (2) and sneeze (4) are undercounts. For threat, compare spawned counts and delays, and have `tools/set-shots.mjs` also print the spawn count and capture at frames 30, 90, 150.

Concrete retunes, all keeping delays <= 60 f:
- **slurry** (`biomes.ts:234`): stagger the second stream and the crawler so peak concurrency is 4, not 7.
  `formation('sine', PH*.3, 3, FIXED); later(30, () => formation('sine', PH*.7, 3, FIXED)); later(55, () => crawler(1));`
  Same 7 spawns. For S2 use, also lower the second stream y from PH*.7 (178) to PH*.55 (140), away from the lake.
- **congestion** (`biomes.ts:242`): `later(45, () => hatch(ri(3, 5), false))`, down from `ri(4, 6)` at 30. The two static corpses divide the passage into three lanes; fewer hatchlings arriving later keeps the lanes readable. Frame-90 count about 5.
- **backdraft** (`biomes.ts:238`): `behindWave(PH*.3, 3, FIXED); later(40, () => behindWave(PH*.7, 3, FIXED)); mutant();` (6 drones + mutant, 7 spawns, proxy 6). The second wave is then in flight at frame 90. If it is meant to stay light, mark it S2-eligible and leave the count.
- **lining**: no change to the numbers; fix the shot rig (above).
- **clot** (snot is the lightest catalogue): add `later(45, () => hatch(ri(3, 4), false))` for 6-7 spawns (proxy 5). See section 5, snot mass.

Elite exposure: `el()` rolls once per spawn (`biomes.ts:277-282`), so count-heavy pieces (flood 13-17, sneeze 9-13) carry more elite rolls than 3-spawn pieces. No action; keep in mind when weighting `SETW`.

## 4. Draw maths

### Mechanism (traced from `setdraw.ts:25-34`)

After visit 1 the used set holds the 3 drawn ids. A revisit then gets the 2 unused pieces first (they are the only choices left, so S1 and S2), and the refill (`seen = out`, `pool` = the 3 older ids minus the 2 just held) provides S3. So on every revisit S1 and S2 are fresh and S3 is always a recycled piece. At visit 3 the used set holds the 3 pieces from visit 2, so S1 and S2 are the 2 pieces missing from it; S3 is a repeat.

### Expected distribution over a run

6 biome stages, 4 biomes, assuming independent route choice. A biome is visited `k ~ Binomial(6, .25)`.

| k (visits) | P(k) | Slots | Unique pieces | Repeats |
|---|---|---|---|---|
| 0 | .178 | 0 | 0 | 0 |
| 1 | .356 | 3 | 3 | 0 |
| 2 | .297 | 6 | 5 | 1 |
| 3 | .132 | 9 | 5 | 4 |
| 4 | .033 | 12 | 5 | 7 |
| 5 | .004 | 15 | 5 | 10 |

Expected repeats per biome = .297*1 + .132*4 + .033*7 + .004*10 = 1.10, so about 4.4 of 18 slots (24%) repeat inside one run. The real route is not independent (forks, visit counts), so treat as indicative. No piece repeats before all five have shown.

### Same-biome share (formula)

`share(N) = E|A ∩ B| / SETS_PER_STAGE = (k^2 / N) / k = k / N`, with k = `SETS_PER_STAGE` = 3, for two independent uniform k-subsets of an N-piece catalogue.

| Symbol | Type | Range | Description |
|---|---|---|---|
| N | int | 5-8 | Catalogue size per biome |
| k | int | 3 | Pieces drawn per stage (`SETS_PER_STAGE`) |
| share | float | 0-1 | Expected fraction of one stage's pieces also in the other stage |

Output range: unbounded above only by N >= k; at N = k it is 1. For the range that matters:

| N | share | Cost |
|---|---|---|
| 5 | 60% (matches `set-share.txt`) | built |
| 6 | 50% (exactly the target, not under) | +1 piece per biome, 4 total |
| 7 | 43% | +2 per biome, 8 total |
| 8 | 37.5% | +3 per biome, 12 total |

Worked example: N = 7, k = 3 gives 9/7 = 1.29 shared pieces, 1.29 / 3 = 43%.

- A piece costs about one `SET` line, one entry in `CATALOG` and the 3 test touchpoints (`setdraw.test.ts` step check, `biomebeats.test.ts` D20 loop, a set-shots entry), plus a screenshot.
- Zero-catalogue options: cross-run memory (exclude the last run's trio, so consecutive runs share at most 1 of 3 = 33%) costs a `meta` field, a `save.ts` migration, and only helps the same player on consecutive runs, not "two seeds". Dropping to 2 pieces per stage gives 2/5 = 40% but loses the 3-slot rhythm.
- **Recommendation:** accept 60% same-biome for LS2-mv (the whole-run requirement, 15-18%, passes with wide margin) and log "N >= 7" as the catalogue growth target, to land with round 2. Do not add pieces just to hit the same-biome number.

## 5. Density

- The build B tempo row (gap 1.1, dbl -.1; `layout.ts:224`) is already on main. This lane did not change it. The density change from LS2-mv comes only from the set pieces and the hazard multiplier.
- Derived spawn rates, `rate = (60 / (B.gap * T.gap)) * (1 + dbl)`:

  | Biome | Build A | Build B | Peak |
  |---|---|---|---|
  | ice | .81/s | .69/s | 1.18/s |
  | acid | .74/s | .63/s | 1.09/s |
  | fire | .96/s | .82/s | 1.40/s |
  | snot | .72/s | .61/s | 1.06/s |

  Build B is 15% lighter than Build A in every biome (.848-.852). That satisfies "lighter", but only just, and the target the brief quotes (about 1.0/s builds) is met by neither build (.61-.96). The 1.0-1.7/s figure in `docs/pacing.md` §3.1 is the Peak target; it is met in derivation (1.06-1.40) but the probe measures lower (see next).
- `density-probe` (`density.txt`) does not isolate Build B. Its "peak" column is everything after breath 1: build B, breath 2, and peak together. Over 1543 px (25.7 s) with breath 2 (about 3.9 s of zero) that gives peak-only about .88/s for ice D1 (19.3 / 21.8). It reports only breath 1 (p .34-.41), so breath 2 is not shown. Its "breath 0.0" row therefore confirms only the first breath. It also calls `biomeScript` without `setIds` and counts a set piece as one call.
- **Fix.** Split the probe's columns by tempo band (intro A, intro B, build A, build B, peak), report both breaths, and pass drawn `setIds`. Then record build B explicitly, expecting about .6-.8/s.
- Set-piece mass (the larger density change). Nominal spawns of the three set slots per stage:

  | Biome | Before (signature x3, first visit) | After (catalogue mean x3) |
  |---|---|---|
  | ice | 12 | 10.2 |
  | acid | 18 | 17.4 |
  | fire | 12 | 13.2 |
  | snot | 45 (flood 15 x3) | 25.2 |

  Snot loses about 20 enemies per stage, roughly 30% of its stage enemy count (proxy points: 24 -> 15.6, -35%). Intended or not, it is the biggest density shift in the lane and the probe does not see it. Either accept (flood x3 was the known repetition problem) or lift the light snot pieces (clot, retuned above) so the stage mean is about 5.2 -> 6 proxy points.
- Gimmick plus lighter spawns: inside the 456 px band the player sees about 4.6-6.2 spawn events (rate x 7.6 s, before the S2 piece) and a terrain gimmick that pinches to 108 only at the throat/stair-top/crevasse-tip cells. That fits "terrain is the threat" except where B1 above lets a heavy piece into S2.

## Acceptance checks I recommend adding

1. `tests/unit/setdraw.test.ts`: S2 is the argmin of `SETW` over the drawn trio, and the draw stream consumed is unchanged (same `G.picks`).
2. `tests/unit/biomebeats.test.ts`: D20 over `pend` fire frames, not just script x.
3. `tools/set-shots.mjs`: S2 pieces on B0 and B1 terrain at p .53, spawned count printed, frames 30/90/150.
4. `tools/density-probe.mjs`: tempo-band split, both breaths, `setIds` passed.
5. Route-probe at loop 2 for ice B0, `hazHitFrames` read.

## Open questions for Matt

- "Icicles every x.7 as often": interval x.7 (built) or rate x.7?
- Is B0 meant to be mostly a first-visit-only gimmick, with D3 about 87% B1?
- Snot set-piece mass -30%: accept, or retune clot / sneeze up?
- N = 5 catalogue accepted for this lane, with N >= 7 booked for round 2?
