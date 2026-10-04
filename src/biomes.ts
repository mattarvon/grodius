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
import { drawFX } from './render/biomeart';
export { biomePat, biomeTerrainFill, biomeEdge, drawBiomeBG, drawBiomeDecor, splatCols, biomeDark, biomeMist } from './render/biomeart';

/** the two biome slots in the level (world x). Stage 1 = slot 0, stage 2 = slot 1. */
export const SEG = [
  { x0: 2300, x1: 5050, bossX: 4950 },
  { x0: 5150, x1: 8200, bossX: 8020 },
];

export const BIOMES = {
  ice: {
    name: 'THE CRYOVAULT', tag: 'FROZEN // CRUCIFER', sub: 'THE CREW IS STILL IN HERE. FROZEN MID-SCREAM', col: '#9fd8ff', rgb: '160,215,255',
    dark: .55, mist: '90,10,26', bg: ['#02060e', '#0e2840'], edge: '#f2fbff', fog: '120,180,230',
    gore: ['#7a1222', '#300610', '#d8efff', '#0c0809', '#8cc4ee', '#ffffff'], blood: ['#7a1222', '#300610', '#c8506a'],
    boss: 'crux', bossName: 'THE FROZEN CRUCIFER', haz: 'icicle', hazEvery: 95,
    mix: [['corpse', 4], ['wall', 2], ['sine', 2], ['cross', 2], ['eye', 2], ['flayer', 2], ['hook', 1]],
    logs: ['TEMPERATURE: -140C. THE BODIES ARE STANDING UP.', 'THE ICE IS FULL OF FACES.'],
  },
  acid: {
    name: 'THE DIGESTION TANKS', tag: 'DISSOLVING // MAW', sub: 'EVERYTHING DOWN HERE IS BEING EATEN', col: '#3fe8c8', rgb: '60,230,195',
    dark: .6, mist: '18,120,100', bg: ['#010605', '#081a15'], edge: '#7ff0d8', fog: '40,200,170',
    gore: ['#8a4630', '#2e140c', '#46e0c0', '#0c0809', '#ddd27a', '#c8f4e8'], blood: ['#1c9a80', '#0a3a32', '#6ff0d4'],
    boss: 'maw', bossName: 'THE DISSOLVED MAW', haz: 'geyser', hazEvery: 120,
    mix: [['womb', 3], ['hatch', 2], ['crawler', 3], ['eye', 2], ['dive', 2], ['corpse', 1]],
    logs: ['THE FLOOR IS STOMACH LINING. IT IS SECRETING.', 'MY HULL PLATING IS SIZZLING.'],
  },
  fire: {
    name: 'THE FURNACE', tag: 'BURNING // BUTCHER', sub: 'THEY BURNED THE BODIES. THE BODIES KEPT MOVING', col: '#ff7a1a', rgb: '255,120,30',
    dark: .6, mist: '50,12,6', bg: ['#040000', '#300702'], edge: '#ffb347', fog: '255,90,20',
    gore: ['#4a0a06', '#120202', '#ff6a1a', '#050303', '#ffb347', '#ff3a10'], blood: ['#6a0a08', '#240303', '#ff4a1a'],
    boss: 'butcher', bossName: 'THE BURNING BUTCHER', haz: 'jet', hazEvery: 105,
    mix: [['flayer', 3], ['hook', 3], ['zig', 2], ['dive', 2], ['crawler', 2], ['behind', 1]],
    logs: ['INCINERATOR RUNNING AT 4000C. SOMETHING IS SINGING IN IT.', 'ASH IS FALLING UP.'],
  },
  snot: {
    name: 'THE SINUS', tag: 'MUCUS // MAW', sub: 'THE SHIP HAS A COLD', col: '#ecd25a', rgb: '236,210,90',
    dark: .4, mist: '160,140,40', bg: ['#0a0503', '#2a1c08'], edge: '#f4e49a', fog: '200,180,70',
    gore: ['#d0b840', '#7a4a18', '#f4e6a0', '#3a1a0a', '#fff4c8', '#a83a24'], blood: ['#c8ac3a', '#6a4a14', '#f2e08a'],
    boss: 'maw', bossName: 'THE MUCUS MAW', haz: 'strand', hazEvery: 130,
    mix: [['womb', 3], ['hatch', 3], ['corpse', 2], ['sine', 2], ['crawler', 2], ['eye', 1]],
    logs: ['EVERYTHING IS COATED. IT IS WARM. IT IS MOVING.', 'I CAN HEAR IT BREATHING THROUGH THE WALLS.'],
  },
};
export const BIOME_KEYS = Object.keys(BIOMES);

