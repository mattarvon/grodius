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
import { setLayout } from './layout';

// ---------------- layout flag (build plan sprint 2 item D) ----------------
// ?layout=long flies the long4 entry (src/layout.ts); the default stays short. It runs at boot, before any newGame():
// setLayout's contract. An unknown or unregistered value falls back to short with a warning, never a crash
/** the layout entry id a ?layout= value selects (null: no flag) */
export const LAYOUT_FLAG = { long: 'long4', long4: 'long4', short: 'short' };
{
  const v = new URLSearchParams(location.search).get('layout');
  if (v != null) {
    try { setLayout(Object.hasOwn(LAYOUT_FLAG, v) ? LAYOUT_FLAG[v] : v); } catch (e) { console.warn(`?layout=${v}: ${e.message}; flying the short layout`); setLayout('short'); }
  }
}

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
    pIn();
    step();
    pOut('step');
    n++;
  }
  if (n) {
    render();
    pFrame();
    autoQuality(now);
  }
}
// auto quality: if frames average slower than ~52 fps over 2 s of play, drop the display canvas one resolution notch
let qN = 0, qSum = 0, qLast = 0, qHold = 0;
function autoQuality(now) {
  const d = now - qLast;
  qLast = now;
  if (document.hidden || d > 100 || $.state !== 'play' || now < 4000 || now < qHold) return;
  qSum += d;
  if (++qN < 120) return;
  if (qSum / qN > 19.2 && lowerDK()) qHold = now + 3000; // let the new size settle before judging again
  qN = qSum = 0;
}
// pre-build the bosses' static art one piece per idle slot after boot, so no fight opens on a build hitch
const WARM = [warmHeroEye, warmEyes, warmMaw, warmMidbosses, warmUfo, warmBiomeBosses, warmDrive];
function warmUp() {
  while (WARM.length && !WARM[0]()) WARM.shift();
  if (WARM.length) (window.requestIdleCallback || ((f) => setTimeout(f, 50)))(warmUp, { timeout: 1000 });
}
export function start(data) {
  setTimeout(warmUp, 1500);
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
import { musicNow, musicPlan } from './music';
(window as any).__music = musicNow;
(window as any).__musicPlan = musicPlan;
import { RST, rigFX, rigged } from './contraptions';
(window as any).__rig = () => ({ ...RST, rigged: rigged(), fx: rigFX() });
(window as any).__mb = () => ($.menuBoxes || []).map(({ x, y, w, h, i, now }) => ({ x, y, w, h, i, now }));
import { AU as __AU } from './audio';
(window as any).__au = () => ({ state: __AU.c && __AU.c.state, last: __AU.lastCat, gate: $.gate });
(window as any).__sfx = () => Object.fromEntries(Object.entries(BANK).map(([k, v]) => [k, v.length]));

// ---------------- android lifecycle ----------------
import { App } from '@capacitor/app';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { NATIVE } from './platform';
import { save } from './save';
import { PR, fit, lowerDK } from './input';
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
import { auInit, audioRunning } from './audio';
import { warmMaw } from './render/gross/maw';
import { warmMidbosses } from './render/gross/midbosses';
import { warmUfo } from './render/gross/ufo';
import { warmBiomeBosses } from './render/gross/biomebosses';
import { warmDrive } from './render/gross/drive';
import { warmEyes } from './render/eyes';
import { warmHeroEye } from './render/heroeye';
import { pFrame, pIn, pOut } from './perf';
auInit();
$.gate = !audioRunning();
if ($.gate) AU_watch();
function AU_watch() {
  // if something else unlocks audio first (e.g. Android allows autoplay), drop the gate
  const iv = setInterval(() => { if (audioRunning() && $.state === 'title') { $.gate = false; clearInterval(iv); } }, 250);
}
Promise.all(['8px Silkscreen', '28px "Grenze Gotisch"'].map((f) => document.fonts.load(f)))
  .catch(() => {})
  .then(() => {
    fit();
    start({});
    (window as any).__started = true;
  });
