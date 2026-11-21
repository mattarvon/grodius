# HARDER: the studio's difficulty package (2026-11-20)

Matt: "we need to make the game harder overall. fan out the studio to do this." Three lanes reported, read-only:
qa-lead (measurements, main vs `balance-d1`), systems + economy designers (levers and values), game + level designers
(encounter and pattern changes). Nothing here is built yet. Matt picks; then it is built in worktrees, measured
against the new bands and played.

## 1. Where the game is (qa-lead; raw data in the session scratchpad `difficulty/`)

Would-be hits/min per stage (invincible bot, long4, mean of seeds 7/11/23):

| Stage | main | balance-d1 (D58) |
|---|---|---|
| D1 Orbit / A / B / Drive | 0.30 / 0.64 / 1.28 / 1.25 | 0.61 / 2.67 / 5.94 / 3.65 |
| D2 Orbit / A / B / Drive | 0.96 / 1.14 / 0.60 / 0.48 | 9.80 / 3.97 / 7.67 / 5.54 |
| D3 Orbit / A / B / Drive | 0.65 / 0.90 / 0.55 / 1.40 | 4.62 / 3.27 / 7.17 / 7.31 |
| Mortal pilot, D1 clears | 3 of 5 (2 deathless) | 0 of 5 (15 deaths, 9 at slot-B midbosses) |

- Main is too easy and gets easier: power rank hits its cap of 1.0 at D2 Orbit, after which the player keeps
  growing (level 19, every weapon slot maxed, ~6000 biomass at run end) and nothing else does.
- Bosses fall in seconds: Saucer/Maw 11-12 s in D1 and ~5 s later; most biome midbosses 5-9 s in D2-3; the D2-3
  Butcher 4 s. THE KEEPSAKE (35-54 s) is the only fight that holds.
- Regular enemies live 0.6-1.5 s on screen and ~75% die in the right quarter, so they rarely shoot.
- D58 overshoots, worst in D2 (Orbit 9.8/min): it multiplies pressure on top of a curve that was never shaped.

## 2. Why (both design lanes agree)

1. **Threats are written to avoid the ship.** Shooters only fire at a ship still ahead of them (drones
   `enemies/update.ts:63`, mutant `:880`, sentry `:909`); rear waves are moved away from the ship's height
   (`spawn.ts:196`); hazards re-roll off its column (`biomes.ts:515-519`). The back half of the screen is a sanctuary.
2. **Player power outgrows enemy toughness ~9x inside D1** (graft damage `mutations.ts:128`, fire rate
   `player.ts:178`), while midboss/boss HP stays flat all of D1 (`depth.ts:61`) and rank caps at 1 (`step.ts:34`).
3. **Survival is cheap.** A WARD pod at cap refills the shield to 3 (`player.ts:43-45`); boss deaths refund FULL
   pods; BLACK BOX gives everything back; HULL (an extra ship) costs 150 biomass.
4. **Midbosses and the Butcher don't make you move.** Aimed fans from a fixed spot (one step dodges them); the
   Butcher's hook reaches 230 px, so the left edge is a park.

## 3. The package, in three passes (each built, measured and played before the next)

**Pass 1: "it notices you" (encounters, D1-safe, small edits to existing code)**
- Passed sentries/mutants turn and fire back (existing 52 f locked aim line); D2+ dive drones U-turn once.
- Rear waves come in at the ship's height (keep the 100 f warning).
- 1 in 3 hazards marks the ship's column first (KEEPSAKE's beam tell, >= 44 f); 1 in 2 in D3.
- Flayers hunt (target x follows the ship).
- One area-denial move per midboss: Choir sweeps a lane, Cyst plants acid pools, Apprentice a full-reach hook,
  Brood's litter from behind (phase 2).
- Butcher's hook reaches the whole screen in its second half and stays planted as a chain for ~90 f.

**Pass 2: "the curve" (numbers; D58 kept but reshaped so D2 isn't a wall)**
- WARD at cap = +1 hit, not a full refill (biggest single leak).
- Rank cap 1 -> 1.25 so pressure keeps climbing in D2-3 (audit every `G.rank` reader first).
- D58 #1 late shooters fire sooner/faster (coolRank .25 -> .35, first shot 20-60 f); #2 boss HP by stage order
  (bossOrd .6 -> .8, KEEPSAKE's base HP divided back); #4 slot-B midboss HP x2.0; #3 formation extra drones pay
  half XP and no pod/biomass.
- Graft damage softened (serr 1.25 -> 1.2, cal 1.22 -> 1.18); HULL 150/500 -> 400/1100; kill biomass .4 -> .35.
- THE KEEPSAKE's DOZING phase gets the fork recall from its second attack (recMin 3 -> 2, recEvery 300 -> 240).

**Pass 3: late game (D2+ only)**
- Midbosses enrage for ~8 s instead of leaving when their clock runs out ("IT WON'T LET GO" for midbosses).
- New set pieces "crossfire" and "drag" that punish both parking and running.
- Optional: BLACK BOX limited in late fights; Sinus contractions (walls squeeze to ~72 px, needs a route-probe
  exception).

## 4. New targets (replace the gentle HPM bands; floor is a hard gate, top may run +40%)

| Would-be hits/min | D1 | D2 | D3 |
|---|---|---|---|
| Orbit | 1.0 | 1.6 | 2.0 |
| Biome A | 1.8 | 2.6 | 3.0 |
| Biome B | 3.0 | 3.8 | 4.2 |
| Drive | 3.5 | 4.2 | 4.6 |

- TTKs: midbosses slot A 8-11 s, slot B 10-13 s; stage bosses 15-22 s; KEEPSAKE 38-46 s at kit=mid; Drive >= 24 s.
- Mortal pilot: D1 2-3 of 5 clears; D2 1-2 of 5; D3 0-1 of 5. Human: the first D1 clear takes 3-6 attempts.
- "Too far" sign: the pilot's deaths pile up on one beat (one midboss cut, one Drive phase) instead of spreading
  out. Roll back the newest change to that encounter first.

## 5. Decisions for Matt
1. Adopt the new target bands (re-scopes D58)?
2. Which passes, in what order (recommended: 1, then 2, then 3)?
3. Rank cap past 1? BLACK BOX nerf?
