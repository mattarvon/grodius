// Perf probe: real-clock cost of step() and render() per frame in the heaviest scenes: a crowded Open Orbit with a
// strong kit, every boss / midboss in its own biome, and each boss's death + aftermath. The game's own rAF loop is
// disabled; frames are driven by hand. CPU is throttled (default 4x) to approximate a phone.
// Usage: node tools/perf-probe.mjs <url> [throttle=4] [scenes=all|maw,crux,...] [prof] [--layout short]   (WARM_MS=20000 env: wait for the idle art warm-up first, like the title screen; fairer for boss scenes)
//   prints avg / p95 / max ms for step and render, and the share of frames whose step+render blows the 16.7 ms budget.
//   prof: also samples the JS profiler per scene and prints the top self-time functions.
//   ELITE=1 env: in biome scenes, a crowd of elites (enemies/elite.ts) keeps streaming in alongside the fight (~8 alive);
//   ELITE=2: the same crowd, not elite (the control: what the elite visuals and attacks cost on top).
//   XHOST=ice|acid|fire|snot env: the four biome midboss scenes run as crossovers in that biome (host tint and terrain fit, LS1 P0).
//   World x comes from src/layout.ts: biome scenes at biome slot 0 (stage-relative x 1000), the Saucer at ufoAt() + 150,
//   the Drive at bossAt(), the crowded orbit at Open Orbit x 600.
//   LS1 row K scenes (per-route warm-up; each name also expands: mid8, cold, peak, route):
//   mid8:<kind>@<host>   "midboss + 8 incoming": 8 non-elite enemies streaming in alongside the fight, 16 kind x host cells.
//                        After the cells it prints the p95 of every kind pair per host, from the merged frames of both fights
//                        (a stage's two fights run one after the other, so a pair's frames are its two cells' frames).
//   cold:<kind>@<host>   a reloaded page (cold JIT and caches), the route warmed by the real pump, then the midboss's first 60
//                        frames. Target: max < 100 ms. COLD=1 env skips the pump, to show what the warm-up buys.
//   peak:<biome>         the densest 1500 px of a real biome script, every spawn elite, no invincible-kit shortcut on spawns.
//   route:<a>+<b>        a real flight from gate a through both biome stages to the Drive: two midboss warm-ups per stage, the
//                        pump on a 4 Hz beat, the drop at each stage start. Reports frames inside WARNINGs and each slice.
//   floor:<biome>        the same biome with nothing in it: no enemies, no fire. What every frame pays before anything is in it.
//   bootlog              the boot slices, timed at the throttle (the skyline bake among them).
//   warngate             the hard rule, in page: a WARNING fires with route art still unbuilt; no slice may run until it ends.
// Needs the VITE DEV server (imports live modules). Restart vite after edits before trusting numbers.
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import { BIOME_POOLS, ROSTER } from '../src/enemies/mid/roster.ts'; // plain Node reads the registry: the file is a leaf with erasable types
const [url, THR = '4', SC = 'all', PROF = ''] = process.argv.slice(2);
const HELD = ROSTER.filter((r) => BIOME_POOLS.includes(r.pool)), REST = ROSTER.filter((r) => !BIOME_POOLS.includes(r.pool)); // the registry, WIP kinds too
const KINDS = HELD.map((r) => r.k), HOSTS = BIOME_POOLS;
const SCENES = ['orbit', 'maw', ...REST.map((r) => r.k), ...KINDS, 'crux', 'butcher', 'gravity'];
const cells = (pre) => KINDS.flatMap((k) => HOSTS.map((h) => `${pre}:${k}@${h}`));
const GROUPS = { mid8: cells('mid8'), cold: cells('cold'), peak: HOSTS.map((h) => `peak:${h}`), floor: HOSTS.map((h) => `floor:${h}`), route: ['route:ice+acid', 'route:fire+snot'] };
const want = SC === 'all' ? SCENES : SC.split(',').flatMap((s) => GROUPS[s] || [s]);
// d3d11 falls back to SwiftShader on Linux (software raster, ~11x off: LS1-P0's report). ANGLE=gl there is the integrated GPU,
// ANGLE=vulkan the discrete one; the renderer in use is printed with the table, so numbers from different hosts can't be mixed up
const ANGLE = process.env.ANGLE || (process.platform === 'win32' ? 'd3d11' : 'gl');
const b = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', `--use-angle=${ANGLE}`, ...(ANGLE === 'vulkan' ? ['--enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE'] : []), '--enable-gpu-rasterization'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {}
  // every canvas the game makes, weakly held: a live total for the spec's 64 MB canvas-cache budget (decoded images aren't in it)
  const made = [], ce = document.createElement.bind(document);
  document.createElement = (t, o) => { const el = ce(t, o); if (String(t).toLowerCase() === 'canvas') made.push(new WeakRef(el)); return el; };
  window.__canvasMB = () => made.reduce((n, r) => { const c = r.deref(); return n + (c ? c.width * c.height * 4 : 0); }, 0) / 1048576;
});
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'perf-probe', { limits: 'fights are staged in Open Orbit, biome slot 0 and the Drive only; later biome slots and interior stages are not' });
await p.waitForTimeout(+(process.env.WARM_MS || 1500)); // images / patterns load (WARM_MS: let the idle warm-up finish, like the title screen does)
const cdp = await p.context().newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +THR });
/** a fresh page: cold JIT and cold caches, with the boot warm-up left to finish unthrottled, as a title screen does */
async function reloadCold() {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await p.reload(); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  await useLayout(p, 'perf-probe', { quiet: true });
  await p.waitForTimeout(+(process.env.WARM_MS || 1500));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +THR });
}
if (PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }

