// @ts-nocheck
// Biomes + branching route. Each descent: OPEN ORBIT -> fork -> biome -> fork -> biome -> THE GRAVITY DRIVE.
// At a fork the scroll holds and two gates open; fly into one (or wait 15s and the ship picks). Choosing a biome
// rewrites that stretch of terrain, writes its enemy script and boss, and switches palette, background,
// ambient particles, hazards, gore colour and music for as long as you're inside it.
import { $ } from './state';
import { C, DC, FIRE, H, PH, R, TAU, TS, W, clamp, ctx, dist2, hash, lerp, pick, ri, rr, sstep, vnoise } from './core';
import { CEIL, FLOOR, ceilAt, floorAt, shots } from './world';
import { mkTex } from './textures';
import { sfx, sample } from './audio';
import { buzz } from './platform';
import { spark, drop, flash, gore, pop, mist } from './fx/spawn';
import { banner, behindWave, butcher, corpse, crawler, crossT, eyeT, flayer, formation, hatch, hookE, logLine, maw, midboss, miniWarn, womb, crux } from './enemies/spawn';
import { glow, light } from './render/util';
import { mutant, slime } from './enemies/spawn';
import * as SPW from './enemies/spawn'; // W1's entryWave (g3-w1-bullets), read through w1() until it lands
import * as CPK from './cellpick'; // W1's droneEntry, likewise
import { eliteChance, eliteRoll } from './enemies/elite';
import { enemies } from './world';
import { startStage } from './stages';
import { drawFX } from './render/biomeart';
import { beatPlan, layout, nSlots, slotRow, stageOfSlot } from './layout';
import { midSeedOf, pickSeedOf, seedOf, stream } from './rng';
import { HOME, MIDS, forceSlotA, forkAllows, midsWanted, noteMids, pickBiomeMids, slotClock } from './midpick';
import { driftOf, whenNoMini } from './midslot';
import { MID_NAMES, ROSTER } from './enemies/mid/roster';
import { midForce, midsWip } from './lab';
import { drawPicks } from './setdraw';
import { MOVE, MOVES, MOVE_GAP, bandClamp, gimmick, hazInterval, moveAt, narrowNear, snapVent } from './terrainb';
import { BOSS_SIM, bossFor } from './enemies/boss/registry';
import { hazAimed, hazLeadX } from './notice';
import { ECON, econId, noticeOf } from './economy';
import { FURNACE, GRILL, GULLET, ICICLE, INSET_MID, MORGUE, SPACE, heldInsetOf, SWALLOW, TIDE, SPUR, WEAVE, envelope, grillCols, hazRankMul, insetOf, morgueLane, planSig, setSigWindows, tideLen, weaveAt, weaveHold, weaveLoss } from './sigs';
import { srr } from './srnd';
import { rho } from './rank';
import { HAZ_HOOK } from './boss/bossrules'; // the boss hazard drop (W4b)
import { SC, armSwallow, armTide, solids, spawnIce, spawnPlug } from './solids'; // the space engine (W3a)
export { biomePat, biomeTerrainFill, biomeEdge, drawBiomeBG, drawBiomeDecor, splatCols, biomeDark, biomeMist } from './render/biomeart';

// the biome slots (world x0, bossX) are stage rows of the layout (src/layout.ts slotRow); short: stage 1 = slot 0,
// stage 2 = slot 1

export const BIOMES = {
  ice: {
    name: 'THE CRYOVAULT', tag: 'FROZEN // BLOAT', sub: 'THE CREW IS STILL IN HERE. FROZEN MID-SCREAM', col: '#9fd8ff', rgb: '160,215,255',
    dark: .55, mist: '90,10,26', bg: ['#02060e', '#0e2840'], edge: '#f2fbff', fog: '120,180,230',
    gore: ['#7a1222', '#300610', '#d8efff', '#0c0809', '#8cc4ee', '#ffffff'], blood: ['#7a1222', '#300610', '#c8506a'],
    boss: 'crux', bossName: 'THE BLOAT', haz: 'icicle', hazEvery: 110,
    // slow and heavy: fewer, tougher things drifting out of the cold
    gap: 115, dbl: .55, set: 'morgue', sig: 'corpse',
    mix: [['corpse', 4], ['cross', 3], ['mutant', 2.5], ['flayer', 2], ['eye', 2], ['hook', 2], ['sine', 2]],
    // a repeat visit (remix(), below): the hulks lead, crucifixes line the shelves, two kinds wander in from elsewhere
    remix: { sig: 'mutant', set: 'crucify', drop: ['hook', 'eye', 'sine'], add: [['zig', 1]], pool: [['crawler', 2], ['womb', 2], ['slime', 2], ['hatch', 1.2]] },
    logs: ['TEMPERATURE: -140C. THE BODIES ARE STANDING UP.', 'THE ICE IS FULL OF FACES.',
      'SOMEONE SCRATCHED A TALLY INTO THE FROST. IT STOPS AT 2557.', 'THE COLD IS NOT SLOWING THEM DOWN.'],
  },
  acid: {
    name: 'THE DIGESTION TANKS', tag: 'DISSOLVING // MAW', sub: 'EVERYTHING DOWN HERE IS BEING EATEN', col: '#3fe8c8', rgb: '60,230,195',
    dark: .6, mist: '18,120,100', bg: ['#010605', '#081a15'], edge: '#7ff0d8', fog: '40,200,170',
    gore: ['#8a4630', '#2e140c', '#46e0c0', '#0c0809', '#ddd27a', '#c8f4e8'], blood: ['#1c9a80', '#0a3a32', '#6ff0d4'],
    boss: 'maw', bossName: 'THE DISSOLVED MAW', haz: 'geyser', hazEvery: 135,
    // wall swarms over a floor full of crawlers and wombs
    gap: 125, dbl: .55, set: 'walls', sig: 'crawler',
    mix: [['crawler', 4], ['womb', 3], ['eye', 2], ['hatch', 1], ['wall', .7], ['dive', .3]],
    late: [['slime', 2.5]], // Descent 2+: the Sinus's slimes have leaked into the tanks
    remix: { sig: 'womb', set: 'gutter', drop: ['dive', 'hatch'], add: [['sine', .6]], pool: [['mutant', 2], ['hook', 2], ['flayer', 2], ['cross', 2]] },
    logs: ['THE FLOOR IS STOMACH LINING. IT IS SECRETING.', 'HULL PLATING THINNING. IT TASTES ME.',
      'A BOOT FLOATS PAST. THE FOOT IS STILL IN IT.', 'THE TANK IS NOT FULL. IT IS STILL EATING.'],
  },
  fire: {
    name: 'THE FURNACE', tag: 'BURNING // BUTCHER', sub: 'THEY BURNED THE BODIES. THE BODIES KEPT MOVING', col: '#ff7a1a', rgb: '255,120,30',
    dark: .6, mist: '50,12,6', bg: ['#040000', '#300702'], edge: '#ffb347', fog: '255,90,20',
    gore: ['#4a0a06', '#120202', '#ff6a1a', '#050303', '#ffb347', '#ff3a10'], blood: ['#6a0a08', '#240303', '#ff4a1a'],
    boss: 'butcher', bossName: 'THE BURNING BUTCHER', haz: 'jet', hazEvery: 125,
    // aggressive: tight spacing, divers and flayers, things coming from behind
    gap: 100, dbl: .6, set: 'pincer', sig: 'flayer',
    mix: [['flayer', 3], ['hook', 3], ['mutant', 2.5], ['crawler', 2], ['dive', .6], ['behind', .4]],
    remix: { sig: 'mutant', set: 'kiln', drop: ['crawler', 'dive'], add: [['zig', .8]], pool: [['cross', 2], ['eye', 2], ['corpse', 2], ['slime', 2]] },
    logs: ['INCINERATOR RUNNING AT 4000C. SOMETHING IS SINGING IN IT.', 'ASH IS FALLING UP.',
      'THE ASH HAS FINGERPRINTS.', 'COOLANT LINES CUT BY HAND. SOMEONE WANTED IT HOT.'],
  },
  snot: {
    name: 'THE SINUS', tag: 'MUCUS // MAW', sub: 'IT IS BREATHING. YOU ARE IN THE AIRWAY', col: '#ecd25a', rgb: '236,210,90',
    dark: .4, mist: '160,140,40', bg: ['#0a0503', '#2a1c08'], edge: '#f4e49a', fog: '200,180,70',
    gore: ['#d0b840', '#7a4a18', '#f4e6a0', '#3a1a0a', '#fff4c8', '#a83a24'], blood: ['#c8ac3a', '#6a4a14', '#f2e08a'],
    boss: 'maw', bossName: 'THE MUCUS MAW', haz: 'strand', hazEvery: 150,
    // hatchling floods out of wombs and the walls
    gap: 125, dbl: .5, set: 'flood', sig: 'hatch',
    mix: [['slime', 5], ['hatch', 3], ['womb', 3], ['corpse', 2], ['sine', 1.5], ['crawler', 1], ['eye', 1]],
    remix: { sig: 'slime', set: 'drip', drop: ['corpse', 'eye', 'sine'], add: [['zig', 1.2]], pool: [['mutant', 2], ['hook', 2], ['cross', 2], ['flayer', 2]] },
    logs: ['EVERYTHING IS COATED. IT IS WARM. IT IS MOVING.', 'I CAN HEAR IT BREATHING THROUGH THE WALLS.',
      'MY INTAKES ARE BLOCKED. SOMETHING IS IN THEM.', 'THE WALLS CONTRACTED. THEY ARE WAITING.'],
  },
};
export const BIOME_KEYS = Object.keys(BIOMES);
// B.mids: the biome's own midboss pool, home first, each with its skill tag (spec §6.1-6.2), from the registry
// (enemies/mid/roster.ts). A biome stage on a picker layout draws home plus a crossover from every biome pool
for (const b of BIOME_KEYS) BIOMES[b].mids = ROSTER.filter((r) => r.pool === b).map(({ k, name, tag }) => ({ k, name, tag }));
export { MID_NAMES };

// ---------------- where are we ----------------
// LS3: G.bx assumes the biome slots follow each other (slot s ends where slot s + 1 starts, the last one at
// biomeExit). long5 puts an interior between the slots, so it needs a per-slot end (e.g. G.bxEnd[slot]) read here
// and by rewriteTerrain, which today blends every slot until layout().tEnd.
// G.bx[s] = world x where biome s starts (just off the right edge when its gate was taken); G.bx[2] = where the
// second biome hands back to the ship (just off the right edge when stage 2 clears). A biome holds through its
// boss and the fork that follows, and crossfades into the next one over ~320px.
const fadeIn = (x, wx) => sstep(x - 280, x + 40, wx);
export function biomeK(wx) {
  const G = $.G;
  if (!G || !G.route || !G.bx) return [null, 0];
  let best = null, bk = 0;
  for (let s = 0; s < G.route.length; s++) { // G.route has one entry per biome slot (flow.ts); no nSlots() here: it allocates, and this runs ~10x a frame
    const b = G.route[s], x0 = G.bx[s];
    if (!b || x0 == null) continue;
    const x1 = G.bx[s + 1], k = fadeIn(x0, wx) * (x1 == null ? 1 : 1 - fadeIn(x1, wx));
    if (k > bk) { best = b; bk = k; }
  }
  return [best, bk];
}

// ---------------- gore palette ----------------
const DC0 = [...DC];
/** the default gore palette, before any biome rewrites C */
export const C0 = { blood: C.blood, bloodD: C.bloodD, bloodL: C.bloodL };
let palNow = null;
function applyPalette(b) {
  if (palNow === b) return;
  palNow = b;
  const B = b && BIOMES[b];
  for (let i = 0; i < DC.length; i++) DC[i] = B ? B.gore[i] : DC0[i];
  C.blood = B ? B.blood[0] : C0.blood;
  C.bloodD = B ? B.blood[1] : C0.bloodD;
  C.bloodL = B ? B.blood[2] : C0.bloodL;
}

