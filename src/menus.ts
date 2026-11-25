// @ts-nocheck
import { $ } from './state';
import { goreLite, setGoreMode } from './fx/gorecap';
import { HULL2_REFUND, SET, UPG, exportSave, importSave, lv, save } from './save';
import { auInit, sample, setMute, sfx, voiceStopAll, bankWant } from './audio';
import { I, PR } from './input';
import { jumpRun, newGame, openPause, openShop, resumeLast, resumedFrom, shopNext, startLoop } from './flow';
import { clearRun, runInfo, runSealed, sealRun } from './runsave';
import { LAYOUTS, setLayout } from './layout';
import { bossJump, midJump } from './jump';
import { midRow } from './enemies/mid/roster';
import { RIG, RIG_BY, SOCKET_COST, rigInit, rigged, sockets } from './contraptions';
import { LAYOUT_ID, activeLayout, applyRunLayout, lab, layoutName, midForce, setLab, tierPick, wipMids } from './lab';
import { TIER_NAME } from './tier';
import { ARM_T, backStep, descendTap, exitLive } from './backstep';
import { NATIVE } from './platform';
import { SHIPS, hardOn } from './death';

// ---------------- menus ----------------
let titleSub = null, saveMsg = '';
const sub = (s) => () => { titleSub = s; saveMsg = ''; $.menuSel = 0; };
/** the open title sub-menu ('opt', 'lab') or null; screens.ts draws the BACK button and hides the help under it */
export const titleSubOf = () => titleSub;
// DESCEND confirm (S2 #1): the title row a pointer tap armed, and the $.T it was armed at
let armed = null, armT = 0;
/** the armed DESCEND row or null (screens.ts, tools/back-check.mjs) */
export const armedRow = () => armed;
/** once per step: an arm clears when the selection moves, after ARM_T frames, or off the title */
// the title root's leave arm (backstep.ts EXIT_ARM_T): the $.T a first Android back armed it at, and the selection then
let exitT = null, exitSel = 0;
/** is a second Android back going to leave? (screens.ts draws the prompt; tools/back-check.mjs reads it) */
export const exitArmed = () => exitLive(exitT, $.T);
export function stepArm() {
  if (armed !== null && ($.state !== 'title' || $.menuSel !== armed || $.T - armT > ARM_T)) armed = null;
  // anything else the player does disarms the leave: another screen, a sub-menu, a selection move, any key or pad press
  if (exitT !== null && (!exitLive(exitT, $.T) || $.state !== 'title' || titleSub || $.menuSel !== exitSel || PR.size || I.up || I.down || I.ok || I.back || I.pause || I.power)) exitT = null;
}
function exportItem() {
  const code = exportSave();
  saveMsg = 'SHOWN';
  try { navigator.clipboard.writeText(code).then(() => { saveMsg = 'COPIED'; }, () => {}); } catch (e) {}
  // prompt() shows the code in a selectable field: works where the clipboard API doesn't
  try { window.prompt('YOUR SAVE CODE (KEEP IT SOMEWHERE SAFE)', code); } catch (e) {}
}
function importItem() {
  let code = null;
  try { code = window.prompt('PASTE A SAVE CODE. THIS REPLACES YOUR CURRENT SAVE.'); } catch (e) {}
  if (!code) return;
  if (importSave(code)) { clearRun(); location.reload(); } // the old profile's checkpoint must not be offered under the imported one (LS1 audit, security S3)
  else saveMsg = 'BAD CODE';
}
export function titleItems() {
  if (!SET.asked) return [true, false].map((on) => ({
    l: 'HELL FLASHES ' + (on ? 'ON' : 'OFF'),
    r: on ? 'AS INTENDED' : 'NO FLASHING',
    a: () => {
      SET.flashes = on;
      SET.asked = true;
      save();
      $.menuSel = 0;
    }
  }));
  if (titleSub === 'opt') return optionItems();
  if (titleSub === 'lab') return labItems();
  const ri = runInfo();
  // with a run save, a pointer tap on a DESCEND row only arms it (it would wipe the save); the right column warns
  const cf = !!ri, warn = (i, r) => (armed === i ? { r: 'ENDS SAVED RUN', rc: '#ffd23a' } : { r });
  return [...(ri ? [{
    // item H: the last checkpoint (one slot). First while it exists; the harness and probes clear storage at boot,
    // so DESCEND stays row 0 for them
    l: 'RE-ENTER', // not RESUME: the pause menu's RESUME means carry on from here (Matt, D34)
    r: `STAGE ${ri.loop + 1}-${ri.stage + 1}` + (ri.layout && ri.layout !== activeLayout().id ? ' ' + layoutName(ri.layout) : ''),
    a: () => { liftJumpSeal(); resumeLast(); }
  }] : []), {
    l: 'DESCEND',
    confirm: cf,
    ...warn(ri ? 1 : 0, undefined),
    a: () => {
      startRun();
    }
  }, ...(lv('deep') ? [{
    l: 'DESCEND DEEPER',
    confirm: cf,
    ...warn(ri ? 2 : 1, 'DESCENT 2'),
    a: () => startRun(1)
  }] : []), ...(activeLayout().id === 'long4' ? [diffRow()] : []), {
    l: 'INFIRMARY',
    r: fmtBio($.meta.bio),
    a: () => openShop('title')
  }, {
    l: 'OPTIONS',
    a: sub('opt')
  }, {
    // dev row (LS1 D2): kept last so DESCEND stays row 0 for the harness and the probes. Its right column is the
    // layout a run started now would fly, URL flag included, then the forced midboss when one is set (every run flies it)
    l: 'LAB',
    r: layoutTag() + (midForce() ? ' ' + midLabel(midForce()) : ''),
    a: sub('lab')
  }];
}
/** the title's DIFFICULTY row (DIFFICULTY-SPEC §2.1 Tiers, decision 6A; it replaced D63's BRUTAL): the tier the next long
 *  run flies, the same LAB setting as the LAB's own row, cycled EASY > NORMAL > HARD > VERY HARD. A ?tier= / ?brutal=
 *  over it is shown, as the LAB row shows it. After DESCEND, so DESCEND stays row 0 for the harness and the probes */
