// Resume-point check (D19 build plan LS1 row H, Evidence column): plays the real game to a checkpoint, reloads the page
// mid-stage, presses RESUME on the title and diffs the rebuilt run against the original:
//   - the terrain: FLOOR/CEIL hashes, and terrain-only renders (render/terrain.ts drawTerrain on a cleared frame) at
//     several scroll x from the lead-in to the stage's boss, compared pixel for pixel (PNGs kept with --out);
//   - the script x and kind list still to fire (every entry past cpX: filler, set pieces, log lines, midboss, boss);
//   - the stored rebuild recipe (seed, loop, stage, route, bx, visitNo, remixV) and where the scroll restarts
//     (cpX - CP.lead);
//   - sim RNG draws made by the RESUME press (must be 0: the rebuild draws only the stage build streams).
// With --death it first flies checkpoint option b (LAB CHECKPOINT: ON DEATH): after the checkpoint the ship is killed,
// and the run must restart at the checkpoint with one life spent; the reload then resumes with that life still gone.
//
// Seeded Math.random, fake clock, manual rAF, no audio (as tools/harness.mjs); an invincible autopilot (as
// tools/layout-parity.mjs) flies to the checkpoint. Storage is cleared on the first load only, so the reload keeps
// grodius.run.
// Usage: node tools/resume-check.mjs [url] [--layout long4|short] [--stage 1] [--cp 1] [--seed 7] [--death]
//          [--out production/qa/evidence/ls1-h]
//   No url: starts its own Vite dev server. Exits 1 on any difference. --out writes the terrain PNGs, the title with
//   RESUME, the first resumed frame and a JSON report into that directory.
//   Not measured: live enemies, shots, pods and spawn-time rolls (side, y, formation, elite status), which a resume does
//   not reproduce by design (spec §4); the Fold APK app kill (Matt's check, in production/qa/evidence/ls1-h.md).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LAYOUT = opt('--layout', 'long4'), STAGE = +opt('--stage', '1'), CPN = +opt('--cp', '1'), SEED = +opt('--seed', '7');
const DEATH = argv.includes('--death'), OUT = opt('--out', null);
let url = argv.find((a, i) => !a.startsWith('--') && !['--layout', '--stage', '--cp', '--seed', '--out'].includes(argv[i - 1]));
const MAX = 60 * 60 * 6; // 6 min of play to reach a checkpoint in Descent 1 is a hang

let server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5399, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

