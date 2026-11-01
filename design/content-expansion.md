# Grodius content expansion (D19): design spec

*Producer, 2026-11-01, revision 2 (after the creative, technical, QA and art director reviews; see the Review log at the end). A draft for Matt. It combines five proposals (level-designer, game-designer, world-builder, systems-designer, technical-director) and the technical map of the stage and descent systems. Code refs are relative to `/home/matt/Projects/grodius`. Nothing in the repo was changed.*

**Source decision (D19, Matt, 2026-11-01):**
- Stages run about 90-120 s, classic Gradius length (today they are about 35 s). A mid-stage checkpoint follows from this.
- More levels of all three kinds: new biomes, more stages per descent, and ship-interior stages.
- Each biome has a pool of 3-4 midbosses. A long stage meets two different ones, and repeat runs meet different ones.
- The game no longer has to fit phone sessions, but it must stay **playable on a phone**: touch controls, readable at phone size, and holding frame rate on the reference device.

**What this spec does not presume.** Art direction round 2 is still waiting on Matt's answers (arc, idiom, meridian, sound, hell, cast, ship, gore, type). Every place, body and name below is a mechanical identity with a working title. §11 lists which content depends on which question. None of the systems work depends on those answers. Matt names every boss and midboss and picks every player-facing string (direction brief §2.1).

**How to read the defaults.** Each number is a studio default, and each one sits in a typed table (the `DEPTH` pattern) so it can be tuned. The questions Matt has to answer are in §12, each with a recommended default.

---

## 1. Summary

| | Today | After D19 (default) |
|---|---|---|
| Stage length | ~35 s of scroll; 54-71 s from stage card to tally | **90-120 s from stage card to tally**: ~60 s of scroll (3600 px) plus two midbosses and a boss |
| Stages per descent | 4: Orbit, biome, biome, Drive | **5: Orbit, biome, ship interior, biome, Drive** |
| Descent time | 4-6 min | **~9.5-11 min** (`long5`). The phase-1 build (`long4`, 4 stages, §2.2) runs **~7.5-8.5 min**, toward the low end while Orbit has one midboss and the Drive approach none |
| Midbosses per stage | 1 per biome stage; the Saucer in Orbit | 2 per stage (1 on the Drive approach) |
| Midboss pools | 1 per biome | **4 per biome** (3 in the first wave), plus an Orbit pool and a shared ship pool |
| Biomes | 4 | 6 (2 new, built one at a time) |
| Interior stages | Open Orbit and the Drive approach only | Up to 3 rotating interior kinds (the first is the Skin, working title) |
| Checkpoint | none | **Checkpoint**: saved at stage start and after midboss A. Always a resume point after an app kill or quit; whether death also restarts you there is Matt's call (§4, Q2) |
| Layout | Absolute world x values, hand-placed | Generated from a stage-kind table |

## 2. Run and descent structure

### 2.1 Order

```
OPEN ORBIT -> fork -> BIOME A -> SHIP INTERIOR -> fork -> BIOME B -> GRAVITY DRIVE -> tally -> Infirmary -> next descent
```

- **Why 5 stages.** All five proposals reached this independently.
  - It is the smallest change that delivers all three D19 content kinds.
  - It keeps two forks and the 2-wide `G.route`.
  - It gives each descent a sawtooth shape: an onboarding stage, a peak, a change of texture, a second peak, and the finale.
- **Biome variety.** With 6 biomes and 2 biome slots per descent, Descents 1-3 never repeat a biome. That matches the rule `pickV` already enforces for authored sections (`scripts.ts:27-38`). Today Descent 3 always repeats a biome.
- **The interior stage has no fork.** If players could choose it, they would pick their favourite interior every descent, which would break the rotation. Player choice stays with the two biome forks.
- **Interior rotation.**
  - Interior kinds are drawn without replacement per run, using the sim `R()` at `startLoop`. Descents 1-3 therefore fly three different interiors.
  - From Descent 4 the draw repeats, but never back to back.
  - The Bridge is gated to Descent 2 and later.
  - Until three interior kinds exist, the slot uses whichever kinds have been built (see the build plan).
- **Possible later options (6 or 7 stages).** Add a third biome slot, or a second interior, from Descent 3. These cost 11-15 min per descent and need 9 biomes before Descents 1-3 can avoid a repeat. Because the layout is table-driven, adding them later is a data change, not a rewrite.

### 2.2 Stage-kind table

The layout is generated from a table. There are **three layout entries**, because phase 1 ships 4 stages and every band in §7 and §8 has to be measurable against the build that exists:

| Entry | Stages | Ships in | Used for |
|---|---|---|---|
| `short` | Orbit, biome, biome, Drive at today's x values | today | Byte-identical parity with today; A/B for one milestone after the flip, then deleted |
| `long4` | Orbit, biome, biome, Drive, each long (Drive approach 2700 px) | LS1 (behind the flag) | The LS1 exit. Its own seals, XP, kill-bio, GLUTTONY and hits/min bands (§7, §8) |
| `long5` | Orbit, biome, interior, biome, Drive | LS3-0 | The D19 target. The §7/§8 `long5` values are the LS3-0 exit |

Each entry carries its own seal schedule, grade reference seconds, stage XP, kill-bio factor, GLUTTONY thresholds and §8 hits/min row. `long5` shows the shape; the code is in the build plan.

```
DESCENT_LONG5 = [
  {kind:'orbit',    len:3600, mids:['drift','held'], end:'maw'},
  {kind:'biome',    slot:0, len:3600, mids:2, fork:true, end:'biomeBoss'},
  {kind:'interior', len:3600, mids:2, end:'coreLock'},
  {kind:'biome',    slot:1, len:3600, mids:2, fork:true, end:'biomeBoss'},
  {kind:'drive',    len:2700, mids:1, end:'drive'},
]
// long4 = the same rows without the interior; in LS1 its Orbit row has mids:['drift'] and its Drive row mids:0
// until LS2-orbit and LS2-ship land (§6.3)
```

- `layout(L)` returns, for each stage, `x0`, `x1`, `bossX`, the breath windows and the movement bands, plus `LEVEL` and `BOSS_AT`.
- `LEVEL` comes to about 20,500 px with fork and arena margins (10,000 today). The terrain arrays grow from about 2,742 to about 5,300 cells, which is negligible.
- **The current layout is the first row set in the table.** The short 4-stage layout is kept as a table entry (`layout=short`), so the refactor can be proven byte-identical in the harness before anything changes. The long layout runs behind a dev flag until it is ready to become the default.
- **Economy constants live in the layout entry:** seal schedule, grade reference seconds, stage XP, kill-bio, GLUTTONY thresholds and hits/min targets. Each layout therefore carries its own tuning, and the short layout keeps today's numbers exactly.
- **Layout invariants** (checked in `tests/unit/layout.test.ts` for every entry): stages contiguous; breaths ≥ 300 px from set pieces and `bossX`; **every DRIFT midboss's forced-exit x sits at least 300 px before the next WARNING in its stage** (§3.2).

## 3. Stage beat template and timing

### 3.1 What "90-120 s" measures

**Default:** wall time from the STAGE card to the tally, fights included. `pod-probe` and `playtest.mjs` already report this per stage. Under this definition, each stage needs about 60 s of scroll.

If Matt means scroll time only, every content number in this spec roughly doubles (§12, Q1).

| Player | Scroll | WARNINGs (3 × 2.5 s) | Midboss A | Midboss B | Boss | Total |
|---|---|---|---|---|---|---|
| Fast (strong kit) | 60 s | 7 s | 6 s | 8 s | 12 s | **~93 s** |
| Median (stage-1 kit) | 60 s | 7 s | 10 s | 12 s | 20 s | **~109 s** |
| Worst case (both midbosses withdraw; boss runs both `PHASE_F` halves) | 60 s | 7 s | 18 s | 21 s | 50 s | ~156 s |

- The worst case ends in an escape, graded C, so running over 120 s there is acceptable.
- The midboss leave clocks (§6.4) cap the worst case.

### 3.2 Biome stage beats (3600 px; p is progress through the spawn span)

