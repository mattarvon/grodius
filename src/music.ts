// @ts-nocheck
// Music: one looping track per slot, streamed through <audio> elements into the Web Audio master (so mute and
// the master compressor apply). musicUpdate() runs every step and crossfades when the wanted track changes.
// Files live in src/music/*.ogg (loudness-matched to -16 LUFS); credits in CREDITS.md.
import { $ } from './state';
import { AU } from './audio';
import { SET } from './save';
import { row, slotOf } from './layout';
import { musicIntensity, INTENSITY, RELEASE_TAU, EQ, shelfDb, driveFor, driveMakeup, droneTarget, droneDetune, MUSIC_TONE, toneDrive, toneMakeup } from './audiomix';

const URLS = import.meta.glob('./music/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** key -> file stem in src/music/, stages keyed by stage kind (layout.ts). Change a mapping to retheme a stage. A list is one track per descent
 *  (Descent 1 first); past its end, Descent 2+ cycle through the rest so Descent 1's track stays special.
 *  ov-* tracks are Openverse picks (tools/import_openverse.py), credited in CREDITS.md. */
export const TRACKS = {
  title: 'void-10-title-music',
  menu: ['void-07-heist', 'ov-dx7-chords'], // the Infirmary: alternates per visit
  over: 'ov-horror-ambience', // game over
  fork: 'ov-dark-drone-loop', // the ship splits: the gates hang open
  orbit: ['void-05-cyber-side-scroller', 'ov-circuit-synthwave', 'ov-dreamchip-synthwave', 'ov-synthwave-electropop'], // Open Orbit
  orbitBoss: ['ov-cyberpunk-beat', 'ov-cyberpunk-snippet'], // THE MAW
  biome: ['void-02-institutional-values', 'void-11-corporate-identity'], // fallback only, by biome slot: a biome stage plays its biome's track (BIOME_MIX)
  drive: ['void-12-not-done-here-yet', 'ov-circuit-synthwave-alt', 'ov-space-wind'], // The Gravity Drive approach
  driveBoss: 'void-13-finale', // The Gravity Drive fight
};
const byLoop = (v, L) => !Array.isArray(v) ? v : L < v.length ? v[L] : v[1 + (L - 1) % (v.length - 1)];
let shopVisits = 0, lastState = '';
/** each biome has its own track, coloured by a light filter (optionally LFO-swept) and drive. rate is the interim
 *  tone pass (D39, audiomix.ts MUSIC_TONE.rate): every row, 'none' included, plays the tracks slower and lower */
export const BIOME_MIX = {
  none: { rate: MUSIC_TONE.rate, type: 'lowpass', f: 20000, q: .7, lfo: 0, depth: 0, drive: 0 },
  // ice: a little thinner, the sub frozen out
  ice: { track: 'void-08-caves', rate: MUSIC_TONE.rate, type: 'highpass', f: 110, q: .7, lfo: 0, depth: 0, drive: 0 },
  // acid: a slow, shallow wah with a little grit
  acid: { track: 'void-02-institutional-values', rate: MUSIC_TONE.rate, type: 'bandpass', f: 1600, q: .5, lfo: .2, depth: 500, drive: .2 },
  // fire: bass shelf up and lightly driven
  fire: { track: 'void-11-corporate-identity', rate: MUSIC_TONE.rate, type: 'lowshelf', f: 160, q: .7, gain: 4, lfo: 0, depth: 0, drive: .35 },
  // snot: muffled, a soft lowpass breathing between ~1800 and ~3000Hz
  snot: { track: 'void-09-pods', rate: MUSIC_TONE.rate, type: 'lowpass', f: 2400, q: 1, lfo: .13, depth: 600, drive: .05 },
  // not a biome: while SQUID SAUCER 2000 (Open Orbit midboss) is up, Open Orbit's own track goes wet and wobbly, a slow wah
  ufo: { rate: MUSIC_TONE.rate, type: 'bandpass', f: 1100, q: .6, lfo: .35, depth: 650, drive: .25 },
  // a repeat visit to a biome (G.visitNo, set in biomes.ts choose()): same track, filtered differently so it doesn't replay the last visit
  'ice+': { rate: MUSIC_TONE.rate, type: 'bandpass', f: 1400, q: .45, lfo: .07, depth: 700, drive: .1 }, // a cold wind sweeping through it
  'acid+': { rate: MUSIC_TONE.rate, type: 'lowpass', f: 1300, q: 3, lfo: .3, depth: 600, drive: .3 }, // a gurgling resonant wah
  'fire+': { rate: MUSIC_TONE.rate, type: 'highpass', f: 260, q: 1.1, lfo: 0, depth: 0, drive: .5 }, // the bass burnt out, louder grit
  'snot+': { rate: MUSIC_TONE.rate, type: 'lowpass', f: 900, q: 1.4, lfo: .09, depth: 350, drive: .12 }, // heard through a blocked nose
};
const FADE = 1.4, PAUSE_LVL = .35, DUCK_LVL = .3;
let filt = null, shaper = null, lfo = null, lfoG = null, mixNow = 'none';
// the intensity layer (audiomix.ts): EQ ahead of the clip, a gain after it. lastLvl/lastDrive/lastBedB/lastBedLvl cache what is
// applied, so AudioParams are touched only when the level, mix or biome changes, never per step
let iShelf = null, iPres = null, iGain = null, toneLp = null, lastLvl = 0, lastDrive = '', lastBedB = 'none', lastBedLvl = 0;
// soft clip; drive 0..1 maps to tanh gain 1..6 (k*30 turned a mastered track into a square wave), normalised to unity peak
const mkCurve = (k) => { const n = 2048, c = new Float32Array(n), a = 1 + k * 5; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(a * x) / Math.tanh(a); } return c; };
// curves cached by drive rounded to .01: a level or mix change allocates at most once per value
const CURVES = new Map();
const curve = (k) => { const r = Math.round(k * 100) / 100; let c = CURVES.get(r); if (!c) CURVES.set(r, (c = mkCurve(r))); return c; };
function applyMix(name) {
  if (!filt || mixNow === name) return;
  mixNow = name;
  const m = BIOME_MIX[name] || BIOME_MIX.none, t = AU.c.currentTime;
  filt.type = m.type;
  filt.frequency.setTargetAtTime(m.f, t, .4);
  filt.Q.setTargetAtTime(m.q, t, .4);
  filt.gain.setTargetAtTime(m.gain || 0, t, .4);
  lfo.frequency.setTargetAtTime(m.lfo || .1, t, .2);
  lfoG.gain.setTargetAtTime(m.depth, t, .4);
  applyDrive(name, lastLvl);
  for (const d of decks) { d.el.preservesPitch = false; d.el.playbackRate = m.rate; }
}

