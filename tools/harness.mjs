// Deterministic regression gate: seeded RNG, fake clock, manual rAF, scripted input.
// Usage: node tools/harness.mjs [url] [--frames N] [--update]
//   No url: starts its own Vite dev server. Compares sim state + page errors against
//   tools/harness.baseline.json and exits 1 on any difference. Canvas hashes are
//   advisory only (render-side RNG is not yet split from the sim RNG).
//   --update rewrites the baseline from this run.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { platform, release } from 'node:os';

const argv = process.argv.slice(2);
const UPDATE = argv.includes('--update');
const fi = argv.indexOf('--frames');
const FRAMES = fi >= 0 ? +argv[fi + 1] : 3600;
let url = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--frames');
const BASELINE = new URL('./harness.baseline.json', import.meta.url);

let server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5199, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

const init = () => {
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
  // fresh save that has already answered the first-launch HELL FLASHES prompt (flashes ON, the default)
  try { localStorage.clear(); localStorage.setItem('grodius.v1', '{"meta":{"v":2},"asked":true}'); } catch (e) {}
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
async function runOnce(b) {
  const p = (p0 = await b.newPage({ viewport: { width: 1280, height: 720 } }));
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let loads = 0; p.on('load', () => loads++);
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.addInitScript(init);
  await p.goto(url);
  let ok = false;
  for (let i = 0; i < 300 && !ok; i++) { ok = await ready().catch(() => false); if (!ok) await sleep(50); }
  if (!ok) errs.push('harness: game not ready after 15 s (boot, fonts or images)');
  const hashes = [];
  // script: frame -> actions
  // with no audio the title gate stays up and swallows the first key, so open it before pressing Enter
  const plan = { 10: ['down:KeyX'], 12: ['up:KeyX'], 30: ['down:Enter'], 32: ['up:Enter'], 60: ['down:KeyZ'] };
  for (let f = 90; f < FRAMES; f += 90) (plan[f] ||= []).push(`down:${(f / 90) % 2 ? 'ArrowUp' : 'ArrowDown'}`), (plan[f + 45] ||= []).push(`up:${(f / 90) % 2 ? 'ArrowUp' : 'ArrowDown'}`);
  const stops = [...new Set([...Object.keys(plan).map(Number), ...Array.from({ length: FRAMES / 600 }, (_, i) => i * 600 + 600)])].filter((f) => f <= FRAMES).sort((a, b) => a - b);
  let f = 0;
  for (const s of stops) {
    if (s > f) { await p.evaluate(`__tick(${s - f})`); f = s; }
    if (f % 600 === 0 && f > 0) hashes.push(createHash('md5').update(await p.evaluate(() => document.getElementById('c').toDataURL())).digest('hex').slice(0, 10));
    const acts = plan[f]; if (acts) await p.evaluate(acts.map((a) => { const [t, c] = a.split(':'); return key(t === 'down' ? 'keydown' : 'keyup', c); }).join(';'));
  }
  const st = await p.evaluate(() => { const g = window.__G ? window.__G() : { G, P, state, enemies, gibs, drops, caps };
    return { state: g.state, score: g.G && g.G.score, scroll: g.G && Math.round(g.G.scroll), lives: g.G && g.G.lives, px: g.P && +g.P.x.toFixed(3), py: g.P && +g.P.y.toFixed(3), en: g.enemies.length, gibs: g.gibs.length, drops: g.drops.length, caps: g.caps.length }; });
  if (loads > 1) errs.push(`harness: page reloaded ${loads - 1}x mid-run (Vite dependency re-optimisation?)`);
  await p.close();
  return { st, hashes, errs };
}
function compare(base, r) {
  const diffs = Object.keys({ ...base.st, ...r.st }).filter((k) => base.st[k] !== r.st[k]).map((k) => `  st.${k}: ${base.st[k]} -> ${r.st[k]}`);
  if (JSON.stringify(base.errs) !== JSON.stringify(r.errs)) diffs.push(`  errs: ${JSON.stringify(base.errs)} -> ${JSON.stringify(r.errs)}`);
  return diffs;
}

const b = await chromium.launch();
let result, retry;
try {
  result = await runOnce(b);
  console.log(JSON.stringify(result));
  // one retry on a mismatch: a real regression fails twice; a one-off is reported as FLAKY, never hidden
  if (!UPDATE && existsSync(BASELINE)) {
    const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
    if (base.frames === FRAMES && compare(base, result).length) {
      console.log('mismatch on first run; running once more to tell a regression from a flake');
      retry = await runOnce(b);
      console.log(JSON.stringify(retry));
    }
  }
} finally {
  await b.close();
  if (server) await server.close();
}

if (UPDATE) {
  let commit = 'unknown';
  try { commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch {}
  writeFileSync(BASELINE, JSON.stringify({ frames: FRAMES, commit, os: `${platform()} ${release()}`, ...result }, null, 2) + '\n');
  console.log(`baseline updated (${FRAMES} frames @ ${commit})`);
  process.exit(0);
}
if (!existsSync(BASELINE)) { console.error('no baseline: run with --update'); process.exit(1); }
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
if (base.frames !== FRAMES) { console.error(`baseline is for ${base.frames} frames, ran ${FRAMES}`); process.exit(1); }
const first = compare(base, result);
const final = retry || result, diffs = retry ? compare(base, retry) : first;
const hashMoves = final.hashes.filter((h, i) => h !== base.hashes[i]).length;
if (hashMoves) console.log(`note: ${hashMoves}/${final.hashes.length} canvas hashes differ (advisory)`);
if (diffs.length) { console.error(`REGRESSION vs baseline @ ${base.commit}:\n${diffs.join('\n')}`); process.exit(1); }
if (retry) console.warn(`FLAKY: first run differed, the retry matched. Nondeterminism to track down:\n${first.join('\n')}`);
console.log(`PASS vs baseline @ ${base.commit}`);
