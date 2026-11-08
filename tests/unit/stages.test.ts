import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

vi.mock('../../src/save', () => ({ save: () => {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: { power: () => {}, stageClear: () => {}, alarm: () => {} } }));
vi.mock('../../src/enemies/spawn', () => ({ banner: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/biomes', () => ({ BIOMES: {}, openFork: () => {}, holdForFork: () => {}, biomeExit: () => {} }));
vi.mock('../../src/stagebuild', () => ({ buildStage: () => {} })); // startStage builds Open Orbit / the Drive on entry (LS1 C/B2)

const { deepPay, stageLabel, clearStage, stageTs } = await import('../../src/stages');
const { setLayout } = await import('../../src/layout');

/** a run on the Gravity Drive (stage 4, no fork), one clear from breaking seal 1, with a clean stage */
function gravityDriveRun(loop = 0) {
  return {
    loop, stage: 3, route: [], pend: [], t: 600, score: 0, bio: 0, cleared: 1, seal: 0,
    st: { kills: 10, spawned: 10, hits: 0, deaths: 0, chain: 0, t0: 0 },
  };
}

describe('stage payouts', () => {
  // D5b (production/decision-log.md, decided): every run pays double from Descent 2 on, whether or
  // not DESCEND DEEPER was bought. The upgrade itself only unlocks starting at Descent 2.
  it('doubles stage pay from Descent 2 on, in every run', () => {
    $.G = { loop: 0 };
    expect(deepPay()).toBe(1);
    $.G = { loop: 1 };
    expect(deepPay()).toBe(2);
    $.G = { loop: 4 };
    expect(deepPay()).toBe(2);
  });

  it('labels stages descent-stage, 1-based', () => {
    $.G = { loop: 1, stage: 2 };
    expect(stageLabel()).toBe('2-3');
  });
});

describe('clearStage', () => {
  beforeEach(() => {
    $.meta = { bio: 0, best: {} };
  });

  it('pays the grade biomass for a boss kill, doubled from Descent 2 on', () => {
    $.G = gravityDriveRun(0);
    clearStage();
    expect($.G.tally.g).toBe('S');
    expect($.G.bio).toBe(40);
    expect($.meta.bio).toBe(40);

    $.G = gravityDriveRun(1);
    clearStage();
    expect($.G.bio).toBe(80);
  });

  it('pays no biomass when the boss escapes (D5b)', () => {
    $.G = gravityDriveRun(1);
    clearStage(true);
    expect($.G.bio).toBe(0);
    expect($.meta.bio).toBe(0);
    expect($.G.tally.bio).toBe(0);
    expect($.G.tally.deep).toBe(false);
  });

  it('still grades an escape C, pays its score and counts it toward the next seal', () => {
    $.G = gravityDriveRun(0);
    const seal = clearStage(true);
    expect($.G.tally.g).toBe('C');
    expect($.G.score).toBe(2000);
    expect($.G.cleared).toBe(2);
    expect(seal).toBe(1);
  });

  it('records the best grade under the stage-kind key; the tally keeps the descent-stage label', async () => {
    $.G = gravityDriveRun(1);
    clearStage();
    expect($.meta.best).toEqual({ '2-drive': 'S' });
    expect($.G.tally.id).toBe('2-4');
    expect($.G.tally.best).toBe('FIRST CLEAR');
    const { BIOMES } = (await import('../../src/biomes')) as any; // mocked {}: give the tally a name to show
    BIOMES.acid = { name: 'ACID', sub: '' };
    try {
      $.G = { ...gravityDriveRun(0), stage: 2, route: ['ice', 'acid'] };
      clearStage(true);
      expect($.meta.best['1-acid']).toBe('C');
      expect($.G.tally.id).toBe('1-3');
    } finally {
      delete BIOMES.acid; // the mock is shared by the whole file
    }
  });
});

// LS1 item G: clearStage reads the active layout's economy entry (src/economy.ts). Short is pinned above and in
// economy.test.ts's golden copy; these drive the long4 entry through the live clearStage
describe('clearStage on the long4 economy (LS1 item G, D26)', () => {
  beforeEach(() => {
    setLayout('long4');
    $.meta = { bio: 0, best: {} };
  });
  afterEach(() => setLayout('short'));

  it('measures each long4 stage in scroll seconds from its row span at 1 px/frame', () => {
    $.G = { stage: 0 };
    expect([0, 1, 2, 3].map((i) => stageTs(i))).toEqual([4380 / 60, 3620 / 60, 3750 / 60, 3400 / 60]);
  });

  it('grades a clean one-hit Drive S on long4, where the short layout grades it A', () => {
    $.G = { ...gravityDriveRun(0), st: { kills: 10, spawned: 10, hits: 1, deaths: 0, chain: 0, t0: 0 } };
    clearStage();
    expect($.G.tally.g).toBe('S');
    expect($.G.tally.perfect).toBe(false); // the no-hit bonus still needs no hits
    setLayout('short');
    $.G = { ...gravityDriveRun(0), st: { kills: 10, spawned: 10, hits: 1, deaths: 0, chain: 0, t0: 0 } };
    clearStage();
    expect($.G.tally.g).toBe('A');
  });

  it('withholds the S for two hits or a death, however clean the kills', () => {
    $.G = { ...gravityDriveRun(0), st: { kills: 10, spawned: 10, hits: 2, deaths: 0, chain: 0, t0: 0 } };
    clearStage();
    expect($.G.tally.g).toBe('A');
    $.G = { ...gravityDriveRun(0), st: { kills: 10, spawned: 10, hits: 0, deaths: 1, chain: 0, t0: 0 } };
    clearStage();
    expect($.G.tally.g).toBe('A');
  });

  it('weighs hits by 35/Ts: four hits on the 56.7 s Drive cost 24.7 points, not 40', () => {
    // 60% kills, 4 hits: 60 - 40 * 35 / 56.67 = 35.3 -> B on long4; short charges the full 40 -> 20, C
    $.G = { ...gravityDriveRun(0), st: { kills: 6, spawned: 10, hits: 4, deaths: 0, chain: 0, t0: 0 } };
    clearStage();
    expect($.G.tally.g).toBe('B');
    setLayout('short');
    $.G = { ...gravityDriveRun(0), st: { kills: 6, spawned: 10, hits: 4, deaths: 0, chain: 0, t0: 0 } };
    clearStage();
    expect($.G.tally.g).toBe('C');
  });

  it("keeps today's seal schedule: the 2nd clear breaks seal 1, the 3rd breaks none", () => {
    $.G = gravityDriveRun(0); // cleared: 1
    expect(clearStage()).toBe(1);
    $.G = { ...gravityDriveRun(0), cleared: 2, seal: 1 };
    expect(clearStage()).toBe(0);
  });
});
