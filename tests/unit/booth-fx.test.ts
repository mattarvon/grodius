// The voice booth's FX rack (tools/booth/fx.ts): cleanFx is the only door from a request to ffmpeg, so it must keep
// known effects and knobs only, as in-range numbers on their step; fxGraph builds a graph from those numbers alone.
// The graphs themselves are run through real ffmpeg by tests/integration/booth-fx-ffmpeg.test.ts and
// `node tools/booth/chain-probe.mjs --fx`.
import { describe, expect, it } from 'vitest';
import { EFFECTS, FX_LEVEL, FX_TAIL, GROUPS, PRESETS, cleanFx, defaults, fxGraph, fxName, fxOn, randomFx, type FxSet } from '../../tools/booth/fx';
import { fxParam } from '../../tools/booth/plugin';

/** a seeded LCG, as chain-probe.mjs uses */
const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
/** every character a graph may carry: filter names, numbers, the graph's own punctuation and the quoted expressions */
const GRAPH_OK = /^[A-Za-z0-9[\]:;=,'|.\-()*+/_ ]+$/;
const knob = (e: string, k: string) => EFFECTS.find((x) => x.id === e)!.knobs.find((x) => x.k === k)!;
const onGrid = (v: number, k: { min: number; step: number }) => Math.abs((v - k.min) / k.step - Math.round((v - k.min) / k.step)) < 1e-6;

const HOSTILE: unknown[] = [
  { pitch: { semi: '1;volume=100' } },
  { pitch: '1;volume=100' },
  { ring: { f: "45':c=same[x];[x]amovie=/etc/passwd" } },
  { 'robot;volume=100': { mix: 1 } },
  { robot: { mix: 1, 'win_size=1,amovie=x': 3 } },
  { __proto__: { pitch: { semi: 5 } } },
  JSON.parse('{"__proto__":{"pitch":{"semi":5}},"constructor":{"x":1},"toString":{}}'),
  { echo: { ms: Infinity, decay: NaN } },
  { echo: { ms: 1e308, decay: -1e308 } },
  { crush: { bits: [8], samples: { valueOf: () => 4 }, mix: true } },
  { radio: { lo: 9000, hi: 80 } },
  { drive: { gain: 1e-12, type: 99 } },
  { vocoder: { car: "0':exprs='amovie=x'", hz: '82;volume=100', bands: 1e9, sib: -5, mix: 'all' } },
  { convo: { room: 99, size: '2', decay: 1e6, pre: -1, mix: 2 }, revverb: { swell: 'volume=100', decay: [], mix: {} } },
  { stutter: { at: -1e9, ms: 1e9, n: 1e9 }, speed: { semi: '12;amovie=x' }, static: { level: 1e9, drop: 'x', rate: 0 } },
  { formant: { shift: '1;volume=100' }, harmony: { a: '7', b: null, mix: NaN }, wah: { rate: Infinity, lo: -Infinity, oct: '4' } },
  { gate: { thr: 1e9, range: -1e9, attack: 'x', release: '1,amovie=x' }, comp: { thr: 1e9, ratio: 0, attack: -1, release: 1e9 } },
  Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, k.max * 1000]))])),
  Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, -1e9]))])),
  Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, k.min + 1e-7]))])),
];