function diffRow() {
  const L = lab(), t = tierPick('long4');
  return {
    l: 'DIFFICULTY',
    // ux: what the run will fly; under a URL override the LAB value a press changes is shown too, so a press is never dead
    r: t != null && t !== L.tier ? TIER_NAME[t] + ' (URL) / ' + TIER_NAME[L.tier] : TIER_NAME[L.tier],
    a: () => setLab({ tier: ((L.tier + 1) % 4) as 0 | 1 | 2 | 3 })
  };
}
/** a render-side hook run as DESCEND starts a run, before newGame (render/titledoll.ts armTitleOut sets it: menus.ts stays
 *  free of the DOM, so the unit tests can import it) */
let descendHook: null | (() => void) = null;
export const onDescend = (f: () => void) => { descendHook = f; };
/** start a run on the layout the LAB / URL chose (setLayout contract: before newGame()) */
function startRun(loop?) {
  // render/titledoll.ts: the title's last frame stays up for the doll's snap. Render only, so it may never stop the run:
  // a throw here (a lost canvas context, memory pressure on the Fold) used to leave DESCEND doing nothing
  try { descendHook?.(); } catch (err) { console.warn('descend hook failed; the run starts without the snap', err); }
  liftJumpSeal();
  if (resumedFrom != null) setLayout(resumedFrom); // a RESUME flew the checkpoint's layout: a new run flies the chosen one
  applyRunLayout();
  newGame(loop);
}
/** the run-save seal JUMP TO MID set (a URL jump's seal is never this one: it is for the page's life) */
let jumpSeal = false;
/** a run after a LAB jump stores, re-writes and clears the player's checkpoint again (DESCEND, RE-ENTER) */
function liftJumpSeal() {
  if (jumpSeal) sealRun(false);
  jumpSeal = false;
}
/** a midboss kind's short name for the LAB */
const midLabel = (k) => (midRow(k) || { label: k.toUpperCase() }).label;
/** the active layout's midboss picker: a forced kind only takes slot A where there is one (long4, not short) */
const pickerOn = () => !!(LAYOUTS[activeLayout().id] || {}).picker;
/** JUMP TO MID (D53): the dev URL jump to slot A's WARNING, from the LAB, so the APK can reach a forced fight. A jump
 *  run, like the URL's: the run-save slot is sealed (the player's checkpoint and RE-ENTER are kept), meta pays as usual */
