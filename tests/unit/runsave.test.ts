import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RUN_KEY, RUN_V, applyRun, clearRun, decodeRun, readRun, serializeRun, writeRun } from '../../src/runsave';

function storage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  };
}

// short-layout anchors the fixtures stand for (biomes.ts SEG x0 and the screen width W)
const SEG0_X0 = 2300, SEG1_X0 = 5150, W = 480;
/** choose()'s rule: the biome starts at max(SEG.x0, scroll + W + 10) when the player flies into the gate */
const forkX = (x0: number, scroll: number) => Math.max(x0, scroll + W + 10);

/** a Descent 2 run in its second biome, with run state of every allowlisted kind plus live state that must not be kept */
function midRun(bx: (number | null)[]) {
  const G: any = {
    loop: 1, stage: 2, cpX: 6120.5, layout: 'short', seed: 123456789, bx,
    pk: { graze: 2, tape: 1 }, xp: 17.25, xpTot: 912.5, lvl: 14, gm: { rapid: 2, seek: 1 }, kk: { sm: 40 }, gmk: 3, cur: 2,
    lives: 2, score: 123450, bio: 812.4, kills: 410, maxCombo: 37, seal: 2, cleared: 5,
    route: ['ice', 'fire'], bvis: { ice: 2, fire: 1 }, visited: ['ice', 'acid', 'fire'], seenV: 3,
    remix: { 0: 1, 1: 0, orbitA: { used: [0, 2], last: 2 } },
    st: { kills: 12, spawned: 20, hits: 1, deaths: 0, chain: 9, t0: 5400 },
    // live state: never stored
    scroll: 6000, t: 9001, pend: [{ t: 40, f: () => 0 }], boss: { hp: 3 }, script: [{ x: 1, f: () => 0 }], tally: null, fork: null,
  };
  const P: any = { speed: 2, missile: 1, double: 1, laser: 0, pyre: 2, options: 3, shield: 2, wardLv: 1, aegis: 0, frag: [0, 1, null, 2],
    x: 50, y: 120, inv: 0, hist: [{ x: 1 }], rig: { saw: { spin: 1 } } };
  return { G, P };
}
const LIVE_G = ['scroll', 't', 'pend', 'boss', 'script', 'tally', 'fork'];
const LIVE_P = ['x', 'y', 'inv', 'hist', 'rig'];

describe('run save round trip', () => {
  beforeEach(() => vi.stubGlobal('localStorage', storage()));

  it.each([
    ['early (gate taken at once: bx = SEG.x0)', [forkX(SEG0_X0, 1500), forkX(SEG1_X0, 4000), null]],
    ['late (dawdled at the gate: bx = scroll + W + 10)', [forkX(SEG0_X0, 2611.5), forkX(SEG1_X0, 5377), 7930]],
  ])('is lossless for a fork taken %s, bx included', (_, bx) => {
    const a = midRun(bx as (number | null)[]);
    const s = JSON.stringify(serializeRun(a.G, a.P));
    const d = decodeRun(s)!;
    expect(d).not.toBeNull();
    const b: any = { G: {}, P: {} };
    applyRun(d, b.G, b.P);
    const { G: g0, P: p0 } = midRun(bx as (number | null)[]);
    for (const k of LIVE_G) delete g0[k];
    for (const k of LIVE_P) delete p0[k];
    expect(b.G).toStrictEqual(g0);
    expect(b.P).toStrictEqual(p0);
    expect(b.G.bx).toEqual(bx); // all three entries, null kept as null
  });

  it('keeps no live state, closures or entity references', () => {
    const { G, P } = midRun([2200, null, null]);
    const s = serializeRun(G, P);
    for (const k of LIVE_G) expect(s.g).not.toHaveProperty(k);
    for (const k of LIVE_P) expect(s.p).not.toHaveProperty(k);
  });

  it('stores remix whole when choose() made it an array that pickV hung keys on', () => {
    const { G, P } = midRun([2200, null, null]);
    const r: any = [1, 0];
    r.orbitA = { used: [0], last: 0 };
    G.remix = r;
    const d = decodeRun(JSON.stringify(serializeRun(G, P)))!;
    expect(d.g.remix).toEqual({ 0: 1, 1: 0, orbitA: { used: [0], last: 0 } });
  });

  it('keeps a sparse frag readable (player.ts writes frag[i] at the pod index picked up first)', () => {
    const { G, P } = midRun([2300, null, null]);
    P.frag = [];
    P.frag[2] = 1; // [ , , 1]
    expect(writeRun(G, P)).toBe(true);
    const d = readRun()!;
    expect(d).not.toBeNull();
    expect(d.p.frag).toEqual([null, null, 1]); // holes come back as null; player.ts reads frag[i] || 0
  });

  it('refuses to write a run that would not read back, leaving the last checkpoint standing', () => {
    const a = midRun([2300, null, null]);
    expect(writeRun(a.G, a.P)).toBe(true);
    const before = (localStorage as any).map.get(RUN_KEY);
    const b = midRun([2300, 5150, null]);
    b.G.score = NaN; // JSON writes NaN as null
    expect(writeRun(b.G, b.P)).toBe(false);
    expect((localStorage as any).map.get(RUN_KEY)).toBe(before);
  });

  it('restores copies, so the saved blob and the live run never share objects', () => {
    const { G, P } = midRun([2200, 4300, null]);
    const d = decodeRun(serializeRun(G, P))!;
    const b: any = {};
    applyRun(d, b, {});
    b.bx[2] = 1;
    expect(d.g.bx[2]).toBeNull();
  });

  it('writes, reads and clears one slot under grodius.run', () => {
    const { G, P } = midRun([2200, 4300, null]);
    expect(writeRun(G, P)).toBe(true);
    expect(JSON.parse((localStorage as any).map.get(RUN_KEY)).v).toBe(RUN_V);
    expect(readRun()!.g.bx).toEqual([2200, 4300, null]);
    clearRun();
    expect(readRun()).toBeNull();
  });
});

