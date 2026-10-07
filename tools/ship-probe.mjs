// Ship-form probe: starts a run, forces pods / grafts / perks / contraptions straight into state, and
// screenshots close-ups of the player ship so the growth of the hull can be eyeballed.
// Usage: node tools/ship-probe.mjs <url> <outdir>
import { chromium } from 'playwright';
const [url = 'http://localhost:4201/', out = '/tmp/ship-shots'] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 3 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => {
  let now = 0;
  const q = [];
  performance.now = () => now;
  window.requestAnimationFrame = (f) => (q.push(f), 1);
  window.setTimeout = () => 0;
  window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__hold = null;
  window.__tick = (n) => {
    for (let i = 0; i < n; i++) {
      now += 1000 / 60;
      const g = window.__G && window.__G();
      if (g && g.P && g.state === 'play' && window.__hold) {
        g.enemies.length = 0;
        g.P.alive = true;
        g.P.x = window.__hold.x;
        g.P.y = window.__hold.y;
        g.P.inv = window.__hold.inv;
        if (window.__hold.rig) g.P.rig = window.__hold.rig;
        g.G.pick = null;
      }
      q.splice(0).forEach((f) => f(now));
    }
  };
});
await p.goto(url);
await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter');
await p.evaluate('__tick(60)');
await p.evaluate(() => (window.__hold = { x: 200, y: 127, inv: 40 }));
await p.evaluate('__tick(400)');
await p.evaluate('__tick(30)');

const BASE = { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0, aegis: 0 };
async function setup(cfg) {
  await p.evaluate((cfg) => {
    const g = __G(), S = window.__shipS;
    Object.assign(g.P, cfg.P);
    g.G.gm = { ...(cfg.gm || {}) };
    g.G.pk = { ...(cfg.pk || {}) };
    S.meta.rig = cfg.rig || [];
    S.meta.own = cfg.rig || [];
    S.meta.cl = cfg.cl || {};
    S.meta.lv.socket = 2;
    S.meta.lv.sculpt = cfg.sculpt || 0;
    window.__hold.rig = cfg.prig || null;
    if (!cfg.prig) delete g.P.rig;
  }, cfg);
  await p.evaluate(() => { __tick(3); const g = __G(); g.gibs.length = 0; g.drops.length = 0; });
}
async function shot(name, { w = 100, h = 64, settle = 90 } = {}) {
  await p.evaluate((n) => { window.__hold.inv = 40; __tick(n); window.__hold.inv = 0; __tick(8); }, settle);
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); const P = __G().P; return { x: c.x, y: c.y, s: c.width / 480, px: P.x, py: P.y }; });
  await p.screenshot({ path: `${out}/${name}.png`, clip: { x: r.x + (r.px - w / 2) * r.s, y: r.y + (r.py - h / 2) * r.s, width: w * r.s, height: h * r.s } });
  console.log('shot', name);
}
const builds = {
  '01-base': { P: { ...BASE } },
  '02-early': { P: { ...BASE, speed: 2, missile: 1, wardLv: 1, shield: 3 }, pk: { dmg: 1 } },
  '03-mid': { P: { ...BASE, speed: 3, missile: 2, double: 1, options: 2, wardLv: 2, shield: 3 }, gm: { pierce: 1, seek: 1, tail: 1, cal: 1 }, pk: { dmg: 2, rof: 1, volatile: 1 } },
  '04-max': { P: { ...BASE, speed: 5, laser: 1, pyre: 2, options: 3, wardLv: 3, shield: 3, aegis: 12 }, gm: { rapid: 2, pierce: 2, seek: 2, tail: 2, ripple: 2, chain: 2, serr: 2, over: 2, cal: 3, regrow: 2, spore: 2 }, pk: { dmg: 3, rof: 3, crit: 3, volatile: 3, graze: 2, magnet: 2, tape: 1, ignite: 2 }, rig: ['saw', 'furnace', 'leech'], cl: { saw: 3, furnace: 3, leech: 3 }, sculpt: 3, prig: { saw: { spin: 1 }, furnace: { heat: 1 }, leech: { fill: 1 } } },
  '05-max-b': { P: { ...BASE, speed: 4, double: 1, missile: 2, options: 1, wardLv: 2, shield: 3 }, gm: { pierce: 2, seek: 2, chain: 2, over: 1 }, pk: { dmg: 2, frost: 2, glass: 1, snot: 1 }, rig: ['gut', 'spine', 'hook'], cl: { gut: 2, spine: 3, hook: 2 }, sculpt: 1 },
};
for (const id of ['saw', 'gut', 'leech', 'spine', 'hook', 'furnace', 'choir'])
  for (const lvl of [1, 3]) {
    const prig = { saw: { spin: 1 }, gut: { charge: .9 }, leech: { fill: .7 }, spine: { cd: 0 }, hook: { phase: 0 }, furnace: { heat: 1 }, choir: { chg: lvl === 3 ? 1 : .5 } };
    builds[`rig-${id}-${lvl}`] = { P: { ...BASE, speed: 1 }, rig: [id], cl: { [id]: lvl }, prig };
  }
builds['rig-hook-firing'] = { P: { ...BASE, speed: 1 }, rig: ['hook'], cl: { hook: 2 }, prig: { hook: { phase: .5, tx: 240, ty: 100 } } };
for (const [n, cfg] of Object.entries(builds)) {
  await setup(cfg);
  await shot(n);
}
// growth moment: settle on a mid build, then sprout horn barrels + bone needles + a saw, shoot a few frames in
await setup(builds['03-mid']);
await shot('06-before-growth');
await p.evaluate(() => { const g = __G(); g.P.double = 0; g.P.laser = 1; g.G.gm.pierce = 2; g.G.gm.over = 1; window.__shipS.meta.rig = ['saw']; window.__shipS.meta.cl = { saw: 2 }; });
for (const f of [3, 6, 10, 16]) {
  await p.evaluate((f) => __tick(f), f === 3 ? 3 : f - [3, 6, 10, 16][[3, 6, 10, 16].indexOf(f) - 1]);
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); const P = __G().P; return { x: c.x, y: c.y, s: c.width / 480, px: P.x, py: P.y }; });
  await p.screenshot({ path: `${out}/07-growth-f${f}.png`, clip: { x: r.x + (r.px - 60) * r.s, y: r.y + (r.py - 40) * r.s, width: 120 * r.s, height: 80 * r.s } });
}
await p.evaluate('__tick(40)');
await shot('08-after-growth', { settle: 1 });
// full-frame context shot of the max build in the real game view
await p.evaluate(() => (window.__hold = { x: 200, y: 127, inv: 40 }));
await setup(builds['04-max']);
await p.evaluate(() => { window.__hold.inv = 0; __tick(20); });
await p.screenshot({ path: `${out}/09-max-context.png` });
// Infirmary preview (game 0, s 1.6): bought contraptions + FLESH SCULPT
await p.evaluate(() => { const S = window.__shipS; S.meta.rig = ['saw', 'leech', 'furnace']; S.meta.cl = { saw: 2, leech: 1, furnace: 2 }; S.meta.lv.sculpt = 3; S.state = 'shop'; __tick(30); });
await p.screenshot({ path: `${out}/10-infirmary.png` });
await p.evaluate(() => { const S = window.__shipS; S.state = 'title'; __tick(30); });
await p.screenshot({ path: `${out}/11-title.png` });
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
