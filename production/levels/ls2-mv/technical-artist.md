# LS2-mv technical-artist review: render props (src/render/moveprops.ts)

Reviewer: technical-artist. Read: moveprops.ts (all), biomeart.ts call site (drawBiomeDecor, L462-621; the call is L619), terrainb.ts,
the rewriteTerrain hunk (biomes.ts L159-185), render/terrain.ts draw order, rules engine-code.md and sim-determinism.md, the four biome
contact sheets and the s0 B0hold/B1hold shots. Nothing under src/ was edited; perf-probe was not run (cost figures below are counted
from the code, not measured).

Units: logical px (W=480, PH=254, TS=4); the screenshots are 2x.

## Verdict

No BLOCKING. The props are inside the mass, RNG-free, save/restore-free (no save/restore to unbalance), cheap, and cannot lie about
collision. Three of the eight (stairs, throat, polyps) add almost nothing a player can see, and one (throat) does not show the
mechanic its spec line names. Those are SHOULD FIX as art, not as correctness.

## 1. Do the props read as the spec names, and do they sit on the collision terrain

The read comes mostly from the terrain shape in `gimmick()`, not from the props; the props are trim.

| Gimmick | Reads as spec? | Alignment to FLOOR/CEIL | Notes |
|---|---|---|---|
| ice B0 crevasse | Yes. Tall tight teeth, fracture lines run up into the ice | Lines start at `ceilAt(tip)-2` and go up to y 0: inside the mass | Good. Teeth centres (18+36n) are not on the 4 px grid, so the sampled tip is up to 2 px off the peak and about 17% short of nominal (see 5) |
| ice B1 stairs | Yes, from the terrain alone (20 px risers, 120 px treads). Prop invisible | Lip rect is `f-1..f+1`, frost line at `f+5`, all inside or on the edge | Prop duplicates the snow lip biomeEdge already draws; in the shots I cannot see it |
| acid B0 tank | Partly. Reads as "lake risen with ladders going under", not as a tank (no glass, no wall) | Rungs start `f+4`, in the mass; the pale surface dash is `f-2+bob`, up to 3 px above the collision floor | Interim; acceptable until round 2 |
| acid B1 folds | Yes, clearly (drapes with cusps between, creases, a bead) | Creases end at `ceilAt(wx+q*.7)-2`: inside | The drape cusps at cell boundaries are sharp V notches (sin^.7), good |
| fire B0 spires | Yes, tall needles with burning tips | Tip rect from `f`, down | Spires 18-26 tall skip their glow (L78, see 5) so ~13% of tips are dark |
| fire B1 chimney | Weak. Hoods read as thin-outlined stalactites; the grille is a flat orange block in the top 16 px, which is the HUD strip (health bar and score text cover it in B1hold) | Grille is `0..ceilAt(vent)`, inside the mass | The "mouth open to y 16" is hidden under the HUD, so the jets appear from nowhere. See 5 |
| snot B0 throat | No. The terrain has a static train of narrows; the props are 8 px dark vertical bars with a cream cap, scrolling at t*.7. In the B0hold shot they read as vertical streaks in the mass, not as contraction | Bars are `0..c-1` and `f+1..PH`, inside the mass | Nothing marches at the player. The flagged reading holds on the terrain, but the render does not sell it |
| snot B1 polyps | Yes from the terrain (semicircular bulges). Prop invisible | Dimple at `f+12` and the shine arc ending at about `f+4`: inside | The dark dimple and shine do not show at all against the texture |

No prop draws in the flyable gap. Every fill starts at the edge (or 1-3 px beyond it: tank dash, stair lip, spire tip, throat cap)
and goes into the mass. The 1-3 px overhang is the same order as the edge stroke and the snow lip, so it does not lie about collision.
No floating parts: every anchor reads `floorAt`/`ceilAt` at the same x it draws at.

Blend-zone caveat: inside the 200 px blend the terrain is a lerp, so a cell's flat tread or tooth is tilted, but the prop is placed at
the cell centre's edge height and keeps its full width. It can sit a few px off the edge at the cell ends. It fades with `k` so this is
subtle; I see no seam in the AtoC shots.

## 2. Render correctness

