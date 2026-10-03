# Grodius

Gradius-style horizontal shooter with an Event Horizon aesthetic. A rescue tug descends into the derelict MERIDIAN in Neptune orbit and fights its way to the gravity drive.

Vite + TypeScript web game, wrapped as an Android app with Capacitor. The last single-file version lives on the `legacy-singlefile` branch.

## Play it
- **Android (Galaxy Fold 7):** every push to `main` builds an APK and publishes it to the [latest release](https://github.com/mattarvon/grodius/releases/tag/latest). Open that page on the phone, tap `grodius.apk`, allow installs from your browser once.
- **Browser:** https://mattarvon.github.io/grodius/ (same build, deployed on every push).

## Notes
- `CHANGELOG.md` is the running history (newest first). It and this README are mirrored into the Obsidian vault (`Projects\Grodius\Mirrors\`) after every push via `tools/vault_mirror.py` / `Sync-Vault.ps1`; local commits and pulls trigger it through a git hook.

## Develop
```
npm install
npm run dev          # http://localhost:5173, also on your LAN for testing on the phone
npm run build        # -> dist/
npm run android      # build + copy into the Android project (open android/ in Android Studio to run locally)
```
`tools/harness.mjs <url> [frames]` runs a seeded, fixed-clock playthrough and prints game state plus rendered frame hashes. Run it before and after a refactor: identical output means identical behavior.

## Code layout
- `src/core.ts` constants, canvases, math, palette; `src/state.ts` the few globals reassigned across modules (`$.G`, `$.P`, `$.state`, ...)
- simulation: `world` `flow` `step` `player` `shots` `mutations` `enemies/` `boss/` `fx/` `menus` `save` `audio` `input`
- drawing: `src/render/*`
- `src/platform.ts` Android glue (haptics, native text-to-speech for voice lines); lifecycle (pause on background, back button, keep screen awake) in `src/main.ts`
- Type checking is off per file (`// @ts-nocheck`) after the split; remove it module by module while typing.

## Android notes
- Fullscreen immersive, draws under the camera cutout, keeps the screen awake while open.
- Fold inner screen: the game pins to the top and the space underneath is a thumb zone. Drag anywhere on screen to fly; your thumb never has to cover the ship.
- Haptics on big kills, shield hits and death. Hardware back pauses / goes back in menus / exits from the title.
- **Stable signing (recommended):** without it each APK is signed with a throwaway key, so you must uninstall before installing a new build (and lose saves). To fix, create a keystore once (`keytool -genkeypair -keystore grodius.keystore -alias grodius -keyalg RSA -keysize 2048 -validity 10000`) and add repo secrets `GRODIUS_KEYSTORE_B64` (base64 of the file), `GRODIUS_KEYSTORE_PASSWORD`, `GRODIUS_KEY_ALIAS`, `GRODIUS_KEY_PASSWORD`. Keep the keystore out of the repo.

## Controls
- Move: arrows / WASD
- Fire: Z / Space (hold)
- Power up: fly into a pod
- Pause: P / Esc, Mute: M
- Gamepad: A fire, Start pause
- Touch: drag anywhere to fly (relative, like a trackpad), auto-fire

## Power pods
Every pod is labeled and color-coded with the upgrade it gives. Fly into it to take it instantly, or dodge it to skip. Pods favor upgrades you are missing, and pods for something you already maxed pay out score and biomass. The bottom bar shows your level in each.

THRUST, MISSILE (ground-hugging, splash), SPLIT, ARC, PYRE (exploding flaming eyeballs, sets enemies on fire), WRAITH (options), WARD (shield)

## Notes
- Meta progression (biomass and Infirmary grafts) persists in localStorage under `grodius.v1` (app-private storage on Android).
- Enemy fire is toxic green and drawn above all gore so it stays dodgeable.

## Your vessel
The ship is a living thing. Power-ups grow new parts mid-run: egg-sac missile pods, a dorsal horn cannon (SPLIT), a crackling nerve spine (ARC), burning eye stalks (PYRE), chitin plating (WARD), and longer sinew tendrils (THRUST). Permanent Infirmary grafts mutate it further: more bone spikes, extra eyes, swept horns, iris color shifts, and at full mutation it bleeds. The Infirmary shows a live preview.

Eyeballs are pre-rendered textures with veins, fibrous irises and wet highlights, drawn on a high-res layer over the pixel-art world.

## Mutations: you become what you kill
Every kill feeds a mutation tied to that enemy type. Hit a threshold and a graft pod (a fleshy sac with an eye) grows where the enemy died: grab it to take the mutation. You can carry 3 gun grafts; a 4th sheds your oldest (the pod tells you which). Each mutation has 2 levels (CALIBER 3). Thresholds are steep (e.g. BONE NEEDLES at 15 / 48 corpses, CALIBER at 120 / 400 / 800 kills): a graft is a trophy. Dying withers every graft one level. Progress shows on the pause screen.

| Kill | Mutation | Effect |
|---|---|---|
| Drones (36 / 150) | SWARM CADENCE | faster fire |
| Corpses | BONE NEEDLES | shots pierce |
| Eye turrets | OPTIC LOCK | shots home in |
| Crawlers | REAR MANDIBLE | tail guns |
| Crosses | HALO RIPPLE | shots widen into rings |
| Hooks | MEATHOOK ARC | hits arc to nearby enemies |
| Flayers | FLAYED EDGE | +30% damage per level |
| Maws | GLUTTONY | critical hits |
| Any (total) | CALIBER | bigger, harder rounds |
| Wombs | REGROWTH | shield membrane regrows |
| Hatchlings | SPORE COAT | shield hits burst shots back |

WARD stacks: MEMBRANE (absorbs hits), MIRROR (absorbed bullets fire back), BONE AEGIS (front plate that eats frontal fire and regrows).

Enemies that come from behind are telegraphed with a BEHIND warning, enter in the lane away from you, and are harmless until fully materialized.

## Balance (Gradius rules)
- Main gun is exclusive: SPLIT or ARC. Sub-weapon is exclusive: MISSILE or PYRE.
- WRAITH caps at 3. Damage stacking is deliberately small (FLAYED EDGE +15%, CALIBER +10%).
- Rank: the more powered up you are, the faster enemy bullets fly and the more often mini-bosses fire.

## Mini-bosses
The scroll stops until they die.
- THE MAW: ends the open-orbit section (and returns inside).
- THE CRUCIFER: end of the hull. A flayed body crucified upside down; its heart sits behind 4 nail barriers you have to shoot through (Big Core homage). Spike fans, hand rings; below half HP a blood spiral and glob rain.
- THE BUTCHER: inside, before the gate. Hangs on chains; telegraphed cleaver sweep (red wedge), thrown meathook (dashed line), gib spit. Below half HP it snaps a chain and swings, adding ring bursts.

## Progression: earn your guns
- **Stages.** Each descent is 4 stages: OPEN ORBIT (ends on THE MAW), THE HULL (THE CRUCIFER), THE CORRIDORS (THE BUTCHER; a second Maw mid-stage only coughs up pods), THE GRAVITY DRIVE. Each opens with a stage card.
- **Stage clear tally:** kills (% of everything that spawned), hits taken, deaths, best chain, time, and a grade S/A/B/C. S needs no hits. The grade pays score (x descent) and biomass; no-hit adds PERFECT. Your best grade per stage is saved. If the Maw escapes, the stage ends on a C with no reward.
- **Seals** break on the 2nd, 4th and 6th stage cleared in a run: end of the Hull, end of Descent 1, Descent 2 Hull. Full power is a Descent 2 thing.
- **Stage-boss reward:** 3 gold-ringed pods, each a full level, take one and the others burst.
- **Fragments:** a pod is one fragment of its upgrade; higher levels cost more (THRUST 1,1,2,2,3; MISSILE 1,2; ARC 2; PYRE 2,3; WRAITH 2,3,4; WARD 1,2,3).
- **Death:** you keep half your THRUST. Guns, wraiths, WARD and fragment progress are gone, and every graft withers a level.
- **WARD** soaks 3 hits. REGROWTH graft: 1 hit back every 20s at level 1, up to 2 every 12s at level 2.
- **Rank:** the more powered up you are, the faster enemy bullets fly, the more HP enemies have (up to +80%, minis +40%) and the bigger the formations (up to +3).

## Infirmary (between runs)
Buys options and comfort, never raw power: REINFORCED HULL (+1 ship, max 2), HARVEST GLAND (+25% biomass), AMPOULE LURE (pods drift to you), BLACK BOX (your guns burst out as pods when you die), DESCEND DEEPER (start at Descent 2), FLESH SCULPT (cosmetic mutation). Saves from before this change get their biomass refunded for the removed upgrades.

## Sound
- Kill sounds, explosions and death come from sample folders under `src/sfx/<category>/`: `splat_s` (drones, hatchlings), `splat_m`, `splat_l` (heavies, minis), `thud` (body-impact layer under medium and big splats), `bone` (layered on half of the bigger kills), `silly` (comedy layer on ~1 in 7 kills), `explode_s` (missiles), `explode_l` (mini-boss/boss deaths, your death). Every play picks a random clip (never the same twice in a row) with pitch and volume jitter.
- `kenney-*.ogg` are from Kenney's Impact Sounds (CC0, kenney.nl).
- The `gen-*.ogg` files are synthesized by `python3 tools/gen_sfx.py` (original, no license strings). Drop any `.ogg/.wav/.mp3` into a folder and it joins the rotation on the next build. Use CC0/public-domain files only while the repo is public.
- Hype man voice lines: `src/sfx/hype<N>/` holds a recorded line for the N-kill chain (hype10 is Matty's "hell yeah"); missing milestones fall back to text-to-speech.
- Anything not covered by a sample (shots, pickups, alarms, UI) is still synthesized live in `src/audio.ts`.
