// Wall-enemy close-ups for the walls art pass: eye / crawler / womb on floor AND ceiling, in a chosen fork biome, with
// their tells forced (eye charging + blinking, crawler gaping / airborne, womb about to birth / just birthed).
// Usage: node tools/walls-shots.mjs <url> <outDir> [biome=ice]       (needs the VITE dev server)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT, BIOME = 'ice'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.evaluate(async (BIOME) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts');
  const BI = await import('/src/biomes.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  window.__us = { $, W, ST, SP, C, IN, RS };
  window.__usClear = () => {
    const m = window.__us; m.$.G.si = m.$.G.script.length; m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.$.G.mini = null;
    for (const a of [m.W.enemies, m.W.eshots, m.W.caps, m.W.shots, m.W.gibs, m.W.drops]) if (a) a.length = 0;
  };
  window.__usStep = (n) => { const m = window.__us; for (let i = 0; i < n; i++) { Object.assign(m.$.P, { x: 40, y: 135, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; m.ST.step(); } m.RS.render(); };
  window.__usClear(); $.G.scroll = 2300;
  BI.openFork(0); $.G.fork.opts = [BIOME, BIOME]; $.G.fork.t = 50;
  Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
  ST.step(); $.G.scroll = 3300;
  window.__usStep(60);
}, BIOME);
const rect = () => p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
async function shot(name, gx, gy, half) {
  const r = await rect();
  const x = Math.max(0, r.x + (gx - half) * r.s), y = Math.max(0, r.y + (gy - half) * r.s);
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x, y, width: half * 2 * r.s, height: half * 2 * r.s } });
}
// [name, spawn call, kind, field overrides applied (and held) for the last frames]
const CASES = [
  ['eye-floor', 'SP.eyeT(1)', 'eye', {}], ['eye-floor-charge', 'SP.eyeT(1)', 'eye', { cool: 6 }], ['eye-floor-blink', 'SP.eyeT(1)', 'eye', { blink: 6, cool: 80 }],
  ['eye-ceil', 'SP.eyeT(-1)', 'eye', { cool: 80 }], ['eye-ceil-charge', 'SP.eyeT(-1)', 'eye', { cool: 6 }],
  ['crawler-floor', 'SP.crawler(1)', 'crawler', { cool: 80 }], ['crawler-floor-gape', 'SP.crawler(1)', 'crawler', { cool: 3 }],
  ['crawler-ceil', 'SP.crawler(-1)', 'crawler', { cool: 80 }],
  ['womb', 'SP.womb()', 'womb', { cool: 60 }], ['womb-prebirth', 'SP.womb()', 'womb', { cool: 3 }], ['womb-birth', 'SP.womb()', 'womb', { cool: 112 }],
];
for (const [name, call, k, ov] of CASES) {
  await p.evaluate(() => window.__usClear());
  let e = null;
  for (let t = 0; t < 800 && !e; t += 4) {
    if (t % 40 === 0 && !(await p.evaluate((k) => window.__us.W.enemies.some((e) => e.k === k), k))) await p.evaluate(`(() => { const SP = window.__us.SP; ${call}; })()`);
    await p.evaluate(() => window.__usStep(4));
    e = await p.evaluate((k) => { const x = window.__us.W.enemies.find((e) => e.k === k && e.x < 330 && e.x > 100); return x ? 1 : null; }, k);
  }
  if (!e) { console.log(`${name}: never came on screen`); continue; }
  const at = await p.evaluate(([k, ov]) => {
    const m = window.__us, x = m.W.enemies.find((e) => e.k === k);
    m.W.eshots.length = 0; m.W.enemies.length = 0; m.W.enemies.push(x);
    if (k === 'womb') m.W.enemies.forEach(() => 0);
    Object.assign(x, ov); m.RS.render();
    m.W.enemies.length = 0; m.W.enemies.push(x); m.W.enemies = m.W.enemies;
    return { x: x.x, y: x.y };
  }, [k, ov]);
  await shot(name, at.x, at.y, +(process.env.HALF || 30));
  console.log(name, at.x | 0, at.y | 0);
}
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
