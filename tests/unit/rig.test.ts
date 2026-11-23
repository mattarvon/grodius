// W2 (DIFFICULTY-SPEC §2.2 "Contraptions", Decision 4A; §2.1 perk scar, LAST GASP, perk seal cap): contraptions.ts
// rigLive / rigLv and power.ts rigPower on long4, and perks.ts perkScar, the seal cap in the offer and LAST GASP's
// per-tier refresh. Mocks as power.test.ts: perks.ts and contraptions.ts pull in canvas/audio/DOM modules at import.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

vi.mock('../../src/core', () => ({ FIRE: 0, PH: 270, R: () => .5, TAU: Math.PI * 2, W: 480, clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), ctx: {}, dist2: () => 0, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }), sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ PR: new Set(), I: {} }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0, orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gib: () => {}, gore: () => {}, mist: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/enemies/update', () => ({ hurt: () => {} }));
vi.mock('../../src/boss/update', () => ({ bossHitByShot: () => {} }));
vi.mock('../../src/save', () => ({ SET: {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3, wardCap: () => 3 }));
vi.mock('../../src/render/util', () => ({ drawChain: () => {}, drawHookTip: () => {}, light: () => {} }));

const C = await import('../../src/contraptions');
const { POWER, rigPower } = await import('../../src/power');
const PK = await import('../../src/perks');
const { setLayout } = await import('../../src/layout');

const bolt = (rig: Record<string, number>, sockets = 3) => { $.meta = { rig: Object.keys(rig), own: Object.keys(rig), cl: { ...rig }, lv: { socket: sockets - 1 } }; };

beforeEach(() => {
  setLayout('long4');
  $.state = 'play';
  $.P = { alive: true, x: 100, y: 100, speed: 0, wardLv: 0, shield: 0, rig: C.rigFresh() };
  $.G = { loop: 0, cleared: 0, seal: 0, t: 0, gm: {}, pk: {}, stage: 0, scrollSpeed: 1 };
  bolt({ gut: 3, saw: 2, spine: 1 });
});

describe('rigLive: what runs in Descent 1 (Decision 4A)', () => {
  it('nothing in Orbit or the first biome, then only the first rig at level 1', () => {
    expect(C.rigged().length).toBe(3); // the Infirmary and the hull art still see all three bolted
    expect(C.rigLive()).toEqual([]);
    expect(C.rigLv('gut')).toBe(0);
    $.G.cleared = 2;
    expect(C.rigLive()).toEqual([{ id: 'gut', lvl: 1 }]);
    expect([C.rigLv('gut'), C.rigLv('saw'), C.rigLv('spine')]).toEqual([1, 0, 0]);
  });

  it('a death knocks it offline; the next clear wakes it and drops the saved flag', () => {
    $.G.cleared = 3;
    $.G.rigOff = 1;
    $.G.rigOffC = 3;
    expect(C.rigLive()).toEqual([]);
    C.stepContraptions();
    expect($.G.rigOff).toBe(1);
    $.G.cleared = 4;
    C.stepContraptions();
    expect($.G.rigOff).toBe(0);
    expect(C.rigLive()).toEqual([{ id: 'gut', lvl: 1 }]);
  });

  it('holds the call while a pick or the tally card is up', () => {
    $.G.cleared = 1;
    C.resetContraptions();
    C.stepContraptions();
    $.G.cleared = 2;
    $.G.pick = { opts: [] };
    C.stepContraptions();
    expect($.G.feed).toBeUndefined();
    $.G.pick = null;
    C.stepContraptions();
    expect($.G.feed.s).toBe('GUT CANNON ONLINE');
  });
  it('says the rig is ONLINE when it wakes, once', () => {
    $.G.cleared = 1;
    C.resetContraptions();
    C.stepContraptions();
    expect($.G.feed).toBeUndefined();
    $.G.cleared = 2;
    C.stepContraptions();
    expect($.G.feed.s).toBe('GUT CANNON ONLINE');
    $.G.feed = null;
    C.stepContraptions();
    expect($.G.feed).toBeNull();
  });

  it('runs every bolted rig at its level from Descent 2, and everywhere on short', () => {
    $.G.loop = 1;
    expect(C.rigLive()).toEqual([{ id: 'gut', lvl: 3 }, { id: 'saw', lvl: 2 }, { id: 'spine', lvl: 1 }]);
    $.G.loop = 0;
    setLayout('short');
    expect(C.rigLive().length).toBe(3);
  });
});

describe('rigPower follows rigLive (rank power: what does nothing counts nothing)', () => {
  it('is 0 before the stage-2 clear and one level-1 rig after it, on long4 Descent 1', () => {
    expect(rigPower()).toBe(0);
    $.G.cleared = 2;
    expect(rigPower()).toBeCloseTo(POWER.rig.gut);
    $.G.rigOff = 1;
    $.G.rigOffC = 2;
    expect(rigPower()).toBe(0);
  });
  it('counts the full rack from Descent 2', () => {
    $.G.loop = 1;
    expect(rigPower()).toBeCloseTo(3 * POWER.rig.gut + 2 * POWER.rig.saw + POWER.rig.spine);
  });
});

describe('perk scar, seal cap and LAST GASP (Decision 2A, spec §2.1-2.2)', () => {
  const pickTake = (id: string) => { $.G.pick = { opts: [id] }; PK.take(id); };

  it('perkScar eats a level of the strongest damage perk, re-offerable, and records the pick order', () => {
    PK.perksReset();
    pickTake('dmg');
    pickTake('rof');
    pickTake('scab');
    expect($.G.pkOrder).toEqual(['dmg', 'rof', 'scab']);
    expect(PK.perkScar()).toBe('rof'); // .6 like dmg, picked later
    expect($.G.pk.rof).toBeUndefined();
    expect($.G.pkOrder).toEqual(['dmg', 'scab']);
    expect(PK.perkScar()).toBe('dmg');
    expect(PK.perkScar()).toBeNull(); // SCAB WEAVE (.3) is never eaten
    expect($.G.pk.scab).toBe(1);
  });

  it('caps every perk at 1 + seal on long4: level 1 to the stage-2 clear, 2 for the rest of Descent 1', () => {
    const dmg = PK.PERKS.find((p) => p.id === 'dmg')!;
    expect(PK.perkCap(dmg)).toBe(1);
    $.G.seal = 1;
    expect(PK.perkCap(dmg)).toBe(2);
    $.G.seal = 2;
    expect(PK.perkCap(dmg)).toBe(2); // never 3 in Descent 1 (gate E7)
    $.G.loop = 1;
    expect(PK.perkCap(dmg)).toBe(3);
    $.G.loop = 0;
    setLayout('short');
    $.G.seal = 0;
    expect(PK.perkCap(dmg)).toBe(3);
  });

  it('LAST GASP fires once per descent on Normal, per stage on Easy, never on Very Hard', () => {
    PK.perksReset();
    $.G.pk.gasp = 1;
    $.G.tier = 1;
    expect(PK.lastGasp()).toBe(true);
    $.G.stage = 1;
    expect(PK.lastGasp()).toBe(false); // the next stage of the same descent: spent
    expect($.G.gaspD).toBe(0);
    $.G.loop = 1;
    expect(PK.lastGasp()).toBe(true);
    PK.perksReset();
    $.G.pk.gasp = 1;
    $.G.tier = 0;
    $.G.loop = 0;
    $.G.stage = 0;
    expect(PK.lastGasp()).toBe(true);
    expect(PK.lastGasp()).toBe(false);
    $.G.stage = 1;
    expect(PK.lastGasp()).toBe(true);
    $.G.tier = 3;
    $.G.stage = 2;
    expect(PK.lastGasp()).toBe(false);
  });

  it('describes SCAB WEAVE at 3% a level and LAST GASP per descent on long4 Normal', () => {
    $.G.tier = 1;
    expect(PK.perkDesc('scab', 2)).toBe('6% of kills regrow a WARD hit');
    expect(PK.perkDesc('gasp', 1)).toBe('once per descent, a killing blow only stuns you');
    setLayout('short');
    expect(PK.perkDesc('scab', 2)).toBe('12% of kills regrow a WARD hit');
    expect(PK.perkDesc('gasp', 1)).toBe('once per stage, a killing blow only stuns you');
  });
});