describe('cleanFx', () => {
  it('rejects anything but a plain object', () => {
    for (const x of [null, undefined, 0, 1, '', 'pitch', '{"pitch":{}}', [], [{ pitch: {} }], true, () => ({ pitch: {} })]) expect(cleanFx(x)).toEqual({});
  });
  it('drops unknown effects and unknown knobs; an effect given as a non-object is off', () => {
    expect(cleanFx({ bogus: { x: 1 }, pitch: { semi: 2, extra: 9 }, robot: 'on', ring: [45], echo: null })).toEqual({ pitch: { semi: 2, formant: 0 } });
  });
  it('clamps every knob to its range and snaps it to its step', () => {
    for (const e of EFFECTS) for (const k of e.knobs) {
      expect(cleanFx({ [e.id]: { [k.k]: k.max + 1e6 } })[e.id][k.k], `${e.id}.${k.k} high`).toBe(k.max);
      expect(cleanFx({ [e.id]: { [k.k]: k.min - 1e6 } })[e.id][k.k], `${e.id}.${k.k} low`).toBe(k.min);
      const v = cleanFx({ [e.id]: { [k.k]: k.min + k.step * 1.4 } })[e.id][k.k];
      expect(v, `${e.id}.${k.k} snap`).toBeCloseTo(Math.min(k.max, k.min + k.step), 9);
      expect(onGrid(v, k)).toBe(true);
    }
    expect(cleanFx({ pitch: { semi: 2.3 } }).pitch.semi).toBe(2.5);
    expect(cleanFx({ ring: { f: 47.4, mix: 0.33 } }).ring).toEqual({ f: 45, mix: 0.35 });
  });
  it('puts a missing, non-numeric or non-finite knob at its default', () => {
    for (const bad of [undefined, null, '3', '1;volume=100', NaN, Infinity, -Infinity, [3], { v: 3 }, true]) {
      expect(cleanFx({ pitch: { semi: bad } }).pitch.semi).toBe(knob('pitch', 'semi').def);
    }
    expect(cleanFx({ flanger: {} }).flanger).toEqual(defaults('flanger'));
  });
  it('never lets a string through anywhere, and only known ids and knobs as keys', () => {
    for (const h of HOSTILE) {
      const c = cleanFx(h);
      for (const [id, v] of Object.entries(c)) {
        const e = EFFECTS.find((x) => x.id === id);
        expect(e, id).toBeDefined();
        expect(Object.keys(v).sort()).toEqual(e!.knobs.map((k) => k.k).sort());
        for (const [kk, n] of Object.entries(v)) {
          const k = knob(id, kk);
          expect(typeof n).toBe('number');
          expect(n).toBeGreaterThanOrEqual(k.min);
          expect(n).toBeLessThanOrEqual(k.max);
        }
      }
      expect(JSON.stringify(c)).not.toMatch(/volume|passwd|amovie|;/);
    }
  });
  it('reads own keys only: an inherited effect or knob is not taken', () => {
    const proto = { pitch: { semi: 5 } }, knobs = Object.create({ semi: 7 });
    expect(cleanFx(Object.create(proto))).toEqual({});
    expect(cleanFx({ pitch: knobs }).pitch.semi).toBe(knob('pitch', 'semi').def);
  });
  it('is idempotent, and keeps every default on the grid', () => {
    for (const e of EFFECTS) {
      expect(cleanFx({ [e.id]: defaults(e.id) })).toEqual({ [e.id]: defaults(e.id) });
      for (const k of e.knobs) expect(onGrid(k.def, k), `${e.id}.${k.k}`).toBe(true);
    }
    for (const p of PRESETS) expect(cleanFx(p.fx), p.name).toEqual(p.fx);
  });
});

describe('fxOn / fxName', () => {
  it('is on only for a known effect', () => {
    expect(fxOn(null)).toBe(false);
    expect(fxOn({})).toBe(false);
    expect(fxOn({ robot: defaults('robot') })).toBe(true);
    // an inherited Object key is not an effect (fxOn on uncleaned input)
    expect(fxOn({ constructor: {}, toString: {}, __proto__x: {} } as unknown as FxSet)).toBe(false);
    expect(fxOn(JSON.parse('{"__proto__":{}}'))).toBe(false);
  });
  it('names the rack in its running order', () => {
    expect(fxName({ radio: {}, robot: {} } as FxSet)).toBe('robot + radio band');
    expect(fxName(undefined)).toBe('');
  });
});

