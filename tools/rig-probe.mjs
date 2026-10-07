// Rig probe: seeded invincible bot plays a real run with a given Infirmary save; logs kills/biomass/rig damage.
// Usage: node tools/rig-probe.mjs <url> <rigIds comma|none> [level] [seconds] [fire 1|0] [shotDir] [shotEvery]
import { chromium } from 'playwright';
const [url, rigArg = 'none', lvl = '1', secs = '60', fireArg = '1', shotDir = '', shotEvery = '0'] = process.argv.slice(2);
const rig = rigArg === 'none' ? [] : rigArg.split(',');
const save = { meta: { bio: 0, lv: { socket: 2 }, best: {}, rig, own: rig, cl: Object.fromEntries(rig.map((r) => [r, +lvl])), v: 2 }, hi: 0, muted: true };
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((sv) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = 0x9e3779b9; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify(sv)); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true;
        const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0]; const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0]; if (t) { tx = c ? c.x : Math.min(window.__ram ? 470 : 140, t.x - (window.__ram ? 6 : 60)); ty = t.y; } }
        if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); } }
      q.splice(0).forEach((f) => f(now)); } }; }, save);
await p.goto(url); await p.waitForFunction(() => window.__started);
if (process.env.RAM) await p.evaluate(() => (window.__ram = 1));
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)');
if (fireArg === '1') await key('keydown', 'KeyZ');
let f = 0, sh = 0; const S = +secs * 60, se = +shotEvery * 60;
while (f < S) {
  await p.evaluate('__tick(30)'); f += 30;
  const pk = await p.evaluate(() => !!(__G().G && __G().G.pick));
  if (pk) { await p.evaluate('__tick(40)'); await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  if (shotDir && se && f % se === 0) await p.screenshot({ path: `${shotDir}/${rigArg.replace(/,/g, '+')}-${sh++}.png` });
  const st = await p.evaluate(() => __G().state); if (st !== 'play') break;
}
const r = await p.evaluate(() => { const { G } = __G(); return { kills: G.kills, bio: Math.round(G.bio), score: G.score, stage: (G.loop + 1) + '-' + ((G.stage || 0) + 1), rig: window.__rig ? window.__rig() : null }; });
console.log(rigArg, 'L' + lvl, JSON.stringify(r), 'errors:', errs.slice(0, 3).join(' | ') || 'none');
await b.close();
