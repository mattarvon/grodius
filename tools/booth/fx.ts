// The voice booth's FX rack (a voice-design rack: cyborg filters, vocoder, convolution space and other weird stuff):
// a fixed list of effects, each a set of numeric knobs, turned into one ffmpeg filter graph that runs on a take after
// the cleanup and before the gain to the target (plugin.ts processTake), so whatever the rack does, the take still
// lands at the game's loudness. Shared by the page (booth.ts: the sliders, the presets) and the plugin (the graph).
// A leaf module: no imports.
//
// Only numbers ever reach ffmpeg: cleanFx() keeps the known effects and knobs, clamps every value to its range and
// rounds it to its step, and fxGraph() builds the graph from those numbers alone (an enumeration knob is an index into
// a fixed table here). A request can't inject a filter. fxGraph's optional take info (length, loudness) is numbers
// too, range-checked before use.

export type Knob = { k: string; label: string; min: number; max: number; step: number; def: number; unit?: string; opts?: readonly string[] };
/** the rack's sections, as the page groups them */
export type Group = 'pitch' | 'synth' | 'space' | 'mod' | 'dirt' | 'tone' | 'dynamics' | 'time' | 'weird';
export type Effect = { id: string; label: string; blurb: string; group: Group; knobs: readonly Knob[] };
/** the effects that are on, each with its knob values. An effect missing from the set is off */
export type FxSet = Record<string, Record<string, number>>;

/** the groups in display order (the signal flow: clean-up first, space last, then the oddities) */
export const GROUPS: readonly { id: Group; label: string }[] = [
  { id: 'dynamics', label: 'Dynamics' },
  { id: 'tone', label: 'Tone & EQ' },
  { id: 'pitch', label: 'Pitch & formant' },
  { id: 'synth', label: 'Synth & vocoder' },
  { id: 'dirt', label: 'Dirt & comms' },
  { id: 'mod', label: 'Modulation' },
  { id: 'time', label: 'Time' },
  { id: 'space', label: 'Space' },
  { id: 'weird', label: 'Weird' },
];

const mix = (def = 1): Knob => ({ k: 'mix', label: 'mix', min: 0, max: 1, step: 0.05, def });
const K = (k: string, label: string, min: number, max: number, step: number, def: number, unit?: string): Knob => ({ k, label, min, max, step, def, ...(unit ? { unit } : {}) });
/** an enumeration knob: an index into opts */
const O = (k: string, label: string, opts: readonly string[], def = 0): Knob => ({ k, label, min: 0, max: opts.length - 1, step: 1, def, opts });

const FORMANT = ['shifted', 'preserved'] as const;
const CARRIERS = ['saw', 'pulse', 'chord', 'noise', 'saw + hiss'] as const;
const ROOMS = ['hull', 'locker', 'cathedral', 'plate', 'sewer'] as const;

/** the rack, in the order the graph runs it: clean-up and tone first, then pitch, synth, dirt, modulation, time and
 *  space last. (The order is the signal flow, not the page's grouping: chop runs before the drive, radio after it,
 *  as they always have) */
