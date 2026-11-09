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

## Gates (on the pre-rebase tip, base 547926e; rerun after the rebase, see the commit)
- unit 985 pass; harness short, long4, flashes-off PASS; 12 scenarios PASS (exit 0); layout-parity PASS.
- rng-probe: all 11 fights identical rendered every frame / flashes off / never rendered.
- perf-probe 4x CPU throttle, share of frames over 16.7 ms, base -> tip: orbit 48 -> 29, maw 24 -> 16, ufo 4 -> 7, choir 12 -> 8,
  cyst 17 -> 10, prentice 16 -> 6, brood 55 -> 24, crux 63 -> 65 (render avg 16.4 -> 16.5), butcher 59 -> 35, gravity 47 -> 45.
- Clips: one scripted fight per boss on the real game (`tools/boss-clip.mjs`), contact sheets in `ls2-bossart/<k>-fight.jpg`.

## Reviews
- art-director: APPROVE butcher, prentice, snotmaw; APPROVE WITH NOTES crux, drive, choir, brood, maw, acidmaw, ufo.
  BLOCK on the Womb's background: the acid tanks hold adult skeletons, and a tank skull can sit right over the placenta so the
  boss reads as a body with a skull head. Matt's D46 call keeps adult corpses, so this goes to Matt rather than being cut here.
  Its pod question is answered: at 6x the pods hold a clot, no figure.
- technical-artist: BLOCK on crux/butcher frame time, fixed (shared drips and particles batched, no per-particle transforms, no
  per-frame key strings); crux now at base, butcher well under. Notes fixed: atlas load race, decode warm, deaths reset per run.

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
