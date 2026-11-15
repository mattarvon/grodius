// THE KEEPSAKE as a stage boss: its words (the keepsake-boss design, section 6; narrative-director and writer). A leaf
// with no imports: the fight (enemies/boss/keepsake.ts, kboss-core) shows the banners, readout and log line from here,
// and the booth (tools/booth/slots.ts) reads SLAB's lines from here, so the script Matt reads is the game's own text.
//
// The rules every line here keeps (imply-only, D46/D53(B)): the doll is a toy the ship swallowed, never a child's
// remains. No line addresses it as a child, names the kid or frames it as a body. Not used, and why: PAST YOUR BEDTIME
// and SLEEP TIGHT (both address the doll as a child), NAP TIME (cute: fails Pillar 5).

/** the WARNING banner's name (kept from the midboss: it already carries the horror) */
export const KEEPSAKE_NAME = 'THE KEEPSAKE';
/** the stage-boss readout on the kill (goes into stages.ts BOSS_READOUTS, so no quip with these words follows it) */
export const KEEPSAKE_READOUT = 'PUT TO BED';
/** the phase banners: cold, in the house style of ITS HEART IS EXPOSED and IT SNAPPED A CHAIN */
export const KEEPSAKE_BANNERS = {
  woke: 'IT WOKE UP', // phase 1 -> 2
  cracked: 'IT CRACKED', // phase 2 -> 3
  quiet: 'IT STOPPED CRYING', // the crier broken (phase 3)
  hold: "IT WON'T LET GO", // a phase clock ran out
} as const;
/** the run-up log line, terminal and declarative. Placement A (stage 1-3's boss: the ship swallowed it) and, once THE
 *  CREW DECK exists, placement D */
export const KEEPSAKE_LOG = {
  tract: 'OBJECT IN THE TRACT // NOT ORGANIC // NOT CREW-ISSUE',
  crew: 'QUARTERS 3B // PERSONAL EFFECTS NOT RECOVERED',
} as const;
/** SGT. RAMROD SLAB's lines for the fight (recorded in the booth: src/sfx/bark-keepsake-<k>/). Deadpan, grim, no
 *  exclamation marks. Each is the caption lines of one take */
export const KEEPSAKE_BARKS = {
  warn: ['BIG HEAD ON THE SCOPE', 'RUBBER FACE', 'GO FOR THE TOP'], // the WARNING: the one line that teaches (ANGLE)
  eyes: ['EYES OPEN', "IT'S COMING"], // the first tell of phase 2
  woke: ["IT'S UP"], // IT WOKE UP
  crack: ["IT'S COMING APART", 'STAY ON IT'], // IT CRACKED
} as const;
