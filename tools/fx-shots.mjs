// FX shots: hit sparks (Open Orbit, ice, fire, acid, snot), death explosions (small / medium / boss-size, mid-animation),
// the title eye and a few hi-res EYEQ eyes, for checking the sprite FX in tools/prep_fx.py + src/fx/fxsprites.ts.
// Usage: node tools/fx-shots.mjs <url> <outDir>      (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(1500);
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts');
  const XS = await import('/src/fx/fxsprites.ts'), PL = await import('/src/player.ts'), FX = await import('/src/fx/spawn.ts'), GF = await import('/src/fx/gunfx.ts'), BI = await import('/src/biomes.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  const m = window.__fx = { $, W, ST, SP, C, IN, RS, FX, GF, BI, PL, XS, shoot: 0 };
  window.__fxClear = () => {
    m.$.G.si = m.$.G.script.length; m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.$.G.mini = null; m.$.G.banner = null; if (m.$.G.pend) m.$.G.pend.length = 0;
    for (const a of [m.W.enemies, m.W.eshots, m.W.caps, m.W.shots, m.W.gibs, m.W.drops, m.W.mists, m.W.sparks, m.W.texts, m.W.flashes, m.W.splats]) if (a) a.length = 0;
  };
  window.__fxStep = (n, py = 135) => { for (let i = 0; i < n; i++) { Object.assign(m.$.P, { x: 60, y: py, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; if (m.shoot && m.$.P.cd <= 0) m.PL.fire(); m.ST.step(); } m.RS.render(); };
  window.__fxBiome = (bk) => {
    window.__fxClear(); m.$.G.scroll = 2300;
    m.BI.openFork(0); m.$.G.fork.opts = [bk, bk]; m.$.G.fork.t = 50;
    Object.assign(m.$.P, { x: m.C.W * .74, y: m.$.G.fork.gy[0], alive: true, inv: 30 });
    m.ST.step(); m.$.G.scroll = 3300;
    window.__fxStep(60);
  };
  // a fake target soaking hits: a stream of impacts walking along a line, with the spray at all ages
  window.__fxHits = (x, y, n = 8) => {
    const e = { x, y, r: 10, dead: false, big: 1, burn: 0 };
    for (let k = 0; k < n; k++) {
      m.GF.impact(e, 1 + (k % 4) * .8, x + (k % 3) * 22, y + ((k * 7) % 5 - 2) * 9, 1, k === n - 2 ? 2 : 1);
      window.__fxStep(2);
    }
  };
});
const rect = () => p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
async function shot(name, gx, gy, half) {
  await p.screenshot({ path: `${OUT}/${name}-full.png` });
  const r = await rect();
  const x = Math.max(0, r.x + (gx - half) * r.s), y = Math.max(0, r.y + (gy - half) * r.s);
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x, y, width: half * 2 * r.s, height: half * 2 * r.s } });
}

