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
import { eliteChance, eliteRoll } from './enemies/elite';
import { enemies } from './world';
import { startStage } from './stages';
import { drawFX } from './render/biomeart';
import { beatPlan, layout, nSlots, slotRow, stageOfSlot } from './layout';
import { seedOf, stream } from './rng';
export { biomePat, biomeTerrainFill, biomeEdge, drawBiomeBG, drawBiomeDecor, splatCols, biomeDark, biomeMist } from './render/biomeart';

// the biome slots (world x0, bossX) are stage rows of the layout (src/layout.ts slotRow); short: stage 1 = slot 0,
// stage 2 = slot 1

export const BIOMES = {
  ice: {
    name: 'THE CRYOVAULT', tag: 'FROZEN // BLOATED BITCH', sub: 'THE CREW IS STILL IN HERE. FROZEN MID-SCREAM', col: '#9fd8ff', rgb: '160,215,255',
    dark: .55, mist: '90,10,26', bg: ['#02060e', '#0e2840'], edge: '#f2fbff', fog: '120,180,230',
    gore: ['#7a1222', '#300610', '#d8efff', '#0c0809', '#8cc4ee', '#ffffff'], blood: ['#7a1222', '#300610', '#c8506a'],
    boss: 'crux', bossName: 'THE BLOATED BITCH', mid: 'choir', midName: 'THE NAIL CHOIR', haz: 'icicle', hazEvery: 110,
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
    boss: 'maw', bossName: 'THE DISSOLVED MAW', mid: 'cyst', midName: 'THE DISSOLVING WOMB', haz: 'geyser', hazEvery: 135,
    // wall swarms over a floor full of crawlers and wombs
    gap: 125, dbl: .55, set: 'walls', sig: 'crawler',
    mix: [['crawler', 4], ['womb', 3], ['eye', 2], ['hatch', 1], ['wall', .7], ['dive', .3]],
    late: [['slime', 2.5]], // Descent 2+: the Sinus's slimes have leaked into the tanks
    remix: { sig: 'womb', set: 'gutter', drop: ['dive', 'hatch'], add: [['sine', .6]], pool: [['mutant', 2], ['hook', 2], ['flayer', 2], ['cross', 2]] },
    logs: ['THE FLOOR IS STOMACH LINING. IT IS SECRETING.', 'MY HULL PLATING IS SIZZLING.',
      'A BOOT FLOATS PAST. THE FOOT IS STILL IN IT.', 'THE TANK IS NOT FULL. IT IS STILL EATING.'],
  },
  fire: {
    name: 'THE FURNACE', tag: 'BURNING // BUTCHER', sub: 'THEY BURNED THE BODIES. THE BODIES KEPT MOVING', col: '#ff7a1a', rgb: '255,120,30',
    dark: .6, mist: '50,12,6', bg: ['#040000', '#300702'], edge: '#ffb347', fog: '255,90,20',
    gore: ['#4a0a06', '#120202', '#ff6a1a', '#050303', '#ffb347', '#ff3a10'], blood: ['#6a0a08', '#240303', '#ff4a1a'],
    boss: 'butcher', bossName: 'THE BURNING BUTCHER', mid: 'prentice', midName: "THE BUTCHER'S APPRENTICE", haz: 'jet', hazEvery: 125,
    // aggressive: tight spacing, divers and flayers, things coming from behind
    gap: 100, dbl: .6, set: 'pincer', sig: 'flayer',
    mix: [['flayer', 3], ['hook', 3], ['mutant', 2.5], ['crawler', 2], ['dive', .6], ['behind', .4]],
    remix: { sig: 'mutant', set: 'kiln', drop: ['crawler', 'dive'], add: [['zig', .8]], pool: [['cross', 2], ['eye', 2], ['corpse', 2], ['slime', 2]] },
    logs: ['INCINERATOR RUNNING AT 4000C. SOMETHING IS SINGING IN IT.', 'ASH IS FALLING UP.',
      'THE ASH HAS FINGERPRINTS.', 'COOLANT LINES CUT BY HAND. SOMEONE WANTED IT HOT.'],
  },
  snot: {
    name: 'THE SINUS', tag: 'MUCUS // MAW', sub: 'THE SHIP HAS A COLD', col: '#ecd25a', rgb: '236,210,90',
    dark: .4, mist: '160,140,40', bg: ['#0a0503', '#2a1c08'], edge: '#f4e49a', fog: '200,180,70',
    gore: ['#d0b840', '#7a4a18', '#f4e6a0', '#3a1a0a', '#fff4c8', '#a83a24'], blood: ['#c8ac3a', '#6a4a14', '#f2e08a'],
    boss: 'maw', bossName: 'THE MUCUS MAW', mid: 'brood', midName: 'THE BROOD MOTHER', haz: 'strand', hazEvery: 150,
    // hatchling floods out of wombs and the walls
    gap: 125, dbl: .5, set: 'flood', sig: 'hatch',
    mix: [['slime', 5], ['hatch', 3], ['womb', 3], ['corpse', 2], ['sine', 1.5], ['crawler', 1], ['eye', 1]],
    remix: { sig: 'slime', set: 'drip', drop: ['corpse', 'eye', 'sine'], add: [['zig', 1.2]], pool: [['mutant', 2], ['hook', 2], ['cross', 2], ['flayer', 2]] },
    logs: ['EVERYTHING IS COATED. IT IS WARM. IT IS MOVING.', 'I CAN HEAR IT BREATHING THROUGH THE WALLS.',
      'MY INTAKES ARE CLOGGED. THE CLOG IS CHEWING.', 'IT SNEEZED. I AM STILL INSIDE IT.'],
  },
};
export const BIOME_KEYS = Object.keys(BIOMES);

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
const DC0 = [...DC], C0 = { blood: C.blood, bloodD: C.bloodD, bloodL: C.bloodL };
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
function arena(b, ce, fl) {
  const [c0, f0] = REST[b] || REST.snot;
  ce = c0 + (ce - c0) * .5;
  fl = f0 + (fl - f0) * .5;
  if (fl - ce < ARENA_GAP) { const m = (fl + ce) / 2; fl = m + ARENA_GAP / 2; ce = m - ARENA_GAP / 2; }
  return [ce, fl];
}
/** blend the terrain from world x `from` onward (over 300px, all of it off-screen) into biome b; it stays that
 *  biome until the next rewrite, and always fades back to the untouched level over layout().tEnd, where the biome
 *  terrain hands back to the level's own corridor (the Gravity Drive approach; its chamber band is in world.ts). The biome shape
 *  and the base level both keep a >=104px gap, and a lerp of two such gaps can't be narrower. A layout with a run-up
 *  beat (long4) blends movement A (shape) into movement C (arena) over arenaBlend px from the run-up's scroll x, so
 *  the whole screen is arena by the time the run-up starts; a lerp of a >=108 and a >=150 gap stays >=108 */
