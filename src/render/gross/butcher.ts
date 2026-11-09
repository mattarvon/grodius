// @ts-nocheck
// Render-only: own RNG and particles (./midbosses.ts), no gameplay state touched. Sim: enemies/update.ts 'butcher', spawn.ts butcher().
import { TAU, hash } from '../../core';
import { glowC, fxs, spray, stepParts, drawParts, strand, snd, emit, rnd, rn, GROSS } from './midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, pour, trackDeath, woundStage } from './baked';

// =====================================================================
//  THE BURNING BUTCHER - a half carcass sawn down the spine, hung on two hooks, its own foreleg bone grown through a
//  rusted cleaver (Matt's pick c1 The Split Side; D46: carcass and offal only). Art: tools/bossart/butcher/bake.py ->
//  sprites/boss/butcher.png. The chains, the cleaver cone and the hook line stay in render/enemies.ts, under this.
// =====================================================================
const K = 'butcher';
const A0 = -4.05, ASTEP = .08, AN = 24; // the arm lists' angles: must match tools/bossart/butcher/bake.py
const PX = -10, PY = -10; // cleaver pivot (sim: sx = e.x - 10, sy = e.y - 10)
const BIG = { w: 16, h: 26, jets: 8, len: 90, meat: 22, rope: 6 };
const TOP = { w: 5, h: 4, jets: 3, len: 40, meat: 4, rope: 0 };
// the carcass tears off its hook: the bowel and the body pour as it drops, the shoulder slot spurts while it rips
const DEATH = {
  k: K, list: 'die', rate: 7, fall: .03, hold: 30,
  gore: (x, y, age) => { pour(x - 6, y + 14, age, BIG); if (age < 40) pour(x - 14, y - 24, age, TOP); },
};
// where it drips from, boss-local [x, y, len, period]: the hem, then the bowel once it is out, then the opened flank
const HEM = [[-6, 52, 12, 47], [5, 46, 9, 61], [12, 49, 14, 53], [21, 43, 8, 79], [-15, 42, 10, 67]];
const GUT = [[-12, 60, 16, 41], [-4, 63, 12, 57], [3, 58, 18, 49], [-18, 56, 10, 71]];
const TORN = [[-22, 12, 9, 39], [-9, 14, 12, 51], [-3, 2, 8, 63], [-14, -26, 7, 45]];

/** the body's stage: 0 whole, 1 torn, 2 chain snapped (bowel out), 3 ruined. The snap is the sim's e.cut */
const stage = (e) => { const w = woundStage(e); return w === 0 ? 0 : !e.cut ? 1 : w === 1 ? 2 : 3; };

