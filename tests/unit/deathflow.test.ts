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
/** the queue grouped back into its waves (death.ts flies each carrier as its own entry, RECOVERY.file apart) */
const waves = (q: any[]) => { const o: any[] = []; for (const e of q) { const w = o[o.length - 1]; if (w && e.t === w.t + w.pods.length * D.RECOVERY.file) w.pods.push(...e.pods); else o.push({ t: e.t, pods: [...e.pods] }); } return o; };
const D = await import('../../src/death');

const KIT = { speed: 3, missile: 1, laser: 1, double: 0, pyre: 0, options: 2, wardLv: 2, shield: 2 };
const died = (tier: number, over: any = {}) => {
  $.G = { tier, loop: 0, stage: 1, lives: 2, cleared: 1, gm: {}, st: { deaths: 1, hits: 2 }, route: [null, null], scroll: 6200, pend: [], ...over } as any;
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
    expect(waves($.G.recovery).map((q: any) => [q.t, q.pods])).toEqual([[D.RECOVERY.r1, [{ ty: 0 }, { ty: 3, full: true }, { ty: 1 }]], [D.RECOVERY.r1 + D.RECOVERY.r2, [{ ty: 5 }, { ty: 5 }, { ty: 6 }]]]); // R2 carries its WARD pod (RECOVERY.r2Ward on, W6 round 2)
    expect($.G.feed.d).toContain('BLACK BOX'); // ux: the parts' arrival (no death feed was up)
    expect(H.caps.length).toBe(0); // nothing flies until R1's time
  });

  it('turns BLACK BOX off on Very Hard, and queues plain pods without it', () => {
    H.salvage = 1;
    died(3);
    F.respawn();
    const full = () => waves($.G.recovery)[0].pods.filter((p: any) => p.full).length;
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
  it('a death drops the seal-primed stored parts (resetPlayer clears P.frag; tune-tc)', () => {
    for (const t of [0, 1]) {
      died(t);
      $.P.frag = [2, 2, 0, 0, 0, 3, 2];
      $.P.alive = true;
      F.killPlayer();
      F.respawn();
      expect($.P.frag).toEqual([]);
    }
  });
  it('Easy keeps its perks (decision 11): no scar; Normal and up pay it', () => {
    for (const t of [0, 1, 2, 3]) {
      H.scar.mockClear();
      died(t);
      $.P.alive = true;
      F.killPlayer();
      expect(H.scar).toHaveBeenCalledTimes(t === 0 ? 0 : 1);
    }
  });
  it('Easy R1 returns exactly the slot the gradual strip took (decision 10): one FULL pod a level', () => {
    died(0);
    $.P.alive = true;
    F.killPlayer();
    F.respawn();
    expect(waves($.G.recovery)[0].pods).toEqual([{ ty: 5, full: true }, { ty: 5, full: true }]); // KIT's WRAITH 2
    expect(waves($.G.recovery)[1].pods).toEqual([{ ty: 6 }, { ty: 6 }]);
  });

  it('names what the death took, and takes the Descent 1 rig offline until the next clear', () => {
    H.scar.mockReturnValue('serrated marrow'); // the longest perk name: the line must still fit
    H.graft.mockReturnValue(true);
    died(1, { cleared: 2 });
    $.P.alive = true;
    F.killPlayer();
    expect($.G.rigOff).toBe(1);
    expect($.G.rigOffC).toBe(2);
    expect($.G.feed.d).toBe('GRAFTS -1 // SERRATED MARROW -1 // CONTRAPTION OFF TILL NEXT CLEAR');
    expect($.G.feed.d.length).toBeLessThanOrEqual(70); // loc / ux: the banner's limit
    H.blob = cpBlob({ tier: 1, cleared: 2 });
    F.respawn();
    expect($.G.rigOff).toBe(1); // the restored G (saved before the death) gets it back from the death
    expect($.G.feed.d).toContain('CONTRAPTION OFF');
    expect($.G.pend.length).toBe(1); // RECOVERY follows it, never appended
    $.G.pend[0].f();
    expect($.G.feed.s).toBe('RECOVERY');
  });

  it('carries a spent LAST GASP across the restart, so the replay cannot refill it', () => {
    died(1, { gaspD: 0 }); // the checkpoint blob was written before the gasp was spent
    F.respawn();
    expect($.G.gaspD).toBe(0);
  });
  it('keeps the one-time PARTS STORED line said across the restart (round-4 integration)', () => {
    died(1, { primeLog: 1 }); // the checkpoint blob predates the first stored part
    F.respawn();
    expect($.G.primeLog).toBe(1);
  });
});