export const EFFECTS: readonly Effect[] = [
  // ---- clean-up and tone, on the dry voice
  { id: 'denoise', label: 'Denoise', group: 'dynamics', blurb: 'FFT noise reduction against a tracked floor: hiss and room out', knobs: [K('nr', 'reduction', 3, 40, 1, 12, 'dB'), K('nf', 'floor', -80, -20, 1, -50, 'dB')] },
  { id: 'gate', label: 'Noise gate', group: 'dynamics', blurb: 'shuts between words: dead air, hard cuts', knobs: [K('thr', 'threshold', -70, -24, 1, -40, 'dB'), K('range', 'range', 0, 60, 1, 30, 'dB'), K('attack', 'attack', 0.5, 50, 0.5, 2, 'ms'), K('release', 'release', 20, 800, 10, 120, 'ms')] },
  { id: 'eq', label: '3-band EQ', group: 'tone', blurb: 'low shelf, a sweepable mid, high shelf', knobs: [K('lo', 'low', -15, 15, 0.5, 0, 'dB'), K('mid', 'mid', -15, 15, 0.5, 0, 'dB'), K('midf', 'mid freq', 200, 5000, 50, 1200, 'Hz'), K('hi', 'high', -15, 15, 0.5, 0, 'dB')] },
  { id: 'comp', label: 'Compressor', group: 'dynamics', blurb: 'evens the syllables out: up-front, in your face', knobs: [K('thr', 'threshold', -40, 0, 1, -26, 'dB'), K('ratio', 'ratio', 1, 20, 0.5, 4), K('attack', 'attack', 0.1, 100, 0.1, 5, 'ms'), K('release', 'release', 10, 1000, 10, 120, 'ms')] },
  { id: 'deess', label: 'De-esser', group: 'dynamics', blurb: 'tames the S and T hiss', knobs: [K('i', 'intensity', 0, 1, 0.05, 0.6), K('m', 'max cut', 0, 1, 0.05, 0.5), K('f', 'band', 0.1, 0.9, 0.05, 0.5)] },
  { id: 'exciter', label: 'Exciter', group: 'tone', blurb: 'synthesised top-end harmonics: presence, bite', knobs: [K('amount', 'amount', 0.5, 8, 0.5, 2), K('freq', 'from', 2000, 10000, 100, 4500, 'Hz'), K('drive', 'harmonics', 1, 10, 0.5, 8.5)] },
  { id: 'crystal', label: 'Crystalizer', group: 'tone', blurb: 'sharpens the transients: crisp, brittle', knobs: [K('i', 'intensity', 0.5, 8, 0.5, 2)] },
  { id: 'sub', label: 'Sub boost', group: 'tone', blurb: 'resonant low end under the voice: chest, trailer weight', knobs: [K('boost', 'boost', 1, 12, 0.5, 4), K('cutoff', 'cutoff', 50, 300, 5, 120, 'Hz')] },
  // ---- pitch and formant (rubberband, high quality)
  { id: 'pitch', label: 'Pitch', group: 'pitch', blurb: 'up or down, same length (formant shifted: chipmunk / ogre; preserved: the same throat, best going up)', knobs: [K('semi', 'semitones', -12, 12, 0.5, -3), O('formant', 'formant', FORMANT)] },
  { id: 'formant', label: 'Formant', group: 'pitch', blurb: 'the throat, not the note: down is a giant (strong), up is an imp (subtle)', knobs: [K('shift', 'shift', -12, 12, 0.5, -4, 'st')] },
  { id: 'speed', label: 'Tape speed', group: 'pitch', blurb: 'pitch and tempo together: slow-mo death or chipmunk mutant (changes the length)', knobs: [K('semi', 'semitones', -12, 12, 0.5, -4)] },
  { id: 'octave', label: 'Sub octave', group: 'pitch', blurb: 'a second voice an octave (or more) below: demon double', knobs: [K('semi', 'semitones', -24, -3, 1, -12), mix(0.5)] },
  { id: 'harmony', label: 'Harmonizer', group: 'pitch', blurb: 'two extra voices at fixed intervals: a choir of you (0 = that voice off)', knobs: [K('a', 'voice A', -12, 12, 1, 7, 'st'), K('b', 'voice B', -12, 12, 1, -12, 'st'), mix(0.4)] },
  // ---- synth
  { id: 'robot', label: 'Robot', group: 'synth', blurb: 'phase flattened to a monotone buzz', knobs: [O('win', 'buzz', ['high', 'mid', 'low', 'sub'], 1), mix(1)] },
  { id: 'whisper', label: 'Whisper', group: 'weird', blurb: 'random phase: a breathy ghost', knobs: [mix(1)] },
  { id: 'vocoder', label: 'Vocoder', group: 'synth', blurb: 'your words played on a synth: a channel vocoder over a generated carrier', knobs: [O('car', 'carrier', CARRIERS), K('hz', 'note', 30, 400, 1, 82, 'Hz'), K('bands', 'bands', 8, 24, 1, 16), K('sib', 'hiss', 0, 1, 0.05, 0.4), mix(1)] },
  { id: 'ring', label: 'Ring mod', group: 'synth', blurb: 'metal warble (30-60 Hz is the classic evil robot)', knobs: [K('f', 'freq', 5, 2000, 5, 45, 'Hz'), mix(1)] },
  { id: 'freqshift', label: 'Freq shifter', group: 'weird', blurb: 'every partial moved by the same Hz: inharmonic, alien, sick', knobs: [K('hz', 'shift', -600, 600, 5, -70, 'Hz'), mix(1)] },
  { id: 'chop', label: 'Chopper', group: 'mod', blurb: 'square-wave stutter', knobs: [K('f', 'rate', 2, 60, 1, 18, 'Hz'), K('d', 'depth', 0, 1, 0.05, 0.8)] },
  // ---- dirt
  { id: 'drive', label: 'Distortion', group: 'dirt', blurb: 'overdriven and clipped', knobs: [K('gain', 'drive', 0, 36, 1, 14, 'dB'), O('type', 'shape', ['tanh', 'hard', 'atan', 'cubic', 'sin'], 1)] },
  { id: 'fold', label: 'Wavefolder', group: 'dirt', blurb: 'the wave folded back on itself: snarling, buzzing meat', knobs: [K('gain', 'fold', 1, 16, 0.5, 5, 'x'), O('shape', 'shape', ['sine', 'triangle']), mix(0.7)] },
  { id: 'crush', label: 'Bitcrush', group: 'dirt', blurb: 'fewer bits, lower sample rate: broken hardware', knobs: [K('bits', 'bits', 2, 16, 1, 8), K('samples', 'downsample', 1, 40, 1, 4, 'x'), mix(0.7)] },
  { id: 'lofi', label: 'Lo-fi', group: 'dirt', blurb: 'an old recording: a dull top, a grainy log-quantised body', knobs: [K('cut', 'top', 1200, 8000, 100, 3200, 'Hz'), K('bits', 'bits', 4, 12, 1, 7)] },
  { id: 'megaphone', label: 'Megaphone', group: 'dirt', blurb: 'a horn with a blown driver: honk and crackle', knobs: [K('drive', 'drive', 0, 30, 1, 12, 'dB'), K('tone', 'honk', 600, 3000, 50, 1600, 'Hz')] },
  { id: 'radio', label: 'Radio band', group: 'tone', blurb: 'telephone / helmet comms band', knobs: [K('lo', 'low cut', 80, 1500, 10, 320, 'Hz'), K('hi', 'high cut', 1200, 9000, 100, 3400, 'Hz')] },
  { id: 'static', label: 'Static', group: 'dirt', blurb: 'comms static, crackle and dropouts: a link that is dying', knobs: [K('level', 'static', -50, -6, 1, -26, 'dB'), K('drop', 'dropouts', 0, 0.6, 0.05, 0.15), K('rate', 'drop rate', 4, 40, 1, 14, 'Hz')] },
  // ---- modulation
  { id: 'chorus', label: 'Clone army', group: 'mod', blurb: 'a crowd of you, slightly out of time', knobs: [K('n', 'voices', 2, 5, 1, 3), K('depth', 'depth', 0.5, 10, 0.5, 2.5, 'ms')] },
  { id: 'flanger', label: 'Flanger', group: 'mod', blurb: 'jet sweep, metal tube', knobs: [K('delay', 'delay', 0, 30, 1, 3, 'ms'), K('depth', 'depth', 0, 10, 0.5, 3, 'ms'), K('regen', 'feedback', -95, 95, 5, 50, '%'), K('speed', 'speed', 0.1, 10, 0.1, 0.4, 'Hz')] },
  { id: 'phaser', label: 'Phaser', group: 'mod', blurb: 'swirling notches', knobs: [K('speed', 'speed', 0.1, 2, 0.1, 0.5, 'Hz'), K('decay', 'depth', 0.1, 0.9, 0.05, 0.6)] },
  { id: 'wah', label: 'Auto-wah', group: 'mod', blurb: 'a resonant peak sweeping the voice: iron lung, mutant throat', knobs: [K('rate', 'rate', 0.1, 8, 0.1, 1.2, 'Hz'), K('lo', 'from', 250, 1500, 10, 400, 'Hz'), K('oct', 'sweep', 0.5, 4, 0.25, 2.5, 'oct'), mix(0.8)] },
  { id: 'vibrato', label: 'Vibrato', group: 'mod', blurb: 'pitch wobble: nervous android, broken tape', knobs: [K('f', 'rate', 0.5, 20, 0.5, 6, 'Hz'), K('d', 'depth', 0, 1, 0.05, 0.4)] },
  { id: 'wow', label: 'Wow & flutter', group: 'mod', blurb: 'a stretched tape on a dying motor', knobs: [K('f', 'wow rate', 0.2, 3, 0.1, 0.7, 'Hz'), K('d', 'wow', 0, 1, 0.05, 0.5), K('flutter', 'flutter', 0, 1, 0.05, 0.3)] },
  { id: 'tremolo', label: 'Tremolo', group: 'mod', blurb: 'volume wobble', knobs: [K('f', 'rate', 0.5, 40, 0.5, 8, 'Hz'), K('d', 'depth', 0, 1, 0.05, 0.6)] },
  // ---- time
  { id: 'stutter', label: 'Stutter', group: 'time', blurb: 'a slice of the opening repeated: G-G-G-GRODIUS (adds to the length)', knobs: [K('at', 'from', 0, 600, 10, 60, 'ms'), K('ms', 'slice', 40, 400, 10, 140, 'ms'), K('n', 'repeats', 1, 8, 1, 3)] },
  { id: 'reverse', label: 'Reverse', group: 'time', blurb: 'played backwards (mix it in for a backmask under the words)', knobs: [mix(1)] },
  { id: 'comb', label: 'Comb filter', group: 'weird', blurb: 'a tuned metal resonance: vent shaft, pipe, iron mask', knobs: [K('f', 'tune', 40, 1000, 5, 160, 'Hz'), K('fb', 'ring', 0, 95, 5, 80, '%'), mix(0.6)] },
  { id: 'echo', label: 'Echo', group: 'time', blurb: 'short = metal corridor, long = canyon', knobs: [K('ms', 'delay', 10, 900, 10, 120, 'ms'), K('decay', 'decay', 0.05, 0.9, 0.05, 0.4)] },
  // ---- space
  { id: 'cave', label: 'Hull reverb', group: 'space', blurb: 'the inside of a dead ship (multi-tap)', knobs: [K('size', 'size', 0.2, 3, 0.1, 1), K('decay', 'decay', 0.1, 0.8, 0.05, 0.45)] },
  { id: 'convo', label: 'Convolution', group: 'space', blurb: 'a real reverb: an impulse response grown in the graph for each room', knobs: [O('room', 'room', ROOMS), K('size', 'size', 0.5, 2, 0.05, 1), K('decay', 'decay', 0.2, 4, 0.1, 1.4, 's'), K('pre', 'pre-delay', 0, 120, 5, 15, 'ms'), mix(0.35)] },
  { id: 'revverb', label: 'Reverse reverb', group: 'space', blurb: 'the reverb arrives before the word: the horror swell (adds the swell to the length)', knobs: [K('swell', 'swell', 0.1, 0.6, 0.05, 0.35, 's'), K('decay', 'decay', 0.5, 4, 0.1, 2, 's'), mix(0.5)] },
];
const BY = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

