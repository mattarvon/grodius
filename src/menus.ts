// @ts-nocheck
import { $ } from './state';
import { SET, UPG, lv, save } from './save';
import { auInit, sample, setMute, sfx } from './audio';
import { I } from './input';
import { newGame, openShop, shopNext, startLoop } from './flow';

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
const menuBlip = (ok) => {
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
export function shopItems() {
  return [...UPG.map(u => ({
    u
  })), {
    back: 1
  }];
}
export function buy(u) {
  const l = lv(u.id);
  if (l >= u.max) {
    sfx.deny();
    return;
  }
  const c = u.cost[l];
  if ($.meta.bio < c) {
    sfx.deny();
    return;
  }
  $.meta.bio -= c;
  $.meta.lv[u.id] = l + 1;
  if (u.id === 'hull' && $.G && shopNext === 'loop') $.G.lives++;
  save();
  sfx.power();
}
export function leaveShop() {
  save();
  if (shopNext === 'loop') startLoop($.G.loop + 1);else {
    $.state = 'title';
    $.menuSel = 0;
  }
}
export function stepShop() {
  if ($.shopLock > 0) {
    $.shopLock--;
    return;
  }
  const it = shopItems();
  if (I.up) {
    $.menuSel = ($.menuSel + it.length - 1) % it.length;
    sfx.menu();
  }
  if (I.down) {
    $.menuSel = ($.menuSel + 1) % it.length;
    sfx.menu();
  }
  if (I.ok) {
    const x = it[$.menuSel];
    if (x.back) leaveShop();else buy(x.u);
  } else if (I.back) leaveShop();
}
export function menuPointer(x, y) {
  if ($.state === 'shop' && $.shopLock > 0) return;
  if ($.state === 'over' && $.G.overT <= 70) return;
  for (const b of $.menuBoxes) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
    if ($.menuSel === b.i || $.state === 'title' || $.state === 'pause' || $.state === 'over') {
      $.menuSel = b.i;
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
