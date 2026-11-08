// Deterministic regression gate: seeded RNG, fake clock, manual rAF, scripted input.
// Usage: node tools/harness.mjs [url] [--layout short|long4] [--frames N] [--flashes off] [--update]
//   No url: starts its own Vite dev server. Compares sim state + page errors against
//   tools/harness.baseline.json and exits 1 on any difference. Canvas hashes are
//   advisory only (they also move with sprite decode order and the HELL FLASHES setting).
//   --flashes off runs with HELL FLASHES off; `st` must still match the (flashes-on) baseline, which proves the
//   setting cannot reach the sim (render/fx draw srnd(), never the sim R()). Never combine it with --update.
//   --update rewrites the baseline from this run.
//   --layout long4 flies ?layout=long4 (the game default since D24) against tools/harness.long4.baseline.json.
//   No --layout: ?layout=short against tools/harness.baseline.json, exactly as before.
//   --scenario <name>|all flies a jump-switch scenario (SCENARIOS below; src/jump.ts) on long4 against its own
//   tools/harness.<name>.baseline.json. --runs N flies each N times and fails unless all N match (the determinism
//   proof). --shots <dir> keeps each scenario's first frame there. Scenario `st` adds the stage, rank, what the run met
//   (`seen`) and `sig`, a hash of the live sim; a scenario that never meets its subject fails, whatever its baseline.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform, release } from 'node:os';

const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const fi = argv.indexOf('--frames');
const FRAMES = fi >= 0 ? +argv[fi + 1] : 3600;
const fl = argv.indexOf('--flashes');
const FLASHES = fl >= 0 ? argv[fl + 1] !== 'off' : true;
if (UPDATE && !FLASHES) { console.error('--update records the flashes-on baseline: drop --flashes off'); process.exit(1); }
const li = argv.indexOf('--layout');
const LAYOUT = li >= 0 ? argv[li + 1] : 'short';
if (!['short', 'long4'].includes(LAYOUT)) { console.error(`--layout must be short or long4, got ${LAYOUT}`); process.exit(1); }
const argOf = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const SCENARIO = argOf('--scenario'), RUNS = +(argOf('--runs') ?? 1), SHOTS = argOf('--shots');
if (SCENARIO && (li >= 0 || fi >= 0)) { console.error('--scenario sets its own layout and frames: drop --layout and --frames'); process.exit(1); }
if ((RUNS !== 1 || SHOTS) && !SCENARIO) { console.error('--runs and --shots need --scenario'); process.exit(1); }
let url = argv.find((a, i) => !a.startsWith('--') && !['--frames', '--flashes', '--layout', '--scenario', '--runs', '--shots'].includes(argv[i - 1]));
const baselineOf = (name) => new URL(name ? `./harness.${name}.baseline.json` : LAYOUT === 'short' ? './harness.baseline.json' : `./harness.${LAYOUT}.baseline.json`, import.meta.url);

// The jump-switch scenarios (build plan LS1 row I). x comes from the layout table, so a retuned row moves the jump with
// it: each lands LEAD px of scroll before its subject (plus the resume's own lead-in). The boss set is M3's: Maw, Drive,
// Crux, Butcher at D1 and D3, rank pinned (D1 .5 and kit mid, D3 1 and kit full, where a real run stands there).
// seed pins the stage builds and the midboss pick. `want` is what the run must meet, as `seen` writes it.
const LEAD = 30;
async function scenarios() {
  const L = await import('../src/layout.ts');
  L.setLayout('long4');
  const orbit = L.rowOfKind('orbit'), drive = L.rowOfKind('drive'), b0 = L.slotRow(0);
  const rel = (r, x) => Math.round(x - r.x0 - LEAD);
  const breath2 = L.beatPlan(b0, b0.gateLate, false).warns[1];
  const fight = (stage, r, x, want) => [[`${want}-d1`, { q: `stage=${stage}&x=${rel(r, x)}&loop=0&kit=mid&rank=.5&seed=7`, frames: 1200, want: want }],
    [`${want}-d3`, { q: `stage=${stage}&x=${rel(r, x)}&loop=2&kit=full&rank=1&seed=7`, frames: 1200, want: want }]];
  return {
    orbit: { q: 'stage=orbit&x=0&seed=7', frames: 1200 },
    saucer: { q: `stage=orbit&x=${rel(orbit, L.ufoAt())}&kit=mid&seed=7`, frames: 1200, want: 'ufo' },
    breath2: { q: `stage=ice&x=${rel(b0, breath2)}&kit=mid&seed=7`, frames: 1200, want: 'slotB' },
    drive: { q: 'stage=drive&x=0&kit=mid&seed=7', frames: 1200 },
    ...Object.fromEntries([
      ...fight('orbit', orbit, orbit.bossX, 'maw'),
      ...fight('drive', drive, drive.warnX, 'drive'),
      ...fight('ice', b0, b0.bossX, 'crux'),
      ...fight('fire', b0, b0.bossX, 'butcher'),
    ]),
  };
}

