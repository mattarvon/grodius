// Midboss denial probe (D61 Pass 1, the KEEPSAKE probe's method from D59 adapted to the held biome midbosses): does the
// fight make a parked ship move? Each fight is staged as tools/midboss-probe.mjs stages it (biome slot 0 of long4, its
// home biome, stage-relative x 1000, the STAGE 1 kit unless --kit), and run three ways:
//   park    invincible; the ship sits at x 90 level with the midboss and shoots (midboss-probe's bot). TTK, and the hits it
//           would have taken, by source
//   grid    invincible and holding fire; for each spot of a grid (x 50..330 by 70, y every 22 inside the cave) the ship
//           never moves from it for --frames (default 900: past the entrance, two or more attack cycles). A spot that takes
//           no hit is a safe park. Run once at full HP (phase 1) and once with --ph2 (HP set under half on arrival)
//   pilot   mortal: tools/pilot.mjs's dodging autopilot (with window.__DN, the denial moves' threats), shooting, lives
//           refilled so the fight always finishes. Deaths, would-be hits per minute and where it died (the midboss's state)
// Would-be hits are counted by geometry, as keepsake-probe does: each enemy shot once (r + 2.6), each body contact once per
// touch (e.r + 4), each denial hit (src/enemies/mid/_deny.ts denyHit: lane, pool, hook) once per touch, plus the
// Apprentice's cleaver sweep from its own sector test. Works on a tree without _deny.ts (the before numbers): it then
// counts only shots and bodies.
// Usage: node tools/mid-deny-probe.mjs <url> <kind|all> <park|grid|pilot> [--seed n] [--ph2] [--frames F] [--kit 0-3] [--leave F]
// Prints one JSON line per kind. Needs a Vite dev server for this worktree (it imports live modules).
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import { PILOT } from './pilot.mjs';
import { BIOME_POOLS, ROSTER } from '../src/enemies/mid/roster.ts';
const arg = (f, d) => { const i = process.argv.indexOf(f); if (i < 0) return d; const v = process.argv[i + 1]; process.argv.splice(i, 2); return v; };
const flag = (f) => { const i = process.argv.indexOf(f); if (i < 0) return false; process.argv.splice(i, 1); return true; };
const SEED = +arg('--seed', '1'), FR = +arg('--frames', '900'), KIT = +arg('--kit', '1'), LEAVE = +arg('--leave', '1080'), PH2 = flag('--ph2');
const [url, KIND = 'all', MODE = 'park'] = process.argv.slice(2);
if (!url || !['park', 'grid', 'pilot'].includes(MODE)) { console.error('usage: node tools/mid-deny-probe.mjs <url> <kind|all> <park|grid|pilot> [--seed n] [--ph2] [--frames F] [--kit 0-3]'); process.exit(2); }
const L = [
  ['NAKED', {}, {}, {}],
  ['STAGE 1 kit', { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }],
  ['END DESCENT 1', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  ['STRONG D1', { speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }],
];
const KINDS = ROSTER.filter((r) => BIOME_POOLS.includes(r.pool) && !r.wip).filter((r) => KIND === 'all' || r.k === KIND).map((r) => [r.k, r.pool]);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; window.AudioContext = undefined; window.webkitAudioContext = undefined; try { localStorage.clear(); } catch (e) {} });
await p.addInitScript((s0) => { let s = s0 | 0; window.__reseed = (n) => { s = n | 0; }; Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }, SEED);
await p.addInitScript(PILOT);
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'mid-deny-probe', { quiet: true });
await p.evaluate(async () => { window.__W = await import('/src/world.ts'); window.__BU = await import('/src/boss/update.ts'); try { window.__DN = await import('/src/enemies/mid/_deny.ts'); } catch (e) { window.__DN = null; } });