// ---------------- terrain ----------------
function shape(b, x, o) {
  const a = vnoise(x / 200 + o) * 2 - 1, n = vnoise(x / 47 + o + 7) * 2 - 1, f = vnoise(x / 17 + o + 3) * 2 - 1;
  let ce, fl;
  if (b === 'ice') {
    const t = (x % 52) / 52, tooth = (1 - Math.abs(2 * t - 1)) ** 1.6 * (10 + hash(Math.floor(x / 52) + o) * 30);
    ce = 18 + a * 10 + tooth;
    fl = PH - 30 - a * 12 - Math.floor((n * 18) / 9) * 9; // stepped ice shelves
  } else if (b === 'acid') {
    ce = 16 + a * 14 + n * 6;
    fl = PH - 18 + Math.sin(x / 9) * 1.5 - Math.max(0, n) * 26; // low lake with stomach folds
  } else if (b === 'fire') {
    ce = 26 + a * 16 + Math.abs(f) * 8;
    fl = PH - 24 - Math.max(0, n) ** 2 * 70 - Math.abs(f) * 6; // basalt spires
  } else {
    ce = 34 + 26 * Math.abs(Math.sin(x / 83 + o)) + n * 10;
    fl = PH - 34 - 26 * Math.abs(Math.sin(x / 71 + o + 1.3)) - n * 10; // bulbous sinus walls
  }
  if (fl - ce < 108) { const m = (fl + ce) / 2; fl = m + 54; ce = m - 54; }
  return [ce, fl];
}
/** test hook (terrainb.test.ts): movement A's own walls at world x, terrain offset o */
export const shapeAt = (b, x, o) => shape(b, x, o);
// movement C, the boss arena (spec §3.3): today's shape at half its swing around the biome's resting edges, with the
// gap opened to ARENA_GAP so the boss patterns have room. Rest = shape()'s constant terms per biome
const REST = { ice: [18, PH - 30], acid: [16, PH - 18], fire: [26, PH - 24], snot: [34, PH - 34] };
/** the arena gap (spec §3.3 movement C: >= 150 px; route-probe minGap reads it) */
export const ARENA_GAP = 150;
/** the registered stage boss (enemies/boss/registry.ts, D55) that ends biome slot seg this descent, or null for the
 *  biome's own: by slot and descent, never world x, and no RNG (bossFor). Its arena, WARNING, spawn and run-up line come
 *  from its BossSim */
export const slotBoss = (seg) => {
  const k = bossFor(seg, ($.G && $.G.loop) || 0, !!layout().picker);
  // an unregistered k is null here (unit tests load biomes.ts against mocks without the kind files); the game can't reach
  // that: main.ts checkBosses refuses to boot when a placed boss has no defineBoss
  return (k && BOSS_SIM[k]) || null;
};
const AR = [0, 0];
function arena(b, ce, fl) {
  const [c0, f0] = REST[b] || REST.snot;
  ce = c0 + (ce - c0) * .5;
  fl = f0 + (fl - f0) * .5;
  if (fl - ce < ARENA_GAP) { const m = (fl + ce) / 2; fl = m + ARENA_GAP / 2; ce = m - ARENA_GAP / 2; }
  return [ce, fl];
}
/** the difficulty rebuild's long4 rules are on (DIFFICULTY-SPEC §2: gated on ECON[econId()].hard; short is untouched) */
const isL4 = () => { const E = ECON[econId()]; return !!(E && E.hard); };
/** 0..1, how close world x is to the held screen of a midboss this stage really flies (mids: its picks by slot; a
 *  breath with no pick, THE KEEPSAKE stage's dropped slot B, is a rest and keeps the full inset). The held screen runs
 *  from the breath's start to W px past its end; INSET_MID.pad more either side, eased over ramp. null: none */
function midNear(seg, from, mids) {
  const P = INSET_MID, R = beatPlan(slotRow(seg), from, false).breaths.filter((r) => r.mid).filter((_, s) => !mids || mids[s] != null);
  if (!R.length) return null;
  return (x) => { let k = 0; for (const r of R) k = Math.max(k, sstep(r.a - P.pad - P.ramp, r.a - P.pad, x) * (1 - sstep(r.z + W + P.pad, r.z + W + P.pad + P.ramp, x))); return k; };
}
/** slot B's GULLET (src/sigs.ts): its world x span, starting GULLET.lead past the scroll x of its spawn-span p */
function gulletAt(seg, from) {
  const x0 = beatPlan(slotRow(seg), from, false).P(GULLET.p) + GULLET.lead;
  return { x0, x1: x0 + GULLET.len };
}
/** the gullet's edges at world x (decision 31, W6 r4: the winding throat): a `zig.gap` px lane whose centre holds at
 *  PH x lanes[0], then lanes[1], ... for `zig.w` px every `zig.pitch` px and runs straight between them (smooth: the walls'
 *  own noise would break the swept fit), blended in at both ends (a lerp of two >= 108 column gaps stays >= 108) */
function gullet(g, x, b, ce, fl) {
  // the lane holds through both blends (its last hold starts where the exit blend can't reach a ramp), so a blend only
  // ever carries a held lane in or out, never a moving one (level-designer review: S3 through the blends)
  const G = GULLET, Z = G.zig, k = envelope(x, g.x0, g.x1, G.blend), tMax = Math.floor((g.x1 - g.x0 - 2 * G.blend - Z.w) / Z.pitch) * Z.pitch;
  const t = Math.min(tMax, Math.max(0, x - g.x0 - G.blend)), i = Math.floor(t / Z.pitch), r = t - i * Z.pitch;
  const y = (j) => PH * Z.lanes[j % 2], m = r < Z.w ? y(i) : lerp(y(i), y(i + 1), (r - Z.w) / (Z.pitch - Z.w));
  return [lerp(ce, m - Z.gap / 2, k), lerp(fl, m + Z.gap / 2, k)];
}
/** blend the terrain from world x `from` onward (over 300px, all of it off-screen) into biome b; it stays that
 *  biome until the next rewrite, and always fades back to the untouched level over layout().tEnd, where the biome
 *  terrain hands back to the level's own corridor (the Gravity Drive approach; its chamber band is in world.ts). The biome shape
 *  and the base level both keep a >=104px gap, and a lerp of two such gaps can't be narrower. A layout with a run-up
 *  beat (long4) blends movement A (shape) into movement C (arena) over arenaBlend px from the run-up's scroll x, so
 *  the whole screen is arena by the time the run-up starts; a lerp of a >=108 and a >=150 gap stays >=108. Variant mv
 *  (a layout with moveB) blends movement B (src/terrainb.ts) in and out over its band, by the same argument */
