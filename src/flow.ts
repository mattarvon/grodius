// @ts-nocheck
import { $ } from './state';
import { PH, R, clamp, dist2, pick, ri, rr, swapRm } from './core';
import { lv, save } from './save';
import { applyRun } from './runsave';
import { sfx } from './audio';
import { buzz } from './platform';
import { ALL, buildTerrain, ceilAt, eshots, floorAt } from './world';
import { drop, flash, gore, spark, splat } from './fx/spawn';
import './enemies/spawn'; // kept where the old buildScript import was: the boot-time module order stays as it was
import { startStage } from './stages';
import { biomeReset } from './biomes';
import { perksReset } from './perks';
import { caps } from './world';
import { resetContraptions, rigFresh } from './contraptions';
import { shipShed } from './shipform';
import { nSlots } from './layout';
import { newRunSeed } from './rng';
import { setLayout, layout } from './layout';
import { clearRun, decodeRunAs, lastRun } from './runsave';
import { stageBanner } from './stages';
import { CP, cp1X, writeCp } from './checkpoint';
import { rebuildAt } from './stagebuild';
import { cpTrigger } from './lab';

// ---------------- game flow ----------------
export const LOG_START = ['CHARON-7 // RESCUE TUG // NEPTUNE ORBIT', 'TARGET: THE MERIDIAN. LOST 7 YEARS. BACK 9 DAYS.', 'ITS GRAVITY DRIVE IS STILL RUNNING.'];
/** a fresh run's G before the run seed (newGame adds it; a resume restores the stored one) */
const baseG = () => ({
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
  });
export function newGame(startL = 0) {
  clearRun(); // a new game drops the old checkpoint (spec §4); this run's CP0 replaces it at its first safe step
  resumedFrom = null;
  $.P = null;
  $.G = {
    ...baseG(),
    seed: newRunSeed(R) // the run seed (B2): every stage build draws from a stream hashed from it (src/rng.ts); kept in the run save
  };
  perksReset();
  startLoop(startL);
}
/** the layout that was active before RESUME switched to the checkpoint's (menus.ts restores it at the next DESCEND) */
export let resumedFrom = null;
/** the last checkpoint, decoded under its own layout, which is left ACTIVE (a resume flies it), or null */
function lastCp() {
  const s = lastRun();
  const d = s && decodeRunAs(s, true);
  return d && typeof d.g.seed === 'number' && typeof d.g.cpX === 'number' && typeof d.g.layout === 'string' && (d.g.cpN === 0 || d.g.cpN === 1) ? d : null;
}
/** RESUME on the title: rebuild the run at its last checkpoint. False (and the slot dropped) if it isn't resumable */
export function resumeLast() {
  const prev = layout().id, d = lastCp();
  if (!d) { setLayout(prev); clearRun(); return false; }
  if (resumedFrom == null) resumedFrom = prev;
  resumeRun(d);
  return true;
}
/** rebuild the run from a decoded checkpoint whose layout is active (spec §4 "How it restores"): a fresh G and ship,
 *  the stored fields over them, the terrain and this stage's script rebuilt from the stored seed, loop, route,
 *  visitNo, remixV and bx (stagebuild.ts rebuildAt), entries up to cpX skipped, and the scroll CP.lead before cpX.
 *  Live enemies, shots, pods, timers and spawn-time rolls are not reproduced. Draws no sim R() */
