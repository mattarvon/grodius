# LS1-bot evidence: a mortal pilot that survives long4

This work comes from LS1-G carry-forwards 1, 2 and 9. Under `--mortal`, G's bot steered straight at targets 3 px a frame. On
every seed it game-overed in long4's first biome, so nothing past Open Orbit could be graded on a bot that takes real hits.
The fix is a probe-side autopilot, `tools/pilot.mjs`, enabled by `pod-probe.mjs --pilot`. It is a tools-only change: no
`src/` file changes, the harness and layout parity are not affected. Without `--pilot`, pod-probe's behaviour is unchanged; the only difference is that its JSON gains `"pilot": null`.

## 1. The pilot

- **Search.** Every frame the pilot scores 33 held moves: stay, plus 16 directions × {half, full} of the ship's real speed,
  `(1.25 + .42·speed) × (.45 if slowed)`. Each move is held over a 24-frame look-ahead sampled every 2 frames, inside the
  game's own clamp.
- **Danger.** The cost of a move is the danger along its path, plus a small pull toward the old bot's target. The old target
  choice is unchanged, so economy and kill behaviour stay comparable with G's figures. Danger comes from:
  - enemy shots and bodies, moved forward at their observed velocity, plus `hb` hitboxes;
  - terrain, using five hull points against `floorAt`/`ceilAt` at the scrolled world x;
  - biome hazards: icicles, geysers and jets, and strands (strands are a penalty, not a kill);
  - telegraphed line and sector attacks, modelled from their real geometry and timings: the Saucer lash, the Drive laser
    and tentacles (through `boss/update.ts`'s `tentPts`), the Butcher hook and cleaver, and the Apprentice cleaver.
- **Logging.** A frame with no safe move counts as `pilot.trapped`. Each death logs the stage, position, the two nearest
  threats and the nearby enemies' attack states (`pilot.deaths`).
- **Determinism.** The pilot draws no `R()`. Seed 1 run twice gave byte-identical JSON.

## 2. Runs

The runs used `node tools/pod-probe.mjs <url> <seed> 30 2 --layout long4 --mortal --pilot`: seeds 1-5 on long4, plus seed 1
on short. Each run covers two descents and was started on a fresh profile. The runs went one at a time, each waiting for
Tctl < 80 °C.

| run | end | ships left | deaths | trapped frames | D1 LV | D1 biomass (steady) | D2 biomass earned (steady) |
|---|---|---|---|---|---|---|---|
| long4 s1 | survived 2 descents | 1 | 1 | 148 | 15 | 1252 | 1724 |
| long4 s2 | survived | 2 | 0 | 102 | 12 | 1312 | 1807 |
| long4 s3 | survived | 2 | 0 | 68 | 13 | 1440 | 1724 |
| long4 s4 | game over at 2-4 (Drive) | 0 | 4 | 71 | 11 | 1031 | — |
| long4 s5 | survived | 1 | 0 | 75 | 13 | 1083 | 1918 |
| short s1 | survived | 2 | 0 | 25 | 11 | 1019 | 1802 |

How to read the table:

- **Steady biomass** is the raw tally figure minus 100 for each first kill paid. The probe starts on a fresh profile, so
  every midboss kind pays once. The shop is skipped, so nothing is spent.
- **Deaths** come from `pilot.deaths`; `grades` counts only the deaths that the tally saw.

**Grades.** Each cell is grade / hits. A grade carries a `d` when that tally also saw a death.

| run | 1-1 Orbit | 1-2 biome A | 1-3 biome B | 1-4 Drive | 2-1 | 2-2 | 2-3 | 2-4 |
|---|---|---|---|---|---|---|---|---|
| long4 s1 | S/0 | A/3 | B d/2 | A/1 | S/1 | S/0 | A/2 | S/1 |
| long4 s2 | S/0 | A/3 | S/0 | A/2 | S/1 | A/2 | S/0 | A/2 |
| long4 s3 | S/0 | A/2 | S/1 | S/1 | A/4 | S/0 | S/0 | S/0 |
| long4 s4 | A/2 | C dd/6 | B/1 | A/1 | S/0 | S/0 | S/0 | (over) |
| long4 s5 | C/2 | S/0 | A/2 | A/2 | A/3 | S/0 | B/5 | B/3 |

**Wall time** (`tally_s`, from the STAGE card to the boss kill):

| | Orbit | biome A | biome B | Drive |
|---|---|---|---|---|
| D1 | 76-100 s | 85-119 s | 79-106 s | 82-109 s |
| D2 | 73-81 s | 74-92 s | 77-91 s | 65-79 s |

**Drive fight time** (`bossFight_s`): 36.5-63.5 s in D1 (seeds 3-5 above 60 s), and 19-33 s in D2.

**Deaths.** There were 5 logged deaths in 9 full long4 descents, plus seed 4's partial D2:

- 4 with a flayer nearest or second-nearest, all logged with `safe: true`: seed 1 at 1-3; seed 4 at 1-2; and seed 4 twice at
  2-4, once beside a glob and once in the Drive fight. The pilot does not yet model the flayer whip, which has a 34-frame
  `tel`, then a `strike` along `whipPts`. That is the next model to add if more survival is wanted.
- 1 to the Apprentice cleaver: seed 4, stage 1-2, already in a no-safe-move frame (`safe: false`).

The cleaver and hook models removed the Apprentice deaths that had ended seed 5's earlier run. Seed 5 ends with one ship
fewer than seeds 2 and 3, with no death logged. No tally saw a death either, so the likeliest cause is a perk:
the `tape` perk sets `lives = max(1, lives - 1)` (`src/perks.ts`). The probe does not log picks, so this is not confirmed. The D2 Drive figures leave out seed 4's 4.2 s, because that fight ended in
the game over.

### Re-run after the review fix

The tools review found that the pilot treated a stopped scroll as 1 px a frame (`G.scrollSpeed || 1`). The scroll is
exactly 0 during held midbosses and the Drive, so terrain and hazards were predicted up to 24 px off in those fights. It
is now `?? 1`. Seed 4, the worst run above, was re-run on its own afterwards:

| run | end | ships left | logged deaths | trapped | D1 LV | D1 steady biomass | D2 earned | D1 / D2 Drive fight |
|---|---|---|---|---|---|---|---|---|
| long4 s4, after the fix | survived 2 descents | 1 | 1 (Apprentice cleaver, 1-2, `safe: false`) | 99 | 13 | 1213 | 1618 | 44.4 / 26 s |

Grades: A/2, C d/4, S/0, A/1, S/0, S/1, S/0, S/1. The three flayer-adjacent deaths, two of them in the D2 Drive stage,
are gone, so 5 of 5 long4 seeds now survive two descents. The other four seeds were not re-run, so the tables above are
from the pre-fix pilot. The fix touches only predictions while the scroll is stopped, and most of their run is unaffected.

## 3. What this answers, and what it doesn't

These are observations for the LS1-G owners. The bands are the spec's.

- **Grades past Orbit (carry-forward 9).** Biome and Drive grades now come from a bot that takes real hits. The spread
  runs S to C, mostly S and A.
- **LV (carry-forward 2).** The D1 median is 13 (11-15) against `lvD1 [12,14]`. With the invincible bot it was 14.
- **D1 biomass (carry-forward 2).** The steady-state median is 1252 (1031-1440) against the 1.3-1.5k target. The invincible
  bot gave 1434, and real deaths pull the figure down.
- **D2 biomass.** D2 earned 1724-1918 against the 2.1-2.4k target. These are the first D2 figures measured. D3 is still
  unmeasured.
- **Wall time (carry-forward 9).** The D1 biome stages now span 79-119 s against the 90-120 s band. The low end is inside
  the band on some seeds and below it on others. With the invincible bot the range was 76-89 s; the mortal pilot is slower
  because it dodges.
- **Drive fight.** The D1 Drive fight runs 36-64 s against the 30-45 s target, which is longer than G measured.
- **Hits/min (carry-forward 1) is NOT answered by this.** Spec §8 defines its targets as *would-be hits per minute for the
  invincible bot*. The mortal pilot dodges, so its rate (0.4-1.4 hits/min per run) measures how good the pilot is, not how
  hard the game is. G's shortfall was sample size: 0-3 hits per cell on 2 seeds. Closing it needs a ≥ 10-seed
  `tools/playtest.mjs` sweep on long4, or Matt waiving the criterion.

## 4. Files

- `tools/pilot.mjs` (new): `PILOT_TUNE`, plus the `PILOT` init script that defines `__pilotStep` and `__pilotLog`.
- `tools/pod-probe.mjs`: adds `--pilot`. It exposes `world.ts` and `boss/update.ts` to the page, and its output gains
  `pilot`.