let server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5199, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

const init = (flashes) => {
  let s = 0x9e3779b9;
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0; const q = [];
  performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  window.setTimeout = (f) => 0; // voice lines / delayed sfx: irrelevant to sim
  window.speechSynthesis = undefined;
  // no audio: auInit draws R() once per noise sample, so the device sample rate (44.1k vs 48k) and whether
  // the context runs (autoplay policy, no sound card on CI) would otherwise change the sim's RNG stream
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  // fresh save that has already answered the first-launch HELL FLASHES prompt (flashes ON, the default; --flashes off)
  try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true, ...(flashes ? {} : { flashes: false }) })); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const fs = q.splice(0); for (const f of fs) f(now); } };
};
const key = (type, code) => `dispatchEvent(new KeyboardEvent('${type}',{code:'${code}',key:'${code}'}))`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Ready = booted, fonts in, and every sprite strip and photo decoded. Images that finish loading after frames start
// change which draw paths run, so they must all be in first. Polled from Node: the page's own timers are stubbed.
const ready = () => p0.evaluate(async () => {
  if (!window.__started || document.fonts.status !== 'loaded') return false;
  try {
    const [s, t] = await Promise.all([import('/src/sprites.ts'), import('/src/textures.ts')]);
    return Object.values(s.SPR).every((x) => x.fw > 0) && Object.values(t.PIC).every((i) => i.complete && i.naturalWidth > 0);
  } catch (e) { return true; } // not a Vite dev server (e.g. a preview URL): boot + fonts is the best available
});
let p0;
async function runOnce(b, sc = null, name = null) {
  const frames = sc ? sc.frames : FRAMES;
  const p = (p0 = await b.newPage({ viewport: { width: 1280, height: 720 } }));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let loads = 0; p.on('load', () => loads++);
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.addInitScript(init, FLASHES);
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'layout=' + (sc ? 'long4' : LAYOUT) + (sc ? '&' + sc.q : '')); // pinned either way: the short baseline stays short although long4 is the default (D24)
  let ok = false;
  for (let i = 0; i < 300 && !ok; i++) { ok = await ready().catch(() => false); if (!ok) await sleep(50); }
  if (!ok) errs.push('harness: game not ready after 15 s (boot, fonts or images)');
  // --flashes off must actually reach the game's setting, or the ON/OFF comparison proves nothing
  const fset = await p.evaluate(async () => { try { return (await import('/src/save.ts')).SET.flashes; } catch (e) { return null; } });
  if (fset !== null && fset !== FLASHES) errs.push(`harness: SET.flashes is ${fset}, wanted ${FLASHES}`);
  const hashes = [];
  // script: frame -> actions
  // with no audio the title gate stays up and swallows the first key, so open it before pressing Enter
  // a scenario boots straight into play: the same gate key and the same fire and weave, no Enter
  const plan = { 10: ['down:KeyX'], 12: ['up:KeyX'], ...(sc ? {} : { 30: ['down:Enter'], 32: ['up:Enter'] }), 60: ['down:KeyZ'] };
  for (let f = 90; f < frames; f += 90) (plan[f] ||= []).push(`down:${(f / 90) % 2 ? 'ArrowUp' : 'ArrowDown'}`), (plan[f + 45] ||= []).push(`up:${(f / 90) % 2 ? 'ArrowUp' : 'ArrowDown'}`);
  const stops = [...new Set([...Object.keys(plan).map(Number), ...Array.from({ length: frames / 600 }, (_, i) => i * 600 + 600)])].filter((f) => f <= frames).sort((a, b) => a - b);
  let f = 0;
  const seen = [];
  if (sc) {
    await p.evaluate('__tick(1)');
    f = 1;
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await p.locator('#c').screenshot({ path: `${SHOTS}/${name}-first-frame.png` }); }
  }
  for (const s of stops) {
    if (s > f) { await p.evaluate(`__tick(${s - f})`); f = s; }
    if (sc) for (const k of await p.evaluate(meets)) if (!seen.includes(k)) seen.push(k);
    if (f % 600 === 0 && f > 0) hashes.push(createHash('md5').update(await p.evaluate(() => document.getElementById('c').toDataURL())).digest('hex').slice(0, 10));
    const acts = plan[f]; if (acts) await p.evaluate(acts.map((a) => { const [t, c] = a.split(':'); return key(t === 'down' ? 'keydown' : 'keyup', c); }).join(';'));
  }
  const st = await p.evaluate(() => { const g = window.__G ? window.__G() : { G, P, state, enemies, gibs, drops, caps };
    return { state: g.state, score: g.G && g.G.score, scroll: g.G && Math.round(g.G.scroll), lives: g.G && g.G.lives, px: g.P && +g.P.x.toFixed(3), py: g.P && +g.P.y.toFixed(3), en: g.enemies.length, gibs: g.gibs.length, drops: g.drops.length, caps: g.caps.length }; });
  if (sc) {
    Object.assign(st, await p.evaluate(simState));
    st.seen = seen.join(' ');
    st.sig = createHash('md5').update(st.simSig).digest('hex').slice(0, 10);
    delete st.simSig;
    if (!st.jump) errs.push('harness: the jump switch did not start (a built page ignores ?stage=: use the dev server)');
    // 'slotB': the stage's second midboss, whichever the picker drew
    const want = sc.want === 'slotB' ? st.pair.split('+')[1] : sc.want;
    if (want && !seen.some((k) => k === `mini:${want}` || k === `boss:${want}`)) errs.push(`harness: never met ${want} (seen: ${st.seen || 'nothing'})`);
  }
  if (loads > 1) errs.push(`harness: page reloaded ${loads - 1}x mid-run (Vite dependency re-optimisation?)`);
  await p.close();
  return { st, hashes, errs };
}
// what is on the field at a stop, and the scenario's closing sim state. In-page: they read window.__G only
const meets = () => { const { G, state } = window.__G(); return [G && G.mini && `mini:${G.mini.k}`, G && G.boss && 'boss:drive', state !== 'play' && `state:${state}`].filter(Boolean); };
// sig also covers the Gravity Drive (G.boss is not in enemies), enemy shots (world.ts eshots, not in __G: read through
// the dev server's module, as ready() does) and the midboss's own clock/state plus the picker's per-stage tables
const simState = async () => { const { G, P, enemies, drops, caps } = window.__G(), r = (v) => (typeof v === 'number' ? +v.toFixed(3) : v ?? null);
  let es = null; try { es = (await import('/src/world.ts')).eshots; } catch (e) {} // a built page: no module URL, sig leaves them out
  const B = G.boss, M = G.mini;
  return { jump: !!G.jump, stage: G.stage, pair: ((G.mb && G.mb[G.stage]) || []).join('+'), loop: G.loop, pow: r(G.pow), rank: r(G.rank), lvl: G.lvl, kills: G.kills, t: G.t, simSig: JSON.stringify([G.score, G.scroll, G.bio, G.xpTot, G.mb, G.route, P && [P.x, P.y, P.inv, P.shield], enemies.map((e) => [e.k, r(e.x), r(e.y), e.hp]), drops.length, caps.map((c) => [c.ty, r(c.x), r(c.y)]),
    B && [r(B.x), r(B.y), r(B.hp), r(B.max), B.phase, B.t, B.dying, B.enter, B.plates.map((q) => r(q.hp))], es && es.map((e) => [e.k, r(e.x), r(e.y)]),
    M && [M.k, r(M.x), r(M.y), r(M.hp), M.st ?? null, M.t ?? null, M.leave ?? null], G.mbUsed ?? null, G.mbLast ?? null]) }; };