describe('fxGraph', () => {
  const shape = (g: string | null) => {
    expect(g).not.toBeNull();
    expect(g!.startsWith('[0:a]')).toBe(true);
    expect(g!.endsWith('[fx]')).toBe(true);
    expect(g!).toMatch(GRAPH_OK);
    // every label used as an input was made by an earlier step; every label is made once and used once (ffmpeg
    // refuses an output pad left unconnected), and [fx] is the only one left over
    const made = new Set(['0:a']), used = new Set<string>();
    for (const step of g!.split(';')) {
      const ins = [...step.matchAll(/^((?:\[[^\]]+\])+)/g)][0]?.[1].match(/[^[\]]+/g) ?? [];
      for (const i of ins) {
        expect(made.has(i), `${i} in ${step}`).toBe(true);
        expect(used.has(i), `${i} used twice`).toBe(false);
        used.add(i);
      }
      for (const o of [...step.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).slice(ins.length)) {
        expect(made.has(o), `${o} made twice`).toBe(false);
        made.add(o);
      }
      // a step with no input is a source: only the carriers, the static and the impulse responses
      if (!ins.length && !step.startsWith('[')) expect(step, step).toMatch(/^aevalsrc=exprs='/);
    }
    expect([...made].filter((l) => !used.has(l))).toEqual(['fx']);
  };
  it('is null for an empty, bogus or missing rack', () => {
    for (const x of [{}, null, undefined, { bogus: {} }, { pitch: 'x' }] as unknown[]) expect(fxGraph(x as FxSet)).toBeNull();
  });
  it('builds a graph from [0:a] to [fx] for every effect alone at its defaults, mins and maxes', () => {
    for (const e of EFFECTS) {
      shape(fxGraph({ [e.id]: defaults(e.id) }));
      shape(fxGraph({ [e.id]: Object.fromEntries(e.knobs.map((k) => [k.k, k.min])) }));
      shape(fxGraph({ [e.id]: Object.fromEntries(e.knobs.map((k) => [k.k, k.max])) }));
    }
  });
  it('builds one for every preset but Clean, and null for Clean', () => {
    for (const p of PRESETS) {
      if (!fxOn(p.fx)) { expect(fxGraph(p.fx), p.name).toBeNull(); continue; }
      shape(fxGraph(p.fx));
    }
  });
  it('carries only allowlisted characters for 500 random racks and every hostile input', () => {
    const rnd = lcg(99);
    for (let i = 0; i < 500; i++) shape(fxGraph(randomFx(rnd)));
    for (const h of HOSTILE) {
      const g = fxGraph(h as FxSet);
      if (g != null) shape(g);
      expect(g ?? '').not.toMatch(/volume=100|passwd|amovie|win_size=1,/);
    }
  });
  it('splits and mixes for a wet/dry mix between 0 and 1, runs serial at 1, and skips at 0', () => {
    const half = fxGraph({ ring: { f: 45, mix: 0.5 } })!;
    expect(half).toMatch(/asplit\[d1\]\[w1\]/);
    expect(half).toMatch(/amix=inputs=2:weights='0\.5 0\.5':normalize=0/);
    const some = fxGraph({ robot: { win: 1, mix: 0.25 } })!;
    expect(some).toMatch(/weights='0\.75 0\.25'/);
    const full = fxGraph({ ring: { f: 45, mix: 1 } })!;
    expect(full).not.toMatch(/asplit|amix/);
    expect(full).toMatch(/aeval=exprs='val\(0\)\*sin\(2\*PI\*45\*t\)'/);
    const none = fxGraph({ ring: { f: 45, mix: 0 } })!;
    expect(none).not.toMatch(/asplit|amix|aeval/);
    expect(none.split(';').at(-1)).toBe('[a0]anull[fx]');
  });
  it('passes a rack of no-ops straight through', () => {
    expect(fxGraph({ pitch: { semi: 0 }, vibrato: { f: 6, d: 0 }, tremolo: { f: 8, d: 0 } })).toBe(
      '[0:a]aformat=sample_fmts=flt:channel_layouts=mono,aresample=44100[a0];[a0]anull[fx]');
  });
  const TAKE = { dur: 2.31, lufs: -23.4 };
  it('builds a well-formed graph with the take info for every effect at its defaults, mins, maxes and random knobs', () => {
    const rnd = lcg(5);
    for (const e of EFFECTS) {
      shape(fxGraph({ [e.id]: defaults(e.id) }, TAKE));
      shape(fxGraph({ [e.id]: Object.fromEntries(e.knobs.map((k) => [k.k, k.min])) }, TAKE));
      shape(fxGraph({ [e.id]: Object.fromEntries(e.knobs.map((k) => [k.k, k.max])) }, TAKE));
      for (let i = 0; i < 20; i++) shape(fxGraph({ [e.id]: Object.fromEntries(e.knobs.map((k) => [k.k, k.min + rnd() * (k.max - k.min)])) }, TAKE));
    }
    for (const p of PRESETS) if (fxOn(p.fx)) shape(fxGraph(p.fx, TAKE));
    for (let i = 0; i < 300; i++) shape(fxGraph(randomFx(rnd), TAKE));
    // every effect at once, every knob at both ends
    for (const end of ['min', 'max', 'def'] as const) shape(fxGraph(Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, k[end]]))])), TAKE));
  });
  it('brings the take to FX_LEVEL first when told its loudness, and ignores take info that is not a sane number', () => {
    expect(fxGraph({ robot: defaults('robot') }, TAKE)!.split(';')[0]).toBe(`[0:a]aformat=sample_fmts=flt:channel_layouts=mono,aresample=44100,volume=${Math.round((FX_LEVEL - TAKE.lufs) * 1e4) / 1e4}dB[a0]`);
    // the pre-gain is clamped to +-40 dB
    expect(fxGraph({ robot: defaults('robot') }, { lufs: -95 })!.split(';')[0]).toMatch(/,volume=40dB\[a0\]$/);
    const plain = fxGraph({ echo: defaults('echo') });
    for (const bad of [{ dur: NaN, lufs: NaN }, { dur: Infinity, lufs: -Infinity }, { dur: -1, lufs: 99 }, { dur: 1e9, lufs: -1e9 },
      { dur: '2;amovie=x', lufs: '1;volume=100' }, { dur: [2], lufs: { valueOf: () => -20 } }, null, undefined] as unknown[]) {
      expect(fxGraph({ echo: defaults('echo') }, bad as never), JSON.stringify(bad)).toBe(plain);
    }
  });
  it('ends a tail FX_TAIL past the voice with a fade, however many tail effects pile up', () => {
    const rack = P2({ echo: { ms: 900 }, cave: { size: 3, decay: 0.8 }, convo: { decay: 4, pre: 120, mix: 0.5 } });
    const g = fxGraph(rack, TAKE)!;
    const pads = [...g.matchAll(/apad=pad_dur=([\d.]+)/g)].map((m) => +m[1]);
    expect(pads.reduce((a, b) => a + b, 0)).toBeCloseTo(FX_TAIL, 6);
    expect(g).toContain(`afade=t=out:st=${TAKE.dur}:d=${FX_TAIL},atrim=end=${Math.round((TAKE.dur + FX_TAIL) * 1e4) / 1e4}`);
    // without the take's length the tail is still bounded (the pads), just not trimmed
    const g2 = fxGraph(rack)!;
    expect([...g2.matchAll(/apad=pad_dur=([\d.]+)/g)].reduce((a, m) => a + +m[1], 0)).toBeLessThanOrEqual(FX_TAIL + 1e-9);
    expect(g2).not.toMatch(/atrim=end/);
    // no tail effect, no trim
    expect(fxGraph({ robot: defaults('robot') }, TAKE)).not.toMatch(/apad|atrim=end/);
  });
  it('cuts a rack that moved the voice where the voice now ends', () => {
    const r = 2 ** (-4 / 12);
    expect(fxGraph({ speed: { semi: -4 } }, TAKE)).toContain(`atrim=end=${Math.round((TAKE.dur / r) * 1e4) / 1e4}[`);
    expect(fxGraph({ stutter: { at: 60, ms: 140, n: 3 } }, TAKE)).toContain(`atrim=end=${Math.round((TAKE.dur + 0.42) * 1e4) / 1e4}[`);
    expect(fxGraph({ revverb: { swell: 0.35, decay: 2, mix: 0.5 } }, TAKE)).toContain(`atrim=end=${Math.round((TAKE.dur + 0.35) * 1e4) / 1e4}[`);
    // a stutter's slice never runs past a short take
    expect(fxGraph({ stutter: { at: 600, ms: 400, n: 2 } }, { dur: 0.5 })).toMatch(/atrim=start=0\.1:end=0\.5,/);
  });
  it('renders each new effect with the filters it is built from', () => {
    const g = (fx: FxSet) => fxGraph(fx, TAKE)!;
    expect(g({ pitch: { semi: -3, formant: 1 } })).toMatch(/rubberband=pitch=0\.840896:pitchq=quality:formant=preserved/);
    expect(g({ pitch: { semi: 5 } })).toMatch(/rubberband=pitch=1\.33484:pitchq=quality:formant=shifted/);
    expect(g({ formant: { shift: -4 } })).toMatch(/rubberband=tempo=1\.259921:pitch=1\.259921:formant=preserved:pitchq=quality,asetrate=35002,aresample=44100/);
    expect(g({ octave: { semi: -12, mix: 0.5 } })).toMatch(/rubberband=pitch=0\.5:pitchq=quality/);
    const voc = g({ vocoder: { car: 2, hz: 110, bands: 20, sib: 0.4, mix: 1 } });
    expect(voc.match(/amultiply/g)).toHaveLength(20);
    expect(voc).toMatch(/aevalsrc=exprs='\(2\*mod\(t\*110,1\)/);
    expect(voc).toMatch(/amix=inputs=21:normalize=0:duration=first/);
    expect(g({ vocoder: { car: 3, bands: 8 } }).match(/amultiply/g)).toHaveLength(8);
    const cv = g({ convo: { room: 4, size: 1, decay: 2, pre: 30, mix: 0.5 } });
    expect(cv).toMatch(/aevalsrc=exprs='\(random\(0\)\*2-1\)\*exp\(-6\.9078\*t\/2\)[^']*':s=44100:d=2\.1,/);
    expect(cv).toMatch(/adelay=delays=30:all=1/);
    expect(cv).toMatch(/afir=irnorm=2/);
    const rv = g({ revverb: { swell: 0.35, decay: 2, mix: 0.5 } });
    expect(rv.indexOf('areverse,apad=pad_dur=0.35')).toBeLessThan(rv.indexOf('afir'));
    expect(rv.indexOf('afir')).toBeLessThan(rv.lastIndexOf('areverse,afade=t=in'));
    expect(g({ reverse: { mix: 1 } })).toMatch(/\]areverse\[/);
    expect(g({ freqshift: { hz: -70, mix: 1 } })).toMatch(/afreqshift=shift=-70/);
    expect(g({ stutter: { at: 60, ms: 140, n: 3 } })).toMatch(/concat=n=5:v=0:a=1/);
    expect(g({ stutter: { at: 0, ms: 140, n: 3 } })).toMatch(/concat=n=4:v=0:a=1/);
    expect(g({ comb: { f: 200, fb: 80, mix: 1 } })).toMatch(/flanger=delay=5:depth=0:regen=80/);
    expect(g({ wah: defaults('wah') })).toMatch(/afftfilt=real='re\*/);
    // the vibratos run behind 20 ms of silence (ffmpeg's vibrato reads its delay line before writing it)
    expect(g({ vibrato: defaults('vibrato') })).toMatch(/adelay=delays=20:all=1,vibrato=f=6:d=0\.4,atrim=start=0\.02,asetpts=PTS-STARTPTS/);
    expect(g({ wow: defaults('wow') })).toMatch(/adelay=delays=20:all=1,vibrato=f=0\.7:d=0\.5,vibrato=f=11\.3:d=0\.036,atrim=start=0\.02/);
    // harmony with one voice off runs one shifter; both off is a no-op
    expect(g({ harmony: { a: 7, b: 0, mix: 0.4 } }).match(/rubberband/g)).toHaveLength(1);
    expect(fxGraph({ harmony: { a: 0, b: 0, mix: 0.4 } })).toBe('[0:a]aformat=sample_fmts=flt:channel_layouts=mono,aresample=44100[a0];[a0]anull[fx]');
  });
  it('keeps the original effects as they were (kept takes name them): Hive mind renders the same filters', () => {
    const hive = fxGraph(PRESETS.find((p) => p.name === 'Hive mind')!.fx)!;
    expect(hive).toContain('chorus=0.6:0.8:35|49|63|77:0.45|0.4|0.35|0.3:0.2|0.33|0.46|0.59:6|6|6|6[');
    expect(hive).toContain("aeval=exprs='val(0)*sin(2*PI*120*t)':c=same");
    expect(hive).toContain("weights='0.65 0.35':normalize=0");
    expect(hive).toContain('flanger=delay=5:depth=5:regen=70:speed=0.2:width=70');
    expect(hive).toContain('apad=pad_dur=0.12');
    expect(hive).toContain('aecho=0.8:0.8:40:0.4');
  });
});

