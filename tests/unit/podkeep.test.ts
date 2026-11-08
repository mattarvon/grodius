// D31 (audit d31-economy.md §2.2): the carrier keep roll in enemies/spawn.ts mk() reads the entry's capKeep. Short keeps
// today's `R() < .65` drop exactly; long4 keeps .17. Only the threshold moves: the draw count is the same on both
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// spawn.ts pulls in DOM/canvas/audio modules at import time; stub them (the formation.test.ts pattern), with a
// scripted R so each test sets the keep roll and counts the draws
const enemies: any[] = [];
const rq = vi.hoisted(() => ({ v: .5, n: 0 }));
vi.mock('../../src/core', () => ({ PH: 270, R: () => { rq.n++; return rq.v; }, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: {} }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies, eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const { formation } = await import('../../src/enemies/spawn');
const L = await import('../../src/layout');

/** one carrier drone (cap set) spawned on layout id with the keep roll at r; returns whether it kept its pod and the
 *  R() draws its spawn made */
const carrier = (id: 'short' | 'long4', r: number) => {
  L.setLayout(id);
  $.G = { loop: 0, pow: 0, st: { spawned: 0 } };
  enemies.length = 0;
  rq.v = r; rq.n = 0;
  formation('sine', 100, 1, { cap: 1 });
  return { kept: !!enemies[0].cap, n: rq.n };
};

describe('carrier keep roll (D31 capKeep)', () => {
  beforeEach(() => L.setLayout('short'));
  afterEach(() => L.setLayout('short'));

  it("keeps a short carrier's pod exactly when today's roll did (R() >= .65)", () => {
    for (const r of [0, .3, .35, .6499, .65, .66, .83, .99]) expect(carrier('short', r).kept, String(r)).toBe(!(r < .65));
  });

  it('keeps a long4 carrier pod only at R() >= .83 (capKeep .17)', () => {
    for (const r of [.65, .7, .8299]) expect(carrier('long4', r).kept, String(r)).toBe(false);
    for (const r of [.83, .9, .99]) expect(carrier('long4', r).kept, String(r)).toBe(true);
  });

  it('draws the same number of R() on both entries: only the threshold moved', () => {
    expect(carrier('long4', .9).n).toBe(carrier('short', .9).n);
  });

  it('marks the group of a pod formation and leaves an ordinary one unmarked', () => {
    $.G = { loop: 0, pow: 0, st: { spawned: 0 } };
    enemies.length = 0;
    formation('sine', 100, 2, { pod: 1 });
    formation('sine', 100, 1);
    expect(enemies[0].group.pod).toBe(1);
    expect(enemies[0].pod).toBeUndefined(); // the flag is the group's, not passed to each drone
    expect(enemies[2].group.pod).toBeUndefined();
  });
});
