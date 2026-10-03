// @ts-nocheck
// Entry point. Side-effect imports keep the original top-to-bottom init order.
import '@fontsource/silkscreen/400.css';
import '@fontsource/grenze-gotisch/600.css';
import '@fontsource/grenze-gotisch/900.css';
import './style.css';
import './core';
import './save';
import './audio';
import './input';
import './world';
import './textures';
import './fx/spawn';
import './flow';
import './enemies/spawn';
import './enemies/update';
import './boss/update';
import './mutations';
import './player';
import './shots';
import './fx/update';
import './step';
import './menus';
import './render/util';
import './render/eyes';
import './render/ship';
import './render/enemies';
import './render/boss';
import './render/gore';
import './render/terrain';
import './render/hell';
import './render/hype';
import './render/hud';
import './render/screens';
import { $ } from './state';
import { step } from './step';
import { render } from './render/screens';

// ---------------- loop ----------------
export let acc = 0,
  lastT = performance.now();
export function frame(now) {
  requestAnimationFrame(frame);
  acc += Math.min(100, now - lastT);
  lastT = now;
  let n = 0;
  while (acc >= 1000 / 60 && n < 5) {
    acc -= 1000 / 60;
    step();
    n++;
  }
  if (n) render();
}
export function start(data) {
  if (data && data.meta && data.meta.lv) {
    $.meta = data.meta;
    $.hi = Math.max($.hi, data.hi || 0);
  }
  requestAnimationFrame(frame);
}
import { enemies, gibs, drops, caps } from './world';
// test hook for tools/harness.mjs
(window as any).__G = () => ({ G: $.G, P: $.P, state: $.state, enemies, gibs, drops, caps });
import { BANK } from './audio';
import { musicNow } from './music';
(window as any).__music = musicNow;
(window as any).__sfx = () => Object.fromEntries(Object.entries(BANK).map(([k, v]) => [k, v.length]));

// ---------------- android lifecycle ----------------
import { App } from '@capacitor/app';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { NATIVE } from './platform';
import { save } from './save';
import { PR, fit } from './input';
import { openPause } from './flow';
if (NATIVE) {
  KeepAwake.keepAwake().catch(() => {});
  App.addListener('pause', () => {
    save();
    if ($.state === 'play') openPause();
  });
  // hardware back: pause in play, otherwise acts like Esc (menu back); exits from the title screen
  App.addListener('backButton', () => {
    if ($.state === 'title') App.exitApp();
    else PR.add('Escape');
  });
}
// fold/unfold changes the viewport without always firing a plain resize
window.visualViewport?.addEventListener('resize', fit);
screen.orientation?.addEventListener?.('change', fit);

// canvas text needs the bundled fonts before the first frame
Promise.all(['8px Silkscreen', '28px "Grenze Gotisch"'].map((f) => document.fonts.load(f)))
  .catch(() => {})
  .then(() => {
    fit();
    start({});
    (window as any).__started = true;
  });
