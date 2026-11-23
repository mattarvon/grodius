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
//
// long4 (DIFFICULTY-SPEC §2.1 "Death penalty", Decision 1A, workstream W2): a checkpoint LIST per stage instead of
// CP1 alone (cpPlan): after every midboss or Saucer exit, at every signature start (sigs.ts sigWindows), 10 s before
// the stage boss's WARNING, and filled so no two are more than 30 s of scroll apart (C21). On long4 the tier decides
// the trigger (death.ts DEATH_TIER: a checkpoint restart on Normal, Hard and Very Hard; Easy respawns in place). No
// checkpoint is written inside a signature window or while a recovery wave is still queued.
import { $ } from './state';
import { encodeRun, storeRun } from './runsave';
import { beatPlan, cpsOf, driftsOf, layout, layoutRev, row } from './layout';
import { sealFor } from './stages';
import { hardOn } from './death';


import { sigWindows } from './sigs';

/** the signature windows as world-x spans [{x0, x1}] (src/sigs.ts sigWindows, DIFFICULTY-SPEC §2.4; empty until W3) */
export const sigSpans = (): readonly { x0: number; x1: number }[] => sigWindows($);


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
  /** a resumed ship's i-frames: the respawn's 160 plus the lead-in, so nothing can touch it before the first beat.
   *  long4 reads death.ts SURV.cpInv (120: the lead-in alone, C20) */
  inv: 280,
  /** long4, C21 (GR rule 7): at most this much scroll (30 s at 1 px/f) between any two checkpoints of a stage */
  gap: 1800,
  /** long4: a checkpoint this far before the stage boss's WARNING (10 s), so a fight death replays the run-up and its
   *  recovery waves (C15) */
  warnLead: 600,
  /** long4: planned checkpoints closer than this merge into the earlier one (a fill point next to an anchor) */
  minSep: 300,
  /** the ship's screen x on a restore (flow.ts resetPlayer): what sits "inside" a signature window is the ship's world x,
   *  P.x + scroll, over the restore's lead-in */
  shipX: 50,
};

/** is a checkpoint at scroll x inside a signature window? The ship's world x over the restore's lead-in,
 *  [x - lead + shipX, x + shipX], must touch no window (spec §5.1: checkpoints never sit inside one) */
export function cpInSig(x, spans = sigSpans()) {
  const a = x - CP.lead + CP.shipX, b = x + CP.shipX;
  return spans.some((w) => a <= w.x1 && b >= w.x0);
}
/** the latest scroll x at or before x whose lead-in clears every window, or null if that falls at or before `floor` */
function outOfSig(x, floor, spans) {
  let c = x;
  for (let k = 0; k < 8 && cpInSig(c, spans); k++) {
    const w = spans.find((q) => c - CP.lead + CP.shipX <= q.x1 && c + CP.shipX >= q.x0);
    c = w.x0 - CP.shipX - 1;
  }
  return c > floor && !cpInSig(c, spans) ? c : null;
}

/** the first scroll x after x whose lead-in clears the window holding x, or null */
function afterSig(x, spans) {
  const w = spans.find((q) => x - CP.lead + CP.shipX <= q.x1 && x + CP.shipX >= q.x0);
  if (!w) return null;
  const c = w.x1 + CP.lead - CP.shipX + 1;
  return cpInSig(c, spans) ? null : c;
}

/** the scroll x where stage i's own content starts: a biome stage's gate less a screen (the gate is choose()'s
 *  scroll + W + 10), else its row x0. Pure */
export function stageStartX(i, G = $.G) {
  const r = row(i);
  if (!r) return 0;
  if (r.kind === 'biome' && G.bx && G.bx[r.slot] != null) return Math.max(i > 0 ? row(i - 1).x0 : 0, G.bx[r.slot] - 480);
  return r.x0;
}

/** the checkpoints after CP0 of stage i, in order: [{x, rel}] (rel: a release entry the checkpoint must precede,
 *  else null; cpStep falls back to rel + CP.after once the scroll passes it). Off long4: CP1 alone, today's rule.
 *  long4: the anchors (every midboss breath's CP1 point, the Saucer's exit, the Drive approach's midpoint, the row's
 *  `cps` data (stage-relative to the stage start; W3's placements), every signature start) and the boss WARNING
 *  - CP.warnLead, then filled so no gap from the stage start on exceeds CP.gap; none inside a signature window.
 *  Pure: reads only the layout, G and the windows */
