// Depth probe (docs/pacing.md 3.8): time-to-kill for every midboss and boss at Descent 1, 2 and 3, each with a kit like
// the one tools/playtest.mjs's bot carries into that descent (guns, grafts, perks AND bolted contraptions). Much faster
// than a playtest, so use it to turn the src/depth.ts knobs, then confirm with playtest.mjs.
// Invincible bot parks at x=90 and tracks the target's y (the Gravity Drive: its lowest plate), holding fire.
// Fights run in open space at scroll 3000 (the Saucer at its real 950, scroll moving; no biome terrain), so they are a little faster than the real ones.
// Usage: node tools/depth-probe.mjs <url> [capSeconds=90]
//  TTK = seconds from on screen to dead; "esc" = it left first; "--" = outlived the cap
import { chromium } from 'playwright';
const [url, CAP = '90'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
// [name, loop, guns, grafts, perks, bolted contraptions {id: level}]; roughly the playtest bot (seed 11) at each descent's start
const L = [
  ['D1 mid-run', 0, { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }, {}],
  ['D1 end', 0, { speed: 3, missile: 1, double: 1, options: 2, wardLv: 2 }, { rapid: 2, spore: 1, cal: 1 }, { dmg: 1, rof: 1, crit: 1 }, {}],
  ['D2', 1, { speed: 4, missile: 2, double: 1, options: 3, wardLv: 3 }, { rapid: 2, spore: 1, cal: 2, serr: 1 }, { dmg: 2, rof: 2, crit: 2, pierce: 1 }, { saw: 2, gut: 1 }],
  ['D3', 2, { speed: 5, missile: 1, double: 1, options: 3, wardLv: 3 }, { spore: 2, cal: 3, serr: 2, seek: 1, over: 1 }, { dmg: 3, rof: 3, crit: 2, pierce: 2, volatile: 1 }, { saw: 3, gut: 2, spine: 2 }],
];
const FIGHTS = ['ufo', 'choir', 'cyst', 'prentice', 'brood', 'maw0', 'maw', 'crux', 'butcher', 'gravity'];
const res = await p.evaluate(async ([L, FIGHTS, CAP]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BU = await import('/src/boss/update.ts'), C = await import('/src/core.ts'), U = await import('/src/enemies/ufo.ts');
  const IN = await import('/src/input.ts'); const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  const out = {}, info = {};
  const setup = (loop, pw, gm, pkk, rig, scroll, stage) => {
    $.meta.own = Object.keys(rig); $.meta.rig = Object.keys(rig); $.meta.cl = { ...rig }; $.meta.lv.socket = Math.max(0, Object.keys(rig).length - 1);
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    $.G.loop = loop; $.G.stage = stage;
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
    if ($.P.wardLv) $.P.shield = 3;
    $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
    $.G.scroll = scroll; $.G.si = $.G.script.length; // no scripted spawns: just the fight
    W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
    const sv = $.G.scroll; ST.step(); $.G.scroll = sv; // one world step so G.rank / G.pow reflect this loadout
    W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  };
  const park = (y) => { $.P.hist.unshift({ x: 90, y }); if ($.P.hist.length > 80) $.P.hist.pop(); Object.assign($.P, { x: 90, y, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; };
  for (const [name, loop, pw, gm, pkk, rig] of L) {
    const row = {};
    for (const k of FIGHTS) {
      setup(loop, pw, gm, pkk, rig, k === 'gravity' ? C.BOSS_AT : k === 'ufo' ? 950 : 3000, k === 'maw0' || k === 'ufo' ? 0 : k === 'gravity' ? 3 : 1);
      if (k === 'gravity') BU.startBoss();
      else if (k === 'ufo') U.spawnUfo(); // at its real scroll x: it drifts with the scroll and leaves by 1840
      else if (k === 'maw' || k === 'maw0') SP.maw(true);
      else if (k === 'crux' || k === 'butcher') SP[k]();
      else SP.midboss(k, k);
      const hp0 = Math.round(k === 'gravity' ? $.G.boss.max : $.G.mini.max);
      let f = 0, t0 = -1, r = '--';
      for (; f < CAP * 60 + 600; f++) {
        let ty = $.P.y;
        if (k === 'gravity') {
          const B = $.G.boss; if (!B || B.dying) { r = ((f - t0) / 60).toFixed(1); break; }
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
      row[k] = r + '/' + hp0;
    }
    out[name] = row; info[name] = { rank: +$.G.rank.toFixed(2), pow: +($.G.pow || 0).toFixed(2) };
  }
  return { out, info };
}, [L, FIGHTS, +CAP]);
console.log('TTK s / HP. maw0 = the Open Orbit Maw, maw = a biome Maw');
console.log('kit'.padEnd(12), 'rank/pow'.padEnd(10), ...FIGHTS.map((s) => s.padStart(12)));
for (const [n, r] of Object.entries(res.out)) console.log(n.padEnd(12), `${res.info[n].rank}/${res.info[n].pow}`.padEnd(10), ...FIGHTS.map((k) => String(r[k]).padStart(12)));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
