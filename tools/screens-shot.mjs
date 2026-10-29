// Screen-art shots: the hype-voice comms portrait mid-line in a real play frame (one per voice clip), the game-over
// screen at two animation moments and the Infirmary. Imports live modules from the VITE dev server and drives $.state
// directly; rAF is parked so every frame is rendered on purpose.
// Usage: node tools/screens-shot.mjs <url> <outDir> [only=hype,over,shop,phone]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT, only = 'hype,over,shop,phone'] = process.argv.slice(2);
const want = new Set(only.split(','));
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
async function boot(vp, touch) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} window.__adv = (ms) => (now += ms); });
  await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
  await p.evaluate(async () => {
    const S = await import('/src/state.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts'), RS = await import('/src/render/screens.ts');
    const W = await import('/src/world.ts'), A = await import('/src/audio.ts'), SP = await import('/src/sprites.ts'), U = await import('/src/fx/update.ts');
    const $ = S.$; $.gate = false;
    window.__s = { $, ST, F, RS, W, A, SP, U };
    // fake an audio clock so the comms window can follow a clip without real audio
    const real = A.AU.c || new AudioContext();
    window.__clock = 0;
    A.AU.c = new Proxy(real, { get: (t, k) => (k === 'currentTime' ? window.__clock : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
    window.__play = (n) => { const m = window.__s; for (let i = 0; i < n; i++) { Object.assign(m.$.P, { alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0; m.ST.step(); window.__clock += 1 / 60; m.RS.render(); } };
    window.__sprWait = () => Object.values(m_SPR()).every((s) => s.fw > 0);
    function m_SPR() { return SP.SPR; }
  });
  await p.waitForFunction(() => window.__sprWait(), null, { timeout: 20000 });
  return p;
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` });

if (want.has('hype') || want.has('phone')) {
  const vps = [];
  if (want.has('hype')) vps.push(['', { width: 960, height: 540 }, 0]);
  if (want.has('phone')) vps.push(['phone-', { width: 904, height: 388 }, 1]); // Fold 7 cover screen-ish 21:9 landscape
  for (const [pre, vp, touch] of vps) {
    const p = await boot(vp, touch);
    await p.evaluate(() => { const m = window.__s; m.F.newGame(0); m.$.state = 'play'; window.__play(420); });
    const clips = pre ? [['hype10', 'hell-yeah-matty-1']] : [['hype10', 'hell-yeah-matty-1'], ['hype10', 'shamalama-matty-1'], ['babe20', 'sfriend-matty-1'], ['corpsevoice', 'stop-killing-me-matty-1'], ['bossreward', 'keyster-easter-matty-1'], ['startgame', 'lesley-yeah-baby-matty-1']];
    for (const [cat, name] of clips) {
      await p.evaluate(([cat, name]) => {
        const m = window.__s;
        m.$.G.hype = null; m.$.G.babe = null;
        if (cat === 'hype10') m.U.hype(10);
        if (cat === 'babe20') m.U.babe();
        m.A.voiceOn(cat, { clip: name, duration: 2.4 }, 1);
        window.__play(26);
      }, [cat, name]);
      await shot(p, `${pre}hype-${name.replace(/-matty-1/, '')}`);
      if (!pre && cat === 'hype10' && name.startsWith('hell')) { await p.evaluate(() => window.__play(9)); await shot(p, 'hype-hell-yeah-b'); await p.evaluate(() => window.__play(128)); await shot(p, 'hype-hell-yeah-out'); }
      await p.evaluate(() => window.__play(240));
    }
    await p.close();
  }
}
if (want.has('over')) {
  const p = await boot({ width: 960, height: 540 });
  await p.evaluate(() => { const m = window.__s; m.F.newGame(0); m.$.state = 'play'; window.__play(300); Object.assign(m.$.G, { score: 48210, kills: 311, maxCombo: 37, bio: 912 }); m.$.state = 'over'; m.$.G.overT = 0; m.$.menuSel = 0; });
  for (const [n, f] of [['over-a', 70], ['over-b', 23], ['over-c', 15]]) { await p.evaluate((f) => { const m = window.__s; for (let i = 0; i < f; i++) { m.$.T++; m.$.G.overT++; } m.RS.render(); }, f); await shot(p, n); }
  await p.close();
}
if (want.has('shop')) {
  const p = await boot({ width: 960, height: 540 });
  await p.evaluate(() => { const m = window.__s; m.$.meta.bio = 640; m.F.openShop('title'); m.$.menuSel = 0; m.RS.render(); });
  await shot(p, 'shop-a');
  await p.evaluate(() => { const m = window.__s; for (let i = 0; i < 47; i++) m.$.T++; m.$.menuSel = 3; m.RS.render(); });
  await shot(p, 'shop-b');
  await p.close();
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
await b.close();
