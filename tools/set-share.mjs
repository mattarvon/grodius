// Cross-seed set-piece report (build plan LS2-mv; spec §10): over N run seeds, how much of a stage's set-piece draw two
// seeds share. Node only, no browser: it replays the real draw (src/setdraw.ts drawPicks on src/rng.ts pickSeedOf streams
// with the run's flown-variant bits, the same call biomes.ts stagePicks makes) over a route per seed. The route is a stand-in for the fork: a uniform choice
// among the biomes the fork rule allows, not a played one (the real picks of played seeds: playtest.mjs --compare).
//   whole run: stage by stage, any biome. A pair on different biomes shares nothing.
//   same biome: only pairs flying the same biome there, the worst case. Three of five can't share less than one.
// Three measures per pair: count (shared / 3), jaccard (shared / union: playtest --compare's wave overlap measure) and
// placed (same piece at the same beat, S1/S2/S3).
// Usage: node tools/set-share.mjs [seeds=200] [descents=3]
import { CATALOG, drawPicks } from '../src/setdraw.ts';
import { pickSeedOf, seedOf, stream } from '../src/rng.ts';
import { forkAllows } from '../src/midpick.ts';
import { layout, setLayout, slotRow, stageOfSlot, nSlots } from '../src/layout.ts';

const [N = '200', D = '3'] = process.argv.slice(2);
setLayout('long4');
const biomes = Object.keys(CATALOG);
function run(seed) {
  const pick = stream(seedOf(seed, 99, 99)), used = {}, seen = {}, bvis = {}, out = {};
  for (let loop = 0; loop < +D; loop++) {
    const route = Array(nSlots()).fill(null);
    for (let s = 0; s < nSlots(); s++) {
      const ok = biomes.filter((k) => forkAllows(k, route) && !route.includes(k)), b = ok[Math.floor(pick() * ok.length)];
      route[s] = b;
      const v = bvis[b] || 0, i = stageOfSlot(s);
      bvis[b] = v + 1;
      out[`${loop + 1}-${i + 1}`] = { b, v, ...drawPicks(b, v, loop, used, stream(pickSeedOf(seed, loop, i)), seen) };
    }
  }
  return out;
}
const runs = Array.from({ length: +N }, (_, i) => run(i + 1));
const pct = (x) => `${Math.round(100 * x)}%`;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pairs = (k, same) => {
  const c = [], j = [], p = [];
  for (let i = 0; i < runs.length; i++) for (let q = i + 1; q < runs.length; q++) {
    const A = runs[i][k], B = runs[q][k];
    if (same && A.b !== B.b) continue;
    const sh = A.b === B.b ? A.sp.filter((x) => B.sp.includes(x)).length : 0;
    c.push(sh / 3); j.push(sh / (6 - sh)); p.push(A.b === B.b ? A.sp.filter((x, n) => B.sp[n] === x).length / 3 : 0);
  }
  return { c: mean(c), j: mean(j), p: mean(p), n: c.length };
};
console.log(`set-piece share over ${N} seeds, ${D} descents, layout ${layout().id}, simulated routes`);
let worst = 0, worstSame = 0;
for (const k of Object.keys(runs[0])) {
  const w = pairs(k, false), s = pairs(k, true);
  worst = Math.max(worst, w.c); worstSame = Math.max(worstSame, s.c);
  console.log(`stage ${k}  whole run: count ${pct(w.c)} jaccard ${pct(w.j)} placed ${pct(w.p)}   same biome (${s.n} pairs): count ${pct(s.c)} jaccard ${pct(s.j)} placed ${pct(s.p)}`);
}
const mv = {}; for (const r of runs) for (const [k, p] of Object.entries(r)) { (mv[k] ||= [0, 0])[p.mv]++; }
console.log('movement B split (B0/B1) by stage:', Object.entries(mv).map(([k, [a, b]]) => `${k} ${a}/${b}`).join('  '));
console.log(`worst whole-run count share ${pct(worst)}: ${worst <= .5 ? 'PASS' : 'FAIL'} (<= 50%, any two seeds at a stage)`);
console.log(`worst same-biome count share ${pct(worstSame)}: ${worstSame <= .5 ? 'PASS' : 'FAIL'} (<= 50%, two seeds on the same biome at a stage: 3 of a catalogue of N shares 3/N by construction)`);
console.log('not measured: played routes (see playtest.mjs --compare); consecutive-run memory (none: the draw is per run)');
