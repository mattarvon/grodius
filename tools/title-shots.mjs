// Title-screen shots: the hero eye at a few moments of its life (holds, a dart, the membrane), desktop and phone, plus the
// armed "PRESS BACK AGAIN TO LEAVE" state. Parks rAF and drives $.T so each frame is the same every run. Crops are the
// eye alone at display resolution.
// Usage: node tools/title-shots.mjs <url> <outDir> [prefix]   (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
import fs from 'node:fs';
const [url, OUT, pre = ''] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
async function boot(vp, dsf, touch) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dsf, hasTouch: !!touch, isMobile: !!touch });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
  await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
  await p.evaluate(async () => {
    const S = await import('/src/state.ts'), RS = await import('/src/render/screens.ts'), SV = await import('/src/save.ts'), SP = await import('/src/sprites.ts'), M = await import('/src/menus.ts'), HE = await import('/src/render/heroeye.ts'), E = await import('/src/render/eyes.ts');
    window.__t = { $: S.$, RS, SV, SP, M };
    S.$.gate = false; SV.SET.asked = true; S.$.state = 'title';
    HE.warmHeroEye(); for (let i = 0; i < 500 && E.warmEyes(); i++);
    window.__at = (T) => { S.$.T = T; for (let i = 0; i < 3; i++) RS.render(); };
  });
  await p.waitForFunction(() => Object.values(window.__t.SP.SPR).every((s) => s.fw > 0), null, { timeout: 20000 });
  return p;
}
// real moments of the eye's life, read from titleGaze itself so they can't go stale: three separate holds, the second
// saccade of a burst, and the membrane mid-sweep on its way in
const MOMENTS = await (async () => {
  const p = await (await b.newContext()).newPage();
  await p.goto(url);
  const m = await p.evaluate(async () => {
    const { titleGaze } = await import('/src/render/titlegaze.ts'), holds = [];
    let dart = 0, blink = 0, wasHold = false;
    for (let t = 1000; t < 40000 && (holds.length < 3 || !dart || !blink); t++) {
      const g = titleGaze(t), hold = g.phase === 0 && g.jig === 0 && g.bl === 0;
      if (hold && !wasHold && holds.length < 3 && (!holds.length || t - holds[holds.length - 1] > 240)) holds.push(t + 30);
      wasHold = hold;
      if (!dart && g.phase === 2 && g.jig === 1 && titleGaze(t - 1).phase === 2) dart = t + 2;
      if (!blink && g.bl > .28 && g.bl < .34 && g.bl > titleGaze(t - 1).bl) blink = t;
    }
    return [['rest', holds[0]], ['look-a', holds[1]], ['look-b', holds[2]], ['dart', dart], ['blink', blink]];
  });
  await p.context().close();
  return m;
})();
console.log('moments', JSON.stringify(MOMENTS));
for (const [tag, vp, dsf, touch] of [['desktop', { width: 960, height: 540 }, 2, 0], ['phone', { width: 904, height: 412 }, 2.625, 1]]) {
  const p = await boot(vp, dsf, touch);
  const box = await p.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  for (const [m, T] of MOMENTS) {
    await p.evaluate((T) => window.__at(T), T);
    if (m === 'rest') await p.screenshot({ path: `${OUT}/${pre}${tag}-title.png` });
    await p.screenshot({ path: `${OUT}/${pre}${tag}-eye-${m}.png`, clip: { x: box.x + box.w * .5, y: box.y, width: box.w * .5, height: box.h } });
  }
  await p.evaluate(() => { const t = window.__t; t.$.T = 1000; t.M.doBack('armExit'); window.__at(1010); });
  await p.screenshot({ path: `${OUT}/${pre}${tag}-armed.png` });
  await p.context().close();
}
await b.close();
console.log('title-shots', errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok');
