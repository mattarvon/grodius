// Upgrade shots: renders every regular enemy, the player ship, bullets and a busy gore frame as they look right now, for
// the upgrade picker (tools/upgrade-picker.mjs). Each enemy is spawned alone through its real spawn function and stepped
// on screen, so terrain-bound ones sit on their wall. Saves a full frame and a close-up per subject.
// Usage: node tools/upgrade-shots.mjs <url> <outDir>      (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  window.__us = { $, W, ST, SP, C, IN, RS };
  window.__usClear = () => {
    const m = window.__us; m.$.G.si = m.$.G.script.length; m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.$.G.mini = null;
    for (const a of [m.W.enemies, m.W.eshots, m.W.caps, m.W.shots, m.W.gibs, m.W.drops]) if (a) a.length = 0;
  };
  window.__usStep = (n) => { const m = window.__us; for (let i = 0; i < n; i++) { Object.assign(m.$.P, { x: 40, y: 230, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; m.ST.step(); } m.RS.render(); };
});
const rect = () => p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
async function shot(name, gx, gy, half) {
  await p.screenshot({ path: `${OUT}/${name}-full.png` });
  const r = await rect();
  const x = Math.max(0, r.x + (gx - half) * r.s), y = Math.max(0, r.y + (gy - half) * r.s);
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x, y, width: half * 2 * r.s, height: half * 2 * r.s } });
}

// spawn call, frames to wait for it to come on screen
const KINDS = {
  drone: ['SP.formation("sine", 120, 5)', 'drone'], corpse: ['SP.corpse(120)', 'corpse'], eye: ['SP.eyeT(1)', 'eye'],
  crawler: ['SP.crawler(1)', 'crawler'], hatch: ['SP.hatch(6, false)', 'hatch'], womb: ['SP.womb()', 'womb'],
  cross: ['SP.crossT(1)', 'cross'], hook: ['SP.hookE()', 'hook'], flayer: ['SP.flayer(120)', 'flayer'],
};
const WALLED = new Set(['eye', 'crawler', 'womb', 'cross']); // need cave walls: Open Orbit has none, so they're shot in a biome
const meta = {};
for (const [name, [call, k]] of Object.entries(KINDS)) {
  if (WALLED.has(k)) continue;
  await shoot(name, call, k);
}
await p.evaluate(async () => {
  const m = window.__us, BI = await import('/src/biomes.ts');
  window.__usClear(); m.$.G.scroll = 2300;
  BI.openFork(0); m.$.G.fork.opts = ['ice', 'ice']; m.$.G.fork.t = 50;
  Object.assign(m.$.P, { x: m.C.W * .74, y: m.$.G.fork.gy[0], alive: true, inv: 30 });
  m.ST.step(); m.$.G.scroll = 3300;
  window.__usStep(60);
});
for (const [name, [call, k]] of Object.entries(KINDS)) if (WALLED.has(k)) await shoot(name, call, k);

async function shoot(name, call, k) {
  await p.evaluate(() => window.__usClear());
  let e = null;
  for (let t = 0; t < 600 && !e; t += 4) {
    if (t % 40 === 0 && !(await p.evaluate((k) => window.__us.W.enemies.some((e) => e.k === k), k))) await p.evaluate(`(() => { const SP = window.__us.SP; ${call}; })()`);
    await p.evaluate(() => window.__usStep(4));
    e = await p.evaluate((k) => { const x = window.__us.W.enemies.find((e) => e.k === k && e.x < 330 && e.x > 60); return x ? { x: x.x, y: x.y, r: x.r } : null; }, k);
  }
  if (!e) { console.log(`${name}: never came on screen`); return; }
  await shot(name, e.x, e.y, Math.max(22, e.r * 3.2));
  meta[name] = e; console.log(`${name}: r=${e.r} at ${e.x | 0},${e.y | 0}`);
}

// the player ship firing, then a busy gore frame (a formation shot to pieces)
await p.evaluate(() => { window.__usClear(); window.__us.IN.K.KeyZ = true; });
await p.evaluate(() => window.__usStep(40));
await shot('ship', 40, 230, 30);
await p.evaluate(() => { const m = window.__us; m.SP.formation('wall', 230, 6); });
for (let i = 0; i < 12; i++) await p.evaluate(() => window.__usStep(10));
await shot('gore', 140, 230, 70);
fs.writeFileSync(`${OUT}/meta.json`, JSON.stringify(meta, null, 1));
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