// ---------------- where are we ----------------
export function biomeK(wx) {
  const G = $.G;
  if (!G || !G.route) return [null, 0];
  for (let s = 0; s < SEG.length; s++) {
    const b = G.route[s];
    if (!b) continue;
    const g = SEG[s], k = sstep(g.x0 + 150, g.x0 + 450, wx) * (1 - sstep(g.x1 - 100, g.x1 + 200, wx));
    if (k > 0) return [b, k];
  }
  return [null, 0];
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
function rewriteTerrain(seg, b, from) {
  const g = SEG[seg], o = ($.G.loop + 1) * 37.1 + seg * 11;
  const i0 = Math.max(0, Math.floor(from / TS)), i1 = Math.min(FLOOR.length - 1, Math.ceil((g.x1 + 260) / TS));
  for (let i = i0; i <= i1; i++) {
    const x = i * TS, [ce, fl] = shape(b, x, o);
    const w = sstep(from, from + 260, x) * (1 - sstep(g.x1 - 60, g.x1 + 260, x));
    FLOOR[i] = lerp(FLOOR[i], fl, w);
    CEIL[i] = lerp(CEIL[i], ce, w);
  }
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
function biomeScript(seg, b, from) {
  const B = BIOMES[b], g = SEG[seg], S = [], at = (x, f) => S.push({ x, f }), hard = $.G.loop > 0;
  const tot = B.mix.reduce((s, m) => s + m[1], 0), roll = () => { let r = R() * tot, k = 0; while ((r -= B.mix[k][1]) > 0) k++; return B.mix[k][0]; };
  const a = Math.max(g.x0 + 220, from + 40), z = g.bossX - 160;
  at(a - 20, () => logLine(B.logs[0]));
  at((a + z) / 2, () => logLine(B.logs[1]));
  for (let x = a; x < z; x += 118) {
    at(x, SPAWN[roll()]);
    if (R() < .55) at(x + 55, SPAWN[roll()]);
    if (hard && R() < .35) at(x + 85, SPAWN[roll()]);
  }
  if (seg === 1) at(Math.round((a + z) / 2) + 200, () => maw(false)); // a mid-stage gut-check in the second biome
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
  G.forkHold = true;
  banner('THE SHIP SPLITS', 'FLY INTO A GATE', '#e8f1ff', 160);
  sfx.alarm();
}
function choose(b) {
  const G = $.G, f = G.fork, seg = f.seg;
  G.route[seg] = b;
  G.fork = null;
  G.forkHold = false;
  const from = Math.max(SEG[seg].x0, G.scroll + W + 10);
  rewriteTerrain(seg, b, from);
  insertScript(biomeScript(seg, b, from));
  G.pend.push({ t: 40, f: () => startStage(seg + 1) });
  flash($.P.x, $.P.y, 80, 18, BIOMES[b].rgb);
  sfx.power();
  buzz('heavy');
}
const gatePos = (i) => ({ x: W * .74, y: i ? PH * .72 : PH * .28 });

// ---------------- hazards + ambience ----------------
const haz = [], amb = [];
export function biomeReset() {
  haz.length = amb.length = 0;
  applyPalette(null);
}

function spawnHazard(b) {
  const G = $.G, x = rr(W * .45, W * .9), wx = x + G.scroll, c = ceilAt(wx), f = floorAt(wx);
  if (b === 'icicle' && c > 4) haz.push({ k: b, x, y: c + 2, t: 0, vy: 0, len: rr(10, 18) });
  else if (b === 'geyser' && f < PH - 2) haz.push({ k: b, x, y: f, t: 0, top: c });
  else if (b === 'jet') { const up = R() < .5 && c > 4; haz.push({ k: b, x, y: up ? c : f, dir: up ? 1 : -1, t: 0, span: f - c }); }
  else if (b === 'strand') haz.push({ k: b, x: W + 10, t: 0, hp: 3, ph: R() * TAU });
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
    if ($.P && $.P.alive && f.t > 40) for (let i = 0; i < 2; i++) { const p = gatePos(i); if (dist2($.P.x, $.P.y, p.x, p.y) < 24 * 24) { choose(f.opts[i]); break; } }
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
  if (B && k > .9 && $.state === 'play' && !G.fork) {
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
      for (const s of shots) if (s.k === 'bolt' && Math.abs(s.x - h.x) < 5 && s.y > c && s.y < f && !(s.hit && s.hit.has(h))) {
        (s.hit || (s.hit = new Set())).add(h);
        if (--h.hp <= 0) { dead = true; for (let q = 0; q < 10; q++) drop(h.x, s.y + rr(-10, 10), rr(-1, 1), rr(-1, 1), 1.4, 0, 70); sfx.squish(); }
      }
    }
    if (h.k === 'icicle') for (const s of shots) if (!dead && dist2(s.x, s.y, h.x, h.y + h.len / 2) < 64) { dead = true; for (let q = 0; q < 8; q++) spark(h.x, h.y + h.len / 2, rr(-2, 2), rr(-2, 2), 12, '#e8f6ff'); sfx.tink(); }
    if (dead) haz.splice(i, 1);
  }
}

// ---------------- drawing (art lives in render/biomeart.ts) ----------------
export function drawBiomeFX() { drawFX(haz, amb, gatePos); }
/** consume a hazard hit this frame (applied by the caller so playerHit stays in one place) */
export function hazardHit() { const h = $.G && $.G.hazHit; if (h) $.G.hazHit = 0; return !!h; }
