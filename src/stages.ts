// @ts-nocheck
// Stage structure: each descent is 4 stages, each ending on a boss. Clearing a stage shows a tally,
// pays out score + biomass by grade, records your best grade, and every 2nd clear breaks a seal.
import { $ } from './state';
import { save } from './save';
import { sfx } from './audio';
import { banner } from './enemies/spawn';
import { buzz } from './platform';

export const STAGES = [
  { name: 'OPEN ORBIT', sub: 'THE MERIDIAN LOOMS' },
  { name: 'THE HULL', sub: 'SOMETHING GROWS ON THE PLATING' },
  { name: 'THE CORRIDORS', sub: 'THE WALLS ARE BREATHING' },
  { name: 'THE GRAVITY DRIVE', sub: 'IT IS STILL RUNNING' },
];
/** seals break on the 2nd, 4th and 6th stage cleared in a run (end of Hull, end of Descent 1, Descent 2 Hull) */
const SEAL_AT = { 2: 1, 4: 2, 6: 3 };
export const SEAL_TXT = ['', 'MISSILE II, ARC, PYRE, WRAITH II, MIRROR, 2 GRAFTS', 'PYRE II, WRAITH III, AEGIS, 3 GRAFTS', 'EVERYTHING UNSEALED'];
const GRADE = {
  S: { score: 20000, bio: 40, col: '#ffd23a' },
  A: { score: 10000, bio: 25, col: '#ff8a3a' },
  B: { score: 5000, bio: 12, col: '#cfd9e3' },
  C: { score: 2000, bio: 5, col: '#7a8694' },
};
const ORDER = 'SABC';

export const stageLabel = () => `${$.G.loop + 1}-${$.G.stage + 1}`;

export function startStage(i) {
  $.G.stage = i;
  $.G.st = { kills: 0, spawned: 0, hits: 0, deaths: 0, chain: 0, t0: $.G.t };
  const s = STAGES[i];
  $.G.pend.push({ t: 70, f: () => banner(`STAGE ${stageLabel()}`, s.name + ' // ' + s.sub, '#c8d4e0', 190) });
}

function grade(st, escaped) {
  const pct = st.kills / Math.max(1, st.spawned);
  if (escaped) return 'C';
  const pts = pct * 100 - st.hits * 10 - st.deaths * 30;
  if (pts >= 70 && !st.hits && !st.deaths) return 'S';
  if (pts >= 50) return 'A';
  if (pts >= 30) return 'B';
  return 'C';
}

/** call when the stage's boss dies (or escapes). Returns the seal tier broken, or 0. */
export function clearStage(escaped = false) {
  const G = $.G, st = G.st;
  if (!st || st.done) return 0;
  st.done = true;
  const g = grade(st, escaped), R = GRADE[g], perfect = !st.hits && !st.deaths && !escaped;
  const bonus = R.score * (G.loop + 1) + (perfect ? 10000 * (G.loop + 1) : 0);
  G.score += bonus;
  G.bio += R.bio;
  $.meta.bio += R.bio;
  const id = stageLabel(), best = ($.meta.best ||= {});
  const newBest = !best[id] || ORDER.indexOf(g) < ORDER.indexOf(best[id]);
  const prev = best[id];
  if (newBest) best[id] = g;
  G.cleared = (G.cleared || 0) + 1;
  const seal = SEAL_AT[G.cleared] && SEAL_AT[G.cleared] > (G.seal || 0) ? SEAL_AT[G.cleared] : 0;
  G.tally = {
    id, name: STAGES[G.stage].name, g, col: R.col, perfect, escaped, bonus, bio: R.bio,
    kills: st.kills, pct: Math.round((st.kills / Math.max(1, st.spawned)) * 100),
    hits: st.hits, deaths: st.deaths, chain: st.chain, secs: Math.round((G.t - st.t0) / 60),
    best: newBest ? (prev ? 'NEW BEST (WAS ' + prev + ')' : 'FIRST CLEAR') : 'BEST ' + best[id],
    t: 420, ml: 420,
  };
  sfx.power();
  buzz('heavy');
  if (seal) {
    G.pend.push({ t: 300, f: () => { G.seal = seal; banner('SEAL BROKEN', 'UNLOCKED: ' + SEAL_TXT[seal], '#ffd23a', 230); sfx.alarm(); } });
  }
  if (G.stage < STAGES.length - 1) G.pend.push({ t: 200, f: () => startStage(G.stage + 1) });
  save();
  return seal;
}
