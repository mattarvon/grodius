// Layout parity check (D19 build plan §0, LS1 row A): proves a refactor left the SHORT layout behaviour-identical
// over full descents, which the default harness (60 s of Open Orbit) never reaches.
//
// On each fixed seed a seeded, invincible autopilot plays the real game (no rendering, no audio, fake clock, one sim
// step per rAF like tools/harness.mjs) through N descents, taking a seed-dependent gate at every fork, auto-picking
// perks and leaving the Infirmary. Per stage it dumps:
//   scroll at stage start and end, frames, the script x list at stage start, every script entry that fired with the
//   kinds it spawned (the "x/kind list"), a hash of the full spawn trace, midboss/boss arrivals (kind, title, scroll),
//   the fork (options, bx), the tally, terrain hashes at stage start and end, and the music it wanted.
// Once per run it dumps the static anchors (LEVEL, BOSS_AT, SEG, T_END0/1, UFO_AT/UFO_GAP_END, AMT sampled every
// 10 px), and route-probe's checks (min on-screen gap, terrain slams, hazards spawned / spawned badly, fork events).
//
// Usage: node tools/layout-parity.mjs [url] [--seeds 1,3,5,7,11] [--descents 2] [--update] [--out file]
//   Seed 2 is not in the default set: its bot kit cannot kill the Gravity Drive (no escape clock), so it times out.
//   The gate taken at each fork is a hash of the seed; over the default seeds every fork position takes both gates.
//   The url must be a Vite DEV server (the anchors are read by importing /src modules).
//   Not measured (printed at the end of every run): hits, deaths, game over and respawn (the bot is invincible), and
//   anything render-only (canvas calls are stubbed; tests/unit/layout.test.ts pins the render bands).
//   No url: starts its own Vite dev server. Compares against tools/layout-parity.baseline.json and exits 1 on any
//   difference (field by field). --update rewrites the baseline. --out also writes this run's dump to a file.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const UPDATE = argv.includes('--update');
const SEEDS = opt('--seeds', '1,3,5,7,11').split(',').map(Number);
const DESCENTS = +opt('--descents', '2');
const OUT = opt('--out', null);
let url = argv.find((a, i) => !a.startsWith('--') && !['--seeds', '--descents', '--out'].includes(argv[i - 1]));
const BASELINE = new URL('./layout-parity.baseline.json', import.meta.url);
const MAX_FRAMES = 60 * 60 * 14 * DESCENTS; // a descent is 4-6 min; 14 min each is a hang, not a slow run

let server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5299, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

