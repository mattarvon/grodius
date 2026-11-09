// @ts-nocheck
// ?vox=<cat>[&clip=<stem>]: the voice booth's "test in game" (LS2-booth, tools/booth/README.md). Dev server only:
// main.ts imports this behind import.meta.env.DEV, so a build drops it with the import. Once audio is running and the
// category's clips have decoded, it fires the game's own trigger for that line once: hype(n) for a chain line (the
// sting, the caption and the clip through the comms window), the call site's own sample() for the rest (the corpse
// plea, the boss reward, DESCEND, a midboss kill word, OPENED). It never runs the corpse plea's once-a-stage count
// (G.st.corpseN/corpseVo) or OPENED's cooldown: it tests the line, not the rule. clip= narrows
// the bank to that take, so the booth hears the take it just kept rather than the shuffle bag's next pick.
// hype(n) is the real thing: it writes $.G.hype (run state) from a timer outside step(). Harmless in a hand test;
// never put ?vox= in a harness scenario. Without ?vox= nothing here runs. No sim RNG is drawn (sample() uses ar()).
import { $ } from './state';
import { BANK, audioRunning, sample } from './audio';
import { HYPE, hype } from './fx/update';
import { KILL_WORD_AT } from './enemies/update';
import { MID_SIM } from './enemies/mid/roster';

/** the game's call for each wired voice slot; the sample() options are the call sites' own (enemies/update.ts
 *  corpse kill, stages.ts boss reward, menus.ts DESCEND), tests/unit/booth.test.ts checks they still match */
export const VOX_FIRE: Record<string, { state: string; fire: () => unknown }> = {
  // the plea's own call (enemies/update.ts, after corpseKilled): fired straight, so G.st.corpseN/corpseVo stay as the run left them
  corpsevoice: { state: 'play', fire: () => sample('corpsevoice', { vol: 1.1, spread: .04, wet: .2, solo: true, prio: true }) },
  bossreward: { state: 'play', fire: () => sample('bossreward', { vol: 1.15, spread: .02, wet: .16 }) },
  startgame: { state: 'title', fire: () => sample('startgame', { vol: 1.15, spread: .02, wet: .14 }) },
  // OPENED (fx/update.ts opened): the same call; the OPENED_GAP cooldown is the game's, not the test's
  carn5: { state: 'play', fire: () => sample('carn5', { vol: 1.15, spread: .02, wet: .16, queue: false }) },
};
for (const n of Object.keys(HYPE)) VOX_FIRE['hype' + n] = { state: 'play', fire: () => hype(+n) };
/** a midboss's kill word (enemies/update.ts killEnemy, the same call); added at boot, once every kind has registered */
const killFire = () => {
  for (const k in MID_SIM) VOX_FIRE['kill-' + k] ||= { state: 'play', fire: () => sample('kill-' + k, { vol: 1.15, spread: .02, wet: .16, at: KILL_WORD_AT }) };
};

/** how long the fired tip stays up (ms; written as a product: layout-literals.test.ts reserves bare world-x numbers) */
const TIP_MS = 8 * 1000;

/** read ?vox= and fire it once when it can be heard */
export function voxBoot(search: string) {
  const q = new URLSearchParams(search), cat = q.get('vox'), clip = q.get('clip');
  if (!cat) return;
  killFire();
  const v = VOX_FIRE[cat];
  const tip = document.createElement('div');
  tip.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9;padding:4px 8px;background:#000c;color:#ffd0c0;font:12px monospace;border:1px solid #ff4a5a;pointer-events:none';
  document.body.appendChild(tip);
  if (!v) return void (tip.textContent = `?vox=${cat}: not a wired voice slot (${Object.keys(VOX_FIRE).join(', ')})`);
  let waited = 0;
  const id = setInterval(() => {
    if (!audioRunning()) return void (tip.textContent = `VOX ${cat}: click or press a key to start audio`);
    const all = BANK[cat] || [], pick = clip ? all.filter((b) => b.clip === clip) : all;
    if (!pick.length) {
      // clips decode one by one after the audio starts: give them a few seconds before calling one missing
      if ((waited += 250) > 4000) tip.textContent = clip ? `VOX ${cat}: no take ${clip} in src/sfx/${cat}/` : `VOX ${cat}: no takes in src/sfx/${cat}/`;
      return;
    }
    if ($.state !== v.state) return void (tip.textContent = `VOX ${cat}: waiting for the ${v.state} screen`);
    clearInterval(id);
    // hype() plays its clip 120 ms after the sting: the narrowed bank stays up until that has been picked
    if (clip) BANK[cat] = pick;
    v.fire();
    if (clip) setTimeout(() => (BANK[cat] = [...new Set([...all, ...BANK[cat]])]), 600); // keeps any clip that decoded meanwhile
    tip.textContent = `VOX ${cat}: fired ${clip || `one of ${all.length} take${all.length === 1 ? '' : 's'}`}. Reload to hear it again`;
    setTimeout(() => tip.remove(), TIP_MS);
  }, 250);
}