const init = ([seed, cpB]) => {
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) | 0, draws = 0;
  Math.random = () => { draws++; s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  window.__draws = () => draws;
  let now = 0; const q = [];
  performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  window.setTimeout = () => 0; window.setInterval = () => 0; window.speechSynthesis = undefined;
  window.AudioContext = undefined; window.webkitAudioContext = undefined; // see tools/harness.mjs: audio would draw R()
  // first load only: a fresh save (and the LAB's checkpoint option); the reload keeps grodius.run
  try {
    if (!sessionStorage.getItem('rc')) {
      sessionStorage.setItem('rc', '1');
      localStorage.clear();
      localStorage.setItem('grodius.v1', '{"meta":{"v":2},"asked":true}');
      if (cpB) localStorage.setItem('grodius.lab', '{"layout":"long","mids":"","cp":"b"}');
    }
  } catch (e) {}
  const key = (t, c) => dispatchEvent(new KeyboardEvent(t, { code: c, key: c }));
  window.__key = key;
  window.__god = true;
  let enterUp = 0;
  window.__tick = (n) => {
    for (let i = 0; i < n; i++) {
      now += 1000 / 60;
      const g = window.__G && window.__G();
      if (g && g.P && g.state === 'play') {
        const G = g.G, P = g.P;
        if (window.__god) P.inv = Math.max(P.inv, 30);
        let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = G.fork.gy[(G.loop * 2 + G.fork.seg + seed) % 2]; }
        else if (G.fork) { tx = 60; ty = 127; }
        else if (G.boss && !G.boss.dying) { tx = 140; ty = G.boss.y; }
        else {
          const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > P.x + 20 && e.x < 480).sort((a, b) => Math.abs(a.y - P.y) - Math.abs(b.y - P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; } else if (P.x > 200) { tx = 120; ty = P.y; }
        }
        if (tx != null && P.alive) { P.x += Math.sign(tx - P.x) * Math.min(3, Math.abs(tx - P.x)); P.y += Math.sign(ty - P.y) * Math.min(3, Math.abs(ty - P.y)); }
        if (enterUp) { key('keyup', 'Enter'); enterUp = 0; }
        if (G.pick && G.pick.t === 40) { key('keydown', 'Enter'); enterUp = 1; }
      }
      q.splice(0).forEach((f) => f(now));
      // stop on the very frame the target checkpoint is written, so the original is read as the checkpoint saw it
      const st = window.__stopAt, c = st && window.__cp && window.__cp(), h = st && window.__G && window.__G();
      if (st && c.info && c.info.stage === st.stage && c.cpN === st.cpN && h.G && h.G.stage === st.stage && h.G.cpX === h.G.scroll) { window.__stopAt = null; window.__stopped = true; return; }
    }
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function ready(p) {
  for (let i = 0; i < 300; i++) {
    const ok = await p.evaluate(async () => {
      if (!window.__started || document.fonts.status !== 'loaded') return false;
      try {
        const [s, t] = await Promise.all([import('/src/sprites.ts'), import('/src/textures.ts')]);
        return Object.values(s.SPR).every((x) => x.fw > 0) && Object.values(t.PIC).every((i) => i.complete && i.naturalWidth > 0);
      } catch (e) { return true; }
    }).catch(() => false);
    if (ok) return;
    await sleep(50);
  }
  throw new Error('game not ready after 15 s');
}
/** press a key for 2 frames */
const press = async (p, code) => { await p.evaluate((c) => window.__key('keydown', c), code); await p.evaluate('__tick(2)'); await p.evaluate((c) => window.__key('keyup', c), code); await p.evaluate('__tick(2)'); };

/** everything the rebuild must reproduce, read in-page. xs: the scroll x of each terrain-only render */
const snap = (p, xs) => p.evaluate(async (xs) => {
  const g = window.__G(), G = g.G, B = window.__biome(), cp = window.__cp();
  const fnv = (a) => { let h = 2166136261; for (let i = 0; i < a.length; i++) { const s = a[i].toFixed(3) + ','; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } } return (h >>> 0).toString(16); };
  const core = await import('/src/core.ts'), T = await import('/src/render/terrain.ts'), st = await import('/src/state.ts');
  const imgs = {};
  if (xs) {
    const sc0 = G.scroll, T0 = st.$.T, c = core.ctx;
    for (const x of xs) {
      G.scroll = x; st.$.T = 0;
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#000'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
      T.drawTerrain();
      c.restore();
      imgs[Math.round(x)] = c.canvas.toDataURL('image/png');
    }
    G.scroll = sc0; st.$.T = T0;
  }
  return {
    state: g.state, stage: G.stage, loop: G.loop, lives: G.lives, scroll: G.scroll, cpX: cp.cpX, cpN: cp.cpN, seed: G.seed,
    route: G.route, bx: G.bx, visitNo: G.visitNo, remixV: G.remixV, deaths: G.st && G.st.deaths,
    script: G.script.slice(G.si).filter((e) => e.x > cp.cpX).map((e) => `${e.x}:${e.k}`),
    floor: fnv(B.F), ceil: fnv(B.C), imgs, bossX: (await import('/src/layout.ts')).row(G.stage).bossX,
  };
}, xs);