const STRONG = [{ speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }];
const BIOME = { ...Object.fromEntries(HELD.map((r) => [r.k, r.pool])), crux: 'ice', butcher: 'fire', maw: null, ufo: null, orbit: null, gravity: null };
const XHOST = process.env.XHOST || '';
if (XHOST) for (const k of KINDS) BIOME[k] = XHOST;

async function scene(k, { biome = BIOME[k], elite = +(process.env.ELITE || 0), xhost = XHOST, wantTot = false } = {}) {
  return p.evaluate(async ([k, biome, kit, elite, xhost, wantTot]) => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
    const BU = await import('/src/boss/update.ts'), SCR = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts');
    const $ = S.$; $.gate = false; IN.K.KeyZ = true;
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    const [pw, gm, pkk] = kit;
    const arm = () => { Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw); $.P.shield = 3; $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10; };
    if (biome) {
      const x0 = LY.slotRow(0).x0; $.G.scroll = x0; $.G.si = $.G.script.length; W.enemies.length = 0;
      BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
      Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
      ST.step(); $.G.scroll = x0 + 1000;
      for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
    }
    arm();
    if (k === 'orbit') { const o = LY.row(0).x0 + 600; $.G.scroll = o; $.G.si = 0; while ($.G.si < $.G.script.length && $.G.script[$.G.si].at < o) $.G.si++; }
    else {
      $.G.si = $.G.script.length; W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
      if (k === 'gravity') { $.G.scroll = LY.bossAt(); BU.startBoss(); }
      else if (k === 'maw') SP.maw(true);
      else if (k === 'ufo') { const UF = await import('/src/enemies/mid/ufo.ts'); $.G.scroll = LY.ufoAt() + 150; $.G.eat = LY.ufoGapEnd(); UF.spawnUfo(); } // Open Orbit midboss
      else if (k === 'crux' || k === 'butcher') { SP[k](); if ($.G.mini) $.G.mini.biome = biome; }
      else SP.midboss(k, BI.MID_NAMES[k], xhost || undefined);
    }
    $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
    const EL = elite && biome ? await import('/src/enemies/elite.ts') : null;
    // scenes staged without a real route: build what the route would have (a real flight: the route scene)
    (await import('/src/render/warmup.ts')).warmNow(k === 'crux' || k === 'butcher' ? [k] : k === 'maw' ? [] : [k, 'crux', 'butcher', 'maw:acid', 'maw:snot']);
    const st = [], rt = [];
    let deadAt = -1, f = 0;
    const MAX = k === 'orbit' ? 900 : 2400;
    for (; f < MAX; f++) {
      if (EL && f % 40 === 0 && W.enemies.filter((e) => (e.elite || e.crowd) && !e.dead).length < 8) { const n0 = W.enemies.length; [() => SP.corpse(C.rr(40, 200)), () => SP.flayer(C.rr(50, 200)), () => SP.crawler(1), () => SP.hatch(3, false)][(f / 40) % 4](); for (const e of W.enemies.slice(n0)) if (elite === 1) EL.eliteify(e); else e.crowd = 1; }
      const m = $.G.mini, B = $.G.boss;
      const tgt = k === 'gravity' ? (B ? B.y : $.P.y) : k === 'orbit' ? 135 + Math.sin(f * .02) * 70 : (m ? m.y : $.P.y);
      const y = C.clamp(tgt + Math.sin(f * .05) * 6, 8, C.PH - 8);
      $.P.hist.unshift({ x: 90, y }); if ($.P.hist.length > 80) $.P.hist.pop();
      Object.assign($.P, { x: 90, y, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0;
      const gone = k === 'orbit' ? false : k === 'gravity' ? !B || B.dying : !m || m.dead;
      if (gone && deadAt < 0) deadAt = f;
      if (deadAt >= 0 && f - deadAt > 300) break; // death + aftermath captured
      const t0 = performance.now(); ST.step(); const t1 = performance.now(); SCR.render(); const t2 = performance.now();
      st.push(t1 - t0); rt.push(t2 - t1);
    }
    const q = (a, x) => { const s = [...a].sort((u, v) => u - v); return s[Math.min(s.length - 1, Math.floor(s.length * x))]; };
    const avg = (a) => a.reduce((u, v) => u + v, 0) / a.length;
    const tot = st.map((v, i) => v + rt[i]);
    const dSl = deadAt >= 0 ? rt.slice(deadAt) : [];
    return { frames: f, deadAt, step: [avg(st), q(st, .95), Math.max(...st)], render: [avg(rt), q(rt, .95), Math.max(...rt)],
      over: tot.filter((v) => v > 1000 / 60).length / tot.length, death: dSl.length ? [avg(dSl), q(dSl, .95)] : null, tot: wantTot ? tot : null };
  }, [k, biome, STRONG, elite, xhost, wantTot]);
}

