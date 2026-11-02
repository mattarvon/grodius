# LS1-D: the long layout and beat template v2, behind `?layout=long` (sprint 2, lane d)

*level-designer + gameplay-programmer, 2026-11-01. Branch `ls1-d`, rebased onto `origin/ls1-s2` at `d3daf63` (J, B1fix and C/B2 merged). All gates below were re-run on that base against its baselines; nothing was re-baselined. Spec: `design/content-expansion.md` §2.2, §3.2-3.4. Plan: `production/content-build-plan.md` §2 sprint 2, row D. Rulings: `production/decision-log.md` D20.*

## Commits

| Commit | What |
|---|---|
| `c6ffc94` | `long4` entry, BREATHS table, `beatPlan()`, beat template v2 in `biomeScript`, movement C, log pool; tests |
| `7f4784c` | `?layout=long` flag parse in `src/main.ts` |
| `8c676c4` | Three new tools: `stage-clock`, `beat-probe`, `movement-shots` |
| `c65daeb` | After J: `long4` registered in `LAYOUTS`; `setLayout` own-keys fix; Saucer at 1080; J's `density-probe` reads `beatPlan`; tools on J's `--layout` |
| `3d392c7` | First report, probe output, screenshots |
| `cde9216` | After C/B2: the beat and density probes and `biomebeats.test.ts` set a run seed per roll (build rolls now draw the stage stream) |
| (this commit) | Report refreshed on the `d3daf63` base |

## What changed

### `src/layout.ts`

**Beats are now a table.** `Beats` used to hold one breath (`breath: {end, len}`). It now has:
- `breaths`: a BREATHS list. `mid` marks the breath that holds the biome midboss; `release` adds a pod formation and log line 2 when it ends.
- `tempo`: the spawn loop's bands. Each runs until a p value, or until the end of breath *i*, and sets the gap multiplier, the double chance (absolute, or relative to `B.dbl`), the signature picker, a lead slot (signature, or the second-ranked kind), the Descent 2+ third spawn, and `stop` (the run-up).
- `gateLead`: the offset from the gate x at which the spawn span starts.
- `runup` and `arenaBlend`: optional. Only `long4` sets them.

**Short keeps its numbers.** Today's single breath and today's intro/build/peak/tail tempo are written into the new shape. `layout.test.ts` pins them, and the parity check proves the script is unchanged.

**`beatPlan(row, from, remix)`** is the one place that computes a biome stage's beats: the span, p → x, the breaths, the set pieces, the midboss WARNING and the run-up. `biomeScript`, `rewriteTerrain` (movement C), the invariant test and the probes all read it, so the test can no longer drift from the game.

**`setLayout` uses `Object.hasOwn`.** Before, `?layout=constructor` (or `__proto__`, `toString`) resolved to `Object`'s constructor, and the game ran on undefined rows. Found while checking the flag in a real page. A test covers it, and I watched it fail on the old lookup.

### The `long4` entry

| Stage | Kind | x0 → x1 | bossX | Other |
|---|---|---|---|---|
| 0 | orbit | 0 → 3600 | 3420 (the Maw) | `warnX` 3300; drift `ufo` at **1080**, gapEnd 2140 (provisional, item E), exitLead 60 |
| 1 | biome slot 0, fork | 3600 → 7220 | 7020 | `end` 7120, `gateLate` 3970, `breathAfterMid` unset |
| 2 | biome slot 1, fork | 7220 → 10970 | 10770 | `end` 10870, `gateLate` 7720, `breathAfterMid` unset |
| 3 | drive | 10970 → 14370 | 13670 (approach 2700) | `warnX` 13430 |

- **How the rows are sized.** Rows are sized by scroll time, not by width. At a fork the scroll holds about 50 px past the Orbit Maw, and about 200 px past a biome boss (its WARNING runs 150 f while the scroll coasts). So each biome stage gets **3550 px from its gate scroll to its `bossX`**, which measures as 59.4 s of scroll.
- **`gateLate`.** Measured gates are 3958/3961 and 7707/7711; `gateLate` rounds these up.
- **LEVEL is 14,370.** The brief estimated about 13,500-14,000. The extra comes from the biome-boss WARNING coasts (2 × 150 px) and from keeping today's 700 px Drive chamber past `bossX`.
- **The Saucer is at 1080, not 1100.** 1100 is already an Orbit script x in `enemies/scripts.ts`, and the anchor grep test (`layout-literals`) flags any anchor number found there. The spec says "around 1100". Item E owns the final value.
- **Bands.** Short's shapes are re-anchored on the long rows: the hull closes at the Orbit's end, the corridor rises at slot 0's boss and squeezes from slot 1, and the chamber opens over the 400 px before the Drive's `bossX`.
- **`tEnd` is [11450, 11750].** That is one screen into the Drive approach. The slot 1 boss arena (scroll about 10970, screen out to about 11450) therefore stays on movement C. `biomeExit`'s look hand-back lands at the same x.
- **`hell`: PROVISIONAL.** This meets the creative director's condition: real per-kind values come after art round 2 and are never copied from AMT. For now they are keyed to stage rows, not to AMT. `corr` rises over slot 1's first 500 px and falls into the Drive chamber; `core` is the chamber. A test checks that `hell.corr` is not a copy of `bands.corr`.
- **`hudMarks`: PROVISIONAL.** The art director said the tick design for long rows is an art decision. For now they follow today's rule: one tick just inside each biome slot's start (3700, 7270).

