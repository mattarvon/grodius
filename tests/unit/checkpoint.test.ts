import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// LS1 row H: the checkpoint triggers (src/checkpoint.ts) and the run-save read under the blob's own layout
// (src/runsave.ts decodeRunAs). The restore itself is in resume.test.ts and tools/resume-check.mjs.
vi.mock('../../src/save', () => ({ save: () => {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: { power: () => {}, alarm: () => {} } }));
vi.mock('../../src/enemies/spawn', () => ({ banner: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/biomes', () => ({ BIOMES: {}, openFork: () => {}, holdForFork: () => {}, biomeExit: () => {} }));
vi.mock('../../src/stagebuild', () => ({ buildStage: () => {} }));

const { CP, cp1Release, cp1X, cpSafe, cpStep, cpView, writeCp } = await import('../../src/checkpoint');
const { RUN_KEY, RUN_V, clearRun, decodeRun, decodeRunAs, lastRun, readRun, rewriteRun, runInfo, serializeRun } = await import('../../src/runsave');
const { LAYOUTS, beatPlan, layout, setLayout } = await import('../../src/layout');
const { sealFor } = await import('../../src/stages');

function storage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), map: m };
}
const store = () => (localStorage as any).map as Map<string, string>;
/** a stored checkpoint blob of a run on layout id: stage 2 (biome slot 1), both gates taken */
function blob(id: 'short' | 'long4', over: Record<string, unknown> = {}) {
  const L = LAYOUTS[id]!, s0 = L.stages[1], s1 = L.stages[2];
  return JSON.stringify({ v: RUN_V, g: { loop: 0, stage: 2, cpX: s1.x0 + 900, cpN: 1, layout: id, seed: 77, bx: [s0.x0 + 300, s1.x0 + 400, null], route: ['ice', 'fire'], visitNo: [0, 0], lives: 2, ...over }, p: { speed: 1 } });
}
/** a G in play, at a safe point of stage i */
function playing(i = 1, over: Record<string, unknown> = {}) {
  $.state = 'play';
  $.P = { alive: true, speed: 1, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, shield: 0, wardLv: 0, aegis: 0, frag: [] } as any;
  const L = layout(), r = L.stages[i];
  $.G = { loop: 0, stage: i, t: 1000, scroll: r.x0 + 10, seed: 5, bx: [L.stages[1].x0 + 400, L.stages[2].x0 + 400, null], route: ['acid', 'ice'], visitNo: [0, 0],
    st: { kills: 0, spawned: 0, hits: 0, deaths: 0, chain: 0, t0: 900 }, pend: [], mini: null, fork: null, forkHold: false, tally: null, pick: null,
    boss: null, bossStarted: false, clearT: 0, lives: 2, seal: 0, cleared: 1, cpWant: 0, ...over } as any;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  clearRun();
  setLayout('short');
});

describe('reading a run save under its own layout (sprint 2 carry-forward 1)', () => {
  it('keeps a long4 checkpoint read on a short boot, and leaves short active', () => {
    store().set(RUN_KEY, blob('long4'));
    const d = readRun();
    expect(d).not.toBeNull();
    expect(d!.g.layout).toBe('long4');
    expect(store().has(RUN_KEY)).toBe(true); // not cleared
    expect(layout().id).toBe('short');
    expect(runInfo()).toEqual({ loop: 0, stage: 2, layout: 'long4' });
  });

  it('keeps a short checkpoint read on a long4 boot, and leaves long4 active', () => {
    setLayout('long4');
    store().set(RUN_KEY, blob('short'));
    expect(readRun()).not.toBeNull();
    expect(store().has(RUN_KEY)).toBe(true);
    expect(layout().id).toBe('long4');
  });

  it('keeps a checkpoint from a layout with more biome slots and stages than the booted one (the long5 case)', () => {
    // short and long4 both have 2 slots and 4 stages, so only a wider entry shows a validation against the wrong one
    const L4 = LAYOUTS.long4!, s = L4.stages, x = s[2].x1;
    const extra = { ...s[2], slot: 2, x0: x, x1: x + 3000, end: x + 2900, bossX: x + 2800 };
    (LAYOUTS as any).wide5 = { ...L4, id: 'wide5', stages: [s[0], s[1], s[2], extra, s[3]] };
    try {
      store().set(RUN_KEY, JSON.stringify({ v: RUN_V, g: { loop: 0, stage: 4, cpX: s[3].x0 + 1, cpN: 0, layout: 'wide5', seed: 1, bx: [s[1].x0, s[2].x0, extra.x0, null], route: ['ice', 'fire', 'acid'] }, p: {} }));
      expect(readRun()).not.toBeNull();
      expect(store().has(RUN_KEY)).toBe(true);
      expect(layout().id).toBe('short');
    } finally {
      delete (LAYOUTS as any).wide5;
    }
  });

  it('validates bx and route against the blob layout, not the active one', () => {
    // a long4-shaped blob claiming to be short with a bad route length is still refused
    store().set(RUN_KEY, blob('short', { route: ['ice'] }));
    expect(readRun()).toBeNull();
    expect(store().has(RUN_KEY)).toBe(false);
  });

  it('discards a blob whose layout names no entry, and one whose stage that layout lacks (H entry criterion 2)', () => {
    for (const bad of [blob('long4', { layout: 'long9' }), blob('long4', { layout: 'constructor' }), blob('long4', { stage: 4 }), blob('short', { stage: 7 })]) {
      store().set(RUN_KEY, bad);
      expect(readRun()).toBeNull();
      expect(store().has(RUN_KEY)).toBe(false);
      expect(layout().id).toBe('short');
    }
    store().set(RUN_KEY, blob('long4', { stage: 3 })); // the Drive: the last stage is fine
    expect(readRun()).not.toBeNull();
  });

  it('leaves the blob layout active only when asked (the resume flies it)', () => {
    expect(decodeRunAs(blob('long4'), true)).not.toBeNull();
    expect(layout().id).toBe('long4');
    setLayout('short');
    expect(decodeRunAs(blob('long4', { stage: 9 }), true)).toBeNull();
    expect(layout().id).toBe('short'); // a refused blob never switches it
  });
});

