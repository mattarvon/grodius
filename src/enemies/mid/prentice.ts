// @ts-nocheck
// THE BUTCHER'S APPRENTICE (fire home): a small carcass on one chain with a cleaver. Art: render/gross/mid/prentice.ts
// Its picker row (name, tag, pool) is in ./roster.ts. Moved verbatim from update.ts's switch (LS2-0).
// Its RANGE denial (D61, ./_deny.ts): every third attack a chain hook thrown the full width of the screen. It mirrors the
// Butcher's hook (enemies/update.ts 'htel'/'hook') in its own code: tracked then locked, out until it strikes, then it
// bites and holds with the chain taut (a wire across the screen), then reels in.
import { $ } from '../../state';
import { FIRE, PH, R, TAU, W, clamp, dist2, lerp, pick, ri, rr } from '../../core';
import { ceilAt, floorAt } from '../../world';
import { sfx } from '../../audio';
import { drop, spark } from '../../fx/spawn';
import { cdm } from '../../depth';
import { aimA, every, fan, ring, wrapA } from '../spawn';
import { playerHit } from '../../player';
import { bandFit, midLeave } from '../update';
import { HOST_SPARK, isCross, midPh2 } from '../midhost';
import { DN, hookHit } from './_deny';
import { defineMid } from './roster';

