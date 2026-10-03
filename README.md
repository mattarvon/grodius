# Grodius

Gradius-style horizontal shooter with an Event Horizon aesthetic. A rescue tug descends into the derelict MERIDIAN in Neptune orbit and fights its way to the gravity drive.

Single self-contained file: open `index.html` in a browser. No build step.

## Controls
- Move: arrows / WASD
- Fire: Z / Space (hold)
- Power up: fly into a pod
- Pause: P / Esc, Mute: M
- Gamepad: A fire, Start pause
- Touch: drag to fly, auto-fire

## Power pods
Every pod is labeled and color-coded with the upgrade it gives. Fly into it to take it instantly, or dodge it to skip. Pods favor upgrades you are missing, and pods for something you already maxed pay out score and biomass. The bottom bar shows your level in each.

THRUST, MISSILE (ground-hugging, splash), SPLIT, ARC, PYRE (exploding flaming eyeballs, sets enemies on fire), WRAITH (options), WARD (shield)

## Notes
- Meta progression (biomass and Infirmary grafts) persists in localStorage under `grodius.v1`.
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
