// LS2-0 studio pass: the registry hooks a pool lane needs on day one, through the real enemies/update.ts.
// - MidSim.hurt: a WINDOW or ANGLE kind scales its own hits (spec §6.2), 0 a tink, so no lane edits hurt()
// - a `wip` kind (?mids=wip) never touches the real profile: no first-kill pay, no meta.mbK, no meta.mb
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

/** the roster plus what a pool lane adds: a finished kind with a hurt hook, and a wip one */
vi.mock('../../src/enemies/mid/roster', async (orig) => {
  const m = await orig<typeof import('../../src/enemies/mid/roster')>();
  const ROSTER = [...m.ROSTER,
    { k: 'shell', name: 'THE SHELL', label: 'SHELL', tag: 'WINDOW', pool: 'ice', min: 0, fit: { up: 20, dn: 20, hw: 20 } },
    { k: 'greybox', name: 'THE GREYBOX', label: 'GREYBOX', tag: 'ANGLE', pool: 'ice', min: 1, fit: { up: 20, dn: 20, hw: 20 }, wip: true }];
  const midRow = (k: string) => ROSTER.find((r) => r.k === k);
  // defineMid checks the row against the extended roster
  const defineMid = (k: string, sim: any) => { if (!midRow(k)) throw new Error('no row ' + k); m.MID_SIM[k] = sim; m.MID_ET[k] = sim.et; };
  return { ...m, ROSTER, midRow, defineMid };
});
// enemies/update.ts pulls in canvas/audio/DOM modules at import time; stub them (the damage.test.ts pattern)
const noop = () => {};
const pops: string[] = [];
vi.mock('../../src/core', () => ({ FIRE: {}, PH: 270, R: () => .99, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, dist2: () => 1e9, lerp: (a: number) => a, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, sstep: (v: number) => v }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 270, geysers: [], orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: (_x: number, _y: number, t: string) => pops.push(t), spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: () => {}, pk: () => 0, spillSlick: () => {} }));
vi.mock('../../src/stages', () => ({ clearStage: () => {}, deepPay: () => 1 }));
vi.mock('../../src/enemies/spawn', () => ({ BS: () => 1, aimA: () => 0, banner: () => {}, eshoot: () => {}, every: () => false, fan: () => {}, mk: () => ({}), onScreen: () => true, ring: () => {}, wrapA: (a: number) => a }));
vi.mock('../../src/mutations', () => ({ countKill: () => {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => {}, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoKilled: () => {}, updUfo: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: () => {}, eliteTick: () => {} }));

const { hurt, killEnemy } = await import('../../src/enemies/update');
const { defineMid } = await import('../../src/enemies/mid/roster');
const { meetMid } = await import('../../src/midslot');
const L = await import('../../src/layout');

/** the shell: closed (e.shut) it takes x0.15, and its front (hx < e.x) only tinks */
let calls = 0;
defineMid('greybox', { et: { hp: 100, r: 20, mid: 1 }, word: 'X', update: () => {} });
defineMid('shell', { et: { hp: 100, r: 20, mid: 1 }, word: 'X', update: () => {}, hurt: (e, _d, hx) => (calls++, hx < e.x ? 0 : e.shut ? .15 : 1) });

const run = () => {
  L.setLayout('long4');
  $.G = { loop: 0, stage: 1, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0 }, hitstop: 0 };
  $.P = { x: 90, y: 135 };
  $.meta = { bio: 0 };
};
/** a live midboss of kind k at x 300 */
const mid = (k: string, hp = 100) => ({ k, x: 300, y: 135, hp, max: hp, mid: 1, mini: 1, score: 0, bio: 0, gsz: 3 }) as any;

describe('MidSim.hurt', () => {
  afterEach(() => L.setLayout('short'));

  it('scales a hit by what the kind returns', () => {
    run();
    const e = mid('shell');
    hurt(e, 10, 310, 135, 1);
    expect(e.hp).toBe(90);
    e.shut = 1;
    hurt(e, 10, 310, 135, 1);
    expect(e.hp).toBeCloseTo(88.5);
  });

  it('turns a hit the kind returns 0 for into a tink: no damage, a short flash', () => {
    run();
    const e = mid('shell');
    hurt(e, 10, 290, 135, 1);
    expect(e.hp).toBe(100);
    expect(e.flash).toBe(1);
  });

  it('leaves a kind with no hook, and a non-midboss, at full damage without asking', () => {
    run();
    calls = 0;
    const e = mid('cyst');
    hurt(e, 10, 290, 135, 1);
    expect(e.hp).toBe(90);
    const d = { k: 'shell', x: 300, y: 135, hp: 100, max: 100, score: 0, bio: 0, gsz: 1 } as any; // no e.mid
    hurt(d, 10, 290, 135, 1);
    expect(d.hp).toBe(90);
    expect(calls).toBe(0);
  });
});

describe('a wip kind and the real profile', () => {
  afterEach(() => L.setLayout('short'));

  it('pays no first-kill biomass and records nothing for a wip kind, while a finished one still pays', () => {
    run();
    killEnemy(mid('greybox'));
    expect($.meta.bio).toBe(0);
    expect($.meta.mbK).toBeUndefined();
    killEnemy(mid('shell'));
    expect($.meta.mbK).toEqual({ shell: 1 });
  });

  it('does not count meeting a wip kind in meta.mb', () => {
    run();
    meetMid('greybox');
    meetMid('cyst');
    expect($.meta.mb).toEqual({ cyst: 1 });
  });
});