describe('checkpoint positions', () => {
  it('puts CP1 150 px past midboss A on a biome stage with no release, just before the release on one with it, from the stored gate x', () => {
    for (const id of ['short', 'long4'] as const) {
      setLayout(id);
      const r = layout().stages[1], from = r.x0 + 333;
      const g = { bx: [from, null, null], visitNo: [0, 0] };
      const b = beatPlan(r, from, false).breaths.find((b) => b.mid)!, bz = b.z;
      expect(b.release).toBe(id === 'long4'); // short's single breath has no release beat
      expect(cp1X(1, g)).toBeCloseTo(b.release ? bz - CP.preRelease : bz + CP.after, 6);
      expect(cp1Release(1, g)).toBe(b.release ? bz : null);
      expect(cp1X(1, { ...g, bx: [from + 200, null, null] })).toBeGreaterThan(cp1X(1, g)!); // a later gate moves it
      expect(cp1X(1, { bx: [null, null, null] })).toBeNull(); // no gate taken: no CP1
    }
  });

  it('puts Orbit CP1 after the Saucer window and the Drive CP1 at the approach midpoint', () => {
    for (const id of ['short', 'long4'] as const) {
      setLayout(id);
      const o = layout().stages[0], d = layout().stages[3];
      expect(cp1X(0, {})).toBe(o.x0 + o.drift![0].gapEnd + CP.after);
      expect(cp1X(3, {})).toBe(Math.round((d.x0 + d.warnX!) / 2));
      expect(cp1X(0, {})!).toBeLessThan(o.warnX!); // before the Maw's banner
      expect(cp1X(3, {})!).toBeLessThan(d.warnX!);
    }
  });
});