function rewriteTerrain(seg, b, from, mv = null, mids = null, sp = null) {
  const o = ($.G.loop + 1) * 37.1 + seg * 11, LY = layout(), [T_END0, T_END1] = LY.tEnd;
  const xC = LY.beats.runup != null ? beatPlan(slotRow(seg), from, false).runup : null, xC1 = xC != null ? xC + LY.beats.arenaBlend : 0;
  const M = mv != null ? beatPlan(slotRow(seg), from, false).moveB : null, SB = slotBoss(seg); // SB: a registered boss owns its arena (movement C)
  if (M) MOVES[seg] = { ...M, b, mv, o };
  // long4 (DIFFICULTY-SPEC §2.4): the resting walls come in by INSET px a side, halved near a held midboss's screen, and
  // slot B gets the GULLET narrow in its rush. Movement C (the arena) is built from the un-inset walls, so the boss
  // arenas don't move. short: ins0 is 0 and there is no gullet, so the loop is the arithmetic it was
  const L4 = isL4(), ins0 = L4 ? insetOf(b, seg) : 0, held = heldInsetOf(b, seg), near = ins0 ? midNear(seg, from, mids) : null, gul = L4 && seg ? gulletAt(seg, from) : null;
  const i0 = Math.max(0, Math.floor(from / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil(T_END1 / TS));
  const edges = (i) => { // movement A, then B's gimmick, then the gullet: the un-inset walls at column i
    const x = i * TS;
    let [ce, fl] = shape(b, x, o);
    if (M && x > M.a && x < M.z) { const k = sstep(M.a, M.a + M.blend, x) * (1 - sstep(M.z - M.blend, M.z, x)), [cb, fb] = gimmick(b, mv, x, o, ce, fl); ce = lerp(ce, cb, k); fl = lerp(fl, fb, k); }
    if (gul && x > gul.x0 && x < gul.x1) [ce, fl] = gullet(gul, x, b, ce, fl);
    return [ce, fl];
  };
  const write = (i, ce, fl) => {
    const x = i * TS, w = sstep(from, from + 300, x) * (1 - sstep(T_END0, T_END1, x));
    if (xC != null && x > xC) { const k = sstep(xC, xC1, x), [cc, ff] = SB && SB.arena ? SB.arena(...(REST[b] || REST.snot), ce, fl, AR) : arena(b, ce, fl); ce = lerp(ce, cc, k); fl = lerp(fl, ff, k); }
    FLOOR[i] = lerp(FLOOR[i], fl, w);
    CEIL[i] = lerp(CEIL[i], ce, w);
  };
  if (!L4 || i1 < i0) { for (let i = i0; i <= i1; i++) { const [ce, fl] = edges(i); write(i, ce, fl); } return; } // short: the arithmetic it was
  // long4 inset, in two passes. A wall coming in next to a needle (a fire spire, an ice tooth) narrows the swept 21 px
  // fit gap there, not just its own column, so each column's inset is capped by the narrowest un-inset swept fit within
  // INSET_FIT.reach px: fit after >= fit before - 2 x inset >= INSET_FIT.keep wherever the walls left room (route-probe
  // S1 holds by construction), and nothing moves where they did not. The arena (movement C) is built from the un-inset walls
  const n = i1 - i0 + 1, C0 = new Float32Array(n), F0 = new Float32Array(n), fit = new Float32Array(n), R = INSET_FIT.reach / TS | 0;
  for (let i = i0; i <= i1; i++) { const [ce, fl] = edges(i); C0[i - i0] = ce; F0[i - i0] = fl; }
  if (M && mv) b1Swept(M, b, i0, n, C0, F0); // a remix B1's steps and drapes: the swept fit, not just each column (S1)
  const sweep = () => { for (let j = 0; j < n; j++) { let c = -1e9, f = 1e9; for (let q = Math.max(0, j - 3); q <= Math.min(n - 1, j + 3); q++) { c = Math.max(c, C0[q]); f = Math.min(f, F0[q]); } fit[j] = f - c; } }; // the swept span [-9, +12] px, a column either side
  sweep();
  const mask = flowMask(seg, from, mids, sp, gul, xC, i0, n, mv ? M : null); // where the weave and the spurs may run (sigs.ts WEAVE, SPUR)
  if (weave(seg, o, i0, n, C0, F0, fit, R, mask)) sweep(); // the lane weave, before the inset reads the fit
  const ins = new Float32Array(n), wnt = new Float32Array(n); // the capped inset per column, and what it wanted
  for (let j = 0; j < n; j++) {
    let m = 1e9; for (let q = Math.max(0, j - R); q <= Math.min(n - 1, j + R); q++) m = Math.min(m, fit[q]);
    const x = (i0 + j) * TS, want = near ? lerp(ins0, held, near(x)) : ins0;
    wnt[j] = want;
    ins[j] = Math.max(0, Math.min(want, (m - INSET_FIT.keep) / 2));
  }
  // the cap changes fast where a needle enters the window: limit it to INSET_FIT.slope px a column both ways, only ever
  // lowering it (a smaller inset never narrows the fit), so it adds no tile-to-tile cliff (terrainb.test.ts)
  for (let j = 1; j < n; j++) ins[j] = Math.min(ins[j], ins[j - 1] + INSET_FIT.slope);
  for (let j = n - 2; j >= 0; j--) ins[j] = Math.min(ins[j], ins[j + 1] + INSET_FIT.slope);
  for (let j = 0; j < n; j++) { C0[j] += ins[j]; F0[j] -= ins[j]; }
  // the walls inside a MORGUE RUSH or GRILL window are not its squeeze (the blocks lodge against them and shatter when the
  // fit would drop under the window floor; the jets reach a share of the span), so oneWall runs there too; a tide or a
  // swallow is the window's own squeeze, fitted against the walls as they were
  const m1 = sp && (sp.k === 'morgue_rush' || sp.k === 'grill') ? flowMask(seg, from, mids, null, gul, xC, i0, n, mv ? M : null) : mask;
  oneWall(n, C0, F0, ins, wnt, m1); // what the cap took beside a needle, from the other wall (flown corridor only)
  spurs(seg, o, from, i0, n, C0, F0, mask); // the staggered spurs, on the inset walls (their tips are fitted to those)
  for (let j = 0; j < n; j++) write(i0 + j, C0[j], F0[j]);
}
/** W6 r4 (L2): the symmetric cap above gives both walls (fit - keep) / 2, so beside a needle (an ice tooth, a fire spire,
 *  movement B0's crevasse and spire field) neither wall came in and the flown corridor stayed at ~70% free height.
 *  Here the inset the cap took (want - ins) comes from one wall at a time, as far as the swept fit allows: a wall
 *  column moves in only while every column of the other wall within 6 (a shared 21 px footprint) stays
 *  INSET_FIT.keep away, so no footprint is pushed below keep (S1; it never lifts one that was already under it). Half each wall, then the rest; each pass
 *  is slope-limited (INSET_FIT.slope, lowered only), so it adds no cliff. Only where the flow mask runs (not in a
 *  signature window, the gullet, a held midboss's screen or the run-up: those keep the walls they were fitted on) */
function oneWall(n, C, F, ins, wnt, mask) {
  const R = 6, K = INSET_FIT.keep, rc = new Float32Array(n), rf = new Float32Array(n), e = new Float32Array(n);
  for (let j = 0; j < n; j++) rc[j] = rf[j] = Math.max(0, wnt[j] - ins[j]) * mask[j];
  const pass = (floor, share) => {
    for (let j = 0; j < n; j++) {
      let lim = floor ? -1e9 : 1e9;
      for (let q = Math.max(0, j - R); q <= Math.min(n - 1, j + R); q++) lim = floor ? Math.max(lim, C[q]) : Math.min(lim, F[q]);
      e[j] = Math.max(0, Math.min((floor ? rf[j] : rc[j]) * share, floor ? F[j] - lim - K : lim - K - C[j]));
    }
    for (let j = 1; j < n; j++) e[j] = Math.min(e[j], e[j - 1] + INSET_FIT.slope);
    for (let j = n - 2; j >= 0; j--) e[j] = Math.min(e[j], e[j + 1] + INSET_FIT.slope);
    for (let j = 0; j < n; j++) { if (floor) { F[j] -= e[j]; rf[j] -= e[j]; } else { C[j] += e[j]; rc[j] -= e[j]; } }
  };
  pass(true, .5); pass(false, .5); pass(true, 1); pass(false, 1);
}
/** a remix movement B1 (Descent 2+, long4): its gimmicks keep MOVE_GAP per column (terrainb.ts keepFloor / keepCeil /
 *  centre), but a stair face or a drape's flank moves a wall by up to ~25 px inside the swept fit's 21 px footprint, so
 *  route-probe read 86-99 px holes there (S1 is 100; W6 ledger). Over the band, the wall that is not the gimmick gives way
 *  until every pair of columns that can share a footprint (7 columns, so <= 6 apart) is MOVE_GAP apart: the ceiling for
 *  the floor gimmicks (ice stairs, snot polyps), the floor for the ceiling ones (acid folds, fire's Chimney hoods). The
 *  gimmick's own wall keeps its shape. Pure of the sim RNG; D1 never flies B1 (setdraw.ts moveRoll), short has no band */
function b1Swept(M, b, i0, n, C, F) {
  const floorG = b === 'ice' || b === 'snot', R = 6, a = Math.max(0, Math.floor(M.a / TS) - i0 - R), z = Math.min(n - 1, Math.ceil(M.z / TS) - i0 + R);
  if (z < a) return; // the band ends before this rewrite's first column (never from a gate today)
  const out = new Float32Array(z - a + 1);
  for (let j = a; j <= z; j++) {
    let v = floorG ? 1e9 : -1e9;
    for (let q = Math.max(0, j - R); q <= Math.min(n - 1, j + R); q++) v = floorG ? Math.min(v, F[q]) : Math.max(v, C[q]);
    out[j - a] = floorG ? Math.min(C[j], v - MOVE_GAP) : Math.max(F[j], v + MOVE_GAP);
  }
  for (let j = a; j <= z; j++) { if (floorG) C[j] = out[j - a]; else F[j] = out[j - a]; }
}
/** 0..1 per column i0..: where the flown corridor may weave and grow spurs (sigs.ts WEAVE, SPUR): faded out (WEAVE.fade
 *  px) over the signature windows (sp), the gullet, a held midboss's screen and the run-up (xC, movement C) */
function flowMask(seg, from, mids, sp, gul, xC, i0, n, mb = null) {
  const near = midNear(seg, from, mids), fd = WEAVE.fade, ws = sp ? sp.vars : [], m = new Float32Array(n);
  const band = (x, a, z) => sstep(a - fd, a, x) * (1 - sstep(z, z + fd, x));
  for (let j = 0; j < n; j++) {
    const x = (i0 + j) * TS;
    let k = 1;
    if (near) k *= 1 - near(x);
    for (const V of ws) k *= 1 - band(x, V.x0, V.x1);
    if (gul) k *= 1 - band(x, gul.x0, gul.x1);
    if (mb) k *= 1 - band(x, mb.a, mb.z); // a remix movement B1 (Descent 2+): its own shapes, fitted un-woven
    if (xC != null) k *= 1 - sstep(xC - fd, xC, x);
    m[j] = k;
  }
  return m;
}
/** the LANE WEAVE (sigs.ts WEAVE, L3): shift both walls of columns i0.. (C0 / F0, un-inset) by the slot's weave, inside
 *  the flow mask, scaled down where the un-woven swept fit (fit, read within R columns) has no room for the sweep loss.
 *  The scale moves at most WEAVE.ease a px (lowered only), so a fade adds no cliff. Returns whether anything moved */
function weave(seg, o, i0, n, C0, F0, fit, R, mask) {
  const Wv = WEAVE, loss = weaveLoss(seg), m = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    let f = 1e9; for (let q = Math.max(0, j - R); q <= Math.min(n - 1, j + R); q++) f = Math.min(f, fit[q]);
    m[j] = mask[j] * Math.max(0, Math.min(1, (f - Wv.keep) / loss));
  }
  const e = Wv.ease * TS;
  for (let j = 1; j < n; j++) m[j] = Math.min(m[j], m[j - 1] + e);
  for (let j = n - 2; j >= 0; j--) m[j] = Math.min(m[j], m[j + 1] + e);
  let any = false;
  for (let j = 0; j < n; j++) { if (m[j] <= 0) continue; const d = m[j] * weaveAt((i0 + j) * TS, o, seg); C0[j] += d; F0[j] += d; any = true; }
  return any;
}
/** the STAGGERED SPURS (sigs.ts SPUR, L3): every SPUR pitch px a spur off one wall, then the other, its tip stopping
 *  `gap` px short of the lowest (highest) opposite wall within the spur's span + 12 px (the swept fit there is >= gap by
 *  construction: S1), at most `depth` deep, its depth eased across its width and scaled by the flow mask at its centre.
 *  On the final (inset, woven) walls C / F, before the arena blend and the gate blend */
function spurs(seg, o, from, i0, n, C, F, mask) {
  const S = SPUR.slot[seg ? 1 : 0], w = Math.round(S.w / TS), H = weaveHold(o, seg), half = H.P / 2, sw = 3, list = (SPURS[seg] = []);
  const x0 = i0 * TS, x1 = (i0 + n - 1) * TS;
  // phase-locked to the weave (level-designer review): spur c is centred on a weave hold, a ceiling spur on the +amp
  // (corridor low) hold and a floor spur on the -amp one, so the open bands under two spurs in a row overlap by only
  // ~216 - corridor - 4 amp px (A ~7, B ~14): a ship holding the middle is moved too
  for (let c = Math.ceil((x0 - H.x) / half); H.x + c * half + S.w < x1; c++) {
    const cx = H.x + c * half, a = Math.round((cx - S.w / 2) / TS) - i0, z = a + w, mid = (a + z) >> 1;
    if (a - sw < 0 || z + sw >= n) continue;
    // depth eases in over the stage's opening (game-designer review): half depth at the gate, full SPUR.ramp px on
    const k = mask[mid] * (.5 + .5 * sstep(from + 320, from + 320 + SPUR.ramp, cx)); if (k <= .02) continue;
    const top = (c & 1) === 0;
    let opp = top ? 1e9 : -1e9, wall = top ? -1e9 : 1e9;
    for (let q = a - sw; q <= z + sw; q++) { if (top) { opp = Math.min(opp, F[q]); wall = Math.max(wall, C[q]); } else { opp = Math.max(opp, C[q]); wall = Math.min(wall, F[q]); } }
    const tip = top ? Math.min(wall + S.depth, opp - S.gap) : Math.max(wall - S.depth, opp + S.gap);
    if (top ? tip <= wall : tip >= wall) continue;
    for (let q = a; q <= z; q++) {
      const u = (q - a) / w, e = k * Math.sin(Math.PI * u) ** S.pow;
      if (top) C[q] = Math.max(C[q], lerp(C[q], tip, e)); else F[q] = Math.min(F[q], lerp(F[q], tip, e));
    }
    list.push((i0 + a) * TS, (i0 + z) * TS);
  }
}
/** the spurs built this descent, by slot: flat [x0, x1, x0, x1, ...] in world x (spawnHazard keeps hazards off them) */
const SPURS = [];
/** screen x moved off any spur's span (+8 px), to its nearer side: a hazard born on a spur tip would start 50-80 px
 *  nearer the lane than its tell reads (level-designer review). Pure of the sim RNG */
function offSpur(x, sc) {
  const wx = x + sc;
  for (const L of SPURS) if (L) for (let j = 0; j < L.length; j += 2) if (wx > L[j] - 8 && wx < L[j + 1] + 8) return (wx - L[j] < L[j + 1] - wx ? L[j] - 8 : L[j + 1] + 8) - sc;
  return x;
}
/** the inset's swept-fit guard (route-probe S1 is 100): keep >= `keep` px, reading the un-inset fit within `reach` px */
const INSET_FIT = { keep: 108, reach: 24, slope: 1 };
/** the last biome stage (slot `slot`) cleared: the biome's look and hazards hand back to the ship (the Gravity Drive
 *  approach) from just off-screen. G.bx[slot + 1] is where that biome ends */
export function biomeExit(slot) {
  const G = $.G;
  if (!G || !G.bx || G.bx[slot + 1] != null || !G.route[slot]) return;
  G.bx[slot + 1] = G.scroll + W + 10;
}

