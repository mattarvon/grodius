# Changelog

Newest first. Every push to `main` builds a fresh APK ([latest release](https://github.com/mattarvon/grodius/releases/tag/latest)) and redeploys https://mattarvon.github.io/grodius/.

## 2026-10-31 (bug fixes, regression gate)

- Picking one capsule from a choice row no longer applies its power twice or deletes an unrelated capsule on screen.
- The Nail Choir's nail bars fire again at high power (their wind-up was being reset before it finished).
- The Womb's hatchlings no longer drag down the stage's kill % and grade, matching the Brood Mother's litter.
- When exactly one biome is left unvisited, the fork always offers it.
- `npm run test:regress` is now a real gate: it starts its own server, compares the run against `tools/harness.baseline.json`, and fails on any difference.

## 2026-10-30 (deeper descents fight back, less repetition)

A bot playtest (`tools/playtest.mjs`: three descents, spends in the Infirmary, logs kill speed, would-be hits and repeats) showed the ship outgrowing everything by Descent 2 and half of every descent replaying the same script. Three parallel agents fixed it; tuning knobs are in `src/depth.ts`, `src/biomes.ts` and `src/enemies/elite.ts`.

### Bosses stop melting
- Power keeps counting past the rank cap (bolted contraptions included), and from Descent 2 enemy and boss HP grows with depth and with that excess. Descent 1 is unchanged.
- Bot times, Descent 2-3: midbosses 10-16 s and biome bosses 12-19 s (were 2-6 s), the Saucer 10-15 s (was 3 s), the Gravity Drive 24-39 s.
- From Descent 2 enemies fire faster (+45% per descent); from Descent 3 wall eyes fire 3 shots and security drones 5-round bursts, and death shots bracket you. No telegraph got shorter.

### Every descent plays differently
- Open Orbit and the Gravity Drive approach have 3-4 hand-made variants per section (debris fields, ambushes from behind, security-drone pickets, a hull breach, mutants leading the corridor). Descent 1 keeps the classic script; later descents never replay one you've seen.
- Drones are about a third of Open Orbit and about a quarter of biome spawns (were 50-80%). Mutants show up 5-12 times per Cryovault or Furnace stage, slimes 13-23 times per Sinus stage.
- A biome you've visited before plays remixed: a different signature enemy and set pieces, two creatures borrowed from other biomes, a filtered version of its music, and elites.

### Elites (Descent 2+)
- 10-34% of biome spawns: a violet aura and throbbing pustules, 1.8x HP, faster fire, and a pustule that swells and spits an aimed glob. They pay 2.5x biomass and burst violet.

### The Infirmary lasts
- Contraption levels and sockets cost more; buying everything takes about 5-6 descents instead of 3. The first contraption is still free.

### Checked
Three-descent playtests on two seeds; would-be hits about 1 per minute overall for a bot that never dodges (were 0.2); route-probe clean on two routes; harness deterministic (new baseline: score 3028, scroll 2168).

## 2026-10-28 (sprite upgrade)

Twenty OpenGameArt picks (found with `tools/sprite-scout.mjs`, placed slot by slot in the `tools/upgrade-picker.mjs` page) cut, repainted toward the game's palette and wired in by seven parallel agents. Credits in CREDITS.md and on the title screen.

### Enemies get real art
- **Swarm drones are wasps**, sick yellow-green with a bloodshot eye and venom dripping off the sting.
- **Hatchlings are loose eyeballs** swimming on their torn optic nerves.
- **Drifting corpses are frozen zombie crew** (cop, civilian, zombie): four variants, still dismembered and still pleading.
- **Wall eye turrets are tentacle starfish** half-buried in the rock, the eye tracking you and going amber when it charges.
- **Wall crawlers are earwigs**, wet red-brown, mandibles gaping before they spit.
- **Ceiling wombs are toothed flesh sacs** that split open to birth hatchlings, the same species as the eye turrets.

### New enemies
- **Snot slime** (the Sinus): oozes along floor and ceiling, rears up and lobs snot, lunges if you fly over.
- **Hulking mutant** (Cryovault and Furnace floors): a 40 px crewman-hulk that tears off meat and throws it, then gets torn in half. 26 HP, the tankiest regular enemy.
- **MERIDIAN security drone** (Open Orbit and the drive corridor): the derelict's own defences. It locks a dashed aim line on you, blinks, then fires a burst down it, and bleeds blood-oil when killed.

### New midboss: THE SQUIDFUCKED SAUCER
- A wrecked saucer gone to meat, halfway through Open Orbit. It whips a tentacle along a line it aims first, bursts tumours into glob fans, and drops hatchling litters from a puckered belly hatch; below half HP it adds a bullet ring. It dies splitting in two in a flood of tentacles: CALAMARI SERVED.
- 80 HP, so a fresh run can kill it (13 s naked, 8 s with a stage-1 kit). It drifts with the scroll instead of holding it, and the Open Orbit filler is skipped while it's up, so the stage keeps its length. It pays out in pods as it breaks up.

### Effects, world, screens
- **Hit sparks** per biome: blood, ice, fire, plus teal acid and yellow snot versions.
- **Explosions**: Tyrian fireballs in sick bloody fire under the gibs, sized to what died.
- **Eyes** use a real iris photo, tinted per eye, some with cat, frog or fish pupils. Built at idle, never mid-fight.
- **Triton**, an eclipsed moon, hangs beside Neptune in Open Orbit.
- **MERIDIAN corridors** show brass panels, vents and pipes with flesh growing over them.
- **Ice biome** gets crystal pillars with frozen-blood veins.
- **Hype voices** each get a diseased alien face in a glitchy CRT comms window, jaw flapping. The corpse plea gets an eyeless dead crewman.
- **Game over**: a blood-red horned demon chews and drools over your score.
- **Infirmary**: a HUMANFLESH / EAT HERE poster with stuttering neon.

### Checked
Two full descents on two fork routes with no errors or slams; midboss kill times in line; performance unchanged after the idle warm-up (`tools/perf-probe.mjs` now takes `WARM_MS=20000` to measure that way). The harness baseline moved because of the new enemies and the midboss (new: score 2869, scroll 2168) and stays deterministic.

## 2026-10-25 (voices, no crosses)

### Less hype, rarer pleading
- **The boss-kill line is just "the keister for Easter, baby" now** (2.25 s). The "touch me where it smells funny" tail and the laugh after it are cut, located with a Whisper transcription. The full original is kept in `assets-raw/voice/` (not in the repo).
- **Hype voices have a 20 s cooldown.** With a strong build the chain milestones fire constantly, and SGT. SLAB plus the surfer flyby saturated the mix. The chain word (MESSY, GRISLY, VISCERAL...) and its splat still show on every milestone; only the voiced call waits (`HYPE_CD` in `src/fx/update.ts`).
- **"Stop killing me" plays on every 5th crew corpse** you shoot instead of every one.

### THE FROZEN CRUCIFER is now THE BLOATED BITCH
- The ice biome boss is renamed on its HP bar, its WARNING banner and the fork gate tag (FROZEN // BLOATED BITCH). Internally it is still `crux`.

### No upside-down crosses
They looked cool but read as a religious symbol. Everything that was one is now meat-locker or bone imagery:
- **The crucified-crew enemy** is a carcass on a butcher's gambrel: a side post with a bar across the top, hung by the ankles on meat hooks, arms dangling and dripping. Same hitbox.
- **The Frozen Crucifer** hangs on a braced frozen rack (the post stops at the bar, with gallows-style diagonal braces) instead of an inverted cross.
- **Decor:** the inverted-cross silhouettes (title, Gravity Drive chamber, derelict skyline, terrain markers) are hanging spinal columns (`hangSpine` in `src/render/util.ts`). The corridor's cross-shaped lights are round portholes, and the figures hung in the corridor have their arms hanging down instead of spread on a bar.
- Gameplay unchanged (`harness` identical).

## 2026-10-25 (performance)

### Smooth again on big monitors and weak GPUs
- **Where the time went.** Measured in Chrome on the rig: the game's own code costs about 1.5 ms per frame even in the busiest boss fights. The slowdowns were all GPU and compositor work: a 2400x1350 display canvas on big monitors, a full-screen CRT scanline layer using `mix-blend-mode: multiply`, and one-off art builds when a boss arrives (the Gravity Drive froze for about 213 ms, the Crucifer for 12 ms).
- **Display canvas capped at 4x** (it was up to 5x). The playfield is still drawn at 480x270; only eyes and close-ups use the extra resolution, and they look the same. **Auto quality:** if frames average slower than about 52 fps for 2 s of play, the display canvas drops one notch (down to 2x). `?dk=N` pins it for testing.
- **CRT scanlines without blend mode:** black stripes look the same with normal blending and cost much less to composite.
- **No more boss-arrival hitches:** the Maw, midboss, Crucifer/Butcher and Gravity Drive art is pre-built one piece at a time in idle slots after boot.
- Result on the rig's integrated GPU (the one Chrome was using): every boss fight and the title hold the display's 165 Hz (6.1 ms frames). Before, they ran 10–12 ms with 18–42 ms spikes.
- **Perf meter:** add `?perf` to the URL for a readout of FPS, slow-frame share and per-phase ms (step / world / fx / hud / present); `window.__perf()` returns the numbers. `tools/perf-probe.mjs` measures the same scenes headless with CPU throttling (`prof` adds a profiler breakdown).
- Checked: `harness` state identical (twice), route-probe clean.

## 2026-10-25 (gross-out pass: six parallel branches)

Grodius is Gross Gradius. Every boss got a gross-out pass, and the sky and terrain are now real science imagery. All of it is visual and audio only: hitboxes, HP, attacks and timing are unchanged (`harness` state identical, `boss-probe` / `midboss-probe` kill times unchanged within run-to-run noise). Each new file has a `GROSS` knob at the top (1 = full, 0 = off or close to the original) so any of it can be dialed back. All new randomness is render-only, so seeded runs don't shift.

### Bosses
- **The Maw family** (`src/render/gross/maw.ts`): rotting gangrenous bodies, boils that swell, burst into pus and grow back, a split stomach seam with bile sloshing around a skull, 13 rotten teeth, a drooling ulcerous tongue, a retch-then-vomit-jet telegraph, a farting back sphincter, wounds that open and fill with maggots, a rotten gash with an exposed rib at half HP, and a sludge-wave death after which the skin deflates with a fart. The Dissolved Maw shows skull and ribs and a glowing acid stomach; the Mucus Maw is snot-glazed with popping nostril bubbles.
- **The Frozen Crucifer** (`gross/biomebosses.ts`): a flayed, frostbitten carcass with gangrene fingers, bile icicles, frozen vomit and a snot runner. Its own skin is nailed to the nail bars and snaps when they break. The frosted heart leaks blood slush and bursts out of the chest when the last bar goes; it shatters into ice and meat on death.
- **The Burning Butcher**: an obese roasting carcass with bubbling fat, man-boobs and triple chins, an offal apron, sizzling sausage-link guts, a cleaver caked in rotten meat with flies, and projectile-vomited burnt chunks. When the chain snaps at half HP the belly bursts open.
- **The midbosses** (`gross/midbosses.ts`):
  - Nail Choir: gargling, drooling frostbitten mouths, pus icicles, and a severed tongue nailed to each nail.
  - Dissolving Womb: veined membrane, bile digesting a twitching fetus, popping acid blisters.
  - Butcher's Apprentice: popping fat blisters, maggots, an offal loincloth, and it cries with a snot bubble.
  - Brood Mother: visible larvae, booger-crusted nostrils, giant pre-sneeze snot bubbles, and a gushing birth.
- **The Gravity Drive** (`gross/drive.ts`): a giant diseased heart-organ beating faster each phase, with bile pumping through pipe-arteries, five crew faces stretched over the plating that scream, haemorrhoid-ringed vents that fart, exhaust ports that vomit, and intestine tentacles with sucker-mouths. Phase 0 plates are pus pressure gauges whose glass cracks; the eye is sewn shut. In phase 1 it opens into a jaundiced, cataracted eye that weeps pus. It rots more as HP drops. On death the eye bursts, then the whole thing ruptures into a rain of bile, meat and eyeballs and the carcass deflates.
- **New sounds** (all synthesized, `tools/gen_gross_sfx.py`, `gen_bossgross_sfx.py`, `gen_drive_sfx.py`): gross_pop, gross_gargle, gross_slosh, gross_gush, gsizzle, gicecrack, drivegut, driveretch, driveburst. Matty's farts now come out of the Maw and the Gravity Drive.

### Real imagery from the Registry of Open Data on AWS
- **Skies** (`tools/roda_sky.py`, public-domain JWST data from `mast-jwst`): Descent 2 is Carina's Cosmic Cliffs graded bruise and blood (also the title backdrop), Descent 3 is the Tarantula Nebula graded flesh-pink, and Descent 4+ cycle. Cassiopeia A, graded raw meat and bile, breathes in Open Orbit as a "wound". The Flickr Milky Way is gone. Webb's Neptune is toned down so it doesn't blow out.
- **Tissue terrain** (`tools/roda_textures.py`, all CC0): a CAMELYON16 cancer-pathology slide and iNaturalist slime moulds and jelly fungi become 128 px tiles. The derelict's walls are meat, ice is frozen fat cells, acid is dog-vomit slime mould, fire is charred witches' butter with embers, and snot is pus beads in yellow mucus.

### Tools
- Screenshot look-books: `tools/maw-shots.mjs`, `biomeboss-shots.mjs`, `drive-shots.mjs`.
- Probe gotcha: restart vite before trusting `boss-probe` / `midboss-probe` numbers. After hot reloads the probe imports different module copies than the game, and every fight reads "esc".

## 2026-10-25

### Real sounds, more music, real space
- **Openverse scout** (`tools/openverse.mjs`): searches the Openverse API for CC0 / CC BY / public-domain sounds, music and images, builds a picker page, downloads the picks and writes their credit rows. `tools/import_openverse.py` turns them into game assets.
- **Sound effects:** 79 one-shots cut from Freesound recordings at their transients and level-matched to each bank: wet meat and squelching flesh in the splat banks, frozen-tissue cracks in `bone`, real explosions in `explode_l`. New banks:
  - `monster`: real growls and shrieks under every roar (boss arrivals, big kills, the Choir of Mouths)
  - `snot`: Sinus kills squish
  - `warning`: recorded sirens under every WARNING banner (midbosses, biome bosses, the Gravity Drive, GRAVITY WELL CRITICAL)
  - `stinger`: scary strings when a midboss or the Maw is coming
  - `forkopen`: a glitchy loading blip when the ship splits
- **Music per descent:** Descent 1 is unchanged. From Descent 2, Open Orbit plays Circuit Synthwave, then Doctor Dreamchip, then Synthwave Electropop; the Gravity Drive approach rotates Circuit Synthwave Alt and Space Wind. New slots: THE MAW fight (Cyberpunk Beat / Cyberpunk Snippet, through the stage card), the fork (a dark drone loop), game over (Horror Ambience 16), and the Infirmary alternates Heist with DX7 SynthWave Chords. Music went from about 28 MB to 38 MB.
- **Real space:** Open Orbit's sky in Descent 1 is a real **JWST deep field**: a cutout of the JADES GOODS-S NIRCam mosaics (F444W/F200W/F090W), found through the Registry of Open Data on AWS and read straight out of the 11 GB FITS files with S3 range requests (`tools/jades_backdrop.py`). Descent 2+ get the Milky Way's core. Neptune is Voyager 2's photo in Descent 1 and Webb's ringed infrared Neptune deeper down. The Perseus cluster's "x-ray skull" (NASA Chandra) breathes in the Gravity Drive's well; x-ray films hang in the Infirmary.
- Title credits updated; every CC BY source is in CREDITS.md.
- Checked: `harness` gameplay state identical to before (only frame hashes changed); `route-probe` over two descents plays every music slot as mapped, no errors.

## 2026-10-16 (branch `stage-scripts`)

### A real run-up to the Gravity Drive
- The approach to the final boss used to last about 6 s, so the approach music barely started before the fight track took over. It now lasts about **17 s** (16.5–17.6 s over 5 seeds).
- The level is 600 px longer: the boss now sits at 9300 instead of 8700. After the second biome, the derelict's own corridor comes back, and the Gravity Drive chamber opens up just before the fight.
- The approach is a short scripted gauntlet that gets harder as it goes: a sine wave and drifting crew, then two divers from opposite sides, wall eyes, a wave from behind, zig drones with a flayer, a wall formation and a flayer pair. Then a red **WARNING: GRAVITY WELL CRITICAL**, and a few seconds of calm before the drive arrives. From Descent 2 on, hatchlings and an extra diver join the late waves.
- The Gravity Drive fight is unchanged: 32.0 s for the bot with an end-of-Descent-1 kit (was 32.2 s).

### Open Orbit gets meaner in Descent 2+
- Stage 0 used to play exactly the same every descent. From Descent 2 on, two of its sine waves become zig waves, a wave comes in from behind between the dives and the wall, and a flayer pair joins the behind wave halfway through.
- Descent 1 is unchanged: same first pod at 5.7 s, and the same seeded runs through stage 1-2.

## 2026-10-16 (branch `biome-midbosses`)

### Every biome has its own midboss
- Halfway through each biome stage, in the quiet "breath" beat, a **WARNING** sounds and the biome's own midboss arrives. It holds the scroll like the Maw. This happens in both biome stages of a descent, so you meet one midboss per biome stage instead of a single generic Maw in the second.
  - **Ice: THE NAIL CHOIR.** A frozen eye in a crust of ice and singing mouths, with two nail barriers circling it that soak up your shots. It glares down frost lines before it throws a spike fan, and the nails glint before each one spits spikes at you. Break both nails and its fans get wider.
  - **Acid: THE DISSOLVING WOMB.** A womb melting in the lake, its child half eaten inside. Its crown bubbles before it geysers a rain of acid globs lobbed onto where you are, and it bloats before it bursts a ring.
  - **Fire: THE BUTCHER'S APPRENTICE.** A scorched little carcass on one chain with a cleaver too big for it. It lunges in behind a red sweep cone, the Butcher's own warning, and you get almost a second to get out of it. Otherwise its mouth glows and it spits ember fans. No hook.
  - **Snot: THE BROOD MOTHER.** A swollen snot sac full of young. It heaves before it births a litter of hatchlings, and its nostrils flare before it sneezes snot globs.
- Each one gets meaner below half health. If you can't kill it, it leaves after about **23 s** at no cost. A fuse above its HP bar shows how long you have. Killing it drops **2 pods**.
- Midbosses count toward GLUTTONY, like the Maws they replace. The Brood Mother's litter doesn't count toward grafts or your stage kill %.
- The small pod formation that used to sit in the first biome's breath is gone, since the midboss takes its place.
- Time to kill with a stage-1 kit is close to the Maw's 13 s: Nail Choir 15.8 s, Dissolving Womb 12.6 s, Apprentice 10.4 s, Brood Mother 14.2 s. New `tools/midboss-probe.mjs` measures this and can screenshot each fight.

## 2026-10-16 (branch `void-soundtrack`)

### New soundtrack: dancramp's *Void*
- All music is now from **Void** by dancramp, 80s-influenced synthwave and cyberpunk, CC BY 4.0. Each slot has its own song:

  | Where | Track |
  |---|---|
  | Title | Title Music for an Imaginary Sci-Fi Platformer |
  | Infirmary / game over | Heist |
  | Open Orbit | Cyber Side Scroller |
  | Ice | Caves |
  | Acid | Institutional Values |
  | Fire | Corporate Identity |
  | Snot | Pods |
  | Gravity Drive approach | We're Not Done Here Yet |
  | Gravity Drive fight | Finale |

- The biomes used to be pitch/filter remixes of the same few tracks. Now they're distinct songs, so the remixing is gentler: no pitch shift, just a light filter and drive per biome.
- Each song's closing fade-out is trimmed and replaced with a 2 s fade so it loops cleanly. All tracks are matched to -16 LUFS.
- The old horror/metal tracks (David KBD, Kenten Fina, Ruskerdax) are no longer bundled. They're still in git history and `assets-raw/`. Music size went from about 10 MB to about 28 MB.
- `route-probe` confirms the right track plays in every slot. Credits are in `CREDITS.md` and on the title screen.

## 2026-10-15 (branch `pacing-pass`)

### Biome stages have a shape
- Biome stages used to spawn at one flat density from start to finish. Now they have beats, based on Taisei's stage timelines (see `docs/pacing.md`):
  - **Intro:** sparse, and the biome's signature enemy (corpse / wall / flayer / hatchling) arrives alone first.
  - **Build:** as before.
  - **Breath:** about 10% of the stage with no spawns. In the first biome it holds one small formation that drops a pod. In the second biome the mid-stage Maw is its centerpiece.
  - **Peak:** tighter spacing and more doubles.
- About the same number of enemies per stage (−2% to −4%), just bunched up: intro ~0.5 spawns/s, peak 1.0–1.7/s.
- New `tools/density-probe.mjs` prints spawn rates per beat for every biome, stage and descent.
- New `tools/pod-probe.mjs`: a seeded bot that plays a whole descent, getting through pick screens, forks and the shop. It reports first-pod time, pods per minute per stage, level and biomass. The older probes stall partway through a descent. Measured over 5 seeds: biome pods per minute 7.7 → 8.5, biomass per descent 1109 → 1122, level at the end of Descent 1 unchanged at 10.2.

### Biome bosses are on the clock
- The Crucifer and the Butcher no longer drag. Each half of the fight (split at 50% HP) gets **25 s** once the boss has settled in. A thin fuse above the boss HP bar counts it down and blinks red for the last 5 s.
- **First half runs out:** the boss lurches into its second half. HP drops to 50%, and the Crucifer's nail barriers shatter ("IT LURCHES ONWARD").
- **Second half runs out:** it retreats like the Maw, so the stage is graded C with no reward ("IT RETREATS").
- The clock pauses while you're dead.
- Strong builds never see a timeout. `boss-probe` kill times with the stage-1, end-of-descent-1 and strong kits are unchanged. With no kit, the Crucifer now falls in 45 s instead of 50 s, and the Butcher retreats instead of taking 67 s.

### Sounds repeat less
- **Shuffle bag:** each sound folder plays every one of its clips once before any of them repeats, and a new round never opens with the clip that just played. Before, picks were plain random with only an immediate repeat blocked.
- **Fresh order every session:** the sound RNG used a fixed seed, so every session opened with the same order of clips. It's now seeded per boot. It's still separate from gameplay randomness, so runs aren't affected.
- To add variety, drop more clips into any `src/sfx/<category>/` folder; they're picked up automatically.

### DESCEND DEEPER pays what it says
- It promised "every stage pays double", but nothing doubled. Now, from Descent 2 on, stage grade biomass and the +30 boss-choice biomass are doubled, and the tally card shows **DEEP x2**.

### Pacing bible
- New `docs/pacing.md`: how Grodius paces itself against Taisei, Gradius, Zanac and Tyrian, with target numbers and the probes that measure them.

## 2026-10-11 (branch `balance-overhaul`)

### The Gravity Drive fights fair
- **Eye laser:** aims while it charges (a widening band that turns white and blinks when the aim locks), then fires in a straight line. It can hit you **once per sweep** (it used to hit every frame, eating a full WARD in one pass and killing on the next). Fires less often (every ~4.2s, ~3.3s angry).
- **Its HP scales with your power rank** (x1 to x1.6), like the biome bosses, so a stacked build still gets a fight.
- **Crits, ORBITING TEETH, IMMOLATION and CORROSIVE SPIT now hurt it** (before, only direct shots and contraptions did).
- **Boss-fight recovery:** die during any boss and you respawn with FULL pods of your main gun, MISSILE/PYRE and a WRAITH in front of you. BLACK BOX still returns everything.
- Biome bosses: power-rank HP scaling +40% -> +100% (strong builds were deleting them in 2-5s). Maw 95 -> 120 HP, Crucifer 170 -> 145, Butcher 250 -> 300.
- Measured with the new `tools/boss-probe.mjs` (ideal bot; real fights run ~2x): end-of-descent-1 kit kills the Gravity Drive in ~32s, a strong kit in ~15s.

### Classic power meter (optional)
- Title / pause menu: **POWER: PODS / METER**. PODS (default) is unchanged.
- METER: drops become orange POWER capsules; each moves the cursor one slot along the bottom bar, POWER buys a full level of the lit slot (X / Shift / K, pad B, on-screen POWER button on touch). Cursor resets on death. Boss choice, salvage, graft and PURGE pods are unchanged. `tools/meter-probe.mjs` compares both modes over stage 1 (comparable power).

### Title eyeball
- Bigger (radius 74 -> 100) and sloppier: lavender/blue sclera under a dense crimson vein crackle, lime iris with a dark rim, cyan glint, wobbling silhouette that jiggles when it darts its gaze, wet sheen, slime strands that stretch and snap (`src/render/heroeye.ts`).
- Fix: the title menu no longer overlaps the help text.

## 2026-10-07

### The ship mutates, upgrades hit hard, contraptions
- **Your ship grows with your build.** Every pod level, graft, contraption and most perks sprout their own part on the hull (bone nozzles, egg-sac missile clusters, twin horn barrels, eye stalks that track enemies, meat hooks, sawtooth fins, a lamprey maw, veins, pustules, a tapeworm...). Parts pop in with a flash, gore spray and a little shake. Overall power grows the hull itself through 4 tiers: TUG, ARMORED, BLOATED, ABOMINATION (about 3x the size at the top; hitbox unchanged), announced as "THE HULL MUTATES". When you die, the grown parts tear off as gibs.
- **Upgrades actually matter now.** An audit found duds: SPLIT added +14%, grafts +10-15% per level (FLAYED EDGE gave half what it said), MISSILE II +14%. Now:
  - SPLIT is a 3-way fan (2.4x base against crowds). MISSILE II fires a twin salvo, reloads faster and blasts wider.
  - Grafts compound per level: CALIBER x1.22 and a bigger round, FLAYED EDGE x1.25, SWARM CADENCE x1.25 fire rate. GLUTTONY crits hit x3.
  - WRAITH gunners deal half damage so the top end doesn't run away. Max loadout against crowds: 22x base before, 46x now.
- **You can see and hear it.** Rounds turn gold then crimson and get longer and heavier as damage rises; muzzle flash, recoil and the shot sound grow with your power tier (bass thump, crack, sub). ARC is a forking beam with exit sparks, missiles are finned rockets with smoke trails and shockwave blasts. Heavy hits knock back and blow blood out the far side; crits pop "CRIT x3". Each pickup calls out what it did ("SPLIT: 3-WAY FAN").
- **Contraptions.** The Infirmary now sells 7 bolt-on machines, each upgradable to level 3, each with real gameplay and visible on the hull:
  - BONE SAW shreds small enemies you ram. GUT CANNON fires a piercing slug every few seconds. LEECH PUMP turns kills into WARD hits. SPINE LAUNCHER fires homing spine volleys. MEAT WINCH harpoons an enemy, rips it open and reels in pods. FURNACE BELLY: more speed and a burning slag trail. CHOIR OF MOUTHS screams at kill chains and wipes nearby enemy bullets.
  - The first contraption is free and bolts on by itself. You start with 1 socket; buy a 2nd (400 bio) and 3rd (900).
- **The Infirmary is rebuilt** as a shop with CONTRAPTIONS / SOCKETS / GRAFTS, a live preview of your ship with the parts animating, a socket diagram, and per-level effects. Works with keys, gamepad, mouse and touch. Old saves load fine.
- HOLLOW HEART's text now mentions GLUTTONY's x3 crits.
- Built with three parallel agents (ship form, weapon impact, contraptions + Infirmary); new probes in `tools/` (ship-probe, dps-probe, gun-shots, rig-probe, rig-fx, shop-probe).

### Start sound
- Hitting DESCEND (or DESCEND DEEPER) on the title plays Lesley's "yeah baby" (recorded on RecForge II) instead of the select fart; the music ducks under it as the stage track fades in. Other title items still fart. Clip in `src/sfx/startgame/`; more takes there rotate at random.

## 2026-10-03

### 20-chain voice swap
- The 20-chain surfer flyby now picks between "sfriend" and "shamalama" (Matty's recordings); "little stinker" is retired. sfriend was trimmed, de-clicked and lightly de-noised (the take has a steady background bed).
- **Fix: voice lines were clipping.** Every recorded line (hell yeah, shamalama, keyster easter, stop killing me) peaked at 127% with hundreds of clipped samples: the loudness step ran at 192 kHz and the downsample after the limiter brought the overs back. All re-processed from the original recordings with the limiter after the resample; peaks now ~0.87, zero clipped. Fart clips re-encoded at 44.1 kHz (were 192 kHz, 4x the size).

### Biomes, branching route, ship XP + perks
- **Branching route.** Each descent: OPEN ORBIT, then a fork (two gates, fly into one, 15s auto-pick), a biome stage, another fork, a second biome, then THE GRAVITY DRIVE. Forks prefer biomes you haven't visited.
- **Four biomes**, each with its own terrain shape, palette, gore colours, background, ambient particles, hazard, enemy mix, set pieces and boss:
  - THE CRYOVAULT (ice): aurora, glacier ridge of frozen crew, crew frozen mid-scream in ice blocks, falling icicles (shake + drop-line warning, shootable). Boss: THE FROZEN CRUCIFER.
  - THE DIGESTION TANKS (acid, teal + sulfur so enemy bullets stay readable): vats of dissolving skeletons, half-eaten hanged crew, acid geysers. Boss: THE DISSOLVED MAW.
  - THE FURNACE (fire): incinerator mouths full of the standing dead, charred bodies swinging on chains, heat shimmer, flame jets from floor and ceiling. Boss: THE BURNING BUTCHER.
  - THE SINUS (snot/pus): veined sinus lining, swelling pus blisters that burst, crew cocooned in snot, snot strands that slow you (shootable). Boss: THE MUCUS MAW.
- **Ship XP + perks.** Kills (and stage clears) give XP; every level the world slows and you pick 1 of 3 mutations. 26 perks incl. trade-offs (GLASS JAW, TAPEWORM) and biome perks unlocked by clearing that biome (FROSTBITE, CORROSIVE SPIT, IMMOLATION, SNOT ROCKET). Perks last the whole run, through deaths. ~LV3 after stage 1, ~LV10-11 by the end of descent 1. Perk power raises enemy difficulty.
- **Biome music remixes** of existing tracks: Cryovault (Tech Rooms amb 01, slowed, high-passed), Digestion Tanks (sped up, swept band-pass wah), Furnace (Eternity, driven + bass shelf), Sinus (slowed, swept low-pass, gloopy).
- Corpses say "stop killing me" (Matty's recording) when killed, one at a time.
- Built with three parallel agents (art, route/hazards/music, XP/perks); verified with new probes in `tools/` (route-probe, hazard-probe, perk-verify, perk-pace, biome-tour).

### Title eyeball
- The title emblem is no longer the Gravity Drive boss (slit-pupil eye in a spiked ring). It's a huge bloodshot eyeball: pale, lumpy sclera with cracked red veins, a round green iris, wet highlight, hanging off a swaying optic nerve that drips. Gaze wanders and darts, blinks every few seconds. Rendered at high resolution (512px sclera texture) on the smooth eye layer.

### Fix: title music and menu farts silent on desktop Chrome
- Chrome blocks audio until a click or key. The title now opens on a blinking PRESS ANY KEY / TAP TO DESCEND gate: the first input only unlocks audio and starts the title music.
- Mouse hover over a menu item plays the cursor fart, clicking plays the select fart (before, mouse clicks skipped the fart path entirely).
- Sound banks now load at startup, so the very first menu move farts instead of beeping. Audio unlocks on the events Chrome actually accepts (click, pointer up, touch end, key).
- Android: the WebView no longer requires a tap before media plays, so title music starts on launch.

### Music
- Title: Bleak Terminal (Ruskerdax). Stage 1: Tech Rooms action 01, Stage 2: action 02 (Kenten Fina). Stage 3: Eternity 01 "The Desolation of a Civilization" (David KBD). Stage 4 approach: Tech Rooms ambient 02, the Gravity Drive fight: Eternity 01. Infirmary / game over: Tech Rooms ambient 03.
- Crossfades between tracks, drops to 35% on pause, ducks under the hype man and boss-kill voice lines, pauses when the app is backgrounded. MUSIC on/off in the title and pause menus (saved).
- All tracks gain-matched to -16 LUFS (flat gain, loops stay seamless). Credits in `CREDITS.md` and on the title screen.
- Raw downloads reorganized into `assets-raw/` (git-ignored) by source.

### Title menu farts
- Title screen: moving the cursor plays a short pfft (`src/sfx/fart_nav/`), selecting plays a full fart (`src/sfx/fart_ok/`). Seeded with Matty's recording in 3 pitches; more takes go in those folders.

### Your voice on the hype man
- 10-kill chain "HELL YEAH BROTHER!" now plays Matty's own recording (RecForge II, trimmed, high-passed, compressed, loudness-normalized) instead of text-to-speech; the splash holds longer to match the 4.4s line.
- 10-chain picks randomly between "hell yeah" and "shamalama"; 20-chain surfer flyby picks between "little stinker" and "shamalama" (replacing the text-to-speech "excellent work, baby"). Splashes hold longer for the recorded lines.
- Beating any stage boss (Maw, Crucifer, Butcher, Gravity Drive) plays Matty's "keyster easter" reward line (`src/sfx/bossreward/`); not when the Maw escapes.
- Matty's fart recording joins the comedy layer in three pitches (original, deep, squeaky).
- Any milestone can be voiced the same way: drop a clip in `src/sfx/hype<N>/` (hype35, hype50, hype75, hype100; the 20-chain surfer uses `babe20/`). Milestones without a clip keep the robot voice.

### Sound: sample banks (`842c59b`, `5d878de`)
- Kills, explosions and deaths play from sample folders (`src/sfx/<category>/`), random pick with pitch/volume jitter, never the same clip twice in a row.
- 78 original synthesized clips (`tools/gen_sfx.py`): wet pops, squelches, heavy bursts with drip tails, bone cracks, a comedy set (raspberries, blorps, gurgles), small and large layered explosions.
- Kenney Impact Sounds (CC0): punches and soft impacts as a `thud` layer under medium/big kills, wood cracks in `bone`, explosion crunches and low booms in the explosion banks, slime in small splats.
- ~1 kill in 7 gets the comedy layer; half of the heavy kills get a bone crack.

### Progression rework (`140c0ac`)
- Each descent is 4 stages with stage cards: Open Orbit (Maw), The Hull (Crucifer), The Corridors (Butcher), The Gravity Drive.
- Stage clear tally: kill %, hits, deaths, best chain, time, grade S/A/B/C. Pays score x descent and biomass; PERFECT bonus for no hits; best grade per stage saved.
- Seals break on the 2nd, 4th and 6th stage cleared, not every mini-boss. Full unseal moved from ~3 minutes to Descent 2.
- WARD soaks 3 hits (was 10); regrowth much slower. Graft thresholds ~3x.
- Death keeps half your THRUST, nothing else. Power rank now adds enemy HP (up to +80%, minis +40%) and bigger formations.
- Infirmary sells options, not power: removed Hollow-Point, Nerve Graft, Second Skin, Bound Wraith (biomass refunded). Black Box drops your guns as recoverable pods. New: Descend Deeper, Flesh Sculpt.

### Android app (`3208210` .. `eb6216e`)
- Split the single 2,000-line file into ~30 Vite + TypeScript modules; proven behavior-identical with a seeded replay harness (`tools/harness.mjs`). Old version on branch `legacy-singlefile`.
- Capacitor Android app: fullscreen, camera cutout, keep-awake, pause on background, back button, haptics, native text-to-speech for voice lines, bundled fonts.
- Galaxy Fold: drag anywhere to fly; on the inner screen the game pins to the top and the space below is a thumb zone.
- GitHub Actions builds the APK on every push and publishes it to the `latest` release; web build to GitHub Pages.

### Gore and readability (`1f2dcc9`)
- Gore cut ~40%: fewer particles, airborne gore clears faster, floating chunks fade back. Floor and ceiling gore keeps its long life.
- Graft pods crawl to a reachable spot instead of dying at the screen edge.
- "GRAFT GROWN" banner moved to a compact top-right strip.

## 2026-10-02
- Initial build through mini-bosses, kill-driven mutations, typed power pods, earned progression, hype man, 20-chain surfer flyby (built in Claude Desktop, single HTML file).
