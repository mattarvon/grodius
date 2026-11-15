// The acid vats' dead fade out while THE DISSOLVING WOMB is up and back after it dies (D46, Matt's call b: a vat skull over the
// placenta read as the boss's head). Pure and DOM-free so tests/unit/tankfade.test.ts can drive it; render/biomeart.ts owns
// the one live state. Render only: it eases on the frame counter, never on the sim RNG.
/** frames to fade out once the Womb is up, and back in once it is gone */
export const TANK_FADE = { out: 40, back: 90 };
export interface TankFade { vis: number; t: number }
export const tankFadeNew = (): TankFade => ({ vis: 1, t: -1 });
/** advance to frame T (womb: the Womb is alive) and return the bodies' alpha, eased. A T that goes backwards (a new run, a
 *  rig jumping the clock) restarts the clock without a jump; a step of more than 4 frames counts as 4 (a stall never snaps it) */
export function tankFadeStep(s: TankFade, T: number, womb: boolean): number {
  const dt = s.t < 0 || T < s.t ? 0 : Math.min(4, T - s.t);
  s.t = T;
  s.vis = womb ? Math.max(0, s.vis - dt / TANK_FADE.out) : Math.min(1, s.vis + dt / TANK_FADE.back);
  return s.vis * s.vis * (3 - 2 * s.vis);
}