// the LS1 row K scenes share a set-up: a live run at gate `b` of slot `seg`, through the real openFork and choose()
const STAGED = `
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const SCR = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts'), WU = await import('/src/render/warmup.ts'), EL = await import('/src/enemies/elite.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  const q = (a, x) => { const s = [...a].sort((u, v) => u - v); return s[Math.min(s.length - 1, Math.floor(s.length * x))] || 0; };
  const arm = () => { const [pw, gm, pk] = kit; Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw); $.P.shield = 3; $.G.gm = { ...gm }; $.G.pk = { ...pk }; $.G.lvl = 10; };
  const start = () => { F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step(); arm(); };
  const gate = (seg, b) => { // the real fork at slot seg, flown into gate b: choose() builds the stage and picks its pair
    const x0 = LY.slotRow(seg).x0; $.G.scroll = x0; $.G.si = $.G.script.length; W.enemies.length = 0;
    BI.openFork(seg); $.G.fork.opts = [b, b]; $.G.fork.t = 50; $.G.tally = null;
    Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step();
  };
  const fly = (f, y) => { $.P.hist.unshift({ x: 90, y }); if ($.P.hist.length > 80) $.P.hist.pop(); Object.assign($.P, { x: 90, y: C.clamp(y + Math.sin(f * .05) * 6, 8, C.PH - 8), alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; };
  const frame = () => { const t0 = performance.now(); ST.step(); SCR.render(); return performance.now() - t0; };
`;
const staged = (body) => new Function('arg', 'kit', `return (async () => {${STAGED}${body}})()`).toString();
const run = (body, arg) => p.evaluate(`(${staged(body)})(${JSON.stringify(arg)}, ${JSON.stringify(STRONG)})`);

