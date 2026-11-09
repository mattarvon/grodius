// @ts-nocheck
// Render-only: own RNG and particles (../midbosses.ts), no gameplay state touched. Sim: enemies/mid/prentice.ts.
import { $ } from '../../../state';
import { TAU, ctx, hash } from '../../../core';
import { ceilAt } from '../../../world';
import { drawChain } from '../../util';
import { glowC, fxs, emit, spray, stepParts, drawParts, strand, snd, rnd, rn, GROSS } from '../midbosses';
import { bakedBuilt, bakedDrop, bakedFallback, bakedWarm, bf, breath, pour, trackDeath, twitch, woundStage } from '../baked';

// =====================================================================
//  THE BUTCHER'S APPRENTICE - Grown Into the Blade (Matt's pick c2): an adult carcass starved to ribs and dried gut, hung on a hook
//  through the skull; its fractured upper arm has splintered into a pitted iron blade that is most of its silhouette.
//  Art: tools/bossart/prentice/bake.py -> sprites/boss/prentice.png. The blade is 24 baked angles, chosen by the sim's e.ba
// =====================================================================
const K = 'prentice';
const PX = -8, PY = -6; // the sim's cleaver pivot (enemies/mid/prentice.ts sx, sy)
// blade angles baked: A0 down to A0 - SPAN in NA steps (bake.py BLADE_A): every angle the sim sets (-2.3 idle, -2.4 tell, to -3.98 cut)
const A0 = -2.2, SPAN = 1.85, NA = 24, NT = 4;
const DEATH = {
  k: K, list: 'die', rate: 7, hold: 30, fall: .06,
  // the gut lets go where it hung, and the arm's stump pumps
  gore: (x, y, age) => { pour(x + 4, y + 8, age, { w: 9, h: 20, jets: 6, len: 76, meat: 16, rope: 4 }); if (age < 40) pour(x - 8, y - 6, age, { w: 4, h: 4, jets: 2, len: 40, meat: 0, rope: 0 }); },
};
// dried gut ends under the body (they drip), and the belly tear's lip from stage 1 on: [x, y, len, P]
const GUT = [[2, 25, 6, 61], [6, 27, 8, 47], [-1, 28, 5, 83], [8, 30, 7, 55]];
const TEAR = [[2, 2, 7, 41], [6, 10, 9, 37], [3, 16, 6, 52], [9, 4, 5, 66]];
// blade drip points, blade-local: [along from the pivot, toward the edge] (edge sits ~14 px off the pivot line)
const EDGE = [[22, 13], [34, 12.5], [44, 11]];

const bladeIndex = (ba) => Math.max(0, Math.min(NA - 1, Math.round((A0 - ba) / (SPAN / (NA - 1)))));
/** spit's mouth frame by e.wt: it gapes before each of the sim's two fans (24f and 38f), -1 = shut */
const mouthAt = (wt) => (wt < 14 ? -1 : wt < 20 ? 0 : wt < 22 ? 1 : wt < 30 ? 2 : wt < 34 ? 1 : wt < 44 ? 2 : wt < 48 ? 0 : -1);

