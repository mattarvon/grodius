# LS2-bossart: every boss repainted from Matt's picks (Phase 2 report)

Matt (2026-11-08): the bosses "look vector and generic", "more realistic, more gross shit". Phase 1 offered 5 to 7 painted
concepts per boss; Matt picked one each (2026-11-09). Phase 2 bakes each pick into the game.

| Boss | Pick | Atlas |
|---|---|---|
| THE BLOATED BITCH (crux) | c5 Engorged Frost Leech | crux 246 KB |
| THE BURNING BUTCHER | c1 The Split Side | butcher 160 KB |
| THE GRAVITY DRIVE | c3 Spine Wheel | drive 325 KB |
| THE MAW / DISSOLVED / MUCUS | c1 Lamprey Disc, real engraved teeth (rawpixel CC0) | maw_orbit 78, maw_acid 69, maw_snot 79 KB |
| THE NAIL CHOIR | c3 The Enucleated Eye | choir 89 KB |
| THE DISSOLVING WOMB (cyst) | c2 The Torn Placenta | cyst 93 KB |
| THE BUTCHER'S APPRENTICE | c2 Grown Into the Blade | prentice 60 KB |
| THE BROOD MOTHER | c3 Tapeworm Knot | brood 121 KB |
| THE SQUIDFUCKED SAUCER | c3 Natural-History Plate | ufo 61 KB |

## How
- `tools/bossart/<boss>/bake.py` paints every state from the concept's generator (PIL, real photos as micro-detail; README there)
  and writes one palette atlas + frame layout per boss to `src/sprites/boss/`. Motion frames are mesh bends of the painting
  (breathing, peristalsis, writhing, swell); rotating parts (cleavers, the spine wheel, gaze) are baked per angle.
- `src/render/gross/baked.ts` draws frames by sim state, loads atlases through the route warm-up (decoded off the draw), and runs the
  baked deaths (`trackDeath`, `pour`). Each draw adds live wet on top: drips that shed real drops, wound blood that grows per
  stage, hit spray, glows on the tells.
- Wound stages (3 per boss, 4 for the Butcher and Saucer) and a heavy multi-frame death per boss in its own anatomy.
- Render only: no sim file changed. Old procedural art deleted (`gross/biomebosses.ts` whole; the rest rewritten in place).

## D46 content cuts (Matt: "cut it in the repaint")
- Womb: the child figure and kicking limb are gone with the old draw; the new boss is placenta, cord and membrane only.
- Butcher: the old art (breasts in `buildButcher`) deleted with `biomebosses.ts`; the new carcass has none.
- Snot-biome egg pods: the figure inside is now a settled dark clot and veins (`biomeart.ts` cocoon).
- Acid tanks: two child-sized skeletons per tank became one adult-sized body per tank (`biomeart.ts` acidFar, `wounds.ts`
  acidFarW). Adult corpses and gore kept.
- Evidence: `ls2-bossart/d46-tanks-pods.jpg` (pods at 6x).

## Gates on the final code tip 03d041c7ee5a9581860db0c7b94ca69db95e6708 (rebased on origin/main eede936)
Run on that exact commit, clean tree, 2026-11-09. The commit after it only adds this report's results (docs only).
- unit: 56 files, 1117 pass (1 expected fail), exit 0.
- harness short: PASS vs baseline @ 8ff9ba4; long4: PASS vs baseline @ 88d9525 (both exit 0).
- 12 scenarios: all PASS (orbit, saucer, breath2, drive, maw-d1/d3, drive-d1/d3, crux-d1/d3, butcher-d1/d3), exit 0.
- layout-parity: PARITY PASS, exit 0.
- rng-probe: all 11 fights identical rendered every frame / flashes off / never rendered, exit 0.
- perf-probe (pre-rebase tip, render code unchanged since except the tank fade), 4x CPU throttle, share of frames over 16.7 ms,
  base 547926e -> tip: orbit 48 -> 29, maw 24 -> 16, ufo 4 -> 7, choir 12 -> 8, cyst 17 -> 10, prentice 16 -> 6,
  brood 55 -> 24, crux 63 -> 65 (render avg 16.4 -> 16.5), butcher 59 -> 35, gravity 47 -> 45.