// --- hit sparks: real fire into a drone formation (Open Orbit), then staged impacts in each biome ---
await p.evaluate(() => { window.__fxClear(); const m = window.__fx; m.shoot = 1; Object.assign(m.$.P, { double: 1, options: 2, missile: 1 }); m.$.G.gm = { cal: 2, rapid: 1 }; m.SP.formation('wall', 135, 6); });
let best = 0;
for (let i = 0; i < 60; i++) {
  await p.evaluate(() => window.__fxStep(4));
  const n = await p.evaluate(() => window.__fx.W.enemies.filter((e) => e.x < 300).length);
  if (n >= 3) { best = 1; break; }
}
await p.evaluate(() => { const m = window.__fx; m.$.G.banner = null; window.__fxStep(1); });
await shot('sparks-orbit-fight', 340, 135, 90);
await p.evaluate(() => { window.__fxClear(); window.__fx.shoot = 0; window.__fxHits(220, 135); });
await shot('sparks-orbit', 245, 135, 40);
// --- explosions: small, medium, boss-size, a few frames in ---
for (const [name, sz, n] of [['boom-small', .7, 6], ['boom-small2', 1, 12], ['boom-mid', 2.4, 8], ['boom-mid2', 1.6, 18], ['boom-big', 5, 6], ['boom-big2', 5, 24]]) {
  const dx = await p.evaluate(([sz, n]) => { window.__fxClear(); const m = window.__fx; m.$.G.shake = 0; m.FX.gore(240, 135, sz, { dir: 1 }); let dx = 0; for (let i = 0; i < n; i++) { m.$.G.shake = 0; window.__fxStep(1); dx += m.$.G.scrollSpeed * .5; } m.$.G.shx = m.$.G.shy = 0; m.RS.render(); return dx; }, [sz, n]);
  await shot(name, 240 - dx, 135, sz >= 3 ? 70 : 34);
}
// explosion sprites alone (no gore on top), to judge the art
for (const [name, sz, n] of [['boomonly-small', .8, 5], ['boomonly-mid', 2.4, 7], ['boomonly-big', 5, 14]]) {
  const dx = await p.evaluate(([sz, n]) => { window.__fxClear(); const m = window.__fx; m.XS.boom(240, 135, sz); let dx = 0; for (let i = 0; i < n; i++) { m.$.G.shake = 0; window.__fxStep(1); dx += m.$.G.scrollSpeed * .5; } m.$.G.shx = m.$.G.shy = 0; m.RS.render(); return dx; }, [sz, n]);
  await shot(name, 240 - dx, 135, sz >= 3 ? 60 : 30);
}
for (const bk of ['ice', 'fire', 'acid', 'snot']) {
  await p.evaluate((bk) => { window.__fxBiome(bk); window.__fxClear(); window.__fxHits(220, 135); }, bk);
  await shot('sparks-' + bk, 245, 135, 40);
}
// --- eyes: title hero, then hi-res EYEQ eyes on corpses / crawler / ship ---
await p.evaluate(() => { const m = window.__fx; m.$.state = 'title'; for (let i = 0; i < 4; i++) m.RS.render(); });
await shot('eye-title', 355, 135, 80);
await p.evaluate(() => { window.__fx.$.state = 'play'; });
await p.evaluate(() => { window.__fxClear(); window.__fx.$.G.mini = null; window.__fx.SP.formation('sine', 120, 5); });
for (let i = 0; i < 20; i++) await p.evaluate(() => window.__fxStep(4, 240));
const ds = await p.evaluate(() => window.__fx.W.enemies.filter((e) => e.x > 40 && e.x < 440).map((e) => ({ x: e.x, y: e.y, k: e.k })));
if (ds[0]) await shot('eye-drones', ds[0].x, ds[0].y, 40);
// gib eyes from a big kill
await p.evaluate(() => { window.__fxClear(); const m = window.__fx; m.FX.gore(240, 135, 4, { dir: 1, eyes: 6 }); window.__fxStep(14); });
await shot('eye-gibs', 240, 140, 50);
// a grid of EYEQ eyes in the colours the game uses, at a few sizes (variants: colour shift + odd pupils)
await p.evaluate(async () => {
  const m = window.__fx, E = await import('/src/render/eyes.ts');
  window.__fxClear(); window.__fxStep(1);
  const cols = ['#b01018', '#8a9a22', '#8a0f12', '#9fd8ff', '#3b6fd0', '#6a3b1c', '#e8b818', '#c8a020', '#ffb347', '#9a5aff', '#c8ac3a', '#ff3a10'];
  m.C.ctx.setTransform(1, 0, 0, 1, 0, 0);
  let i = 0;
  for (const r of [3, 5.5, 8]) for (const c of cols) {
    const x = 20 + (i % 12) * 38, y = 40 + Math.floor(i / 12) * 60 + (r - 3) * 2;
    E.eye(m.C.ctx, x, y, r, { iris: c, ang: (i * 1.7) % 6.28, m: .5, bs: 1 + (i % 4) * .5, fire: c === '#ff3a10' });
    i++;
  }
  E.drawEyeQ();
});
await shot('eye-grid', 240, 110, 100);
await shot('eye-grid-big', 120, 165, 40);
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
