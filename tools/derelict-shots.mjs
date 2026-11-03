// Derelict skyline shots (art-derelict-vapor): the "city blocks that float by" behind Open Orbit, on the live loop.
// Full frames at three scroll positions (one with enemy fire over the skyline), plus isolated 3x strips of
// drawDerelict alone (no sky, no post-FX) so the blocks, neon and windows can be judged pixel by pixel. The sunset
// disc sits at off+1560, which no layout's Open Orbit scrolls to (space fades out first), so its strip draws
// drawDerelict straight at a scroll past the fade: a preview of the art, not a reachable game state.
// Usage: node tools/derelict-shots.mjs <outDir> [prefix] [--layout long4]   (starts its own Vite dev server)
import { chromium } from 'playwright';
import { useLayout, ranOn, LY } from './layout-arg.mjs';
import fs from 'node:fs';
const [OUT = 'production/qa/evidence/derelict-vapor', PRE = 'after'] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const { createServer } = await import('vite');
const server = await createServer({ server: { port: 5231, strictPort: false, host: '127.0.0.1', fs: { strict: false } }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
await p.addInitScript(() => { window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
await useLayout(p, 'derelict-shots');
await p.waitForTimeout(800);
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), F = await import('/src/flow.ts');
  const C = await import('/src/core.ts'), SP = await import('/src/enemies/spawn.ts'), T = await import('/src/render/terrain.ts');
  window.__d = { S, W, F, C, SP, T };
  S.$.gate = false; F.newGame(0); S.$.state = 'play';
});
await p.waitForTimeout(400);
const o = LY.rowOfKind('orbit').x0;
// park the run at scroll sc with an empty sky; the live loop then runs ms of real frames
const at = async (sc, fire, ms = 450) => {
  await p.evaluate(({ sc, fire }) => {
    const { S, W, C, SP } = window.__d, $ = S.$;
    $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null;
    for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops]) if (a) a.length = 0;
    $.G.scroll = sc; Object.assign($.P, { x: 70, y: C.PH * .45, alive: true, inv: 9999 });
    // a spread of toxic orbs fanned across the skyline band, so their readability over the blocks is on record
    if (fire) for (let i = 0; i < 26; i++) SP.eshoot(C.W * .92, C.PH * (.5 + (i % 5) * .07), Math.PI + (i - 13) * .06, .6 + (i % 3) * .2);
  }, { sc, fire });
  await p.waitForTimeout(ms);
};
const shot = (n) => p.locator('#c').screenshot({ path: `${OUT}/${PRE}-${n}.png` });
for (const [n, sc, fire] of [['01-orbit-early', o + 300, 0], ['02-orbit-fire', o + 1900, 1], ['03-orbit-late', o + 3600, 0]]) {
  await at(sc, fire); await shot(`${n}-sc${sc}`);
}
// isolated strips: drawDerelict on a plain void, read back from the low-res canvas and scaled 3x (nearest)
for (const [n, sc] of [['04-strip-early', 300], ['05-strip-late', 3600], ['06-strip-disc-preview', 13100]]) {
  const png = await p.evaluate((sc) => {
    const { C, T, S } = window.__d, x = C.ctx, k = 3, y0 = 100, h = 130;
    x.save(); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#05040b'; x.fillRect(0, 0, C.W, C.H);
    T.drawDerelict(1, sc);
    x.restore();
    const c = document.createElement('canvas'); c.width = C.W * k; c.height = h * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(C.lo, 0, y0, C.W, h, 0, 0, C.W * k, h * k);
    return c.toDataURL('image/png').split(',')[1];
  }, sc);
  fs.writeFileSync(`${OUT}/${PRE}-${n}-sc${sc}.png`, Buffer.from(png, 'base64'));
}
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
ranOn('derelict-shots'); await b.close(); await server.close();
