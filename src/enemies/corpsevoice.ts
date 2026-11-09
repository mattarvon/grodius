// The crew corpse's "stop killing me" plea (CREWMAN #5 // DECEASED): at most once per stage, on a corpse kill that
// varies by stage (Matt 2026-11-09: every 5th kill was too often). A pure leaf: the pick is a hash of the stage and
// loop, never an R() or srnd() draw, so the sim streams and the harness are untouched. The count and the played flag
// live in the stage stats G.st: startStage resets them, and a checkpoint stores G.st (runsave.ts), so RE-ENTER resumes
// with the count and flag as they stood at the checkpoint (a plea before it is not played again).

export const CORPSE_VOICE = {
  /** the plea lands on corpse kill 1..span of the stage; a stage with fewer corpse kills than its target stays quiet */
  span: 5,
};

/** which corpse kill of stage `stage` in loop `loop` pleads (1..CORPSE_VOICE.span); varies stage to stage */
export function corpseVoiceAt(stage: number, loop: number): number {
  // a small integer hash (Knuth multiplicative) so neighbouring stages and loops land on different kills
  const h = Math.imul((stage | 0) * 31 + (loop | 0) * 7 + 1, 0x9e3779b1) >>> 0;
  return 1 + ((h >>> 16) % CORPSE_VOICE.span);
}

/** count a corpse kill in the stage stats; true when this is the kill that pleads (once per stage) */
export function corpseKilled(st: { corpseN?: number; corpseVo?: boolean }, stage: number, loop: number): boolean {
  st.corpseN = (st.corpseN || 0) + 1;
  if (st.corpseVo || st.corpseN !== corpseVoiceAt(stage, loop)) return false;
  st.corpseVo = true;
  return true;
}
