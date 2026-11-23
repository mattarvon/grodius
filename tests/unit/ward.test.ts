// W2 (DIFFICULTY-SPEC §2.1 "Survival"): player.ts on long4. WARD holds hits = its level (1/2/3) and every refill and
// top-up caps there; a broken WARD hit gives 40 f of i-frames (C20); REGROWTH is half as fast and capped at
// max(1, wardLv); Short keeps today's numbers. Mocks as
// damage.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const H = vi.hoisted(() => ({ caps: [] as any[], shots: [] as any[], R: vi.fn(() => .5), wave: null as any }));
vi.mock('../../src/core', () => ({ PH: 270, R: H.R, TAU: Math.PI * 2, W: 480, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), dist2: () => 1e9, lerp: (a: number) => a, ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ I: { x: 0, y: 0 }, PR: new Set(), touch: { dx: 0, dy: 0 } }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/world', () => ({ arcs: [], caps: H.caps, ceilAt: () => -100, enemies: [], floorAt: () => 1000, shots: H.shots }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/fx/gunfx', () => ({ gunTier: () => 0, smoke: () => {} }));
vi.mock('../../src/flow', () => ({ killPlayer: () => {}, respawn: () => {} }));
vi.mock('../../src/enemies/update', () => ({ POD: Array.from({ length: 7 }, () => ({ h: '#fff', c: '255,255,255' })), hurt: () => {} }));
vi.mock('../../src/enemies/spawn', () => ({}));

const P = await import('../../src/player');
const D = await import('../../src/death');
const { setLayout } = await import('../../src/layout');

const ship = (over: any = {}) => ({ x: 100, y: 120, alive: true, inv: 0, speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0, aegis: 0, frag: [], hist: [], cd: 5, mcd: 5, pcd: 5, ...over });

beforeEach(() => {
  setLayout('long4');
  H.caps.length = 0;
  H.shots.length = 0;
  H.R.mockClear();
  H.wave = null;
  $.state = 'play';
  $.G = { tier: 1, loop: 0, stage: 0, t: 1, seal: 2, gm: {}, pk: {}, scroll: 0, st: { hits: 0 } } as any;
  $.P = ship() as any;
  $.meta = { bio: 0, lv: {} } as any;
});

describe('WARD hits = WARD level (long4)', () => {
  it('a level-up grows the shield to the new level, not to 3', () => {
    for (const l of [1, 2, 3]) {
      P.applyPower(6, true);
      expect([$.P.wardLv, $.P.shield]).toEqual([l, l]);
    }
  });
  it('a WARD pod at the cap adds a hit, never past the level, and counts as maxed when full', () => {
    $.P = ship({ wardLv: 2, shield: 0 }) as any;
    $.G.seal = 1; // WARD's cap at seal 1 is 2 (player.ts SBASE)
    P.applyPower(6, true);
    expect($.P.shield).toBe(1);
    P.applyPower(6, true);
    expect($.P.shield).toBe(2);
    expect(P.slotMaxed(6)).toBe(true);
    P.applyPower(6, true); // the surplus: no third hit
    expect($.P.shield).toBe(2);
  });
  it('short keeps the refill to WARD_MAX', () => {
    setLayout('short');
    P.applyPower(6, true);
    expect($.P.shield).toBe(P.WARD_MAX);
  });
});

describe('a broken WARD hit (C20)', () => {
  it('gives 40 f of i-frames on long4 (x1.5 a PAIN SPONGE level), 18 on short', () => {
    $.P = ship({ wardLv: 1, shield: 1 }) as any;
    expect(P.playerHit()).toBe(false);
    expect($.P.inv).toBe(40);
    $.P = ship({ wardLv: 1, shield: 1 }) as any;
    $.G.pk = { inv: 1 };
    P.playerHit();
    expect($.P.inv).toBe(60);
    setLayout('short');
    $.G.pk = {};
    $.P = ship({ wardLv: 1, shield: 1 }) as any;
    P.playerHit();
    expect($.P.inv).toBe(18);
  });
});

describe('REGROWTH (halved, capped at max(1, wardLv))', () => {
  const tick = (t: number) => { $.G.t = t; $.P.cd = 5; P.updatePlayer(); };
  it('regrows one hit every 40 s at level 1, and never past WARD 1 on a WARD-1 ship', () => {
    $.G.gm = { regrow: 2 };
    $.P = ship({ wardLv: 1, shield: 0 }) as any;
    tick(720); // today's level-2 beat: nothing on long4
    expect($.P.shield).toBe(0);
    tick(1440);
    expect($.P.shield).toBe(1);
    tick(2880);
    expect($.P.shield).toBe(1); // capped at the WARD level, not REGROWTH II's 2
    $.G.gm = { regrow: 1 };
    $.P = ship({ wardLv: 0, shield: 0 }) as any;
    tick(1200);
    expect($.P.shield).toBe(0);
    tick(2400);
    expect($.P.shield).toBe(1); // no WARD at all still regrows one membrane hit
  });
});
