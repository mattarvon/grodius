// @ts-nocheck
// Ship XP + perks. Kills (and grazes, with GRAZE NERVES) feed XP; every ship level freezes time to a crawl and
// offers 3 perks, pick 1. Perks belong to the run: they survive death (guns and pods don't).
// Biome perks only show up once you've cleared that biome this run.
import { $ } from './state';
import { R } from './core';
import { sfx } from './audio';
import { buzz } from './platform';

export const PERKS = [
  { id: 'dmg', name: 'SERRATED MARROW', max: 3, w: 10, d: (l) => `+${15 * l}% damage, every gun` },
  { id: 'rof', name: 'TWITCH GLAND', max: 3, w: 10, d: (l) => `+${12 * l}% fire rate` },
  { id: 'spd', name: 'SINEW THRUSTERS', max: 3, w: 8, d: (l) => `+${8 * l}% ship speed, on top of THRUST` },
  { id: 'pierce', name: 'BONE TIPS', max: 2, w: 7, d: (l) => `shots punch through ${l} more enem${l > 1 ? 'ies' : 'y'}` },
  { id: 'crit', name: 'HOLLOW HEART', max: 3, w: 7, d: (l) => `${8 * l}% chance to crit for double` },
  { id: 'volatile', name: 'VOLATILE MEAT', max: 3, w: 7, d: (l) => `kills burst, hurting anything within ${20 + 8 * l}px` },
  { id: 'scab', name: 'SCAB WEAVE', max: 3, w: 6, d: (l) => `${6 * l}% of kills regrow a WARD hit` },
  { id: 'inv', name: 'PAIN SPONGE', max: 2, w: 5, d: (l) => `${50 * l}% longer invulnerability after a hit` },
  { id: 'tiny', name: 'SHRUNKEN CORE', max: 2, w: 5, d: (l) => `hitbox ${20 * l}% smaller` },
  { id: 'graze', name: 'GRAZE NERVES', max: 2, w: 6, d: (l) => `near-misses feed you XP${l > 1 ? ' and score x2' : ''}` },
  { id: 'reload', name: 'MISSILE GLAND', max: 2, w: 6, d: (l) => `MISSILE and PYRE fire ${20 * l}% faster` },
  { id: 'magnet', name: 'AMPOULE MAGNET', max: 2, w: 5, d: () => `pods and biomass crawl toward you` },
  { id: 'greed', name: 'BLOOD MONEY', max: 2, w: 5, d: (l) => `+${30 * l}% biomass` },
  { id: 'life', name: 'SPARE MEAT', max: 1, w: 2, d: () => `+1 ship, right now` },
  // biome perks: unlocked by clearing that biome this run
  { id: 'frost', name: 'FROSTBITE', max: 2, w: 9, req: 'ice', d: (l) => `hits freeze enemies to half speed${l > 1 ? ', longer' : ''}` },
  { id: 'corrode', name: 'CORROSIVE SPIT', max: 2, w: 9, req: 'acid', d: (l) => `hits leave acid that eats ${l > 1 ? 'fast' : 'slowly'}` },
  { id: 'ignite', name: 'IMMOLATION', max: 2, w: 9, req: 'fire', d: (l) => `hits set enemies burning${l > 1 ? ' longer' : ''}` },
  { id: 'snot', name: 'SNOT ROCKET', max: 2, w: 9, req: 'snot', d: (l) => `hawk a piercing glob every ${l > 1 ? 2.5 : 4}s` },
];
const BYID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export const pk = (id) => ($.G && $.G.pk && $.G.pk[id]) || 0;
export const xpNeed = (lvl) => Math.round(14 + lvl * 9 + lvl * lvl * 1.6);

export function perksReset() {
  const G = $.G;
  G.pk = {};
  G.xp = 0;
  G.lvl = 1;
  G.pickQ = 0;
  G.pick = null;
  G.visited = G.visited || [];
}

/** +xp (fractional ok); queues a pick per level gained */
export function gainXP(n) {
  const G = $.G;
  if (!G || G.pk == null) return;
  G.xp += n;
  while (G.xp >= xpNeed(G.lvl)) {
    G.xp -= xpNeed(G.lvl);
    G.lvl++;
    G.pickQ++;
  }
}

function offer() {
  const G = $.G, pool = PERKS.filter((p) => pk(p.id) < p.max && (!p.req || (G.visited || []).includes(p.req)));
  const out = [];
  while (out.length < 3 && pool.length) {
    // biome perks you just unlocked get a boost so the branch choice actually shows up in your build
    const tot = pool.reduce((s, p) => s + p.w, 0);
    let r = R() * tot, k = 0;
    while ((r -= pool[k].w) > 0) k++;
    out.push(pool.splice(k, 1)[0].id);
  }
  return out;
}

/** called every step; returns true while the pick screen owns the frame */
export function stepPerks(I) {
  const G = $.G;
  if (!G || G.pk == null) return false;
  if (!G.pick && G.pickQ > 0 && !G.fork && $.P && $.P.alive && !G.tally) {
    const opts = offer();
    G.pickQ--;
    if (!opts.length) return false;
    G.pick = { opts, sel: 1, t: 0 };
    sfx.power();
    buzz('medium');
  }
  if (!G.pick) return false;
  const p = G.pick;
  p.t++;
  if (p.t > 35) {
    // input lockout so a held / mashed fire button doesn't auto-pick
    if (I.up || I.x < 0 && p.lx >= 0) p.sel = (p.sel + p.opts.length - 1) % p.opts.length;
    if (I.down || I.x > 0 && p.lx <= 0) p.sel = (p.sel + 1) % p.opts.length;
    p.lx = I.x;
    if (I.ok || I.power) take(p.opts[p.sel]);
  }
  return !!G.pick;
}

export function take(id) {
  const G = $.G;
  if (!G.pick) return;
  G.pk[id] = (G.pk[id] || 0) + 1;
  if (id === 'life') G.lives++;
  G.pick = null;
  G.feed = { s: 'MUTATION // ' + BYID[id].name + (G.pk[id] > 1 ? ' ' + ['', 'I', 'II', 'III'][G.pk[id]] : ''), d: BYID[id].d(G.pk[id]), t: 170, ml: 170 };
  sfx.pick();
  setTimeout(() => sfx.power(), 90);
}

export const perkName = (id) => BYID[id].name;
export const perkDesc = (id, l) => BYID[id].d(l);
export const perkReq = (id) => BYID[id].req;
