// DPS probe: holds the ship still at (100,127) firing into fixed immortal dummy targets and measures damage/second
// per loadout. Needs the VITE DEV server (imports live modules). Usage: node tools/dps-probe.mjs http://localhost:4202/ [frames=600] [--layout long4|short]
//   After the per-item table: the KITS table (E4, E5) and the TTK rig (R2); see the W5 block at the end
//   The targets sit in open space at biome slot 0's x0 + 700 (src/layout.ts; 3000 on short).
//  FIELD = 12 targets scattered over the right 2/3 of the screen + 2 floor crawlers; ship sweeps up/down (rewards coverage)
//  ONE   = a single big (r16) target dead ahead at x=250, ship parked level with it (boss-ish: raw focus damage)
//  eff   = WALL dps / enemy-HP inflation that loadout's power rank causes (what the player actually feels on fodder)
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, FR = '600'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'dps-probe');
const L = [
  ['base', {}],
  ['SPLIT', { double: 1 }],
  ['ARC', { laser: 1 }],
  ['MISSILE I', { missile: 1 }],
  ['MISSILE II', { missile: 2 }],
  ['PYRE I', { pyre: 1 }],
  ['PYRE II', { pyre: 2 }],
  ['WRAITH 1', { options: 1 }],
  ['WRAITH 2', { options: 2 }],
  ['WRAITH 3', { options: 3 }],
  ['SPLIT+MSL2', { double: 1, missile: 2 }],
  ['SPLIT+MSL2+W3', { double: 1, missile: 2, options: 3 }],
  ['CAL 1', {}, { cal: 1 }],
  ['CAL 2', {}, { cal: 2 }],
  ['CAL 3', {}, { cal: 3 }],
  ['SERR 1', {}, { serr: 1 }],
  ['SERR 2', {}, { serr: 2 }],
  ['OVER 1', {}, { over: 1 }],
  ['OVER 2', {}, { over: 2 }],
  ['RAPID 1', {}, { rapid: 1 }],
  ['RAPID 2', {}, { rapid: 2 }],
  ['PIERCE 1', {}, { pierce: 1 }],
  ['CHAIN 2', {}, { chain: 2 }],
  ['MID S+M1+W1', { double: 1, missile: 1, options: 1 }, { cal: 1 }],
  ['MAX', { double: 1, missile: 2, options: 3, speed: 4 }, { cal: 3, serr: 2, rapid: 2 }],
  ['MAX ARC+PYRE2', { laser: 1, pyre: 2, options: 3, speed: 4 }, { cal: 3, serr: 2, rapid: 2 }],
];
const res = await p.evaluate(async ([L, FR]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const $ = S.$;
  const IN = await import('/src/input.ts'); $.gate = false; IN.K.KeyZ = true;
  const out = [];
  for (const [name, pw, gm] of L) {
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
    $.G.gm = { ...(gm || {}) };
    const sc = __LY.slotRow(0).x0 + 700, fl = (x) => W.floorAt(x + sc);
    const r = {};
    for (const set of ['WALL', 'ONE']) {
      W.shots.length = 0; W.enemies.length = 0; $.P.hist.length = 0;
      const pos = set === 'ONE' ? [[250, 127]] : [[190, 40], [230, 95], [210, 160], [270, 60], [300, 130], [280, 190], [350, 30], [370, 100], [340, 165], [420, 70], [440, 140], [410, 200], [250, fl(250) - 9], [390, fl(390) - 9]];
      const D = pos.map(([x, y]) => ({ k: 'drone', x, y, vx: 0, vy: 0, t: 0, flash: 0, rot: 0, dead: false, hp: 1e6, max: 1e6, r: set === 'ONE' ? 16 : 8, big: set === 'ONE' ? 1 : 0, gsz: 1, score: 0, bio: 0, dum: 1 }));
      let dmg = 0;
      for (let f = 0; f < FR; f++) {
        const py = set === 'ONE' ? 127 : 127 - 70 * Math.sin(f / 240 * Math.PI * 2);
        $.P.hist.unshift({ x: 100, y: py }); if ($.P.hist.length > 80) $.P.hist.pop();
        Object.assign($.P, { x: 100, y: py, alive: true, inv: 30 });
        $.G.scroll = sc; $.G.scrollSpeed = 0; $.G.hitstop = 0; $.G.pick = null; $.G.pickQ = 0; $.G.boss = null;
        W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0;
        D.forEach((d, i) => { Object.assign(d, { x: pos[i][0], y: pos[i][1], hp: 1e6, dead: false, t: 0, vx: 0, vy: 0 }); W.enemies.push(d); });
        ST.step();
        for (const d of D) dmg += 1e6 - d.hp;
      }
      r[set] = dmg / FR * 60;
    }
    const P = $.P, pwr = P.speed * .5 + (P.double || P.laser ? 1 : 0) + P.missile + P.pyre + P.options + Object.values($.G.gm).reduce((a, b) => a + b, 0) * .7;
    r.rank = Math.min(1, pwr / 14);
    out.push([name, r]);
  }
  return out;
}, [L, +FR]);
const base = res[0][1];
const hm = (rk) => 1 + rk * (globalThis.HPK ?? +(process.env.HPK || .8));
console.log('loadout'.padEnd(16), 'WALL dps'.padStart(9), 'xBase'.padStart(6), 'ONE dps'.padStart(8), 'xBase'.padStart(6), 'rank'.padStart(5), 'eff'.padStart(6));
for (const [n, r] of res) console.log(n.padEnd(16), r.WALL.toFixed(1).padStart(9), (r.WALL / base.WALL).toFixed(2).padStart(6), r.ONE.toFixed(1).padStart(8), (r.ONE / base.ONE).toFixed(2).padStart(6), r.rank.toFixed(2).padStart(5), (r.WALL / base.WALL / hm(r.rank)).toFixed(2).padStart(6));
// ---- W5 (DIFFICULTY-SPEC §3.1): the kit table and the TTK rig, measure-only ----
// KITS: the systems audit's §2 copy of this probe with the midboss-probe kits (perks in G.pk as well as grafts), plus
//   LEGAL MAX D1 (economy spec §1: K1 guns + CAL1 SERR1 CAD1 + MARROW2 TWITCH2 CRIT2 VOL1 TEETH1; K1 lets MISSILE 2 or
//   PYRE 1 and SPLIT or ARC, so all four are flown and E4 reads the strongest) and "respawn at END D1 (spec)" (END D1's
//   perks with the death scar applied, grafts one level down, THRUST 1, no guns: E5 wants ONE <= .32 x END D1). The scar
//   eats one level of the perk with the highest POWER.perk weight; MARROW and TWITCH tie at .6 and the kit's pick order
//   is unknown, so both scars are flown and E5 reads the stronger. pow = POWER's powerBudget(), rank = src/rank.ts.
// TTK: the systems audit's time-to-kill rows (R2). A real enemy is made by spawn.ts mk() at the loadout's power, at the
//   stage ordinal named (G.stage), and its HP is read; bolts = HP / the main bolt's damage (mutations.ts gunDm), s =
//   HP / that kit's ONE dps. `main` is the audit's main-branch HP for the same case (R2: within +-10%; drones 1 bolt).
const KITS = [
  ['bare', {}, {}, {}],
  ['STAGE 1 kit', { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }],
  ['BIOME B kit', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 1 }, { cal: 1, rapid: 1 }, { dmg: 1, rof: 1, crit: 2 }],
  ['END D1', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  ['STRONG D1', { speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }],
  ['respawn (END D1 perks+grafts)', { speed: 1 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  ['LEGAL MAX D1 SPLIT+MSL2', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, serr: 1, rapid: 1 }, { dmg: 2, rof: 2, crit: 2, volatile: 1, teeth: 1 }],
  ['LEGAL MAX D1 SPLIT+PYRE1', { speed: 3, pyre: 1, double: 1, options: 2, wardLv: 2 }, { cal: 1, serr: 1, rapid: 1 }, { dmg: 2, rof: 2, crit: 2, volatile: 1, teeth: 1 }],
  ['LEGAL MAX D1 ARC+MSL2', { speed: 3, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 1, serr: 1, rapid: 1 }, { dmg: 2, rof: 2, crit: 2, volatile: 1, teeth: 1 }],
  ['LEGAL MAX D1 ARC+PYRE1', { speed: 3, pyre: 1, laser: 1, options: 2, wardLv: 2 }, { cal: 1, serr: 1, rapid: 1 }, { dmg: 2, rof: 2, crit: 2, volatile: 1, teeth: 1 }],
  ['respawn END D1 (spec, scar MARROW)', { speed: 1 }, {}, { dmg: 1, rof: 1, crit: 2 }],
  ['respawn END D1 (spec, scar TWITCH)', { speed: 1 }, {}, { dmg: 2, rof: 0, crit: 2 }],
];
const TTK = [ // [kind, stage ordinal, kit, main-branch HP (systems audit §2)]
  ['drone', 0, 'bare', 1], ['drone', 3, 'END D1', 1.4], ['eye', 1, 'STAGE 1 kit', 7.9], ['eye', 3, 'END D1', 9.7], ['flayer', 3, 'END D1', 22.3], ['mutant', 3, 'END D1', 36.2],
  ...KITS.filter((k) => k[0] !== 'bare' && k[0] !== 'END D1').map((k) => ['drone', 3, k[0], 1.4]),
];
const kr = await p.evaluate(async ([KITS, TTK, FR]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const POW = await import('/src/power.ts'), MU = await import('/src/mutations.ts'), SP = await import('/src/enemies/spawn.ts'), IN = await import('/src/input.ts');
  let RK = null; try { RK = await import('/src/rank.ts'); } catch (e) {}
  const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  const fit = (pw, gm, pk) => { F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step();
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw); $.G.gm = { ...gm }; $.G.pk = { ...pk }; };
  const dps = (set) => { const sc = __LY.slotRow(0).x0 + 700, fl = (x) => W.floorAt(x + sc);
    W.shots.length = 0; W.enemies.length = 0; $.P.hist.length = 0;
    const pos = set === 'ONE' ? [[250, 127]] : [[190, 40], [230, 95], [210, 160], [270, 60], [300, 130], [280, 190], [350, 30], [370, 100], [340, 165], [420, 70], [440, 140], [410, 200], [250, fl(250) - 9], [390, fl(390) - 9]];
    const D = pos.map(([x, y]) => ({ k: 'drone', x, y, vx: 0, vy: 0, t: 0, flash: 0, rot: 0, dead: false, hp: 1e6, max: 1e6, r: set === 'ONE' ? 16 : 8, big: set === 'ONE' ? 1 : 0, gsz: 1, score: 0, bio: 0, dum: 1 }));
    let dmg = 0;
    for (let f = 0; f < FR; f++) {
      const py = set === 'ONE' ? 127 : 127 - 70 * Math.sin(f / 240 * Math.PI * 2);
      $.P.hist.unshift({ x: 100, y: py }); if ($.P.hist.length > 80) $.P.hist.pop();
      Object.assign($.P, { x: 100, y: py, alive: true, inv: 30 });
      $.G.scroll = sc; $.G.scrollSpeed = 0; $.G.hitstop = 0; $.G.pick = null; $.G.pickQ = 0; $.G.boss = null;
      W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0;
      D.forEach((d, i) => { Object.assign(d, { x: pos[i][0], y: pos[i][1], hp: 1e6, dead: false, t: 0, vx: 0, vy: 0 }); W.enemies.push(d); });
      ST.step();
      for (const d of D) dmg += 1e6 - d.hp;
    }
    return dmg / FR * 60; };
  const kits = {};
  for (const [name, pw, gm, pk] of KITS) { fit(pw, gm, pk); const r = { WALL: dps('WALL') }; fit(pw, gm, pk); r.ONE = dps('ONE');
    r.pow = +POW.powerBudget().toFixed(2); r.rank = RK && RK.rank ? (() => { try { return RK.rank($); } catch (e) { return 'n/a'; } })() : 'n/a'; kits[name] = r; }
  const ttk = [];
  for (const [k, ord, kit, main] of TTK) { const K = KITS.find((x) => x[0] === kit); fit(K[1], K[2], K[3]);
    W.enemies.length = 0; const sv = $.G.scroll; ST.step(); $.G.scroll = sv; W.enemies.length = 0; W.eshots.length = 0; // pow reflects the kit
    const s0 = $.G.stage; $.G.stage = ord; const e = SP.mk(k, 250, 127); $.G.stage = s0; W.enemies.length = 0;
    const bolt = MU.gunDm(); ttk.push({ k, ord, kit, hp: +e.hp.toFixed(2), main, bolt: +bolt.toFixed(2), bolts: Math.ceil(e.hp / bolt - 1e-9), s: +(e.hp / kits[kit].ONE).toFixed(2), vsMain: +(e.hp / main).toFixed(2) }); }
  return { kits, ttk };
}, [KITS, TTK, +FR]);
console.log('\nKITS (systems audit §2 kits + the spec kits):');
console.log('kit'.padEnd(36), 'ONE dps'.padStart(8), 'xBare'.padStart(6), 'WALL dps'.padStart(9), 'xBare'.padStart(6), 'pow'.padStart(5), 'rank'.padStart(5));
const kb = kr.kits.bare;
for (const [n, r] of Object.entries(kr.kits)) console.log(n.padEnd(36), r.ONE.toFixed(1).padStart(8), (r.ONE / kb.ONE).toFixed(2).padStart(6), r.WALL.toFixed(1).padStart(9), (r.WALL / kb.WALL).toFixed(2).padStart(6), String(r.pow).padStart(5), String(r.rank).padStart(5));
{ const lm = Object.entries(kr.kits).filter(([n]) => n.startsWith('LEGAL MAX')), one = Math.max(...lm.map(([, r]) => r.ONE)), wall = Math.max(...lm.map(([, r]) => r.WALL));
  const rs = Object.entries(kr.kits).filter(([n]) => n.includes('(spec')), rone = Math.max(...rs.map(([, r]) => r.ONE)), end = kr.kits['END D1'].ONE;
  console.log(`E4 LEGAL MAX D1 (strongest variant): ONE ${one.toFixed(1)} (<= 50: ${one <= 50 ? 'PASS' : 'FAIL'}), WALL ${wall.toFixed(1)} (<= 105: ${wall <= 105 ? 'PASS' : 'FAIL'})`);
  console.log(`E5 respawn at END D1 (spec, stronger scar): ONE ${rone.toFixed(1)} = ${(rone / end).toFixed(2)} x END D1 (<= .32: ${rone / end <= .32 ? 'PASS' : 'FAIL'})`); }
console.log('\nTTK rig (real mk() HP at the kit\'s power; bolts = HP / main bolt; s = HP / ONE dps; vsMain = HP / main-branch HP):');
for (const t of kr.ttk) console.log(`  ${t.k.padEnd(7)} stage ${t.ord}  ${t.kit.padEnd(36)} hp ${String(t.hp).padStart(6)}  bolt ${String(t.bolt).padStart(5)}  bolts ${String(t.bolts).padStart(3)}  ${String(t.s).padStart(5)} s  vsMain ${t.vsMain}`);
{ const dr = kr.ttk.filter((t) => t.k === 'drone'), mid = kr.ttk.filter((t) => t.k !== 'drone');
  console.log(`R2 drones: ${dr.every((t) => t.bolts <= 1) ? 'PASS' : 'FAIL'} (bolts ${[...new Set(dr.map((t) => t.bolts))].join('/')}); mid enemies within +-10% of main: ${mid.every((t) => Math.abs(t.vsMain - 1) <= .1) ? 'PASS' : 'FAIL'} (${mid.map((t) => t.k + ' ' + t.vsMain).join(', ')})`); }
console.log('DPSKITS ' + JSON.stringify(kr));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('dps-probe'); await b.close();
