import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// sprint 3 H review (lead-programmer): a resume that throws must not wedge RESUME or the option-b death restart. A save
// that decodes should always rebuild (runsave.ts validates the kinds the rebuild indexes, runsave.test.ts), so here the
// rebuild is made to throw directly: flow.ts tryResume drops the slot and puts $.G, $.P, the screen and the layout back
const rebuild = vi.fn();
let trigger = 'a';
// every sim draw is counted: a RESUME press must make none (#13; the rebuild's own builds are resume.test.ts's)
let simDraws = 0;
const draw = <T,>(v: T) => () => { simDraws++; return v; };
vi.mock('../../src/core', () => ({ PH: 270, R: draw(0), clamp: (v: number) => v, dist2: () => 1e9, pick: (a: any[]) => { simDraws++; return a[0]; }, ri: draw(0), rr: draw(0), swapRm: () => {} }));
vi.mock('../../src/save', () => ({ lv: () => 0, save: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: { shield: () => {}, die: () => {} } }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/world', () => ({ ALL: [], buildTerrain: () => {}, caps: [], ceilAt: () => 0, eshots: [], floorAt: () => 270 }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, spark: () => {}, splat: () => {} }));
vi.mock('../../src/enemies/spawn', () => ({}));
vi.mock('../../src/stages', () => ({ startStage: () => {}, stageBanner: () => {}, sealFor: () => 0 }));
vi.mock('../../src/biomes', () => ({ biomeReset: () => {} }));
vi.mock('../../src/perks', () => ({ perksReset: () => {} }));
vi.mock('../../src/contraptions', () => ({ resetContraptions: () => {}, rigFresh: () => ({}) }));
vi.mock('../../src/shipform', () => ({ shipShed: () => {} }));
vi.mock('../../src/rng', () => ({ newRunSeed: () => 1 }));
vi.mock('../../src/stagebuild', () => ({ rebuildAt: (x: number) => rebuild(x) }));
vi.mock('../../src/lab', () => ({ cpTrigger: () => trigger }));

const { jumpRun, killPlayer, resumeLast, respawn, startLoop } = await import('../../src/flow');
const { warmBlocked } = await import('../../src/warmplan');
const { parseJump } = await import('../../src/jump');
const { RUN_KEY, RUN_V, lastRun, readRun, runInfo } = await import('../../src/runsave');
const { LAYOUTS, layout, setLayout } = await import('../../src/layout');

function storage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), map: m };
}
/** a stored long4 checkpoint at stage 2 CP1 (biome slot 1), read the way boot reads it */
function stored(over: Record<string, unknown> = {}) {
  const L = LAYOUTS.long4!;
  const g = { loop: 0, stage: 2, cpX: L.stages[2].x0 + 900, cpN: 1, layout: 'long4', seed: 77, lives: 2,
    bx: [L.stages[1].x0 + 300, L.stages[2].x0 + 400, null], route: ['ice', 'fire'], visitNo: [0, 0], ...over };
  (localStorage as any).setItem(RUN_KEY, JSON.stringify({ v: RUN_V, g, p: { speed: 1 } }));
  return readRun();
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  rebuild.mockReset();
  trigger = 'a';
  setLayout('short');
});

describe('RESUME when the rebuild throws', () => {
  it('drops the checkpoint and leaves the title as it was, on its own layout, without throwing', () => {
    expect(stored()).not.toBeNull();
    rebuild.mockImplementation(() => { throw new TypeError("Cannot read properties of undefined (reading 'remix')"); });
    $.state = 'title';
    $.G = null as any;
    $.P = null as any;
    let ok: boolean | undefined;
    expect(() => { ok = resumeLast(); }).not.toThrow();
    expect(ok).toBe(false);
    expect(lastRun()).toBeNull();
    expect(runInfo()).toBeNull(); // no RESUME row on the title any more
    expect((localStorage as any).map.has(RUN_KEY)).toBe(false);
    expect(layout().id).toBe('short'); // not left on the checkpoint's long4
    expect($.state).toBe('title');
    expect($.G).toBeNull();
    expect($.P).toBeNull();
  });

  it('still resumes when the rebuild works', () => {
    stored();
    $.state = 'title';
    expect(resumeLast()).toBe(true);
    expect(rebuild).toHaveBeenCalledTimes(1);
    expect($.state).toBe('play');
    expect(layout().id).toBe('long4');
    setLayout('short');
  });
});