/** the soft clip and the intensity EQ/gain for a mix at a level. A curve cannot be ramped, so it swaps here; the swap
 *  lands on a midboss arrival or a kill explosion, which masks it. Calm with drive 0 leaves the curve null, as before */
function applyDrive(name, lvl) {
  if (!shaper) return;
  const m = BIOME_MIX[name] || BIOME_MIX.none, base = toneDrive(m.drive), d = lvl ? driveFor(base, lvl) : base, key = name + '|' + lvl;
  if (key === lastDrive) return;
  const up = lvl > lastLvl, tau = up ? INTENSITY[lvl].tau : RELEASE_TAU, t = AU.c.currentTime, L = INTENSITY[lvl];
  lastDrive = key;
  // the curve swaps at once, so its makeup swaps at once too (no dip or jump at the kill); only gainDb ramps
  const mk = driveMakeup(base, lvl) * toneMakeup(m.drive), was = Math.pow(10, INTENSITY[lastLvl].gainDb / 20);
  shaper.curve = d ? curve(d) : null;
  iShelf.gain.setTargetAtTime(shelfDb(m, lvl), t, tau);
  iPres.gain.setTargetAtTime(L.pres, t, tau);
  iGain.gain.cancelScheduledValues(t);
  iGain.gain.setValueAtTime(mk * was, t);
  iGain.gain.setTargetAtTime(mk * Math.pow(10, L.gainDb / 20), t, tau);
}