/** an effect's knobs at their defaults */
export const defaults = (id: string): Record<string, number> => Object.fromEntries((Object.hasOwn(BY, id) ? BY[id].knobs : []).map((k) => [k.k, k.def]));

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
    const v = Object.hasOwn(x, e.id) ? (x as Record<string, unknown>)[e.id] : undefined;
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    out[e.id] = Object.fromEntries(e.knobs.map((k) => {
      const n = Object.hasOwn(v, k.k) ? (v as Record<string, unknown>)[k.k] : undefined;
      return [k.k, Math.round(snap(typeof n === 'number' && Number.isFinite(n) ? n : k.def, k) * 1e4) / 1e4];
    }));
  }
  return out;
}
// own keys of BY only: BY is a plain object, so BY.constructor / BY.toString would otherwise count as effects
export const fxOn = (fx: FxSet | null | undefined) => !!fx && Object.keys(fx).some((id) => Object.hasOwn(BY, id));
/** "robot + radio band" for a take list */
export const fxName = (fx: FxSet | null | undefined) => (fx ? EFFECTS.filter((e) => Object.hasOwn(fx, e.id) && fx[e.id]).map((e) => e.label.toLowerCase()).join(' + ') : '');

/** the presets (a starting point: every knob stays live). Values not given take the knob's default */
const P = (o: Record<string, Record<string, number>>): FxSet => cleanFx(Object.fromEntries(Object.entries(o).map(([id, v]) => [id, { ...defaults(id), ...v }])));
const room = (r: (typeof ROOMS)[number]) => ROOMS.indexOf(r);
const car = (c: (typeof CARRIERS)[number]) => CARRIERS.indexOf(c);
export const PRESETS: readonly { name: string; fx: FxSet }[] = [
  { name: 'Clean (no FX)', fx: {} },
  // ---- the originals, as they were (kept takes and saved racks name them)
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
  // ---- the controller and his comms
  { name: 'Broadcast polish', fx: P({ denoise: { nr: 10 }, gate: { thr: -44, range: 18 }, eq: { lo: 1.5, mid: -2, midf: 400, hi: 3 }, comp: { thr: -28, ratio: 3 }, deess: { i: 0.5 }, exciter: { amount: 1.5 } }) },
  { name: 'Trailer voice', fx: P({ pitch: { semi: -2, formant: 1 }, formant: { shift: -2 }, sub: { boost: 5, cutoff: 110 }, eq: { lo: 3, hi: 2 }, comp: { thr: -30, ratio: 5 }, convo: { room: room('hull'), decay: 0.9, mix: 0.15 } }) },
  { name: 'Cyborg sergeant', fx: P({ formant: { shift: -2 }, robot: { win: 1, mix: 0.3 }, comp: { thr: -30, ratio: 4 }, radio: { lo: 180, hi: 6500 }, flanger: { delay: 1, depth: 1, regen: 60, speed: 0.15 }, crush: { bits: 11, samples: 1, mix: 0.35 } }) },
  { name: 'Station PA', fx: P({ megaphone: { drive: 6, tone: 1800 }, comp: { thr: -30, ratio: 4 }, convo: { room: room('hull'), size: 1.6, decay: 1.6, pre: 30, mix: 0.3 } }) },
  { name: 'Riot megaphone', fx: P({ megaphone: { drive: 18, tone: 1400 }, echo: { ms: 170, decay: 0.25 } }) },
  { name: 'Broken comms', fx: P({ radio: { lo: 420, hi: 3000 }, crush: { bits: 7, samples: 2, mix: 0.5 }, static: { level: -22, drop: 0.25, rate: 16 }, stutter: { at: 40, ms: 70, n: 2 } }) },
  { name: 'Dead channel', fx: P({ radio: { lo: 300, hi: 3600 }, static: { level: -16, drop: 0.4, rate: 9 }, whisper: { mix: 0.25 } }) },
  // ---- machines
  { name: 'Vocoder drone', fx: P({ vocoder: { car: car('saw'), hz: 65, bands: 16, sib: 0.4 }, comp: { thr: -30, ratio: 3 }, chorus: { n: 2, depth: 1.5 } }) },
  { name: 'Pulse drone', fx: P({ vocoder: { car: car('pulse'), hz: 55, bands: 12, sib: 0.3 }, phaser: { speed: 0.2, decay: 0.5 }, convo: { room: room('plate'), decay: 1, mix: 0.2 } }) },
  { name: 'Machine whisper', fx: P({ vocoder: { car: car('noise'), bands: 20, sib: 0.6 }, formant: { shift: -2 }, convo: { room: room('locker'), decay: 0.6, mix: 0.25 } }) },
  { name: 'Dying android', fx: P({ robot: { win: 1, mix: 0.6 }, speed: { semi: -2 }, wow: { f: 0.5, d: 0.9, flutter: 0.2 }, crush: { bits: 8, samples: 2, mix: 0.5 }, stutter: { at: 50, ms: 90, n: 2 } }) },
  { name: 'Overclocked AI', fx: P({ vocoder: { car: car('saw + hiss'), hz: 140, bands: 18, mix: 0.7 }, ring: { f: 220, mix: 0.25 }, crystal: { i: 3 }, flanger: { delay: 1, depth: 2, regen: 70, speed: 1.5 } }) },
  { name: 'Meat grinder', fx: P({ pitch: { semi: -3 }, octave: { semi: -12, mix: 0.4 }, fold: { gain: 8, shape: 1, mix: 0.8 }, eq: { lo: 2, hi: -4 }, tremolo: { f: 22, d: 0.3 } }) },
  // ---- the dead, and the things that ate them
  { name: 'Hive queen', fx: P({ vocoder: { car: car('chord'), hz: 110, bands: 20, mix: 0.55 }, harmony: { a: 7, b: -12, mix: 0.4 }, chorus: { n: 4, depth: 4 }, convo: { room: room('cathedral'), decay: 2.4, mix: 0.25 } }) },
  { name: 'Corpse gurgle', fx: P({ pitch: { semi: -4 }, formant: { shift: -3 }, eq: { hi: -8, lo: 3 }, wah: { rate: 6, lo: 300, oct: 1.25, mix: 0.6 }, vibrato: { f: 13, d: 0.45 }, comb: { f: 90, fb: 60, mix: 0.35 } }) },
  { name: 'Cathedral demon', fx: P({ pitch: { semi: -6 }, octave: { semi: -12, mix: 0.6 }, drive: { gain: 6, type: 0 }, convo: { room: room('cathedral'), size: 1.4, decay: 3.2, pre: 40, mix: 0.4 } }) },
  { name: 'Reverse-swell ghost', fx: P({ whisper: { mix: 0.5 }, pitch: { semi: 1, formant: 1 }, eq: { lo: -4, hi: 3 }, revverb: { swell: 0.4, decay: 2.5, mix: 0.6 } }) },
  { name: 'Backmasked', fx: P({ reverse: { mix: 0.3 }, octave: { semi: -12, mix: 0.35 }, whisper: { mix: 0.2 }, convo: { room: room('cathedral'), decay: 2, mix: 0.3 } }) },
  { name: 'Tape horror', fx: P({ speed: { semi: -3 }, wow: { f: 0.6, d: 0.7, flutter: 0.4 }, lofi: { cut: 3400, bits: 8 }, static: { level: -36, drop: 0 } }) },
  { name: 'Slow-mo death', fx: P({ speed: { semi: -7 }, sub: { boost: 3 }, convo: { room: room('hull'), decay: 2, mix: 0.3 } }) },
  { name: 'Helium leak', fx: P({ speed: { semi: 7 }, chorus: { n: 2, depth: 1 }, tremolo: { f: 9, d: 0.25 } }) },
  { name: 'Xeno hiss', fx: P({ whisper: { mix: 0.7 }, formant: { shift: 4 }, freqshift: { hz: 40, mix: 0.5 }, exciter: { amount: 3 }, phaser: { speed: 0.8, decay: 0.6 } }) },
  { name: 'Bode alien', fx: P({ freqshift: { hz: -120 }, flanger: { delay: 2, depth: 3, regen: 60, speed: 0.25 }, convo: { room: room('plate'), decay: 1.2, mix: 0.2 } }) },
  { name: 'Insectoid', fx: P({ formant: { shift: 10 }, pitch: { semi: 3 }, freqshift: { hz: 25, mix: 0.6 }, tremolo: { f: 32, d: 0.5 }, vibrato: { f: 10, d: 0.3 } }) },
  { name: 'Giant', fx: P({ formant: { shift: -7 }, pitch: { semi: -2, formant: 1 }, sub: { boost: 4, cutoff: 90 }, convo: { room: room('hull'), size: 2, decay: 1.5, mix: 0.2 } }) },
  { name: 'Imp', fx: P({ formant: { shift: 8 }, pitch: { semi: 4 }, vibrato: { f: 9, d: 0.2 }, convo: { room: room('locker'), decay: 0.4, mix: 0.2 } }) },
  { name: 'Ring wraith', fx: P({ ring: { f: 75, mix: 0.7 }, formant: { shift: -3 }, whisper: { mix: 0.2 }, convo: { room: room('cathedral'), decay: 2.6, mix: 0.3 } }) },
  { name: 'Corpse choir', fx: P({ harmony: { a: 7, b: -5, mix: 0.5 }, octave: { semi: -12, mix: 0.3 }, chorus: { n: 4, depth: 3 }, convo: { room: room('cathedral'), decay: 3, mix: 0.35 } }) },
  { name: 'Abyss calling', fx: P({ pitch: { semi: -7 }, octave: { semi: -24, mix: 0.4 }, whisper: { mix: 0.3 }, revverb: { swell: 0.3, decay: 3, mix: 0.45 } }) },
  // ---- places
  { name: 'Vent crawler', fx: P({ comb: { f: 260, fb: 85, mix: 0.6 }, radio: { lo: 250, hi: 5000 }, convo: { room: room('locker'), size: 0.7, decay: 0.5, mix: 0.3 } }) },
  { name: 'Sewer thing', fx: P({ pitch: { semi: -5 }, formant: { shift: -2 }, comb: { f: 70, fb: 50, mix: 0.3 }, convo: { room: room('sewer'), decay: 2.2, mix: 0.45 } }) },
  { name: 'Iron lung', fx: P({ wah: { rate: 0.35, lo: 350, oct: 2 }, comp: { thr: -30, ratio: 4 }, phaser: { speed: 0.15, decay: 0.5 }, convo: { room: room('hull'), decay: 1, mix: 0.2 } }) },
  { name: 'Stuck signal', fx: P({ stutter: { at: 30, ms: 120, n: 4 }, crush: { bits: 7, samples: 3, mix: 0.6 }, radio: { lo: 300, hi: 4500 } }) },
];

