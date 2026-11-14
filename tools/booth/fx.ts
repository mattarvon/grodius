// The voice booth's FX rack (cyborg filters and other weird stuff): a fixed list of effects, each a set of numeric
// knobs, turned into one ffmpeg filter graph that runs on a take after the cleanup and before the gain to the target
// (plugin.ts processTake), so whatever the rack does, the take still lands at the game's loudness. Shared by the page
// (booth.ts: the sliders, the presets) and the plugin (the graph). A leaf module: no imports.
//
// Only numbers ever reach ffmpeg: cleanFx() keeps the known effects and knobs, clamps every value to its range and
// rounds it to its step, and fxGraph() builds the graph from those numbers alone. A request can't inject a filter.

export type Knob = { k: string; label: string; min: number; max: number; step: number; def: number; unit?: string; opts?: readonly string[] };
export type Effect = { id: string; label: string; blurb: string; knobs: readonly Knob[] };
/** the effects that are on, each with its knob values. An effect missing from the set is off */
export type FxSet = Record<string, Record<string, number>>;

const mix = (def = 1): Knob => ({ k: 'mix', label: 'mix', min: 0, max: 1, step: 0.05, def });

/** the rack, in the order the graph runs it */
export const EFFECTS: readonly Effect[] = [
  { id: 'pitch', label: 'Pitch', blurb: 'up or down, same length', knobs: [{ k: 'semi', label: 'semitones', min: -12, max: 12, step: 0.5, def: -3 }] },
  { id: 'octave', label: 'Sub octave', blurb: 'a second voice an octave (or more) below: demon double', knobs: [{ k: 'semi', label: 'semitones', min: -24, max: -3, step: 1, def: -12 }, mix(0.5)] },
  { id: 'robot', label: 'Robot', blurb: 'phase flattened to a monotone buzz', knobs: [{ k: 'win', label: 'buzz', min: 0, max: 3, step: 1, def: 1, opts: ['high', 'mid', 'low', 'sub'] }, mix(1)] },
  { id: 'whisper', label: 'Whisper', blurb: 'random phase: a breathy ghost', knobs: [mix(1)] },
  { id: 'ring', label: 'Ring mod', blurb: 'metal warble (30-60 Hz is the classic evil robot)', knobs: [{ k: 'f', label: 'freq', min: 5, max: 2000, step: 5, def: 45, unit: 'Hz' }, mix(1)] },
  { id: 'chop', label: 'Chopper', blurb: 'square-wave stutter', knobs: [{ k: 'f', label: 'rate', min: 2, max: 60, step: 1, def: 18, unit: 'Hz' }, { k: 'd', label: 'depth', min: 0, max: 1, step: 0.05, def: 0.8 }] },
  { id: 'drive', label: 'Distortion', blurb: 'overdriven and clipped', knobs: [{ k: 'gain', label: 'drive', min: 0, max: 36, step: 1, def: 14, unit: 'dB' }, { k: 'type', label: 'shape', min: 0, max: 4, step: 1, def: 1, opts: ['tanh', 'hard', 'atan', 'cubic', 'sin'] }] },
  { id: 'crush', label: 'Bitcrush', blurb: 'fewer bits, lower sample rate: broken hardware', knobs: [{ k: 'bits', label: 'bits', min: 2, max: 16, step: 1, def: 8 }, { k: 'samples', label: 'downsample', min: 1, max: 40, step: 1, def: 4, unit: 'x' }, mix(0.7)] },
  { id: 'radio', label: 'Radio band', blurb: 'telephone / helmet comms band', knobs: [{ k: 'lo', label: 'low cut', min: 80, max: 1500, step: 10, def: 320, unit: 'Hz' }, { k: 'hi', label: 'high cut', min: 1200, max: 9000, step: 100, def: 3400, unit: 'Hz' }] },
  { id: 'chorus', label: 'Clone army', blurb: 'a crowd of you, slightly out of time', knobs: [{ k: 'n', label: 'voices', min: 2, max: 5, step: 1, def: 3 }, { k: 'depth', label: 'depth', min: 0.5, max: 10, step: 0.5, def: 2.5, unit: 'ms' }] },
  { id: 'flanger', label: 'Flanger', blurb: 'jet sweep, metal tube', knobs: [{ k: 'delay', label: 'delay', min: 0, max: 30, step: 1, def: 3, unit: 'ms' }, { k: 'depth', label: 'depth', min: 0, max: 10, step: 0.5, def: 3, unit: 'ms' }, { k: 'regen', label: 'feedback', min: -95, max: 95, step: 5, def: 50, unit: '%' }, { k: 'speed', label: 'speed', min: 0.1, max: 10, step: 0.1, def: 0.4, unit: 'Hz' }] },
  { id: 'phaser', label: 'Phaser', blurb: 'swirling notches', knobs: [{ k: 'speed', label: 'speed', min: 0.1, max: 2, step: 0.1, def: 0.5, unit: 'Hz' }, { k: 'decay', label: 'depth', min: 0.1, max: 0.9, step: 0.05, def: 0.6 }] },
  { id: 'vibrato', label: 'Vibrato', blurb: 'pitch wobble: nervous android, broken tape', knobs: [{ k: 'f', label: 'rate', min: 0.5, max: 20, step: 0.5, def: 6, unit: 'Hz' }, { k: 'd', label: 'depth', min: 0, max: 1, step: 0.05, def: 0.4 }] },
  { id: 'tremolo', label: 'Tremolo', blurb: 'volume wobble', knobs: [{ k: 'f', label: 'rate', min: 0.5, max: 40, step: 0.5, def: 8, unit: 'Hz' }, { k: 'd', label: 'depth', min: 0, max: 1, step: 0.05, def: 0.6 }] },
  { id: 'echo', label: 'Echo', blurb: 'short = metal corridor, long = canyon', knobs: [{ k: 'ms', label: 'delay', min: 10, max: 900, step: 10, def: 120, unit: 'ms' }, { k: 'decay', label: 'decay', min: 0.05, max: 0.9, step: 0.05, def: 0.4 }] },
  { id: 'cave', label: 'Hull reverb', blurb: 'the inside of a dead ship', knobs: [{ k: 'size', label: 'size', min: 0.2, max: 3, step: 0.1, def: 1 }, { k: 'decay', label: 'decay', min: 0.1, max: 0.8, step: 0.05, def: 0.45 }] },
];
const BY = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

