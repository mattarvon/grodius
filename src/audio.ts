// @ts-nocheck
import { SET } from './save';
import { duckMusic, curBiome } from './music';
import { BIOME_KILL, KILL_LAYER } from './audiomix';
import { QUIPS } from './voice/quips';
import { QUIP, normText, pickQuip, quipCat, quipLines, type QuipBag } from './voice/quiplist';

// ---------------- audio ----------------
export const AU = {
  c: null,
  last: {}
};
export const audioRunning = () => !!AU.c && AU.c.state === 'running';
export function auInit() {
  if (AU.c) {
    if (AU.c.state === 'suspended') AU.c.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const A = new AC();
  AU.c = A;
  const comp = A.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.connect(A.destination);
  AU.m = A.createGain();
  AU.m.gain.value = SET.muted ? 0 : .55;
  AU.m.connect(comp);
  loadBank(A);
  const len = A.sampleRate * 2,
    b = A.createBuffer(1, len, A.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = ar() * 2 - 1;
  AU.noise = b;
  const il = A.sampleRate * 2.6 | 0,
    ib = A.createBuffer(2, il, A.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ib.getChannelData(c);
    for (let i = 0; i < il; i++) ch[i] = (ar() * 2 - 1) * Math.pow(1 - i / il, 3.2);
  }
  AU.verb = A.createConvolver();
  AU.verb.buffer = ib;
  const vg = A.createGain();
  vg.gain.value = .4;
  AU.verb.connect(vg);
  vg.connect(AU.m);
  // drone bed
  const g = A.createGain();
  g.gain.value = 0;
  g.gain.linearRampToValueAtTime(.12, A.currentTime + 4);
  const lp = A.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 160;
  lp.Q.value = 5;
  [41.2, 41.75, 82.1, 61.9].forEach((f, i) => {
    const o = A.createOscillator();
    o.type = i === 3 ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    const og = A.createGain();
    og.gain.value = i === 3 ? .4 : 1;
    o.connect(og);
    og.connect(lp);
    o.start();
  });
  const lfo = A.createOscillator();
  lfo.frequency.value = .06;
  const lg = A.createGain();
  lg.gain.value = 70;
  lfo.connect(lg);
  lg.connect(lp.frequency);
  lfo.start();
  const ns = A.createBufferSource();
  ns.buffer = AU.noise;
  ns.loop = true;
  const nf = A.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 80;
  const ng = A.createGain();
  ng.gain.value = .35;
  ns.connect(nf);
  nf.connect(ng);
  ng.connect(g);
  ns.start();
  lp.connect(g);
  g.connect(AU.m);
  AU.lp = lp;
  AU.dg = g; // the bed's gain: music.ts raises it with the intensity level (audiomix.ts droneTarget)
}
// ---------------- sample bank ----------------
// Every audio file under src/sfx/<category>/ is bundled and decoded on first input. Categories:
// splat_s splat_m splat_l thud bone explode_s explode_l (silly is shelved, src/sfx-shelved/README.md), plus monster (under roar), snot (Sinus kills),
// warning (sirens under WARNING banners), stinger (midboss warning), forkopen (gates open) and the voice lines.
// Drop more files in a folder and they join the rotation. ov-* clips are cut from Openverse picks by
// tools/import_openverse.py.
const SFX_URLS = import.meta.glob('./sfx/*/*.{ogg,wav,mp3,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const BANK: Record<string, AudioBuffer[]> = {};
const LASTS: Record<string, number> = {};
// audio has its own RNG so sound choices never perturb gameplay randomness; seeded per boot so every session
// doesn't open with the same run of clips
let arng = ((globalThis.crypto?.getRandomValues?.(new Uint32Array(1))[0] ?? Date.now()) | 1) >>> 0;
const ar = () => ((arng ^= arng << 13), (arng ^= arng >>> 17), (arng ^= arng << 5), (arng >>> 0) / 4294967296);
// audio never draws the sim R() (M2 #13): sfx args are evaluated even when no context runs (the harness, a muted or
// autoplay-blocked device), so an R() there made the sim depend on how many gibs hit the floor and on the sample rate
const arr = (a, b) => a + ar() * (b - a);
// The voice cap (was `voices > 14`: 15 sound at once). A wall of 30 splats in one frame is mud anyway, so ordinary sounds
// past it are dropped. LIVE is oldest-first so a priority cue can take the oldest ordinary voice's slot.
export const VOICE_CAP = 15;
/** seconds of air between a voice line and the one queued behind it */
export const VOICE_GAP = .25;
// AU.c is created once. If the context is ever recreated, clear LIVE with it: a dead context's sources never fire onended
const LIVE: { s: any; g: any; prio: boolean; cat: string; t0: number }[] = [];
// voice lines: they duck the music and set AU.voice/SOLO, so evicting one would cut it mid-word and leave those pointing
// at a dead take. Eviction skips them (sound-designer review)
// (kill-<k>: a midboss's kill word; carn5: OPENED, the 5-chain; quip-<id>: Matt's one-liners after a big kill,
// LS2-quips. All SGT. RAMROD SLAB's)
const VOICE_CAT = /^(hype|bossreward|corpsevoice|startgame|kill-|carn5|quip-)/;
function loadBank(A) {
  for (const [p, u] of Object.entries(SFX_URLS)) {
    const cat = p.split('/')[2];
    fetch(u).then((r) => r.arrayBuffer()).then((b) => A.decodeAudioData(b)).then((buf) => (BANK[cat] ||= []).push(Object.assign(buf, { clip: p.split('/')[3].replace(/\.\w+$/, '') }))).catch(() => {});
  }
}
// shuffle bag per category: every clip plays once before any repeats, and a new bag never opens with the clip
// that just played. Rebuilt when the bank grows (clips decode asynchronously after boot).
const BAGS: Record<string, { n: number; q: number[] }> = {};
function nextClip(cat, n) {
  let b = BAGS[cat];
  if (!b || b.n !== n || !b.q.length) {
    const q = [...Array(n).keys()];
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(ar() * (k + 1)); [q[k], q[j]] = [q[j], q[k]]; }
    if (n > 1 && q[n - 1] === LASTS[cat]) [q[0], q[n - 1]] = [q[n - 1], q[0]];
    b = BAGS[cat] = { n, q };
  }
  return (LASTS[cat] = b.q.pop());
}
/** play a random clip from a category with pitch/volume jitter. false if the category isn't loaded (caller falls back to
 *  synth), or if it was dropped at the voice cap and the call set `fb`. `prio`: never dropped (see the cap below) */
const SOLO: Record<string, number> = {};
export function sample(cat, o: { vol?: number; rate?: number; spread?: number; wet?: number; at?: number; solo?: boolean; prio?: boolean; fb?: boolean; queue?: boolean } = {}) {
  const L = BANK[cat];
  if (!AU.c || !L || !L.length || SET.muted || AU.c.state !== 'running') return false;
  // one caller on the comms at a time (LS2-slab): a voice line that lands while another still talks waits for it on
  // the audio clock, a beat after it ends; `queue: false` (OPENED, the 5-chain: common and minor) is skipped instead
  const voice = VOICE_CAT.test(cat);
  let at = o.at ?? 0;
  // any other voice line beats a quip that has not started yet: feedback (a chain line, a kill word) before flavour
  // (LS2-quips, audio-director)
  if (voice && !cat.startsWith('quip-')) dropQueuedQuips();
  if (voice) {
    const v = AU.voice, now = AU.c.currentTime;
    if (v && v.t1 + VOICE_GAP > now + at) {
      if (o.queue === false) return false;
      at = v.t1 - now + VOICE_GAP;
    }
  }
  if (o.solo && AU.c && AU.c.currentTime < (SOLO[cat] || 0)) return true; // previous take still talking
  // LS1 audit #5/#6: a drop used to return true, so siren()'s alarm() fallback never ran, and the Maw could die silent
  // (its death frame is the busiest gore frame). A priority cue (Maw and Drive deaths, WARNING siren, stinger, forkopen) is never
  // dropped: it takes the oldest ordinary voice's slot, faded over ~20 ms so it doesn't click. If every live voice is a
  // priority cue or a voice line it plays over the cap (there are only a handful). An ordinary sound is still swallowed, and reports
  // false only when the caller marked a fallback (`fb`): gore's synth fallback would only add mud to a full frame
  // (producer ruling, option b)
  // a voice line passes the cap like a priority cue: a midboss's kill word fires on its death frame, the busiest gore
  // frame there is, and a swallowed line would lose its comms window with it (LS2-slab, qa-tester and web-specialist)
  if (LIVE.length >= VOICE_CAP) {
    if (!o.prio && !voice) return !o.fb;
    const k = LIVE.findIndex((v) => !v.prio && !VOICE_CAT.test(v.cat)); // none left (all priority or voice): play over the cap
    if (k >= 0) {
      const v = LIVE.splice(k, 1)[0], t = AU.c.currentTime;
      v.s.onended = null;
      v.g.gain.setTargetAtTime(0, t, .007);
      v.s.stop(t + .03);
    }
  }
  const i = nextClip(cat, L.length);
  const s = AU.c.createBufferSource(), g = AU.c.createGain();
  s.buffer = L[i];
  s.playbackRate.value = (o.rate ?? 1) * (1 + (ar() * 2 - 1) * (o.spread ?? .14));
  // a voice line's level jitters less (.95-1.05): the booth already matched every take to -12 LUFS, and a line coming in
  // 2 dB quiet reads as a different mic (audio-director, LS2 review). Still one ar() draw either way
  g.gain.value = (o.vol ?? 1) * (voice ? .95 + ar() * .1 : .8 + ar() * .3);
  s.connect(g);
  route(g, o.wet ?? .2);
  const v = { s, g, prio: !!o.prio, cat, t0: AU.c.currentTime + at };
  LIVE.push(v);
  AU.lastCat = cat; // test hook
  s.onended = () => { const k = LIVE.indexOf(v); if (k >= 0) LIVE.splice(k, 1); };
  s.start(AU.c.currentTime + at);
  if (o.solo) SOLO[cat] = AU.c.currentTime + at + L[i].duration / s.playbackRate.value;
  if (VOICE_CAT.test(cat)) duckMusic(at + L[i].duration + .3), voiceOn(cat, L[i], s.playbackRate.value, at);
  return true;
}
/** the quips' shuffle bag (quiplist.ts pickQuip): kept across runs, so the lines go round rather than restart */
const QBAG: QuipBag = { q: [], last: null };
/** after a big kill (a midboss's kill word, a stage boss's TAKEN DOWN), maybe one of SLAB's quips
 *  (src/voice/quips.json, LS2-quips): QUIP.chance of one, from the shuffle bag of quips with a take in the bank,
 *  never one whose words are the kill word just said. It queues behind that line on the audio clock (sample()), so
 *  game over drops it and a new game cuts it like any voice line (D50), and any other voice line called before it
 *  starts takes its place (dropQueuedQuips). Skipped, with no roll drawn, when the comms is busy with anything but the
 *  line it follows, or when it could not start within QUIP.maxLate of the kill (audio-director: flavour never lands in
 *  the next fight). Audio only: the roll and the pick draw ar(), never R(); with no running context (the harness,
 *  muted) nothing is drawn at all. `force` skips the roll and the busy rules (the ?vox=quip test hook). Returns the
 *  quip id played, or null */
export function quipAfterKill(word = '', at = 0, force = false): string | null {
  if (!AU.c || SET.muted || AU.c.state !== 'running') return null;
  const now = AU.c.currentTime;
  if (!force) {
    // the lines still talking or waiting: at most the one this quip follows (a kill word, TAKEN DOWN)
    const live = (AU.voiceQ || []).filter((v) => v.t1 + VOICE_GAP > now);
    if (live.length > 1 || (live.length === 1 && !/^(kill-|bossreward$)/.test(live[0].cat))) return null;
    const v = AU.voice, start = v && v.t1 + VOICE_GAP > now + at ? v.t1 - now + VOICE_GAP : at;
    if (start > QUIP.maxLate) return null;
  }
  const said = normText(word), ready: string[] = [], avoid: string[] = [];
  for (const q of QUIPS) {
    if (!BANK[quipCat(q.id)]?.length) continue;
    ready.push(q.id);
    if (said && quipLines(q.text).join(' ') === said) avoid.push(q.id);
  }
  const id = pickQuip(ready, QBAG, ar, force ? 1 : undefined, avoid);
  if (id == null || !sample(quipCat(id), { vol: 1.15, spread: .02, wet: .16, at })) return null;
  return id;
}
/** a quip queued behind another line and not started yet is dropped: the voice line now being called goes first
 *  (audio only; a quip already talking finishes) */
function dropQueuedQuips() {
  if (!AU.c || !AU.voiceQ?.length) return;
  const now = AU.c.currentTime;
  if (!AU.voiceQ.some((v) => v.cat.startsWith('quip-') && v.t0 > now)) return;
  for (let k = LIVE.length - 1; k >= 0; k--) {
    const v = LIVE[k];
    if (!v.cat.startsWith('quip-') || v.t0 <= now) continue;
    v.s.onended = null;
    v.s.stop(); // a source stopped before its start time never plays
    LIVE.splice(k, 1);
  }
  AU.voiceQ = AU.voiceQ.filter((v) => !(v.cat.startsWith('quip-') && v.t0 > now));
  AU.voice = AU.voiceQ[AU.voiceQ.length - 1] || null;
}
/** the voice line now talking: render/hype.ts puts a comms-window face to it (clip = file stem, t0/t1 = AU.c clock) */
export function voiceOn(cat, buf, rate = 1, at = 0) {
  const now = AU.c ? AU.c.currentTime : 0, t0 = now + at;
  AU.voice = { cat, clip: buf.clip || cat, t0, t1: t0 + buf.duration / rate };
  // every line still talking or waiting its turn, in order: the comms window shows the one talking now (AU.voice is
  // the last one scheduled, which the queue in sample() waits behind)
  AU.voiceQ = (AU.voiceQ || []).filter((v) => v.t1 + VOICE_GAP > now).concat(AU.voice);
}
/** game over: every voice line queued but not yet started is dropped; the one already talking finishes (audio only) */
export function voiceDropQueued() {
  if (!AU.c) return;
  const now = AU.c.currentTime;
  for (let k = LIVE.length - 1; k >= 0; k--) {
    const v = LIVE[k];
    if (!VOICE_CAT.test(v.cat) || v.t0 <= now) continue;
    v.s.onended = null;
    v.s.stop(); // a source stopped before its start time never plays
    LIVE.splice(k, 1);
  }
  AU.voiceQ = (AU.voiceQ || []).filter((v) => v.t0 <= now);
  AU.voice = AU.voiceQ[AU.voiceQ.length - 1] || null;
}
/** a new game forgets the last spoken OPENED (fx/update.ts opened), so a fresh run's first 5-chain speaks */
export function resetOpened() {
  AU.openedAt = -1e9;
}
/** seconds the voice fades over when a new game or the title cuts it off: short enough to feel cut, long enough not to click */
export const VOICE_CUT = .06;
/** a new game or the title: every voice line (talking or queued) stops with a VOICE_CUT fade, and the comms window
 *  has nothing left to show (audio only) */
export function voiceStopAll() {
  if (AU.c) {
    const now = AU.c.currentTime;
    for (let k = LIVE.length - 1; k >= 0; k--) {
      const v = LIVE[k];
      if (!VOICE_CAT.test(v.cat)) continue;
      v.s.onended = null;
      v.g.gain.setTargetAtTime(0, now, VOICE_CUT / 3);
      v.s.stop(now + VOICE_CUT);
      LIVE.splice(k, 1);
    }
  }
  for (const k in SOLO) if (VOICE_CAT.test(k)) delete SOLO[k];
  AU.voice = null;
  AU.voiceQ = [];
}
export function thr(k, ms) {
  const n = performance.now();
  if (AU.last[k] && n - AU.last[k] < ms) return true;
  AU.last[k] = n;
  return false;
}
export function route(node, wet) {
  node.connect(AU.m);
  if (wet) {
    const g = AU.c.createGain();
    g.gain.value = wet;
    node.connect(g);
    g.connect(AU.verb);
  }
}
export function env(g, t, a, d, v) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + a);
  g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
}
export function tone(o) {
  if (!AU.c || SET.muted || AU.c.state !== 'running') return;
  const A = AU.c,
    t = A.currentTime + (o.at || 0),
    dur = o.dur || .1,
    a = o.a || .003;
  const os = A.createOscillator();
  os.type = o.type || 'square';
  os.frequency.setValueAtTime(o.f, t);
  if (o.f2) os.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  const g = A.createGain();
  env(g, t, a, dur, o.vol || .1);
  let n = os;
  if (o.lp || o.bp) {
    const f = A.createBiquadFilter();
    f.type = o.bp ? 'bandpass' : 'lowpass';
    f.frequency.value = o.bp || o.lp;
    f.Q.value = o.q || 1;
    os.connect(f);
    n = f;
  }
  n.connect(g);
  route(g, o.wet ?? .1);
  os.start(t);
  os.stop(t + a + dur + .05);
}
export function nz(o) {
  if (!AU.c || SET.muted || AU.c.state !== 'running') return;
  const A = AU.c,
    t = A.currentTime + (o.at || 0),
    dur = o.dur || .1,
    a = o.a || .003;
  const s = A.createBufferSource();
  s.buffer = AU.noise;
  const f = A.createBiquadFilter();
  f.type = o.ft || 'lowpass';
  f.frequency.setValueAtTime(o.f || 1000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  f.Q.value = o.q || 1;
  const g = A.createGain();
  env(g, t, a, dur, o.vol || .2);
  s.connect(f);
  f.connect(g);
  route(g, o.wet ?? .2);
  s.loop = true;
  s.start(t, ar() * 1.5);
  s.stop(t + a + dur + .05);
}
/** synth stand-in for a biome kill clip not in the bank yet (acid: the gfizz clip set is a follow-up) */
function synthKill(kind, sz) {
  if (kind !== 'fizz') return;
  // tone pass (Matt 2026-11-07, "more evil, not cartoonish"): the rising bubble pops read as a cartoon, so they are
  // gone. A hiss that sinks (bandpass 2.6 kHz -> 700 Hz, inside the phone speaker's 1-4 kHz band at its start) entering
  // 30 ms in so the splat's transient lands first, under two saws a semitone-ish apart sagging together: the beat
  // between them is the wrong, sour note of flesh giving way. Lowpassed so it sits under the splat, never over it.
  nz({ f: 2600, f2: 700, dur: .22 + sz * .04, vol: .07, ft: 'bandpass', q: 1.2, wet: .15, at: .03 }); // flesh dissolving
  const f0 = arr(200, 240);
  tone({ type: 'sawtooth', f: f0, f2: f0 * .42, dur: .2 + sz * .04, vol: .035, lp: 900, wet: .15, at: .04 }); // sag
  tone({ type: 'sawtooth', f: f0 * 1.06, f2: f0 * .4, dur: .2 + sz * .04, vol: .03, lp: 900, wet: .15, at: .04 }); // its sour twin
}
export const sfx = {
  /** player gun. t = power tier 0..4: each tier drops the pitch and stacks a heavier layer (body, thump, crack, sub) */
  shot(t = 0) {
    if (thr('s', 55)) return;
    const p = [1, .8, .64, .52, .44][t];
    tone({ f: 1250 * p, f2: 420 * p, dur: .05 + t * .006, vol: .03 + t * .004, wet: .04 });
    if (t >= 1) tone({ type: 'triangle', f: 420 * p, f2: 140 * p, dur: .06, vol: .035 });
    if (t >= 2) tone({ type: 'sine', f: 150, f2: 46, dur: .07, vol: .07 + t * .01, wet: 0 });
    if (t >= 3) nz({ f: 2600, f2: 700, dur: .04, vol: .05, ft: 'bandpass', q: 2, wet: .05 });
    if (t >= 4) tone({ type: 'sawtooth', f: 95, f2: 34, dur: .09, vol: .06, lp: 420, wet: 0 });
  },
  laser(t = 0) {
    if (thr('l', 75)) return;
    tone({
      type: 'sawtooth',
      f: 2300 - t * 250,
      f2: 240 - t * 30,
      dur: .15,
      vol: .04,
      lp: 5200
    });
    nz({ f: 5200, f2: 2400, dur: .07, vol: .035 + t * .006, ft: 'highpass', q: 1, wet: .05 }); // crackle
    if (t >= 2) tone({ type: 'sine', f: 130, f2: 48, dur: .08, vol: .06 + t * .01, wet: 0 });
  },
  missile(lv = 1) {
    if (thr('m', 120)) return;
    nz({
      f: 1500,
      f2: 300,
      dur: .2 + lv * .04,
      vol: .06 + lv * .02,
      ft: 'bandpass',
      q: 2
    });
    tone({ type: 'sine', f: 120, f2: 38, dur: .12, vol: .09 + lv * .03, wet: 0 }); // launch thump
  },
  hit() {
    if (thr('h', 38)) return;
    nz({
      f: 1700,
      f2: 260,
      dur: .06,
      vol: .12
    });
    tone({
      type: 'sine',
      f: 170,
      f2: 55,
      dur: .07,
      vol: .12
    });
  },
  // tone pass (D39, tone.md Audio): no clean blip above ~1.2 kHz. The deflection is a dull knock on plate, a short
  // falling triangle under a lowpass with a damp band of noise, not a bright ping
  tink() {
    if (thr('t', 60)) return;
    tone({ type: 'triangle', f: 820, f2: 560, dur: .05, vol: .05, lp: 1000 }); // starts under the 1.2 kHz line, not on it
    nz({ f: 800, dur: .03, vol: .04, ft: 'bandpass', q: 3 });
  },
  gore(sz) {
    if (thr('g', 45)) return;
    const cat = sz >= 2.1 ? 'splat_l' : sz >= 1.2 ? 'splat_m' : 'splat_s';
    if (sample(cat, { vol: .75 + Math.min(.45, sz * .08), wet: .22 })) {
      if (sz >= 1.2) sample('thud', { vol: .5 + Math.min(.3, sz * .06), rate: sz >= 2.1 ? .8 : 1 }); // body impact under the splat
      if (sz >= 1.4 && ar() < .5) sample('bone', { vol: .55, at: .015 });
      if (sz >= 3) sample('explode_l', { vol: .9, wet: .35 });
      // the biome's kill layer (audiomix.ts BIOME_KILL): lowest priority, so it skips near the voice cap and is throttled
      // on its own key: sharing sfx.glob()'s 'gb' let the two silence each other
      const k = BIOME_KILL[curBiome()];
      if (k && sz >= k.minSz && LIVE.length <= KILL_LAYER.maxVoices && !thr('gk', KILL_LAYER.gapMs) && ar() < k.chance)
        sample(k.cat, { vol: k.vol + Math.min(KILL_LAYER.volCap, sz * k.sizeVol), rate: k.rate, at: k.at, wet: .15 }) || (k.synth && synthKill(k.synth, sz));
      return;
    }
    const v = Math.min(1, .3 + sz * .14);
    nz({
      f: 2600,
      f2: 80,
      dur: .25 + sz * .12,
      vol: .38 * v,
      wet: .25
    });
    tone({
      type: 'sine',
      f: 130,
      f2: 26,
      dur: .25 + sz * .1,
      vol: .5 * v
    });
    for (let k = 0; k < 2 + sz * 2; k++) nz({
      at: ar() * .22 * sz + .02,
      f: arr(500, 1500),
      f2: arr(140, 300),
      dur: .05,
      vol: .18 * v,
      ft: 'bandpass',
      q: 3
    });
  },
  // tone pass (D39): rewards fall and never resolve upward. pick was a C-major arpeggio up; now a minor 2nd down then a
  // tritone down (G#4 G4 C#4) on lowpassed saws, in the 200 Hz-1 kHz band a phone speaker carries
  pick() {
    [415.3, 392, 277.2].forEach((f, i) => tone({ at: i * .05, type: 'sawtooth', f, dur: .07, vol: .045, lp: 1100, q: 1.5 }));
  },
  /** power-ups, perk takes, menu confirms and the stage clear (stages.ts calls this; its sim is not touched). A falling
   *  m2 / tritone / m2 figure (D#4 D4 G#3 G3) over a slow swell of two low saws a semitone apart (G2/G#2), whose
   *  beating is the dark swell tone.md asks for at the stage clear */
  power() {
    [311.1, 293.7, 207.7, 196].forEach((f, i) => tone({ at: i * .06, type: 'sawtooth', f, dur: .22, vol: .042, lp: 950, q: 2 }));
  },
  /** stage clear: the falling power figure over a dark swell of two saws a semitone apart (G2/G#2). Only the clear
   *  gets the swell; on every perk, buy and confirm it stopped meaning anything (audio-director, ls2-read) */
  stageClear() {
    sfx.power(); // not this.power(): safe if passed as a bare callback
    tone({ type: 'sawtooth', f: 98, f2: 92.5, dur: .55, a: .2, vol: .05, lp: 420, wet: .35 });
    tone({ type: 'sawtooth', f: 103.8, f2: 98, dur: .55, a: .2, vol: .045, lp: 420, wet: .35 });
  },
  deny() {
    tone({
      f: 140,
      f2: 90,
      dur: .15,
      vol: .06
    });
  },
  die() {
    sample('explode_l', { vol: 1, wet: .4 });
    sample('splat_l', { vol: .9, at: .05 });
    nz({
      f: 4200,
      f2: 50,
      dur: 1.5,
      vol: .6,
      wet: .5
    });
    tone({
      type: 'sawtooth',
      f: 820,
      f2: 85,
      dur: 1.3,
      vol: .12,
      bp: 900,
      q: 3
    });
    tone({
      type: 'sine',
      f: 95,
      f2: 20,
      dur: 1.2,
      vol: .6
    });
  },
  eshot() {
    if (thr('e', 80)) return;
    tone({
      f: 330,
      f2: 190,
      dur: .07,
      vol: .025
    });
  },
  glob() {
    if (thr('gb', 100)) return;
    nz({
      f: 650,
      f2: 180,
      dur: .16,
      vol: .12,
      ft: 'bandpass',
      q: 4
    });
  },
  whisper() {
    nz({
      f: 700,
      f2: 1900,
      dur: 1.1,
      vol: .2,
      ft: 'bandpass',
      q: 9,
      wet: .9
    });
    nz({
      at: .3,
      f: 1700,
      f2: 480,
      dur: .9,
      vol: .14,
      ft: 'bandpass',
      q: 12,
      wet: .9
    });
  },
  roar() {
    sample('monster', { vol: .85, wet: .45, spread: .1 }); // a real throat over the synth rumble
    tone({
      type: 'sawtooth',
      f: 72,
      f2: 36,
      dur: 2.3,
      vol: .26,
      lp: 520,
      a: .2,
      wet: .5
    });
    tone({
      type: 'sawtooth',
      f: 75,
      f2: 39,
      dur: 2.3,
      vol: .2,
      lp: 420,
      a: .2
    });
    nz({
      f: 520,
      f2: 110,
      dur: 2.1,
      vol: .26,
      a: .3,
      wet: .5
    });
  },
  /** WARNING banners: a recorded siren, the synth alarm if the bank isn't loaded */
  siren() {
    if (!sample('warning', { vol: .5, wet: .35, spread: .04, prio: true, fb: true })) sfx.alarm();
  },
  /** a midboss is coming: siren plus the string stinger */
  dread() {
    sfx.siren();
    sample('stinger', { vol: .7, wet: .4, spread: 0, prio: true });
  },
  forkOpen() {
    if (!sample('forkopen', { vol: .8, wet: .3, spread: 0, prio: true, fb: true })) sfx.alarm();
  },
  // tone pass (D39): the 660/880 hi-lo siren was a cartoon klaxon. Now a 220/233 Hz pair (a minor 2nd, ~13 Hz beat)
  // pulsing four times over the same ~2.1 s: a sour throb in the band phones carry
  alarm() {
    for (let i = 0; i < 4; i++) for (const f of [220, 233.1]) tone({ at: i * .52, type: 'sawtooth', f, dur: .4, a: .04, vol: .04, lp: 1000, q: 1.5, wet: .3 });
  },
  heart() {
    tone({
      type: 'sine',
      f: 62,
      f2: 40,
      dur: .13,
      vol: .45
    });
    tone({
      at: .19,
      type: 'sine',
      f: 56,
      f2: 38,
      dur: .13,
      vol: .34
    });
  },
  squish() {
    if (thr('q', 70)) return;
    nz({
      f: 900,
      f2: 240,
      dur: .07,
      vol: .07,
      ft: 'bandpass',
      q: 5
    });
  },
  purge() {
    nz({
      f: 6000,
      f2: 60,
      dur: 1.7,
      vol: .6,
      wet: .6
    });
    tone({
      type: 'sine',
      f: 210,
      f2: 20,
      dur: 1.5,
      vol: .6
    });
  },
  beam() {
    tone({
      type: 'sawtooth',
      f: 110,
      f2: 58,
      dur: .85,
      vol: .15,
      lp: 1300
    });
    nz({
      f: 3200,
      f2: 700,
      dur: .85,
      vol: .15
    });
  },
  // tone pass (D39): the attack tell was a clean 1.9-2.6 kHz sine sweep. Still a rising pull so it reads as "about to",
  // but two lowpassed saws a tritone apart (D#4/A4) creeping up a semitone, resonant, under 1.2 kHz
  tele() {
    if (thr('tl', 300)) return;
    tone({ type: 'sawtooth', f: 311.1, f2: 329.6, dur: .25, vol: .035, lp: 1100, q: 3 });
    tone({ type: 'sawtooth', f: 440, f2: 466.2, dur: .25, vol: .03, lp: 1100, q: 3 });
  },
  shield() {
    tone({
      type: 'triangle',
      f: 950,
      f2: 300,
      dur: .15,
      vol: .08
    });
  },
  // tone pass (D39): an octave lower and lowpassed, a dull tick rather than a bright blip
  menu() {
    tone({ f: 330, dur: .035, vol: .04, lp: 900 });
  },
  groan() {
    nz({
      f: 250,
      f2: 65,
      dur: 2.6,
      vol: .2,
      ft: 'bandpass',
      q: 18,
      a: .6,
      wet: .9
    });
  },
  /** extra weight on top of hit() for big rounds (own throttle so it never gets swallowed by the light hit) */
  hitHeavy(d) {
    if (thr('hh', 70)) return;
    tone({ type: 'sine', f: 120, f2: 34, dur: .1 + Math.min(.1, d * .01), vol: Math.min(.2, .07 + d * .015), wet: .1 });
    if (d >= 5 && !thr('hhs', 140)) sample('thud', { vol: Math.min(.8, .3 + d * .04), rate: .8, wet: .15 });
  },
  crit() {
    if (thr('cr', 90)) return;
    tone({ type: 'square', f: 2600, f2: 1300, dur: .05, vol: .05, wet: .2 });
    if (!sample('bone', { vol: .55, rate: 1.1, wet: .2 })) nz({ f: 3000, f2: 500, dur: .08, vol: .14, ft: 'bandpass', q: 3 });
  },
  pyre() {
    if (thr('py', 50)) return;
    nz({
      f: 1900,
      f2: 80,
      dur: .5,
      vol: .42,
      wet: .3
    });
    tone({
      type: 'sine',
      f: 170,
      f2: 28,
      dur: .4,
      vol: .42
    });
    nz({
      at: .04,
      f: 3200,
      f2: 600,
      dur: .3,
      vol: .16,
      ft: 'highpass'
    });
    nz({
      at: .08,
      f: 500,
      f2: 1400,
      dur: .35,
      vol: .12,
      ft: 'bandpass',
      q: 3
    });
  },
  fireball(lv = 1) {
    if (thr('fb', 110)) return;
    nz({
      f: 600,
      f2: 2400,
      dur: .2,
      vol: .08 + lv * .02,
      ft: 'bandpass',
      q: 2
    });
    tone({ type: 'sine', f: 90, f2: 40, dur: .14, vol: .07 + lv * .03, wet: .1 }); // throat-gulp
  },
  lash() {
    nz({
      f: 6000,
      f2: 900,
      dur: .09,
      vol: .34,
      ft: 'highpass',
      q: 2
    });
    tone({
      at: .02,
      f: 2600,
      f2: 420,
      dur: .07,
      vol: .09
    });
  },
  chain() {
    if (thr('ch', 150)) return;
    // tone pass (D39): was bright 1.8-3.6 kHz triangle pings; now a low lowpassed rattle of links dragging
    for (let k = 0; k < 5; k++) tone({ at: k * .035, type: 'sawtooth', f: arr(500, 900), f2: arr(250, 400), dur: .04, vol: .035, lp: 1100, q: 2 });
  },
  bomb() {
    if (thr('bm', 80)) return;
    if (sample('explode_s', { vol: .7, wet: .3 })) return;
    nz({
      f: 1300,
      f2: 60,
      dur: .38,
      vol: .34,
      wet: .25
    });
    tone({
      type: 'sine',
      f: 115,
      f2: 28,
      dur: .32,
      vol: .38
    });
  },
  hype() {
    [82.4, 123.5, 164.8].forEach(f => tone({
      type: 'sawtooth',
      f,
      dur: .7,
      vol: .07,
      lp: 1200,
      a: .01,
      wet: .3
    }));
    [82.4, 123.5, 164.8].forEach(f => tone({
      at: .18,
      type: 'sawtooth',
      f: f * 1.0595, // tone pass (D39): was x1.335, a rising fourth (triumph); now a minor 2nd above, sour
      dur: .9,
      vol: .06,
      lp: 1200,
      wet: .3
    }));
    nz({
      f: 900,
      dur: 1.4,
      vol: .16,
      ft: 'bandpass',
      q: .7,
      a: .15,
      wet: .6
    });
    tone({
      type: 'sine',
      f: 60,
      f2: 40,
      dur: .4,
      vol: .4
    });
  },
  drip() {
    if (thr('dr', 200)) return;
    // tone pass (D39): was a 1.1-1.5 kHz plink; now a low wet drop falling into the 200-800 Hz band
    tone({ type: 'sine', f: arr(600, 800), f2: 240, dur: .06, vol: .025, wet: .6 });
  }
};
// say() (speechSynthesis / native TTS) is gone (tone pass D39): a voice line is a recorded clip or nothing, so an
// empty or shelved bank is silent
export function setMute(m) {
  SET.muted = m;
  if (AU.m) AU.m.gain.value = m ? 0 : .55;
}

// ---------------- input ----------------