/** stage one fight (midboss-probe's prep) and leave a stepper on window.__mb */
const prep = (k, biome, spot, seed) => p.evaluate(async ([pw, gm, pkk, k, biome, LEAVE, MODE, PH2, spot, seed]) => {
  window.__reseed(seed);
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const LY = await import('/src/layout.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  $.G.scroll = LY.slotRow(0).x0; $.G.si = $.G.script.length; W.enemies.length = 0;
  BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
  Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
  ST.step();
  $.G.scroll = LY.slotRow(0).x0 + 1000;
  for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
  $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
  if ($.G.pend) $.G.pend.length = 0;
  Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
  if ($.P.wardLv) $.P.shield = 3;
  $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  const sv = $.G.scroll; ST.step(); $.G.scroll = sv;
  W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  $.G.lives = 9;
  SP.midboss(k, BI.MID_NAMES[k], undefined, MODE === 'grid' ? 99999 : LEAVE);
  if (MODE === 'grid') { IN.K.KeyZ = false; $.P.shield = 0; }
  const m = { $, ST, C, W, f: 0, t0: -1, hits: 0, by: {}, deaths: 0, dctx: [], ep: {}, HS: new WeakSet(), att: {}, lastSt: '', ph2: false, alive: true, lastH: 0 };
  window.__mb = m;
  const mortal = MODE === 'pilot', inv = !mortal;
  const add = (k) => { m.hits++; m.by[k] = (m.by[k] || 0) + 1; };
  // the Apprentice's cleaver sweep (prentice.ts 'cut'): its own sector, 14-84 px, swept angle to 3.99
  const cleave = (g, P) => { if (g.k !== 'prentice' || g.st !== 'cut' || g.wt > 12) return false; const sx = g.x - 8, sy = g.y - 6, d = Math.hypot(P.x - sx, P.y - sy);
    let pa = Math.atan2(P.y - sy, P.x - sx), cur = g.ba; if (pa < 0) pa += Math.PI * 2; if (cur < 0) cur += Math.PI * 2; return d > 14 && d < 84 && pa <= 3.99 && pa >= cur; };
  window.__mbStep = (n) => {
    for (let i = 0; i < n; i++) {
      const g = m.$.G.mini, P = m.$.P;
      if (!g || g.dead) return { end: g && (g.gone || g.x > m.C.W + 50) ? 'esc' : 'dead' };
      if (m.t0 < 0 && g.x < m.C.W - 20) { m.t0 = m.f; if (PH2) { g.hp = g.max * .45; } }
      m.$.G.lives = 9; m.$.G.pick = null; m.$.G.pickQ = 0;
      if (spot) Object.assign(P, { x: spot[0], y: spot[1], alive: true, inv: 30, shield: 0 });
      else if (inv) { const y = m.C.clamp(g.y + (g.wy || 0), 8, m.C.PH - 8); P.hist.unshift({ x: 90, y }); if (P.hist.length > 80) P.hist.pop(); Object.assign(P, { x: 90, y, alive: true, inv: 30 }); }
      else window.__pilotStep(window.__G(), 90, g.y);
      const h0 = m.$.G.st ? m.$.G.st.hits || 0 : 0;
      m.ST.step(); m.f++;
      const g2 = m.$.G.mini;
      if (mortal) { const h = m.$.G.st ? m.$.G.st.hits || 0 : 0; if (h > h0) { m.hits += h - h0; } if (m.alive && !P.alive) { m.deaths++; m.dctx.push({ st: g2 ? g2.st : '?', ph2: g2 ? g2.hp < g2.max * .5 : null, x: Math.round(P.x), y: Math.round(P.y), near: (window.__pilotLog.deaths.at(-1) || {}).near }); } m.alive = P.alive; }
      if (!g2 || g2.dead) continue;
      if (g2.st !== m.lastSt && g2.st !== 'idle') m.att[g2.st] = (m.att[g2.st] || 0) + 1;
      m.lastSt = g2.st;
      if (inv && m.t0 >= 0) {
        for (const s of m.W.eshots) if (!m.HS.has(s) && Math.hypot(s.x - P.x, s.y - P.y) < (s.r || 2) + 2.6) { m.HS.add(s); add('shot:' + s.k); }
        const c = { body: m.W.enemies.some((e) => !e.dead && !(e.ghost > 0) && e.r && Math.hypot(e.x - P.x, e.y - P.y) < e.r + 4), cleave: cleave(g2, P) };
        const dk = window.__DN ? window.__DN.denyHit(g2, m.$.G.scroll, P.x, P.y) : '';
        if (dk) c[dk] = true;
        for (const k in c) { if (c[k] && !m.ep[k]) add(k === 'body' ? 'body' : k); m.ep[k] = c[k]; }
        for (const k in m.ep) if (!(k in c)) m.ep[k] = false;
      }
    }
    return null;
  };
  return { rank: +$.G.rank.toFixed(2), floor: Math.round(W.floorAt($.G.scroll + 200)), ceil: Math.round(W.ceilAt($.G.scroll + 200)) };
}, [...L[KIT].slice(1), k, biome, LEAVE, MODE, PH2, spot, seed]);
const runFight = async (cap) => { let r = null; for (let i = 0; i < cap && !r; i++) r = await p.evaluate(() => window.__mbStep(60)); return r; };
const read = () => p.evaluate(() => { const m = window.__mb; return { secs: +((m.f - Math.max(0, m.t0)) / 60).toFixed(1), hits: m.hits, by: m.by, deaths: m.deaths, att: m.att, dctx: m.dctx }; });

for (const [k, biome] of KINDS) {
  const seedOf = (j) => (SEED * 1000003 + j * 7919 + k.length * 31) | 0;
  if (MODE === 'grid') {
    const info = await prep(k, biome, null, seedOf(0));
    // the cave at the fight (screen x 50..330): the spots that are inside it
    const cave = await p.evaluate(() => { const m = window.__mb, out = []; for (let x = 50; x <= 330; x += 70) out.push([x, m.W.ceilAt(m.$.G.scroll + x), m.W.floorAt(m.$.G.scroll + x)]); return out; });
    const res = [];
    for (const [x, c, f] of cave) for (let y = Math.max(12, Math.ceil(c) + 12); y <= Math.min(242, f - 10); y += 22) {
      await prep(k, biome, [x, y], seedOf(x * 1000 + y));
      const sx = Math.round(FR / 60);
      for (let i = 0; i < sx; i++) { const r = await p.evaluate(() => window.__mbStep(60)); if (r) break; }
      const o = await read();
      res.push({ x, y, hits: o.hits, by: o.by });
    }
    const safe = res.filter((r) => !r.hits).map((r) => `${r.x},${r.y}`);
    const tot = {}; for (const r of res) for (const [q, n] of Object.entries(r.by)) tot[q] = (tot[q] || 0) + n;
    console.log(JSON.stringify({ k, mode: 'grid', ph2: PH2, frames: FR, spots: res.length, safe, minHits: Math.min(...res.map((r) => r.hits)), meanHits: +(res.reduce((a, r) => a + r.hits, 0) / res.length).toFixed(1), by: tot, cave: cave.map(([x, c, f]) => [x, Math.round(c), Math.round(f)]), grid: res.map((r) => `${r.x},${r.y}:${r.hits}`).join(' ') }));
  } else {
    const info = await prep(k, biome, null, seedOf(0));
    const r = await runFight(90);
    const o = await read();
    console.log(JSON.stringify({ k, mode: MODE, kit: L[KIT][0], rank: info.rank, end: r ? r.end : 'cap', ttk: o.secs, hits: o.hits, hpm: o.secs ? +(o.hits / (o.secs / 60)).toFixed(1) : 0, deaths: o.deaths, by: o.by, att: o.att, dctx: o.dctx }));
  }
}
if (errs.length) console.log('errors:', errs.slice(0, 5).join(' | '));
ranOn('mid-deny-probe'); await b.close();
