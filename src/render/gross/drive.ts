// @ts-nocheck
// THE GRAVITY DRIVE, grown into a diseased organ. Everything here is presentation only: it reads the boss
// object (hp, phase, plates, laser, dying) and never writes gameplay state or calls the gameplay RNG.
//  - a cyst-covered heart mass pumping black bile through pipes that became arteries
//  - crew faces stretched over the plating, mouths still moving; skin sloughing off; maggots in the wounds
//  - sphincter vents that fart gas, exhaust ports that vomit, pus pressure gauges for armour plates
//  - an infected eyeball (cataract, weeping tear duct, stitched lids) drawn on the hi-res eye layer
//  - prolapsed intestines with sucker-mouths for tentacles
//  - rots and leaks harder as it loses HP; dies in an enormous rupture (bile rain + carcass + lens drips)
import { $ } from '../../state';
import { PH, TAU, W, ctx } from '../../core';
import { SET } from '../../save';
import { sample } from '../../audio';
import { EYEQ } from '../eyes';
import { glow, light } from '../util';
import { drawCorpse } from '../enemies';
import { tentPts } from '../../boss/update';

/** dial-back knob: 0 = the redesigned drive with no extra gore (no particles/flies/farts/vomit), 1 = everything */
export const GROSS = 1;
const GK = Math.max(0, GROSS);

// ---------------- render-only RNG (never the gameplay R) ----------------
let rs = 0x1badf00d;
const rnd = () => {
  rs ^= rs << 13;
  rs ^= rs >>> 17;
  rs ^= rs << 5;
  return (rs >>> 0) / 4294967296;
};
const rf = (a, b) => a + rnd() * (b - a);
const seed = (n) => (rs = n >>> 0 || 1);

