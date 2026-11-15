// Title-screen perf probe (LS2-eye): what one title frame costs, before and after the ROT eye. The game's own rAF loop is parked
// and frames are driven by hand, one step() + render() each, on the real clock.
// Usage: node tools/title-perf-probe.mjs <url> [--mode raf|readback|both|heap|boot] [--dk 4] [--throttle 4] [--frames 1200]
//          [--angle gl] [--uncapped] [--no-head] [--tag name] [--shot file.png]
//   Needs the VITE DEV server (imports live modules). Prints a table and a `RESULT {json}` line to stdout; writes no files but --shot's.
//   raf       one frame per real rAF: JS time, and the rAF interval, which is the only reading that includes the compositor.
//             --uncapped frees rAF from vsync (--disable-gpu-vsync --disable-frame-rate-limit), so the interval shows throughput with
//             the GPU in the loop instead of sitting pinned at 16.7 ms: the headroom reading.
//   readback  one frame per loop, then getImageData on 1 px of the display canvas. Chromium probably moves a canvas read this
//             often to software, so treat it as a curiosity, not a reading of the GPU path.
//   heap      JS heap slope and allocation per frame (precise memory info), forced-GC growth, allocating functions (sampling profiler).
//   boot      cold page: old hero's texture paint (warmHeroEye + heroTex) if the build has it, first title frames against steady
//             ones (JS only), and each rot_ and head_ layer's decode: decode() wall time, and a cold synchronous first draw.
//   The easter-egg head is held on screen (E in titleblood.ts, parked in LINGER on the left rail) unless --no-head. A build without
//   titleblood.ts (93e595b) has no head and runs the same modes.
import { chromium } from 'playwright';

const argv = process.argv.slice(2), url = argv[0];
if (!url || url.startsWith('--')) { console.error('usage: title-perf-probe.mjs <url> [--mode ...] (see the header)'); process.exit(2); }
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i > 0 ? argv[i + 1] : d; };
const MODE = opt('mode', 'both'), DK = +opt('dk', 4), THR = +opt('throttle', 4), FRAMES = +opt('frames', 1200), HEAD = !argv.includes('--no-head');
const ANGLE = opt('angle', 'gl'), TAG = opt('tag', '');
const PREROLL = 300;

// the Fold's cover-screen shape, the same as title-shots' phone: at dsf 2.625 fit() reaches DK 4. A 960x540 dsf 1 page never
// does (fit() caps k at ceil(scale * dsf)), so ?dk=4 alone would silently measure DK 2; run() asserts the DK it got
const VP = { viewport: { width: 904, height: 412 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true };
const args = ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', `--use-angle=${ANGLE}`, ...(ANGLE === 'vulkan' ? ['--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE'] : []), '--enable-gpu-rasterization'];
if (MODE === 'heap') args.push('--enable-precise-memory-info');
const UNCAPPED = argv.includes('--uncapped');
if (UNCAPPED) args.push('--disable-gpu-vsync', '--disable-frame-rate-limit');
const b = await chromium.launch({ args });
const errs = [], notes = [];

async function open() {
  const ctx = await b.newContext(VP), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) navs++; });
  await p.addInitScript(() => {
    window.__raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 1;
    window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {}
  });
  await p.goto(`${url}${url.includes('?') ? '&' : '?'}dk=${DK}`);
  await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
  const cdp = await ctx.newCDPSession(p);
  return { ctx, p, cdp, navs: () => navs };
}

/** the title, warm: every sprite in, the idle warm-up drained so no slice lands in a timed frame */
const SETUP = async ({ HEAD, PREROLL }) => {
  const S = await import('/src/state.ts'), RS = await import('/src/render/screens.ts'), SV = await import('/src/save.ts'), SP = await import('/src/sprites.ts');
  const ST = await import('/src/step.ts'), C = await import('/src/core.ts'), WU = await import('/src/render/warmup.ts');
  let TB = null; try { TB = await import('/src/render/titleblood.ts'); } catch (e) {}
  S.$.gate = false; SV.SET.asked = true; S.$.state = 'title';
  await new Promise((res) => { let n = 0; const iv = setInterval(() => { if (Object.values(SP.SPR).every((s) => s.fw > 0) || ++n > 200) { clearInterval(iv); res(); } }, 50); });
  await new Promise((res) => setTimeout(res, 1700)); // startWarm's first slice is on a 1500 ms timer
  let guard = 0; while (WU.warmPump() && guard++ < 5000);
  // parked mid-visit on the left rail, the longest drip floor, so the sprite and the drips both run in every timed frame
  if (TB && HEAD) Object.assign(TB.E, { phase: TB.LINGER, rail: 1, x: 1, y: 120, timer: 1e9 });
  const one = () => { ST.step(); RS.render(); };
  for (let i = 0; i < PREROLL; i++) one();
  const q = (a, x) => { const s = Array.from(a).sort((u, v) => u - v); return s[Math.min(s.length - 1, Math.floor(s.length * x))]; };
  const pct = (a) => a.length ? { p50: q(a, .5), p95: q(a, .95), p99: q(a, .99), max: Math.max(...a), avg: Array.from(a).reduce((u, v) => u + v, 0) / a.length } : null;
  const liveNow = () => TB ? TB.D.n : 0;
  window.__T = { S, RS, ST, C, TB, one, pct, q, liveNow, DK: () => [S.$.DK, C.cv.width, C.cv.height] };
  return { dk: S.$.DK, cw: C.cv.width, head: !!(TB && HEAD), headArt: !!(SP.SPR.head_egg && SP.SPR.head_egg.fw), phase: TB ? TB.E.phase : null };
};