describe('feedAfter (ux-designer: no banner overwrites an unread one)', () => {
  const run = () => { for (let k = 0; k < 400; k++) for (let i = $.G.pend.length - 1; i >= 0; i--) { const p = $.G.pend[i]; if (--p.t <= 0) { $.G.pend.splice(i, 1); p.f(); } } };
  it('chains two queued banners instead of firing them on one frame', () => {
    $.G = { pend: [], feed: { s: 'DEATH', t: 60 } } as any;
    const shown: string[] = [];
    const a = { s: 'SALVAGE', t: 170 }, b = { s: 'RECOVERY', t: 200 };
    F.feedAfter(a);
    F.feedAfter(b);
    expect($.G.pend.map((p: any) => p.t)).toEqual([60, 150]);
    for (let k = 0; k < 200; k++) { for (let i = $.G.pend.length - 1; i >= 0; i--) { const p = $.G.pend[i]; if (--p.t <= 0) { $.G.pend.splice(i, 1); p.f(); } } if (shown.at(-1) !== $.G.feed.s) shown.push($.G.feed.s); }
    expect(shown).toEqual(['DEATH', 'SALVAGE', 'RECOVERY']);
  });
  it('waits behind a newer banner that took the feed meanwhile', () => {
    $.G = { pend: [], feed: { s: 'DEATH', t: 60 } } as any;
    F.feedAfter({ s: 'RECOVERY', t: 200 });
    $.G.feed = { s: 'GRAFT GROWN', t: 150 };
    for (let k = 0; k < 60; k++) for (let i = $.G.pend.length - 1; i >= 0; i--) { const p = $.G.pend[i]; if (--p.t <= 0) { $.G.pend.splice(i, 1); p.f(); } }
    expect($.G.feed.s).toBe('GRAFT GROWN');
    run();
    expect($.G.feed.s).toBe('RECOVERY');
  });
  it('shows at once when nothing is up', () => {
    $.G = { pend: [], feed: null } as any;
    F.feedAfter({ s: 'RECOVERY', t: 200 });
    expect($.G.feed.s).toBe('RECOVERY');
  });
});

describe('gate D1: the power goes with the ship', () => {
  it('strips the dying ship at once on long4 (rank reads it during the 150 f before the respawn), and the respawn and R1 still see what died', () => {
    died(0);
    $.P.alive = true;
    F.killPlayer();
    expect([$.P.speed, $.P.laser, $.P.missile, $.P.options, $.P.wardLv, $.P.shield]).toEqual([0, 0, 0, 0, 0, 0]);
    F.respawn(); // Easy: in place, the gradual strip from the ship that died
    expect([$.P.speed, $.P.laser, $.P.missile, $.P.options]).toEqual([3, 1, 1, 0]);
    expect($.G.deadP).toBeNull();
  });
  it("leaves the dying ship as it was on short", () => {
    setLayout('short');
    died(1);
    $.P.alive = true;
    F.killPlayer();
    expect($.P.laser).toBe(1);
  });
});

describe('graft pods on screen (economy-designer: D2 in place)', () => {
  it('a death purges a graft pod still flying, so it cannot hand the lost level back', () => {
    died(0);
    $.P.alive = true;
    H.caps.push({ graft: 'cal', glv: 3 }, { ty: 2 });
    F.killPlayer();
    expect(H.caps.filter((c) => c.purged).length).toBe(1);
    expect(H.graft).toHaveBeenLastCalledWith($.G, true); // the counter rewinds as if wiped, in place too
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
