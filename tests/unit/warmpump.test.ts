// The warm-up runner, behaviourally (LS1 row K; ls1-audit S2 item 5 and the qa audit's "wiring tests match source text").
// warmPump runs against fake art units, and the WARNING it must sit out is raised through spawn.ts's real banner() and
// miniWarn(), so a rename of the banner copy can't reopen the gate (common.md hard rule 3: no warm-up inside a WARNING).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';
import { setLayout } from '../../src/layout';

// the fake art: every route unit records its builds and drops in one set, keyed as warmup.ts keys UNITS
const A = vi.hoisted(() => {
  const built = new Set<string>();
  const unit = (k: string) => ({ warm: () => { built.add(k); return false; }, built: () => built.has(k), drop: () => { built.delete(k); } });
  return { built, unit };
});
const gibs: any[] = [];
vi.mock('../../src/render/gibart', () => ({ gibAtlas: () => {} }));
vi.mock('../../src/render/wounds', () => ({ warmWound: () => false, dropWound: () => {}, woundBuilt: () => false, woundHeld: () => false, woundDC: () => null }));
vi.mock('../../src/render/heroeye', () => ({ warmHeroEye: () => false }));
vi.mock('../../src/render/eyes', () => ({ warmEyes: () => false }));
vi.mock('../../src/render/terrain', () => ({ warmDerelict: () => false }));
vi.mock('../../src/render/gross/drive', () => ({ warmDrive: () => false }));
vi.mock('../../src/render/gross/maw', () => ({
  warmMawVariant: (v: string) => A.unit('maw:' + v).warm(), dropMawVariant: (v: string) => A.unit('maw:' + v).drop(), mawVariantBuilt: (v: string) => A.unit('maw:' + v).built(),
}));
vi.mock('../../src/render/gross/biomebosses', () => ({
  warmBiomeBoss: (k: string) => A.unit(k).warm(), dropBiomeBoss: (k: string) => A.unit(k).drop(), biomeBossBuilt: (k: string) => A.unit(k).built(),
}));
vi.mock('../../src/render/gross/mid', async () => {
  const { ROSTER: rows } = await import('../../src/enemies/mid/roster');
  return { MID_ART: Object.fromEntries(rows.map((r) => [r.k, A.unit(r.k)])) };
});
// spawn.ts pulls in DOM/canvas/audio modules at import time; stubbed as in rearwave.test.ts
vi.mock('../../src/core', () => ({ PH: 254, R: () => .99, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: { dread: () => {}, tele: () => {} } }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 254, gibs }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const WU = await import('../../src/render/warmup');
const { banner, miniWarn } = await import('../../src/enemies/spawn');

const SLOT0_STAGE = 1; // long4: Orbit, biome, biome, Drive
const PICKS = ['choir', 'brood'], BOSS = 'butcher'; // a fire slot 0 (BOSS_ART.fire)
const WINDOW = 170; // frames, any WARNING length
const ops = () => WU.warmLog.map((l) => l.op + ' ' + l.k);
/** pump until idle (bounded: a spinning warm-up fails the test rather than hanging it) */
const drain = () => { let n = 0; while (WU.warmPump()) if (++n > 200) throw new Error('warmPump spins'); return n; };

beforeEach(() => {
  setLayout('long4');
  // the boot art first, off the run: it is held all session and never dropped, so later pumps see only route work
  $.state = 'title'; $.G = null;
  drain();
  A.built.clear(); gibs.length = 0; WU.warmLog.length = 0;
  $.state = 'play';
  $.G = { t: 500, warnEnd: 0, stage: 0, scroll: 0, route: ['fire', null], mb: { [SLOT0_STAGE]: PICKS }, pend: [], glitch: 0, banner: null };
});

describe('warmPump', () => {
  it('builds the committed route\'s art one piece per call, then idles', () => {
    expect(drain()).toBe(3);
    expect(ops()).toEqual(['route choir', 'route brood', 'route butcher']);
    expect(WU.warmBuilt().sort()).toEqual([...PICKS, BOSS].sort());
  });

  it('drops the art a stage has left behind', () => {
    drain(); WU.warmLog.length = 0;
    $.G.stage = SLOT0_STAGE + 1;
    expect(drain()).toBe(3);
    expect(ops().every((o) => o.startsWith('drop '))).toBe(true);
    expect(WU.warmBuilt()).toEqual([]);
  });

  it('holds the drop while a midboss\'s split corpse can still redraw its body, but not for an ordinary enemy\'s', () => {
    drain(); WU.warmLog.length = 0;
    $.G.stage = SLOT0_STAGE + 1;
    gibs.push({ k: 'half', e: { k: 'choir', mini: 1 } });
    expect(WU.warmPump()).toBe(false);
    expect(WU.warmBuilt().length).toBe(3);
    gibs[0] = { k: 'half', e: { k: 'drone' } };
    expect(drain()).toBe(3);
  });
});

describe('the WARNING gate, through banner()', () => {
  it('does no work inside a midboss WARNING, and resumes on the step it ends', () => {
    miniWarn('THE NAIL CHOIR', () => {});
    expect(WU.warmPump()).toBe(false);
    expect(WU.warmLog).toEqual([]);
    $.G.t = $.G.warnEnd - 1;
    expect(WU.warmPump()).toBe(false);
    $.G.t = $.G.warnEnd;
    expect(WU.warmPump()).toBe(true);
  });

  it('holds for a WARNING whatever its copy says (a rename or a translation)', () => {
    banner('ACHTUNG', 'GRAVITATIONSBRUNNEN', '#ff2a2a', WINDOW, true);
    expect($.G.warnEnd).toBe($.G.t + WINDOW);
    expect(WU.warmPump()).toBe(false);
    expect(A.built.size).toBe(0);
  });

  it('runs under any banner that is not flagged as a WARNING, even one that reads WARNING', () => {
    banner('WARNING', 'A STAGE CARD WITH UNLUCKY COPY', '#ff2a2a', WINDOW);
    expect($.G.warnEnd).toBe(0);
    expect(WU.warmPump()).toBe(true);
  });
});

describe('warmLog', () => {
  it('marks where it stopped recording, and counts what it dropped', () => {
    $.G.route = [null, null]; // nothing to build: the drop pass runs instead, one log line per pump
    const n = WU.WARM_LOG_CAP + 5;
    for (let i = 0; i < n; i++) { A.built.add(BOSS); WU.warmPump(); }
    expect(WU.warmLog.length).toBe(WU.WARM_LOG_CAP + 1);
    const cut = WU.warmLog[WU.WARM_LOG_CAP];
    expect(cut.op).toBe('cut');
    expect(cut.n).toBe(5);
  });

  it('starts recording again after a probe clears it', () => {
    $.G.route = [null, null];
    for (let i = 0; i < WU.WARM_LOG_CAP + 2; i++) { A.built.add(BOSS); WU.warmPump(); }
    WU.warmLog.length = 0;
    A.built.add(BOSS); WU.warmPump();
    expect(ops()).toEqual(['drop ' + BOSS]);
  });
});