function midJumpRun(make = midJump) {
  if (resumedFrom != null) setLayout(resumedFrom);
  applyRunLayout(); // the jump is built on the layout a run started now would fly
  const j = make();
  if (!j) return;
  liftJumpSeal(); // a second JUMP TO MID in a row: lift this LAB's own seal first, so `was` is only ever a URL jump's
  const was = runSealed();
  sealRun();
  voiceStopAll();
  if (!jumpRun(j)) { if (!was) sealRun(false); return; }
  jumpSeal = !was;
  titleSub = null; // back on the title after the run, not in the LAB
}
/** the active layout for the title: LONG / SHORT, marked URL when a ?layout= flag overrides the LAB */
export function layoutTag() {
  const c = activeLayout();
  return layoutName(c.id) + (c.src === 'url' ? ' (URL)' : '');
}
function labItems() {
  const L = lab(), c = activeLayout();
  return [{
    l: 'LAYOUT',
    // the LAB's own setting; when a URL flag overrides it, say what the run will really fly
    r: L.layout.toUpperCase() + (c.src === 'url' && c.id !== LAYOUT_ID[L.layout] ? ' > URL ' + layoutName(c.id) : ''),
    a: () => setLab({ layout: L.layout === 'long' ? 'short' : 'long' })
  }, {
    l: 'MIDBOSSES',
    r: L.mids === 'wip' ? 'WIP' : 'OFF',
    a: () => setLab({ mids: L.mids === 'wip' ? '' : 'wip' })
  }, {
    l: 'CHECKPOINT',
    // long4: the tier decides (decision 1A: a death restarts at the checkpoint on NORMAL and up, EASY respawns in place)
    r: c.id === 'long4' ? 'BY DIFFICULTY' : L.cp === 'b' ? 'ON DEATH' : 'QUIT ONLY',
    a: () => { if (c.id !== 'long4') setLab({ cp: L.cp === 'b' ? 'a' : 'b' }); } // long4: the tier decides, nothing to toggle
  }, {
    // the difficulty tier (src/tier.ts, DIFFICULTY-SPEC §2.1; it replaced D63's BRUTAL row) for the next long run:
    // EASY / NORMAL / HARD / VERY HARD; a ?tier= (or ?brutal=, read as NORMAL) over it is shown, as ?layout= is
    l: 'DIFFICULTY',
    r: ((t) => TIER_NAME[L.tier] + (c.id !== 'long4' ? ' (LONG ONLY)' : t != null && t !== L.tier ? ' > URL ' + TIER_NAME[t] : ''))(tierPick(c.id)),
    a: () => setLab({ tier: ((L.tier + 1) % 4) as 0 | 1 | 2 | 3 })
  }, ...(wipMids().length > 1 || L.mid ? [{
    // D53: the wip midboss forced into slot A of every biome stage (lab.ts midForce): off, then each wip kind. The
    // LAB's own setting; a ?mid= query over it is shown, as the layout's URL flag is. Picker layouts only. Hidden while
    // the roster has no wip kind (THE KEEPSAKE's row retired, D55): there is nothing to force
    l: 'FORCE MID',
    r: (L.mid ? midLabel(L.mid) : 'OFF') + (midForce() !== (L.mid || null) ? ' > URL ' + midLabel(midForce()) : !pickerOn() && L.mid ? ' (LONG ONLY)' : ''),
    a: () => { const ks = wipMids(); setLab({ mid: ks[(ks.indexOf(L.mid) + 1) % ks.length] }); }
  }] : []), ...(midForce() && pickerOn() ? [{
    // only while a kind is forced: start Descent 1 at the first biome stage, just before slot A's WARNING, mid kit
    l: 'JUMP TO MID',
    r: midLabel(midForce()),
    a: () => midJumpRun()
  }] : []), ...(pickerOn() ? [{
    // D55: Descent 1, the second biome stage, end-of-D1 kit, just before THE KEEPSAKE's WARNING (jump.ts bossJump), so
    // the phone reaches the stage boss without flying there. A jump run like JUMP TO MID: the run-save slot is sealed
    l: 'JUMP TO BOSS',
    r: 'KEEPSAKE',
    a: () => { bankWant('kboss_'); midJumpRun(bossJump); } // its lazy banks start decoding now, before the jump's WARNING (audio only)
  }] : []), {
    l: 'BACK', // the same close as Esc, Android back and the < BACK button: the cursor lands back on LAB
    a: () => doBack('closeSub')
  }];
}
function optionItems() {
  return [{
    l: 'POWER',
    r: SET.meter ? 'METER' : 'PODS',
    a: () => {
      SET.meter = !SET.meter;
      save();
    }
  }, {
    l: 'HELL FLASHES',
    r: SET.flashes ? 'ON' : 'OFF',
    a: () => {
      SET.flashes = !SET.flashes;
      save();
    }
  }, {
    // GORE DENSITY (decision 32, fx/gorecap.ts): AUTO is LITE on a phone (the app, a touch-first screen), FULL elsewhere
    l: 'GORE',
    r: SET.gore === 'auto' ? 'AUTO (' + (goreLite() ? 'LITE' : 'FULL') + ')' : SET.gore === 'lite' ? 'LITE' : 'FULL',
    a: () => {
      SET.gore = SET.gore === 'auto' ? 'full' : SET.gore === 'full' ? 'lite' : 'auto';
      setGoreMode(SET.gore);
      save();
    }
  }, {
    l: 'SOUND',
    r: SET.muted ? 'OFF' : 'ON',
    a: () => setMute(!SET.muted)
  }, {
    l: 'MUSIC',
    r: SET.music ? 'ON' : 'OFF',
    a: () => {
      SET.music = !SET.music;
      save();
    }
  }, {
    l: 'EXPORT SAVE',
    r: saveMsg === 'SHOWN' || saveMsg === 'COPIED' ? saveMsg : '',
    a: exportItem
  }, {
    l: 'IMPORT SAVE',
    r: saveMsg === 'BAD CODE' ? saveMsg : '',
    a: importItem
  }, {
    l: 'BACK', // the same close as Esc, Android back and the < BACK button: the cursor lands back on OPTIONS
    a: () => doBack('closeSub')
  }];
}
export function overItems() {
  return [{
    l: 'DESCEND AGAIN',
    a: () => startRun()
  }, {
    l: 'INFIRMARY',
    r: fmtBio($.meta.bio),
    a: () => openShop('title')
  }, {
    l: 'SURFACE',
    a: () => {
      $.state = 'title';
      voiceStopAll(); // back on the title: no voice line runs on from the game (audio only)
      $.menuSel = 0;
    }
  }];
}
export function pauseItems() {
  return [{
    l: 'RESUME',
    a: () => {
      $.state = 'play';
    }
  }, {
    l: 'POWER',
    r: SET.meter ? 'METER' : 'PODS',
    a: () => {
      SET.meter = !SET.meter;
      save();
    }
  }, {
    l: 'SOUND',
    r: SET.muted ? 'OFF' : 'ON',
    a: () => setMute(!SET.muted)
  }, {
    l: 'MUSIC',
    r: SET.music ? 'ON' : 'OFF',
    a: () => {
      SET.music = !SET.music;
      save();
    }
  }, {
    l: 'SURFACE', // was ABANDON SHIP; since H it keeps the run (RE-ENTER on the title), so it no longer abandons (Matt, D34)
    a: () => {
      if ($.G.score > $.hi) $.hi = $.G.score;
      save();
      $.state = 'title';
      voiceStopAll(); // back on the title: no voice line runs on from the game (audio only)
      $.menuSel = 0;
    }
  }];
}
// title screen: every cursor move is a small wet valve pop (gross_pop), every selection a wet splat (splat_s), both low (tone pass D39: the farts are out)
/** SLAB's GRODIUS (src/sfx/title/): the title's greeting (step.ts). False until the folder has a take, or while muted */
export const titleLine = () => sample('title', { vol: 1.15, spread: .02, wet: .14 });
export const menuBlip = (ok) => {
  // DESCEND / DESCEND DEEPER is a select splat like every other item since 2026-11-24 (Matt: GRODIUS BITCH moved from
  // the start of the run to a late boss-fight death, voice/deathline.ts)
  if ($.state === 'title' && sample(ok ? 'splat_s' : 'gross_pop', { vol: ok ? .5 : .35, spread: .08, wet: .1 })) return;
  sfx.menu();
};
export function menuNav(items) {
  if (I.up) {
    $.menuSel = ($.menuSel + items.length - 1) % items.length;
    menuBlip(false);
  }
  if (I.down) {
    $.menuSel = ($.menuSel + 1) % items.length;
    menuBlip(false);
  }
  if (I.ok) { // keys and pad never need the DESCEND confirm: a deliberate press, not a stray tap
    auInit();
    menuBlip(true);
    items[$.menuSel].a();
  }
}
// ---------------- the Infirmary ----------------
// Rows (all selectable): 7 contraptions, the socket graft, the utility grafts, then leave.
export function shopItems() {
  return [...RIG.map(r => ({ k: 'rig', r })), { k: 'sock' }, ...UPG.map(u => ({ k: 'upg', u })), { k: 'back', back: 1 }];
}
export const shopSec = k => (k === 'rig' ? 0 : k === 'sock' ? 1 : k === 'upg' ? 2 : 3);
const msg = (s, col = '#ffb0b0') => ($.shopMsg = { s, col, t: 150 });
/** save v4 (Decision 3A): the first Infirmary visit after the migration says where a HULL level 2 went, once */
function hullNote() {
  if (($.meta.hullRef === 1 || $.meta.hullRef === 3) && !$.shopMsg) {
    const paid = $.meta.hullRef === 1;
    $.meta.hullRef = 2;
    $.shopMsg = { s: 'HULL REFIT: ITS SHIP JOINS AT DESCENT 2' + (paid ? `, +${HULL2_REFUND} BIOMASS BACK` : ''), col: '#ffd0a0', t: 300 };
    save();
  }
}
export const rigOwned = id => ($.meta.own || []).includes(id);
export const rigBolted = id => rigged().some(q => q.id === id);
/** the first contraption is on the house: nobody should leave their first Infirmary visit empty-handed */
export const rigFree = () => !($.meta.own || []).length;
export const rigCost = r => (rigFree() ? 0 : r.cost);
export const rigUpCost = r => { const l = ($.meta.cl || {})[r.id] || 1; return l >= 3 ? 0 : r.up[l - 1]; };
export const sockCost = () => SOCKET_COST[lv('socket')];
function spend(c) {
  if ($.meta.bio < c) {
    sfx.deny();
    msg('NOT ENOUGH BIOMASS: ' + Math.ceil(c - $.meta.bio) + ' SHORT');
    return false;
  }
  $.meta.bio -= c;
  return true;
}
function bolt(id) {
  rigInit();
  const m = $.meta;
  m.rig = m.rig.filter(x => x !== id).slice(0, sockets());
  if (m.rig.length >= sockets()) {
    sfx.deny();
    msg('SOCKETS FULL. UNBOLT SOMETHING OR GRAFT A SOCKET.');
    return false;
  }
  m.rig.push(id);
  sample('thud', { vol: .7, rate: 1.1 }) || sfx.power();
  msg(RIG_BY[id].name + ' BOLTED ON', '#ffd0a0');
  return true;
}
/** ENTER on a contraption: buy it, else bolt / unbolt it */
export function rigAct(r) {
  rigInit();
  const m = $.meta;
  if (!rigOwned(r.id)) {
    const free = rigFree();
    if (!spend(rigCost(r))) return;
    m.own.push(r.id);
    m.cl[r.id] = 1;
    sfx.power();
    sample('splat_m', { vol: .6 });
    // game-designer: the Descent 1 rule, said where a contraption is bought (long4)
    msg(free ? r.name + ' GRAFTED. THE SHIP ASKS NOTHING. YET.' : r.name + ' GRAFTED' + (hardOn() ? ' // DESCENT 1: FIRST ONLY, LV 1, FROM STAGE 3' : ''), '#ffd0a0');
    if (m.rig.length < sockets()) bolt(r.id);
  } else if (rigBolted(r.id)) {
    m.rig = m.rig.filter(x => x !== r.id);
    sfx.menu();
    msg(r.name + ' UNBOLTED', '#9fb0c2');
  } else bolt(r.id);
  save();
}
/** RIGHT on a contraption: next level */
export function rigUp(r) {
  rigInit();
  if (!rigOwned(r.id)) return rigAct(r);
  const l = $.meta.cl[r.id] || 1;
  if (l >= 3) {
    sfx.deny();
    msg(r.name + ' IS FULLY GROWN', '#9fb0c2');
    return;
  }
  if (!spend(r.up[l - 1])) return;
  $.meta.cl[r.id] = l + 1;
  sfx.power();
  sample('bone', { vol: .6 });
  msg(r.name + ' GROWS TO LEVEL ' + (l + 1), '#ffd0a0');
  save();
}
export function buySocket() {
  const l = lv('socket');
  if (l >= SOCKET_COST.length) {
    sfx.deny();
    msg('THE HULL CAN TAKE NO MORE SOCKETS', '#9fb0c2');
    return;
  }
  if (!spend(SOCKET_COST[l])) return;
  $.meta.lv.socket = l + 1;
  sfx.power();
  sample('splat_l', { vol: .5 });
  msg('NEW SOCKET CUT INTO THE HULL', '#ffd0a0');
  save();
}
export function buy(u) {
  const l = lv(u.id);
  if (l >= u.max) {
    sfx.deny();
    return;
  }
  const c = u.cost[l];
  if (!spend(c)) return;
  $.meta.lv[u.id] = l + 1;
  // the loop shop: the ship is aboard for the next descent. On long4 the Descent 2 gate's startLoop adds HULL itself
  // (Decision 3A), so the shop between Descent 1 and 2 adds nothing here, or that ship would count twice
  if (u.id === 'hull' && $.G && shopNext === 'loop' && !(hardOn() && ($.G.loop | 0) + 1 === SHIPS.hullAt)) $.G.lives++;
  save();
  sfx.power();
}
export function shopAct(x, side = 0) {
  if (x.k === 'back') return leaveShop();
  if (x.k === 'rig') return side > 0 ? rigUp(x.r) : rigAct(x.r);
  if (x.k === 'sock') return buySocket();
  if (side >= 0) buy(x.u);
}
export function leaveShop() {
  save();
  $.shopMsg = null;
  if (shopNext === 'loop') startLoop($.G.loop + 1);else {
    $.state = 'title';
    voiceStopAll(); // back on the title: no voice line runs on from the game (audio only)
    $.menuSel = 0;
  }
}
export function stepShop() {
  if ($.shopMsg && --$.shopMsg.t <= 0) $.shopMsg = null;
  hullNote();
  const px = $.shopPX || 0;
  $.shopPX = I.x;
  // shopLock (40 frames after opening) gates the pointer and OK so a tap in flight can't buy. Back is honoured during it
  // only from Esc / Backspace (hardBack): X and pad B are POWER, and openShop('loop') runs straight from play, so mashing
  // power through a stage clear would otherwise select DESCEND and continue past the Infirmary. Android back skips this
  const locked = $.shopLock > 0;
  if (locked) $.shopLock--;
  if (locked ? I.hardBack : I.back) return keyBack();
  if (locked) return;
  rigInit();
  const it = shopItems();
  if ($.menuSel >= it.length) $.menuSel = 0;
  if (I.up) {
    $.menuSel = ($.menuSel + it.length - 1) % it.length;
    sfx.menu();
  }
  if (I.down) {
    $.menuSel = ($.menuSel + 1) % it.length;
    sfx.menu();
  }
  const x = it[$.menuSel];
  if (I.x > 0 && px <= 0 && x.k === 'rig') rigUp(x.r);
  else if (I.x < 0 && px >= 0 && x.k === 'rig' && rigOwned(x.r.id)) rigAct(x.r);
  if (I.ok) shopAct(x);
}
export function menuPointer(x, y) {
  exitT = null; // a tap is something else: the leave arm drops
  if ($.state === 'shop' && $.shopLock > 0) return;
  if ($.state === 'over' && $.G.overT <= 70) return;
  for (const b of $.menuBoxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
    if (b.confirm && $.state === 'title') {
      // DESCEND with a run save: the first tap arms (nav blip), a second tap on the armed row starts the run
      const d = descendTap(armed, b.i, true);
      $.menuSel = b.i;
      armed = d.armed;
      armT = $.T;
      menuBlip(d.act);
      if (d.act) b.a();
    } else if (b.now) {
      // Infirmary buttons (BUY / BOLT / UPGRADE) act on the first tap
      $.menuSel = b.i;
      b.a();
    } else if ($.menuSel === b.i || $.state === 'title' || $.state === 'pause' || $.state === 'over') {
      $.menuSel = b.i;
      menuBlip(true);
      b.a();
    } else {
      $.menuSel = b.i;
      sfx.menu();
    }
    if (!b.confirm) armed = null; // any other box disarms
    return;
  }
}
// ---------------- back (src/backstep.ts decides, doBack applies) ----------------
/** what a back press sees now. native: only the Capacitor app may exit (main.ts backButton) */
export function backView(native = false) {
  return {
    state: $.state,
    sub: titleSub,
    gate: !!$.gate,
    asked: !!SET.asked,
    shopNext,
    onExitRow: $.state === 'shop' && $.menuSel === shopItems().length - 1,
    overT: $.G ? $.G.overT : 0,
    native,
    exitArmed: exitArmed()
  };
}
/** apply one back action through the existing menu actions ('exit' and 'none' do nothing here; 'armExit' arms the
 *  title root's leave for EXIT_ARM_T frames) */
