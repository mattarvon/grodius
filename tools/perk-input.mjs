// Pick-screen input test: held fire / mashed fire must not pick; release+hold, Enter, arrows, mouse hover + click work.
// Usage: node tools/perk-input.mjs <url>
import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = (f) => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true; } q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 60000 });
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
const tick = (n) => p.evaluate((n) => __tick(n), n);
const st = () => p.evaluate(() => { const G = __G().G; return { open: !!G.pick, sel: G.pick && G.pick.sel, n: Object.values(G.pk).reduce((a, b) => a + b, 0) }; });
const open = async () => { await p.evaluate(() => { const G = __G().G; G.pickQ = 1; G.pickGap = 0; }); await tick(2); };
await key('keydown', 'KeyA'); await tick(5); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await tick(2); await key('keyup', 'Enter'); await tick(200);
const R = [];
// 1. fire held through the opening, kept held for 3 s
await key('keydown', 'KeyZ'); await open(); await tick(180); R.push(['held fire 3s', (await st()).open ? 'still open (ok)' : 'PICKED (bad)']);
// 2. mash: 4 frames down, 4 up, for 3 s
await key('keyup', 'KeyZ');
for (let i = 0; i < 22; i++) { await key('keydown', 'KeyZ'); await tick(4); await key('keyup', 'KeyZ'); await tick(4); }
R.push(['mashed fire 3s', (await st()).open ? 'still open (ok)' : 'PICKED (bad)']);
// 3. arrows move the selection
const s0 = (await st()).sel; await key('keydown', 'ArrowRight'); await tick(2); await key('keyup', 'ArrowRight'); await tick(2);
const s1 = (await st()).sel; await key('keydown', 'ArrowUp'); await tick(2); await key('keyup', 'ArrowUp'); await tick(2);
R.push(['right / up', `${s0} -> ${s1} -> ${(await st()).sel}`]);
// 4. release + hold 30 frames grafts
let n0 = (await st()).n; await key('keydown', 'KeyZ'); await tick(30); await key('keyup', 'KeyZ'); R.push(['hold fire 30f', (await st()).open ? 'not picked (bad)' : `picked (+${(await st()).n - n0})`]);
// 5. Enter grafts (after lockout)
await open(); await key('keydown', 'Enter'); await tick(2); await key('keyup', 'Enter'); R.push(['Enter inside lockout', (await st()).open ? 'ignored (ok)' : 'PICKED (bad)']);
await tick(40); n0 = (await st()).n; await key('keydown', 'Enter'); await tick(2); await key('keyup', 'Enter'); R.push(['Enter after lockout', (await st()).open ? 'not picked (bad)' : `picked (+${(await st()).n - n0})`]);
// 6. mouse hover selects, click grafts
await open(); await tick(40);
const box = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { l: c.left, t: c.top, w: c.width, h: c.height }; });
const at = (gx, gy) => ({ x: box.l + gx / 480 * box.w, y: box.t + gy / 270 * box.h });
let pt = at(240 - 151, 120); await p.mouse.move(pt.x, pt.y); await tick(2); R.push(['hover left card', 'sel=' + (await st()).sel]);
pt = at(240 + 151, 120); await p.mouse.move(pt.x, pt.y); await tick(2); R.push(['hover right card', 'sel=' + (await st()).sel]);
n0 = (await st()).n; await p.mouse.down(); await p.mouse.up(); await tick(2); R.push(['click right card', (await st()).open ? 'not picked (bad)' : `picked (+${(await st()).n - n0})`]);
for (const [a, r] of R) console.log(a.padEnd(22), r);
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
