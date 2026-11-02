// Boss probe: time-to-kill for every boss across loadout tiers, plus Gravity Drive laser lethality.
// Invincible bot parks at x=90 and tracks the boss's current weak point, holding fire. Needs the VITE DEV server
// (imports live modules). Usage: node tools/boss-probe.mjs http://localhost:4202/ [capSeconds=150] [--layout short]
//  World x comes from src/layout.ts: biome bosses fight at slot 0's x0 + 700 (3000 on short), the Drive at bossAt()
//  TTK  = seconds from the boss becoming hittable to dead (or "esc" if it escaped / "--" if it outlived the cap)
//  LASER = per Gravity Drive beam: hits that land on a ship sitting in the beam with a full WARD, and whether it dies
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, CAP = '150'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'boss-probe', { limits: 'fights are staged in Open Orbit, biome slot 0 and the Drive only; later biome slots and interior stages are not' });
// loadouts: what a player plausibly carries into each fight (seals cap you; see stages.ts SEAL_TXT)
const L = [
  ['NAKED (died)', {}, {}, {}],
  ['STAGE 1 kit', { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }],
  ['END DESCENT 1', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  ['STRONG D1', { speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }],
];
const BOSSES = ['maw', 'crux', 'butcher', 'gravity'];
const res = await p.evaluate(async ([L, BOSSES, CAP]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BU = await import('/src/boss/update.ts'), C = await import('/src/core.ts'), LY = await import('/src/layout.ts');
  const IN = await import('/src/input.ts'); const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  const out = {};
  const setup = (pw, gm, pkk, scroll) => {
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
    if ($.P.wardLv) $.P.shield = 3;
    $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
    $.G.scroll = scroll; $.G.si = $.G.script.length; // no scripted spawns: just the boss
    W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
    const sv = $.G.scroll; ST.step(); $.G.scroll = sv; // one world step so G.rank reflects this loadout before the boss spawns
    W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  };
  const park = (y) => { $.P.hist.unshift({ x: 90, y }); if ($.P.hist.length > 80) $.P.hist.pop(); Object.assign($.P, { x: 90, y, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; };
  for (const [name, pw, gm, pkk] of L) {
    const row = {};
    for (const k of BOSSES) {
      setup(pw, gm, pkk, k === 'gravity' ? LY.bossAt() : LY.slotRow(0).x0 + 700);
      if (k === 'gravity') BU.startBoss(); else if (k === 'maw') SP.maw(true); else SP[k]();
      let f = 0, t0 = -1, r = '--';
      for (; f < CAP * 60 + 600; f++) {
        let ty = $.P.y;
        if (k === 'gravity') {
          const B = $.G.boss; if (!B) { r = ((f - t0) / 60).toFixed(1); break; }
          if (B.dying) { r = ((f - t0) / 60).toFixed(1); break; }
          if (!B.enter && t0 < 0) t0 = f;
          const pl = B.plates.filter((q) => q.hp > 0).sort((a, b) => Math.abs(Math.sin(a.a)) - Math.abs(Math.sin(b.a)))[0];
          ty = pl ? B.y + Math.sin(pl.a) * 42 : B.y;
        } else {
          const m = $.G.mini;
          if (!m || m.dead) { r = m && m.x > C.W + 50 ? 'esc' : ((f - Math.max(0, t0)) / 60).toFixed(1); break; }
          if (t0 < 0 && m.x < C.W - 20) t0 = f;
          ty = m.y;
        }
        park(C.clamp(ty, 8, C.PH - 8));
        ST.step();
      }
      if (t0 >= 0 && f - t0 > CAP * 60) r = '--';
      row[k] = r;
      (out.rank ||= {})[name] = +$.G.rank.toFixed(2);
    }
    out[name] = row;
  }
  // laser lethality: full WARD (3), parked dead in the beam's path for the whole sweep
  const lz = [];
  setup({ wardLv: 2 }, {}, {}, LY.bossAt()); BU.startBoss();
  const B = $.G.boss; for (const q of B.plates) q.hp = 0; // skip to phase 1 (eye open)
  let sweeps = 0, hits0 = 0, inBeam = false, died = false;
  for (let f = 0; f < 60 * 40 && sweeps < 4; f++) {
    $.G.st.hits = $.G.st.hits || 0;
    const Lz = $.G.boss && $.G.boss.laser;
    if (Lz && Lz.beam > 0 && !inBeam) { inBeam = true; hits0 = $.G.st.hits; $.P.shield = 3; $.P.alive = true; died = false; }
    // sit on the beam's line, 190px (outside tentacle reach) from the eye
    if ($.G.boss) { const a = Lz ? Lz.ang : Math.PI; $.P.x = C.clamp($.G.boss.x + Math.cos(a) * 190, 12, C.W - 20); $.P.y = C.clamp($.G.boss.y + Math.sin(a) * 190, 8, C.PH - 8); }
    if (!$.P.alive) died = true;
    if (!Lz || Lz.beam <= 0) { if (inBeam) { lz.push({ hits: $.G.st.hits - hits0, died }); sweeps++; } inBeam = false; if ($.P.inv > 0 && !Lz) $.P.inv = 0; }
    $.P.alive = true; $.G.lives = 9; W.eshots.length = 0; W.enemies.length = 0; // beam only
    ST.step();
  }
  const rank = out.rank; delete out.rank;
  return { out, lz, rank };
}, [L, BOSSES, +CAP]);
console.log('rank per loadout:', JSON.stringify(res.rank));
console.log('loadout'.padEnd(16), ...['MAW', 'CRUCIFER', 'BUTCHER', 'GRAV DRIVE'].map((s) => s.padStart(11)));
for (const [n, r] of Object.entries(res.out)) console.log(n.padEnd(16), ...BOSSES.map((k) => String(r[k]).padStart(11)));
console.log('LASER sweeps vs full WARD (3):', res.lz.map((s) => `${s.hits} hits${s.died ? ' DEAD' : ''}`).join(', ') || 'none observed');
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('boss-probe'); await b.close();
