// Perf probe: real-clock cost of step() and render() per frame in the heaviest scenes: a crowded Open Orbit with a
// strong kit, every boss / midboss in its own biome, and each boss's death + aftermath. The game's own rAF loop is
// disabled; frames are driven by hand. CPU is throttled (default 4x) to approximate a phone.
// Usage: node tools/perf-probe.mjs <url> [throttle=4] [scenes=all|maw,crux,...] [prof]   (WARM_MS=20000 env: wait for the idle art warm-up first, like the title screen; fairer for boss scenes)
//   prints avg / p95 / max ms for step and render, and the share of frames whose step+render blows the 16.7 ms budget.
//   prof: also samples the JS profiler per scene and prints the top self-time functions.
//   ELITE=1 env: in biome scenes, a crowd of elites (enemies/elite.ts) keeps streaming in alongside the fight (~8 alive);
//   ELITE=2: the same crowd, not elite (the control: what the elite visuals and attacks cost on top).
//   XHOST=ice|acid|fire|snot env: the four biome midboss scenes run as crossovers in that biome (host tint and terrain fit, LS1 P0).
// Needs the VITE DEV server (imports live modules). Restart vite after edits before trusting numbers.
import { chromium } from 'playwright';
const [url, THR = '4', SC = 'all', PROF = ''] = process.argv.slice(2);
const SCENES = ['orbit', 'maw', 'ufo', 'choir', 'cyst', 'prentice', 'brood', 'crux', 'butcher', 'gravity'];
const want = SC === 'all' ? SCENES : SC.split(',');
const b = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu-rasterization'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(+(process.env.WARM_MS || 1500)); // images / patterns load (WARM_MS: let the idle warm-up finish, like the title screen does)
const cdp = await p.context().newCDPSession(p);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +THR });
if (PROF) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); }

const STRONG = [{ speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }];
const BIOME = { choir: 'ice', cyst: 'acid', prentice: 'fire', brood: 'snot', crux: 'ice', butcher: 'fire', maw: null, ufo: null, orbit: null, gravity: null };
const XHOST = process.env.XHOST || '';
if (XHOST) for (const k of ['choir', 'cyst', 'prentice', 'brood']) BIOME[k] = XHOST;

async function scene(k) {
  return p.evaluate(async ([k, biome, kit, elite, xhost]) => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
    const BU = await import('/src/boss/update.ts'), SCR = await import('/src/render/screens.ts');
    const $ = S.$; $.gate = false; IN.K.KeyZ = true;
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    const [pw, gm, pkk] = kit;
    const arm = () => { Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw); $.P.shield = 3; $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10; };
    if (biome) {
      $.G.scroll = 2300; $.G.si = $.G.script.length; W.enemies.length = 0;
      BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
      Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
      ST.step(); $.G.scroll = 3300;
      for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
    }
    arm();
    if (k === 'orbit') { $.G.scroll = 600; $.G.si = 0; while ($.G.si < $.G.script.length && $.G.script[$.G.si].at < 600) $.G.si++; }
    else {
      $.G.si = $.G.script.length; W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
      if (k === 'gravity') { $.G.scroll = C.BOSS_AT; BU.startBoss(); }
      else if (k === 'maw') SP.maw(true);
      else if (k === 'ufo') { const UF = await import('/src/enemies/ufo.ts'); $.G.scroll = UF.UFO_AT + 150; $.G.eat = UF.UFO_GAP_END; UF.spawnUfo(); } // Open Orbit midboss
      else if (k === 'crux' || k === 'butcher') { SP[k](); if ($.G.mini) $.G.mini.biome = biome; }
      else SP.midboss(k, BI.BIOMES[biome].midName, xhost || undefined);
    }
    $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
    const st = [], rt = [];
    let deadAt = -1, f = 0;
    const MAX = k === 'orbit' ? 900 : 2400;
    const EL = elite && biome ? await import('/src/enemies/elite.ts') : null;
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
      over: tot.filter((v) => v > 1000 / 60).length / tot.length, death: dSl.length ? [avg(dSl), q(dSl, .95)] : null };
  }, [k, BIOME[k], STRONG, +(process.env.ELITE || 0), XHOST]);
}

const f1 = (a) => a.map((v) => v.toFixed(1).padStart(5)).join(' ');
console.log(`CPU throttle ${THR}x   (ms: avg  p95  max)`);
console.log('scene'.padEnd(10), 'frames', 'step avg/p95/max'.padStart(19), 'render avg/p95/max'.padStart(19), ' >16.7ms', ' death render avg/p95');
const prof = {};
for (const k of want) {
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
  }
  console.log(k.padEnd(10), String(r.frames).padStart(6), f1(r.step).padStart(19), f1(r.render).padStart(19), `${(100 * r.over).toFixed(0).padStart(6)}%`, r.death ? '  ' + f1(r.death) : '');
}
if (PROF) for (const [k, lines] of Object.entries(prof)) console.log(`\n-- ${k}: top self time\n` + lines.join('\n'));
console.log(errs.length ? 'errors:\n' + errs.join('\n') : 'errors: none');
await b.close();