const SC = 2; // pre-render scale (drawn back down with smoothing)
const MX = 30, RX = 100, RY = 112; // heart mass: ellipse centre (boss-local), radii
function can(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SC);
  c.height = Math.ceil(h * SC);
  const x = c.getContext('2d');
  x.scale(SC, SC);
  return [c, x];
}
const h2 = (x, y) => {
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function vn(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const fbm = (x, y) => vn(x, y) * .5 + vn(x * 2.1, y * 2.1) * .3 + vn(x * 4.3, y * 4.3) * .2;
function walk(x, cx, cy, n, w0, col, steps, step = 2.2) {
  // branching vein from (cx,cy)
  let a = rnd() * TAU, px = cx, py = cy, w = w0;
  x.strokeStyle = col;
  x.lineCap = 'round';
  for (let i = 0; i < steps; i++) {
    a += rf(-.6, .6);
    const nx = px + Math.cos(a) * step, ny = py + Math.sin(a) * step;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(nx, ny);
    x.stroke();
    px = nx;
    py = ny;
    w = Math.max(.35, w * .93);
    if (n > 0 && rnd() < .12) walk(x, px, py, n - 1, w * .8, col, steps * .5 | 0, step);
  }
}

// ---------------- pre-rendered layers ----------------
let ART = null;
function inMass(lx, ly, pad = 0) {
  const dx = (lx - MX) / (RX - pad), dy = ly / (RY - pad);
  return dx * dx + dy * dy < 1;
}
function buildMass() {
  // covers boss-local x -80..140, y -125..125; drawn centred on (MX,0) as -110..110
  const [c, x] = can(220, 250);
  x.translate(110, 125); // origin = mass centre
  seed(911);
  const blob = () => {
    x.beginPath();
    x.ellipse(0, 0, RX - 6, RY - 6, 0, 0, TAU);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU + rf(-.1, .1), rr2 = rf(9, 20);
      x.moveTo(Math.cos(a) * (RX - 8) + rr2, Math.sin(a) * (RY - 8));
      x.arc(Math.cos(a) * (RX - 8), Math.sin(a) * (RY - 8), rr2, 0, TAU);
    }
  };
  blob();
  const g = x.createRadialGradient(10, -14, 8, 0, 0, 125);
  g.addColorStop(0, '#8a3040');
  g.addColorStop(.45, '#5c1a2c');
  g.addColorStop(.8, '#30081a');
  g.addColorStop(1, '#14030a');
  x.fillStyle = g;
  x.fill();
  // mottling: necrotic green, bruise purple, jaundice
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
  for (let py = 0; py < c.height; py++) for (let px = 0; px < c.width; px++) {
    const i = (py * c.width + px) * 4;
    if (d[i + 3] < 8) continue;
    const u = px / 26, v = py / 26, n1 = fbm(u, v), n2 = fbm(u * .7 + 40, v * .7 + 9), n3 = fbm(u * 1.3 + 77, v * 1.3 + 3);
    let r = d[i], gg = d[i + 1], b = d[i + 2];
    const k = .75 + n1 * .5;
    r *= k; gg *= k; b *= k;
    if (n2 > .6) { const t = Math.min(1, (n2 - .6) * 3.5); r += (78 - r) * t; gg += (86 - gg) * t; b += (38 - b) * t; }
    if (n3 > .64) { const t = Math.min(1, (n3 - .64) * 4); r += (70 - r) * t; gg += (26 - gg) * t; b += (80 - b) * t; }
    if (n1 > .7) { const t = Math.min(1, (n1 - .7) * 4) * .7; r += (190 - r) * t; gg += (160 - gg) * t; b += (70 - b) * t; }
    const sp = h2(px, py);
    if (sp > .985) { r *= .5; gg *= .5; b *= .5; }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;
  }
  x.putImageData(im, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  // metal plating the flesh grew over: grey panels, rivets, rust, ragged skin pulled across their edges
  for (const [px, py, w, h, a] of [[-40, -80, 30, 20, -.3], [50, -60, 34, 22, .2], [64, 30, 30, 26, -.15], [-20, 80, 34, 18, .25], [20, -20, 26, 40, .05]]) {
    x.save();
    x.translate(px, py);
    x.rotate(a);
    const mg = x.createLinearGradient(0, -h / 2, 0, h / 2);
    mg.addColorStop(0, '#4a525a');
    mg.addColorStop(1, '#22272c');
    x.fillStyle = mg;
    x.fillRect(-w / 2, -h / 2, w, h);
    x.fillStyle = 'rgba(20,10,8,.5)';
    x.fillRect(-w / 2, h / 2 - 1.5, w, 1.5);
    x.fillStyle = '#9aa8b6';
    for (let k = -w / 2 + 3; k < w / 2; k += 6) { x.fillRect(k, -h / 2 + 2, 1, 1); x.fillRect(k, h / 2 - 3, 1, 1); }
    x.strokeStyle = 'rgba(150,70,20,.55)';
    x.lineWidth = 1.2;
    for (let k = 0; k < 4; k++) { const sx = rf(-w / 2, w / 2); x.beginPath(); x.moveTo(sx, -h / 2 + 2); x.lineTo(sx + rf(-2, 2), -h / 2 + rf(6, h)); x.stroke(); }
    // skin stretched over it: pale ragged sheet with tension lines
    x.fillStyle = '#8a6a62';
    x.beginPath();
    x.moveTo(-w / 2 - 3, -h / 2 - 3);
    const ex = rf(.2, .7);
    for (let k = 0; k <= 10; k++) x.lineTo(-w / 2 - 3 + (w + 6) * k / 10, -h / 2 + h * ex + rf(-4, 4) + Math.sin(k) * 3);
    x.lineTo(w / 2 + 3, -h / 2 - 3);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(90,40,40,.6)';
    x.lineWidth = .5;
    for (let k = 0; k < 7; k++) { const sx = rf(-w / 2, w / 2); x.beginPath(); x.moveTo(sx, -h / 2 - 2); x.lineTo(sx + rf(-3, 3), -h / 2 + h * ex - 1); x.stroke(); }
    x.strokeStyle = '#6a1a1c';
    x.lineWidth = 1;
    x.beginPath();
    for (let k = 0; k <= 10; k++) { const yy = -h / 2 + h * ex + Math.sin(k) * 3; k ? x.lineTo(-w / 2 - 3 + (w + 6) * k / 10, yy) : x.moveTo(-w / 2 - 3, yy); }
    x.stroke();
    x.restore();
  }
  // veins
  for (let i = 0; i < 26; i++) walk(x, rf(-90, 90), rf(-100, 100), 2, rf(1, 2.4), i % 3 ? '#250618' : '#3c2a5a', 22, 2.4);
  // fat and yellowed tissue
  for (let i = 0; i < 16; i++) {
    const fx = rf(-90, 90), fy = rf(-100, 100);
    x.fillStyle = 'rgba(227,196,143,.55)';
    x.beginPath();
    x.ellipse(fx, fy, rf(2, 5), rf(1.5, 4), rf(0, 3), 0, TAU);
    x.fill();
  }
  // gloss
  const hl = x.createRadialGradient(-20, -50, 5, -20, -50, 70);
  hl.addColorStop(0, 'rgba(255,190,190,.18)');
  hl.addColorStop(1, 'rgba(255,190,190,0)');
  x.fillStyle = hl;
  x.fillRect(-110, -125, 220, 250);
  x.globalCompositeOperation = 'source-over';
  // rotting overlay (drawn with alpha = rot): green-black necrosis and slime trails
  const [nc, nx] = can(220, 250);
  nx.translate(110, 125);
  nx.drawImage(c, -110, -125, 220, 250); // same pixels as the mass (invisible when overlaid) + patches painted atop
  nx.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 30; i++) {
    const fx = rf(-100, 100), fy = rf(-110, 110), r = rf(6, 22);
    const ng = nx.createRadialGradient(fx, fy, 0, fx, fy, r);
    ng.addColorStop(0, 'rgba(18,24,8,.9)');
    ng.addColorStop(.6, 'rgba(50,62,20,.6)');
    ng.addColorStop(1, 'rgba(50,62,20,0)');
    nx.fillStyle = ng;
    nx.fillRect(fx - r, fy - r, r * 2, r * 2);
  }
  nx.strokeStyle = 'rgba(150,170,60,.45)';
  nx.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) { const sx = rf(-90, 90), sy = rf(-100, 60); nx.beginPath(); nx.moveTo(sx, sy); nx.quadraticCurveTo(sx + rf(-4, 4), sy + 14, sx + rf(-3, 3), sy + rf(20, 40)); nx.stroke(); }
  return { mass: c, necro: nc };
}
function buildRingA() {
  // outer ring (rotates with b.ra): vertebrae fused into the drive's rim, rib-bone spikes, crew impaled on 3 of them
  const R = 94, [c, x] = can(R * 2, R * 2);
  x.translate(R, R);
  seed(4242);
  // flesh webbing between spike bases
  x.fillStyle = 'rgba(70,12,22,.9)';
  for (let k = 0; k < 8; k++) {
    const a0 = k * TAU / 8, a1 = (k + 1) * TAU / 8;
    x.beginPath();
    x.arc(0, 0, 63, a0, a1);
    const am = (a0 + a1) / 2;
    x.quadraticCurveTo(Math.cos(am) * 66, Math.sin(am) * 66, Math.cos(a0) * 63, Math.sin(a0) * 63);
    x.fill();
  }
  x.lineWidth = 11;
  x.strokeStyle = '#2a0812';
  x.beginPath();
  x.arc(0, 0, 58, 0, TAU);
  x.stroke();
  // vertebrae
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * TAU;
    x.save();
    x.rotate(a);
    x.fillStyle = '#9c8860';
    x.beginPath();
    x.ellipse(58, 0, 3.8, 4.6, 0, 0, TAU);
    x.fill();
    x.fillStyle = '#6a5838';
    x.beginPath();
    x.ellipse(59.4, 1.2, 2.6, 3.2, 0, 0, TAU);
    x.fill();
    x.fillStyle = '#3a0a10';
    x.fillRect(57, -.6, 3, 1.2);
    x.fillStyle = '#c8b890';
    x.fillRect(55.8, -2.6, 1, 1);
    // gristle and rot between the vertebrae
    x.fillStyle = k % 3 ? '#5a1420' : '#4a5a22';
    x.beginPath();
    x.ellipse(58, 4.6, 3.2, 1.6, 0, 0, TAU);
    x.fill();
    x.restore();
  }
  x.lineWidth = 1;
  x.strokeStyle = '#6a2030';
  x.beginPath();
  x.arc(0, 0, 63.5, 0, TAU);
  x.stroke();
  // rib spikes
  for (let k = 0; k < 8; k++) {
    x.save();
    x.rotate(k * TAU / 8);
    x.fillStyle = '#8a2a30';
    x.beginPath();
    x.ellipse(63, 0, 5, 8, 0, 0, TAU);
    x.fill();
    x.fillStyle = '#a8966c';
    x.beginPath();
    x.moveTo(61, -5.5);
    x.quadraticCurveTo(76, -4, 89, .5);
    x.quadraticCurveTo(76, 3, 61, 5.5);
    x.closePath();
    x.fill();
    x.fillStyle = '#6a5a3a';
    x.beginPath();
    x.moveTo(61, 1);
    x.quadraticCurveTo(76, 2.5, 89, .5);
    x.quadraticCurveTo(76, 3.5, 61, 5.5);
    x.closePath();
    x.fill();
    x.strokeStyle = '#4a3a22';
    x.lineWidth = .5;
    x.beginPath();
    x.moveTo(66, -2);
    x.lineTo(70, 0);
    x.lineTo(73, -1.5);
    x.stroke();
    // rotting meat clinging near the tip
    x.fillStyle = '#5a0a14';
    for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(rf(70, 84), rf(-2, 3), rf(1.5, 3), rf(1, 2), 0, 0, TAU); x.fill(); }
    x.fillStyle = '#a10d14';
    x.fillRect(80, 1, 1, rf(3, 6));
    x.fillRect(74, 2, 1, rf(2, 5));
    if (k % 3 === 0) {
      x.save();
      x.translate(72, 0);
      x.rotate(Math.PI / 2);
      x.scale(.55, .55);
      drawCorpse(x, { twitch: 0, noLeg: k === 3, noArm: 0, cap: 0 });
      x.restore();
    }
    x.restore();
  }
  return c;
}
function buildRingB() {
  // inner ring (rb): a sphincter of striated muscle, four jawbones studded with teeth
  const R = 50, [c, x] = can(R * 2, R * 2);
  x.translate(R, R);
  x.lineWidth = 7;
  x.strokeStyle = '#4a0c18';
  x.beginPath();
  x.arc(0, 0, 42, 0, TAU);
  x.stroke();
  for (let k = 0; k < 90; k++) {
    const a = k / 90 * TAU;
    x.strokeStyle = k % 2 ? '#8a2630' : '#b2444a';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(Math.cos(a) * 39.5, Math.sin(a) * 39.5);
    x.lineTo(Math.cos(a + .05) * 45, Math.sin(a + .05) * 45);
    x.stroke();
  }
  x.strokeStyle = '#d8b8a0';
  x.lineWidth = 1;
  x.beginPath();
  x.arc(0, 0, 45.5, 0, TAU);
  x.stroke();
  for (let k = 0; k < 4; k++) {
    x.save();
    x.rotate(k * TAU / 4 + .4);
    x.fillStyle = '#7a1e28';
    x.fillRect(24, -4, 24, 8);
    x.fillStyle = '#d8ccaa';
    x.fillRect(25, -2.6, 22, 4.4);
    x.fillStyle = '#9a8a62';
    x.fillRect(25, .8, 22, 1);
    x.fillStyle = '#f2ead2';
    for (let j = 0; j < 6; j++) {
      x.beginPath();
      x.moveTo(27 + j * 3.5, -2.6);
      x.lineTo(28.6 + j * 3.5, -6);
      x.lineTo(30 + j * 3.5, -2.6);
      x.fill();
    }
    x.restore();
  }
  return c;
}
function buildFace() {
  // a crew face stretched over metal: 16x20 local
  const [c, x] = can(16, 20);
  x.translate(8, 10);
  const g = x.createRadialGradient(-1, -2, 1, 0, 0, 10);
  g.addColorStop(0, '#c8b8a0');
  g.addColorStop(.7, '#9a8a74');
  g.addColorStop(1, '#5e4a40');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, 0, 7.5, 9.5, 0, 0, TAU);
  x.fill();
  // tension lines where the skin is nailed to the plating
  x.strokeStyle = 'rgba(70,30,30,.6)';
  x.lineWidth = .4;
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * TAU;
    x.beginPath();
    x.moveTo(Math.cos(a) * 4, Math.sin(a) * 5);
    x.lineTo(Math.cos(a) * 7.5, Math.sin(a) * 9.5);
    x.stroke();
  }
  x.fillStyle = '#9aa8b6';
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + .3; x.fillRect(Math.cos(a) * 7 - .5, Math.sin(a) * 9 - .5, 1, 1); }
  // sockets, nose hole, cheekbones
  x.fillStyle = '#2a1010';
  x.beginPath();
  x.ellipse(-2.8, -2.5, 2, 1.6, 0, 0, TAU);
  x.ellipse(2.8, -2.5, 2, 1.6, 0, 0, TAU);
  x.fill();
  x.fillStyle = '#3a1414';
  x.fillRect(-.9, .2, .8, 1.4);
  x.fillRect(.3, .2, .8, 1.4);
  x.fillStyle = 'rgba(255,230,210,.25)';
  x.fillRect(-5.5, -.8, 2, 1);
  x.fillRect(3.5, -.8, 2, 1);
  return c;
}
function buildEyeTex() {
  const S = 192, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d'), R = S / 2;
  seed(1313);
  const g = x.createRadialGradient(R * .85, R * .8, 4, R, R, R);
  g.addColorStop(0, '#eadc98');
  g.addColorStop(.5, '#d4bc64');
  g.addColorStop(.82, '#a88a3a');
  g.addColorStop(1, '#6a4a1a');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // burst-vessel haemorrhages
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU, d = rf(.45, .85) * R, hx = R + Math.cos(a) * d, hy = R + Math.sin(a) * d, hr = rf(8, 22);
    const hg = x.createRadialGradient(hx, hy, 0, hx, hy, hr);
    hg.addColorStop(0, 'rgba(170,16,20,.75)');
    hg.addColorStop(1, 'rgba(170,16,20,0)');
    x.fillStyle = hg;
    x.fillRect(hx - hr, hy - hr, hr * 2, hr * 2);
  }
  // fat veins crawling in from the rim
  for (let i = 0; i < 44; i++) {
    const a = rnd() * TAU;
    let px = R + Math.cos(a) * R * .98, py = R + Math.sin(a) * R * .98, w = rf(2.5, 5), an = a + Math.PI + rf(-.5, .5);
    x.strokeStyle = i % 4 ? '#a4121c' : '#5a0a20';
    x.lineCap = 'round';
    for (let k = 0; k < 26; k++) {
      an += rf(-.45, .45);
      const nx = px + Math.cos(an) * 3.2, ny = py + Math.sin(an) * 3.2;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(nx, ny);
      x.stroke();
      if (rnd() < .18) {
        let bx = nx, by = ny, ba = an + rf(-1.2, 1.2), bw = w * .6;
        for (let j = 0; j < 8; j++) { ba += rf(-.5, .5); const qx = bx + Math.cos(ba) * 2.6, qy = by + Math.sin(ba) * 2.6; x.lineWidth = bw; x.beginPath(); x.moveTo(bx, by); x.lineTo(qx, qy); x.stroke(); bx = qx; by = qy; bw *= .85; }
      }
      px = nx;
      py = ny;
      w *= .9;
    }
  }
  // pus pimples on the white
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU, d = rf(.55, .85) * R, px = R + Math.cos(a) * d, py = R + Math.sin(a) * d, pr = rf(3, 6);
    x.fillStyle = '#c03a2a';
    x.beginPath();
    x.arc(px, py, pr * 1.5, 0, TAU);
    x.fill();
    x.fillStyle = '#f0dc6a';
    x.beginPath();
    x.arc(px, py, pr, 0, TAU);
    x.fill();
    x.fillStyle = '#fffbe0';
    x.beginPath();
    x.arc(px - pr * .3, py - pr * .3, pr * .35, 0, TAU);
    x.fill();
  }
  // iris: sick orange-red with dark limbus
  const ic = document.createElement('canvas');
  ic.width = ic.height = 128;
  const ix = ic.getContext('2d');
  const ig = ix.createRadialGradient(64, 64, 6, 64, 64, 64);
  ig.addColorStop(0, '#3a0a04');
  ig.addColorStop(.3, '#a8401a');
  ig.addColorStop(.75, '#c86a20');
  ig.addColorStop(.92, '#6a1a08');
  ig.addColorStop(1, '#200400');
  ix.fillStyle = ig;
  ix.beginPath();
  ix.arc(64, 64, 63, 0, TAU);
  ix.fill();
  for (let k = 0; k < 120; k++) {
    const a = k / 120 * TAU + rf(-.02, .02);
    ix.strokeStyle = rnd() < .5 ? 'rgba(255,170,80,.35)' : 'rgba(60,10,0,.45)';
    ix.lineWidth = rf(.8, 2);
    ix.beginPath();
    ix.moveTo(64 + Math.cos(a) * 16, 64 + Math.sin(a) * 16);
    ix.lineTo(64 + Math.cos(a + rf(-.1, .1)) * 58, 64 + Math.sin(a + rf(-.1, .1)) * 58);
    ix.stroke();
  }
  // cataract: milky clot, lumpy, with swirls
  const cc = document.createElement('canvas');
  cc.width = cc.height = 128;
  const cx = cc.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const px = 64 + rf(-16, 16), py = 64 + rf(-16, 16), pr = rf(26, 44);
    const cg = cx.createRadialGradient(px, py, 0, px, py, pr);
    cg.addColorStop(0, 'rgba(236,240,226,.55)');
    cg.addColorStop(.6, 'rgba(200,214,196,.3)');
    cg.addColorStop(1, 'rgba(200,214,196,0)');
    cx.fillStyle = cg;
    cx.fillRect(0, 0, 128, 128);
  }
  cx.strokeStyle = 'rgba(255,255,245,.35)';
  cx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { cx.beginPath(); cx.arc(64 + rf(-8, 8), 64 + rf(-8, 8), rf(10, 30), rf(0, 6), rf(0, 6) + 1.6); cx.stroke(); }
  // edge shading
  const sc = document.createElement('canvas');
  sc.width = sc.height = 128;
  const sx = sc.getContext('2d'), sg = sx.createRadialGradient(56, 54, 30, 64, 64, 64);
  sg.addColorStop(0, 'rgba(40,20,0,0)');
  sg.addColorStop(.8, 'rgba(50,20,0,.25)');
  sg.addColorStop(1, 'rgba(30,6,0,.7)');
  sx.fillStyle = sg;
  sx.fillRect(0, 0, 128, 128);
  return { scl: c, iris: ic, cat: cc, shade: sc };
}
function art() {
  if (ART) return ART;
  const m = buildMass();
  ART = { ...m, ringA: buildRingA(), ringB: buildRingB(), face: buildFace(), eye: buildEyeTex() };
  return ART;
}

