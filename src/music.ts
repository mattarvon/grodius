// @ts-nocheck
// Music: one looping track per slot, streamed through <audio> elements into the Web Audio master (so mute and
// the master compressor apply). musicUpdate() runs every step and crossfades when the wanted track changes.
// Files live in src/music/*.ogg (loudness-matched to -16 LUFS); credits in CREDITS.md.
import { $ } from './state';
import { AU } from './audio';
import { SET } from './save';

const URLS = import.meta.glob('./music/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** slot -> file stem in src/music/. Change a mapping to retheme a stage. */
export const TRACKS = {
  title: 'void-10-title-music',
  menu: 'void-07-heist', // Infirmary + game over
  stage0: 'void-05-cyber-side-scroller', // Open Orbit
  stage1: 'void-02-institutional-values', // fallback only: stages 1-2 play their biome's track (BIOME_MIX)
  stage2: 'void-11-corporate-identity',
  stage3: 'void-12-not-done-here-yet', // The Gravity Drive approach
  boss3: 'void-13-finale', // The Gravity Drive fight
};
/** each biome has its own track, coloured by a light filter (optionally LFO-swept) and drive. rate stays 1: these
 *  are distinct songs now, so there's no reuse to disguise by pitching them */
export const BIOME_MIX = {
  none: { rate: 1, type: 'lowpass', f: 20000, q: .7, lfo: 0, depth: 0, drive: 0 },
  // ice: a little thinner, the sub frozen out
  ice: { track: 'void-08-caves', rate: 1, type: 'highpass', f: 110, q: .7, lfo: 0, depth: 0, drive: 0 },
  // acid: a slow, shallow wah with a little grit
  acid: { track: 'void-02-institutional-values', rate: 1, type: 'bandpass', f: 1600, q: .5, lfo: .2, depth: 500, drive: .2 },
  // fire: bass shelf up and lightly driven
  fire: { track: 'void-11-corporate-identity', rate: 1, type: 'lowshelf', f: 160, q: .7, gain: 4, lfo: 0, depth: 0, drive: .35 },
  // snot: muffled, a soft lowpass breathing between ~1800 and ~3000Hz
  snot: { track: 'void-09-pods', rate: 1, type: 'lowpass', f: 2400, q: 1, lfo: .13, depth: 600, drive: .05 },
};
const FADE = 1.4, PAUSE_LVL = .35, DUCK_LVL = .3;
let filt = null, shaper = null, lfo = null, lfoG = null, mixNow = 'none';
// soft clip; drive 0..1 maps to tanh gain 1..6 (k*30 turned a mastered track into a square wave), normalised to unity peak
const curve = (k) => { const n = 2048, c = new Float32Array(n), a = 1 + k * 5; for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(a * x) / Math.tanh(a); } return c; };
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
  shaper.curve = m.drive ? curve(m.drive) : null;
  for (const d of decks) { d.el.preservesPitch = false; d.el.playbackRate = m.rate; }
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
  lfo = AU.c.createOscillator();
  lfoG = AU.c.createGain();
  lfoG.gain.value = 0;
  lfo.connect(lfoG);
  lfoG.connect(filt.frequency);
  lfo.start();
  bus.connect(filt);
  filt.connect(shaper);
  shaper.connect(AU.m);
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
  if (s === 'title') return TRACKS.title;
  if (s === 'shop' || s === 'over') return TRACKS.menu;
  if (!$.G) return '';
  const st = $.G.stage || 0, b = curBiome();
  if (b) return BIOME_MIX[b].track;
  if ($.G.bossStarted && TRACKS['boss' + st]) return TRACKS['boss' + st];
  return TRACKS['stage' + st] || '';
}

/** call every step: switches tracks, pause level, ducking */
export function musicUpdate() {
  if (!AU.c) return;
  const w = wanted();
  if (w !== curName) play(w);
  if (!bus) return;
  applyMix(($.state === 'play' || $.state === 'pause') && curBiome() || 'none');
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
export const musicNow = () => ({ mix: mixNow, want: curName, playing: cur ? !cur.el.paused : false, t: cur ? +cur.el.currentTime.toFixed(1) : 0, bus: bus ? +bus.gain.value.toFixed(2) : null });

/** biome the music should be in: the stage's chosen route once that stage has started */
function curBiome() {
  const G = $.G;
  if (!G || !G.route || !(G.stage === 1 || G.stage === 2)) return null;
  return G.route[G.stage - 1] || null;
}
