// @ts-nocheck
import { $ } from './state';
import { H, W, crt, cv, psBtn, pwBtn, wrap } from './core';
import { save } from './save';
import { AU, auInit } from './audio';
import { openPause } from './flow';
import { menuPointer } from './menus';
import { TOUCH } from './platform';

// ---------------- input ----------------
export const K = {},
  PR = new Set();
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!K[e.code]) PR.add(e.code);
  K[e.code] = true;
  auInit();
});
addEventListener('keyup', e => {
  K[e.code] = false;
});
addEventListener('pagehide', () => save());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if ($.state === 'play') openPause();
    if (AU.c) AU.c.suspend();
  } else if (AU.c) AU.c.resume();
});
addEventListener('blur', () => {
  for (const k in K) K[k] = false;
  if ($.state === 'play') openPause();
});
export const I = {
  x: 0,
  y: 0,
  fire: false,
  power: false,
  up: false,
  down: false,
  ok: false,
  back: false,
  pause: false
};
export let padPrev = [];
export const touch = {
  id: null,
  lx: 0,
  ly: 0,
  dx: 0,
  dy: 0,
  power: false,
  used: false
};
export function pollInput() {
  let x = (K.ArrowRight || K.KeyD ? 1 : 0) - (K.ArrowLeft || K.KeyA ? 1 : 0),
    y = (K.ArrowDown || K.KeyS ? 1 : 0) - (K.ArrowUp || K.KeyW ? 1 : 0);
  let fire = !!(K.KeyZ || K.Space || K.KeyJ) || touch.used;
  let power = PR.has('KeyX') || PR.has('ShiftLeft') || PR.has('ShiftRight') || PR.has('KeyK') || touch.power;
  let up = PR.has('ArrowUp') || PR.has('KeyW'),
    down = PR.has('ArrowDown') || PR.has('KeyS');
  let ok = PR.has('Enter') || PR.has('Space') || PR.has('KeyZ'),
    back = PR.has('Escape') || PR.has('KeyX') || PR.has('Backspace');
  let pause = PR.has('KeyP') || PR.has('Escape');
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const b = i => !!(p.buttons[i] && p.buttons[i].pressed),
      was = i => !!padPrev[i],
      tap = i => b(i) && !was(i);
    const ax = p.axes[0] || 0,
      ay = p.axes[1] || 0;
    if (Math.abs(ax) > .35) x = Math.sign(ax);
    if (Math.abs(ay) > .35) y = Math.sign(ay);
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    fire = fire || b(0) || b(7) || b(5);
    power = power || tap(1) || tap(2) || tap(4);
    ok = ok || tap(0);
    back = back || tap(1);
    pause = pause || tap(9);
    up = up || tap(12) || ay < -.5 && !padPrev.ay;
    down = down || tap(13) || ay > .5 && !padPrev.ay;
    padPrev = p.buttons.map(q => q.pressed);
    padPrev.ay = Math.abs(ay) > .5;
    break;
  }
  touch.power = false;
  if ($.state !== 'play') {
    touch.dx = touch.dy = 0;
  }
  Object.assign(I, {
    x,
    y,
    fire,
    power,
    up,
    down,
    ok,
    back,
    pause
  });
}
export let SCALE = 1;
addEventListener('touchstart', e => {
  if (e.target instanceof Element && e.target.closest('.tb')) return;
  auInit();
  touch.used = true;
  psBtn.hidden = false;
  for (const t of e.changedTouches) if (touch.id === null) {
    touch.id = t.identifier;
    touch.lx = t.clientX;
    touch.ly = t.clientY;
  }
  if ($.state === 'play') e.preventDefault();
}, {
  passive: false
});
addEventListener('touchmove', e => {
  for (const t of e.changedTouches) if (t.identifier === touch.id) {
    touch.dx += (t.clientX - touch.lx) / SCALE * 1.35;
    touch.dy += (t.clientY - touch.ly) / SCALE * 1.35;
    touch.lx = t.clientX;
    touch.ly = t.clientY;
  }
  e.preventDefault();
}, {
  passive: false
});
export const tend = e => {
  for (const t of e.changedTouches) if (t.identifier === touch.id) touch.id = null;
};
addEventListener('touchend', tend);
addEventListener('touchcancel', tend);
pwBtn.addEventListener('touchstart', e => {
  e.preventDefault();
  touch.power = true;
});
pwBtn.addEventListener('click', () => {
  touch.power = true;
});
psBtn.addEventListener('click', () => {
  if ($.state === 'play') openPause();else if ($.state === 'pause') $.state = 'play';
});
cv.addEventListener('pointerdown', e => {
  auInit();
  cv.focus();
  if ($.state === 'play') return;
  const r = cv.getBoundingClientRect();
  const gx = (e.clientX - r.left) / r.width * W,
    gy = (e.clientY - r.top) / r.height * H;
  menuPointer(gx, gy);
});
export function fit() {
  const pad = TOUCH ? 0 : 32,
    aw = innerWidth - pad,
    ah = innerHeight - pad;
  document.body.classList.toggle('touch', TOUCH);
  document.body.classList.toggle('tall', TOUCH && innerHeight / innerWidth > 0.75);
  let s = Math.min(aw / W, ah / H);
  if (s >= 2) s = Math.floor(s * 4) / 4;
  s = Math.max(.5, s);
  SCALE = s;
  wrap.style.width = W * s + 'px';
  wrap.style.height = H * s + 'px';
  const k = Math.max(2, Math.min(5, Math.ceil(s * (window.devicePixelRatio || 1))));
  if (cv.width !== W * k) {
    $.DK = k;
    cv.width = W * k;
    cv.height = H * k;
  }
  const zone = document.getElementById('zone');
  if (zone) zone.style.top = wrap.getBoundingClientRect().bottom + 'px';
  crt.style.background = `repeating-linear-gradient(to bottom,transparent 0,transparent ${s * .55}px,rgba(0,0,0,.32) ${s * .55}px,rgba(0,0,0,.32) ${s}px)`;
}
addEventListener('resize', fit);
fit();

// ---------------- world state ----------------
