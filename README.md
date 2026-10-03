# Grodius

Gradius-style horizontal shooter with an Event Horizon aesthetic. A rescue tug descends into the derelict MERIDIAN in Neptune orbit and fights its way to the gravity drive.

Single self-contained file: open `index.html` in a browser. No build step.

## Controls
- Move: arrows / WASD
- Fire: Z / Space (hold)
- Power up: X / Shift
- Pause: P / Esc, Mute: M
- Gamepad: A fire, B power, Start pause
- Touch: drag to fly, auto-fire, tap POWER

## Power meter
THRUST, MISSILE (ground-hugging, splash), SPLIT, ARC, PYRE (exploding flaming eyeballs, sets enemies on fire), WRAITH (options), WARD (shield)

## Notes
- Meta progression (biomass and Infirmary grafts) persists in localStorage under `grodius.v1`.
- Enemy fire is toxic green and drawn above all gore so it stays dodgeable.

## Your vessel
The ship is a living thing. Power-ups grow new parts mid-run: egg-sac missile pods, a dorsal horn cannon (SPLIT), a crackling nerve spine (ARC), burning eye stalks (PYRE), chitin plating (WARD), and longer sinew tendrils (THRUST). Permanent Infirmary grafts mutate it further: more bone spikes, extra eyes, swept horns, iris color shifts, and at full mutation it bleeds. The Infirmary shows a live preview.

Eyeballs are pre-rendered textures with veins, fibrous irises and wet highlights, drawn on a high-res layer over the pixel-art world.
