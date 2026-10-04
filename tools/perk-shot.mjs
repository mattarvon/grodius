// Pick-screen screenshots: starts a run, plays a bit, forces level-ups (optionally with given visited biomes / perks)
// and screenshots the pick screen + HUD. Usage: node tools/perk-shot.mjs <url> <outdir> [visited=ice,acid] [pk json]
import { chromium } from 'playwright';
const [url, out, vis = '', pkj = '{}', force = ''] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = (f) => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true; } q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 60000 });
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
await p.evaluate('__tick(400)');
await p.evaluate(([v, k]) => { const G = __G().G; G.visited = v ? v.split(',') : []; G.seenV = G.visited.length; G.boostReq = G.visited.at(-1) || null; Object.assign(G.pk, JSON.parse(k)); G.lvl = 6; G.xp = 30; G.pickQ = 2; __G().P.wardLv = 1; }, [vis, pkj]);
await p.evaluate('__tick(20)');
if (force) await p.evaluate((f) => { __G().G.pick.opts = f.split(','); }, force);
await p.screenshot({ path: `${out}/pick-early.png` });
await p.evaluate('__tick(30)');
await key('keyup', 'KeyZ'); await p.evaluate('__tick(4)'); await key('keydown', 'KeyZ'); await p.evaluate('__tick(14)');
await p.screenshot({ path: `${out}/perks.png` });
console.log(await p.evaluate(() => JSON.stringify(__G().G.pick)));
await p.evaluate('__tick(20)');
console.log('after hold', await p.evaluate(() => JSON.stringify([__G().G.pick && __G().G.pick.opts, __G().G.pk])));
await key('keyup', 'KeyZ'); await p.evaluate('__tick(60)');
await p.screenshot({ path: `${out}/hud.png` });
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