/** an effect's knobs at their defaults */
export const defaults = (id: string): Record<string, number> => Object.fromEntries((BY[id]?.knobs ?? []).map((k) => [k.k, k.def]));

const snap = (v: number, k: Knob) => {
  const c = Math.min(k.max, Math.max(k.min, v));
  return Math.round(Math.round((c - k.min) / k.step) * k.step * 1e4) / 1e4 + k.min;
};
/** anything (a request's JSON, localStorage) -> a clean FxSet: known effects and knobs only, numbers clamped to range
 *  and rounded to step, a missing or non-numeric knob at its default */
export function cleanFx(x: unknown): FxSet {
  const out: FxSet = {};
  if (!x || typeof x !== 'object' || Array.isArray(x)) return out;
  for (const e of EFFECTS) {
    const v = (x as Record<string, unknown>)[e.id];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    out[e.id] = Object.fromEntries(e.knobs.map((k) => {
      const n = (v as Record<string, unknown>)[k.k];
      return [k.k, Math.round(snap(typeof n === 'number' && Number.isFinite(n) ? n : k.def, k) * 1e4) / 1e4];
    }));
  }
  return out;
}
export const fxOn = (fx: FxSet | null | undefined) => !!fx && Object.keys(fx).some((id) => BY[id]);
/** "robot + radio band" for a take list */
export const fxName = (fx: FxSet | null | undefined) => (fx ? EFFECTS.filter((e) => fx[e.id]).map((e) => e.label.toLowerCase()).join(' + ') : '');

