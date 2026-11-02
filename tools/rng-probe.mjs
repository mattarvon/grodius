// RNG split probe (M2 #13, LS1-B1): proves render, fx and the HELL FLASHES setting cannot reach the sim.
// Every boss and midboss fight runs from a seeded Math.random three ways, each on a fresh page:
//   ON    step() + render() every frame, HELL FLASHES on   (what the harness does)
//   OFF   step() + render() every frame, HELL FLASHES off
//   BARE  step() only, never render()                       (a frame-rate / render-path-independence check)
// The sim signature (frames, boss/midboss hp, score, rank, bio, player, enemies, enemy shots, caps, orbs) must be
// identical across the three. A difference means something outside the sim drew the sim RNG R() (or wrote sim state).
// Fx-only arrays (gibs, drops, ...) are reported but not signed: they are presentation.
// Usage: node tools/rng-probe.mjs [url] [--frames N] [--only maw,ufo] [--json out.json] [--trace]
//   --trace records the call site of every Math.random draw made inside render() and prints the top ones
//   No url: starts its own Vite dev server (like the harness). Exits 1 if any fight's signatures differ.
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FRAMES = +opt('--frames', 2400);
const ONLY = opt('--only', '');
const JSON_OUT = opt('--json', '');
const TRACE = argv.includes('--trace');
let url = argv.find((a, i) => !a.startsWith('--') && !['--frames', '--only', '--json'].includes(argv[i - 1]));
let server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5299, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}

// [id, label, kind, biome]: kind 'boss' = the Gravity Drive (BOSS_AT, $.G.boss); 'stage' = a stage-boss spawner;
// 'mid' = a biome midboss in its biome (midboss-probe's setup); 'ufo' = the Open Orbit saucer
const FIGHTS = [
  ['drive', 'GRAVITY DRIVE', 'boss', null],
  ['maw', 'MAW (stage)', 'stage', null],
  ['crux', 'CRUCIFER', 'stage', null],
  ['butcher', 'BUTCHER', 'stage', null],
  ['mawmid', 'MAW (mid)', 'mid', 'acid'],
  ['choir', 'NAIL CHOIR', 'mid', 'ice'],
  ['cyst', 'DISS. WOMB', 'mid', 'acid'],
  ['prentice', 'APPRENTICE', 'mid', 'fire'],
  ['brood', 'BROOD MOM', 'mid', 'snot'],
  ['ufo', 'SQUID SAUCER', 'ufo', null],
  // the Crucifer again, with the ship's form changing mid-fight (pods grow at 1, 3 and 5 s; a pod withers at 7 s): render's
  // trackForm sprouts and withers parts as particles, which the fixed-kit fights above never exercise (LS1-B1fix)
  ['grow', 'FORM CHANGE', 'stage', null, 'crux'],
].filter(([id]) => !ONLY || ONLY.split(',').includes(id));
const MODES = [['ON', true, true], ['OFF', false, true], ['BARE', true, false]];
const KIT = [{ speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }]; // boss-probe's STAGE 1 kit

const init = ({ flashes, trace }) => {
  let s = 0x9e3779b9; // the harness's seeded Math.random (mulberry32)
  Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0; performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined;
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  const mr = Math.random; window.__rdraws = {}; window.__rwrites = {}; window.__trace = trace;
  Math.random = () => { if (window.__inRender) { const k = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim().replace(/https?:\/\/[^/]+/, '').replace(/\?[^:)]*/, '')).join(' < '); window.__rdraws[k] = (window.__rdraws[k] || 0) + 1; } return mr(); };
  try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true, ...(flashes ? {} : { flashes: false }) })); } catch (e) {}
};

