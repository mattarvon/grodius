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
import { MOVE, MOVES, bandClamp, gimmick, hazInterval, moveAt, narrowNear, snapVent } from './terrainb';
import { BOSS_SIM, bossFor } from './enemies/boss/registry';
import { hazAimed, hazLeadX } from './notice';
import { ECON, econId, noticeOf } from './economy';
import { FURNACE, GRILL, GULLET, ICICLE, INSET_MID, MORGUE, SPACE, SWALLOW, TIDE, envelope, grillCols, hazRankMul, insetOf, morgueLane, planSig, setSigWindows, throatInset, tideLen, tideLevel } from './sigs';
import { srr } from './srnd';
import { rho } from './rank';
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
/** the gullet's edges at world x: gap 108-118 around the biome's resting centre (smooth: the walls' own noise would
 *  break the swept fit) swinging +-amp on its period, blended in at both ends (a lerp of two >= 108 gaps stays >= 108) */
function gullet(g, x, b, ce, fl) {
  const G = GULLET, k = envelope(x, g.x0, g.x1, G.blend), u = (x - g.x0) / G.period, [c0, f0] = REST[b] || REST.snot;
  const m = (c0 + f0) / 2 + G.amp * Math.sin(2 * Math.PI * u), gap = G.gap[0] + (G.gap[1] - G.gap[0]) * (.5 + .5 * Math.cos(4 * Math.PI * u));
  return [lerp(ce, m - gap / 2, k), lerp(fl, m + gap / 2, k)];
}
/** blend the terrain from world x `from` onward (over 300px, all of it off-screen) into biome b; it stays that
 *  biome until the next rewrite, and always fades back to the untouched level over layout().tEnd, where the biome
 *  terrain hands back to the level's own corridor (the Gravity Drive approach; its chamber band is in world.ts). The biome shape
 *  and the base level both keep a >=104px gap, and a lerp of two such gaps can't be narrower. A layout with a run-up
 *  beat (long4) blends movement A (shape) into movement C (arena) over arenaBlend px from the run-up's scroll x, so
 *  the whole screen is arena by the time the run-up starts; a lerp of a >=108 and a >=150 gap stays >=108. Variant mv
 *  (a layout with moveB) blends movement B (src/terrainb.ts) in and out over its band, by the same argument */