// ---- in-page: seeded RNG, fake clock, no audio, no canvas work, the autopilot and the recorder ----
const init = ([seed, gates, descents]) => {
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) | 0;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0; const q = [];
  performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  window.setTimeout = () => 0; window.setInterval = () => 0; window.speechSynthesis = undefined;
  window.AudioContext = undefined; window.webkitAudioContext = undefined; // see tools/harness.mjs: audio would draw R()
  try { localStorage.clear(); localStorage.setItem('grodius.v1', '{"meta":{"v":2},"asked":true}'); } catch (e) {}
  { const P = CanvasRenderingContext2D.prototype; for (const m of ['fillRect', 'strokeRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'clearRect', 'getImageData']) { const o = P[m]; P[m] = function (...a) { return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; }; } }
  const fnv = (h, str) => { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const arrHash = (a, i0 = 0, i1 = a.length) => { let h = 2166136261; for (let i = i0; i < i1; i++) h = fnv(h, a[i].toFixed(3) + ','); return h.toString(16); };
  const key = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c }));
  const R = (window.__par = { stages: [], route: { minGap: 999, minGapAt: 0, slam: 0, slamMax: 0, slamAt: [], haz: 0, hazKinds: {}, hazHash: 2166136261, hazBad: [], hazHits: 0, forks: [] }, shops: 0, frames: 0, end: '', errs: [] });
  let miniF = 0, curMus = null, cur = null, lastKey = '', prevVis = null, lastLoop = -1, lastMini = null, lastBoss = null, lastFork = null, lastTally = null, seenE = new WeakSet(), seenH = new WeakSet(), shopT = -1, fr = 0, enterUp = 0;
  const music = () => { try { const m = window.__musicPlan && window.__musicPlan(); return m ? `${m.want}|${m.mix}` : '-'; } catch (e) { return 'err'; } };
  const close = (G, B) => { if (!cur) return; cur.scroll1 = Math.round(G.scroll * 1000) / 1000; cur.frames = fr - cur.f0; cur.terrain1 = arrHash(B.F) + '/' + arrHash(B.C); cur.spawnHash = cur.sh.toString(16); delete cur.sh; delete cur.f0; R.stages.push(cur); cur = null; };
  window.__tick = (n) => {
    for (let i = 0; i < n && !R.end; i++) {
      now += 1000 / 60;
      const g0 = window.__G && window.__G();
      // ---- autopilot (route-probe's, at 3 px/f like playtest.mjs) ----
      if (g0 && g0.P && g0.state === 'play') {
        const G = g0.G, P = g0.P;
        P.inv = 30;
        let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = G.fork.gy[gates[(G.loop * 2 + G.fork.seg) % gates.length]]; }
        else if (G.fork) { tx = 60; ty = 127; }
        else if (G.boss && !G.boss.dying) { tx = 140; ty = G.boss.y; }
        else {
          const c = g0.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g0.enemies.filter((e) => !e.dead && e.x > P.x + 20 && e.x < 480).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - P.y) - Math.abs(b.y - P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } else if (P.x > 200) { tx = 120; ty = P.y; }
        }
        if (tx != null && P.alive) { P.x += Math.sign(tx - P.x) * Math.min(3, Math.abs(tx - P.x)); P.y += Math.sign(ty - P.y) * Math.min(3, Math.abs(ty - P.y)); }
        // tap Enter on the perk screen (released next frame whatever happened, or K.Enter sticks and later taps are lost)
        if (enterUp) { key('keyup', 'Enter'); enterUp = 0; }
        if (G.pick && G.pick.t === 40) { key('keydown', 'Enter'); enterUp = 1; }
      }
      const si0 = g0 && g0.G && g0.G.script ? g0.G.si : 0, sc0 = g0 && g0.G && g0.G.script;
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G();
      if (!h) continue;
      // ---- menus: the Infirmary (leave it), game over (stop) ----
      if (h.state === 'shop') {
        if (shopT < 0) { shopT = 0; R.shops++; if (cur && h.G) close(h.G, window.__biome()); if (R.shops >= descents) { R.end = 'shop ' + R.shops; break; } }
        if (++shopT === 60) key('keydown', 'Backspace');
        if (shopT === 62) key('keyup', 'Backspace');
        continue;
      }
      shopT = -1;
      if (h.state === 'over') { R.end = 'game over'; break; }
      if (!h.G || !h.G.route || h.state !== 'play') continue;
      const G = h.G, B = window.__biome();
      fr++; R.frames = fr;
      // ---- stage bookkeeping ----
      const k = `${G.loop}-${G.stage}`;
      if (k !== lastKey) {
        close(G, B);
        lastKey = k;
        cur = { id: k, scroll0: Math.round(G.scroll * 1000) / 1000, f0: fr, route: (G.route || []).join('/'), script: G.script.slice(G.si).map((e) => e.x), si: G.si, scriptLen: G.script.length,
          terrain0: arrHash(B.F) + '/' + arrHash(B.C), fired: [], minis: [], boss: null, fork: null, tally: null, spawns: 0, kinds: {}, sh: 2166136261, music: [] };
        curMus = null;
      }
      // script entries that fired this step (the kinds they spawned are this step's new enemies)
      const fresh = [];
      for (const e of h.enemies) if (!seenE.has(e)) { seenE.add(e); fresh.push(e); }
      if (sc0 === G.script && G.si > si0) cur.fired.push(G.script.slice(si0, G.si).map((e) => e.x).join('+') + ':' + fresh.map((e) => e.k).join(','));
      for (const e of fresh) { cur.spawns++; cur.kinds[e.k] = (cur.kinds[e.k] || 0) + 1; cur.sh = fnv(cur.sh, `${fr}:${e.k}:${e.x.toFixed(2)}:${e.y.toFixed(2)};`); }
      // music: every switch of the wanted track or mix, in order, with the stage frame it happened on
      if (fr % 5 === 0) { const m = music(); if (m !== curMus) { cur.music.push(`${fr - cur.f0}:${m}`); curMus = m; } }
      // midbosses and stage bosses: arrival (kind, title, biome, stage boss, scroll), then how and where they left
      if (G.mini !== lastMini) {
        if (lastMini) { const how = lastMini.dead && !lastMini.gone && !(lastMini.t >= lastMini.leave) ? 'killed' : lastMini.gone || lastMini.t >= lastMini.leave ? 'withdrew' : 'replaced'; cur.minis.push(`  left ${how} at ${Math.round(G.scroll * 1000) / 1000} after ${fr - miniF}f`); }
        if (G.mini) { cur.minis.push(`${G.mini.k}|${G.mini.title || '-'}|${G.mini.biome || '-'}|${!!G.mini.stageBoss}|${Math.round(G.scroll * 1000) / 1000}`); miniF = fr; }
        lastMini = G.mini;
      }
      if (G.boss && G.boss !== lastBoss) cur.boss = Math.round(G.scroll * 1000) / 1000;
      lastBoss = G.boss;
      if (G.fork && !lastFork) cur.fork = { seg: G.fork.seg, opts: G.fork.opts.join('/'), scroll: Math.round(G.scroll * 1000) / 1000 };
      if (!G.fork && lastFork) { R.route.forks.push(`${k} seg ${lastFork.seg} after ${lastFork.t}f -> route ${G.route} bx ${G.bx && G.bx.map((x) => x == null ? '-' : Math.round(x * 1000) / 1000)}`); }
      lastFork = G.fork ? { seg: G.fork.seg, t: G.fork.t } : null;
      if (G.tally && G.tally !== lastTally) { const t = G.tally; cur.tally = `${t.id}|${t.name}|${t.g}|esc=${t.escaped}|${t.kills}/${G.st.spawned}|${t.secs}s|bonus ${t.bonus}|bio ${t.bio}`; lastTally = t; }
      // ---- route-probe checks: visible gap, slams, hazards ----
      if (G.loop !== lastLoop) { lastLoop = G.loop; prevVis = null; }
      const i0 = Math.floor(G.scroll / B.TS), i1 = Math.ceil((G.scroll + 480) / B.TS), vis = [];
      for (let j = i0; j <= i1; j++) { const gap = B.F[j] - B.C[j]; if (gap < R.route.minGap && B.F[j] < 270 && B.C[j] > 0) { R.route.minGap = +gap.toFixed(3); R.route.minGapAt = j * B.TS; } vis.push(B.F[j], B.C[j]); }
      if (prevVis && prevVis.i0 === i0) for (let j = 0; j < vis.length; j++) { const d = Math.abs(vis[j] - prevVis.v[j]); if (d > 1.5) { R.route.slam++; R.route.slamMax = Math.max(R.route.slamMax, +d.toFixed(3)); if (R.route.slamAt.length < 5) R.route.slamAt.push((i0 + (j >> 1)) * B.TS); } }
      prevVis = { i0, v: vis };
      for (const z of B.haz) if (!seenH.has(z)) {
        seenH.add(z); R.route.haz++; R.route.hazKinds[z.k] = (R.route.hazKinds[z.k] || 0) + 1; R.route.hazHash = fnv(R.route.hazHash, `${fr}:${z.k}:${z.x.toFixed(2)};`);
        const bad = G.fork || G.forkHold || G.tally || !h.P.alive ? 'state' : z.k !== 'strand' && Math.abs(z.x - h.P.x) < 40 ? 'on-ship' : '';
        if (bad) R.route.hazBad.push(bad + ':' + z.k + '@' + k);
      }
      if (G.hazHit) R.route.hazHits++;
    }
    const g = window.__G && window.__G(), G = g && g.G;
    return { end: R.end, fr, st: g && g.state, sc: G && Math.round(G.scroll), stage: G && G.stage, pick: !!(G && G.pick), mini: G && G.mini && G.mini.k, boss: !!(G && G.boss), fork: !!(G && G.fork), hold: !!(G && G.forkHold), tally: !!(G && G.tally), alive: !!(g && g.P && g.P.alive) };
  };
};