/** the presets (a starting point: every knob stays live). Values not given take the knob's default */
const P = (o: Record<string, Record<string, number>>): FxSet => cleanFx(Object.fromEntries(Object.entries(o).map(([id, v]) => [id, { ...defaults(id), ...v }])));
export const PRESETS: readonly { name: string; fx: FxSet }[] = [
  { name: 'Clean (no FX)', fx: {} },
  { name: 'Comms radio', fx: P({ radio: {}, crush: { bits: 10, samples: 1, mix: 0.5 } }) },
  { name: 'Robot', fx: P({ robot: {}, radio: { lo: 150, hi: 6000 } }) },
  { name: 'Robot radio', fx: P({ robot: {}, radio: {}, crush: { bits: 10, samples: 1, mix: 0.5 }, echo: { ms: 18, decay: 0.35 } }) },
  { name: 'Cyborg', fx: P({ pitch: { semi: -3 }, robot: { win: 1, mix: 0.45 }, ring: { f: 60, mix: 0.3 }, radio: { lo: 200, hi: 5000 }, flanger: { delay: 2, depth: 2, regen: 40, speed: 0.3 } }) },
  { name: 'Android', fx: P({ pitch: { semi: -2 }, flanger: { delay: 2, depth: 2, regen: 40, speed: 0.3 }, radio: {}, crush: { bits: 10, samples: 1, mix: 0.5 } }) },
  { name: 'Evil machine (ring mod)', fx: P({ ring: { f: 30, mix: 1 }, radio: { lo: 150, hi: 4500 } }) },
  { name: 'Demon', fx: P({ pitch: { semi: -5 }, octave: { semi: -12, mix: 0.6 }, drive: { gain: 8, type: 0 }, cave: { size: 1.4, decay: 0.4 } }) },
  { name: 'Possessed', fx: P({ octave: { semi: -12, mix: 0.5 }, whisper: { mix: 0.35 }, vibrato: { f: 4, d: 0.15 }, cave: { size: 1, decay: 0.35 } }) },
  { name: 'Ghost', fx: P({ whisper: { mix: 0.8 }, pitch: { semi: -2 }, cave: { size: 2.2, decay: 0.55 } }) },
  { name: 'Glitch', fx: P({ crush: { bits: 5, samples: 10, mix: 1 }, chop: { f: 22, d: 0.9 }, radio: { lo: 250, hi: 5000 } }) },
  { name: 'Busted PA', fx: P({ drive: { gain: 22, type: 1 }, radio: { lo: 500, hi: 2600 }, echo: { ms: 260, decay: 0.3 } }) },
  { name: 'Clone army', fx: P({ chorus: { n: 5, depth: 4 }, pitch: { semi: -1 }, cave: { size: 0.8, decay: 0.3 } }) },
  { name: 'Alien larva', fx: P({ pitch: { semi: 7 }, vibrato: { f: 11, d: 0.5 }, phaser: { speed: 1.2, decay: 0.7 } }) },
  { name: 'Dying battery', fx: P({ pitch: { semi: -4 }, vibrato: { f: 1.5, d: 0.6 }, crush: { bits: 6, samples: 6, mix: 0.6 }, tremolo: { f: 5, d: 0.4 } }) },
  { name: 'Hive mind', fx: P({ chorus: { n: 4, depth: 6 }, ring: { f: 120, mix: 0.35 }, flanger: { delay: 5, depth: 5, regen: 70, speed: 0.2 }, echo: { ms: 40, decay: 0.4 } }) },
];

/** a random rack: 2-5 effects at random settings, mostly mild so the words survive. rnd = Math.random in the page */
export function randomFx(rnd: () => number = Math.random): FxSet {
  const pool = EFFECTS.map((e) => e.id).filter((id) => id !== 'whisper' || rnd() < 0.3);
  const n = 2 + Math.floor(rnd() * 4), out: Record<string, Record<string, number>> = {};
  while (Object.keys(out).length < n && pool.length) {
    const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out[id] = Object.fromEntries(BY[id].knobs.map((k) => {
      // mixes and depths lean low so a random rack stays a voice, not noise
      const t = k.k === 'mix' || k.k === 'd' ? rnd() * 0.75 + 0.15 : rnd();
      return [k.k, k.min + t * (k.max - k.min)];
    }));
  }
  if (out.radio && out.radio.hi < out.radio.lo + 800) out.radio.hi = Math.min(9000, out.radio.lo + 1500);
  return cleanFx(out);
}

const SR = 44100;
const WIN = [256, 512, 1024, 2048];
const CLIP = ['tanh', 'hard', 'atan', 'cubic', 'sin'];
const f4 = (n: number) => String(Math.round(n * 1e4) / 1e4);
/** pitch by n semitones at the same length: resample, then tempo back */
const pitchF = (semi: number) => {
  const r = 2 ** (semi / 12);
  return `asetrate=${Math.round(SR * r)},aresample=${SR},atempo=${f4(1 / r)}`;
};

/** an FxSet -> an ffmpeg -filter_complex graph from [0:a] to [fx], or null when the rack is empty. Built from
 *  cleanFx() numbers only. Wet/dry knobs split the signal, run the effect on one side and mix them back */