/** the clean-up tools (dynamics, EQ) stay out of a random rack: a random gate or EQ is a broken take, not a voice */
const NO_RANDOM = new Set(['denoise', 'gate', 'comp', 'deess', 'eq', 'exciter', 'crystal', 'sub']);
/** a random rack: 2-5 effects at random settings, mostly mild so the words survive. rnd = Math.random in the page */
export function randomFx(rnd: () => number = Math.random): FxSet {
  const pool = EFFECTS.map((e) => e.id).filter((id) => !NO_RANDOM.has(id) && (id !== 'whisper' || rnd() < 0.3));
  const n = 2 + Math.floor(rnd() * 4), out: Record<string, Record<string, number>> = {};
  while (Object.keys(out).length < n && pool.length) {
    const id = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    out[id] = Object.fromEntries(BY[id].knobs.map((k) => {
      // mixes, depths and dropouts lean low so a random rack stays a voice, not noise; a stutter repeats a few times
      const t = k.k === 'mix' || k.k === 'd' || k.k === 'drop' ? rnd() * 0.75 + 0.15 : id === 'stutter' && k.k === 'n' ? rnd() * 0.4 : rnd();
      return [k.k, k.min + t * (k.max - k.min)];
    }));
  }
  if (out.radio && out.radio.hi < out.radio.lo + 800) out.radio.hi = Math.min(9000, out.radio.lo + 1500);
  return cleanFx(out);
}

