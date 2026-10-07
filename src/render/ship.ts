// @ts-nocheck
import { $ } from '../state';
import { TAU, ctx, dist2 } from '../core';
import { lv } from '../save';
import { enemies } from '../world';
import { spark } from '../fx/spawn';
import { gmL } from '../mutations';
import { pk } from '../perks';
import { rigged } from '../contraptions';
import { ANCH, growF, growK, trackForm } from '../shipform';
import { glow, glowSpr, light, poly } from '../render/util';
import { eye } from '../render/eyes';
import {
  boneNeedles, caliberBore, droneWings, eggSacs, flayedEdge, glassJaw, gluttonyMaw, haloRipple, hornBarrels, meathooks, nerveSpine,
  opticStalks, perkTells, pyreStalks, rearMandible, rigChoir, rigFurnace, rigGut, rigHook, rigLeech, rigSaw, rigSpine, sculptParts,
  sporePods, tapeworm, thrustParts, tierBack, tierFront, umbilicals, wardParts, wombSac
} from '../render/shipparts';

// --- player ship & helpers ---
const GIDS = ['rapid', 'pierce', 'seek', 'tail', 'ripple', 'chain', 'serr', 'over', 'cal', 'regrow', 'spore'];
/** perks that leave a visible tell on the hull (teeth / trail are drawn as world fx elsewhere) */
const PIDS = ['dmg', 'rof', 'spd', 'pierce', 'crit', 'volatile', 'scab', 'inv', 'graze', 'reload', 'magnet', 'frost', 'corrode', 'ignite', 'snot', 'tape', 'glass'];
/** everything the ship's shape reads from; also the source of the frame-to-frame form diff */
export function shipLoad() {
  let tier = 0;
  for (const k in $.meta.lv) tier += $.meta.lv[k] || 0;
  const rig = {};
  for (const r of rigged()) rig[r.id] = r.lvl;
  const game = !!($.P && $.P.missile != null && ($.state === 'play' || $.state === 'pause' || $.state === 'over')), P = game ? $.P : {};
  const gm = {}, pkk = {};
  if (game) {
    for (const k of GIDS) if (gmL(k)) gm[k] = gmL(k);
    for (const k of PIDS) if (pk(k)) pkk[k] = pk(k);
  }
  const ld = {
    spd: P.speed || 0,
    mis: P.missile || 0,
    dbl: P.double || 0,
    las: P.laser || 0,
    pyre: P.pyre || 0,
    opt: P.options || 0,
    ward: P.wardLv || 0,
    shd: P.shield > 0,
    aegis: P.aegis || 0,
    tier,
    game: game ? 1 : 0,
    gm,
    pk: pkk,
    rig,
    sculpt: lv('sculpt')
  };
  let pw = ld.spd + ld.mis * 1.5 + (ld.dbl + ld.las) * 2 + ld.pyre * 1.5 + ld.opt * 1.5 + ld.ward * 1.5;
  for (const k in gm) pw += gm[k] * 1.5;
  for (const k in pkk) pw += pkk[k] * .5;
  for (const k in rig) pw += rig[k] * 1.5;
  ld.power = pw;
  ld.ftier = pw >= 24 ? 3 : pw >= 13 ? 2 : pw >= 5 ? 1 : 0;
  return ld;
}
/** flat part-key -> level map (diffed frame to frame for sprout / wither moments) */
export function shipForm(ld) {
  const f = { thr: ld.spd, mis: ld.mis, dbl: ld.dbl, las: ld.las, pyre: ld.pyre, opt: ld.opt, ward: ld.ward, tier: ld.ftier };
  for (const k in ld.gm) f['g:' + k] = ld.gm[k];
  for (const k in ld.pk) f['p:' + k] = ld.pk[k];
  for (const k in ld.rig) f['r:' + k] = ld.rig[k];
  return f;
}
/** draw a part through its sprout animation: scales from 0 with overshoot about its anchor, flashes white-hot */
function part(c, key, fn) {
  const k = growK(key);
  if (k <= .02) return;
  const a = ANCH[key] || [0, 0];
  if (k !== 1) {
    c.save();
    c.translate(a[0], a[1]);
    c.scale(k, k);
    c.translate(-a[0], -a[1]);
    fn();
    c.restore();
  } else fn();
  const f = growF(key);
  if (f > 0) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = f * f * .8;
    const r = key[0] === 'r' ? 11 : key === 'tier' ? 6 : 7;
    c.drawImage(glowSpr('255,170,120'), a[0] - r, a[1] - r, r * 2, r * 2);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}