export function fxGraph(raw: FxSet | null | undefined): string | null {
  const fx = cleanFx(raw);
  if (!fxOn(fx)) return null;
  const g: string[] = [];
  let cur = 'a0', n = 0;
  g.push(`[0:a]aformat=sample_fmts=flt:channel_layouts=mono,aresample=${SR}[a0]`);
  const serial = (f: string) => { const o = `s${++n}`; g.push(`[${cur}]${f}[${o}]`); cur = o; };
  const wet = (f: string, m: number) => {
    if (m <= 0) return;
    if (m >= 1) return serial(f);
    const i = ++n;
    g.push(`[${cur}]asplit[d${i}][w${i}]`, `[w${i}]${f}[x${i}]`, `[d${i}][x${i}]amix=inputs=2:weights='${f4(1 - m)} ${f4(m)}':normalize=0[s${i}]`);
    cur = `s${i}`;
  };
  for (const e of EFFECTS) {
    const v = fx[e.id];
    if (!v) continue;
    switch (e.id) {
      case 'pitch': if (v.semi) serial(pitchF(v.semi)); break;
      // the low voice sits under the dry one; mix is how loud it is
      case 'octave': wet(pitchF(v.semi), v.mix); break;
      case 'robot': wet(`afftfilt=real='hypot(re,im)':imag='0':win_size=${WIN[v.win] ?? 512}:overlap=0.75`, v.mix); break;
      case 'whisper': wet(`afftfilt=real='hypot(re,im)*cos((random(0)*2-1)*2*3.14)':imag='hypot(re,im)*sin((random(1)*2-1)*2*3.14)':win_size=128:overlap=0.8`, v.mix); break;
      case 'ring': wet(`aeval=exprs='val(0)*sin(2*PI*${f4(v.f)}*t)':c=same`, v.mix); break;
      case 'chop': serial(`aeval=exprs='val(0)*(1-${f4(v.d)}*lt(sin(2*PI*${f4(v.f)}*t),0))':c=same`); break;
      case 'drive': serial(`volume=${f4(v.gain)}dB,asoftclip=type=${CLIP[v.type] ?? 'tanh'},volume=${f4(-v.gain * 0.6)}dB`); break;
      case 'crush': serial(`acrusher=bits=${f4(v.bits)}:samples=${f4(v.samples)}:mix=${f4(v.mix)}:mode=lin:aa=0.5`); break;
      case 'radio': serial(`highpass=f=${f4(v.lo)}:poles=2,lowpass=f=${f4(Math.max(v.hi, v.lo + 200))}:poles=2,highpass=f=${f4(v.lo)}:poles=2`); break;
      case 'chorus': {
        const k = Math.round(v.n), d = Array.from({ length: k }, (_, i) => 35 + i * 14), dec = d.map((_, i) => f4(0.45 - i * 0.05)),
          sp = d.map((_, i) => f4(0.2 + i * 0.13)), dp = d.map(() => f4(v.depth));
        serial(`chorus=0.6:0.8:${d.join('|')}:${dec.join('|')}:${sp.join('|')}:${dp.join('|')}`);
        break;
      }
      case 'flanger': serial(`flanger=delay=${f4(v.delay)}:depth=${f4(v.depth)}:regen=${f4(v.regen)}:speed=${f4(v.speed)}:width=70`); break;
      case 'phaser': serial(`aphaser=in_gain=0.6:out_gain=0.9:delay=3:decay=${f4(v.decay)}:speed=${f4(v.speed)}:type=t`); break;
      case 'vibrato': if (v.d > 0) serial(`vibrato=f=${f4(v.f)}:d=${f4(v.d)}`); break;
      case 'tremolo': if (v.d > 0) serial(`tremolo=f=${f4(v.f)}:d=${f4(v.d)}`); break;
      // padded first, so the repeats ring out past the last word instead of being cut with it
      case 'echo': serial(`apad=pad_dur=${f4(Math.min(1.5, (v.ms / 1000) * 3))},aecho=0.8:0.8:${f4(v.ms)}:${f4(v.decay)}`); break;
      case 'cave': {
        const taps = [43, 79, 113, 151, 197].map((t) => Math.round(t * v.size)), dec = taps.map((_, i) => f4(v.decay * (1 - i * 0.16)));
        serial(`apad=pad_dur=${f4(Math.min(1.5, 0.25 * v.size + v.decay))},aecho=0.8:0.7:${taps.join('|')}:${dec.join('|')}`);
        break;
      }
    }
  }
  // a rack whose every effect was a no-op (pitch 0, depth 0, mix 0) still passes the signal through
  g.push(`[${cur}]anull[fx]`);
  return g.join(';');
}
