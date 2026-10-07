// Screenshots of the guns at base / mid / max loadouts firing into live meat. Needs the VITE DEV server.
// Usage: node tools/gun-shots.mjs http://localhost:4202/ <outdir>
import { chromium } from 'playwright';
const [url, out = '.'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let s = 0x1234567; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {}
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; window.__pre && window.__pre(); q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.evaluate('__tick(3)');
const L = {
  base: [{}, {}],
  mid: [{ double: 1, missile: 1, options: 1 }, { cal: 1 }],
  max: [{ double: 1, missile: 2, options: 3, speed: 3 }, { cal: 3, serr: 2, rapid: 2 }],
  arcmax: [{ laser: 1, pyre: 2, options: 3, speed: 3 }, { cal: 2, over: 2, rapid: 1 }],
};
for (const [name, [pw, gm]] of Object.entries(L)) {
  await p.evaluate(async ([pw, gm]) => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), F = await import('/src/flow.ts'), IN = await import('/src/input.ts'), SP = await import('/src/enemies/spawn.ts');
    const $ = S.$; $.gate = false; IN.K.KeyZ = true;
    F.newGame(0); $.state = 'play';
    $.G.scroll = 3000;
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
    $.G.gm = { ...gm };
    let f = 0;
    window.__pre = () => {
      f++;
      const P = $.P; if (!P) return;
      P.alive = true; P.inv = 0; $.G.pick = null; $.G.hype = $.G.babe = $.G.banner = $.G.boss = $.G.mini = null; for (let i = W.enemies.length - 1; i >= 0; i--) if (!W.enemies[i].tst) W.enemies.splice(i, 1); $.G.pickQ = 0; W.eshots.length = 0; $.G.scrollSpeed = .4;
      const y = 127 - 40 * Math.sin(f / 50), x = 110 + 30 * Math.sin(f / 23); P.hist.unshift({ x, y }); if (P.hist.length > 80) P.hist.pop(); P.x = x; P.y = y; P.inv = 0;
      if (f % 14 === 0 && W.enemies.length < 14) { const k = ['drone', 'corpse', 'drone', 'flayer'][(f / 14) % 4 | 0]; try { const e = SP.mk(k, 300 + Math.random() * 150, 40 + Math.random() * 170); e.vx = -.6; e.tst = 1; } catch (e) {} }
    };
  }, [pw, gm]);
  await p.evaluate('__tick(100)');
  await p.screenshot({ path: `${out}/guns-${name}.png`, clip: { x: 120, y: 60, width: 760, height: 420 } });
  await p.evaluate('__tick(7)');
  await p.screenshot({ path: `${out}/guns-${name}-b.png`, clip: { x: 120, y: 60, width: 760, height: 420 } });
}
// pickup callout: grab SPLIT on a naked ship
await p.evaluate(async () => { const S = await import('/src/state.ts'), PL = await import('/src/player.ts'); Object.assign(S.$.P, { double: 0, missile: 0, options: 0, laser: 0, pyre: 0 }); S.$.G.gm = {}; PL.applyPower(2, true); });
await p.evaluate('__tick(25)');
await p.screenshot({ path: `${out}/guns-callout.png` });
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
