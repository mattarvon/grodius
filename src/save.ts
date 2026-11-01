// @ts-nocheck
import { $ } from './state';
import { migrateBest } from './gradekey';

// ---------------- persistence ----------------
export const SET = {
  flashes: true,
  asked: false, // the first-launch HELL FLASHES question has been answered
  muted: false,
  music: true,
  meter: false // POWER: false = typed pods (grab to pick), true = classic Gradius meter (capsules move a cursor, POWER buys)
};
$.hi = 0;
$.meta = {
  bio: 0,
  lv: {},
  best: {},
  rig: [],
  own: [],
  cl: {},
  mb: {}, // midbosses met: {kind: timesMet} (spec §6.3 weighting, §6.4 first-kill pay); written by item F
  v: 3
};
const KEY = 'grodius.v1', BAK = 'grodius.v1.bak', BAD = 'grodius.v1.corrupt';
// a save that exists but won't parse is kept aside (BAD) before anything is written over it
let unreadable = null;
function readSave() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
  for (const k of [KEY, BAK]) {
    try {
      const s = k === KEY ? raw : localStorage.getItem(BAK);
      const d = s && JSON.parse(s);
      if (d && typeof d === 'object') return d;
    } catch (e) {}
  }
  if (raw) unreadable = raw;
  return null;
}
try {
  const d = readSave();
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
    // v3 (D19 LS1): best grades keyed by stage kind (gradekey.ts) and meta.mb. A v3 save is never re-migrated.
    if ($.meta.v < 3) {
      $.meta.best = migrateBest($.meta.best);
      $.meta.v = 3;
    }
    {
      const mb = d.meta && d.meta.mb, ok = mb && typeof mb === 'object' && !Array.isArray(mb) ? mb : {};
      $.meta.mb = {};
      for (const [k, n] of Object.entries(ok)) if (Number.isFinite(+n) && +n > 0) $.meta.mb[k] = Math.floor(+n);
    }
    $.hi = +d.hi || 0;
    SET.flashes = d.flashes !== false;
    SET.asked = !!d.asked;
    SET.muted = !!d.muted;
    SET.music = d.music !== false;
    SET.meter = !!d.meter;
  }
} catch (e) {
  try { unreadable = localStorage.getItem(KEY); } catch (e2) {}
}
const snapshot = () => JSON.stringify({
  meta: $.meta,
  hi: $.hi,
  flashes: SET.flashes,
  asked: SET.asked,
  muted: SET.muted,
  music: SET.music,
  meter: SET.meter
});
export function save() {
  try {
    if (unreadable) { localStorage.setItem(BAD, unreadable); unreadable = null; }
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BAK, prev);
    localStorage.setItem(KEY, snapshot());
  } catch (e) {}
}
/** the whole save as a pasteable code (base64 JSON) */
export const exportSave = () => btoa(unescape(encodeURIComponent(snapshot())));
/** replace the save with a code from exportSave(); false if the code isn't a Grodius save. Reload to apply. */
export function importSave(code) {
  try {
    const s = decodeURIComponent(escape(atob(String(code).trim())));
    const d = JSON.parse(s);
    if (!d || typeof d !== 'object' || !d.meta || typeof d.meta !== 'object') return false;
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BAK, prev);
    localStorage.setItem(KEY, s);
    return true;
  } catch (e) {
    return false;
  }
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
  desc: 'Start a run at Descent 2. Tougher from the first stage.',
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
