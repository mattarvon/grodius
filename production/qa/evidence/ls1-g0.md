# LS1 sprint 1, lane G0: economy tables as pure functions

*2026-11-01. Branch `ls1-g0` off `main` f2f9c03. Owners: economy-designer + systems-designer. Spec: `design/content-expansion.md` §7 and §8; plan: `production/content-build-plan.md` §2 Sprint 1, row G0.*

## What changed

- **New `src/economy.ts`**: a typed table `ECON` with one row per layout entry (`short`, `long4`, `long5`), plus pure functions of `(entry id, plain numbers)`. They read no `$`, draw no RNG, and nothing imports them yet. **No wiring** (that is item G).
  - `sealAt(id, cleared)`: seal tier broken on the n-th clear of a run
  - `gradePts(id, st, Ts)` / `gradeOf(id, st, escaped, Ts)`: hit penalty × `35/Ts` on the long entries; S allows `sHits` hits (0 short, 1 long), deaths 0
  - `stageXP(id, ord, loop)`, `killXP(id, base)`, `killBio(id, v)`
  - `descDepth(id, loop, ord)`: `loop + intra × ord/(n−1)`, clamped to the descent
  - `gluttonyN(id)`, `d1EliteChance(id, ord)`, `livesAfterDrive(id, lives)`
  - `hpmCol(kind, slot)`, `hpmTarget(id, kind, slot, loop)`: §8 target, ±30% band (`HPM_TOL`), and whether that column is banded at the entry's exit
  - `targets`: the LV and biomass probe targets for item G (`long4`) and LS3-0 (`long5`)
- **New `tests/unit/economy.test.ts`**: 33 tests.

Files: `src/economy.ts`, `tests/unit/economy.test.ts`, this file. No existing file is touched.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Short entry equals today's numbers (pinned) | **PASS.** Pinned against the live code, not against copied numbers: `gradeOf('short')` = `stages.ts clearStage` grade over 80 stage results crossing every boundary (escaped too); `sealAt('short')` = `clearStage`'s returned seal for clears 1-10; `stageXP('short')` = `perks.ts stageXP` for loop 0-4 × ord 0-3; `gluttonyN('short')` = `mutations.ts GM['over'].n`. Kill XP/bio ×1, depth = loop, no D1 elites, no Drive lives, no per-kind hits/min |
| Pins watched failing | **PASS.** Perturbing `short` (`sHits` 1, XP b 44, seal at 7, GLUTTONY [2,5]) fails exactly those 4 tests; the file was then restored |
| `long4` matches the spec §7 `long4` column | **PASS.** Seals {2,4,6}; grade ref 35 s; S ≤ 1 hit, 0 deaths; today's XP lump; kill XP ×0.75 and kill bio ×0.75 (*start*); intra .35 with N = 4; GLUTTONY [3,6]; no D1 elites or Drive lives; §8 rows with only biome slots 0/1 banded (Orbit/Drive measured-only until LS2); LV 13±1, biomass D1 1.3-1.5k / D2 2.1-2.4k / D3 2.6-3.6k |
| `long5` matches the spec §7 `long5` column | **PASS.** Seals {1,3,5}; XP `40 + 35×ord + 40×loop`; kill XP ×0.75, kill bio ×0.6; intra .35 with N = 5; GLUTTONY [3,7]; D1 elites .05 from stage 4; +1 ship per Drive kill, capped at 5 (never removes one above the cap); all 5 hits/min columns banded; LV 4 / 8 after stages 1 / 2, LV 14±1 |
| No wiring | **PASS.** `grep -rn economy src` finds only the file itself |

## Gates

- `npm run test:unit`: 9 files, **88 passed**.
- `npm run typecheck`: clean (no `@ts-nocheck` on the new file; it is fully typed).
- `npm run test:regress`: **PASS vs baseline**, harness `st` identical. 6/6 canvas hashes differ (advisory). The likely cause is the worktree: its `node_modules` symlink points outside Vite's serving allow list, so the webfonts don't load (the harness log shows the warnings). No code path reaches `economy.ts`.

## Interpretations and open points (for review)

1. **Stage kinds and N are duplicated from the layout.** `ECON[id].n` and the `Kind` type stand in for lane A's `src/layout.ts`. When both land, item G should read N from `layout()` or add a test that the two agree.
2. **Ts (scroll seconds) is a parameter.** The layout owns stage length, so `gradePts` takes Ts from the caller. With no Ts given, or Ts = 0, it grades as a 35 s stage, so it can never divide by zero.
3. **Which biomass `killBio` scales.** I read it as the kill pods only (`fx/update.ts` orb pickup). Grade pay, midboss capsule pay and the first-kill bonus are not scaled. Item G should confirm this against the D1 1.3-1.5k target.
4. **`descDepth` scope.** The spec feeds it to `depthHP`, `cdm` and `firem` for regular enemies and midbosses. The Drive's own HP keeps the integer loop (`driveMul`). Note that `depthHP` returns 1 whenever `loop ≤ 0`, so item G must change that guard for intra-descent depth to reach Descent 1.
5. **Pending Matt answers carry the recommended defaults:** Q9 (S ≤ 1 hit), Q10 (`long5` seals), Q11 (Drive lives), Q12 (kill bio ×0.6). The `long5` D1 elite is marked "optional" in the spec and is included at .05.
6. **Not in G0:** best grades by kind (`gradeKey()`, lane H0), grade pay (unchanged per stage), and the seal copy (`SEAL_TXT`/HUD, LS3-0).

## Merge order

The lane adds new files only, so it conflicts with nothing and can merge in any order. Item G (sprint 3) depends on it, after F.
