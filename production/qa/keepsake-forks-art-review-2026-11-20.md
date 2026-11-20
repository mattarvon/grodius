# THE KEEPSAKE: fork art review (2026-11-20)

*Art department (art-director and technical-artist roles), on branch `kboss-core`. Review and scouting only: nothing in
`src/` or the committed tools changed, and nothing is committed. Matt's ask: "the look is great though. the forks could
be more realistic. can we have the art dept look at those? maybe leverage the openverse API."*

Evidence is in git-ignored `assets-raw/forks-review/`:
- `shots/`: `tools/keepsake-shots.mjs`, fire biome, long4, 18 beats, all clean. The fork beats are 1b, 1c, 2d, 2e, 3b and 3d.
- `ingame-forks-strip.png` and `ingame-forks-closeup.png`: the mobile, the boomerang and the fountain, cropped.
- `atlas-forks-x6.png`: the atlas's fork, mfork and wound frames at 6x.
- `openverse-contact*.jpg`: the candidates.
- `mock-photo-fork-x6.png`: a naive auto cut-out of a photo fork at 50/33/22/15 px.

## 1. Inventory: every fork in the fight

The game draws to a 480x270 canvas, upscaled nearest-neighbour (about 3.75 device px per game px on the shots rig).

| Fork | Where it's made | Size (game px) | Frames |
|---|---|---|---|
| **Embedded** (soft spot) | Atlas, baked by `prep_keepsake_boss.py` `paint_fork()` into `wound_seat`/`wound_proud` (a procedural Python paint, **not** a photo) | 15x50 fork, about 38 px above the skull (+9 px proud) | 5 tilts x 2 |
| **Stump** (CRACKED brain) | Atlas `wound_brain` (`brain()`) | a few px | 5 tilts |
| **Big fork**: boomerang, flying (`st 'fly'`) | Atlas `fork` frame through `bigFork()`, **rotated at runtime** (`$.T*.45`, about 26 deg/frame, about 4.3 rev/s) with smoothing off | 13x50 | 1 frame, rotated live |
| **Fountain** (`fk 1`), Fountain II | `render/fork.ts drawFork` vector, via `hud.ts drawEShots` | 15 px long (10 handle + 5 tines), about 8 px wide with the outline | none (rotated to its velocity) |
| **Aimed throw** (`fk 2`) | same `drawFork`, scale 1 | 15 px | none |
| **Mobile**, hanging x6 | `drawFork` x2.2 (`KB.mobFs`) | 33 px | none (the drop tell only glows) |
| **Mobile drop / fork rain** (eshots) | `drawFork` x2.2 | 33 px | none |
| Atlas `mfork` x2 | baked, **unused** (the code comment says it is "too long, too fine") | 9x46 | n/a |
| Tier-2 fallback | `src/sprites/keepsake-fork.png` (the midboss's), at 1.5x | 7x32 | only while the atlas loads |
| Landing | **none**: the fork vanishes on terrain, with `forkLand`'s tink only. The red chevrons and dashed paths are telegraphs (keep them) | n/a | n/a |

### Why they read as fake

1. **Icon proportions.** The Walker & Hall fork below measures, as a share of its length: tines about 27%, head width
   about 12.5%, neck about 4%, terminal about 9.5%.
   - The atlas fork has 40% tines and a 22% head (11 px of 50), so it reads as a rake.
   - `drawFork` is worse: half of its length is tines, and the head is nearly as wide as the tines are long. Its handle
     has no taper and no flared terminal.
2. **The outline scales with the fork.** `drawFork` strokes a 3 px black pass under the steel and then calls `c.scale(2.2)`.
   On the mobile that makes a 6.6 px slab: the 3.5 px tine pitch leaves 0.6 px gaps, so the tines fuse into a **comb or
   spatula**. This is the worst offender on screen (2d, 3b).
   - At 1x the 1.6 px pitch under a 1.3 px stroke gives sub-pixel gaps, so the fountain forks are grey paddles.
3. **Flat steel.** Both are drawn in one pale grey (`#d9dee3`, or 0.50-0.56 grey with a white spine). Polished steel reads
   as steel through **contrast**: near-black mirror bands from the dark scene, a hot specular, and a warm cast from the
   fire biome. The flat grey reads as aluminium, plastic or bone, especially next to Matt's photographed vinyl.
4. **Blunt, parallel tines.** They are square bars with rounded caps. They don't taper to points and have no cupped
   bowl at the tine roots.
5. **Runtime rotation.** The boomerang's 13x50 sprite is rotated nearest-neighbour every frame, so its edges stair-step
   and crawl and the tines alias into a grille (2e close-up). The bake's own rule (header, TILTS) is "never rotated at
   runtime, because that shimmers on the Fold"; the fork is the one exception.
   - The spin of about 26 deg/frame also strobes: no frame reads as a fork.
6. **No motion read.** Thrown forks have no glint, streak or tumble, and they don't stick where they land.
7. **Scale versus the head (an art call, not a defect).** A real dinner fork is about 1.3-1.5x a doll head's height. Ours
   is 0.4x (50 vs 124 px), so it reads as a cake fork or a toy pick. True scale would break the crown lane and the
   hitboxes. A **slimmer** fork reads longer at the same length; an extra +15-20% visible length is optional.

## 2. Openverse scout

The search used `tools/openverse.mjs search assets-raw/forks-review/queries.json`. It made 30 API requests in total
(12 on pass 1 and 18 on pass 2), with CC0, CC BY and PD only.

**Picker:** `assets-raw/openverse/picker.html` (110 candidates: 83 CC BY 2.0, 21 CC0, 3 CC BY 3.0, 2 CC BY 4.0, 1 PDM).
- I merged two useful pass-1 hits back in ("A Fork in Black and White", "Candle Light Fork and an Eggshell").
- I **dropped one hit that shows a child** ("stab it with a fork"), to respect the imply-only line.
- Pass 1's raw hits are in `assets-raw/forks-review/hits-pass1.json`.

**Queries and hits** (total found; up to 8 new kept per query):

| Query | Found | Query | Found |
|---|---|---|---|
| stainless steel fork | 240 | rusty fork | 39 (mostly tools and junk) |
| silver dinner fork | 195 | fork macro tines | 2 |
| dinner fork | 0 | silverware macro | 14 |
| table fork | 240 (The Met CC0 carving forks) | bent fork | 156 |
| fork cutlery | 240 | fork in steak | 207 (food, weak) |
| sterling silver fork | 16 | fork stabbed | 6 |
| antique silver fork | 12 | cutlery black background | 60 |
| vintage silverware fork | 38 | silverware black background | 1 |
| tarnished silverware | 11 | old fork | 240 |

Pass 1 only: "fork isolated white background" 0, "fork side view" 240 (rivers), "fork stuck in" 44 (meatballs),
"fork on black" 240 (rivers).

### Strongest candidates

| # | Title, creator, source | Licence | Why |
|---|---|---|---|
| 1 | **Table Fork - Cutlery Set, Walker & Hall**: Museums Victoria (collections.museumsvictoria.com.au/items/2049633) | CC BY 4.0 | **Top pick for the bake.** 3000x873, flat orthographic top-down on a clean sweep, four tapered tines and a cupped bowl, an antique silver-plate fiddle-pattern handle. Its age fits the antique doll, and it is the right view for spin frames. Needs a CREDITS row. |
| 2 | **18-8 stainless steel fork 1 / 2**: Yapparina, Wikimedia (curid 67011521 / 67011522) | CC0 | 5184x3456, isolated, a 3/4 side-on view that shows the neck bend. The CC0 fallback source, and the perspective reference for the embedded fork standing up out of the skull. |
| 3 | **Vintage Sterling Silver Birks Norman Pattern Luncheon Forks**: GranniesKitchen, Flickr 5016404048 (also 5015796143) | CC BY 2.0 | A worn sterling fork top-down on dark weathered wood: real patina, and how silver goes dark against a dark ground. A reference for the steel ramp. |
| 4 | **Old forks (28626495995)**: freestocks.org, Wikimedia (curid 131378050) | CC0 | 4802x3201. Tarnished antique forks: the tarnish colour (warm grey to brown in the recesses). |
| 5 | **Fork**: kevin dooley, Flickr 1965708320 | CC BY 2.0 | A black-and-white macro of the tines: hard mirror bands, near-black next to white. Exactly the value ramp the forks lack. |
| 6 | **Orange Fork**: Hey Paul, Flickr 107326037 | CC BY 2.0 | Tines driven into a soft round skin: the entry dimple and angle for the embedded fork. |
| 7 | **fork**: Dean Hochman, Flickr 31382301854 | CC BY 2.0 | A fork standing upright, lit hard, with a long shadow: the stuck-fork silhouette and lean, for the embedded fork and any landing sticks. |
| 8 | **Fork, cutlery**: rawpixel 6024396 (and 6024412) | CC0 | Chrome forks on white and black with crisp specular streaks. A glint reference. |
| 9 | **Cutlery Macro 2**: Ed Townend, Flickr 3588895523 | CC BY 2.0 | Tine roots with rim light along each tine edge: the rim-light model for the dark-biome read. |
| 10 | **Old fork bent...**: storebukkebruse, Flickr 8581637637 | CC BY 2.0 | A bent-tine reference for the CRACKED stump and fork-rain variety. |

Numbers 3 and 5-10 are **reference only**: no pixels from them ship, so they need no CREDITS row. If 1 ships, it needs:
`Museums Victoria, "Table Fork - Cutlery Set, Walker & Hall ...", CC BY 4.0`.

## 3. Options

**The mock** (`mock-photo-fork-x6.png`): a naive auto cut-out keeps the photo's real shading on the handle at 50 px, but
it loses the tine gaps at 33 px and under. The tines must be redrawn on the game-px grid, as `paint_fork` already does.
Photo detail cannot survive at 15 px.

| | What | Effort | Fold perf | Atlas | Risk |
|---|---|---|---|---|---|
| **A. Procedural v2** | Redraw `drawFork`: real proportions (27% tines tapering to points, a slim neck, a flared terminal); the outline at a fixed 1 px (divide by the scale); a 4-stop steel ramp (a near-black mirror band, mid grey, white edge, one specular pixel) from a gradient built once; a dark tarnish fleck. | about 0.5 day | neutral (a few more path ops on 12 or fewer forks) | 0 | It stays vector next to a photographic doll: better, but still "drawn". |
| **B. Full photo bake** | Swap `paint_fork` for a cut-out of pick 1 (or 2), graded into the atlas palette (silver in the `RARE` slots), with the tine grid enforced. Bake: embedded (5 tilts x 2), big fork at **16 angles** plus 2 glint frames, mfork at a real 33 px (finally used), and the 15 px eshot fork at 16 angles. The renderer picks frames by angle (fallback `drawFork`). | about 1.5 days | neutral to better (removes the runtime-rotated `drawImage`) | about +6-8% area, more palette pressure | The 15 px photo forks mush, so hand-touched pixels are needed anyway. `hud.ts` eshots would depend on the lazy atlas. |
| **C. Hybrid (recommended)** | B for the forks 33 px and up (embedded, boomerang, mobile and its drops); A for the 15 px fountain and aimed eshots, with the ramp colours **sampled from the photo bake** so they match. Plus motion (below). | about 1-1.5 days | neutral | about +5% | low: shared code keeps its vector fallback |

**Motion (any option):**
- **Boomerang.** Step through the baked angles, and drop the spin to about 0.3 rad/frame, or bake 24 angles, so it
  doesn't strobe. Add two ghost copies at the previous angles (35% and 18% alpha) and a one-frame star glint as the head
  passes "up" (toward the top light).
- **Thrown and fountain forks.** Keep them tines first (direction is the threat read). Add a 1 px streak behind the
  fork and a glint pixel that slides along the handle.
- **Optional, render-only landing.** The fork sticks where it tinks, quivers ±6 deg over 20 f and fades by about 60 f.
  It is dim and has no green glow, so it never reads as a live hazard.

Everything keeps the enemy-fire glow, the telegraphs and the hitboxes as they are. No sim change, no `R()`, rng-probe SAME.

## 4. Recommendation

**Option C, sourced from pick 1** (Walker & Hall, CC BY 4.0). Yapparina's CC0 18-8 fork is the fallback if Matt wants
no credit line. The direction for the art: slim real proportions, dark-mirror steel with one hot specular and a warm
cast in fire, a fixed 1 px outline, baked spin with a glint. Hand C to technical-artist as a `kboss-art` follow-up
through `prep_keepsake_boss.py` (the palette and dither match the doll's automatically).

## 5. What Matt needs to do

1. Open `assets-raw/openverse/picker.html` and tick picks (suggested: 1, 2, 4; add any refs you like). Then hit
   **SAVE PICKS** and drop `picks.json` in the worktree.
2. Choose **A, B or C**. Also say whether the fork stays at 50 px or gains +15-20%, and whether you want stuck-fork landings.
3. Then the art team runs `node tools/openverse.mjs fetch picks.json` and the bake. The CC BY row goes into `CREDITS.md`.

## 6. Addendum: A / B / C mock-ups (2026-11-20, for Matt to pick by eye)

The mock-ups are in git-ignored `assets-raw/forks-review/`:
- **`compare-ABC.png`** (1602x816): the embedded fork on the doll's crown (atlas head), the hanging mobile fork and two
  fountain/aimed forks (one on bricks, one on a bright window).
- **`compare-ABC-spin.png`** (1600x1438): four of the 16 baked boomerang angles (the fourth has a glint), a motion
  frame with 2 ghosts, and a row showing option C at +18%.

Every cell shows true game size first, then 4x nearest-neighbour (the +18% row is 3x), on the fire arena from the shots
rig, with the enemy-fire glow.

How they were made:
- **TODAY** is rendered by the game's own `drawFork`, plus the atlas fork rotated the way `bigFork` does it
  (`mock/today.mjs`, against the dev server).
- **A, B and C** come from `mock/forks_abc.py`.
  - The silhouette is measured from the Walker & Hall photo (head clamped to 7 px, so the 4 tines survive).
  - B and C take their shading from that photo, graded to dark-mirror steel with a warm cast.
  - A is posterized to a 4-step ramp, with a tarnish fleck.
  - Angles are baked at 8x and box-filtered down.

**Read:**
- **TODAY:** bold, but a rake/comb. The mobile fork is a 17 px wide spatula, and the boomerang is a grille.
- **A:** the right silhouette, crisp and clean even at 15 px. Next to the photographed doll it reads as cartoon steel.
- **B:** the most real at 33 px and up: warm reflections, a hot handle highlight, a dark bowl, and it matches the doll.
  At 15 px it collapses into a needle and stops reading as a fork.
- **C:** B's look for the big forks, plus A's 15 px shape in photo-sampled steel. **Pick: C.**
- **Caveat:** the slimmer forks are less bold at true size than today's. The mobile leans on its glow, so it may want a
  brighter rim.

**+18%:** the embedded and boomerang forks at 59 px read as a dinner fork rather than a cake fork (worth it; their
hitboxes are unchanged). The mobile at 39 px gains little and widens the gap between what's drawn and the tip hitbox,
so keep it at 33.
