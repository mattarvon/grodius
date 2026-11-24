// tune-tc (gates E2, E3, E4, E5): player.ts on long4. SEAL PRIMING: once the ship holds the whole seal-0 kit (K0), a
// sealed slot's pod is stored toward its next level, and the stored levels grow in when the seal breaks; at seal 0 a
// maxed pod is re-rolled as it is taken; the long4 gun and perk numbers. short keeps today's game. Mocks as
// ward.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const H = vi.hoisted(() => ({ caps: [] as any[], shots: [] as any[], R: vi.fn(() => .5), ty: vi.fn(() => -1), SET: {} as any, feed: [] as any[] }));
vi.mock('../../src/core', () => ({ PH: 270, R: H.R, TAU: Math.PI * 2, W: 480, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), dist2: () => 1e9, lerp: (a: number) => a, ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ I: { x: 0, y: 0 }, PR: new Set(), touch: { dx: 0, dy: 0 } }));
vi.mock('../../src/save', () => ({ SET: H.SET, lv: () => 0 }));
vi.mock('../../src/world', () => ({ arcs: [], caps: H.caps, ceilAt: () => -100, enemies: [], floorAt: () => 1000, shots: H.shots }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/fx/gunfx', () => ({ gunTier: () => 0, smoke: () => {} }));
vi.mock('../../src/flow', () => ({ killPlayer: () => {}, respawn: () => {}, feedAfter: (f: any) => H.feed.push(f) }));
vi.mock('../../src/enemies/update', () => ({ POD: Array.from({ length: 7 }, () => ({ h: '#fff', c: '255,255,255' })), hurt: () => {}, podType: H.ty }));
vi.mock('../../src/enemies/spawn', () => ({}));

const P = await import('../../src/player');
const { setLayout } = await import('../../src/layout');

const ship = (over: any = {}) => ({ x: 100, y: 120, alive: true, inv: 0, speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0, aegis: 0, frag: [], hist: [], cd: 0, mcd: 0, pcd: 0, ...over });
/** K0: THRUST 2, MISSILE 1, SPLIT, WRAITH 1, WARD 1 (the seal-0 ceiling) */
const K0 = { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1, shield: 1 };

beforeEach(() => {
  setLayout('long4');
  H.shots.length = 0;
  H.ty.mockReset().mockReturnValue(-1);
  H.SET.meter = 0;
  H.feed.length = 0;
  $.state = 'play';
  $.G = { tier: 1, loop: 0, stage: 1, t: 1, seal: 0, gm: {}, pk: {}, scroll: 0, score: 0, bio: 0, st: { hits: 0 } } as any;
  $.P = ship(K0) as any;
  $.meta = { bio: 0, lv: {} } as any;
});

describe('SEAL PRIMING (long4, seal 0)', () => {
  it('stores a sealed slot pod toward its next level, then the slot counts as maxed', () => {
    expect(P.slotMaxed(5)).toBe(false); // WRAITH 2 needs 3
    for (let k = 0; k < 3; k++) P.applyPower(5, false);
    expect([$.P.options, $.P.frag[5]]).toEqual([1, 3]);
    expect(P.slotMaxed(5)).toBe(true);
    P.applyPower(0, true); // a FULL pod stores the whole level, never past the seal
    expect([$.P.speed, $.P.frag[0]]).toEqual([2, 2]);
  });
  it('never primes ARC or PYRE (they would swap out the held form)', () => {
    expect(P.slotMaxed(3)).toBe(true);
    expect(P.slotMaxed(4)).toBe(true);
    expect(P.primeOk(3) || P.primeOk(4)).toBe(false);
  });
  it('the seal breaking grows every stored level in on one frame, under one banner', () => {
    $.P.frag = [2, 2, 0, 0, 0, 3, 2];
    $.G.seal = 1;
    P.updatePlayer();
    expect([$.P.speed, $.P.missile, $.P.options, $.P.wardLv, $.P.shield]).toEqual([3, 2, 2, 2, 2]); // K1
    expect(H.feed.length).toBe(1);
    expect(H.feed[0].s).toBe('STORED PARTS GROW IN');
  });
  it('drops a stored MISSILE level once the ship flies PYRE instead', () => {
    $.P = ship({ ...K0, missile: 0, pyre: 1, frag: [0, 2] }) as any;
    $.G.seal = 1;
    P.updatePlayer();
    expect([$.P.missile, $.P.pyre, $.P.frag[1]]).toEqual([0, 1, 0]);
  });
  it('waits for the whole K0: below the ceiling a sealed slot stays maxed', () => {
    $.P = ship({ ...K0, options: 0 }) as any;
    expect(P.slotMaxed(0)).toBe(true);
    expect(P.slotMaxed(5)).toBe(false); // WRAITH 1 is still to earn
  });
  it('a WARD pod mends a broken hit before it primes', () => {
    $.P.shield = 0;
    P.applyPower(6, false);
    expect([$.P.shield, $.P.frag[6] || 0]).toEqual([1, 0]);
  });
  it('never in meter mode (its POWER buys whole levels)', () => {
    H.SET.meter = 1;
    expect(P.primeOk(5)).toBe(false);
    expect(P.slotMaxed(5)).toBe(true);
  });
  it('one non-FULL pod stores one fragment (a death drops them: flow.ts resetPlayer frag [], deathflow.test)', () => {
    P.applyPower(5, false);
    expect($.P.frag[5]).toBe(1);
  });
  it('only at seal 0, only on long4', () => {
    $.G.seal = 1;
    $.P = ship({ speed: 3, missile: 2, double: 1, options: 2, wardLv: 2, shield: 2 }) as any;
    expect(P.slotMaxed(5)).toBe(true);
    $.G.seal = 0;
    $.P = ship(K0) as any;
    setLayout('short');
    expect(P.slotMaxed(5)).toBe(true);
    expect(P.primeOk(5)).toBe(false);
  });
});

describe('K0 FIRST: short of K0 at seal 0, a pod for a slot already at its K0 level becomes the first missing slot (long4, W6 round 3)', () => {
  it('turns a full MISSILE pod into the missing WRAITH, with no R() (it was a podType re-roll)', () => {
    $.P = ship({ ...K0, options: 0 }) as any; // MISSILE full, WRAITH open
    H.ty.mockReturnValue(3);
    P.applyPower(1, false);
    expect(H.ty).not.toHaveBeenCalled();
    expect([$.P.frag[5], $.G.score]).toEqual([1, 0]);
  });
  it('turns a WARD pod into the missing THRUST even with the shield down (no top-up while K0 is short)', () => {
    $.P = ship({ ...K0, speed: 1, shield: 0 }) as any;
    P.applyPower(6, false);
    expect(H.ty).not.toHaveBeenCalled();
    expect([$.P.shield, $.P.speed]).toEqual([0, 2]);
  });
  it('fills the gaps in R1 then R2 order: THRUST, the main gun (SPLIT), the side gun (MISSILE), WRAITH, WARD', () => {
    $.P = ship({ speed: 2, wardLv: 1, shield: 1 }) as any; // no gun, no side gun, no WRAITH
    P.applyPower(0, false); // THRUST is at its seal-0 cap: the gun first
    expect([$.P.double, $.P.missile, $.P.options]).toEqual([1, 0, 0]);
  });
  it('sends an ARC pod to the gap while SPLIT is held, so the gun form never swaps (qa-lead)', () => {
    $.P = ship({ ...K0, options: 0 }) as any;
    P.applyPower(3, false);
    expect([$.P.double, $.P.laser, $.P.frag[5]]).toEqual([1, 0, 1]);
  });
  it('leaves a FULL pod alone (BLACK BOX), and does nothing from seal 1 (qa-lead)', () => {
    $.P = ship({ ...K0, options: 0 }) as any;
    P.applyPower(0, true); // a FULL THRUST pod: THRUST 3 is sealed, so it stays the surplus it was
    expect($.P.frag[5] || 0).toBe(0);
    $.G.seal = 1;
    $.P = ship({ ...K0, options: 0 }) as any;
    P.applyPower(1, false); // MISSILE 2 opens at seal 1: it takes its own fragment
    expect([$.P.frag[1], $.P.frag[5] || 0]).toEqual([1, 0]);
  });
  it('lets a pod for a slot K0 still needs through unchanged', () => {
    $.P = ship({ ...K0, options: 0 }) as any;
    P.applyPower(5, false);
    expect([$.P.frag[5], $.P.missile]).toEqual([1, 1]);
  });
  it('past K0 a maxed pod is re-rolled as before, and falls back to the surplus when nothing is open (podType -1)', () => {
    $.P = ship({ ...K0, shield: 1 }) as any;
    $.G.seal = 0;
    P.applyPower(2, false); // SPLIT held: maxed; the K0 ship primes only THRUST / its MISSILE / WRAITH / WARD
    expect(H.ty).toHaveBeenCalledTimes(1);
    expect($.G.score).toBe(1500);
  });
  it('never re-rolls past seal 0, so a THRUST pod never swaps the held gun form (economy-designer)', () => {
    $.G.seal = 1;
    $.P = ship({ speed: 3, missile: 2, double: 1, options: 2, wardLv: 2, shield: 2 }) as any; // K1: ARC and PYRE still open
    H.ty.mockReturnValue(3);
    for (let k = 0; k < 3; k++) P.applyPower(0, false);
    expect(H.ty).not.toHaveBeenCalled();
    expect([$.P.double, $.P.laser, $.P.missile, $.P.pyre]).toEqual([1, 0, 2, 0]);
  });
  it('a FULL pod and short keep the surplus (no draw)', () => {
    $.P = ship({ ...K0, options: 0 }) as any;
    P.applyPower(1, true);
    setLayout('short');
    P.applyPower(1, false);
    expect(H.ty).not.toHaveBeenCalled();
    expect($.G.score).toBe(3000);
  });
});

describe('long4 gun numbers (gate E4)', () => {
  const fire = (over: any) => { H.shots.length = 0; $.P = ship(over) as any; P.fire(); return H.shots; };
  it('ARC hits x1.3 and a PYRE I eye .6 on long4 (PYRE II keeps 5), x1.7 and 5 on short', () => {
    expect(fire({ laser: 1 })[0].dmg).toBeCloseTo(1.3);
    expect(fire({ pyre: 1 }).find((s: any) => s.k === 'pyre').dmg).toBeCloseTo(.6);
    expect(fire({ pyre: 2 }).find((s: any) => s.k === 'pyre').dmg).toBeCloseTo(5);
    setLayout('short');
    expect(fire({ laser: 1 })[0].dmg).toBeCloseTo(1.7);
    expect(fire({ pyre: 1 }).find((s: any) => s.k === 'pyre').dmg).toBeCloseTo(5);
  });
});

describe('long4 perk curves and graft steps (gate E5, E4)', () => {
  it('MARROW 8/20/30 and TWITCH 11/18/24 on long4; short keeps .1 * l and 8/15/21 exactly', async () => {
    const PK = await import('../../src/perks');
    expect([1, 2, 3].map(PK.marrowB)).toEqual([.08, .2, .3]);
    expect([1, 2, 3].map(PK.twitchB)).toEqual([.11, .18, .24]);
    setLayout('short');
    expect([1, 2, 3].map(PK.marrowB)).toEqual([.1, .1 * 2, .1 * 3]);
    expect([1, 2, 3].map(PK.twitchB)).toEqual([.08, .15, .21]);
  });
  it('SERRATION steps 1.06 on long4 (1.25 on short); the cards read the live step', async () => {
    const MU = await import('../../src/mutations');
    $.G.gm = { serr: 1 };
    expect(MU.gunDm()).toBeCloseTo(1.06);
    const serr = MU.GM.find((m: any) => m.id === 'serr');
    expect([serr.dl(1), serr.d]).toEqual(['+6% damage, barbed rounds', '+6% damage']);
    setLayout('short');
    expect(MU.gunDm()).toBeCloseTo(1.25);
    expect([serr.dl(2), serr.d]).toEqual(['+56% damage, barbed rounds', '+25% damage']);
  });
});
