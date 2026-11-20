# THE KEEPSAKE as the title hero (2026-11-20)

*Art department, branch `kboss-forks`. Matt saw the mock-up ("love the baby doll head on the title and love the
animation idea"). The decision-log entry is left for the merge, because the combat team is writing D59 there.*

## What changed
- **The hero switch.** `src/titlelayout.ts` `TITLE_HERO` is the one switch. It is set to `'doll'` now; `'rot'` brings ROT back.
- **ROT is kept, not drawn.** Its modules and sprites (`heroeye.ts`, `titlegaze.ts`, `rot_*`, ROT's half of the keep-out
  zones and the test) are all still in the repo. Matt hasn't said where ROT goes next. The mock-up review suggested a
  game-over card, the Infirmary, or a rare swap after the first kill of THE KEEPSAKE.
- **The head is a real title-resolution bake.** `tools/prep_keepsake_title.py` bakes it from Matt's doll photos on the
  boss's own work canvas, with the Walker & Hall photo fork. The layers live in `src/sprites/title/doll_*.png` and `doll.json`:
  - halo, face, eye half / shut / open, and the wound with the fork at 0, 3, 6 and 9 boss px of rise;
  - 3.5 device px per title px, 9 layers, 516 KB.
- **How it's drawn.** `src/render/titledoll.ts` draws it like ROT, at device resolution through the eye queue. The halo
  goes on the low-res canvas, under the drips and the text. The drips are the title's own world drops, off the jaw and the
  tear tracks.
- **Idle doze.** `src/render/titledoze.ts` holds it, as a pure function of `$.T`:
  - it rests half-lidded and is never open at rest;
  - every 5-18 s the lids clack shut for 45-110 frames, with a 1 px dip, or the eyes flutter.

## DESCEND timing
The run starts on the press, exactly as before: no sim frame waits, and the harness and the Enter-driven rigs fly unchanged.

`menus.ts` `startRun` calls a DOM-free hook. That hook (`titledoll.ts` `armTitleOut`) keeps the last title frame on screen,
and it is drawn over the run's first 30 frames:

| Frames | What happens |
|---|---|
| 0 | the eyes snap open |
| 3, 6, 9 | the fork jerks up out of the wound, one step each |
| to 14 | the frame holds |
| 14-30 | it fades off the run, as one flattened layer |

The DESCEND voice line plays from the press, as it always did.

## Checks
- **Shots.** In `assets-raw/title-review/after/` (git-ignored):
  - desktop at DK 3 and the Fold cover screen at DK 4;
  - idle half and shut;
  - DESCEND at frames 1, 7, 12, 22 and 32.
- **Perf.** `title-perf-probe` (Fold cover, DK 4, 4x throttle): JS p50 / p95 is 2.3 / 3.1 ms with the doll and 2.5 / 3.3 ms with ROT.
- **Keep-out.** ROT's circle and rope rect become the doll's ellipse and a thin fork rect. The easter egg's rails are
  unchanged and stay clear; `titleblood.test.ts` passes.

## Left to do
- Log the decision at merge.
- Choose ROT's next home.
- `tools/title-shots.mjs` still names its crops after ROT's gaze moments. It runs clean, but its "eye" crops are now of the doll.
- The doll draws nothing for the few frames before its layers load at boot (ROT waited for its sprites the same way).