describe('checkpoint triggers', () => {
  it('writes CP0 at the first safe step, then CP1 past its x', () => {
    playing(1);
    cpStep();
    expect($.G.cpWant).toBe(1);
    let d = decodeRun(lastRun())!;
    expect(d.g.cpN).toBe(0);
    expect(d.g.cpX).toBe($.G.scroll);
    expect(d.g.layout).toBe('short');
    expect(JSON.parse(store().get(RUN_KEY)!).g.cpN).toBe(0);
    $.G.scroll = $.G.cp1X - 1;
    cpStep();
    expect(decodeRun(lastRun())!.g.cpN).toBe(0);
    $.G.scroll = $.G.cp1X;
    cpStep();
    d = decodeRun(lastRun())!;
    expect(d.g.cpN).toBe(1);
    expect(d.g.cpX).toBe($.G.cp1X);
    expect($.G.cpWant).toBe(2);
    const s = lastRun();
    $.G.scroll += 500;
    cpStep();
    expect(lastRun()).toBe(s); // one CP1 per stage
  });

  it.each([
    ['a midboss is up', { mini: { k: 'choir' } }],
    ['a boss fight', { bossStarted: true }],
    ['the fork', { fork: { seg: 1 } }],
    ['the scroll held for a fork', { forkHold: true }],
    ['the tally', { tally: { t: 30 } }],
    ['a level-up pick is open', { pick: { opts: [] } }],
    ['the descent is ending', { clearT: 40 }],
  ])('never writes while %s', (_, over) => {
    playing(1, over);
    cpStep();
    expect(lastRun()).toBeNull();
    expect($.G.cpWant).toBe(0);
  });

  it('never writes while the ship is dead or outside play', () => {
    playing(1);
    $.P.alive = false;
    cpStep();
    expect(lastRun()).toBeNull();
    $.P.alive = true;
    $.state = 'pause';
    expect(cpSafe()).toBe(false);
    $.state = 'play';
    cpStep();
    expect(lastRun()).not.toBeNull();
  });

  it('holds CP1 until every pending closure has run (a queued WARNING or set piece is never lost)', () => {
    playing(1);
    cpStep();
    $.G.scroll = $.G.cp1X + 10;
    $.G.pend.push({ t: 30, f: () => {} });
    cpStep();
    expect(decodeRun(lastRun())!.g.cpN).toBe(0);
    $.G.pend.length = 0;
    cpStep();
    expect(decodeRun(lastRun())!.g.cpN).toBe(1);
  });

  it('writes CP1 before the release entry once midboss A is gone, so a resume replays the release pod (LS1 audit #4)', () => {
    setLayout('long4');
    playing(1);
    cpStep();
    const rel = $.G.cp1Rel;
    expect(rel).toBe(cp1Release(1, $.G));
    expect($.G.cp1X).toBe(rel - CP.preRelease);
    $.G.scroll = $.G.cp1X;
    cpStep();
    const d = decodeRun(lastRun())!;
    expect(d.g.cpN).toBe(1);
    expect(d.g.cpX).toBeLessThan(rel); // the rebuild keeps entries x > cpX: the release at rel replays
  });

  it('falls back to 150 px past the release when the first safe step comes after it fired', () => {
    setLayout('long4');
    playing(1);
    cpStep();
    const rel = $.G.cp1Rel;
    $.G.scroll = $.G.cp1X;
    $.G.pend.push({ t: 30, f: () => {} }); // a closure still pending holds CP1 past the release
    cpStep();
    $.G.scroll = rel + 5;
    $.G.pend.length = 0;
    cpStep();
    expect(decodeRun(lastRun())!.g.cpN).toBe(0); // the release fired: no CP1 between it and its pod's lifetime
    expect($.G.cp1X).toBe(rel + CP.after);
    $.G.scroll = rel + CP.after;
    cpStep();
    expect(decodeRun(lastRun())!.g.cpN).toBe(1);
    expect(decodeRun(lastRun())!.g.cpX).toBe(rel + CP.after);
  });

  it('leaves the previous checkpoint standing when the state would not read back', () => {
    playing(1);
    cpStep();
    const s = lastRun();
    $.G.score = NaN;
    expect(writeCp(1)).toBe(false);
    expect(lastRun()).toBe(s);
  });

  it('re-writes the last checkpoint on Android pause, never live state', () => {
    playing(1);
    cpStep();
    const s = lastRun();
    $.G.score = 99999;
    store().delete(RUN_KEY);
    expect(rewriteRun()).toBe(true);
    expect(store().get(RUN_KEY)).toBe(s);
  });
});

describe('rewards pending at the checkpoint (H entry criterion 1)', () => {
  it('stores the seal the clears have earned, though its banner closure is still queued', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(sealFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    playing(2, { cleared: 2, seal: 0, sealQ: () => {} }); // a fork-time seal waits in G.sealQ
    expect(cpView().seal).toBe(1);
    playing(3, { cleared: 4, seal: 1, pend: [{ t: 100, f: () => {} }] }); // a non-fork seal waits in G.pend
    cpStep();
    expect(decodeRun(lastRun())!.g.seal).toBe(2);
    playing(3, { cleared: 4, seal: 3 });
    expect(cpView().seal).toBe(3); // never lowers one
  });

  it('stores queued level-up picks and the biome boost offer', () => {
    playing(2, { lvl: 4, pickQ: 2, boostReq: 'acid' });
    cpStep();
    const d = decodeRun(lastRun())!;
    expect(d.g.pickQ).toBe(2);
    expect(d.g.boostReq).toBe('acid');
  });

  it('stores the stage clock as frames into the stage', () => {
    playing(1);
    expect(cpView().stT).toBe(100);
    expect(serializeRun(cpView()).g.stT).toBe(100);
  });
});