const RAF = (n) => new Promise((res) => {
  const T = window.__T, js = new Float32Array(n), iv = new Float32Array(n), nl = new Float32Array(n);
  let i = 0, last = 0, mem = 0;
  const tick = (now) => {
    const t0 = performance.now(); T.ST.step(); T.RS.render();
    js[i] = performance.now() - t0; iv[i] = last ? now - last : 16.7; last = now; nl[i] = T.liveNow(); mem = Math.max(mem, nl[i]);
    if (++i < n) window.__raf(tick);
    else res({ js: T.pct(js.slice(30)), interval: T.pct(iv.slice(30)), over18: iv.slice(30).filter((v) => v > 18).length / (n - 30), over25: iv.slice(30).filter((v) => v > 25).length / (n - 30), liveAvg: nl.reduce((u, v) => u + v, 0) / n, livePeak: mem, state: T.S.$.state, dk: T.DK() });
  };
  window.__raf(tick);
});

const READ = async (n) => {
  const T = window.__T, js = new Float32Array(n), all = new Float32Array(n), rb = new Float32Array(n), nl = new Float32Array(n);
  let mem = 0;
  const one = (i) => {
    const t0 = performance.now(); T.ST.step(); T.RS.render(); const t1 = performance.now(); T.C.dctx.getImageData(10, 10, 1, 1); const t2 = performance.now();
    js[i] = t1 - t0; rb[i] = t2 - t1; all[i] = t2 - t0; nl[i] = T.liveNow(); mem = Math.max(mem, nl[i]);
  };
  for (let i = 0; i < n; i++) { one(i); if (i % 60 === 59) await new Promise((r) => setTimeout(r, 0)); } // yield: the compositor gets a turn
  return { js: T.pct(js.slice(30)), readback: T.pct(rb.slice(30)), total: T.pct(all.slice(30)), over: all.slice(30).filter((v) => v > 1000 / 60).length / (n - 30), liveAvg: nl.reduce((u, v) => u + v, 0) / n, livePeak: mem, state: T.S.$.state, dk: T.DK() };
};

const HEAP = async (n) => {
  const T = window.__T, used = new Float64Array(n + 1);
  // a reading's own cost, so it can be taken off the frame figure
  let self = 0, l0 = performance.memory.usedJSHeapSize;
  for (let i = 0; i < 2000; i++) { const u = performance.memory.usedJSHeapSize; if (u > l0) self += u - l0; l0 = u; }
  used[0] = performance.memory.usedJSHeapSize;
  let up = 0, gcs = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    T.one();
    const u = performance.memory.usedJSHeapSize; used[i + 1] = u;
    if (u > used[i]) up += u - used[i]; else if (u < used[i]) gcs++;
    peak = Math.max(peak, u);
    if (i % 60 === 59) await new Promise((r) => setTimeout(r, 0));
  }
  // least-squares slope over the whole run. A sawtooth of minor GCs: read it with the forced-GC growth, not alone
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i <= n; i++) { sx += i; sy += used[i]; sxy += i * used[i]; sxx += i * i; }
  const slope = (sxy * (n + 1) - sx * sy) / (sxx * (n + 1) - sx * sx);
  return { slopeBytesPerFrame: slope, state: T.S.$.state, dk: T.DK(), livePeak: T.TB ? T.TB.D.peak : 0, bytesPerFrameRaw: up / n, readingSelfBytes: self / 2000, drops: gcs, framesPerDrop: gcs ? n / gcs : null, peakMB: peak / 1048576 };
};