| p | Scroll s | Beat | Gap / double chance | Contents |
|---|---|---|---|---|
| — | — | Entrance | — | STAGE card, log line 1. Terrain blends in off-screen (`rewriteTerrain`) |
| 0-.12 | 0-7 | Intro A | ×1.4 / .2 | Signature enemy alone in the first slot; 60% signature after that (existing rule) |
| .12-.22 | 7-13 | Intro B | ×1.25 / .25 | The biome's second-ranked mix kind gets its first slot on its own: one idea per wave (pacing §1, Taisei) |
| .22-.30 | 13-18 | Build A | base | Set piece S1 at .26 |
| .30-.36 | 18-22 | **Breath 1** | none | WARNING at bZ1 − 210, then **midboss A** (scroll held) |
| — | — | Release | none | One guaranteed pod formation, log line 2. **CP1 is written here** (§4) |
| .36-.62 | 22-37 | Terrain movement B (the gimmick) + Build B | ×1.1 / base − .1 | Lighter spawns, so the terrain is the threat. S2 at .48. Crossover kinds come in here on a remix |
| .62-.68 | 37-41 | **Breath 2** | none | WARNING, then **midboss B** (scroll held) |
| .68-.90 | 41-54 | Peak | ×.75 / base + .15 | S3 at .80. Rear waves. Descent 2+ adds a third spawn 35% of the time (existing) |
| .90-1 | 54-60 | Arena run-up | none | Terrain widens to the boss arena. Log line 3. WARNING, then the stage boss at `bossX` |

- **On a remix,** the set pieces move to p .22, .46 and .76.
- **Spawn rates** stay at today's measured values: about 0.5/s in the intro, about 1.0/s in the builds, 1.0-1.7/s in the peak (pacing.md §3.1).
  - A biome stage then spawns about 55-70 enemies, against 30-40 today.
  - That is what drives the economy changes in §7.
- **Code changes to `biomeScript` (`biomes.ts:190-221`):**
  - The breaths become a table (`BREATHS`) instead of the single `bA/bZ`.
  - A second `miniWarn`.
  - The stage-2-only `mid + 260` hack is removed.
  - A third set piece.
  - An intro B branch.
  - `B.logs` becomes a pool (§5.5).
- **Breath 2 safety rule.** Breath 2's WARNING must never fire while midboss A is still up. `G.mini` is a single slot and `midboss()` overwrites it (`spawn.ts:320-324`), so a collision would silently delete midboss A.
  - **Held midbosses** are already safe: `step.ts:30` holds the scroll while `G.mini && !G.mini.drift`, so `runScript` stalls.
  - **DRIFT midbosses are not:** the scroll keeps moving while they are up. A 1080 f leave clock is about 1080 px of scroll, but breath 1 to breath 2 is only about 900 px. This hits the Saucer in Orbit slot A and the Calving Shelf (ice pool). Today only the Saucer's `UFO_GAP_END` forced exit (`src/enemies/ufo.ts:31,47,65`) protects it.
  - **Rule 1 (layout invariant):** every DRIFT midboss gets a **stage-relative forced-exit x at least 300 px before the next WARNING** in its stage (the `UFO_GAP_END` pattern, generalised). `layout.test.ts` checks it for every layout entry.
  - **Rule 2 (guard):** slot B's `miniWarn` (and `midboss()` itself) **defers while `G.mini` is non-null**, re-checking each frame. In normal play rule 1 means it never triggers; it is the explicit backstop. A unit test covers a DRIFT midboss in slot A on long Orbit and on a biome stage.

### 3.3 Terrain movements (biome stages)

One noise function over 60 s reads as wallpaper. Each biome stage therefore has three terrain movements, blended with `sstep` over 200 px. Terrain stays noise-only (`vnoise`/`hash`), so it rebuilds exactly, which the checkpoint relies on.

| Movement | Span | Rule |
|---|---|---|
| A, signature | intro to CP1 | Today's `shape()`, unchanged |
| B, gimmick | p .36-.62 | Biome-specific (table below). The gap never drops below 108 px (`biomes.ts:126`) |
| C, arena | p .90 to the boss | Gap ≥ 150 px and half amplitude, so boss patterns have room |

| Biome | B0 (first visit) | B1 (remix) |
|---|---|---|
| ice | Crevasse: tighter, taller ice teeth; icicles every ×.7 as often | Shelf stairs: floor steps every 120 px |
| acid | Flooded tank: the lake rises 30 px and swells | Folds: the ceiling drops in folds |
| fire | Spire field: more, narrower spires | Chimney: ceiling vents with downward jets |
| snot | Peristalsis: the narrows march toward the player (gap 108-150) | Polyps: round floor bulges |

- From Descent 2, a first visit may also roll B1, which adds variety.
- **Cost:** about 15-25 lines per biome in `shape()`, plus one decor prop per gimmick (20-40 lines).
- **Waits on round 2:** how the props look depends on meridian and idiom (bulkheads vs sphincters).

### 3.4 Other stage kinds

| Stage | Scroll | Midbosses | End | Wall time |
|---|---|---|---|---|
| **Open Orbit** | 3600 px | A: the Saucer (drift: it does not hold the scroll, and it eats the filler). B: a held midboss from the Orbit pool | Maw (`maw(true)`), unchanged | 85-100 s with both midbosses. **LS1 (Saucer only): 75-90 s** |
| **Ship interior** | 3600 px | 2 from the ship pool | **Core lock** (§5.3) | 100-120 s |
| **Gravity Drive** | 2700 px (45 s) | 1 from the ship pool, at p ~.5 | Existing WARNING, drifting crew, then `startBoss` | 90-110 s with its midboss (fight target 30-45 s, M3). **LS1 (no midboss): 80-95 s** |

- Orbit and the interiors use the same p template as the biome stages.
- The Saucer WARNING moves to around x 1100, because `UFO_AT` and `UFO_GAP_END` become stage-relative. `UFO_GAP_END` becomes the Saucer's forced-exit x and obeys the §3.2 rule (≥ 300 px before Orbit's slot B WARNING).
- **Why the Drive stage gets one midboss, not two.** Under D19 the Drive approach counts as **part of the boss stage**: the stage is the approach plus the Drive fight, and the fight is the stage's second big encounter. One midboss keeps the 30-45 s Drive window and lands the stage at 90-110 s. This reading is put to Matt in Q7.
- **"The corridor."** The Drive approach (x 8300-9300 today: `drawInterior`/`AMT.corr`, `scripts.ts:142-227`) is the MERIDIAN corridor that the round-2 questions refer to. The interior stages (§5.2) share its kit, so **the meridian, cast and hell answers about the corridor also cover the interiors**.
- **D19's "two per long stage" in phase 1.** In LS1, Open Orbit has one midboss (the Saucer, which does not hold the scroll) and the Drive approach has none. D19 is fully met for those two stages only after LS2-orbit and LS2-ship. Every biome stage has two different midbosses from LS1. The default flip waits on this (build plan item M).
- **Authoring method (resolves a disagreement).** Orbit, the interiors and the Drive approach do **not** get 3600 px hand-authored sections × 3 variants each. Instead they run through the same beat generator with an **interior mix table**: sentry, crew corpse, mutant, crawler, womb, wall eyes, flayer, and drones at about 30%. On top of that, a pool of hand-authored **cells** of about 300 px (4-6 spawns each) goes into tagged slots (`intro`, `build`, `peak`).
  - Today's `ORBIT_A/C/D` and `DRIVE_E/F` variants become the first cells.
  - `pickV`'s rules move down to the cell level: no repeats within a descent, prefer cells not seen this run, never last descent's.
  - Target: 14-16 cells per interior kind, 10-12 for Orbit.
- **Descent 1 Open Orbit.** The first 3 cells (about 15 s) stay fixed, as a learnable teaching opener. The rest varies across runs, using cross-run memory in `$.meta`.

## 4. Checkpoint

**What D19 says.** "A mid-stage checkpoint follows from this." D19 supersedes parts of the brief, so the brief's "drops checkpoint restarts" is **not** treated as settled here. There are two readings, and only Matt can pick (Q2):