export function doBack(a) {
  if (a === 'armExit') {
    exitT = $.T;
    exitSel = $.menuSel;
    menuBlip(false); // the title's own sound, like every other title press (audio-director)
  } else if (a === 'closeSub') {
    const from = titleSub === 'opt' ? 'OPTIONS' : 'LAB';
    titleSub = null;
    saveMsg = '';
    $.menuSel = Math.max(0, titleItems().findIndex(x => x.l === from));
    menuBlip(false);
  } else if (a === 'leaveShop') leaveShop();
  else if (a === 'selectExit') {
    $.menuSel = shopItems().length - 1;
    sfx.menu();
    msg('PRESS BACK AGAIN TO DESCEND', '#ffd0a0');
  } else if (a === 'unpause') pauseItems()[0].a(); // RESUME
  else if (a === 'pause') openPause();
  else if (a === 'surface') overItems().find(x => x.l === 'SURFACE').a();
}
/** a back key or pad B in a menu (step.ts, stepShop): the same tree as Android back, minus the exit */
export function keyBack() {
  doBack(backStep(backView(false)));
}
/** the Android hardware back (main.ts): 'exit' only from the title root */
export const nativeBack = () => backStep(backView(NATIVE));
export const fmtBio = n => Math.floor(n) + ' BIO';
export const pad = (n, l) => String(Math.floor(n)).padStart(l, '0');

// =====================================================================
//  RENDERING
// =====================================================================
