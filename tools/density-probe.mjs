// Density probe: builds every biome script (4 biomes x 2 segs x loop 0/1, averaged over N rolls) straight from
// biomeScript and prints spawn calls per pacing beat (intro/build/breath/peak/tail) as count and spawns/s (60px = 1s).
// Each slot is built from where choose() puts it in practice (fork scroll + W + 10 = 2658 / 5637).
// Set pieces count as one call; logs, the biome midboss (mid p= is where it lands) and the boss don't count.
// Usage: node tools/density-probe.mjs <url> [N=400] [save.json] [compare.json]
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [url, N = '400', SAVE, CMP] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; });
await p.goto(url); await p.waitForFunction(() => window.__started);
const res = await p.evaluate(async (N) => {
  const { biomeScript, BIOMES, SEG } = await import('/src/biomes.ts'), { $ } = await import('/src/state.ts');
  const FROM = [2658, 5637], out = {}, G0 = $.G;
  for (const loop of [0, 1]) for (let seg = 0; seg < 2; seg++) for (const bk of Object.keys(BIOMES)) {
    const g = SEG[seg], a = Math.max(g.x0 + 220, FROM[seg] + 60), z = g.bossX - 160, mid = Math.round((a + z) / 2);
    // breath window as biomeScript places it: p .45-.55, or in seg 1 the 10% ending just past the midboss
    const qZ = seg === 1 ? Math.max(.55, (mid + 260 - a) / (z - a)) : .55, qA = qZ - .1;
    const BK = [['intro', 0, .2], ['build', .2, qA], ['breath', qA, qZ], ['peak', qZ, .9], ['tail', .9, 1]], c = Object.fromEntries(BK.map((k) => [k[0], 0]));
    let tot = 0, maw = null;
    for (let n = 0; n < N; n++) {
      $.G = { loop, rank: 0 };
      for (const e of biomeScript(seg, bk, FROM[seg])) {
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
