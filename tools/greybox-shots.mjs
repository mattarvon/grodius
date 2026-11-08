// Tone shots (ls2-read worklist A1/A2, D39): the pass-1 greybox midboss template calm and telegraphing, the Dissolving
// Womb (cyst) with its bile, and a gore splat with gut ropes, on desktop and a Fold-cover-like phone viewport.
// The greybox has no kind using it yet, so it is staged in page: the cyst's DRAW entry is swapped for
// greybox({ col: acid tint, r: the cyst's 21 }) with tell(e) read off window.__k, render-only (no sim field written).
// Files: <outDir>/tone-<greybox-calm|greybox-tell|greybox-half|cyst|cyst-tel|gore>-<desktop|phone>[-zoom].png
// Not measured: a crossover tint over the greybox, any biome but acid, phase 2.
// Usage: node tools/greybox-shots.mjs <outDir> [url|''] [desktop|phone]   (no url: starts its own Vite dev server)
// Heavy: run under flock /tmp/grodius-heavy.lock sh -c 'node tools/greybox-shots.mjs ...'
import { chromium } from 'playwright';
import fs from 'node:fs';

const [OUT, url0, ONLY] = process.argv.slice(2); // ONLY: desktop or phone, to re-run one view
if (!OUT) { console.error('usage: node tools/greybox-shots.mjs <outDir> [url]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
let url = url0 || '', server;
if (!url) {
  const { createServer } = await import('vite');
  const nm = fs.realpathSync('node_modules');
  server = await createServer({ server: { port: 5498, strictPort: false, host: '127.0.0.1', fs: { allow: [process.cwd(), nm] } }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
const VIEWS = [
  ['desktop', { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }],
  ['phone', { viewport: { width: 832, height: 384 }, deviceScaleFactor: 2.6, hasTouch: true }],
];
const b = await chromium.launch();
const errs = [];
for (const [vn, opts] of VIEWS.filter(([n]) => !ONLY || n === ONLY)) {
  const cx = await b.newContext(opts), p = await cx.newPage();
  p.on('pageerror', (e) => errs.push(`${vn}: ${e.message}`));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.addInitScript(() => {
    let s = 4242; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {}
  });
  await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(6000); // the boot warm-up
  await p.evaluate(async () => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts');
    const RS = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts'), WU = await import('/src/render/warmup.ts');
    const FX = await import('/src/fx/spawn.ts'), EN = await import('/src/render/enemies.ts'), GB = await import('/src/render/gross/mid/_greybox.ts');
    const $ = S.$, x0 = LY.slotRow(0).x0; $.gate = false;
    F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step();
    $.G.scroll = x0; $.G.si = $.G.script.length; W.enemies.length = 0;
    BI.openFork(0); $.G.fork.opts = ['acid', 'acid']; $.G.fork.t = 50; $.G.tally = null;
    Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step(); $.G.scroll = x0 + 1000;
    for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
    $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
    WU.warmNow(['cyst']);
    SP.midboss('cyst', BI.MID_NAMES.cyst, 'acid');
    const adv = (n) => { for (let i = 0; i < n; i++) { Object.assign($.P, { x: 90, y: 135, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; ST.step(); } RS.render(); };
    adv(140); W.eshots.length = 0; RS.render();
    const real = EN.DRAW.cyst;
    window.__k = 0;
    const gb = GB.greybox({ col: BI.BIOMES.acid.col, r: 21, tell: () => window.__k }).draw;
    window.__T = {
      adv, $, W,
      grey: (k) => { window.__k = k; EN.DRAW.cyst = gb; RS.render(); EN.DRAW.cyst = real; },
      real: () => { RS.render(); },
      // the cyst's telegraph, render-only: the sim's st/wt swapped in for one render, then put back
      tel: () => { const m = $.G.mini, st = m.st, wt = m.wt; m.st = 'tel'; m.wt = 40; RS.render(); m.st = st; m.wt = wt; },
      at: () => { const m = $.G.mini; return m ? { x: m.x, y: m.y } : null; },
      gore: () => { W.eshots.length = 0; for (let k = 0; k < 3; k++) FX.gore(170 + k * 70, 120 + k * 22, 4, { limbs: 2, teeth: 3, rope: 3, metal: 1 }); adv(14); },
    };
  });
  const rect = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const zoom = async (name) => {
    const m = await p.evaluate(() => window.__T.at()); if (!m) return;
    const s = rect.w / 480, cxp = rect.x + m.x * s, cyp = rect.y + m.y * s, half = 40 * s;
    await p.screenshot({ path: `${OUT}/${name}-zoom.png`, clip: { x: Math.max(0, cxp - half), y: Math.max(0, cyp - half), width: half * 2, height: half * 2 } });
  };
  const shot = async (name, fn, arg) => { await p.evaluate(([fn, arg]) => window.__T[fn](arg), [fn, arg]); await p.screenshot({ path: `${OUT}/${name}.png` }); await p.evaluate(([fn, arg]) => window.__T[fn](arg), [fn, arg]); await zoom(name); console.log('shot', name); };
  await shot(`tone-greybox-calm-${vn}`, 'grey', 0);
  await shot(`tone-greybox-half-${vn}`, 'grey', .5);
  await shot(`tone-greybox-tell-${vn}`, 'grey', 1);
  await shot(`tone-cyst-${vn}`, 'real');
  await shot(`tone-cyst-tel-${vn}`, 'tel');
  await p.evaluate(() => window.__T.gore());
  await p.screenshot({ path: `${OUT}/tone-gore-${vn}.png` }); console.log('shot', `tone-gore-${vn}`);
  await cx.close();
}
console.log(errs.length ? 'errors:\n' + errs.join('\n') : 'errors: none');
await b.close();
if (server) await server.close();
