// @ts-nocheck
import { $ } from './state';
import { playerHit } from './player';
import { stepBiome, hazardHit } from './biomes';
import { stepPerks } from './perks';
import { powerBudget } from './power';
import { musicUpdate } from './music';
import { clamp, swapRm } from './core';
import { srnd } from './srnd';
import { SET, save } from './save';
import { setMute } from './audio';
import { I, PR, pollInput } from './input';
import { arcs, decals } from './world';
import { endLoop, openPause } from './flow';
import { runScript } from './enemies/spawn';
import { updateBoss } from './boss/update';
import { updatePlayer } from './player';
import { updateCaps, updateEShots, updateEnemies, updateShots } from './shots';
import { decayFX, updateAmbient, updateCombo, updateFX } from './fx/update';
import { stepContraptions } from './contraptions';
import { menuNav, overItems, pauseItems, stepShop, titleItems } from './menus';

// ---------------- main step ----------------
export function stepWorld() {
  $.G.t++;
  // one power budget (src/power.ts): every gun, graft, perk and bolted contraption. Difficulty reads it only as enemy
  // fire and density (D1); uncapped here, every()/BS()/formation() cap it at 2
  $.G.pow = powerBudget();
  $.G.rank = clamp($.G.pow, 0, 1);
  if ($.G.mini && $.G.mini.dead) $.G.mini = null;
  const tgt = $.G.bossStarted || ($.G.mini && !$.G.mini.drift) || $.G.forkHold ? 0 : 1; // drift: the Open Orbit midboss doesn't hold the scroll
  $.G.scrollSpeed += (tgt - $.G.scrollSpeed) * .02;
  if (tgt === 0 && $.G.scrollSpeed < .02) $.G.scrollSpeed = 0;
  $.G.scroll += $.G.scrollSpeed;
  if ($.state === 'play') {
    runScript();
    updatePlayer();
    stepContraptions();
  }
  updateShots();
  updateEnemies();
  updateBoss();
  updateEShots();
  updateCaps();
  updateFX();
  updateCombo();
  updateAmbient();
  stepBiome();
  if ($.G.tally && --$.G.tally.t <= 0) $.G.tally = null; // tally card lifetime counts game steps, not rendered frames
  if (hazardHit()) playerHit();
  decayFX();
  for (let i = $.G.pend.length - 1; i >= 0; i--) {
    const p = $.G.pend[i];
    if (--p.t <= 0) {
      $.G.pend.splice(i, 1);
      p.f();
    }
  }
  for (let i = $.G.warn.length - 1; i >= 0; i--) if (--$.G.warn[i].t <= 0) $.G.warn.splice(i, 1);
  if ($.G.feed && --$.G.feed.t <= 0) $.G.feed = null;
  for (let i = arcs.length - 1; i >= 0; i--) if (--arcs[i].l <= 0) swapRm(arcs, i);
  if ($.G.t % 600 === 0) save();
  if ($.G.t % 30 === 0) {
    let j = 0;
    for (const d of decals) if (d.wx > $.G.scroll - 30) decals[j++] = d;
    decals.length = j;
  }
  if ($.state === 'play' && $.G.clearT > 0 && --$.G.clearT === 0) endLoop();
}
export function step() {
  $.T++;
  musicUpdate();
  pollInput();
  if (PR.has('KeyM')) setMute(!SET.muted);
  if ($.state === 'play') {
    if (I.pause) {
      openPause();
    } else if ($.G.hitstop > 0) {
      $.G.hitstop--;
      decayFX();
    } else if (stepPerks(I)) {
      // perk pick: the world crawls at 1/5 speed while you choose
      if ($.T % 5 === 0) stepWorld();
    } else stepWorld();
  } else if ($.state === 'over') {
    $.G.overT++;
    stepWorld();
    if ($.G.overT > 70) menuNav(overItems());
  } else if ($.state === 'pause') {
    menuNav(pauseItems());
    if (I.pause && $.state === 'pause') $.state = 'play';
  } else if ($.state === 'title') { if (!$.gate) menuNav(titleItems()); }else if ($.state === 'shop') stepShop();
  if ($.G) {
    const k = Math.min(9, $.G.shake);
    // render-only offsets (screens.ts, hype.ts translate by them), so srnd: shake is set by fx and by render's ship-sprout
    // fx, and a sim-stream draw here happened only when render had shaken the screen (LS1-B1fix)
    $.G.shx = k > .3 ? Math.round((srnd() * 2 - 1) * k) : 0;
    $.G.shy = k > .3 ? Math.round((srnd() * 2 - 1) * k * .7) : 0;
  }
  PR.clear();
}

// ---------------- menus ----------------
