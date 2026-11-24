// @ts-nocheck
// Ship XP + perks. Kills (and grazes, with GRAZE NERVES) feed XP, clearing a stage pays a lump; every ship level
// slows time to a crawl and offers 3 mutations, pick 1. Perks belong to the run: they survive death (guns and pods don't).
// Biome perks only show up once you've cleared that biome this run (and the first offer after a biome includes it).
import { $ } from './state';
import { R, TAU, W, PH, rr } from './core';
import { sfx } from './audio';
import { buzz } from './platform';
import { PR } from './input';
import { enemies } from './world';
import { flash, spark, drop, pop } from './fx/spawn';
import { econId, stageXP as econXP } from './economy';
import { midMul } from './enemies/mid/roster';
import { POWER } from './power';
import { SURV, deathTier, gaspSlot, hardOn, perkCapOf, perkScarPick } from './death';
import { decodeRun, lastRun, storeRun } from './runsave';

/** perk table. d(l): what level l does. c: the price (trade-off perks). req: biome that unlocks it. */
export const PERKS = [
  { id: 'dmg', f: 'the marrow grows teeth', name: 'SERRATED MARROW', max: 3, w: 8, d: (l) => `+${Math.round(100 * marrowB(l))}% damage, every gun` },
  { id: 'rof', f: 'it will not stop shaking', name: 'TWITCH GLAND', max: 3, w: 8, d: (l) => `+${Math.round(100 * twitchB(l))}% fire rate` },
  { id: 'spd', f: 'pulled tight as piano wire', name: 'SINEW THRUSTERS', max: 3, w: 7, d: (l) => `+${8 * l}% ship speed, on top of THRUST` },
  { id: 'pierce', f: 'sharpened on your own ribs', name: 'BONE TIPS', max: 2, w: 7, d: (l) => `shots punch through ${l} more enem${l > 1 ? 'ies' : 'y'}` },
  { id: 'crit', f: 'nothing in there but hunger', name: 'HOLLOW HEART', max: 3, w: 7, d: (l) => `${7 * l}% chance to crit for double (x3 with GLUTTONY)` },
  { id: 'volatile', f: 'they go off like rotten fruit', name: 'VOLATILE MEAT', max: 3, w: 7, d: (l) => `kills burst, hurting meat within ${18 + 8 * l}px` },
  { id: 'scab', f: 'the wound learns', name: 'SCAB WEAVE', max: 3, w: 6, ward: 1, d: (l) => `${Math.round(scabChance() * 100) * l}% of kills regrow a WARD hit` },
  { id: 'inv', f: 'pain arrives late now', name: 'PAIN SPONGE', max: 2, w: 5, d: (l) => `${50 * l}% longer invulnerability after a hit` },
  { id: 'tiny', f: 'less of you to hit', name: 'SHRUNKEN CORE', max: 2, w: 5, d: (l) => `hitbox ${20 * l}% smaller` },
  { id: 'graze', f: 'it brushed you. it learned your shape.', name: 'GRAZE NERVES', max: 2, w: 6, d: (l) => `near-misses feed you XP${l > 1 ? ', double score' : ''}` },
  { id: 'reload', f: 'a second throat for the missiles', name: 'MISSILE GLAND', max: 2, w: 5, d: (l) => `MISSILE and PYRE fire ${20 * l}% faster` },
  { id: 'magnet', f: 'the ampoules know your name', name: 'AMPOULE MAGNET', max: 2, w: 4, d: (l) => `pods and biomass crawl to you${l > 1 ? ' from far off' : ''}` },
  { id: 'greed', f: 'the ship gets paid in meat', name: 'BLOOD MONEY', max: 2, w: 4, d: (l) => `+${30 * l}% biomass` },
  { id: 'life', f: 'grown in the dark, from spares', name: 'SPARE MEAT', max: 1, w: 2, d: () => `+1 ship, right now` },
  // build-definers
  { id: 'teeth', f: 'they were yours, once', name: 'ORBITING TEETH', max: 2, w: 6, d: (l) => `${l > 1 ? 'two teeth circle' : 'a tooth circles'} the ship, chewing what it touches` },
  { id: 'trail', f: 'leave the lights on behind you', name: 'BLOOD TRAIL', max: 2, w: 5, d: (l) => `kills leave a slick that eats meat flying through${l > 1 ? ', bigger and longer' : ''}` },
  { id: 'shard', f: 'break, then bite', name: 'SHRAPNEL RIBS', max: 2, w: 5, ward: 1, d: (l) => `a broken WARD hit bursts into ${l > 1 ? 16 : 10} rib shards` },
  { id: 'gasp', f: 'not yet. not like this.', name: 'LAST GASP', max: 1, w: 4, d: () => `once per ${gaspWord()}, a killing blow only stuns you` },
  { id: 'glass', f: 'hit harder. bleed easier.', name: 'GLASS JAW', max: 1, w: 5, d: () => `+35% damage, every gun`, c: 'WARD never holds more than 1 hit' },
  { id: 'tape', f: 'it is always hungry', name: 'TAPEWORM', max: 1, w: 4, lives: 2, d: () => `+50% XP for the rest of the run`, c: 'it eats one of your ships, now' },
  // biome perks: unlocked by clearing that biome this run
  { id: 'frost', f: 'cold enough to stop a heart', name: 'FROSTBITE', max: 2, w: 9, req: 'ice', d: (l) => `hits freeze meat to half speed${l > 1 ? ', longer' : ''}` },
  { id: 'corrode', f: 'it eats until it is done', name: 'CORROSIVE SPIT', max: 2, w: 9, req: 'acid', d: (l) => `hits leave acid that eats ${l > 1 ? 'fast' : 'slowly'}` },
  { id: 'ignite', f: 'everything burns the same', name: 'IMMOLATION', max: 2, w: 9, req: 'fire', d: (l) => `hits set meat burning${l > 1 ? ' longer' : ''}` },
  { id: 'snot', f: 'it comes up on its own.', name: 'SNOT ROCKET', max: 2, w: 9, req: 'snot', d: (l) => `cough a piercing glob every ${l > 1 ? 2.5 : 4}s` },
];
const BYID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export const pk = (id) => ($.G && $.G.pk && $.G.pk[id]) || 0;
/** SERRATED MARROW's damage bonus and TWITCH GLAND's fire-rate bonus by level. long4 (tune-tc, gate E5: the ship a
 *  death leaves at END D1 <= .32 x END D1's single-target dps): a death's perk scar eats the TOP level of one of them,
 *  and at today's curves that bite was 8-9% either way, so the respawn kept .32-.34 of END D1 (dps-probe, 6000 f).
 *  MARROW's second level and TWITCH's first carry more of the curve now, so the scar takes ~10% (MARROW 2 -> 1 or
 *  TWITCH 1 -> 0); every TWITCH step stays a felt one (+11 / +6 / +5 points: game-designer). short and long5 keep
 *  today's curves [FIT, dps-probe 6000 f] */
