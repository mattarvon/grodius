// Biome tour: invincible pod-grabbing bot plays the real flow, takes gate <pick> at each fork,
// auto-picks perks, and screenshots the fork, the first perk screen, and each biome.
// Usage: node tools/biome-tour.mjs <url> <outdir> [gateIndex0] [gateIndex1]
import { chromium } from 'playwright';
const [url, out, g0 = '0', g1 = '1'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = (f) => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true;
        const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = window.__gate ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0]; const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0]; if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } }
        if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); } }
      q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
let forks = 0, pickShot = false, seen = {}, f = 0;
while (f < 60 * 60 * 9) {
  await p.evaluate('__tick(30)'); f += 30;
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, scroll: Math.round(G.scroll), stage: G.stage, fork: G.fork ? G.fork.opts : null, ft: G.fork ? G.fork.t : 0, pick: !!G.pick, route: G.route, lvl: G.lvl, music: window.__music && __music().mix }; });
  if (s.fork && s.ft > 60 && s.ft < 95) { await shot('fork' + forks); await p.evaluate((i) => (window.__gate = i), forks ? +g1 : +g0); console.log('fork', forks, s.fork, 'scroll', s.scroll); forks++; await p.evaluate('__tick(70)'); f += 70; }
  if (s.pick) { if (!pickShot) { await p.evaluate('__tick(8)'); await shot('perks'); pickShot = true; console.log('perk pick at lvl', s.lvl); } await p.evaluate('__tick(40)'); await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  const b = s.route && s.route[s.stage - 1];
  if (b && !seen[b]) { const k = await p.evaluate(() => { const G = __G().G; return G.scroll; }); if ((s.stage === 1 && k > 3100) || (s.stage === 2 && k > 6000)) { seen[b] = 1; await shot('biome-' + b); console.log('biome', b, 'stage', s.stage, 'scroll', k, 'music', s.music); } }
  if (s.st !== 'play' || s.stage >= 3) { console.log('end', JSON.stringify(s)); break; }
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
