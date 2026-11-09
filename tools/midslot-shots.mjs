// Midboss slot rig (build plan LS1 row F): a long4 biome stage flown through its real script from the gate, with an
// invincible parked bot that holds fire. Midboss A (the picker's slot A, G.mb) is met and, 200 f in, sent off (its clock
// forced), then the scroll runs on into breath 2: a shot 40 f into slot B's WARNING and one of midboss B in the fight.
// Prints the stage's picks, the WARNING x, each midboss's leave clock and host, and whether G.mini was clear at B's WARNING.
// Usage: node tools/midslot-shots.mjs <url> <outDir> [biome=ice] [seed=3] [drift]   (a Vite DEV server url; flies ?layout=long4)
//   drift: slot A is SQUID SAUCER 2000 (the real enemies/mid/ufo.ts spawner, a DRIFT midboss in a biome slot: no phase-1
//   pool has one, so the stage's picks are pre-set) and is left to run out on its own forced exit / clock, not sent off.
// Not measured: fight length (midboss-probe does that), slot 1 (the second biome stage), a repeat visit (remix).
import { chromium } from 'playwright';
const [url, OUT, BIOME = 'ice', SEED = '3', MODE = ''] = process.argv.slice(2), DRIFT = MODE === 'drift';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((seed) => {
  let s = seed | 0; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {}
}, +SEED);
await p.goto(url + '?layout=long4'); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
const info = await p.evaluate(async ([biome, drift]) => {
  const S = await import('/src/state.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts'), BI = await import('/src/biomes.ts');
  const C = await import('/src/core.ts'), LY = await import('/src/layout.ts'), W = await import('/src/world.ts');
  const $ = S.$; $.gate = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  $.G.scroll = LY.slotRow(0).x0; $.G.si = $.G.script.length; W.enemies.length = 0; $.G.pend.length = 0; $.G.mini = null;
  if (drift) $.G.mb[1] = ['ufo', BI.BIOMES[biome].mids[0].k]; // slot A the Saucer, slot B the home midboss
  BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
  Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
  ST.step();
  const r = LY.slotRow(0), BP = LY.beatPlan(r, $.G.bx[0], false);
  window.__f = { $, ST, BP, picks: $.G.mb[1].slice() };
  return { picks: $.G.mb[1], warns: BP.warns, exit: BP.driftExit, bx: $.G.bx[0] };
}, [BIOME, DRIFT]);
console.log('picks', info.picks, 'warns', info.warns, 'bx', info.bx);
const a = await p.evaluate((drift) => {
  const { $, ST, BP } = window.__f;
  for (let i = 0; i < 20000 && !($.G.mini && !$.G.mini.stageBoss); i++) { Object.assign($.P, { alive: true, inv: 30, x: 70 }); $.G.pick = null; $.G.pickQ = 0; ST.step(); }
  const m = $.G.mini; const out = `${m.k}@${Math.round($.G.scroll)} leave=${m.leave} host=${m.host}`;
  for (let i = 0; i < 200; i++) { Object.assign($.P, { alive: true, inv: 30, x: 70 }); ST.step(); }
  if (!drift) { m.leave = m.t; return out; } // send it off: it withdraws, the scroll resumes
  // the DRIFT case: let it run out by itself; where did it start to withdraw, and where was it gone?
  let goneAt = null;
  for (let i = 0; i < 20000 && $.G.mini === m && !m.dead; i++) { Object.assign($.P, { alive: true, inv: 30, x: 70 }); $.G.pick = null; $.G.pickQ = 0; ST.step(); if (m.gone && goneAt == null) goneAt = Math.round($.G.scroll); }
  return `${out} exitX=${m.exitX} (driftExit ${BP.driftExit[0]}) withdrew@${goneAt} gone@${Math.round($.G.scroll)} slotB WARNING@${BP.warns[1]}`;
}, DRIFT);
console.log('slot A met:', a);
const shot = async (name) => { await p.evaluate(async () => { const { render } = await import('/src/render/screens.ts'); render(); }); await p.screenshot({ path: `${OUT}/${name}` }); console.log('shot', name); };
// slot B's WARNING: the frame its banner goes up (G.mini clear by then)
const w = await p.evaluate(() => {
  const { $, ST, BP } = window.__f;
  for (let i = 0; i < 20000; i++) {
    Object.assign($.P, { alive: true, inv: 30, x: 70 }); $.G.pick = null; $.G.pickQ = 0; ST.step();
    if ($.G.scroll >= BP.warns[1]) { for (let k = 0; k < 40; k++) { Object.assign($.P, { alive: true, inv: 30, x: 70 }); ST.step(); } return { scroll: Math.round($.G.scroll), mini: !!$.G.mini, banner: $.G.banner && ($.G.banner.title || $.G.banner.t || JSON.stringify($.G.banner).slice(0, 80)) }; }
  }
  return null;
});
console.log('slot B WARNING:', JSON.stringify(w));
await shot(`ls1-f-${BIOME}${DRIFT ? '-drift' : ''}-slotB-warning.png`);
const m = await p.evaluate(() => {
  const { $, ST } = window.__f;
  for (let i = 0; i < 400; i++) { Object.assign($.P, { alive: true, inv: 30, x: 70 }); $.G.pick = null; $.G.pickQ = 0; ST.step(); if ($.G.mini && !$.G.mini.stageBoss && $.G.mini.t > 150) break; }
  const g = $.G.mini; return g && `${g.k}@${Math.round($.G.scroll)} leave=${g.leave} host=${g.host} title=${g.title}`;
});
console.log('slot B met:', m);
await shot(`ls1-f-${BIOME}${DRIFT ? '-drift' : ''}-slotB-midboss.png`);
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