- Determinism: clean. Only `$.T`, `hash`, `Math.sin`. No `R()`, no `Math.random`. `rng-split` rule satisfied.
- Composite: `lit()`/`flat()` are always paired (L81, L94). `glow()` restores alpha itself. OK.
- No `save`/`restore`/`translate` are used, so no balance risk.
- globalAlpha: set per iteration, ended at `a` (L134). Caller sets 1 at biomeart L620. OK.
- lineWidth, strokeStyle, fillStyle are left changed (lineWidth 1.4 after folds, 1.2 after polyps). Not a regression: drawBiomeDecor already leaks these, and the code after it in terrain.ts sets its own fill. Noted only.
- Dependency direction: `render/moveprops` imports `MOVES` from `../biomes`, and `biomes.ts` re-exports from `render/biomeart`, which imports `moveprops`. That is a cycle, but biomeart already imports `BIOMES, biomeK` from `../biomes` the same way, and `MOVES` is read at call time only, so it is safe. `terrainb` imports only `core`.
- Off-screen waste: loops start at `max(sc, m.a)` and end at `min(sc+W, m.z)`, so none. Throat (L104) does not clamp to the band and relies on `fade<=0` to skip: harmless (at most 7 iterations). Chimney (L89) iterates one extra vent each side; also harmless.
- Per-frame allocation: one. `for (const q of [-22, 0, 22])` at L68 builds an array per fold per frame (about 5 per frame). Engine-code rule says no. Small, but it breaks the rule.
- Sub-pixel: `f`/`c` are interpolated floats, so the 1 px rects (stair lip L41-43, tank rungs L54-56, spire L82-83) land on fractional y and antialias to two blurred rows that shimmer as the floor scrolls through grid cells. The other decor does this too.
- Defensive: `PROP[m.b][m.mv]` (L132) would throw if `mv` were ever null. Today `MOVES[seg]` is only written when `mv != null` (biomes.ts L174-176) and `biomeReset` clears it per descent, so it cannot happen; a one-line guard costs nothing.

## 3. Cost (worst case on screen, from the code; not measured)

Worst-case visible cells use W=480.

| Prop | Cells on screen | Ops per frame | Notes |
|---|---|---|---|
| crevasse | 13-14 teeth | 2 stroke paths each, so about 27 strokes, 4 style sets | Heaviest stroke count |
| stairs | 4-5 | 3 fillRect + 5-rect loop each, about 40 fillRect | Tiny |
| tank | 8-9 | 7 fillRect each, about 60 fillRect | Highest fillRect count |
| folds | 4-5 | 3 stroke paths (quadratic) + 1 rect, plus the array alloc, so about 15 strokes | |
| spires | 12 | 1 glow drawImage + 2 rect + 2 composite switches each, so 12 drawImage, 24 composite switches | Composite switching is the one costly thing here on mobile GPUs (batch flush) |
| chimney | 3-4 | 1 glow + about 10 rects each, so about 40 rects | |
| throat | 6-7 | 4 rects each, about 28 rects | |
| polyps | 3-4 | 2 ellipse fills + 1 arc stroke each, about 12 paths | |

Only one prop is active at a time on screen (one movement B per screen except at a band seam, where two could overlap briefly:
about 2x the above for 200 px). Worst case is under about 70 canvas ops, which is small beside the existing decor (flames, pustules, the
snot drip loop at 14 px with a stroke and fills each). I would not expect this to be visible in the S2-K1 numbers, but I did not measure
it. Nothing here needs gradient or offscreen caching. One cheap win: spires' 24 composite switches (see S2).

Budget trade-offs: none of the fixes below raise another budget.

## 4. Fit with existing biome art; interim status

- Palette: props use their own hard-coded hex (`#e6f6ff #7ac4f4 #3f78a8 #6a3a22 #a8603a #7ff0d8 #ffb347 #ff6a1a #ffd08a #7a4a18 #f4e49a ...`)
  rather than the `BIOMES[b]` tokens. They sit inside the established families: ice pale blue, acid teal/rust, fire orange (`#ff6a14` is
  the existing floor seam colour), snot ochre/cream (cream `#f4e49a` echoes the glaze). Bullets are lime and nothing here is lime: pass.
- Edge style: the props do not touch the edge stroke, so biomeEdge/biomeTerrainFill continue to define the silhouette. Good for the
  interim: when round 2 changes the idiom, the terrain edge does not need to change with the prop.
- The chimney is the one place the prop is louder than the neighbours: a saturated opaque `#ff6a1a` block, brighter than the molten seam.
  It is fine as a placeholder but should not survive round 2 as is.
- Interim status: the header comment says so (L2-4). The spec says the look "waits on art round 2 (meridian and idiom: bulkheads vs
  sphincters)"; this should be carried in the decision log as open. I am deferring all palette and idiom choices to art-director; the
  fixes below are structural only.

## 5. Terrain shapes in the shots

