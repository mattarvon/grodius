// THE KEEPSAKE difficulty probe (D59): how much the fight threatens a ship, per phase, on the real jump into it.
// Flies the dev URL Matt plays (`?layout=long4&stage=fire&slot=1&x=boss&kit=<kit>&seed=<seed>`, Descent 1, rank unpinned)
// with one of three ships, and reports per phase: seconds, would-be hits (what they were), near misses, the attacks it
// started, and the share of frames the boss took damage; and for the fight: TTK, the search beam's spots, the enrage.
//   park       invincible; flies at the ship's real speed to x 90 level with the wound and never dodges (an upper bound:
//              it is what the fight does to a ship that only shoots)
//   pilot      mortal: tools/pilot.mjs's dodging autopilot, lives refilled so the fight always finishes (deaths per clear).
//              Its eyes are given what has no eshot: the mobile's hanging forks, the boomerang, the planted forks, the
//              forks flying home. It is not told about the search beam's marked column: it reacts to the three forks
//              only once they fall (a player sees the band 50 f earlier, so this reads the beam as a slow reader would)
//   spot:X,Y   invincible; the ship never moves from (X, Y) and holds fire. A spot with no hits in a phase is a safe park
// Would-be hits on the invincible ships are counted by geometry: each enemy shot once, each contact (boomerang, a hanging
// fork, a planted fork, a fork flying home, a body) once per touch. (A shield would eat shots inside 16 px and hide them.)
// Needs a Vite dev server for this worktree (imports live modules).
// Usage: node tools/keepsake-probe.mjs <url> <park|pilot|spot:X,Y> [seed=7] [kit=mid] [capSeconds=150]
//   prints one JSON line. Several seeds: run it once per seed (they run fine in parallel).
//   SHOTS=<dir> env: also save the canvas at the first of each new telegraph (a recall's threads locking, a tug, the
//   search beam's marked column half full, the hoard at 6+ forks, CRACKED's beam sweeping), for a look at the reads.
// Use a dev server that has not hot-reloaded since it started: after an HMR update the page's modules carry ?t= stamps
// and a probe's plain /src/ imports get other instances (boss-probe's bot then never fires). This probe only reads
// the page through __G() and a pure table (KB), but start a fresh server for numbers you mean to keep.
import { chromium } from 'playwright';
import { PILOT } from './pilot.mjs';
const [url, MODE = 'park', SEED = '7', KIT = 'mid', CAPS = '150'] = process.argv.slice(2);
if (!url) { console.error('usage: node tools/keepsake-probe.mjs <url> <park|pilot|spot:X,Y> [seed] [kit] [capSeconds]'); process.exit(1); }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(PILOT);
await p.addInitScript(([seed]) => {
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  let now = 0; const q = []; performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  window.AudioContext = undefined; window.webkitAudioContext = undefined; // as the harness: no audio, no device-dependent draws
  try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true })); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; window.__pre && window.__pre(); q.splice(0).forEach((f) => f(now)); window.__post && window.__post(); } };
}, [+SEED]);
await p.goto(`${url}${url.includes('?') ? '&' : '?'}layout=long4&stage=fire&slot=1&x=boss&kit=${KIT}&seed=${SEED}`);
await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c })), [t, c]);
await p.evaluate('__tick(10)'); await key('keydown', 'KeyX'); await p.evaluate('__tick(2)'); await key('keyup', 'KeyX'); // the title gate (no audio)
await p.evaluate('__tick(20)'); await key('keydown', 'KeyZ'); // fire, held
const SHOTS = process.env.SHOTS;
if (SHOTS) (await import('node:fs')).mkdirSync(SHOTS, { recursive: true });
await p.evaluate(async ([MODE, CAP]) => {
  window.__W = await import('/src/world.ts'); window.__BU = await import('/src/boss/update.ts');
  const { KB, capsuleHit } = await import('/src/enemies/boss/_keepsake.ts');
  const W = window.__W, pilot = MODE === 'pilot', spot = MODE.startsWith('spot:') ? MODE.slice(5).split(',').map(Number) : null;
  const R = { mode: MODE, ph: [0, 1, 2].map(() => ({ f: 0, hits: 0, by: {}, deaths: 0, near: 0, att: {}, dmgF: 0 })), ttk: null, rank: null, hp: null, rage: 0, spots: 0, end: null };
  let fight = false, f0 = 0, fr = 0, lastHits = 0, alive = true, lastSt = '', lastHp = 0;
  const HS = new WeakSet(), NS = new WeakSet(), ep = {};
  const mobPts = (m, out) => { if (m.ph >= 1 && m.ma && m.my > -40) for (let i = 0; i < KB.mobN; i++) if (m.ma[i]) { const x = m.x + KB.mobX + (i - (KB.mobN - 1) / 2) * KB.mobDx, t = m.my + KB.mobLen + m.ml[i]; for (const dy of [0, 11, 22]) out.push([x, t - dy, KB.mobHit]); } return out; };
  const plantPts = (m, sc, out) => { for (let i = 0; i < (m.pn || 0); i++) for (const d of [4, 10]) out.push([m.pX[i] - sc, m.pY[i] - m.pS[i] * d, KB.plR]); return out; };
  const homePts = (m, out) => { for (let j = 0; j < (m.fh || 0); j++) out.push([m.hX[j], m.hY[j], 4.5, m.hVX[j], m.hVY[j]]); return out; };
  const near = (pts, x, y, pad) => pts.some((q) => Math.hypot(q[0] - x, q[1] - y) < q[2] + pad);
  const sp = (P) => 1.25 + .42 * (P.speed || 0);
  const toward = (P, tx, ty) => { const v = sp(P); P.x += Math.sign(tx - P.x) * Math.min(v, Math.abs(tx - P.x)); P.y += Math.sign(ty - P.y) * Math.min(v, Math.abs(ty - P.y)); };
  const prevB = [0, 0];
  window.__pre = () => {
    const g = window.__G(); if (!g || g.state !== 'play') return;
    const P = g.P, G = g.G, m = G.mini;
    G.lives = 9;
    if (!pilot) { P.inv = 30; P.alive = true; P.shield = 0; }
    if (!m || m.k !== 'keepsake' || m.dead) { toward(P, 90, 120); return; } // the run-up
    const tx = 90, ty = Math.max(10, Math.min(244, m.y + (m.wy || -52)));
    if (spot) { P.x = spot[0]; P.y = spot[1]; return; }
    if (!pilot) { toward(P, tx, ty); return; }
    const sc = G.scroll, fakes = [];
    for (const q of mobPts(m, [])) fakes.push({ x: q[0], y: q[1], r: q[2], vx: 0, vy: 0 });
    for (const q of plantPts(m, sc, [])) fakes.push({ x: q[0], y: q[1], r: q[2], vx: 0, vy: 0 });
    for (const q of homePts(m, [])) fakes.push({ x: q[0], y: q[1], r: q[2], vx: q[3], vy: q[4] });
    if (m.st === 'fly') fakes.push({ x: m.bx, y: m.by, r: KB.boomHalf + KB.boomR, vx: m.bx - prevB[0], vy: m.by - prevB[1] });
    prevB[0] = m.bx; prevB[1] = m.by;
    window.__pilotStep({ ...g, enemies: g.enemies.concat(fakes) }, tx, ty);
  };
  window.__post = () => {
    const g = window.__G(); if (!g) return; const P = g.P, G = g.G, m = G.mini;
    if (!fight && m && m.k === 'keepsake' && m.t >= KB.enter) { fight = true; f0 = fr; lastHits = G.st ? G.st.hits || 0 : 0; R.rank = +(G.rank || 0).toFixed(2); lastHp = m.hp; R.hp = Math.round(m.max); }
    fr++;
    if (!fight) return;
    if (!m || m.k !== 'keepsake' || m.dead) { if (R.ttk == null) R.ttk = +((fr - f0) / 60).toFixed(1); return; }
    const ph = R.ph[m.ph]; ph.f++;
    const add = (k) => { ph.hits++; ph.by[k] = (ph.by[k] || 0) + 1; };
    const h = G.st ? G.st.hits || 0 : 0;
    if (pilot && h > lastHits) ph.hits += h - lastHits;
    lastHits = h;
    if (alive && !P.alive) ph.deaths++;
    alive = P.alive;
    if (m.hp < lastHp - 1e-6) ph.dmgF++;
    lastHp = m.hp;
    if (m.st !== lastSt && !['idle', 'fount', 'open', 'fly', 'dying'].includes(m.st)) ph.att[m.st] = (ph.att[m.st] || 0) + 1;
    lastSt = m.st;
    for (const s of W.eshots) {
      const d = Math.hypot(s.x - P.x, s.y - P.y);
      if (!NS.has(s) && d < 14 + (s.r || 2)) { NS.add(s); ph.near++; }
      if (!pilot && !HS.has(s) && d < (s.r || 2) + 2.6) { HS.add(s); add(s.k + (s.fk ? ':fork' : '')); }
    }
    if (!pilot) {
      const sc = G.scroll, c = {
        boom: m.st === 'fly' && capsuleHit(m.bx, m.by, m.bsa, KB.boomHalf, KB.boomR + 2.6, P.x, P.y),
        mobile: near(mobPts(m, []), P.x, P.y, 2.6),
        planted: near(plantPts(m, sc, []), P.x, P.y, 2.6),
        home: near(homePts(m, []), P.x, P.y, 2.6),
        body: g.enemies.some((e) => !e.dead && e.r && Math.hypot(e.x - P.x, e.y - P.y) < e.r + 3),
      };
      for (const k in c) { if (c[k] && !ep[k]) add(k); ep[k] = c[k]; }
    }
    if (m.rage) R.rage = 1;
    const snap = (k, c) => { if (c && !window.__snapped[k]) { window.__snapped[k] = 1; window.__snapQ = k; } };
    snap('recall-locked', m.rcW === KB.recall - 8); snap('tug', m.st === 'tug' && m.wt === KB.tug - 10);
    snap('beam-mark', m.mkT === Math.round(KB.bTel / 2)); snap('hoard', m.pn >= 6); snap('beam-sweep', m.ph === 2 && m.p3t === KB.pRamp + KB.bArm + 30);
    snap('fountain-marks', m.st === 'tell' && m.wt === KB.tell - 6);
    R.spots = m.spots || 0; R.recalls = m.recalls || 0; R.hpNow = +(m.hp / m.max).toFixed(3); R.phNow = m.ph;
  };
  window.__R = R; window.__snapped = {}; window.__snapQ = null; window.__left = CAP * 60 + 900;
}, [MODE, +CAPS]);
// the run, in chunks (frame by frame through a telegraph when SHOTS wants it)
for (;;) {
  const st = await p.evaluate((n) => { const R = window.__R; for (let i = 0; i < n && !window.__snapQ; i++) window.__tick(1); window.__left -= n;
    if (window.__G().state !== 'play') R.end = window.__G().state;
    const q = window.__snapQ; window.__snapQ = null; return { q, done: R.ttk != null || !!R.end || window.__left <= 0 }; }, SHOTS ? 30 : 300);
  if (st.q && SHOTS) await p.locator('#c').screenshot({ path: `${SHOTS}/${MODE.replace(/[:,]/g, '-')}-${KIT}-s${SEED}-${st.q}.png` });
  if (st.done) break;
}
const res = await p.evaluate(() => {
  const R = window.__R, pilot = R.mode === 'pilot';
  for (const ph of R.ph) { ph.s = +(ph.f / 60).toFixed(1); ph.hpm = ph.f ? +(ph.hits / (ph.f / 3600)).toFixed(1) : 0; ph.dmgShare = ph.f ? +(ph.dmgF / ph.f).toFixed(2) : 0; delete ph.f; delete ph.dmgF; }
  if (pilot) R.pilot = { trapped: window.__pilotLog.trapped, deaths: window.__pilotLog.deaths.map((d) => ({ x: d.x, y: d.y, near: d.near })) };
  return R;
});
const hits = res.ph.reduce((a, q) => a + q.hits, 0), secs = res.ph.reduce((a, q) => a + q.s, 0), deaths = res.ph.reduce((a, q) => a + q.deaths, 0);
console.log(JSON.stringify({ seed: +SEED, kit: KIT, ...res, hits, hpm: secs ? +(hits / (secs / 60)).toFixed(1) : 0, deaths, errs: errs.slice(0, 3) }));
await b.close();
