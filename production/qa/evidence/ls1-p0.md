# LS1 sprint 1, lane P0: midboss hygiene and crossover-proofing

*Branch `ls1-p0`, off `main` f2f9c03. Code commit `74b913f`. Owners: gameplay-programmer + technical-artist.
Source: `production/content-build-plan.md` §2 row P0; `design/content-expansion.md` §6.2-6.3.*

## What changed

| Item | Change |
|---|---|
| Choir per-frame filter | `e.bars.filter(b => !b.dead)` every frame → a counted loop (`nLive`); the sing loops skip dead bars inline. The choir telegraph render's `e.bars.some(...)` closure is a loop too. Behaviour identical. |
| Brood alive cap | Hatchling cap 10 → **8** (`BROOD_CAP` in `src/enemies/midhost.ts`); the `enemies.filter(...)` count at birth is a loop. |
| Crossover interface | `midboss(k, title, host?)` (`src/enemies/spawn.ts`). `host` = the biome it fights in, stored as `e.host`. `src/biomes.ts` passes its biome. No host, or the home biome, = a home fight. |
| Crossover terrain fit (cyst's lake y, and the other three) | Outside its home biome, after its own y motion each midboss is clamped into the band `[max ceil + up, min floor − dn]` sampled across its body width (`crossFit` in `update.ts`, `MID_BODY` / `bodyBand` / `fitY` in `midhost.ts`). The band tightens at once and relaxes eased (`BAND_EASE`). Its own motion and attacks are untouched. |
| Crossover sparks (prentice's fire sparks, and the others) | Ambient and cleaver-strike sparks use `HOST_SPARK[host]`. A `pick()` replaces a colour that was already an `R()` draw; the Womb's constant colour becomes a frame-indexed entry. **A crossover draws exactly as many `R()` values as a home fight.** Telegraph cues keep their own colours. |
| Host-biome tint | `drawMidCross` (`render/gross/midbosses.ts`): a crossover's body is drawn into a 480×270 layer, washed with `HOST_TINT[host]` (the biome's `rgb`, alpha .20-.26, source-atop), then blitted at the caller's transform. Eyes still queue on the main ctx (hi-res, untinted); the hit-flash filter still applies. The Womb's and Brood's death halves (`render/gore.ts`) use the same path. Its five `glow()` and three `eye()` calls go through `glowC`/`eyeC`, which are exactly `glow`/`eye` when `c` is the main ctx, so **home rendering is unchanged**. |
| Home Brood fit (follow-up commit, Matt's request) | The Brood Mother's home fight now uses the same terrain band (`HOME_FIT = ['brood']`, `fitsTerrain()` in `midhost.ts`; `crossFit` renamed `bandFit`). Her ±20% PH bob clipped the Sinus walls on 28% of on-screen frames; now 0%. The other three home fights are untouched. The fit draws no `R()`. |
| Probes | `tools/midboss-probe.mjs <url> matrix [dir]`: a 4 midboss × 4 biome × 4 stage-position matrix, plus a brood cap check. `tools/perf-probe.mjs`: `XHOST=<biome>` env runs the 4 midboss scenes as crossovers. Default modes unchanged. |

**Files:** `src/enemies/midhost.ts` (new), `src/enemies/update.ts`, `src/enemies/spawn.ts`, `src/biomes.ts` (one argument), `src/render/gross/midbosses.ts`, `src/render/enemies.ts`, `src/render/gore.ts`, `tests/unit/midhost.test.ts` (new), `tools/midboss-probe.mjs`, `tools/perf-probe.mjs`, and this file plus `ls1-p0/`.

## Acceptance

| Criterion (row P0) | Result |
|---|---|
| Choir per-frame `e.bars.filter` fixed | **PASS.** A unit test fails if any of the 4 midboss update cases contains `.filter/.map/.some/.every/.slice/.concat(` or an arrow function. I watched it fail against f2f9c03 and pass now. |
| Brood alive cap 10 → 8 | **PASS.** Probe with the STRONG kit holding fire, Descent 5, phase 2: max **8** alive over 9 litters. With `BROOD_CAP` set back to 10 the same check reads **10**, so the check discriminates. Unit test pins the constant and its use. |
| Cyst and prentice work outside their home biome | **PASS.** Matrix below: 0% terrain clipping in all 3 foreign biomes each, TTK in band, no errors. |
| Host-biome tint for crossovers | **PASS (art sign-off pending).** `ls1-p0/xmb-matrix-zoom.png`. Alphas are a technical-artist first pass; art-director to tune `HOST_TINT`. |
| Each of the 4 renders and behaves in all 4 biomes | **PASS.** 16 cells, 1,485 render() frames sampled across fights and deaths, page errors: none. |
| No per-frame allocation | **PASS for the sim** (see above). Render: the gross art still allocates per frame (inline `[[x,y,r],...]` literals, `createRadialGradient` in the Choir, `eye()` option objects, `rim` closures). This is pre-existing and out of this diff's scope. Handed to lane K with the list. |
| `midboss-probe` across a 4×4 biome matrix | **Done**, output below. |
| `perf-probe` brood scene p95 not worse than 22.0 ms | **No regression vs base, but the 22.0 ms absolute could not be reproduced on this host** (see Perf). |
| Short layout behaviour-identical | **PASS** with two intended exceptions, both in the home Sinus fight: the brood cap, which the row mandates, and the home Brood terrain fit, which Matt asked for after the first report. Harness `st` is byte-identical. Crossover code runs only when `e.host` ≠ home, and the short layout always spawns the home midboss. Harness re-run after the Brood fit: PASS, same `st` and hashes. |

## Test and probe output

**Gates** (on `74b913f`): `npm run typecheck` clean; `npm run test:unit` 70/70 (15 new); `npm run build` ok; `npm run test:regress` **PASS vs baseline** (`st` `{state: over, score: 2282, scroll: 2168, …}`). The "6/6 canvas hashes differ (advisory)" note reproduces **identically on a clean f2f9c03 checkout** on this host: P0 and base hashes are equal, `3b358a5e13 … 0c21666de8`. It comes from the environment (worktree fontsource 403s, as `docs/pacing.md` records), not from this change.

**Harness reach:** the 60 s harness never reaches a biome or a midboss. So it neither covers nor moves on the brood cap: no re-baseline, no separate commit needed.

**Midboss matrix**, re-run after the home Brood fit (`node tools/midboss-probe.mjs <url> matrix production/qa/evidence/ls1-p0`): STAGE 1 kit. Each cell is the mean of 4 stage positions (world x 3300/3700/4100/4500). "clip" = % of on-screen frames with a hittable part inside the terrain. `*` = home.

```
midboss                              ice                          acid                          fire                          snot
choir          * 10.0   clip  0% y86-168       10.0   clip  0% y86-168        9.8   clip  0% y86-168        8.7   clip  0% y90-154
cyst             8.7   clip  0% y119-185    *  8.7   clip  0% y119-185       9.9   clip  0% y119-185       8.5   clip  0% y119-174
prentice          6.8   clip  0% y87-139        6.8   clip  0% y87-139     *  6.8   clip  0% y87-139        6.8   clip  0% y87-139
brood             9.8   clip  0% y76-178        9.8   clip  0% y76-178       11.2   clip  0% y76-178     *  9.8   clip  0% y76-175
brood CROWD cap (STRONG kit holding fire, Descent 5, phase 2): max hatchlings alive 8 over 9 litters, rank 1 (cap 8)
render frames sampled: 1485      errors: none
```

- Home Brood before the fit: 9.2 s, clip **28%**. After: 9.8 s, clip 0%. With all of her body hittable she should die faster, but the fit also keeps her off the top and bottom of the screen, where she was easiest to line up on; net +0.6 s, inside the 8-11 s band. Crossover brood TTKs moved by ≤0.3 s between runs (probe noise from hatchling spread).
- Crossover TTKs (8.5-11.2 s) are in the spec's slot-A 8-11 s range, give or take 0.5 s. The Apprentice (6.8 s) is under it everywhere, its home included; that is a balance note, not a crossover effect.
- A first version eased the band in both directions. That left 1-5% clipping in crossovers while the body slid in over changing terrain, which is why the band now tightens at once. A no-fit crossover baseline was not measured.
- The default mode is unchanged: STAGE 1 kit, Choir 10.0 / Womb 8.7 / Apprentice 6.8 / Brood 9.8 s.

**Perf** (`WARM_MS=20000 ELITE=2 node tools/perf-probe.mjs <url> 4 brood`, run interleaved against a clean f2f9c03 checkout on the same host). Render p95 in ms:

| run | base f2f9c03 | P0 (home, snot) | P0 crossover (`XHOST=ice`) |
|---|---|---|---|
| 1 | 255.5 | 255.4 | 148.3 |
| 2 | 248.3 | 252.7 | 125.2 |
| 3 | 253.7 | 250.1 | 122.6 |
| mean | 252.5 | **252.7** | 132.0 |

- **P0 vs base: no difference** (+0.2 ms on ~250, inside run-to-run noise).
- The crossover is cheaper than the home fight because the ice biome renders cheaper than the Sinus. The tint layer's cost does not show above that.
- Step p95 is about 3.5-4.0 ms in every column.
- **The absolute numbers are about 11× the 22.0 ms in `docs/pacing.md`, on base as well.** This host's headless Chromium falls back to software rasterisation: the probe's GPU flags (`--use-angle=d3d11`) are Windows ones. Five other lanes were also running headless Chromes during the runs. So the 22.0 ms gate can only be checked as "not worse than base on the same host", and it passes that test. **Lane K (or Matt on the reference host) should re-take the absolute brood p95 with this branch merged.**

No-elite pass, P0, 4×, render avg/p95: home choir 50.2/251.4, cyst 43.8/172.1, prentice 63.1/362.1, brood 56.4/246.4. As `XHOST=fire` crossovers: 34.1/50.6, 33.8/43.6, 62.9/351.0, 41.7/53.3. These differ by host biome, not by tint.

## Stubs, open risks, findings

1. **Picker wiring is lane F0's.** P0 only provides the interface: `midboss(kind, title, host)`. Today `biomes.ts` passes its own biome with its own midboss, so no crossover can occur in a real run until F0's `pickMids` passes a foreign kind. `title` should be the **midboss's** name, not the host's (the probe had that bug; fixed).
2. **Home Brood Mother clipped the Sinus walls 28% of the time: fixed** in a follow-up commit at Matt's request (`HOME_FIT`). It changes the home Sinus fight (her y range is 76-175 instead of 76-178 and she never enters the walls), so game-designer should still look at the fight's feel; TTK stays in band.
3. **Tint values are a first pass.** `HOST_TINT` alpha is .20-.26, chosen so the body still reads as the same creature and its own telegraph glows show. Glows drawn inside the tint layer composite source-over instead of additively, so a crossover's crown/eye glow is slightly softer than at home. Art-director to review against `ls1-p0/xmb-matrix-zoom.png`.
4. **Nailbars stay untinted.** The Choir's bars are separate entities (grey metal), and its telegraph lines and the Apprentice's sweep cone are drawn outside the body on purpose (readability).
5. **Render-side allocations** in the gross art (item above) go to lane K.
6. **Perf absolute** not reproducible here (above).

## Merge-order notes

- Touches the LS2-0 hotspots (`update.ts` cases choir..brood, `spawn.ts` `midboss()`, `render/enemies.ts` `drawEnemy`, `render/gross/midbosses.ts`). Per the plan, **K after P0**, and **F0's picker should merge after P0** so it can pass `host`.
- `src/biomes.ts`: a one-argument change on the `midboss(...)` line in `biomeScript` (`, b`). It may conflict textually with LS1-D (beats) or F0 (picker) if they rewrite that line. The resolution is to keep passing the host biome.
- `tools/perf-probe.mjs`: `XHOST` is additive; lane K's scene work should keep it.
- No save, layout or harness-baseline changes.

## Studio review prompts

- **technical-artist / art-director:** tint strength per host; the softer glows in crossovers; whether nailbars should tint.
- **game-designer:** the home-Brood fit's feel (finding 2); crossover TTKs.
- **qa-lead:** the matrix is the regression check for crossovers; the harness does not reach them.
- **performance-analyst:** paired perf only; absolute re-take needed.
