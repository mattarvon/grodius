// Meter probe: plays the real flow (invincible pod-grabbing bot) in PODS mode and METER mode and compares the loadout
// over time, so the classic meter's economy can be checked against typed pods. In METER mode the bot presses POWER
// whenever the cursor sits on a slot it wants (greedy: THRUST to 2, then MISSILE, SPLIT, WRAITH, WARD; never ARC/PYRE).
// Needs the VITE DEV server. Usage: node tools/meter-probe.mjs http://localhost:4202/ [seconds=200] [shotDir] [--layout short]
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, SECS = '200', shotDir] = process.argv.slice(2);
const b = await chromium.launch();
const errs = [];
async function run(meter) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
    try { localStorage.clear(); } catch (e) {}
    window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true;
          if (g.G.pick) g.G.pickQ = 0, g.G.pick = null;
          const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const tgt = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (tgt) { const tx = c ? c.x : Math.min(140, tgt.x - 60); g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(tgt.y - g.P.y) * Math.min(3, Math.abs(tgt.y - g.P.y)); }
          if (window.__meter && g.G.cur >= 0 && window.__want(g)) { dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyX' })); window.__buys = (window.__buys || 0) + 1; } }
        q.splice(0).forEach((f) => f(now)); } }; });
  await p.goto(url); await p.waitForFunction(() => window.__started);
  await useLayout(p, 'meter-probe');
  await p.evaluate(async (m) => {
    const SV = await import('/src/save.ts'); SV.SET.meter = m; window.__meter = m;
    const PL = await import('/src/player.ts');
    window.__want = (g) => { const i = g.G.cur, P = g.P; if (PL.slotMaxed(i)) return false;
      if (i === 0) return P.speed < 2; if (i === 3 || i === 4) return false; return true; };
  }, meter);
  const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
  // any key first drops the audio gate; a cleared save then asks HELL FLASHES before the title's START (menus.ts titleItems)
  await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
  for (let i = 0; i < 3 && (await p.evaluate(() => __G().state === 'title')); i++) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); }
  await key('keydown', 'KeyZ');
  const rows = [];
  for (let s = 30; s <= +SECS; s += 30) {
    await p.evaluate('__tick(1800)');
    rows.push(await p.evaluate((s) => { const { G, P } = __G(); return `${String(s).padStart(4)}s scroll${Math.round(G.scroll)} | THR${P.speed} MSL${P.missile} SPL${P.double} ARC${P.laser} PYR${P.pyre} WRA${P.options} WRD${P.wardLv || 0} | cur ${G.cur ?? '-'} buys ${window.__buys || 0}`; }, s));
    if (shotDir && meter && s === 60) await p.screenshot({ path: `${shotDir}/meter-hud.png` });
  }
  // death resets the cursor
  const reset = meter ? await p.evaluate(async () => { const F = await import('/src/flow.ts'); const g = __G(); g.G.cur = 3; g.P.inv = 0; F.killPlayer(); return g.G.cur; }) : null;
  await p.close();
  return { rows, reset };
}
for (const m of [false, true]) {
  const r = await run(m);
  console.log(m ? 'METER' : 'PODS');
  r.rows.forEach((x) => console.log('  ' + x));
  if (m) console.log('  cursor after death:', r.reset);
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('meter-probe'); await b.close();
