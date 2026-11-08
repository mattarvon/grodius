import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVES_MAX, LOAD_MAX, LOOP_MAX, SCREEN_W, SEAL_MAX, xpNeedRun, RUN_KEY, RUN_V, applyRun, clearRun, decodeRun, readRun, runInfo, serializeRun, writeRun } from '../../src/runsave';

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
    loop: 1, stage: 2, cpX: 6120.5, cpN: 1, layout: 'short', seed: 123456789, bx,
    pk: { graze: 2, tape: 1 }, xp: 17.25, xpTot: 912.5, lvl: 14, gm: { rapid: 2, seek: 1 }, kk: { sm: 40 }, gmk: 3, cur: 2,
    lives: 2, score: 123450, bio: 812.4, kills: 410, maxCombo: 37, seal: 2, cleared: 5,
    route: ['ice', 'fire'], bvis: { ice: 2, fire: 1 }, visited: ['ice', 'acid', 'fire'], seenV: 3,
    remix: { 0: 1, 1: 0, orbitA: { used: [0, 2], last: 2 } },
    // the midboss picker's state (item F): this descent's picks by stage, met this descent, each biome's last pair
    mb: { 0: ['ufo'], 1: ['choir', 'cyst'], 2: ['prentice', 'brood'] }, mbUsed: ['ufo', 'choir', 'cyst', 'prentice', 'brood'], mbLast: { ice: ['choir', 'cyst'], fire: ['prentice', 'brood'], acid: ['cyst', 'choir'] },
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

  it('round-trips the stage picks and the set-piece used set (LS2-mv)', () => {
    const picks = { 1: { mv: 1, sp: ['thaw', 'vigil', 'pack'] } }, spUsed = { ice: ['thaw', 'vigil', 'pack'] }, mvSeen = { ice: 2, fire: 3 };
    const b = serializeRun(midRun([2200, 5300, null]).G, midRun([2200, 5300, null]).P), d = decodeRun(JSON.stringify({ ...b, g: { ...b.g, picks, spUsed, mvSeen } }));
    expect(d.g.picks).toEqual(picks);
    expect(d.g.spUsed).toEqual(spUsed);
    expect(d.g.mvSeen).toEqual(mvSeen);
  });
  it('keeps no live state, closures or entity references', () => {
    const { G, P } = midRun([2200, 5300, null]);
    const s = serializeRun(G, P);
    for (const k of LIVE_G) expect(s.g).not.toHaveProperty(k);
    for (const k of LIVE_P) expect(s.p).not.toHaveProperty(k);
  });

  it('stores remix whole when choose() made it an array that pickV hung keys on', () => {
    const { G, P } = midRun([2200, 5300, null]);
    const r: any = [1, 0];
    r.orbitA = { used: [0], last: 0 };
    G.remix = r;
    const d = decodeRun(JSON.stringify(serializeRun(G, P)))!;
    expect(d.g.remix).toEqual({ 0: 1, 1: 0, orbitA: { used: [0], last: 0 } });
  });

  it('keeps a sparse frag readable (player.ts writes frag[i] at the pod index picked up first)', () => {
    const { G, P } = midRun([2300, 5300, null]);
    P.frag = [];
    P.frag[2] = 1; // [ , , 1]
    expect(writeRun(G, P)).toBe(true);
    const d = readRun()!;
    expect(d).not.toBeNull();
    expect(d.p.frag).toEqual([null, null, 1]); // holes come back as null; player.ts reads frag[i] || 0
  });

  it('refuses to write a run that would not read back, leaving the last checkpoint standing', () => {
    const a = midRun([2300, 5300, null]);
    expect(writeRun(a.G, a.P)).toBe(true);
    const before = (localStorage as any).map.get(RUN_KEY);
    const b = midRun([2300, 5150, null]);
    b.G.score = NaN; // JSON writes NaN as null
    expect(writeRun(b.G, b.P)).toBe(false);
    expect((localStorage as any).map.get(RUN_KEY)).toBe(before);
  });

  it('restores copies, so the saved blob and the live run never share objects', () => {
    const { G, P } = midRun([2200, 5300, null]);
    const d = decodeRun(serializeRun(G, P))!;
    const b: any = {};
    applyRun(d, b, {});
    b.bx[2] = 1;
    expect(d.g.bx[2]).toBeNull();
  });

  it('writes, reads and clears one slot under grodius.run', () => {
    const { G, P } = midRun([2200, 5300, null]);
    expect(writeRun(G, P)).toBe(true);
    expect(JSON.parse((localStorage as any).map.get(RUN_KEY)).v).toBe(RUN_V);
    expect(readRun()!.g.bx).toEqual([2200, 5300, null]);
    clearRun();
    expect(readRun()).toBeNull();
  });
});