// ---------------- per-fight state ----------------
const FACES = [[94, -34], [92, 36], [38, -94], [40, 94], [102, 4]];
const VENTS = [[70, -76, -1.1], [70, 76, 1.1]]; // x, y, outward angle
const PORTS = [[-36, -84, -2.15], [-36, 84, 2.15]];
const TEARS = [[60, -55, .5, .2], [50, 62, -.4, .35], [108, -60, 1.2, .5], [-2, -102, .2, .65], [112, 58, 1.4, .8]]; // x, y, angle, opens at rot
const ARTS = [[18, -104, -10, -1], [60, -92, 80, -1], [18, 104, -10, 1], [60, 92, 80, 1]]; // attach x,y; anchor dx; side
let S = null;
function fresh(b) {
  seed(777);
  const cysts = [];
  let tries = 0;
  while (cysts.length < 18 && tries++ < 600) {
    const a = rnd() * TAU, d = rf(66, 108), x = Math.cos(a) * d, y = Math.sin(a) * d;
    if (!inMass(x, y, 8) || x > 112) continue;
    if (FACES.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 14)) continue;
    if (VENTS.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 15) || PORTS.some(([fx, fy]) => Math.hypot(fx - x, fy - y) < 15)) continue;
    if (cysts.some((c) => Math.hypot(c.x - x, c.y - y) < 12)) continue;
    cysts.push({ x, y, r: rf(2.4, 5.4), ph: rf(0, TAU), thr: 0, pop: 0 });
  }
  cysts.forEach((c, i) => (c.thr = .06 + .88 * ((i * 7) % cysts.length) / cysts.length));
  const flaps = [];
  for (let i = 0; i < 12; i++) {
    const a = rf(.35, 2.8), x = MX + Math.cos(a) * (RX - 8), y = Math.sin(a) * (RY - 8);
    flaps.push({ x: Math.min(x, 105), y: y * (rnd() < .3 ? -1 : 1), len: rf(6, 15), w: rf(3, 6), ph: rf(0, TAU), thr: rf(.15, .95), gone: 0 });
  }
  const flies = [];
  for (let i = 0; i < 30; i++) flies.push({ cx: rf(-20, 100), cy: rf(-100, 100), rx: rf(6, 22), ry: rf(4, 16), f1: rf(.05, .13), f2: rf(.07, .17), ph: rf(0, TAU) });
  return {
    b, G: $.G, lt: $.G.t, bt: 0, beat: 0, hurt: 0, lastHp: b.hp, lastPh: b.phase, plHp: b.plates.map((p) => p.hp), cd: {}, flash: 0,
    cysts, flaps, flies, faces: FACES.map(([x, y], i) => ({ x, y, ph: i * 1.7, gone: 0 })),
    vents: VENTS.map(([x, y, a], i) => ({ x, y, a, t: 160 + i * 140, open: 0 })),
    ports: PORTS.map(([x, y, a], i) => ({ x, y, a, t: 260 + i * 170, retch: 0 })),
    eyeBurst: 0, lastDying: 0, bx: b.x, by: b.y, after: null, beamOn: 0,
  };
}
// render-side particles (world coords)
const P = [], MAXP = Math.round(420 * GK);
const GRAV = [.08, .07, .1, -.004, .06, .03, .1, .1, .05, .08, .09, .09];
// kinds: 0 bile 1 pus 2 vomit 3 gas 4 maggot 5 skin 6 meat 7 tooth 8 jelly 9 blood 10 eyeball 11 glass
function sp(k, x, y, vx, vy, s, l) {
  if (P.length >= MAXP) return;
  P.push({ k, x, y, vx, vy, s, l, ml: l, r: rnd() * TAU, vr: rf(-.25, .25), c: rnd() });
}
function burst(k, x, y, n, sp0, sp1, s0, s1, l0, l1, dir = null, spread = TAU) {
  n = Math.round(n * GK);
  for (let i = 0; i < n; i++) {
    const a = dir == null ? rnd() * TAU : dir + rf(-spread / 2, spread / 2), v = rf(sp0, sp1);
    sp(k, x, y, Math.cos(a) * v, Math.sin(a) * v, rf(s0, s1), rf(l0, l1) | 0);
  }
}
function snd(cat, o, cd = 30) {
  if (!GK || !S) return true;
  if ((S.cd[cat] || 0) > 0) return true;
  S.cd[cat] = cd;
  return sample(cat, o);
}
function rotOf(b) {
  const pm = b.plates.reduce((s, p) => s + p.max, 0), pl = b.plates.reduce((s, p) => s + Math.max(0, p.hp), 0);
  const plateDmg = pm ? 1 - pl / pm : 1;
  return Math.min(1, .22 * plateDmg + .78 * (1 - Math.max(0, b.hp) / b.max));
}
const pulse = (f) => Math.exp(-(((f - .08) / .05) ** 2)) + .65 * Math.exp(-(((f - .3) / .06) ** 2));
const deathK = (b) => (b.dying ? 1 - b.dying / 220 : 0);