const SR = 44100;
/** the level the graph works at (LUFS) when fxGraph is told the take's: the drive, crush, gate, compressor, folder
 *  and static are level-dependent, so a quiet take and a loud one get the same rack */
export const FX_LEVEL = -20;
/** the most a rack adds after the voice ends (s): echo and reverb tails ring into it and fade out by its end. The
 *  hype lines' limit is 2.5 s for a 2 s target (slots.ts), and a take already keeps 0.25 s after its last word */
export const FX_TAIL = 0.3;
const WIN = [256, 512, 1024, 2048];
const CLIP = ['tanh', 'hard', 'atan', 'cubic', 'sin'];
const f4 = (n: number) => String(Math.round(n * 1e4) / 1e4);
const f6 = (n: number) => String(Math.round(n * 1e6) / 1e6);
const lin = (db: number) => 10 ** (db / 20);
/** gain (dB) that brings a new effect's output back to about its input's loudness (measured with the chain probe's
 *  voice at the defaults), so its mix knob is a balance and not a level change. The original sixteen effects have
 *  none: kept takes name them, and a reprocess must sound the same */
const COMP: Record<string, number> = { vocoder: 5.5, fold: -12, lofi: -1, wah: -1, comb: 5 };

/** the rubberband pitch shifter at high quality: r = the pitch ratio */
const rb = (r: number, formant: number) => `rubberband=pitch=${f6(r)}:pitchq=quality:formant=${FORMANT[formant] ?? 'shifted'}`;
const ratio = (semi: number) => 2 ** (semi / 12);
/** ffmpeg's vibrato reads its delay line before it has written it: now and then (1 run in 7, measured) the first
 *  samples come out NaN, which the loudness meter reads as a silent take. 20 ms of silence ahead of it fills the line
 *  with zeros; it is cut off again after */
const vib = (f: string) => `adelay=delays=20:all=1,${f},atrim=start=0.02,asetpts=PTS-STARTPTS`;
/** the vocoder's carriers, F the note (Hz): naive waveforms (the band-passes filter them), a minor triad, white noise */
const CARRIER = [
  (F: string) => `2*mod(t*${F},1)-1`,
  (F: string) => `2*lt(mod(t*${F},1),0.22)-1`,
  (F: string) => `(2*mod(t*${F},1)+2*mod(t*${F}*1.1892,1)+2*mod(t*${F}*1.4983,1)-3)/3`,
  () => `random(0)*2-1`,
  (F: string) => `0.8*(2*mod(t*${F},1)-1)+0.4*(random(0)*2-1)`,
];
/** the power (mean square) a carrier puts through one vocoder band: the band-pass pair's response (|H|^4, the RBJ
 *  constant-peak band-pass, unwarped) summed over the carrier's harmonics (amplitude a_k at frequency f_k), or over
 *  the band for white noise. The band's carrier is turned up by 1/sqrt of it, so every band carries the voice's own
 *  level: the vocoder's output follows the voice's spectrum whatever the carrier, the note or the band count */
const H4 = (f: number, fc: number, Q: number) => { const x = f / fc, h = (x / Q) ** 2 / ((1 - x * x) ** 2 + (x / Q) ** 2); return h * h; };
const harm = (F: number, fc: number, Q: number, a: (k: number) => number) => {
  let p = 0;
  for (let k = 1; k * F < SR / 2; k++) p += (a(k) ** 2 / 2) * H4(k * F, fc, Q);
  return p;
};
const noiseP = (fc: number, Q: number) => {
  let p = 0;
  for (let f = 1; f < SR / 2; f += 2) p += H4(f, fc, Q) * 2;
  return (p * (1 / 3)) / (SR / 2);
};
const saw = (k: number) => 2 / (Math.PI * k);
const CARRIER_P = [
  (F: number, fc: number, Q: number) => harm(F, fc, Q, saw),
  (F: number, fc: number, Q: number) => harm(F, fc, Q, (k) => (4 / (Math.PI * k)) * Math.abs(Math.sin(Math.PI * k * 0.22))),
  (F: number, fc: number, Q: number) => [1, 1.1892, 1.4983].reduce((p, m) => p + harm(F * m, fc, Q, saw) / 9, 0),
  (_F: number, fc: number, Q: number) => noiseP(fc, Q),
  (F: number, fc: number, Q: number) => 0.64 * harm(F, fc, Q, saw) + 0.16 * noiseP(fc, Q),
];
/** the convolution rooms: an impulse response of decaying noise, shaped. lp/hp: the room's colour (Hz); at: the onset
 *  build-up (s, times size); modes: metal resonances (Hz, over size); flutter: a parallel-wall flutter echo period
 *  (s, times size) */
const ROOM = [
  { lp: 5200, hp: 110, at: 0.004, modes: [310, 870, 1630], flutter: 0 }, // hull: metal, ringing
  { lp: 6500, hp: 260, at: 0.001, modes: [520], flutter: 0.011 }, // locker: small, boxy, close walls
  { lp: 3000, hp: 70, at: 0.03, modes: [], flutter: 0 }, // cathedral: dark, a slow bloom
  { lp: 10000, hp: 420, at: 0.0005, modes: [], flutter: 0 }, // plate: bright, instant, dense
  { lp: 1700, hp: 60, at: 0.008, modes: [140], flutter: 0.045 }, // sewer: a wet brick tube
];
/** an impulse response (a finite aevalsrc source) for a room: rt = RT60 (s) */
const irSrc = (ri: number, size: number, rt: number) => {
  const R = ROOM[ri] ?? ROOM[0], len = Math.min(4, rt * 1.05);
  const fl = R.flutter ? `*(1+2*lt(mod(t,${f6(R.flutter * size)}),0.0015))` : '';
  const modes = R.modes.map((f) => `,equalizer=f=${f4(f / size)}:t=q:w=7:g=9`).join('');
  return `aevalsrc=exprs='(random(0)*2-1)*exp(-6.9078*t/${f4(rt)})*(1-exp(-t/${f6(R.at * size)}))${fl}':s=${SR}:d=${f4(len)},` +
    `aformat=sample_fmts=flt:channel_layouts=mono,lowpass=f=${R.lp},highpass=f=${R.hp}${modes}`;
};