function rewriteTerrain(seg, b, from, mv = null, mids = null) {
  const o = ($.G.loop + 1) * 37.1 + seg * 11, LY = layout(), [T_END0, T_END1] = LY.tEnd;
  const xC = LY.beats.runup != null ? beatPlan(slotRow(seg), from, false).runup : null, xC1 = xC != null ? xC + LY.beats.arenaBlend : 0;
  const M = mv != null ? beatPlan(slotRow(seg), from, false).moveB : null, SB = slotBoss(seg); // SB: a registered boss owns its arena (movement C)
  if (M) MOVES[seg] = { ...M, b, mv, o };
  // long4 (DIFFICULTY-SPEC §2.4): the resting walls come in by INSET px a side, halved near a held midboss's screen, and
  // slot B gets the GULLET narrow in its rush. Movement C (the arena) is built from the un-inset walls, so the boss
  // arenas don't move. short: ins0 is 0 and there is no gullet, so the loop is the arithmetic it was
  const L4 = isL4(), ins0 = L4 ? insetOf(b, seg) : 0, near = ins0 ? midNear(seg, from, mids) : null, gul = L4 && seg ? gulletAt(seg, from) : null;
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
  if (!ins0 || i1 < i0) { for (let i = i0; i <= i1; i++) { const [ce, fl] = edges(i); write(i, ce, fl); } return; } // short: the arithmetic it was
  // long4 inset, in two passes. A wall coming in next to a needle (a fire spire, an ice tooth) narrows the swept 21 px
  // fit gap there, not just its own column, so each column's inset is capped by the narrowest un-inset swept fit within
  // INSET_FIT.reach px: fit after >= fit before - 2 x inset >= INSET_FIT.keep wherever the walls left room (route-probe
  // S1 holds by construction), and nothing moves where they did not. The arena (movement C) is built from the un-inset walls
  const n = i1 - i0 + 1, C0 = new Float32Array(n), F0 = new Float32Array(n), fit = new Float32Array(n), R = INSET_FIT.reach / TS | 0;
  for (let i = i0; i <= i1; i++) { const [ce, fl] = edges(i); C0[i - i0] = ce; F0[i - i0] = fl; }
  for (let j = 0; j < n; j++) { let c = -1e9, f = 1e9; for (let q = Math.max(0, j - 3); q <= Math.min(n - 1, j + 3); q++) { c = Math.max(c, C0[q]); f = Math.min(f, F0[q]); } fit[j] = f - c; } // the swept span [-9, +12] px, a column either side
  const ins = new Float32Array(n); // the capped inset per column
  for (let j = 0; j < n; j++) {
    let m = 1e9; for (let q = Math.max(0, j - R); q <= Math.min(n - 1, j + R); q++) m = Math.min(m, fit[q]);
    const x = (i0 + j) * TS, want = near ? ins0 * (1 - (1 - INSET_MID.k) * near(x)) : ins0;
    ins[j] = Math.max(0, Math.min(want, (m - INSET_FIT.keep) / 2));
  }
  // the cap changes fast where a needle enters the window: limit it to INSET_FIT.slope px a column both ways, only ever
  // lowering it (a smaller inset never narrows the fit), so it adds no tile-to-tile cliff (terrainb.test.ts)
  for (let j = 1; j < n; j++) ins[j] = Math.min(ins[j], ins[j - 1] + INSET_FIT.slope);
  for (let j = n - 2; j >= 0; j--) ins[j] = Math.min(ins[j], ins[j + 1] + INSET_FIT.slope);
  for (let j = 0; j < n; j++) write(i0 + j, C0[j] + ins[j], F0[j] - ins[j]);
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
  if (isL4() && !legacy) for (const [p, y] of OPEN_PODS) at(P(p), () => formation('sine', PH * y, FM, { pod: 1, open: 1 }), 'pod:open');
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
  rewriteTerrain(seg, b, from, pk && pk.mv, mids);
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
  haz.length = amb.length = MOVES.length = 0;
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
  if (k !== 'icicle' || !$.G) return;
  const c = Math.max(0, ceilAt(x + $.G.scroll)); // an open sky drops it from the top edge
  haz.push({ k, x, y: c + 2, t: 0, vy: 0, len: 14, aim: 1, shoot: 1 });
}
// W4b's src/boss/bossrules.ts HAZ_HOOK, registered without a hard import so this branch builds before W4b lands (an eager
// glob of a missing file is {}). Wired on the first stepBiome, after every module has evaluated (no import-order cycle)
const BOSS_RULES = import.meta.glob('./boss/bossrules.ts', { eager: true }) as Record<string, { HAZ_HOOK?: { drop?: unknown } }>;
let hazHooked = false;
/** hand dropHazard to W4b's HAZ_HOOK (idempotent; stepBiome calls it once, tests may call it) */
export function hookHazards() { hazHooked = true; for (const m of Object.values(BOSS_RULES)) if (m && m.HAZ_HOOK) m.HAZ_HOOK.drop = dropHazard; }