export const IRIS_T = ['#c0141c', '#e05a10', '#e8b818', '#b23cff'];
export function drawShip(c, x, y, bank, s = 1, eng = 1, ld) {
  ld = ld || shipLoad();
  const tier = ld.tier,
    mini = s < .6,
    ft = mini ? 0 : ld.ftier,
    G = ld.gm,
    PK = ld.pk,
    RG = ld.rig,
    beat = Math.pow(Math.max(0, Math.sin($.T * .16)), 6),
    fire = ld.game && $.P && $.P.cd > 3;
  if (ld.game && !mini && $.P) trackForm(shipForm(ld), x, y, s);
  let look = Math.sin($.T * .021) * .5;
  if (ld.game && !mini) {
    let bd = 1e9;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist2(e.x, e.y, x, y);
      if (d < bd && e.x > x - 20) {
        bd = d;
        look = Math.atan2(e.y - y, e.x - x);
      }
    }
  }
  const irisC = IRIS_T[Math.min(3, Math.max(tier / 5 | 0, ft))];
  c.save();
  c.translate(x, y);
  if (PK.rof && !mini && $.T % 7 < 2) c.translate((Math.random() - .5) * .45 * PK.rof, (Math.random() - .5) * .45 * PK.rof);
  c.scale(s, s * (1 - Math.abs(bank) * .07));
  // ---- contraptions that sit behind the hull
  if (!mini && RG.furnace) part(c, 'r:furnace', () => rigFurnace(c, RG.furnace, mini));
  // ---- the hull itself swells with the build (hitbox does not)
  const hs = 1 + ft * .1;
  c.save();
  c.scale(hs, hs);
  // bile engine + sinew tendrils
  if (eng) {
    const f = .75 + Math.random() * .4,
      L = 1 + ld.spd * .18;
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = 'rgba(255,70,30,.45)';
    c.beginPath();
    c.ellipse(-16 * L, 0, 9 * f * L, 3, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,200,140,.9)';
    c.beginPath();
    c.ellipse(-13.5, 0, 3.8 * f, 1.3, 0, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  if (!mini) {
    const n = 2 + Math.min(ld.spd, 4),
      len = 7 + ld.spd * 2.2;
    c.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      const by = (k / (n - 1) - .5) * 6,
        ph = $.T * .18 + k * 1.7;
      let px = -11,
        py = by;
      for (let j = 1; j <= 4; j++) {
        const nx = -11 - j * len / 4,
          ny = by * (1 + j * .35) + Math.sin(ph - j * .9) * j * .9;
        c.strokeStyle = j < 3 ? '#3a1012' : '#6e2226';
        c.lineWidth = 2.2 - j * .45;
        c.beginPath();
        c.moveTo(px, py);
        c.lineTo(nx, ny);
        c.stroke();
        px = nx;
        py = ny;
      }
    }
    c.lineCap = 'butt';
  }

  if (!mini) {
    part(c, 'tier', () => tierBack(c, ft, beat));
    if (G.ripple) part(c, 'g:ripple', () => haloRipple(c, G.ripple));
    if (G.rapid) part(c, 'g:rapid', () => droneWings(c, G.rapid));
    if (ld.opt) part(c, 'opt', () => umbilicals(c, ld.opt));
    if (PK.tape) part(c, 'p:tape', () => tapeworm(c));
    if (G.tail) part(c, 'g:tail', () => rearMandible(c, G.tail, fire));
    if (G.pierce) part(c, 'g:pierce', () => boneNeedles(c, G.pierce));
    if (G.serr) part(c, 'g:serr', () => flayedEdge(c, G.serr));
    if (G.chain) part(c, 'g:chain', () => meathooks(c, G.chain));
  }
  if (ld.pyre) part(c, 'pyre', () => pyreStalks(c, ld.pyre, look, mini));
  if (ld.spd) part(c, 'thr', () => thrustParts(c, ld.spd, eng, mini));
  // ventral + dorsal bone spikes (grow with permanent grafts)
  const ty = x0 => -5.6 + Math.pow((x0 + 3) / 9, 2) * 2;
  const nsp = 2 + Math.min(7, tier * .42 | 0);
  for (let k = 0; k < nsp; k++) {
    const sx = -9 + k * (14 / Math.max(1, nsp - 1)),
      h = 2.6 + tier * .13 + k % 2 * 1.3 + Math.sin($.T * .05 + k) * .2,
      b = ty(sx) + .6;
    c.fillStyle = '#5e5040';
    poly(c, [[sx - 1.2, b], [sx + 1, b], [sx - 1.8 - h * .45, b - h]]);
    c.fillStyle = '#d8c8a4';
    poly(c, [[sx - 1.2, b], [sx - .1, b], [sx - 1.8 - h * .45, b - h]]);
  }
  if (tier >= 5) for (let k = 0; k < 3; k++) {
    const sx = -7 + k * 5,
      h = 1.8 + tier * .08,
      b = -ty(sx) - .6;
    c.fillStyle = '#b8a888';
    poly(c, [[sx - 1, b], [sx + 1, b], [sx - 1.6 - h * .4, b + h]]);
  }
  if (tier >= 10) {
    c.strokeStyle = '#cbb995';
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    for (const sg of [-1, 1]) {
      c.beginPath();
      c.moveTo(4, sg * 4.4);
      c.quadraticCurveTo(-2, sg * (9 + tier * .15), -9, sg * (8 + tier * .2));
      c.stroke();
    }
    c.lineCap = 'butt';
  }

  if (ld.mis) part(c, 'mis', () => eggSacs(c, ld.mis, !mini && PK.reload));
  // carapace hull
  c.fillStyle = '#0a0404';
  c.beginPath();
  c.moveTo(-12.5, -3.4);
  c.quadraticCurveTo(-6, -8.2, 2, -6.6);
  c.quadraticCurveTo(9.5, -5, 15.6, -.7);
  c.lineTo(15.6, .7);
  c.quadraticCurveTo(9.5, 5.4, 2, 6);
  c.quadraticCurveTo(-6, 7, -12.5, 3.4);
  c.closePath();
  c.fill();
  c.fillStyle = '#5e4236';
  c.beginPath();
  c.moveTo(-12, -3);
  c.quadraticCurveTo(-6, -7.5, 2, -6);
  c.quadraticCurveTo(9, -4.5, 15, -.6);
  c.lineTo(15, .6);
  c.quadraticCurveTo(9, 5, 2, 5.5);
  c.quadraticCurveTo(-6, 6.5, -12, 3);
  c.closePath();
  c.fill();
  c.fillStyle = '#8c6c58';
  c.beginPath();
  c.moveTo(-11, -3);
  c.quadraticCurveTo(-5, -7, 2, -5.6);
  c.quadraticCurveTo(8, -4.3, 13.5, -1.2);
  c.quadraticCurveTo(2, -3, -11, -1);
  c.closePath();
  c.fill();
  // exposed belly meat with pulsing veins
  const mR = 110 + beat * 70 | 0;
  c.fillStyle = `rgb(${mR},${26 + beat * 14 | 0},${30})`;
  c.beginPath();
  c.moveTo(-11, 1.2);
  c.quadraticCurveTo(-2, 7, 11, 2);
  c.lineTo(13, .8);
  c.quadraticCurveTo(0, 2.6, -11, 1.2);
  c.fill();
  c.strokeStyle = `rgba(${200 + beat * 55 | 0},40,50,.8)`;
  c.lineWidth = .45;
  c.beginPath();
  c.moveTo(-9, 2);
  c.quadraticCurveTo(-5, 4.6, -1, 3.3);
  c.quadraticCurveTo(3, 4.4, 8, 2.6);
  c.moveTo(-5, 3.6);
  c.lineTo(-4, 5);
  c.moveTo(2, 3.8);
  c.lineTo(3, 5.1);
  c.stroke();
  // heart glowing through the ribs
  c.globalCompositeOperation = 'lighter';
  c.fillStyle = `rgba(255,40,30,${.35 + beat * .5})`;
  c.beginPath();
  c.ellipse(-3.5, -1.4, 3.4 + beat, 2.4 + beat * .6, 0, 0, TAU);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  // ribs
  c.strokeStyle = '#8c7b66';
  c.lineWidth = .9;
  for (let i = 0; i < 5; i++) {
    const rx = -10 + i * 3.6;
    c.beginPath();
    c.moveTo(rx, ty(rx) + .8);
    c.quadraticCurveTo(rx + 2.2, -3, rx + 1.2, .2);
    c.stroke();
  }
  c.strokeStyle = '#d8c8a4';
  c.lineWidth = .6;
  c.beginPath();
  c.moveTo(-11, -3.8);
  c.quadraticCurveTo(-4, -7, 4, -5.5);
  c.quadraticCurveTo(9, -4.2, 13, -1.6);
  c.stroke();

  if (!mini) {
    part(c, 'tier', () => tierFront(c, ft));
    perkTells(c, PK, beat);
    if (G.regrow) part(c, 'g:regrow', () => wombSac(c, G.regrow));
    if (G.spore) part(c, 'g:spore', () => sporePods(c, G.spore));
    if (ld.ward) part(c, 'ward', () => wardParts(c, ld.ward, ld.shd, ld.aegis));
    if (G.cal) part(c, 'g:cal', () => caliberBore(c, G.cal, fire));
  }
  // mandibles
  const op = fire ? 1.3 : .35 + .25 * Math.sin($.T * .09);
  c.fillStyle = '#d8c8a4';
  poly(c, [[11, -2.6], [19.5, -1.4 - op], [17.5, -.6], [13, -.6]]);
  poly(c, [[11, 2.6], [19, 1.2 + op], [17, .6], [13, .6]]);
  c.fillStyle = '#2a0507';
  c.fillRect(13, -.6, 5, 1.2);
  c.fillStyle = '#f0e6d0';
  for (let k = 0; k < 3; k++) {
    c.fillRect(13.5 + k * 1.6, -.6, .6, .7);
    c.fillRect(14.2 + k * 1.6, 0, .6, .6);
  }

  if (!mini) {
    if (PK.glass) glassJaw(c);
    if (PK.pierce) {
      c.fillStyle = '#f0e6d0';
      poly(c, [[18.5, -1.9], [21 + PK.pierce * 1.5, -2.4], [19, -1.1]]);
      poly(c, [[18, 1.7], [20.5 + PK.pierce * 1.5, 2.2], [18.5, .9]]);
    }
    if (G.over) part(c, 'g:over', () => gluttonyMaw(c, G.over));
    if (ld.sculpt) sculptParts(c, ld.sculpt);
  }
  if (ld.dbl) part(c, 'dbl', () => hornBarrels(c, fire));
  if (ld.las) part(c, 'las', () => nerveSpine(c));
  // clustered extra eyes (one per two permanent grafts)
  const EP = [[-1, -3.8, 1.25], [-6.5, -3, 1.1], [3, -4, 1.05], [-4, 3.6, 1], [-9.5, -1.4, .95], [1.5, 3.8, 1], [-8, 2.4, .9], [5.6, 2.6, .9], [-3, -5.6, .85]];
  const ne = Math.min(EP.length, tier / 2 | 0);
  for (let i = 0; i < ne; i++) {
    const [ex, ey, er] = EP[i],
      bl = ($.T + i * 53) % (160 + i * 17) < 5 ? 1 : 0;
    eye(c, ex, ey, er, {
      ang: look,
      iris: irisC,
      bs: 1.4,
      blink: bl,
      lid: '#4a1818'
    });
  }

  if (!mini && G.seek) part(c, 'g:seek', () => opticStalks(c, G.seek, look));
  // the main eye
  const blM = ($.T + 31) % 220 < 6 ? 1 : 0;
  eye(c, 7, -1.8, 2.9, {
    ang: look,
    iris: irisC,
    bs: 1.2 + tier * .06,
    blink: blM,
    lid: '#3a1414',
    dil: fire ? .7 : 1,
    fire: tier >= 15
  });
  if (!mini) {
    c.globalCompositeOperation = 'lighter';
    const gc = tier >= 15 ? '180,60,255' : '255,60,40';
    c.fillStyle = `rgba(${gc},.18)`;
    c.beginPath();
    c.arc(7, -1.8, 4.4, 0, TAU);
    c.fill();
    c.globalCompositeOperation = 'source-over';
  }
  // blood drip from a fully grafted hull
  if (tier >= 14 && !mini) {
    c.fillStyle = '#8a0610';
    for (let k = 0; k < 3; k++) {
      const dx = -6 + k * 5,
        dd = ($.T * .25 + k * 7) % 9;
      c.fillRect(dx, 4.6 + dd * .4, .8, dd * .6);
      c.beginPath();
      c.arc(dx + .4, 4.8 + dd, .6, 0, TAU);
      c.fill();
    }
  }
  c.restore();
  // ---- contraptions bolted over the hull (unscaled anchors: logic and art line up)
  if (!mini) {
    if (RG.choir) part(c, 'r:choir', () => rigChoir(c, RG.choir));
    if (RG.hook) part(c, 'r:hook', () => rigHook(c, RG.hook, x, y, s));
    if (RG.gut) part(c, 'r:gut', () => rigGut(c, RG.gut));
    if (RG.spine) part(c, 'r:spine', () => rigSpine(c, RG.spine));
    if (RG.leech) part(c, 'r:leech', () => rigLeech(c, RG.leech));
    if (RG.saw) part(c, 'r:saw', () => rigSaw(c, RG.saw, mini));
  }
  c.restore();
}
export function drawBolt(s) {
  const cal = gmL('cal'),
    L = 8 + cal * 2.5,
    th = 3 + cal * .7,
    a = Math.atan2(s.vy, s.vx);
  if (s.rip) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(a);
    ctx.strokeStyle = 'rgba(255,140,170,.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1, s.r * .35), s.r, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,245,.9)';
    ctx.lineWidth = .5;
    ctx.stroke();
    ctx.restore();
    return;
  }
  const col = s.mirror ? '200,215,235' : s.spore ? '255,170,200' : gmL('serr') ? '255,90,90' : s.seek ? '190,130,255' : s.pierce ? '240,226,192' : '120,190,255';
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(a);
  ctx.fillStyle = `rgba(${col},.6)`;
  ctx.fillRect(-L / 2, -th / 2, L, th);
  ctx.fillStyle = '#fff6f0';
  ctx.fillRect(-L / 2 + 1, -.5, L - 2, 1);
  if (s.pierce) {
    ctx.fillStyle = '#f0e2c0';
    poly(ctx, [[L / 2, -th / 2], [L / 2 + 3, 0], [L / 2, th / 2]]);
  }
  ctx.restore();
  if (s.seek && s.t % 2 === 0) spark(s.x - s.vx, s.y - s.vy, 0, 0, 8, '#a080ff');
}
/** WRAITH follower: a burning foetal skull trailing an umbilical of fire */
export function drawWraith(x, y, i) {
  ctx.globalCompositeOperation = 'lighter';
  glow(x, y, 12, '255,110,40', .55);
  glow(x, y, 5, '255,210,150', .8);
  const h = $.P.hist[Math.min((i + 1) * 13 + 5, $.P.hist.length - 1)];
  if (h) {
    ctx.strokeStyle = 'rgba(255,120,50,.45)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.quadraticCurveTo((x + h.x) / 2, (y + h.y) / 2 + Math.sin($.T * .2 + i) * 3, h.x, h.y);
    ctx.stroke();
  }
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = k ? 'rgba(255,170,60,.7)' : 'rgba(255,80,20,.7)';
    const fy = y + (Math.random() - .5) * 3;
    poly(ctx, [[x - 2, fy - 1.6], [x - 7 - Math.random() * 5, fy], [x - 2, fy + 1.6]]);
  }
  ctx.globalCompositeOperation = 'source-over';
  // skull
  ctx.fillStyle = '#e8d8b4';
  ctx.beginPath();
  ctx.ellipse(x, y - .6, 3.4, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - .6, y + 1, 3, 2);
  ctx.fillStyle = '#2b0d05';
  ctx.fillRect(x - .2, y - 1.8, 1.4, 1.6);
  ctx.fillRect(x + 1.8, y - 1.8, 1.2, 1.6);
  ctx.fillRect(x + 1, y + .6, .8, .8);
  ctx.fillStyle = '#ff7a20';
  ctx.fillRect(x + .3, y - 1.2, .5, .5);
  ctx.fillRect(x + 2.2, y - 1.2, .5, .5);
  ctx.fillStyle = '#2b0d05';
  for (let k = 0; k < 3; k++) ctx.fillRect(x - .2 + k, y + 2.4, .4, .6);
  light(x, y, 30, .6);
}
// --- enemies ---