### Beat template v2 (`long4` beats)

| p | Beat | Gap / double chance | Notes |
|---|---|---|---|
| — | Entrance | — | The span starts 330 px of scroll after the gate (`gateLead` −160, about 5.5 s), once the terrain has fully blended in. Short keeps +60. Log line 1 at `a − 40` |
| 0-.12 | Intro A | ×1.4 / .2 | Signature alone in the first slot, then the signature 60% of the time |
| .12-.22 | Intro B | ×1.25 / .25 | The second-ranked mix kind gets its own first slot, alone (`secondKind`: the heaviest non-signature kind; the first listed wins a tie) |
| .22-.335 | Build A | ×1 / base | S1 at .23 (remix .20) |
| .335-.41 | **Breath 1** | none | Midboss A: its WARNING sits 210 px before the end, inside the breath (.075 of the span is about 237 px) |
| .41 | Release | — | One pod formation (a `sine` drone wave, which drops a pod when wiped out) and log line 2 |
| .41-.65 | Build B | ×1.1 / base − .1 | S2 at .53 (remix .515). Movement B is a later item |
| .65-.725 | **Breath 2** | none | **Empty in sprint 2.** Slot B's midboss and miniWarn are sprint 3 item F |
| .725-.9 | Peak | ×.75 / base + .15 | S3 at .86 (remix .83). Descent 2+ third spawn (peak only, per spec §3.2) |
| .9-1 | Arena run-up | none | No spawns, and no extra spawn spills in from earlier slots. Log line 3. Movement C blends in |

- **I did not use the spec's fractions.** With S1 at .26 against breath 1 at .30, D20's 300 px rule fails: about 144 px on a 3600 px span, and less on the real span of about 3150. The remix values .22, .46 and .76 fail it too. So both breaths moved and widened, and the set pieces sit inside the windows the rule leaves. The closest gap is 331 px, at the late gate. `long4` passes the invariant test with **no legacy pins**.
- **`B.logs` is now a pool of 4 per biome.** Short still reads lines 1 and 2. Long takes 3 per visit, rotated by visit number, with no RNG.
  - The **2 new lines per biome are drafts** for the writer's pass under D8 (copy rules).
  - ice: "SOMEONE SCRATCHED A TALLY INTO THE FROST. IT STOPS AT 2557." / "THE COLD IS NOT SLOWING THEM DOWN."
  - acid: "A BOOT FLOATS PAST. THE FOOT IS STILL IN IT." / "THE TANK IS NOT FULL. IT IS STILL EATING."
  - fire: "THE ASH HAS FINGERPRINTS." / "COOLANT LINES CUT BY HAND. SOMEONE WANTED IT HOT."
  - snot: "MY INTAKES ARE CLOGGED. THE CLOG IS CHEWING." / "IT SNEEZED. I AM STILL INSIDE IT."
- **Movement A** is today's `shape()`, unchanged.
- **Movement C** (arena): `shape()` at half its swing around each biome's resting edges, with the gap opened to at least `ARENA_GAP` = 150. It is blended with `sstep` over 200 px starting at the run-up's scroll x, so the whole screen is arena by the time the run-up starts.
- **Short's path draws the same `R()` calls in the same order.** Its tempo bands reproduce `intro` / `peak` / tail exactly, and its lead slot is today's "n = 0: signature alone". The parity check and the harness prove it.

### `src/main.ts`: the flag

`?layout=long` (or `long4`) calls `setLayout('long4')` at boot, before any `newGame()`. `short` selects short. Any other value is tried as an entry id. If that fails, the game logs a console warning and flies short; it never crashes. Checked in a real page:

```
(none) -> short;  ?layout=long -> long4;  ?layout=short -> short
?layout=bogus -> short, warning "?layout=bogus: unknown layout bogus; flying the short layout"
?layout=long5 -> short, warning;  ?layout=constructor -> undefined before the hasOwn fix, short + warning after
```

