// @ts-nocheck
// Stage structure: each descent is the active layout's stages (src/layout.ts; short: Orbit, biome, biome, Drive), each ending on a boss. Clearing a stage shows a tally,
// pays out score + biomass by grade, records your best grade, and every 2nd clear breaks a seal.
// An escaped boss grades C and pays its score but no biomass; it still counts toward the seals (D5b).
import { $ } from './state';
import { save } from './save';
import { sample, sfx } from './audio';
import { banner } from './enemies/spawn';
import { buzz } from './platform';
import { BIOMES, openFork, holdForFork, biomeExit } from './biomes';
import { forkAfter, lastStage, row } from './layout';
import { gradeKey } from './gradekey';
import { buildStage } from './stagebuild';
import { econId, gradeOf, sealAt } from './economy';

/** stage names by stage kind; a biome stage is named by the biome you fly into once its gate is taken */
export const STAGE_NAMES = {
  orbit: { name: 'OPEN ORBIT', sub: 'THE MERIDIAN LOOMS' },
  biome: { name: 'THE SPLIT', sub: 'CHOOSE A WOUND' },
  drive: { name: 'THE GRAVITY DRIVE', sub: 'IT IS STILL RUNNING' },
};
// seals break on the clears the layout's economy entry schedules (src/economy.ts sealAt; short and long4: the 2nd, 4th
// and 6th stage cleared in a run, i.e. end of the first biome, end of Descent 1, Descent 2's first biome)
/** the highest seal tier `cleared` stage clears have earned (a checkpoint stores this, so a seal still queued in a
 *  closure, G.sealQ or G.pend, is never lost by a resume: H entry criterion 1) */
export function sealFor(cleared) {
  const id = econId();
  let t = 0;
  for (let k = 1; k <= cleared; k++) t = Math.max(t, sealAt(id, k));
  return t;
}
export const SEAL_TXT = ['', 'MISSILE II, ARC, PYRE, WRAITH II, MIRROR, 2 GRAFTS', 'PYRE II, WRAITH III, AEGIS, 3 GRAFTS', 'EVERYTHING UNSEALED'];
const GRADE = {
  S: { score: 20000, bio: 40, col: '#ffd23a' },
  A: { score: 10000, bio: 25, col: '#ff8a3a' },
  B: { score: 5000, bio: 12, col: '#cfd9e3' },
  C: { score: 2000, bio: 5, col: '#7a8694' },
};
const ORDER = 'SABC';
/** biomass payouts from Descent 2 on are doubled in every run, DESCEND DEEPER bought or not (D5b) */
export const deepPay = () => ($.G.loop > 0 ? 2 : 1);

export const stageLabel = () => `${$.G.loop + 1}-${$.G.stage + 1}`;
/** a biome stage is whichever biome you flew into */
export function stageInfo(i = $.G.stage || 0) {
  const r = row(i), b = r && r.kind === 'biome' && $.G.route && $.G.route[r.slot];
  return b ? { name: BIOMES[b].name, sub: BIOMES[b].sub } : r && STAGE_NAMES[r.kind];
}

export function startStage(i) {
  $.G.stage = i;
  if (row(i).kind !== 'biome') buildStage(i); // a stage is built on entry; a biome stage was built at its gate (choose)
  $.G.st = { kills: 0, spawned: 0, hits: 0, deaths: 0, chain: 0, t0: $.G.t };
  $.G.cpWant = 0; // CP0 is written at the first safe step of the stage (src/checkpoint.ts cpStep)
  if ($.G.tally) $.G.tally.t = Math.min($.G.tally.t, 30); // last stage's card makes way for this stage's banner
  stageBanner(i);
  if ($.G.sealQ) { const f = $.G.sealQ; $.G.sealQ = null; $.G.pend.push({ t: 270, f }); }
}

/** queue the STAGE n-m banner of stage i (a stage start, and a resume) */
export function stageBanner(i) {
  const s = stageInfo(i);
  $.G.pend.push({ t: 70, f: () => banner(`STAGE ${stageLabel()}`, s.name + ' // ' + s.sub, '#c8d4e0', 190) });
}