function grossPrentice(c, e) {
  const s = fxs(e), t = e.t, ba = e.ba ?? -2.3;
  stepParts(s);
  trackDeath(e, DEATH);
  if (e.hp <= 0) { if (!bf(c, K, 'die', 0)) bakedFallback(c, e.r); return; }
  const w = woundStage(e), tel = e.st === 'tel' ? Math.min(1, e.wt / 50) : 0, mo = e.st === 'spit' ? mouthAt(e.wt) : -1;
  const ca = Math.cos(ba), sa = Math.sin(ba);
  // ---- the meat: breathing, a hurt frame on a hit, the mouth when it spits
  let ok;
  if (e.flash) ok = bf(c, K, 'hurt' + w);
  else if (mo >= 0) ok = bf(c, K, 'spit' + w, mo);
  else ok = bf(c, K, 'idle' + w, tel ? twitch(t, 3, 6, 5) + 2 : breath(t, 6, 104 - w * 16, 7));
  if (!ok) { bakedFallback(c, e.r); return; }
  // ---- the blade at the sim's angle: on the tell its edge floods red in four steps, and the last one flickers
  const bi = bladeIndex(ba);
  if (tel) {
    let h = Math.min(NT - 1, tel * NT | 0);
    if (h === NT - 1 && twitch(t, 2, 3, 9)) h = NT - 2;
    bf(c, K, 'tell', h * NT + Math.min(NT - 1, bi));
  } else bf(c, K, 'blade', bi);
  bf(c, K, 'cap');
  // ---- the wet a still frame can't hold. Old blood off the edge, wherever the edge is pointing
  for (let i = 0; i < EDGE.length; i++) {
    const u = EDGE[i][0], v = EDGE[i][1], x = PX + ca * u + sa * v, y = PY + sa * u - ca * v;
    strand(c, s, e, 40 + i, x, y, 4 + i * 2, .9, 'rgba(70,6,10,.9)', 58 + i * 23, '#6a0a10', .5);
  }
  for (let i = 0; i < GUT.length; i++) { const g = GUT[i]; strand(c, s, e, 50 + i, g[0], g[1], g[2], 1, 'rgba(48,8,10,.92)', g[3], '#4a0a10', 1.1); }
  for (let i = 0; i < w * 2 && i < TEAR.length; i++) { const g = TEAR[i]; strand(c, s, e, 60 + i, g[0], g[1], g[2], 1.1, 'rgba(96,6,12,.95)', g[3], '#8a0c14', .6); }
  if (w === 2 && rnd() < .12 * s.dt * GROSS) emit(s, e.x + rn(0, 8), e.y + rn(4, 16), rn(-.3, .3), rn(.1, .6), '#6a0810', rn(.8, 1.3), 0, 80);
  if (e.flash && rnd() < .55 * GROSS) emit(s, e.x + rn(-6, 12), e.y + rn(-16, 18), rn(-1.6, 1.6), rn(-1.8, .2), rnd() < .6 ? '#7a0a12' : '#4a060a', rn(.8, 1.6), 0, 60);
  // the swing: the edge flings what it was carrying along the cut
  if (s.ev === 'tel>cut') { snd('gross_slosh', .4, .3); spray(s, e.x + PX - 30, e.y + PY + 4, 14, '#7a0a12', 2.4, 1.2, .2); }
  if (e.st === 'cut' && e.wt <= 12 && rnd() < .7 * GROSS) {
    const u = rn(18, 46), x = PX + ca * u + sa * 13, y = PY + sa * u - ca * 13;
    emit(s, e.x + x, e.y + y, sa * rn(1, 2.6), -ca * rn(1, 2.6), '#8a0c14', rn(.8, 1.4), 0, 50);
  }
  // spit: embers boil up the throat before each fan, from the sim's point
  if (mo >= 1 && rnd() < .5 * s.dt * GROSS) emit(s, e.x - 4 + rn(-2, 2), e.y - 23, rn(-1.2, -.2), rn(-.8, .4), hash(t) < .5 ? '#ffb040' : '#ff5a1a', 1, 1, rn(14, 26), .04);
  drawParts(c, s, e);
  // ---- light: the tell's edge glows hot along its length; the throat glows when it opens
  if (tel || mo >= 1) {
    c.globalCompositeOperation = 'lighter';
    if (tel) for (let i = 0; i < 3; i++) { const u = 18 + i * 12; glowC(c, PX + ca * u + sa * 13, PY + sa * u - ca * 13, 6 + tel * 8, '255,40,16', .12 + .3 * tel); }
    if (mo >= 1) glowC(c, -4, -23, 5 + mo * 4, '255,110,30', .55);
    c.globalCompositeOperation = 'source-over';
  }
}

/** under the body: its chain, and the sweep cone */
function under(e) {
  drawChain(ctx, e.x, e.y - 20, e.x + 4, Math.max(-8, ceilAt(e.x + $.G.scroll)), 1.4);
  const sx = e.x - 8, sy = e.y - 6;
  if (e.st === 'tel') { // same sweep cone as the Butcher's, shorter
    const k = e.wt / 50;
    ctx.fillStyle = `rgba(255,60,20,${.08 + .22 * k * (($.T >> 2) % 2 ? 1 : .6)})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, 84, 2.3, 3.99);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(255,120,60,${.4 + .5 * k})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(sx, sy, 84, 2.3, 3.99);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (e.st === 'cut' && e.wt <= 12) {
    let cur = e.ba;
    if (cur < 0) cur += TAU;
    ctx.fillStyle = 'rgba(255,220,180,.35)';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, 84, cur, 3.99);
    ctx.closePath();
    ctx.fill();
  }
}

/** the kind's art for the registry (./index.ts): draw, and its atlas for the per-route warm-up (render/warmup.ts) */
export default {
  draw: grossPrentice,
  under,
  warm() { bakedWarm(K); return false; }, // false: nothing left to build
  built: () => bakedBuilt(K),
  drop() { bakedDrop(K); },
};
