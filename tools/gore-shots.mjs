// Gore shots (LS2 S2-K1): the same seeded heavy kill and Maw death every run, so a render change can be judged side by side.
// Saves full-frame PNGs named <tag>-<scene>-f<frame>.png and prints the live gib count by kind at each one.
// Usage: node tools/gore-shots.mjs <url> <outDir> <tag> [--layout long4|short]   (needs the VITE dev server: imports live modules)
// Not measured: boss deaths other than the Maw, and any biome but snot (heavy kill) and acid (Maw).
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, OUT, TAG] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  let s = 12345; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {}
});
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'gore-shots');
await p.waitForTimeout(8000); // the boot warm-up: eyes and sprites, so the shots show the finished art
const prep = (scene) => p.evaluate(async (scene) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const RS = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts'), WU = await import('/src/render/warmup.ts'), FX = await import('/src/fx/spawn.ts');
  const $ = S.$, biome = scene === 'heavy' ? 'snot' : 'acid', x0 = LY.slotRow(0).x0; $.gate = false; IN.K.KeyZ = true;
  F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step();
  $.G.scroll = x0; $.G.si = $.G.script.length; W.enemies.length = 0;
  BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
  Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step(); $.G.scroll = x0 + 1000;
  for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
  $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  WU.warmNow(['brood', 'maw:acid']);
  if (scene === 'heavy') SP.midboss('brood', BI.MID_NAMES.brood, biome); else { SP.maw(true); $.G.mini.biome = biome; $.G.mini.title = 'T'; }
  const m = $.G.mini;
  const adv = (n) => { for (let i = 0; i < n; i++) { Object.assign($.P, { x: 90, y: 135, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; ST.step(); RS.render(); } };
  adv(100); m.hp = .01; let f = 0; while ($.G.mini && !m.dead && f++ < 400) adv(1);
  if (scene === 'heavy') for (let k = 0; k < 3; k++) FX.gore(150 + k * 90, 110 + k * 25, 4, { limbs: 2, eyes: 1, teeth: 3, rope: 2, metal: 3, skull: 1 }); // the crowd dying with it
  window.__adv = adv; window.__gibs = () => { const n = {}; for (const q of W.gibs) n[q.k] = (n[q.k] || 0) + 1; return { n, mists: W.mists.length, drops: W.drops.length }; };
}, scene);
let at = 0;
for (const [scene, frames] of [['heavy', [12, 40, 240]], ['maw', [30, 90]]]) {
  await prep(scene); at = 0;
  for (const f of frames) {
    await p.evaluate((n) => window.__adv(n), f - at); at = f;
    await p.screenshot({ path: `${OUT}/${TAG}-${scene}-f${f}.png` });
    console.log(scene, 'f' + f, JSON.stringify(await p.evaluate(() => window.__gibs())));
  }
}
console.log(errs.length ? 'errors:\n' + errs.join('\n') : 'errors: none');
ranOn('gore-shots'); await b.close();