/** the midboss's first 60 frames, after the real plan has (or, COLD=1, hasn't) warmed the route */
const coldScene = (k, host) => run(`
  const [k, host, skip] = arg; start(); gate(0, host);
  $.G.mb[1] = [k]; let slices = 0;
  if (!skip) while (WU.warmPump()) slices++;
  for (let i = 0; i < 90; i++) { fly(i, 135); ST.step(); } // the ship flies on: nothing cold is timed in this stretch
  $.G.si = $.G.script.length; W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  const t0 = performance.now(); SP.midboss(k, BI.MID_NAMES[k], host); const spawn = performance.now() - t0, ms = [];
  for (let f = 0; f < 60; f++) { fly(f, $.G.mini ? $.G.mini.y : 135); ms.push(frame()); }
  return { spawn, first: ms[0], max: Math.max(...ms), at: ms.indexOf(Math.max(...ms)), tail: q(ms.slice(30), .5), slices, log: WU.warmLog.filter((l) => l.op !== 'boot').map((l) => l.k + ' ' + l.ms.toFixed(1)) };
`, [k, host, !!process.env.COLD]);

/** the densest 1500 px of a real biome script, every spawn made elite */
const peakScene = (b) => run(`
  const b = arg; start(); gate(0, b); let n = 0;
  while (WU.warmPump()) n++;
  const sc = $.G.script, win = 1500, x0 = LY.slotRow(0).x0, i0 = sc.findIndex((e) => e.x >= x0); let best = 0, bx = sc[i0].x; // G.script still holds Orbit's entries
  for (let i = i0, j = i0; i < sc.length; i++) { while (j < sc.length && sc[j].x < sc[i].x + win) j++; if (j - i > best) { best = j - i; bx = sc[i].x; } }
  $.G.scroll = bx - 60; $.G.si = 0; while ($.G.si < sc.length && sc[$.G.si].x < $.G.scroll) $.G.si++;
  $.G.st.t0 = $.G.t; const ms = [], alive = []; let seen = new Set(), bite = 0;
  for (let f = 0; f < 1500; f++) {
    for (const e of W.enemies) if (!seen.has(e)) { seen.add(e); if (!e.mini && !e.par && !e.kid && !e.elite && !e.dead) { try { EL.eliteify(e); bite++; } catch (x) {} } }
    fly(f, 135 + Math.sin(f * .02) * 70); ms.push(frame()); alive.push(W.enemies.filter((e) => !e.dead).length);
  }
  return { entries: best, at: Math.round(bx), avg: ms.reduce((u, v) => u + v, 0) / ms.length, p95: q(ms, .95), max: Math.max(...ms), over: ms.filter((v) => v > 1000 / 60).length / ms.length, alive: Math.max(...alive), elites: bite };
`, b);

/** the biome with nothing in it: the per-frame floor under every other scene */
const floorScene = (b) => run(`
  start(); gate(0, arg); IN.K.KeyZ = false; while (WU.warmPump());
  $.G.scroll = LY.slotRow(0).x0 + 1000; $.G.si = $.G.script.length; const ms = [];
  for (let f = 0; f < 300; f++) { W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0; fly(f, 135); ms.push(frame()); }
  return { avg: ms.reduce((u, v) => u + v, 0) / ms.length, p95: q(ms, .95), max: Math.max(...ms) };
`, b);