/** a preset-style rack: each effect at its defaults with these knobs over them */
const P2 = (o: Record<string, Record<string, number>>): FxSet => Object.fromEntries(Object.entries(o).map(([id, v]) => [id, { ...defaults(id), ...v }]));

describe('the rack (EFFECTS, GROUPS, PRESETS)', () => {
  const CONTRACT = ['pitch', 'synth', 'space', 'mod', 'dirt', 'tone', 'dynamics', 'time', 'weird'];
  it('has 35-45 effects with unique ids, each in a known group; every group is used', () => {
    expect(EFFECTS.length).toBeGreaterThanOrEqual(35);
    expect(EFFECTS.length).toBeLessThanOrEqual(45);
    expect(new Set(EFFECTS.map((e) => e.id)).size).toBe(EFFECTS.length);
    expect(GROUPS.map((g) => g.id).sort()).toEqual([...CONTRACT].sort());
    for (const g of GROUPS) expect(g.label.length, g.id).toBeGreaterThan(0);
    for (const e of EFFECTS) expect(CONTRACT, e.id).toContain(e.group);
    for (const g of CONTRACT) expect(EFFECTS.some((e) => e.group === g), g).toBe(true);
  });
  it('keeps every effect id and knob a saved rack can name', () => {
    const OLD: Record<string, string[]> = {
      pitch: ['semi'], octave: ['semi', 'mix'], robot: ['win', 'mix'], whisper: ['mix'], ring: ['f', 'mix'], chop: ['f', 'd'], drive: ['gain', 'type'],
      crush: ['bits', 'samples', 'mix'], radio: ['lo', 'hi'], chorus: ['n', 'depth'], flanger: ['delay', 'depth', 'regen', 'speed'], phaser: ['speed', 'decay'],
      vibrato: ['f', 'd'], tremolo: ['f', 'd'], echo: ['ms', 'decay'], cave: ['size', 'decay'],
    };
    for (const [id, ks] of Object.entries(OLD)) for (const k of ks) expect(knob(id, k), `${id}.${k}`).toBeDefined();
    // a rack saved before the formant knob loads, the new knob at its default (the old sound: formant shifted)
    expect(cleanFx({ pitch: { semi: -3 } })).toEqual({ pitch: { semi: -3, formant: 0 } });
  });
  it('has sane knobs: min < max, a positive step that lands on max, an option per step for enumerations', () => {
    for (const e of EFFECTS) {
      expect(new Set(e.knobs.map((k) => k.k)).size, e.id).toBe(e.knobs.length);
      for (const k of e.knobs) {
        expect(k.max, `${e.id}.${k.k}`).toBeGreaterThan(k.min);
        expect(k.step).toBeGreaterThan(0);
        expect(onGrid(k.max, k), `${e.id}.${k.k} max on grid`).toBe(true);
        if (k.opts) expect(k.opts.length, `${e.id}.${k.k}`).toBe((k.max - k.min) / k.step + 1);
      }
    }
  });
  it('has 35-50 presets with unique names, keeping every name a kept take may carry', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(35);
    expect(PRESETS.length).toBeLessThanOrEqual(50);
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
    for (const n of ['Clean (no FX)', 'Comms radio', 'Robot', 'Robot radio', 'Cyborg', 'Android', 'Evil machine (ring mod)', 'Demon', 'Possessed',
      'Ghost', 'Glitch', 'Busted PA', 'Clone army', 'Alien larva', 'Dying battery', 'Hive mind']) expect(PRESETS.map((p) => p.name)).toContain(n);
    expect(PRESETS.find((p) => p.name === 'Hive mind')!.fx).toEqual({
      ring: { f: 120, mix: 0.35 }, chorus: { n: 4, depth: 6 }, flanger: { delay: 5, depth: 5, regen: 70, speed: 0.2 }, echo: { ms: 40, decay: 0.4 } });
    // every new effect is in at least one preset
    for (const e of EFFECTS) expect(PRESETS.some((p) => p.fx[e.id]), e.id).toBe(true);
  });
});

