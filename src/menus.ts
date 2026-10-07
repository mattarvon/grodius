// @ts-nocheck
import { $ } from './state';
import { SET, UPG, lv, save } from './save';
import { auInit, sample, setMute, sfx } from './audio';
import { I } from './input';
import { newGame, openShop, shopNext, startLoop } from './flow';
import { RIG, RIG_BY, SOCKET_COST, rigInit, rigged, sockets } from './contraptions';

// ---------------- menus ----------------
export function titleItems() {
  return [{
    l: 'DESCEND',
    a: () => {
      newGame();
    }
  }, ...(lv('deep') ? [{
    l: 'DESCEND DEEPER',
    r: 'DESCENT 2',
    a: () => newGame(1)
  }] : []), {
    l: 'INFIRMARY',
    r: fmtBio($.meta.bio),
    a: () => openShop('title')
  }, {
    l: 'HELL FLASHES',
    r: SET.flashes ? 'ON' : 'OFF',
    a: () => {
      SET.flashes = !SET.flashes;
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
  }];
}
export function overItems() {
  return [{
    l: 'DESCEND AGAIN',
    a: () => newGame()
  }, {
    l: 'INFIRMARY',
    r: fmtBio($.meta.bio),
    a: () => openShop('title')
  }, {
    l: 'SURFACE',
    a: () => {
      $.state = 'title';
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
    l: 'ABANDON SHIP',
    a: () => {
      if ($.G.score > $.hi) $.hi = $.G.score;
      save();
      $.state = 'title';
      $.menuSel = 0;
    }
  }];
}
// title screen: every cursor move is a short pfft, every selection a full fart (src/sfx/fart_nav, fart_ok)
export const menuBlip = (ok) => {
  // starting a run (DESCEND / DESCEND DEEPER) gets Lesley's "yeah baby" instead of the select fart
  if ($.state === 'title' && ok && /^DESCEND/.test((titleItems()[$.menuSel] || {}).l || '') && sample('startgame', { vol: 1.15, spread: .02, wet: .14 })) return;
  if ($.state === 'title' && sample(ok ? 'fart_ok' : 'fart_nav', { vol: ok ? .9 : .7, spread: .08, wet: .1 })) return;
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
  if (I.ok) {
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
    msg(free ? r.name + ' GRAFTED. THIS ONE WAS FREE.' : r.name + ' GRAFTED', '#ffd0a0');
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
  if (u.id === 'hull' && $.G && shopNext === 'loop') $.G.lives++;
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
    $.menuSel = 0;
  }
}
export function stepShop() {
  if ($.shopMsg && --$.shopMsg.t <= 0) $.shopMsg = null;
  const px = $.shopPX || 0;
  $.shopPX = I.x;
  if ($.shopLock > 0) {
    $.shopLock--;
    return;
  }
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
  else if (I.back) leaveShop();
}
export function menuPointer(x, y) {
  if ($.state === 'shop' && $.shopLock > 0) return;
  if ($.state === 'over' && $.G.overT <= 70) return;
  for (const b of $.menuBoxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
    if (b.now) {
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
    return;
  }
}
export const fmtBio = n => Math.floor(n) + ' BIO';
export const pad = (n, l) => String(Math.floor(n)).padStart(l, '0');

// =====================================================================
//  RENDERING
// =====================================================================
