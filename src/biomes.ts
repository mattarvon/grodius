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
import { banner, behindWave, butcher, corpse, crawler, crossT, eyeT, flayer, formation, hatch, hookE, logLine, maw, miniWarn, womb, crux } from './enemies/spawn';
import { glow, light } from './render/util';
import { startStage } from './stages';

/** the two biome slots in the level (world x). Stage 1 = slot 0, stage 2 = slot 1. */
export const SEG = [
  { x0: 2300, x1: 5050, bossX: 4950 },
  { x0: 5150, x1: 8200, bossX: 8020 },
];

export const BIOMES = {
  ice: {
    name: 'THE CRYOVAULT', tag: 'FROZEN // CRUCIFER', sub: 'THE CREW IS STILL IN HERE. FROZEN MID-SCREAM', col: '#9fd8ff', rgb: '160,215,255',
    bg: ['#04101c', '#163552'], edge: '#e8f6ff', fog: '120,180,230',
    gore: ['#8e1a2a', '#3e0a14', '#cfe8ff', '#0c0809', '#7fb8e8', '#ffffff'], blood: ['#8e1a2a', '#3e0a14', '#d4485a'],
    boss: 'crux', bossName: 'THE FROZEN CRUCIFER', haz: 'icicle', hazEvery: 110,
    // slow and heavy: fewer, tougher things drifting out of the cold
    gap: 115, dbl: .5, set: 'morgue',
    mix: [['corpse', 3], ['cross', 3], ['flayer', 2], ['eye', 2], ['hook', 2], ['wall', 2], ['sine', 2]],
    logs: ['TEMPERATURE: -140C. THE BODIES ARE STANDING UP.', 'THE ICE IS FULL OF FACES.'],
  },
  acid: {
    name: 'THE DIGESTION TANKS', tag: 'DISSOLVING // MAW', sub: 'EVERYTHING DOWN HERE IS BEING EATEN', col: '#a6ff2a', rgb: '160,255,40',
    bg: ['#030a03', '#16300a'], edge: '#d8ff6a', fog: '120,220,40',
    gore: ['#6faf12', '#2a4806', '#d8ff4a', '#0c0809', '#e8e05a', '#aaff00'], blood: ['#6faf12', '#2a4806', '#c8ff3a'],
    boss: 'maw', bossName: 'THE DISSOLVED MAW', haz: 'geyser', hazEvery: 135,
    // wall swarms over a floor full of crawlers and wombs
    gap: 125, dbl: .5, set: 'walls',
    mix: [['wall', 4], ['crawler', 3], ['womb', 2], ['eye', 2], ['dive', 1], ['hatch', 1]],
    logs: ['THE FLOOR IS STOMACH LINING. IT IS SECRETING.', 'MY HULL PLATING IS SIZZLING.'],
  },
  fire: {
    name: 'THE FURNACE', tag: 'BURNING // BUTCHER', sub: 'THEY BURNED THE BODIES. THE BODIES KEPT MOVING', col: '#ff7a1a', rgb: '255,120,30',
    bg: ['#120302', '#4a0c02'], edge: '#ffb347', fog: '255,90,20',
    gore: ['#5a0806', '#1c0303', '#ff6a1a', '#0c0809', '#ffb347', '#ff3a10'], blood: ['#6a0a08', '#240303', '#ff4a1a'],
    boss: 'butcher', bossName: 'THE BURNING BUTCHER', haz: 'jet', hazEvery: 125,
    // aggressive: tight spacing, divers and flayers, things coming from behind
    gap: 100, dbl: .6, set: 'pincer',
    mix: [['flayer', 3], ['dive', 3], ['hook', 2], ['zig', 2], ['crawler', 2], ['behind', 1]],
    logs: ['INCINERATOR RUNNING AT 4000C. SOMETHING IS SINGING IN IT.', 'ASH IS FALLING UP.'],
  },
  snot: {
    name: 'THE SINUS', tag: 'MUCUS // MAW', sub: 'THE SHIP HAS A COLD', col: '#d8e04a', rgb: '210,220,70',
    bg: ['#0c0e04', '#2e3208'], edge: '#f0f08a', fog: '200,210,60',
    gore: ['#c8c03a', '#6a7a18', '#f0e88a', '#3a4010', '#e8f0a0', '#a0c040'], blood: ['#b8b030', '#5a6a14', '#e8e070'],
    boss: 'maw', bossName: 'THE MUCUS MAW', haz: 'strand', hazEvery: 150,
    // hatchling floods out of wombs and the walls
    gap: 125, dbl: .45, set: 'flood',
    mix: [['hatch', 4], ['womb', 3], ['corpse', 2], ['sine', 2], ['crawler', 1], ['eye', 1]],
    logs: ['EVERYTHING IS COATED. IT IS WARM. IT IS MOVING.', 'I CAN HEAR IT BREATHING THROUGH THE WALLS.'],
  },
};
export const BIOME_KEYS = Object.keys(BIOMES);

