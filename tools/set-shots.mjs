// Set-piece shots (build plan LS2-mv): every catalogue piece new in LS2-mv, fired from its script entry in its own biome,
// 90 frames on, full frame. Each shot starts on an empty screen, and the ship is invincible and parked at the left.
// Usage: node tools/set-shots.mjs <outDir> [url] [--layout long4]   (no url: starts its own Vite dev server)
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import fs from 'node:fs';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OUT = pos[0];
let url = pos[1], server;
if (!OUT) { console.error('usage: node tools/set-shots.mjs <outDir> [url] [--layout long4]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5498, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'set-shots');
await p.waitForTimeout(1500);
const list = await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts'), BI = await import('/src/biomes.ts'), L = await import('/src/layout.ts'), SD = await import('/src/setdraw.ts');
  const { $ } = S;
  const wipe = () => { $.G.banner = null; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null; $.G.pend.length = 0; for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops]) if (a) a.length = 0; };
  window.__into = (bk) => {
    S.$.gate = false; IN.K.KeyZ = false; F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    wipe();
    $.G.scroll = L.rowOfKind('orbit').bossX + 50;
    ($.G.picks ||= {})[L.stageOfSlot(0)] = { mv: 0, sp: SD.CATALOG[bk].slice(2) };
    BI.openFork(0); $.G.fork.opts = [bk, bk]; $.G.fork.t = 50;
    Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step();
  };
  window.__fire = (id) => {
    const i = $.G.script.findIndex((e) => e.k === 'set:' + id), x = $.G.script[i].x;
    wipe(); $.G.stage = 1; $.G.si = i; $.G.scroll = x - 1;
    for (let n = 0; n < 90; n++) { Object.assign($.P, { x: 40, y: C.PH / 2, alive: true, inv: 30 }); ST.step(); if ($.G.si > i) $.G.si = $.G.script.length; }
    RS.render();
    return W.enemies.length;
  };
  return Object.entries(SD.CATALOG).flatMap(([bk, a]) => a.slice(2).map((id) => [bk, id]));
});
let at = '';
for (const [bk, id] of list) {
  if (bk !== at) { await p.evaluate((bk) => window.__into(bk), bk); at = bk; }
  const n = await p.evaluate((id) => window.__fire(id), id);
  await p.screenshot({ path: `${OUT}/${bk}-${id}.png` });
  console.log(`${bk} ${id}: ${n} enemies at frame 90`);
}
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
ranOn('set-shots');
await b.close();
if (server) await server.close();
