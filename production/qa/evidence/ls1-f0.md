# LS1-F0: midboss picker (pure module, no wiring)

*Lane f0, branch `ls1-f0` off main `f2f9c03`, 2026-11-01. Owner role: systems-designer. Spec: `design/content-expansion.md` §6.3. Plan row: `production/content-build-plan.md` §2 Sprint 1, F0.*

## What changed

| File | Change |
|---|---|
| `src/midpick.ts` (new, typed, not `@ts-nocheck`) | `pickMids()`, a pure picker: step 1 descent gate, step 2 kind **and body** exclusion (never relaxed), step 3 previous-pair exclusion, step 4 `1/(1+meta.mb[k])` weighting, step 5 slot A then slot B with a different tag, step 6 fallback (relax 3, then 1). `ignoreMeta` hook (D10). `MIDS` roster table (the 4 biome midbosses + the Saucer, with tag/body/min), `HOME`, `PHASE1_BIOME_POOL`, and helpers `noteMids` / `newDescentMids` / `pickBiomeMids` (phase 1: home preferred plus one crossover) |
| `tests/unit/midpick.test.ts` (new) | 21 tests: a 10k-descent phase-1 simulation, a 10k-descent wave-1-shaped simulation, and rule-level tests |

Nothing else changed. No file imports `midpick.ts` yet, so the game is behaviour-identical by construction.

## Interface (for LS1-F wiring, sprint 3)

```ts
pickMids({ pool, L, n?, used, last?, met?, ignoreMeta?, prefer?, rng, defs? }) -> { picks: string[], relaxed: 0|1|2 }
pickBiomeMids(st /* {mbUsed, mbLast} */, b, L, rng, met?, ignoreMeta?) -> PickOut   // phase 1, also records the picks
noteMids(st, key, picks); newDescentMids(st)   // G.mbUsed / G.mbLast upkeep; newDescentMids goes in startLoop
```

- `rng` is the per-stage build stream `Rs`. `midpick.ts` never touches `R()`, `$` or `G`.
- `L` is `G.loop`, so it is 0-based: `min: 1` means "never in Descent 1".
- `relaxed` reports which fallback level was needed. There is no level that relaxes step 2. If step 2 leaves too few candidates, the stage gets fewer midbosses (1 or 0), never a repeat.
- Slot A is drawn only from candidates that leave slot B a partner with a different tag and a different body, so the tag rule is never broken.
- `ignoreMeta: true` draws exactly as if `meta.mb` were empty (tested). Every caller passes false today.

## Acceptance checklist

| Acceptance (plan row F0) | Result |
|---|---|
| 10k simulated descents: 0 repeated bodies within a descent | **PASS**: 0 over 10,000 descents (1000 runs × 10, `meta.mb` building up across runs, biomes may repeat inside a descent) |
| Slot B tag ≠ slot A | **PASS**: 0 of 20,000 biome stages |
| The step-2 relaxation never happens | **PASS**: every one of the 20,000 stages got 2 picks, none of them already used. Step 2 has no relaxation path in the code |
| When biome A's crossover is biome B's home midboss, biome B gets two different crossovers | **PASS**: 3,587 such cases, 0 bad (two different bodies, neither is B's home, no overlap with A) |
| Gates, body exclusion, tag rule, `meta.mb` weighting, fallback order, `ignoreMeta` hook | **PASS**: one rule-level test each. Weighting measured at 0.78–0.82 against an expected 0.8 |
| Extra: wave-1 shape (pools of 4, ANGLE/RACE `min: 1`), 10k descents | **PASS**: the first 2 visits to a biome share no midboss; 0 repeats, 0 same-tag pairs, 0 short stages |

**Mutation check (each test watched failing):** I disabled one rule at a time in `src/midpick.ts` and confirmed at least one test fails each time: body exclusion, kind exclusion, tag rule, home preference, previous-pair exclusion, meta weighting, and the order of the fallback steps. The file was restored afterwards.

## Test output

- `npx vitest run`: 9 files, **76 passed** (midpick: 21).
- `npm run typecheck`: clean.
- `npm run test:regress`: **PASS vs baseline @ 1e20b36**, `st` identical. The 6/6 canvas hashes differ, which is advisory only. The vite log shows the `@fontsource` files being refused ("outside of Vite serving allow list") because this worktree's `node_modules` is a symlink to the main checkout. That font loss is the likely cause of the hash diff, and this lane changed no rendered code.
- Phase-1 simulation log: `stages 20000, step-3 relaxed 3134, gate relaxed 0, crossover case 3587`.

## Observations and open risks (for review)

1. **The home midboss is lost more often after Descent 1.** By descent (2000 runs, distinct-biome routes), the share of routes where biome A takes biome B's home midboss is **D1 32%**, matching the spec's "about 1 route in 3", then **about 50% from D2 on**. The cause is step 3: on a revisit, the biome's previous pair (home plus a crossover) is excluded, so slot A is often a crossover, and that doubles the chance of taking the next biome's home. This follows the spec's rules as written. Game-designer to confirm it is acceptable in phase 1. A home-exempt step 3 in phase 1 would be a one-line change.
2. **Step 3 relaxes often in phase 1** (3,134 / 20,000 stages, about 16%), because a pool of 4 cannot avoid both the previous pair and this descent's picks on some revisits. This is expected with 4 bodies, and it shrinks once the W1 pools land.
3. **`HOME` duplicates `BIOMES[b].mid`.** `biomes.ts` imports canvas and audio at load time, so this lane's test only checks `HOME` against `PHASE1_BIOME_POOL`. LS1-F should assert `HOME[b] === BIOMES[b].mid` when it wires the picker in.
4. **Draw count varies.** When the home midboss is preferred, slot A uses no `rng()` call. This is deterministic for the same inputs. If LS1-F wants a fixed number of draws per stage (to keep `Rs` aligned across versions), it can burn one draw there.
5. **Stubs:** none. `Rs`, `G.mb`, `G.mbUsed`, `G.mbLast` and `$.meta.mb` don't exist yet. The picker takes them as plain arguments, so H0 (the save v3 `meta.mb` field) and A/LS1-F (the stage build stream) plug in without a picker change.

## Merge-order notes

These are new files only, with no conflicts with A, B1, G0, H0 or P0, so they can merge in any order. LS1-F (picker wiring in `biomes.ts` `choose()`) merges after LS1-D, as the plan says.
