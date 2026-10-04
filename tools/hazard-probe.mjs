// Hazard probe: forces the route into one biome, then for that biome's hazard checks
//   telegraph length, a hit kills through playerHit (and not while invincible), it can be shot (icicle/strand),
//   snot slow wears off. Usage: node tools/hazard-probe.mjs <url> <ice|acid|fire|snot>
import { chromium } from 'playwright';
const [url, biome = 'ice'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  { const P = CanvasRenderingContext2D.prototype; for (const m of ['fillRect','strokeRect','drawImage','fill','stroke','fillText','strokeText','putImageData','clearRect','getImageData']) { const o = P[m]; P[m] = function (...a) { return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; }; } }
  window.__tick = (n, fn) => { for (let i = 0; i < n; i++) { now += 1000 / 60; if (fn) fn(); q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA'); await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)');
// skip to the Maw, kill it, take the gate into <biome>
await p.evaluate(() => { const G = __G().G; G.scroll = 2100; G.si = G.script.findIndex((e) => e.x >= 2100); G.lives = 30; });
await key('keydown', 'KeyZ');
for (let k = 0; k < 200; k++) {
  const r = await p.evaluate((biome) => { __tick(10); const g = __G(), G = g.G; g.P.inv = 30; if (G.mini && !G.mini.dead && G.mini.hp > 1) G.mini.hp = .5; if (G.fork) { G.fork.opts[0] = biome; if (G.fork.t > 45) { g.P.x = 355; g.P.y = 71; } } return G.route[0]; }, biome);
  if (r) break;
}
await key('keyup', 'KeyZ');
// fly into the biome (enemies cleared every step so the test is about hazards)
const res = await p.evaluate(() => { const G = __G().G; for (let i = 0; i < 1500 && !(window.__biome().k[1] > .95); i++) __tick(1, () => { __G().enemies.length = 0; __G().P.inv = 30; }); return { sc: G.scroll | 0, k: window.__biome().k }; });
console.log('in biome', JSON.stringify(res));
// helpers run in page
const run = (body) => p.evaluate(body);
const out = await run(async () => {
  const R = {}, B = window.__biome, g0 = __G(), G = g0.G;
  const clear = () => { __G().enemies.length = 0; __G().G.pick = null; __G().G.pickQ = 0; };
  const waitHaz = (maxF = 2000) => { for (let i = 0; i < maxF; i++) { __tick(1, () => { clear(); __G().P.inv = 30; __G().P.x = 40; __G().P.y = (B().F[(G.scroll / B().TS) | 0] + B().C[(G.scroll / B().TS) | 0]) / 2; }); const h = B().haz.find((h) => h.t < 3); if (h) return h; } return null; };
  // 1) telegraph + spawn distance + hit kills
  const trial = (inv) => {
    const h = waitHaz(); if (!h) return 'no hazard';
    const k = h.k, lives = G.lives; let tele = -1, hitF = -1, dead = false, slowSeen = 0;
    for (let i = 0; i < 400; i++) {
      __tick(1, () => { clear(); const P = __G().P; if (!P.alive) return; P.inv = inv; P.shield = 0;
        // park the ship where the hazard will be
        if (k === 'icicle') { P.x = h.x; P.y = Math.min(h.y + h.len + 30, B().F[((h.x + G.scroll) / B().TS) | 0] - 8); }
        else if (k === 'geyser') { P.x = h.x; P.y = h.y - 8; }
        else if (k === 'jet') { P.x = h.x; P.y = h.dir > 0 ? h.y + 8 : h.y - 8; }
        else if (k === 'strand') { P.x = Math.max(20, h.x); P.y = 127; }
      });
      const P = __G().P;
      if (tele < 0 && (h.reach > 0 || (k === 'icicle' && h.vy > 0))) tele = h.t;
      if (P.slow > 0) slowSeen = Math.max(slowSeen, P.slow);
      if (!P.alive) { dead = true; hitF = h.t; break; }
      if (!B().haz.includes(h) && k !== 'strand') break;
      if (k === 'strand' && slowSeen) break;
    }
    // let the slow wear off
    let slowLeft = -1; if (slowSeen) { for (let i = 0; i < 120; i++) __tick(1, clear); slowLeft = __G().P.slow; }
    // wait for respawn
    for (let i = 0; i < 260 && !__G().P.alive; i++) __tick(1, clear);
    return { k, inv, telegraphF: tele, dead, hitF, livesLost: lives - G.lives, slowSeen, slowLeft };
  };
  R.hitMortal = trial(0);
  R.hitInv = trial(120);
  // 2) shootable: icicle/strand with the gun held
  const h = waitHaz(); let shot = 'n/a';
  if (h && (h.k === 'icicle' || h.k === 'strand')) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    let alive = true;
    for (let i = 0; i < 300 && alive; i++) { __tick(1, () => { clear(); const P = __G().P; P.inv = 30; P.x = Math.max(12, h.x - 70); P.y = h.k === 'icicle' ? h.y + h.len / 2 : 127; }); alive = B().haz.includes(h) && !(h.k === 'icicle' && h.vy > 0); }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ' }));
    shot = alive ? 'survived' : B().haz.includes(h) ? 'fell first' : 'destroyed';
  }
  R.shoot = shot;
  // 3) spawn rate + distance from ship over 40s of flying
  let n = 0, near = 0; const seen = new Set();
  for (let i = 0; i < 2400; i++) { __tick(1, () => { clear(); __G().P.inv = 30; }); for (const z of B().haz) if (!seen.has(z)) { seen.add(z); n++; if (z.k !== 'strand' && Math.abs(z.x - __G().P.x) < 40) near++; } }
  R.rate = { per40s: n, nearShip: near };
  return R;
});
console.log(biome, JSON.stringify(out, null, 1));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
