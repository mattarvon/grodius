// Route probe: fast headless run (no rendering) of the real flow with an invincible bot. Takes gate g0 at the first
// fork and g1 at the second fork of every descent, auto-picks perks, leaves the shop, and checks every frame:
//   forks open after stage 0/1 tallies and close; terrain gap on screen >= 100px; no visible terrain jumps (slams);
//   hazards never spawn on the ship or during fork/tally/death; biome boss titles; music mix per stage.
// Usage: node tools/route-probe.mjs <url> [g0=0] [g1=1] [descents=1] [opts: die-fork,escape0,escape1,wait,mortal]
import { chromium } from 'playwright';
const [url, g0 = '0', g1 = '1', N = '1', OPT = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
await p.addInitScript(([g0, g1, OPT]) => {
  let now = 0; const q = [];
  performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  const O = OPT.split(','), ev = (window.__ev = []), log = (s) => ev.push(s);
  window.__nr = 1;
  { const P = CanvasRenderingContext2D.prototype; for (const m of ['fillRect', 'strokeRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'clearRect', 'getImageData']) { const o = P[m]; P[m] = function (...a) { if (window.__nr) return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; return o.apply(this, a); }; } }
  let prevVis = null, lastFork = null, lastStage = -1, lastLoop = -1, lastMini = null, forkIdx = 0, mortal = 0, hz = new Set(), lastTally = null, lastSeal = 0;
  const st = (window.__st = { minGap: 999, minGapAt: 0, slam: 0, slamMax: 0, slamAt: [], hazSpawn: 0, hazKinds: {}, hazBad: [], hazHits: 0, mixes: {}, frames: 0, deaths: 0 });
  window.__tick = (n) => {
    for (let i = 0; i < n; i++) {
      now += 5000 / 60;
      const g = window.__G && window.__G();
      if (g && g.P && g.state === 'play') {
        const G = g.G;
        if (mortal > 0 || O.includes('mortal')) mortal--; else { g.P.inv = 30; }
        let tx, ty;
        if (G.fork && G.fork.t > 45 && !O.includes('wait')) { tx = 480 * .74; ty = G.fork.gy[G.fork.seg === 0 ? +g0 : +g1]; }
        else if (G.fork) { tx = 60; ty = 127; }
        else if (G.boss && !G.boss.dying) { tx = 140; ty = G.boss.y; }
        else {
          const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } else if (g.P.x > 200) { tx = 120; ty = g.P.y; }
        }
        if (tx != null && g.P.alive) { g.P.x += Math.sign(tx - g.P.x) * Math.min(12, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(12, Math.abs(ty - g.P.y)); }
      }
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G();
      if (!h || !h.G || !h.G.route || h.state !== 'play') continue;
      const G = h.G, B = window.__biome();
      st.frames++;
      if (G.loop !== lastLoop) { lastLoop = G.loop; prevVis = null; }
      // terrain gap + slam check over the visible screen
      const i0 = Math.floor(G.scroll / B.TS), i1 = Math.ceil((G.scroll + 480) / B.TS), vis = [];
      for (let j = i0; j <= i1; j++) { const gap = B.F[j] - B.C[j]; if (gap < st.minGap && B.F[j] < 270 && B.C[j] > 0) { st.minGap = gap; st.minGapAt = j * B.TS; } vis.push(B.F[j], B.C[j]); }
      if (prevVis && prevVis.i0 === i0) for (let j = 0; j < vis.length; j++) { const d = Math.abs(vis[j] - prevVis.v[j]); if (d > 1.5) { st.slam++; st.slamMax = Math.max(st.slamMax, d); if (st.slamAt.length < 5) st.slamAt.push((i0 + (j >> 1)) * B.TS); } }
      prevVis = { i0, v: vis };
      // hazards
      for (const z of B.haz) if (!hz.has(z)) {
        hz.add(z); st.hazSpawn++; st.hazKinds[z.k] = (st.hazKinds[z.k] || 0) + 1;
        const bad = G.fork || G.forkHold || G.tally || !h.P.alive ? 'state' : z.k !== 'strand' && Math.abs(z.x - h.P.x) < 40 ? 'on-ship' : '';
        if (bad) st.hazBad.push(bad + ':' + z.k);
      }
      if (G.hazHit) st.hazHits++;
      if (!h.P.alive && !window.__dead) st.deaths++;
      window.__dead = !h.P.alive;
      // music
      const m = window.__music && window.__music();
      if (m) { const key = `${G.loop}-${G.stage}:${m.mix}:${m.want}:${m.playing ? 'on' : 'off'}`; st.mixes[key] = (st.mixes[key] || 0) + 1; }
      // events
      if (G.stage !== lastStage) { log(`L${G.loop} stage ${G.stage} start scroll ${G.scroll | 0} route ${G.route} k ${B.k && B.k.join('/')}`); lastStage = G.stage; }
      if (G.fork && !lastFork) {
        forkIdx++;
        { const wx = G.scroll + 480 * .74, j = (wx / B.TS) | 0; log(`  fork open seg ${G.fork.seg} opts ${G.fork.opts} scroll ${G.scroll | 0} visited ${G.visited} gates y ${G.fork.gy.map((y) => y | 0)} terrain ${B.C[j] | 0}..${B.F[j] | 0}`); }
        const force = O.find((o) => o.startsWith('force' + G.fork.seg + '='));
        if (force) { G.fork.opts[G.fork.seg ? +g1 : +g0] = force.split('=')[1]; log('  (forced gate ' + force + ')'); }
        if (O.includes('die-fork')) { mortal = 2; h.P.inv = 0; h.P.shield = 0; G.hazHit = 1; log('  (killing ship during fork)'); }
      }
      if (!G.fork && lastFork) log(`  fork closed after ${lastFork.t}f -> route ${G.route} bx ${G.bx && G.bx.map((x) => x | 0)} alive ${h.P.alive}`);
      if (G.fork && G.fork.t >= 40 && G.fork.t < 140 && OPT.includes('dbg')) log(`  dbg P ${h.P.x | 0},${h.P.y | 0} alive ${h.P.alive} pick ${!!G.pick}`);
      lastFork = G.fork ? { ...G.fork } : null;
      if (G.mini !== lastMini) {
        if (G.mini) {
          log(`  mini ${G.mini.k} title=${G.mini.title || '-'} biome=${G.mini.biome || '-'} stageBoss=${!!G.mini.stageBoss} scroll ${G.scroll | 0} k ${B.k && B.k.join('/')}`);
          const esc = (O.includes('escape0') && G.stage === 0) || (O.includes('escape1') && G.stage === 1);
          if (esc && G.mini.stageBoss) { G.mini.hp = 1e9; G.mini.max = 1e9; G.mini.t = G.mini.leave; log('  (forcing maw escape)'); }
        }
        lastMini = G.mini;
      }
      if (O.includes('minihp') && G.mini && st.frames % 300 === 0) log(`    mini ${G.mini.k} hp ${G.mini.hp | 0}/${G.mini.max | 0} x ${G.mini.x | 0} y ${G.mini.y | 0} st ${G.mini.st} P ${h.P.x | 0},${h.P.y | 0} ens ${h.enemies.length} shots ${window.__G().G.t}`);
      if (G.tally && G.tally !== lastTally) { log(`  tally ${G.tally.id} "${G.tally.name}" ${G.tally.g} esc=${G.tally.escaped} kills ${G.tally.kills}/${G.st.spawned} ${G.tally.secs}s k ${B.k && B.k.join('/')}`); lastTally = G.tally; }
      if ((G.seal || 0) !== lastSeal) { log(`  SEAL ${G.seal} (cleared ${G.cleared})`); lastSeal = G.seal || 0; }
      if (G.boss && !window.__bossSeen) { window.__bossSeen = 1; log(`  GRAVITY DRIVE boss at scroll ${G.scroll | 0} k ${B.k && B.k.join('/')}`); }
      if (!G.boss) window.__bossSeen = 0;
    }
  };
}, [g0, g1, OPT]);
await p.goto(url);
await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await p.evaluate('__tick(40)'); await p.evaluate(() => __ev.push('TITLE music ' + JSON.stringify(__music())));
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
let f = 0, shopN = 0, stuck = 0, lastSc = -1;
const SHOTS = (OPT.split(',').find((o) => o.startsWith('shots=')) || '').slice(6), shotDone = {}, shotWait = {};
while (f < 60 * 60 * 40) {
  await p.evaluate('__tick(12)'); f += 60;
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, stage: G.stage, loop: G.loop, pick: !!G.pick, pt: G.pick ? G.pick.t : 0, sc: G.scroll | 0, fork: !!G.fork, hold: !!G.forkHold, mini: !!G.mini, boss: !!G.boss, tally: !!G.tally, dead: !g.P.alive, pend: G.pend.length }; });
  if (SHOTS) {
    const tag = s.fork ? `fork${s.stage}` : s.mini ? `boss${s.stage}` : s.boss ? 'drive' : s.stage && s.sc > [0, 3300, 6400, 8500][s.stage] ? `fly${s.stage}` : s.st === 'play' && s.sc > 1200 && !s.stage ? 'fly0' : '';
    if (tag && !shotDone[tag + s.loop] && (!(s.mini || s.fork) || (shotWait[tag] = (shotWait[tag] || 0) + 1) > 3)) {
      shotDone[tag + s.loop] = 1;
      await p.evaluate(() => { window.__nr = 0; __tick(1); });
      await p.screenshot({ path: `${SHOTS}/${s.loop}-${tag}.png` });
      await p.evaluate(() => { window.__nr = 1; });
    }
  }
  if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(1)'); await key('keyup', 'Enter'); }
  if (s.st === 'shop') {
    shopN++; await p.evaluate('__tick(60)'); await p.evaluate((n) => __ev.push('SHOP ' + n + ' music ' + JSON.stringify(__music())), shopN);
    if (shopN >= +N) break;
    await p.evaluate('__tick(40)'); await key('keydown', 'Backspace'); await p.evaluate('__tick(1)'); await key('keyup', 'Backspace'); await p.evaluate('__tick(40)');
    continue;
  }
  if (s.st === 'over') { await p.evaluate(() => __ev.push('GAME OVER')); break; }
  if (s.sc === lastSc && !s.mini && !s.boss && !s.fork && !s.pick && !s.tally && !s.dead && !s.pend) { if (++stuck > 40) { await p.evaluate((s) => __ev.push('STUCK ' + JSON.stringify(s)), s); break; } } else stuck = 0;
  lastSc = s.sc;
}
const r = await p.evaluate(() => ({ ev: __ev, st: __st }));
console.log(r.ev.join('\n'));
const mx = Object.entries(r.st.mixes).filter(([, v]) => v > 30).map(([k, v]) => k + ' x' + v).join('\n  ');
console.log(`minGap ${r.st.minGap.toFixed(1)} @${r.st.minGapAt}  slams ${r.st.slam} (max ${r.st.slamMax.toFixed(1)} at ${r.st.slamAt})  hazards ${r.st.hazSpawn} ${JSON.stringify(r.st.hazKinds)} bad [${r.st.hazBad.join(',')}] hazHitFrames ${r.st.hazHits} deaths ${r.st.deaths} frames ${r.st.frames}`);
console.log('music:\n  ' + mx);
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
