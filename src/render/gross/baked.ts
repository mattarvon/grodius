// @ts-nocheck
// LS2-bossart: the bosses' baked art. tools/bossart/<boss>.py paints every state and writes src/sprites/boss/<k>.png + <k>.json:
// one atlas per boss, frame lists by name, each frame [sx, sy, w, h, ox, oy] with (ox, oy) from the boss origin. The atlases
// are route art: warm() starts the download, drop() frees it. Until the image lands a boss draws a dark mass, never a hitch.
// Render only: nothing here reads the sim RNG. Motion comes from t and hashes; gore goes through the fx stream (srnd).
import { $ } from '../../state';
import { TAU, hash } from '../../core';
import { srr, srnd } from '../../srnd';
import { drop, gib, mist } from '../../fx/spawn';

const URLS = import.meta.glob('../../sprites/boss/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const LAY = import.meta.glob('../../sprites/boss/*.json', { eager: true, import: 'default' }) as Record<string, any>;
const IMG: Record<string, HTMLImageElement | null> = {};
const READY: Record<string, boolean> = {};
const layout = (k) => LAY[`../../sprites/boss/${k}.json`];

/** start loading atlas k (a route's warm-up slice: costs a fetch, no decode on this frame) */
export function bakedWarm(k) {
  if (IMG[k] || typeof Image === 'undefined') return;
  const url = URLS[`../../sprites/boss/${k}.png`];
  if (!url) return;
  const im = new Image();
  // only if this is still the wanted image (a drop while loading must not mark a dead load ready); decode() off the draw so the
  // fight's first frame doesn't pay a multi-MB decode
  const ok = () => { if (IMG[k] === im) READY[k] = true; };
  im.onload = () => { if (im.decode) im.decode().then(ok, ok); else ok(); };
  im.src = url;
  IMG[k] = im;
}
/** requested, for warmup.ts: the warm-up asks once and never spins on a slow decode */
export const bakedBuilt = (k) => !!IMG[k];
/** the image has landed */
export const bakedReady = (k) => !!READY[k];
/** free atlas k; a later draw or warm loads it again */
export function bakedDrop(k) { IMG[k] = null; READY[k] = false; }
/** frame count of list name, 0 if absent */
export function bakedN(k, name) { const L = layout(k); return L && L.f[name] ? L.f[name].length : 0; }

/** draw frame i (wraps) of list name at boss-local (x, y). False until the atlas is ready, and it starts the load */
export function bf(c, k, name, i = 0, x = 0, y = 0) {
  if (!READY[k]) { bakedWarm(k); return false; }
  const rows = layout(k).f[name];
  if (!rows) return false;
  const n = rows.length, r = rows[(((i | 0) % n) + n) % n];
  const sm = c.imageSmoothingEnabled;
  c.imageSmoothingEnabled = false;
  c.drawImage(IMG[k], r[0], r[1], r[2], r[3], x + r[4], y + r[5], r[2], r[3]);
  c.imageSmoothingEnabled = sm;
  return true;
}
/** while the atlas is on its way: an unlit mass, so a hit never lands on nothing */
export function bakedFallback(c, r) {
  c.fillStyle = '#12060a';
  c.beginPath();
  c.ellipse(0, 0, r * 1.2, r * 1.5, 0, 0, TAU);
  c.fill();
}

/** breathing without a sine: ping-pong through n frames at a pace that changes every cycle, with a held beat and an
 *  occasional hitch (D39: alive by holds and hitches). Pure function of t, so no state and no allocation */
export function breath(t, n, period = 96, seed = 1) {
  if (n < 2) return 0;
  const cyc = Math.floor(t / period), f = (t % period) / period;
  const hold = .1 + hash(cyc * 3.1 + seed) * .25; // the beat between breaths, different every cycle
  const u = f < hold ? 0 : (f - hold) / (1 - hold);
  const pp = u < .5 ? u * 2 : (1 - u) * 2, e = pp * pp * (3 - 2 * pp);
  const hitch = hash(cyc * 7.7 + seed) < .2 && u > .3 && u < .42 ? -1 : 0; // now and then it catches on the way up
  return Math.max(0, Math.min(n - 1, Math.round(e * (n - 1)) + hitch));
}
/** a fast irregular flicker through n frames, for a telegraph: never a clean loop */
export function twitch(t, n, rate = 5, seed = 1) {
  return Math.floor(hash(Math.floor(t / rate) * 1.7 + seed) * n);
}
/** how torn the body is: 0 whole, 1 torn, 2 ruined, from the hp fraction */
export const woundStage = (e, a = .66, b = .33) => { const f = e.hp / e.max; return f > a ? 0 : f > b ? 1 : 2; };

// ---------------- death ----------------
// A dead boss leaves `enemies`, so its draw stops. trackDeath is called from its draw; drawBakedDeaths (hud.ts, once per
// render, with the Maw's and the biome bosses' fx) notices the kill and plays the baked `die` list where it fell, while the gore pours.
const TRACK: any[] = [], DYING: any[] = [];
const seen = new WeakSet();
/** cfg: k atlas, list frame list, rate game frames per frame, fall px/frame^2, drift, hold frames on the last frame,
 *  gore(x, y, age, d) called every game frame of the sequence. body false: gore only, len game frames, for a kind whose
 *  split halves carry the art (gore.ts redraws a dead body through its draw: see dieAge) */
export function trackDeath(e, cfg) {
  if (seen.has(e)) return;
  seen.add(e);
  TRACK.push({ e, cfg });
}
let lastT = -1, lastG = null;
export function drawBakedDeaths(c) {
  if ($.G !== lastG) { lastG = $.G; resetBakedDeaths(); } // a new run: a fight left mid-way never sets dead, so forget it here
  const T = $.T || 0, dt = lastT < 0 || T < lastT ? 0 : Math.min(3, T - lastT);
  lastT = T;
  for (let i = TRACK.length - 1; i >= 0; i--) {
    const q = TRACK[i], e = q.e;
    if (!e.dead) continue;
    TRACK.splice(i, 1);
    if (e.hp <= 0 && !e.gone) DYING.push({ cfg: q.cfg, x: e.x, y: e.y, age: 0, vy: 0, last: -1 });
  }
  for (let i = DYING.length - 1; i >= 0; i--) {
    const d = DYING[i], g = d.cfg, n = bakedN(g.k, g.list || 'die'), end = g.body === false ? g.len || 70 : n * (g.rate || 5) + (g.hold || 40);
    for (let s = 0; s < dt; s++) {
      d.age++;
      d.vy += g.fall || 0;
      d.y += d.vy;
      d.x += g.drift || 0;
      if (g.gore) g.gore(d.x, d.y, d.age, d);
    }
    if (d.age >= end) { DYING[i] = DYING[DYING.length - 1]; DYING.pop(); continue; }
    if (g.body === false) continue;
    const a = d.age > end - 24 ? (end - d.age) / 24 : 1;
    c.save();
    c.globalAlpha = a;
    bf(c, g.k, g.list || 'die', Math.min(n - 1, Math.floor(d.age / (g.rate || 5))), d.x, d.y);
    c.restore();
  }
}
const DIED = new WeakMap();
/** game frames since a dead body was first drawn: lets a split corpse's halves play the die list as they tumble */
export function dieAge(e) {
  let t0 = DIED.get(e);
  if (t0 === undefined) DIED.set(e, t0 = $.T || 0);
  return ($.T || 0) - t0;
}
/** forget the sequences (a new run) */
export function resetBakedDeaths() { TRACK.length = 0; DYING.length = 0; lastT = -1; }

/** a body letting go: arterial jets, gut ropes and meat over `len` game frames, on the fx stream. Call from cfg.gore.
 *  o: w, h spread in px; jets per frame while it pumps; meat chunks once; rope count once; col blood palette index for drop */
export function pour(x, y, age, o) {
  const len = o.len || 70, w = o.w || 16, h = o.h || 16, pump = 1 - age / len;
  if (age === 1) {
    for (let k = 0; k < (o.meat ?? 14); k++) gib(x + srr(-w, w), y + srr(-h, h), srr(-3, 3), srr(-4.5, 1), 'chunk', srr(1.8, 4.2));
    for (let k = 0; k < (o.rope ?? 3); k++) gib(x + srr(-w * .5, w * .5), y + srr(-h * .5, h * .5), srr(-2.5, 2.5), srr(-3.5, -.5), 'rope', 3);
    mist(x, y, w * 2.4, 46, 1);
  }
  if (pump > 0) {
    // the heartbeat in it: jets come in pulses that weaken, not a steady hose
    const beat = (age % 14) < 5 ? 1 : .15, n = (o.jets ?? 5) * pump * beat;
    for (let k = 0; k < n; k++) {
      if (srnd() > n / Math.ceil(n)) continue;
      drop(x + srr(-w * .6, w * .6), y + srr(-h * .6, h * .6), srr(-2.8, 2.8) * pump, srr(-3.4, .8), srr(1.2, 2.4), srnd() < .75 ? 1 : 0, 80);
    }
  }
}
