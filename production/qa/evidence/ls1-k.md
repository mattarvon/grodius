# LS1 sprint 3, lane K: perf and warm-up

Owner roles: performance-analyst + engine-programmer. Branch `ls1-k`, off main `5c8c3eb`.

**Result:** the warm-up is built and the WARNING rule holds. The cold-hitch target is met. **The p95 target is missed in every cell and every pair (24.8-36.2 ms against 16.7 ms). This is filed below as S2-K1, and this lane did not fix it.** A pre-existing Maw death bug turned up on the way and is fixed.

## Preconditions (checked in code before measuring)

- CROWD alive cap: `BROOD_CAP = 8` (`src/enemies/midhost.ts`), used at `src/enemies/update.ts:505`.
- Filler suppression while a midboss is up: `fillerQuiet` (`src/midslot.ts`), used in `runScript` (`src/enemies/spawn.ts:432`).

## What changed

| File | Change |
|---|---|
| `src/warmplan.ts` (new) | Pure plan: `BOOT_ART`, `routeArt(G)`, `warmBlocked(state, G)` |
| `src/render/warmup.ts` (new) | The runner: one piece per idle slot, a 4 Hz poll between jobs, drops, and a bounded slice log (`window.__warm`) |
| `src/main.ts` | The all-at-boot list is gone; `start()` calls `startWarm()` |
| `src/enemies/spawn.ts` | `banner()` writes `G.warnEnd` for a WARNING. Write-only for the sim |
| `src/render/gross/{midbosses,maw,biomebosses}.ts` | Per-kind warm, built and drop functions |
| `src/render/gross/maw.ts` | **Bug fix:** `if (!e.dead) live.add(e)` |
| `src/render/gross/biomebosses.ts` | The Bloated Bitch's frozen eyes now build with her warm-up, not on her first frame |
| `src/render/terrain.ts` | `warmDerelict`: the skyline bake moves to a boot slice (build plan follow-up) |
| `tools/perf-probe.mjs` | Scenes `mid8`, `cold`, `peak`, `route`, `floor`, `bootlog`, `warngate`, `mawdrop`; Linux GPU flags; inclusive profile; live canvas total |
| `tests/unit/warmplan.test.ts` (new) | 16 tests on the plan, the gate and the wiring |
| `docs/architecture/architecture-overview.md` | One line |

**How it works.** Nothing in the sim calls the warm-up. It polls run state, so `biomes.ts` gains no render import and the boot module order stays as it was.
- **Boot:** hero, eyes, skyline, Orbit Maw, Saucer, Drive. These are held all session.
- **Route:** once `choose()` commits a slot, its `G.mb` pair plus its boss. Short has no picks, so it warms the home midboss.
- **Drop:** a stage's art leaves the plan at the next `startStage`, then drops one piece per pass.
- **Gate:** no build or drop runs from a WARNING until its fight ends (`G.warnEnd`, `G.mini`, `G.boss`, `G.bossStarted`). Drops also wait while a split midboss or Maw corpse is on screen.

Why `G.warnEnd` and not `G.banner`: a STAGE banner replaced the WARNING banner mid-window in `warngate` (the banner showed for 49 of the 170 frames).

## Acceptance

| Criterion | Result |
|---|---|
| Boot: hero + Orbit + Drive | **Met.** Slices below |
| `choose()`/stage build: pair + boss | **Met** on real flights: all three warm within about 45 px of the gate |
| Drop on clear | **Met.** `mawdrop`: one drop per piece, no rebuild. On `route` flights the first stage drops at the next stage start. The last biome's split-corpse pieces were still held when the flight ended, 240 frames into the Drive |
| No warm-up in a WARNING | **Met.** `warngate`: 0 slices in 170 frames with art unbuilt, and work resumes after. `route`: 0 slices in 1026 and 1020 WARNING frames. Plus unit tests |
| p95 ≤ 16.7 ms at 4×, `WARM_MS=20000`, every pair | **MISSED, all 16 cells and all 24 pairs. S2-K1** |
| Cold hitch on the first midboss < 100 ms | **Met** on real flights (slot A 33.9-48.6 ms; any midboss, 77.4 ms at worst). See the first-scene caveat |
| Harness and parity identical | See Gates |

## Perf tables

Host: Ryzen 9 8945HS, Radeon 780M through ANGLE GL (`ANGLE=gl`, now the Linux default), 4× CPU throttle, `WARM_MS=20000`, long4 unless stated. One run per scene unless stated, with other lanes' jobs interleaved between scenes under the lock.

**"Midboss + 8 incoming", p95 of step + render in ms (target 16.7).** Diagonal cells are home fights, the rest are crossover tints.