export function cpPlan(i, G = $.G, hard = hardOn(), spans = sigSpans()) {
  if (!hard) {
    const x = cp1X(i, G);
    return x == null ? [] : [{ x, rel: cp1Release(i, G) }];
  }
  const r = row(i);
  if (!r) return [];
  const start = stageStartX(i, G), end = (r.warnX ?? r.bossX) - CP.warnLead, a = [];
  if (r.kind === 'biome') {
    const from = G.bx && G.bx[r.slot];
    if (from != null) for (const b of beatPlan(r, from, !!(G.visitNo && G.visitNo[r.slot])).breaths) if (b.mid) a.push(b.release ? { x: b.z - CP.preRelease, rel: b.z } : { x: b.z + CP.after, rel: null });
  } else {
    for (const d of driftsOf(i)) a.push({ x: r.x0 + d.gapEnd + CP.after, rel: null });
    if (r.cp1 != null) a.push({ x: r.x0 + r.cp1, rel: null });
    if (r.kind === 'drive') a.push({ x: Math.round((r.x0 + (r.warnX ?? r.bossX)) / 2), rel: null });
  }
  // W3b's checkpoint data (layout.ts cpsOf: the row's `cps` in world x; Orbit and Drive rows, null elsewhere)
  for (const x of cpsOf(i) || []) a.push({ x, rel: null });
  // every signature start: the window's own cp where W3c placed one (sigs.ts sigCheckpoints: each biome variation's
  // arming x - 60), else just before the window (the fixed-row windows carry none)
  for (const w of spans) if (w.x0 > start && w.x0 < end) a.push({ x: w.cp != null ? w.cp : w.x0 - CP.shipX - 1, rel: null });
  // anchors in order, inside the stage, out of the windows, merged when closer than minSep (the earlier one stays)
  const pts = [];
  for (const p of a.filter((q) => q.x > start && q.x < end).sort((p, q) => p.x - q.x)) {
    const x = outOfSig(p.x, start, spans);
    if (x == null) continue;
    const q = x === p.x ? p : { x, rel: null };
    if (pts.length && q.x - pts[pts.length - 1].x < CP.minSep) continue;
    pts.push(q);
  }
  const bx = outOfSig(end, start, spans);
  if (bx != null) {
    while (pts.length && bx - pts[pts.length - 1].x < CP.minSep) pts.pop(); // the WARNING checkpoint wins over a near anchor
    pts.push({ x: bx, rel: null });
  }
  // fill: wherever two neighbours (the stage start first) are more than CP.gap apart, spread k points evenly, then pull
  // any that a window moved back further in, greedily, so every gap stays <= CP.gap (C21) unless a window longer than
  // CP.gap leaves nowhere legal (then the first point past it)
  const out = [];
  let prev = start;
  for (const p of pts) {
    const k = Math.ceil((p.x - prev) / CP.gap) - 1;
    let last = prev;
    for (let j = 1; j <= k && p.x - last > CP.gap; j++) {
      const even = Math.round(prev + ((p.x - prev) * j) / (k + 1)), x = outOfSig(Math.min(even, last + CP.gap), last, spans);
      if (x != null) { out.push({ x, rel: null }); last = x; }
    }
    while (p.x - last > CP.gap) { // a window pulled a point back: one more, as far on as it may go
      const x = outOfSig(last + CP.gap, last, spans) ?? afterSig(last + CP.gap, spans);
      if (x == null || x >= p.x || x <= last) break;
      out.push({ x, rel: null });
      last = x;
    }
    out.push(p);
    prev = p.x;
  }
  return out;
}

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
  if (!($.state === 'play' && !!P && P.alive && !G.mini && !G.bossStarted && !G.boss && !G.fork && !G.forkHold && !G.tally && !G.pick && !G.clearT)) return false;
  // long4: never inside a signature window (a restore there would resume in a closing throat), and never while a
  // recovery wave is queued (G.recovery is not saved, spec §5.4: a save mid-queue would lose it)
  return !hardOn() || (!(G.recovery && G.recovery.length) && !cpInSig(G.scroll));
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
  G.rev = layoutRev(); // D31: runsave refuses a save from an older geometry of this layout
  const s = encodeRun(cpView(G), $.P);
  return !!s && storeRun(s);
}

/** G.cp1X / G.cp1Rel: the next planned checkpoint's x and release, mirrored for tools/resume-check.mjs and main.ts __cp */
function mirrorNext(G) {
  const q = G.cpQ && G.cpWant > 0 ? G.cpQ[G.cpWant - 1] : null;
  if (!q && G.cpWant > 1) return; // past the list: the last one stays mirrored, as CP1 did
  G.cp1X = q ? q.x : null;
  G.cp1Rel = q ? q.rel : null;
}
/** a resumed run's next checkpoint: the first planned one past the restored cpX (CP0 is never re-written from here:
 *  its cpX would move back by the lead-in on every resume). Sets G.cpQ and G.cpWant (past the list = done) */
export function cpResume(G = $.G) {
  G.cpQ = cpPlan(G.stage, G);
  const k = G.cpQ.findIndex((q) => q.x > G.cpX);
  G.cpWant = k >= 0 ? k + 1 : Math.max(2, G.cpQ.length + 1);
  mirrorNext(G);
}
/** once per sim step in play (step.ts): write CP0, then each planned checkpoint (cpPlan), at the first safe step past
 *  each. G.cpWant is the next one's number (0 = CP0); past the list, nothing more is written this stage */
export function cpStep() {
  const G = $.G;
  if (G.tally && G.recovery && G.recovery.length) G.recovery = []; // a stage clear drops the queue: no wave flies into the next stage
  if (!Number.isInteger(G.cpWant) || G.cpWant < 0) return;
  let q = null;
  if (G.cpWant > 0) {
    q = G.cpQ && G.cpQ[G.cpWant - 1];
    if (!q) return;
    if (q.rel != null && G.scroll >= q.rel) { q.x = q.rel + CP.after; q.rel = null; mirrorNext(G); } // the release fired before a safe step: today's anchor
  }
  if (!cpSafe(G)) return;
  if (q && (G.scroll < q.x || G.pend.length)) return; // a later checkpoint also waits out every pending closure
  if (G.cpWant === 0) G.cpQ = cpPlan(G.stage, G);
  writeCp(G.cpWant ? 1 : 0); // cpN: 0 the stage start, 1 any later one (the run save's field; cpResume finds the next by cpX)
  G.cpWant = G.cpWant === 0 && !G.cpQ.length ? 2 : G.cpWant + 1; // short keeps today's numbers: 2 = done after CP1
  mirrorNext(G);
}