describe('the option-b death restart when the rebuild throws', () => {
  it('drops the checkpoint and falls back to the ordinary respawn on the same run', () => {
    trigger = 'b';
    setLayout('long4');
    stored();
    rebuild.mockImplementation(() => { throw new Error('unknown midboss kind: gorgon'); });
    const G = { loop: 0, stage: 2, lives: 2, scroll: 7000, st: { deaths: 0 } } as any;
    $.G = G;
    $.P = { x: 50, y: 100, speed: 2 } as any;
    $.state = 'play';
    expect(() => respawn()).not.toThrow();
    expect($.G).toBe(G); // the run it was on, not a half-built one
    expect(G.lives).toBe(1); // the ordinary respawn's life
    expect(G.scroll).toBe(7000);
    expect($.P.alive).toBe(true);
    expect(lastRun()).toBeNull();
    setLayout('short');
  });
});

// the jump switch (build plan LS1 row I) flies the same tryResume path: same rebuild, same backstop
describe('the option-b death restart pays the normal death cost (D32)', () => {
  /** a stored stage-2 CP1 with a fitted ship and grafts, and the live run on the same stage, dying */
  function dyingAt(storedHits: number, liveHits: number) {
    trigger = 'b';
    setLayout('long4');
    const L = LAYOUTS.long4!;
    const g = { loop: 0, stage: 2, cpX: L.stages[2].x0 + 900, cpN: 1, layout: 'long4', seed: 77, lives: 3, cur: 3, gm: { rapid: 2, seek: 0 },
      bx: [L.stages[1].x0 + 300, L.stages[2].x0 + 400, null], route: ['ice', 'fire'], visitNo: [0, 0], st: { kills: 4, spawned: 9, hits: storedHits, deaths: 0, chain: 0 } };
    (localStorage as any).setItem(RUN_KEY, JSON.stringify({ v: RUN_V, g, p: { speed: 3, missile: 2, laser: 1, options: 2, shield: 2, wardLv: 1 } }));
    readRun();
    $.G = { loop: 0, stage: 2, lives: 3, cur: 1, gm: { rapid: 1 }, scroll: 7000, st: { deaths: 1, hits: liveHits } } as any;
    $.P = { x: 50, y: 100, speed: 4, missile: 2, alive: false } as any;
    $.state = 'play';
    respawn();
  }

  it('strips the restored guns as respawn does, keeping half the THRUST', () => {
    dyingAt(1, 4);
    expect($.G.cpX).toBe(LAYOUTS.long4!.stages[2].x0 + 900); // it did restart at the checkpoint
    expect([$.P.speed, $.P.missile, $.P.laser, $.P.options, $.P.shield, $.P.wardLv]).toEqual([1, 0, 0, 0, 0, 0]);
    expect($.P.alive).toBe(true);
    expect($.P.inv).toBe(280); // the resume's i-frames (CP.inv), not respawn's 160
    expect($.G.lives).toBe(2);
    setLayout('short');
  });

  it('drops every restored graft a level and resets the power cursor', () => {
    dyingAt(1, 4);
    expect($.G.gm).toEqual({ rapid: 1, seek: 0 });
    expect($.G.cur).toBe(-1);
    expect($.G.feed.s).toBe('YOUR GRAFTS WITHER');
    setLayout('short');
  });

  it('keeps the higher hit count for the grade, whichever side it is on', () => {
    dyingAt(1, 4);
    expect($.G.st.hits).toBe(4);
    expect($.G.st.deaths).toBe(1);
    dyingAt(5, 2);
    expect($.G.st.hits).toBe(5);
    setLayout('short');
  });

  it('re-writes the checkpoint with the cost taken, so an app kill cannot give the guns back', () => {
    dyingAt(1, 4);
    const d = JSON.parse(lastRun()!);
    expect(d.p.laser).toBe(0);
    expect(d.p.speed).toBe(1);
    expect(d.g.gm.rapid).toBe(1);
    expect(d.g.cur).toBe(-1);
    expect(d.g.lives).toBe(2);
    setLayout('short');
  });

  it('leaves option a\'s death cost as it was', () => {
    $.G = { lives: 2, cur: 3, gm: { rapid: 2, seek: 0 }, st: { deaths: 0 }, scroll: 0 } as any;
    $.P = { x: 50, y: 100, alive: true, speed: 3, missile: 1 } as any;
    killPlayer();
    expect($.G.cur).toBe(-1);
    expect($.G.gm).toEqual({ rapid: 1, seek: 0 });
    respawn();
    expect([$.P.speed, $.P.missile]).toEqual([1, 0]);
    expect($.G.lives).toBe(1);
  });
});