| | **(a) Resume point only** | **(b) Gradius checkpoint** |
|---|---|---|
| On death | Unchanged: respawn in place (`flow.ts:181-204`) | Restart at the last checkpoint (CP0 or CP1) with one life spent: the classic Gradius checkpoint. Game over still ends the run |
| On app kill or quit | Resume at the last checkpoint | The same |
| Brief | "Drops checkpoint restarts" stays | That brief line is edited |
| Feel | Phone-safe, no added punishment | Harder, more Gradius; a death costs up to ~40 s of replay |

- **Both use the same rebuild path** (build plan item H). H's code does not change between them; only the trigger does: on death in `flow.ts:181-204` (`respawn()`), versus app kill and quit only.
- **Recommendation: (a)**, because it keeps the death rules the M1/M2 tuning was done against, and (b) can be switched on later without new restore code. Matt answers Q2 at the LS1 playtest (build plan §6), after flying both if he wants (the trigger can sit behind a dev toggle).
- Either way, this covers the "playable on a phone" case: a 10-minute descent is not lost when Android kills the WebView.

**When it saves:**
- **CP0:** at stage start (after `choose()` or the tally).
- **CP1:** once `scroll ≥ bZ1 + 150` **and** `G.mini == null`, meaning after midboss A has died or withdrawn.
  - Interior and Orbit stages use the equivalent anchor after midboss A's forced exit.
  - The Drive stage puts CP1 at the approach midpoint.
- **Never** during a fight, a fork or a tally. If the game is paused in one of those, the last checkpoint stands.
- **Android `pause`** (`main.ts:107-110`) writes the last checkpoint again, not live state.
- **Most progress you can lose:** about 40 s of scroll plus a fight.

**What it stores.** An allowlisted JSON under its own key (`grodius.run`):
- loop, stage index, `cpX`, layout id, run seed (a production run seed is new: today the sim RNG is `R = Math.random`, `core.ts:33`, and only the tools reseed it. B2 draws one seed per run at `newGame()` and saves it here);
- **`bx`, all three entries.** `choose()` builds biome terrain and the biome script from `from = max(SEG.x0, G.scroll + W + 10)` at the moment the player flies into the gate (`biomes.ts:244-247`), and `biomeExit` sets `G.bx[2]` at the moment of the clear (`biomes.ts:150`). Both depend on player timing, so they cannot be recomputed;
- loadout, `pk`/`xp`, `gm`, `rig`, lives, score, seal, cleared, hull form;
- `route`, `bvis`, `visited`;
- remix state, the midboss used and seen sets, the set-piece used set, the interior rotation;
- `G.st` stats as they stood at the checkpoint;
- **this stage's picks:** the midboss pair, the set-piece ids and the movement-B variant.

**How it restores (a rebuild, not a snapshot).** A snapshot is impossible because of closures and object references (map §8). The restore:
1. Rebuilds terrain exactly from the loop number, then re-applies `rewriteTerrain(seg, b, bx[seg])` for each committed biome **with the stored `bx[seg]`**, never a recomputed x.
2. Rebuilds the stage script from the per-stage build stream (`Rs`), passing the stored `from` (`bx[seg]`) to `biomeScript`. The script x list and kinds are exact once the per-stage streams land.
3. Skips script entries with `x < cpX` (the `G.eat` pattern).
4. Starts scroll at `cpX − W`, with a 120 f empty lead-in and respawn i-frames.

**What is not reproduced:**
- Live enemies, bullets, pods, decals, chain and cooldowns.
- Spawn-time rolls on the sim `R()`: the `SPAWN` closures' side, y and formation (`biomes.ts:156-175`), in-flight behaviour rolls, and **the elite roll inside `el()`**, which runs at spawn time. "Same filler" after a resume therefore means the **same script x and kind list**, not the same sides, positions or elite status. (Moving elite rolls into the B2 build stream would make them exact; it is optional and not in LS1.)

**Integrity:**
- One slot only.
- Cleared on game over, at descent end and on a new game.
- The title screen shows RESUME only while a valid checkpoint exists.
- A version mismatch discards the checkpoint safely and never crashes.
- **Known exploit (option a only):** killing the app rewinds you to the last checkpoint. Default: accept it, since the game is single-player with no leaderboards. A mitigation is offered to Matt (Q2). Under (b) the rewind costs nothing extra over dying, so it is moot.

## 5. New places

Each new place is written with **two readings**: a ship function (the name on the stage card) and an organ reading. How much meat sits on the steel is left to round-2 **meridian**, and the two-reading device itself depends on it:
- **ship-is-body / meat-spreads:** both readings stand.
- **rooms-on-ship:** the organ reading is moot; each place is just the ship room (the concepts still work).
- **hell-bleeding:** the device is invalid, and **every biome concept below is invalidated**; that means new concepts, not just new art.

**Rules every place obeys:**
- Minimum gap 108 px.
- Hazards are never lime and never move bullets.
- Hazards keep the ±46 px no-drop-on-ship rule.
- Telegraphs last at least 36-45 f.
- No cross shapes in terrain or silhouettes.
- No mechanic punishes shooting (§9).

### 5.1 New biomes (concept cards; build 2, in order)