// ---------------- enemy script for a biome slot ----------------
const FM = 4;
const SPAWN = {
  // biome formations are a size smaller than Open Orbit's (FM drones, + rank as everywhere): the biome's own creatures carry the stage
  corpse: () => corpse(rr(50, PH - 80)), wall: () => formation('wall', PH / 2, FM), sine: () => formation('sine', rr(50, PH - 90), FM),
  zig: () => formation('zig', rr(60, PH - 90), FM), dive: () => formation('dive', rr(50, PH - 90), FM), cross: () => crossT(R() < .6 ? 1 : -1),
  eye: () => eyeT(R() < .55 ? 1 : -1), flayer: () => flayer(rr(60, PH - 60)), hook: () => hookE(), womb: () => womb(),
  // the rear coin stays .5: W6 r4 tried .35 (N4), but with the enemies stream's ENTRY.mix refit N2 (regular shooters'
  // rear hits) read 18% (floor 20); the lead's condition was to keep N2 above its floor
  hatch: () => hatch(ri(5, 8), R() < .5), crawler: () => crawler(R() < .6 ? 1 : -1), behind: () => behindWave(rr(70, PH - 70), FM),
};
Object.assign(SPAWN, { slime: () => slime(R() < .65 ? 1 : -1), mutant: () => mutant() }); // new enemies: snot slime (floor or ceiling), hulking mutant (floor)
/** the drone formation kinds of the spawn roll (W1's entry mix applies to these) */
const DRONE_KINDS = new Set(['sine', 'zig', 'dive', 'wall', 'behind']);
/** an export of a module that may not have it yet (W1's branch), or null; a vitest mock throws on a missing key */
const w1 = (m, k) => { try { return typeof m[k] === 'function' ? m[k] : null; } catch (e) { return null; } };
/** the spawn-roll kinds (test hook: midslot.ts BIOME_FILL must list exactly these as filler) */
export const SPAWN_KINDS = Object.keys(SPAWN);
/** merge script entries into the unplayed part of G.script, kept sorted by x (a stable sort: equal x keep their
 *  order, entries already there first) */
export function insertScript(entries) {
  const G = $.G, rest = G.script.slice(G.si).concat(entries).sort((a, b) => a.x - b.x);
  G.script = G.script.slice(0, G.si).concat(rest);
}
// B.logs is a pool (spec §3.2): short reads lines 1-2 as before; long layouts take three per visit (logPick).
// Lines 3-4 are drafts for the writer's pass (D8 copy rules)
// one signature set piece per biome, dropped in twice per slot; a repeat visit swaps in the second one (remix)
const later = (t, f) => $.G.pend.push({ t, f });
const FIXED = { fixed: 1 };
/** a set piece's fixed spawn height y, kept out of the terrain mass where it enters (x = W + 20) when a movement B band
 *  (long layouts) has moved the walls there: S2 sits inside the gimmick, and a stair, lake or spire floor can stand above
 *  a fraction of PH that is open on movement A (systems review). Outside every band (always, on short) it is y */
const bandY = (y) => { const wx = $.G.scroll + W + 20; return bandClamp(y, wx, ceilAt(wx), floorAt(wx)); };
/** the rear-wave lane filter's sampling (rearY). A rear wave enters at the left edge and crosses the whole screen at a
 *  fixed y, so the lane has to be open over all of it, not just where it enters. The drones move in screen space while
 *  the screen scrolls, so the terrain they cross runs well past the right edge of the screen at the call */
const REAR = {
  x0: -20, // screen x of the first sample: the lead drone spawns at x = -16 (spawn.ts formation 'behind'), sampled a little behind it
  x1: W, // to the right edge: the wave flies until it leaves the screen
  v: 1.8, // px/f a rear drone flies in screen space (enemies/update.ts, pat 'behind': e.x += 1.8); the screen scrolls 1 px/f
  tail: 32, // the last drone of a 3-drone set-piece wave (backdraft) spawns 32 px behind the lead (spawn.ts: -16 - i * 16)
  step: 16, // world px between samples, every 4th terrain column (TS = 4 px): ~50 samples a call, at the telegraph and the spawn
  // the y the drones fly at is y0 + sin(..) * 14 + (x > W / 2 ? (i - 2) * (x - W / 2) * .06 : 0) (update.ts 'behind').
  // For a set piece's wave (n <= 3, i - 2 <= 0) the fan only lifts, by at most 2 * (W / 2) * .06 = 28.8 at the right edge
  dn: 7 + 14, // pad toward the floor: drone radius (ET.drone.r 7) + the bob (14)
  up: Math.ceil(7 + 14 + 2 * (W / 2) * .06), // pad toward the ceiling: radius + bob + the fan, 49.8 -> 50
  lead: 100, // spawn.ts rearWarn's telegraph (a literal there): a rear wave spawns 100 f, ~100 px at 1 px/f, after its call
};
/** the world x offset (from G.scroll at the spawn) the drones' flight reaches: a drone at screen x sx has flown
 *  (sx - x0) / v frames, and the screen has scrolled that far, so it is over world scroll + sx + (sx - x0) / v; the last
 *  drone reaches the right edge tail / v frames after the lead */
const REAR_END = REAR.x1 + (REAR.x1 - REAR.x0 + REAR.tail) / REAR.v;
/** a set piece's rear-wave lane y (behindWave's fit), clamped into the opening the whole flight crosses; when no lane
 *  is open end to end it takes the middle of the tightest one. On a layout with no arena run-up (short, legacy: the
 *  same test as biomeScript's) it is y, so short's pincer is unchanged. Reads terrain and scroll only, never R() */
export const rearY = (y) => {
  if (layout().beats.runup == null) return y;
  let ce = 0, fl = PH;
  // world x from scroll + x0 to scroll + REAR_END, the span the flight covers (screen x0..x1 mapped as above), every step px
  for (let o = REAR.x0; ; o = Math.min(o + REAR.step, REAR_END)) {
    const wx = $.G.scroll + o; ce = Math.max(ce, ceilAt(wx)); fl = Math.min(fl, floorAt(wx));
    if (o >= REAR_END) break;
  }
  return ce + REAR.up <= fl - REAR.dn ? clamp(y, ce + REAR.up, fl - REAR.dn) : (ce + fl) / 2;
};
const SET = {
  morgue: () => { corpse(bandY(PH * .25)); corpse(bandY(PH * .5), { drift: .2 }); corpse(bandY(PH * .75)); later(40, mutant); }, // a frozen crew drifting in a line, a hulk walking under it
  // set pieces are fixed: formation()'s power drones (up to +6) would close the walls' gap and stretch the pincer's wave
  walls: () => { formation('wall', bandY(PH * .33), 2, FIXED); formation('wall', bandY(PH * .67), 2, FIXED); crawler(1); crawler(-1); }, // a double wall, gap in the middle, crawlers on the lining
  pincer: () => { flayer(bandY(55)); flayer(bandY(PH - 75)); behindWave(PH / 2, 2, FIXED, rearY); }, // flayers top and bottom, a short rear wave between them
  flood: () => { hatch(ri(7, 9), false); hatch(ri(4, 6), true); slime(1); later(30, () => slime(-1)); },
  // remix sets
  crucify: () => { crossT(1); crossT(-1); later(30, mutant); later(70, () => crossT(R() < .5 ? 1 : -1)); }, // the shelves are lined with crucifixes
  gutter: () => { womb(); crawler(1); crawler(-1); later(35, () => { crawler(1); crawler(-1); }); later(70, () => eyeT(1)); }, // the lining crawls
  kiln: () => { mutant(); hookE(); later(40, () => { hookE(); flayer(bandY(PH / 2)); }); later(80, mutant); }, // the meat line: hulks under swinging hooks
  drip: () => { slime(1); slime(-1); later(35, () => { slime(1); slime(-1); }); later(70, () => { slime(1); womb(); }); }, // the walls run with slimes
  // the catalogue's new pieces (src/setdraw.ts CATALOG; LS2-mv). Their later() waits stop at 55 f (the older pieces above
  // go to 80 f), but a behindWave lands 100 f after it is called (spawn.ts rearWarn): backdraft's second wave spawns at
  // 20 + 100 = 120 f. biomebeats.test.ts drains G.pend on a frame clock and checks every piece's spawns land before the
  // run-up from S3's planned x (a first visit's S3 is 126 px before it)
  thaw: () => { corpse(bandY(PH * .2)); later(25, () => corpse(bandY(PH * .5), { drift: .2 })); later(50, () => corpse(bandY(PH * .8))); }, // the crew thaw out of the wall one at a time, top to bottom
  vigil: () => { eyeT(1); eyeT(-1); later(40, () => corpse(bandY(PH / 2))); }, // eyes in the ice on both shelves, a body between them
  pack: () => { mutant(); flayer(bandY(PH * .3)); later(45, mutant); }, // two hulks walking, a flayer riding over them
  slurry: () => { formation('sine', bandY(PH * .3), 3, FIXED); later(30, () => formation('sine', bandY(PH * .7), 3, FIXED)); later(55, () => crawler(1)); }, // two thin streams through the tank, the second behind the first, something crawling after them
  vats: () => { womb(); later(45, womb); eyeT(-1); }, // wombs on the lining, one eye watching from above
  lining: () => { eyeT(1); eyeT(-1); hatch(ri(4, 6), true); }, // the lining opens: eyes either side, hatchlings from behind
  meatline: () => { hookE(); later(25, hookE); later(50, hookE); flayer(bandY(PH / 2)); }, // the hooks swing in one after another
  backdraft: () => { behindWave(PH * .3, 3, FIXED, rearY); later(20, () => behindWave(PH * .7, 3, FIXED, rearY)); mutant(); }, // the fire comes round behind in two waves, a hulk holds the front. 20 f, not 40 (ls1-audit, game-designer): at 40 the second wave spawned 13 px into the run-up when drawn as a first visit's S3; 20 lands it 7 px short and still reads as two waves. Long layouts only (short never draws the catalogue)
  cinders: () => { formation('dive', bandY(PH * .3), 3, FIXED); later(40, () => flayer(bandY(PH * .7))); }, // a short dive, a flayer under it
  sneeze: () => { hatch(ri(6, 8), true); hatch(ri(3, 5), false); }, // it blows through from behind, a few come the right way (fewer than flood's front wave: a rear wave costs more)
  clot: () => { womb(); later(30, () => { slime(1); slime(-1); }); later(55, () => hatch(ri(3, 4), false)); }, // the passage plugs: a womb lodges, the walls run, then the plug spits its brood (drip is slimes first, the womb last)
  congestion: () => { corpse(bandY(PH / 3)); corpse(bandY(PH * 2 / 3)); later(45, () => hatch(ri(3, 5), false)); }, // two bodies block the passage, hatchlings press through them
};
/** the set pieces there are (test hook: setdraw.ts CATALOG must name only these) */
export const SET_KINDS = Object.keys(SET);
/** long4's authored opening carriers: [p in the spawn span, spawn height as a fraction of PH] (DIFFICULTY-SPEC §2.2:
 *  2 per biome stage in its first 45 s, ~1 pod every 10 s with the release; gate E2 counts fixed:open) */
const OPEN_PODS: readonly [number, number][] = [[.05, .4], [.2, .6]];
/** which drawn set piece the signature's v2 replaces (0-based: S2, levels.md §5.0b) */
const SIG_SET = 1;
/** a repeat visit to a biome (v = earlier visits this run): its own second signature + set, the set pieces moved, some
 *  of its kinds gone, its drone pattern swapped (add), two kinds borrowed from other biomes (a fresh pick each time),
 *  and more elites (enemies/elite.ts) */
export function remix(b, v, loop, rs) {
  const B = BIOMES[b], X = B.remix, mix = B.mix.concat(loop > 0 && B.late ? B.late : []), BT = layout().beats;
  if (!v || !X) return { sig: B.sig, set: B.set, mix, sets: BT.sets.slice(), cross: [] };
  const pool = X.pool.slice(), cross = [];
  while (cross.length < 2 && pool.length) cross.push(pool.splice(Math.floor(rs() * pool.length), 1)[0]);
  return { sig: X.sig, set: X.set, mix: mix.filter((m) => !X.drop.includes(m[0])).concat(X.add || [], cross), sets: BT.remixSets.slice(), cross: cross.map((c) => c[0]) };
}
/** the biome's second-ranked mix kind for this visit: the heaviest kind in the mix that isn't the signature (the
 *  first listed wins a tie). Intro B gives it its own first slot (spec §3.2: one idea per wave) */
export function secondKind(X) {
  let k = null, w = -1;
  for (const [n, m] of X.mix) if (n !== X.sig && m > w) { k = n; w = m; }
  return k;
}
/** the three log lines of a visit from the biome's pool (B.logs): line 1 at the entrance, 2 at the release, 3 at the
 *  arena run-up. A repeat visit rotates the pool by three, so it opens on lines a first visit didn't end on. No RNG */
