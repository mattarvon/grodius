// Contraption FX shots: plays a seeded bot run per contraption and screenshots (zoomed on the ship) the moment its effect is live.
// Usage: node tools/rig-fx.mjs <url> <outdir> [ids]
import { chromium } from 'playwright';
const [url, out, ids = 'saw,gut,spine,hook,furnace,choir,leech'] = process.argv.slice(2);
const COND = {
  saw: 'R.saw.spin > .5', gut: 'F.slugs > 0', spine: 'F.spines > 3', hook: 'R.hook.st === 1 && R.hook.phase > .3',
  furnace: 'F.slag > 40', choir: 'F.rings > 0', leech: 'X.wards > 0',
};
const b = await chromium.launch();
const errs = [];
for (const id of ids.split(',')) {
  const save = { meta: { bio: 0, lv: { socket: 2 }, best: {}, rig: [id], own: [id], cl: { [id]: 3 }, v: 2 }, hi: 0, muted: true };
  const p = await b.newPage({ viewport: { width: 1440, height: 810 } });
  p.on('pageerror', (e) => errs.push(id + ': ' + e.message));
  await p.addInitScript(([sv, ram]) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0;
    let s = 0x1234567; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
    localStorage.setItem('grodius.v1', JSON.stringify(sv));
    window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 0; g.P.shield = 3; g.P.wardLv = Math.max(1, g.P.wardLv); g.P.alive = true;
          const t = g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          let tx = 120, ty = 127 + Math.sin(now / 900) * 60; if (t) { tx = Math.min(ram ? 470 : 140, t.x - (ram ? 6 : 70)); ty = t.y; }
          g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); }
        q.splice(0).forEach((f) => f(now)); } }; }, [save, id === 'saw']);
  await p.goto(url); await p.waitForFunction(() => window.__started);
  const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
  await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
  await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)');
  if (id !== 'spine' && id !== 'hook' && id !== 'gut') await key('keydown', 'KeyZ');
  let ok = false;
  for (let f = 0; f < 60 * 50 && !ok; f += 2) {
    await p.evaluate('__tick(2)');
    ok = await p.evaluate((c) => { const g = __G(); if (!g.P || !g.P.rig || g.state !== 'play') return false; const R = g.P.rig, X = __rig(), F = X.fx; return eval(c); }, COND[id]);
    if (!ok && f % 60 === 0 && (await p.evaluate(() => !!__G().G.pick))) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  }
  if (id === 'leech') await p.evaluate('__tick(4)');
  const sp = await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(), P = __G().P; return { x: r.left + (P.x / 480) * r.width, y: r.top + (P.y / 270) * r.height, s: r.width / 480 }; });
  const w = 260 * sp.s, h = 150 * sp.s, x = Math.max(0, sp.x - w * .3), y = Math.max(0, Math.min(sp.y - h / 2, 810 - h));
  await p.screenshot({ path: `${out}/fx-${id}.png`, clip: { x, y, width: w, height: h } });
  await p.screenshot({ path: `${out}/fxfull-${id}.png` });
  console.log(id, ok ? 'captured' : 'TIMEOUT', JSON.stringify(await p.evaluate(() => __rig().fx)));
  await p.close();
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