export function drawButcher(c, e) {
  const s = fxs(e), t = e.t;
  stepParts(s);
  trackDeath(e, DEATH);
  if (e.hp <= 0) { if (!bf(c, K, 'die', 0)) bakedFallback(c, e.r); return; }
  const w = stage(e);
  if (e.cut && !s.f.cut) { // the chain goes: the flank splits and the bowel drops out in one heave
    s.f.cut = 1;
    spray(s, e.x - 8, e.y + 12, 26, '#6a0810', 2.4, 1.6, .5);
    spray(s, e.x - 4, e.y + 20, 12, '#3a0408', 1.8, 1.4, .2);
    snd('splat_l', .7, .3);
    snd('gsizzle', .5, .2);
  }
  // ---- the body ----
  let ok;
  if (e.flash) ok = bf(c, K, 'hurt' + w);
  else if (e.st === 'spit') ok = bf(c, K, 'spit' + w, e.wt < 5 || e.wt > 34 ? 0 : 1);
  else if (e.st === 'htel') ok = bf(c, K, 'htel' + w);
  else if (e.st === 'hook') ok = bf(c, K, 'hook' + w);
  else {
    // the hem and the bowel trail the swing (the sim's e.sw), and now and then the meat clenches on its own
    const cyc = Math.floor(t / 37), spas = hash(cyc * 2.3 + w) < .14 + .05 * w && t % 37 < 5;
    ok = spas ? bf(c, K, 'spasm' + w) : bf(c, K, 'idle' + w, Math.round((1 - Math.cos(e.sw - .5)) * 2));
  }
  if (!ok) { bakedFallback(c, e.r); return; }
  // ---- the cleaver arm: a baked frame per angle at the pivot; the edge heats through the tell and cools after the cut ----
  const ai = Math.max(0, Math.min(AN - 1, Math.round((e.ba - A0) / ASTEP)));
  bf(c, K, 'arm', ai);
  const heat = e.st === 'ctel' ? Math.min(1, e.wt / 40) : e.st === 'cut' ? Math.max(0, 1 - e.wt / 16) : 0;
  if (heat > 0) {
    c.globalAlpha = heat;
    bf(c, K, 'armh', ai);
    c.globalAlpha = 1;
  }
  // ---- live wet: threads off the hem, the bowel, the opened flank; each sheds real drops ----
  for (let i = 0; i < HEM.length; i++) { const h = HEM[i]; strand(c, s, e, 80 + i, h[0], h[1] - (w >= 2 ? 3 : 0), h[2], 1, 'rgba(60,6,12,.9)', h[3], '#5a0a10', 1.4); }
  if (w >= 2) for (let i = 0; i < GUT.length; i++) { const h = GUT[i]; strand(c, s, e, 90 + i, h[0], h[1] + (w - 2) * 3, h[2] + w * 3, 1.2, 'rgba(84,8,14,.92)', h[3] - w * 6, '#7a0a12', 2.2); }
  for (let i = 0; i < w + (w > 1 ? 1 : 0) && i < TORN.length; i++) { const h = TORN[i]; strand(c, s, e, 100 + i, h[0], h[1], h[2], 1.1, 'rgba(110,6,14,.95)', h[3], '#8a0c14', .6); }
  if (e.flash && rnd() < .55 * GROSS) emit(s, e.x + rn(-16, 10), e.y + rn(-20, 24), rn(-1.6, 1.2), rn(-2, .2), rnd() < .7 ? '#7a0a12' : '#3a0408', rn(.8, 1.6), 0, 60);
  // rendered fat spitting out of the char cracks on the burnt side: the heat is in the meat, not on it
  if (rnd() < .05 * s.dt * GROSS) emit(s, e.x - 18 + rn(-6, 6), e.y + rn(-14, 24), rn(-.6, .1), rn(-.8, -.2), '#e09040', rn(.6, 1), 1, 30, .1);
  // the spit: gobbets of black blood and burnt fat leave the windpipe bore with the gameplay fan
  if (e.st === 'spit' && (e.wt === 10 || e.wt === 26) && s.f.sw !== e.wt) {
    s.f.sw = e.wt;
    for (let k = 0; k < 10 * GROSS; k++) emit(s, e.x - 6, e.y - 35, rn(-3, -.6), rn(-1.4, .8), rnd() < .6 ? '#5a0608' : '#1a0204', rn(.8, 1.6), 0, 50);
    emit(s, e.x - 6, e.y - 35, rn(-2, -1), rn(-1, 0), '#ffb060', 1, 1, 24, .05);
  }
  // the hook throw: blood pumping from the hole in the spine the chain comes out of
  if (e.st === 'hook' && rnd() < .35 * s.dt) emit(s, e.x + 10 + rn(-1, 1), e.y - 7, rn(-.4, .6), rn(-.2, .6), '#6a0810', rn(.7, 1.2), 0, 50);
  drawParts(c, s, e);
  // ---- glow on the tells ----
  c.globalCompositeOperation = 'lighter';
  if (heat > 0) {
    const ca = Math.cos(e.ba), sa = Math.sin(e.ba);
    glowC(c, PX + ca * 30, PY + sa * 30, 10 + 8 * heat, '255,110,30', .2 + .45 * heat);
  }
  if (e.st === 'spit') glowC(c, -6, -36, 7 + (e.wt < 34 ? 6 : 0), '255,120,40', e.wt < 34 ? .5 : .15);
  if (e.st === 'htel') glowC(c, 10, -8, 5 + 6 * e.wt / 40, '255,40,30', .2 + .4 * e.wt / 40 * (((t >> 2) & 1) ? 1 : .6));
  c.globalCompositeOperation = 'source-over';
}

/** start the atlas download for the per-route warm-up (render/warmup.ts); false: nothing left to build */
export function warmButcher() { bakedWarm(K); return false; }
/** requested: the warm-up asks once */
export const butcherBuilt = () => bakedBuilt(K);
/** free the atlas when the route has left the fire biome */
export function dropButcher() { bakedDrop(K); }
