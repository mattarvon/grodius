# Grodius

Gradius-style horizontal shooter with an Event Horizon aesthetic. A rescue tug descends into the derelict MERIDIAN in Neptune orbit and fights its way to the gravity drive.

Vite + TypeScript web game, wrapped as an Android app with Capacitor. The last single-file version is tagged `v0-singlefile`.

## Play it
- **Android (Galaxy Fold 7):** every push to `main` builds an APK and publishes it to the [latest release](https://github.com/mattarvon/grodius/releases/tag/latest). Open that page on the phone, tap `grodius.apk`, allow installs from your browser once.
- **Browser:** https://mattarvon.github.io/grodius/ (same build, deployed on every push).

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
Every kill feeds a mutation tied to that enemy type. Hit a threshold and a graft pod (a fleshy sac with an eye) grows where the enemy died: grab it to take the mutation. You can carry 3 gun grafts; a 4th sheds your oldest (the pod tells you which). Each mutation has 2 levels (CALIBER 3). Dying withers every graft one level. Progress shows on the pause screen.

| Kill | Mutation | Effect |
|---|---|---|
| Drones | SWARM CADENCE | faster fire |
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
- WRAITH caps at 3. Damage stacking is deliberately small (Infirmary +10%/level, FLAYED EDGE +15%, CALIBER +10%).
- Rank: the more powered up you are, the faster enemy bullets fly and the more often mini-bosses fire.

## Mini-bosses
The scroll stops until they die.
- THE MAW: ends the open-orbit section (and returns inside).
- THE CRUCIFER: end of the hull. A flayed body crucified upside down; its heart sits behind 4 nail barriers you have to shoot through (Big Core homage). Spike fans, hand rings; below half HP a blood spiral and glob rain.
- THE BUTCHER: inside, before the gate. Hangs on chains; telegraphed cleaver sweep (red wedge), thrown meathook (dashed line), gib spit. Below half HP it snaps a chain and swings, adding ring bursts.

## Progression: earn your guns
- **Fragments:** a pod is one fragment of its upgrade. Higher levels cost more fragments (THRUST 1,1,2,2,3; MISSILE 1,2; ARC 2; PYRE 2,3; WRAITH 2,3,4; WARD 1,2,3). Pod labels and the bottom bar show progress (e.g. `WRAITH 1/2`).
- **Seals:** each upgrade has a ceiling that rises only when you kill a mini-boss. Seal 0 allows THRUST 2, MISSILE I, SPLIT, WRAITH I, WARD Membrane; ARC and PYRE start sealed. Each mini-boss breaks a seal and unlocks the next tier, plus another gun graft slot (1, 2, 3). Locked slots show a padlock.
- **Mini-boss reward:** breaking a seal spawns 3 gold-ringed pods. Each is a full level, take one and the others burst.
- Pods are scarcer (about 28 per loop, down from 48) and only about a third of glowing carriers drop one.
