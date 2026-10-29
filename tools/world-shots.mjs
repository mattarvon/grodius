// World shots: Open Orbit sky (Neptune + Triton), a derelict corridor stretch and the ice biome, as full frames.
// Usage: node tools/world-shots.mjs <url> <outDir>      (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(1500);
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts'), BI = await import('/src/biomes.ts');
  window.__w = { S, W, ST, F, C, IN, RS, BI };
  window.__clear = () => { const $ = S.$; $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null; for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops]) if (a) a.length = 0; };
  window.__go = (sc, n = 30, keep) => { const $ = S.$; if (!keep) window.__clear(); $.G.scroll = sc; for (let i = 0; i < n; i++) { Object.assign($.P, { x: 60, y: C.PH / 2, alive: true, inv: 30 }); ST.step(); $.G.scroll = sc + i * .5; } RS.render(); };
});
const fresh = (loop = 0) => p.evaluate((loop) => { const { S, F, ST, IN } = window.__w; S.$.gate = false; IN.K.KeyZ = false; F.newGame(0); S.$.state = 'play'; S.$.G.loop = loop; for (let i = 0; i < 30; i++) ST.step(); }, loop);
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });

await fresh(0);
for (const sc of [300, 1300, 2000]) { await p.evaluate((sc) => window.__go(sc, 240, true), sc); await shot(`orbit-d1-${sc}`); }
await fresh(1);
await p.evaluate(() => window.__go(1300, 240, true)); await shot('orbit-d2-1300');
// ice: fork into ice twice
await fresh(0);
await p.evaluate(() => { const { S, BI, C, ST } = window.__w, $ = S.$; window.__clear(); $.G.scroll = 2300; BI.openFork(0); $.G.fork.opts = ['ice', 'ice']; $.G.fork.t = 50; Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step(); });
for (const sc of [3000, 3400, 3900, 4400]) { await p.evaluate((sc) => window.__go(sc, 240), sc); await shot(`ice-${sc}`); }
// the derelict corridor: no biome route past slot 1, so the corridor stretches stand bare
await fresh(0);
for (const sc of [5600, 6400, 7200, 8600]) { await p.evaluate((sc) => window.__go(sc, 240), sc); await shot(`corridor-${sc}`); }
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
