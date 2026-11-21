// THE BURNING BUTCHER with a dodging pilot (D61): the real fight, ship firing, tools/pilot.mjs steering, lives refilled so
// it always finishes. Reports per run: TTK, would-be hits (playerHit calls that landed: G.st.hits) and ships lost, split by
// half (boss above/below 50% HP). The kit rows are boss-probe's (STAGE 1 kit, END DESCENT 1, STRONG D1).
// Needs a Vite dev server (imports live modules). Usage: node tools/butcher-pilot.mjs <url> [seeds=1,2,3,4,5,6] [kit=1]
//   kit: 0 naked, 1 STAGE 1 kit, 2 END DESCENT 1, 3 STRONG D1.  Prints one line per seed and a total.
import { chromium } from 'playwright';
import { PILOT } from './pilot.mjs';
import { useLayout } from './layout-arg.mjs';
const [url, SEEDS = '1,2,3,4,5,6', KIT = '1'] = process.argv.slice(2);
const L = [
  [{}, {}, {}],
  [{ speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }],
  [{ speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  [{ speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }],
][+KIT];
const b = await chromium.launch(); const rows = [];
for (const seed of SEEDS.split(',').map(Number)) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(PILOT);
  await p.addInitScript(([seed]) => {
    let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
    let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined;
    try { localStorage.clear(); } catch (e) {}
  }, [seed]);
  await p.goto(`${url}${url.includes("?") ? "&" : "?"}seed=${seed}`); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  await useLayout(p, 'butcher-pilot', { limits: 'staged in biome slot 0 only' });
  const r = await p.evaluate(async ([L]) => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts'), LY = await import('/src/layout.ts'), IN = await import('/src/input.ts'), BU = await import('/src/boss/update.ts');
    window.__W = W; window.__BU = BU; const $ = S.$; $.gate = false; IN.K.KeyZ = true;
    F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step();
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, L[0]);
    if ($.P.wardLv) $.P.shield = 3;
    $.G.gm = { ...L[1] }; $.G.pk = { ...L[2] }; $.G.lvl = 10; $.G.scroll = LY.slotRow(0).x0 + 700; $.G.si = $.G.script.length;
    W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0; const sv = $.G.scroll; ST.step(); $.G.scroll = sv; W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
    SP.butcher(); const m = $.G.mini; const g = window.__G();
    let ff = 0; const h = [0, 0], d = [0, 0]; let t0 = -1, hp0 = 0, alive = true, ttk = '--', lastHits = 0, lastLives = 9;
    for (let f = 0; f < 150 * 60; f++) {
      ff = f; if (m.dead) { ttk = ((f - t0) / 60).toFixed(1); break; }
      if (t0 < 0 && m.x < C.W - 20) { t0 = f; lastHits = $.G.st.hits; }
      $.G.lives = 9; lastLives = 9;
      window.__pilotStep(window.__G(), 90, C.clamp(m.y, 12, C.PH - 12));
      const ph = m.hp < m.max * .5 ? 1 : 0, was = $.P.alive; const hb = $.G.st.hits;
      ST.step();
      if (t0 >= 0) { h[ph] += $.G.st.hits - hb; if (was && !$.P.alive) d[ph]++; }
      if (!$.P.alive && $.G.lives < 9) { /* respawn handled by the sim */ }
    }
    return { ttk, h, d, trapped: window.__pilotLog.trapped, frames: window.__pilotLog.frames, ff: window.__pilotLog.frames };
  }, [L]);
  rows.push({ seed, ...r, errs: errs.slice(0, 2) }); console.log(JSON.stringify({ seed, ttk: r.ttk, hitsH1H2: r.h, deathsH1H2: r.d, trapped: r.trapped, frames: r.frames, ff: r.ff, errs: errs.slice(0, 2) }));
  await p.close();
}
const sum = (i, k) => rows.reduce((a, r) => a + r[k][i], 0);
console.log(`kit ${KIT}: ${rows.length} runs, hits first half ${sum(0, 'h')}, second half ${sum(1, 'h')}; ships lost ${sum(0, 'd')} + ${sum(1, 'd')}; mean TTK ${(rows.reduce((a, r) => a + (+r.ttk || 0), 0) / rows.length).toFixed(1)} s`);
await b.close();
