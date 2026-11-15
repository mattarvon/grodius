// Title capture for review: a short WebM and GIF of the title with its motion, on a parked clock. Parks rAF, advances $.T by
// 1 per frame, renders, and keeps every 2nd frame at 30 fps. Runs until the easter egg has made two visits, cutting all but
// 1 s of each absence so the film stays small; [seconds] is the film's limit.
// Usage: node tools/title-capture.mjs <url> <outDir> <name> [seconds]   (needs the VITE dev server: imports live modules)
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [url, OUT, name, secs = '30'] = process.argv.slice(2);
if (!url || !OUT || !name) { console.error('usage: title-capture.mjs <url> <outDir> <name> [seconds]'); process.exit(2); }
const MAX_FRAMES = Math.round(+secs * 60), VISITS = 2, KEEP_GAP = 60, GIF_MAX = 8e6;
fs.mkdirSync(OUT, { recursive: true });
const raw = fs.mkdtempSync(path.join(OUT, `.${name}-raw-`));
const b = await chromium.launch();
const errs = [];
const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url);
await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
await p.evaluate(async () => {
  const S = await import('/src/state.ts'), RS = await import('/src/render/screens.ts'), SV = await import('/src/save.ts'), SP = await import('/src/sprites.ts'), E = await import('/src/render/eyes.ts'), HE = await import('/src/render/heroeye.ts'), TB = await import('/src/render/titleblood.ts');
  S.$.gate = false; SV.SET.asked = true; S.$.state = 'title';
  HE.warmHeroEye?.(); for (let i = 0; i < 500 && E.warmEyes(); i++);
  await new Promise((res) => { const iv = setInterval(() => { if (Object.values(SP.SPR).every((s) => s.fw > 0)) { clearInterval(iv); res(); } }, 50); });
  let T = 1000, gapRun = 0;
  S.$.T = T; RS.render();
  // one frame on, skipping absence past KEEP_GAP; reports whether to keep the frame and how many visits have ended
  window.__next = (KEEP_GAP) => {
    do { S.$.T = ++T; RS.render(); gapRun = TB.E.phase === TB.GONE ? gapRun + 1 : 0; } while (gapRun > KEEP_GAP);
    return TB.E.done;
  };
});
let shot = 0, frames = 0;
while (frames < MAX_FRAMES) {
  const done = await p.evaluate((k) => window.__next(k), KEEP_GAP);
  if (frames++ % 2 === 0) await p.screenshot({ path: `${raw}/${String(shot++).padStart(5, '0')}.png` });
  if (done >= VISITS) break;
}
await b.close();
const ff = (...a) => { const r = spawnSync('/usr/bin/ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg failed'); };
const inp = ['-framerate', '30', '-i', `${raw}/%05d.png`];
ff(...inp, '-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0', '-pix_fmt', 'yuv420p', `${OUT}/${name}.webm`);
// the palette is the whole GIF, and game pixels want nearest; step down only if it comes out too big to share
const gif = `${OUT}/${name}.gif`;
for (const [w, fps] of [[720, 15], [480, 12]]) {
  ff(...inp, '-vf', `fps=${fps},scale=${w}:-1:flags=neighbor,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none`, gif);
  if (fs.statSync(gif).size <= GIF_MAX) break;
}
fs.rmSync(raw, { recursive: true, force: true });
console.log('title-capture', errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok', `${frames} frames`, `webm ${fs.statSync(`${OUT}/${name}.webm`).size} gif ${fs.statSync(gif).size}`);
