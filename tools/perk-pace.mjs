// XP pacing probe: invincible bot plays the real flow (takes forks, grabs pods), logs ship level per stage,
// every level-up time, and any pick screen that opens during a fork / tally / death (must never happen).
// Usage: node tools/perk-pace.mjs <url> [minutes=20] [mode=pick|none] [endLoop=1]
//   mode none: pick screens are dismissed without taking a perk (baseline for balance comparison)
import { chromium } from 'playwright';
const [url, MIN = '20', MODE = 'pick', END = '1'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = (f) => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__bad = []; window.__nr = 1; { const P = CanvasRenderingContext2D.prototype; for (const m of ['fillRect','strokeRect','drawImage','fill','stroke','fillText','strokeText','putImageData','clearRect','getImageData']) { const o = P[m]; P[m] = function (...a) { if (window.__nr) return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; return o.apply(this, a); }; } }
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 5000 / 60; const g = window.__G && window.__G(); if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true;
        const G = g.G; 
        let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi = window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0]; const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0]; if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } }
        if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(12, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(12, Math.abs(ty - g.P.y)); } }
      q.splice(0).forEach((f) => f(now)); const h = window.__G && window.__G(); if (h && h.G && h.G.pick && h.G.pick !== window.__lp) { window.__lp = h.G.pick; if (h.G.fork || h.G.tally || !h.P.alive || h.state !== 'play') window.__bad.push({ fork: !!h.G.fork, tally: !!h.G.tally, t: h.G.pick.t }); } } }; });
await p.goto(url); await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
let f = 0, last = '', lastLvl = 1, lastFork = null, t0 = 0;
const lvT = [];
while (f < 60 * 60 * +MIN || console.log('time up')) {
  await p.evaluate('__tick(12)'); f += 60;
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, stage: G.stage, loop: G.loop, lvl: G.lvl, xp: G.xp, pick: G.pick ? G.pick.opts : null, pt: G.pick ? G.pick.t : 0, fork: !!G.fork, tally: !!G.tally, pk: G.pk, kills: G.kills, boss: !!G.boss, lives: G.lives, xpTot: G.xpTot || 0 }; });
  if (s.fork && !lastFork) await p.evaluate(() => (window.__gi = (window.__gi ?? 0) + 1));
  lastFork = s.fork;
  const k = `${s.loop + 1}-${(s.stage || 0) + 1}`;
  if (k !== last) { console.log(`${(f / 3600).toFixed(1).padStart(5)}m  stage ${k}  LV${s.lvl}  xpTot ${Math.round(s.xpTot)}  kills ${s.kills}  stage-time ${((f - t0) / 60) | 0}s`); last = k; t0 = f; }
  if (s.lvl !== lastLvl) { lvT.push(((f / 60) | 0)); lastLvl = s.lvl; }
  if (s.pick && s.pt > 36) {
    if (MODE === 'none') await p.evaluate(() => { __G().G.pick = null; });
    else { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  }
  if (s.st === 'shop') { console.log('shop after', k, 'LV' + s.lvl); await p.evaluate('__tick(40)'); await key('keydown', 'Backspace'); await p.evaluate('__tick(1)'); await key('keyup', 'Backspace'); await p.evaluate('__tick(40)'); continue; }
  if (s.st !== 'play' || s.loop >= +END) { console.log('end', JSON.stringify(s)); break; }
}
const s = await p.evaluate(() => { const g = __G(), G = g.G; return { lvl: G.lvl, pk: G.pk, kills: G.kills, score: G.score, bad: window.__bad }; });
console.log('final', JSON.stringify(s));
console.log('level-up times (s):', lvT.join(' '));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