const fmt = (x) => x ? `p50 ${x.p50.toFixed(1).padStart(5)}  p95 ${x.p95.toFixed(1).padStart(5)}  p99 ${x.p99.toFixed(1).padStart(5)}  max ${x.max.toFixed(1).padStart(6)}` : '-';
const R = { uncapped: UNCAPPED, tag: TAG, url, mode: MODE, dkAsked: DK, throttle: THR, head: HEAD, frames: FRAMES };

{ // what the browser actually got
  const ctx = await b.newContext(), p = await ctx.newPage();
  R.renderer = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; });
  try {
    await p.goto('chrome://gpu', { timeout: 4000 }); await p.waitForTimeout(500);
    R.canvasFeature = await p.evaluate(() => { const walk = (n, o) => { if (n.shadowRoot) walk(n.shadowRoot, o); for (const c of n.children || []) walk(c, o); if (n.tagName === 'LI' && /^Canvas:/.test(n.textContent.trim())) o.push(n.textContent.trim()); return o; }; return walk(document.documentElement, []).join(' | '); }) || 'not readable';
  } catch (e) { R.canvasFeature = 'not readable'; }
  await ctx.close();
}
console.log(`renderer: ${R.renderer}\ncanvas feature: ${R.canvasFeature}\n${UNCAPPED ? 'rAF UNCAPPED  ' : ''}throttle ${THR}x`);

async function warm(page) {
  const s = await page.p.evaluate(SETUP, { HEAD, PREROLL });
  if (s.dk !== DK) { errs.push(`asked DK ${DK}, got ${s.dk}`); }
  await page.cdp.send('Emulation.setCPUThrottlingRate', { rate: THR });
  return s;
}

