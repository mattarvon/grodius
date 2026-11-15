# LS2-mv world-consistency review (world-builder)

Canon Level: Provisional (review notes, not lore entries). Visible To Player: n/a.
Source: src/biomes.ts BIOMES (names, subs, logs), src/terrainb.ts, src/render/moveprops.ts, design/content-expansion.md §3.3, §5, §11.
Cross-References: spec §11 "meridian" and "idiom" rows; round-2 questions (meridian, idiom, cast, hell).
Contradictions Check: no contradiction with established canon (biome names, subs, log lines). Four reading flags below.
Not reviewed: the s0 contact sheets could not be listed (file search tool failed in this shell), so the look was judged from the prop code only.

## Overall
No BLOCKING. All 8 gimmicks fit their place at the terrain level. The existing logs already lean "ship is body, meat spreads"
("THE FLOOR IS STOMACH LINING", "IT SNEEZED. I AM STILL INSIDE IT"), so the organ readings are already established.
The risk is the opposite: the hardware props (grilles, rungs, treads) quietly lock in the bulkhead side.

## Per gimmick

| Biome / gimmick | Fits? | Note | Severity |
|---|---|---|---|
| Ice B0 Crevasse | Yes | Ceiling teeth and fracture lines. "THE ICE IS FULL OF FACES" supports an ice mass. Fracture lines branch; keep them from forming crosses (spec §5 rule). | NICE TO HAVE: check crosses on the sheets |
| Ice B1 Shelf stairs | Yes, as a ship reading | `crucify` remix already says "crucifixes line the shelves", so shelves exist. Steps are built hardware (deck/cargo racking), not natural ice. Fine under ship-is-body. Under hell-bleeding it is as invalid as every other concept. | no impact |
| Acid B0 Flooded tank | Yes | Best fit of the eight: "THE TANK IS NOT FULL. IT IS STILL EATING." The lake rising is that line made terrain. Rungs plus a rust tide line read as a maintenance ladder going under (machine side). | no impact |
| Acid B1 Folds | Yes, organ reading | Ceiling rugae = "STOMACH LINING". Mixed with tank rungs in the same biome, which is exactly the two-reading device; acceptable under ship-is-body or meat-spreads, organ-only under rooms-on-ship. | SHOULD FIX (flag only, see below) |
| Fire B0 Spire field | Yes | Burned remains standing up; "ASH IS FALLING UP", "THE BODIES KEPT MOVING". Burning tips are fine as slag or bone. | no impact |
| Fire B1 Chimney | Name and behaviour disagree | A chimney exhausts upward and "ASH IS FALLING UP" agrees with that. The terrain does the opposite: ceiling mouths firing jets down. That is a burner or injector, not a flue. The barred grille (`chimney()`) is also pure machine idiom. | SHOULD FIX: reading, not code |
| Snot B0 Peristalsis | Name only | Peristalsis is gut motion. A sinus clears with cilia and mucus flow, and "marching toward the player" is exactly a mucociliary sweep or the sneeze build-up. The contraction bands (`throat()`) are ringed lips: sphincter idiom. | SHOULD FIX: reading |
| Snot B1 Polyps | Yes | Nasal polyps are real; round floor bulges are the most natural prop here. The dimple on each can read as a navel or orifice; keep it, but know it. | no impact |

## Names and readings to NOT lock in by accident (meridian / idiom, art round 2)
1. **Sphincter lock-in:** `throat()` rings with pale lips in the snot band. Reads as sphincters, not bulkheads. Keep it interim; do not reuse this ring motif elsewhere (the fork gates, the boss mouths) until idiom is answered.
2. **Bulkhead lock-in:** the barred grille in `chimney()`, the ladder rungs in `tank()`, the tread lips in `stairs()`. Three hardware motifs. If meridian comes back meat-spreads, they become ribs, ducts or scar tissue; if rooms-on-ship, they stay and the folds, throat and polyps are the ones to redress.
3. **Rugae:** `folds()` is organ-only. Same fate as the throat bands.
4. **Names:** "Chimney" and "Peristalsis" are working titles in the spec. Do not put them in player-facing text or log pools (writer's domain, waits on type and arc). Suggested neutral working names: "Burner field" for the chimney, "Sweep" for peristalsis.
5. Colours in the props follow the biome palette and are provisional with the rest (idiom colour lock). No lime, no blood-red clash seen in the code.

## Cheap environmental storytelling (for later, not now)
- Ice: tally marks scratched on a stair riser (log: "STOPS AT 2557"); a face pressed into one Crevasse tooth every few teeth, tiny, render-only.
- Acid: debris stuck at the rust tide line (a boot, per the log "A BOOT FLOATS PAST"), floating at the new lake height rather than the old one.
- Fire: cut coolant-line stubs beside each vent mouth (log: "COOLANT LINES CUT BY HAND"); ash drifting upward into the mouths, which would also settle the chimney reading.
- Snot: an intake grate half-sunk in one polyp, something dark packed into its slats (log: "MY INTAKES ARE BLOCKED. SOMETHING IS IN THEM."); mucus flow streaks in the band direction so the march reads as flow, not squeezing.
- Log hooks: one log line per movement-B entry (writer, after type and arc). Audio-director: a wet or hollow band sting per biome.

## Gameplay implications flagged to game-designer
None raised: lore asks no mechanic change. The chimney reading question (burner vs flue) does not affect the 108 px gap, hazard snapping or timers.
