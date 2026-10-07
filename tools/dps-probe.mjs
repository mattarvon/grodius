// DPS probe: holds the ship still at (100,127) firing into fixed immortal dummy targets and measures damage/second
// per loadout. Needs the VITE DEV server (imports live modules). Usage: node tools/dps-probe.mjs http://localhost:4202/ [frames=600]
//  FIELD = 12 targets scattered over the right 2/3 of the screen + 2 floor crawlers; ship sweeps up/down (rewards coverage)
//  ONE   = a single big (r16) target dead ahead at x=250, ship parked level with it (boss-ish: raw focus damage)
//  eff   = WALL dps / enemy-HP inflation that loadout's power rank causes (what the player actually feels on fodder)
import { chromium } from 'playwright';
const [url, FR = '600'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
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
    const sc = 3000, fl = (x) => W.floorAt(x + sc);
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
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
