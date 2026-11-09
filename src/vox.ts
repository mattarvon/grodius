// @ts-nocheck
// ?vox=<cat>: the voice booth's "test in game" (LS2-booth, tools/booth/README.md). Dev server only: main.ts imports
// this behind import.meta.env.DEV, so a build drops it with the import. Once audio is running and the category's
// clips have decoded, it fires the game's own trigger for that line once: hype(n) for a chain line (the comms window,
// the sting and the clip), the same sample() call killEnemy / the stage clear / the title make for the rest.
// It runs from a timer, outside step(), and only when the URL asks for it, so a run without ?vox= is untouched;
// sample() draws the audio RNG ar(), never the sim RNG.
import { $ } from './state';
import { BANK, audioRunning, sample } from './audio';
import { HYPE, hype } from './fx/update';

/** the game's call for each wired voice slot; the sample() options are the call sites' own (enemies/update.ts
 *  corpse kill, stages.ts boss reward, menus.ts DESCEND), tests/unit/booth.test.ts checks they still match */
export const VOX_FIRE: Record<string, { state: string; fire: () => unknown }> = {
  corpsevoice: { state: 'play', fire: () => sample('corpsevoice', { vol: 1.1, spread: .04, wet: .2, solo: true }) },
  bossreward: { state: 'play', fire: () => sample('bossreward', { vol: 1.15, spread: .02, wet: .16 }) },
  startgame: { state: 'title', fire: () => sample('startgame', { vol: 1.15, spread: .02, wet: .14 }) },
};
for (const n of Object.keys(HYPE)) VOX_FIRE['hype' + n] = { state: 'play', fire: () => hype(+n) };

/** read ?vox= and fire it once when it can be heard */
export function voxBoot(search: string) {
  const cat = new URLSearchParams(search).get('vox');
  if (!cat) return;
  const v = VOX_FIRE[cat];
  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;padding:4px 8px;background:#000c;color:#ffd0c0;font:12px monospace;border:1px solid #ff4a5a;pointer-events:none';
  document.body.appendChild(tip);
  if (!v) return void (tip.textContent = `?vox=${cat}: not a wired voice slot (${Object.keys(VOX_FIRE).join(', ')})`);
  let waited = 0;
  const id = setInterval(() => {
    if (!audioRunning()) return void (tip.textContent = `VOX ${cat}: click or press a key to start audio`);
    if (!BANK[cat]?.length) {
      if ((waited += 250) > 4000) tip.textContent = `VOX ${cat}: no takes in src/sfx/${cat}/`;
      return;
    }
    if ($.state !== v.state) return void (tip.textContent = `VOX ${cat}: waiting for the ${v.state} screen`);
    clearInterval(id);
    v.fire();
    tip.textContent = `VOX ${cat}: fired (${BANK[cat].length} take${BANK[cat].length === 1 ? '' : 's'}). Reload to hear another`;
    setTimeout(() => tip.remove(), 6000);
  }, 250);
}
