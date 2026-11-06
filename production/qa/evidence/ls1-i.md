# LS1-I: the jump switch

Lane i of LS1 sprint 3 (`production/content-build-plan.md` §2, row I). Owner roles: tools-programmer + qa-lead. Branch `ls1-i` off main `5c8c3eb`.

## What changed

| File | Change |
|---|---|
| `src/jump.ts` (new) | `parseJump(search)` (pure), `jumpBlob(j, seed)`, `jumpBoot(search)`, tuning tables `JUMP` and `KITS` (`bare`, `mid`, `full`) |
| `src/flow.ts` | `jumpRun(j)`: builds the blob, then `decodeRun`, `tryResume` (so `resumeRun`, `rebuildAt`). `respawn()` skips option b on a jump run |
| `src/runsave.ts` | `sealRun()`: `storeRun`, `rewriteRun` and `clearRun` do nothing while sealed. Reads still work |
| `src/main.ts` | `import.meta.env.DEV ? jumpBoot(...)` before `readRun()`; `jumpRun` after `start({})`. A jump that fails to start unseals the slot |
| `src/step.ts` | `G.pow = G.powPin ?? powerBudget()`: the fixed rank. `powPin` is unset on every real run |
| `tools/harness.mjs` | `--scenario <name>\|all`, `--runs N`, `--shots <dir>`, the scenario table. The tail is now one `gate()` function; the short and long4 passes keep their behaviour and messages |
| `tools/harness.<scenario>.baseline.json` (12, new) | See below |
| `tools/jump-check.mjs` (new) | Playwright end-to-end check of the slot, bad URLs, clamps and a normal URL |
| `package.json` | `test:regress` adds `node tools/harness.mjs --scenario all` |
| `tests/unit/jump.test.ts` (new), `tests/unit/resumeguard.test.ts` | 25 + 4 tests |

## The switch

`?stage=<kind>&x=<rel>&loop=&kit=`, plus two params the brief didn't name: `rank=` (pins `G.pow`; the boss scenarios need it) and `seed=` (fixes the run seed).

- **`stage`:** `orbit`, `drive`, `biome` (the first biome), or a biome name (`ice`, `acid`, `fire`, `snot`). Biomes fly the first biome row, slot 0.
- **`x`:** relative to the row's `x0`, and it means what `cpX` means: entries up to it are skipped, and the scroll starts `CP.lead` (120) before it. Range is `[0, bossX - x0)`, because a jump past the end encounter would skip it.
- **Clamped, with a console warning:** `loop` to 9, `rank` to 2.
- **Bad, with a console error and the normal boot:** unknown `stage` or `kit`, out-of-range `x`, negative or fractional `loop`, bad `rank` or `seed`.
- **Run state the blob fakes:** each slot up to the stage committed at its row's `gateLate`, the Drive's hand-back at `tEnd[0]`, earlier DRIFT midbosses as met, earlier stages as cleared, seal from `sealFor`. A slot the URL didn't name takes the first biome the fork rule allows.

## Scenarios (all long4)

Each `x` comes from the layout table, 30 px before the subject. Boss set is M3's: D1 is `kit=mid&rank=.5`, D3 is `kit=full&rank=1`. All are 1200 frames with `seed=7`.

| Scenario | Jump | Met (`seen`) | Closing state |
|---|---|---|---|
| `orbit` | Orbit, x 0, bare | nothing expected | scroll 1190, 15 kills |
| `saucer` | before the Saucer's WARNING | `mini:ufo` | scroll 2130, 9 kills |
| `breath2` | ice, before slot B's WARNING | `mini:cyst` (pair choir+cyst: slot B, asserted) | scroll 6861, 0 lives |
| `drive` | Drive, x 0 | nothing expected | scroll 12805, 24 kills |
| `maw-d1` / `maw-d3` | before the Maw | `mini:maw` | rank .5 / 1 held |
| `drive-d1` / `drive-d3` | before the Drive's WARNING | `boss:drive` | rank .5 / 1 held |
| `crux-d1` / `crux-d3` | ice, before the boss | `mini:crux` | rank .5 / 1 held |
| `butcher-d1` / `butcher-d3` | fire, before the boss | `mini:butcher` | rank .5 / 1 held |

A scenario that never meets its `want`, or whose jump didn't start, fails whatever its baseline says, and `--update` refuses to record it. That caught a real bug in my own parser: `rank=.5` was refused, so six scenarios fell back to a normal boot and were not recorded.

## Acceptance

