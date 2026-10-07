// Infirmary probe: opens the shop from the title with a given save, drives it with keys / mouse / touch, screenshots each state.
// Usage: node tools/shop-probe.mjs <url> <outdir>
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
const errs = [];
async function page(meta, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, hasTouch: !!opts.touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((sv) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0;
    try { localStorage.clear(); if (sv) localStorage.setItem('grodius.v1', JSON.stringify(sv)); } catch (e) {}
    window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; q.splice(0).forEach((f) => f(now)); } }; }, meta && { meta, hi: 0, muted: true });
  await p.goto(url); await p.waitForFunction(() => window.__started);
  const key = async (c, n = 1) => { for (let i = 0; i < n; i++) { await p.evaluate((c) => dispatchEvent(new KeyboardEvent('keydown', { code: c })), c); await p.evaluate('__tick(2)'); await p.evaluate((c) => dispatchEvent(new KeyboardEvent('keyup', { code: c })), c); await p.evaluate('__tick(2)'); } };
  await key('KeyQ'); // title gate
  await key('ArrowDown'); await key('Enter'); await p.evaluate('__tick(50)'); // INFIRMARY
  const meta2 = () => p.evaluate(() => JSON.parse(localStorage.getItem('grodius.v1')).meta);
  const st = () => p.evaluate(() => window.__G().state);
  return { p, key, meta2, st, shot: (n) => p.screenshot({ path: `${out}/shop-${n}.png` }) };
}
// 1) brand-new player (old-style v2 save with no rig fields): first contraption is free
{
  const { p, key, meta2, shot, st } = await page({ bio: 150, lv: { hull: 1 }, best: {}, v: 2 });
  console.log('state', await st());
  await shot('1-fresh');
  await key('ArrowDown', 2); await key('Enter'); await p.evaluate('__tick(5)'); await shot('2-free-taken');
  let m = await meta2(); console.log('after free take', JSON.stringify({ bio: m.bio, own: m.own, rig: m.rig, cl: m.cl }));
  await key('ArrowDown'); await key('Enter'); await p.evaluate('__tick(5)'); await shot('3-too-poor');
  m = await meta2(); console.log('after poor buy', JSON.stringify({ bio: m.bio, own: m.own }));
}
// 2) rich player: buy, upgrade, bolt, fill sockets
{
  const { p, key, meta2, shot } = await page({ bio: 5000, lv: { socket: 1 }, best: {}, rig: ['saw'], own: ['saw'], cl: { saw: 1 }, v: 2 });
  await key('ArrowRight'); await p.evaluate('__tick(3)'); await key('ArrowRight'); await shot('4-upgraded');
  await key('ArrowDown'); await key('Enter'); await key('ArrowDown'); await key('Enter'); await p.evaluate('__tick(3)'); await shot('5-sockets-full');
  let m = await meta2(); console.log('rich', JSON.stringify({ bio: m.bio, own: m.own, rig: m.rig, cl: m.cl }));
  await key('ArrowDown', 5); await key('Enter'); await p.evaluate('__tick(3)'); await shot('6-socket-cut');
  m = await meta2(); console.log('socket', m.lv.socket, 'bio', m.bio);
  // mouse: hover a row, click the BOLT button of hook (row 4) -> bolts into new socket
  const box = await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left, y: r.top, s: r.width / 480 }; });
  await p.evaluate('__tick(2)');
  const btns = await p.evaluate(() => (window.__mb ? window.__mb() : null));
  console.log('menuBoxes', btns && btns.length);
  const hookBolt = btns.find((q) => q.i === 4 && q.now && q.x === 182);
  await p.mouse.move(box.x + (hookBolt.x + 10) * box.s, box.y + (hookBolt.y + 4) * box.s); await p.evaluate('__tick(2)');
  await p.mouse.down(); await p.mouse.up(); await p.evaluate('__tick(3)');
  await shot('7-mouse-bolt');
  m = await meta2(); console.log('mouse', JSON.stringify({ rig: m.rig, own: m.own }));
  // unbolt saw with LEFT
  await key('ArrowUp', 4); // hook row -> saw row
  await key('ArrowLeft'); await p.evaluate('__tick(3)'); m = await meta2(); console.log('left-unbolt', JSON.stringify({ rig: m.rig }));
  await key('Escape'); await p.evaluate('__tick(3)'); console.log('after esc', await p.evaluate(() => window.__G().state));
}
// 3) touch: tap a button
{
  const { p, meta2, shot } = await page({ bio: 900, lv: {}, best: {}, v: 2 }, { touch: true });
  const box = await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return { x: r.left, y: r.top, s: r.width / 480 }; });
  const btns = await p.evaluate(() => window.__mb());
  const b2 = btns.find((q) => q.i === 1 && q.now);
  await p.touchscreen.tap(box.x + (b2.x + 10) * box.s, box.y + (b2.y + 4) * box.s); await p.evaluate('__tick(4)');
  await shot('8-touch');
  const m = await meta2(); console.log('touch', JSON.stringify({ bio: m.bio, own: m.own, rig: m.rig }));
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