export const logPick = (B, v) => [0, 1, 2].map((k) => B.logs[(k + 3 * v) % B.logs.length]);

/** biome slot seg's script from world x `from` (the gate), v = earlier visits to b this run. Every build-time roll
 *  (the remix, the kind rolls, extras) comes from rs, the stage's build stream (src/rng.ts; default: this run's stream
 *  for that stage), so the same inputs always give the same x and kind list. Elite rolls stay at spawn time on the sim
 *  R() (el(), below; spec §4). Every entry carries `k`, what it spawns. The beats are layout().beats through
 *  beatPlan (src/layout.ts): short's single breath, or long4's beat template v2 (spec §3.2). setIds: the stage's drawn
 *  set pieces in play order (stagePicks); null is the visit's one signature piece, three times (short). sigOn: the stage
 *  flies its biome signature (biomeStage: long4, movement B0), whose v2 replaces set piece S2; S2's draw is still
 *  consumed, so G.spUsed and the pick stream hold (levels.md §5.0b) */
export function biomeScript(seg, b, from, v = 0, rs = stageStream(stageOfSlot(seg)), mids = null, setIds = null, sigOn = false) {
  const B = BIOMES[b], g = slotRow(seg), BT = layout().beats, S = [], at = (x, f, k) => S.push({ x, f, k }), hard = $.G.loop > 0, X = remix(b, v, $.G.loop, rs), MX = X.mix;
  const tot = MX.reduce((s, m) => s + m[1], 0), roll = () => { let r = rs() * tot, k = 0; while ((r -= MX[k][1]) > 0 && k < MX.length - 1) k++; return MX[k][0]; };
  // elites: every spawn this slot makes (rear waves and staggered set pieces included) rolls eliteChance once
  const ep = eliteChance($.G.loop, v), el = (f) => !ep ? f : () => {
    const n0 = enemies.length, p0 = $.G.pend.length;
    f();
    eliteRoll(enemies.slice(n0), ep, R);
    for (let i = p0; i < $.G.pend.length; i++) $.G.pend[i].f = el($.G.pend[i].f);
  };
  // the beat plan (layout().beats, src/layout.ts beatPlan): span [a, z], p -> x, the BREATHS, the midboss WARNING
  const BP = beatPlan(g, from, !!v), { a, z, mid, P, breaths: BR } = BP, legacy = BP.runup == null, logs = legacy ? B.logs : logPick(B, v);
  at(a - 40, () => logLine(logs[0]), 'log');
  if (legacy) at(mid, () => logLine(logs[1]), 'log'); // short: line 2 at the span's midpoint
  const SB = slotBoss(seg); // a registered stage boss ends this slot (D55), or null for the biome's own
  if (SB && SB.prep) SB.prep(); // its lazy sound banks start decoding now, a minute before its WARNING (audio only)
  if (!legacy) at(BP.runup, () => logLine((SB && SB.runup) || logs[2]), 'log'); // arena run-up: line 3 (line 2 is the release, below), or the boss's own
  const sig = () => (rs() < .6 ? X.sig : roll()), sets = X.sets.map(P), two = secondKind(X);
  let setN = 0; // which drawn set piece is next (setIds)
  const inBreath = (y) => { for (const r of BR) if (y >= r.a && y < r.z) return r; return null; };
  const quiet = (y) => inBreath(y) || (!legacy && y >= BP.runup); // where an extra may not land: a breath, the run-up
  // where kind k entered at x really spawns: a rear filler (`behind`) lands REAR.lead px late, so it is checked there and
  // dropped if that is quiet (ls1-audit, game-designer). Long layouts only: on short it is x, and every check below is the
  // one that was there (pk() still draws, so the build stream's order holds)
  const lands = (x, k) => (!legacy && k === 'behind' ? x + REAR.lead : x);
  // the tempo band (layout().beats.tempo) for scroll x at progress q: the first whose `until` is still ahead
  const band = (x, q) => { for (const T of BT.tempo) if (typeof T.until === 'number' ? q < T.until : x < BR[T.until.breath].z) return T; return BT.tempo[BT.tempo.length - 1]; };
  const led = new Set();
  // long4 (DIFFICULTY-SPEC §2.3 entry mix, biome A 55/15/10/10/10, B 50/18/12/12/8): a filler drone beat takes its entry
  // edge from W1's cellpick droneEntry on one draw of this build stream (never the sim R()), and spawns through
  // spawn.ts entryWave (top / bottom chevrons, rear waves, wall births). Before W1 lands (no such exports) it is the
  // biome's own spawner, as on short
  const entry = isL4() && !legacy ? w1(CPK, 'droneEntry') : null, wave = entry ? w1(SPW, 'entryWave') : null;
  const spawnOf = (k) => { if (!wave || !DRONE_KINDS.has(k)) return SPAWN[k]; const e = entry('biome', seg, rs()); return () => wave(e, rr(50, PH - 90), FM); };
  // long4: two authored opening carriers (DIFFICULTY-SPEC §2.2 faucet, levels.md §5.0b): fixed formations at p .05 and
  // .20 whose last kill always drops (pod), tagged open (pod-probe's fixed:open, gate E2). Fixed heights and no rs()
  // draw, so the build stream's order is unchanged
  // W6 r4 (N4, enemies stream / lead): the second opener comes in from an edge (slot A drops from the top, slot B rises
  // from the bottom: spawn.ts edgeWave, its ENTRY tell), keeping its authored pod; the authored beats put ~43% of A's
  // entries on the right before the filler rolled. Fixed heights / edges, no rs()
  if (isL4() && !legacy) OPEN_PODS.forEach(([p, y], i) => at(P(p), () => (i && w1(SPW, 'edgeWave') ? w1(SPW, 'edgeWave')(seg ? 'rise' : 'drop', FM, { fixed: 1, pod: 1, open: 1 }) : formation('sine', PH * y, FM, { pod: 1, open: 1 })), 'pod:open'));
  for (let x = a; x < z;) {
    const q = (x - a) / (z - a), T = band(x, q), st = Math.round(B.gap * T.gap), y2 = x + Math.round(st * .45), y3 = x + Math.round(st * .72);
    const br = inBreath(x);
    if (br) {
      x = br.z;
      // the release: one guaranteed pod formation (a drone wave drops a pod when it's wiped out; pod: exempt from the D31
      // grpPod cut, economy.ts) and log line 2
      if (br.release) { at(x, () => logLine(logs[1]), 'log'); at(x, el(() => formation('sine', PH / 2, FM, { pod: 1 })), 'pod'); x += st; }
      continue;
    }
    if (T.stop) break; // the arena run-up: nothing spawns from here to the boss
    if (sets.length && x + st / 2 > sets[0]) {
      const sx = legacy ? x : sets[0], id = (setIds && setIds[setN]) || X.set; sets.shift(); setN++;
      if (sigOn && setN === SIG_SET + 1) { x += st; continue; } // the signature's v2 takes S2's place: its slot stays empty
      at(sx, el(SET[id]), 'set:' + id); x += st; continue;
    }
    const pk = T.sig ? sig : roll, dbl = T.rel ? Math.min(.85, B.dbl + T.dbl) : T.dbl;
    if (T.lead && !led.has(T)) { led.add(T); const k = T.lead === 'sig' || !two ? X.sig : two; at(x, el(SPAWN[k]), k); x += st; continue; } // the band's first slot, alone
    const k1 = pk();
    if (!quiet(lands(x, k1))) at(x, el(spawnOf(k1)), k1); // x itself is never quiet here (breaths skip above, the run-up stops)
    if (rs() < dbl && !quiet(y2)) { const k = pk(); if (!quiet(lands(y2, k))) at(y2, el(spawnOf(k)), k); } // extras never spill into a breath or the run-up
    const p3 = T.third === true ? .35 : T.third || 0; // a number is the chance (long4's climax, layout.ts); true is 35%
    if (hard && p3 && rs() < p3 && !quiet(y3)) { const k = pk(); if (!quiet(lands(y3, k))) at(y3, el(SPAWN[k]), k); }
    x += st;
  }
  midBeats(B, b, BP, mids, at);
  const boss = SB ? () => SB.spawn(b) : { crux, butcher, maw: () => maw(true) }[B.boss], bName = SB ? SB.name : B.bossName;
  at(g.bossX, () => { if (SB && SB.warn) SB.warn(); miniWarn(bName, () => { boss(); if ($.G.mini) { $.G.mini.title = bName; $.G.mini.biome = b; } }); }, 'boss:' + (SB ? SB.k : B.boss));
  return S;
}

/** the midboss breaths' centerpieces, placed through at(x, f, k). Each WARNING sits 150 f (~150 px) ahead, so the
 *  midboss lands ~60 px before its breath's end and the scroll coasts to a stop inside it */
function midBeats(B, b, BP, mids, at) {
  if (!mids) { // short (no picker): the biome's own midboss, as before
    const k = HOME[b], nm = MID_NAMES[k]; // the first finished row of its pool (a wip row may sit above it)
    if (BP.warn != null) at(BP.warn, () => miniWarn(nm, () => midboss(k, nm, b)), 'mid:' + k);
    return;
  }
  mids.forEach((k, s) => { // picker layouts (item F): the stage's picks (stageMids), slot A then slot B
    if (BP.warns[s] == null) return;
    const name = midName(k), go = () => midSlot(k, b, s, BP);
    // slot B's WARNING and its spawn wait while G.mini is up (spec §3.2 rule 2): midboss() would overwrite slot A
    at(BP.warns[s], s ? () => whenNoMini(() => miniWarn(name, () => whenNoMini(go))) : () => miniWarn(name, go), 'mid:' + k);
  });
}

/** stage i's build stream for this run and descent (src/rng.ts): Rs = stream(seedOf(G.seed, G.loop, i)), fresh
 *  each call, so every build of a stage replays the same draws */
export const stageStream = (i) => stream(seedOf(($.G && $.G.seed) || 0, ($.G && $.G.loop) || 0, i));
/** stage i's build-picks stream (movement-B variant, set pieces): salted like midStream, independent of Rs (src/rng.ts) */
export const pickStream = (i) => stream(pickSeedOf(($.G && $.G.seed) || 0, ($.G && $.G.loop) || 0, i));
/** stage i's midboss-pick stream (src/rng.ts midSeedOf): the ONLY stream midpick.ts pickMids/pickBiomeMids may be
 *  given (item F). Never pass stageStream(i) to the picker: the pick would then depend on how many draws the script
 *  made. Fresh each call, independent of stageStream(i), so the pick and the script can run in either order */
export const midStream = (i) => stream(midSeedOf(($.G && $.G.seed) || 0, ($.G && $.G.loop) || 0, i));

/** biome stage i's build picks on a layout with moveB (biome b, v earlier visits): the movement-B variant mv and the
 *  set pieces sp, drawn once and read back on a rebuild, as G.mb is (a resume must not draw again: G.spUsed has moved).
 *  From pickStream(i), salted apart from the script's stream: a rebuild skips this draw, so the script's rolls can't
 *  shift, and the picks don't replay the script's first draws. Writes G.spUsed and G.mvSeen (both run-long, saved) */
export function stagePicks(i, b, v) {
  const G = $.G, P = (G.picks ||= {});
  if (!P[i]) P[i] = drawPicks(b, v, G.loop, (G.spUsed ||= {}), pickStream(i), (G.mvSeen ||= {}), layout().beats.sets.length);
  return P[i];
}

/** build biome slot seg's stage from world x `from` (its gate, G.bx[seg]): blend its terrain in and script it.
 *  Reads the biome and visit number choose() stored (G.route[seg], G.visitNo[seg]), so a resume can call it again
 *  with the stored bx (and the stored G.mb: the picks are made once). Draws only the stage's build stream and, on a
 *  picker layout, its midboss stream; never the sim R() */