D2 adds the persisted LAB toggle on top of this.

### Tools

| Tool | What it does |
|---|---|
| `tools/stage-clock.mjs` (new) | Per stage: **scroll time**, meaning sim frames (`G.t` steps; a perk pick's 1/5-speed crawl and hitstop don't count) from `startStage` until the scroll reaches `bossX`, minus the frames a held midboss is up. Also held time, wall time, and the midboss. Biome stages are checked against 58-62 s |
| `tools/beat-probe.mjs` (new) | `density-probe` generalised to an entry's own beat bands. Flags spawns inside a breath or the run-up, a peak over 1.7/s, and set pieces within 150 px of a WARNING |
| `tools/movement-shots.mjs` (new) | Frames of movements A, A→C and C per biome and slot, with measured minimum gaps |
| `tools/density-probe.mjs` (J's) | Now reads the breath from `beatPlan`, since `beats.breath` no longer exists. Its band set is still short's; `beat-probe` reports long4's own bands |

All three new tools take J's `--layout <id>` (`tools/layout-arg.mjs`).

## Acceptance checklist

| Criterion | Result |
|---|---|
| Biome stage scroll time 58-62 s | **PASS: 59.4 s on every biome stage.** 8 stages on the final base (seeds 1, 5 × 2 descents, `stage-clock-long4.txt`), 10 on the J-only base (seeds 1, 5, 7 × 2) and 16 before that (seeds 1, 5, 6, 7, 11, up to 2 descents each; `stage-clock-long4-pre-rebase.txt`, run with the Saucer at 1100 and the then-temporary registration), across all 4 biomes, both slots, first visits and a repeat (snot+). It is deterministic, because the scroll rate doesn't depend on the bot |
| Breaths empty | **PASS.** `beat-probe`: 0 spawn calls in a breath over 4 biomes × 2 slots × 2 visits × 2 descents × 200 rolls. `biomebeats.test.ts` checks the same for every biome, slot, visit and descent |
| No set piece within 150 px of a WARNING | **PASS: closest 357 px.** That includes breath 2's future WARNING slot and `bossX`, at both gates and on remix (`layout.test.ts`, `beat-probe`) |
| Arena gap ≥ 150 | **PASS: minimum 154.6 px** (slot 1 snot). Measured from the run-up + 200 px to the boss arena's right screen edge, every biome and slot (`movement-shots-long4.txt`) |
| Short layout: harness and parity identical | **PASS on the final base.** Harness `PASS vs baseline @ 8ff9ba4` (ls1-s2's). Parity `PASS vs baseline @ ls1-s2 after J + B1FIX + C/B2`: runs 3, 6, 7, 11, 15, 3x3 and 7m identical (`layout-parity-short.txt`). Also passed on each earlier base (`main` 8ff9ba4, `ls1-s2` with J only) |
| D20 invariants on `long4`, both gates, no legacy exceptions | **PASS** (`layout.test.ts`) |
| Every stage kind has data | **PASS.** `long4` uses only orbit, biome and drive (`layout-kinds.test.ts` now runs over long4 too) |
| `npm run test:unit`, `typecheck`, `build` | **339/339** tests on the final base. `tsc --noEmit` clean. Build OK. The ">500 kB chunk" notice is pre-existing: `ls1-s2` (J base) already built 513.5 kB, and this lane adds about 3.3 kB |

## Evidence (row D's column)

- **`density-probe` on long4** (`density-probe-long4.txt`, J's probe with short's band set) and **`beat-probe`** (`beat-probe-long4.txt`, long4's own bands; short alongside in `beat-probe-short.txt`).
  - Peak **≤ 1.59/s** (exit ≤ 1.7). Each of the 200 rolls per row uses its own run seed (build rolls draw the stage stream since B2).
  - Rates per band match short's: intro about 0.5/s, builds 0.5-0.8/s, peak 1.0-1.6/s.
- **`route-probe`** (`route-probe-long4.txt`).
  - Coverage: 4 gate combinations × 2 descents, plus all **12 ordered biome routes** (forced).
  - Every run reached the Infirmary with **0 slams and 0 deaths, and 0 hazards spawned in a bad state**.
  - **One flag, explained as a probe artifact.** On the final base, gates `01` logged `state:jet`. route-probe steps up to 5 sim frames per rAF and checks the state only after the batch. A temporary copy that logs each flagged hazard's age reproduced it once in 6 runs as `icicle@hazAge2,tallyAge1,minicrux`. The hazard spawned 2 frames earlier, during the live biome-boss fight; the boss died one frame later and opened the tally. The spawn rule (no hazards during a fork, tally or death) held. The same batching can flag this on short. The other 31 runs on this base, and all 32 on earlier bases, flagged nothing.
  - route-probe is not seeded (`Math.random`), so reruns differ.
  - Minimum on-screen gap 113.6 px.
  - The only page messages were font 403s (environment, as `ls1-a.md` notes).
- **Screenshots** in `production/qa/evidence/ls1-d/`, rendered with real fonts and full frames, empty of enemies:
  - `s0-<biome>-A.png`: movement A.
  - `s0-<biome>-AtoC.png`: the run-up's first screen, A blending into C.
  - `s0-<biome>-C.png` and `s1-<biome>-C.png`: the boss arena.

## Open risks and things not measured

1. **Biome stages spawn fewer enemies than the spec expects.**
   - Spawned per long biome stage (route-probe tallies of the 12 forced routes, 24 stages, final base): 44-128, median about 60.
   - The same bot on short (8 stages, J base): 37-95, median about 44.
   - The spec expects 55-70, against 30-40 today. Rates per band match today's, as spec §3.2 asks. The total comes out about ×1.3 rather than ×1.7, because the template itself is about 25% empty: two breaths, the release and the run-up.
   - Ice and acid sit low (44-80); the Sinus runs high (98-128, hatchling litters).
   - This feeds item G's economy band (D1 biomass 1.3-1.5k). The knobs are `long4.beats.tempo` (gap multipliers) and `pad`/`gateLead`. Owner: game-designer with G.
2. **The bot can't kill the Gravity Drive on long4 on some seeds.**
   - Each base gives different runs. First base: seeds 6 and 11 timed out at the Descent 1 Drive fight (about 27 min). J base: seed 7 did, and seed 5's Descent 2 Drive took 1106 s. Final base: seed 1's Descent 1 Drive took 988 s.
   - This is the same bot-kit limit the parity check has with seeds 2 and 3 on short.
   - Not hidden: `stage-clock-long4*.txt` shows them. It doesn't touch the biome measurements, which finish before the Drive.
3. **Stage wall times are for an invincible bot**, not the LS1 exit instrument.
   - Biome stages took 70-100 s here, with only midboss A (item F adds midboss B). Orbit took 66-85 s and the Drive 76-93 s.
   - The exit bands (`playtest.mjs`, natural kit) are measured at sprint 3.
4. **Orbit and Drive content is item E's.**
   - Until E lands, long4 replays today's scripts placed by their rows. That leaves about 23 s of empty Orbit after the Saucer window (1900 → 3300), and about 29 s of empty Drive approach (700 → 2460).
   - The Saucer's `gapEnd` 2140 is provisional.
5. **Provisional values awaiting art round 2:** `hell` (creative-director condition) and `hudMarks` (art-director decision).
6. **Draft log lines** (8 new lines) need the writer's pass.
7. **Not measured:**
   - Render-only output in the bot runs.
   - A mortal pilot on long4.
   - The early gate in `beat-probe` (only `gateLate`, the shorter and denser span; the unit tests check both gates).
   - Descent 3+.
   - Movement B (a later item).
   - Fold or perf readings (item K).
8. **Build rolls are on B2's per-stage stream** for long4 too: the remix, kind rolls and extras all draw `rs()`. The long path adds no draw of its own: `logPick` and `secondKind` are RNG-free. Elite rolls stay at spawn time on `R()`, as B2 left them.

## Merge-order notes

- **Base.** Rebased on `ls1-s2` at `d3daf63` (J, B1fix, C/B2). It fast-forwards onto that tip. The `LAYOUTS.long4` registration depends on J's alias deletion.
- **How the C/B2 conflict was resolved.** Git's auto-merge of `biomes.ts` interleaved `rewriteTerrain` with `remix`. So the file was rebuilt from `ls1-s2`'s version, with D's edits re-applied on top.
  - `biomeScript` keeps B2's `rs` parameter, `remix(..., rs)`, every build roll on `rs()` and the `k` tags on every entry. The release formation is tagged `'pod'`.
  - The short path draws `rs()` in B2's order: the harness and parity pass against B2's baselines.
- **E** fills the long Orbit/Drive rows' content in `layout.ts`/`scripts.ts`. The `long4` Orbit/Drive rows here are the spans E builds into.
- **J's `density-probe`** needs this lane's one-line change (it read `beats.breath`), included here.
- **D2** goes in after this lane's flag parse (`LAYOUT_FLAG` in `main.ts`).
- **F (sprint 3)** puts slot B's `miniWarn` in breath 2, `warnLead` before its end. The invariant test already checks set pieces against that slot.
