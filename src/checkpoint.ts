// @ts-nocheck
// The resume point (D19 build plan LS1 row H; spec design/content-expansion.md §4). Two checkpoints per stage:
// - CP0 at stage start (after choose() at a gate, or after the tally): stages.ts startStage sets G.cpWant = 0;
// - CP1 once the scroll passes cp1X (midboss A done: just before breath 1's release on a long biome stage, so a resume
//   replays the release pod (LS1 audit SUMMARY #4), else breath 1's end + 150, the Saucer's window end
//   + 150 on Open Orbit, the approach midpoint on the Drive) with G.mini gone and nothing pending in G.pend.
// Neither is written during a fight, a fork, a tally, a level-up pick, a death or the descent's end: cpStep waits for
// the first step where cpSafe() holds. A checkpoint is the run-save JSON (runsave.ts), stored in grodius.run and kept
// in memory; the Android pause writes that copy again, never live state. The restore is a rebuild (flow.ts
// resumeRun, stagebuild.ts rebuildAt), not a snapshot.
//
// The trigger (lab.ts cpTrigger, the LAB's CHECKPOINT row): 'a' resumes only after an app kill or quit (RESUME on
// the title), the default; 'b' also restarts at the last checkpoint on death, one life spent (flow.ts respawn).
// Both write the same checkpoints; only what reads them differs.
import { $ } from './state';
import { encodeRun, storeRun } from './runsave';
import { beatPlan, driftsOf, layout, row } from './layout';
import { sealFor } from './stages';

/** checkpoint tuning (spec §4 "When it saves", "How it restores") */
export const CP = {
  /** CP1 sits this far past midboss A's breath end (biome) or the Saucer's filler window end (Orbit): "bZ1 + 150" */
  after: 150,
  /** a biome stage with a release beat (long4's breath 1) puts CP1 this far BEFORE the release entry at the breath's end,
   *  so the rebuild (entries x > cpX) replays the guaranteed pod formation and log line 2 (LS1 audit SUMMARY #4,
   *  game-designer). The scroll holds ~60 px short of the breath end while midboss A is up, so CP1 can only be written
   *  here once it is gone. If the first safe step comes after the release has fired, CP1 falls back to release + after */
  preRelease: 20,
  /** a resume starts the scroll this far before cpX: the spec's 120 f empty lead-in at full scroll speed */
  lead: 120,
  /** a resumed ship's i-frames: the respawn's 160 plus the lead-in, so nothing can touch it before the first beat */
  inv: 280,
};

/** scroll x of stage i's CP1, or null when the stage has none. Biome stages read the stored gate x G.bx[slot] (the
 *  breaths move with it). Pure: reads only the layout and G */
export function cp1X(i, G = $.G) {
  const r = row(i);
  if (!r) return null;
  if (r.kind === 'biome') {
    const from = G.bx && G.bx[r.slot];
    if (from == null) return null;
    const b = beatPlan(r, from, !!(G.visitNo && G.visitNo[r.slot])).breaths.find((q) => q.mid);
    return b ? (b.release ? b.z - CP.preRelease : b.z + CP.after) : null;
  }
  const d = driftsOf(i)[0]; // Orbit: after midboss A's (the Saucer's) forced exit, which comes before its window ends
  if (d) return r.x0 + d.gapEnd + CP.after;
  if (r.kind === 'drive') return Math.round((r.x0 + (r.warnX ?? r.bossX)) / 2); // the approach midpoint
  return null;
}

/** scroll x of stage i's release entry when its CP1 sits before it (cp1X), else null: past it, CP1 falls back */
export function cp1Release(i, G = $.G) {
  const r = row(i);
  if (!r || r.kind !== 'biome' || !G.bx || G.bx[r.slot] == null) return null;
  const b = beatPlan(r, G.bx[r.slot], !!(G.visitNo && G.visitNo[r.slot])).breaths.find((q) => q.mid);
  return b && b.release ? b.z : null;
}

/** may a checkpoint be written this step? Never in a fight (midboss, boss), a fork, a tally, a level-up pick, while
 *  dead or at the descent's end */
export function cpSafe(G = $.G, P = $.P) {
  return $.state === 'play' && !!P && P.alive && !G.mini && !G.bossStarted && !G.boss && !G.fork && !G.forkHold && !G.tally && !G.pick && !G.clearT;
}

/** the run state a checkpoint stores: G as it stands, with the seal as earned by the clears so far (a seal still
 *  queued in a closure is not lost) and the stage clock as frames into the stage. Queued picks (G.pickQ) and the
 *  boost offer (G.boostReq) are plain fields; an open pick never is, since cpSafe waits for it to close */
export const cpView = (G = $.G) => ({ ...G, seal: Math.max(G.seal || 0, sealFor(G.cleared || 0)), stT: G.st ? G.t - G.st.t0 : 0 });

/** write checkpoint n (0 or 1) of the current stage at scroll x (default: here). False, and the previous checkpoint
 *  stands, if the state would not read back or storage refused it */
export function writeCp(n, x = $.G.scroll) {
  const G = $.G;
  G.cpN = n;
  G.cpX = x;
  G.layout = layout().id;
  const s = encodeRun(cpView(G), $.P);
  return !!s && storeRun(s);
}

/** once per sim step in play (step.ts): write CP0, then CP1, at the first safe step past each */
export function cpStep() {
  const G = $.G;
  if (G.cpWant !== 0 && G.cpWant !== 1) return;
  if (G.cpWant === 1 && G.cp1Rel != null && G.scroll >= G.cp1Rel) { G.cp1X = G.cp1Rel + CP.after; G.cp1Rel = null; } // the release fired before a safe step: today's anchor
  if (!cpSafe(G)) return;
  if (G.cpWant === 1 && (G.scroll < G.cp1X || G.pend.length)) return; // CP1 also waits out every pending closure
  if (G.cpWant === 0) { G.cp1X = cp1X(G.stage, G); G.cp1Rel = cp1Release(G.stage, G); }
  writeCp(G.cpWant);
  G.cpWant = G.cpWant === 0 && G.cp1X != null ? 1 : 2;
}
