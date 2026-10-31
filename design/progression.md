# Progression: the power rule (Formulas)

Milestone M2, decisions D1 and D2 (`production/decision-log.md`, "Delegated batch"). This is a short Formulas
note, not a full GDD (`rigor: minimal`). Functions are cited by name. The probe numbers are in the M2 commits and
in the table at the end.

## 1. The rule (D1)

**Player power shows up as enemy fire and density, never as tougher enemies.**

| Scales with **power** (`G.pow`, `G.rank`) | Scales with **depth** (`G.loop`) |
|---|---|
| Attack cadence: `every()` (period × (1 − .4·min(2, pow)), floor 18 frames) | Enemy HP: `mk()` ×(1 + .4·loop), then `depthHP()` |
| Enemy bullet speed: `BS()` (×(1 + .35·min(2, pow))) | Cooldowns and fire chance: `cdm()`, `firem()` |
| Wave size: `formation()` + `formationExtra()` = round(3·min(2, pow)) drones | Extra burst bullet from Descent 3: `xtra()` |
| Boss and midboss cooldowns and litter sizes read `G.rank` | Bullet speed loop term in `BS()` |

Enemy HP never reads `G.pow` or `G.rank`. **The one exception is the Gravity Drive** (section 4).

## 2. One power budget (D2)

`powerBudget()` in `src/power.ts` is the only power number. `stepWorld()` writes it to `G.pow` every step, and
`G.rank = clamp(G.pow, 0, 1)`.

```
G.pow = powerRaw() / POWER.div
powerRaw() = Σ ship levels × POWER.ship  +  Σ graft levels × POWER.ship.graft
           + Σ perk levels × POWER.perk[id]  +  rigPower()
rigPower() = Σ over bolted contraptions (first 1 + socket upgrades of meta.rig) of level × POWER.rig[id]
```

- **One table, `POWER`.** It has a weight for every perk in `PERKS` and every contraption in `RIG`; a unit test
  fails if one is missing. The units are "raw": one gun level = 1. Damage perks are weighted by how much
  killing power they add. Defence and utility perks count a little, because surviving lets a player fight
  more aggressively. Economy and XP perks count the least, but every perk counts.
- **Contraptions count from Descent 1.** Before M2 they counted only through `over()` from Descent 2, so a fully
  rigged veteran met fresh-player density in Descent 1.
- **`POWER.div` = 15.4** (was 14). Before M2 only 8 perks carried a weight, and the other 16 now add about 10% to
  a real Descent 1 build. Raising the divisor keeps those builds where they were. Measured with
  `tools/playtest.mjs` at the end of Descent 1: seed 11 has pow .914 in both formulas (raw 12.8 / 14 → 14.1 / 15.4)
  and seed 7 has .786 → .78. A probe kit carrying only the old 8 perks now reads about 9% lower: boss-probe END
  DESCENT 1 went from .89 to .81.
- **Fire compression is unchanged.** `every()`, `BS()` and `formation()` each cap pow at 2, so past pow 2 power
  adds nothing to difficulty.
- **Not unified (presentation only):** the ship's art tier (`shipLoadout()` power in `src/render/ship.ts`) and
  gun-FX intensity (`gunPow()` in `src/fx/gunfx.ts`) still use their own weights. They change no difficulty.

## 3. What scales HP

`depthHP(k, b, o)` is 1 throughout Descent 1. From Descent 2 it is `1 + k·loop`, with k = `DEPTH.fod` 1.12
(fodder), `DEPTH.mid` 1.12 (midbosses) or `DEPTH.boss` 1.5 (stage bosses). Each boss kind takes the
`DEPTH.w` share of the extra. A boss's parts take the boss's multiplier, and elites (×1.8) apply on top.

Until M2 these multipliers also read `over()` = clamp(pow − 1, 0, 2) with weights .8 / .8 / 1. The loop
weights absorbed what a typical build paid through that term (over ≈ .4 in Descent 2 and ≈ .8 in Descent 3,
so .8 + .8·.4 = 1.12 and 1.1 + .4 = 1.5). A typical build's HP stays within about 2% (depth-probe Descent 2:
242 → 237 for the Saucer, Descent 3: 472 → 467). A stacked build no longer buys tougher enemies.

