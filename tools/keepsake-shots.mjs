// THE KEEPSAKE stage boss (D55) screenshots: each phase and beat, fought where bossFor places it (long4's biome slot 1,
// built for real so its arena terrain and the biome's look are there) by the boss-probe bot (STAGE 1 kit, invincible,
// parked at x 90 aiming at the wound), rendered every frame so the render-side art animates. Full frames plus a 2x
// close-up of the head per beat. The bot holds fire (FIRE=1 env: it shoots) and HP is set straight to each phase's cut, so
// every beat is reached on purpose; the beats themselves are the sim's own.
// Usage: node tools/keepsake-shots.mjs <url> <outDir> [biome=fire] [--layout long4]   (flashes on; FLASHES=0 env: off)
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const args = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && A[i - 1] !== '--layout');
const [url, OUT = '.', BIOME = 'fire'] = args;
const FLASHES = process.env.FLASHES !== '0';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((fl) => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true, ...(fl ? {} : { flashes: false }) })); } catch (e) {} }, FLASHES);
await p.addInitScript((f) => { window.__kFire = f; }, process.env.FIRE === '1');
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'keepsake-shots');
// every sprite and the boss atlas decoded first
await p.evaluate(async () => { const B = await import('/src/render/gross/baked.ts'); B.bakedWarm('keepsake-boss'); });
for (let i = 0; i < 200; i++) { if (await p.evaluate(async () => (await import('/src/render/gross/baked.ts')).bakedReady('keepsake-boss'))) break; await new Promise((r) => setTimeout(r, 50)); }
await p.evaluate(async (biome) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts'), REG = await import('/src/enemies/boss/registry.ts');
  const { render } = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = !!window.__kFire; // the bot holds fire: the rig sets HP itself, so each beat is reached on purpose
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  const G = $.G, r1 = LY.slotRow(1), r0 = LY.slotRow(0);
  G.route = [biome === 'ice' ? 'fire' : 'ice', biome]; G.bx = [r0.gateLate ?? r0.x0, r1.gateLate ?? r1.x0, null]; G.visitNo = [0, 0];
  BI.biomeStage(1, G.bx[1]);
  G.stage = LY.stageOfSlot(1); G.scroll = r1.bossX + 200; G.si = G.script.length; G.pick = null; G.pickQ = 0; G.tally = null;
  Object.assign($.P, { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1, shield: 3 });
  G.gm = { cal: 1 }; G.pk = { dmg: 1 }; G.lvl = 10;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  G.st = { kills: 0, spawned: 0, hits: 0, deaths: 0, chain: 0, t0: G.t };
  G.pend.length = 0; G.banner = null; G.logQ.length = 0; G.log = null; // newGame queued STAGE 1-1's card: this is stage 1-3
  REG.BOSS_SIM.keepsake.spawn(biome);
  window.__k = { $, ST, C, render, W };
  window.__kStep = (n, cond) => {
    const m = window.__k;
    for (let i = 0; i < n; i++) {
      const g = m.$.G.mini;
      if (cond && g && cond(g)) return 'cond';
      if (g && !g.dead) {
        const y = m.C.clamp(g.y + (g.wy || 0), 8, m.C.PH - 8), P = m.$.P;
        P.hist.unshift({ x: 90, y }); if (P.hist.length > 80) P.hist.pop();
        Object.assign(P, { x: 90, y, alive: true, inv: 30 });
      }
      m.$.G.pick = null; m.$.G.pickQ = 0;
      m.ST.step(); m.render();
    }
    return null;
  };
}, BIOME);
let last = { x: 360, y: 160 };
const shot = async (name) => {
  const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(), g = window.__k.$.G.mini; return { x: c.x, y: c.y, s: c.width / 480, g: g ? { x: g.x, y: g.y } : null }; });
  if (r.g) last = r.g;
  name = name.replace(/^kb-/, `kb-${BIOME}-`);
  await p.screenshot({ path: `${OUT}/${name}-core.png` });
  await p.screenshot({ path: `${OUT}/${name}-core-zoom.png`, clip: { x: r.x + (last.x - 150) * r.s, y: r.y, width: 220 * r.s, height: Math.min(254, last.y + 70) * r.s } });
  console.log('shot', name, await p.evaluate(() => { const g = window.__k.$.G.mini; return g ? `ph=${g.ph} st=${g.st} wt=${g.wt} tr=${g.tr} th=${(g.th * 57.3).toFixed(0)} hp=${(g.hp / g.max * 100).toFixed(0)}% rage=${g.rage}` : 'dead'; }));
};
const step = (n, cond) => p.evaluate(([n, c]) => window.__kStep(n, c ? new Function('g', 'return ' + c) : null), [n, cond]);
const setHp = (f) => p.evaluate((f) => { const g = window.__k.$.G.mini; g.hp = g.max * f; }, f);

await step(200); await shot('kb-1a-dozing');
await step(1200, "g.st === 'tell' && g.wt > 34"); await shot('kb-1b-fountain-tell');
await step(1200, "g.st === 'aim' && g.wt > 36"); await shot('kb-1c-throw-locked');
await setHp(.649); await step(600, 'g.ph === 1 && g.tr < 40'); await shot('kb-2a-woke-up');
await step(800, 'g.ph === 1 && g.tr <= 0 && g.th < -.5'); await step(20); await shot('kb-2b-awake-window');
await step(800, 'g.ph === 1 && g.th > .5'); await step(10); await shot('kb-2c-awake-away');
await step(1500, "g.st === 'drop' && g.wt > 30"); await shot('kb-2d-mobile-drop-tell');
await step(1500, "g.st === 'fly' && g.bs > 60"); await shot('kb-2e-boomerang');
await step(1500, "g.st === 'wail' && g.wt > 30"); await shot('kb-2f-wail-tell');
await p.evaluate(() => { const g = window.__k.$.G.mini; g.wins = 9; }); await setHp(.299); await step(600, 'g.ph === 2 && g.tr < 50'); await shot('kb-3a-cracked');
await step(600, 'g.ph === 2 && g.tr <= 0 && g.p3t > 100 && g.pa > 1.6'); await shot('kb-3b-pendulum-swing');
await step(1500, "g.st === 'mama' && g.wt > 30"); await shot('kb-3c-mama-tell');
await step(1500, "g.st === 'rain' && g.wt > 30"); await shot('kb-3d-fork-rain-tell');
await p.evaluate(() => { const g = window.__k.$.G.mini; g.pt = 1499; }); await step(30); await shot('kb-3e-enrage');
await p.evaluate(async () => { const U = await import('/src/enemies/update.ts'), g = window.__k.$.G.mini; if (g.crier && !g.crier.dead) U.hurt(g.crier, 999, g.crier.x, g.crier.y, -1); }); await step(30); await shot('kb-3f-crier-broken');
await setHp(.0019); await step(400, "g.st === 'dying' && g.wt > 45"); await shot('kb-4a-put-to-bed-clacks');
await step(400, "g.st === 'dying' && g.wt > 95"); await shot('kb-4b-tipping');
await step(400, 'g.dead'); await step(20); await shot('kb-4c-dead');
console.log('banner:', await p.evaluate(() => window.__k.$.G.banner && window.__k.$.G.banner.text), 'tally grade:', await p.evaluate(() => window.__k.$.G.tally && window.__k.$.G.tally.g));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('keepsake-shots'); await b.close();