const fails = [], notes = [];
const eq = (what, a, b) => { const A = JSON.stringify(a), Bv = JSON.stringify(b); if (A !== Bv) fails.push(`${what}: ${A.slice(0, 300)} -> ${Bv.slice(0, 300)}`); };
const b = await chromium.launch();
const report = { layout: LAYOUT, stage: STAGE, cp: CPN, seed: SEED, death: DEATH };
try {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.addInitScript(init, [SEED, DEATH]);
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'layout=' + LAYOUT);
  await ready(p);
  await press(p, 'KeyX'); // the audio gate (no AudioContext): its first key opens it
  await press(p, 'Enter'); // DESCEND
  await p.evaluate(() => window.__key('keydown', 'KeyZ')); // hold fire
  // ---- fly to the checkpoint ----
  let f = 0, at = null;
  await p.evaluate(([stage, cpN]) => { window.__stopAt = { stage, cpN }; }, [STAGE, CPN]);
  for (; f < MAX; f += 30) {
    await p.evaluate('__tick(30)');
    if (await p.evaluate(() => window.__stopped)) { at = await p.evaluate(() => { const c = window.__cp(), g = window.__G(); return { info: c.info, cpN: c.cpN, stage: g.G.stage, state: g.state }; }); break; }
    at = await p.evaluate(() => { const c = window.__cp(), g = window.__G(); return { info: c.info, cpN: c.cpN, stage: g.G && g.G.stage, state: g.state }; });
    if (at.state !== 'play' && at.state !== 'pause') break;
    if (at.info && at.info.stage === STAGE && at.cpN === CPN && at.stage === STAGE) break;
  }
  if (!(at && at.info && at.info.stage === STAGE && at.cpN === CPN)) throw new Error(`never reached stage ${STAGE} CP${CPN} (${f} frames, ${JSON.stringify(at)})`);
  const pre = await snap(p, null);
  const xs = [pre.cpX - 120, pre.cpX, pre.cpX + 240, pre.cpX + 600, (pre.cpX + pre.bossX) / 2, pre.bossX - 200].map(Math.round);
  const orig = await snap(p, xs);
  report.reachedAt = f; report.cpX = orig.cpX; report.scriptLeft = orig.script.length; report.xs = xs;
  console.log(`checkpoint: stage ${orig.stage} CP${orig.cpN} at cpX ${orig.cpX.toFixed(1)} after ${f} frames; ${orig.script.length} entries still to fire; route ${orig.route.join('/')}; bx ${orig.bx.map((x) => x == null ? '-' : x.toFixed(1)).join('/')}`);
  await p.evaluate('__tick(300)'); // fly on past the checkpoint: the reload lands mid-stage
  let lives = orig.lives;
  if (DEATH) {
    // option b: a death restarts at the checkpoint, one life spent
    await p.evaluate(async () => { window.__god = false; const g = window.__G(); g.P.inv = 0; (await import('/src/flow.ts')).killPlayer(); });
    await p.evaluate('__tick(160)'); // deadT 150, then respawn()
    const d = await snap(p, null);
    eq('death restart: stage', orig.stage, d.stage);
    if (!(d.scroll >= orig.cpX - 120 && d.scroll < orig.cpX - 100)) fails.push(`death restart: scroll ${d.scroll.toFixed(1)}, want ~${(orig.cpX - 120).toFixed(1)} (+ a few frames)`);
    eq('death restart: lives', orig.lives - 1, d.lives);
    eq('death restart: script still to fire', orig.script, d.script);
    if (!(d.deaths >= 1)) fails.push(`death restart: the stage's deaths ${d.deaths}, want >= 1`);
    console.log(`option b: died at scroll ~${(orig.cpX + 300).toFixed(0)}, restarted at ${d.scroll.toFixed(1)} with ${d.lives} lives (was ${orig.lives}), deaths ${d.deaths}`);
    lives = orig.lives - 1;
    await p.evaluate(() => { window.__god = true; });
    await p.evaluate('__tick(200)');
  }
  const mid = await p.evaluate(() => window.__G().G.scroll);
  report.reloadAt = mid;
  // ---- reload mid-stage, RESUME ----
  await p.evaluate(() => window.__key('keyup', 'KeyZ'));
  await p.reload();
  await ready(p);
  await press(p, 'KeyX');
  const title = await p.evaluate(async () => (await import('/src/menus.ts')).titleItems().map((x) => x.l + (x.r ? ' ' + x.r : '')));
  console.log(`title after reload: ${title.join(' | ')}`);
  if (!/^RESUME/.test(title[0] || '')) fails.push(`title row 0 is ${title[0]}, want RESUME`);
  if (OUT) { await p.evaluate('__tick(2)'); mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/title-resume.png`, Buffer.from((await p.evaluate(() => document.getElementById('c').toDataURL())).split(',')[1], 'base64')); }
  const d0 = await p.evaluate(() => window.__draws());
  await p.evaluate(() => window.__key('keydown', 'Enter'));
  await p.evaluate('__tick(1)'); // the RESUME press: the title step resumes the run
  const d1 = await p.evaluate(() => window.__draws());
  await p.evaluate(() => window.__key('keyup', 'Enter'));
  const res = await snap(p, xs);
  report.resumeDraws = d1 - d0;
  if (d1 !== d0) fails.push(`the RESUME press drew the sim RNG ${d1 - d0} times, want 0`);
  eq('state', 'play', res.state);
  for (const k of ['stage', 'loop', 'seed', 'cpX', 'route', 'bx', 'visitNo', 'remixV']) eq(k, orig[k], res[k]);
  eq('lives', lives, res.lives);
  eq('scroll at resume', Math.max(0, orig.cpX - 120), res.scroll);
  eq('script x and kind list still to fire', orig.script, res.script);
  eq('terrain FLOOR hash', orig.floor, res.floor);
  eq('terrain CEIL hash', orig.ceil, res.ceil);
  const pix = [];
  for (const x of xs) {
    const a = orig.imgs[x], c = res.imgs[x];
    const n = a === c ? 0 : await p.evaluate(async ([a, c]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
      const [A, C] = await Promise.all([load(a), load(c)]), cv = document.createElement('canvas'); cv.width = A.width; cv.height = A.height;
      const x = cv.getContext('2d'); x.drawImage(A, 0, 0); const da = x.getImageData(0, 0, A.width, A.height).data; x.clearRect(0, 0, A.width, A.height); x.drawImage(C, 0, 0); const dc = x.getImageData(0, 0, A.width, A.height).data;
      let n = 0; for (let i = 0; i < da.length; i += 4) if (da[i] !== dc[i] || da[i + 1] !== dc[i + 1] || da[i + 2] !== dc[i + 2]) n++; return n;
    }, [a, c]);
    pix.push(`${x}: ${n} px`);
    if (n) fails.push(`terrain render at scroll ${x}: ${n} pixels differ`);
    if (OUT) for (const [tag, s] of [['orig', a], ['resumed', c]]) writeFileSync(`${OUT}/terrain-${x}-${tag}.png`, Buffer.from(s.split(',')[1], 'base64'));
  }
  report.terrainDiff = pix;
  console.log(`resumed: stage ${res.stage}, scroll ${res.scroll.toFixed(1)} (cpX ${res.cpX.toFixed(1)} - 120), lives ${res.lives}, ${res.script.length} entries to fire; RESUME press drew the sim RNG ${d1 - d0}x`);
  console.log(`terrain-only renders, pixels differing original vs resumed: ${pix.join(', ')}`);
  await p.evaluate('__tick(200)');
  const after = await p.evaluate(() => { const g = window.__G(); return { state: g.state, scroll: g.G.scroll, alive: g.P.alive }; });
  if (after.state !== 'play') fails.push(`200 frames after RESUME the state is ${after.state}`);
  if (OUT) writeFileSync(`${OUT}/resumed-play.png`, Buffer.from((await p.evaluate(() => document.getElementById('c').toDataURL())).split(',')[1], 'base64'));
  report.after = after;
  if (errs.length) fails.push(`page errors: ${errs.join(' | ')}`);
  report.fails = fails;
  if (OUT) writeFileSync(`${OUT}/resume-check-${LAYOUT}-s${STAGE}cp${CPN}${DEATH ? '-death' : ''}.json`, JSON.stringify(report, null, 2) + '\n');
} finally {
  await b.close();
  if (server) await server.close();
}
console.log('not measured: live enemies, shots, pods and spawn-time rolls (not reproduced by design, spec §4); the Fold APK app kill (Matt)');
if (fails.length) { console.error(`RESUME CHECK FAIL (${LAYOUT}, stage ${STAGE} CP${CPN}${DEATH ? ', option b' : ''}):\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log(`RESUME CHECK PASS (${LAYOUT}, stage ${STAGE} CP${CPN}${DEATH ? ', option b' : ''})`);
