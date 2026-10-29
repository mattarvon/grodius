// New-enemy shots: the snot slime, hulking mutant and MERIDIAN security drone, each alive, mid-attack and dying, in
// its real stage (sentry: Open Orbit; slime: the Sinus; mutant: the Cryovault and the Furnace). Same approach as
// tools/upgrade-shots.mjs: live modules in headless Chromium, real spawn functions, biomes entered through openFork.
// Usage: node tools/newenemy-shots.mjs <url> <outDir>      (needs the VITE dev server)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(800); // sprite strips load
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), UP = await import('/src/enemies/update.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts');
  const BI = await import('/src/biomes.ts'), SR = await import('/src/sprites.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  window.__us = { $, W, ST, SP, UP, C, IN, RS, BI, SR, py: 200, px: 40 };
  window.__usClear = () => {
    const m = window.__us; m.$.G.si = m.$.G.script.length; m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.$.G.mini = null;
    for (const a of [m.W.enemies, m.W.eshots, m.W.caps, m.W.shots, m.W.gibs, m.W.drops]) if (a) a.length = 0;
  };
  window.__usStep = (n) => { const m = window.__us; for (let i = 0; i < n; i++) { Object.assign(m.$.P, { x: m.px, y: m.py, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; m.ST.step(); } m.RS.render(); };
  window.__usBiome = (b, scroll) => {
    const m = window.__us;
    window.__usClear(); m.$.G.route = [null, null]; m.$.G.scroll = 2300;
    m.BI.openFork(0); m.$.G.fork.opts = [b, b]; m.$.G.fork.t = 50;
    Object.assign(m.$.P, { x: m.C.W * .74, y: m.$.G.fork.gy[0], alive: true, inv: 30 });
    m.ST.step(); m.$.G.scroll = scroll;
    window.__usStep(60); window.__usClear();
  };
  window.__usFind = (k) => { const e = window.__us.W.enemies.find((e) => e.k === k); return e ? { x: e.x, y: e.y, r: e.r, st: e.st, wt: e.wt, air: e.air } : null; };
});
console.log('sprites ready:', await p.evaluate(() => ['slime-idle', 'mutant-walk', 'sentry'].map((k) => window.__us.SR.sprReady(k))));
const rect = () => p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
async function shot(name, gx, gy, half) {
  await p.screenshot({ path: `${OUT}/${name}-full.png` });
  const r = await rect();
  const x = Math.max(0, r.x + (gx - half) * r.s), y = Math.max(0, r.y + (gy - half) * r.s);
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x, y, width: half * 2 * r.s, height: half * 2 * r.s } });
  console.log(`${name}: at ${gx | 0},${gy | 0}`);
}
const step = (n) => p.evaluate((n) => window.__usStep(n), n);
const find = (k) => p.evaluate((k) => window.__usFind(k), k);
/** step until pred(e) (a JS expression on e) holds for the first enemy of kind k */
async function until(k, pred, max = 900) {
  for (let t = 0; t < max; t++) {
    const ok = await p.evaluate(([k, pred]) => { const e = window.__us.W.enemies.find((e) => e.k === k); return !!(e && new Function('e', 'return ' + pred)(e)); }, [k, pred]);
    if (ok) return find(k);
    await step(1);
  }
  console.log(`${k}: never reached ${pred}`); return find(k);
}
async function kill(k) { await p.evaluate((k) => { const m = window.__us, e = m.W.enemies.find((e) => e.k === k); if (e) m.UP.hurt(e, 999, e.x, e.y, 1); }, k); }

async function trio(tag, k, spawn, half, atk, dieN = 6, focus = null) {
  await p.evaluate(`(() => { const SP = window.__us.SP; ${spawn}; })()`);
  let e = await until(k, 'e.x < 400 && e.t > 30');
  if (!e) return console.log(`${tag}: never spawned`);
  await shot(`${tag}-alive`, e.x, (focus ?? e.y), half);
  e = await until(k, atk);
  await shot(`${tag}-attack`, e.x - 20, (focus ?? e.y), half + 14);
  await step(1);
  e = await find(k);
  await kill(k);
  await step(dieN);
  await shot(`${tag}-dying`, e.x, (focus ?? e.y), half + 18);
  await step(18);
  await shot(`${tag}-dying2`, e.x, (focus ?? e.y), half + 30);
}

// 1. MERIDIAN security drone, Open Orbit
await p.evaluate(() => { window.__usClear(); window.__us.$.G.scroll = 700; window.__us.py = 150; });
await trio('sentry', 'sentry', 'SP.sentry(110, 300)', 26, "e.st === 'tel' && e.wt >= 40");
// its burst in flight
await p.evaluate(() => window.__usClear());
await p.evaluate(() => window.__us.SP.sentry(110, 300));
let e = await until('sentry', "e.st === 'fire' && e.wt >= 16");
await shot('sentry-burst', e.x - 60, e.y + 20, 80);

// 2. snot slime, the Sinus (floor and ceiling)
await p.evaluate(() => { window.__usBiome('snot', 3300); window.__us.py = 135; });
await trio('slime', 'slime', 'SP.slime(1)', 24, "e.st === 'tel' && e.wt >= 22");
await p.evaluate(() => window.__usClear());
await trio('slime-ceiling', 'slime', 'SP.slime(-1)', 24, "e.st === 'spit' && e.wt >= 3");
await p.evaluate(() => window.__usClear());
await p.evaluate(() => { window.__us.SP.slime(1); window.__us.SP.slime(-1); });
e = await until('slime', 'e.x < 300 && e.t > 60');
await step(30);
await shot('slime-pair', e.x, 135, 110);

// 3. hulking mutant, the Cryovault and the Furnace
await p.evaluate(() => { window.__usBiome('ice', 3400); window.__us.py = 120; });
await trio('mutant-ice', 'mutant', 'SP.mutant()', 34, "e.st === 'tel' && e.wt >= 30", 8);
await p.evaluate(() => window.__usClear());
await p.evaluate(() => window.__us.SP.mutant());
e = await until('mutant', "e.st === 'hurl' && e.wt >= 22");
await shot('mutant-ice-hurl', e.x - 80, e.y - 30, 100);
await p.evaluate(() => { window.__usBiome('fire', 3600); window.__us.py = 110; });
await trio('mutant-fire', 'mutant', 'SP.mutant()', 34, "e.st === 'hurl' && e.wt >= 4", 14);
fs.writeFileSync(`${OUT}/errors.txt`, errs.join('\n'));
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
