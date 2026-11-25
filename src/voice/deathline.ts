// SLAB's GRODIUS BITCH (src/sfx/startgame/): his line over the player's death in a late boss fight. Matt, 2026-11-24:
// "change grodius bitch sounds from twice in the beginning, to if you die in a boss battle past a late stage". It used to
// play on the title greeting and again on DESCEND (the folder name `startgame` is historical: kept so the shipped take
// and its references don't churn); the title's moment now belongs to the `title` slot (step.ts).
// Pure: reads $ only, draws no R(); the sample() call in flow.ts killPlayer is audio-only, so the sim never sees it.
import { capCtx } from '../rank';

/** where a run counts as late for the death line. Matt 2026-11-24: "past a late stage". A run is late from the
 *  descent's `stage`-th stage on (0-based within the descent: 0 Open Orbit, 1 the first biome, 2 the second biome, 3
 *  the Gravity Drive; layout.ts stages), or anywhere from descent `loop` on (0-based G.loop: 1 = DESCEND DEEPER's
 *  Descent 2). Retune here */
export const BITCH_LATE = { stage: 2, loop: 1 } as const;
/** seconds after the death the line starts (sample()'s `at`): the explosion's crack and the first of its 1.5 s sweep
 *  go first (audio.ts sfx.die), and he lands on the tail, well before the respawn at 150 frames (2.5 s) */
export const BITCH_AT = .7;

/** does a death now get SLAB's GRODIUS BITCH? A boss fight (rank.ts capCtx 'boss': the Drive, or a stage boss that is
 *  not a midboss) in a late stage (BITCH_LATE). Pure */
export function lateBossDeath($: any): boolean {
  const G = $ && $.G;
  if (!G || capCtx($) !== 'boss') return false;
  return (G.loop | 0) >= BITCH_LATE.loop || (G.stage | 0) >= BITCH_LATE.stage;
}