const MARROW = { today: [0, .1, .1 * 2, .1 * 3], l4: [0, .08, .2, .3] }, TWITCH = { today: [0, .08, .15, .21], l4: [0, .11, .18, .24] }; // today: .1 * l exactly as before (.1 * 3 is not .3 in doubles: short parity)
export const marrowB = (l) => (hardOn() ? MARROW.l4 : MARROW.today)[l | 0] || 0;
export const twitchB = (l) => (hardOn() ? TWITCH.l4 : TWITCH.today)[l | 0] || 0;
/** SCAB WEAVE's chance per level that a kill regrows a WARD hit: 3% on long4 (DIFFICULTY-SPEC §2.1, gate H1), 6%
 *  elsewhere. enemies/update.ts's SCAB roll reads it (with player.ts wardCap() as the cap) */
export const scabChance = () => (hardOn() ? SURV.scab : .06);
/** what LAST GASP is spent per: a stage (short, Easy) or a descent (Normal, Hard); Very Hard never offers it */
const gaspWord = () => (hardOn() && $.G && deathTier($.G).gasp === 'descent' ? 'descent' : 'stage');
/** a perk's level cap now: its max, and on long4 also 1 + the seals broken (spec §2.2: level 1 until the stage-2 clear,
 *  2 for the rest of Descent 1). Gate E7 */
