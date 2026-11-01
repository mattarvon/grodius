// Elite + remix shots: elites (enemies/elite.ts) next to normal enemies in each biome, an elite swelling for its
// pustule shot, an elite taking a hit (flash), and a repeated-biome stage (remix) flown for real with the ship firing.
// Same approach as tools/newenemy-shots.mjs: live modules in headless Chromium, real spawn functions, biomes entered
// through openFork. Usage: node tools/elite-shots.mjs <url> <outDir>      (needs the VITE dev server)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.waitForTimeout(1500); // sprite strips load
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), UP = await import('/src/enemies/update.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts');
  const BI = await import('/src/biomes.ts'), EL = await import('/src/enemies/elite.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  window.__us = { $, W, ST, SP, UP, C, IN, RS, BI, EL, py: 135, px: 40 };
  window.__usClear = () => {
    const m = window.__us; m.$.G.si = m.$.G.script.length; m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.$.G.mini = null;
    for (const a of [m.W.enemies, m.W.eshots, m.W.caps, m.W.shots, m.W.gibs, m.W.drops]) if (a) a.length = 0;
  };
  window.__usStep = (n, free) => { const m = window.__us; for (let i = 0; i < n; i++) { if (!free) Object.assign(m.$.P, { x: m.px, y: m.py }); Object.assign(m.$.P, { alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; m.$.G.tally = null; m.ST.step(); } m.RS.render(); };
  /** enter biome b through a real fork; keep: leave its script running (the remix shot) */
  window.__usBiome = (b, scroll, keep) => {
    const m = window.__us;
    window.__usClear(); m.$.G.route = [null, null]; m.$.G.scroll = scroll;
    m.BI.openFork(0); m.$.G.fork.opts = [b, b]; m.$.G.fork.t = 50;
    Object.assign(m.$.P, { x: m.C.W * .74, y: m.$.G.fork.gy[0], alive: true, inv: 30 });
    m.ST.step();
    if (!keep) { m.$.G.scroll = scroll; window.__usStep(60); window.__usClear(); }
  };
});
const rect = () => p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(); return { x: c.x, y: c.y, s: c.width / 480 }; });
async function shot(name, gx, gy, half) {
  await p.screenshot({ path: `${OUT}/${name}-full.png` });
  if (half) {
    const r = await rect();
    const x = Math.max(0, r.x + (gx - half) * r.s), y = Math.max(0, r.y + (gy - half) * r.s);
    await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x, y, width: half * 2 * r.s, height: half * 2 * r.s } });
  }
  console.log(`${name}${half ? ` at ${gx | 0},${gy | 0}` : ''}`);
}
const step = (n, free) => p.evaluate(([n, free]) => window.__usStep(n, free), [n, !!free]);

// 1. per biome: a line-up of its kinds, every other one elite (loop 1 = Descent 2)
const LINE = {
  ice: "SP.corpse(70); SP.corpse(150); SP.mutant(); SP.crossT(-1); SP.formation('sine', 200, 3)",
  acid: "SP.crawler(1); SP.crawler(-1); SP.womb(); SP.eyeT(1); SP.formation('wall', 130, 2)",
  fire: "SP.flayer(80); SP.flayer(170); SP.mutant(); SP.hookE(); SP.crawler(1)",
  snot: "SP.slime(1); SP.slime(-1); SP.womb(); SP.hatch(5, false); SP.corpse(130)",
};
for (const [bk, js] of Object.entries(LINE)) {
  await p.evaluate(([bk]) => { window.__usBiome(bk, 3400); window.__us.$.G.loop = 1; window.__us.py = 135; window.__us.px = 30; }, [bk]);
  await p.evaluate(`(() => { const SP = window.__us.SP; ${js}; })()`);
  // stagger them across the screen: each spawn steps in a little before the next
  await p.evaluate(() => { const m = window.__us, E = m.W.enemies; E.forEach((e, i) => { if (i % 2 === 0) m.EL.eliteify(e); e.x -= i * 34; if (e.ax != null) e.ax -= i * 34; }); });
  await step(70);
  await shot(`elite-${bk}`, 0, 0, 0);
  const e = await p.evaluate(() => { const e = window.__us.W.enemies.find((e) => e.elite && !e.dead && e.x > 60 && e.x < 440); return e && { x: e.x, y: e.y, k: e.k }; });
  if (e) await shot(`elite-${bk}-${e.k}`, e.x, e.y, 40);
}
// 2. an elite mutant swelling for its pustule shot, then the shot; an elite taking a hit
await p.evaluate(() => { window.__usBiome('fire', 3600); window.__us.$.G.loop = 1; window.__us.SP.mutant(); const e = window.__us.W.enemies[0]; window.__us.EL.eliteify(e); e.pz = 9999; });
await step(80);
await p.evaluate(() => { const e = window.__us.W.enemies.find((e) => e.k === 'mutant'); e.pt = 26; e.pz = 9999; });
await step(20);
let m = await p.evaluate(() => { const e = window.__us.W.enemies.find((e) => e.k === 'mutant'); return { x: e.x, y: e.y }; });
await shot('elite-swell', m.x, m.y, 40);
await step(10);
await shot('elite-pustule-shot', m.x - 30, m.y, 60);
await p.evaluate(() => { const m = window.__us, e = m.W.enemies.find((e) => e.k === 'mutant'); m.UP.hurt(e, .5, e.x, e.y, 1); });
await p.evaluate(() => window.__us.RS.render());
await shot('elite-hitflash', m.x, m.y, 40);

// 3. a repeated biome, flown for real: the Cryovault in Descent 3 after a visit in Descent 2 (remix + elites), firing
for (const [bk, tag] of [['ice', 'first'], ['ice', 'remix'], ['fire', 'first'], ['fire', 'remix']]) {
  await p.evaluate(([bk, tag]) => { const m = window.__us; m.$.G.loop = tag === 'remix' ? 2 : 0; m.$.G.bvis = tag === 'remix' ? { [bk]: 1 } : {}; m.$.G.rank = .9; m.IN.K.KeyZ = true; window.__usBiome(bk, 2300, 1); m.px = 60; m.py = 135; }, [bk, tag]);
  for (const k of [1, 2, 3]) {
    await step(k === 1 ? 900 : 420);
    await shot(`stage-${bk}-${tag}-${k}`, 0, 0, 0);
  }
  console.log(bk, tag, await p.evaluate(() => { const m = window.__us; return JSON.stringify({ scroll: Math.round(m.$.G.scroll), remix: m.$.G.visitNo, el: m.W.enemies.filter((e) => e.elite).length, ks: [...new Set(m.W.enemies.map((e) => e.k))] }); }));
  await p.evaluate(() => { window.__us.IN.K.KeyZ = false; });
}
fs.writeFileSync(`${OUT}/errors.txt`, errs.join('\n'));
console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
await b.close();