// ---------------- simulation (advances with G.t, so pause freezes it) ----------------
function tick(b) {
  let n = $.G.t - S.lt;
  S.lt = $.G.t;
  if (n < 0 || n > 8) n = 1;
  for (let f = 0; f < n; f++) {
    for (const k in S.cd) if (S.cd[k] > 0) S.cd[k]--;
    if (S.flash > 0) S.flash--;
    if (b) step1(b);
    else if (S.after) S.after.t++;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += GRAV[p.k];
      p.r += p.vr;
      if (p.k === 3) { p.vx *= .985; p.vy *= .985; p.s += .09; }
      else if (p.k === 5) { p.vx = p.vx * .96 + Math.sin(p.l * .15) * .05; p.vy = Math.min(p.vy, .9); }
      else p.vx *= .992;
      if (--p.l <= 0 || p.y > PH + 20 || p.x < -30 || p.x > W + 40) { P[i] = P[P.length - 1]; P.pop(); }
    }
  }
}
function step1(b) {
  const k = deathK(b), rot = Math.max(rotOf(b), b.dying ? Math.min(1, .55 + k) : 0), bx = b.x, by = b.y;
  S.bx = bx;
  S.by = by;
  S.lastDying = b.dying;
  const per = b.dying ? 15 : [74, 58, 44][b.phase] || 60;
  S.bt += 1 / per;
  S.beat = pulse(S.bt % 1);
  if (S.hurt > 0) S.hurt--;
  if (b.hp < S.lastHp - .01) S.hurt = 8;
  S.lastHp = b.hp;
  if (!GK) return;
  const sc = S.cd;
  // plates = pus gauges: squirt on hit, burst when broken
  b.plates.forEach((p, i) => {
    const px = bx + Math.cos(p.a) * 42, py = by + Math.sin(p.a) * 42;
    if (p.hp < S.plHp[i]) {
      if (p.hp <= 0 && S.plHp[i] > 0) {
        burst(1, px, py, 34, .8, 3.6, 1.2, 2.6, 50, 90, p.a, 1.6);
        burst(11, px, py, 12, 1, 3, .8, 1.6, 40, 70, p.a, 2);
        snd('splat_l', { vol: .8, rate: .85, wet: .3 }, 10);
        snd('snot', { vol: .7, wet: .3 }, 10);
      } else if (rnd() < .5) burst(1, px, py, 2, .8, 2, .8, 1.6, 30, 50, p.a, 1.2);
    }
    S.plHp[i] = p.hp;
    const dmg = 1 - Math.max(0, p.hp) / p.max;
    if (p.hp > 0 && dmg > .45 && rnd() < .04 * dmg) sp(1, px + rf(-3, 3), py + 6, rf(-.2, .2), .3, rf(.8, 1.4), 70);
    if (p.hp <= 0 && rnd() < .05) sp(1, px + rf(-3, 3), py + 3, rf(-.3, .1), .2, rf(.8, 1.6), 80);
  });
  if (b.phase !== S.lastPh) {
    if (b.phase === 1) { burst(1, bx, by, 26, .6, 2.6, 1, 2.2, 40, 80); snd('snot', { vol: .8 }, 5); }
    if (b.phase === 2) { burst(0, bx, by, 30, 1, 4, 1, 2.5, 50, 90); burst(9, bx, by, 20, 1, 3, 1, 2, 40, 70); snd('splat_l', { vol: .7, rate: .7 }, 5); }
    S.lastPh = b.phase;
  }
  // cysts pop as it rots
  for (const c of S.cysts) {
    if (!c.pop && rot >= c.thr) {
      c.pop = 1;
      burst(1, bx + c.x, by + c.y, 16, .8, 3.2, 1, 2.4, 40, 80, Math.atan2(c.y, c.x), 2.2);
      sp(9, bx + c.x, by + c.y, rf(-.5, .5), -.5, 1.5, 40);
      snd('snot', { vol: .55, wet: .25 }, 8);
    }
    if (c.pop && rnd() < .006 + .01 * rot) sp(1, bx + c.x, by + c.y + c.r * .5, rf(-.2, .2), .2, rf(.8, 1.5), 90);
    if (c.pop && rnd() < .004 * rot) sp(4, bx + c.x, by + c.y, rf(-.6, .6), rf(-.4, .2), 1, 120);
  }
  for (const [x, y, , thr] of TEARS) if (rot > thr && rnd() < .03 + .1 * (rot - thr) + (b.dying ? .1 : 0)) sp(rnd() < .8 ? 0 : 4, bx + x + rf(-2, 2), by + y + 3, rf(-.3, .3), rf(0, .6), rf(1, 2), 90);
  for (const f of S.flaps) if (!f.gone && rot >= f.thr) { f.gone = 1; sp(5, bx + f.x, by + f.y + 4, rf(-.6, .1), rf(-.2, .4), f.len * .7, 140); }
  // sphincter vents fart gas
  for (const v of S.vents) {
    if (v.open > 0) {
      v.open--;
      const wx = bx + v.x, wy = by + v.y;
      if (v.open < 26 && v.open > 4) sp(3, wx + Math.cos(v.a) * 6, wy + Math.sin(v.a) * 6, Math.cos(v.a) * rf(.6, 1.6) - rf(.3, 1.1), Math.sin(v.a) * rf(.4, 1.2), rf(4, 8), rf(100, 170) | 0);
      if (v.open === 25) {
        snd('fart_ok', { vol: .5 + .4 * rot, rate: b.dying ? .4 + k * 1.1 : rf(.45, .62), spread: .05, wet: .45 }, b.dying ? 14 : 60);
        if (rnd() < .5) sp(1, wx, wy, Math.cos(v.a) * 1.5, Math.sin(v.a) * 1.5, 1.4, 50);
      }
    } else if (--v.t <= 0) {
      v.open = 32;
      v.t = b.dying ? rf(18, 34) : rf(200, 360) / (1 + 1.6 * rot);
    }
  }
  // exhaust ports retch and vomit
  for (const p of S.ports) {
    if (p.retch > 0) {
      p.retch--;
      const wx = bx + p.x + Math.cos(p.a) * 7, wy = by + p.y + Math.sin(p.a) * 7;
      if (p.retch < 26) {
        const v = rf(1.4, 2.8) * (p.retch > 8 ? 1 : .6);
        for (let j = 0; j < 2; j++) sp(2, wx, wy, Math.cos(p.a + rf(-.25, .25)) * v, Math.sin(p.a + rf(-.25, .25)) * v, rf(1, 2.4), rf(50, 90) | 0);
      }
      if (p.retch === 26) snd('splat_m', { vol: .55, rate: .55, wet: .3 }, 20);
      if (p.retch === 39 && !snd('driveretch', { vol: .6, wet: .3 }, 20)) snd('snot', { vol: .35, rate: .5 }, 20);
    } else if (--p.t <= 0) {
      p.retch = 40;
      p.t = b.dying ? rf(30, 50) : rf(320, 520) / (1 + 1.4 * rot);
    }
  }
  // arteries leak black bile from the joints, in time with the beat
  ARTS.forEach(([ax, ay], j) => {
    if (rot > .25 + j * .14 || b.dying) {
      for (let q = b.dying ? 3 : 1; q-- > 0;) if (rnd() < .05 + .25 * S.beat + (b.dying ? .3 : 0)) {
        const wx = bx + ax * .8, wy = by + ay * .9 + (ay < 0 ? -6 : 6), v = b.dying ? rf(1.5, 4.5) : rf(.2, 1.5);
        sp(0, wx, wy, rf(-1.2, .4) * (b.dying ? 1.8 : 1), (ay < 0 ? -1 : 1) * v, rf(1, 2.2) * (b.dying ? 1.4 : 1), rf(60, 100) | 0);
      }
    }
  });
  // weeping tear duct (pus), tentacle mouths drooling
  if (!S.eyeBurst && rnd() < .05 + .08 * rot) sp(1, bx - 14 + rf(-1, 1), by + 30, rf(-.1, .1), .3, rf(.8, 1.4), 70);
  if (b.laser && b.laser.tel > 0 && rnd() < .25) sp(9, bx - 15, by + 12, rf(-.6, .1), rf(.2, .8), rf(.8, 1.4), 60);
  if (b.laser && b.laser.tel === 0 && !S.beamOn) { burst(9, bx, by, 14, .8, 2.4, 1, 1.8, 40, 60, Math.PI, 2.4); burst(1, bx - 10, by + 10, 8, .5, 1.5, 1, 1.6, 40, 60, 2, 1.4); }
  S.beamOn = b.laser && b.laser.tel === 0 ? 1 : 0;
  if (rnd() < .12) {
    const tn = b.tent[rnd() < .5 ? 0 : 1], q = tentPts(b, tn)[16];
    sp(rnd() < .5 ? 9 : 1, q.x, q.y + 3, rf(-.3, .3), .3, rf(.8, 1.4), 70);
  }
  if (rnd() < .008) snd('drivegut', { vol: .5 + .3 * rot, wet: .45 }, 150); // gut gurgle
  // ---- death throes ----
  if (b.dying) {
    if (k > .45 && !S.eyeBurst) {
      S.eyeBurst = 1;
      burst(8, bx, by, 40, .8, 4, 1.4, 3, 60, 110);
      burst(9, bx, by, 26, 1, 4.5, 1, 2.2, 50, 90);
      burst(1, bx, by, 22, .8, 3.5, 1, 2.4, 50, 90);
      sp(10, bx, by, -2.2, -2.5, 3, 160);
      snd('splat_l', { vol: 1, rate: .7, wet: .3 }, 4);
      snd('snot', { vol: .9, rate: .6 }, 4);
      if (SET.flashes) S.flash = 5;
    }
    if (rnd() < .3) { const a = rnd() * TAU, d = rf(40, 100); burst(rnd() < .5 ? 0 : 6, bx + Math.cos(a) * d, by + Math.sin(a) * d, 4, .5, 2.5, 1, 2.4, 50, 90); }
    if (k > .7) for (const f of S.faces) if (!f.gone && rnd() < .04) { f.gone = 1; sp(5, bx + f.x, by + f.y, rf(-1, .5), rf(-1, 0), 9, 150); burst(9, bx + f.x, by + f.y, 6, .5, 1.6, 1, 1.6, 40, 60); }
    if (b.dying % 40 === 20) snd('snot', { vol: .7, rate: .45 + k * .4 }, 10);
  }
}
function rupture() {
  // the last frame of the death: the whole organ bursts like a water balloon full of everything
  const x = S.bx, y = S.by;
  burst(0, x, y, 150, 1, 8, 1.8, 4.5, 80, 160);
  burst(1, x, y, 120, 1, 8, 1.8, 4.5, 80, 160);
  burst(6, x, y, 40, 1.5, 6, 3, 6, 80, 140);
  burst(2, x, y, 30, 1, 5, 1.2, 2.6, 60, 110);
  burst(7, x, y, 22, 2, 6, .8, 1.4, 70, 120);
  burst(4, x, y, 40, .5, 4, 1, 1, 90, 160);
  burst(3, x, y, 22, .5, 2, 8, 16, 120, 200);
  burst(10, x, y, 6, 1.5, 4, 2, 3.2, 120, 180);
  burst(5, x, y, 10, 1, 3, 6, 12, 120, 180);
  S.after = { t: 0, x, y, drips: [] };
  for (let i = 0; i < Math.round(26 * GK); i++) S.after.drips.push({ x: rf(8, W - 8), w: rf(3, 9), sp: rf(.25, .9), d: rf(0, 30), c: rnd() < .65 ? 0 : 1 });
  S.cd = {};
  if (!snd('driveburst', { vol: 1, spread: .04, wet: .35 }, 0)) snd('splat_l', { vol: 1, rate: .6, wet: .4 }, 0);
  snd('explode_l', { vol: .7, rate: .7, wet: .4 }, 0);
  snd('fart_ok', { vol: 1, rate: .32, spread: .02, wet: .6, at: .5 }, 0); // and Matty's raspberry, slowed to a groan
}