function compare(base, r) {
  const diffs = Object.keys({ ...base.st, ...r.st }).filter((k) => base.st[k] !== r.st[k]).map((k) => `  st.${k}: ${base.st[k]} -> ${r.st[k]}`);
  if (JSON.stringify(base.errs) !== JSON.stringify(r.errs)) diffs.push(`  errs: ${JSON.stringify(base.errs)} -> ${JSON.stringify(r.errs)}`);
  return diffs;
}

const b = await chromium.launch();
// one gate: fly it, retry a mismatch, then update or judge. true = pass
async function gate(sc, name) {
  const BASELINE = baselineOf(name), tag = name ? `${name}: ` : '', frames = sc ? sc.frames : FRAMES;
  let retry;
  const result = await runOnce(b, sc, name);
  console.log(tag + JSON.stringify(result));
  // --runs: the same scenario again, every result must match the first
  const again = [];
  for (let i = 1; i < RUNS; i++) again.push(await runOnce(b, sc, name));
  for (const r of again) console.log(tag + JSON.stringify(r));
  const same = again.every((r) => JSON.stringify(r.st) === JSON.stringify(result.st) && JSON.stringify(r.errs) === JSON.stringify(result.errs));
  if (RUNS > 1) console.log(`${tag}${RUNS} runs: ${same ? 'identical' : 'DIFFER'} sig ${[result, ...again].map((r) => r.st.sig).join(' ')} canvas ${[result, ...again].map((r) => r.hashes.join('.')).join(' ')}`);
  if (!same) { console.error(`${tag}NONDETERMINISTIC across ${RUNS} runs`); return false; }
  // one retry on a mismatch: a real regression fails twice; a one-off is reported as FLAKY, never hidden
  if (!UPDATE && existsSync(BASELINE)) {
    const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
    if (base.frames === frames && compare(base, result).length) {
      console.log('mismatch on first run; running once more to tell a regression from a flake');
      retry = await runOnce(b, sc, name);
      console.log(tag + JSON.stringify(retry));
    }
  }
  if (UPDATE) {
    if (sc && result.errs.length) { console.error(`${tag}not recording a failed run: ${result.errs.join('; ')}`); return false; }
    let commit = 'unknown';
    try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
    writeFileSync(BASELINE, JSON.stringify({ frames, commit, os: `${platform()} ${release()}`, ...(sc ? { layout: 'long4', scenario: name, q: sc.q } : LAYOUT === 'short' ? {} : { layout: LAYOUT }), ...result }, null, 2) + '\n');
    console.log(`${tag}baseline updated (${frames} frames @ ${commit})`);
    return true;
  }
  if (!existsSync(BASELINE)) { console.error(`${tag}no baseline: run with --update`); return false; }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  if (base.frames !== frames) { console.error(`${tag}baseline is for ${base.frames} frames, ran ${frames}`); return false; }
  const first = compare(base, result);
  const final = retry || result, diffs = retry ? compare(base, retry) : first;
  const hashMoves = final.hashes.filter((h, i) => h !== base.hashes[i]).length;
  if (hashMoves) console.log(`${tag}note: ${hashMoves}/${final.hashes.length} canvas hashes differ (advisory)`);
  if (diffs.length) { console.error(`${tag}REGRESSION vs baseline @ ${base.commit}:\n${diffs.join('\n')}`); return false; }
  if (retry) console.warn(`${tag}FLAKY: first run differed, the retry matched. Nondeterminism to track down:\n${first.join('\n')}`);
  console.log(sc ? `PASS (${name}) vs baseline @ ${base.commit}` : LAYOUT === 'short' ? `PASS vs baseline @ ${base.commit}` : `PASS (${LAYOUT}) vs baseline @ ${base.commit}`);
  return true;
}

let pass = true;
try {
  if (SCENARIO) {
    const all = await scenarios(), names = SCENARIO === 'all' ? Object.keys(all) : SCENARIO.split(',');
    const bad = names.filter((n) => !all[n]);
    if (bad.length) { console.error(`unknown scenario ${bad.join(', ')} (have: ${Object.keys(all).join(', ')})`); pass = false; }
    else {
      const t0 = Date.now();
      for (const n of names) pass = (await gate(all[n], n)) && pass;
      console.log(`${names.length} scenario(s) in ${Math.round((Date.now() - t0) / 1000)} s`);
    }
  } else pass = await gate();
} finally {
  await b.close();
  if (server) await server.close();
}
process.exit(pass ? 0 : 1);
