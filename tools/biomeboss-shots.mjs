// Biome boss screenshots: THE BLOATED BITCH (crux) and THE BURNING BUTCHER fought inside their own biome by the
// boss-probe bot (STAGE 1 kit, invincible, parked at x=90 tracking the boss), rendered every frame so the
// render-side gore (src/render/gross/biomebosses.ts) animates. Saves full frames + 2x close-ups per beat:
//   crux:    shielded (bars up), exposed (bars broken), half HP, death
//   butcher: idle, spit, chain snapped (half HP), death
// Usage: node tools/biomeboss-shots.mjs <url> <outDir> [--layout short]   (fights in biome slot 0 of src/layout.ts, stage-relative x 1000)
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, OUT = '.', MODE = 'all'] = process.argv.slice(2); // MODE: all | clean | fight
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'biomeboss-shots');
const prep = (k, biome) => p.evaluate(async ([k, biome]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const { render } = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts'), X0 = LY.slotRow(0).x0;
  const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  $.G.scroll = X0; $.G.si = $.G.script.length; W.enemies.length = 0;
  BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
  Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
  ST.step();
  $.G.scroll = X0 + 1000;
  for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
  $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
  Object.assign($.P, { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1, shield: 3 });
  $.G.gm = { cal: 1 }; $.G.pk = { dmg: 1 }; $.G.lvl = 10;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  SP[k]();
  window.__bb = { $, ST, C, render, f: 0 };
  window.__bbStep = (n, cond) => { // step n frames (or until cond(boss)), rendering each
    const m = window.__bb;
    for (let i = 0; i < n; i++) {
      const g = m.$.G.mini;
      if (cond && g && cond(g)) return 'cond';
      if (g && !g.dead) {
        const y = m.C.clamp(g.y, 8, m.C.PH - 8), P = m.$.P;
        P.hist.unshift({ x: 90, y }); if (P.hist.length > 80) P.hist.pop();
        Object.assign(P, { x: 90, y, alive: true, inv: 30 });
      }
      m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.banner = null;
      m.ST.step(); if (window.__bbClean) { const W = window.__bbW; W.shots.length = 0; W.eshots.length = 0; } m.render(); m.f++;
    }
    return null;
  };
  window.__bbLast = null; window.__bbW = W; window.__bbClean = false;
}, [k, biome]);
const shot = async (name) => {
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(), g = window.__bb.$.G.mini || window.__bbLast; return { x: c.x, y: c.y, s: c.width / 480, gx: g.x, gy: g.y, hw: window.__bbClean ? 60 : 85, hh: window.__bbClean ? 70 : 80, cl: window.__bbClean }; });
  await p.screenshot({ path: `${OUT}/${name}-zoom.png`, clip: { x: r.x + (r.gx - r.hw) * r.s, y: Math.max(r.y, r.y + (r.gy - r.hh) * r.s), width: (r.cl ? 120 : 170) * r.s, height: (r.cl ? 130 : 160) * r.s } });
  console.log('shot', name, await p.evaluate(() => { const g = window.__bb.$.G.mini; return g ? `${g.k} st=${g.st || ''} hp=${g.hp | 0}/${g.max | 0} shielded=${!!g.shielded}` : 'dead'; }));
};
const step = (n, cond) => p.evaluate(([n, c]) => window.__bbStep(n, c ? new Function('g', 'return ' + c) : null), [n, cond]);
const keepLast = () => p.evaluate(() => { const g = window.__bb.$.G.mini; if (g) window.__bbLast = { x: g.x, y: g.y }; });
if (MODE !== 'clean') {
// --- Crucifer ---
await prep('crux', 'ice');
await step(330); await shot('crux-1-shielded');
await step(3000, '!g.shielded'); await step(70); await shot('crux-2-exposed');
await step(3000, 'g.hp < g.max * .5'); await step(60); await shot('crux-3-half');
for (let i = 0; i < 60; i++) { await keepLast(); if (await step(40, 'g.dead || g.hp < g.max * .08')) break; }
await keepLast(); await step(400, 'g.dead'); await step(14); await shot('crux-4-death');
// --- Butcher ---
await prep('butcher', 'fire');
await step(300); await shot('butcher-1-idle');
await step(1500, "g.st === 'spit' && g.wt > 14"); await shot('butcher-2-spit');
await step(3000, 'g.cut'); await step(50); await shot('butcher-3-snapped');
for (let i = 0; i < 60; i++) { await keepLast(); if (await step(40, 'g.dead || g.hp < g.max * .06')) break; }
await keepLast(); await step(400, 'g.dead'); await step(14); await shot('butcher-4-death');
}
// --- clean poses: no shooting, no bullets, so the art itself can be read ---
const pose = async (k, biome, name, setup, n = 90) => {
  await prep(k, biome);
  await p.evaluate(() => { window.__bbClean = true; });
  await step(260);

  if (setup) await p.evaluate((s) => { const g = window.__bb.$.G.mini; new Function('g', s)(g); }, setup);
  await step(n);
  await shot(name);
};
if (MODE !== 'fight') {
await pose('crux', 'ice', 'clean-crux-shielded');
await pose('crux', 'ice', 'clean-crux-broken', 'for (const b of g.bars) { b.dead = true; } g.hp = g.max * .45;');
await pose('butcher', 'fire', 'clean-butcher');
await pose('butcher', 'fire', 'clean-butcher-snapped', 'g.hp = g.max * .45;');
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('biomeboss-shots'); await b.close();
