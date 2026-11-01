// @ts-nocheck
import { $ } from '../state';
import { C, TAU, ctx, hash } from '../core';
import { srnd, srr } from '../srnd';
import { ceilAt } from '../world';
import { whipPts } from '../enemies/update';
import { drawChain, drawHookTip, drawSkull, glow, light, poly } from '../render/util';
import { eye } from '../render/eyes';
import { spr, sprAt, sprN, sprReady } from '../sprites';
import { drawMidCross, grossBrood, grossChoir, grossCyst, grossPrentice } from './gross/midbosses';
import { HOST_TINT, isCross } from '../enemies/midhost';
import { spr as sprF, sprAt as sprAtF, sprReady as sprReadyF } from '../sprites'; // flyers: wasp / eyeball / corpse
import { drawUfoGross } from './gross/ufo';
import { drawEliteAura, drawElitePus } from '../enemies/elite';

// --- enemies ---
export function drawDrone(c, e) {
  // the wasp (Tiamalt, CC-BY 3.0): sick yellow-green, faint wingbeat; rear waves fly right so they're mirrored
  const d = e.pat === 'behind' ? -1 : 1, ph = (e.i || 0) * 7;
  if (sprF(c, 'wasp', sprAtF(e.t + ph, 50), 0, -4.5, { sx: d })) {
    c.save();
    c.scale(d, 1);
    if (e.cap) { // a swollen red egg sac on the abdomen, pulsing
      c.fillStyle = (($.T + ph) >> 3) % 2 ? '#e01a24' : '#a10d14';
      c.fillRect(1, 0, 4, 3);
      c.fillStyle = '#ffb0b0';
      c.fillRect(2, 0, 1, 1);
    }
    // a bloodshot red eye with a wet glint
    c.fillStyle = '#9a1016';
    c.fillRect(-5, -6, 2, 2);
    c.fillStyle = 'rgba(255,220,200,.9)';
    c.fillRect(-5, -6, 1, 1);
    // venom / pus beading at the sting, stretching and letting go
    const q = (e.t + ph * 3) % 46, L = q < 34 ? q / 34 * 3 : 0;
    c.fillStyle = '#b8c840';
    c.fillRect(5.5, 8, 1, 1 + L);
    if (q >= 34 && q < 42) c.fillRect(5.5, 10 + (q - 34) * .9, 1, 1);
    c.restore();
    return;
  }
  const t = e.t * .2;
  c.lineWidth = 1;
  c.strokeStyle = C.fleshD;
  for (let k = -1; k <= 1; k++) {
    c.beginPath();
    c.moveTo(5, k * 2);
    c.quadraticCurveTo(10, k * 3 + Math.sin(t + k) * 2, 15, k * 4 + Math.sin(t * 1.3 + k) * 3);
    c.stroke();
  }
  c.fillStyle = '#2a0b0a';
  c.beginPath();
  c.ellipse(.5, .5, 8.2, 6.2, 0, 0, TAU);
  c.fill();
  c.fillStyle = e.cap ? '#c4313a' : C.flesh;
  c.beginPath();
  c.ellipse(-.3, -.3, 7.3, 5.3, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.fleshL;
  c.beginPath();
  c.ellipse(-2, -2.6, 3, 1.3, -.3, 0, TAU);
  c.fill();
  c.fillStyle = '#4a5560';
  c.fillRect(1, -6, 2, 12);
  c.fillStyle = '#a5b3c0';
  c.fillRect(1, -4, 1, 1);
  c.fillRect(1, 0, 1, 1);
  c.fillRect(1, 3, 1, 1);
  c.strokeStyle = '#2a0d0c';
  c.beginPath();
  for (let k = 0; k < 3; k++) {
    c.moveTo(-5 + k * 2, 3);
    c.lineTo(-4 + k * 2, 4.6);
  }
  c.moveTo(-6, 3.8);
  c.lineTo(-1, 3.8);
  c.stroke();
  const a = Math.atan2($.P.y - e.y, $.P.x - e.x);
  eye(c, -4, -.5, 2.9, {
    ang: a,
    iris: '#8a0f12',
    bs: 1.2,
    blink: (e.t + e.x | 0) % 170 < 6 ? 1 : 0
  });
}
export function drawCorpse(c, e) {
  const tw = e.twitch > 0 ? Math.sin(e.twitch * 2) * 2 : 0;
  // frozen crew from the Zombie Character Pack (Soluna Software, CC0): 4 variants (civilian woman, civilian man,
  // zombie cop, zombie male) x 2 frames (still, twitch), picked from the spawn-time ph so it never changes mid-flight.
  // Only real corpses: hooks and the drive's baked-in bodies keep the code-drawn crewman below.
  if (e.k === 'corpse' && sprReadyF('corpse')) {
    const v = Math.min(3, Math.floor((e.ph || 0) / TAU * 4)), f = v * 2 + (tw ? 1 : 0);
    c.save();
    if (e.noLeg) { // the leg's gone: clip it off below the hip on the right and leave a frozen stump
      c.beginPath();
      c.rect(-14, -16, 28, 32);
      c.rect(1, 5, 12, 11);
      c.clip('evenodd');
    }
    sprF(c, 'corpse', f, tw * .4, 0);
    c.restore();
    if (e.noLeg) {
      c.fillStyle = C.bloodD;
      c.fillRect(.5, 4, 3, 2);
      c.fillStyle = C.blood;
      c.fillRect(1, 4.5, 2, 1.5);
      c.fillStyle = C.bone;
      c.fillRect(1.5, 5.5, 1, 1.5);
    }
    if (e.noArm) { // torn shoulder, frozen meat
      c.fillStyle = C.blood;
      c.fillRect(2.5, -6, 2, 2);
      c.fillStyle = '#5a050a';
      c.fillRect(3, -5, 1, 1);
    }
    if (e.cap) {
      c.fillStyle = ($.T >> 3) % 2 ? '#e01a24' : '#a10d14';
      c.fillRect(-1.5, -1, 3, 2);
      c.fillStyle = '#ffb0b0';
      c.fillRect(-1, -1, 1, 1);
    }
    // a frozen string of blood from the mouth, and frost catching the light on the skull
    c.fillStyle = '#7a0b10';
    c.fillRect(-.5, -7.5, 1, 2 + ((e.t + v * 17) % 90 < 45 ? 1 : 0));
    c.fillStyle = 'rgba(210,235,255,.8)';
    c.fillRect(-2, -12, 1, 1);
    return;
  }
  c.lineCap = 'round';
  c.lineWidth = 3;
  c.strokeStyle = '#2c3743';
  c.beginPath();
  c.moveTo(-1.5, 5);
  c.lineTo(-3, 12 + tw);
  c.stroke();
  if (!e.noLeg) {
    c.beginPath();
    c.moveTo(1.5, 5);
    c.lineTo(3.5, 12.5 - tw);
    c.stroke();
  } else {
    c.fillStyle = C.blood;
    c.beginPath();
    c.arc(2, 6.5, 1.8, 0, TAU);
    c.fill();
    c.fillStyle = C.bone;
    c.fillRect(1.5, 7, 1, 2);
  }
  c.strokeStyle = '#33404e';
  c.beginPath();
  c.moveTo(-3.5, -3.5);
  c.lineTo(-8, 1 + tw);
  c.stroke();
  if (!e.noArm) {
    c.beginPath();
    c.moveTo(3.5, -3.5);
    c.lineTo(8.5, -6 - tw);
    c.stroke();
    c.fillStyle = C.skin;
    c.fillRect(8, -7.5 - tw, 2, 2);
  } else {
    c.fillStyle = C.blood;
    c.beginPath();
    c.arc(4.4, -3.5, 1.6, 0, TAU);
    c.fill();
  }
  c.fillStyle = C.skin;
  c.fillRect(-9, 0 + tw, 2, 2);
  c.lineCap = 'butt';
  c.fillStyle = C.suit;
  c.fillRect(-4, -5, 8, 11);
  c.fillStyle = '#2a333e';
  c.fillRect(-4, 1, 8, 1);
  c.fillStyle = '#55657a';
  c.fillRect(-4, -5, 8, 1);
  c.fillStyle = '#d0a43a';
  c.fillRect(-3, -3.5, 2, 1);
  c.fillStyle = C.blood;
  c.fillRect(-1, -2, 4, 4);
  c.fillStyle = C.fleshD;
  c.fillRect(0, -1, 2, 2);
  c.fillStyle = C.bone;
  c.fillRect(-.5, -1.6, 3.5, .6);
  c.fillRect(-.5, .2, 3.5, .6);
  c.fillStyle = e.cap ? '#e01a24' : '#5a050a';
  if (e.cap) {
    c.fillRect(-3, 2.5, 3, 2);
    c.fillStyle = '#ffb0b0';
    c.fillRect(-2.5, 3, 1, 1);
  }
  c.fillStyle = C.skin;
  c.beginPath();
  c.arc(0, -8.5, 3.6, 0, TAU);
  c.fill();
  c.fillStyle = '#a8998b';
  c.beginPath();
  c.arc(.8, -7.8, 2.8, 0, Math.PI);
  c.fill();
  c.fillStyle = '#120606';
  c.fillRect(-2.3, -9.6, 1.6, 1.6);
  c.fillRect(.7, -9.6, 1.6, 1.6);
  c.beginPath();
  c.ellipse(0, -6.6, 1, 1.6 + Math.abs(tw) * .3, 0, 0, TAU);
  c.fill();
  c.fillStyle = C.blood;
  c.fillRect(-2, -8, 1, 2.6);
  c.fillRect(1.2, -8, 1, 1.8);
}
// wall eye turret: the tentacle creature (eye variant) rooted in the rock. A flattened copy is the root mat splayed
// over the surface, the upright body is half-buried (clipped at the surface), and the realistic eye on top keeps the
// aim / blink / charge tells. Ceiling ones are mirrored by the scale flip. Render-only: no gameplay RNG.
export function drawEyeT(c, e) {
  if (!sprReady('walleye')) {
    // fallback until the strip loads: the old code-drawn art
    if (e.o < 0) c.scale(1, -1);
    c.fillStyle = '#1a2027';
    poly(c, [[-13, 6], [-9, -2], [9, -2], [13, 6]]);
    c.fillStyle = '#5d6b7a';
    c.fillRect(-9, -2, 18, 1);
    c.fillStyle = '#8e9cab';
    c.fillRect(-7, 1, 1, 1);
    c.fillRect(6, 1, 1, 1);
    c.fillStyle = C.fleshD;
    c.beginPath();
    c.ellipse(0, -3, 10, 4, 0, 0, TAU);
    c.fill();
    c.fillStyle = C.flesh;
    c.beginPath();
    c.ellipse(0, -3.6, 8.5, 2.6, 0, Math.PI, TAU);
    c.fill();
    const ey = e.y - e.o * 9;
    eye(c, 0, -9, 6.9, {
      ang: Math.atan2($.P.y - ey, $.P.x - e.x),
      iris: '#8a9a22',
      bs: 1.6,
      dil: e.cool < 20 ? 1.5 : .85,
      blink: e.blink > 0 ? 1 : 0,
      lid: '#7a2a24'
    });
    return;
  }
  const o = e.o < 0 ? -1 : 1;
  if (o < 0) c.scale(1, -1);
  const t = e.t || 0,
    f = sprAt(t + (e.x * 7 | 0), 7),
    chg = e.cool < 20 ? 1 - Math.max(0, e.cool) / 20 : 0,
    br = Math.sin(t * .07) * .04 + chg * .08;
  // root mat: the creature's tentacles spread flat over the rock, veins running off into it
  spr(c, 'walleye', f + 3, 0, .5, { sx: 1.35, sy: .32, a: .95 });
  c.strokeStyle = 'rgba(110,8,16,.85)';
  c.lineWidth = .8;
  c.beginPath();
  for (const [a, l] of e.veins || []) {
    const dx = Math.cos(a) * (l * 2.2 + 6);
    c.moveTo(dx * .45, 0);
    c.quadraticCurveTo(dx * .8, 1.6 + Math.sin(a * 3) * 1.2, dx, .8 + Math.abs(Math.sin(a)) * 2);
  }
  c.stroke();
  // upright body, sunk into the rock below y = 1.5
  c.save();
  c.beginPath();
  c.rect(-22, -34, 44, 35.5);
  c.clip();
  spr(c, 'walleye', f, 0, -8, { sx: 1 + br, sy: 1 - br * .6 });
  // wet, swollen lip of rock-flesh where it grows out
  c.fillStyle = '#3a0c10';
  c.beginPath();
  c.ellipse(0, 1.2, 11, 2.4, 0, Math.PI, TAU);
  c.fill();
  c.fillStyle = 'rgba(190,70,70,.55)';
  c.fillRect(-8, -1, 3, 1);
  c.fillRect(4, -1, 4, 1);
  c.restore();
  // charge tell: the socket flushes and throbs before it fires
  if (chg > 0) {
    c.fillStyle = `rgba(255,40,40,${.25 + .45 * chg * (.6 + .4 * Math.sin(t * 1.3))})`;
    c.beginPath();
    c.arc(0, -8.5, 5.6 + chg * 1.2, 0, TAU);
    c.fill();
  }
  // pus: beads that ooze out of the socket and slide down to the rock (floor) or drip off the tip (ceiling)
  const pu = (t * .025 + e.x * .013) % 1;
  c.fillStyle = 'rgba(214,196,92,.9)';
  if (o > 0) {
    c.fillRect(3.5, -6 + pu * 6, 1, 1.4);
    c.fillRect(-5, -4 + ((pu + .5) % 1) * 4, 1, 1);
  } else {
    c.fillRect(1, -19 - pu * 6, 1, 1 + pu * 1.5);
    c.fillStyle = 'rgba(214,196,92,.5)';
    c.fillRect(1, -19, .6, -pu * 5);
  }
  const ey = e.y - e.o * 9;
  eye(c, 0, -8.5, 4.6 + chg * .6, {
    ang: Math.atan2($.P.y - ey, $.P.x - e.x),
    iris: chg > .5 ? '#c8a020' : '#8a9a22',
    bs: 1.8,
    dil: e.cool < 20 ? 1.6 : .8,
    blink: e.blink > 0 ? 1 : 0,
    lid: '#4a1018'
  });
}
// wall crawler: the earwig, turned on its side to scuttle along the wall head-first (left), walk frames tied to the
// ground it covers. Wet carapace glint, dripping mandibles that gape before it spits.
export function drawCrawler(c, e) {
  if (!sprReady('earwig')) {
    // fallback until the strip loads: the old code-drawn art
    if (e.o < 0) c.scale(1, -1);
    const t = e.t * .35;
    c.strokeStyle = C.bone;
    c.lineWidth = 1.3;
    c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      const bx = -5 + k * 5,
        ph = t + k * 2.1;
      const fx = bx + Math.sin(ph) * 3,
        fy = 7 - Math.max(0, Math.cos(ph)) * 2.5;
      c.beginPath();
      c.moveTo(bx, 0);
      c.lineTo(bx + (k - 1) * 2, -7);
      c.lineTo(fx, fy);
      c.stroke();
      const ph2 = ph + Math.PI;
      c.beginPath();
      c.moveTo(bx, 1);
      c.lineTo(bx + (k - 1) * 2 + 1, -5);
      c.lineTo(bx + Math.sin(ph2) * 3, 7 - Math.max(0, Math.cos(ph2)) * 2.5);
      c.stroke();
    }
    c.lineCap = 'butt';
    c.fillStyle = '#3e1410';
    c.beginPath();
    c.ellipse(1, 0, 10, 5.5, 0, 0, TAU);
    c.fill();
    c.fillStyle = e.cap ? '#c4313a' : '#8c3b32';
    c.beginPath();
    c.ellipse(1, -.6, 9, 4.4, 0, 0, TAU);
    c.fill();
    c.strokeStyle = C.bone;
    c.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.arc(-3 + k * 3.5, 0, 4, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
    }
    c.fillStyle = C.skin;
    c.beginPath();
    c.arc(-10, -1, 4.2, 0, TAU);
    c.fill();
    c.fillStyle = '#120606';
    c.fillRect(-12.5, -3, 1.6, 1.8);
    c.fillRect(-9.8, -3, 1.6, 1.8);
    const j = e.air ? 2.5 : Math.abs(Math.sin(e.t * .12)) * 1.5;
    c.fillRect(-12, 0, 4, 1 + j);
    c.fillStyle = C.bone;
    for (let k = 0; k < 3; k++) {
      c.fillRect(-11.8 + k * 1.3, 0, .8, .8);
      c.fillRect(-11.8 + k * 1.3, .4 + j, .8, .8);
    }
    c.fillStyle = C.blood;
    c.fillRect(-11, 1.5 + j, 1, 2);
    return;
  }
  if (e.o < 0) c.scale(1, -1);
  const t = e.t || 0,
    n = sprN('earwig'),
    f = e.air ? t * 1.6 : t * (e.spd || .6) * n / 14,
    bob = e.air ? 0 : Math.abs(Math.sin(f * TAU / n * 2)) * .5;
  const flt = c.filter;
  if (e.cap && flt === 'none') c.filter = 'saturate(1.7) hue-rotate(-12deg) brightness(1.15)';
  // body centre sits ~2 px over the surface (y = 7): the lower legs dig into the rock, the upper ones paw the air
  c.translate(0, 1.7 - bob);
  spr(c, 'earwig', f, 0, 0, { sy: .72 });
  c.filter = flt;
  // glistening carapace: a slick highlight that slides along the back, plus fixed wet specks
  const g = (t * .05 + e.x * .02) % 1;
  c.fillStyle = 'rgba(255,225,200,.8)';
  c.fillRect(-9 + g * 13, -2.2, 2, .7);
  c.fillStyle = 'rgba(255,200,180,.5)';
  c.fillRect(-5, -1.6, 1, .6);
  c.fillRect(1.5, -1.9, 1, .6);
  // mandibles: gape before a spit and while airborne
  const gp = e.air ? 1 : e.cool < 14 ? 1 - Math.max(0, e.cool) / 14 : Math.abs(Math.sin(t * .12)) * .25;
  c.strokeStyle = '#e3d2b0';
  c.lineWidth = .9;
  c.beginPath();
  c.moveTo(-12, -.9);
  c.lineTo(-15, -1.1 - gp * 1.8);
  c.moveTo(-12, .9);
  c.lineTo(-15, 1.1 + gp * 1.8);
  c.stroke();
  if (gp > .3) {
    c.fillStyle = '#5a0408';
    c.fillRect(-15, -gp, 2.6, gp * 2);
  }
  // drool: a slime string with a bead stretching off the jaw, and a blood drip
  const dl = (t * .04 + e.x * .03) % 1;
  c.fillStyle = 'rgba(205,215,170,.75)';
  c.fillRect(-14.2, 1.4, .7, 1 + dl * 4.5);
  c.fillStyle = 'rgba(225,235,190,.95)';
  c.fillRect(-14.5, 2.1 + dl * 4.5, 1.3, 1.3);
  c.fillStyle = C.bloodL;
  c.fillRect(-12.4, 1.4, .8, 1 + ((dl + .4) % 1) * 2.5);
}
export function drawHatch(c, e) {
  // the floating eyeball (OwlishMedia, CC0): the strip looks left with the nerve trailing right; fromLeft mirrors it
  const d = e.fromLeft ? -1 : 1, ph = e.ph || 0;
  if (sprF(c, 'eyeball', sprAtF(e.t + ph * 9, 9), -d, 0, { sx: d, ax: 5.5 / 17 })) {
    c.save();
    c.scale(d, 1);
    c.fillStyle = 'rgba(255,245,225,.9)'; // wet glint on the cornea
    c.fillRect(-3, -2.5, 1, 1);
    // blood beading off the torn nerve end
    const q = (e.t + ph * 20) % 30;
    c.fillStyle = '#8a0f12';
    c.fillRect(9 + q * .25, .5 + Math.sin(e.t * .3 + ph), 1, 1);
    c.restore();
    return;
  }
  const w = Math.sin(e.t * .4 + (e.ph || 0));
  c.strokeStyle = '#c98e86';
  c.lineWidth = 2;
  c.beginPath();
  const dir = e.fromLeft ? -1 : 1;
  c.moveTo(dir * 2, 0);
  c.quadraticCurveTo(dir * 6, w * 3, dir * 10, -w * 2);
  c.stroke();
  c.strokeStyle = '#8a1f22';
  c.lineWidth = .8;
  c.beginPath();
  c.moveTo(dir * 1, 1);
  c.quadraticCurveTo(dir * 8, 3 + w * 2, dir * 14, w * 3);
  c.stroke();
  c.fillStyle = '#d8a59a';
  c.beginPath();
  c.arc(-dir, 0, 4.2, 0, TAU);
  c.fill();
  c.fillStyle = '#efc7bb';
  c.beginPath();
  c.arc(-dir * 1.5, -1.4, 2, 0, TAU);
  c.fill();
  c.fillStyle = '#0c0405';
  c.beginPath();
  c.arc(-dir * 3, -1, 1.3, 0, TAU);
  c.arc(-dir * .6, -1.6, 1.1, 0, TAU);
  c.fill();
  c.fillStyle = '#7a0b10';
  c.fillRect(-dir * 3 - 1, 1.3, 2.4, 1);
}
// ceiling womb: the tentacle creature again (teeth variant, same grade as the eye turret), its root mat gripping the
// rock, slung on a raw umbilical, its toothed slit turned upright. It throbs harder as the next birth comes due, the
// slit splits open on a hatchling's face, then gapes and gushes after it drops. Render-only: no gameplay RNG.
export function drawWomb(c, e) {
  if (!sprReady('womb')) {
    // fallback until the strip loads: the old code-drawn art
    const s = 1 + Math.sin(e.t * .09) * .05;
    c.strokeStyle = '#5a1a1a';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, -11);
    c.quadraticCurveTo(Math.sin(e.t * .03) * 3, -e.st * .6, 0, -e.st - 4);
    c.stroke();
    c.strokeStyle = '#8c3b32';
    c.lineWidth = 1;
    c.stroke();
    c.save();
    c.scale(s, s);
    c.fillStyle = 'rgba(120,30,30,.9)';
    c.beginPath();
    c.ellipse(0, 0, 11.5, 14, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(205,110,95,.55)';
    c.beginPath();
    c.ellipse(0, 0, 10, 12.6, 0, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(60,8,10,.85)';
    const k = Math.sin(e.t * .05);
    c.beginPath();
    c.arc(-2 + k, -4, 4, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(1, 3, 4.5, 6, .5 + k * .2, 0, TAU);
    c.fill();
    c.fillStyle = 'rgba(255,40,30,.6)';
    c.fillRect(-3.4 + k, -5, 1, 1);
    c.strokeStyle = 'rgba(70,5,10,.8)';
    c.lineWidth = .7;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      c.moveTo(Math.cos(a) * 10, Math.sin(a) * 12);
      c.quadraticCurveTo(Math.cos(a + .4) * 6, Math.sin(a + .4) * 7, Math.cos(a + .7) * 3, Math.sin(a + .7) * 4);
    }
    c.stroke();
    c.fillStyle = 'rgba(255,230,210,.5)';
    c.beginPath();
    c.ellipse(-4, -6, 2.4, 1.2, -.6, 0, TAU);
    c.fill();
    c.restore();
    return;
  }
  const t = e.t || 0,
    cy = Math.min(-8, ceilAt(e.x + $.G.scroll) - e.y),
    cap = Math.max(70, 120 - ($.G.loop || 0) * 15),
    since = cap - e.cool,
    pre = e.cool < 26 ? Math.min(1, (26 - e.cool) / 26) : 0,
    post = since >= 0 && since < 18 ? 1 - since / 18 : 0,
    op = Math.max(pre, post),
    f = sprAt(t + (e.x * 5 | 0), 6),
    s = 1 + Math.sin(t * (.09 + op * .3)) * (.04 + op * .05) + op * .05,
    sw = Math.sin(t * .03) * 3;
  // grip: the tentacles splayed flat over the ceiling
  spr(c, 'womb', f + 4, sw * .3, cy - .5, { sx: 1.3, sy: -.3 });
  // umbilical: raw cord from the grip down into the sac
  c.lineCap = 'round';
  c.strokeStyle = '#3a0a0e';
  c.lineWidth = 4.5;
  c.beginPath();
  c.moveTo(sw * .3, cy);
  c.quadraticCurveTo(sw, cy * .5, 0, -8);
  c.stroke();
  c.strokeStyle = '#7a2228';
  c.lineWidth = 2.2;
  c.stroke();
  c.strokeStyle = 'rgba(230,150,140,.5)';
  c.lineWidth = .7;
  c.beginPath();
  c.moveTo(sw * .3 - .8, cy + 1);
  c.quadraticCurveTo(sw - .8, cy * .5, -.8, -9);
  c.stroke();
  c.lineCap = 'butt';
  // the sac: toothed slit stood upright (the sheet's slit runs at 45 degrees)
  c.save();
  c.scale(s, s * (1 + op * .04));
  spr(c, 'womb', f, 0, 0, { rot: -Math.PI / 4 });
  // the slit: a dark lens that splits wider as it births
  const w = 1.5 + op * 3,
    h = 6.5 + op * 1.5;
  c.fillStyle = '#5a1418';
  c.beginPath();
  c.ellipse(0, 1, w + 1.2, h + .8, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#140204';
  c.beginPath();
  c.ellipse(0, 1, w, h, 0, 0, TAU);
  c.fill();
  // something pale pushing through: a hatchling's face in the slit before it drops
  if (pre > .45) {
    const k = (pre - .45) / .55;
    c.fillStyle = '#d8a59a';
    c.beginPath();
    c.ellipse(0, 2.5 + k * 1.5, w * .75, 2.6 + k, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#0c0405';
    c.fillRect(-1.6, 2 + k * 1.5, 1, 1);
    c.fillRect(.6, 2 + k * 1.5, 1, 1);
  }
  // teeth on both lips, pointing in
  c.fillStyle = C.bone;
  for (let i = 0; i < 3; i++) {
    const ty = -3.2 + i * 3.6,
      tw = (i === 1 ? 1.6 : 1.1) + op * .6;
    poly(c, [[-w - .6, ty - 1.1], [-w + tw, ty + .2], [-w - .6, ty + 1.2]]);
    poly(c, [[w + .6, ty + .6], [w - tw, ty + 1.8], [w + .6, ty + 2.9]]);
  }
  // mucus strings across the gap after a birth
  if (post > 0) {
    c.strokeStyle = `rgba(220,210,170,${.7 * post})`;
    c.lineWidth = .5;
    c.beginPath();
    c.moveTo(-w, -2);
    c.quadraticCurveTo(0, 1 + post * 2, w, -1);
    c.moveTo(-w, 3);
    c.quadraticCurveTo(0, 5 + post, w, 4);
    c.stroke();
  }
  // wet sheen on the bulge
  c.fillStyle = 'rgba(255,220,210,.45)';
  c.beginPath();
  c.ellipse(-5, -6, 2, .9, -.6, 0, TAU);
  c.fill();
  c.restore();
  // amniotic drool off the bottom of the slit; a gush right after a birth
  const dl = (t * .035 + e.x * .02) % 1,
    gush = post * 9;
  c.fillStyle = 'rgba(190,40,45,.85)';
  c.fillRect(-.5, 7.5 * s, 1, 1.5 + dl * 4 + gush);
  c.fillStyle = 'rgba(225,215,170,.75)';
  c.fillRect(.6, 7 * s, .7, 1 + ((dl + .5) % 1) * 5 + gush * .6);
  c.fillStyle = 'rgba(160,20,28,.9)';
  c.fillRect(-.9, 9 * s + dl * 4 + gush, 1.6, 1.6);
}
import { GROSS as GROSS_MAW, drawGrossMaw } from './gross/maw'; // THE MAW / DISSOLVED / MUCUS, gross edition
export function drawMaw(c, e) {
  if (GROSS_MAW > 0) return drawGrossMaw(c, e); // GROSS = 0 in gross/maw.ts falls through to the original below
  const t = e.t;
  c.strokeStyle = '#2a2f36';
  c.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    c.moveTo(14, 6 + k * 5);
    c.quadraticCurveTo(26, 14 + k * 4 + Math.sin(t * .05 + k) * 4, 36, 6 + k * 9);
    c.stroke();
  }
  c.strokeStyle = '#59626d';
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = '#3a0f0c';
  c.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * TAU,
      r = 26 + Math.sin(a * 3 + t * .05) * 1.5 + hash(i) * 3;
    i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  const g = c.createRadialGradient(-6, -8, 2, 0, 0, 26);
  g.addColorStop(0, '#cf7a64');
  g.addColorStop(.6, '#8e3a2f');
  g.addColorStop(1, '#4b1410');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 23.5, 0, TAU);
  c.fill();
  c.fillStyle = '#2a3038';
  c.fillRect(2, -25, 14, 7);
  c.fillRect(4, 18, 12, 7);
  c.fillStyle = '#6e7b88';
  c.fillRect(2, -25, 14, 1);
  c.fillRect(4, 18, 12, 1);
  c.fillStyle = '#a5b3c0';
  for (const [x, y] of [[4, -22], [13, -22], [6, 21], [13, 21]]) c.fillRect(x, y, 1, 1);
  c.strokeStyle = '#2a0807';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(6, -17);
  c.quadraticCurveTo(14, -2, 8, 16);
  c.stroke();
  c.strokeStyle = '#9aa8b6';
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const y = -14 + k * 5.4,
      x = 6 + Math.sin(k) * 2.5 + 4;
    c.moveTo(x - 2, y);
    c.lineTo(x + 2, y);
  }
  c.stroke();
  for (const ep of e.eyesP) {
    const x = Math.cos(ep.a + Math.PI) * ep.r * .9 + 4,
      y = Math.sin(ep.a) * ep.r;
    eye(c, x, y, ep.s, {
      ang: Math.atan2($.P.y - e.y - y, $.P.x - e.x - x),
      iris: '#b01018',
      bs: 1.5,
      blink: ep.b > 0 ? 1 : 0,
      lid: '#6e2b26'
    });
  }
  const j = e.jaw * 13 + 2;
  c.fillStyle = '#160203';
  c.beginPath();
  c.ellipse(-14, 0, 6 + e.jaw * 2, j, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#7a1418';
  c.beginPath();
  c.ellipse(-13, j * .4, 4, j * .5, 0, 0, Math.PI);
  c.fill();
  c.fillStyle = C.bone;
  for (let k = -4; k <= 4; k++) {
    const y = k * (j / 4.6);
    c.beginPath();
    c.moveTo(-20, y);
    c.lineTo(-16, y + 1.2);
    c.lineTo(-20, y + 2.2);
    c.fill();
    c.beginPath();
    c.moveTo(-8, y);
    c.lineTo(-12, y + 1.2);
    c.lineTo(-8, y + 2.2);
    c.fill();
  }
  if (e.jaw > .3) {
    c.fillStyle = '#e0242c';
    c.fillRect(-15, -j * .8, 1, j * 1.6);
  }
}
export function drawCross(c, e) {
  // a carcass on a meat-locker gambrel: a side post with a bar across the top, hung by the feet, arms dangling.
  // (it used to be an inverted cross; reworked so nothing reads as a religious symbol.) local: body centre at 0,0,
  // post from -22 to +22 (the end touching the terrain), gambrel bar at the top.
  const yB = 22,
    yT = -22,
    fl = e.o > 0;
  c.fillStyle = '#0b0d10';
  c.fillRect(-12.5, yT, 5, 44);
  c.fillRect(-12.5, yT, 20, 4.5);
  c.fillStyle = '#1f262e';
  c.fillRect(-11.8, yT, 3.6, 44);
  c.fillRect(-11.8, yT + .7, 18.6, 3);
  c.fillStyle = '#56616d';
  c.fillRect(-11.8, yT, 1, 44);
  c.fillRect(-11.8, yT + .7, 18.6, 1);
  c.fillStyle = '#4e0307';
  for (let k = 0; k < 5; k++) c.fillRect(-11 + k % 2, yT + 6 + k * 8, 1, 4 + hash(k + e.x * .01) * 4);
  // body: upside down, ankles hooked to the bar, arms hanging past the head
  c.lineCap = 'round';
  c.lineWidth = 2.6;
  c.strokeStyle = C.suit;
  const tw = e.flash ? 1 : Math.sin(e.t * .3) * (srnd() < .02 ? 2 : 0);
  c.beginPath();
  c.moveTo(-1.4, -5);
  c.lineTo(-1.6, -19 + tw);
  c.stroke();
  if (!e.noLeg) {
    c.beginPath();
    c.moveTo(1.4, -5);
    c.lineTo(1.6, -19);
    c.stroke();
  } else {
    c.fillStyle = C.blood;
    c.beginPath();
    c.arc(1.6, -6.5, 1.7, 0, TAU);
    c.fill();
    c.fillStyle = C.bone;
    c.fillRect(1.1, -9.5, 1, 3);
  }
  c.strokeStyle = C.skin;
  c.lineWidth = 2;
  const sw = Math.sin(e.t * .05) * .8; // dead weight sways a little
  c.beginPath();
  c.moveTo(-3, 7);
  c.lineTo(-5.5 + sw, 17);
  c.moveTo(3, 7);
  c.lineTo(5.5 + sw, 17);
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = C.suit;
  c.fillRect(-3.5, -6, 7, 14);
  c.fillStyle = '#55657a';
  c.fillRect(-3.5, 7, 7, 1);
  // opened torso, ribs splayed
  c.fillStyle = C.bloodD;
  c.fillRect(-2.2, -4, 4.4, 9);
  c.fillStyle = C.blood;
  c.fillRect(-1.6, -3, 3.2, 7);
  c.fillStyle = C.fleshD;
  c.fillRect(-.8, -1, 1.6, 3);
  c.fillStyle = C.bone;
  for (let k = 0; k < 3; k++) {
    c.fillRect(-3.2, -2.6 + k * 2.2, 1.6, .6);
    c.fillRect(1.6, -2.6 + k * 2.2, 1.6, .6);
  }
  // meat hooks through the ankles, up into the bar
  c.strokeStyle = '#c9d3dc';
  c.lineWidth = .9;
  c.beginPath();
  c.moveTo(-1.5, yT + 4.5);
  c.lineTo(-1.6, -20 + tw);
  c.moveTo(1.5, yT + 4.5);
  c.lineTo(1.6, -20);
  c.stroke();
  // blood off the fingertips
  c.fillStyle = C.blood;
  c.fillRect(-6 + sw, 18, 1, 2.5 + e.t * .03 % 4);
  c.fillRect(5 + sw, 18, 1, 3 + e.t * .025 % 4);
  // head hanging below the bar
  c.fillStyle = C.skin;
  c.beginPath();
  c.arc(0, 13.6, 3.4, 0, TAU);
  c.fill();
  c.fillStyle = '#120606';
  c.fillRect(-2.1, 14.2, 1.5, 1.5);
  c.fillRect(.6, 14.2, 1.5, 1.5);
  c.beginPath();
  c.ellipse(0, 11.6, 1, 1.4, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#ff2a1a';
  c.fillRect(-1.6, 14.6, .8, .8);
  c.fillRect(1.1, 14.6, .8, .8);
  c.fillStyle = C.blood;
  c.fillRect(-.6, 15.8, 1.2, 2 + e.t * .04 % 5);
  if (fl) {
    drawSkull(c, -7, yB - 3.4, 3, 0);
    drawSkull(c, 6, yB - 2.8, 2.6, 0);
    c.fillStyle = C.bone;
    c.fillRect(-2, yB - 1.4, 7, 1.2);
  } else {
    drawChain(c, -12, yT - 8, -12, 6.5, 1.1);
    drawChain(c, 12, yT - 8, 12, 6.5, 1.1);
  }
  if (e.cap) {
    c.fillStyle = '#e01a24';
    c.fillRect(-1, 1, 2, 2);
  }
}
export function drawHook(c, e) {
  drawCorpse(c, e);
  c.fillStyle = C.blood;
  c.fillRect(-2.6, 11.5, 1.6, 2);
  if (!e.noLeg) c.fillRect(2.8, 11.8, 1.6, 2);
  if (e.cut) {
    c.fillStyle = C.bloodD;
    c.fillRect(-1, -6, 2, 10);
    c.fillStyle = C.blood;
    c.fillRect(-.6, -5, 1.2, 8);
  }
}
export function drawFlayer(c, e) {
  const t = e.t;
  c.strokeStyle = C.bone;
  c.lineWidth = 1.6;
  c.beginPath();
  c.moveTo(4, 6);
  for (let i = 1; i < 7; i++) c.lineTo(4 + i * 2.2 + Math.sin(t * .1 + i) * 1.6, 6 + i * 2.4);
  c.stroke();
  c.fillStyle = C.bone;
  for (let i = 1; i < 7; i++) c.fillRect(3.4 + i * 2.2 + Math.sin(t * .1 + i) * 1.6, 5.4 + i * 2.4, 1.6, 1.2);
  // hooks in the back with chains pulling skin flaps
  for (const s of [-1, 1]) {
    const hx = 5 + s * 2,
      hy = -6 + s * 2;
    c.fillStyle = '#d29d8f';
    poly(c, [[2, hy + 1], [hx + 5, hy - 3 + s], [hx + 5, hy - 1 + s], [3, hy + 3]]);
    drawHookTip(c, hx + 5, hy - 2 + s, -.8, .7);
    drawChain(c, hx + 6, hy - 3 + s, hx + 14, hy - 14 + s * 3, 1);
  }
  c.fillStyle = '#3a0f0c';
  c.beginPath();
  c.ellipse(1, 0, 7, 8.5, .25, 0, TAU);
  c.fill();
  c.fillStyle = e.cap ? '#c4313a' : '#9a4335';
  c.beginPath();
  c.ellipse(.5, -.3, 6, 7.6, .25, 0, TAU);
  c.fill();
  c.strokeStyle = '#5e1a1a';
  c.lineWidth = .7;
  c.beginPath();
  for (let k = 0; k < 5; k++) {
    c.moveTo(-4 + k * 2, -6);
    c.quadraticCurveTo(-3 + k * 2, 0, -4.5 + k * 2.2, 6);
  }
  c.stroke();
  c.strokeStyle = C.bone;
  c.lineWidth = .9;
  for (let k = 0; k < 4; k++) {
    c.beginPath();
    c.arc(1, -3 + k * 2.6, 4.2, Math.PI * 1.15, Math.PI * 1.8);
    c.stroke();
  }
  drawChain(c, -6, -6, 6, 5, 1);
  drawChain(c, -5, 4, 5, -7, 1);
  const sh = e.ws === 'tel' ? Math.min(1, e.wt / 10) : 0;
  c.strokeStyle = C.flesh;
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-3, -3);
  c.lineTo(-7 + sh * 4, 1 - sh * 3);
  c.stroke();
  c.lineCap = 'butt';
  c.fillStyle = C.skin;
  c.fillRect(-8.4 + sh * 4, 0 - sh * 3, 2.4, 2.4);
  const jaw = e.ws === 'strike' ? 2.5 : Math.abs(Math.sin(t * .07)) * 1.2;
  drawSkull(c, -2.5, -11 - jaw * .2, 4.4, 1);
  c.fillStyle = C.bone;
  c.fillRect(-5, -7.2 + jaw, 5, 1.4);
  c.fillStyle = C.blood;
  c.fillRect(-4.4, -7.8 + jaw * .5, 1, jaw + 1.4);
}
export function drawWhip(e) {
  const pts = whipPts(e);
  ctx.lineJoin = 'round';
  for (const [w, col] of [[2.6, '#1a0e0b'], [1.3, '#7a5a48']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.fillStyle = C.bone;
  for (let i = 2; i < pts.length; i += 2) {
    const a = pts[i - 1],
      b = pts[i],
      an = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
    poly(ctx, [[b.x, b.y], [b.x + Math.cos(an) * 2.4 - Math.cos(an - Math.PI / 2) * 1.2, b.y + Math.sin(an) * 2.4 - Math.sin(an - Math.PI / 2) * 1.2], [a.x, a.y]]);
  }
  const tip = pts[pts.length - 1],
    pr = pts[pts.length - 2];
  drawHookTip(ctx, tip.x, tip.y, Math.atan2(tip.y - pr.y, tip.x - pr.x) - Math.PI / 2, 1);
  if (e.ws === 'tel') {
    const k = e.wt / 34;
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.lineDashOffset = -$.T;
    ctx.strokeStyle = `rgba(255,40,40,${.25 + k * .6})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(e.x - 7, e.y + 1);
    ctx.lineTo(e.x - 7 + Math.cos(e.ang) * 122, e.y + 1 + Math.sin(e.ang) * 122);
    ctx.stroke();
    ctx.restore();
  }
  if (e.ws === 'tel' && ($.T >> 2) % 2) {
    ctx.globalCompositeOperation = 'lighter';
    glow(tip.x, tip.y, 8, '255,40,40', .8);
    ctx.globalCompositeOperation = 'source-over';
  }
}
export const DRAW = {
  nailbar: drawNailbar,
  crux: drawCrux,
  butcher: drawButcher,
  cross: drawCross,
  hook: drawHook,
  flayer: drawFlayer,
  drone: drawDrone,
  corpse: drawCorpse,
  eye: drawEyeT,
  crawler: drawCrawler,
  hatch: drawHatch,
  womb: drawWomb,
  maw: drawMaw,
  ufo: drawUfoGross, // THE SQUIDFUCKED SAUCER, the Open Orbit midboss: src/render/gross/ufo.ts
  choir: drawChoir,
  cyst: drawCyst,
  prentice: drawPrentice,
  brood: drawBrood
};
export function drawEnemy(e) {
  if (e.k === 'hook') {
    const fx = e.x - 12 * Math.sin(e.rot),
      fy = e.y + 12 * Math.cos(e.rot);
    drawChain(ctx, e.ax, e.ay, fx, fy - 2);
    drawHookTip(ctx, fx, fy - 3, -e.rot + Math.PI, 1.1);
  }
  if (e.k === 'flayer') drawWhip(e);
  if (e.k === 'choir' && e.st === 'tel') { // the fan it's about to throw, as frost lines
    let n = 7; // 5 while a nailbar lives (a loop, not .some(): no per-frame closure)
    for (const b of e.bars) if (!b.dead) { n = 5; break; }
    const k = e.wt / 40;
    ctx.save();
    ctx.setLineDash([2, 4]);
    ctx.lineDashOffset = -$.T;
    ctx.strokeStyle = `rgba(170,220,255,${.15 + .45 * k})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = e.ha + (i - (n - 1) / 2) * .16; ctx.moveTo(e.x - 10, e.y); ctx.lineTo(e.x - 10 + Math.cos(a) * 150, e.y + Math.sin(a) * 150); }
    ctx.stroke();
    ctx.restore();
  }
  if (e.k === 'nailbar' && e.sing > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(e.x, e.y, 10 + (36 - e.sing) * .4, '170,220,255', .2 + .6 * (1 - e.sing / 36) * (($.T >> 2) % 2 ? 1 : .6));
    ctx.globalCompositeOperation = 'source-over';
  }
  if (e.k === 'prentice') {
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
  if (e.k === 'butcher') {
    const cy = Math.max(-8, ceilAt(e.x + $.G.scroll));
    drawChain(ctx, e.x - 14, e.y - 30, e.x - 14 - (e.cut ? 0 : 6), cy, 1.6);
    if (!e.cut) drawChain(ctx, e.x + 14, e.y - 30, e.x + 20, cy, 1.6);else {
      drawChain(ctx, e.x + 14, e.y - 30, e.x + 30, e.y - 12 + Math.sin($.T * .1) * 4, 1.4);
    }
    const sx = e.x - 10,
      sy = e.y - 10;
    if (e.st === 'ctel') {
      const k = e.wt / 48;
      ctx.fillStyle = `rgba(255,30,30,${.08 + .22 * k * (($.T >> 2) % 2 ? 1 : .6)})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 100, 2.3, 3.99);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(255,60,60,${.4 + .5 * k})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, 100, 2.3, 3.99);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (e.st === 'cut' && e.wt <= 12) {
      let cur = e.ba;
      if (cur < 0) cur += TAU;
      ctx.fillStyle = 'rgba(255,230,220,.35)';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, 100, cur, 3.99);
      ctx.closePath();
      ctx.fill();
    }
    if (e.st === 'htel') {
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.lineDashOffset = -$.T;
      ctx.strokeStyle = `rgba(255,40,40,${.3 + .6 * e.wt / 40})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.x + 10, e.y - 8);
      ctx.lineTo(e.x + 10 + Math.cos(e.ha) * 230, e.y - 8 + Math.sin(e.ha) * 230);
      ctx.stroke();
      ctx.restore();
    }
    if (e.hk) {
      const tx = e.x + 10 + Math.cos(e.ha) * e.hk.d,
        ty = e.y - 8 + Math.sin(e.ha) * e.hk.d;
      drawChain(ctx, e.x + 10, e.y - 8, tx, ty, 1.4);
      drawHookTip(ctx, tx, ty, e.ha - Math.PI / 2, 1.4);
    }
  }
  if (e.burn > 0) {
    ctx.globalCompositeOperation = 'lighter';
    glow(e.x, e.y, e.r + 10, '255,110,30', .3 + .2 * srnd());
    ctx.globalCompositeOperation = 'source-over';
    light(e.x, e.y, 30, .8);
  }
  if (e.elite) drawEliteAura(e); // elites: sick violet aura (enemies/elite.ts)
  const ga = ctx.globalAlpha;
  if (e.ghost > 0) ctx.globalAlpha = ga * (.35 + .25 * Math.sin($.T * .5));
  ctx.save();
  ctx.translate(e.x + (e.flash ? srr(-1, 1) : 0), e.y);
  if (e.k === 'corpse' || e.k === 'hook') ctx.rotate(e.rot);
  if (e.flash) ctx.filter = 'brightness(2.6) saturate(.4)';
  if (e.host && isCross(e)) { const T = HOST_TINT[e.host]; drawMidCross(ctx, e, DRAW[e.k], T.rgb, T.a); } // a crossover midboss takes its host biome's tint
  else DRAW[e.k](ctx, e);
  if (e.elite) drawElitePus(ctx, e); // ...and its pustules, under the hit-flash filter
  ctx.restore();
  ctx.globalAlpha = ga;
  if (e.cap && e.k !== 'corpse') {
    ctx.globalCompositeOperation = 'lighter';
    glow(e.x, e.y, e.r + 6, '255,30,40', .18 + .1 * Math.sin($.T * .2));
    ctx.globalCompositeOperation = 'source-over';
  }
  if (e.k === 'flayer') light(e.x - 2, e.y - 11, 22, .6);else if (e.k === 'cross') light(e.x, e.y + 14, 22, .5);else if (e.k === 'eye') light(e.x, e.y - e.o * 9, 24, .7);else if (e.k === 'womb') light(e.x, e.y, 30, .6);else if (e.k === 'maw') light(e.x, e.y, 60, .7);else if (e.k === 'crux') {
    light(e.x, e.y, 80, .9);
  } else if (e.k === 'butcher') {
    light(e.x, e.y - 10, 80, .9);
  } else if (e.mid) light(e.x, e.y, 60, .8);
  if (e.big && !e.mini && e.hp < e.max) {
    ctx.fillStyle = '#2a0507';
    ctx.fillRect(e.x - 20, e.y - 34, 40, 2);
    ctx.fillStyle = C.bloodL;
    ctx.fillRect(e.x - 20, e.y - 34, 40 * e.hp / e.max, 2);
  }
}
export function drawNailbar(c, e) {
  c.fillStyle = '#14171b';
  c.fillRect(-3.5, -15, 7, 30);
  c.fillStyle = '#3e454e';
  c.fillRect(-2.5, -14, 5, 28);
  c.fillStyle = '#7d8996';
  c.fillRect(-2.5, -14, 1, 28);
  c.fillStyle = '#b8c4d0';
  for (let k = 0; k < 5; k++) {
    const y = -12 + k * 6;
    poly(c, [[-2.5, y - 1.6], [-9, y], [-2.5, y + 1.6]]);
  }
  c.fillStyle = C.blood;
  c.fillRect(-1, -6, 2, 9);
  c.fillRect(-8, -.4, 4, .8);
  c.fillStyle = '#a5b3c0';
  c.fillRect(1, -13, 1, 1);
  c.fillRect(1, 12, 1, 1);
}
import { drawButcherGross, drawCruxGross } from './gross/biomebosses';
export function drawCrux(c, e) {
  drawCruxGross(c, e); // THE BLOATED BITCH (ice biome boss, kind 'crux'): src/render/gross/biomebosses.ts
}
export function drawButcher(c, e) {
  drawButcherGross(c, e); // THE BURNING BUTCHER: src/render/gross/biomebosses.ts
}
// --- biome midbosses ---
const blob = (c, n, r0, f) => { c.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * TAU, r = f(a, i % n) * r0; i ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); };
export function drawChoir(c, e) {
  grossChoir(c, e); // src/render/gross/midbosses.ts
}
export function drawCyst(c, e) {
  grossCyst(c, e); // src/render/gross/midbosses.ts
}
export function drawPrentice(c, e) {
  grossPrentice(c, e); // src/render/gross/midbosses.ts
}
export function drawBrood(c, e) {
  grossBrood(c, e); // src/render/gross/midbosses.ts
}
// --- boss ---

// ---------------- new enemies: snot slime, hulking mutant, MERIDIAN security drone ----------------
// Sprite strips from tools/prep_newenemies.py; each has a code-drawn fallback until its strip loads. Render-only:
// no gameplay RNG here (deterministic wobble from e.t / e.ph / $.T).
const SNOT = 'rgba(190,240,110,', SNOTD = 'rgba(70,110,20,';
export function drawSlime(c, e) {
  if (e.o < 0) c.scale(1, -1); // ceiling slimes hang upside down: local +y is always "into the surface"
  const t = e.t + (e.ph || 0) * 20, ooze = !e.air && e.st !== 'tel' && e.st !== 'spit';
  // the wet slick it drags behind it, hugging the surface
  c.fillStyle = SNOTD + '.55)';
  c.beginPath();
  c.ellipse(5, 6.2, 11 + Math.sin(t * .1), 1.4, 0, 0, TAU);
  c.fill();
  let k = 'slime-idle', f = sprAt(t, 8), ay = 1, y = 8, sq = 1 + Math.sin(t * .14) * .07;
  if (e.air) { k = 'slime-move'; f = e.vy * -e.o > 0 ? 3 : 5; ay = .5; y = 0; sq = 1; }
  else if (e.st === 'tel') { k = 'slime-spit'; f = Math.min(5, e.wt * 6 / 32 | 0); sq = 1 + Math.sin(e.wt * .9) * .08 * e.wt / 32; }
  else if (e.st === 'spit') { k = 'slime-spit'; f = 6 + Math.min(3, e.wt / 6 | 0); }
  if (!spr(c, k, f, 0, y, { ay, sx: sq, sy: 2 - sq })) {
    // fallback: a mucus mound with two clot eyes
    const h = e.st === 'tel' ? 8 + e.wt * .15 : 6;
    c.fillStyle = '#5a5c16';
    c.beginPath(); c.ellipse(0, 6, 11 * sq, h + 1, 0, Math.PI, TAU); c.fill();
    c.fillStyle = '#a3a832';
    c.beginPath(); c.ellipse(0, 6, 10 * sq, h, 0, Math.PI, TAU); c.fill();
    c.fillStyle = '#28120a';
    c.fillRect(-3, 6 - h * .55, 1.5, 1.5); c.fillRect(1, 6 - h * .55, 1.5, 1.5);
  }
  if (ooze) {
    // wet gleam on the dome, and a bubble rising through the snot
    c.fillStyle = 'rgba(255,255,235,.85)';
    c.fillRect(-6, -3, 2, 1); c.fillRect(-4, -5, 2, 1); c.fillRect(3, -2, 1, 1);
    const b = (t * .06) % 1;
    c.fillStyle = SNOT + (.7 * (1 - b)) + ')';
    c.fillRect(1 + Math.sin(t * .2), 3 - b * 9, 1, 1);
  }
  // a ceiling slime sags a mucus strand with a drop swelling on the end; a floor slime drools a string off its lip
  const L = e.o < 0 ? (t * .22) % 16 : 2 + (t * .08) % 5, sx = e.o < 0 ? -1 + Math.sin(t * .05) * 2 : -8;
  c.strokeStyle = SNOT + '.75)';
  c.lineWidth = 1;
  const sy = e.o < 0 ? -6 : 0, dy = e.o < 0 ? -L : L * .9;
  c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.sin(t * .07), sy + dy); c.stroke();
  c.fillStyle = SNOT + '.9)';
  c.beginPath(); c.arc(sx + Math.sin(t * .07), sy + dy, .8 + L * .06, 0, TAU); c.fill();
  if (e.st === 'tel' && !e.dead) { // the swelling throat glows sick yellow
    c.globalCompositeOperation = 'lighter';
    glow(-1, -4, 6 + e.wt * .2, '220,230,90', .15 + .35 * e.wt / 32 * ((($.T >> 2) & 1) ? 1 : .6));
    c.globalCompositeOperation = 'source-over';
  }
}
export function drawMutant(c, e) {
  let k = 'mutant-walk', f = sprAt(e.t, 9);
  if (e.dead) { k = 'mutant-die'; f = Math.min(7, ($.T - (e.dT || $.T)) / 6 | 0); } // the torn halves stagger as they fly
  else if (e.st === 'tel') { k = 'mutant-hurl'; f = Math.min(4, e.wt * 5 / 44 | 0); }
  else if (e.st === 'hurl') { k = 'mutant-hurl'; f = 5 + Math.min(4, e.wt / 6 | 0); }
  if (!spr(c, k, f, 0, 18, { ax: .64, ay: .98 })) {
    // fallback: a hunched slab of meat on two legs
    const s = Math.sin(e.t * .12) * 2;
    c.fillStyle = '#3a1614';
    c.fillRect(-5 + s, 4, 4, 14); c.fillRect(2 - s, 4, 4, 14);
    c.fillStyle = '#8e4a3e';
    c.beginPath(); c.ellipse(0, -6, 11, 13, -.3, 0, TAU); c.fill();
    c.fillStyle = '#b5604f';
    c.beginPath(); c.arc(-7, -16, 5, 0, TAU); c.fill();
    c.fillStyle = '#e8e0cc';
    c.fillRect(-11, -14, 4, 1);
    c.fillStyle = '#8e4a3e';
    c.fillRect(-14, -8 + (e.st === 'tel' ? -8 : 0), 6, 3);
  }
  if (e.dead) return;
  // blood running down its front, a dribble from the jaw
  const d = (e.t * .4) % 10;
  c.fillStyle = 'rgba(150,12,18,.85)';
  c.fillRect(-9, -13 + d, 1, 2);
  if (e.st === 'tel' || e.st === 'hurl') { // eyes and the tearing hand flare red
    const p = e.st === 'tel' ? e.wt / 44 : 1 - e.wt / 34;
    c.globalCompositeOperation = 'lighter';
    glow(-8, -18, 4 + 3 * p, '255,40,30', .5 + .4 * p * ((($.T >> 2) & 1) ? 1 : .5));
    glow(-12, -24 + (e.st === 'tel' ? -4 * p : 6), 6 + 6 * p, '255,60,40', .25 + .4 * p);
    c.globalCompositeOperation = 'source-over';
    light(e.x - 8, e.y - 18, 26, .6);
  }
}
export function drawSentry(c, e) {
  const aim = e.st === 'tel' || e.st === 'fire';
  if (e.st === 'tel') { // the aim line: a dashed track while it hunts you, solid and blinking once it locks (18f to get out)
    const lock = e.wt >= 34, k = Math.min(1, e.wt / 34), ca = Math.cos(e.ha), sa = Math.sin(e.ha);
    c.save();
    if (!lock) { c.setLineDash([3, 3]); c.lineDashOffset = -$.T * .5; }
    c.strokeStyle = `rgba(255,40,30,${lock ? (($.T >> 1) & 1 ? .85 : .45) : .15 + .35 * k})`;
    c.lineWidth = lock ? 1.2 : 1;
    c.beginPath(); c.moveTo(ca * 8, sa * 8); c.lineTo(ca * 200, sa * 200); c.stroke();
    c.restore();
  }
  const f = aim ? 0 : sprAt(e.t, 10), rot = aim ? e.ha - Math.PI : Math.sin(e.t * .05) * .15;
  if (!spr(c, 'sentry', f, 0, 0, { rot })) {
    c.save(); c.rotate(rot);
    c.fillStyle = '#2a3038'; c.beginPath(); c.ellipse(1, 0, 9, 8, 0, 0, TAU); c.fill();
    c.fillStyle = '#56616d'; c.beginPath(); c.ellipse(0, -1, 8, 6.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#3a434d'; c.fillRect(5, -9, 3, 18);
    c.fillStyle = '#a10d14'; c.beginPath(); c.arc(-3, 0, 3, 0, TAU); c.fill();
    c.restore();
  }
  // the red eye: a faint ember on patrol, a hot glare while it aims and fires
  const ex = aim ? Math.cos(e.ha) * 4 : -4, ey = aim ? Math.sin(e.ha) * 4 : 0, p = e.st === 'tel' ? e.wt / 52 : e.st === 'fire' ? 1 : .15;
  c.globalCompositeOperation = 'lighter';
  glow(ex, ey, 4 + 6 * p, '255,40,30', .35 + .55 * p);
  c.globalCompositeOperation = 'source-over';
  if (p > .2) light(e.x + ex, e.y + ey, 20 + 14 * p, .4 + .4 * p);
}
Object.assign(DRAW, { slime: drawSlime, mutant: drawMutant, sentry: drawSentry });
