import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

vi.mock('../../src/save', () => ({ save: () => {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: { power: () => {}, alarm: () => {} } }));
vi.mock('../../src/enemies/spawn', () => ({ banner: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/biomes', () => ({ BIOMES: {}, openFork: () => {}, holdForFork: () => {}, biomeExit: () => {} }));

const { deepPay, stageLabel, clearStage } = await import('../../src/stages');

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
});
