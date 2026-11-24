// One stage with the mortal dodging pilot (tools/pilot.mjs), lives topped up so the whole stage is flown: where the pilot
// dies, to what, and what it saw (W6 tune-tp: the pilot's own iteration rig; pod-probe's M1/M2 runs fly a whole descent).
// Flies the jump URL `?layout=long4&stage=<kind>&slot=<s>&x=<x>&kit=<kit>&seed=<seed>&tier=<t>` (src/jump.ts), fire held,
// steering at pod-probe's target (the nearest pickup, else the nearest enemy ahead, else level with the midboss / boss).
// Per death: the second, the cause (probe-lib PL.cause, the exact overlaps padded by one frame of motion), the fight up,
// and the pilot's own context (its two nearest threats, the attack models live, safe = it had a clean move).
// Needs a Vite dev server: node tools/with-vite.mjs --port P -- node tools/stage-pilot.mjs {URL} <stage> [opts]
// Usage: node tools/stage-pilot.mjs <url> <stage kind: orbit|ice|acid|fire|snot|drive> [--slot 0|1] [--x rel|boss]
//        [--seed 1] [--kit mid|full|bare] [--tier 1] [--secs 200] [--react frames]
//   prints one JSON line: { deaths: [...], byCause, byFight, hits, secs, end, pilot: { trapped, seen, err } }
import { chromium } from 'playwright';
import { PILOT } from './pilot.mjs';
import { pageLib } from './probe-lib.mjs';
import { hostGuard } from './host-guard.mjs';
const opt = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv.splice(i, 2)[1] : d; };
const SLOT = opt('--slot', null), X = opt('--x', '0'), SEED = opt('--seed', '1'), KIT = opt('--kit', 'mid'), TIER = opt('--tier', '1'), SECS = +opt('--secs', '200'), REACT = opt('--react', null);
const [url, STAGE] = process.argv.slice(2);
if (!url || !STAGE) { console.error('usage: node tools/stage-pilot.mjs <url> <stage> [--slot n] [--x rel|boss] [--seed n] [--kit k] [--tier t] [--secs s]'); process.exit(2); }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.addInitScript(hostGuard); // W6 round 3: the host's blur / visibility / gamepad can't reach this page (tools/host-guard.mjs)
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(PILOT);
if (REACT != null) await p.addInitScript((r) => { window.__pilotReact = r; }, +REACT);
await p.addInitScript(pageLib);
await p.addInitScript(([seed]) => {
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  let now = 0; const q = []; performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true })); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; window.__pre && window.__pre(); q.splice(0).forEach((f) => f(now)); window.__post && window.__post(); } };
}, [+SEED]);
const qs = `layout=long4&stage=${STAGE}${SLOT != null ? '&slot=' + SLOT : ''}&x=${X}&kit=${KIT}&seed=${SEED}&tier=${TIER}`;
await p.goto(`${url}${url.includes('?') ? '&' : '?'}${qs}`);
await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c })), [t, c]);
await p.evaluate('__tick(10)'); await key('keydown', 'KeyX'); await p.evaluate('__tick(2)'); await key('keyup', 'KeyX');
await p.evaluate('__tick(20)'); await key('keydown', 'KeyZ');
await p.evaluate(async () => { await window.__PL.load(); await window.__pilotLoad(); });
await p.evaluate((CAP) => {
  const PL = window.__PL, R = (window.__R = { deaths: [], hits: 0, fights: {}, f: 0, end: null, stage0: null });
  let alive = true, pre = null, lastHits = 0;
  window.__pre = () => {
    const g = window.__G(); if (!g || g.state !== 'play' || !g.P) return; const P = g.P, G = g.G;
    if (R.stage0 == null) R.stage0 = G.stage;
    G.lives = 9;
    let tx, ty; const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
    const t = c || g.enemies.filter((e) => !e.dead && e.x > P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - P.y) - Math.abs(b.y - P.y))[0];
    if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss; tx = 90; ty = m ? m.y : P.y; }
    window.__pilotStep(g, tx, ty);
    pre = P.alive && P.inv <= 1 ? { c: PL.cause(g).c, fight: G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? G.mini.k : '', x: Math.round(P.x), y: Math.round(P.y), mst: G.mini && !G.mini.dead ? G.mini.st || '' : '' } : null;
  };
  window.__post = () => {
    const g = window.__G(); if (!g || !g.P) return; const P = g.P, G = g.G; R.f++;
    if (g.state !== 'play') { R.end = g.state; return; }
    if (R.stage0 != null && G.stage !== R.stage0) { R.end = 'next stage'; return; }
    if (G.tally) { R.end = 'tally'; return; }
    const fk = G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? G.mini.k : null; if (fk) R.fights[fk] = (R.fights[fk] || 0) + 1;
    const h = G.st ? G.st.hits || 0 : 0; if (h > lastHits) R.hits += h - lastHits; lastHits = h;
    if (alive && !P.alive && pre) { const pc = window.__pilotLog.deaths.at(-1) || {}; R.deaths.push({ s: +(R.f / 60).toFixed(1), cause: pre.c || 'other', fight: pre.fight, mst: pre.mst, x: pre.x, y: pre.y, safe: pc.safe, near: pc.near, live: pc.live }); }
    alive = P.alive;
    if (R.f >= CAP * 60) R.end = 'cap';
  };
}, SECS);
for (;;) { const done = await p.evaluate(() => { window.__tick(300); return !!window.__R.end; }); if (done) break; }
const R = await p.evaluate(() => ({ ...window.__R, pilot: { trapped: window.__pilotLog.trapped, frames: window.__pilotLog.frames, ms: Math.round(window.__pilotLog.ms), seen: window.__pilotLog.seen, err: window.__pilotLog.err || null } }));
const byCause = {}, byFight = {};
for (const d of R.deaths) { byCause[d.cause] = (byCause[d.cause] || 0) + 1; byFight[d.fight || '-'] = (byFight[d.fight || '-'] || 0) + 1; }
console.log(JSON.stringify({ gateGrade: false, stage: STAGE, // lives topped up: a tuning rig, never a gate's number slot: SLOT, seed: +SEED, kit: KIT, tier: +TIER, secs: +(R.f / 60).toFixed(1), end: R.end, nDeaths: R.deaths.length, byCause, byFight, hits: R.hits,
  fights: Object.fromEntries(Object.entries(R.fights).map(([k, f]) => [k, +(f / 60).toFixed(1)])), deaths: R.deaths, pilot: R.pilot, errors: errs.slice(0, 3) }));
await b.close();