export const perkCap = (p) => perkCapOf(p.max, ($.G && $.G.seal) || 0, hardOn(), ($.G && $.G.loop) || 0);
/** XP to go from lvl to lvl+1: ~2-3 levels in stage 1, ~11 by the end of descent 1, then it drags (quadratic past 10) */
export const xpNeed = (lvl) => Math.round(48 + lvl * 9.6 + Math.max(0, lvl - 10) ** 2 * 6);
/** lump XP for clearing a stage (stage index, descent loop): the active layout's economy entry (src/economy.ts;
 *  short and long4: 30 + 45 * stage + 40 * loop) */
export const stageXP = (stage, loop) => econXP(econId(), stage, loop);
const LOCK = 30, HOLD = 26;

export function perksReset() {
  const G = $.G;
  G.pk = {};
  G.xp = 0;
  G.xpTot = 0;
  G.lvl = 1;
  G.pickQ = 0;
  G.pick = null;
  G.visited = G.visited || [];
  G.seenV = G.visited.length;
  G.gasp = -1;
  G.gaspD = -1; // long4 Normal / Hard: the descent whose LAST GASP is spent (death.ts gaspSlot); in the run save
  G.pkOrder = []; // perk ids in pick order, oldest first: perkScar's tie-break (most recent first)
  G.boostReq = null;
  G.tallyXP = null;
  perkFX.slicks.length = 0;
}

/** +xp (fractional ok); queues a pick per level gained */
export function gainXP(n) {
  const G = $.G;
  if (!G || G.pk == null) return;
  n *= 1 + .5 * pk('tape');
  G.xp += n;
  G.xpTot = (G.xpTot || 0) + n;
  while (G.xp >= xpNeed(G.lvl)) {
    G.xp -= xpNeed(G.lvl);
    G.lvl++;
    G.pickQ++;
    G.lvT = 40; // HUD level-up flare
  }
}

