// @ts-nocheck
import { $ } from './state';

// =====================================================================
//  GRODIUS  -  side-scrolling shooter. Derelict MERIDIAN, Neptune orbit.
// =====================================================================
export const W = 480,
  H = 270,
  PH = 254,
  TS = 4,
  LEVEL = 9400,
  BOSS_AT = 8700;
export const cv = document.getElementById('c'),
  dctx = cv.getContext('2d'),
  lo = document.createElement('canvas');
lo.width = W;
lo.height = H;
export const ctx = lo.getContext('2d');
$.DK = 2;
export const wrap = document.getElementById('wrap'),
  crt = document.getElementById('crt');
export const pwBtn = document.getElementById('pw'),
  psBtn = document.getElementById('ps');
ctx.imageSmoothingEnabled = false;
export const lc = document.createElement('canvas');
lc.width = W;
lc.height = H;
export const lctx = lc.getContext('2d');
export const hc = document.createElement('canvas');
hc.width = W;
hc.height = H;
export const hx = hc.getContext('2d');
export const R = Math.random,
  TAU = Math.PI * 2;
export const rr = (a, b) => a + R() * (b - a),
  ri = (a, b) => Math.floor(rr(a, b + 1));
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v,
  lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  x = clamp((x - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
export const hash = n => {
  n = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
export const vnoise = x => {
  const i = Math.floor(x),
    f = x - i,
    u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u);
};
export const pick = a => a[Math.floor(R() * a.length)];
export const dist2 = (a, b, c, d) => (a - c) * (a - c) + (b - d) * (b - d);
export function swapRm(a, i) {
  a[i] = a[a.length - 1];
  a.pop();
}
export const C = {
  blood: '#a10d14',
  bloodD: '#4e0307',
  bloodL: '#e0242c',
  flesh: '#b5604f',
  fleshD: '#6e2b26',
  fleshL: '#de8d76',
  fat: '#e3c48f',
  bone: '#e8e0cc',
  steel: '#8fa3b8',
  suit: '#3a4757',
  skin: '#c9bcae'
};
export const DC = ['#a10d14', '#5a050a', '#e3202a', '#0c0809', '#b8a35a', '#ff7a1a'];
export const FIRE = ['#ffb347', '#ff6a1a', '#ffe2a0', '#ff3a10', '#fff1c0'];
export const FONT_H = 'Silkscreen, "Courier New", monospace',
  FONT_D = '"Grenze Gotisch", Georgia, serif';

// ---------------- persistence ----------------