| | **THE KEEL** (bone) | **THE LOOM** (nerve) | **THE COOLANT LOOP** (blood) | **THE SCRUBBERS** (lung) |
|---|---|---|---|---|
| Build order | **1st** | 2nd (default) | Backlog | Backlog |
| Ship / organ | Keel and frame ribs / skeleton | Power and data trunk, comms exchange / spinal cord | Coolant loop out of the Drive / circulation | Air scrubbers / lungs |
| Lean (**pending arc**: meaningful only under a per-descent or per-run arc; moot under flat-max or ship-driven) | Dread (dry, ivory); marrow is the gross beat | Dread (dead crew's voices) | Gross | Split |
| Terrain | Alternating ribs every 96 px, ceiling and floor: a slalom | Sagging cable ceiling, ganglion pinches every ~300 px | A tube that rises and falls; clots narrow it | The tunnel breathes ±14 px on a 4 s cycle (base gap ≥ 136) |
| Hazard | `splinter`: a rib creaks (45 f), then sheds 3 shards | `arc`: a cable glows (50 f), then a 12 f discharge column | `clot`: shootable masses (40 f edge shadow) | `draft`: exhale pushes the ship back, **capped at 0.4 px/f** (proposal had 0.6) |
| Signature enemy (new) | Rattler: rebuilds once unless the skull is shot | Synapse pair: tether beam, 30 f telegraph | Leech | Sac: inflates, pops a ring if not shot |
| Colour (**all provisional until the idiom colour lock is set**) | `#d8cbb0` / marrow `#8a1a12` | `#c9b8ff` (close to the pale-blue player fire: check) | `#a0122e` (collides with the proposed locked blood red: a palette clash, not only gore contrast) | `#e89aa8` / ash |
| Extra code beyond the biome checklist | `shape()` only | Tether hazard class | Per-biome scroll target (1.25-1.5 px/f) **breaks 60 px = 1 s** | Time-varying collision |
| Main risk | Rib silhouettes must not read as crosses | **cast = from-beyond** removes its canon hook | Touch fairness at 1.5 px/f; probe units; red-on-red gore contrast | Its boss collides with the all-crew snot-Maw redesign (round-2 cast) |

- **Reserve:** THE ORCHARD (hydroponics). It is held back because it overlaps the acid Tanks' hanging crew.
- **Cost per biome:** about 300-400 lines on the map §10 checklist, plus a new signature enemy (80-150 lines), 2 bitmaps (tissue tile and hit FX), a track or a filter variant, a pool of midbosses and a stage boss. All-in, about 1,300-2,000 lines.
- **Why 2 biomes and not 4 (resolved).** Two are enough for 6 biomes, which means no repeated biome in Descents 1-3. The rule is to build one, measure it, then build the second.
- **Why the Loom over the Coolant Loop as the second.** The Loom keeps the 60 px = 1 s unit and touch fairness. The Coolant Loop is the most "Gradius III" of the four, but it needs probe and touch work. Matt can swap the order (Q13).
- **Stage bosses (working titles):** the Ossuary (Keel; a Big Core with plates), the Exchange (Loom), the Pump (Coolant Loop; a heart-locked rhythm, with shake gated by the flashes setting), the Scrubber (Scrubbers).

### 5.2 Ship-interior stages (non-biome)

Interior stages are built the cheap way:
- a `buildTerrain` band, with no `rewriteTerrain`;
- `drawInterior`, `metalPat` and `tex-flesh` reused;
- the generator plus a pool of cells;
- no per-biome art bill.

They share the kit of "the corridor" (the Drive approach, §3.4), so a round-2 answer about the corridor applies to them too.

Interiors are designed so they **can** be the cold stretch between two biomes. Whether they are depends on **arc**: per-descent, yes; per-run, only in Descent 1; flat-max or ship-driven, no.

| | **THE SKIN** (I2; working title) | **THE CREW DECK** (I1) | **THE BRIDGE** (I3) |
|---|---|---|---|
| Build order | **1st**: cheapest, and the least dependent on round 2 | 2nd | 3rd; Descent 2+ only |
| Terrain | Floor only, ceiling off-screen (Gradius 1 style); masts, plates that peel up | Corridor bands; bulkhead shutters on a timed 60 f close, never leaving less than 108 px | Wide chamber, floor consoles, high ceiling |
| Gimmick (movement B) | `searchlight`: the cone does no damage, but 30 f in it calls a sentry volley | Lights-out section: vignette only, **bullets drawn at full brightness** | The main viewscreen shows the gate, a natural hell-glimpse site |
| Entry | "HULL BREACH": you are blown out through the breach and fly along the skin. Unlike Orbit, it has a floor, structures and turrets | Heaviest log density | — |
| Backdrop | `drawNeptune` / `drawDerelict` reused | `drawInterior` reused | **A new large viewscreen backdrop**, the biggest interior art cost |
| Core lock dressing | the Battery: a point-defence cluster with Big Core plates | the Muster: one deck's crew fused into a roll call | the Helm: the command chair fights, and the seat is empty |
| Waits on | meridian (lightly) | **cast**, **hell**, D18 crew count | **hell**, **meridian**, D18 |

**Cost per interior kind:**
- terrain band, 20-40 lines;
- 14-16 cells at 20-40 lines each;
- core-lock dressing;
- ship-pool midbosses come from the shared pool.

### 5.3 How interior stages end: the core lock (resolves a disagreement)

The game-designer proposed a timed core lock; the world-builder proposed a creature boss per interior. This spec combines them: **one shared core-lock system with per-interior dressing.**

- **How it plays.** Break the shielded core before a 1500 f fuse runs out (the same `PHASE_F` rule and HUD fuse). If you don't, it seals: the stage grades C and pays nothing.
- **Why.** It is Gradius's Big Core, it reuses `phaseClock`, and it gives each descent a non-creature climax between the two creature bosses.
- **What each interior adds.** The Battery, Muster and Helm differ in dressing, plate layout and one attack set, not in a new system each.
- Matt can ask for full creature bosses instead (Q6), at about 3 extra bosses.

## 6. Midbosses

### 6.1 Skill tags

Each midboss tests one skill. The level-designer's four "verbs" map onto the systems-designer's eight tags, and this spec uses the tags.

| Tag | Skill tested | Verb |
|---|---|---|
| LINE | Read an aimed or locked line, sidestep at the lock | AIMED |
| SPACE | Keep moving through area or lobbed fire | AREA |
| RANGE | Hold the right distance; it punishes getting close | MOVER |
| CROWD | Choose targets among its adds | SUMMONER |
| WINDOW | Damage only while it is exposed, and the exposure is itself dangerous | — |
| ANGLE | Hittable only from one side (above, below or behind) while under fire | — |
| RACE | It gets stronger the longer it lives; a fast kill pays more | — |
| DRIFT | It doesn't hold the scroll, so you fight it over moving terrain while the filler is eaten | — |

**Pool rule:** every member of a pool has a different tag, so a stage's two midbosses always test two different skills.

### 6.2 Roster

**Status key:**
- **E**: exists today.
- **W1**: wave 1, needed first.
- **W2**: wave 2.
- **NB**: arrives with a new biome.

"Body" N means new art and hitbox. Every name is a working title.

| Pool | Midboss | Tag | Mechanic (short) | Base HP | Status |
|---|---|---|---|---|---|
| **Ice** | THE NAIL CHOIR | LINE | Glare, then spike fan; nailbars throw 3-fans | 80 + bars | E (fix the per-frame `e.bars.filter`, `update.ts:383`) |
| | Cryosleeper | WINDOW | Takes ×0.15 in its ice block; after a freezing cone (44 f telegraph) it is thawed for 90 f | 110 | W1 |
| | The Hanging Spine | ANGLE | Ceiling body; only the 10 px underside eye can be hit; drops icicle columns with a 40 px safe gap | 95 | W1 |
| | The Calving Shelf | DRIFT | Rides the ceiling; calves slabs that narrow the cave by 24 px for 120 f | 100 | W2 (needs the `G.eat` filler skip in biome scripts, and a stage-relative forced exit per §3.2) |
| **Acid** | THE DISSOLVING WOMB | SPACE | Bubbles, then geyser lobs; or swells, then a ring | 135 | E |
| | The Reclaimer | WINDOW | The lid opens for 80 f with a 60° sweep; the core can only be hit then | 120 | W1 |
| | The Floater | ANGLE | Armoured front ×0.2; only its back and top above the lake take damage | 100 | W1 |
| | The Solvent | RACE | The lake rises 10 px every 360 f (5 steps max), with +10% fire per rise; resets on death or exit | 90 | W2 |
| **Fire** | THE BUTCHER'S APPRENTICE | RANGE | Sweep cone, then a cleaver lunge; ember fans | 150 | E |
| | The Kindling | CROWD | Throws burning bodies (max 6 alive, tagged `kid`); a dead body leaves a 60 f fire patch | 110 | W1 |
| | The Spit | LINE | Two rotating flame jets, .012 rad/f (.018 in phase 2), 44 f ignition telegraph | 120 | W1 |
| | The Kiln Door | WINDOW | The door opens for 70 f with a 3-lane fire wall (one safe lane); the core can only be hit then | 130 | W2 (reuses the `SET kiln` art) |
| **Snot** | THE BROOD MOTHER | CROWD | Heaves, then a litter (alive cap lowered from **10 to 8**); volleys of globs | 105 | E |
| | The Sniffer | SPACE | Inhales for 120 f, pulling 0.35 px/f, then a sneeze fan | 110 | W1 |
| | The Polyp | ANGLE | Face ×0.2; the sac on its back ×1; slip behind it through the strands | 100 | W1 |
| | The Catarrh | RACE | Every 240 f alive it grows, adds a glob and cools down faster (6 steps max) | 85 | W2 |
| **Orbit** | THE SQUIDFUCKED SAUCER | DRIFT | Existing; slot A; guaranteed in Descent 1 | 80 | E |
| | Derelict tug | ANGLE | Armoured nose; engines hittable from behind | ~100 | W1 (first new midboss: gives Orbit its slot B) |
| | Tethered crewman | LINE | Pendulum swing that shows its arc | ~95 | W1 |
| **Ship pool** (interiors and the Drive approach; per-descent exclusion) | Escape shuttle that never left | WINDOW | — | ~110 | W1 (with the first interior) |
| | Hull crawler | RANGE | — | ~110 | W1 (with the first interior) |
| | the Galley | CROWD | The food dispenser feeds crew to you | ~110 | W2 |
| | Bunk Stack | SPACE | Berths that open | ~100 | W2 |
| **Keel** | Ribcage | WINDOW | Bars shot open first (the nailbar pattern) | ~110 | NB |
| | Marrow Sow | SPACE | Lobs globs (a variant of the cyst lob) | ~110 | NB |
| | Gnawer | RANGE | Chews toward you along a rib | ~100 | NB |
| | 4th member | (LINE / ANGLE) | to be designed | — | NB, W2 |
| **Loom** | The Ganglion | — | **Rejected as proposed:** "a reflex volley on every hit" punishes always-on touch fire. Needs a redesign, e.g. a timed reflex on a 44 f pulse | — | NB |
| | The Operator | LINE | A crewwoman fused to a switchboard, plugging tethers across the screen | ~110 | NB |
| | The Twitch | RANGE | Moves only while being shot. On touch it is always moving, which is acceptable | ~100 | NB |

- **Coolant Loop and Scrubbers pools** (the Clot, the Valve, Tapeworm; Iron Lung, Bellows, the Smoker) stay in the concept backlog with those biomes.
- **Counts:**
  - Wave 1 is 8 biome midbosses + 2 Orbit + 2 ship = **12**.
  - Wave 2 is 4 biome + 2 ship = **6**.
  - Each new biome adds 3-4.
- **HP and time to kill.** Base HP is anchored to measured stage-1 DPS (Womb ≈ 10.7 HP/s, Apprentice ≈ 14.4, Choir ≈ 8.3, Brood ≈ 7.4). The targets are 8-11 s for slot A and 10-15 s for slot B, measured with `midboss-probe`. There is no per-slot HP multiplier: D1 says HP comes only from depth.

### 6.3 Selection rules (`pickMids`)

**When it runs:** at stage build time (inside `choose()` for biomes, in `buildStage()` for the others). It draws from the per-stage build stream `Rs`, never from settings or device state.

**Steps:**
1. **Descent gate:** keep members with `min ≤ L`. ANGLE and RACE members are `min: 1`, so Descent 1 shows only LINE, SPACE, RANGE, CROWD, WINDOW and the Saucer.
2. **Never repeat within a descent:** exclude every kind **and every body** in `G.mbUsed`. That set covers the whole descent and is reset in `startLoop`. A recolour or crossover shares its parent's body for this rule.
3. **Avoid repeating a pair:** exclude this biome's previous pair (`G.mbLast[b]`).
4. **Weight across runs:** weight what is left by `1 / (1 + $.meta.mb[k])`, so midbosses never met come first.
5. **Draw slot A, then slot B,** with B's tag different from A's.
6. **Fallback:** if fewer than 2 candidates are left, relax step 3, then step 1. **Never relax step 2** (Pillar 4: a repeat counts as a bug).

**State:**
- Picks live in `G.mb`, not in `G.remix`. `G.remix` already mixes key types (`biomes.ts:242`, `music.ts:149`) and is split as part of the layout refactor.
- `$.meta.mb = {kind: timesMet}` needs explicit load code in `save.ts:41-57` and a save `v` bump.
- If seeded runs (D10) ever become a goal, seeded mode must ignore `meta.mb`. When the `meta.mb` weighting is first added, the picker takes an `ignoreMeta` flag as a **no-op hook** (always false today), so D10 never forces a picker change.

**What this gives:**
- With pools of 4, the first 2 visits to a biome in a run share no midboss.
- Across runs, every pool member is met within about 2 runs per biome.

**Before the new midbosses exist (phase 1 of the build).** Each biome stage **prefers** its home midboss plus one **crossover** (one of the other three existing biome midbosses), chosen by the rules above.
- With body exclusion, a descent meets all 4 existing midbosses, in varying pairings and order. That gives Matt two different midbosses per biome stage straight away.
- **The home midboss is not guaranteed.** When biome A's crossover is biome B's home midboss (about 1 route in 3), body exclusion removes it, and biome B gets **two crossovers**. F0's test asserts this case (two different bodies, neither repeated) rather than a home midboss in every stage.
- The crossover bodies have to work outside their home biome (cyst's lake y, prentice's fire sparks) and take the host biome's tint.
- Open Orbit has only the Saucer until the derelict tug lands. The Drive approach has no midboss until the ship pool exists.

### 6.4 Clocks, scaling and pay

**Leave clocks** (`spawn.ts:321`, 1400 f today for every midboss):

| Midboss | Leave clock |
|---|---|
| Slot A | **1080 f** |
| Slot B | **1260 f** |
| RACE members | 900 f |
| DRIFT members | Whichever comes first: the slot clock, or the stage-relative **forced-exit x** (≥ 300 px before the next WARNING, §3.2) |

Escaping still costs nothing.

**Depth scaling** (no new HP terms):
- HP rises only through `DEPTH.mid` with per-kind `DEPTH.w` shares: WINDOW and ANGLE .6, RACE .5, others 1.
- Idle cooldowns go through `cdm()`.
- **Telegraph lengths never shrink with depth.**

**Phase 2 threshold** (HP fraction where phase 2 starts):

| Descent | Threshold |
|---|---|
| 1-2 | 50% |
| 3 | 65% |
| 4+ | 80% |

On a repeat visit to the biome, the threshold rises one more step and the opening attack switches to the alternate one. From Descent 3, each midboss gets one extra move (wave 2 work).

**Pods:**
- 2 per kill, as today.
- RACE members drop +1 if killed before their first escalation step.
- DRIFT members pay out as they break up, as the Saucer does.

**First kill of each kind ever:** +100 biomass, once, recorded in `meta.mb`. It pays biomass, not power, so it fits Pillar 3.

**GLUTTONY thresholds** (`mutations.ts:76-82`, counts Maw and midboss kills): `n: [2, 4]` today. They live **per layout entry** (§7): `long4` **`[3, 6]`** (about 5 midbosses per descent in LS1), `long5` **`[3, 7]`** (about 9).

**No elite midbosses** (unchanged).

### 6.5 The Maw appearing three times in a descent (Pillar 4)

- The Maw body can already appear three times in one descent: as the Orbit boss, the acid boss and the snot boss.
- **Interim default:** `openFork` never offers acid and snot in the same descent. It is a few lines and needs no art.
- This is revisited when **cast** and D11 are answered. Under "one parasite", Maw recurrence is the point, and the pillar test gets an explicit exemption instead.

## 7. Economy, seals, grades and XP

Each knob sits in the layout entry or a typed table, so the short layout keeps today's values exactly. `long4` is what LS1 ships and is tested against; `long5` is the D19 target and the LS3-0 exit. `long4` values marked *start* are starting points that item G tunes until the target band is met.

| Knob | Today (`short`) | `long4` (LS1) | `long5` (LS3) | Why |
|---|---|---|---|---|
| Seals `SEAL_AT` (`stages.ts:19`) | `{2:1, 4:2, 6:3}` | **`{2:1, 4:2, 6:3}`** (today's) | **`{1:1, 3:2, 5:3}`** | `long5`: seals break at about 1.5, 5.5 and 9.5 min (after the Orbit Maw, the interior and the Drive), so "EVERYTHING UNSEALED" means "Descent 2 starts fully unsealed"; update `SEAL_TXT`, the HUD (`hud.ts:101`) and `stages.test.ts` at LS3-0. `long4`: `{1,3,5}` would break after Orbit, biome B and Descent 2's Orbit, which matches no rationale, so LS1 keeps today's schedule (seals at about 3.3, 8 and 11.5 min) and no seal copy changes in LS1 |
| Grade points (`stages.ts:47-55`) | `kill%×100 − 10×hits − 30×deaths` | `kill%×100 − 10×hits×(35/Ts) − 30×deaths`, where Ts is the stage's scroll seconds | same | Without this, grades collapse on 1.75× the exposure. Deaths stay absolute because they are rare |
| S grade | pts ≥ 70, 0 hits | pts ≥ 70, **≤ 1 hit**, 0 deaths | same | A two-minute no-hit stage is a different ask. Q9 |
| Grade pay | per stage | unchanged per stage | unchanged per stage | 5 stages make it +25% per descent |
| Kill biomass | ×1 | `PAY.killBio = 0.75` (*start*) | `PAY.killBio = 0.6` | Holds purchases per Infirmary visit at 2-4 items. Targets for both: D1 1.3-1.5k, D2 2.1-2.4k, D3 2.6-3.6k (one fewer long stage needs a smaller cut) |
| Stage XP (`perks.ts:48`) | `30 + 45×stage + 40×loop` | today's lump; per-kill XP ×0.75 (*start*) | `40 + 35×ord + 40×loop`; per-kill XP ×0.75 | `long4`: LV 13±1 at the end of Descent 1. `long5`: LV 4 after stage 1, LV 8 after stage 2, LV 14±1 at the end of Descent 1 (12 today) |
| Depth within a descent | per descent only | `dep = loop + 0.35 × ord/(N−1)`, N = 4 | same, N = 5 | Long descents would otherwise leave late Descent 1 soft. Fed to `depthHP`, `cdm` and `firem` for regular enemies and midbosses. The Drive's loop term is unchanged; Orbit stays at 1 in Descent 1 |
| Elites | 0 in Descent 1 | none (unchanged) | optional: .05 from Descent 1 stage 4 | Teaches elites before Descent 2 |
| Lives | from `hull` only | unchanged | **+1 ship per Drive kill, capped at 5** | Exposure per descent doubles at `long5`. Q11 |
| GLUTTONY (§6.4) | `[2, 4]` | `[3, 6]` | `[3, 7]` | Scales with Maw + midbosses per descent |
| Best grades (`stages.ts:68-71`) | key = `stageLabel()` | key by kind | key by kind | See below |

**Best grades.** Today the key is `stageLabel()` = `` `${loop+1}-${stage+1}` `` (`stages.ts:31`), both parts 1-based: Orbit is `N-1`, the biome slots `N-2`/`N-3`, the Drive `N-4`.
- New keys come from a separate `gradeKey()` (by stage kind, loop part kept 1-based): `1-orbit`, `1-ice`, `1-skin`, `1-drive`. `stageLabel()` is left alone, because it still feeds the "STAGE 1-1" banner and `tally.id`.
- Save v3 migration: **`N-1` → `N-orbit`, `N-4` → `N-drive`; drop `N-2` and `N-3`** (the biome on that route is unknown). Pinned in `save.test.ts` with a real v2 blob.
- This lands with LS1 for every layout entry (the short layout writes the same kind keys after v3), because grades by stage kind are needed as soon as stage kinds are rearranged.

**Brief wording to update once Matt confirms:**
- the Core loop "Run" line: "break seals on stages 2, 4 and 6" becomes "break seals on your 1st, 3rd and 5th clear" (at `long5`; it is unchanged while `long4` keeps today's schedule);
- "Who it's for": "phone-playable";
- Pillar 4 (§13).

## 8. Difficulty curve

**Across a descent.** Targets are would-be hits per minute for the invincible bot, **keyed by stage kind and biome slot, not by ordinal**, so the same table serves `long4` (which simply has no Interior column) and `long5`. They all sit inside the existing 1-2 band (pacing §3.9) and the M3 0.9-1.4 band for Descent 1-2 medians. Each layout entry stores its own row set; the values below are the default for both long entries.

| | Orbit | Biome slot 0 | Interior (`long5` only) | Biome slot 1 | Drive |
|---|---|---|---|---|---|
| D1 | .5 | .8 | .8 | 1.1 | 1.3 |
| D2 | 1.0 | 1.3 | 1.2 | 1.6 | 1.8 |
| D3 | 1.3 | 1.6 | 1.5 | 1.9 | 2.0 |

- Under `long4`, intra-descent depth (N = 4) puts biome slot 1 a little higher than it would be at ordinal 3 of 5. The ±30% exit band absorbs this; if not, G sets a `long4` row of its own rather than bending the `long5` targets.
- In LS1, Orbit has no slot B and the Drive no midboss, so their hits/min are measured but held to the band only from LS2-orbit / LS2-ship.

**Within a stage.** The curve is a sawtooth: intro → build → breath 1 + midboss A → gimmick → breath 2 + midboss B → peak → boss.

**Levers, in order of preference:**
1. Intra-descent depth (§7).
2. `eliteChance` (from Descent 2, +.04 per descent, capped at .34).
3. Midboss phase-2 thresholds (§6.4).
4. M3's rank-shaped patterns (pressure.ts).

HP never rises with power (D1).

## 9. Phone playability requirements (no longer session-fit, still required)

**Input:**
- **No mechanic may punish shooting.** Touch fire is always on (`input.ts:65`). So: no reflectors, no "hold fire to stay safe", no hits that heal an enemy.
- Every mechanic must work with only movement and always-on fire.

**Readability:**
- Telegraphs: at least 36 f for aimed and locked attacks, at least 44 f for sweeps and areas, and at least 3 game px thick.
- Telegraph lengths do not shrink with depth.
- Stage cards, WARNING titles and log lines pass the string-fit check (`wrapTxt` drops lines past 4).
- *If round-2 cast = all-crew:* suit markers are at least 10×6 px (round-2 rule; not applicable otherwise).
- *If round-2 gore = pop-then-stain:* a per-stage stain-coverage cap, checked on the Fold, because a stain layer now builds over a ~3× longer stage.

**Forces:**
- A pull or push on the ship is at most 0.4 px/f, against a naked ship speed of 1.25 px/f.
- Scroll speed changes (Coolant Loop) are capped at 1.5 px/f, with no rear spawns during a surge.

**Reference device.** The Fold is the **provisional** reference device, **pending D15**. `performance.enforce` is not set on it until D15 is settled; until then Fold readings are recorded and compared, not enforced against an absolute budget.

**Frame rate:**
- Each midboss gets a `perf-probe` scene of "midboss + 8 incoming", with a p95 target of ≤ 16.7 ms at 4× throttle and `WARM_MS=20000`.
- Brood plus 8 measures 22 ms today. So **CROWD alive caps (6-8) and filler suppression while `G.mini` is up are design rules that land before the perf gate** (build plan P0/F, a precondition of item K), not a fallback after a failed reading.
- No new per-frame allocations, and no `R()` in render code.
- **The default may not flip to long on a filed bug.** An S2 perf bug is acceptable only while the long layout is behind the flag. Flipping the default needs a Fold reading on the long-layout scenes (two midboss warm-ups per stage, peak density with elites, per-route warm-up) showing **no regression against the short-layout Fold baseline and no cold hitch over 100 ms inside a WARNING**. The absolute 16.7 ms enforcement stays with D15/M6, since the frame budget is not yet set.

**Warm-up and memory:**
- Move from warming everything at boot (`main.ts:72`) to **warming per route**:
  - at boot: hero, the Orbit pool and the Drive;
  - at `choose()` or stage build, inside the fork and tally window: the picked midboss pair and the boss;
  - at stage clear: drop the previous stage's caches.
- Proposed budget: 64 MB peak of canvas cache, to be measured on the Fold (pending D15).

**Thermal:**
- A 20-minute soak on the Fold (pending D15) with p95 drift tracked, using `/soak-test`.

**Resume:** §4. The app-kill path is native-only today (`App.addListener('pause')`, `main.ts:107`), and the APK loads with no query string, so long-layout and resume testing on the phone needs the in-app layout toggle (build plan item D2), not `?layout=long`.

**Download size:**
- New places use a `BIOME_MIX` filter variant (0 bytes) by default.
- A new track is about 2-4 MB against today's 38 MB. That is decided by the **sound** answer and the M6 music-load item.

## 10. Freshness on repeat runs (summary)

**Levers, cheapest first:**
1. The midboss pair, with cross-run memory.
2. The set-piece draw: 5 per biome, 3 per stage, drawn without replacement per run (level-designer catalogue).
3. The movement-B variant.
4. Remix crossovers and elites (existing).
5. Log pools: 6 lines per biome, 3 per stage, drawn without replacement per run. Writer work, which waits on **type** and **arc**.
6. Interior and Orbit cells.
7. The interior rotation.

**Measurement:** extend `playtest.mjs`'s "shared with last visit" report to a cross-run comparison.

**Targets:**
- Two consecutive runs share at most 50% of wave signatures per stage.
- No midboss pair repeats within 3 runs.
- Zero repeated bodies within a descent.

## 11. What waits on art direction round 2

| Question | What it decides here | What does not wait on it |
|---|---|---|
| **meridian** | What new biomes and interiors *are* (rooms, organs, meat spreading). Whether interiors reuse `drawInterior`/`metalPat` or need organ art (about 0 vs 3-5 art days each). The look of the terrain-gimmick props. Whether the core lock is a machine or a heart. Whether the two-reading device (§5) stands (moot under rooms-on-ship). The look of "the corridor" (the Drive approach), which the interiors share. **Hell-bleeding invalidates all 4 biome concepts.** The Pump vs Furnace "heart" collision | Stage table, terrain shapes, gap rules |
| **cast** | Identity, names and kill words of every new midboss and boss. Whether recolours are legitimate. Whether Maw recurrence is a feature (§6.5). The Crew Deck stage. The Loom's comms hook. The Scrubber boss's collision with the all-crew snot-Maw redesign. **The crew readings of the ship-pool midbosses** (the Galley feeding crew to you; the tethered crewman) **and of the Orbit tug** (is anyone aboard?). The suit-marker rule (§9, all-crew only). Crew in the corridor | Tags, picker, clocks, HP |
| **idiom** | Art route per midboss: bitmap strips (the Saucer route) or procedural (`midbosses.ts`). That sets about half the per-midboss cost. Photo tissue tile vs pure-code biome, and whether collidable terrain counts as "front" (under back-real-front-pixel, foreground tissue is pixel art and photo sources go to far layers only). **The colour lock** (lime enemy bullets, pale-blue player fire, one blood red, one UI red): every biome colour in §5.1 is provisional until it is set | Mechanics |
| **arc** | What fills the breaths and the extra length. How gross Descent 1 midbosses may be. Whether interiors darken by descent. **Whether interiors are the cold stretch** (§5.2: per-descent yes; per-run only in Descent 1; flat-max or ship-driven no) and the §5.1 Lean row | Breath placement and length |
| **hell** | The Bridge viewscreen. Whether each biome needs a "seen wrong" frame. Where glimpses sit in a 10-minute descent. (`hellFlash` is re-keyed from the stale `AMT` bands to stage kind either way, neutrally) | Re-keying `hellFlash` |
| **sound** | A track, filter variant or drone layer per new place; the 38 MB load | — |
| **gore** | Stain look over 100 s stages; under pop-then-stain, a per-stage stain-coverage cap checked on the Fold (§9); contrast on red walls | Decal caps (already pruned by scroll) |
| **type** | Stage cards, WARNING banners, core-lock banner, logs | String-fit rule |
| **ship** | Hull growth pacing against LV 14 at the end of Descent 1 (`long5`; LV 13 under `long4`) | Structure |

## 12. Questions only Matt can answer (recommended default in bold)

1. **What does "90-120 s" count?** **Wall time, stage card to tally, fights included (~60 s of scroll).** The alternative, scroll only, roughly doubles authored content.
2. **What does D19's "mid-stage checkpoint" mean?** (§4) (a) **A resume point only**: death respawns in place as today, an app kill or quit resumes at the last checkpoint, and the app-kill rewind is accepted (optional mitigation: a dirty flag that costs 1 life if the app restarts before the next checkpoint). (b) **A Gradius checkpoint**: losing a life restarts you at CP0/CP1, and the brief's "drops checkpoint restarts" line is edited. Both use the same restore code; only the trigger differs. **Recommended: (a)**, with (b) flyable behind a dev toggle at the LS1 playtest so you can decide by feel.
3. **Stages per descent?** **5 (Orbit, biome, interior, biome, Drive), about 10 min.** Alternatively 6 or 7 from Descent 3.
4. **Descent 1 Open Orbit:** **a fixed 15 s teaching opener, then varied across runs**, or fully fixed?
5. **Do recolours or attack-set variants count as different midbosses?** **Across runs and biomes yes; within a descent they share their parent's body and are excluded.**
6. **How do interior stages end?** **A shared timed core lock with per-interior dressing**, or a creature boss per interior (about 3 more bosses).
7. **Drive approach midbosses?** **One.** This reads D19's "two per long stage" as satisfied by the Drive stage's approach midboss plus the Drive fight itself: the approach counts as part of the boss stage. It keeps the Drive's 30-45 s window. Alternatives: two (the stage runs ~120-135 s), or none (the systems-designer's proposal; ~80-95 s).
8. **The Maw three times in a descent?** **The fork never offers acid and snot together until cast/D11 is answered.**
9. **S grade?** **≤ 1 hit, no deaths, length-normalised penalty**, or keep no-hit S.
10. **Seals?** **`{1, 3, 5}` clears at 5 stages (`long5`)**, or keep `{2, 4, 6}` for a slower power curve. The 4-stage LS1 build keeps `{2, 4, 6}` either way.
11. **Extra lives?** **+1 ship per Drive kill, capped at 5**, or none.
12. **Biomass pacing?** **Hold purchases per Infirmary visit (kill bio ×0.6)**, or hold bio per minute (which buys out the Infirmary in about 2.5 descents).
13. **New biomes:** **Keel first, measure, then the Loom.** The Coolant Loop and Scrubbers stay in the backlog. Or a different pick.
14. **Midboss pool size before the long stages become the default?** **The phase 1 crossover rule now; 3 per pool in wave 1; 4 in wave 2.**
15. **Descent 1 holds back ANGLE and RACE midbosses?** **Yes.**
16. **Interior order:** **random per run without replacement (Bridge from Descent 2)**, or the fixed Crew Deck / Skin / Bridge order.
17. **When do long stages reach friends?** **Behind a flag until Matt has played them (and M1/M2), then they become the default.** On the web the flag is `?layout=long`; on the APK it is a persisted in-app LAB toggle (build plan D2), because the APK loads with no query string.
18. **Is v1.0 the long-stage game?** **Yes: v1.0 = long stages + midboss wave 1 + the Skin interior. New biomes go to v1.1 unless Matt wants them in v1.0.**
19. **Old best grades:** **migrate Orbit (`N-1`) and Drive (`N-4`), drop the two biome-slot keys (`N-2`, `N-3`).**
20. **Flip to long stages with one Orbit midboss?** At the end of LS1, Open Orbit still has only the Saucer and the Drive approach none. **Recommended: the default waits until LS2-orbit's derelict tug lands** (about 1 week into LS2), so every long stage the public sees meets D19. Alternative: accept one Orbit midboss as an interim and flip at LS1 closeout.

## 13. Proposed Pillar 4 text (for Matt's approval; replaces D19's superseded half)

> **Long, hard, never the same twice.** Classic Gradius-length stages (about 90-120 s: two midbosses and a boss), five-stage descents of about 10 minutes, with forks, remixes, elites and rotating midboss pools. Playable on a phone (touch, readable, holds frame rate, resumes where you left off), but not built around phone sessions. *Test:* repetition is a bug. Meeting the same midboss, boss body or authored section twice in one descent is a regression, and Descents 1-3 of a run never repeat a biome, an interior or a section variant.

Matching edits:
- Concept: "four-stage descents ... 4-6 minutes" becomes "five-stage descents of about 10 minutes".
- Core loop, Stage: "intro, build, breath + midboss, gimmick, breath + midboss, peak, boss (or core lock)".
- Protected core: "five-stage descent with biome forks, two midbosses per stage from rotating pools, timed bosses".

## 14. Disagreements between proposals

### Resolved

| Topic | Positions | Resolution |
|---|---|---|
| Scroll per stage | LD ~3400 spawn span (≈3900 total); GD and WB 3600(-4200); TD 3600-4800 (4200/4800 in its table) | **3600 px** (2700 for the Drive). It lands the median at about 109 s. TD's lengths give 12-16 min descents and exceed 120 s |
| Descent time | 9-11 min (LD, GD, WB) vs 12-16 (TD) | ~9.5-11 min, a consequence of 3600 px |
| Breath positions | .31/.66, .30/.58, .30/.62, .33/.66 | .30-.36 and .62-.68 (SD), held in a table |
| Leave clocks | LD 1100/1400; GD unchanged; SD 1080/1260 | SD's values |
| Slot-A HP ×0.8 | LD yes; SD no | No: D1 says HP comes only from depth. Time to kill is tuned per kind |
| Pool size | 3 (GD, WB) vs 4 (LD, SD) | 4 is the target, 3 ships first |
| Taxonomy | LD verbs vs SD tags | SD tags (they cover the verbs) |
| Variant counting | LD/TD "different" vs SD/GD "same body" | Different across runs, same body within a descent |
| Interior authoring | LD cells; GD generator; TD/WB pickV sections × 3 | Generator + tagged cells (LD and GD combined) |
| Interior end | GD core lock; WB creature bosses | Core lock with per-interior dressing (Q6) |
| Interior order | GD random; WB fixed | Random without replacement, Bridge from Descent 2 (Q16) |
| Number of new biomes | LD/GD 2; WB 4 + reserve | 2, one at a time; the other 2 stay as concept backlog |
| Drive approach midbosses | SD none; others 1 | 1 (Q7) |
| Orbit midbosses | GD/SD Saucer + 1 held; LD drift + held | Saucer (slot A) + held from the Orbit pool |
| Phase 1 second midboss | GD crossover; TD one variant per biome; LD variant as slot 1 | GD crossover first (no new art); variants come in wave 1 |
| Maw triple | GD fork rule; LD/TD defer to D11; TD "palette swaps count as different" | GD fork rule, interim |
| Grade normalisation | GD 35/Ts; TD 60/Ts | GD: it keeps today's points scale at 35 s |
| Best-grade keys | GD by kind (`L-ice`); TD by slot (`L-biome0`) | By kind: the slot is not a place |
| RNG | TD: fold the M2 render split into per-stage build streams so there is one re-baseline | Kept as two re-baselines, each explained (the render split is already an M2 item and runs in parallel). Simpler to review |
| Warm-up | Today: everything at boot | Per route (TD) |
| Loom Ganglion | WB "punishes spray fire" | Rejected by the touch rule; to be redesigned |
| Scrubbers draft | WB 0.6 px/f | Capped at 0.4 (SD force rule) |

### Still open (needs Matt or data)

- **The Coolant Loop's speed gimmick.** It is the most Gradius-like idea, but it breaks the 60 px = 1 s unit and adds touch risk. Parked behind Q13.
- **Whether 2 midbosses + a boss per stage feels like too many fights.** This is measured at the first long-stage playtest. The fallback is slot A on a 50% roll in Descent 1 biome stages.
- **The Scrubber boss vs round-2 all-crew's lung-filter Maw.** This resolves with **cast**.
- **The Pump vs the Furnace as the "heart".** This resolves with **meridian**.
- **The 64 MB canvas budget.** It is unmeasured until the Fold reading exists.

## Review log

Revision 2 (2026-11-01) applies every blocking change from the director reviews below, plus the cheap non-blocking ones. Revision 1 is kept beside this file as `content-expansion.pre-r2.md`.

| Reviewer | Verdict | Item | How it was addressed |
|---|---|---|---|
| creative-director | BLOCK | 1. LS1 (4 stages) measured against 5-stage targets | §2.2 now has three layout entries (`short`, `long4`, `long5`), each with its own seals, XP, kill-bio, GLUTTONY and hits/min. §7 has `long4`/`long5` columns; §8 is keyed by stage kind. §1 restates `long4` at ~7.5-8.5 min. Plan G and the LS1 exit test `long4` |
| | | 2. Default flips while Orbit has one midboss | Plan M waits for LS2-orbit's tug or Matt's explicit interim OK (new Q20, LS1 checklist). §3.4 explains why the Drive stage gets one midboss (the approach is part of the boss stage), put to Matt in Q7 |
| | | 3. DRIFT midboss can collide with slot B | §3.2 rewritten: forced-exit x ≥ 300 px before the next WARNING (layout invariant in `layout.test.ts`, §2.2) plus a `G.mini` defer guard; §6.4 leave-clock row; Calving Shelf note; plan F tests the DRIFT case |
| | | 4. Resume rebuild not exact | §4 stores `bx`, restores with the stored `bx[seg]`; states elite and spawn-time rolls are not reproduced; plan H says "same script x and kind list" |
| | | 5. Best-grade keys wrong | §7 "Best grades": `N-1`→orbit, `N-4`→drive, drop `N-2`/`N-3`; separate `gradeKey()`; real v2 blob in `save.test.ts` (plan H0) |
| | | 6. Checkpoint settled by reinterpretation | §4 and Q2 now present (a) resume point vs (b) Gradius restart neutrally, same rebuild path, different trigger; (a) recommended; Q2 added to the LS1 playtest checklist |
| | | Small: keel tile, Lean row, two readings, perf precondition, GLUTTONY per layout | All applied (plan LS4-keel-b; §5.1; §5 intro; §9 and plan K; §6.4) |
| technical-director | BLOCK | 1. Harness can't prove the refactor (3600 frames never leave Orbit) | Plan §0 and rows A, C, B2 add a full-descent short-layout parity check (`tools/layout-parity.mjs`) on fixed seeds |
| | | 2. Resume can't rebuild biome terrain | §4 allowlist adds `bx` (all three); restore re-applies `rewriteTerrain` with the stored x; H0's round-trip test covers a late and an early fork |
| | | 3. LS1 economy exits assume 5 stages | Same fix as CD 1 (`long4` entry; §8 by kind; `long5` values become the LS3-0 exit) |
| | | 4. Default flip without a Fold frame-rate reading | §9 and plan K/M: S2 bugs allowed only behind the flag; M needs a Fold reading with no regression vs the short baseline and no >100 ms cold hitch in a WARNING; absolute 16.7 ms stays with D15/M6 |
| | | Advisory: production run seed, "same filler", rename THE HULL, cast row, LS1 goal wording, `src/enemies/ufo.ts`, seeded no-op hook | All applied (§4 and plan B2; plan H; renamed to THE SKIN; §11 cast row; plan §2 goal; plan row A; §6.3) |
| qa-lead | BLOCK | 1. Phase 1 not playable or resume-testable on the Fold APK | New plan item D2: persisted in-app LAB toggle (layout, `mids=wip`, checkpoint trigger) shown on the title screen; L, H and the LS1 checklist use it; LS2's `?mids=wip` too; §9 and Q17 note it |
| | | 2. Best-grade keys wrong | Same fix as CD 5, with 1-based loop keys and `stageLabel()` kept for the banner and `tally.id` |
| | | 3. Breath-2 rule wrong for DRIFT | Same fix as CD 3 |
| | | 4. LS1 bands assume LS2 midbosses | §3.4 and the LS1 exit: Orbit 75-90 s and Drive 80-95 s in LS1; 85-100 / 90-110 s move to the LS2-orbit / LS2-ship exits; goal says "every biome stage" |
| | | Advisory: home+crossover not guaranteed, seal rationale on 4 stages, "Fold, pending D15", arc dependency, K's "or a filed S2 bug" | All applied (§6.3 and F0 test; `long4` keeps `{2,4,6}`; §9; §5.2 and §11 arc row; plan K/M) |
| art-director | APPROVE (4 required edits) | 1. Suit markers unconditional | §9 now conditional on cast = all-crew; §11 cast row |
| | | 2. "Cold stretch under any arc answer" | §5.2 replaced with the per-arc statement; §5.1 Lean row marked pending arc; §11 arc row |
| | | 3. `tex-keel.png` (RODA marrow) presumes photo tile | Plan LS4-keel-b reworded per the idiom rule; RODA is a back-layer candidate only |
| | | 4. Biome colours fixed | §5.1 colours marked provisional until the colour lock, with the Loom and Coolant clashes named; every LS4-a/b row gets a contrast acceptance line |
| | | Recommended a-d: name "the corridor", LS1 Orbit/Drive bands, gore stain cap, Crew Deck flashes OFF | All applied (§3.4, §5.2, §11; LS1 bands; §9 and §11 gore; plan LS3-crew) |