// ---------------- drawing ----------------
function quadPts(x0, y0, cx, cy, x1, y1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
  }
  return out;
}
function strokePts(pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}
function drawArteries(b, rot) {
  const t = b.t, k = deathK(b);
  ctx.lineCap = 'round';
  ARTS.forEach(([ax, ay, adx, side], j) => {
    const x0 = b.x + ax, y0 = b.y + ay, x1 = b.x + adx + Math.sin(t * .01 + j) * 4, y1 = side < 0 ? -30 : PH + 30;
    const cx = (x0 + x1) / 2 - 18 + Math.sin(t * .02 + j * 2) * 5, cy = (y0 + y1) / 2;
    const pts = quadPts(x0, y0, cx, cy, x1, y1, 12);
    ctx.strokeStyle = '#14030a';
    ctx.lineWidth = 12;
    strokePts(pts);
    ctx.strokeStyle = '#5c1a32';
    ctx.lineWidth = 9;
    strokePts(pts);
    // black bile inside, pushed along in pulses
    ctx.strokeStyle = '#050605';
    ctx.lineWidth = 4;
    strokePts(pts);
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -(S.bt * 26 + j * 5) * (side < 0 ? -1 : 1);
    ctx.strokeStyle = 'rgba(80,110,40,.65)';
    ctx.lineWidth = 2;
    strokePts(pts);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(200,120,140,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pts[0][0] - 3, pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x - 3, y);
    ctx.stroke();
    // bolus of bile squeezing toward the heart
    const f = 1 - ((S.bt + j * .37) % 1), i = Math.min(11, f * 12 | 0), q = pts[i], q2 = pts[i + 1];
    ctx.fillStyle = '#3a1024';
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], 7, 9, Math.atan2(q2[1] - q[1], q2[0] - q[0]) + Math.PI / 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#070807';
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], 4, 6, Math.atan2(q2[1] - q[1], q2[0] - q[0]) + Math.PI / 2, 0, TAU);
    ctx.fill();
    // old pipe clamps, half swallowed
    for (let c = 2; c < 12; c += 3) {
      const p0 = pts[c], p1 = pts[c + 1], an = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      ctx.save();
      ctx.translate(p0[0], p0[1]);
      ctx.rotate(an);
      ctx.fillStyle = '#4a525a';
      ctx.fillRect(-1.5, -7, 3, 14);
      ctx.fillStyle = '#8a96a2';
      ctx.fillRect(-1.5, -7, 1, 14);
      ctx.fillStyle = 'rgba(150,70,20,.8)';
      ctx.fillRect(0, 2, 1.5, 4);
      // leaking joint
      if (rot > .25 + j * .14 || b.dying) {
        ctx.fillStyle = '#060705';
        ctx.fillRect(1.5, -2, 2 + 2 * S.beat, 3);
      }
      ctx.restore();
    }
  });
}
function drawMass(b, rot) {
  const A = art(), t = b.t, k = deathK(b), beat = S.beat * (1 + k), hurt = S.hurt / 8;
  const sw = 1 + .1 * k + (k > .85 ? Math.sin(t * 1.3) * .03 : 0);
  const sx = (1 + .022 * beat + .015 * hurt * Math.sin(t * 1.7)) * sw, sy = (1 + .03 * beat) * sw;
  ctx.save();
  ctx.translate(b.x + MX, b.y);
  ctx.scale(sx, sy);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(A.mass, -110, -125, 220, 250);
  if (rot > .02) {
    ctx.globalAlpha = Math.min(1, rot * 1.1) * Math.min(1, GK + .3);
    ctx.drawImage(A.necro, -110, -125, 220, 250);
    ctx.globalAlpha = 1;
  }
  ctx.translate(-MX, 0); // boss-local
  // skin flaps sloughing off the plating
  for (const f of S.flaps) {
    if (f.gone) continue;
    const sway = Math.sin(t * .05 + f.ph) * 2, len = f.len * (1 + rot * .4);
    ctx.fillStyle = '#7a2a30';
    ctx.beginPath();
    ctx.moveTo(f.x - f.w / 2, f.y);
    ctx.lineTo(f.x + f.w / 2, f.y);
    ctx.lineTo(f.x + f.w * .3 + sway, f.y + len);
    ctx.lineTo(f.x - f.w * .2 + sway * 1.2, f.y + len * .8);
    ctx.fill();
    ctx.fillStyle = '#b8968a';
    ctx.beginPath();
    ctx.moveTo(f.x - f.w / 2, f.y);
    ctx.lineTo(f.x + f.w / 4, f.y);
    ctx.lineTo(f.x + sway, f.y + len * .9);
    ctx.lineTo(f.x - f.w * .3 + sway * 1.2, f.y + len * .75);
    ctx.fill();
  }
  // cysts: swollen, veined pus domes until they pop; then open craters with maggots
  for (let i = 0; i < S.cysts.length; i++) {
    const c = S.cysts[i];
    if (c.pop) {
      ctx.fillStyle = '#c8b050';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r * 1.25, c.r, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3a0408';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.r * .95, c.r * .7, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a1018';
      ctx.beginPath();
      ctx.ellipse(c.x + .5, c.y + .6, c.r * .6, c.r * .4, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d8c868';
      ctx.fillRect(c.x - .5, c.y + c.r * .6, 1, 2 + Math.sin(t * .04 + c.ph) * 1.5 + 1.5);
      if (GK && i % 2 === 0) {
        ctx.fillStyle = '#f0e8cc';
        const nm = 2 + (rot * 5 * GK | 0);
        for (let m = 0; m < nm; m++) {
          const a = m * 2.4 + c.ph, wig = Math.sin(t * .3 + m * 1.7) * .8;
          ctx.fillRect(c.x + Math.cos(a) * c.r * .55 + wig, c.y + Math.sin(a) * c.r * .4, 1.6, .9);
        }
      }
    } else {
      const sw2 = c.r * (1 + .35 * rot) + Math.sin(t * .07 + c.ph) * .4 + beat * .5;
      // an inflamed mound with a ripe whitehead that swells as the drive rots
      const ripe = rot > c.thr - .12;
      ctx.fillStyle = '#6a1020';
      ctx.beginPath();
      ctx.arc(c.x, c.y + .6, sw2 * 1.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#b02c38';
      ctx.beginPath();
      ctx.arc(c.x - .3, c.y, sw2 * 1.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d8645a';
      ctx.beginPath();
      ctx.arc(c.x - sw2 * .3, c.y - sw2 * .3, sw2 * .7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = ripe ? '#f2e290' : '#d8c068';
      ctx.beginPath();
      ctx.arc(c.x, c.y - sw2 * .1, sw2 * (ripe ? .72 : .55), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,10,20,.8)';
      ctx.lineWidth = .5;
      ctx.beginPath();
      ctx.moveTo(c.x - sw2 * .8, c.y + sw2 * .2);
      ctx.lineTo(c.x - sw2 * .2, c.y - sw2 * .1);
      ctx.lineTo(c.x + sw2 * .1, c.y + sw2 * .5);
      ctx.moveTo(c.x + sw2 * .7, c.y - sw2 * .3);
      ctx.lineTo(c.x + sw2 * .2, c.y - sw2 * .2);
      ctx.stroke();
      ctx.fillStyle = '#fffbe8';
      ctx.beginPath();
      ctx.arc(c.x - sw2 * .2, c.y - sw2 * .35, sw2 * .2, 0, TAU);
      ctx.fill();
    }
  }
  // rot tears: ragged splits in the hide that gape wider as it dies, black bile sheeting out of them
  for (const [x, y, a, thr] of TEARS) {
    if (rot <= thr) continue;
    const op = Math.min(1, (rot - thr) * 3), len = 8 + op * 6, ca = Math.cos(a), sa = Math.sin(a);
    const lip = (sgn, wd) => {
      ctx.beginPath();
      ctx.moveTo(x - ca * len, y - sa * len);
      for (let j = 1; j < 8; j++) {
        const f = j / 8 * 2 - 1, h = (1 - f * f) * wd * (1 + .35 * Math.sin(j * 2.7 + x)) * sgn;
        ctx.lineTo(x + ca * len * f - sa * h, y + sa * len * f + ca * h);
      }
      ctx.lineTo(x + ca * len, y + sa * len);
    };
    ctx.fillStyle = '#9a2430';
    lip(1, 2.5 + op * 4.5);
    for (let j = 7; j > 0; j--) { const f = j / 8 * 2 - 1, h = -(1 - f * f) * (2.5 + op * 4.5) * (1 + .35 * Math.sin(j * 1.9 + y)); ctx.lineTo(x + ca * len * f - sa * h, y + sa * len * f + ca * h); }
    ctx.fill();
    ctx.fillStyle = '#050605';
    lip(1, .8 + op * 3);
    for (let j = 7; j > 0; j--) { const f = j / 8 * 2 - 1, h = -(1 - f * f) * (.8 + op * 3); ctx.lineTo(x + ca * len * f - sa * h, y + sa * len * f + ca * h); }
    ctx.fill();
    ctx.fillStyle = '#d8c8a0';
    for (let j = -1; j <= 1; j++) ctx.fillRect(x + ca * j * len * .45 - .4, y + sa * j * len * .45 - .6 - op * 1.5, .9, 1.2 + op * 3); // ribs showing through
    // bile sheeting down out of it in wavy runs, a maggot or two at the lip
    ctx.fillStyle = '#060806';
    for (let j = 0; j < 3; j++) {
      const sx = x + ca * (j - 1) * len * .4, sy = y + sa * (j - 1) * len * .4 + 1, dl = (3 + op * 12) * (.6 + .4 * Math.sin(j * 2.1 + x)) + Math.sin(t * .05 + j + x) * 1.5;
      for (let q = 0; q < dl; q += 2) ctx.fillRect(sx + Math.sin(q * .5 + j) * .6 - .7, sy + q, 1.4, 2);
      ctx.beginPath();
      ctx.arc(sx, sy + dl, 1.1, 0, TAU);
      ctx.fill();
    }
    if (GK) {
      ctx.fillStyle = '#f0e8cc';
      ctx.fillRect(x - ca * len * .3 + Math.sin(t * .3) * .6, y - sa * len * .3 - 1, 1.6, .9);
      ctx.fillRect(x + ca * len * .2, y + sa * len * .2 + Math.sin(t * .27) * .6, 1.6, .9);
      ctx.fillStyle = '#060806';
    }
  }
  // crew faces stretched over the hull; mouths still working
  for (let i = 0; i < S.faces.length; i++) {
    const f = S.faces[i];
    if (f.gone) {
      ctx.fillStyle = '#4a525a';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 7, 9, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a0a10';
      ctx.fillRect(f.x - 4, f.y - 2, 8, 2);
      ctx.fillRect(f.x - 1, f.y, 2, 9);
      continue;
    }
    ctx.drawImage(A.face, f.x - 8, f.y - 10, 16, 20);
    if (rot > .2) {
      // the skin goes green and starts to slide
      ctx.fillStyle = `rgba(70,90,30,${Math.min(.55, (rot - .2) * .8)})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y + rot * 1.5, 7.5, 9.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a0a10';
      ctx.fillRect(f.x - 3.6, f.y - 1.5, .8, 2 + rot * 5);
      ctx.fillRect(f.x + 2.6, f.y - 1.5, .8, 1 + rot * 6);
    }
    const scream = b.dying ? 1 : Math.max(hurt, b.laser && b.laser.tel > 0 ? .6 : 0);
    const mo = Math.max(scream, .25 + .25 * Math.sin(t * (.08 + i * .023) + f.ph) + .2 * Math.sin(t * .31 + i));
    ctx.fillStyle = '#180204';
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 4.2, 2.2 + mo * .8, .4 + mo * 2.6, 0, 0, TAU);
    ctx.fill();
    if (mo > .45) {
      ctx.fillStyle = '#e6dcc0';
      ctx.fillRect(f.x - 1.5, f.y + 4.2 - (.4 + mo * 2.6) + .2, 3, .8);
      ctx.fillStyle = '#8a2a3a';
      ctx.fillRect(f.x - 1, f.y + 4.2 + mo * 1.2, 2, 1);
    }
    // rolling eyes (one face's are sewn shut)
    if (i === 1) {
      ctx.strokeStyle = '#2a2a30';
      ctx.lineWidth = .5;
      ctx.beginPath();
      for (const ex of [-2.8, 2.8]) for (let s = -1; s <= 1; s++) { ctx.moveTo(f.x + ex + s * .8, f.y - 3.6); ctx.lineTo(f.x + ex + s * .8, f.y - 1.4); }
      ctx.stroke();
    } else {
      ctx.fillStyle = i === 3 ? '#e8d880' : '#d8d0c0';
      const ea = t * .03 + f.ph, ex = Math.cos(ea) * .7, ey = Math.sin(ea * 1.3) * .5;
      ctx.fillRect(f.x - 3.6 + ex, f.y - 3 + ey, 1.4, 1.2);
      ctx.fillRect(f.x + 2 + ex, f.y - 3 + ey, 1.4, 1.2);
      ctx.fillStyle = '#7a0a10';
      ctx.fillRect(f.x - 3.4 + ex, f.y - 1.7, .6, 2 + i % 2);
    }
    // drool
    ctx.fillStyle = 'rgba(220,210,140,.8)';
    ctx.fillRect(f.x - .4 + (i % 2), f.y + 4.2 + .4 + mo * 2.6, .8, 2 + Math.sin(t * .05 + i) * 1.5 + 1.5);
  }
  // sphincter vents: a puckered ring ringed with haemorrhoids, a few hairs; it dilates and farts
  for (const v of S.vents) {
    const o = v.open > 0 ? Math.sin(Math.min(1, (32 - v.open) / 8) * Math.PI / 2) * Math.min(1, v.open / 6) : 0;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.a + Math.PI / 2);
    ctx.scale(1.5, 1.5);
    ctx.fillStyle = '#3a0c18';
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 + o, 7.5 + o, 0, 0, TAU);
    ctx.fill();
    for (let w = 0; w < 7; w++) {
      // haemorrhoids: purple grapes round the rim
      const a = w / 7 * TAU + .5, hr = 2.2 + (w % 3) * .6 + o * .6;
      ctx.fillStyle = '#5a2a5a';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 8.6, Math.sin(a) * 6.2, hr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#8a4a7a';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 8.6 - hr * .3, Math.sin(a) * 6.2 - hr * .3, hr * .45, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#7a3040';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.5 + o * 1.5, 4.6 + o, 0, 0, TAU);
    ctx.fill();
    // creases spiralling into the hole
    ctx.strokeStyle = '#2a0610';
    ctx.lineWidth = .6;
    ctx.beginPath();
    for (let w = 0; w < 10; w++) {
      const a = w / 10 * TAU;
      ctx.moveTo(Math.cos(a) * (1.2 + o * 2.5), Math.sin(a) * (.9 + o * 1.8));
      ctx.quadraticCurveTo(Math.cos(a + .35) * 4, Math.sin(a + .35) * 3, Math.cos(a + .55) * (6 + o), Math.sin(a + .55) * (4.3 + o * .7));
    }
    ctx.stroke();
    ctx.fillStyle = '#0c0204';
    ctx.beginPath();
    ctx.ellipse(0, 0, .9 + o * 3.4, .6 + o * 2.4, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#140806';
    ctx.lineWidth = .35;
    ctx.beginPath();
    for (let w = 0; w < 6; w++) { const a = w / 6 * TAU + .9; ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 7); ctx.quadraticCurveTo(Math.cos(a + .3) * 13, Math.sin(a + .3) * 9.5, Math.cos(a + .1) * 14, Math.sin(a + .1) * 10 + Math.sin(t * .05 + w)); }
    ctx.stroke();
    ctx.restore();
  }
  // exhaust ports (they retch)
  for (const p of S.ports) {
    const r = p.retch, sw2 = r > 26 ? Math.sin((40 - r) / 14 * Math.PI) * 2.5 : r > 0 ? 1.5 : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.fillStyle = '#2e343a';
    ctx.fillRect(-2, -6 - sw2 * .5, 11, 12 + sw2);
    ctx.fillStyle = '#6a747e';
    ctx.fillRect(-2, -6 - sw2 * .5, 11, 1.5);
    ctx.fillStyle = '#7a3a2a';
    ctx.fillRect(2, -6 - sw2 * .5, 1, 12 + sw2);
    ctx.fillStyle = '#9a4a50';
    ctx.beginPath();
    ctx.ellipse(9, 0, 3 + sw2 * .5, 7 + sw2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = r > 0 && r < 26 ? '#c88a3a' : '#1a0606';
    ctx.beginPath();
    ctx.ellipse(10, 0, 1.6 + sw2 * .4, 4.5 + sw2 * .8, 0, 0, TAU);
    ctx.fill();
    // crusted vomit dribble
    ctx.fillStyle = 'rgba(190,140,60,.85)';
    ctx.fillRect(9, 3, 2, 3 + rot * 3);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = false;
  ctx.restore();
}
function drawGuts(b) {
  // tentacles: prolapsed intestines with sucker-mouths, mesentery fat hanging off them
  const t = b.t, k = deathK(b);
  ctx.lineCap = 'round';
  for (let ti = 0; ti < b.tent.length; ti++) {
    const tn = b.tent[ti], raw = tentPts(b, tn);
    const sag = b.dying ? k * 50 : 0;
    const pts = raw.map((p, i) => ({ x: p.x, y: p.y + sag * (i / 16) ** 2 }));
    const w = (i) => 11.5 - i * .22;
    // mesentery strands + fat
    for (let i = 2; i < 12; i += 2) {
      const p = pts[i], hl = 6 + (i % 4) * 2 + Math.sin(t * .05 + i) * 2;
      ctx.strokeStyle = 'rgba(200,160,120,.55)';
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x - 2, p.y + hl * .6, p.x + Math.sin(t * .04 + i) * 2, p.y + hl + 4);
      ctx.stroke();
      ctx.fillStyle = '#e3c48f';
      ctx.beginPath();
      ctx.ellipse(p.x + Math.sin(t * .04 + i) * 2, p.y + hl + 5, 1.6, 2.2, 0, 0, TAU);
      ctx.fill();
    }
    for (const [lw, col, ox, oy] of [[3, '#2a0814', 0, 0], [0, '#8e3e58', 0, 0], [-4.5, '#c06a82', -.6, -1], [-8, '#eaa6b4', -.8, -1.6]]) {
      ctx.strokeStyle = col;
      for (let i = 0; i < 16; i++) {
        const a = pts[i], q = pts[i + 1];
        ctx.lineWidth = Math.max(1, w(i) + lw - (lw < -6 ? 0 : 0));
        ctx.beginPath();
        ctx.moveTo(a.x + ox, a.y + oy);
        ctx.lineTo(q.x + ox, q.y + oy);
        ctx.stroke();
      }
    }
    // haustra: puckered constrictions
    ctx.strokeStyle = '#4a1022';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 16; i++) {
      const a = pts[i - 1], q = pts[i + 1], an = Math.atan2(q.y - a.y, q.x - a.x) + Math.PI / 2, hw = (w(i) + 3) / 2 - .5;
      ctx.moveTo(pts[i].x + Math.cos(an) * hw, pts[i].y + Math.sin(an) * hw);
      ctx.quadraticCurveTo(pts[i].x + Math.cos(an - Math.PI / 2) * 1.5, pts[i].y + Math.sin(an - Math.PI / 2) * 1.5, pts[i].x - Math.cos(an) * hw, pts[i].y - Math.sin(an) * hw);
    }
    ctx.stroke();
    // bruising, bile stains and a wet sheen
    for (let i = 1; i < 16; i += 2) {
      const p = pts[i];
      ctx.fillStyle = i % 4 === 1 ? 'rgba(70,20,60,.6)' : 'rgba(140,160,60,.4)';
      ctx.beginPath();
      ctx.ellipse(p.x + ((i * 7) % 5) - 2, p.y + 1.5, 2.4, 1.4, i, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,235,240,.75)';
    for (let i = 2; i < 16; i += 3) ctx.fillRect(pts[i].x - 1, pts[i].y - w(i) / 2 + 1.4, 1.6, .8);
    // sucker mouths along the gut
    for (const i of [4, 7, 10, 13]) {
      const a = pts[i - 1], q = pts[i + 1], an = Math.atan2(q.y - a.y, q.x - a.x) + Math.PI / 2, sd = (i % 2 ? 1 : -1) * (w(i) / 2 - 1);
      const mx = pts[i].x + Math.cos(an) * sd, my = pts[i].y + Math.sin(an) * sd, op = .5 + .5 * Math.sin(t * .12 + i + ti * 2);
      ctx.fillStyle = '#d07888';
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a0206';
      ctx.beginPath();
      ctx.arc(mx, my, .6 + op * 1.6, 0, TAU);
      ctx.fill();
      if (op > .4) {
        ctx.fillStyle = '#f2ead2';
        for (let j = 0; j < 5; j++) { const ja = j / 5 * TAU + t * .02; ctx.fillRect(mx + Math.cos(ja) * (op * 1.6) - .3, my + Math.sin(ja) * (op * 1.6) - .3, .7, .7); }
      }
    }
    // lamprey mouth at the tip
    const tip = pts[16], pr = pts[15], an = Math.atan2(tip.y - pr.y, tip.x - pr.x), op = .55 + .45 * Math.sin(t * .09 + ti * 1.7);
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(an);
    ctx.fillStyle = '#5a1424';
    ctx.beginPath();
    ctx.ellipse(1, 0, 6, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c86a7a';
    ctx.beginPath();
    ctx.ellipse(1.5, 0, 4.6, 6.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#200508';
    ctx.beginPath();
    ctx.ellipse(2, 0, 2.2 + op * 1.8, 3 + op * 3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    for (let j = 0; j < 10; j++) {
      const ja = j / 10 * TAU + t * .03, rr2 = 2.2 + op * 1.8, ry = 3 + op * 3;
      ctx.beginPath();
      ctx.moveTo(2 + Math.cos(ja) * rr2, Math.sin(ja) * ry);
      ctx.lineTo(2 + Math.cos(ja + .2) * rr2 * .55, Math.sin(ja + .2) * ry * .55);
      ctx.lineTo(2 + Math.cos(ja + .4) * rr2, Math.sin(ja + .4) * ry);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(220,210,140,.85)';
    ctx.fillRect(1.5, 6, 1, 3 + op * 3);
    ctx.restore();
  }
}
function drawRings(b) {
  const A = art();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.rotate(b.ra);
  ctx.drawImage(A.ringA, -94, -94, 188, 188);
  ctx.restore();
  ctx.save();
  ctx.rotate(b.rb);
  ctx.drawImage(A.ringB, -50, -50, 100, 100);
  ctx.restore();
  ctx.imageSmoothingEnabled = false;
  ctx.restore();
}
function drawSocket(b, rot) {
  // inflamed socket around the eye (lo layer, under the hi-res eyeball)
  const t = b.t;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = '#2a0408';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * TAU, sw = 3.6 + Math.sin(k * 2.3) * 1.2 + S.beat * .8;
    ctx.fillStyle = k % 2 ? '#9a2a34' : '#b8404a';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 24.5, Math.sin(a) * 24.5, sw, 0, TAU);
    ctx.fill();
  }
  // yellow crust in the corners
  ctx.fillStyle = '#d8c060';
  for (const [x, y, r] of [[-22, 4, 3], [-20, 9, 2.2], [21, -6, 2.6], [18, 14, 1.8], [-6, 23, 2]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  if (S.eyeBurst) {
    // ruptured: an empty, gushing hole with the torn white hanging out
    ctx.fillStyle = '#0c0204';
    ctx.beginPath();
    ctx.arc(0, 0, 19, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6a0a12';
    ctx.beginPath();
    ctx.arc(2, 3, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e2cf94';
    ctx.beginPath();
    ctx.moveTo(-16, 6);
    ctx.quadraticCurveTo(-14, 26 + Math.sin(t * .1) * 3, -4, 30);
    ctx.lineTo(4, 12);
    ctx.fill();
    ctx.strokeStyle = '#a10d14';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.moveTo(-12, 10);
    ctx.lineTo(-8, 22);
    ctx.stroke();
    ctx.strokeStyle = '#b0505a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.quadraticCurveTo(-6, 20, -2 + Math.sin(t * .08) * 4, 40);
    ctx.stroke();
  } else {
    // tear streaks: pus running from the duct down the socket
    ctx.strokeStyle = 'rgba(214,200,96,.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-17, 8);
    ctx.quadraticCurveTo(-19, 18, -14, 30);
    ctx.moveTo(-14, 13);
    ctx.quadraticCurveTo(-12, 22, -10, 26 + Math.sin(t * .05) * 2);
    ctx.stroke();
  }
  ctx.restore();
}
function drawPlates(b) {
  for (let i = 0; i < b.plates.length; i++) {
    const p = b.plates[i], px = b.x + Math.cos(p.a) * 42, py = b.y + Math.sin(p.a) * 42, dmg = 1 - Math.max(0, p.hp) / p.max;
    ctx.save();
    ctx.translate(px, py);
    if (p.hp <= 0) {
      // burst gauge: torn brass, glass teeth, a crater still dribbling pus
      ctx.fillStyle = '#5a4a2a';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 10, p.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a0204';
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 8, p.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a1018';
      ctx.beginPath();
      ctx.ellipse(-1, 1, 3.4, 4.5, p.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(200,230,240,.8)';
      for (let j = 0; j < 5; j++) { const a = j * 1.3 + i; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 6.5, Math.sin(a) * 8); ctx.lineTo(Math.cos(a + .15) * 3.5, Math.sin(a + .15) * 4.5); ctx.lineTo(Math.cos(a + .3) * 6.5, Math.sin(a + .3) * 8); ctx.fill(); }
      ctx.fillStyle = '#d8c868';
      ctx.fillRect(-1, 5, 2, 6 + Math.sin(b.t * .05 + i) * 2);
      ctx.restore();
      continue;
    }
    ctx.rotate(p.a);
    // brass rim
    ctx.fillStyle = '#3a2a14';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 15.5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#9a7a3a';
    ctx.beginPath();
    ctx.ellipse(-.5, 0, 8, 14.5, 0, 0, TAU);
    ctx.fill();
    // glass bulb full of pus; the level and pressure rise with damage
    const swell = 1 + dmg * .12 + S.beat * .03;
    ctx.fillStyle = '#5a5020';
    ctx.beginPath();
    ctx.ellipse(-.5, 0, 6.4 * swell, 13 * swell, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = dmg > .6 ? '#ecd860' : '#d8c458';
    ctx.beginPath();
    ctx.ellipse(-.5, 0, 6 * swell, 12.4 * swell, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a89a3a';
    ctx.beginPath();
    ctx.ellipse(1.5, 2, 3.5, 8, 0, 0, TAU);
    ctx.fill();
    // bubbles rising through it
    ctx.fillStyle = 'rgba(255,250,210,.85)';
    for (let j = 0; j < 4; j++) { const yy = 10 - ((b.t * (.2 + j * .07) + j * 7) % 20); ctx.beginPath(); ctx.arc(-2 + j * 1.3, yy, .7 + j * .2, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(-4, -9, 1.2, 6);
    // pressure dial
    ctx.fillStyle = '#e8e0c8';
    ctx.beginPath();
    ctx.arc(4.5, -8, 3.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a2a14';
    ctx.lineWidth = .6;
    ctx.stroke();
    ctx.fillStyle = '#c0101a';
    ctx.beginPath();
    ctx.arc(4.5, -8, 2.6, -.2, .9);
    ctx.lineTo(4.5, -8);
    ctx.fill();
    const na = -2.4 + dmg * 3.2 + (dmg > .6 ? Math.sin(b.t * .9) * .25 : 0);
    ctx.strokeStyle = '#100808';
    ctx.lineWidth = .7;
    ctx.beginPath();
    ctx.moveTo(4.5, -8);
    ctx.lineTo(4.5 + Math.cos(na) * 2.6, -8 + Math.sin(na) * 2.6);
    ctx.stroke();
    // cracks, a blister forcing through, rivets
    if (dmg > .3) {
      ctx.strokeStyle = 'rgba(255,255,240,.85)';
      ctx.lineWidth = .5;
      ctx.beginPath();
      ctx.moveTo(-3, -4);
      ctx.lineTo(0, -1);
      ctx.lineTo(-1, 3);
      ctx.lineTo(2, 6);
      if (dmg > .55) { ctx.moveTo(0, -1); ctx.lineTo(3, -3); ctx.moveTo(-1, 3); ctx.lineTo(-4, 5); }
      ctx.stroke();
    }
    if (dmg > .6) {
      const bl = 2 + (dmg - .6) * 7 + Math.sin(b.t * .2) * .5;
      ctx.fillStyle = '#f2e27a';
      ctx.beginPath();
      ctx.arc(-1, 3, bl, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fffbe0';
      ctx.beginPath();
      ctx.arc(-1.6, 2.2, bl * .35, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#d8c080';
    for (let k = -2; k <= 2; k++) ctx.fillRect(-8, k * 5.5, 1, 1);
    if (p.f) {
      ctx.fillStyle = 'rgba(255,255,230,.55)';
      ctx.beginPath();
      ctx.ellipse(-.5, 0, 8, 14.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
function arc(x, y, vx, vy, g, n, wd, col) {
  ctx.strokeStyle = col;
  ctx.lineWidth = wd;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 1; i <= n; i++) ctx.lineTo(x + vx * i, y + vy * i + .5 * g * i * i);
  ctx.stroke();
}
function drawJets(b) {
  // solid streams so the gags read through the bullets: vomit from retching ports, bile geysers while it dies
  if (!GK) return;
  const t = b.t;
  ctx.lineCap = 'round';
  for (const p of S.ports) {
    if (!(p.retch > 0 && p.retch < 26)) continue;
    const f = p.retch / 26, x = b.x + p.x + Math.cos(p.a) * 9, y = b.y + p.y + Math.sin(p.a) * 9, v = 2.2 * Math.min(1, f * 2.5);
    const vx = Math.cos(p.a) * v, vy = Math.sin(p.a) * v;
    arc(x, y, vx, vy, .12, 12, 7, '#5a3810');
    arc(x, y, vx, vy, .12, 12, 5, '#b07a30');
    arc(x - .7, y - .7, vx, vy, .12, 10, 1.6, '#e2c060');
    for (let i = 1; i < 12; i++) {
      // lumps
      const lx = x + vx * i + Math.sin(t * .7 + i * 2) * 1.5, ly = y + vy * i + .06 * i * i + Math.cos(t * .6 + i) * 1.5;
      ctx.fillStyle = i % 3 ? '#8a5a20' : '#d8a050';
      ctx.beginPath();
      ctx.arc(lx, ly, 1.6 + (i % 4) * .5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#f2e04a';
    for (let i = 2; i < 12; i += 3) ctx.fillRect(x + vx * i + Math.sin(t + i) * 1.2, y + vy * i + .06 * i * i + Math.cos(t * 1.3 + i), 1.4, 1.4); // corn
  }
  if (b.dying) {
    ARTS.forEach(([ax, ay], j) => {
      const s = ay < 0 ? -1 : 1, fl = .7 + .3 * Math.sin(t * .9 + j * 2), x = b.x + ax * .8, y = b.y + ay * .9;
      arc(x, y, -.5 - j * .25, s * 3.2 * fl, .14, 14, 4.5, '#050605');
      arc(x, y, -.5 - j * .25, s * 3.2 * fl, .14, 12, 1.4, '#3a5a1a');
    });
  }
}
// the infected eyeball, drawn on the hi-res layer by drawEyeQ via e.draw
function eyeHi(D, X, Y, r, e) {
  const A = art().eye, o = e.o, R = r * (1 + .85 * o.bulge * o.bulge) + (o.bulge > .6 ? Math.sin(o.t * 1.7) * r * .05 : 0);
  D.save();
  D.translate(X, Y);
  if (o.fire) {
    D.globalCompositeOperation = 'lighter';
    const g = D.createRadialGradient(0, 0, R * .7, 0, 0, R * 2.2);
    g.addColorStop(0, 'rgba(255,60,20,.4)');
    g.addColorStop(1, 'rgba(255,40,10,0)');
    D.fillStyle = g;
    D.fillRect(-R * 2.2, -R * 2.2, R * 4.4, R * 4.4);
    D.globalCompositeOperation = 'source-over';
  }
  D.save();
  D.beginPath();
  D.arc(0, 0, R, 0, TAU);
  D.clip();
  D.drawImage(A.scl, -R, -R, R * 2, R * 2);
  if (o.bulge > 0) {
    D.fillStyle = `rgba(150,0,10,${o.bulge * .55})`;
    D.fillRect(-R, -R, R * 2, R * 2);
  }
  const m = .7, lx = Math.cos(o.ang) * m, ly = Math.sin(o.ang) * m;
  D.save();
  D.translate(lx * R * .42, ly * R * .42);
  D.rotate(o.ang);
  D.scale(1 - .28 * m, 1);
  D.drawImage(A.iris, -R * .52, -R * .52, R * 1.04, R * 1.04);
  const pr = R * .2 * o.dil;
  D.fillStyle = '#040000';
  D.beginPath();
  D.arc(0, 0, pr, 0, TAU);
  D.fill();
  if (o.ch > 0) {
    // the laser charging behind the cataract: the pupil fills with red, white-hot once the aim locks
    D.globalCompositeOperation = 'lighter';
    const cg = D.createRadialGradient(0, 0, 0, 0, 0, R * .5);
    const col = o.locked ? (o.blinkOn ? '255,235,225' : '255,60,40') : '255,30,20';
    cg.addColorStop(0, `rgba(${col},${.5 + .5 * o.ch})`);
    cg.addColorStop(1, `rgba(${col},0)`);
    D.fillStyle = cg;
    D.fillRect(-R * .5, -R * .5, R, R);
    D.globalCompositeOperation = 'source-over';
  }
  D.globalAlpha = e.al * o.cat;
  D.drawImage(A.cat, -R * .6, -R * .6, R * 1.2, R * 1.2);
  D.globalAlpha = e.al;
  D.restore();
  // mucus film and wet highlights
  D.strokeStyle = 'rgba(230,220,140,.5)';
  D.lineWidth = Math.max(1, R * .05);
  D.beginPath();
  D.moveTo(-R * .9, -R * .1);
  D.quadraticCurveTo(-R * .2, R * .25, R * .7, -R * .3);
  D.moveTo(-R * .6, R * .55);
  D.quadraticCurveTo(0, R * .35, R * .5, R * .7);
  D.stroke();
  D.fillStyle = 'rgba(255,255,250,.6)';
  D.beginPath();
  D.ellipse(-R * .35, -R * .42, R * .2, R * .1, -.6, 0, TAU);
  D.fill();
  D.drawImage(A.shade, -R, -R, R * 2, R * 2);
  if (o.flash) {
    D.fillStyle = 'rgba(255,240,200,.16)';
    D.fillRect(-R, -R, R * 2, R * 2);
  }
  // lids
  const bl = Math.min(1, o.blink);
  if (bl > .02) {
    for (const s of [-1, 1]) {
      const lg = D.createLinearGradient(0, s * R, 0, 0);
      lg.addColorStop(0, '#4a0a10');
      lg.addColorStop(1, '#a8383a');
      D.fillStyle = lg;
      D.beginPath();
      D.ellipse(0, s * R, R * 1.15, R * bl * 1.02, 0, s < 0 ? 0 : Math.PI, s < 0 ? Math.PI : TAU);
      D.fill();
      // raw red rim and yellow crust along the lid edge, bristly lashes
      D.strokeStyle = '#d04040';
      D.lineWidth = Math.max(1, R * .07);
      D.beginPath();
      D.ellipse(0, s * R, R * 1.15, R * bl * 1.02, 0, s < 0 ? 0 : Math.PI, s < 0 ? Math.PI : TAU);
      D.stroke();
      D.fillStyle = '#e6cf6a';
      D.strokeStyle = '#140404';
      D.lineWidth = Math.max(1, R * .03);
      for (let j = -4; j <= 4; j++) {
        const xx = j / 4.6 * R, yy = s * R - s * R * bl * 1.02 * Math.sqrt(Math.max(0, 1 - (xx / (R * 1.15)) ** 2));
        if (j % 2 === 0) { D.beginPath(); D.arc(xx, yy, R * .07, 0, TAU); D.fill(); }
        D.beginPath();
        D.moveTo(xx, yy);
        D.lineTo(xx + R * .05 * j / 4, yy - s * R * .16);
        D.stroke();
      }
    }
    if (bl > .15 && bl < .9) {
      // mucus strings stretching between the lids as it opens
      D.strokeStyle = 'rgba(225,215,120,.75)';
      D.lineWidth = Math.max(1, R * .05);
      for (let j = 0; j < 4; j++) {
        const xx = (-.55 + j * .37) * R, h = R * (1 - bl * 1.02 * Math.sqrt(Math.max(0, 1 - (xx / (R * 1.15)) ** 2)));
        D.beginPath();
        D.moveTo(xx, -h);
        D.quadraticCurveTo(xx + R * .1, 0, xx, h);
        D.stroke();
        D.fillStyle = 'rgba(235,225,140,.85)';
        D.beginPath();
        D.arc(xx + R * .05, R * .1 * (j - 1.5), R * .06, 0, TAU);
        D.fill();
      }
    }
    if (bl > .92) {
      // sewn shut: wire stitches across the seam, crust in the seam
      D.fillStyle = '#e6cf6a';
      D.fillRect(-R * .9, -R * .04, R * 1.8, R * .08);
      D.strokeStyle = '#a8b4c0';
      D.lineWidth = Math.max(1, R * .05);
      D.beginPath();
      for (let j = -2; j <= 2; j++) {
        const xx = j * R * .34;
        D.moveTo(xx - R * .1, -R * .16);
        D.lineTo(xx + R * .1, R * .16);
        D.moveTo(xx + R * .1, -R * .16);
        D.lineTo(xx - R * .1, R * .16);
      }
      D.stroke();
      // the eye rolling underneath the lids
      D.fillStyle = 'rgba(255,190,170,.25)';
      D.beginPath();
      D.ellipse(Math.cos(o.ang) * R * .35, Math.sin(o.ang) * R * .2, R * .45, R * .35, 0, 0, TAU);
      D.fill();
    }
  }
  D.restore();
  D.strokeStyle = 'rgba(30,2,4,.8)';
  D.lineWidth = Math.max(1, R * .07);
  D.beginPath();
  D.arc(0, 0, R, 0, TAU);
  D.stroke();
  // stye on the upper lid and the swollen tear duct, outside the clip so they bulge off the eye
  D.fillStyle = '#b8303a';
  D.beginPath();
  D.arc(R * .35, -R * (1 - bl * .9) - R * .02, R * .26, 0, TAU);
  D.fill();
  D.fillStyle = '#f0dc6a';
  D.beginPath();
  D.arc(R * .35, -R * (1 - bl * .9) - R * .08, R * .17, 0, TAU);
  D.fill();
  D.fillStyle = '#fffbe0';
  D.beginPath();
  D.arc(R * .3, -R * (1 - bl * .9) - R * .14, R * .06, 0, TAU);
  D.fill();
  D.fillStyle = '#d87080';
  D.beginPath();
  D.ellipse(-R * .92, R * .3, R * .22, R * .3, .4, 0, TAU);
  D.fill();
  D.fillStyle = '#e8d462';
  D.beginPath();
  D.arc(-R * .95, R * .5 + (o.t % 40) / 40 * R * .25, R * .12, 0, TAU);
  D.fill();
  D.restore();
}
function eyeLow(b, o) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = '#e2c886';
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b0501a';
  ctx.beginPath();
  ctx.arc(Math.cos(o.ang) * 6, Math.sin(o.ang) * 6, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = o.ch > 0 ? '#ff4030' : 'rgba(230,236,222,.8)';
  ctx.beginPath();
  ctx.arc(Math.cos(o.ang) * 6, Math.sin(o.ang) * 6, 5, 0, TAU);
  ctx.fill();
  if (o.blink > .05) {
    ctx.fillStyle = '#8a2a2a';
    ctx.fillRect(-19, -19, 38, 19 * o.blink);
    ctx.fillRect(-19, 19 - 19 * o.blink, 38, 19 * o.blink);
  }
  ctx.restore();
}
function drawEye(b) {
  if (S.eyeBurst) return;
  const L = b.laser, k = deathK(b);
  const o = {
    ang: Math.atan2($.P.y - b.y, $.P.x - b.x),
    blink: 1 - b.eye,
    dil: L && L.tel > 0 ? .55 : 1.15,
    ch: L && L.tel > 0 ? 1 - L.tel / (L.ml || 60) : L ? 1 : 0,
    locked: L && L.tel <= 20,
    blinkOn: ($.T >> 1) % 2,
    cat: b.phase === 2 ? .7 : .85,
    fire: b.phase === 2,
    bulge: b.dying ? Math.min(1, k / .45) : 0,
    flash: b.fl > 0,
    t: b.t,
  };
  if (b.dying) o.blink = 0;
  if ($.EYE_LOW) return eyeLow(b, o);
  const m = ctx.getTransform();
  EYEQ.push({ x: m.a * b.x + m.c * b.y + m.e, y: m.b * b.x + m.d * b.y + m.f, r: 22, al: ctx.globalAlpha, draw: eyeHi, o });
}
function drawFlies(b, rot) {
  if (!GK) return;
  const n = Math.round((5 + 25 * rot) * GK), t = b ? b.t : S.after.t, bx = b ? b.x : S.bx, by = b ? b.y : S.by;
  ctx.fillStyle = '#0c0a08';
  for (let i = 0; i < Math.min(n, S.flies.length); i++) {
    const f = S.flies[i], x = bx + f.cx + Math.sin(t * f.f1 + f.ph) * f.rx + Math.sin(t * .7 + i) * 1.2, y = by + f.cy + Math.cos(t * f.f2 + f.ph) * f.ry;
    ctx.fillRect(x, y, 1.3, 1);
    if ((t + i) % 3) {
      ctx.fillStyle = 'rgba(220,230,240,.5)';
      ctx.fillRect(x - .5, y - 1, 1, .8);
      ctx.fillRect(x + 1, y - 1, 1, .8);
      ctx.fillStyle = '#0c0a08';
    }
  }
}
const PCOL = [['#060806', '#1a2a10'], ['#d8c868', '#f8eea8'], ['#b8823a', '#e2c060'], null, ['#efe6c8', '#c8b898'], ['#b8968a', '#7a2a30'], ['#7a1a1e', '#d8b080'], ['#f2ead2', '#c8bc98'], ['rgba(230,236,210,.55)', 'rgba(255,255,240,.7)'], ['#a10d14', '#e0242c'], ['#ece2cc', '#b0501a'], ['rgba(200,230,240,.8)', '#ffffff']];
function drawParts() {
  for (const p of P) {
    const a = Math.min(1, p.l / 25);
    if (p.k === 3) {
      ctx.globalAlpha = a * .32 * (p.l / p.ml + .25);
      ctx.fillStyle = p.c < .5 ? '#7a8030' : '#806430';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = a * .16;
      ctx.fillStyle = '#b8b860';
      ctx.beginPath();
      ctx.arc(p.x - p.s * .3, p.y - p.s * .3, p.s * .55, 0, TAU);
      ctx.fill();
      continue;
    }
    ctx.globalAlpha = a;
    const c = PCOL[p.k], s = p.s;
    if (p.k === 4) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r + Math.sin(p.l * .4) * .6);
      ctx.fillStyle = c[0];
      ctx.fillRect(-1.2, -.5, 2.4, 1);
      ctx.restore();
    } else if (p.k === 5 || p.k === 6) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = c[1];
      ctx.fillRect(-s / 2, -s * .3, s, s * .6);
      ctx.fillStyle = c[0];
      ctx.fillRect(-s / 2, -s * .3, s * .8, s * .4);
      ctx.restore();
    } else if (p.k === 10) {
      ctx.fillStyle = c[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = c[1];
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.r) * s * .4, p.y + Math.sin(p.r) * s * .4, s * .45, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.fillRect(p.x + Math.cos(p.r) * s * .45 - .5, p.y + Math.sin(p.r) * s * .45 - .5, 1, 1);
    } else if (p.k === 2 && p.c > .8) {
      ctx.fillStyle = '#f2e04a'; // corn. there is always corn.
      ctx.fillRect(p.x - .7, p.y - .7, 1.4, 1.4);
    } else {
      // drop with a streak along its velocity
      ctx.fillStyle = c[0];
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      const v = Math.hypot(p.vx, p.vy);
      if (v > 1.2 && p.k !== 7 && p.k !== 11) ctx.fillRect(p.x - p.vx * .8 - s / 4, p.y - p.vy * .8 - s / 4, s / 2, s / 2);
      if (s > 1.4) {
        ctx.fillStyle = c[1];
        ctx.fillRect(p.x - s / 2, p.y - s / 2, Math.max(.6, s * .35), Math.max(.6, s * .35));
      }
    }
  }
  ctx.globalAlpha = 1;
}
function drawAfter() {
  const A = S.after, t = A.t, art0 = art();
  // black bile shockwave
  if (t < 46) {
    const f = t / 46, rr2 = 12 + f * 260;
    ctx.globalAlpha = 1 - f;
    for (let j = 0; j < 40; j++) {
      const a = j / 40 * TAU + h2(j, 3) * .2, d = rr2 * (.85 + .25 * h2(j, 7));
      ctx.fillStyle = j % 3 === 0 ? '#e0cc60' : j % 3 === 1 ? '#0a0e08' : '#5a7a20';
      ctx.beginPath();
      ctx.arc(A.x + Math.cos(a) * d, A.y + Math.sin(a) * d, (1 - f) * 8 + 1.5, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    light(A.x, A.y, 160 * (1 - f), 1);
  }
  // the emptied carcass, deflating and sliding out of the chamber
  if (t < 200) {
    const f = t / 200, x = A.x + MX + f * 30, y = A.y + f * f * 160;
    light(x, y, 90, 1 - f);
    ctx.save();
    ctx.globalAlpha = 1 - f * f * f;
    ctx.translate(x, y);
    ctx.scale(.75 - .35 * f + Math.sin(t * .3) * .03 * (1 - f), .45 - .3 * f);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art0.mass, -110, -125, 220, 250);
    ctx.globalAlpha *= .9;
    ctx.drawImage(art0.necro, -110, -125, 220, 250);
    ctx.imageSmoothingEnabled = false;
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // bile slopped across the lens, running down
  for (const d of A.drips) {
    const tt = Math.max(0, t - d.d), len = Math.min(PH, tt * d.sp * 2.4), al = Math.max(0, 1 - Math.max(0, t - 220) / 120);
    if (al <= 0 || tt <= 0) continue;
    ctx.globalAlpha = al * .85;
    ctx.fillStyle = d.c ? '#d8c458' : '#0a0e08';
    ctx.fillRect(d.x - d.w / 2, -2, d.w, len);
    ctx.beginPath();
    ctx.arc(d.x, len, d.w * .75, 0, TAU);
    ctx.fill();
    ctx.fillStyle = d.c ? 'rgba(255,250,200,.6)' : 'rgba(110,150,50,.75)';
    ctx.fillRect(d.x - d.w / 2 + .8, -2, 1.2, len);
  }
  ctx.globalAlpha = 1;
}

/** the whole boss body (everything but the laser and the HP bar). b === null draws the aftermath of a rupture */
export function drawDrive(b) {
  if ($.G && S && S.G !== $.G) { S = null; P.length = 0; }
  if (!b) {
    if (!S) return;
    if (S.b && S.lastDying > 0 && S.lastDying <= 3 && !S.after) rupture();
    S.b = null;
    tick(null);
    if (!S.after) { if (!P.length) S = null; else drawParts(); return; }
    drawAfter();
    drawParts();
    if (S.after.t > 400 && !P.length) S = null;
    return;
  }
  if (!S || S.b !== b) { S = fresh(b); P.length = 0; }
  tick(b);
  const rot = Math.max(rotOf(b), b.dying ? Math.min(1, .55 + deathK(b)) : 0);
  drawArteries(b, rot);
  drawMass(b, rot);
  drawGuts(b);
  ctx.globalCompositeOperation = 'lighter';
  glow(b.x, b.y, 80, b.phase === 2 ? '200,10,20' : '120,10,20', .3 + .15 * S.beat);
  ctx.globalCompositeOperation = 'source-over';
  drawRings(b);
  drawSocket(b, rot);
  drawPlates(b);
  drawJets(b);
  drawEye(b);
  drawParts();
  drawFlies(b, rot);
  if (S.flash > 0) {
    // eye rupture: a sickly yellow-green wash (only with flashes on; S.flash is never set otherwise)
    ctx.fillStyle = `rgba(170,180,60,${.08 * S.flash})`;
    ctx.fillRect(-20, -20, W + 40, PH + 40);
  }
}
/** test hook for tools/drive-shots.mjs */
export const driveState = () => S;