| midboss | ice | acid | fire | snot |
|---|---|---|---|---|
| choir | 35.2 | 30.9 | 36.2 | 35.5 |
| cyst | 33.1 | 27.4 | 30.1 | 33.7 |
| prentice | 30.6 | 26.3 | 36.2 | 32.6 |
| brood | 28.0 | 24.8 | 30.3 | 36.1 |

**Pairs:** 24 of 24 miss, 25.5 to 36.2 ms. These are merged frames from each pair's two cells, because a stage's fights run one after the other. They aren't separate flights.

**Empty biome (`floor`), p95:** ice 13.7, acid 11.7, fire 12.9, snot 11.5 ms.

**Peak density with elites (`peak`), densest 1500 px of a real slot 0 script, every spawn elite:**

| biome | p95 | avg | max | alive peak | elites |
|---|---|---|---|---|---|
| ice | 36.3 | 23.5 | 117.3 | 4 | 19 |
| acid | 31.4 | 20.0 | 55.5 | 7 | 24 |
| fire | 34.8 | 22.3 | 70.7 | 9 | 33 |
| snot | 30.1 | 19.5 | 60.8 | 8 | 47 |

**Real long4 flights (`route`), gate through both biome stages to the Drive, final source:**

| | ice+acid | fire+snot |
|---|---|---|
| frames | 9004 | 9308 |
| p95 / avg / max | 30.1 / 19.9 / 89.8 | 37.4 / 23.6 / 121.3 |
| WARNING frames | 1026 | 1020 |
| WARNING p95 / max | 27.3 / 61.0 | 31.8 / 71.0 |
| slices in a WARNING | 0 | 0 |
| worst first-60-frame max, midbosses | 58.8 (cyst) | 77.4 (choir) |
| worst first-60-frame max, bosses | 56.9 (Maw) | 75.7 (Butcher) |
| canvases, boot to peak | 11.2 to 14.5 MB | 11.1 to 14.7 MB |

Before the Maw fix, the same flights had WARNING max 81.9 and 94.0 ms. The 121.3 ms frame is outside any WARNING and I did not locate it. The stage build at the gate is a candidate, not a finding.

**Cold midboss (`cold`), reloaded page, first 60 frames:** 15 of 16 cells at 30.2-42.2 ms. `choir@ice` read 101.2 ms, but it was the first scene in the browser, and the first scene pays about 95-100 ms whatever it is: `cyst@acid` read 95.2 when placed first, and `choir@ice` read 24.6-36.2 ms in three runs placed later. So it is first-use browser cost, not that midboss. It would land on Orbit's opening in real play, but neither real flight reproduces it on a midboss.

**What the warm-up buys, honestly.** With the pump off (`COLD=1`) the four home cells read about the same (29-39 ms, plus the same first-scene 100.5). Midboss layers cost 0.2-3.5 ms to build, so warming them changes little. The expensive piece is the Bloated Bitch at 39-69 ms, and that is what route warm-up takes off a fight's first frame. Route art is under 0.2 MB by canvas size, so the drop frees almost nothing; total canvases peak at 14.7 MB against the proposed 64 MB (decoded images not counted).

**Boot slices at 4×:** hero 0.1, eyes 106.1 total (max 34.7), skyline 11.0, Orbit Maw 1.5, Saucer 2.8, Drive 511.5 total (max 503.8) ms. The skyline was not much of a hitch here, but it is in a boot slice now regardless.

**Short vs long (`ELITE=2`, home fights, render p95):** short choir 31.4, cyst 29.0, prentice 30.4, brood 30.5. Long4 home cells: 31.7, 25.7, 33.7, 33.2. No long-only cost shows, but this is one run each.

## Bugs

**Fixed: a dead Maw ruptured every frame (pre-existing, on main, both layouts).** The split corpse (`gore.ts` `half`) redraws the dead Maw through `drawGrossMaw`, which re-added it to `live`, so `drawMawFx` fired a new rupture every frame while the halves lasted: 100 live ruptures measured, each with 70 particles and samples. Now one. **This changes how a Maw death looks and sounds on both layouts**, render side only. Art and audio should look at it: `ls1-k-maw-death-f30.png`, `ls1-k-maw-death-f90.png`. I have no "before" screenshot.

