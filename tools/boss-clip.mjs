// Boss clips (LS2-bossart): flies each boss through one scripted fight on the real game and keeps the frames: idle, its attacks,
// damage down through the wound stages with real hit flashes, then the death. Sim stepped by hand on a fake clock, player invincible at
// the left and not firing; hits come from enemies/update.ts hurt(). Measures nothing, writes only under <outDir>. Not measured: a real
// player's shots and the bullet read under fire (each clip does keep the boss's own bullets).
// Usage: node tools/boss-clip.mjs <url> <outDir> <subject> [...]   subjects: crux butcher maw acidmaw snotmaw drive choir cyst prentice brood ufo
//   --from-spawn: render and keep every frame from the spawn (render-side state such as fades runs as in play); default skips
//   the first 260 frames unrendered.
//   Needs the Vite dev server. Writes <outDir>/<subject>/f0000.png at the game's 480x270, every 2nd game frame. Pack: tools/boss_clip_pack.py
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2), FROM_SPAWN = args.includes('--from-spawn'), [url, OUT, ...subs] = args.filter((a) => a !== '--from-spawn');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url + '?layout=long4'); await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
await p.waitForTimeout(1500);
const MID = { choir: 'ice', cyst: 'acid', prentice: 'fire', brood: 'snot' };
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const U = await import('/src/enemies/update.ts'), RS = await import('/src/render/screens.ts'), LY = await import('/src/layout.ts'), BU = await import('/src/boss/update.ts'), UF = await import('/src/enemies/mid/ufo.ts');
  const $ = S.$, cap = document.createElement('canvas'); cap.width = C.W; cap.height = C.H; const cx = cap.getContext('2d');
  const toBiome = (biome) => {
    F.newGame(0); $.state = 'play'; $.gate = false; IN.K.KeyZ = false;
    for (let i = 0; i < 30; i++) ST.step();
    const X0 = LY.slotRow(0).x0; $.G.scroll = X0; $.G.si = $.G.script.length; W.enemies.length = 0;
    BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
    Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
    ST.step(); $.G.scroll = X0 + 1000;
    for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
    clear();
  };
  const clear = () => { $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; if ($.G.pend) $.G.pend.length = 0; W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0; };
  const subject = () => $.G.boss || $.G.mini;
  window.__c = {
    start(k, biome) {
      if (biome) { toBiome(biome); SP.midboss(k, BI.MID_NAMES[k], undefined, 9000); }
      else if (k === 'crux') { toBiome('ice'); SP.crux(); } else if (k === 'butcher') { toBiome('fire'); SP.butcher(); }
      else if (k === 'acidmaw' || k === 'snotmaw') { const v = k === 'acidmaw' ? 'acid' : 'snot'; toBiome(v); SP.maw(true); $.G.mini.biome = v; $.G.mini.title = BI.BIOMES[v].bossName; }
      else if (k === 'maw') { F.newGame(0); $.state = 'play'; $.gate = false; for (let i = 0; i < 30; i++) ST.step(); $.G.scroll = LY.rowOfKind('orbit').warnX; clear(); SP.maw(true); }
      else if (k === 'drive') { F.newGame(0); $.state = 'play'; $.gate = false; for (let i = 0; i < 30; i++) ST.step(); $.G.scroll = LY.bossAt(); clear(); BU.startBoss(); }
      else if (k === 'ufo') { F.newGame(0); $.state = 'play'; $.gate = false; for (let i = 0; i < 30; i++) ST.step(); $.G.scroll = LY.ufoAt() - 1; clear(); for (let i = 0; i < 300; i++) ST.step(); $.G.scroll = LY.ufoAt() - 1; clear(); UF.ufoWarn(); }
    },
    /** n game frames; keep a png every 2nd when grab. Stops at death + n */
    run(n, grab) {
      const out = [];
      for (let i = 0; i < n; i++) {
        const g = subject();
        if (g && !g.dead) { const P = $.P; P.hist.unshift({ x: 60, y: 200 }); if (P.hist.length > 80) P.hist.pop(); }
        Object.assign($.P, { x: 60, y: 200, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; $.G.banner = null; $.G.tally = null; $.gate = false;
        ST.step();
        if (grab) { RS.render(); if (i % 2 === 0) { cx.drawImage(document.getElementById('c'), 0, 0, C.W, C.H); out.push(cap.toDataURL('image/png')); } }
      }
      return out;
    },
    /** hp frac now, with hits at the body so the flash and the tearing play */
    hit(frac) {
      const g = subject(); if (!g) return;
      if (g.bars) for (const q of g.bars) if (!q.dead) U.killEnemy(q, -1);
      if (g.plates) for (const q of g.plates) q.hp = 0;
      if (g.shielded !== undefined) g.shielded = false;
      const d = Math.max(0, g.hp - g.max * frac);
      if (g.plates || !U.hurt) { g.hp -= d; g.flash = 4; return; }
      g.t = Math.max(g.t || 0, 200); g.hp -= Math.max(0, d - .01); U.hurt(g, .01, g.x, g.y, 1); g.flash = g.flash || 4;
    },
    kill() { const g = subject(); if (!g) return; if (g.plates) { g.hp = 0; return; } g.hp = 0; U.killEnemy(g, 1); },
    info() { const g = subject(); return g ? `${g.k || 'boss'} st=${g.st || ''} hp=${(g.hp / g.max * 100) | 0}% y=${g.y | 0}` : 'gone'; },
  };
});
for (const k of subs) {
  const dir = `${OUT}/${k}`; mkdirSync(dir, { recursive: true }); let f = 0;
  const keep = async (n) => { const fr = await p.evaluate((n) => window.__c.run(n, true), n); for (const d of fr) writeFileSync(`${dir}/f${String(f++).padStart(4, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')); };
  await p.evaluate(([k, bio]) => { window.__c.start(k, bio); window.__c.run(2, true); }, [k, MID[k] || null]);
  await p.waitForTimeout(700); // the baked atlas: its first draw starts the load, which needs real time (the game's warm-up does this earlier)
  if (FROM_SPAWN) await keep(k === 'drive' ? 420 : 260); else await p.evaluate((k) => window.__c.run(k === 'drive' ? 420 : 260, false), k);
  await keep(k === 'ufo' ? 140 : 240); console.log(k, 'fight', await p.evaluate(() => window.__c.info()));
  for (const fr of [.8, .6, .45, .3, .15, .08]) { await p.evaluate((fr) => window.__c.hit(fr), fr); await keep(k === 'ufo' ? 40 : fr > .5 ? 80 : 110); /* the Saucer drifts off on its own clock: a slow clip loses the kill */ console.log(k, 'at', fr, await p.evaluate(() => window.__c.info())); }
  await p.evaluate(() => window.__c.kill()); await keep(k === 'drive' ? 400 : 200);
  console.log(k, f, 'frames', await p.evaluate(() => window.__c.info()));
}
console.log('errors:', errs.slice(0, 8).join(' | ') || 'none'); await b.close();