describe('a bad or old run save', () => {
  beforeEach(() => vi.stubGlobal('localStorage', storage()));
  const ok = () => serializeRun(midRun([2200, 5300, null]).G, midRun([2200, 5300, null]).P);

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
    ['a midboss pick that is not a kind list', JSON.stringify({ ...ok(), g: { ...ok().g, mb: { 1: 'choir' } } })],
    ['a midboss pick holding a number', JSON.stringify({ ...ok(), g: { ...ok().g, mb: { 1: ['choir', 3] } } })],
    ['midbosses met that is not a list', JSON.stringify({ ...ok(), g: { ...ok().g, mbUsed: { choir: 1 } } })],
    ['a previous pair table with an own __proto__', '{"v":' + RUN_V + ',"g":{"loop":0,"stage":0,"bx":[null,null,null],"route":[null,null],"mbLast":{"__proto__":["x"]}},"p":{}}'],
    // kinds the rebuild indexes by name (sprint 3 H review): a save that decodes must rebuild, never throw on RESUME
    ['a route naming an unknown biome', JSON.stringify({ ...ok(), g: { ...ok().g, route: ['ice', 'lava'] } })],
    ['a route naming an inherited name', JSON.stringify({ ...ok(), g: { ...ok().g, route: ['constructor', null] } })],
    ['a stage pick naming an unknown midboss', JSON.stringify({ ...ok(), g: { ...ok().g, mb: { 1: ['choir', 'gorgon'] } } })],
    ['a stage pick keyed by something other than a stage', JSON.stringify({ ...ok(), g: { ...ok().g, mb: { x: ['choir'] } } })],
    ['midbosses met naming an unknown one', JSON.stringify({ ...ok(), g: { ...ok().g, mbUsed: ['ufo', 'toString'] } })],
    ['a previous pair naming an unknown midboss', JSON.stringify({ ...ok(), g: { ...ok().g, mbLast: { ice: ['gorgon'] } } })],
    ['a stage pick naming an unknown set piece', JSON.stringify({ ...ok(), g: { ...ok().g, picks: { 1: { mv: 0, sp: ['gorgon', 'thaw', 'vigil'] } } } })],
    ['a stage pick with no such movement variant', JSON.stringify({ ...ok(), g: { ...ok().g, picks: { 1: { mv: 2, sp: ['morgue', 'thaw', 'vigil'] } } } })],
    ['a stage pick under a key that is no stage', JSON.stringify({ ...ok(), g: { ...ok().g, picks: { x: { mv: 0, sp: ['morgue', 'thaw', 'vigil'] } } } })],
    ['a stage pick with too few set pieces (its script entry would fire SET[undefined])', JSON.stringify({ ...ok(), g: { ...ok().g, picks: { 1: { mv: 0, sp: ['morgue', 'thaw'] } } } })],
    ['a stage pick with no set pieces', JSON.stringify({ ...ok(), g: { ...ok().g, picks: { 1: { mv: 0, sp: [] } } } })],
    ['a stage pick naming one piece twice', JSON.stringify({ ...ok(), g: { ...ok().g, picks: { 1: { mv: 0, sp: ['morgue', 'thaw', 'thaw'] } } } })],
    ['a flown-variants entry for no such biome', JSON.stringify({ ...ok(), g: { ...ok().g, mvSeen: { gorgon: 1 } } })],
    ['a flown-variants entry that is no variant set', JSON.stringify({ ...ok(), g: { ...ok().g, mvSeen: { ice: 4 } } })],
    ['a used set for no such biome', JSON.stringify({ ...ok(), g: { ...ok().g, spUsed: { gorgon: ['morgue'] } } })],
    // LS1 audit (security-engineer, gameplay-programmer): the remix memory is typed, and every bound holds
    ['a visitNo that is not a list', JSON.stringify({ ...ok(), g: { ...ok().g, visitNo: { 0: 1 } } })],
    ['a visitNo of the wrong length', JSON.stringify({ ...ok(), g: { ...ok().g, visitNo: [0] } })],
    ['a visitNo holding a string (biomeStage would build a remix silently)', JSON.stringify({ ...ok(), g: { ...ok().g, visitNo: [0, 'yes'] } })],
    ['a remix value that is no visit count or section memory', JSON.stringify({ ...ok(), g: { ...ok().g, remix: { 0: 'x' } } })],
    ['a remix section memory with a bad used list', JSON.stringify({ ...ok(), g: { ...ok().g, remix: { orbitA: { used: ['a'], last: 0 } } } })],
    ['a remixV that is a list', JSON.stringify({ ...ok(), g: { ...ok().g, remixV: [1] } })],
    ['a remixV section with no last', JSON.stringify({ ...ok(), g: { ...ok().g, remixV: { orbitA: { used: [0] } } } })],
    ['a remixV section with a fractional descent', JSON.stringify({ ...ok(), g: { ...ok().g, remixV: { orbitA: { used: [0], last: 0, L: .5 } } } })],
    ['a remixV cell memory with numeric ids', JSON.stringify({ ...ok(), g: { ...ok().g, remixV: { 'c:orbit': { used: [1], last: [] } } } })],
    ['a remixV cell pick with no filler list', JSON.stringify({ ...ok(), g: { ...ok().g, remixV: { 'c:orbit': { used: [], last: [], L: 0, pick: { ids: ['a'] } } } } })],
    ['THRUST above its max', JSON.stringify({ ...ok(), p: { ...ok().p, speed: LOAD_MAX.speed + 1 } })],
    ['MISSILE above its max', JSON.stringify({ ...ok(), p: { ...ok().p, missile: LOAD_MAX.missile + 1 } })],
    ['SPLIT above its max', JSON.stringify({ ...ok(), p: { ...ok().p, double: LOAD_MAX.double + 1 } })],
    ['ARC above its max', JSON.stringify({ ...ok(), p: { ...ok().p, laser: LOAD_MAX.laser + 1 } })],
    ['PYRE above its max', JSON.stringify({ ...ok(), p: { ...ok().p, pyre: LOAD_MAX.pyre + 1 } })],
    ['ten million WRAITHs (the hud and player loops would hang)', JSON.stringify({ ...ok(), p: { ...ok().p, options: 1e7 } })],
    ['WARD above its max', JSON.stringify({ ...ok(), p: { ...ok().p, wardLv: LOAD_MAX.wardLv + 1 } })],
    ['a shield above WARD_MAX', JSON.stringify({ ...ok(), p: { ...ok().p, shield: LOAD_MAX.shield + .5 } })],
    ['an aegis above its cap', JSON.stringify({ ...ok(), p: { ...ok().p, aegis: LOAD_MAX.aegis + 1 } })],
    ['more fragment counts than pod types', JSON.stringify({ ...ok(), p: { ...ok().p, frag: Array(LOAD_MAX.frag + 1).fill(0) } })],
    ['a fragment count past every NEED', JSON.stringify({ ...ok(), p: { ...ok().p, frag: [LOAD_MAX.fragN + 1] } })],
    ['a fractional fragment count', JSON.stringify({ ...ok(), p: { ...ok().p, frag: [.5] } })],
    ['an xp of 1e30 (gainXP would loop for ever on the first kill)', JSON.stringify({ ...ok(), g: { ...ok().g, xp: 1e30 } })],
    ['an xp at its level\'s need (gainXP never leaves one there)', JSON.stringify({ ...ok(), g: { ...ok().g, lvl: 14, xp: xpNeedRun(14) } })],
    ['a negative xp', JSON.stringify({ ...ok(), g: { ...ok().g, xp: -1 } })],
    ['a missing checkpoint x (resumeRun would set the scroll to NaN)', JSON.stringify({ ...ok(), g: { ...ok().g, cpX: undefined } })],
    ['a missing checkpoint number', JSON.stringify({ ...ok(), g: { ...ok().g, cpN: undefined } })],
    ['a gate x more than W before its slot', JSON.stringify({ ...ok(), g: { ...ok().g, bx: [SEG0_X0 - W - 1, 5300, null] } })],
    ['a gate x at its slot boss', JSON.stringify({ ...ok(), g: { ...ok().g, bx: [2200, 8020, null] } })],
    ['a reached slot with no biome (rebuildAt would build an empty stage)', JSON.stringify({ ...ok(), g: { ...ok().g, route: ['ice', null] } })],
    ['a reached slot with no gate x', JSON.stringify({ ...ok(), g: { ...ok().g, bx: [2200, null, null] } })],
    ['more clears than LOOP_MAX descents hold (sealFor walks them all)', JSON.stringify({ ...ok(), g: { ...ok().g, cleared: 1e9 } })],
    ['a seal past SEAL_TXT', JSON.stringify({ ...ok(), g: { ...ok().g, seal: 4 } })],
    ['a descent past LOOP_MAX', JSON.stringify({ ...ok(), g: { ...ok().g, loop: LOOP_MAX + 1 } })],
    ['lives past the hang guard', JSON.stringify({ ...ok(), g: { ...ok().g, lives: LIVES_MAX + 1 } })],
    ['more queued picks than levels gained', JSON.stringify({ ...ok(), g: { ...ok().g, lvl: 3, pickQ: 3 } })],
    ['a checkpoint x past the stage boss', JSON.stringify({ ...ok(), g: { ...ok().g, cpX: 8020 } })],
    ['a negative checkpoint x', JSON.stringify({ ...ok(), g: { ...ok().g, cpX: -5 } })],
    ['a checkpoint x before the previous stage', JSON.stringify({ ...ok(), g: { ...ok().g, cpX: SEG0_X0 - 1 } })],
    ['a used set naming an unknown set piece', JSON.stringify({ ...ok(), g: { ...ok().g, spUsed: { ice: ['gorgon'] } } })],
  ])('is discarded without throwing: %s', (_, s) => {
    expect(() => decodeRun(s)).not.toThrow();
    expect(decodeRun(s)).toBeNull();
    (localStorage as any).setItem(RUN_KEY, s);
    expect(readRun()).toBeNull();
    expect((localStorage as any).map.has(RUN_KEY)).toBe(false); // removed, so RESUME never offers it
    expect(runInfo()).toBeNull(); // and the title has no RESUME row
  });

  it('accepts every bound at its limit (a maxed ship, a full queue, the stage edges)', () => {
    const b = ok();
    const p = { speed: 5, missile: 2, double: 1, laser: 1, pyre: 2, options: 3, wardLv: 3, shield: 3, aegis: 12, frag: [0, 1, 2, 3, 4, null, 0] };
    for (const cpX of [SEG0_X0, 8019.5]) expect(decodeRun(JSON.stringify({ ...b, g: { ...b.g, cpX, lvl: 4, pickQ: 3, lives: LIVES_MAX, visitNo: [0, 2],
      remixV: { orbitA: { used: [0, 2], last: 2, L: 1 }, 'c:orbit': { used: ['a'], last: [], L: 1, pick: { ids: ['a', null], fill: [{ x: 10, k: 'drone', u: 0 }] } } } }, p }))).not.toBeNull();
  });

  it('keeps LOAD_MAX in step with player.ts SMAX, WARD_MAX and NEED', async () => {
    // player.ts imports the sim; read its tables as text so this test needs no mocks
    const src = (await import('node:fs')).readFileSync(new URL('../../src/player.ts', import.meta.url), 'utf8');
    const arr = (n: string) => JSON.parse(src.match(new RegExp(`export const ${n} = (\\[[^;]*\\]);`))![1].replace(/'/g, '"'));
    expect([LOAD_MAX.speed, LOAD_MAX.missile, LOAD_MAX.double, LOAD_MAX.laser, LOAD_MAX.pyre, LOAD_MAX.options, LOAD_MAX.wardLv]).toEqual(arr('SMAX'));
    expect(LOAD_MAX.shield).toBe(+src.match(/export const WARD_MAX = (\d+);/)![1]);
    expect(LOAD_MAX.frag).toBe(arr('SLOTS').length);
    // the aegis cap is a literal at every write: player.ts (refill, regrowth) and contraptions.ts (the WARD socket)
    const caps = [src, (await import('node:fs')).readFileSync(new URL('../../src/contraptions.ts', import.meta.url), 'utf8')]
      .flatMap((t) => [...t.matchAll(/aegis\s*(?:=|<)\s*(\d+)|Math\.min\((\d+),\s*\(P\.aegis/g)].map((m) => +(m[1] ?? m[2])));
    expect(caps.length).toBeGreaterThanOrEqual(5);
    expect(new Set(caps)).toEqual(new Set([LOAD_MAX.aegis]));
    expect(LOAD_MAX.fragN).toBe(Math.max(...arr('NEED').flat()));
  });

  it('keeps SCREEN_W and SEAL_MAX in step with core.ts W and stages.ts SEAL_TXT', async () => {
    const fs = await import('node:fs'), read = (f: string) => fs.readFileSync(new URL(`../../src/${f}`, import.meta.url), 'utf8');
    expect(SCREEN_W).toBe(+read('core.ts').match(/export const W = (\d+)/)![1]);
    expect(SEAL_MAX).toBe(JSON.parse(read('stages.ts').match(/export const SEAL_TXT = (\[.*\]);/)![1].replace(/'/g, '"')).length - 1);
    expect(W).toBe(SCREEN_W);
  });

  it('keeps xpNeedRun in step with perks.ts xpNeed', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('../../src/perks.ts', import.meta.url), 'utf8');
    const body = src.match(/export const xpNeed = \(lvl\) => (.*);\n/)![1];
    const xpNeed = new Function('lvl', `return ${body};`) as (l: number) => number;
    for (let l = 1; l <= 80; l++) expect(xpNeedRun(l)).toBe(xpNeed(l));
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('x'); } });
    const { G, P } = midRun([2200, 5300, null]);
    expect(writeRun(G, P)).toBe(false);
    expect(readRun()).toBeNull();
    expect(() => clearRun()).not.toThrow();
  });
});