function avail(p) {
  const G = $.G;
  if (pk(p.id) >= perkCap(p)) return false;
  if (p.id === 'gasp' && hardOn() && deathTier(G).gasp === 'off') return false; // Very Hard: LAST GASP does nothing
  if (p.req && !(G.visited || []).includes(p.req)) return false;
  if (p.lives && G.lives < p.lives) return false;
  if (p.ward && !($.P && $.P.wardLv > 0)) return false; // WARD perks only once you actually wear WARD
  return true;
}
function offer() {
  const G = $.G, pool = PERKS.filter(avail), out = [];
  // a biome you just cleared: its mutation is guaranteed in the next offer
  if (G.boostReq) {
    const b = pool.findIndex((p) => p.req === G.boostReq);
    if (b >= 0) out.push(pool.splice(b, 1)[0].id);
    G.boostReq = null;
  }
  while (out.length < 3 && pool.length) {
    const tot = pool.reduce((s, p) => s + p.w, 0);
    let r = R() * tot, k = 0;
    while ((r -= pool[k].w) > 0) k++;
    out.push(pool.splice(k, 1)[0].id);
  }
  // shuffle so the guaranteed biome card isn't always on the left
  for (let i = out.length - 1; i > 0; i--) { const j = (R() * (i + 1)) | 0; [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** called every step in play; returns true while the pick screen owns the frame */
export function stepPerks(I) {
  const G = $.G;
  if (!G || G.pk == null) return false;
  if (G.lvT > 0) G.lvT--;
  if (G.xpPop && --G.xpPop.t <= 0) G.xpPop = null;
  if (G.pickGap > 0) G.pickGap--;
  if ((G.visited || []).length > (G.seenV || 0)) {
    G.boostReq = G.visited[G.visited.length - 1];
    G.seenV = G.visited.length;
  }
  // stage clear pays a lump of XP, once per tally
  if (G.tally && G.tallyXP !== G.tally) {
    G.tallyXP = G.tally;
    const n = stageXP(G.stage || 0, G.loop || 0);
    gainXP(n);
    G.xpPop = { n: Math.round(n * (1 + .5 * pk('tape'))), t: 240 };
  }
  if (!G.pick && G.pickQ > 0 && !(G.pickGap > 0) && !G.fork && !G.tally && $.P && $.P.alive && !G.clearT && !(G.boss && G.boss.dying)) {
    const opts = offer();
    G.pickQ--;
    if (!opts.length) return false;
    G.pick = { opts, sel: 1, t: 0, hold: 0, rel: false, hov: -1 };
    sfx.power();
    buzz('medium');
  }
  if (!G.pick) return false;
  const p = G.pick;
  p.t++;
  // fire must be let go after the screen opens before it can confirm: held or mashed fire never auto-picks
  if (!I.fire) { p.rel = p.t > 6; p.hold = 0; }
  if (p.t > LOCK) {
    let mv = 0;
    if (I.up || (I.x < 0 && !(p.lx < 0))) mv = -1;
    if (I.down || (I.x > 0 && !(p.lx > 0))) mv = 1;
    if (mv) { p.sel = (p.sel + p.opts.length + mv) % p.opts.length; p.hold = 0; sfx.menu && sfx.menu(); }
    p.lx = I.x;
    if (PR.has('Enter') || PR.has('NumpadEnter')) return take(p.opts[p.sel]), false;
    // fire: press and HOLD to graft (a tap or a mash just drains back)
    if (I.fire && p.rel) { if (++p.hold >= HOLD) return take(p.opts[p.sel]), false; }
  }
  return true;
}

export function take(id) {
  const G = $.G;
  if (!G.pick || !BYID[id]) return;
  G.pk[id] = (G.pk[id] || 0) + 1;
  G.pkOrder = (G.pkOrder || []).filter((x) => x !== id);
  G.pkOrder.push(id);
  if (id === 'life') G.lives++;
  if (id === 'tape') G.lives = Math.max(1, G.lives - 1);
  if (id === 'glass' && $.P) $.P.shield = Math.min($.P.shield, 1);
  G.pickGap = 50; // a breath between back-to-back level-ups (and the feed gets read)
  G.pick = null;
  const P = BYID[id];
  G.feed = { s: 'MUTATION // ' + P.name + (G.pk[id] > 1 ? ' ' + ['', 'I', 'II', 'III'][G.pk[id]] : ''), d: P.d(G.pk[id]) + (P.c ? ' // ' + P.c : ''), t: 170, ml: 170 };
  if ($.P) flash($.P.x, $.P.y, 50, 14, P.req ? '160,255,60' : '255,200,60');
  sfx.pick();
  setTimeout(() => sfx.power(), 90);
}

export const perkName = (id) => BYID[id].name;
export const perkDesc = (id, l) => BYID[id].d(l);
export const perkCost = (id) => BYID[id].c;
export const perkReq = (id) => BYID[id].req;
export const perkFlavor = (id) => BYID[id].f;
export const perkMax = (id) => BYID[id].max;

// ---------------- perk world effects (teeth, slicks) ----------------
export const perkFX = { slicks: [], teeth: [] };
/** tooth positions this frame (screen space) */
export function teethPos() {
  const n = pk('teeth'), P = $.P, out = [];
  if (!n || !P || !P.alive) return out;
  const a0 = ($.G.t || 0) * .085;
  for (let i = 0; i < n; i++) { const a = a0 + i * Math.PI; out.push({ x: P.x + Math.cos(a) * 24, y: P.y + Math.sin(a) * 19, a }); }
  return out;
}
/** called from updatePlayer each world step */
export function perkTick(hurt) {
  const G = $.G;
  // ORBITING TEETH: chew whatever they touch, 4 hits/s per tooth per enemy
  const tp = teethPos();
  perkFX.teeth = tp;
  for (const t of tp) for (const e of enemies) {
    if (e.dead || e.ghost > 0) continue;
    const r = (e.r || 6) + 4;
    if ((e.x - t.x) ** 2 + (e.y - t.y) ** 2 < r * r && !(e.toothT > G.t)) {
      e.toothT = G.t + 15;
      hurt(e, (e.big || e.mini ? .5 : 1) * (1 + marrowB(pk('dmg'))), t.x, t.y, Math.sign(e.x - t.x) || 1);
      if (R() < .5) spark(t.x, t.y, rr(-2, 2), rr(-2, 2), 8, '#f0e2c0');
    }
  }
  // BLOOD TRAIL slicks drift with the terrain, eat anything inside
  const sl = perkFX.slicks, ss = G.scrollSpeed || 0;
  for (let i = sl.length - 1; i >= 0; i--) {
    const s = sl[i];
    s.t--;
    s.x -= ss;
    if (s.t <= 0 || s.x < -30) { sl.splice(i, 1); continue; }
    if (G.t % 6) continue;
    for (const e of enemies) {
      if (e.dead || e.ghost > 0) continue;
      const r = s.r + (e.r || 6) * .6;
      if ((e.x - s.x) ** 2 + ((e.y - s.y) * 1.6) ** 2 < r * r) {
        const d = (e.big || e.mini ? .08 : .25) * s.lv; // W6 round 3: midMul is told the damage the slick deals (it was told .08 at every level and size, so a hurt hook's floor saw too little)
        e.hp -= d * midMul(e, d, e.x, e.y, 0); // area: MidSim.hurt decides
        e.flash = 2;
        if (R() < .4) drop(e.x, e.y, rr(-.6, .6), rr(-1, .2), 1, 0, 40);
        if (e.hp <= 0) hurt(e, 0, e.x, e.y, 1);
      }
    }
  }
}
/** a kill spills a slick (BLOOD TRAIL) */
export function spillSlick(x, y) {
  const l = pk('trail');
  if (!l || x < 0 || x > W || y < 0 || y > PH) return;
  const sl = perkFX.slicks;
  if (sl.length >= 10) sl.shift();
  sl.push({ x, y, r: 12 + 5 * l, t: 120 + 60 * l, ml: 120 + 60 * l, lv: l, seed: R() * TAU });
}
/** LAST GASP: returns true if the lethal hit was eaten */
export function lastGasp() {
  const G = $.G;
  if (!pk('gasp')) return false;
  if (hardOn()) {
    // long4 (spec §2.1 LAST GASP): once per descent on Normal and Hard, per stage on Easy, never on Very Hard
    const g = gaspSlot(G);
    if (!g || G[g.f] === g.k) return false;
    G[g.f] = g.k;
    if (g.f === 'gaspD') cpPatch({ gaspD: g.k }); // spent in the stored checkpoint too: an app kill can't refill it
  } else {
    if (G.gasp === G.stage + G.loop * 10) return false;
    G.gasp = G.stage + G.loop * 10;
  }
  $.P.inv = 120;
  G.red = 1;
  G.shake = 10;
  G.hitstop = 8;
  pop($.P.x, $.P.y - 14, 'LAST GASP', '#ff3040', 10, 70);
  flash($.P.x, $.P.y, 70, 18, '255,40,50');
  sfx.shield && sfx.shield();
  buzz('heavy');
  return true;
}
/** write G fields into the stored checkpoint as it stands (not the live loadout): a LAST GASP spent after the last
 *  checkpoint must survive an app kill (systems-designer). No-op without a checkpoint or with the slot sealed */
export function cpPatch(fields) {
  const s = lastRun();
  if (!s) return false;
  try {
    const o = JSON.parse(s);
    Object.assign(o.g, fields);
    const t = JSON.stringify(o);
    return !!decodeRun(t) && storeRun(t); // a patch that would not read back never replaces a good save
  } catch (e) { return false; }
}
/** the perk scar (Decision 2A, DIFFICULTY-SPEC §2.1 "Death penalty"): a long4 death eats one level of the held perk
 *  with the highest POWER.perk weight above .3, ties to the most recent pick. It stays in the pool (avail reads the
 *  level), so a later level-up can offer it back. Returns the perk's id, or null when nothing was eaten. No RNG */
export function perkScar(G = $.G) {
  if (!G || !G.pk) return null;
  const id = perkScarPick(G.pk, G.pkOrder || [], POWER.perk);
  if (!id) return null;
  G.pk[id]--;
  if (G.pk[id] <= 0) {
    delete G.pk[id];
    if (G.pkOrder) G.pkOrder = G.pkOrder.filter((x) => x !== id);
  }
  return id;
}
/** SHRAPNEL RIBS: a broken WARD hit spits shards (pushes into shots) */
export function ribShards(shots, dm) {
  const l = pk('shard');
  if (!l) return;
  const n = l > 1 ? 16 : 10, P = $.P;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    shots.push({ k: 'bolt', x: P.x, y: P.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, dmg: 1.4 * dm, r: 2, pierce: 1, seek: 0, rip: 0, t: 0, rib: 1 });
  }
}

// a perk's weight toward difficulty (G.pow) lives in POWER.perk (src/power.ts): every perk above has one
