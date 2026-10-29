// UFO shots: THE SQUIDFUCKED SAUCER (Open Orbit midboss, enemies/ufo.ts + render/gross/ufo.ts) at 2x: the WARNING, idle, each
// attack's telegraph and release, wounded (last damage sheet + hull cracks), and the death (hull split, tentacle flood).
// Saves full-frame + close-up PNGs.
// Usage: node tools/ufo-shots.mjs <url> <outDir>      (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
const [url, OUT] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(800); // sprites load
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const UF = await import('/src/enemies/ufo.ts'), IN = await import('/src/input.ts'), U = await import('/src/enemies/update.ts'), RS = await import('/src/render/screens.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  $.G.scroll = UF.UFO_AT - 1; $.G.si = $.G.script.length; W.enemies.length = 0; W.eshots.length = 0;
  for (let i = 0; i < 300; i++) ST.step(); // past the stage card
  $.G.scroll = UF.UFO_AT - 1; $.G.si = $.G.script.length; W.enemies.length = 0; W.eshots.length = 0;
  UF.ufoWarn();
  window.__ms = { $, ST, W, U, RS };
  window.__msStep = (n, hpf, rend = n <= 40) => {
    const m = window.__ms;
    for (let i = 0; i < n; i++) {
      const g = m.$.G.mini; if (hpf != null && g && !g.dead) g.hp = Math.min(g.hp, g.max * hpf);
      Object.assign(m.$.P, { x: 90, y: 160, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0;
      m.ST.step(); if (rend) m.RS.render();
    }
  };
});
const shot = async (name, wide) => {
  await p.evaluate(async () => { const { render } = await import('/src/render/screens.ts'); render(); });
  await p.screenshot({ path: `${OUT}/${name}.png` });
  if (wide) return;
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(), g = window.__ms.$.G.mini; return { x: c.x, y: c.y, s: c.width / 480, gx: g ? g.x : 384, gy: g ? g.y : 120 }; });
  await p.screenshot({ path: `${OUT}/${name}-zoom.png`, clip: { x: r.x + (r.gx - 85) * r.s, y: Math.max(0, r.y + (r.gy - 45) * r.s), width: 160 * r.s, height: 90 * r.s } });
};
// force the next attack (att % 4: 0 lash, 1 swell, 2 lash, 3 brood) and step to wt = w of state st
const attack = (a, st, w) => p.evaluate(([a, st, w]) => {
  const g = window.__ms.$.G.mini; g.st = 'idle'; g.att = a; g.wt = g.cool - 1;
  let k = 0; while (!(g.st === st && g.wt >= w) && k++ < 400) window.__msStep(1, null, false);
  window.__msStep(1);
}, [a, st, w]);
await p.evaluate(() => window.__msStep(70)); await shot('ufo-warning', true);
await p.evaluate(() => { window.__msStep(200, null, false); window.__msStep(30); }); await shot('ufo-idle');
await attack(0, 'lash', 32); await shot('ufo-lash-tel');
await attack(0, 'whip', 10); await shot('ufo-lash-whip');
await attack(1, 'swell', 30); await shot('ufo-volley-tel');
await attack(1, 'swell', 40); await shot('ufo-volley-burst');
await attack(3, 'brood', 34); await shot('ufo-brood-tel');
await attack(3, 'brood', 48); await shot('ufo-brood-drop');
await p.evaluate(() => window.__msStep(120, .55, false)); await p.evaluate(() => window.__msStep(20)); await shot('ufo-hurt');
await p.evaluate(() => window.__msStep(120, .25, false)); await p.evaluate(() => window.__msStep(30)); await shot('ufo-wounded');
await p.evaluate(() => { const m = window.__ms, g = m.$.G.mini; g.hp = 0; m.U.killEnemy(g); window.__msStep(8); });
await shot('ufo-death', true);
await p.evaluate(() => window.__msStep(30)); await shot('ufo-death2', true);
await p.evaluate(() => window.__msStep(40)); await shot('ufo-death3', true);
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
