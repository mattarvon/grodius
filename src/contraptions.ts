// @ts-nocheck
// Contraptions: permanent ship modules bought in the Infirmary with biomass and bolted into sockets.
// Each one is real gameplay (logic: stepContraptions / hooks below) AND a visible, animated part on the hull
// (drawn by render/ship.ts from rigged()). Sockets start at 1; SOCKET upgrades in the Infirmary add more.
// meta.rig  = ids currently bolted on (persisted).  meta.own = ids bought (persisted).  meta.cl[id] = upgrade level 1..3.
import { $ } from './state';

/** id, name, Infirmary blurb, buy cost, level-up costs (lvl 2, 3). Logic/visual owners key off `id`. */
export const RIG = [
  { id: 'saw', name: 'BONE SAW', desc: 'A buzzsaw of sharpened ribs on the prow. Ram enemies to shred them.', cost: 180, up: [260, 420] },
  { id: 'gut', name: 'GUT CANNON', desc: 'A belly cannon that coughs a piercing slug of bone and offal every few seconds.', cost: 220, up: [300, 480] },
  { id: 'leech', name: 'LEECH PUMP', desc: 'A pumping heart on the spine. Kills fill its vial; a full vial regrows a WARD hit (or grants one).', cost: 260, up: [340, 520] },
  { id: 'spine', name: 'SPINE LAUNCHER', desc: 'Dorsal quill rack. Fires a volley of homing spines at the nearest enemies.', cost: 240, up: [320, 500] },
  { id: 'hook', name: 'MEAT WINCH', desc: 'A chain-and-hook arm that harpoons an enemy, rips it open and reels its pods in.', cost: 200, up: [280, 460] },
  { id: 'furnace', name: 'FURNACE BELLY', desc: 'Stoked exhaust stacks. Faster ship, and a trail of burning slag behind you.', cost: 200, up: [280, 440] },
  { id: 'choir', name: 'CHOIR OF MOUTHS', desc: 'A ring of screaming mouths. At a 10-kill chain they scream and wipe nearby enemy bullets.', cost: 300, up: [380, 560] },
];
export const RIG_BY = Object.fromEntries(RIG.map((r) => [r.id, r]));
/** sockets: 1 base, +1 per Infirmary 'socket' level (max 3 sockets) */
export const SOCKET_COST = [400, 900];

export function rigInit() {
  const m = $.meta;
  m.rig ||= [];
  m.own ||= [];
  m.cl ||= {};
}
export const sockets = () => 1 + (($.meta.lv && $.meta.lv.socket) || 0);
/** contraptions bolted on this run: [{id, lvl}] */
export const rigged = () => ($.meta.rig || []).filter((id) => RIG_BY[id]).slice(0, sockets()).map((id) => ({ id, lvl: ($.meta.cl && $.meta.cl[id]) || 1 }));
export const rigLv = (id) => { const r = rigged().find((q) => q.id === id); return r ? r.lvl : 0; };
