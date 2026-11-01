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
- **New `tests/unit/economy.test.ts`**: 42 tests (33 at first commit, grown through the specialist and lead passes).

Files: `src/economy.ts`, `tests/unit/economy.test.ts`, this file. No existing file is touched.

## Acceptance checklist

| Criterion | Result |
|---|---|
| Short entry equals today's numbers (pinned) | **PASS.** Pinned against the live code, not against copied numbers: `gradeOf('short')` = `stages.ts clearStage` grade over 80 stage results crossing every boundary (escaped too); `sealAt('short')` = `clearStage`'s returned seal for clears 1-10; `stageXP('short')` = `perks.ts stageXP` for loop 0-4 × ord 0-3; `gluttonyN('short')` = `mutations.ts GM['over'].n`. Kill XP/bio ×1, depth = loop, no D1 elites, no Drive lives, no per-kind hits/min |
| Pins watched failing | **PASS.** Perturbing `short` (`sHits` 1, XP b 44, seal at 7, GLUTTONY [2,5]) fails exactly those 4 tests; the file was then restored |
| `long4` matches the spec §7 `long4` column | **PASS.** Seals {2,4,6}; grade ref 35 s; S ≤ 1 hit, 0 deaths; today's XP lump; kill XP ×0.75 and kill bio ×0.75 (*start*); intra .35 with N = 4; GLUTTONY [3,6]; no D1 elites or Drive lives; §8 rows with only biome slots 0/1 banded (Orbit/Drive measured-only until LS2); LV 13±1, biomass D1 1.3-1.5k / D2 2.1-2.4k / D3 2.6-3.6k |
| `long5` matches the spec §7 `long5` column | **PASS.** Seals {1,3,5}; XP `40 + 35×ord + 40×loop`; kill XP ×0.75, kill bio ×0.6; intra .35 with N = 5; GLUTTONY [3,7]; D1 elites .05 from stage 4; +1 ship per Drive kill, capped at 5 (never removes one above the cap); all 5 hits/min columns banded; LV 4 / 8 after stages 1 / 2, LV 14±1 |
| No wiring | **PASS.** no file in `src` imports `./economy` (`grep -rn "economy'" src` is empty; `src/power.ts` only uses the word in comments) |

## Gates

- `npm run test:unit`: 9 files, **97 passed** (42 in `economy.test.ts` after the specialist and lead fixes).
- `npm run typecheck`: clean (no `@ts-nocheck` on the new file; it is fully typed).
- `npm run test:regress`: **PASS vs baseline**, harness `st` identical. 6/6 canvas hashes differ (advisory). **Confirmed environmental:** an untouched `main` (f2f9c03) in a scratch worktree with the same symlinked `node_modules` produces the same six hashes byte for byte and the same 6/6 note. The symlink points outside Vite's serving allow list, so the webfonts don't load. No code path reaches `economy.ts`.

## Interpretations and open points (for review)

1. **Stage kinds and N are duplicated from the layout.** `ECON[id].n` and the `Kind` type stand in for lane A's `src/layout.ts`. When both land, item G should read N from `layout()` or add a test that the two agree.
2. **Ts (scroll seconds) is a parameter.** The layout owns stage length, so `gradePts` takes Ts from the caller. With no usable Ts (missing, 0, negative or NaN) it grades as a 35 s stage. A stage shorter than 35 s grades its hits harder, which is the spec formula followed literally and uncapped. `gradeOf(id, st, Ts, escaped)` puts Ts before `escaped` so a caller can't drop it by accident.
3. **Which biomass `killBio` scales.** I read it as the kill pods only (`fx/update.ts` orb pickup). Grade pay, midboss capsule pay and the first-kill bonus are not scaled. Item G should confirm this against the D1 1.3-1.5k target.
4. **`descDepth` scope.** The spec feeds it to `depthHP`, `cdm` and `firem` for regular enemies and midbosses. The Drive's own HP keeps the integer loop (`driveMul`). Note that `depthHP` returns 1 whenever `loop ≤ 0`, so item G must change that guard for intra-descent depth to reach Descent 1.
5. **Pending Matt answers carry the recommended defaults:** Q9 (S ≤ 1 hit), Q10 (`long5` seals), Q11 (Drive lives), Q12 (kill bio ×0.6). The `long5` D1 elite is marked "optional" in the spec and is included at .05.
6. **`sealAt` returns the scheduled tier only.** `clearStage`'s guard that a tier breaks only if it is above `G.seal` stays with the caller (doc comment says so).
7. **Descent 4+ hits/min** read the D3 row; the spec sets D1-D3 only. `long4` has no interior column (`hpmTarget` returns null).
8. **Spec naming:** the spec writes `PAY.killBio`; the code has `ECON[id].killBio`. The spec text can follow.
9. **Not in G0:** best grades by kind (`gradeKey()`, lane H0), grade pay (unchanged per stage), and the seal copy (`SEAL_TXT`/HUD, LS3-0).