const cool = (ph2) => Math.round((ph2 ? 50 : 75) * (1 - .3 * ($.G.rank || 0)) * cdm());
/** the hook, one frame of its tell, throw, bite or reel. e.ha: its line, e.hd: how far out the tip is */
function hook(e, ph2, sp) {
  const ox = e.x + DN.hOx, oy = e.y + DN.hOy;
  if (e.st === 'htel') {
    if (e.wt <= DN.hTel - DN.hLock) e.ha += wrapA(aimA(ox, oy) - e.ha) * DN.hTrack; // then locked: the line is honest
    if (e.wt >= DN.hTel) { e.st = 'hook'; e.wt = 0; e.hd = 10; sfx.lash(); }
  } else if (e.st === 'hook') {
    e.hd += DN.hSp;
    const tx = ox + Math.cos(e.ha) * e.hd, ty = oy + Math.sin(e.ha) * e.hd, wx = tx + $.G.scroll;
    if (ty >= floorAt(wx) || ty <= ceilAt(wx) || tx <= 2 || ty <= 2 || ty >= PH - 2 || e.hd >= DN.hMax) { // it bites
      e.st = 'bite'; e.wt = 0; $.G.shake += 3; sfx.chain();
      for (let k = 0; k < 10; k++) spark(tx, ty, rr(-2, 2), rr(-2, 2), ri(6, 12), k % 2 ? '#cfe6ff' : pick(sp));
      for (let k = 0; k < 8; k++) drop(tx, ty, rr(-1.5, 1.5), rr(-1.5, 1), 1.3, R() < .5 ? 0 : 1, 70);
    }
  } else if (e.st === 'bite') {
    if (e.wt >= DN.hBite) { e.st = 'reel'; e.wt = 0; sfx.chain(); }
  } else if (e.st === 'reel') {
    e.hd -= DN.hIn;
    if (e.hd <= 12) { e.hd = 0; e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
  }
  if ($.P.alive && hookHit(e, $.P.x, $.P.y)) playerHit();
}

function updPrentice(e) {
  // THE BUTCHER'S APPRENTICE: a small carcass on one chain with a cleaver. Lunges in behind a red sweep cone (50f to get out), or spits ember fans
  const go = midLeave(e, e.st === 'tel' ? .06 : .03), ph2 = midPh2(e), cx = isCross(e), sp = cx ? HOST_SPARK[e.host] : FIRE; // its embers burn in the host's colours
  e.sw = (e.sw || 0) + (ph2 ? .028 : .018);
  if (e.st === 'tel' && e.wt < 25) e.y = lerp(e.y, clamp($.P.y + 6, 50, PH - 40), .06);
  else if (e.st !== 'tel' && e.st !== 'cut' && !(e.hd > 0) && e.st !== 'htel') e.y = lerp(e.y, PH * .42 + Math.sin(e.sw) * 34, .05); // holds still on the hook's line
  if (cx) bandFit(e);
  const sx = e.x - 8, sy = e.y - 6;
  if (!go && e.t > 120 && $.P.alive) {
    e.wt++;
    if (e.st === 'idle') {
      e.ba = lerp(e.ba, -2.3, .1);
      e.tx = W - 92;
      if (e.wt >= e.cool) {
        e.att++;
        const k = e.att % 3; // lunge, hook, spit (the lunge only when you are in front of it)
        e.st = k === 1 && $.P.x < W - 160 ? 'tel' : k === 2 ? 'htel' : 'spit'; e.wt = 0;
        if (e.st === 'htel') { e.ha = aimA(e.x + DN.hOx, e.y + DN.hOy); e.hd = 0; sfx.tele(); sfx.chain(); }
        else e.st === 'tel' ? sfx.tele() : sfx.chain();
      }
    } else if (e.st === 'tel') {
      e.tx = clamp($.P.x + 64, 130, W - 70);
      e.ba = lerp(e.ba, -2.4, .2);
      if (e.wt >= 50) { e.st = 'cut'; e.wt = 0; sfx.lash(); }
    } else if (e.st === 'cut') {
      const p = Math.min(1, e.wt / 12);
      e.ba = -2.3 - p * (TAU - 4.6);
      if (e.wt === 6) {
        $.G.shake += 3;
        for (let k = 0; k < 24; k++) spark(sx - 50, sy + rr(-30, 30), rr(-3, 0), rr(-2, 2), ri(8, 16), pick(sp));
        fan(sx, sy, aimA(sx, sy), 3, .3, 1.5);
      }
      if ($.P.alive && e.wt <= 12) {
        const d = Math.sqrt(dist2($.P.x, $.P.y, sx, sy));
        let pa = Math.atan2($.P.y - sy, $.P.x - sx), cur = e.ba;
        if (pa < 0) pa += TAU;
        if (cur < 0) cur += TAU;
        if (d > 14 && d < 84 && pa <= 3.99 && pa >= cur) playerHit();
      }
      if (e.wt >= 30) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
    } else if (e.st === 'htel' || e.st === 'hook' || e.st === 'bite' || e.st === 'reel') hook(e, ph2, sp);
    else if (e.st === 'spit') {
      if (e.wt === 24 || e.wt === 38) fan(e.x - 4, e.y - 24, aimA(e.x - 4, e.y - 24), ph2 ? 7 : 5, .19, 1.7);
      if (e.wt >= 50) { e.st = 'idle'; e.wt = 0; e.cool = cool(ph2); }
    }
    if (ph2 && every(e, 120)) ring(e.x, e.y, 10, e.t * .06, 1.05);
  }
  if (go && e.hd > 0) { e.hd = Math.max(0, e.hd - DN.hIn * 2); if (!e.hd) e.st = 'idle'; } // it withdraws: the chain comes home, harmless (midLeave set it idle)
  if (R() < .5) spark(e.x + rr(-12, 12), e.y + rr(-10, 24), rr(-.4, .3), -rr(.4, 1.4), ri(8, 16), pick(sp));
  if (R() < .25) drop(e.x + rr(-10, 10), e.y + rr(0, 20), rr(-.3, .3), rr(.2, .8), 1.3, R() < .5 ? 0 : 1, 90);
}

defineMid('prentice', {
  et: { hp: 150, r: 15, gsz: 4, score: 6000, bio: 70, skull: 1, limbs: 3, eyes: 3, teeth: 6, big: 1, mini: 1, mid: 1 },
  word: 'CLEAVED',
  spawnY: .42,
  update: updPrentice,
});