function rewriteTerrain(seg, b, from) {
  const o = ($.G.loop + 1) * 37.1 + seg * 11, LY = layout(), [T_END0, T_END1] = LY.tEnd;
  const xC = LY.beats.runup != null ? beatPlan(slotRow(seg), from, false).runup : null, xC1 = xC != null ? xC + LY.beats.arenaBlend : 0;
  const i0 = Math.max(0, Math.floor(from / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil(T_END1 / TS));
  for (let i = i0; i <= i1; i++) {
    const x = i * TS, w = sstep(from, from + 300, x) * (1 - sstep(T_END0, T_END1, x));
    let [ce, fl] = shape(b, x, o);
    if (xC != null && x > xC) { const k = sstep(xC, xC1, x), [cc, ff] = arena(b, ce, fl); ce = lerp(ce, cc, k); fl = lerp(fl, ff, k); }
    FLOOR[i] = lerp(FLOOR[i], fl, w);
    CEIL[i] = lerp(CEIL[i], ce, w);
  }
}
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
const SET = {
  morgue: () => { corpse(PH * .25); corpse(PH * .5, { drift: .2 }); corpse(PH * .75); later(40, mutant); }, // a frozen crew drifting in a line, a hulk walking under it
  // set pieces are fixed: formation()'s power drones (up to +6) would close the walls' gap and stretch the pincer's wave
  walls: () => { formation('wall', PH * .33, 2, FIXED); formation('wall', PH * .67, 2, FIXED); crawler(1); crawler(-1); }, // a double wall, gap in the middle, crawlers on the lining
  pincer: () => { flayer(55); flayer(PH - 75); behindWave(PH / 2, 2, FIXED); }, // flayers top and bottom, a short rear wave between them
  flood: () => { hatch(ri(7, 9), false); hatch(ri(4, 6), true); slime(1); later(30, () => slime(-1)); },
  // remix sets
  crucify: () => { crossT(1); crossT(-1); later(30, mutant); later(70, () => crossT(R() < .5 ? 1 : -1)); }, // the shelves are lined with crucifixes
  gutter: () => { womb(); crawler(1); crawler(-1); later(35, () => { crawler(1); crawler(-1); }); later(70, () => eyeT(1)); }, // the lining crawls
  kiln: () => { mutant(); hookE(); later(40, () => { hookE(); flayer(PH / 2); }); later(80, mutant); }, // the meat line: hulks under swinging hooks
  drip: () => { slime(1); slime(-1); later(35, () => { slime(1); slime(-1); }); later(70, () => { slime(1); womb(); }); }, // the walls run with slimes
};
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
 *  beatPlan (src/layout.ts): short's single breath, or long4's beat template v2 (spec §3.2) */
export function biomeScript(seg, b, from, v = 0, rs = stageStream(stageOfSlot(seg))) {
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
  else at(BP.runup, () => logLine(logs[2]), 'log'); // arena run-up: line 3 (line 2 is the release, below)
  const sig = () => (rs() < .6 ? X.sig : roll()), sets = X.sets.map(P), two = secondKind(X);
  const inBreath = (y) => { for (const r of BR) if (y >= r.a && y < r.z) return r; return null; };
  const quiet = (y) => inBreath(y) || (!legacy && y >= BP.runup); // where an extra may not land: a breath, the run-up
  // the tempo band (layout().beats.tempo) for scroll x at progress q: the first whose `until` is still ahead
  const band = (x, q) => { for (const T of BT.tempo) if (typeof T.until === 'number' ? q < T.until : x < BR[T.until.breath].z) return T; return BT.tempo[BT.tempo.length - 1]; };
  const led = new Set();
  for (let x = a; x < z;) {
    const q = (x - a) / (z - a), T = band(x, q), st = Math.round(B.gap * T.gap), y2 = x + Math.round(st * .45), y3 = x + Math.round(st * .72);
    const br = inBreath(x);
    if (br) {
      x = br.z;
      // the release: one guaranteed pod formation (a drone wave drops a pod when it's wiped out) and log line 2
      if (br.release) { at(x, () => logLine(logs[1]), 'log'); at(x, el(() => formation('sine', PH / 2, FM)), 'pod'); x += st; }
      continue;
    }
    if (T.stop) break; // the arena run-up: nothing spawns from here to the boss
    if (sets.length && x + st / 2 > sets[0]) { sets.shift(); at(x, el(SET[X.set]), 'set:' + X.set); x += st; continue; }
    const pk = T.sig ? sig : roll, dbl = T.rel ? Math.min(.85, B.dbl + T.dbl) : T.dbl;
    if (T.lead && !led.has(T)) { led.add(T); const k = T.lead === 'sig' || !two ? X.sig : two; at(x, el(SPAWN[k]), k); x += st; continue; } // the band's first slot, alone
    const k1 = pk();
    at(x, el(SPAWN[k1]), k1);
    if (rs() < dbl && !quiet(y2)) { const k = pk(); at(y2, el(SPAWN[k]), k); } // extras never spill into a breath or the run-up
    if (hard && T.third && rs() < .35 && !quiet(y3)) { const k = pk(); at(y3, el(SPAWN[k]), k); }
    x += st;
  }
  // the midboss breath's centerpiece: the biome's own midboss. WARNING 150f (~150px) ahead so it lands ~60px before the breath's end and the scroll coasts to a stop inside it
  if (BP.warn != null) at(BP.warn, () => miniWarn(B.midName, () => midboss(B.mid, B.midName, b)), 'mid:' + B.mid);
  const boss = { crux, butcher, maw: () => maw(true) }[B.boss];
  at(g.bossX, () => miniWarn(B.bossName, () => { boss(); if ($.G.mini) { $.G.mini.title = B.bossName; $.G.mini.biome = b; } }), 'boss:' + B.boss);
  return S;
}

/** stage i's build stream for this run and descent (src/rng.ts): Rs = stream(seedOf(G.seed, G.loop, i)), fresh
 *  each call, so every build of a stage replays the same draws */
export const stageStream = (i) => stream(seedOf(($.G && $.G.seed) || 0, ($.G && $.G.loop) || 0, i));

/** build biome slot seg's stage from world x `from` (its gate, G.bx[seg]): blend its terrain in and script it.
 *  Reads the biome and visit number choose() stored (G.route[seg], G.visitNo[seg]), so a resume can call it again
 *  with the stored bx. Draws only the stage's build stream, never the sim R() */
export function biomeStage(seg, from) {
  const G = $.G, b = G.route[seg], v = G.visitNo[seg];
  rewriteTerrain(seg, b, from);
  insertScript(biomeScript(seg, b, from, v, stageStream(stageOfSlot(seg))));
}

// ---------------- the fork ----------------
export function holdForFork() { $.G.forkHold = true; }
export function openFork(seg) {
  const G = $.G, fresh = BIOME_KEYS.filter((k) => !G.route.includes(k) && !(G.visited || []).includes(k));
  const rest = BIOME_KEYS.filter((k) => !G.route.includes(k) && !fresh.includes(k)).sort(() => R() - .5);
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
  haz.length = amb.length = 0;
  applyPalette(null);
  if ($.G) { $.G.bx = Array(nSlots() + 1).fill(null); $.G.hazT = 90; $.G.hazHit = 0; }
}

function spawnHazard(b) {
  const G = $.G, P = $.P;
  let x = rr(W * .45, W * .9);
  for (let k = 0; k < 8 && P && Math.abs(x - P.x) < 46; k++) x = rr(W * .45, W * .9); // never drop it on the ship
  if (P && Math.abs(x - P.x) < 46) return;
  const wx = x + G.scroll, c = ceilAt(wx), f = floorAt(wx);
  if (b === 'icicle' && c > 4) haz.push({ k: b, x, y: c + 2, t: 0, vy: 0, len: rr(10, 18) });
  else if (b === 'geyser' && f < PH - 2) haz.push({ k: b, x, y: f, t: 0, top: c });
  else if (b === 'jet') { const up = R() < .5 && c > 4; haz.push({ k: b, x, y: up ? c : f, dir: up ? 1 : -1, t: 0, span: f - c }); }
  else if (b === 'strand' && G.scrollSpeed > .5) haz.push({ k: b, x: W + 10, t: 0, hp: 3, ph: R() * TAU });
}

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
  if (B && k > .9 && $.state === 'play' && !G.fork && !G.forkHold && !G.tally && !G.pick && !G.clearT && P0 && P0.alive && P0.inv < 60) {
    G.hazT = (G.hazT || 60) - 1;
    if (G.hazT <= 0) { spawnHazard(B.haz); G.hazT = B.hazEvery * (G.mini ? 1.6 : 1) * rr(.7, 1.3) / (1 + .3 * G.loop); }
  }
  const P = $.P;
  for (let i = haz.length - 1; i >= 0; i--) {
    const h = haz[i];
    h.t++;
    h.x -= ss;
    let dead = h.x < -30;
    if (h.k === 'icicle') {
      if (h.t > 50) { h.vy += .22; h.y += h.vy; }
      const wx = h.x + sc;
      if (h.y + h.len > floorAt(wx)) { dead = true; for (let q = 0; q < 10; q++) spark(h.x, floorAt(wx) - 2, rr(-2, 2), -rr(.5, 2.5), ri(10, 20), q % 2 ? '#e8f6ff' : '#9fd8ff'); sfx.tink(); }
      if (P && P.alive && Math.abs(P.x - h.x) < 5 && P.y > h.y && P.y < h.y + h.len + 4) { G.hazHit = 1; dead = true; }
    } else if (h.k === 'geyser' || h.k === 'jet') {
      const warm = h.k === 'geyser' ? 70 : 60, live = h.k === 'geyser' ? 45 : 70;
      if (h.t < warm && R() < .4) spark(h.x + rr(-4, 4), h.y - (h.dir || -1) * -2, rr(-.3, .3), (h.dir || -1) * rr(.3, 1.2), 12, h.k === 'geyser' ? '#7ff0d8' : pick(FIRE));
      if (h.t === warm) { sfx.glob(); if (h.k === 'jet') sfx.fireball && sfx.fireball(); }
      if (h.t >= warm) {
        const reach = (h.k === 'geyser' ? h.y - h.top : h.span) * (h.k === 'geyser' ? .62 : .55) * Math.min(1, (h.t - warm) / 8);
        h.reach = reach;
        const y0 = h.k === 'geyser' ? h.y - reach : h.dir > 0 ? h.y : h.y - reach, y1 = h.k === 'geyser' ? h.y : h.dir > 0 ? h.y + reach : h.y;
        if (P && P.alive && Math.abs(P.x - h.x) < 7 && P.y > y0 && P.y < y1) G.hazHit = 1;
        if (R() < .6) drop(h.x + rr(-3, 3), y0, rr(-1.2, 1.2), rr(-1.5, .5), rr(1, 1.6), h.k === 'geyser' ? 2 : 5, 40);
        if (h.k === 'jet') light(h.x, (y0 + y1) / 2, 40, .9);
      }
      if (h.t > warm + live) dead = true;
    } else if (h.k === 'strand') {
      const wx = h.x + sc, c = ceilAt(wx), f = floorAt(wx);
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
    if (h.k === 'icicle') for (const s of shots) if (!dead && Math.abs(s.x - h.x) < Math.max(6, Math.abs(s.vx || 0) * .6 + 1) && s.y > h.y - 4 && s.y < h.y + h.len + 4) { dead = true; for (let q = 0; q < 8; q++) spark(h.x, h.y + h.len / 2, rr(-2, 2), rr(-2, 2), 12, '#e8f6ff'); sfx.tink(); }
    if (dead) haz.splice(i, 1);
  }
}

// ---------------- drawing (art lives in render/biomeart.ts) ----------------
export function drawBiomeFX() { drawFX(haz, amb, gatePos); }
/** consume a hazard hit this frame (applied by the caller so playerHit stays in one place) */
export function hazardHit() { const h = $.G && $.G.hazHit; if (h) $.G.hazHit = 0; return !!h; }
/** test hook (tools/route-probe.mjs): live terrain + hazards */
(globalThis as any).__biome = () => ({ F: FLOOR, C: CEIL, TS, haz, k: $.G ? biomeK($.G.scroll + W / 2) : null });
