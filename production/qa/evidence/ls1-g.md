# LS1-G evidence: the long4 economy

Row G of LS1 sprint 3, for the economy-designer and systems-designer roles. It wires spec §7's `long4` column
(design/content-expansion.md) on top of G0's tables in `src/economy.ts`, plus D29 (Matt: midboss HP is exempt from
intra-descent depth). The short layout is behaviour-identical: the harness and layout parity are unchanged.

Branch `ls1-g`, rebased onto main `aad830e` (F, H, D27, D28 and D29 merged). G's commits:

- `wire the long4 economy (LS1 item G)`
- `first-kill +100 biomass per midboss kind on long layouts (spec §6.4)`
- `tune: long4 kill biomass x0.65 after F's second midboss`
- `D29, midboss HP is exempt from intra-descent depth`
- this report, the CHANGELOG lines and the midboss-probe `--ord` flag

**The Studio Hierarchy review has not been run.** The brief says G does not run it.

## 1. What changed

| File | Change |
|---|---|
| `src/economy.ts` | `econOf(id)` / `econId()` map the active layout to its entry; unknown or prototype ids map to short. `gradePts` is length-normalised with a **D26 clamp**: `hitW = min(1, ref/Ts)`, so a stage under 35 s never grades harder than today. long4 `killXP` .85 (spec start .75), `killBio` .65 (spec start .75). New field `firstKill` (short 0, long4 100, long5 100) and pure `firstKillPay(id, rec, k)`. |
| `src/stages.ts` | `clearStage` grades through `gradeOf(econId(), st, stageTs(), escaped)` and seals through `sealAt(econId(), cleared)`. `stageTs(i)` = the row's scroll seconds. The local `SEAL_AT` and `grade()` are gone. H's `sealFor()` reads the entry's seal schedule (same {2,4,6} on short and long4). Best grades by kind come from H0's `gradeKey()`, unchanged. |
| `src/perks.ts` | `stageXP` reads the entry's lump (long4 = today's). |
| `src/enemies/update.ts` | Kill XP ×`killXP`, kill orb value ×`killBio` (orb count unchanged). New `firstKill(e)` in the `e.mid` branch: it pays `G.bio`/`meta.bio` once per kind, writes `meta.mbK[k] = 1` and pops "FIRST KILL +100". No `R()`. `miniReward`'s 30 biomass and grade pay are not scaled. |
| `src/depth.ts` | `dep()` = `descDepth(econId(), loop, stage)`: short = `loop`; long4 = `loop + .35·stage/3`. It feeds **regular-enemy HP**, `cdm()` and `firem()` (all enemy fire, midbosses included). **D29:** midboss HP (biome midbosses, the Saucer, the Orbit and mid-stage Maws) takes the integer loop. Stage-boss HP, `xtra()` and `driveMul()` were already on the integer loop. G applies no intra-depth to stage bosses. The per-kind fire curves (`cadence.ts`) and the depth HP rule are untouched. |
| `src/mutations.ts` | The GLUTTONY thresholds are a getter on `gluttonyN(econId())`: short [2,4], long4 [3,6]. |
| `src/save.ts` | `meta.mbK` default `{}`, cleaned on every load like `meta.mb` (finite numbers ≥ 1 kept, stored as 1). |
| `tests/unit/economy.test.ts` | Clamp test (replaces the uncapped one), `econOf` mapping, `ECON[id].n` = layout stage count, live GM 'over' `.n` per layout, killXP .85 / killBio .65, `firstKillPay` (pays once, short 0, replay pays 0, inherited keys ignored). |
| `tests/unit/stages.test.ts` | long4 `clearStage`: `stageTs` per row; 1-hit Drive = S on long4 / A on short; 2 hits or 1 death = A; 60% / 4 hits = B on long4 / C on short; seal schedule unchanged. |
| `tests/unit/depth.test.ts` | Intra-descent depth on long4: Orbit D1 = 1×; the Drive stage reads .35 for fodder HP, `cdm`, `firem`. D29: midboss HP is 1× at Descent 1 stages 1-3 while `cdm()` < 1 and fodder takes the intra term. Stage bosses, `xtra` and `driveMul` stay on the integer loop. Also D1 power-independence, and short `dep()` = loop. |
| `tests/unit/save.test.ts` | `meta.mbK` default and malformed-input cleaning. |
| `tests/unit/midboss-hp.test.ts` (D27's) | D29: the Apprentice is exactly 200 on long4 and 150 on short at stages 1 and 2 in Descent 1. `meet()` takes a stage. D27's own assertions are unchanged. |
| `tools/pod-probe.mjs` | `--mortal`; per-tally `grades` (grade, hits, deaths, kill%, spawns, LV, biomass, first-kill count); `bossFight_s` (Drive up-time); `firstKills`. |
| `tools/playtest.mjs` | Per-stage `danger:` line: would-be hits, hits/min, regular spawns. |
| `tools/midboss-probe.mjs` | `--ord <stage>`: spawn at that stage ordinal's depth (slot B's depth on slot A's terrain). |
| `CHANGELOG.md` | Lines added to the combined 2026-11-03 entry. |
| `production/qa/evidence/` | `ls1-g-long4-tally-1hit.png` (S, 1 hit), `ls1-g-short-tally-1hit.png` (A, same stats), `ls1-g-long4-pause-gluttony.png` (GLUTTONY 0/3), `ls1-g-long4-first-kill.png` ("FIRST KILL +100"). |

**No extra lives on long4.** `driveLife` is null on short and long4 (D26). long5 wires it at LS3-0. Descent 1 elites
are also null on both.

## 2. Acceptance checklist

| Item | Result |
|---|---|
| Seals {2,4,6} | **PASS**. `sealAt('long4')` = short's schedule (unit test), and `clearStage` and `sealFor` read it. |
| Normalised grades, S ≤ 1 hit and 0 deaths (D26 clamp) | **PASS**. Unit tests, plus tally screenshots of the same 1-hit Drive clear: S on long4, A on short. |
| Kill XP ×.75 start | **Tuned to ×.85.** At .75, end-of-D1 LV sat on the low edge (12/14/12/12). |
| Kill biomass ×.75 start | **Tuned to ×.65.** F's second midboss pushed D1 biomass over the band at .75 (§3.1). |
| Intra-descent depth .35 (N = 4) | **PASS**, as amended by D29 (regular-enemy HP and all fire; midboss HP exempt). `depth.test.ts`. Orbit D1 unchanged. |
| D29: midboss HP exempt; D27's 8-11 s band in slots A and B | **PASS**. Unit tests (watched failing on the pre-D29 code); midboss-probe §3.5. |
| GLUTTONY [3,6] | **PASS**. Unit test on the live GM entry; pause screenshot shows 0/3. |
| Best grades by kind via `gradeKey()` | **PASS** (H0's wiring; `stages.test.ts`). |
| No extra lives on long4 | **PASS**. `driveLife` null; nothing reads it on long4. |
| First-kill +100 (spec §6.4; F's carry-forward, taken by G) | **PASS**. Unit tests, in-page check and screenshot (§4). |
| Short layout unchanged: harness and parity identical | **PASS** (§5). |
| `stages.test.ts` and `depth.test.ts` updated for long4 | **PASS**. |
| Evidence: LV 13±1 at end of D1 | **PASS on the median.** 13/15/15/14/13 (median 14); seeds 2 and 3 are one over. |
| Evidence: D1 biomass 1.3-1.5k | **PASS (steady state).** 1434/1416/1613/1447/1310 (median 1434), §3.1. The first run on a fresh profile adds +500. |
| Evidence: hits/min per kind within ±30% of §8 for biome slots 0 and 1 | **NOT DEMONSTRATED** (§3.4). It runs low in most cells, but on counts of 0-3 hits per stage. Not tuned. |
| Orbit and Drive hits/min measured only | Measured (§3.4). |

## 3. Probe output

All of this runs on long4's Descent 1 with the invincible pod-probe bot (seeds 1-5) unless marked otherwise.
"Final" = the shipped build (D29 on top of main `aad830e`), each run on a freshly started dev server. Every run
reported `errors: []`.

### 3.1 End-of-Descent-1 LV and biomass

"Steady" is run biomass minus 100 per first-kill kind. The probe starts on a fresh profile, so every midboss kind
killed pays once. That pay happens once per profile, so the spec's band is read against steady state.

| Build | Seed 1 | 2 | 3 | 4 | 5 | Median |
|---|---|---|---|---|---|---|
| Before G (×1/×1), pre-F | LV 14, 1866 | 13, 1818 | 14, 1796 | 13, 1748 | 13, 1799 | LV 13, 1799 |
| .75/.75, pre-F (seeds 1-4) | 12, 1570 | 14, 1354 | 12, 1368 | 12, 1300 | — | LV 12 |
| .85/.75, pre-F | 13, 1488 | 15, 1311 | 13, 1681 | 13, 1436 | 12, 1365 | LV 13, 1436 |
| .85/.75 on main (F+H+D27), steady | 13, 1732 | 15, 1583 | 13, 1412 | 13, 1834 | 13, 1627 | LV 13, 1627 (over) |
| .85/.65 on main, pre-D29, steady | 13, 1537 | 15, 1408 | 13, 1258 | 13, 1625 | 13, 1446 | LV 13, 1446 |
| **Final (.85/.65 + D29), steady** | **13, 1434** | **15, 1416** | **15, 1613** | **14, 1447** | **13, 1310** | **LV 14, 1434** |
| Final, fresh-profile run biomass | 1934 | 1916 | 2113 | 1947 | 1810 | 1934 (5 kinds each) |

Why .65: on main, F's second midboss per biome stage adds kills and biomass, which pushed steady state over the band
at .75. D29 then shortened midboss fights a little, which nudged LV up (median 13 → 14). LV stays in band on the
median, so it was not retuned: the spread per seed is ±1 LV and ±12% biomass, and it follows spawn counts (§3.2).

### 3.2 Carry-forward 5: biome spawns and the Drive fight

**Regular spawns per stage** (`G.st.spawned`, final build). The spec expects 55-70 per biome stage; the pre-wiring
note said 30-40.

| Seed | Orbit | Biome A | Biome B | Drive |
|---|---|---|---|---|
| 1 | 132 | 48 | 62 | 143 |
| 2 | 115 | 114 | 58 | 123 |
| 3 | 127 | 48 | 53 | 138 |
| 4 | 107 | 61 | 47 | 127 |
| 5 | 127 | 55 | 51 | 137 |

Typical biome stages land at 47-62, on or just under the spec's 55-70. That is about 1.5× today's 30-40, against the
spec's 1.7×. One stage in ten here (seed 2, biome A: 114) runs far denser; it is a biome whose script runs heavier
waves (the pre-D29 runs also showed 105-117 on two others). **Tempo table not tuned**: the economy targets are met
without it.

**Drive fight** (seconds the Drive is up and not dying; invincible bot). The spec says 30-45 s.

| | Seed 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Pre-F, .85/.75 | 45.8 | 46.7 | 36.3 | 30.8 | 32.9 |
| Final | 49.5 | 40.3 | 36.6 | 40.3 | 43.3 |

playtest.mjs (final build, natural kit): Descent 1 52.8 s (seed 7) / 51.3 s (seed 11); Descent 2 24.4 / 32.7 s.
The Drive's HP keeps the integer loop (`driveMul`), and G does not touch it. The Descent 1 fight is 37-53 s, so one
pod-probe seed of five and both playtest seeds are over 45. Measured only, as the brief asks: the Drive is not banded
in LS1.

**Tally (wall) seconds** per stage, final build: Orbit 78-80, biome A 85-104, biome B 76-80, Drive 83-95.
playtest.mjs stage times: biome stages 81-112 s. F's 90-120 s biome band: biome A reaches it on most seeds; biome B
sits just under it.

### 3.3 Mortal bot (grades)

`--mortal` on the main build (pre-D29; D29 cannot reach these runs). Every run game-overs in long4's first biome
(short: stage 1-2), so only Orbit grades exist. They are identical before and after the rebase: Open Orbit has dep = 0
and kills no midboss before the tally.

| Seed | long4 Orbit | short stage 1-1 |
|---|---|---|
| 1 | C (5 hits, 2 deaths, 96%) | A (3 hits, 100%) |
| 2 | B (6 hits, 1 death, 89%) | A (2 hits, 96%) |
| 3 | A (4 hits, 98%) | C (3 hits, 2 deaths, 90%) |
| 4 | A (4 hits, 100%) | B (4 hits, 1 death, 100%) |
| 5 | S (1 hit, 98%) | A (3 hits, 96%) |

Both medians are A. long4's 73 s Orbit takes more hits than short's ~35 s stage, and normalisation keeps the grade
level with short's. The mortal bot cannot reach a biome midboss or the Drive, so the grades past Orbit and the Drive
fight come from the invincible bot only. The invincible runs grade S on every tally (0 hits).

### 3.4 Hits per minute (`tools/playtest.mjs`, invincible bot, natural kit, final build, 2 descents)

Would-be hits per minute, seed 7 / seed 11, against spec §8's `long4` target (±30% band in brackets).

| Stage | D1 measured | D1 target | D2 measured | D2 target |
|---|---|---|---|---|
| Orbit | 0 / 0 | .5 [.35-.65] | .73 / 0 | 1.0 [.7-1.3] |
| Biome slot 0 (banded) | .62 / 0 | .8 [.56-1.04] | 0 / .67 | 1.3 [.91-1.69] |
| Biome slot 1 (banded) | .68 / 0 | 1.1 [.77-1.43] | 1.96 / .72 | 1.6 [1.12-2.08] |
| Drive | .57 / 0 | 1.3 [.91-1.69] | 0 / .71 | 1.8 [1.26-2.34] |

Whole run: seed 7 0.6/min (7 hits in 12.1 min), seed 11 0.2/min (3 in 12.1 min). An earlier pre-F 3-descent run of
seed 7 measured 0.9/min.

Read: 2 of the 8 banded cells are in band (seed 7: D1 slot 0 and D2 slot 1), and so is 1 measured-only cell (seed 7,
D2 Orbit). The other 13 of 16 are below the band's floor, and none is above it. But each cell is 0-3 hits, and one hit moves a stage by ~0.7/min. The
direction (long4 reads low for the invincible bot) is plausible. The magnitude is not established, and the band is
**not demonstrated**. Depth was not tuned on it: the fire curves are pinned, D29 just set the midboss HP rule, and a
banded read needs many seeds per kind or a mortal bot that survives the biomes. This is a risk for the LS2 banding.

### 3.5 Midboss TTK: D29 check (slot A and slot B)

`tools/midboss-probe.mjs --layout long4`, STAGE 1 kit, seconds. The default run sits at slot A's ordinal (stage 1;
`--ord 1` gives identical results). `--ord 2` is slot B's depth with slot B's leave clock (1260 f).

| Build / depth | Maw (mid) | Nail Choir | Diss. Womb | Apprentice | Brood Mother |
|---|---|---|---|---|---|
| Pre-D29, no intra depth (`--ord 0`; D27's basis) | 9.1 | 10.0 | 8.7 | 10.2 | 9.5 |
| Pre-D29, slot A (HP ×1.13) | 9.6 | 12.7 | 9.3 | 10.4 | 9.9 |
| Pre-D29, slot B (HP ×1.26) | 10.3 | 13.2 | 10.2 | 11.6 | 10.3 |
| **Final (D29), slot A** | **9.1** | **10.0** | **8.7** | **10.1** | **9.5** |
| **Final (D29), slot B** | **9.1** | **10.0** | **8.7** | **9.9** | **9.3** |

With D29, every held kind is in D27's 8-11 s band in both slots, and the Apprentice runs ~10 s. Midboss fire still
reads `dep()` (D29 is HP only). It barely moves TTK: the Choir is 10.0 s in both slots. So the pre-D29 Choir jump came
from HP, not fire. The Saucer (5.4 s) is shown for completeness. It fights in Open Orbit, where dep = 0.

## 4. In-page check: first-kill pay

A scratch check on a fresh dev server spawns and kills cyst, cyst, brood through the real `midboss()` and
`killEnemy()`:

```
long4: dG/dM = 100/100, 0/0, 100/100; meta.mbK = {cyst:1, brood:1}
short: dG/dM = 0/0, 0/0, 0/0;          meta.mbK = {}
```

Screenshot: `ls1-g-long4-first-kill.png`. The pop overlaps a graft pop at the same kill point. It reads, but the two
stack (minor; see §7).

The harness does not reach this code: the long4 harness run dies in Open Orbit before the Saucer is killed. The unit
tests and this in-page check cover it.

## 5. Gates (final build: D29 commit)

```
npm run typecheck          OK
npx vitest run             26 files, 495 tests passed
npm run build              OK
npm run test:regress       PASS vs baseline @ 8ff9ba4 (short)
                           PASS (long4) vs baseline @ 88d9525
                           (6/6 canvas hashes differ: advisory, environmental, see §9)
node tools/layout-parity.mjs
  PARITY PASS: runs 3, 6, 7, 11, 15, 3x3, 7m identical (5 seeds x 2 descents + 3x3 + 7m)
```

There was **no harness re-baseline**. The long4 harness pass dies in Open Orbit, where dep = 0 and no midboss is
killed, so neither intra depth, D29 nor first-kill pay reaches it.

## 6. Open questions and flags (for the Studio review and Matt)

- **Q-G1 (midbosses vs intra-descent depth): settled by D29** (Matt, option a). Implemented and checked (§3.5).
- **D19 / Pillar 4 wording.** `design/game-brief.md` line 34 still says "about 35 s stages". long4's stages scroll
  57-73 s, with 76-104 s tallies. Not edited (it is Matt's to approve). Flagged here.
- **Hits/min reads low** for the invincible bot on long4 (§3.4), but it is not established on these counts. It needs
  a proper banded read before LS2 bands Orbit and the Drive.
- **Drive fight** is 37-53 s in Descent 1 against 30-45 s (measured only).
- **Spawn density.** Typical biome stages land at 47-62 regular spawns against the spec's 55-70; one in ten runs
  denser (§3.2). The economy meets its targets either way, so the tempo table is unchanged.

## 7. Not measured, stubs and risks

- **Not measured:** grades and hits past Open Orbit with a mortal bot (it game-overs in the first biome); Descent 2-3
  economy targets (the spec's D2/D3 biomass bands, 2100-2400 / 2600-3600: the probe ran Descent 1); Fold and phone
  feel; the long4 harness never reaches a biome midboss, a first kill or the Drive.
- **First-kill pay is once per profile.** A probe or playtester on an old profile sees steady state; a new player's first
  run gets about +500 in Descent 1 (5 kinds). The spec's band is read as steady state here, and the probe reports both.
- **Resume and the first-kill record.** `meta.mbK` guards the pay, so a kill replayed after a resume pays nothing (unit
  test). The run's `G.bio` is restored from the checkpoint, so that run loses the 100 while the profile's `meta.bio`
  keeps it. H's Q2 / D28 (deaths before a checkpoint don't count after a resume) also affects grades. Accepted by Matt
  as known.
- **Not scaled by `killBio`:** `miniReward`'s 30 biomass per stage boss, grade pay, and Infirmary pay (by design: spec
  §7 scales kill pods only).
- **The FIRST KILL pop** stacks with graft and level pops at the kill point (minor UI).
- **Seeds:** five per measurement, invincible bot. The LV and biomass medians are in band, but the per-seed spread
  (LV 13-15, biomass 1310-1613) touches or crosses both edges.

## 8. Merge-order notes

- F merged first (`9a62927`), then H and D27 (`0fc066c`), then the D28 and D29 docs (`aad830e`). G is rebased onto
  `aad830e`. One conflict, in `src/stages.ts`: H's `sealFor()` used the old `SEAL_AT`, and it now reads the economy
  schedule.
- D27's `midboss-hp.test.ts`: `meet()` takes a stage. D29's test replaces the intra-factor test G had added before
  the ruling.
- CHANGELOG: G's lines are in the combined 2026-11-03 entry, whose heading gains "the long-stage economy".
- The economy figures quoted earlier in this lane against pre-F or pre-D29 builds are superseded by the "Final" rows.

## 9. Environment notes

- Canvas hashes: this worktree's `node_modules` is a symlink into the main checkout, which is outside Vite's serving
  allow list. The fonts don't load, so every hash differs. This is the same environmental cause G0 recorded. Sim state is
  the gate, and it passes.
- The shell's `grep` is a broken wrapper function in this environment; use `command grep`.
- The probes need a Vite dev server. After `src/` changes or a rebase, restart it: Vite's HMR can leave two copies of
  `layout.ts`, so a probe's `setLayout()` and the game read different entries. This hit one of my in-page checks
  (short paid first-kill) until I restarted the server.
