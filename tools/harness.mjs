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
  try { localStorage.clear(); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const fs = q.splice(0); for (const f of fs) f(now); } };
};
const key = (type, code) => `dispatchEvent(new KeyboardEvent('${type}',{code:'${code}',key:'${code}'}))`;
const b = await chromium.launch();
let result;
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.addInitScript(init);
  await p.goto(url); await p.waitForFunction(() => window.__started || typeof G !== 'undefined', null, { timeout: 10000 }).catch(() => {}); await p.waitForTimeout(300);
  const hashes = [];
  // script: frame -> actions
  const plan = { 30: ['down:Enter'], 32: ['up:Enter'], 60: ['down:KeyZ'] };
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
  result = { st, hashes, errs };
} finally {
  await b.close();
  if (server) await server.close();
}

console.log(JSON.stringify(result));

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
const diffs = Object.keys({ ...base.st, ...result.st }).filter((k) => base.st[k] !== result.st[k]).map((k) => `  st.${k}: ${base.st[k]} -> ${result.st[k]}`);
if (JSON.stringify(base.errs) !== JSON.stringify(result.errs)) diffs.push(`  errs: ${JSON.stringify(base.errs)} -> ${JSON.stringify(result.errs)}`);
const hashMoves = result.hashes.filter((h, i) => h !== base.hashes[i]).length;
if (hashMoves) console.log(`note: ${hashMoves}/${result.hashes.length} canvas hashes differ (advisory)`);
if (diffs.length) { console.error(`REGRESSION vs baseline @ ${base.commit}:\n${diffs.join('\n')}`); process.exit(1); }
console.log(`PASS vs baseline @ ${base.commit}`);