async function run(b, fight, flashes, draw) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.addInitScript(init, { flashes, trace: TRACE });
  await p.goto(url);
  await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  // every sprite and photo decoded first, as in the harness: a late image changes which draw paths run
  for (let i = 0; i < 300; i++) {
    const ok = await p.evaluate(async () => {
      if (document.fonts.status !== 'loaded') return false;
      const [s, t] = await Promise.all([import('/src/sprites.ts'), import('/src/textures.ts')]);
      return Object.values(s.SPR).every((x) => x.fw > 0) && Object.values(t.PIC).every((i) => i.complete && i.naturalWidth > 0);
    }).catch(() => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  const out = await p.evaluate(async ([fight, KIT, FRAMES, draw]) => {
    const [id, , kind, biome, spawn = id] = fight;
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
    const UF = await import('/src/enemies/ufo.ts'), BU = await import('/src/boss/update.ts'), SV = await import('/src/save.ts');
    const { render } = await import('/src/render/screens.ts');
    const $ = S.$; $.gate = false; IN.K.KeyZ = true;
    const [pw, gm, pkk] = KIT;
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    if (kind === 'ufo') $.G.scroll = UF.UFO_AT + 150;
    else if (kind === 'mid') {
      $.G.scroll = 2300; $.G.si = $.G.script.length; W.enemies.length = 0;
      BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
      Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
      ST.step();
      $.G.scroll = 3300;
      for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
    } else $.G.scroll = kind === 'boss' ? C.BOSS_AT : 3000;
    $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
    if ($.P.wardLv) $.P.shield = 3;
    $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
    W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
    const sv = $.G.scroll; ST.step(); $.G.scroll = sv;
    W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
    if (kind === 'boss') BU.startBoss();
    else if (kind === 'stage') spawn === 'maw' ? SP.maw(true) : SP[spawn]();
    else if (kind === 'ufo') { $.G.eat = UF.UFO_GAP_END; UF.spawnUfo(); }
    else id === 'mawmid' ? SP.maw(false) : SP.midboss(id, BI.BIOMES[biome].midName);
    const foe = () => (kind === 'boss' ? $.G.boss : $.G.mini);
    let f = 0, end = 'cap';
    for (; f < FRAMES; f++) {
      const g = foe();
      if (!g || g.dead || g.dying) { end = !g ? 'gone' : g.dying ? 'dying' : g.gone || g.x > C.W + 50 ? 'esc' : 'dead'; break; }
      let ty = g.y;
      if (kind === 'boss') { const pl = g.plates.filter((q) => q.hp > 0).sort((a, b) => Math.abs(Math.sin(a.a)) - Math.abs(Math.sin(b.a)))[0]; ty = pl ? g.y + Math.sin(pl.a) * 42 : g.y; }
      const y = C.clamp(ty, 8, C.PH - 8);
      $.P.hist.unshift({ x: 90, y }); if ($.P.hist.length > 80) $.P.hist.pop();
      Object.assign($.P, { x: 90, y, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0;
      if (id === 'grow') { // sim-side and identical in every mode: only render decides when the form diff is seen
        if (f === 60) $.P.missile = 2; else if (f === 180) $.P.options = 2; else if (f === 300) $.P.laser = 1; else if (f === 420) $.P.options = 1;
      }
      ST.step();
      if (draw) {
        // --trace: which sim fields does render() itself write? (flat diff of the foe, the enemies and $.G scalars)
        const snap = () => { const o = {}; const walk = (v, k, d) => { if (d > 3 || v == null) return void (o[k] = v); if (typeof v === 'object') { if (v instanceof HTMLCanvasElement || v instanceof CanvasRenderingContext2D) return; for (const [kk, vv] of Object.entries(v)) if (typeof vv !== 'function') walk(vv, k + '.' + kk, d + 1); } else o[k] = v; };
          const g = foe(); walk(g, 'foe', 0); W.enemies.forEach((e, i) => e !== g && walk(e, 'en' + i, 1)); for (const [k, v] of Object.entries($.G)) if (typeof v !== 'object') o['G.' + k] = v; walk($.P, 'P', 1); W.eshots.forEach((e, i) => walk(e, 'es' + i, 2)); W.shots.forEach((e, i) => walk(e, 'sh' + i, 2)); o.eshots = W.eshots.length; o.shots = W.shots.length; o.orbs = W.orbs.length; return o; };
        const a = window.__trace ? snap() : null;
        window.__inRender = 1; render(); window.__inRender = 0;
        if (a) { const z = snap(); for (const k of new Set([...Object.keys(a), ...Object.keys(z)])) if (!Object.is(a[k], z[k])) window.__rwrites[k.replace(/\d+/g, '#')] = (window.__rwrites[k.replace(/\d+/g, '#')] || 0) + 1; }
      }
    }
    const g = foe(), r3 = (v) => Math.round(v * 1000) / 1000;
    const sig = {
      f, end, hp: g ? r3(g.hp) : null, score: $.G.score, t: $.G.t, rank: r3($.G.rank), bio: r3($.G.bio || 0), scroll: r3($.G.scroll),
      P: [r3($.P.x), r3($.P.y), $.P.shield],
      en: W.enemies.map((e) => [e.k, r3(e.x), r3(e.y), r3(e.hp || 0)]),
      es: W.eshots.map((e) => [r3(e.x), r3(e.y)]), caps: W.caps.length, orbs: W.orbs.map((o) => [r3(o.x), r3(o.y)]),
    };
    return { sig, fx: { gibs: W.gibs.length, drops: W.drops.length }, flashes: SV.SET.flashes, rdraws: window.__rdraws, rwrites: window.__rwrites };
  }, [fight, KIT, FRAMES, draw]);
  await p.close();
  return { ...out, errs };
}

const b = await chromium.launch();
const rows = [];
let bad = 0;
try {
  for (const fight of FIGHTS) {
    const row = { id: fight[0], label: fight[1] };
    for (const [m, flashes, draw] of MODES) {
      const r = await run(b, fight, flashes, draw);
      if (r.flashes !== flashes) r.errs.push(`SET.flashes is ${r.flashes}, wanted ${flashes}`);
      row[m] = { hash: createHash('md5').update(JSON.stringify(r.sig)).digest('hex').slice(0, 10), f: r.sig.f, end: r.sig.end, hp: r.sig.hp, score: r.sig.score, en: r.sig.en.length, es: r.sig.es.length, ...r.fx, rdraws: r.rdraws, rwrites: r.rwrites, errs: r.errs };
    }
    if (TRACE) for (const [m] of MODES) for (const [k, n] of Object.entries(row[m].rdraws || {}).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${m} render draw x${n}: ${k}`);
    if (TRACE) for (const [k, n] of Object.entries(row.ON.rwrites || {}).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ON render wrote ${k} in ${n} frames`);
    row.same = row.ON.hash === row.OFF.hash && row.ON.hash === row.BARE.hash;
    if (!row.same || MODES.some(([m]) => row[m].errs.length)) bad++;
    rows.push(row);
    const c = row.ON;
    console.log(`${row.label.padEnd(14)} ${row.same ? 'SAME ' : 'DIFF '} ON ${row.ON.hash} OFF ${row.OFF.hash} BARE ${row.BARE.hash} | ON: ${c.end} @${(c.f / 60).toFixed(1)}s hp=${c.hp} score=${c.score} en=${c.en} es=${c.es} gibs=${c.gibs} drops=${c.drops}${MODES.some(([m]) => row[m].errs.length) ? ' ERR ' + MODES.map(([m]) => row[m].errs.join('|')).join(' ') : ''}`);
  }
} finally {
  await b.close();
  if (server) await server.close();
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ frames: FRAMES, rows }, null, 2) + '\n');
console.log(bad ? `FAIL: ${bad}/${rows.length} fights differ between ON / OFF / BARE (or errored)` : `PASS: all ${rows.length} fights identical ON / OFF / BARE`);
process.exit(bad ? 1 : 0);
