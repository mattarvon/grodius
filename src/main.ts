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
import { applyRunLayout } from './lab';
import { lastRun, readRun, rewriteRun, runInfo, sealRun } from './runsave';
import { jumpBoot } from './jump';
import { jumpRun } from './flow';

// ---------------- layout flag (build plan sprint 2 items D, D2) ----------------
// ?layout=long flies the long4 entry (src/layout.ts); the default is long4 (D24). The parse is lab.ts layoutChoice
// (URL > LAB > DEFAULT_LAYOUT), applied here at boot, before any newGame() (setLayout's contract), and again at each run start.
// An unknown or unregistered value is ignored with a warning (the LAB or short applies), never a crash
{
  const c = applyRunLayout(true);
  if (c.bad != null) console.warn(`?layout=${c.bad}: unknown layout; flying ${c.id}`);
}
// the jump switch (build plan LS1 row I, src/jump.ts): dev server only, so a deployed page ignores ?stage=. Parsed
// here, after the layout flag and before the run save is read: a valid jump seals the slot first. Started below
const jump = import.meta.env.DEV ? jumpBoot(location.search) : null;
// the run save (item H): read once at boot, validated under its own layout (the active one is left as chosen above);
// the title offers RESUME from the in-memory copy
readRun();

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
export function start(data) {
  startWarm(); // pre-build the art per route, one piece per idle slot, so no fight opens on a build hitch (render/warmup.ts)
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
(window as any).__cp = () => ({ last: lastRun(), info: runInfo(), want: $.G && $.G.cpWant, cp1X: $.G && $.G.cp1X, cpX: $.G && $.G.cpX, cpN: $.G && $.G.cpN }); // tools/resume-check.mjs
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
    rewriteRun(); // the LAST CHECKPOINT again, never live state (spec §4)
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
import { startWarm, warmLog } from './render/warmup';
(window as any).__warm = () => warmLog; // tools/perf-probe.mjs
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
    if (jump && !jumpRun(jump)) sealRun(false); // a jump that didn't start is a normal boot, with a normal slot
    (window as any).__started = true;
  });
