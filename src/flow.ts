// @ts-nocheck
import { $ } from './state';
import { PH, clamp, dist2, pick, ri, rr, swapRm } from './core';
import { lv, save } from './save';
import { sfx } from './audio';
import { buzz } from './platform';
import { ALL, buildTerrain, ceilAt, eshots, floorAt } from './world';
import { drop, flash, gore, spark, splat } from './fx/spawn';
import { buildScript } from './enemies/spawn';
import { startStage } from './stages';
import { biomeReset } from './biomes';
import { perksReset } from './perks';
import { caps } from './world';

// ---------------- game flow ----------------
export const LOG_START = ['CHARON-7 // RESCUE TUG // NEPTUNE ORBIT', 'TARGET: THE MERIDIAN. LOST 7 YEARS. BACK 9 DAYS.', 'ITS GRAVITY DRIVE IS STILL RUNNING.'];
export function newGame(startL = 0) {
  $.P = null;
  $.G = {
    score: 0,
    loop: 0,
    lives: 2 + lv('hull'),
    bio: 0,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    meter: -1,
    kills: 0,
    shake: 0,
    hitstop: 0,
    white: 0,
    red: 0,
    hell: 0,
    glitch: 0,
    deadT: 0,
    clearT: 0,
    overT: 0,
    banner: null,
    logQ: [],
    log: null,
    boss: null,
    flick: 0,
    t: 0,
    cMile: 0,
    gm: {},
    kk: {},
    gmk: 0,
    pend: [],
    warn: [],
    feed: null
  };
  perksReset();
  startLoop(startL);
}
export function startLoop(L) {
  $.G.loop = L;
  $.G.pend = [];
  $.G.warn = [];
  $.G.scroll = 0;
  $.G.scrollSpeed = 1;
  $.G.si = 0;
  $.G.script = buildScript(L);
  $.G.bossStarted = false;
  $.G.boss = null;
  $.G.clearT = 0;
  $.G.t = 0;
  buildTerrain(L);
  for (const a of ALL) a.length = 0;
  if (!$.P) resetPlayer(false);else {
    if (!$.P.alive) resetPlayer(true);
    $.P.x = 50;
    $.P.y = PH / 2;
    $.P.inv = 150;
    $.P.hist.length = 0;
    $.P.alive = true;
  }
  $.G.logQ = L === 0 ? [...LOG_START] : [`THE GATE OPENED AGAIN. DESCENT ${L + 1}.`, 'IT REMEMBERS YOU.'];
  $.G.tally = null;
  $.G.route = [null, null];
  $.G.fork = null;
  $.G.forkHold = false;
  biomeReset();
  startStage(0);
  $.state = 'play';
}
export function resetPlayer(keepGuns) {
  const old = $.P;
  $.P = {
    x: 50,
    y: PH / 2,
    // death keeps half your THRUST (rounded down); everything else is gone
    speed: keepGuns && old ? Math.floor(old.speed / 2) : 0,
    missile: 0,
    double: 0,
    laser: 0,
    pyre: 0,
    pcd: 0,
    frag: [],
    options: 0,
    shield: 0,
    wardLv: 0,
    aegis: 0,
    inv: 160,
    cd: 0,
    mcd: 0,
    hist: [],
    alive: true,
    bank: 0
  };
}
/** BLACK BOX: on death your guns burst out as pods (full level each); fly through them to take them back */
function blackBox() {
  if (!lv('salvage')) return;
  const P = $.P, ty = [];
  if (P.double) ty.push(2);
  if (P.laser) ty.push(3);
  for (let i = 0; i < P.missile; i++) ty.push(1);
  for (let i = 0; i < (P.pyre || 0); i++) ty.push(4);
  for (let i = 0; i < Math.min(2, P.options); i++) ty.push(5);
  ty.forEach((t, k) => caps.push({ x: clamp(P.x + 40 + k * 22, 30, 430), y: clamp(P.y + (k % 2 ? 18 : -18), 30, PH - 30), t: k * 10, blue: false, ty: t, full: 1, salv: 1 }));
}
export function killPlayer() {
  if (!$.P.alive) return;
  $.P.alive = false;
  $.G.deadT = 150;
  buzz('death');
  if ($.G.st) $.G.st.deaths++;
  blackBox();
  gore($.P.x, $.P.y, 1.8, {
    metal: 9,
    rope: 2,
    eyes: 1,
    teeth: 2
  });
  flash($.P.x, $.P.y, 80, 20, '255,140,60');
  for (let i = 0; i < 30; i++) spark($.P.x, $.P.y, rr(-4, 4), rr(-4, 4), ri(10, 30), pick(['#ffb347', '#ff6a1a', '#ffe2a0']));
  $.G.red = 1;
  $.G.shake = 14;
  $.G.hitstop = 10;
  $.G.glitch = 14;
  $.G.combo = 0;
  $.G.comboT = 0;
  $.G.cMile = 0;
  $.G.meter = -1;
  {
    let w = 0;
    for (const k in $.G.gm) if ($.G.gm[k] > 0) {
      $.G.gm[k]--;
      w = 1;
    }
    if (w) $.G.feed = {
      s: 'YOUR GRAFTS WITHER',
      d: 'every mutation lost a level',
      t: 170,
      ml: 170
    };
  }
  splat(rr(120, 360), rr(60, 180), 3);
  sfx.die();
}
export function respawn() {
  if ($.G.lives <= 0) {
    gameOver();
    return;
  }
  $.G.lives--;
  resetPlayer(true);
  const wx = $.P.x + $.G.scroll;
  $.P.y = clamp((floorAt(wx) + ceilAt(wx)) / 2, 30, PH - 30);
  for (let i = eshots.length - 1; i >= 0; i--) {
    const q = eshots[i];
    if (dist2(q.x, q.y, $.P.x, $.P.y) < 110 * 110) {
      for (let k = 0; k < 3; k++) drop(q.x, q.y, rr(-1, 1), rr(-1, 1), 1.4, 0, 90);
      swapRm(eshots, i);
    }
  }
  flash($.P.x, $.P.y, 50, 16, '255,60,40');
  sfx.shield();
}
export function gameOver() {
  $.state = 'over';
  $.G.overT = 0;
  $.menuSel = 0;
  $.G.newHi = $.G.score > $.hi && $.G.score > 0;
  if ($.G.score > $.hi) $.hi = $.G.score;
  save();
  if ($.G.newHi) setTimeout(() => sfx.hype(), 900);
}
export function endLoop() {
  const bonus = ($.G.lives + 1) * 5000 * ($.G.loop + 1);
  $.G.score += bonus;
  if ($.G.score > $.hi) $.hi = $.G.score;
  save();
  openShop('loop');
}
$.shopLock = 0;
export function openShop(next) {
  $.state = 'shop';
  shopNext = next;
  $.menuSel = 0;
  $.shopLock = 40;
  sfx.menu();
}
export function openPause() {
  $.state = 'pause';
  $.menuSel = 0;
}
export let shopNext = 'title';

// ---------------- enemies ----------------
