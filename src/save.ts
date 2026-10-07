// @ts-nocheck
import { $ } from './state';

// ---------------- persistence ----------------
export const SET = {
  flashes: true,
  muted: false,
  music: true
};
$.hi = 0;
$.meta = {
  bio: 0,
  lv: {},
  best: {},
  rig: [],
  own: [],
  cl: {},
  v: 2
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
    $.meta.best = d.meta && d.meta.best || {};
    // contraptions (added after v2): absent on old saves -> empty rig, nothing owned
    {
      const m = d.meta || {}, own = Array.isArray(m.own) ? m.own.filter(x => typeof x === 'string') : [];
      $.meta.own = [...new Set(own)];
      $.meta.rig = (Array.isArray(m.rig) ? [...new Set(m.rig)] : []).filter(x => own.includes(x));
      $.meta.cl = {};
      for (const id of own) $.meta.cl[id] = Math.max(1, Math.min(3, Math.floor(+(m.cl && m.cl[id]) || 1)));
      if ($.meta.lv.socket) $.meta.lv.socket = Math.max(0, Math.min(2, $.meta.lv.socket | 0));
    }
    $.meta.v = d.meta && d.meta.v || 1;
    if ($.meta.v < 2) {
      // v2 removed raw-power upgrades; give the biomass back
      const OLD = { nerve: [90, 260], hollow: [100, 240, 480, 900], skin: [420], wraith: [380, 950], hull: [150, 380, 800] };
      let refund = 0;
      for (const [id, cost] of Object.entries(OLD)) {
        const keep = id === 'hull' ? Math.min(2, $.meta.lv[id] || 0) : 0;
        for (let i = keep; i < ($.meta.lv[id] || 0); i++) refund += cost[i];
        if (id === 'hull') $.meta.lv.hull = keep; else delete $.meta.lv[id];
      }
      if (($.meta.lv.salvage || 0) > 0) refund += 300; // Black Box got cheaper (800 -> 500)
      $.meta.bio += refund;
      $.meta.refund = refund;
      $.meta.v = 2;
    }
    $.hi = +d.hi || 0;
    SET.flashes = d.flashes !== false;
    SET.muted = !!d.muted;
    SET.music = d.music !== false;
  }
} catch (e) {}
export function save() {
  try {
    localStorage.setItem('grodius.v1', JSON.stringify({
      meta: $.meta,
      hi: $.hi,
      flashes: SET.flashes,
      muted: SET.muted,
      music: SET.music
    }));
  } catch (e) {}
}
export const lv = id => $.meta.lv[id] || 0;
// The Infirmary buys options and comfort, not raw power: in-run power has to be earned in-run.
export const UPG = [{
  id: 'hull',
  name: 'REINFORCED HULL',
  desc: 'One more ship per run.',
  max: 2,
  cost: [150, 500]
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
  id: 'salvage',
  name: 'BLACK BOX',
  desc: 'When you die your guns burst out as pods. Fly through them to take them back.',
  max: 1,
  cost: [500]
}, {
  id: 'deep',
  name: 'DESCEND DEEPER',
  desc: 'Unlocks starting a run at Descent 2. Tougher, and every stage pays double.',
  max: 1,
  cost: [600]
}, {
  id: 'sculpt',
  name: 'FLESH SCULPT',
  desc: 'Cosmetic. The ship grows more of itself: spikes, eyes, horns.',
  max: 3,
  cost: [60, 160, 320]
}];

// ---------------- audio ----------------