/** a stage's scroll seconds for grade normalisation (spec §7 Ts): its world span at the nominal 1 px/frame scroll
 *  (flow.ts newGame scrollSpeed = 1), so it is fixed per row and never depends on how the fight went. Only the
 *  normalised entries read it (short has gradeRef null) */
export const stageTs = (i = $.G.stage || 0) => { const r = row(i); return r ? (r.x1 - r.x0) / 60 : 0; };

/** call when the stage's boss dies (or escapes). Returns the seal tier broken, or 0. */
export function clearStage(escaped = false) {
  const G = $.G, st = G.st;
  if (!st || st.done) return 0;
  st.done = true;
  const g = gradeOf(econId(), st, stageTs(G.stage), escaped), R = GRADE[g], perfect = !st.hits && !st.deaths && !escaped;
  const bonus = R.score * (G.loop + 1) + (perfect ? 10000 * (G.loop + 1) : 0);
  const bio = escaped ? 0 : R.bio * deepPay(); // IT GOT AWAY / NO BIOMASS: no biomass (D5b)
  G.score += bonus;
  G.bio += bio;
  $.meta.bio += bio;
  const id = stageLabel(), key = gradeKey(), best = ($.meta.best ||= {}); // id: banner/tally label; key: by stage kind
  const newBest = !best[key] || ORDER.indexOf(g) < ORDER.indexOf(best[key]);
  const prev = best[key];
  if (newBest) best[key] = g;
  G.cleared = (G.cleared || 0) + 1;
  const at = sealAt(econId(), G.cleared), seal = at > (G.seal || 0) ? at : 0;
  G.tally = {
    id, name: stageInfo(G.stage).name, g, col: R.col, perfect, escaped, bonus, bio, deep: bio > 0 && deepPay() > 1,
    kills: st.kills, pct: Math.round((st.kills / Math.max(1, st.spawned)) * 100),
    hits: st.hits, deaths: st.deaths, chain: st.chain, secs: Math.round((G.t - st.t0) / 60),
    best: newBest ? (prev ? 'NEW BEST (WAS ' + prev + ')' : 'FIRST CLEAR') : 'BEST ' + best[key],
    t: 420, ml: 420,
  };
  sfx.stageClear();
  buzz('heavy');
  // boss-kill reward line (src/sfx/bossreward/, random pick if there are several; none loaded since Matt shelved THE KEYSTER, see src/sfx-shelved/README.md, so sample() returns false and nothing plays); waits out the death roar
  if (!escaped) G.pend.push({ t: 50, f: () => sample('bossreward', { vol: 1.15, spread: .02, wet: .16 }) });
  const breakSeal = () => { if (seal > (G.seal || 0)) { G.seal = seal; banner('SEAL BROKEN', 'UNLOCKED: ' + SEAL_TXT[seal], '#ffd23a', 230); sfx.alarm(); } };
  const r = row(G.stage), seg = forkAfter(G.stage); // seg: the biome slot whose fork this clear opens, or -1
  // at a fork the seal waits until you're through the gate (its banner would bury the gate prompt), see startStage
  if (seal && seg >= 0) G.sealQ = breakSeal;
  else if (seal) G.pend.push({ t: 300, f: breakSeal });
  if (r.kind === 'biome' && G.route[r.slot]) (G.visited ||= []).includes(G.route[r.slot]) || G.visited.push(G.route[r.slot]);
  if (seg >= 0) {
    // branch: hold the scroll, open two gates after the tally has had its moment
    holdForFork();
    G.pend.push({ t: 200, f: () => openFork(seg) });
  } else if (G.stage < lastStage()) {
    if (r.kind === 'biome') biomeExit(r.slot); // the last biome hands the rest of the level back to the ship (the Gravity Drive)
    const nx = G.stage + 1;
    G.pend.push({ t: 200, f: () => G.stage === nx - 1 && startStage(nx) });
  }
  save();
  return seal;
}
