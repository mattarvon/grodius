// Movement shots (build plan sprint 2 item D; spec §3.3): biome terrain movements A (signature, today's shape()) and C
// (the boss arena: gap >= 150 px, half amplitude, blended in over arenaBlend px from the run-up) for every biome in both
// slots, on the layout the page flies. Full frames, empty of enemies, plus a measured gap table:
//   A     min gap over movement A's span (gate + 300 .. run-up)
//   C     min gap from the run-up + arenaBlend to the boss arena's right screen edge (bossX + 200 + W)
// Usage: node tools/movement-shots.mjs <outDir> [url] [--layout long]
//   No url: starts its own Vite dev server. --layout is appended as ?layout= (src/main.ts flag parse).
//   Not measured: movement B (a later item), live hazards, Descent 2+ terrain seeds (shots and gaps are Descent 1).
import { chromium } from 'playwright';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--layout');
const OUT = pos[0], LAYOUT = opt('--layout', null);
let url = pos[1], server;
if (!OUT) { console.error('usage: node tools/movement-shots.mjs <outDir> [url] [--layout long]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5499, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
if (LAYOUT) url += (url.includes('?') ? '&' : '?') + 'layout=' + LAYOUT;

const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(1500);
const id = await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts'), BI = await import('/src/biomes.ts'), L = await import('/src/layout.ts');
  window.__w = { S, W, ST, F, C, IN, RS, BI, L };
  window.__clear = () => { const $ = S.$; $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null; $.G.pend.length = 0; for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops]) if (a) a.length = 0; };
  window.__go = (sc, n = 240) => { const $ = S.$; window.__clear(); $.G.scroll = sc; for (let i = 0; i < n; i++) { Object.assign($.P, { x: 60, y: C.PH / 2, alive: true, inv: 30 }); ST.step(); window.__clear(); $.G.scroll = sc + i * .5; } RS.render(); };
  // fork into biome b at slot s the way choose() does, with the scroll where the fork holds it (prev bossX + 50 / + 200)
  window.__into = (s, b) => {
    const { $ } = S; S.$.gate = false; IN.K.KeyZ = false; F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    window.__clear();
    const prev = L.row(L.stageOfSlot(s) - 1);
    if (s === 1) { $.G.route[0] = b === 'ice' ? 'acid' : 'ice'; }
    $.G.scroll = prev.bossX + (prev.kind === 'orbit' ? 50 : 200);
    BI.openFork(s); $.G.fork.opts = [b, b]; $.G.fork.t = 50;
    Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step();
    const r = L.slotRow(s), from = $.G.bx[s], P = L.beatPlan(r, from, false);
    return { from, runup: P.runup, a: P.a, bossX: r.bossX, blend: L.layout().beats.arenaBlend || 0 };
  };
  window.__gap = (x0, x1) => { const B = window.__biome(); let m = 1e9, at = 0; for (let j = Math.floor(x0 / B.TS); j <= Math.ceil(x1 / B.TS); j++) { const g = B.F[j] - B.C[j]; if (g < m) { m = g; at = j * B.TS; } } return [m, at]; };
  return L.layout().id;
});
console.log(`layout ${id}`);
const shot = (n) => p.screenshot({ path: `${OUT}/${n}.png` });
const rows = [];
for (const s of [0, 1]) for (const bk of ['ice', 'acid', 'fire', 'snot']) {
  const g = await p.evaluate(([s, bk]) => window.__into(s, bk), [s, bk]);
  const gA = await p.evaluate(([a, b]) => window.__gap(a, b), [g.from + 300, g.runup ?? g.bossX]);
  const gC = g.runup != null ? await p.evaluate(([a, b]) => window.__gap(a, b), [g.runup + g.blend, g.bossX + 200 + 480]) : null;
  rows.push(`slot ${s} ${bk.padEnd(5)} gate ${Math.round(g.from)}  A min gap ${gA[0].toFixed(1)} @${gA[1]}` + (gC ? `  C min gap ${gC[0].toFixed(1)} @${gC[1]}` : '  (no movement C on this layout)'));
  // A: a third into the span; C: the run-up's first screen and the boss arena (scroll where the boss fight holds it)
  await p.evaluate((x) => window.__go(x), Math.round(g.a + ((g.runup ?? g.bossX) - g.a) * .3)); await shot(`s${s}-${bk}-A`);
  if (g.runup != null) {
    await p.evaluate((x) => window.__go(x), Math.round(g.runup - 240)); await shot(`s${s}-${bk}-AtoC`);
    await p.evaluate((x) => window.__go(x), Math.round(g.bossX + 200)); await shot(`s${s}-${bk}-C`);
  }
}
console.log(rows.join('\n'));
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
console.log('not measured: movement B (later item); hazards; Descent 2+ terrain seeds');
await b.close();
if (server) await server.close();