describe('randomFx', () => {
  it('is deterministic for a seeded rnd', () => {
    for (const s of [1, 2, 3, 12345]) expect(randomFx(lcg(s))).toEqual(randomFx(lcg(s)));
    expect(randomFx(lcg(1))).not.toEqual(randomFx(lcg(2)));
  });
  it('always passes cleanFx unchanged, with 2-5 effects and a usable radio band', () => {
    const rnd = lcg(7);
    for (let i = 0; i < 500; i++) {
      const f = randomFx(rnd);
      expect(cleanFx(f)).toEqual(f);
      const n = Object.keys(f).length;
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
      if (f.radio) expect(f.radio.hi).toBeGreaterThanOrEqual(f.radio.lo + 800);
    }
  });
});

describe('fxParam', () => {
  const q = (fx?: string) => new URLSearchParams(fx == null ? {} : { fx });
  it('is undefined with no fx, oversized fx or bad JSON', () => {
    expect(fxParam(q())).toBeUndefined();
    expect(fxParam(q('{nope'))).toBeUndefined();
    expect(fxParam(q('{"pitch":{"semi":2}}'.padEnd(4001, ' ')))).toBeUndefined();
  });
  it('cleans what it reads; non-object JSON is an empty (clean) rack', () => {
    expect(fxParam(q('{"pitch":{"semi":2.2,"x":"1;volume=100"},"evil":{}}'))).toEqual({ pitch: { semi: 2, formant: 0 } });
    expect(fxParam(q('{"pitch":{"semi":2}}'.padEnd(4000, ' ')))).toEqual({ pitch: { semi: 2, formant: 0 } });
    expect(fxParam(q('null'))).toEqual({});
    expect(fxParam(q('"robot"'))).toEqual({});
  });
});
