// r4-perf: render/hudcues.ts, the HUD's reads of four long4 rules, checked against the rules themselves (player.ts
// applyPower / primeOk, mid/_fight.ts phaseShare / halfClock), so the HUD can't drift from the sim. Mocks as
// sealprime.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const H = vi.hoisted(() => ({ caps: [] as any[], shots: [] as any[], R: vi.fn(() => .5), ty: vi.fn(() => -1), SET: {} as any, eshots: [] as any[] }));
vi.mock('../../src/core', () => ({ PH: 270, R: H.R, TAU: Math.PI * 2, W: 480, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), dist2: () => 1e9, lerp: (a: number) => a, ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ I: { x: 0, y: 0 }, PR: new Set(), touch: { dx: 0, dy: 0 } }));
vi.mock('../../src/save', () => ({ SET: H.SET, lv: () => 0 }));
vi.mock('../../src/world', () => ({ arcs: [], caps: H.caps, ceilAt: () => -100, enemies: [], eshots: H.eshots, floorAt: () => 1000, shots: H.shots }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/fx/gunfx', () => ({ gunTier: () => 0, smoke: () => {} }));
vi.mock('../../src/flow', () => ({ killPlayer: () => {}, respawn: () => {}, feedAfter: () => {} }));
vi.mock('../../src/enemies/update', () => ({ POD: Array.from({ length: 7 }, () => ({ h: '#fff', c: '255,255,255' })), hurt: () => {}, podType: H.ty }));
vi.mock('../../src/enemies/spawn', () => ({}));

const P = await import('../../src/player');
const HC = await import('../../src/render/hudcues');
const { FT, halfClock, phaseAtt, phaseShare } = await import('../../src/enemies/mid/_fight');
const { setLayout } = await import('../../src/layout');

const KEYS = ['speed', 'missile', 'double', 'laser', 'pyre', 'options', 'wardLv'] as const;
const ship = (over: any = {}) => ({ x: 100, y: 120, alive: true, inv: 0, speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0, aegis: 0, frag: [], hist: [], cd: 0, mcd: 0, pcd: 0, ...over });
const K0 = { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1, shield: 1 };
/** the slot applyPower actually moved (a level or a fragment), or -1 (a WARD top-up, the surplus, nothing) */
function gave(ty: number, full: boolean): number {
  const before = KEYS.map((k) => $.P[k] || 0), fr = [...($.P.frag || [])];
  P.applyPower(ty, full);
  for (let i = 0; i < 7; i++) if (($.P[KEYS[i]] || 0) !== before[i] || (($.P.frag || [])[i] || 0) !== (fr[i] || 0)) return i;
  return -1;
}
beforeEach(() => {
  setLayout('long4');
  H.ty.mockReset().mockReturnValue(-1);
  H.SET.meter = 0;
  $.state = 'play';
  $.G = { tier: 1, loop: 0, stage: 1, t: 1, seal: 0, gm: {}, pk: {}, scroll: 0, score: 0, bio: 0, shake: 0, st: { hits: 0 } } as any;
  $.P = ship() as any;
  $.meta = { bio: 0, lv: {} } as any;
});

describe('podShows: a capsule shows the slot K0 FIRST will give it', () => {
  // kits short of K0 in each way, plus K0 itself; every pod type, FULL and not
  const KITS = [{}, { speed: 2 }, { speed: 2, double: 1 }, { speed: 2, laser: 1 }, { speed: 2, double: 1, missile: 1 }, { speed: 2, double: 1, pyre: 1 },
    { speed: 2, double: 1, missile: 1, options: 1 }, { speed: 2, double: 1, missile: 1, options: 1, wardLv: 1, shield: 1 }, { speed: 1, options: 1, wardLv: 1, shield: 0 }];
  it('matches applyPower on every kit short of K0, every pod type, at seal 0', () => {
    let moved = 0;
    for (const kit of KITS) for (let ty = 0; ty < 7; ty++) for (const full of [false, true]) {
      $.P = ship(kit) as any;
      const shown = HC.podShows(ty, full), got = gave(ty, full);
      if (got >= 0) expect([kit, ty, full, shown]).toEqual([kit, ty, full, got]); // the slot it shows is the slot it levelled
      if (shown !== ty) moved++;
    }
    expect(moved).toBeGreaterThan(10); // the retype is real on these kits, not a no-op that passes by matching ty
  });
  it('turns a WARD pod into THRUST on a bare ship (the request: a WARD-coloured pod that will become THRUST shows it)', () => {
    $.P = ship({ wardLv: 1, shield: 1 }) as any;
    expect(HC.podShows(6)).toBe(0);
  });
  it('keeps the type once K0 is held (the re-roll there is R(), not shown), for a FULL pod, at seal 1, on short and in meter mode', () => {
    $.P = ship(K0) as any;
    expect(HC.podShows(0)).toBe(0);
    $.P = ship({ wardLv: 1, shield: 1 }) as any;
    expect(HC.podShows(6, true)).toBe(6);
    $.G.seal = 1; expect(HC.podShows(6)).toBe(6); $.G.seal = 0;
    H.SET.meter = 1; expect(HC.podShows(6)).toBe(6); H.SET.meter = 0;
    setLayout('short'); expect(HC.podShows(6)).toBe(6);
  });
  it('leaves an unrolled pod (ty < 0) alone', () => expect(HC.podShows(-1)).toBe(-1));
});

describe('stored: SEAL PRIMING parts on a sealed slot', () => {
  it('counts what primeOk stored and turns ready at the whole level', () => {
    $.P = ship(K0) as any;
    expect(HC.stored(5)).toBeNull();
    P.applyPower(5, false);
    expect(HC.stored(5)).toEqual({ n: 1, nd: 3, ready: false });
    P.applyPower(5, false); P.applyPower(5, false);
    expect(HC.stored(5)).toEqual({ n: 3, nd: 3, ready: true });
    expect(P.slotMaxed(5)).toBe(true); // the old bar went blank here: slotMaxed hid the fragments
  });
  it('shows nothing on an open slot (the ordinary progress bar) or on short', () => {
    $.P = ship({ speed: 1, frag: [1] }) as any;
    expect(HC.stored(0)).toBeNull();
    $.P = ship({ ...K0, frag: [0, 0, 0, 0, 0, 2] }) as any;
    setLayout('short');
    expect(HC.stored(5)).toBeNull();
  });
});

describe('floorHeld / lurched: the half floor and the half clock', () => {
  const boss = (o: any = {}) => ({ hp: 100, max: 100, t: 0, leave: 1080, ...o });
  it('holds exactly while phaseShare holds a hit back', () => {
    const e: any = boss({ hp: 80 });
    expect(HC.floorHeld(e)).toBeNull(); // no attack counted yet: not a floor kind as far as the HUD can tell
    phaseAtt(e, 30);
    for (const t of [0, 10, 39, 40, 41]) {
      e.t = t; if (t === 10) phaseAtt(e, 30);
      const held = HC.floorHeld(e), share = phaseShare(e, 1000);
      expect([t, held != null]).toEqual([t, share < 1]);
    }
  });
  it('sits at the half line in the first half and at 1 HP in the second', () => {
    const e: any = boss({ hp: 80 }); phaseAtt(e, 30);
    expect(HC.floorHeld(e)).toBe(.5);
    e.hp = 30; e.hfN = [2, 0]; e.hfT = [0, 0];
    expect(HC.floorHeld(e)).toBeCloseTo(1 / 100);
  });
  it('marks a draw that saw halfClock lurch, even with steps (burn, open hits) in between, and not an earned break', () => {
    const due = 1080 * FT.halfK, e: any = boss({ hp: 70, t: due });
    const prev = e.hp, pt = due - 1; halfClock(e);
    expect(HC.lurched(e, prev, pt)).toBe(true);
    e.hp -= 7; e.t += 2; // two more steps before the draw: burn and a second-half hit took HP off halfClock's value
    expect(HC.lurched(e, prev, pt)).toBe(true);
    expect(HC.lurched(e, e.hp, e.t)).toBe(false); // the next draw: once only
    const f: any = boss({ hp: 40, t: 100 }); // a break earned by damage, before the clock is due
    expect(HC.lurched(f, 60, 99)).toBe(false);
    setLayout('short');
    expect(HC.lurched(e, prev, pt)).toBe(false);
  });
});
