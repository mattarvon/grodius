// Stage clock (build plan sprint 2 item D): how long each stage SCROLLS, on whatever layout the page flies. A seeded,
// invincible autopilot (route-probe's pilot; seeded Math.random, fake clock, canvas stubbed, one sim step per rAF) plays
// N descents. Per stage it reports:
//   scroll s   sim frames (G.t steps: a perk pick's 1/5-speed crawl and hitstop don't count) from the stage start
//              (startStage) until the scroll reaches the row's bossX (where the biome boss WARNING / the Drive's
//              startBoss sits), minus the frames a held midboss is up: the spec §3.1 "scroll" column
//   held s     frames a held (non-drift) midboss was up before bossX
//   wall s     startStage to the tally (the stage's wall time with this bot's kit: fights included)
//   midboss    where breath 1's midboss arrived and how it left
// Biome stages are checked against the item D band (58-62 s of scroll). Orbit and Drive rows are reported only:
// their script content is item E's.
// Usage: node tools/stage-clock.mjs [url] [--layout long4] [--seeds 1,5,6,7,11] [--descents 1]
//   No url: starts its own Vite dev server. --layout <id> (tools/layout-arg.mjs, default short) sets the entry
//   in-page before the run, like every probe; the game's own ?layout=long flag (src/main.ts) selects the same entry.
//   Not measured: render-only output (canvas stubbed); a mortal pilot (it never dies, so no respawn stalls); seeds 2
//   and 3 (the parity bot's kit cannot kill the Gravity Drive, their runs time out).
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = opt('--seeds', '1,5,6,7,11').split(',').map(Number), DESCENTS = +opt('--descents', '1');
let url = argv.find((a, i) => !a.startsWith('--') && !['--seeds', '--descents'].includes(argv[i - 1]));
let server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5399, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
const BAND = [58, 62];

const init = ([seed, gate]) => {
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) | 0;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0; const q = [];
  performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  window.setTimeout = () => 0; window.setInterval = () => 0; window.speechSynthesis = undefined; window.AudioContext = window.webkitAudioContext = undefined;
  try { localStorage.clear(); } catch (e) {}
  { const P = CanvasRenderingContext2D.prototype; for (const m of ['fillRect', 'strokeRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'clearRect', 'getImageData']) P[m] = function (...a) { return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; }; }
  const out = (window.__clk = { stages: [], warn: [] });
  let cur = null, lastStage = -1, lastLoop = -1, lastMini = null, forks = 0, lastT = -1;
  window.__tick = (n) => {
    for (let i = 0; i < n; i++) {
      now += 1000 / 60;
      const g = window.__G && window.__G();
      if (g && g.P && g.state === 'play') {
        const G = g.G; g.P.inv = 30;
        let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = G.fork.gy[(gate >> forks) & 1]; }
        else if (G.fork) { tx = 60; ty = 127; }
        else if (G.boss && !G.boss.dying) { tx = 140; ty = G.boss.y; }
        else {
          const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } else if (g.P.x > 200) { tx = 120; ty = g.P.y; }
        }
        if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(12, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(12, Math.abs(ty - g.P.y)); }
      }
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G();
      if (!h || !h.G || h.state !== 'play' || !h.G.route) continue;
      const G = h.G, L = window.__layout;
      if (G.fork && !window.__inFork) { window.__inFork = 1; } else if (!G.fork && window.__inFork) { window.__inFork = 0; forks++; }
      if (G.stage !== lastStage || G.loop !== lastLoop) {
        if (cur) { delete cur.oldTally; out.stages.push(cur); }
        const r = L.row(G.stage);
        cur = { loop: G.loop, stage: G.stage, kind: r.kind, slot: r.slot, biome: r.kind === 'biome' ? G.route[r.slot] : '', visit: r.kind === 'biome' ? (G.visitNo || [])[r.slot] : 0, bossX: r.bossX, s0: Math.round(G.scroll), scrollF: 0, heldF: 0, wallF: 0, mid: '', tally: null, oldTally: G.tally, gate: r.kind === 'biome' ? Math.round(G.bx[r.slot]) : null };
        lastStage = G.stage; lastLoop = G.loop;
      }
      if (!cur.tally) cur.wallF++;
      if (G.tally && G.tally !== cur.oldTally && !cur.tally) cur.tally = G.tally.secs;
      // sim frames only: a perk pick runs the world at 1/5 and hitstop freezes it (step.ts); neither is scroll time
      const simF = G.t !== lastT; lastT = G.t;
      if (simF && G.scroll < cur.bossX && !G.fork && !G.forkHold && !cur.tally) { cur.scrollF++; if (G.mini && !G.mini.drift && !G.mini.stageBoss) cur.heldF++; }
      if (G.mini !== lastMini) {
        if (G.mini && !G.mini.stageBoss && G.scroll < cur.bossX) cur.mid += `${G.mini.k}@${Math.round(G.scroll)}`;
        if (lastMini && !lastMini.stageBoss && cur.mid && !cur.mid.includes(' ')) cur.mid += ` ${lastMini.gone || lastMini.t >= lastMini.leave ? 'withdrew' : 'killed'}@${Math.round(G.scroll)}`;
        lastMini = G.mini;
      }
    }
  };
  window.__flush = () => { if (cur) { delete cur.oldTally; out.stages.push(cur); } cur = null; };
};