**What doesn't scale HP:** `G.rank`, `G.pow`, `over()`, perks, grafts and contraptions. The only exception is the Drive.

## 4. The Gravity Drive: kept as the one exception

`driveMul()` in `src/depth.ts` (called by `startBoss()`):

```
HP = 560 × (1 + DEPTH.driveL·loop) × (1 + DEPTH.driveRank·rank) × (1 + DEPTH.driveO·over(), from Descent 2 only)
     driveL .4, driveRank .6, driveO .2; each plate 48 × the same multiplier
```

D1 said to drop the rank term unless boss-probe showed the fight collapsing. It collapses. Bot TTK with and
without the power terms:

| Kit | With (kept) | Without |
|---|---|---|
| boss-probe STRONG D1 | 14.3 s | **9.8 s** (under the ~10 s line) |
| depth-probe Descent 2 | 18.2 s | **10.6 s** |
| depth-probe Descent 3 | 14.3 s | **7.0 s** |

The CHANGELOG (2026-10-30) documents 24-39 s for Descent 2-3. Other bosses have an escape clock, guard
windows or a cleaver that holds their fight together. The Drive is one HP pool, so its rank and over terms are
the only thing that keeps a stacked build from deleting it. It is now already *below* the documented 24-39 s
even with the terms kept, and that is a tuning question for the next pass, not for this rule.

## 5. Flat damage follows the gun

Every periodic player shot multiplies its base damage by `gunDm()` (`src/mutations.ts`):
`1.25^SERRATION × 1.22^CALIBER × dmMul()`, where `dmMul()` = SERRATED MARROW × GLASS JAW. This is the main
gun's own multiplier, so these shots keep their share of damage as depth HP grows.

- **SNOT ROCKET:** `snotGlob()` deals `SNOT_DMG` (4) × `gunDm()`.
- **SPORE COAT:** `sporeBurst()` deals `SPORE_DMG` (1.2) × `gunDm()`. It still never crits.
- Already scaled: bolts, MISSILE, PYRE and WRAITH (all use `dm`). SHRAPNEL RIBS uses `dmMul()` only.

**Still flat** (listed, not changed in M2). Each needs a decision on whether it should scale:

| Source | Where | Now |
|---|---|---|
| Contraptions: BONE SAW, GUT CANNON, SPINE LAUNCHER, MEAT WINCH, FURNACE slag, CHOIR scream | `T` table in `src/contraptions.ts` | flat per level |
| ORBITING TEETH | `stepPerks()` teeth in `src/perks.ts`, and the boss hit in `src/boss/update.ts` | `1 + .1·dmg` only: no GLASS JAW, no grafts |
| BLOOD TRAIL slick | `stepPerks()` in `src/perks.ts` | `.25·lv` per tick (`.08` vs big) |
| IMMOLATION / burn | burn tick in `updateEnemies()` (`src/shots.ts`) | `.05` per frame |
| CORROSIVE SPIT / acid | acid tick in `updateEnemies()` (`src/shots.ts`) | `.02·(1 + corrode)` per frame |
| WARD ram | contact check in `updateEnemies()` (`src/shots.ts`) | 8 |
| VOLATILE MEAT burst | `killEnemy()` in `src/enemies/update.ts` | `.6 + .6·lv` to up to 6 neighbours |

## 6. Set pieces keep their layout

`formation(pat, y, n, { fixed: 1 })` spawns exactly n drones and skips `formationExtra()`. Open formations
still scale. The biome set pieces `SET.walls` (the acid double wall) and `SET.pincer` (its short rear wave via
`behindWave(y, n, o)`) are fixed, because +6 drones per wall closes the gap between the two walls. Stage
scripts in `src/enemies/scripts.ts` are not marked. Each scripted twin formation there should be checked when
that file is next touched.

## Tests

`tests/unit/power.test.ts` (weight table coverage, calibration, contraptions from Descent 1),
`tests/unit/depth.test.ts` (HP ignores power, `driveMul()`), `tests/unit/damage.test.ts` (`gunDm()`, SNOT,
SPORE), `tests/unit/formation.test.ts` (fixed set pieces).