describe('a RESUME press and the sim RNG (#13)', () => {
  it('draws the sim RNG zero times through resumeLast (resume.test.ts shows the rebuild draws none either)', () => {
    stored();
    simDraws = 0;
    expect(resumeLast()).toBe(true);
    expect(simDraws).toBe(0);
    setLayout('short');
  });
});

describe('jumpRun', () => {
  const jump = (q: string) => (parseJump(q) as any).jump;
  beforeEach(() => { setLayout('long4'); $.state = 'title'; $.G = null as any; $.P = null as any; });

  it('starts the run through the rebuild at the URL x, marked as a jump', () => {
    expect(jumpRun(jump('?stage=ice&x=900&kit=mid&seed=7'))).toBe(true);
    expect(rebuild).toHaveBeenCalledExactlyOnceWith(LAYOUTS.long4!.stages[1].x0 + 900);
    expect($.state).toBe('play');
    expect($.G).toMatchObject({ jump: true, seed: 7, stage: 1, loop: 0 });
    expect($.P.options).toBe(1);
    setLayout('short');
  });

  it('pins G.powPin only when the URL names a rank, including rank 0', () => {
    jumpRun(jump('?stage=orbit&seed=7'));
    expect($.G.powPin).toBeUndefined();
    jumpRun(jump('?stage=orbit&rank=0&seed=7'));
    expect($.G.powPin).toBe(0);
    setLayout('short');
  });

  it('returns false and leaves the title as it was when the rebuild throws', () => {
    rebuild.mockImplementation(() => { throw new Error('bad build'); });
    expect(jumpRun(jump('?stage=orbit&seed=7'))).toBe(false);
    expect($.state).toBe('title');
    expect($.G).toBeNull();
    setLayout('short');
  });

  it('never restarts a jump run at the player\'s stored checkpoint, even under option b', () => {
    trigger = 'b';
    stored();
    jumpRun(jump('?stage=biome&seed=7'));
    $.G.stage = 2;
    rebuild.mockClear();
    const G = $.G;
    respawn();
    expect(rebuild).not.toHaveBeenCalled();
    expect($.G).toBe(G);
    setLayout('short');
  });
});

// sprint 3 I+K studio review (web-specialist): the Drive's WARNING writes warnEnd on the descent clock. startLoop resets
// G.t to 0 for the next descent, so a stale warnEnd would hold the per-route warm-up for most of Descent 2+
describe('the warm-up gate across a descent', () => {
  it('starts the next descent with no WARNING window held over from the last one', () => {
    $.G = { t: 15000, warnEnd: 15200, loop: 0, stage: 4 } as any;
    $.P = { alive: true, hist: [] } as any;
    expect(warmBlocked('play', $.G as any)).toBe(true);
    startLoop(1);
    expect($.G.t).toBe(0);
    expect(warmBlocked('play', $.G as any)).toBe(false);
  });
});
