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
- **Determinism.** The pilot draws no `R()`. Seed 1 run twice gave byte-identical JSON (before the fix below, which
  added no randomness).

## 2. Runs

The runs used `node tools/pod-probe.mjs <url> <seed> 30 2 --layout long4 --mortal --pilot` on seeds 1-5. Each run aims
for two descents and starts on a fresh profile. The runs went one at a time under `flock /tmp/grodius-heavy.lock`, each
waiting for Tctl < 80 °C.

**The tables below are post-fix runs only.** The tools review found that the pilot treated a stopped scroll as 1 px a frame
(`G.scrollSpeed || 1`). The scroll is exactly 0 during held midbosses and the Drive, so the first round of runs predicted
terrain and hazards up to 24 px off in exactly those fights. It is now `?? 1`, and all five seeds were re-run. The
first-round figures are dropped. On seed 4 alone the fix moved the D1 Drive fight from 63.5 to 44.4 s.

The pilot's path is chaotic: a small change in its predictions sends a run somewhere quite different. In the first round
seed 4 game-overed and seeds 1 and 5 survived; after the fix it is the other way round. So read survival as a rate,
not per seed.

| seed | end | ships left | logged deaths | trapped frames | D1 LV | D1 biomass (steady) | D2 biomass earned (steady) |
|---|---|---|---|---|---|---|---|
| 1 | game over at 2-4 (Drive) | 0 | 2 | 90 | 15 | 1169 | — |
| 2 | survived 2 descents | 2 | 0 | 129 | 13 | 1312 | 2351 |
| 3 | survived | 2 | 0 | 100 | 13 | 1413 | 1828 |
| 4 | survived | 1 | 1 | 99 | 13 | 1213 | 1618 |
| 5 | game over at 2-4 (Drive) | 0 | 3 | 92 | 15 | 1181 | — |

How to read the table:

- **D1 LV** is the level at the D1 Drive tally. The boss-kill XP lands after it, so `lvlAtStart` at 2-1 can be one
  higher.
- **Steady biomass** is the raw tally figure minus 100 for each first kill paid. The probe starts on a fresh profile, so
  every midboss kind pays once. The shop is skipped, so nothing is spent. **D2 earned** is the 2-4 figure minus the 1-4
  figure, again less any first kills.

**Grades.** Each cell is grade / hits / kill %. A `d` marks a tally that saw a death.

| seed | 1-1 Orbit | 1-2 biome A | 1-3 biome B | 1-4 Drive | 2-1 | 2-2 | 2-3 | 2-4 |
|---|---|---|---|---|---|---|---|---|
| 1 | S/0/96 | A/3/78 | S/0/88 | S/1/98 | S/0/100 | A/0/67 | B d/2/76 | (over) |
| 2 | S/0/87 | A/3/88 | S/0/93 | A/2/88 | A/4/88 | S/0/95 | A/2/89 | S/1/99 |
| 3 | S/0/90 | A/2/97 | S/1/87 | S/0/89 | S/0/83 | S/0/94 | S/1/80 | A/3/97 |
| 4 | A/2/92 | C d/4/70 | S/0/98 | A/1/73 | S/0/97 | S/1/88 | S/0/93 | S/1/87 |
| 5 | C/2/67 | S/0/82 | A/2/85 | S/0/98 | S/0/96 | S/0/83 | C d/3/49 | (over) |

**Wall time** (`tally_s`, from the STAGE card to the boss kill). The band for each stage is in brackets (spec §3.4, LS1):

| | Orbit [75-90] | biome A [90-120] | biome B [90-120] | Drive stage [80-95] |
|---|---|---|---|---|
| D1 (5 seeds) | 76-100 s | 85-115 s | 73-95 s | 86-100 s |
| D2 (3-5 seeds) | 74-78 s | 75-84 s | 73-118 s | 72-76 s |

**Drive fight time** (`bossFight_s`), with a band of 30-45 s: 40.5-54.6 s in D1 (5 seeds), and 26.0-30.1 s in D2 (the 3
seeds that finished it).

**Deaths.** There were 6 logged deaths: 1 in D1 and 5 in D2.

- **3 with a flayer nearest:** seed 1 at 2-3, and seed 5 twice in the D2 Drive stage. They were all logged `safe: true`.
  The pilot does not model the flayer whip yet, which has a 34-frame `tel` and then a `strike` along `whipPts`.
- **2 to orb shots at 1-15 px:** seed 1 at 2-4 and seed 5 at 2-3. Both were logged `safe: true`, so the straight-line shot
  prediction missed those shots.
- **1 to the Apprentice cleaver:** seed 4 at 1-2, already in a no-safe-move frame (`safe: false`).

Those two gaps, the flayer whip and the shot motion, are where to look next if more survival is wanted.

The short layout was run only in the first round (seed 1, survived 2 descents, 0 deaths). It was not re-run after the fix.

## 3. What this answers, and what it doesn't

These are observations for the LS1-G owners. The bands are the spec's. The pilot sees 24 frames ahead with perfect
information and makes no reaction errors, so it stands in for a strong player, not a median one. Read its grades and
survival as an upper bound, and its time and economy figures as one consistent instrument.

- **Grades past Orbit (carry-forward 9).** Biome and Drive grades now come from a bot that takes real hits. The spread
  runs S to C, mostly S and A.
- **LV (carry-forward 2).** The D1 median is 13 (13-15) against `lvD1 [12,14]`. With the invincible bot it was 14.
- **D1 biomass (carry-forward 2).** The steady-state median is 1213 (1169-1413) against the 1.3-1.5k target, and 4 of 5
  seeds fall under it. The invincible bot gave 1434. **The cause is unmeasured.** Deaths don't explain it: seed 2 had no
  deaths and seed 1 had none in D1, yet their figures differ, and kill % doesn't track biomass either. The shortfall needs an
  economy-designer owner.
- **D2 biomass.** D2 earned 1618-2351 on 3 seeds against the 2.1-2.4k target; only seed 2 is inside it. These are the
  first D2 figures measured. D3 is still unmeasured.
- **Wall time (carry-forward 9):**
  - The D1 biome stages span 73-115 s against the 90-120 s band. Biome A is mostly in band; biome B is under it on 3 of
    5 seeds.
  - The D1 Drive stage runs 86-100 s against 80-95 s, over the band on 2 seeds.
  - Orbit runs 76-100 s against 75-90 s; one seed is over.
  - D2 stages run shorter: the player is stronger by then.
- **Drive fight.** The D1 fight runs 40-55 s against the 30-45 s target, longer than G's 37-53 s on the invincible bot.
  The D2 fight runs 26-30 s.
- **Survival.** All 5 seeds clear Descent 1. 3 of 5 survive two descents.
- **Hits/min (carry-forward 1) is NOT answered by this.** Spec §8 defines its targets as *would-be hits per minute for the
  invincible bot*. The mortal pilot dodges, so its hit rate measures how good the pilot is, not how hard the game is.
  G's shortfall was sample size: 0-3 hits per cell on 2 seeds. Closing it needs a ≥ 10-seed `tools/playtest.mjs`
  sweep on long4, or Matt waiving the criterion.

## 4. Files

- `tools/pilot.mjs` (new): `PILOT_TUNE`, plus the `PILOT` init script that defines `__pilotStep` and `__pilotLog`.
- `tools/pod-probe.mjs`: adds `--pilot`. It exposes `world.ts` and `boss/update.ts` to the page, and its output gains
  `pilot`.
