// W2 (DIFFICULTY-SPEC §2.1 "Death penalty", tier table; §2.2 "Lives and meta"; decisions 1A-4A): flow.ts on long4.
// A death restarts at the checkpoint on Normal/Hard/Very Hard and respawns in place on Easy; no BLACK BOX burst at the
// death site; the lifeline on Easy only; the recovery queue on every respawn and restart, BLACK BOX making R1's gun
// FULL (not on Very Hard); 3 ships in Descent 1 and HULL's ship at the Descent 2 gate; the death state a replay must
// not give back (LAST GASP spent, the rig offline). Mocks as deathrestart.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const H = vi.hoisted(() => ({ blobOver: null as any, caps: [] as any[], salvage: 0, hull: 0, blob: null as any, R: vi.fn(() => 0), scar: vi.fn((_: any) => null as string | null), graft: vi.fn((_: any, __?: boolean) => false) }));
vi.mock('../../src/core', () => ({ PH: 270, R: H.R, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), dist2: () => 1e9, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, W: 480, H: 270, TAU: 6.28 }));
vi.mock('../../src/save', () => ({ lv: (k: string) => (k === 'salvage' ? H.salvage : k === 'hull' ? H.hull : 0), save: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }), resetOpened: () => {}, voiceDropQueued: () => {}, voiceCutQuips: () => {}, voiceStopAll: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/world', () => ({ ALL: [H.caps], buildTerrain: () => {}, caps: H.caps, ceilAt: () => 0, eshots: [], floorAt: () => 270, enemies: [], drops: [], gibs: [], shots: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, spark: () => {}, splat: () => {} }));
vi.mock('../../src/enemies/spawn', () => ({}));
vi.mock('../../src/stages', () => ({ startStage: () => {}, stageBanner: () => {}, sealFor: () => 0 }));
vi.mock('../../src/biomes', () => ({ biomeReset: () => {} }));
vi.mock('../../src/perks', () => ({ perksReset: () => { $.G.gaspD = -1; $.G.pkOrder = []; }, perkScar: (G: any) => H.scar(G), perkName: (id: string) => id.toUpperCase() }));
vi.mock('../../src/mutations', () => ({ graftDeath: (G: any, w?: boolean) => H.graft(G, w) }));
vi.mock('../../src/contraptions', () => ({ resetContraptions: () => {}, rigFresh: () => ({}), rigLive: (G: any) => ((G.cleared | 0) >= 2 && !G.rigOff ? [{ id: 'gut', lvl: 1 }] : []) }));
vi.mock('../../src/shipform', () => ({ shipShed: () => {} }));
vi.mock('../../src/rng', () => ({ newRunSeed: () => 1 }));
vi.mock('../../src/stagebuild', () => ({ rebuildAt: () => {} }));
vi.mock('../../src/lab', () => ({ cpTrigger: () => 'a', tierPick: () => null, brutalPick: () => 0 }));
vi.mock('../../src/checkpoint', () => ({ CP: { lead: 120, inv: 280 }, cpResume: () => {}, writeCp: vi.fn() }));
vi.mock('../../src/runsave', async () => {
  const { $: S } = await import('../../src/state');
  return {
    clearRun: () => {}, lastRun: () => 'blob', decodeRunAs: () => H.blob,
    applyRun: (d: any, G: any = S.G, P: any = S.P) => { Object.assign(G, JSON.parse(JSON.stringify(d.g))); if (P) Object.assign(P, JSON.parse(JSON.stringify(d.p))); },
  };
});

const F = await import('../../src/flow');
const { writeCp } = await import('../../src/checkpoint');
const { setLayout } = await import('../../src/layout');
const D = await import('../../src/death');

const KIT = { speed: 3, missile: 1, laser: 1, double: 0, pyre: 0, options: 2, wardLv: 2, shield: 2 };
const died = (tier: number, over: any = {}) => {
  $.G = { tier, loop: 0, stage: 1, lives: 2, cleared: 1, gm: {}, st: { deaths: 1, hits: 2 }, route: [null, null], scroll: 6200, ...over } as any;
  $.P = { x: 60, y: 135, alive: false, ...KIT } as any;
  H.blob = cpBlob({ tier, ...(H.blobOver || {}) }); // the run save carries the tier (W0 runsave.ts)
};
const cpBlob = (g: any = {}) => ({ g: { loop: 0, stage: 1, seed: 7, cpX: 6000, cpN: 1, layout: 'long4', lives: 2, cleared: 1, gm: {}, st: { deaths: 0, hits: 0 }, ...g }, p: { ...KIT } });

beforeEach(() => {
  setLayout('long4');
  H.caps.length = 0;
  H.salvage = 0;
  H.hull = 0;
  H.blob = cpBlob();
  H.R.mockClear();
  H.scar.mockReset().mockReturnValue(null);
  H.graft.mockReset().mockReturnValue(false);
  vi.mocked(writeCp).mockReset();
  $.state = 'play';
  $.meta = { bio: 0, lv: {}, rig: ['gut'] } as any;
});

describe('position on death by tier (Decision 1A)', () => {
  it.each([1, 2, 3])('tier %i restarts at the checkpoint and strips the restored ship', (t) => {
    died(t);
    const G = $.G;
    F.respawn();
    expect($.G).not.toBe(G);
    expect($.G.cpX).toBe(6000);
    expect(writeCp).toHaveBeenCalledTimes(1);
    expect([$.P.speed, $.P.laser, $.P.missile, $.P.options, $.P.wardLv, $.P.shield]).toEqual([t === 1 ? 1 : 0, 0, 0, 0, 0, 0]); // C18
    expect($.P.inv).toBe(D.SURV.cpInv); // C20: 120
    expect(H.graft).toHaveBeenLastCalledWith($.G, true); // the restart wiped the pods
  });

  it('Easy respawns in place with the gradual strip, 120 f of i-frames', () => {
    died(0);
    const G = $.G;
    F.respawn();
    expect($.G).toBe(G);
    expect(writeCp).not.toHaveBeenCalled();
    expect([$.P.speed, $.P.laser, $.P.missile, $.P.options, $.P.wardLv]).toEqual([3, 1, 1, 0, 0]); // WRAITH went; WARD as Normal
    expect($.P.inv).toBe(D.SURV.respawnInv);
    expect(G.lives).toBe(1);
  });
});

describe('BLACK BOX, the lifeline and the recovery queue (C15-C17)', () => {
  it('drops no burst at the death site and queues R1 with a FULL gun pod', () => {
    H.salvage = 1;
    died(1);
    $.P.alive = true;
    F.killPlayer();
    expect(H.caps.length).toBe(0); // no burst
    F.respawn();
    expect($.G.recovery.map((q: any) => [q.t, q.pods])).toEqual([[D.RECOVERY.r1, [{ ty: 0 }, { ty: 3, full: true }, { ty: 1 }]], [D.RECOVERY.r1 + D.RECOVERY.r2, [{ ty: 5 }, { ty: 5 }]]]);
    expect($.G.feed.d).toContain('BLACK BOX'); // ux: the death's price, then the parts' arrival
    expect(H.caps.length).toBe(0); // nothing flies until R1's time
  });

  it('turns BLACK BOX off on Very Hard, and queues plain pods without it', () => {
    H.salvage = 1;
    died(3);
    F.respawn();
    const full = () => $.G.recovery[0].pods.filter((p: any) => p.full).length;
    expect(full()).toBe(0);
    H.salvage = 0;
    died(2);
    F.respawn();
    expect(full()).toBe(0);
  });

  it('keeps the fight lifeline on Easy only', () => {
    for (const t of [0, 1]) {
      H.caps.length = 0;
      died(t, { mini: { k: 'maw' } });
      $.P.alive = true;
      F.killPlayer();
      if (t === 1) expect($.G.recover).toBeUndefined();
      else expect($.G.recover).toEqual([3, 1, 5, 6].slice(0, 2));
      F.respawn();
      expect(H.caps.filter((c) => c.salv).length).toBe(t === 0 ? 2 : 0);
    }
  });

  it('draws no sim RNG on any of it', () => {
    H.salvage = 1;
    for (const t of [0, 1, 2, 3]) { died(t); $.P.alive = true; F.killPlayer(); F.respawn(); }
    expect(H.R).not.toHaveBeenCalled();
  });
});

describe('the death cost on the run (Decision 2A, 4A)', () => {
  it('names what the death took, and takes the Descent 1 rig offline until the next clear', () => {
    H.scar.mockReturnValue('dmg');
    H.graft.mockReturnValue(true);
    died(1, { cleared: 2 });
    $.P.alive = true;
    F.killPlayer();
    expect($.G.rigOff).toBe(1);
    expect($.G.rigOffC).toBe(2);
    expect($.G.feed.d).toBe('every graft lost a level // DMG lost a level // your rig is offline until the next clear');
    H.blob = cpBlob({ tier: 1, cleared: 2 });
    F.respawn();
    expect($.G.rigOff).toBe(1); // the restored G (saved before the death) gets it back from the death
    expect($.G.feed.d).toContain('rig is offline');
  });

  it('carries a spent LAST GASP across the restart, so the replay cannot refill it', () => {
    died(1, { gaspD: 0 }); // the checkpoint blob was written before the gasp was spent
    F.respawn();
    expect($.G.gaspD).toBe(0);
  });
});

describe('ships (Decision 3A)', () => {
  it('starts every profile on 3 ships in Descent 1, HULL or not, and brings HULL\'s at the Descent 2 gate', () => {
    H.hull = 1;
    $.P = null as any;
    F.newGame(0);
    expect($.G.lives).toBe(D.SHIPS.d1Spare);
    F.startLoop(1);
    expect($.G.lives).toBe(D.SHIPS.d1Spare + 1);
    expect($.G.feed.s).toBe('REINFORCED HULL');
    F.startLoop(2);
    expect($.G.lives).toBe(D.SHIPS.d1Spare + 1); // once, at the Descent 2 gate
  });

  it('DESCEND DEEPER (a Descent 2 start) carries HULL\'s ship from the start', () => {
    H.hull = 1;
    $.P = null as any;
    F.newGame(1);
    expect($.G.lives).toBe(D.SHIPS.d1Spare + 1);
  });

  it('short keeps 2 + HULL', () => {
    setLayout('short');
    H.hull = 1;
    $.P = null as any;
    F.newGame(0);
    expect($.G.lives).toBe(3);
  });
});