// ---------------- where are we ----------------
// G.bx[s] = world x where biome s starts (just off the right edge when its gate was taken); G.bx[2] = where the
// second biome hands back to the ship (just off the right edge when stage 2 clears). A biome holds through its
// boss and the fork that follows, and crossfades into the next one over ~320px.
const fadeIn = (x, wx) => sstep(x - 280, x + 40, wx);
export function biomeK(wx) {
  const G = $.G;
  if (!G || !G.route || !G.bx) return [null, 0];
  let best = null, bk = 0;
  for (let s = 0; s < SEG.length; s++) {
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
/** the biome terrain hands back to the level's own terrain here: the Gravity Drive chamber opens up from 8300 */
const T_END0 = 8300, T_END1 = 8600;
/** blend the terrain from world x `from` onward (over 300px, all of it off-screen) into biome b; it stays that
 *  biome until the next rewrite, and always fades back to the untouched level over T_END0..T_END1. The biome shape
 *  and the base level both keep a >=104px gap, and a lerp of two such gaps can't be narrower. */
function rewriteTerrain(seg, b, from) {
  const o = ($.G.loop + 1) * 37.1 + seg * 11;
  const i0 = Math.max(0, Math.floor(from / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil(T_END1 / TS));
  for (let i = i0; i <= i1; i++) {
    const x = i * TS, [ce, fl] = shape(b, x, o), w = sstep(from, from + 300, x) * (1 - sstep(T_END0, T_END1, x));
    FLOOR[i] = lerp(FLOOR[i], fl, w);
    CEIL[i] = lerp(CEIL[i], ce, w);
  }
}
/** stage 2 cleared: the biome's look and hazards hand back to the Gravity Drive approach from just off-screen */
export function biomeExit() {
  const G = $.G;
  if (!G || !G.bx || G.bx[2] != null || !G.route[1]) return;
  G.bx[2] = G.scroll + W + 10;
}

// ---------------- enemy script for a biome slot ----------------
const SPAWN = {
  corpse: () => corpse(rr(50, PH - 80)), wall: () => formation('wall', PH / 2), sine: () => formation('sine', rr(50, PH - 90)),
  zig: () => formation('zig', rr(60, PH - 90)), dive: () => formation('dive', rr(50, PH - 90)), cross: () => crossT(R() < .6 ? 1 : -1),
  eye: () => eyeT(R() < .55 ? 1 : -1), flayer: () => flayer(rr(60, PH - 60)), hook: () => hookE(), womb: () => womb(),
  hatch: () => hatch(ri(5, 8), R() < .5), crawler: () => crawler(R() < .6 ? 1 : -1), behind: () => behindWave(rr(70, PH - 70)),
};
function insertScript(entries) {
  const G = $.G, rest = G.script.slice(G.si).concat(entries).sort((a, b) => a.x - b.x);
  G.script = G.script.slice(0, G.si).concat(rest);
}
// one signature set piece per biome, dropped in twice per slot
const SET = {
  morgue: () => { corpse(PH * .25); corpse(PH * .5, { drift: .2 }); corpse(PH * .75); }, // a frozen crew drifting in a line
  walls: () => { formation('wall', PH * .33, 4); formation('wall', PH * .67, 4); }, // a double wall, gap in the middle
  pincer: () => { formation('dive', 55); formation('dive', PH - 75); behindWave(PH / 2, 4); },
  flood: () => { hatch(ri(9, 12), false); hatch(ri(5, 7), true); },
};
function biomeScript(seg, b, from) {
  const B = BIOMES[b], g = SEG[seg], S = [], at = (x, f) => S.push({ x, f }), hard = $.G.loop > 0;
  const tot = B.mix.reduce((s, m) => s + m[1], 0), roll = () => { let r = R() * tot, k = 0; while ((r -= B.mix[k][1]) > 0) k++; return B.mix[k][0]; };
  const a = Math.max(g.x0 + 220, from + 60), z = g.bossX - 160, mid = Math.round((a + z) / 2);
  at(a - 40, () => logLine(B.logs[0]));
  at(mid, () => logLine(B.logs[1]));
  for (let x = a; x < z; x += B.gap) {
    if (Math.abs(x - (a + (z - a) * .3)) <= B.gap / 2 || Math.abs(x - (a + (z - a) * .75)) <= B.gap / 2) { at(x, SET[B.set]); continue; }
    at(x, SPAWN[roll()]);
    if (R() < B.dbl) at(x + Math.round(B.gap * .45), SPAWN[roll()]);
    if (hard && R() < .35) at(x + Math.round(B.gap * .72), SPAWN[roll()]);
  }
  if (seg === 1) at(mid + 200, () => maw(false)); // a mid-stage gut-check in the second biome
  const boss = { crux, butcher, maw: () => maw(true) }[B.boss];
  at(g.bossX, () => miniWarn(B.bossName, () => { boss(); if ($.G.mini) { $.G.mini.title = B.bossName; $.G.mini.biome = b; } }));
  return S;
}

// ---------------- the fork ----------------
export function holdForFork() { $.G.forkHold = true; }
export function openFork(seg) {
  const G = $.G, fresh = BIOME_KEYS.filter((k) => !G.route.includes(k) && !(G.visited || []).includes(k));
  let pool = fresh.length >= 2 ? fresh : BIOME_KEYS.filter((k) => !G.route.includes(k));
  pool = pool.sort(() => R() - .5).slice(0, 2);
  G.fork = { seg, opts: pool, t: 0 };
  G.fork.gy = gateYs();
  G.forkHold = true;
  haz.length = 0; // anything left over (a strand parked off-screen) doesn't follow you through the gate
  if (G.tally) G.tally.t = Math.min(G.tally.t, 30); // the stage card fades out as the gates open (it covers their labels)
  banner('THE SHIP SPLITS', 'FLY INTO A GATE', '#e8f1ff', 160);
  sfx.alarm();
}
function choose(b) {
  const G = $.G, f = G.fork, seg = f.seg;
  G.route[seg] = b;
  G.fork = null;
  G.forkHold = false;
  const from = Math.max(SEG[seg].x0, G.scroll + W + 10);
  (G.bx ||= [null, null, null])[seg] = from;
  rewriteTerrain(seg, b, from);
  insertScript(biomeScript(seg, b, from));
  G.pend.push({ t: 40, f: () => startStage(seg + 1) });
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
  if ($.G) { $.G.bx = [null, null, null]; $.G.hazT = 90; $.G.hazHit = 0; }
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
      if (h.t < warm && R() < .4) spark(h.x + rr(-4, 4), h.y - (h.dir || -1) * -2, rr(-.3, .3), (h.dir || -1) * rr(.3, 1.2), 12, h.k === 'geyser' ? '#a6ff2a' : pick(FIRE));
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

// ---------------- drawing ----------------
const PAT = {};
function biomePat(b) {
  if (PAT[b]) return PAT[b];
  return (PAT[b] = mkTex((x) => {
    let s = b.length * 97 + 13;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (b === 'ice') {
      x.fillStyle = '#5f8cb4'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 14; i++) { x.fillStyle = r() < .5 ? 'rgba(220,240,255,.35)' : 'rgba(30,70,110,.35)'; x.beginPath(); x.moveTo(r() * 64, r() * 64); x.lineTo(r() * 64, r() * 64); x.lineTo(r() * 64, r() * 64); x.fill(); }
      x.strokeStyle = 'rgba(240,250,255,.6)'; x.lineWidth = .6; for (let i = 0; i < 6; i++) { x.beginPath(); let px = r() * 64, py = r() * 64; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += r() * 16 - 8; py += r() * 16 - 8; x.lineTo(px, py); } x.stroke(); }
    } else if (b === 'acid') {
      x.fillStyle = '#1a240c'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(${90 + r() * 80 | 0},${160 + r() * 90 | 0},20,${.15 + r() * .3})`; x.beginPath(); x.arc(r() * 64, r() * 64, 1 + r() * 4, 0, TAU); x.fill(); }
      for (let i = 0; i < 5; i++) { x.fillStyle = 'rgba(170,255,40,.4)'; const px = r() * 64; x.fillRect(px, r() * 30, 1, 10 + r() * 24); }
    } else if (b === 'fire') {
      x.fillStyle = '#1c0e0a'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 18; i++) { x.fillStyle = `rgba(${40 + r() * 30 | 0},${20 + r() * 14 | 0},${16 + r() * 10 | 0},.8)`; x.fillRect(r() * 64, r() * 64, 4 + r() * 10, 3 + r() * 6); }
      x.strokeStyle = '#ff6a1a'; x.lineWidth = 1; for (let i = 0; i < 4; i++) { x.beginPath(); let px = r() * 64, py = r() * 64; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += r() * 14 - 7; py += r() * 14 - 7; x.lineTo(px, py); } x.stroke(); }
    } else {
      x.fillStyle = '#7a8420'; x.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 20; i++) { x.fillStyle = r() < .5 ? 'rgba(220,220,90,.35)' : 'rgba(60,70,10,.4)'; x.beginPath(); x.ellipse(r() * 64, r() * 64, 2 + r() * 7, 1 + r() * 4, r() * 3, 0, TAU); x.fill(); }
      for (let i = 0; i < 6; i++) { x.fillStyle = '#e8e07a'; const px = r() * 64, py = r() * 64; x.beginPath(); x.arc(px, py, 1.5 + r() * 1.5, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,220,.8)'; x.fillRect(px - .5, py - 1, 1, 1); }
    }
  }));
}
/** terrain fill overlay: call with the terrain path still set */
export function biomeTerrainFill(mtx) {
  const [b, k] = biomeK($.G.scroll + W / 2);
  if (!b) return 0;
  const p = biomePat(b);
  p.setTransform(mtx);
  ctx.globalAlpha = k;
  ctx.fillStyle = p;
  ctx.fill();
  ctx.globalAlpha = 1;
  return k;
}
export const biomeEdge = () => { const [b, k] = biomeK($.G.scroll + W / 2); return b && k > .5 ? BIOMES[b].edge : null; };

export function drawBiomeBG(sc) {
  const [b, k] = biomeK(sc + W / 2);
  if (!b) return;
  const B = BIOMES[b], t = $.T;
  ctx.globalAlpha = k;
  const g = ctx.createLinearGradient(0, 0, 0, PH);
  g.addColorStop(0, B.bg[0]); g.addColorStop(1, B.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, PH);
  if (b === 'ice') {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(120,255,200,${.05 + .03 * Math.sin(t * .01 + i)})`; ctx.beginPath(); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, 30 + i * 18 + Math.sin(x * .02 + t * .008 + i * 2) * 10); ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.fill(); }
    // frozen wall with bodies stuck in it
    const off = (sc * .3) % 90;
    for (let x = -off; x < W + 90; x += 90) {
      const id = Math.floor((x + sc * .3) / 90), h = hash(id * 1.3);
      ctx.fillStyle = 'rgba(150,200,240,.16)'; ctx.fillRect(x, PH * .25 + h * 30, 70, PH);
      ctx.fillStyle = 'rgba(20,40,70,.55)'; const bx = x + 20 + h * 30, by = PH * .45 + h * 40;
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.fill(); ctx.fillRect(bx - 4, by + 4, 8, 18); ctx.fillRect(bx - 11 + h * 4, by + 6 - h * 8, 6, 3); ctx.fillRect(bx + 5, by + 2 + h * 6, 7, 3);
    }
  } else if (b === 'acid') {
    const off = (sc * .25) % 120;
    for (let x = -off; x < W + 120; x += 120) {
      const h = hash(Math.floor((x + sc * .25) / 120) * 2.1);
      ctx.fillStyle = 'rgba(10,20,6,.8)'; ctx.fillRect(x + 10, PH * .35 + h * 30, 60, PH);
      ctx.fillStyle = `rgba(160,255,40,${.25 + .1 * Math.sin(t * .05 + h * 9)})`; ctx.fillRect(x + 14, PH * .35 + h * 30 + 14, 52, 4);
      ctx.globalCompositeOperation = 'lighter'; glow(x + 40, PH * .35 + h * 30 + 16, 30, '120,255,40', .25 * k); ctx.globalCompositeOperation = 'source-over';
    }
  } else if (b === 'fire') {
    for (let x = 0; x < W; x += 6) { const h = 30 + 40 * vnoise((x + sc * .2) / 40 + t * .02) + 20 * Math.sin(t * .1 + x); ctx.fillStyle = `rgba(255,${80 + h | 0},20,.12)`; ctx.fillRect(x, PH - h, 6, h); }
    ctx.globalCompositeOperation = 'lighter'; glow(W * .5, PH + 20, 260, '255,80,10', .35 * k); ctx.globalCompositeOperation = 'source-over';
  } else {
    const off = (sc * .35) % 40;
    ctx.strokeStyle = 'rgba(200,210,60,.22)'; ctx.lineWidth = 2;
    for (let x = -off; x < W + 40; x += 40) { const h = hash(Math.floor((x + sc * .35) / 40)); ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(t * .02 + h * 6) * 10, PH * (.3 + h * .3), x + 4, PH * (.45 + h * .4)); ctx.stroke(); ctx.fillStyle = 'rgba(220,220,80,.3)'; ctx.beginPath(); ctx.arc(x + 4, PH * (.45 + h * .4) + 3, 3, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 3; i++) { const x = ((i * 180 - sc * .15) % (W + 120) + W + 120) % (W + 120) - 60, r = 34 + 6 * Math.sin(t * .04 + i); ctx.fillStyle = 'rgba(150,160,40,.18)'; ctx.beginPath(); ctx.ellipse(x, PH * .5 + i * 20 - 20, r, r * .8, 0, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function drawBiomeDecor(sc) {
  const [b, k] = biomeK(sc + W / 2);
  if (!b || k < .05) return;
  ctx.globalAlpha = k;
  for (let wx = Math.floor(sc / 14) * 14; wx < sc + W + 14; wx += 14) {
    const x = wx - sc, c = ceilAt(wx), f = floorAt(wx), h = hash(wx * .37);
    if (b === 'ice' && c > -2 && h < .7) {
      const len = 4 + h * 14; ctx.fillStyle = '#cfe8ff'; ctx.beginPath(); ctx.moveTo(x - 2.5, c); ctx.lineTo(x + 2.5, c); ctx.lineTo(x, c + len); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x - 1, c, 1, len * .6);
    } else if (b === 'acid') {
      if (f < PH && h < .5) { ctx.globalCompositeOperation = 'lighter'; glow(x, f, 10, '140,255,40', .3 * k); ctx.globalCompositeOperation = 'source-over'; }
      if (c > -2 && h > .75) { const d = (($.T + h * 200) % 90) / 90; ctx.fillStyle = '#a6ff2a'; ctx.fillRect(x, c + d * 30, 1.5, 3); }
    } else if (b === 'fire') {
      if (f < PH + 2) { ctx.globalCompositeOperation = 'lighter'; const fl = .5 + .5 * Math.sin($.T * .2 + wx); glow(x, f + 2, 12 + fl * 6, '255,100,20', .35 * k); ctx.globalCompositeOperation = 'source-over'; if (h < .15) light(x, f, 40, .8); }
    } else if (b === 'snot') {
      if (c > -2 && h < .45) { const len = 6 + h * 26 + Math.sin($.T * .03 + wx) * 3; ctx.strokeStyle = 'rgba(220,220,90,.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, c); ctx.lineTo(x + Math.sin($.T * .02 + wx) * 2, c + len); ctx.stroke(); ctx.fillStyle = '#e8e07a'; ctx.beginPath(); ctx.arc(x + Math.sin($.T * .02 + wx) * 2, c + len + 1.5, 2, 0, TAU); ctx.fill(); }
      if (f < PH && h > .8) { const r = 3 + (h - .8) * 30; ctx.fillStyle = '#b8b030'; ctx.beginPath(); ctx.arc(x, f - r * .5, r, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#f0f0a0'; ctx.beginPath(); ctx.arc(x, f - r * .8, r * .4, 0, TAU); ctx.fill(); }
    }
  }
  ctx.globalAlpha = 1;
}

export function drawBiomeFX() {
  for (const p of amb) {
    if (p.em) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, 1, 1); glow(p.x, p.y, 3, '255,120,30', .3); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.bub) { ctx.strokeStyle = 'rgba(170,255,60,.6)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.stroke(); }
    else if (p.glob) { ctx.fillStyle = p.c; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.s * .7, p.s, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(220,220,90,.35)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 8); ctx.stroke(); }
    else { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s); }
  }
  const sc = $.G ? $.G.scroll : 0;
  for (const h of haz) {
    if (h.k === 'icicle') {
      const sh = h.t < 50 ? Math.sin(h.t * 1.7) * 1.2 : 0;
      ctx.fillStyle = '#cfe8ff'; ctx.beginPath(); ctx.moveTo(h.x - 4 + sh, h.y); ctx.lineTo(h.x + 4 + sh, h.y); ctx.lineTo(h.x + sh, h.y + h.len); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(h.x - 1.5 + sh, h.y, 1, h.len * .7);
      if (h.t < 50 && (h.t >> 2) % 2) { ctx.fillStyle = 'rgba(255,60,60,.8)'; ctx.fillRect(h.x - 1, h.y + h.len + 3, 2, 2); }
    } else if (h.k === 'geyser' || h.k === 'jet') {
      const geo = h.k === 'geyser', col = geo ? '160,255,40' : '255,110,20';
      if (!h.reach) { ctx.fillStyle = `rgba(${col},${.3 + .3 * Math.sin(h.t * .5)})`; ctx.fillRect(h.x - 5, geo ? h.y - 3 : h.dir > 0 ? h.y : h.y - 3, 10, 3); continue; }
      const y0 = geo ? h.y - h.reach : h.dir > 0 ? h.y : h.y - h.reach;
      ctx.globalCompositeOperation = 'lighter';
      for (let q = 0; q < 3; q++) { ctx.fillStyle = `rgba(${col},${.35 - q * .1})`; ctx.fillRect(h.x - 3 - q * 2 + Math.sin($.T * .7 + q) * 1.5, y0, 6 + q * 4, h.reach); }
      glow(h.x, y0 + h.reach / 2, 30, col, .5);
      ctx.globalCompositeOperation = 'source-over';
    } else if (h.k === 'strand') {
      const wx = h.x + sc, c = ceilAt(wx), f = floorAt(wx), sw = Math.sin($.T * .05 + h.ph) * 5;
      ctx.strokeStyle = 'rgba(200,200,60,.85)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(h.x, c); ctx.quadraticCurveTo(h.x + sw, (c + f) / 2, h.x, f); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,200,.5)'; ctx.lineWidth = .8; ctx.stroke();
      ctx.fillStyle = '#e8e07a'; ctx.beginPath(); ctx.arc(h.x + sw * .5, (c + f) / 2, 3, 0, TAU); ctx.fill();
    }
  }
  // fork gates
  const G = $.G;
  if (G && G.fork) {
    const f = G.fork;
    for (let i = 0; i < 2; i++) {
      const p = gatePos(i), B = BIOMES[f.opts[i]], open = Math.min(1, f.t / 40), r = 22 * open;
      ctx.globalCompositeOperation = 'lighter';
      glow(p.x, p.y, r * 2.4, B.rgb, .45);
      ctx.globalCompositeOperation = 'source-over';
      for (let q = 0; q < 3; q++) { ctx.strokeStyle = B.col; ctx.globalAlpha = .9 - q * .25; ctx.lineWidth = 2.2 - q * .5; ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(.5, r - q * 4), Math.max(.5, r - q * 4) * 1.15, $.T * (.03 + q * .02) * (i ? -1 : 1), 0, TAU * .82); ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, Math.max(.5, r * .55), Math.max(.5, r * .65), 0, 0, TAU); ctx.fill();
      light(p.x, p.y, 60, .9);
      if (open > .9) {
        const tw = 104;
        ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(p.x - tw - 30, p.y - 9, tw, 18);
        ctx.font = `8px ${'Silkscreen, monospace'}`; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = B.col; ctx.fillText(B.name, p.x - 34, p.y - 7);
        ctx.font = `7px ${'Silkscreen, monospace'}`; ctx.fillStyle = '#8fa3b8'; ctx.fillText(B.tag, p.x - 34, p.y + 2);
      }
    }
    const left = Math.max(0, Math.ceil((900 - f.t) / 60));
    ctx.font = `7px ${'Silkscreen, monospace'}`; ctx.textAlign = 'center'; ctx.fillStyle = '#cfd9e3'; ctx.fillText('FLY INTO A GATE  ' + left, W * .74, PH * .5 - 3);
    ctx.textAlign = 'left';
  }
}
/** consume a hazard hit this frame (applied by the caller so playerHit stays in one place) */
export function hazardHit() { const h = $.G && $.G.hazHit; if (h) $.G.hazHit = 0; return !!h; }
/** test hook (tools/route-probe.mjs): live terrain + hazards */
(globalThis as any).__biome = () => ({ F: FLOOR, C: CEIL, TS, haz, k: $.G ? biomeK($.G.scroll + W / 2) : null });