/** the take as processTake knows it: its length (s) and loudness (LUFS) before the rack. Both optional */
export type TakeInfo = { dur?: number | null; lufs?: number | null };

/** an FxSet -> an ffmpeg -filter_complex graph from [0:a] to [fx], or null when the rack is empty. Built from
 *  cleanFx() numbers only. Wet/dry knobs split the signal, run the effect on one side and mix them back.
 *  Given the take's loudness, the graph first brings it to FX_LEVEL; given its length, the rack's tail (echo, reverb)
 *  ends FX_TAIL past the voice, faded out */
export function fxGraph(raw: FxSet | null | undefined, take: TakeInfo | null = {}): string | null {
  const fx = cleanFx(raw);
  if (!fxOn(fx)) return null;
  const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
  const lufs = num(take?.lufs, -100, 20);
  const g: string[] = [];
  let n = 0, cur = 'a0';
  /** the voice's length so far (null: unknown); the tail padded on so far; whether the voice's length changed */
  let len = num(take?.dur, 0.01, 600), padded = 0, moved = false;
  const pre = lufs == null ? '' : `,volume=${f4(Math.max(-40, Math.min(40, FX_LEVEL - lufs)))}dB`;
  g.push(`[0:a]aformat=sample_fmts=flt:channel_layouts=mono,aresample=${SR}${pre}[a0]`);
  const lbl = (p: string) => `${p}${++n}`;
  const step = (ins: string[], f: string, outs: string[]) => g.push(`${ins.map((i) => `[${i}]`).join('')}${f}${outs.map((o) => `[${o}]`).join('')}`);
  const on = (i: string, f: string) => { const o = lbl('s'); step([i], f, [o]); return o; };
  const serial = (f: string) => { cur = on(cur, f); };
  const comp = (id: string) => (COMP[id] ? `,volume=${f4(COMP[id])}dB` : '');
  type Build = (i: string) => string;
  /** an effect on the wet side of a split, mixed back with the dry at m (0 skips it, 1 runs it in series) */
  const wet = (f: string | Build, m: number) => {
    if (m <= 0) return;
    const b: Build = typeof f === 'string' ? (i) => on(i, f) : f;
    if (m >= 1) { cur = b(cur); return; }
    const i = ++n;
    g.push(`[${cur}]asplit[d${i}][w${i}]`);
    const x = b(`w${i}`);
    g.push(`[d${i}][${x}]amix=inputs=2:weights='${f4(1 - m)} ${f4(m)}':normalize=0:duration=first[s${i}]`);
    cur = `s${i}`;
  };
  /** pads the tail (once, shared by every effect after it) to what this effect needs, up to FX_TAIL */
  const pad = (need: number) => {
    const add = Math.round((Math.min(need, FX_TAIL) - padded) * 1e4) / 1e4;
    if (add > 0.001) { serial(`apad=pad_dur=${f4(add)}`); padded += add; }
  };
  /** a convolution with an impulse response made in the graph (afir, energy-normalised), after a pre-delay */
  const conv = (i: string, ir: string, preMs: number) => {
    const w = preMs > 0 ? on(i, `adelay=delays=${f4(preMs)}:all=1`) : i, r = lbl('ir'), o = lbl('cv');
    step([], ir, [r]);
    step([w, r], 'afir=irnorm=2', [o]);
    return o;
  };

  for (const e of EFFECTS) {
    const v = fx[e.id];
    if (!v) continue;
    switch (e.id) {
      case 'denoise': serial(`afftdn=nr=${f4(v.nr)}:nf=${f4(v.nf)}:tn=1`); break;
      case 'gate': serial(`agate=threshold=${f6(lin(v.thr))}:range=${f6(lin(-v.range))}:ratio=20:attack=${f4(v.attack)}:release=${f4(v.release)}:knee=2:detection=peak`); break;
      case 'eq': serial(`lowshelf=f=180:g=${f4(v.lo)},equalizer=f=${f4(v.midf)}:t=o:w=1.2:g=${f4(v.mid)},highshelf=f=4500:g=${f4(v.hi)}`); break;
      // with a make-up gain for what it takes off a voice at FX_LEVEL (its syllables sit ~5 dB over it), so what comes
      // after it (a drive, a crush) sees the level it would without it
      case 'comp': serial(`acompressor=threshold=${f4(v.thr)}dB:ratio=${f4(v.ratio)}:attack=${f4(v.attack)}:release=${f4(v.release)}:knee=4,volume=${f4(Math.max(0, FX_LEVEL + 5 - v.thr) * (1 - 1 / v.ratio))}dB`); break;
      case 'deess': serial(`deesser=i=${f4(v.i)}:m=${f4(v.m)}:f=${f4(v.f)}:s=o`); break;
      case 'exciter': serial(`aexciter=amount=${f4(v.amount)}:drive=${f4(v.drive)}:freq=${f4(v.freq)}:blend=0`); break;
      case 'crystal': serial(`crystalizer=i=${f4(v.i)}:c=1`); break;
      case 'sub': serial(`asubboost=dry=1:wet=0.8:boost=${f4(v.boost)}:decay=0.3:feedback=0.6:cutoff=${f4(v.cutoff)}:slope=0.5:delay=20`); break;
      case 'pitch': if (v.semi) serial(rb(ratio(v.semi), v.formant)); break;
      case 'formant': {
        // rubberband moves the pitch by 1/r and stretches the take by r, keeping the formants; then the take is sped
        // up by r (pitch, formants and length together): the pitch and the length are back, the formants moved by r.
        // Measured on a sung vowel (spectral centroid): -6 st moves the formants 0.73x (ideal 0.71), +6 st 1.12x
        // (ideal 1.41): rubberband keeps formants well on an upward shift, poorly on a downward one, which the imp
        // side needs. Down is the strong side; up is subtle under +6
        if (!v.shift) break;
        const r = ratio(v.shift);
        serial(`rubberband=tempo=${f6(1 / r)}:pitch=${f6(1 / r)}:formant=preserved:pitchq=quality,asetrate=${Math.round(SR * r)},aresample=${SR}`);
        break;
      }
      case 'speed': {
        if (!v.semi) break;
        const r = ratio(v.semi);
        serial(`asetrate=${Math.round(SR * r)},aresample=${SR}`);
        if (len != null) len /= r;
        moved = true;
        break;
      }
      // the low voice sits under the dry one; mix is how loud it is
      case 'octave': wet(rb(ratio(v.semi), 0), v.mix); break;
      case 'harmony': {
        const iv = [v.a, v.b].filter((s) => s !== 0);
        if (!iv.length) break;
        wet((i) => {
          const ins = iv.map(() => lbl('hv'));
          step([i], `asplit=${iv.length}`, ins);
          const outs = iv.map((s, j) => on(ins[j], rb(ratio(s), 0)));
          if (outs.length === 1) return outs[0];
          const o = lbl('hm');
          step(outs, `amix=inputs=2:normalize=0:duration=first,volume=0.7071`, [o]);
          return o;
        }, v.mix);
        break;
      }
      case 'robot': wet(`afftfilt=real='hypot(re,im)':imag='0':win_size=${WIN[v.win] ?? 512}:overlap=0.75`, v.mix); break;
      case 'whisper': wet(`afftfilt=real='hypot(re,im)*cos((random(0)*2-1)*2*3.14)':imag='hypot(re,im)*sin((random(1)*2-1)*2*3.14)':win_size=128:overlap=0.8`, v.mix); break;
      case 'vocoder': {
        // a channel vocoder: the voice (the modulator) and a generated carrier through the same bank of log-spaced
        // band-passes (two in series per band: 4 poles); each voice band's envelope (|x| through a 40 Hz low-pass)
        // multiplies its carrier band, and the bands sum. The voice's own top (6 kHz up) goes back in (hiss) so the
        // consonants stay words. The carrier is an endless source: amultiply ends with the voice
        const N = Math.round(v.bands), lo = 110, hi = 7000, B = Math.log2(hi / lo) / N, Q = Math.sqrt(2 ** B) / (2 ** B - 1);
        const src = (CARRIER[v.car] ?? CARRIER[0])(f4(v.hz)), cp = CARRIER_P[v.car] ?? CARRIER_P[0];
        wet((i) => {
          const ms = Array.from({ length: N }, () => lbl('vm')), cs = Array.from({ length: N }, () => lbl('vc')), hs = lbl('vh'), bands: string[] = [];
          step([i], `asplit=${N + 1}`, [...ms, hs]);
          step([], `aevalsrc=exprs='${src}':s=${SR},aformat=sample_fmts=flt:channel_layouts=mono,asplit=${N}`, cs);
          for (let j = 0; j < N; j++) {
            const fc = lo * (hi / lo) ** ((j + 0.5) / N), bp = `bandpass=f=${f4(fc)}:width_type=q:w=${f4(Q)}`;
            const env = on(ms[j], `${bp},${bp},aeval=exprs='abs(val(0))':c=same,lowpass=f=40`);
            // a band the carrier barely reaches (a high note's lowest bands) is turned up 30 dB at most
            const cb = on(cs[j], `${bp},${bp},volume=${f4(Math.min(30, -10 * Math.log10(Math.max(1e-12, cp(v.hz, fc, Q)))))}dB`);
            const o = lbl('vb');
            step([env, cb], 'amultiply', [o]);
            bands.push(o);
          }
          bands.push(on(hs, `highpass=f=6000,highpass=f=6000,volume=${f4(v.sib)}`));
          const o = lbl('vo');
          step(bands, `amix=inputs=${bands.length}:normalize=0:duration=first${comp('vocoder')}`, [o]);
          return o;
        }, v.mix);
        break;
      }
      case 'ring': wet(`aeval=exprs='val(0)*sin(2*PI*${f4(v.f)}*t)':c=same`, v.mix); break;
      case 'freqshift': if (v.hz) wet(`afreqshift=shift=${f4(v.hz)}:level=1:order=8${comp('freqshift')}`, v.mix); break;
      case 'chop': serial(`aeval=exprs='val(0)*(1-${f4(v.d)}*lt(sin(2*PI*${f4(v.f)}*t),0))':c=same`); break;
      case 'drive': serial(`volume=${f4(v.gain)}dB,asoftclip=type=${CLIP[v.type] ?? 'tanh'},volume=${f4(-v.gain * 0.6)}dB`); break;
      case 'fold': {
        // sin(g x) folds a peak past pi/2 back down; the triangle folds linearly (asin of sin); a low-pass tames the alias
        const x = `${f4(v.gain)}*val(0)`, f = v.shape ? `asin(sin(${x}))*0.6366` : `sin(${x})`;
        wet(`aeval=exprs='${f}':c=same,lowpass=f=9000${comp('fold')}`, v.mix);
        break;
      }
      case 'crush': serial(`acrusher=bits=${f4(v.bits)}:samples=${f4(v.samples)}:mix=${f4(v.mix)}:mode=lin:aa=0.5`); break;
      case 'lofi': {
        const s = Math.max(1, Math.round(SR / (2.4 * v.cut)));
        serial(`highpass=f=180,acrusher=bits=${f4(v.bits)}:samples=${s}:mix=1:mode=log:aa=0.8,lowpass=f=${f4(v.cut)},lowpass=f=${f4(v.cut)},asoftclip=type=tanh${comp('lofi')}`);
        break;
      }
      case 'megaphone': serial(`highpass=f=500,highpass=f=500,lowpass=f=4200,lowpass=f=4200,equalizer=f=${f4(v.tone)}:t=q:w=1.4:g=9,volume=${f4(v.drive)}dB,asoftclip=type=atan,volume=${f4(-v.drive * 0.7)}dB,highpass=f=400,lowpass=f=5000${comp('megaphone')}`); break;
      case 'radio': serial(`highpass=f=${f4(v.lo)}:poles=2,lowpass=f=${f4(Math.max(v.hi, v.lo + 200))}:poles=2,highpass=f=${f4(v.lo)}:poles=2`); break;
      case 'static': {
        // band-limited noise (with the odd crackle) under the voice, `level` dB under FX_LEVEL; then the dropouts: a
        // pseudo-random draw held for 1/rate s (a sine hash of the slot number) mutes the link under `drop`
        const nz = lbl('nz'), mx = lbl('sm');
        step([], `aevalsrc=exprs='(random(0)*2-1)+gt(random(1),0.9993)*(random(2)*2-1)*6':s=${SR},aformat=sample_fmts=flt:channel_layouts=mono,highpass=f=900,lowpass=f=5000,volume=${f4(v.level + FX_LEVEL + 17)}dB`, [nz]);
        step([cur, nz], 'amix=inputs=2:normalize=0:duration=first', [mx]);
        cur = mx;
        if (v.drop > 0) serial(`aeval=exprs='val(0)*(1-0.97*lt(mod(abs(sin(floor(t*${f4(v.rate)})*12.9898+78.233)*43758.5453),1),${f4(v.drop)}))':c=same`);
        break;
      }
      case 'chorus': {
        const k = Math.round(v.n), d = Array.from({ length: k }, (_, i) => 35 + i * 14), dec = d.map((_, i) => f4(0.45 - i * 0.05)),
          sp = d.map((_, i) => f4(0.2 + i * 0.13)), dp = d.map(() => f4(v.depth));
        serial(`chorus=0.6:0.8:${d.join('|')}:${dec.join('|')}:${sp.join('|')}:${dp.join('|')}`);
        break;
      }
      case 'flanger': serial(`flanger=delay=${f4(v.delay)}:depth=${f4(v.depth)}:regen=${f4(v.regen)}:speed=${f4(v.speed)}:width=70`); break;
      case 'phaser': serial(`aphaser=in_gain=0.6:out_gain=0.9:delay=3:decay=${f4(v.decay)}:speed=${f4(v.speed)}:type=t`); break;
      case 'wah': {
        // a spectral peak (a bump on a log-frequency axis, ~1/3 octave wide, +12 dB over a -6 dB floor) whose centre
        // sweeps `oct` octaves up from `lo` and back on a raised cosine. afftfilt's pts counts samples
        const fc = `${f4(v.lo)}*pow(2,${f4(v.oct)}*(0.5-0.5*cos(2*PI*${f4(v.rate)}*pts/sr)))`;
        const G = `(0.5+4*exp(-pow(log((b+0.5)*sr/(2*nb)/(${fc})),2)*18))`;
        wet(`afftfilt=real='re*${G}':imag='im*${G}':win_size=1024:overlap=0.75${comp('wah')}`, v.mix);
        break;
      }
      case 'vibrato': if (v.d > 0) serial(vib(`vibrato=f=${f4(v.f)}:d=${f4(v.d)}`)); break;
      case 'wow': {
        // wow: a slow, deep pitch drift; flutter: a fast, shallow one (vibrato's depth is a share of a fixed delay
        // swing, so at 11 Hz it is scaled down to stay a flutter)
        const fs = [v.d > 0 ? `vibrato=f=${f4(v.f)}:d=${f4(v.d)}` : '', v.flutter > 0 ? `vibrato=f=11.3:d=${f4(v.flutter * 0.12)}` : ''].filter(Boolean);
        if (fs.length) serial(vib(fs.join(',')));
        break;
      }
      case 'tremolo': if (v.d > 0) serial(`tremolo=f=${f4(v.f)}:d=${f4(v.d)}`); break;
      case 'stutter': {
        // the take up to `at`, the slice [at, at + ms] n times (a 3 ms fade in and a 6 ms fade out on each, so the
        // seams don't click), then the take from `at` on
        let at = v.at / 1000, d = v.ms / 1000;
        if (len != null) { d = Math.min(d, len); at = Math.min(at, Math.max(0, len - d)); }
        const k = Math.round(v.n), head = at > 0.001, outs = Array.from({ length: k + 1 + (head ? 1 : 0) }, () => lbl('st')), parts: string[] = [];
        step([cur], `asplit=${outs.length}`, outs);
        const o0 = head ? 1 : 0;
        if (head) parts.push(on(outs[0], `atrim=end=${f4(at)},asetpts=PTS-STARTPTS`));
        for (let j = 0; j < k; j++) parts.push(on(outs[o0 + j], `atrim=start=${f4(at)}:end=${f4(at + d)},asetpts=PTS-STARTPTS,afade=t=in:d=0.003,afade=t=out:st=${f4(Math.max(0, d - 0.006))}:d=0.006`));
        parts.push(on(outs[o0 + k], `atrim=start=${f4(at)},asetpts=PTS-STARTPTS,afade=t=in:d=0.003`));
        const o = lbl('su');
        step(parts, `concat=n=${parts.length}:v=0:a=1`, [o]);
        cur = o;
        if (len != null) len += k * d;
        moved = true;
        break;
      }
      case 'reverse': wet('areverse', v.mix); break;
      // a feedback comb (a flanger that never sweeps): a resonance at f and its harmonics; fb is how long it rings
      case 'comb': wet(`flanger=delay=${f4(1000 / v.f)}:depth=0:regen=${f4(v.fb)}:width=100:speed=0.1${comp('comb')}`, v.mix); break;
      // padded first, so the repeats ring out past the last word instead of being cut with it (up to FX_TAIL)
      case 'echo': pad((v.ms / 1000) * 3); serial(`aecho=0.8:0.8:${f4(v.ms)}:${f4(v.decay)}`); break;
      case 'cave': {
        const taps = [43, 79, 113, 151, 197].map((t) => Math.round(t * v.size)), dec = taps.map((_, i) => f4(v.decay * (1 - i * 0.16)));
        pad(0.25 * v.size + v.decay);
        serial(`aecho=0.8:0.7:${taps.join('|')}:${dec.join('|')}`);
        break;
      }
      case 'convo': {
        if (v.mix <= 0) break;
        pad(v.decay + v.pre / 1000);
        wet((i) => conv(i, irSrc(v.room, v.size, v.decay), v.pre), v.mix);
        break;
      }
      case 'revverb': {
        // backwards, `swell` s of room on the end for the reverb to ring into, the reverb (a plate), forwards again:
        // the tail now leads into the word. Faded in over the swell (the reverb was cut where the pad ended)
        if (v.mix <= 0) break;
        serial(`areverse,apad=pad_dur=${f4(v.swell)}`);
        wet((i) => on(conv(i, irSrc(3, 1, v.decay), 0), 'lowpass=f=6000'), v.mix);
        serial(`areverse,afade=t=in:d=${f4(v.swell)}:curve=qsin`);
        if (len != null) len += v.swell;
        moved = true;
        break;
      }
    }
  }
  // given the take's length: the tail ends FX_TAIL past the voice, faded out over the pad; a rack that moved the voice
  // (speed, stutter, a swell) is cut where the voice now ends
  if (len != null && (padded > 0 || moved)) serial(`${padded > 0 ? `afade=t=out:st=${f4(len)}:d=${f4(padded)},` : ''}atrim=end=${f4(len + padded)}`);
  // a rack whose every effect was a no-op (pitch 0, depth 0, mix 0) still passes the signal through
  g.push(`[${cur}]anull[fx]`);
  return g.join(';');
}