const b = await chromium.launch();
const rows = [];
for (const seed of SEEDS) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
  await p.addInitScript(init, [seed, (seed * 2654435761) >>> 0]);
  await p.goto(url);
  await p.waitForFunction(() => window.__started);
  await useLayout(p, 'stage-clock', { limits: 'Orbit and Drive script content is item E\'s; only biome stages are banded' });
  await p.evaluate(async () => { window.__layout = await import('/src/layout.ts'); });
  const layoutId = await p.evaluate(() => window.__layout.layout().id);
  const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
  await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA'); await p.evaluate('__tick(40)');
  await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
  let shops = 0, f = 0, end = 'timeout';
  while (f < 60 * 60 * 16 * DESCENTS) {
    await p.evaluate('__tick(60)'); f += 60;
    const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, pick: !!(G && G.pick), pt: G && G.pick ? G.pick.t : 0 }; });
    if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(1)'); await key('keyup', 'Enter'); }
    if (s.st === 'shop') { if (++shops >= DESCENTS) { end = 'descents done'; break; } await p.evaluate('__tick(40)'); await key('keydown', 'Backspace'); await p.evaluate('__tick(1)'); await key('keyup', 'Backspace'); await p.evaluate('__tick(40)'); }
    if (s.st === 'over') { end = 'game over'; break; }
  }
  await p.evaluate('__flush()');
  const st = await p.evaluate(() => __clk.stages);
  console.log(`seed ${seed} on layout ${layoutId}: ${end}, ${st.length} stages${errs.length ? ', page messages: ' + errs.slice(0, 3).join(' | ') : ''}`);
  for (const r of st) {
    const sc = (r.scrollF - r.heldF) / 60, ok = r.kind !== 'biome' ? '' : sc >= BAND[0] && sc <= BAND[1] ? '  ok' : '  OUT OF BAND';
    console.log(`  D${r.loop + 1} s${r.stage} ${(r.kind + (r.biome ? ' ' + r.biome + (r.visit ? '+' : '') : '')).padEnd(12)} start ${String(r.s0).padStart(5)}${r.gate != null ? ' gate ' + r.gate : ''}  scroll ${sc.toFixed(1).padStart(5)} s  held ${(r.heldF / 60).toFixed(1).padStart(4)} s  wall ${(r.wallF / 60).toFixed(1).padStart(5)} s  tally ${r.tally ?? '-'} s  ${r.mid}${ok}`);
    rows.push({ seed, ...r, sc });
  }
  await p.close();
}
await b.close();
const bio = rows.filter((r) => r.kind === 'biome' && r.tally != null);
if (bio.length) {
  const xs = bio.map((r) => r.sc).sort((a, b) => a - b);
  console.log(`biome stages: ${bio.length}, scroll min ${xs[0].toFixed(1)} median ${xs[xs.length >> 1].toFixed(1)} max ${xs[xs.length - 1].toFixed(1)} s; band ${BAND.join('-')} s: ${bio.filter((r) => r.sc < BAND[0] || r.sc > BAND[1]).length} out of band`);
}
console.log('not measured: render-only output; a mortal pilot; seeds 2 and 3; Orbit and Drive content (item E)');
ranOn('stage-clock');
if (server) await server.close();