## Studio Hierarchy review, specialist pass

| Reviewer | Verdict | Acted on |
|---|---|---|
| systems-designer | APPROVE WITH CHANGES | **Fixed:** Ts = 0 gave a hit weight of 35, not 1 (major; the new test was watched failing on the old code); `long4` interior column removed; n = 1 guard in `descDepth`; `sealAt` guard note; D4+ and Ts < 35 behaviour documented |
| web-specialist | APPROVE | **Fixed:** Ts moved before `escaped` in `gradeOf`; probes named on the *start* values; n = 1 guard; mock caveat commented. The hash claim was confirmed against `main` (above) |
| qa-tester | ADEQUATE, APPROVE WITH CHANGES | **Fixed:** the false Ts test; grade boundaries 70/50/30 under normalisation; all 15 §8 cells checked against a literal copy of the spec for both entries; negative loop, zero/negative clears, ord past the end. **Not changed:** the tests that restate spec values (GLUTTONY, targets) are deliberate spec pins; no explicit AAA comments in loop-style parity tests |

## Studio Hierarchy review, lead pass

| Lead | Verdict | Acted on |
|---|---|---|
| game-designer | APPROVE WITH CHANGES | **Done:** Q9-Q12 logged as open in `production/decision-log.md` (Q9 needed before item G); the Ts < 35 clamp question attached to Q9 rather than changed here, because the spec formula is uncapped; `long5` D1 elite logged as a playtest call |
| lead-programmer | APPROVE WITH CHANGES | **Done:** `n` pinned at 4/4/5; unused binding removed. **Carried:** layout.ts becomes the single owner of `Kind` and `n` at merge (below); item G names one accessor for the current entry |
| qa-lead | APPROVE | **Done:** golden literal table of today's `short` outputs (stage XP, seals, grades), so the pins survive item G pointing the live code at `ECON`; test count corrected |
| art-director | APPROVE | No visual impact. Carried to G: tally / seal banner / grade screenshots per entry; harness re-run with real fonts |
| audio-director | APPROVE | No audio impact. Carried: seal-alarm timing under `{1,3,5}` (LS3-0), a 1UP cue for Drive lives (LS3-0) |
| narrative-director | APPROVE | No copy impact. Carried to LS3-0: `SEAL_TXT`, HUD, brief "Run" line together; Drive-life copy |
| release-manager | APPROVE WITH CHANGES | No bundle/APK change (unimported). **Carried:** merge order (below); final `Studio review:` line in the merge commit |
| localization-lead | APPROVE | No strings. Carried to LS3-0: new seal copy and any "+1 SHIP" go through a string key |

## Obligations carried to item G (wiring `long4`)

- Wiring the `short` entry leaves the harness `st` byte-identical and the parity check identical, with no re-baseline.
- Matt answers Q9 first.
- Every long-entry call passes Ts; add a test that it does.
- A test that `ECON[id].n` (or its replacement) agrees with `layout()`.
- `depthHP`'s `loop <= 0` guard changes so fractional depth reaches Descent 1, with a unit test.
- Confirm that `killBio` scales the kill pods only, against D1 1.3-1.5k.
- pod-probe LV 13±1.
- Screenshots of tally / seal / grade on `short` and `long4`.

## Merge order

The lane adds new files only, so there are no text conflicts. Its tests, though, pin the live `stages.ts`, `perks.ts` and `mutations.ts`, which lanes A and H0 change. **Merge G0 before A and H0**, so their `verify` runs check the pins. If it lands after them, run `npm run test:unit` on the merged result first. A failing pin then means a behaviour change in that lane, not a G0 problem. At A's merge, `Kind` and `n` move to `src/layout.ts` (`import type { Kind }`, derive `n`), keeping the 4/4/5 test. Item G (sprint 3) depends on this lane, after F.
