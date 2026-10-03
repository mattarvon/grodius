// @ts-nocheck
import { $ } from './state';

// ---------------- persistence ----------------
export const SET = {
  flashes: true,
  muted: false
};
$.hi = 0;
$.meta = {
  bio: 0,
  lv: {}
};
try {
  const d = JSON.parse(localStorage.getItem('grodius.v1') || 'null');
  if (d) {
    $.meta = {
      bio: +(d.meta && d.meta.bio) || 0,
      lv: {
        ...(d.meta && d.meta.lv || {})
      }
    };
    $.hi = +d.hi || 0;
    SET.flashes = d.flashes !== false;
    SET.muted = !!d.muted;
  }
} catch (e) {}
export function save() {
  try {
    localStorage.setItem('grodius.v1', JSON.stringify({
      meta: $.meta,
      hi: $.hi,
      flashes: SET.flashes,
      muted: SET.muted
    }));
  } catch (e) {}
}
export const lv = id => $.meta.lv[id] || 0;
export const UPG = [{
  id: 'hull',
  name: 'REINFORCED HULL',
  desc: 'One more ship per run.',
  max: 3,
  cost: [150, 380, 800]
}, {
  id: 'nerve',
  name: 'NERVE GRAFT',
  desc: 'Start every life with THRUST already stacked.',
  max: 2,
  cost: [90, 260]
}, {
  id: 'hollow',
  name: 'HOLLOW-POINT RIVETS',
  desc: '+10% damage on every gun, wraiths included.',
  max: 4,
  cost: [100, 240, 480, 900]
}, {
  id: 'gland',
  name: 'HARVEST GLAND',
  desc: '+25% biomass squeezed out of every kill.',
  max: 4,
  cost: [80, 200, 400, 750]
}, {
  id: 'lure',
  name: 'AMPOULE LURE',
  desc: 'Power ampoules drift toward you.',
  max: 2,
  cost: [120, 300]
}, {
  id: 'skin',
  name: 'SECOND SKIN',
  desc: 'Every life starts with a WARD field.',
  max: 1,
  cost: [420]
}, {
  id: 'wraith',
  name: 'BOUND WRAITH',
  desc: 'Every life starts with a WRAITH in tow.',
  max: 2,
  cost: [380, 950]
}, {
  id: 'salvage',
  name: 'BLACK BOX',
  desc: 'Keep MISSILE, SPLIT, ARC and PYRE when you die.',
  max: 1,
  cost: [800]
}];

// ---------------- audio ----------------
