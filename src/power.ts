// @ts-nocheck
// =====================================================================
//  ONE POWER BUDGET (design/progression.md, decisions D1/D2 in production/decision-log.md).
//  G.pow = powerBudget(): every source of player power, weighted by ONE table, divided by POWER.div.
//  Difficulty reads G.pow (and G.rank = clamp(pow, 0, 1)) ONLY as enemy fire and density: every(), BS(), formation()
//  in src/enemies/spawn.ts and the boss/midboss cooldowns. Enemy HP never reads it (src/depth.ts) - the Gravity Drive
//  is the one documented exception (driveMul() in src/depth.ts).
//  Weights are in "raw" units where one gun level = 1. Rule of thumb: a source's weight is its share of a gun level's
//  killing power; defence/utility perks count a little (they still let you play faster and riskier), economy perks
//  the least. Measured with tools/playtest.mjs (seeds 11 and 7: end-of-Descent-1 pow before/after) and
//  tools/boss-probe.mjs / tools/depth-probe.mjs (their kits only carry perks the old table already weighted).
// =====================================================================
import { $ } from './state';

export const POWER = {
  // raw budget per 1.0 pow. Was 14 when only guns, grafts and 8 perks counted; the extra 16 perks put a real Descent 1
  // build ~10% higher (playtest seeds 11/7, end of D1: raw 12.8 -> 14.1 and 11.0 -> 12.0), so 15.4 keeps those builds at
  // the pow they had (.914 / .786) and rank still caps around the end of Descent 1 (docs/pacing.md 3.9)
  div: 15.4,
  ship: {
    speed: .5, //    THRUST levels: mobility, not damage
    gun: 1, //       SPLIT or ARC (the main gun's form): the unit
    missile: 1, pyre: 1, options: 1, //  each level is roughly another gun's worth of fire
    ward: 1, //      WARD levels: survivability buys aggression
    graft: .7, //    every kill-count graft level (src/mutations.ts GM), gun and utility alike
  },
  // every perk in src/perks.ts PERKS, per level (tests/unit/power.test.ts fails if one is missing)
  perk: {
    dmg: .6, rof: .6, // +10% damage / +8-21% fire rate on every gun
    crit: .4, pierce: .4, volatile: .4, teeth: .4, trail: .4, // damage multipliers and on-kill / orbit damage
    glass: 1.2, //  +35% damage in one pick
    reload: .4, //  MISSILE and PYRE fire faster
    shard: .3, //   rib shards when a WARD hit breaks
    frost: .4, //   crowd control: frozen meat is easy meat
    corrode: .5, ignite: .5, // damage over time on every hit
    snot: .5, //    a piercing glob every 2.5-4 s (scales with the gun since M2)
    scab: .3, gasp: .3, // survivability: WARD regrowth, one stun instead of a death per stage
    inv: .2, tiny: .2, spd: .2, // softer survivability: i-frames, hitbox, speed
    life: .2, //    +1 ship
    graze: .1, tape: .1, // XP accelerators: power arrives sooner, they aren't power themselves
    magnet: .1, greed: .1, // pickup range / biomass: economy, counted so that every perk counts
  },
  // every contraption in src/contraptions.ts RIG, per bolted level; ~.5 matches the old DEPTH.rig (.035 pow per level)
  rig: {
    saw: .5, //      ram damage on the prow
    gut: .6, //      the heaviest single hit (12-24 per slug)
    spine: .6, //    homing volleys
    hook: .5, //     harpoon damage plus pod reel-in
    furnace: .4, //  speed plus a slag trail
    choir: .4, //    bullet wipe at a 10-chain
    leech: .3, //    WARD regrowth: survivability only
  },
};

/** bolted contraption levels the player actually carries: meta.rig, limited to the sockets owned (as rigged() does) */
export function rigPower() {
  const m = $.meta;
  if (!m || !m.rig) return 0;
  const n = 1 + ((m.lv && m.lv.socket) || 0);
  let s = 0, used = 0;
  for (let i = 0; i < m.rig.length && used < n; i++) {
    const w = POWER.rig[m.rig[i]];
    if (w == null) continue;
    used++;
    s += w * ((m.cl && m.cl[m.rig[i]]) || 1);
  }
  return s;
}

/** raw power budget (before POWER.div) from the ship, grafts, perks and bolted contraptions */
export function powerRaw() {
  const P = $.P, G = $.G, w = POWER.ship;
  let s = 0;
  if (P) s += P.speed * w.speed + (P.double || P.laser ? w.gun : 0) + P.missile * w.missile + P.pyre * w.pyre + P.options * w.options + (P.wardLv || 0) * w.ward;
  if (G && G.gm) for (const k in G.gm) s += G.gm[k] * w.graft;
  if (G && G.pk) for (const k in G.pk) s += G.pk[k] * (POWER.perk[k] || 0);
  return s + rigPower();
}

/** G.pow: the one power number difficulty reads (uncapped; every()/BS()/formation() cap it at 2) */
export const powerBudget = () => powerRaw() / POWER.div;