- Clips: one scripted fight per boss on the real game (`tools/boss-clip.mjs`), contact sheets in `ls2-bossart/<k>-fight.jpg`;
  the Womb's retaken with `--from-spawn` on the final code (the default skips the first 260 frames unrendered, which is
  why the first Womb sheet never showed the fade).

## Reviews
- art-director: APPROVE butcher, prentice, snotmaw; APPROVE WITH NOTES crux, drive, choir, brood, maw, acidmaw, ufo.
  It blocked the Womb's background: the acid vats' adult skeletons could sit behind the placenta, so the boss read as a
  body with a skull head. Matt chose option b, "b, looks cool merge it": the vat bodies fade out while the Womb is up.
  - Recheck 1 (proof retaken from the spawn): BLOCK. A hook corpse ended on the placenta's rod, and the pale cut-cord stump
    read as a small face under the swell glow. Fixed: every hanging acid corpse (hook corpses and the gantry crewman, full and
    drained visits) fades with the vat dead; the cord lip re-baked as dark raw meat; the swell glow is lower and softer.
  - Recheck 2, on `ls2-bossart/d46-womb-fade.jpg` (spawn: adult-sized vat bodies; ~60 frames in: vats and hooks empty;
    mid-fight; ~200 frames after the kill: bodies back) and `d46-womb-crown-x4.jpg`: **CLEAR**. "Nothing in or above the
    vats reads as a head or body on the placenta... The crown does not read as a head or face... adult-sized at spawn and
    come back at full size after the kill." Advisory: a single white glint at the crown's centre could flicker like an eye
    in motion (backlog).
  - Tested: `tests/unit/tankfade.test.ts` (fade out while the Womb is up, back after it dies, a $.T reset or stall).
- technical-artist: BLOCK on crux/butcher frame time, fixed (shared drips and particles batched, no per-particle transforms, no
  per-frame key strings); crux now at base, butcher well under. Notes fixed: atlas load race, decode warm, deaths reset per run.
- Studio leads (parent): 7 APPROVE / WITH NOTES; qa-lead S2-1 (gates on the final tip: above), S2-2 (option b proof: above),
  S3 (tank fade test, stale picker rows in tools/upgrade-picker.mjs: done).

## Open (not done here)
- Art notes: drive spike ring still near-concentric (bigger missing arc); choir sclera drifts toward googly at small size; maw
  outline still near round (taper the rear); ufo rim clean until the first crack; brood near-ball outline; mucus slime reads
  grey not grey-yellow; acid Maw belly near candy pink. Each is a re-bake in its `tools/bossart/<boss>/`.
- Biome art over the bosses: fire jets cross the Butcher and Apprentice; ice ceiling shards cover the leech. Biome lanes.
- The shared kill burst (sim `gore()`) still covers the first frames of every baked death; the Drive's white hell-flash face
  reads cartoonish (not this lane's art).
- Sim sparks: the Apprentice's per-frame ember sparks and the Saucer's ochre drops are sim-side (`enemies/mid/*`), left alone.
- `src/sprites/ufo1..3@17.png` and `tools/prep_midboss.py` are no longer drawn; left for their owner to remove.
- Bakes need `assets-raw/bossart/` (git-ignored) to re-run; the committed atlases are the source of truth.

## Backlog (Studio review, recorded, not done here)
- Atlas `onerror` retry; `bakedBuilt` means requested, not ready.
- Butcher and Apprentice rim light against the fire biome.
- Choir eye googly at small size; acid Maw belly too pink; Womb crown glint (art-director advisory above).
- Saucer: rim grime, and more waterlogged for THE DROWNED LANDER if that rename lands.
- The emoji-like round skulls in `biomeart.ts`.
- The shared kill burst hiding the first baked death frames.
- Before a tagged release: licence spot-check of about 5 Flickr CC BY rows and the 4 creatorless rawpixel rows in CREDITS.