export function stepBiome() {
  if (!hazHooked) hookHazards();
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
      if (L4 && ENG.plugs.some((q) => q.vis && Math.abs(q.wx + q.cell / 2 - wx) < q.cell && q.cells.some((c2) => c2.on))) { dead = true; sfx.squish(); } // levels.md §5.4: a strand that touches a plug is absorbed
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
// stepSigs. A run only schedules: what moves the walls or makes a solid is the space engine, called through ENG below
// with W3a's API (scratchpad spec/W3A-API.md: armTide, armSwallow, spawnIce, spawnPlug). No R() anywhere: frame
// counters, world x and the ship's position; fx draw srr. Checkpoints sit before a window (its `cp`), and a rebuild
// (buildTerrain, then biomeStage) clears the runs, so nothing here is saved.
const SG = { runs: [] };

// ---- ENGINE ADAPTER: a local stand-in for W3a's src/solids.ts until it lands; the rebase swaps this block for an
// import. Same names and options. Moving terrain is levels.md §2.2's design (a window's base FLOOR / CEIL saved and
// rewritten each frame, put back at the end); a lodged block and a mucus plug are written into the terrain arrays, so
// they kill like walls through WARD (Decision 5) and every floorAt / ceilAt reader agrees; a flying block is a body hit
// (WARD takes it). The real engine steps before the ship moves; this one steps in stepBiome, a frame later ----
const ENG = {
  wins: [], blocks: [], lodged: [], plugs: [],
  /** a tide window: the floor rises d px over [x0, x1], tell / rise / hold / drain, no column under `fit` */
  armTide(o) { const w = dynWin('tide', o); w.len = TIDE.tell + o.rise + o.hold + o.drain; return w; },
  /** a swallow window: each wall in by S (1 - cos 2 pi t / T) / 2 for `dur` frames; split: halves out of phase */
  armSwallow(o) { const w = dynWin('swallow', o); w.len = o.dur; return w; },
  /** a MORGUE RUSH block on `lane` (S5: null within 48 px of the ship) */
  spawnIce(o) {
    const P = $.P, G = $.G, M = MORGUE;
    if (!P) return null;
    const sx = W + M.enter + M.w / 2, wx = G.scroll + sx, lo = ceilAt(wx) + M.wallPad + M.h / 2, hi = floorAt(wx) - M.wallPad - M.h / 2;
    if (hi <= lo) return null;
    const y = clamp(o.lane ?? P.y, lo, hi);
    if ((P.x - sx) ** 2 + (P.y - y) ** 2 < SPACE.noSpawn ** 2) return null;
    const k = { sig: o.sig, st: 'tell', t: 0, tell: o.tell ?? M.tell, x: W + M.enter, y, xStop: o.xStop ?? Math.max(P.x + M.stopLead, M.stopMin), hp: o.hp ?? M.hp, fit: o.fit ?? 100, dir: 0 };
    ENG.blocks.push(k);
    return k;
  },
  /** a MUCUS PLUG column at world x: cells from the relaxed walls (a window's base) growing over `tell` f */
  spawnPlug(o) {
    const Q = SWALLOW.plug, cell = o.cell ?? Q.cell, w = ENG.wins.find((v) => o.wx >= v.x0 && o.wx < v.x1), j = Math.round((o.wx + cell / 2) / TS);
    const c0 = w ? w.bc[j - w.i0] : ceilAt(o.wx), f0 = w ? w.bf[j - w.i0] : floorAt(o.wx), n = Math.max(1, Math.ceil((f0 - c0) / cell));
    const p = { sig: o.sig, wx: o.wx - cell / 2, cell, yTop: c0, n, t: 0, tell: o.tell ?? Q.grow, regrow: o.regrow ?? Q.regrow, cells: Array.from({ length: n }, () => ({ on: false, g: false, cut: -1e9 })), vis: null };
    ENG.plugs.push(p);
    return p;
  },
  /** forget everything whose sig starts with `pre` (every thing: ''), putting the windows' base terrain back */
  reset(pre = '') {
    const keep = (o) => !o.sig.startsWith(pre);
    for (const w of ENG.wins) if (!keep(w)) restoreWin(w);
    ENG.wins = ENG.wins.filter(keep); ENG.blocks = ENG.blocks.filter(keep); ENG.lodged = ENG.lodged.filter(keep); ENG.plugs = ENG.plugs.filter(keep);
  },
  step() {
    for (let i = ENG.wins.length - 1; i >= 0; i--) { const w = ENG.wins[i]; if (++w.t >= w.len) { restoreWin(w); ENG.wins.splice(i, 1); } else stepWin(w); }
    stepBlocks();
    stepPlugs();
  },
};
function dynWin(kind, o) {
  const i0 = Math.max(0, Math.floor(o.x0 / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil(o.x1 / TS));
  const w = { kind, ...o, t: 0, i0, i1, arr: FLOOR, bc: CEIL.slice(i0, i1 + 1), bf: FLOOR.slice(i0, i1 + 1) };
  ENG.wins.push(w);
  return w;
}
/** put a window's base terrain back (unless the arrays were rebuilt under it) */
function restoreWin(w) { if (w.arr === FLOOR) { CEIL.set(w.bc, w.i0); FLOOR.set(w.bf, w.i0); } }
function stepWin(w) {
  if (w.arr !== FLOOR) return; // a rebuild replaced the arrays: the window is stale
  if (w.kind === 'tide') {
    const lv = tideLevel(w.v, w.t), cap = w.fit + TIDE.pad;
    // the cap reads the highest ceiling within 6 columns (24 px), so the swept 21 px fit holds the floor, not just each column
    for (let i = w.i0; i <= w.i1; i++) { let c = -1e9; for (let q = Math.max(0, i - 6); q <= Math.min(CEIL.length - 1, i + 6); q++) c = Math.max(c, CEIL[q]); const b0 = w.bf[i - w.i0], d = w.d * lv * envelope(i * TS, w.x0, w.x1, TIDE.ramp); FLOOR[i] = Math.min(b0, Math.max(b0 - d, c + cap)); }
    return;
  }
  const g = w.fit + 2;
  for (let i = w.i0; i <= w.i1; i++) {
    const c0 = w.bc[i - w.i0], f0 = w.bf[i - w.i0], s = throatInset(w.v, w.t, i * TS, w.x0, w.x1);
    let ce = c0 + s, fl = f0 - s;
    if (fl - ce < g) { const m = (c0 + f0) / 2, h = Math.min(g, f0 - c0) / 2; ce = m - h; fl = m + h; } // never under the window floor
    CEIL[i] = ce; FLOOR[i] = fl;
  }
}
/** the swept S1 fit gap's minimum over ship positions [a, b] (world x); blk: a block [x0, x1, edge y, on the ceiling]
 *  to count as lodged (MORGUE's lodge rule) */
function fitSpan(a, b, blk) {
  const ce = (u) => (blk && u >= blk[0] && u <= blk[1] && blk[3] ? Math.max(ceilAt(u), blk[2]) : ceilAt(u));
  const fl = (u) => (blk && u >= blk[0] && u <= blk[1] && !blk[3] ? Math.min(floorAt(u), blk[2]) : floorAt(u));
  let m = 1e9;
  for (let p = a; p <= b; p += 2) { let c = -1e9, f = 1e9; for (let u = p - 9; u <= p + 12; u += 3) { c = Math.max(c, ce(u)); f = Math.min(f, fl(u)); } m = Math.min(m, f - c); }
  return m;
}
/** one of the ship's shots overlapping the rect [x, x + w] x [y, y + h] (screen) this frame or the next, spent on it */
function shotInto(x, y, w, h) {
  for (let j = shots.length - 1; j >= 0; j--) {
    const s = shots[j], tip = s.k === 'laser' ? s.x + (s.len || 0) : s.x;
    if (s.g || tip + Math.max(0, s.vx || 0) < x || s.x > x + w || s.y < y || s.y > y + h) continue;
    shots.splice(j, 1);
    return s;
  }
  return null;
}
function stepBlocks() {
  const G = $.G, P = $.P, M = MORGUE, sc = G.scroll;
  for (let i = ENG.blocks.length - 1; i >= 0; i--) {
    const k = ENG.blocks[i];
    k.t++;
    if (k.st === 'tell') { if (k.t >= k.tell) { k.st = 'fly'; crack({ vol: .35, rate: 1.3 }); } continue; }
    if (k.st === 'fly') {
      k.x -= M.vx;
      if (k.x <= k.xStop) { k.st = 'turn'; const cx = k.x + M.w / 2 + sc; k.dir = k.y - ceilAt(cx) < floorAt(cx) - k.y ? -1 : 1; }
    } else { // turning: fixed in the world now, sliding to the nearer wall until it meets it (or a block already there)
      k.x -= G.scrollSpeed;
      k.y += k.dir * M.vLodge;
      const wx = k.x + sc, edge = k.dir < 0 ? Math.max(ceilAt(wx), ceilAt(wx + M.w / 2), ceilAt(wx + M.w)) : Math.min(floorAt(wx), floorAt(wx + M.w / 2), floorAt(wx + M.w));
      if (k.dir < 0 ? k.y - M.h / 2 <= edge : k.y + M.h / 2 >= edge) { lodge(k, k.dir < 0 ? edge + M.h / 2 : edge - M.h / 2); ENG.blocks.splice(i, 1); continue; }
    }
    // flying, a block is a body: WARD takes it (levels.md §5.1)
    if (P && P.alive && Math.abs(P.x - (k.x + M.w / 2)) < M.w / 2 + 8 && Math.abs(P.y - k.y) < M.h / 2 + 4) { G.hazHit = 1; shatter(k); ENG.blocks.splice(i, 1); continue; }
    if (shotInto(k.x, k.y - M.h / 2, M.w, M.h)) {
      for (let q = 0; q < 3; q++) spark(k.x, k.y + srr(-4, 4), srr(-2, 0), srr(-1.5, 1.5), 8, '#e8f6ff');
      if (--k.hp <= 0) { shatter(k); ENG.blocks.splice(i, 1); continue; }
      sfx.tink();
    }
    if (k.x < -M.w - 20 || k.y < -20 || k.y > PH + 20) ENG.blocks.splice(i, 1);
  }
}
/** a block meets its wall at centre y yc: it becomes terrain, unless that leaves the swept fit gap under its `fit` (or
 *  under what the walls there already leave), and then it shatters (levels.md §5.1 lodge rule) */
function lodge(k, yc) {
  const M = MORGUE, wx = k.x + $.G.scroll, up = k.dir < 0, e = up ? yc + M.h / 2 : yc - M.h / 2;
  if (fitSpan(wx - 12, wx + M.w + 12, [wx, wx + M.w, e, up]) < Math.min(k.fit, fitSpan(wx - 12, wx + M.w + 12, null))) { shatter(k); return; }
  const i0 = Math.max(0, Math.floor(wx / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil((wx + M.w) / TS));
  for (let i = i0; i <= i1; i++) { if (up) CEIL[i] = Math.max(CEIL[i], e); else FLOOR[i] = Math.min(FLOOR[i], e); }
  ENG.lodged.push({ sig: k.sig, wx, y: yc });
  crack({ vol: .6, rate: .9 }) || sfx.tink();
  for (let q = 0; q < 8; q++) spark(k.x + srr(0, M.w), e, srr(-1.5, 1.5), up ? srr(.2, 1.5) : -srr(.2, 1.5), 14, q % 2 ? '#e8f6ff' : '#9fd8ff');
}
/** the ice crack sample, at most once every 12 frames (a v3 rush releases a block every 45 f, each cracking 2-3 times) */
let crackT = -99;
function crack(o) { const t = $.G ? $.G.t : 0; if (t - crackT < 12) return true; crackT = t; return sample('gicecrack', o); }
function shatter(k) {
  const M = MORGUE, cx = k.x + M.w / 2;
  for (let q = 0; q < 12; q++) spark(cx + srr(-8, 8), k.y + srr(-5, 5), srr(-2.5, 2.5), srr(-2.5, 1.5), 16, q % 3 ? '#e8f6ff' : '#9fd8ff');
  gore(cx, k.y, .4); // the crewman inside comes apart too
  crack({ vol: .8, rate: 1.1 }) || sfx.tink();
}
/** the plugs: grow in from both walls over `tell` f, take the ship's fire a cell a shot, regrow a cut cell `regrow` f
 *  later (never within SPACE.regrowMin of the ship), and are written into the terrain every frame */
function stepPlugs() {
  const G = $.G, P = $.P;
  for (const p of ENG.plugs) {
    const x = p.wx - G.scroll;
    p.t++;
    const reach = Math.ceil(p.n / 2 * Math.min(1, p.t / p.tell));
    const far = (j) => !P || (P.x - x - p.cell / 2) ** 2 + (P.y - p.yTop - (j + .5) * p.cell) ** 2 >= SPACE.regrowMin ** 2; // S5: a cell never forms on the ship (it waits)
    for (let j = 0; j < p.n; j++) { const c = p.cells[j]; if (!c.g && Math.min(j, p.n - 1 - j) < reach && far(j)) { c.g = true; c.on = true; } }
    for (let j = 0; j < p.n; j++) {
      const c = p.cells[j];
      if (c.g && !c.on && p.t - c.cut >= p.regrow && far(j)) c.on = true;
    }
    for (let k = shots.length - 1; k >= 0; k--) { // 1 hp a cell: a ship-sized hole is 3 bolts (S6)
      const s = shots[k], tip = s.k === 'laser' ? s.x + (s.len || 0) : s.x;
      if (s.g || !(s.vx > 0) || tip > x + p.cell || tip + s.vx < x - 1) continue;
      const c = p.cells[Math.floor((s.y - p.yTop) / p.cell)];
      if (!c || !c.on) continue;
      c.on = false; c.cut = p.t; shots.splice(k, 1);
      for (let q = 0; q < 6; q++) drop(x, s.y + srr(-4, 4), srr(-1.5, -.2), srr(-1, 1), srr(1, 1.8), 0, 60);
      sfx.squish();
    }
    bakePlug(p);
  }
}
/** write a plug into the terrain: at its columns the opening is its longest run of missing cells (a tie: the one
 *  nearest the ship), or nothing when it is whole. p.vis keeps the throat's own edges for the draw */
function bakePlug(p) {
  const P = $.P, i0 = Math.max(0, Math.floor(p.wx / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil((p.wx + p.cell) / TS));
  let best = null;
  for (let j = 0; j < p.n;) {
    if (p.cells[j].on) { j++; continue; }
    let e = j; while (e < p.n && !p.cells[e].on) e++;
    const a = p.yTop + j * p.cell, b = p.yTop + e * p.cell, d = best ? b - a - (best[1] - best[0]) : 1;
    if (d > .5 || (d > -.5 && P && Math.abs((a + b) / 2 - P.y) < Math.abs((best[0] + best[1]) / 2 - P.y))) best = [a, b];
    j = e;
  }
  p.vis = [CEIL[i0], FLOOR[i0]];
  for (let i = i0; i <= i1; i++) {
    const top = best ? Math.max(CEIL[i], best[0]) : 0, bot = best ? Math.min(FLOOR[i], best[1]) : 0;
    if (best && bot > top) { CEIL[i] = top; FLOOR[i] = bot; } else { const m = (CEIL[i] + FLOOR[i]) / 2; CEIL[i] = FLOOR[i] = m; }
  }
}
// ---- end of the engine adapter ----

/** forget slot seg's signature runs and engine pieces (null: every slot). The caller rebuilds the terrain */
function sigClear(seg) {
  SG.runs = seg == null ? [] : SG.runs.filter((r) => r.seg !== seg);
  ENG.reset(seg == null ? 'b' : `b${seg}:`);
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
      if ($.P && ENG.spawnIce({ lane: morgueLane(r.v, r.rel, $.P.y), fit: r.V.floor, sig: r.sig })) sfx.tink(); // the racks rattle
      r.rel++;
    }
    if ('cross' in V && (r.t === 1 || r.t === Math.round(n * V.every / 2))) crossT(r.t === 1 ? 1 : -1);
    if (r.rel >= n && r.t >= (n - 1) * V.every + MORGUE.tail) r.done = true;
  },
  /** ACID: arm the tide (the engine runs it), the tell's glug and the ceiling turrets */
  high_tide(r) {
    if (r.t !== 1) { if (r.t >= tideLen(r.v)) r.done = true; return; }
    const V = TIDE.vars[r.v];
    ENG.armTide({ x0: r.V.x0, x1: r.V.x1, d: V.d, rise: V.rise, hold: V.hold, drain: V.drain, tell: TIDE.tell, fit: r.V.floor, sig: r.sig, v: r.v });
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
      ENG.armSwallow({ x0: X.x0, x1: X.x1, S: V.S, T: V.T, dur: Math.max(1, Math.round(X.x1 + 20 - G.scroll)), tell: SWALLOW.tell, fit: X.floor, split: 'oop' in V, sig: r.sig, v: r.v });
      sample('gross_slosh', { vol: .6, rate: .7 }) || sfx.squish(); // the tell: the airway draws in
      if (r.v === 1) { slime(1); slime(-1); } // slimes on both lips
      if ('plug' in V) { womb(); r.plugs = plugNarrows(X).map((nx) => ({ nx, on: false })); }
    }
    const u = r.t - SWALLOW.tell, Q = SWALLOW.plug;
    // S5 / S4: a plug starts only while its narrow is still >= SPACE.sigLead ahead of the ship; one the ship nears first is retired
    if (r.plugs) for (const p of r.plugs) if (!p.on && $.P && p.nx - G.scroll - $.P.x < SPACE.sigLead) p.on = true; // S4 too (W3a request): it starts growing >= 120 px (120 f) ahead
    if (r.plugs) for (const p of r.plugs) if (!p.on && p.nx - G.scroll < W - 20 && u > 0 && (u + Q.grow) % V.T === V.T / 2) {
      p.on = true;
      ENG.spawnPlug({ wx: p.nx, tell: Q.grow, fit: X.floor, hp: Q.hp, cell: Q.cell, regrow: Q.regrow, sig: r.sig });
      sample('gross_gargle', { vol: .5, rate: 1.2 }) || sfx.squish();
    }
    if (u > 0 && u % V.T === V.T / 2 - 20) sample('gross_slosh', { vol: .35, rate: .55 }); // each clench is heard closing
    if (G.scroll > X.x1 + 20) { ENG.reset(r.sig); r.done = true; }
  },
};
function stepSigs() {
  for (const r of SG.runs) if (r.on && !r.done) { r.t++; SIGSTEP[r.k](r); }
  ENG.step();
}
/** the signatures' own draws (procedural, from the corpse and glob palettes; S7 keeps them off the background) */
function drawSigs() {
  const G = $.G;
  if (!G) return;
  const sc = G.scroll, M = MORGUE, T = $.T;
  for (const k of ENG.blocks) {
    if (k.st !== 'tell') { drawBlock(k.x, k.y); continue; }
    // the tell: a frost streak along the lane over the screen's right 120 px, brightening, and a red edge mark
    const q = k.t / k.tell;
    ctx.fillStyle = `rgba(225,244,255,${.25 + .55 * q})`;
    for (let x = W - M.streak; x < W; x += 6) if ((x + T * 3) % 12 < 7) ctx.fillRect(x, k.y - .5, 4, 1);
    ctx.fillStyle = (k.t >> 2) % 2 ? '#ff5a4a' : '#eaf7ff'; ctx.fillRect(W - 3, k.y - M.h / 2, 2, M.h);
  }
  for (const l of ENG.lodged) { const x = l.wx - sc; if (x > -M.w - 2 && x < W + 2) drawBlock(x, l.y); }
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
  for (const p of ENG.plugs) {
    if (!p.vis) continue;
    const x = p.wx - sc;
    if (x < -12 || x > W + 2) continue;
    for (let j = 0; j < p.n; j++) {
      if (!p.cells[j].on) continue;
      const cy = p.yTop + (j + .5) * p.cell;
      if (cy < p.vis[0] - 3 || cy > p.vis[1] + 3) continue; // inside the clenched wall
      ctx.fillStyle = '#9c8228'; ctx.beginPath(); ctx.ellipse(x + 5, cy, 6.2, 5.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#dcc860'; ctx.beginPath(); ctx.ellipse(x + 4.4, cy - .6, 4.4, 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,220,.85)'; ctx.fillRect(x + 2.6, cy - 2.8, 1.5, 1.5);
    }
  }
}
/** a frozen crewman in a block of ice, left edge x, centre y (screen) */
function drawBlock(x, y) {
  // art-director review: it must read as solid ice in front of the vault's background coffins (S7), so it gets a dark
  // contact shadow, a solid rim and a pale, skin-toned body (the background figures' tone), not a dark smear
  const M = MORGUE, t = y - M.h / 2;
  ctx.fillStyle = 'rgba(0,6,16,.55)'; ctx.fillRect(x + 2, t + 2, M.w, M.h); // contact shadow
  ctx.fillStyle = '#5d8fb8'; ctx.fillRect(x, t, M.w, M.h); // the ice, opaque
  ctx.fillStyle = '#d9a99a'; ctx.fillRect(x + 4, y - 2, 11, 4); // the body, laid in the ice, mid-scream
  ctx.beginPath(); ctx.arc(x + 17, y - .5, 2.7, 0, TAU); ctx.fill();
  ctx.fillRect(x + 1.5, y - 3.5, 3, 1.4); ctx.fillRect(x + 1.5, y + 2, 3, 1.4); // feet
  ctx.fillRect(x + 9, y - 5, 1.4, 3); ctx.fillRect(x + 12, y + 2, 1.4, 3); // arms pressed to the ice
  ctx.fillStyle = '#7a1222'; ctx.fillRect(x + 8, y - 1, 4, 2); ctx.fillStyle = '#2a0408'; ctx.fillRect(x + 18, y - 1, 1.5, 1.5); // a wound, the open mouth
  ctx.fillStyle = 'rgba(170,220,255,.35)'; ctx.fillRect(x, t, M.w, M.h); // frost over it
  ctx.fillStyle = 'rgba(240,252,255,.9)'; ctx.fillRect(x + 2, t + 1.5, 7, 1); ctx.fillRect(x + M.w - 4, t + 3, 1, 5);
  ctx.strokeStyle = '#eef9ff'; ctx.lineWidth = 1.5; ctx.strokeRect(x + .75, t + .75, M.w - 1.5, M.h - 1.5);
}
/** test hook (tests/unit/sigs.test.ts, tools): the live signature runs and the adapter's engine state */
export const sigRuns = () => ({ runs: SG.runs, eng: ENG, pause: sigPause });

// ---------------- drawing (art lives in render/biomeart.ts) ----------------
export function drawBiomeFX() { drawFX(haz, amb, gatePos); if (isL4()) drawSigs(); }
/** consume a hazard hit this frame (applied by the caller so playerHit stays in one place) */
export function hazardHit() { const h = $.G && $.G.hazHit; if (h) $.G.hazHit = 0; return !!h; }
/** test hook (tools/route-probe.mjs): live terrain + hazards */
(globalThis as any).__biome = () => ({ F: FLOOR, C: CEIL, TS, haz, k: $.G ? biomeK($.G.scroll + W / 2) : null, sig: sigRuns() }); // sig: the signature runs and the engine adapter (MORGUE RUSH blocks in flight are bodies outside haz)
