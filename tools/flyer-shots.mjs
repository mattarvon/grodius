// Flyer upgrade shots: wasp drones (formation + rear wave), eyeball hatchlings (school + from behind), the frozen corpse
// variants, a hit flash and a corpse cut in half. Usage: node tools/flyer-shots.mjs <url> <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts');
  const U = await import('/src/enemies/update.ts'), SR = await import('/src/sprites.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  window.__us = { $, W, ST, SP, C, IN, RS, U, SR };
  window.__clr = () => {
    const m = window.__us; m.$.G.si = m.$.G.script.length; m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.$.G.mini = null;
    for (const a of [m.W.enemies, m.W.eshots, m.W.caps, m.W.shots, m.W.gibs, m.W.drops]) if (a) a.length = 0;
  };
  window.__st = (n, render = 1) => { const m = window.__us; for (let i = 0; i < n; i++) { Object.assign(m.$.P, { x: 40, y: 250, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; m.ST.step(); } if (render) m.RS.render(); };
});
await p.waitForFunction(() => ['wasp', 'eyeball', 'corpse'].every((k) => window.__us.SR.sprReady(k)), null, { timeout: 10000 });
const rect = () => p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
async function shot(name, gx, gy, hw, hh = hw) {
  const r = await rect();
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: Math.max(0, r.x + (gx - hw) * r.s), y: Math.max(0, r.y + (gy - hh) * r.s), width: hw * 2 * r.s, height: hh * 2 * r.s } });
}
const ev = (s) => p.evaluate(s);

// wasp formation coming in on a sine
await ev(`(() => { window.__clr(); window.__us.SP.formation('sine', 120, 6); })()`); await ev(() => window.__st(90));
await p.screenshot({ path: `${OUT}/drones-full.png` });
let e = await ev(() => { const e = window.__us.W.enemies.find((e) => e.k === 'drone' && e.x < 330); return e && { x: e.x, y: e.y }; });
if (e) await shot('drone', e.x, e.y, 22);
await shot('drones', 330, 120, 110, 50);
// a wall of wasps
await ev(`(() => { window.__clr(); window.__us.SP.formation('wall', 135, 7); })()`); await ev(() => window.__st(70));
await shot('drones-wall', 400, 135, 70, 65);
// a rear wave (mirrored, ghosting in)
await ev(`(() => { window.__clr(); window.__us.SP.formation('behind', 120, 5); })()`); await ev(() => window.__st(150));
await shot('drones-behind', 140, 120, 120, 50);
// hatchling school from the right
await ev(`(() => { window.__clr(); window.__us.SP.hatch(10, false); })()`); await ev(() => window.__st(50));
await p.screenshot({ path: `${OUT}/hatch-full.png` });
e = await ev(() => { const e = window.__us.W.enemies.find((e) => e.k === 'hatch' && e.x < 400); return e && { x: e.x, y: e.y }; });
if (e) await shot('hatch', e.x, e.y, 18);
// from behind
await ev(`(() => { window.__clr(); window.__us.SP.hatch(8, true, 1); })()`); await ev(() => window.__st(110));
await p.screenshot({ path: `${OUT}/hatch-behind-full.png` });
e = await ev(() => { const e = window.__us.W.enemies.find((e) => e.k === 'hatch' && e.x > 60); return e && { x: e.x, y: e.y }; });
if (e) await shot('hatch-behind', e.x, e.y, 18);
// the four corpse variants, legs on / off, one capsule carrier, one flashing
await ev(`(() => { const m = window.__us; window.__clr();
  for (let v = 0; v < 4; v++) { m.SP.corpse(60 + v * 50, { ph: (v + .5) * m.C.TAU / 4, noLeg: false, noArm: false, cap: false, vr: .006 * (v - 1.5) });
    m.SP.corpse(60 + v * 50, { ph: (v + .5) * m.C.TAU / 4, noLeg: true, noArm: v % 2 === 0, cap: v === 1, vr: .01 }); }
  const cs = m.W.enemies.filter((e) => e.k === 'corpse'); cs.forEach((e, i) => { e.x = 200 + (i % 2) * 70; e.drift = 0; e.vx = 0; });
})()`);
await ev(() => { const m = window.__us; m.$.G.scrollSpeed = 0; for (const e of m.W.enemies) { e.x = e.x; } window.__st(40); });
await ev(() => { const cs = window.__us.W.enemies.filter((e) => e.k === 'corpse'); cs.forEach((e, i) => { e.x = 200 + (i % 2) * 40; e.y = 50 + (i >> 1) * 48; e.rot = 0; }); window.__us.RS.render(); });
await shot('corpses-upright', 220, 125, 45, 100);
await ev(() => { window.__st(60, 0); const cs = window.__us.W.enemies.filter((e) => e.k === 'corpse'); cs.forEach((e, i) => { e.x = 200 + (i % 2) * 40; e.y = 50 + (i >> 1) * 48; }); window.__us.RS.render(); });
await shot('corpses', 220, 125, 45, 100);
await ev(() => { const cs = window.__us.W.enemies.filter((e) => e.k === 'corpse'); cs[0].flash = 3; window.__us.RS.render(); });
await shot('corpse-flash', 200, 50, 20);
// cut in half
e = await ev(() => { const m = window.__us; const c = m.W.enemies.find((e) => e.k === 'corpse'); m.U.killEnemy(c, 1); return { x: c.x, y: c.y }; });
await ev(() => window.__st(3));
await shot('corpse-halves', e.x, e.y, 30);
await ev(() => window.__st(14));
await shot('corpse-halves2', e.x + 10, e.y, 40);
// halves only (the rest of the gore cleared), to check the sprite clips along the cut
await ev(`(() => { const m = window.__us; window.__clr(); m.SP.corpse(135, { ph: 2.5, noLeg: false, noArm: false, cap: false });
  const c = m.W.enemies.find((e) => e.k === 'corpse'); c.x = 240; c.rot = .4; m.U.killEnemy(c, 1);
  for (const a of [m.W.gibs]) { const h = a.filter((g) => g.e === c); a.length = 0; a.push(...h); }
  m.W.drops.length = 0; })()`);
await ev(() => { const m = window.__us; for (let i = 0; i < 5; i++) { m.ST.step(); m.W.drops.length = 0; } for (const a of [m.W.mists, m.W.splats, m.W.flashes, m.W.sparks, m.W.texts]) if (a) a.length = 0; m.RS.render(); });
await shot("corpse-halves-clean", 242, 135, 25);
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