// ---- static anchors: read from the live modules (src/layout.ts once it exists, else the pre-refactor homes) ----
const anchors = (p) => p.evaluate(async () => {
  const imp = async (m) => { try { return await import(m); } catch (e) { return null; } };
  const LY = await imp('/src/layout.ts'), C = await imp('/src/core.ts'), BI = await imp('/src/biomes.ts'), UF = await imp('/src/enemies/ufo.ts'), WO = await imp('/src/world.ts');
  let a;
  if (LY && LY.parityAnchors) a = LY.parityAnchors();
  else {
    const src = await (await fetch('/src/biomes.ts')).text(), m = src.match(/T_END0 = (\d+), T_END1 = (\d+)/);
    a = { level: C.LEVEL, bossAt: C.BOSS_AT, seg: BI.SEG.map((s) => ({ ...s })), tEnd: m ? [+m[1], +m[2]] : null, ufoAt: UF.UFO_AT, ufoGapEnd: UF.UFO_GAP_END };
  }
  const amt = {};
  for (const k of Object.keys(WO.AMT).sort()) { const v = []; for (let x = -200; x <= a.level + 1200; x += 10) v.push(+WO.AMT[k](x).toFixed(6)); amt[k] = v.join(','); }
  return { ...a, amt };
});

const b = await chromium.launch();
const runs = {};
try {
  for (const seed of SEEDS) {
    const gates = [0, 1, 2, 3].map((i) => (Math.imul(seed + 1, 0x9e3779b1) >>> (7 + i * 5)) & 1); // fork n of the run takes gate gates[n % 4]
    const p = await b.newPage({ viewport: { width: 960, height: 540 } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
    await p.addInitScript(init, [seed, gates, DESCENTS]);
    await p.goto(url);
    await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
    const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c })), [t, c]);
    // the title gate (no audio) swallows the first key: open it, start, hold fire (tools/harness.mjs)
    await p.evaluate('__tick(10)'); await key('keydown', 'KeyX'); await p.evaluate('__tick(2)'); await key('keyup', 'KeyX');
    await p.evaluate('__tick(18)'); await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter');
    await p.evaluate('__tick(28)'); await key('keydown', 'KeyZ');
    const anc = await anchors(p);
    let r;
    for (let f = 0; f < MAX_FRAMES; f += 1200) { r = await p.evaluate('__tick(1200)'); if (process.env.PARITY_DEBUG) console.log(JSON.stringify(r)); if (r.end) break; }
    const par = await p.evaluate(() => window.__par);
    if (!par.end) par.end = `timeout after ${par.frames} play frames`;
    runs[seed] = { gates: gates.join(''), anchors: anc, end: par.end, playFrames: par.frames, shops: par.shops, route: par.route, stages: par.stages, errs };
    console.log(`seed ${seed} gates ${gates.join('')}: ${par.end}, ${par.stages.length} stages, ${par.frames} play frames, errors ${errs.length}`);
    await p.close();
  }
} finally {
  await b.close();
  if (server) await server.close();
}

