// D31 (audit d31-economy.md §2.2): a cleared formation drops its pod on the entry's grpPod chance (killEnemy in
// enemies/update.ts). Short (grpPod 1) draws no extra R(); long4 (.22, fit 1) draws one per cleared formation; the biome
// breath's release formation (group.pod, biomes.ts biomeScript) always drops and draws nothing
import { afterEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// enemies/update.ts pulls in canvas/audio/DOM modules at import time; stub them (the firstkill.test.ts pattern), with
// a scripted R that counts its draws
const noop = () => {};
const caps: any[] = [];
const rq = vi.hoisted(() => ({ q: [] as number[], n: 0 }));
vi.mock('../../src/core', () => ({ FIRE: {}, PH: 270, R: () => { rq.n++; return rq.q.length ? rq.q.shift() : .99; }, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, dist2: () => 1e9, lerp: (a: number) => a, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, sstep: (v: number) => v }));
vi.mock('../../src/save', () => ({ SET: {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/world', () => ({ caps, ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 270, geysers: [], orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: noop, flash: noop, gib: noop, gore: noop, mist: noop, pop: noop, spark: noop, splat: noop }));
vi.mock('../../src/perks', () => ({ gainXP: () => {}, pk: () => 0, spillSlick: () => {} }));
vi.mock('../../src/stages', () => ({ clearStage: () => {}, deepPay: () => 1 }));
vi.mock('../../src/enemies/spawn', () => ({ BS: () => 1, aimA: () => 0, banner: () => {}, eshoot: () => {}, every: () => false, fan: () => {}, mk: () => ({}), onScreen: () => true, ring: () => {}, wrapA: (a: number) => a }));
vi.mock('../../src/mutations', () => ({ countKill: () => {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, playerHit: () => {}, slotMaxed: () => false }));
vi.mock('../../src/contraptions', () => ({ onKillContraptions: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoKilled: () => {}, updUfo: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteKill: () => {}, eliteTick: () => {} }));

const { killEnemy } = await import('../../src/enemies/update');
const L = await import('../../src/layout');

/** kill the last drone of a one-drone formation on layout id, R() answering q first; returns pods dropped and draws */
const clear = (id: 'short' | 'long4', q: number[], pod?: number) => {
  L.setLayout(id);
  $.G = { loop: 0, stage: 1, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0 }, hitstop: 0 };
  $.P = { x: 90, y: 135 };
  $.meta = { bio: 0 };
  caps.length = 0;
  rq.q = [...q]; rq.n = 0;
  killEnemy({ k: 'drone', x: 300, y: 135, score: 100, bio: 0, gsz: 1, group: { n: 1, killed: 0, ...(pod ? { pod } : {}) } });
  return { pods: caps.length, n: rq.n };
};
/** the R() draws dropCap itself makes (blue roll, phase, podType) when they answer .99: a dropped pod costs these on every entry */
const DROP_DRAWS = 3;

describe('formation pod drop (D31 grpPod)', () => {
  afterEach(() => L.setLayout('short'));

  it('always drops on short and draws no R() beyond the pod itself', () => {
    expect(clear('short', [])).toEqual({ pods: 1, n: DROP_DRAWS });
  });

  it('drops on long4 when its one roll is under .22 (fit 1), and not otherwise', () => {
    expect(clear('long4', [.2199])).toEqual({ pods: 1, n: 1 + DROP_DRAWS });
    expect(clear('long4', [.22])).toEqual({ pods: 0, n: 1 });
    expect(clear('long4', [.99])).toEqual({ pods: 0, n: 1 });
  });

  // G1: a one-drone formation cannot tell "roll at the last kill" from "roll at every kill"; three drones can
  /** kill the n drones of one n-drone formation on layout id, R() answering q first; returns the R() draws after each kill */
  const clearN = (id: 'short' | 'long4', n: number, q: number[]) => {
    L.setLayout(id);
    $.G = { loop: 0, stage: 1, score: 0, bio: 0, combo: 0, comboT: 0, kills: 0, maxCombo: 0, st: { kills: 0, chain: 0 }, hitstop: 0 };
    $.P = { x: 90, y: 135 };
    $.meta = { bio: 0 };
    caps.length = 0;
    rq.q = [...q]; rq.n = 0;
    const g = { n, killed: 0 }, after: number[] = [];
    for (let i = 0; i < n; i++) { killEnemy({ k: 'drone', x: 300, y: 135, score: 100, bio: 0, gsz: 1, group: g }); after.push(rq.n); }
    return { pods: caps.length, after };
  };

  it('draws its one roll only when the last drone of a 3-drone formation dies on long4', () => {
    expect(clearN('long4', 3, [.2199])).toEqual({ pods: 1, after: [0, 0, 1 + DROP_DRAWS] });
  });

  it('draws nothing for a 3-drone formation on short beyond the pod itself', () => {
    expect(clearN('short', 3, [])).toEqual({ pods: 1, after: [0, 0, DROP_DRAWS] });
  });

  it("always drops the biome breath's release formation on long4, without a roll", () => {
    expect(clear('long4', [], 1)).toEqual({ pods: 1, n: DROP_DRAWS });
  });
});