export function resumeRun(d) {
  $.P = null;
  $.G = baseG();
  perksReset();
  biomeReset(); // before applyRun: it resets G.bx
  resetPlayer(false); // before applyRun, or the stored loadout has no ship to land on (H entry criterion 3)
  applyRun(d);
  const G = $.G, P = $.P;
  G.pend = [];
  G.warn = [];
  G.scrollSpeed = 1;
  G.bossStarted = false;
  G.boss = null;
  G.clearT = 0;
  G.t = 0;
  G.st = { kills: 0, spawned: 0, hits: 0, deaths: 0, chain: 0, ...(G.st || {}), t0: -(G.stT || 0) }; // the stage clock as it stood
  G.logQ = [];
  G.tally = null;
  G.fork = null;
  G.forkHold = false;
  G.sealQ = null;
  for (const a of ALL) a.length = 0;
  resetContraptions();
  rebuildAt(G.cpX);
  G.scroll = Math.max(0, G.cpX - CP.lead);
  // the next checkpoint of this stage: CP1 after a CP0, none after a CP1. CP0 is never re-written from here: its
  // cpX would move back by the lead-in on every resume
  G.cp1X = G.cpN === 0 ? cp1X(G.stage, G) : null;
  G.cpWant = G.cp1X != null ? 1 : 2;
  const wx = P.x + G.scroll;
  P.y = clamp((floorAt(wx) + ceilAt(wx)) / 2, 30, PH - 30);
  P.inv = CP.inv;
  stageBanner(G.stage);
  $.state = 'play';
}
export function startLoop(L) {
  $.G.loop = L;
  $.G.pend = [];
  $.G.warn = [];
  $.G.scroll = 0;
  $.G.scrollSpeed = 1;
  $.G.si = 0;
  $.G.script = []; // each stage is built on entry (stagebuild.ts): stage 0 by startStage(0) below
  $.G.bossStarted = false;
  $.G.boss = null;
  $.G.clearT = 0;
  $.G.t = 0;
  buildTerrain(L);
  for (const a of ALL) a.length = 0;
  resetContraptions();
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
  $.G.route = Array(nSlots()).fill(null); // the biome picked at each fork, by slot
  $.G.fork = null;
  $.G.forkHold = false;
  if ($.G.sealQ) { $.G.sealQ(); $.G.sealQ = null; } // a seal earned right before a fork is never lost
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
    bank: 0,
    rig: rigFresh()
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
/** dying in a boss fight leaves you a lifeline: your main gun, MISSILE/PYRE and one WRAITH come back as FULL pods
  on respawn (Gradius-style recovery; nothing else drops mid-fight). BLACK BOX already returns everything, so it skips this. */
function bossRecoveryNote() {
  const G = $.G, P = $.P;
  if (lv('salvage') || !(G.bossStarted || G.mini)) return;
  const ty = [];
  if (P.laser) ty.push(3); else if (P.double) ty.push(2);
  if (P.missile) ty.push(1); else if (P.pyre) ty.push(4);
  if (P.options) ty.push(5);
  if (P.wardLv) ty.push(6);
  G.recover = ty.slice(0, 3);
}
export function killPlayer() {
  if (!$.P.alive) return;
  $.P.alive = false;
  $.G.deadT = 150;
  buzz('death');
  if ($.G.st) $.G.st.deaths++;
  blackBox();
  bossRecoveryNote();
  shipShed($.P.x, $.P.y);
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
  $.G.cur = -1; // classic: the power cursor resets when you die
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
  if (cpTrigger() === 'b' && deathRestart()) return;
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
  if ($.G.recover && $.G.recover.length && ($.G.bossStarted || $.G.mini)) {
    $.G.recover.forEach((t, k) => caps.push({ x: $.P.x + 60 + k * 26, y: clamp($.P.y + (k - 1) * 22, 24, PH - 24), t: k * 8, blue: false, ty: t, full: 1, salv: 1 }));
    $.G.feed = { s: 'SALVAGE', d: 'your guns came back as FULL pods: fly through them', t: 170, ml: 170 };
  }
  $.G.recover = null;
}
/** checkpoint option b (spec §4; LAB CHECKPOINT: ON DEATH): a death restarts the run at its last checkpoint with one
 *  life spent; the stage's deaths still count against its grade. The checkpoint is re-written with the life gone, so
 *  an app kill can't give it back. False when there is no checkpoint (respawn in place, as option a) */
function deathRestart() {
  const G0 = $.G, lives = G0.lives - 1, deaths = G0.st ? G0.st.deaths : 0, d = lastCp();
  if (!d || d.g.loop !== G0.loop || d.g.stage !== G0.stage) return false; // only this stage's checkpoint
  resumeRun(d);
  $.G.lives = lives;
  $.G.st.deaths = Math.max($.G.st.deaths || 0, deaths);
  writeCp($.G.cpN, $.G.cpX);
  return true;
}
export function gameOver() {
  clearRun(); // spec §4: game over clears the checkpoint
  $.state = 'over';
  $.G.overT = 0;
  $.menuSel = 0;
  $.G.newHi = $.G.score > $.hi && $.G.score > 0;
  if ($.G.score > $.hi) $.hi = $.G.score;
  save();
  if ($.G.newHi) setTimeout(() => sfx.hype(), 900);
}
export function endLoop() {
  clearRun(); // spec §4: cleared at descent end; the next descent's CP0 writes a new one
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
