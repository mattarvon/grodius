// Gravity Drive look-book: renders the final boss at full HP, ~50%, ~15%, mid-death and the rupture, at 2x.
// Invincible bot parks at x=90 on the boss's y (firing). Needs the VITE DEV server.
// Usage: node tools/drive-shots.mjs http://localhost:5203/ <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const [url, OUT = 'assets-raw/gross/drive'] = process.argv.slice(2);
mkdirSync(OUT + '/zoom', { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(1500); // textures
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const BU = await import('/src/boss/update.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), SC = await import('/src/render/screens.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  Object.assign($.P, { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2, shield: 3 });
  $.G.scroll = C.BOSS_AT; $.G.si = $.G.script.length;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  BU.startBoss();
  window.__d = {
    $, W, C,
    run(n, fire = true, draw = true) {
      IN.K.KeyZ = fire;
      for (let i = 0; i < n; i++) {
        const B = $.G.boss, y = B ? C.clamp(B.y + 10, 8, C.PH - 8) : $.P.y;
        $.P.hist.unshift({ x: 90, y }); if ($.P.hist.length > 80) $.P.hist.pop();
        Object.assign($.P, { x: 90, y, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
        ST.step();
        if (draw) SC.render();
      }
    },
    boss: () => $.G.boss,
  };
});
const shot = async (name) => {
  await p.locator('#c').screenshot({ path: `${OUT}/${name}.png` });
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
  await p.screenshot({ path: `${OUT}/zoom/${name}.png`, clip: { x: r.x + 230 * r.s, y: r.y + 10 * r.s, width: 250 * r.s, height: 244 * r.s } }); console.log('shot', name, await p.evaluate(() => { const B = window.__d.boss(); return B ? `ph=${B.phase} hp=${(B.hp / B.max * 100) | 0}% dying=${B.dying} laser=${B.laser ? B.laser.tel : '-'}` : 'gone'; })); };
// 1) full HP, plates up (hold fire so it stays full)
await p.evaluate(() => window.__d.run(420, false, false));
await p.evaluate(() => window.__d.run(90, false));
await shot('drive-1-full');
// 2) ~50%: plates broken, eye open; catch a locked laser telegraph
await p.evaluate(() => { const B = window.__d.boss(); B.plates.forEach((q) => (q.hp = 0)); B.hp = B.max * .6; window.__d.run(140, false); B.hp = Math.max(B.hp, B.max * .5); });
for (let i = 0; i < 400; i++) { const t = await p.evaluate(() => { window.__d.run(1, false); const L = window.__d.boss().laser; return L ? L.tel : -1; }); if (t > 0 && t <= 18) break; }
await shot('drive-2-half-telegraph');
await p.evaluate(() => window.__d.run(60, false));
await shot('drive-2-half');
// a fart and a retch in the same frame
await p.evaluate(async () => { window.__DS = (await import('/src/render/gross/drive.ts')).driveState; });
for (let i = 0; i < 900; i++) if (await p.evaluate(() => { window.__d.run(1, false); const S = window.__DS(); return S && S.vents.some((v) => v.open > 0 && v.open < 12) && S.ports.some((q) => q.retch > 4 && q.retch < 18); })) break;
await shot('drive-2-half-fart-retch');
// 3) ~15%: angry
await p.evaluate(() => { const B = window.__d.boss(); B.hp = B.max * .2; window.__d.run(200, false); B.hp = Math.max(B.hp, B.max * .15); });
for (let i = 0; i < 400; i++) { const t = await p.evaluate(() => { window.__d.run(1, false); const L = window.__d.boss().laser; return L ? L.tel : -1; }); if (t === 0) break; }
await p.evaluate(() => window.__d.run(6, false));
await shot('drive-3-low-beam');
await p.evaluate(() => window.__d.run(80, false));
await shot('drive-3-low');
// 4) death: let the bot finish it
await p.evaluate(() => { const B = window.__d.boss(); B.hp = .01; B.burn = 30; });
for (let i = 0; i < 600; i++) { const d = await p.evaluate(() => { window.__d.run(1); const B = window.__d.boss(); return B ? B.dying : -1; }); if (d > 0) break; }
await p.evaluate(() => window.__d.run(70, false));
await shot('drive-4-death-a');
await p.evaluate(() => window.__d.run(60, false));
await shot('drive-4-death-b');
await p.evaluate(() => window.__d.run(70, false));
await shot('drive-4-death-c');
for (let i = 0; i < 400; i++) if (await p.evaluate(() => { window.__d.run(1, false); return !window.__d.boss(); })) break;
await p.evaluate(() => window.__d.run(22, false));
await shot('drive-5-rupture');
await p.evaluate(() => window.__d.run(50, false));
await shot('drive-5-after');
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