/** a real flight from gate a through both biome stages to the Drive; the pump runs every 15 frames, the 4 Hz beat */
const routeScene = (a, b) => run(`
  const [a, b] = arg, MAX = +(arg[2] || 26000), R = { fights: [], ms: [], warn: [], stages: [] };
  start(); gate(0, a); WU.warmLog.length = 0;
  let f = 0, mini = null, fightF = 0, pumpMs = 0, mb0 = window.__canvasMB(), mbPeak = mb0;
  for (; f < MAX; f++) {
    const G = $.G, m = G.mini, B = G.boss;
    if (G.fork) { G.fork.opts = [b, b]; G.fork.t = Math.max(G.fork.t, 50); Object.assign($.P, { x: C.W * .74, y: G.fork.gy[0], alive: true, inv: 30 }); }
    else fly(f, m ? m.y : B ? B.y : 135 + Math.sin(f * .02) * 70);
    if (m !== mini) { if (m) { R.fights.push({ k: m.k, x: Math.round(G.scroll), f, first: [] }); fightF = 0; } mini = m; }
    if (f % 15 === 0) { const t0 = performance.now(); WU.warmPump(); pumpMs = performance.now() - t0; } else pumpMs = 0;
    const warn = G.t < (G.warnEnd || 0), ms = frame() + pumpMs; // the banner itself can be replaced mid-window (a STAGE banner)
    R.ms.push(ms); if (warn) R.warn.push(ms);
    if (m && fightF++ < 60) R.fights[R.fights.length - 1].first.push(ms);
    if (m && fightF > 2400 && m.hp > 1) m.hp = 1; // the bot can't finish some fights; the frames that matter are behind us
    if (R.stages[R.stages.length - 1] !== $.G.stage) R.stages.push($.G.stage);
    if (f % 600 === 0) mbPeak = Math.max(mbPeak, window.__canvasMB());
    if ($.G.stage >= 3) { if (!R.driveF) R.driveF = f; if (f - R.driveF > 240) break; }
  }
  const log = WU.warmLog.filter((l) => l.op !== 'boot'), ms = R.ms;
  return { frames: f, stages: R.stages, avg: ms.reduce((u, v) => u + v, 0) / ms.length, p95: q(ms, .95), max: Math.max(...ms), over: ms.filter((v) => v > 1000 / 60).length / ms.length,
    warnFrames: R.warn.length, warnP95: q(R.warn, .95), warnMax: Math.max(0, ...R.warn), fights: R.fights.map((x) => ({ k: x.k, x: x.x, firstMax: Math.max(0, ...x.first) })),
    mb: JSON.stringify($.G.mb), canvas: [mb0, mbPeak], inWarn: log.filter((l) => l.warn || l.banner === 'WARNING').length, log: log.map((l) => \`\${l.op} \${l.k} \${l.ms.toFixed(1)}ms s\${l.stage} x\${Math.round(l.scroll)}\`), built: WU.warmBuilt() };
`.replace(/\\/g, ''), [a, b, process.env.ROUTE_MAX || 0]);

/** a dropped route piece stays dropped: kill a stage Maw, wait out its death, move past the stage, pump. One drop, no churn */
const mawDrop = () => run(`
  start(); gate(0, 'acid'); while (WU.warmPump()); $.G.si = $.G.script.length;
  SP.maw(true); const m = $.G.mini; m.biome = 'acid'; m.title = 'T'; m.x = 300; 
  for (let f = 0; f < 120; f++) { fly(f, 135); ST.step(); SCR.render(); }
  m.hp = 0.01; let f = 0; while ($.G.mini && f < 600) { fly(f, m.y); ST.step(); SCR.render(); f++; }
  const killed = f; for (let i = 0; i < 900; i++) { fly(i, 135); ST.step(); SCR.render(); }
  WU.warmLog.length = 0; $.G.fork = null; $.G.forkHold = false; $.G.stage = 3; let churn = 0;
  for (let i = 0; i < 300; i++) { fly(i, 135); ST.step(); SCR.render(); if (i % 15 === 0) WU.warmPump(); }
  return { killed, drops: WU.warmLog.map((l) => l.op + ' ' + l.k), built: WU.warmBuilt(), enemies: W.enemies.filter((e) => e.k === 'maw').map((e) => [e.dead, e.x | 0, e.hp]), mawFx: window.__mawFx && window.__mawFx() };
`);