**S2-K1 (open): p95 misses 16.7 ms in every midboss + 8 scene.** A miss by up to 2.2×, and it can't carry the flip (row M).
- Both GPUs read the same (brood@snot 34.1 on the 780M, 32.2 on the 4070), so it is CPU-side JS and canvas calls.
- The empty biome is already 11.5-13.7 ms, leaving 3-5 ms for everything in a fight.
- Inclusive profile, brood@snot: `drawGibs` 21.9%, `flushLo` 14.7%, `drawBG` 7.3%, `drawShots` 7.2%, `drawHUD` 7.1%, `grossBrood` 7.0%.
- **Named fix, in order:** (1) bake gib shapes to sprites, so `drawGibs` stops doing per-gib vector work; (2) cut the floor: cache or lower the rate of `drawBG` and biome decor, and look at `flushLo`; (3) then re-take this table. These are my estimates from the profile: the first two aren't measured as fixes. Fix 1 alone won't reach the target, because 22% off about 34 ms is about 27 ms.
- **Not fixed here:** it is a render rework with art sign-off, larger than this row.
- **Read the target with care:** the scene uses the probe's end-game kit, which makes more gibs and shots than a stage-1 ship, and 4× on this CPU is not a measured stand-in for the Fold. The old 22 ms figure was render-only on another host. The Fold reading is what decides row M.

**S3-K2 (open):** the Drive's `buildMass` is one 504 ms slice at 4×. It runs on the title's idle time, as before, but a player who starts within a few seconds of boot can catch it during Orbit. The fix is to split it into slices.

## Gates

All on the final source.

| Gate | Result |
|---|---|
| `npm run typecheck` | pass |
| `npx vitest run` | 28 files, 515 tests pass |
| `npm run build` | pass |
| `npm run test:regress` | `PASS vs baseline @ 8ff9ba4` (short), `PASS (long4) vs baseline @ 88d9525`. No re-baseline. Canvas hashes 6/6 differ on both, advisory |
| `node tools/layout-parity.mjs` | `PARITY PASS`, short: all runs identical, including 7m (mortal, 0 errors). Seeds 2 and 3 are not run: their bots can't kill the Gravity Drive |

The sim did not move. The Maw fix and the warm-up are render-side, and `G.warnEnd` is write-only for the sim.

## What I did not measure

- **Anything on the Fold.** That is Matt's reading, steps below.
- The Maw death's cost before the fix as a frame time. Only the rupture count.
- Biome slot 1 in `mid8`, `peak` or `cold`; those are staged at slot 0. `route` does fly slot 1.
- Descent 2+ and the resume path through the warm-up. A resume should warm from restored `G.route`/`G.mb` by the same poll, but no probe ran it.
- Boss cold hitches beyond the two `route` flights.
- Run-to-run variance: most scenes ran once.
- `mid8`, `peak`, `cold` and `floor` were taken before the Maw fix and the drop-hold change. Neither touches those scenes' frames (no Maw in them, and no drop runs in a staged scene), so I did not re-run them.
- Whether the harness's advisory canvas-hash note (6/6 differ, both passes) is the usual run-to-run noise. I did not compare it against base.

The bot never reached the Gravity Drive fight here: `route` stops 240 frames into the stage.

## Fold reading (Matt)

The in-game meter needs `?perf`, and the APK has no query string, so use the deployed page in Chrome on the Fold. It is Chrome rather than the app's WebView, but it is the same engine family; note that on the reading. The numbers show on the display canvas, and `window.__perf()` returns them through `chrome://inspect`.

1. Take this after the `ls1-k` merge has deployed. Note the build hash, and let the phone cool first.
2. **Short baseline:** open `https://mattarvon.github.io/grodius/?perf&layout=short`. Fly one descent. At each midboss and boss, note frame p95 and max from the readout.
3. **Long:** open the same URL with `?perf&layout=long`. Fly one descent to the Drive; that is two midbosses per biome stage, so about 4 biome midbosses plus the Saucer.
4. **In each WARNING and each first second of a fight,** note any visible hitch, and the readout's max. The row M limit is no cold hitch over 100 ms inside a WARNING.
5. **Peak density:** the busiest stretch of a biome stage, in Descent 2 or later if you get there. Note p95.
6. **Warm-up check:** in `chrome://inspect`, run `__warm()` after a descent. Every entry should have `warn: false`, and each `route` entry's `ms` is what that build cost on the phone.
7. Record short and long side by side with the build hash. Row M's gate is no regression against short. The absolute 16.7 ms stays with D15/M6.

If the Pages URL differs from the one above, use the deployed one; I took it from the repo name and did not open it.

## Stubs and open risks

- No stubs.
- LS2 kinds aren't in `UNITS`, so a new midboss gets no warm-up and builds lazily, as today. LS2-0's registry should add a warm entry per kind.
- `BOSS_ART` must track `BIOMES[b].boss`; a unit test pins it.
- Row F's open question (should a withdrawing midboss count for `miniUp`?): no change needed from the perf side. Filler suppression was not the cause of anything measured here.
- The host's `grep` shell function began failing mid-session ("claude native binary not installed"). It is outside the game and I did not change it; I used `/usr/bin/grep`.

## Merge-order notes

K goes after P0 and F, both on main. No other row's files are touched beyond the `banner()` line in `spawn.ts`. Row M's gate 2 stays open: an open S2 does not satisfy it.
