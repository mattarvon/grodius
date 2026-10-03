// @ts-nocheck
import { R, rr } from './core';
import { SET } from './save';
import { nativeSay } from './platform';
import { duckMusic } from './music';

// ---------------- audio ----------------
export const AU = {
  c: null,
  last: {}
};
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
  for (let i = 0; i < len; i++) d[i] = R() * 2 - 1;
  AU.noise = b;
  const il = A.sampleRate * 2.6 | 0,
    ib = A.createBuffer(2, il, A.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ib.getChannelData(c);
    for (let i = 0; i < il; i++) ch[i] = (R() * 2 - 1) * Math.pow(1 - i / il, 3.2);
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
}
// ---------------- sample bank ----------------
// Every audio file under src/sfx/<category>/ is bundled and decoded on first input. Categories:
// splat_s splat_m splat_l thud bone silly explode_s explode_l. Drop more files in a folder and they join the rotation.
const SFX_URLS = import.meta.glob('./sfx/*/*.{ogg,wav,mp3,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const BANK: Record<string, AudioBuffer[]> = {};
const LASTS: Record<string, number> = {};
let arng = 0x2545f491; // audio has its own RNG so sound choices never perturb gameplay randomness
const ar = () => ((arng ^= arng << 13), (arng ^= arng >>> 17), (arng ^= arng << 5), (arng >>> 0) / 4294967296);
let voices = 0;
function loadBank(A) {
  for (const [p, u] of Object.entries(SFX_URLS)) {
    const cat = p.split('/')[2];
    fetch(u).then((r) => r.arrayBuffer()).then((b) => A.decodeAudioData(b)).then((buf) => (BANK[cat] ||= []).push(buf)).catch(() => {});
  }
}
/** play a random clip from a category with pitch/volume jitter. false if the category isn't loaded (caller falls back to synth) */
export function sample(cat, o: { vol?: number; rate?: number; spread?: number; wet?: number; at?: number } = {}) {
  const L = BANK[cat];
  if (!AU.c || !L || !L.length || SET.muted) return false;
  if (voices > 14) return true; // swallow it: a wall of 30 splats in one frame is mud anyway
  let i = Math.floor(ar() * L.length);
  if (L.length > 1 && i === LASTS[cat]) i = (i + 1) % L.length;
  LASTS[cat] = i;
  const s = AU.c.createBufferSource(), g = AU.c.createGain();
  s.buffer = L[i];
  s.playbackRate.value = (o.rate ?? 1) * (1 + (ar() * 2 - 1) * (o.spread ?? .14));
  g.gain.value = (o.vol ?? 1) * (.8 + ar() * .3);
  s.connect(g);
  route(g, o.wet ?? .2);
  voices++;
  s.onended = () => voices--;
  s.start(AU.c.currentTime + (o.at ?? 0));
  if (/^(hype|babe|bossreward)/.test(cat)) duckMusic(L[i].duration + .3);
  return true;
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
  if (!AU.c || SET.muted) return;
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
  if (!AU.c || SET.muted) return;
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
  s.start(t, R() * 1.5);
  s.stop(t + a + dur + .05);
}
export const sfx = {
  shot() {
    if (thr('s', 55)) return;
    tone({
      f: 1250,
      f2: 420,
      dur: .05,
      vol: .03,
      wet: .04
    });
  },
  laser() {
    if (thr('l', 75)) return;
    tone({
      type: 'sawtooth',
      f: 2300,
      f2: 240,
      dur: .15,
      vol: .04,
      lp: 5200
    });
  },
  missile() {
    if (thr('m', 120)) return;
    nz({
      f: 1500,
      f2: 300,
      dur: .2,
      vol: .06,
      ft: 'bandpass',
      q: 2
    });
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
  tink() {
    if (thr('t', 60)) return;
    tone({
      type: 'triangle',
      f: 2700,
      f2: 1900,
      dur: .05,
      vol: .045
    });
    nz({
      f: 5000,
      dur: .03,
      vol: .04,
      ft: 'highpass'
    });
  },
  gore(sz) {
    if (thr('g', 45)) return;
    const cat = sz >= 2.1 ? 'splat_l' : sz >= 1.2 ? 'splat_m' : 'splat_s';
    if (sample(cat, { vol: .75 + Math.min(.45, sz * .08), wet: .22 })) {
      if (sz >= 1.2) sample('thud', { vol: .5 + Math.min(.3, sz * .06), rate: sz >= 2.1 ? .8 : 1 }); // body impact under the splat
      if (sz >= 1.4 && ar() < .5) sample('bone', { vol: .55, at: .015 });
      if (sz >= .9 && ar() < .14) sample('silly', { vol: .6, at: .04 }); // ~1 in 7 kills gets the comedy layer
      if (sz >= 3) sample('explode_l', { vol: .9, wet: .35 });
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
      at: R() * .22 * sz + .02,
      f: rr(500, 1500),
      f2: rr(140, 300),
      dur: .05,
      vol: .18 * v,
      ft: 'bandpass',
      q: 3
    });
  },
  pick() {
    [523, 784, 1046].forEach((f, i) => tone({
      at: i * .05,
      f,
      dur: .07,
      vol: .05
    }));
  },
  power() {
    [262, 330, 392, 523].forEach((f, i) => tone({
      at: i * .04,
      type: 'sawtooth',
      f,
      dur: .2,
      vol: .04,
      lp: 2600
    }));
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
  alarm() {
    for (let i = 0; i < 6; i++) tone({
      at: i * .36,
      f: i % 2 ? 660 : 880,
      dur: .3,
      vol: .045,
      lp: 3000,
      wet: .3
    });
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
  tele() {
    if (thr('tl', 300)) return;
    tone({
      type: 'sine',
      f: 1900,
      f2: 2600,
      dur: .25,
      vol: .03
    });
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
  menu() {
    tone({
      f: 660,
      dur: .03,
      vol: .035
    });
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
  fireball() {
    if (thr('fb', 110)) return;
    nz({
      f: 600,
      f2: 2400,
      dur: .2,
      vol: .08,
      ft: 'bandpass',
      q: 2
    });
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
    for (let k = 0; k < 5; k++) tone({
      at: k * .035,
      type: 'triangle',
      f: rr(1800, 3600),
      f2: rr(900, 1500),
      dur: .04,
      vol: .035
    });
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
      lp: 1900,
      a: .01,
      wet: .3
    }));
    [82.4, 123.5, 164.8].forEach(f => tone({
      at: .18,
      type: 'sawtooth',
      f: f * 1.335,
      dur: .9,
      vol: .06,
      lp: 1900,
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
    tone({
      type: 'sine',
      f: rr(1100, 1500),
      f2: 500,
      dur: .05,
      vol: .02,
      wet: .6
    });
  }
};
export function say(t, o = {}) {
  if (SET.muted) return;
  if (nativeSay(t, o.pitch ?? .3, o.rate ?? .92)) return;
  try {
    const S = window.speechSynthesis;
    if (!S) return;
    const u = new SpeechSynthesisUtterance(t);
    u.pitch = o.pitch ?? .3;
    u.rate = o.rate ?? .92;
    u.volume = 1;
    if (o.female) {
      const v = S.getVoices().find(v => /female|samantha|zira|victoria|karen|moira|tessa|fiona|susan|aria|jenny/i.test(v.name));
      if (v) u.voice = v;
    }
    S.cancel();
    S.speak(u);
  } catch (e) {}
}
export function setMute(m) {
  SET.muted = m;
  if (AU.m) AU.m.gain.value = m ? 0 : .55;
}

// ---------------- input ----------------