/** the drone bed (audio.ts) follows the biome and the level even with the music off. fx/update.ts owns AU.lp.frequency,
 *  so the bed moves its detune (a multiplier on that frequency), its Q and the bed gain AU.dg */
function applyBed(b, lvl, prev) {
  if (!AU.lp || !AU.dg) return;
  const bk = b || 'none';
  if (bk === lastBedB && lvl === lastBedLvl) return;
  lastBedB = bk;
  lastBedLvl = lvl;
  const t = AU.c.currentTime, tau = lvl > prev ? INTENSITY[lvl].tau : RELEASE_TAU, d = droneTarget(b, lvl);
  AU.lp.detune.setTargetAtTime(droneDetune(b, lvl), t, tau);
  AU.lp.Q.setTargetAtTime(d.q, t, tau);
  AU.dg.gain.setTargetAtTime(d.gain, t, tau);
}

let bus = null, cur = null, curName = '', duckUntil = 0;
const decks = [];

function ensure() {
  if (bus || !AU.c) return !!bus;
  bus = AU.c.createGain();
  bus.gain.value = 1;
  filt = AU.c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 20000;
  shaper = AU.c.createWaveShaper();
  shaper.oversample = '2x';
  // intensity EQ, 0 dB (transparent) at calm
  iShelf = AU.c.createBiquadFilter();
  iShelf.type = 'lowshelf';
  iShelf.frequency.value = EQ.shelfF;
  iShelf.gain.value = 0;
  iPres = AU.c.createBiquadFilter();
  iPres.type = 'peaking';
  iPres.frequency.value = EQ.presF;
  iPres.Q.value = EQ.presQ;
  iPres.gain.value = 0;
  iGain = AU.c.createGain();
  iGain.gain.value = 1;
  // the interim tone lowpass on the whole bus (audiomix.ts MUSIC_TONE): fixed, after the intensity layer
  toneLp = AU.c.createBiquadFilter();
  toneLp.type = 'lowpass';
  toneLp.frequency.value = MUSIC_TONE.lpF;
  toneLp.Q.value = MUSIC_TONE.lpQ;
  lfo = AU.c.createOscillator();
  lfoG = AU.c.createGain();
  lfoG.gain.value = 0;
  lfo.connect(lfoG);
  lfoG.connect(filt.frequency);
  lfo.start();
  bus.connect(filt);
  filt.connect(iShelf);
  iShelf.connect(iPres);
  iPres.connect(shaper);
  shaper.connect(iGain);
  iGain.connect(toneLp);
  toneLp.connect(AU.m);
  for (let i = 0; i < 2; i++) {
    const el = new Audio();
    el.loop = true;
    el.preload = 'auto';
    const g = AU.c.createGain();
    g.gain.value = 0;
    AU.c.createMediaElementSource(el).connect(g);
    g.connect(bus);
    decks.push({ el, g, name: '' });
  }
  applyDrive(mixNow, lastLvl); // the interim tone drive applies from the first track, before any mix change
  return true;
}

function play(name) {
  curName = name;
  if (!ensure()) return;
  const t = AU.c.currentTime, url = URLS[`./music/${name}.ogg`];
  const next = decks.find((d) => d !== cur) || decks[0];
  if (cur) {
    const old = cur;
    old.g.gain.cancelScheduledValues(t);
    old.g.gain.setValueAtTime(old.g.gain.value, t);
    old.g.gain.linearRampToValueAtTime(0, t + FADE);
    setTimeout(() => old !== cur && old.el.pause(), FADE * 1000 + 100);
  }
  cur = next;
  if (!url) return; // empty slot: fade out to silence
  if (next.name !== name) {
    next.el.src = url;
    next.name = name;
  }
  next.el.currentTime = 0;
  next.el.play().catch(() => {});
  next.g.gain.cancelScheduledValues(t);
  next.g.gain.setValueAtTime(0, t);
  next.g.gain.linearRampToValueAtTime(1, t + FADE);
}

