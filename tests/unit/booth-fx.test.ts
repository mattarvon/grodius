// The voice booth's FX rack (tools/booth/fx.ts): cleanFx is the only door from a request to ffmpeg, so it must keep
// known effects and knobs only, as in-range numbers on their step; fxGraph builds a graph from those numbers alone.
// The graphs themselves are run through real ffmpeg by `node tools/booth/chain-probe.mjs --fx`.
import { describe, expect, it } from 'vitest';
import { EFFECTS, PRESETS, cleanFx, defaults, fxGraph, fxName, fxOn, randomFx, type FxSet } from '../../tools/booth/fx';
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
  Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, k.max * 1000]))])),
  Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, -1e9]))])),
  Object.fromEntries(EFFECTS.map((e) => [e.id, Object.fromEntries(e.knobs.map((k) => [k.k, k.min + 1e-7]))])),
];

describe('cleanFx', () => {
  it('rejects anything but a plain object', () => {
    for (const x of [null, undefined, 0, 1, '', 'pitch', '{"pitch":{}}', [], [{ pitch: {} }], true, () => ({ pitch: {} })]) expect(cleanFx(x)).toEqual({});
  });
  it('drops unknown effects and unknown knobs; an effect given as a non-object is off', () => {
    expect(cleanFx({ bogus: { x: 1 }, pitch: { semi: 2, extra: 9 }, robot: 'on', ring: [45], echo: null })).toEqual({ pitch: { semi: 2 } });
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
    // every label used as an input was made by an earlier step
    const made = new Set(['0:a']);
    for (const step of g!.split(';')) {
      const ins = [...step.matchAll(/^((?:\[[^\]]+\])+)/g)][0]?.[1].match(/[^[\]]+/g) ?? [];
      for (const i of ins) expect(made.has(i), `${i} in ${step}`).toBe(true);
      for (const o of [...step.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).slice(ins.length)) made.add(o);
    }
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
    expect(fxParam(q('{"pitch":{"semi":2.2,"x":"1;volume=100"},"evil":{}}'))).toEqual({ pitch: { semi: 2 } });
    expect(fxParam(q('{"pitch":{"semi":2}}'.padEnd(4000, ' ')))).toEqual({ pitch: { semi: 2 } });
    expect(fxParam(q('null'))).toEqual({});
    expect(fxParam(q('"robot"'))).toEqual({});
  });
});
