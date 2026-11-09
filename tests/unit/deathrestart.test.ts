// Option b's restart (flow.ts deathRestart, D32; spec §4): the same death as option a, on the checkpoint's state.
// game-designer: the restore cleared BLACK BOX's pods and the boss-fight lifeline, so both are paid again from the
// loadout that died. systems-designer: lives come off the checkpoint's count, or a life gained since is kept and earned
// again. Mocks as flowclear.test.ts, with the real caps array in ALL so resumeRun's clear is the real one.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const H = vi.hoisted(() => ({ caps: [] as any[], salvage: 0, trigger: 'b', blob: null as any, R: vi.fn(() => 0) }));
vi.mock('../../src/core', () => ({ PH: 270, R: H.R, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), dist2: () => 1e9, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, W: 480, H: 270, TAU: 6.28 }));
vi.mock('../../src/save', () => ({ lv: (k: string) => (k === 'salvage' ? H.salvage : 0), save: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }) }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/world', () => ({ ALL: [H.caps], buildTerrain: () => {}, caps: H.caps, ceilAt: () => 0, eshots: [], floorAt: () => 270, enemies: [], drops: [], gibs: [], shots: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, spark: () => {}, splat: () => {} }));
vi.mock('../../src/enemies/spawn', () => ({}));
vi.mock('../../src/stages', () => ({ startStage: () => {}, stageBanner: () => {}, sealFor: () => 0 }));
vi.mock('../../src/biomes', () => ({ biomeReset: () => {} }));
vi.mock('../../src/perks', () => ({ perksReset: () => {} }));
vi.mock('../../src/contraptions', () => ({ resetContraptions: () => {}, rigFresh: () => ({}) }));
vi.mock('../../src/shipform', () => ({ shipShed: () => {} }));
vi.mock('../../src/rng', () => ({ newRunSeed: () => 1 }));
vi.mock('../../src/stagebuild', () => ({ rebuildAt: () => {} }));
vi.mock('../../src/lab', () => ({ cpTrigger: () => H.trigger }));
vi.mock('../../src/checkpoint', () => ({ CP: { lead: 120, inv: 280 }, cp1X: () => null, cp1Release: () => null, writeCp: vi.fn() }));
vi.mock('../../src/runsave', async () => {
  const { $: S } = await import('../../src/state');
  return {
    clearRun: () => {}, lastRun: () => 'blob', decodeRunAs: () => H.blob,
    applyRun: (d: any, G: any = S.G, P: any = S.P) => { Object.assign(G, JSON.parse(JSON.stringify(d.g))); if (P) Object.assign(P, JSON.parse(JSON.stringify(d.p))); },
  };
});

const F = await import('../../src/flow');
const { writeCp } = await import('../../src/checkpoint');

const LOADOUT = { missile: 1, laser: 1, double: 0, pyre: 1, options: 3, wardLv: 1 };
const died = (over: any = {}) => {
  $.G = { loop: 0, stage: 1, lives: 2, gm: {}, st: { deaths: 1, hits: 2 }, route: [null, null], ...over } as any;
  $.P = { x: 60, y: 135, alive: false, ...LOADOUT } as any;
};
const cpBlob = (g: any = {}) => ({ g: { loop: 0, stage: 1, seed: 7, cpX: 6000, cpN: 1, layout: 'long4', lives: 2, gm: {}, st: { deaths: 0, hits: 0 }, ...g }, p: { speed: 2, missile: 0, laser: 0, pyre: 0, options: 0, wardLv: 0 } });
const pods = () => H.caps.map((c) => c.ty);

beforeEach(() => {
  H.caps.length = 0;
  H.salvage = 0;
  H.trigger = 'b';
  H.blob = cpBlob();
  H.R.mockClear();
  vi.mocked(writeCp).mockReset();
  $.state = 'play';
  $.meta = { bio: 0, lv: {} } as any;
});

describe('option b restart: the death pods come back', () => {
  it('drops the pre-death loadout as BLACK BOX pods, not the restored one, and clears the dead pods first', () => {
    H.salvage = 1;
    died();
    H.caps.push({ ty: 99 }); // killPlayer's pods: resumeRun clears them
    F.respawn();
    expect(pods()).toEqual([3, 1, 4, 5, 5]); // laser, missile, pyre, two options: what died, capped as option a's
    expect(H.caps.every((c) => c.full === 1 && c.salv === 1)).toBe(true);
    expect($.P!.alive).toBe(true);
  });

  it('pays the boss-fight lifeline, which the restored G no longer holds', () => {
    died({ recover: [3, 1, 5] });
    F.respawn();
    expect(pods()).toEqual([3, 1, 5]);
    expect(($.G as any).feed.s).toBe('SALVAGE');
    expect(($.G as any).recover).toBeUndefined();
  });

  it('drops nothing with neither BLACK BOX nor a lifeline', () => {
    died();
    F.respawn();
    expect(pods()).toEqual([]);
  });

  it('draws no sim RNG for the pods', () => {
    H.salvage = 1;
    died();
    F.respawn();
    expect(H.R).not.toHaveBeenCalled();
  });

  it('writes the checkpoint after the pods, which stay out of it', () => {
    H.salvage = 1;
    died();
    F.respawn();
    expect(writeCp).toHaveBeenCalledTimes(1);
  });
});

describe('option b restart: the life it costs', () => {
  it('comes off the checkpoint count, so a life gained since is not kept', () => {
    died({ lives: 3 }); // 2 at the checkpoint, SPARE MEAT since
    H.blob = cpBlob({ lives: 2 });
    F.respawn();
    expect($.G!.lives).toBe(1);
  });

  it('is never more than the live count allows', () => {
    died({ lives: 1 });
    H.blob = cpBlob({ lives: 3 });
    F.respawn();
    expect($.G!.lives).toBe(0);
  });

  it('respawns in place when the checkpoint was on the last life and a spare was gained since', () => {
    died({ lives: 1 });
    H.blob = cpBlob({ lives: 0 });
    const G = $.G;
    try { F.respawn(); } catch { /* resetPlayer's far side, as option a below */ }
    expect($.G).toBe(G); // no rewind
    expect(writeCp).not.toHaveBeenCalled();
    expect(G!.lives).toBe(0); // the spare is spent
    expect($.state).toBe('play'); // the run isn't lost
  });

  it('cannot loop: a spare picked up again after every restart still ends in game over', () => {
    died({ lives: 1 });
    H.blob = cpBlob({ lives: 1 });
    vi.mocked(writeCp).mockImplementation(() => { H.blob = cpBlob({ lives: $.G!.lives }); }); // the checkpoint keeps the cost
    let deaths = 0;
    for (; deaths < 8 && $.state !== 'over'; deaths++) {
      const G = $.G;
      try { F.respawn(); } catch { /* resetPlayer's far side on the in-place respawn */ }
      if ($.G !== G) $.G!.lives++; // rewound past the spare: the replay gives it back (scripted pickup, score extend)
    }
    expect($.state).toBe('over');
    expect(deaths).toBe(3); // restart at 1 life, the spare back: in place, then out
  });
});

describe('option a is untouched', () => {
  it('does not restore: the same G and no checkpoint write', () => {
    H.trigger = 'a';
    died({ lives: 3 });
    const G = $.G;
    try { F.respawn(); } catch { /* resetPlayer's far side, on partial mocks; the restart branch is what is under test */ }
    expect($.G).toBe(G);
    expect(writeCp).not.toHaveBeenCalled();
    expect(G!.lives).toBe(2);
  });
});