function wanted() {
  if (SET.music === false) return '';
  const s = $.state;
  if (s === 'shop' && lastState !== 'shop') shopVisits++;
  lastState = s;
  if (s === 'title') return TRACKS.title;
  if (s === 'shop') return byLoop(TRACKS.menu, (shopVisits - 1) % TRACKS.menu.length);
  if (s === 'over') return TRACKS.over;
  if (!$.G) return '';
  if ($.G.fork) return TRACKS.fork;
  const r = row($.G.stage || 0), L = $.G.loop || 0, b = curBiome();
  if (b) return BIOME_MIX[b].track;
  if (!r) return '';
  if ($.G.bossStarted && TRACKS[r.kind + 'Boss']) return byLoop(TRACKS[r.kind + 'Boss'], L);
  // the Maw is a mini, not startBoss(): its track runs from its arrival through the stage card, up to the fork
  if (r.kind === 'orbit' && (($.G.mini && $.G.mini.stageBoss) || $.G.tally)) return byLoop(TRACKS.orbitBoss, L);
  return (r.kind === 'biome' ? TRACKS.biome[r.slot] : byLoop(TRACKS[r.kind], L)) || '';
}

/** the filter mix the music wants now: the biome's (a repeat visit gets its '+' mix), the Saucer's, or none */
function mixWanted() {
  const cb = curBiome(), deep = cb && $.G.visitNo && $.G.visitNo[slotOf($.G.stage)] ? cb + '+' : cb;
  return ($.state === 'play' || $.state === 'pause') && (deep || ufoMix()) || 'none';
}
/** test hook (tools/layout-parity.mjs): what the music wants, readable with audio off. wanted() counts Infirmary
 *  visits on entering the shop, so calling this while musicUpdate also runs could advance that count */
export const musicPlan = () => ({ want: wanted(), mix: $.G ? mixWanted() : 'none' });

/** call every step: switches tracks, pause level, ducking */
export function musicUpdate() {
  if (!AU.c) return;
  const w = wanted();
  if (w !== curName) play(w);
  const b = curBiome(), il = musicIntensity($.G, b, $.state), prev = lastLvl;
  applyBed(b, il, prev); // before the bus check: the bed escalates with the music off too
  if (!bus) { lastLvl = il; return; }
  applyMix(mixWanted());
  if (il !== lastLvl) applyDrive(mixNow, il);
  lastLvl = il;
  if (cur && cur.el.playbackRate !== (BIOME_MIX[mixNow] || BIOME_MIX.none).rate) cur.el.playbackRate = (BIOME_MIX[mixNow] || BIOME_MIX.none).rate;
  // a play() refused before the first click/key gets retried once audio is unlocked
  if (cur && cur.name && cur.el.paused && AU.c.state === 'running' && !document.hidden && $.T % 30 === 0) cur.el.play().catch(() => {});
  const lvl = ($.state === 'pause' ? PAUSE_LVL : 1) * (AU.c.currentTime < duckUntil ? DUCK_LVL : 1);
  if (Math.abs(bus.gain.value - lvl) > .01) bus.gain.setTargetAtTime(lvl, AU.c.currentTime, .12);
}

/** drop the music under a voice line for `secs` */
export function duckMusic(secs) {
  if (AU.c) duckUntil = Math.max(duckUntil, AU.c.currentTime + secs);
}

/** app backgrounded / foregrounded */
export function musicSuspend(hidden) {
  if (!cur) return;
  if (hidden) cur.el.pause();
  else if (curName) cur.el.play().catch(() => {});
}

/** test hook */
export const musicNow = () => ({ mix: mixNow, want: curName, playing: cur ? !cur.el.paused : false, t: cur ? +cur.el.currentTime.toFixed(1) : 0, bus: bus ? +bus.gain.value.toFixed(2) : null, inten: lastLvl });

/** the Open Orbit midboss keeps the stage's track (it's a drive-by, not a boss track) but filters it while it's up */
const ufoMix = () => ($.G && $.G.mini && $.G.mini.k === 'ufo' && !$.G.mini.dead && !$.G.mini.gone ? 'ufo' : null);

/** biome the music should be in: the stage's chosen route once that stage has started */
export function curBiome() {
  const G = $.G;
  const s = G && G.route ? slotOf(G.stage) : -1;
  return s >= 0 ? G.route[s] || null : null;
}
