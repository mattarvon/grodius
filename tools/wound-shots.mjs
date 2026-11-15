// Wound-state shots (ls2-read item 2, src/render/wounds.ts): each biome's normal look and its wound (remix) look at the
// same scroll and frame, on desktop and a Fold-cover-like phone viewport; each wound with a lime volley over it; a fork
// with one fresh and one remix gate. The wound is forced in page (G.visitNo[0] = 1, G.bvis[b] = 1): no shipping flag.
// Also prints: the §7 contrast numbers per biome (bare background, no actors, read off the canvas) and the time to build
// each of the 8 wound layers at 4x CPU throttle (the cost of one wound:<b> warm slice).
// Files: <outDir>/wound-<biome>-<normal|wound|bullets>-<desktop|phone>.png and wound-gate-<view>.png.
// Not measured: slot 1 (every scene is staged in biome slot 0), Descent 2+, and the terrain-edge rule (§7 rule 4, by eye).
// Usage: node tools/wound-shots.mjs <outDir> [url] [--only ice,fire]   (no url: starts its own Vite dev server)
// Heavy: run under flock /tmp/grodius-heavy.lock sh -c 'node tools/wound-shots.mjs ...'
import { chromium } from 'playwright';
import fs from 'node:fs';

const [OUT, url0] = process.argv.slice(2).filter((v, i, A) => !v.startsWith('--') && !(A[i - 1] || '').startsWith('--'));
if (!OUT) { console.error('usage: node tools/wound-shots.mjs <outDir> [url]'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
let url = url0, server;
if (!url) {
  const { createServer } = await import('vite');
  const nm = fs.realpathSync('node_modules');
  server = await createServer({ server: { port: 5499, strictPort: false, host: '127.0.0.1', fs: { allow: [process.cwd(), nm] } }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
const BIOMES = ['ice', 'acid', 'fire', 'snot'];
const VIEWS = [
  ['desktop', { viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }],
  ['phone', { viewport: { width: 832, height: 384 }, deviceScaleFactor: 2.6, hasTouch: true }],
];
const SC = 1100; // mid-stage, past the fade-in, before the slot's midboss
// --only ice,acid: retake just those biomes and skip the gate (a check-pass retake); default all four plus the gate
const oi = process.argv.indexOf('--only'), ONLY = oi >= 0 ? process.argv[oi + 1].split(',') : null;

const b = await chromium.launch();
const errs = [], probe = {};
let slices = null;
for (const [vn, opts] of VIEWS) {
  const cx = await b.newContext(opts), p = await cx.newPage();
  p.on('pageerror', (e) => errs.push(`${vn}: ${e.message}`));
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
  await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  await p.evaluate(async () => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts'), BI = await import('/src/biomes.ts');
    const L = await import('/src/layout.ts'), WD = await import('/src/render/wounds.ts');
    const $ = S.$;
    const clear = () => { $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null; $.G.banner = null; if ($.G.pend) $.G.pend.length = 0; for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops, W.decals]) if (a) a.length = 0; };
    const fresh = () => { $.gate = false; IN.K.KeyZ = false; F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step(); };
    window.__wd = {
      // fly into a fork whose both gates lead to b, then hold mid-stage
      stage(b, sc) {
        fresh(); clear(); $.G.scroll = L.slotRow(0).x0; BI.openFork(0); $.G.fork.opts = [b, b]; $.G.fork.t = 50;
        Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step();
        const x = L.slotRow(0).x0 + sc;
        for (let i = 0; i < 240; i++) { clear(); Object.assign($.P, { x: 60, y: C.PH / 2, alive: true, inv: 30 }); $.G.scroll = x + i * .5; ST.step(); }
        clear(); $.G.visitNo[0] = 0; RS.render();
        while (WD.warmWound(b)); // the warm-up builds wound:<b> once the biome is chosen; drawBiomeBG never bakes it
      },
      // a volley along the floor's bright band (the acid fluid), 6 px above the floor line; returns the brightest 16 x 16
      // box mean (relative luminance) centred on those bullets in the frame without them, and the bullet contrast
      floorVolley() {
        const lin = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        // read the displayed frame (the low-res buffer is not left holding it after render), scaled back to game pixels
        RS.render(); const cv = C.cv, k = cv.width / C.W, d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, Y = (x, y) => { const i = ((Math.floor((y + .5) * k)) * cv.width + Math.floor((x + .5) * k)) * 4; return .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); };
        const pts = []; for (let x = 40; x < C.W - 20; x += 24) pts.push([x, Math.round(W.floorAt(x + $.G.scroll) - 6)]);
        let box = 0; for (const [x, y] of pts) { let s = 0, n = 0; for (let yy = y - 8; yy < y + 8; yy++) for (let xx = x - 8; xx < x + 8; xx++) if (yy >= 0 && yy < C.PH) { s += Y(xx, yy); n++; } box = Math.max(box, s / n); }
        W.eshots.length = 0; for (const [x, y] of pts) W.eshots.push({ x, y, vx: -2, vy: 0, r: 2, k: 'orb', t: 10 }); RS.render(); W.eshots.length = 0;
        return { box, cr: (0.85 + .05) / (box + .05) };
      },
      wound(on) { $.G.visitNo[0] = on ? 1 : 0; RS.render(); },
      // a dense lime volley over the whole play band (static: pushed after the last step, drawn by the next render)
      volley() { W.eshots.length = 0; for (let i = 0; i < 48; i++) W.eshots.push({ x: 120 + (i % 12) * 28, y: 30 + ((i / 12) | 0) * 52 + (i % 2) * 14, vx: -2, vy: (i % 3 - 1) * .5, r: i % 5 ? 2 : 3, k: i % 5 ? 'orb' : 'glob', t: 10 }); RS.render(); W.eshots.length = 0; },
      // the bare background (drawBiomeBG alone, on black, into the 480 x 270 low-res buffer: no terrain, actors, HUD or
      // darkness overlay, so it reads brighter than play does): mean relative luminance per 32 px column in y 20..PH-20,
      // and the brightest 16 x 16 box mean
      lum() {
        const g = C.ctx; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(0, 0, C.W, C.H); BI.drawBiomeBG($.G.scroll); g.restore();
        const cv = g.canvas, sx = 1, sy = 1, d = g.getImageData(0, 0, cv.width, cv.height).data;
        const lin = (v) => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
        const Y = (x, y) => { const i = ((y * sy | 0) * cv.width + (x * sx | 0)) * 4; return .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); };
        const cols = []; for (let c = 0; c < C.W; c += 32) { let s = 0, n = 0; for (let y = 20; y < C.PH - 20; y += 2) for (let x = c; x < c + 32; x += 2) { s += Y(x, y); n++; } cols.push(s / n); }
        let box = 0; for (let by = 20; by < C.PH - 36; by += 8) for (let bx = 0; bx < C.W - 16; bx += 8) { let s = 0; for (let y = by; y < by + 16; y += 2) for (let x = bx; x < bx + 16; x += 2) s += Y(x, y); box = Math.max(box, s / 64); }
        RS.render();
        return { cols, box };
      },
      gate(opts, bvis) {
        fresh(); clear(); const prev = L.row(L.stageOfSlot(0) - 1);
        $.G.scroll = prev.bossX + (prev.kind === 'orbit' ? 50 : 200); $.G.bvis = { ...bvis };
        for (const k of Object.keys(bvis)) while (WD.warmWound(k)); // the warm-up has built it by the fork (wound:<b>)
        BI.openFork(0); $.G.fork.opts = opts; $.G.fork.t = 120; $.G.banner = null;
        Object.assign($.P, { x: 60, y: C.PH / 2, alive: true, inv: 600 }); RS.render();
      },
      // each warm slice of each wound:<b> unit, timed as warmPump runs it (one warmWound call per slice)
      slices() { const out = {}; for (const b of ['ice', 'acid', 'fire', 'snot']) { WD.dropWound(b); const ms = []; let more = true; while (more) { const t0 = performance.now(); more = WD.warmWound(b); ms.push(+(performance.now() - t0).toFixed(2)); } out[b] = ms; } return out; },
    };
  });
  const shot = (n) => p.locator('#c').screenshot({ path: `${OUT}/wound-${n}.png` });
  for (const bm of BIOMES) {
    if (ONLY && !ONLY.includes(bm)) continue;
    await p.evaluate(({ bm, SC }) => window.__wd.stage(bm, SC), { bm, SC });
    await shot(`${bm}-normal-${vn}`);
    if (vn === 'desktop') probe[bm] = { normal: await p.evaluate(() => window.__wd.lum()) };
    await p.evaluate(() => window.__wd.wound(true));
    await shot(`${bm}-wound-${vn}`);
    if (vn === 'desktop') probe[bm].wound = await p.evaluate(() => window.__wd.lum());
    await p.evaluate(() => window.__wd.volley());
    await shot(`${bm}-bullets-${vn}`);
    if (bm === 'acid') { const f = await p.evaluate(() => window.__wd.floorVolley()); await shot(`acid-bullets-floor-${vn}`); probe.floor = probe.floor || {}; probe.floor[vn] = f; }
  }
  if (!ONLY) { await p.evaluate(() => window.__wd.gate(['ice', 'fire'], { fire: 1 })); await shot(`gate-${vn}`); }
  if (vn === 'desktop') {
    const cdp = await cx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    slices = await p.evaluate(() => window.__wd.slices());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await cx.close();
}
const bulletY = 0.85; // #b6ff3a relative luminance, spec §7 rule 2
if (probe.floor) for (const [vn, f] of Object.entries(probe.floor)) console.log(`acid floor volley (${vn}): brightest 16px box Y ${f.box.toFixed(3)} around the floor bullets, bullet contrast ${f.cr.toFixed(1)}:1 (limit 4.5; full frame incl. terrain)`);
for (const bm of BIOMES) {
  if (!probe[bm]) { console.log(`${bm}: not retaken (--only)`); continue; }
  const { normal, wound } = probe[bm];
  const ratio = Math.max(...wound.cols.map((v, i) => v / Math.max(1e-4, normal.cols[i])));
  const cr = (bulletY + .05) / (wound.box + .05);
  console.log(`${bm}: worst column wound/normal luminance ${ratio.toFixed(2)} (limit 1.15); brightest 16px box Y ${wound.box.toFixed(3)} (normal ${normal.box.toFixed(3)}), bullet contrast ${cr.toFixed(1)}:1 (limit 4.5)`);
}
console.log('wound warm slices, ms each at 4x CPU:', JSON.stringify(slices));
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
if (server) await server.close();