describe('a bad or old run save', () => {
  beforeEach(() => vi.stubGlobal('localStorage', storage()));
  const ok = () => serializeRun(midRun([2200, null, null]).G, midRun([2200, null, null]).P);

  it.each([
    ['not JSON', '{nope'],
    ['not an object', '42'],
    ['null', 'null'],
    ['an older version', JSON.stringify({ ...ok(), v: RUN_V - 1 })],
    ['a newer version', JSON.stringify({ ...ok(), v: RUN_V + 1 })],
    ['bx with two entries', JSON.stringify({ ...ok(), g: { ...ok().g, bx: [1, 2] } })],
    ['bx holding a string', JSON.stringify({ ...ok(), g: { ...ok().g, bx: [1, 'x', null] } })],
    ['a field outside the allowlist', JSON.stringify({ ...ok(), g: { ...ok().g, boss: {} } })],
    ['a missing stage', JSON.stringify({ ...ok(), g: { ...ok().g, stage: undefined } })],
    ['a missing bx', JSON.stringify({ ...ok(), g: { ...ok().g, bx: undefined } })],
    ['a missing route', JSON.stringify({ ...ok(), g: { ...ok().g, route: undefined } })],
    ['no G at all', JSON.stringify({ v: RUN_V, p: {} })],
    ['an inherited name: toString', JSON.stringify({ ...ok(), g: { ...ok().g, toString: 5 } })],
    ['an inherited name: constructor', JSON.stringify({ ...ok(), g: { ...ok().g, constructor: {} } })],
    ['an inherited name: hasOwnProperty', JSON.stringify({ ...ok(), g: { ...ok().g, hasOwnProperty: 'loop' } })],
    ['an inherited name: __proto__', '{"v":' + RUN_V + ',"g":{"loop":0,"stage":0,"bx":[null,null,null],"route":[null,null],"__proto__":{"x":1}},"p":{}}'],
    ['an inherited name in P', JSON.stringify({ ...ok(), p: { ...ok().p, valueOf: 1 } })],
    ['a negative stage', JSON.stringify({ ...ok(), g: { ...ok().g, stage: -1 } })],
    ['a negative loop', JSON.stringify({ ...ok(), g: { ...ok().g, loop: -7 } })],
    ['negative lives', JSON.stringify({ ...ok(), g: { ...ok().g, lives: -3 } })],
    ['a negative gun level', JSON.stringify({ ...ok(), p: { ...ok().p, missile: -1 } })],
    ['a perk level that is not a number', JSON.stringify({ ...ok(), g: { ...ok().g, pk: { graze: 'x' } } })],
    ['a graft table with an own __proto__', '{"v":' + RUN_V + ',"g":{"loop":0,"stage":0,"bx":[null,null,null],"route":[null,null],"gm":{"__proto__":{"x":1}}},"p":{}}'],
    ['a fractional loop', JSON.stringify({ ...ok(), g: { ...ok().g, loop: 1.5 } })],
    ['a bad loadout', JSON.stringify({ ...ok(), p: { missile: 'lots' } })],
  ])('is discarded without throwing: %s', (_, s) => {
    expect(() => decodeRun(s)).not.toThrow();
    expect(decodeRun(s)).toBeNull();
    (localStorage as any).setItem(RUN_KEY, s);
    expect(readRun()).toBeNull();
    expect((localStorage as any).map.has(RUN_KEY)).toBe(false); // removed, so RESUME never offers it
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('x'); } });
    const { G, P } = midRun([2200, null, null]);
    expect(writeRun(G, P)).toBe(false);
    expect(readRun()).toBeNull();
    expect(() => clearRun()).not.toThrow();
  });
});
