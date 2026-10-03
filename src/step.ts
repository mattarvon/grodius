// @ts-nocheck
import { $ } from './state';
import { R, clamp, swapRm } from './core';
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
import { menuNav, overItems, pauseItems, stepShop, titleItems } from './menus';

// ---------------- main step ----------------
export function stepWorld() {
  $.G.t++;
  {
    const pw = $.P ? $.P.speed * .5 + ($.P.double || $.P.laser ? 1 : 0) + $.P.missile + $.P.pyre + $.P.options + ($.P.wardLv || 0) + Object.values($.G.gm || {}).reduce((a, b) => a + b, 0) * .7 : 0;
    $.G.rank = clamp(pw / 14, 0, 1);
  }
  if ($.G.mini && $.G.mini.dead) $.G.mini = null;
  const tgt = $.G.bossStarted || $.G.mini ? 0 : 1;
  $.G.scrollSpeed += (tgt - $.G.scrollSpeed) * .02;
  if (tgt === 0 && $.G.scrollSpeed < .02) $.G.scrollSpeed = 0;
  $.G.scroll += $.G.scrollSpeed;
  if ($.state === 'play') {
    runScript();
    updatePlayer();
  }
  updateShots();
  updateEnemies();
  updateBoss();
  updateEShots();
  updateCaps();
  updateFX();
  updateCombo();
  updateAmbient();
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
  pollInput();
  if (PR.has('KeyM')) setMute(!SET.muted);
  if ($.state === 'play') {
    if (I.pause) {
      openPause();
    } else if ($.G.hitstop > 0) {
      $.G.hitstop--;
      decayFX();
    } else stepWorld();
  } else if ($.state === 'over') {
    $.G.overT++;
    stepWorld();
    if ($.G.overT > 70) menuNav(overItems());
  } else if ($.state === 'pause') {
    menuNav(pauseItems());
    if (I.pause && $.state === 'pause') $.state = 'play';
  } else if ($.state === 'title') menuNav(titleItems());else if ($.state === 'shop') stepShop();
  if ($.G) {
    const k = Math.min(9, $.G.shake);
    $.G.shx = k > .3 ? Math.round((R() * 2 - 1) * k) : 0;
    $.G.shy = k > .3 ? Math.round((R() * 2 - 1) * k * .7) : 0;
  }
  PR.clear();
}

// ---------------- menus ----------------