export function biomeStage(seg, from) {
  const G = $.G, b = G.route[seg], v = G.visitNo[seg], i = stageOfSlot(seg);
  const pk = layout().beats.moveB ? stagePicks(i, b, v) : null;
  // the picks come first now (the inset reads which midboss breaths are held): midStream(i) is independent of the
  // terrain and of stageStream(i), so the order doesn't move either
  const mids = layout().picker ? stageMids(i, b, seg) : null, sp = sigPlanOf(seg, b, from, v, pk && pk.mv, mids);
  rewriteTerrain(seg, b, from, pk && pk.mv, mids, sp);
  insertScript(biomeScript(seg, b, from, v, stageStream(i), mids, pk && pk.sp, !!sp));
  armSigs(seg, b, sp);
}

// ---------------- midbosses (picker layouts: build plan LS1 row F, spec §6.3-6.4) ----------------
/** the midboss state of the run: G.mb[stage] = that stage's picks, G.mbUsed = met this descent, G.mbLast[key] = a
 *  stage's previous pair (whole run). A stage is picked once: a rebuild (resume, item H) reads G.mb back */
const midState = () => { const G = $.G; G.mb ||= {}; G.mbUsed ||= []; G.mbLast ||= {}; return G; };
/** biome stage i's midbosses (biome b): picked on first call from midStream(i), never stageStream(i) */
export function stageMids(i, b, seg = null) {
  const G = midState();
  if (!G.mb[i]) {
    // THE KEEPSAKE's Descent 1 stage flies midboss A only (midpick.ts midsWanted, DIFFICULTY-SPEC C24)
    const n = seg != null && isL4() ? midsWanted(bossFor(seg, G.loop || 0, !!layout().picker), G.loop || 0) : 2;
    const picks = pickBiomeMids(G, b, G.loop, midStream(i), $.meta && $.meta.mb, false, midsWip(), n).picks, f = midForce();
    G.mb[i] = f ? forceSlotA(picks, f) : picks; // ?mid=<wip kind>: the test path (lab.ts forcedMid); the draw is made either way
  }
  return G.mb[i];
}
/** a non-biome stage whose midbosses are fixed by its layout row (Open Orbit's Saucer, the row's drift entry, in every
 *  descent: so Descent 1 always meets it, spec §6.2): record them as met so no biome stage repeats their body */
export function fixedMids(i, kind, kinds) {
  const G = midState();
  if (G.mb[i] || !kinds.length) return;
  G.mb[i] = kinds.slice();
  noteMids(G, kind, kinds);
}
/** a midboss's name from the registry. An unregistered kind throws: the WARNING banner must never show a raw internal
 *  key. A DRIFT test stub registers a name with no roster row, so driftOf still counts */
function midName(k) {
  const n = MID_NAMES[k] || (driftOf(k) && driftOf(k).name);
  if (!n) throw new Error(`midboss '${k}' has no name (no row in enemies/mid/roster.ts)`);
  return n;
}
/** spawn slot s's midboss k in biome b on its slot clock; a DRIFT kind is forced out at the breath plan's driftExit */
function midSlot(k, b, s, BP) {
  const D = driftOf(k), leave = slotClock(k, s);
  // a DRIFT kind must come through its registered spawner: midboss() would make it a held midboss
  if (!D && MIDS[k] && MIDS[k].tag === 'DRIFT') throw new Error(`DRIFT midboss '${k}' is not registered (midslot.ts registerDrift)`);
  if (D) {
    const x = BP.driftExit[s];
    // a DRIFT midboss needs its stage-relative forced exit (spec §3.2 rule 1): a layout with DRIFT biome slots sets beats.driftLead
    if (x == null) throw new Error(`layout ${layout().id}: DRIFT midboss '${k}' in a biome slot but no beats.driftLead`);
    D.spawn(x, leave);
  }
  else midboss(k, midName(k), b, leave);
}

// ---------------- the fork ----------------
export function holdForFork() { $.G.forkHold = true; }
export function openFork(seg) {
  // picker layouts: acid and snot never in the same descent (spec §6.5 interim, midpick.ts forkAllows); short: all four
  const G = $.G, ok = layout().picker ? (k) => forkAllows(k, G.route) : () => true, fresh = BIOME_KEYS.filter((k) => ok(k) && !G.route.includes(k) && !(G.visited || []).includes(k));
  const rest = BIOME_KEYS.filter((k) => ok(k) && !G.route.includes(k) && !fresh.includes(k)).sort(() => R() - .5);
  const pool = [...fresh.sort(() => R() - .5), ...rest].slice(0, 2).sort(() => R() - .5);
  G.fork = { seg, opts: pool, t: 0 };
  G.fork.gy = gateYs();
  G.forkHold = true;
  haz.length = 0; // anything left over (a strand parked off-screen) doesn't follow you through the gate
  if (G.tally) G.tally.t = Math.min(G.tally.t, 30); // the stage card fades out as the gates open (it covers their labels)
  banner('THE SHIP SPLITS', 'FLY INTO A GATE', '#e8f1ff', 160);
  sfx.forkOpen();
}
function choose(b) {
  const G = $.G, f = G.fork, seg = f.seg;
  G.route[seg] = b;
  const v = ((G.bvis ||= {})[b] || 0); // earlier visits to this biome this run: 1+ = remix
  G.bvis[b] = v + 1;
  (G.visitNo ||= Array(nSlots()).fill(0))[seg] = v; // the music's repeat-visit mix reads it (music.ts)
  G.fork = null;
  G.forkHold = false;
  const from = Math.max(slotRow(seg).x0, G.scroll + W + 10);
  (G.bx ||= Array(nSlots() + 1).fill(null))[seg] = from;
  biomeStage(seg, from); // the gate is this stage's entry: build it here (stagebuild.ts buildStage)
  G.pend.push({ t: 40, f: () => startStage(stageOfSlot(seg)) });
  flash($.P.x, $.P.y, 80, 18, BIOMES[b].rgb);
  sfx.power();
  buzz('heavy');
}
const gatePos = (i) => ({ x: W * .74, y: ($.G.fork && $.G.fork.gy) ? $.G.fork.gy[i] : i ? PH * .72 : PH * .28 });
/** gate heights for the terrain that's actually on screen: a fire spire or ice shelf must never bury a gate */
function gateYs() {
  const wx = $.G.scroll + W * .74;
  let lo = -1e9, hi = 1e9;
  for (let x = wx - 30; x <= wx + 30; x += 6) { lo = Math.max(lo, ceilAt(x)); hi = Math.min(hi, floorAt(x)); }
  lo = Math.max(lo, 0) + 28; hi = Math.min(hi, PH) - 28;
  let a = clamp(PH * .28, lo, hi), b = clamp(PH * .72, lo, hi);
  if (b - a < 56) { const m = (lo + hi) / 2; a = Math.max(lo, m - 28); b = Math.min(hi, m + 28); }
  return [a, b];
}

// ---------------- hazards + ambience ----------------
const haz = [], amb = [];
export function biomeReset() {
  haz.length = amb.length = MOVES.length = SPURS.length = 0;
  sigClear(null);
  applyPalette(null);
  if ($.G) { $.G.bx = Array(nSlots() + 1).fill(null); $.G.hazT = 90; $.G.hazHit = 0; $.G.hazN = 0; $.G.mb = {}; $.G.mbUsed = []; $.G.picks = {}; $.G.sigW = {}; } // a new descent forgets what it met (spec §6.3 step 2); G.mbLast and G.spUsed are kept
}

/** spawn one biome hazard of kind b ('icicle' | 'geyser' | 'jet' | 'strand') on the random timer's rules. Exported for
 *  the fights (W4: the Bloat's icicle curtain); a placed one goes through spawnHazardAt */
export function spawnHazard(b) {
  const G = $.G, P = $.P, nearX = isL4() ? SPACE.noSpawn : 46; // C9: hazards 48 px from the ship on long4 (46 before)
  // D61 "it notices you" (src/notice.ts): every 3rd column hazard (1 in 2 in Descent 3) is aimed. It drops where the
  // ship's column will be when it reaches the ship's height if the ship holds still, and is marked (h.aim: biomeart draws
  // D59's hatched column band over its whole warm-up, 50-70 f). The rest still re-roll off the ship
  // D62: and none while a midboss or boss is up (NOTICE.hazInFight false); the count still advances
  const n = G.hazN = (G.hazN || 0) + 1, fight = (G.mini && !G.mini.dead) || G.boss;
  const N = noticeOf(econId()); // D63: long4 runs D61's rates (every 3rd, 1 in 2 in Descent 3, in fights too)
  const aim = !!P && P.alive && hazAimed(n, G.loop || 0, b, N) && (N.hazInFight || !fight);
  let x;
  if (aim) {
    const c0 = ceilAt(P.x + G.scroll);
    x = hazLeadX(b, P.x, P.y, G.scrollSpeed, c0 + 16, W);
  } else {
    x = rr(W * .45, W * .9);
    for (let k = 0; k < 8 && P && Math.abs(x - P.x) < nearX; k++) x = rr(W * .45, W * .9); // never drop it on the ship
  }
  // the Chimney (movement B1): jets come down its vents. A vent past the right edge would burn its telegraph off-screen
  let vent = false;
  if (b === 'jet') ({ x, vent } = snapVent(x, G.scroll, W)); // src/terrainb.ts; never on short (no bands)
  if (!vent && isL4()) x = offSpur(x, G.scroll); // W6: never on a spur (long4 only: short has none)
  if (!aim && P && Math.abs(x - P.x) < nearX) return;
  const wx = x + G.scroll, c = ceilAt(wx), f = floorAt(wx);
  let h = null;
  if (b === 'icicle' && c > 4) h = { k: b, x, y: c + 2, t: 0, vy: 0, len: rr(10, 18) };
  else if (b === 'geyser' && f < PH - 2) h = { k: b, x, y: f, t: 0, top: c };
  else if (b === 'jet') { const up = (vent || (aim ? P.y < (c + f) / 2 : R() < .5)) && c > 4; h = { k: b, x, y: up ? c : f, dir: up ? 1 : -1, t: 0, span: f - c }; if (vent && up) h.vent = 1; } // vent: the Chimney's own jet (biomeart draws its telegraph bold)
  else if (b === 'strand' && G.scrollSpeed > .5) h = { k: b, x: W + 10, t: 0, hp: 3, ph: R() * TAU };
  if (!h) return;
  if (aim) h.aim = 1;
  haz.push(h);
}
/** a placed hazard at screen x: kind k, `up` (a jet from the ceiling, else the floor), `aim` (draw the marked column),
 *  `shootable` (an icicle the ship's fire may break on long4; ICICLE.immune otherwise), `live` (a jet's burn, frames).
 *  No R(): the caller places it. Returns the hazard, or null where the terrain has no room for it. For the fights (W4)
 *  and the signatures */
export function spawnHazardAt(k, x, o: { up?: boolean; aim?: boolean; shootable?: boolean; live?: number; len?: number } = {}) {
  const wx = x + $.G.scroll, c = ceilAt(wx), f = floorAt(wx);
  let h = null;
  if (k === 'icicle' && c > 4) h = { k, x, y: c + 2, t: 0, vy: 0, len: o.len || 14 };
  else if (k === 'geyser' && f < PH - 2) h = { k, x, y: f, t: 0, top: c };
  else if (k === 'jet') { const up = !!o.up && c > 4; h = { k, x, y: up ? c : f, dir: up ? 1 : -1, t: 0, span: f - c }; }
  if (!h) return null;
  if (o.aim) h.aim = 1;
  if (o.shootable) h.shoot = 1;
  if (o.live) h.live = o.live;
  haz.push(h);
  return h;
}

/** a boss's own hazard drop (W4b's request: THE BLOAT's icicle curtain, boss/bossfights.ts crux3): an icicle at screen x
 *  under the ceiling, marked as an aimed one (h.aim: the hatched column band over its 50 f hang). Shootable (h.shoot:
 *  encounters.md's curtain is "shootable", and W4b measured it so), unlike long4's random icicles. No R() */
