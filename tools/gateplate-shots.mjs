// Gate-plate shots (ls2-read item 1): the fork's two plates in each perk/REMIX state, on desktop and on a Fold-cover-like
// phone viewport. Live loop (no rAF stub): the fork opens, the shot is taken ~1 s later with the THE SHIP SPLITS banner
// still up, so the banner-vs-top-plate overlap is in the picture too.
// Usage: node tools/gateplate-shots.mjs <outDir> [url] [--only 02,03]   (no url: starts its own Vite dev server). Writes only plate-*.png,
// overwriting by name; it never clears the folder (other lanes keep evidence there)
// Run it under the heavy-job lock: flock /tmp/grodius-heavy.lock sh -c 'node tools/gateplate-shots.mjs ...'
import { chromium } from 'playwright';
import fs from 'node:fs';

const argv = process.argv.slice(2), oi = argv.indexOf('--only');
const ONLY = oi >= 0 ? argv.splice(oi, 2)[1].split(',') : null; // --only 02,03: retake just those cases (stem prefixes)
const [OUT, url0] = argv;
if (!OUT) { console.error('usage: node tools/gateplate-shots.mjs <outDir> [url]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
let url = url0, server;
if (!url) {
  const { createServer } = await import('vite');
  // a worktree's node_modules may be a symlink into the main checkout: allow its real path, or the bundled fonts 403
  const nm = fs.realpathSync('node_modules');
  server = await createServer({ server: { port: 5498, strictPort: false, host: '127.0.0.1', fs: { allow: [process.cwd(), nm] } }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

// [file stem, fork options, run fields, gate heights (null: the real gateYs)]
const CASES = [
  ['01-first-visits', ['fire', 'ice'], { visited: [], bvis: {}, pk: {} }, null],
  ['02-remix-known', ['fire', 'acid'], { visited: ['fire'], bvis: { fire: 1 }, pk: { ignite: 1 } }, null],
  ['03-spent', ['snot', 'ice'], { visited: ['ice'], bvis: { ice: 1 }, pk: { frost: 2 } }, null],
  ['04-squeezed', ['acid', 'snot'], { visited: ['snot'], bvis: { snot: 1 }, pk: {} }, 'squeeze'],
];
const VIEWS = [
  ['desktop', { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }],
  // Galaxy Z Fold cover screen, landscape: 2316x904 physical at DPR ~2.6 is about 890x348 CSS; 832x384 is close and wider-than-tall
  ['fold', { viewport: { width: 832, height: 384 }, deviceScaleFactor: 2.6, hasTouch: true }],
];

const b = await chromium.launch();
const errs = [];
for (const [vn, opts] of VIEWS) {
  const ctxB = await b.newContext(opts), p = await ctxB.newPage();
  p.on('pageerror', (e) => errs.push(`${vn}: ${e.message}`));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.addInitScript(() => { window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
  await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
  for (const [stem, fo, run, gy] of CASES) {
    if (ONLY && !ONLY.some((k) => stem.startsWith(k))) continue;
    await p.evaluate(async ({ fo, run, gy }) => {
      const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
      const C = await import('/src/core.ts'), IN = await import('/src/input.ts'), BI = await import('/src/biomes.ts'), L = await import('/src/layout.ts');
      const { $ } = S;
      $.gate = false; IN.K.KeyZ = false; F.newGame(0); $.state = 'play';
      for (let i = 0; i < 30; i++) ST.step();
      const clear = () => { $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null; $.G.pend.length = 0; for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops]) if (a) a.length = 0; };
      clear();
      const prev = L.row(L.stageOfSlot(0) - 1);
      $.G.scroll = prev.bossX + (prev.kind === 'orbit' ? 50 : 200);
      $.G.visited = [...run.visited]; $.G.bvis = { ...run.bvis }; $.G.pk = { ...run.pk };
      BI.openFork(0); $.G.fork.opts = fo; $.G.fork.t = 0;
      if (gy === 'squeeze') $.G.fork.gy = [C.PH * .5 - 28, C.PH * .5 + 28]; // gateYs' tightest case: 56 apart around the countdown box
      Object.assign($.P, { x: 60, y: C.PH / 2, alive: true, inv: 600 });
    }, { fo, run, gy });
    await p.waitForTimeout(1000); // ~60 frames: plates up (open > .9 at ~36 f), banner still up (160 f)
    await p.locator('#c').screenshot({ path: `${OUT}/plate-${stem}-${vn}.png` });
    if (stem === '01-first-visits' || stem === '04-squeezed') { await p.waitForTimeout(2200); await p.locator('#c').screenshot({ path: `${OUT}/plate-${stem}-${vn}-late.png` }); }
  }
  await ctxB.close();
}
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
if (server) await server.close();