console.log('not measured: hits, deaths, game over, respawn (invincible bot); render-only output (canvas stubbed)' + (SEEDS.includes(2) ? '' : '; seed 2 (its bot cannot kill the Gravity Drive)'));
if (OUT) writeFileSync(OUT, JSON.stringify(runs, null, 1) + '\n');
let commit = 'unknown';
try { commit = execSync('git describe --always --dirty', { encoding: 'utf8' }).trim(); } catch {}
const meta = { seeds: SEEDS, descents: DESCENTS };
if (UPDATE) { writeFileSync(BASELINE, JSON.stringify({ ...meta, commit, runs }, null, 1) + '\n'); console.log(`parity baseline updated (${SEEDS.length} seeds x ${DESCENTS} descents @ ${commit})`); process.exit(0); }
if (!existsSync(BASELINE)) { console.error('no parity baseline: run with --update on the commit to compare against'); process.exit(1); }
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
if (JSON.stringify(base.seeds) !== JSON.stringify(SEEDS) || base.descents !== DESCENTS) { console.error(`baseline is for seeds ${base.seeds} x ${base.descents} descents`); process.exit(1); }
// field-by-field diff, so a failure names what moved
const diffs = [];
const walk = (a, b, path) => {
  if (diffs.length > 60) return;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], path + '.' + k); return; }
  if (path.includes('.amt.') && typeof a === 'string' && typeof b === 'string' && a !== b) { // a sampled band: name the first x that moved
    const A = a.split(','), B = b.split(','), i = A.findIndex((v, j) => v !== B[j]);
    diffs.push(`  ${path}: first differs at sample ${i} (x = ${-200 + i * 10}): ${A[i]} -> ${B[i]}`); return;
  }
  if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`  ${path}: ${JSON.stringify(a)?.slice(0, 160)} -> ${JSON.stringify(b)?.slice(0, 160)}`);
};
walk(base.runs, runs, 'seed');
if (diffs.length) { console.error(`PARITY DIFF vs baseline @ ${base.commit}:\n${diffs.join('\n')}`); process.exit(1); }
console.log(`PARITY PASS vs baseline @ ${base.commit}: ${SEEDS.length} seeds x ${DESCENTS} descents identical`);