export function dropHazard(k, x) {
  const G = $.G;
  // never between stages (W6 r4, L5 hazBad [state:icicle] on ice,acid): the timer's own guard in stepBiome, for the drop
  if (k !== 'icicle' || !G || G.tally || G.fork || G.forkHold || G.clearT || !$.P || !$.P.alive) return;
  const c = Math.max(0, ceilAt(x + $.G.scroll)); // an open sky drops it from the top edge
  haz.push({ k, x, y: c + 2, t: 0, vy: 0, len: 14, aim: 1, shoot: 1 });
}
// W4b's src/boss/bossrules.ts HAZ_HOOK (a leaf module, no imports): registered at load (W6, the static import replaced
// the eager glob that let W3c build before W4b landed)
HAZ_HOOK.drop = dropHazard;
/** hand dropHazard to W4b's HAZ_HOOK again (idempotent; tests call it after swapping the hook) */
export function hookHazards() { HAZ_HOOK.drop = dropHazard; }

export function stepBiome() {
  const G = $.G;
  if (!G || !G.route) return;
  const sc = G.scroll, [b, k] = biomeK(sc + W / 2);
  applyPalette(k > .5 ? b : null);
  // fork gates
  if (G.fork) {
    const f = G.fork;
    f.t++;
    if ($.P && $.P.alive && f.t > 40) {
      const d = [0, 1].map((i) => { const p = gatePos(i); return dist2($.P.x, $.P.y, p.x, p.y); }), i = d[1] < d[0] ? 1 : 0;
      if (d[i] < 24 * 24) choose(f.opts[i]);
    }
    if (G.fork && f.t > 900) choose(pick(f.opts)); // nobody chose: the ship drifts into one
  }
  const B = b && BIOMES[b], ss = G.scrollSpeed;
  // ambient particles
  if (B && k > .2 && amb.length < 160) {
    const n = b === 'snot' ? .35 : 1.2;
    for (let i = 0; i < n * 2; i++) if (R() < n * .5) {
      if (b === 'ice') amb.push({ x: rr(0, W + 40), y: -4, vx: rr(-.6, -.2), vy: rr(.3, .9), l: 400, s: R() < .2 ? 2 : 1, c: R() < .5 ? '#e8f6ff' : '#9fd8ff' });
      else if (b === 'acid') amb.push({ x: rr(0, W + 30), y: PH + 4, vx: rr(-.2, .2), vy: -rr(.3, .9), l: 300, s: rr(1, 2.5), c: '#a6ff2a', bub: 1 });
      else if (b === 'fire') amb.push({ x: rr(0, W + 30), y: PH + 4, vx: rr(-.5, .3), vy: -rr(.6, 1.6), l: 220, s: 1, c: pick(FIRE), em: 1 });
      else amb.push({ x: rr(0, W + 30), y: -4, vx: 0, vy: rr(.2, .5), l: 600, s: rr(1.5, 3), c: R() < .5 ? '#c8c03a' : '#e8e07a', glob: 1 });
    }
  }
  for (let i = amb.length - 1; i >= 0; i--) {
    const p = amb[i];
    p.x += p.vx - ss * (p.em ? .2 : .5);
    p.y += p.vy;
    if (p.bub) p.x += Math.sin((p.y + i) * .1) * .3;
    if (--p.l <= 0 || p.y < -8 || p.y > PH + 8 || p.x < -10) amb.splice(i, 1);
  }
  // hazards
  // hazards: only while actually flying a biome (never during a fork / tally / death / pick / boss intro)
  const P0 = $.P;
  // long4: the timer pauses while a signature variation runs (C29: one threat type at a time at a peak), its base is the
  // Furnace's own cadence for fire (sigs.ts FURNACE), and rank scales it (x(1.15 - .3 rho), DIFFICULTY-SPEC §2.1)
  const L4 = isL4();
  if (B && k > .9 && $.state === 'play' && !G.fork && !G.forkHold && !G.tally && !G.pick && !G.clearT && P0 && P0.alive && P0.inv < 60 && !(L4 && sigPause())) {
    G.hazT = (G.hazT || 60) - 1;
    if (G.hazT <= 0) { spawnHazard(B.haz); G.hazT = hazInterval((L4 && b === 'fire' ? FURNACE.every : B.hazEvery) * (G.mini ? 1.6 : 1) * rr(.7, 1.3) / (1 + .3 * G.loop) * (L4 ? hazRankMul(rhoNow()) : 1), sc + W / 2); } // hazInterval: movement B's rate, src/terrainb.ts
  }
  if (L4) stepSigs();
  const P = $.P;
  for (let i = haz.length - 1; i >= 0; i--) {
    const h = haz[i];
    h.t++;
    h.x -= ss;
    let dead = h.x < -30;
    if (h.k === 'icicle') {
      if (h.t > 50) { h.vy += .22; h.y += h.vy; }
      const wx = h.x + sc;
      if (h.y + h.len > floorAt(wx)) { dead = true; if (L4) { for (let q = 0; q < 10; q++) spark(h.x, floorAt(wx) - 2, srr(-2, 2), -srr(.5, 2.5), 10 + (q * 7) % 11, q % 2 ? '#e8f6ff' : '#9fd8ff'); } else for (let q = 0; q < 10; q++) spark(h.x, floorAt(wx) - 2, rr(-2, 2), -rr(.5, 2.5), ri(10, 20), q % 2 ? '#e8f6ff' : '#9fd8ff'); sfx.tink(); } // long4: a landing icicle's sparks draw srr (they land far more often now: no sim R() for fx)
      if (P && P.alive && Math.abs(P.x - h.x) < 5 && P.y > h.y && P.y < h.y + h.len + 4) { G.hazHit = 1; dead = true; }
    } else if (h.k === 'geyser' || h.k === 'jet') {
      const warm = h.k === 'geyser' ? 70 : 60, live = h.live || (h.k === 'geyser' ? 45 : 70); // h.live: a grill column burns until it has passed the ship
      if (h.grill) { // a grill column's sparks come from the render stream: a placed hazard adds no sim R() draws
        if (h.t < warm && srr(0, 1) < .4) spark(h.x + srr(-4, 4), h.y + h.dir * 2, srr(-.3, .3), h.dir * srr(.3, 1.2), 12, FIRE[(h.t >> 2) % FIRE.length]);
      } else if (h.t < warm && R() < .4) spark(h.x + rr(-4, 4), h.y - (h.dir || -1) * -2, rr(-.3, .3), (h.dir || -1) * rr(.3, 1.2), 12, h.k === 'geyser' ? '#7ff0d8' : pick(FIRE));
      if (h.t === warm) { sfx.glob(); if (h.k === 'jet') sfx.fireball && sfx.fireball(); }
      if (h.t >= warm) {
        const reach = (h.k === 'geyser' ? h.y - h.top : h.span) * (h.k === 'geyser' ? .62 : .55) * Math.min(1, (h.t - warm) / 8);
        h.reach = reach;
        const y0 = h.k === 'geyser' ? h.y - reach : h.dir > 0 ? h.y : h.y - reach, y1 = h.k === 'geyser' ? h.y : h.dir > 0 ? h.y + reach : h.y;
        if (P && P.alive && Math.abs(P.x - h.x) < 7 && P.y > y0 && P.y < y1) G.hazHit = 1;
        if (h.grill) { if (srr(0, 1) < .6) drop(h.x + srr(-3, 3), y0, srr(-1.2, 1.2), srr(-1.5, .5), srr(1, 1.6), 5, 40); }
        else if (R() < .6) drop(h.x + rr(-3, 3), y0, rr(-1.2, 1.2), rr(-1.5, .5), rr(1, 1.6), h.k === 'geyser' ? 2 : 5, 40);
        if (h.k === 'jet') light(h.x, (y0 + y1) / 2, 40, .9);
      }
      if (h.t > warm + live) dead = true;
    } else if (h.k === 'strand') {
      const wx = h.x + sc, c = ceilAt(wx), f = floorAt(wx);
      if (L4 && plugAt(wx)) { dead = true; sfx.squish(); } // levels.md §5.4: a strand that touches a plug is absorbed
      if (P && P.alive && Math.abs(P.x - h.x) < 5 && P.y > c && P.y < f) {
        P.slow = 55;
        dead = true;
        sample('splat_m', { vol: .8, rate: .7 }) || sfx.squish();
        for (let q = 0; q < 14; q++) drop(h.x, P.y + rr(-8, 8), rr(-2, 2), rr(-2, 1), rr(1.2, 2), 0, 80);
        pop(P.x, P.y - 12, 'SNOTTED', BIOMES.snot.col, 7, 40);
      }
      for (const s of shots) if (Math.abs(s.x - h.x) < Math.max(5, Math.abs(s.vx || 0) * .6 + 1) && s.y > c && s.y < f && !(s.hit && s.hit.has(h))) {
        (s.hit || (s.hit = new Set())).add(h);
        if (--h.hp <= 0) { dead = true; for (let q = 0; q < 10; q++) drop(h.x, s.y + rr(-10, 10), rr(-1, 1), rr(-1, 1), 1.4, 0, 70); sfx.squish(); }
      }
    }
    if (h.k === 'icicle' && L4 && ICICLE.immune && !h.shoot) { // long4: the ship's fire tinks off the ice and is spent (sigs.ts ICICLE)
      for (let j = shots.length - 1; j >= 0; j--) { const s = shots[j]; if (!dead && Math.abs(s.x - h.x) < Math.max(6, Math.abs(s.vx || 0) * .6 + 1) && s.y > h.y - 4 && s.y < h.y + h.len + 4) { shots.splice(j, 1); for (let q = 0; q < 3; q++) spark(h.x, s.y, srr(-2, 0), srr(-1.5, 1.5), 8, '#e8f6ff'); sfx.tink(); } }
    } else if (h.k === 'icicle') for (const s of shots) if (!dead && Math.abs(s.x - h.x) < Math.max(6, Math.abs(s.vx || 0) * .6 + 1) && s.y > h.y - 4 && s.y < h.y + h.len + 4) { dead = true; for (let q = 0; q < 8; q++) spark(h.x, h.y + h.len / 2, rr(-2, 2), rr(-2, 2), 12, '#e8f6ff'); sfx.tink(); }
    if (dead) haz.splice(i, 1);
  }
}

// ---------------- the biome signatures (long4; DIFFICULTY-SPEC §2.4, levels.md §5.1-5.4; numbers: src/sigs.ts) ----------------
// One run per planned variation (sigs.ts planSig), armed by its script entry `sig:<k>` and stepped every frame by
// stepSigs. A run only schedules: what moves the walls or makes a solid is the space engine (solids.ts), called below
// with W3a's API (scratchpad spec/W3A-API.md: armTide, armSwallow, spawnIce, spawnPlug). No R() anywhere: frame
// counters, world x and the ship's position; fx draw srr. Checkpoints sit before a window (its `cp`), and a rebuild
// (buildTerrain, then biomeStage) clears the runs, so nothing here is saved.
const SG = { runs: [] };

// ---- the space engine (W3a src/solids.ts, scratchpad spec/W3A-API.md): DYN windows (armTide, armSwallow) and the
// solids (spawnIce, spawnPlug) step in step.ts's stepSolids, before the ship moves, and draw in render/solids.ts. The
// W3c stand-in that lived here was swapped for these imports at the W6 merge. A lodged block and a plug are terrain
// class (they kill like walls through WARD, decision 5A); a flying block is a body hit (WARD takes it) ----
/** retire every solid this signature run (or slot prefix) made: marked dead, dropped at the engine's next step. The DYN
 *  windows need nothing: a rebuild replaces the arrays (the engine resets itself) and a window ends on its own clock */