- Crevasse teeth: read well; no spike too thin. The 4 px sampling gives about 83% of nominal height on teeth whose tip is off-grid.
- Spires: needles are narrow (peak^2.4) but the base is 40 px and the tip about 6 px wide at 4 px sampling: readable in B0 shots.
- Stairs: risers are 4 px slopes (sampling), visible as a slight slant, not as aliasing. Reads clean at 1x and 2x.
- Polyps: sides are near-vertical (sqrt profile) up to 56 px high. The 4 px sampling shows a faint stair on the flanks in the B1 shot
  (left edge, lower-left sheet). That is also a collision cliff: it is the intended "round bulge", but it plays as a wall, so the
  hazard/fairness call belongs to the game-designer; I flag it as a visual.
- Band edges: no seam visible in AtoC for any biome; the sstep blend hides the swap.
- Chimney: the 16 px mouth sits wholly in the HUD strip, so the prop that is meant to say "jets come from here" is covered by the HUD.
- Snot throat: gap at the narrows reads at roughly 108-120 in the shot: correct; the bars add nothing to it.

## Findings

### BLOCKING
None.

### SHOULD FIX
- S1. `moveprops.ts:102-111` (throat): the render does not show the "narrows march toward the player" line. The bars are inert dark stripes and move
  through both wide and narrow points. Fix: draw each moving band as a bright cream pulse travelling along the two edge lines only
  (a short `lineTo` run at `ceilAt/floorAt` with `lighter`, 20-30 px long, alpha by the cos of the static narrow it passes over), and drop the full-height
  brown bars. This keeps the "terrain is static, render-only motion" reading and never leaves the mass. If you want the narrows themselves to visibly
  sit at the pulse, shift the terrain's `cos` phase to match `t*.7` only if the determinism rule allows it (it does not, as terrain is noise-only), so keep it a pulse.
- S2. `moveprops.ts:81` (spires): `lit(); glow(); flat();` per spire is 24 composite switches. Fix: two passes, first all glows under one `lit()`,
  then all rects under `flat()`; composite switches go from 24 to 2 for the same visual. Same for the chimney (L94), 6 to 2.
- S3. `moveprops.ts:68` (folds): allocates `[-22, 0, 22]` per cell per frame, against the no-allocation rule. Fix: hoist `const FOLD_Q = [-22, 0, 22]` to module level or unroll to
  three calls.
- S4. `moveprops.ts:89-99` (chimney) with `terrainb.ts` `vent.mouth: 16`: the grille is under the HUD strip, so the vent is not seen. Fix (art-direction call first): either
  give the hood faces (the sloped ceiling around each vent, L96-98 region) the glowing grille so it is visible at y 30-55, or draw a short 6-8 px flame lip at
  the mouth lower edge `c .. c+6` that sits below the HUD. Both are inside the existing ceiling mass edge, so they do not lie about collision. Also drop the grille alpha to about .8 so it does not outshine the molten seam.
- S5. `moveprops.ts:35-45` (stairs) and `:114-125` (polyps): the props are invisible at game scale (duplicate snow lip; dimple and shine lost in the texture). Fix: stairs get a 2-3 px dark riser
  shadow on the tread's inner corner (`fillRect(x0, f, 2, rise)` using the step diff `floorAt(x0+e+2) - f`, only where the diff > 8), which is where the eye needs to find the step;
  polyps get a 1 px bright rim following the bulge (reuse the arc over the full top half) rather than the 3 px dimple.

### NICE TO HAVE
- N1. `moveprops.ts:78` / `:118` (`f > PH - 50` skip): this hides the glow on the short spires (18-26 px), about 13% of them, and on bare polyp cells (already no bulge, so fine). Use `f > PH - 30` for spires so every tip burns.
- N2. `moveprops.ts:56` (tank): the pale dash at `f-2+bob` floats up to 3.2 px above the collision floor. Clamp to `f - 1`, or draw it in the mass (`f+1`).
- N3. Round `f`/`c` to integers for the 1 px rects (L41-43, L54-56, L82-83) to stop the shimmer: `const f = floorAt(wx) | 0`. (Antialiased 1 px rects are blurry on a 2x screenshot.)
- N4. `moveprops.ts:132`: guard `PROP[m.b]?.[m.mv]?.(...)` so a bad save or stale `MOVES` cannot throw in the render loop.
- N5. Palette: lift the hard-coded hex into a named table per biome (the `DEPTH` pattern) so round 2 can re-skin by changing one object; no values change.
- N6. Crevasse (`terrainb.ts` `tooth.every` 36): put tip centres on the 4 px grid (every 36, centre at `n*36+16` or 20) so the sampled tip equals the nominal and the prop's start `c-2` is exact; the
  gain is about 17% on tooth height. Terrain change, so it is a re-baseline/hazard-spacing question for the lane owner.
- N7. Record in the decision log that all eight props are interim and wait on round 2; the stairs, polyps and tank are the three most likely to be replaced outright.

## Checks run
- Read-only: files and screenshots listed above. No perf-probe, harness or build was run.
