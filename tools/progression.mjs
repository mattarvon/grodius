// Progression probe: invincible bot that hoovers up every pod/graft, logs loadout every 10s of game time.
// Usage: node tools/progression.mjs <url> [seconds]
import { chromium } from 'playwright';
const url = process.argv[2], SECS = +(process.argv[3] || 300);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true;
        const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
        const tgt = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
        if (tgt) { const tx = c ? c.x : Math.min(140, tgt.x - 60); g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(tgt.y - g.P.y) * Math.min(3, Math.abs(tgt.y - g.P.y)); } }
      q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
const SL = ['THR', 'MIS', 'SPL', 'ARC', 'PYR', 'WRA', 'WRD'];
for (let s = 10; s <= SECS; s += 10) {
  await p.evaluate('__tick(600)');
  const r = await p.evaluate(() => { const { G, P, state } = __G(); if (!G) return state;
    const lv = [P.speed, P.missile, P.double, P.laser, P.pyre, P.options, P.wardLv || 0];
    const gm = Object.entries(G.gm || {}).filter(([, v]) => v > 0).map(([k, v]) => k + v).join(' ');
    return `${state} loop${G.loop} scroll${Math.round(G.scroll)} seal${G.seal || 0} kills${G.gmk || 0} | ${lv.join(',')} | ${gm} | sh${P.shield} rank${(G.rank || 0).toFixed(2)} ${G.mini && !G.mini.dead ? 'MINI:' + G.mini.k : ''}`; });
  console.log(`${String(s).padStart(4)}s ${r}`);
}
await b.close();
