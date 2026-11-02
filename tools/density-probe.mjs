// Density probe: builds every biome script (4 biomes x every biome slot x loop 0/1, averaged over N rolls) straight from
// biomeScript and prints spawn calls per pacing beat (intro/build/breath/peak/tail around the midboss breath) as count and
// spawns/s (60px = 1s). On a layout with the v2 beat template (long4) tools/beat-probe.mjs gives its own bands.
// Each slot is built from where choose() puts it in practice: the row's gateLate in src/layout.ts (fork scroll + W + 10;
// 2660 / 5640 on short, which the parity bots take at 2658 / 5637). Spans and breaths come from layout.ts beatPlan.
// Set pieces count as one call; logs, the biome midboss (mid p= is where it lands) and the boss don't count.
// Usage: node tools/density-probe.mjs <url> [N=400] [save.json] [compare.json] [--layout short]
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const [url, N = '400', SAVE, CMP] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; });
await p.goto(url); await p.waitForFunction(() => window.__started);
await useLayout(p, 'density-probe');
const res = await p.evaluate(async (N) => {
  const { biomeScript, BIOMES } = await import('/src/biomes.ts'), { $ } = await import('/src/state.ts'), LY = await import('/src/layout.ts');
  const out = {}, G0 = $.G;
  for (const loop of [0, 1]) for (let seg = 0; seg < LY.nSlots(); seg++) for (const bk of Object.keys(BIOMES)) {
    // span, breaths and beats exactly as biomeScript places them (src/layout.ts beatPlan). Its band set is short's
    // (intro/build/breath/peak/tail around the midboss breath); tools/beat-probe.mjs reports a layout's own beat bands
    // (long4: intro A/B, two breaths, the run-up)
    const g = LY.slotRow(seg), from = g.gateLate ?? g.x0, P = LY.beatPlan(g, from, false), a = P.a, z = P.z;
    const br = P.breaths.find((b) => b.mid) || P.breaths[0], qA = (br.a - a) / (z - a), qZ = (br.z - a) / (z - a);
    const BK = [['intro', 0, .2], ['build', .2, qA], ['breath', qA, qZ], ['peak', qZ, .9], ['tail', .9, 1]], c = Object.fromEntries(BK.map((k) => [k[0], 0]));
    let tot = 0, maw = null;
    for (let n = 0; n < N; n++) {
      $.G = { loop, rank: 0, pend: [], seed: n + 1 }; // a run seed per roll: build rolls draw the stage build stream (src/rng.ts, B2), not R()
      for (const e of biomeScript(seg, bk, from)) {
        const s = e.f.toString();
        if (/midboss\(/.test(s)) { maw = ((e.x + 150 - a) / (z - a)).toFixed(3); continue; } // its WARNING; it lands ~150px later
        if (/logLine|miniWarn/.test(s)) continue;
        const q = (e.x - a) / (z - a), k = BK.find((k) => q >= k[1] && q < k[2]) || BK[4];
        c[k[0]]++; tot++;
      }
    }
    out[`L${loop} s${seg} ${bk}`] = { tot: tot / N, maw, br: qA.toFixed(2) + '-' + qZ.toFixed(2), b: BK.map(([k, l, h]) => [k, c[k] / N, c[k] / N / ((h - l) * (z - a) / 60)]) };
  }
  $.G = G0;
  return out;
}, +N);
await b.close();
if (SAVE) writeFileSync(SAVE, JSON.stringify(res));
const old = CMP && JSON.parse(readFileSync(CMP, 'utf8')), f = (v) => v.toFixed(2).padStart(5);
console.log('stage'.padEnd(13) + ['intro', 'build', 'breath', 'peak', 'tail'].map((k) => k.padStart(14)).join('') + '   total' + (old ? '  before  delta' : ''));
for (const [k, r] of Object.entries(res)) {
  let s = k.padEnd(13) + r.b.map(([, c, ps]) => `${c.toFixed(1).padStart(5)} @${f(ps)}/s`.padStart(14)).join('') + r.tot.toFixed(1).padStart(8);
  if (old) s += old[k].tot.toFixed(1).padStart(8) + ((r.tot / old[k].tot - 1) * 100).toFixed(0).padStart(6) + '%';
  s += `  breath p=${r.br}` + (r.maw ? `  mid p=${r.maw}` : '');
  console.log(s);
}
ranOn('density-probe');
