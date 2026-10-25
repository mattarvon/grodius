// Maw shots: renders each Maw variant (Open Orbit / acid THE DISSOLVED MAW / snot THE MUCUS MAW) mid-fight at 2x, at a few
// moments of its 130-frame cycle (idle, jaw telegraph, spew, wounded, and the death rupture), and saves full-frame + close-up PNGs.
// Usage: node tools/maw-shots.mjs <url> <outDir>      (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
const [url, OUT] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
const prep = (biome) => p.evaluate(async (biome) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const U = await import('/src/enemies/update.ts'), RS = await import('/src/render/screens.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  $.G.scroll = biome ? 2300 : 2000; $.G.si = $.G.script.length; W.enemies.length = 0;
  if (biome) {
    BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
    Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
    ST.step(); $.G.scroll = 3300;
    for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
  }
  $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  SP.maw(true); if (biome) { $.G.mini.biome = biome; $.G.mini.title = BI.BIOMES[biome].bossName; }
  window.__ms = { $, ST, C, W, U, RS };
  window.__msStep = (n, hpf, rend = n <= 40) => {
    const m = window.__ms;
    for (let i = 0; i < n; i++) {
      const g = m.$.G.mini; if (hpf != null && g && !g.dead) g.hp = Math.min(g.hp, g.max * hpf);
      Object.assign(m.$.P, { x: 70, y: 200, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0;
      m.ST.step(); if (rend) m.RS.render();
    }
  };
}, biome);
const shot = async (name) => {
  await p.evaluate(async () => { const { render } = await import('/src/render/screens.ts'); render(); });
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(), g = window.__ms.$.G.mini; return { x: c.x, y: c.y, s: c.width / 480, gx: g ? g.x : 380, gy: g ? g.y : 135 }; });
  await p.screenshot({ path: `${OUT}/${name}-zoom.png`, clip: { x: r.x + (r.gx - 80) * r.s, y: Math.max(0, r.y + (r.gy - 55) * r.s), width: 140 * r.s, height: 110 * r.s } });
};
// frame offsets: the Maw's cycle is e.t % 130; jaw opens 80..120, spits at 100
const stepTo = (cyc) => p.evaluate((cyc) => { let n = 0; while (((window.__ms.$.G.mini.t + 30) % 130) !== cyc && n++ < 200) window.__msStep(1, null, false); window.__msStep(30); }, cyc);
for (const [tag, biome] of [['orbit', null], ['acid', 'acid'], ['snot', 'snot']]) {
  await prep(biome);
  await p.evaluate(() => window.__msStep(240));
  await stepTo(40); await shot(`maw-${tag}-idle`);
  await stepTo(96); await shot(`maw-${tag}-tel`);
  await stepTo(106); await shot(`maw-${tag}-spew`);
  await p.evaluate(() => window.__msStep(170, .3)); await stepTo(60); await shot(`maw-${tag}-wounded`);
  await p.evaluate(() => { const m = window.__ms, g = m.$.G.mini; g.hp = 0; m.U.killEnemy(g); window.__msStep(10); });
  await shot(`maw-${tag}-death`);
  await p.evaluate(() => window.__msStep(30)); await shot(`maw-${tag}-death2`);
  console.log('done', tag);
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
