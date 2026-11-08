# LS2-mv art director review

Reviewed from the contact sheets (s0-ice/acid/fire/snot, sets1/2/3, hold-fire, hold-snot) and `src/render/moveprops.ts`.
Not seen: s1-* sheets, hold-ice, hold-acid, and the individual PNGs, so the verdicts below rest on slot 1 plus the
fire and snot holds. `design/art/art-bible.md` does not exist, so there was no bible to read; I judged against each
biome's existing terrain and the spec §3.3 "waits on round 2" line. The Grep and Glob tools were broken in this
session (`rg` failed to spawn), so I could not open §11 of `design/content-expansion.md`.

Verdict: acceptable as interim art for 6 of the 8 gimmicks. Snot B0 (Peristalsis) and fire B1 (Chimney) do not read
as their spec names. Neither is actively wrong in palette, but both fail the "reads at a glance" test.

## 1. Gimmick readability

| Gimmick | Reads as spec name? | B differs from A and C? |
|---|---|---|
| ice B0 crevasse | Yes. Dense, tall teeth with pale fracture lines read clearly as a crevasse. | Strongly. |
| ice B1 stairs | Yes. Flat treads with a bright lip and risers read as shelf stairs. | Strongly. |
| acid B0 tank | Yes. The raised lake with rust ladders going under reads as a flooded tank. | Yes. |
| acid B1 folds | Yes. Hanging ceiling lobes with crease lines read as folds. | Strongly. |
| fire B0 spires | Yes. Many narrow spires with burning tips. | Yes. |
| fire B1 chimney | **No.** The vents sit at y 0..c under the HUD header, and the downward jet is not visible in any slot-1 frame. The ceiling reads as jagged teeth, not a chimney. | Partly. |
| snot B0 peristalsis | **No.** The terrain looks like A (a wide, gentle gap). The brown throat bands are almost invisible against the tissue. | **No, B0 is near-identical to A.** |
| snot B1 polyps | Mostly. The floor bulges read, but the shine and dimple do not. | Yes. |

## 2. Palette, value and edge consistency

Acceptable interim. Ice, acid and fire props reuse each biome's own edge line (pale rim, teal surface, orange rim)
and sit inside the terrain mass. Specific notes:

- Fire spire outlines carry the same hot orange rim as A and C. Good.
- The acid tank's rust (`#6a3a22`, `#a8603a`) is a legitimate fit for the existing wooden gantry colours.
- The snot throat uses `#7a4a18` and `#f4e49a`, which are close to the tissue and the rim. That is why it vanishes.
- The fire chimney's `#ff6a1a` slab with `#ffd08a` core is the brightest flat fill in any biome. It reads as a
  UI block, not a vent.

## 3. Collision silhouette

No prop sits in the gap, which is the right call (the file header states it). Findings:

- Ice B0 fracture lines run to y=0 through the gap-adjacent ceiling mass only. Fine.
- Fire B1 vents are drawn over the terrain mass at the top, and the jet is a hazard that does not appear until it fires.
  A vent with no telegraph is a "looks safe, is not" case. See SHOULD FIX 2.
- Snot throat bands draw above the ceiling and below the floor only (`c - 1` and `f + 1`). They do not mark the narrow
  itself, so the player cannot see where the narrows are before they arrive. See SHOULD FIX 1.
- The existing thin vertical sinew rods in snot A, C and the holds cross the gap and are pre-existing. They look
  solid but have no collision, and they sit close to the new narrows. Not caused by this lane. Flagged only so
  round 2 can address it.

## 4. Set pieces

The 12 new set pieces read as distinct moments within each biome (ice thaw/vigil/pack, acid slurry/vats/lining, fire
meatline/backdraft/cinders, snot sneeze/clot/congestion). Notes:

- `acid-lining` is the weakest: a faint dotted column and a small enemy at the floor, so the moment barely registers.
- `fire-cinders` has green larvae at the top edge, dim against the ceiling. They are lost against the dark rock.
- `fire-meatline` hanging chain and skeletal enemy: the grey enemy sits against the grey-blue chain. Low contrast.
- `snot-sneeze` and `snot-congestion` enemies (small red and grey) are readable against the dark brown cavity, but
  the grey one in congestion is small and low-contrast.
- No set piece is lost in the terrain at the contact-sheet scale.

## 5. Ranked findings

### BLOCKING
None. Nothing is wrong on palette or collision to the point of misleading the player.

### SHOULD FIX (before the next deploy)

1. **Snot B0 Peristalsis does not read** (`s0-snot.png` B0 and `hold-snot.png` B0hold; `src/render/moveprops.ts:102-112`).
   The bands are 8 px wide, `#7a4a18` at alpha .8 times the fade, over a similar brown. Fix: draw the bands as pale
   tissue rings in the existing rim colour, `#f4e49a` at alpha .55, 14 px wide, extending 6 px into the gap on both
   edges (still within a few px of the terrain edge, as the header requires), plus a darker `#2a1208` shadow strip
   of 4 px just inside. The moving bands are the whole gimmick, so they must be the brightest thing on the walls.
2. **Fire B1 Chimney vents hide under the HUD and the jet has no telegraph** (`s0-fire.png` B1; `moveprops.ts:87-100`).
   The vent height is `c` (the ceiling), which is about 30 px, so it falls inside the score header. Fix: draw the
   mouth lower, from `c - 6` to `c + 10` (clip to a few px into the gap), and add a pre-fire glow that ramps for
   the 30 frames before the jet, from the jet's own timer. Drop the `#ff6a1a` full-height slab; use `#3a0c04` with
   orange bars so it reads as a dark mouth, not a bright block. A render-only change; no sim impact.
3. **Snot B0 terrain does not drop to the 108-150 gap in view.** The screenshots show a wide gap. If the narrows
   are placed outside the captured frame, take a screenshot at the narrowest point and retain it as evidence. If they
   are placed correctly, the gap needs to read tighter (see item 1). The lane's own report lists min gap 108 at the
   snot throat, so this is most likely a capture position issue. Verify before closing.
4. **Missing evidence in my review**: confirm hold-ice and hold-acid and the s1 sheets show no regressions. I could not
   check them.

### NICE TO HAVE (can wait for round 2)

- Polyp shine and dimple (`moveprops.ts:114-125`) are too faint at 960x540. Raise the shine alpha to 1 and the radius
  to 15.
- Acid B1 folds crease strokes (`:67`): `rgba(6,30,26,.9)` at 1.4 px is near-invisible on the gold-brown mass in
  `s0-acid.png` B1. Use `#0a2a24` at 2 px.
- Fire spire tips (`:81-83`): the glow works; add a 1 px bright core line on the spire rim to separate it from
  background arches.
- `acid-lining` and `fire-cinders` need a stronger visual anchor in round 2 (a lit vent, a stronger enemy rim).
- Snot sinew rods that cross the gap but do not collide: give them a thinner, more translucent look in round 2.
- Meridian and idiom (bulkheads vs sphincters) wait on round 2 as the spec says.

## What can ship as-is

Ice B0/B1, acid B0/B1, fire B0 and snot B1 props, and all 12 set pieces. They are consistent with their biome's
palette and edge language and do not mislead on collision.