| Requirement | Result |
|---|---|
| Each scenario deterministic across 3 runs | **PASS.** All 12 give identical `st`, including `sig`, on 3 runs and match their baselines. Hashes below and in `ls1-i/three-runs.txt` |
| Existing baselines unchanged | **PASS.** `tools/harness.baseline.json`, `tools/harness.long4.baseline.json` and `tools/layout-parity.baseline.json` are not in the diff |
| Parity identical | **PASS.** Runs 3, 6, 7, 11, 15, 3x3, 7m |
| Runs on H's rebuild path, no second fast-forward | **PASS.** `jumpRun` goes through `decodeRun` and `tryResume`. Unit test: `rebuildAt` is called once with `x0 + x` |
| Normal URL boots as today | **PASS.** `parseJump` returns null with no `stage=`, even with `x`, `loop` or `kit` present; `jump-check` reaches the title with RESUME offered |
| Does not touch the run save | **PASS.** `jump-check`: a stored blob is byte-identical after 200+ frames, game over, and a new game on the same page |
| Bad parameters: console error, normal boot, no crash | **PASS.** 7 bad URLs in `jump-check`: title, console error, no page error, slot and RESUME intact |
| URL parse unit tests: valid, invalid, clamped | **PASS.** `tests/unit/jump.test.ts` |
| First-frame screenshot per scenario | Done: `production/qa/evidence/ls1-i/<scenario>-first-frame.png`. I viewed `orbit`, `breath2` and `drive-d3`; the other 9 were captured but not looked at |

## 3-run hashes (`sig`, the gated sim hash)

```
orbit       e55e70a51d x3      maw-d3      5398ce1a7d x3      crux-d3     157b28fe04 x3
saucer      bac7aa5a7b x3      drive-d1    77d53deed7 x3      butcher-d1  83f8d91ef6 x3
breath2     24ea3cef14 x3      drive-d3    35a155dc50 x3      butcher-d3  fdbf9b3478 x3
drive       50480033ff x3      crux-d1     c57a935344 x3
maw-d1      6eb2462644 x3
```

## Output

```
npm run typecheck      clean
npx vitest run         28 files, 528 passed
npm run build          built (the existing chunk-size notice only)
npm run test:regress   PASS vs baseline @ 8ff9ba4; PASS (long4) vs baseline @ 88d9525; PASS for all 12 scenarios
                       6/6 canvas hashes differ on short and long4 (advisory; ls1-h.md traces the same note to the symlinked node_modules font fallback)
layout-parity          PARITY PASS: runs 3, 6, 7, 11, 15, 3x3, 7m
jump-check             ALL PASS
```

**Added wall time:** 160 s for the 12 scenarios in that `test:regress` run, which took 191 s in all, so the two old passes took about 30 s. An earlier run of six scenarios took about 7.5 s each, so 90 s is the floor on this laptop. CI time is not measured.

**I watched the gates fail.** Each sabotage was reverted, and the files compared byte-equal afterwards.
- Seal removed: 2 `jump.test.ts` tests fail, and `jump-check` fails at game over and at the new game.
- Rank pin removed: `maw-d1` fails with REGRESSION (`pow` .5 → .065, `sig` moved).
- Option-b guard removed: its `resumeguard.test.ts` test fails.

## Not measured, and open risks

- **Canvas hashes are not fully deterministic in `drive`.** Its first hash differed on all 3 runs (`049f3ac048`, `a2363cc84d`, `5ac1c800f8`), and `orbit` had 1 of 2 hashes differ from its baseline in the `test:regress` run. The sim hash is identical in both, and canvas hashes are advisory. **I did not find the cause.**
- **CI has not run this.** Baselines were recorded on this laptop, and sim state should not depend on the font fallback, but that is unproven until the first PR run. The harness now imports `src/layout.ts` in Node for scenarios (as `layout-arg.mjs` does), which needs type stripping: Node 22.18 or later. CI pins `22`, which should resolve to that.
- **Production gate:** the switch is `import.meta.env.DEV` only, so Pages and the APK ignore `?stage=`. Checked by the error text being absent from `dist/assets/*.js`, not by loading a built page. The harness and `jump-check` therefore need the dev server, and a built URL fails scenario mode loudly.
- **Meta is not sealed.** A jump run's clears write `meta.bio`, `meta.best` and `meta.mb` on the dev's own profile. The brief asked only for the run save.
- **The bot is blind.** It weaves and fires, and it often dies in fights (`breath2`, `crux-d1` and `maw-d1` end on 0 lives). No scenario kills its boss, so these baselines cover arrival and the opening of each fight, not a kill, the tally, a fork or a choice capsule. **Forks are not covered**, so this closes the "midboss" and "biome" parts of M6's goal, not "fork". `seed=7` only, slot-0 biome bosses only, first visits only.
- `G.rank` is pinned by `G.powPin`, which sets `G.pow`. Without `rank=`, a kit is a start, not a rank.
- The Gravity Drive kill problem on some seeds did not come up, since no scenario tries to kill it.

## Merge notes

- Row I comes after H; H is already on main. No conflicts expected with K unless it touches `main.ts` near `start({})`.
- **Any later sim change past Orbit now moves these 12 baselines**, not just long4's. Re-baseline with `node tools/harness.mjs --scenario all --update` and explain the move in the commit.
- No stubs. The Studio Hierarchy review is the parent's.