function engDrop(pre) { for (const q of solids) if (q.sig.startsWith(pre)) { q.st = 'dead'; q.cls = 0; } }
/** a live mucus plug cell at world x (the strand hazard is absorbed by it, levels.md §5.4) */
const plugAt = (wx) => solids.some((q) => q.k === 'plug' && (q.cls & SC.PLUG) && Math.abs(q.x + q.w / 2 - wx) < q.w);

/** forget slot seg's signature runs and engine pieces (null: every slot). The caller rebuilds the terrain */
function sigClear(seg) {
  SG.runs = seg == null ? [] : SG.runs.filter((r) => r.seg !== seg);
  engDrop(seg == null ? 'b' : `b${seg}:`);
}
/** rho for the hazard timer: rank.ts (W0), computed from $ at once (W0 contract: never the legacy G.rank) */
const rhoNow = () => rho($);
/** a signature variation is running that pauses the random hazard timer (HIGH TIDE v3 keeps its geysers) */
const sigPause = () => SG.runs.some((r) => r.on && !r.done && !(r.k === 'high_tide' && 'geysers' in TIDE.vars[r.v]));
/** biome slot seg's signature plan, or null: long4, movement B0 (a first visit in Descent 1), inside its band. It runs
 *  from the band's start (midboss A's breath end) to the next midboss WARNING - 40, or to breath 2's end when that
 *  breath holds no midboss (THE KEEPSAKE stage) */
function sigPlanOf(seg, b, from, v, mv, mids) {
  if (!isL4() || mv !== 0 || !layout().beats.moveB) return null;
  const BP = beatPlan(slotRow(seg), from, !!v), M = BP.moveB;
  if (!M || BP.breaths.length < 2) return null;
  const lim = mids && mids.length > 1 && BP.warns[1] != null ? BP.warns[1] - 40 : BP.breaths[1].z; // no midboss B: the signature may run through breath 2 (level-design review: the grill was cut ~40%)
  return planSig(b, seg, M.a, lim);
}
/** the two B0 narrows inside a swallow window (where v3's plugs grow), world x of each narrowest column */
function plugNarrows(V) {
  const out = [], a = V.x0 + SWALLOW.ramp, z = V.x1 - SWALLOW.ramp;
  for (let nx = narrowNear(a); nx <= z && out.length < 2; nx = narrowNear(nx + MOVE.throat.every)) if (nx >= a) out.push(nx);
  return out;
}
/** register slot seg's windows (sigs.ts setSigWindows: the probes' exception list, the cap context) and queue each
 *  variation's arming entry. A v3 swallow window is split around its plugs: a closed plug is a shootable barrier (S6),
 *  so the swept fit there is 0 by design and those columns register with floor 0 */
function armSigs(seg, b, plan) {
  sigClear(seg);
  if (!isL4()) return;
  const G = $.G, wins = [];
  if (plan) for (const V of plan.vars) {
    const run = { seg, b, k: plan.k, v: V.v, V, sig: `b${seg}:${plan.k}:v${V.v + 1}`, on: false, done: false, t: 0 }, id = `${b}:${plan.k}:v${V.v + 1}`, cp = Math.round(V.s0 - 60);
    SG.runs.push(run);
    if (plan.k === 'swallow' && 'plug' in SWALLOW.vars[V.v]) {
      let x = V.x0;
      for (const nx of plugNarrows(V)) { wins.push({ x0: x, x1: nx - 22, floor: V.floor, id, k: plan.k, cp: x === V.x0 ? cp : undefined }); wins.push({ x0: nx - 22, x1: nx + 26, floor: 0, id: id + ':plug', k: plan.k }); x = nx + 26; }
      wins.push({ x0: x, x1: V.x1, floor: V.floor, id, k: plan.k });
    } else wins.push({ x0: V.x0, x1: V.x1, floor: V.floor, id, k: plan.k, cp });
    insertScript([{ x: V.s0, f: () => { run.on = true; run.t = 0; }, k: 'sig:' + plan.k }]);
  }
  setSigWindows(G, 'b' + seg, wins);
}
const SIGSTEP = {
  /** ICE: release the variation's blocks on its cadence on the ship's lane (v2 alternates it), v3 adds the shelf crosses */
  morgue_rush(r) {
    const V = MORGUE.vars[r.v], n = r.V.n;
    r.rel ||= 0;
    while (r.rel < n && r.t >= r.rel * V.every) {
      if ($.P && spawnIce({ lane: morgueLane(r.v, r.rel, $.P.y), fit: r.V.floor, sig: r.sig, tell: MORGUE.tell, hp: MORGUE.hp, w: MORGUE.w, h: MORGUE.h, vFly: MORGUE.vx, vTurn: MORGUE.vLodge, xStop: Math.max($.P.x + MORGUE.stopLead, MORGUE.stopMin) })) sfx.tink(); // the racks rattle
      r.rel++;
    }
    if ('cross' in V && (r.t === 1 || r.t === Math.round(n * V.every / 2))) crossT(r.t === 1 ? 1 : -1);
    if (r.rel >= n && r.t >= (n - 1) * V.every + MORGUE.tail) r.done = true;
  },
  /** ACID: arm the tide (the engine runs it), the tell's glug and the ceiling turrets */
  high_tide(r) {
    if (r.t !== 1) { if (r.t >= tideLen(r.v)) r.done = true; return; }
    const V = TIDE.vars[r.v];
    armTide({ x0: r.V.x0, x1: r.V.x1, d: V.d, rise: V.rise, hold: V.hold, drain: V.drain, tell: TIDE.tell, fit: r.V.floor + TIDE.pad, sig: r.sig }); // the engine tapers each end over max(60, 2.5 d) px (S3)
    sample('gross_gargle', { vol: .7, rate: .8 }) || sfx.glob(); // the tell: the tank glugs
    if ('eye' in V) eyeT(-1); // the floor is liquid: turrets ride the ceiling folds, aiming down into the squeeze
    if ('womb' in V) womb();
  },
  /** FIRE: each column warms when it is GRILL.lead px ahead of the ship and burns until it has passed it */
  grill(r) {
    const G = $.G, P = $.P, V = GRILL.vars[r.v];
    if (!r.cols) { r.cols = grillCols(r.v, r.V.n).map(([dx, up]) => ({ wx: r.V.x0 + 20 + dx, up, on: false })); r.hk = 0; sample('gsizzle', { vol: .6, rate: .7 }) || sfx.fireball(); } // the comb's own cue, once (audio review): the burners catch
    let left = 0, lit = 0;
    for (const c of r.cols) {
      if (c.on) { lit++; continue; }
      left++;
      const x = c.wx - G.scroll;
      if (!P || x - P.x > GRILL.lead || x > W - 6) continue;
      c.on = true; lit++;
      if (Math.abs(x - P.x) < SPACE.noSpawn) continue; // the ship is on it: this column sits the comb out (spawnHazard's rule)
      const h = spawnHazardAt('jet', x, { up: c.up, live: GRILL.lead - GRILL.warm + GRILL.after });
      if (h) { h.grill = 1; h.run = r; }
    }
    if ('hooks' in V && r.hk < V.hooks && lit >= r.hk * r.cols.length / V.hooks) { r.hk++; hookE(); } // v3: meat hooks swing among the spires
    if (!left && !haz.some((h) => h.run === r)) r.done = true;
  },
  /** SNOT: arm the throat for as long as its window is on screen; v3 starts a plug at each narrow so it closes as
   *  the narrow is at its tightest */
  swallow(r) {
    const G = $.G, V = SWALLOW.vars[r.v], X = r.V;
    if (r.t === 1) {
      armSwallow({ x0: X.x0, x1: X.x1, S: V.S, T: V.T, dur: Math.max(1, Math.round(X.x1 + 20 - G.scroll)), tell: SWALLOW.tell, fit: X.floor, split: 'oop' in V, sig: r.sig });
      sample('gross_slosh', { vol: .6, rate: .7 }) || sfx.squish(); // the tell: the airway draws in
      if (r.v === 1) { slime(1); slime(-1); } // slimes on both lips
      if ('plug' in V) { womb(); r.plugs = plugNarrows(X).map((nx) => ({ nx, on: false })); }
    }
    const u = r.t - SWALLOW.tell, Q = SWALLOW.plug;
    // S5 / S4: a plug starts only while its narrow is still >= SPACE.sigLead ahead of the ship; one the ship nears first is retired
    if (r.plugs) for (const p of r.plugs) if (!p.on && $.P && p.nx - G.scroll - $.P.x < SPACE.sigLead) p.on = true; // S4 too (W3a request): it starts growing >= 120 px (120 f) ahead
    if (r.plugs) for (const p of r.plugs) if (!p.on && p.nx - G.scroll < W - 20 && u > 0 && (u + Q.grow) % V.T === V.T / 2) {
      p.on = true;
      spawnPlug({ wx: p.nx, tell: Q.grow, fit: X.floor, hp: Q.hp, cell: Q.cell, regrow: Q.regrow, sig: r.sig });
      sample('gross_gargle', { vol: .5, rate: 1.2 }) || sfx.squish();
    }
    if (u > 0 && u % V.T === V.T / 2 - 20) sample('gross_slosh', { vol: .35, rate: .55 }); // each clench is heard closing
    if (G.scroll > X.x1 + 20) { engDrop(r.sig); r.done = true; }
  },
};
function stepSigs() {
  for (const r of SG.runs) if (r.on && !r.done) { r.t++; SIGSTEP[r.k](r); }
}
/** the signatures' own draws (procedural, from the corpse and glob palettes; S7 keeps them off the background) */
function drawSigs() {
  const G = $.G;
  if (!G) return;
  const sc = G.scroll, T = $.T;
  for (const r of SG.runs) {
    if (!r.on || r.done) continue;
    if (r.k === 'high_tide' && r.t < TIDE.tell + TIDE.vars[r.v].rise) { // the tell: the lake boils hard over the window
      ctx.strokeStyle = 'rgba(120,240,210,.75)'; ctx.lineWidth = .8;
      for (let n = 0; n < 12; n++) { const wx = srr(r.V.x0, r.V.x1), x = wx - sc; if (x < 0 || x > W) continue; ctx.beginPath(); ctx.arc(x, floorAt(wx) - srr(0, 4), srr(1, 2.8), 0, TAU); ctx.stroke(); }
    } else if (r.k === 'swallow' && r.t < SWALLOW.tell + 30) { // the tell: pale strands thicken across the narrows
      const a = Math.min(1, r.t / SWALLOW.tell);
      ctx.strokeStyle = `rgba(244,232,170,${.25 + .5 * a})`; ctx.lineWidth = 1 + 2 * a;
      for (let nx = narrowNear(r.V.x0); nx < r.V.x1; nx += MOVE.throat.every) { const x = nx - sc; if (x < -4 || x > W + 4) continue; ctx.beginPath(); ctx.moveTo(x, ceilAt(nx)); ctx.quadraticCurveTo(x + 6 * Math.sin(T * .05 + nx), (ceilAt(nx) + floorAt(nx)) / 2, x, floorAt(nx)); ctx.stroke(); }
    }
  }
}
/** test hook (tests/unit/sigrun.test.ts, tools): the live signature runs, the hazard pause, one signature step */
export const sigRuns = () => ({ runs: SG.runs, pause: sigPause, step: stepSigs });

// ---------------- drawing (art lives in render/biomeart.ts) ----------------
export function drawBiomeFX() { drawFX(haz, amb, gatePos); if (isL4()) drawSigs(); }
/** consume a hazard hit this frame (applied by the caller so playerHit stays in one place) */
export function hazardHit() { const h = $.G && $.G.hazHit; if (h) $.G.hazHit = 0; return !!h; }
/** test hook (tools/route-probe.mjs): live terrain + hazards */
(globalThis as any).__biome = () => ({ F: FLOOR, C: CEIL, TS, haz, k: $.G ? biomeK($.G.scroll + W / 2) : null, sig: sigRuns() }); // sig: the signature runs (MORGUE RUSH blocks in flight are solids.ts BODY solids, outside haz)
