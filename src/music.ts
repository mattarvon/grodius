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
  title: 'bleak-terminal-ruskerdax',
  menu: 'tech-rooms-amb-03', // Infirmary + game over
  stage0: 'tech-rooms-action-01', // Open Orbit
  stage1: 'tech-rooms-action-02', // The Hull
  stage2: 'eternity-01-desolation-davidkbd', // The Corridors
  stage3: 'tech-rooms-amb-02', // The Gravity Drive approach
  boss3: 'eternity-01-desolation-davidkbd', // The Gravity Drive fight
};
const FADE = 1.4, PAUSE_LVL = .35, DUCK_LVL = .3;

let bus = null, cur = null, curName = '', duckUntil = 0;
const decks = [];

function ensure() {
  if (bus || !AU.c) return !!bus;
  bus = AU.c.createGain();
  bus.gain.value = 1;
  bus.connect(AU.m);
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
  const st = $.G.stage || 0;
  if ($.G.bossStarted && TRACKS['boss' + st]) return TRACKS['boss' + st];
  return TRACKS['stage' + st] || '';
}

/** call every step: switches tracks, pause level, ducking */
export function musicUpdate() {
  if (!AU.c) return;
  const w = wanted();
  if (w !== curName) play(w);
  if (!bus) return;
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
export const musicNow = () => ({ want: curName, playing: cur ? !cur.el.paused : false, t: cur ? +cur.el.currentTime.toFixed(1) : 0, bus: bus ? +bus.gain.value.toFixed(2) : null });