for (const m of MODE === 'both' ? ['raf', 'readback'] : [MODE]) {
  if (m === 'boot') continue;
  const page = await open();
  const s = await warm(page);
  R.setup = s;
  if (m === 'raf') {
    R.raf = await page.p.evaluate(RAF, FRAMES);
    if (opt('shot')) await page.p.screenshot({ path: opt('shot') });
    console.log(`raf      DK ${R.raf.dk[0]} (${R.raf.dk[1]}x${R.raf.dk[2]})  live avg ${R.raf.liveAvg.toFixed(0)} peak ${R.raf.livePeak}  over 18 ms ${(100 * R.raf.over18).toFixed(1)}%  over 25 ms ${(100 * R.raf.over25).toFixed(1)}%`);
    console.log(`  step+render JS    ${fmt(R.raf.js)}\n  rAF interval      ${fmt(R.raf.interval)}`);
  } else if (m === 'readback') {
    R.read = await page.p.evaluate(READ, FRAMES);
    console.log(`readback DK ${R.read.dk[0]} (${R.read.dk[1]}x${R.read.dk[2]})  live avg ${R.read.liveAvg.toFixed(0)} peak ${R.read.livePeak}  over 16.7 ms ${(100 * R.read.over).toFixed(1)}%`);
    console.log(`  step+render JS    ${fmt(R.read.js)}\n  1 px readback     ${fmt(R.read.readback)}\n  total             ${fmt(R.read.total)}`);
  } else if (m === 'heap') {
    await page.cdp.send('HeapProfiler.enable');
    await page.cdp.send('HeapProfiler.collectGarbage');
    const before = (await page.cdp.send('Runtime.getHeapUsage')).usedSize;
    await page.cdp.send('HeapProfiler.startSampling', { samplingInterval: 8192, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    R.heap = await page.p.evaluate(HEAP, FRAMES);
    const { profile } = await page.cdp.send('HeapProfiler.stopSampling');
    await page.cdp.send('HeapProfiler.collectGarbage');
    const after = (await page.cdp.send('Runtime.getHeapUsage')).usedSize;
    R.heap.growthKB = (after - before) / 1024;
    const self = {}; let tot = 0;
    const walk = (n) => { const cf = n.callFrame, k = `${cf.functionName || '(anon)'} ${cf.url.split('/src/').pop().split('?')[0]}:${cf.lineNumber + 1}`; self[k] = (self[k] || 0) + n.selfSize; tot += n.selfSize; (n.children || []).forEach(walk); };
    walk(profile.head);
    R.heap.sampledBytesPerFrame = tot / FRAMES;
    R.heap.top = Object.entries(self).sort((x, y) => y[1] - x[1]).slice(0, 14).map(([k, v]) => `${(v / FRAMES).toFixed(0).padStart(7)} B/frame  ${k}`);
    console.log(`heap     DK ${R.heap.dk[0]} state ${R.heap.state} ${FRAMES} frames: slope ${R.heap.slopeBytesPerFrame.toFixed(1)} B/frame, raw ${R.heap.bytesPerFrameRaw.toFixed(0)} B/frame (one reading alone ${R.heap.readingSelfBytes.toFixed(0)} B), sampled ${R.heap.sampledBytesPerFrame.toFixed(0)} B/frame, heap drops ${R.heap.drops} (every ${R.heap.framesPerDrop ? R.heap.framesPerDrop.toFixed(0) : '-'} frames), growth after forced GC ${R.heap.growthKB.toFixed(0)} KB`);
    console.log(R.heap.top.map((l) => '  ' + l).join('\n'));
  }
  if (page.navs() > 1) errs.push(`page navigated ${page.navs()} times mid-run: discard this run`);
  await page.ctx.close();
}

if (MODE === 'boot') {
  const page = await open();
  const p = page.p;
  await page.cdp.send('Emulation.setCPUThrottlingRate', { rate: THR });
  R.boot = await p.evaluate(async () => {
    const S = await import('/src/state.ts'), RS = await import('/src/render/screens.ts'), SV = await import('/src/save.ts'), SP = await import('/src/sprites.ts'), ST = await import('/src/step.ts'), C = await import('/src/core.ts'), HE = await import('/src/render/heroeye.ts');
    S.$.gate = false; SV.SET.asked = true; S.$.state = 'title';
    const out = { decode: {}, coldDraw: {}, warmLogAtFirstFrame: (window.__warm ? window.__warm() : []).map((l) => `${l.k} ${l.ms.toFixed(1)}`) };
    // before anything else can build it: the warm-up's first slice is on a 1500 ms timer
    { const t0 = performance.now(); HE.warmHeroEye(); out.warmHeroEye = performance.now() - t0; }
    if (HE.heroTex) { const t0 = performance.now(); HE.heroTex(); out.heroTex = performance.now() - t0; }
    await new Promise((res) => { let n = 0; const iv = setInterval(() => { if (Object.values(SP.SPR).every((s) => s.fw > 0) || ++n > 400) { clearInterval(iv); res(); } }, 25); });
    const frame = () => { const t0 = performance.now(); ST.step(); RS.render(); return performance.now() - t0; };
    const f = []; for (let i = 0; i < 90; i++) f.push(frame());
    const s = f.slice(30).sort((u, v) => u - v);
    out.dk = S.$.DK; out.first = f.slice(0, 5).map((v) => +v.toFixed(1)); out.steady = +s[Math.floor(s.length / 2)].toFixed(2); out.firstExtra = +f.slice(0, 5).reduce((u, v) => u + Math.max(0, v - out.steady), 0).toFixed(1);
    const fresh = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src + (src.includes('?') ? '&' : '?') + 'cb=' + Math.random(); });
    for (const k of Object.keys(SP.SPR).filter((k) => /^(rot_|head_)/.test(k))) {
      const src = SP.SPR[k].img.src;
      try {
        // fetched first, so neither figure holds the network. decode() runs off the main thread: wall time, not main-thread cost
        const a = await fresh(src), t0 = performance.now(); await a.decode(); out.decode[k] = +(performance.now() - t0).toFixed(1);
        // a software canvas decodes in the draw: the synchronous worst case. The game's display canvas may decode on a raster worker
        const b = await fresh(src), c = document.createElement('canvas'); c.width = b.naturalWidth; c.height = b.naturalHeight;
        const x = c.getContext('2d', { willReadFrequently: true }), t1 = performance.now(); x.drawImage(b, 0, 0); x.getImageData(0, 0, 1, 1); out.coldDraw[k] = +(performance.now() - t1).toFixed(1);
      } catch (e) { out.decode[k] = 'failed'; }
    }
    return out;
  });
  console.log('boot', JSON.stringify(R.boot));
  if (page.navs() > 1) errs.push(`page navigated ${page.navs()} times mid-run: discard this run`);
  await page.ctx.close();
}

console.log(`not measured:
  - real Fold or any phone: desktop Chromium, main thread throttled ${THR}x; the GPU process and raster workers are NOT throttled, and this GPU is not an Adreno.
  - readback mode's raster may be software if Chromium demoted the canvas after repeated getImageData; raf mode's interval is the GPU path.
  - the compositor's cost past the rAF interval; the Android WebView (this is Chromium in Playwright); thermal throttling on a phone.
  - native canvas memory (heap mode sees the JS heap only); idle warm-up slices (drained before timing).
  - timers cover main-thread recording of canvas commands; raster in the GPU process is outside them and is not throttled.`);
console.log('errors:', errs.length ? errs.join(' | ') : 'none');
console.log('RESULT ' + JSON.stringify(R));
await b.close();
