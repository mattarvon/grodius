# LS1-F follow-up: D27, the Apprentice to 200 HP on long4

**Decision:** D27 (`production/decision-log.md`). It replaces the per-slot TTK bands with one band per held kind, 8-11 s at the stage-1 kit. The Apprentice was the one kind under it, at 6.8 s.

## Change

| File | What |
|---|---|
| `src/midslot.ts` | `MID_HP` tuning table (`prentice: 200`) and `midHpMul(k, base)`. The multiplier is 1 off picker layouts and for any kind not listed. |
| `src/enemies/spawn.ts` | `midboss()` scales `e.hp` and `e.max` by `midHpMul(k, ET[k].hp)` after `mk()`. Depth HP still applies on top, unchanged (D1). No RNG draws. |
| `tests/unit/midslot.test.ts` | 3 tests: 200 on long4, every listed kind at 1 on short, unlisted kinds (Choir, the DRIFT Saucer) at 1 on long4. **Watched failing:** with the picker gate removed, the short test fails; with `prentice: 150`, the 200 test fails. |
| `design/content-expansion.md` | §3.1 median midboss B 12 → 10 s (total ~107 s), plus a note on why. §6.2 roster: Apprentice 200 on long4. §6.2 HP bullet rewritten to the single band with the new measurement. |
| `CHANGELOG.md` | 2026-11-03 entry. |

## Measurement (`tools/midboss-probe.mjs`)

```
long4, --leave 1080     MAW(mid)  NAIL CHOIR  DISS. WOMB  APPRENTICE   BROOD MOM SQUID SAUCER
STAGE 1 kit                  9.1        10.0         8.7        10.2         9.5          5.4
(prentice hp=91/200 mid-fight)  errors: none

short (no --leave)
STAGE 1 kit                  9.1        10.0         8.7         6.8         9.6          5.4
(prentice hp=45/150 mid-fight)  errors: none
```

- Apprentice on long4: **10.2 s, in the 8-11 s band**. The DPS estimate (spec §6.2, ~14.4 HP/s) predicted ~9.1 s.
- On short the Apprentice is unchanged: 150 HP, 6.8 s.
- The Brood reads 9.4 / 9.5 / 9.6 s across runs. Its HP did not change. The probe runs the fights in sequence on one sim stream, so a longer Apprentice fight shifts the Brood fight's random rolls.
- Still in band: Choir 10.0, Womb 8.7, Brood 9.5. The Saucer is DRIFT and exempt.

Screenshots: `ls1-f-d27/apprentice-long4-200hp.png`, `ls1-f-d27/apprentice-short-150hp.png` (mid-fight, rendered by the probe).

## Gates

- `npm run typecheck`: clean.
- `npx vitest run`: **431 passed** (midslot: 3 new; midboss-hp: 3 new, review round 1).
- `npm run build`: built.
- `npm run test:regress`: **short PASS vs baseline @ 8ff9ba4; long4 PASS vs baseline @ 88d9525. No re-baseline.** The long4 bot dies in Open Orbit at scroll 3538, before any biome midboss, so the harness doesn't reach this change. The probe and the unit tests cover it.
- `node tools/layout-parity.mjs`: **PARITY PASS**, short layout identical (runs 3, 6, 7, 11, 15, 3x3, 7m).

## Review round 1 (specialists)

- **systems-designer: APPROVE WITH NOTES.** Keep 200: the band is measured at the stage-1 kit, later kits only shorten fights, and depth HP scales the base, so the band holds at depth. The 9.1 s prediction scaled the TTK in proportion to HP, which ignores time the midboss can't be hit. The measured slope (+50 HP → +3.4 s, ~14.7 HP/s) matches spec §6.2's DPS. **Fixed:** the stale "near 9.1 s" comment in `MID_HP` now gives the measurement and the per-HP rate.
- **gameplay-programmer: APPROVE WITH NOTES.** Correctness, determinism and short are fine: phase thresholds read `e.max` only in later steps, elites skip minis, the Choir's nailbars aren't affected, and a crossover Apprentice also gets 200. **Fixed:** the only unit test covered the pure helper. The new `tests/unit/midboss-hp.test.ts` calls the real `midboss()`: 200 on long4, 150 on short, an unlisted kind unchanged. **Watched failing** with the scale in `midboss()` removed (1 of 3 fails). Not taken: having `midHpMul` look up `ET` itself. `midslot.ts` imports only state and layout, to keep the boot-time module order, so the caller passes the base.