/** the hard rule in page: route art unbuilt, a WARNING fires, the pump runs every frame; nothing may build until it ends */
const warnGate = () => run(`
  start(); gate(0, 'fire');
  for (let i = 0; i < 60; i++) { fly(i, 135); ST.step(); } // past startStage: its STAGE banner would replace the WARNING's
  WU.warmLog.length = 0;
  const unbuilt = WU.warmBuilt().length, G = $.G; let frames = 0, spawned = 0, inWarn = 0, bannerFrames = 0;
  SP.miniWarn('GATE TEST', () => { spawned = 1; });
  const end = G.warnEnd;
  while (G.t < end && frames < 400) {
    fly(frames, 135); WU.warmPump(); inWarn = WU.warmLog.length; if (G.banner && G.banner.text === 'WARNING') bannerFrames++; ST.step(); frames++;
  }
  for (let i = 0; i < 8; i++) WU.warmPump();
  return { unbuilt, warnFrames: frames, bannerFrames, spawned, slicesInWarning: inWarn, afterEnd: WU.warmLog.map((l) => l.op + ' ' + l.k) };
`);

const f1 = (a) => a.map((v) => v.toFixed(1).padStart(5)).join(' ');
console.log('renderer:', await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none'; }));
console.log(`CPU throttle ${THR}x   (ms: avg  p95  max)`);
console.log('scene'.padEnd(10), 'frames', 'step avg/p95/max'.padStart(19), 'render avg/p95/max'.padStart(19), ' >16.7ms', ' death render avg/p95');
const prof = {}, tot = {}, q95 = (a) => { const s = [...a].sort((u, v) => u - v); return s[Math.min(s.length - 1, Math.floor(s.length * .95))]; };
const ms1 = (v) => v.toFixed(1).padStart(6);
for (const k of want) {
  const [pre, arg] = k.split(':');
  if (pre === 'bootlog') { // the boot slices at the throttle, as a phone's title screen would pay them
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await p.reload(); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +THR }); await p.waitForTimeout(+(process.env.WARM_MS || 20000));
    const log = await p.evaluate(() => window.__warm()), by = {};
    for (const l of log) (by[l.k] ||= []).push(l.ms);
    console.log('boot slices:'); for (const [n, a] of Object.entries(by)) console.log(' ', n.padEnd(12), `n ${String(a.length).padStart(3)}  total ${ms1(a.reduce((u, v) => u + v, 0))}  max ${ms1(Math.max(...a))}`);
    continue;
  }
  if (pre === 'mawdrop') { console.log('mawdrop', JSON.stringify(await mawDrop())); continue; }
  if (pre === 'warngate') { console.log('warngate', JSON.stringify(await warnGate())); continue; }
  if (pre === 'cold') {
    const [mk, host] = arg.split('@'); await reloadCold();
    const r = await coldScene(mk, host);
    console.log(k.padEnd(22), `spawn ${ms1(r.spawn)}  first ${ms1(r.first)}  max ${ms1(r.max)} @f${String(r.at).padEnd(2)}  steady ${ms1(r.tail)}  slices ${r.slices} ${r.max + r.spawn < 100 ? 'ok' : 'OVER 100'}  [${r.log.join(', ')}]`);
    continue;
  }
  if (pre === 'floor') { const r = await floorScene(arg); console.log(k.padEnd(22), `p95 ${ms1(r.p95)}  avg ${ms1(r.avg)}  max ${ms1(r.max)}`); continue; }
  if (pre === 'peak') {
    const r = await peakScene(arg);
    console.log(k.padEnd(22), `p95 ${ms1(r.p95)}  avg ${ms1(r.avg)}  max ${ms1(r.max)}  >16.7 ${(100 * r.over).toFixed(0)}%  alive ${r.alive}  elites ${r.elites}  entries ${r.entries} @x${r.at}`);
    continue;
  }
  if (pre === 'route') {
    await reloadCold();
    const [a, b2] = arg.split('+'), r = await routeScene(a, b2);
    console.log(k.padEnd(22), `frames ${r.frames} stages ${r.stages}  p95 ${ms1(r.p95)}  avg ${ms1(r.avg)}  max ${ms1(r.max)}  >16.7 ${(100 * r.over).toFixed(0)}%`);
    console.log(' '.repeat(23) + `WARNING frames ${r.warnFrames}  p95 ${ms1(r.warnP95)}  max ${ms1(r.warnMax)}  slices in WARNING ${r.inWarn}  picks ${r.mb}  left built [${r.built}]  canvases ${r.canvas[0].toFixed(1)} -> peak ${r.canvas[1].toFixed(1)} MB`);
    console.log(' '.repeat(23) + 'fights: ' + r.fights.map((x) => `${x.k}@${x.x} first60max ${x.firstMax.toFixed(1)}`).join(' | '));
    console.log(' '.repeat(23) + 'slices: ' + r.log.join(' | '));
    continue;
  }
  if (pre === 'mid8') {
    const [mk, host] = arg.split('@'), r = await scene(mk, { biome: host, elite: 2, xhost: host, wantTot: true });
    tot[arg] = r.tot; const t95 = q95(r.tot);
    console.log(k.padEnd(22), String(r.frames).padStart(6), f1(r.step).padStart(19), f1(r.render).padStart(19), `${(100 * r.over).toFixed(0).padStart(6)}%`, ` p95 step+render ${ms1(t95)} ${t95 <= 1000 / 60 ? 'ok' : 'MISS'}`);
    continue;
  }
  if (PROF) await cdp.send('Profiler.start');
  const r = await scene(k);
  if (PROF) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = {}, dt = {}, byId = new Map(profile.nodes.map((n) => [n.id, n]));
    profile.samples.forEach((id, i) => { dt[id] = (dt[id] || 0) + (profile.timeDeltas[i] || 0); });
    let all = 0;
    for (const [id, us] of Object.entries(dt)) {
      const n = byId.get(+id), cf = n.callFrame, name = `${cf.functionName || '(anon)'} ${cf.url.split('/src/').pop().split('?')[0]}:${cf.lineNumber + 1}`;
      if (cf.functionName === '(idle)' || cf.functionName === '(program)') continue;
      self[name] = (self[name] || 0) + us; all += us;
    }
    prof[k] = Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([n, us]) => `${(100 * us / all).toFixed(1).padStart(5)}%  ${n}`);
    // inclusive time by function: self time says "drawImage", this says whose drawImage (names the fix)
    const incl = {}, nm = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/src/').pop().split('?')[0]}:${n.callFrame.lineNumber + 1}`;
    const walk = (n, seen) => { let t = dt[n.id] || 0; const name = nm(n), top = !seen.has(name); if (top) seen.add(name); for (const c of n.children || []) t += walk(byId.get(c), seen); if (top) { seen.delete(name); incl[name] = (incl[name] || 0) + t; } return t; };
    walk(profile.nodes[0], new Set());
    prof[k].push('   -- inclusive', ...Object.entries(incl).filter(([n]) => n.includes('render/') || n.includes('fx/') || n.includes('enemies/')).sort((a, b) => b[1] - a[1]).slice(0, 22).map(([n, us]) => `${(100 * us / all).toFixed(1).padStart(5)}%  ${n}`));
  }
  console.log(k.padEnd(10), String(r.frames).padStart(6), f1(r.step).padStart(19), f1(r.render).padStart(19), `${(100 * r.over).toFixed(0).padStart(6)}%`, r.death ? '  ' + f1(r.death) : '');
}
{ // every kind pair per host, from the merged frames of its two cells
  const lines = [];
  for (const h of HOSTS) for (let i = 0; i < KINDS.length; i++) for (let j = i + 1; j < KINDS.length; j++) {
    const A = tot[`${KINDS[i]}@${h}`], B = tot[`${KINDS[j]}@${h}`];
    if (A && B) lines.push([`${KINDS[i]}+${KINDS[j]}@${h}`, q95([...A, ...B])]);
  }
  if (lines.length) { console.log('\npair p95 (step+render, merged frames):'); for (const [n, v] of lines) console.log(' ', n.padEnd(24), ms1(v), v <= 1000 / 60 ? 'ok' : 'MISS'); }
}
if (PROF) for (const [k, lines] of Object.entries(prof)) console.log(`\n-- ${k}: top self time\n` + lines.join('\n'));
console.log(errs.length ? 'errors:\n' + errs.join('\n') : 'errors: none');
ranOn('perf-probe'); await b.close();
