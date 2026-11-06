import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// sprint 3 H review (lead-programmer): a resume that throws must not wedge RESUME or the option-b death restart. A save
// that decodes should always rebuild (runsave.ts validates the kinds the rebuild indexes, runsave.test.ts), so here the
// rebuild is made to throw directly: flow.ts tryResume drops the slot and puts $.G, $.P, the screen and the layout back
const rebuild = vi.fn();
let trigger = 'a';
vi.mock('../../src/core', () => ({ PH: 270, R: () => 0, clamp: (v: number) => v, dist2: () => 1e9, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
vi.mock('../../src/save', () => ({ lv: () => 0, save: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: { shield: () => {} } }));
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

const { jumpRun, resumeLast, respawn } = await import('../../src/flow');
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
