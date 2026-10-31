import { describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

vi.mock('../../src/save', () => ({ save: () => {}, lv: () => 0 }));
vi.mock('../../src/audio', () => ({ sample: () => {}, sfx: {} }));
vi.mock('../../src/enemies/spawn', () => ({ banner: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/biomes', () => ({ BIOMES: {}, openFork: () => {}, holdForFork: () => {}, biomeExit: () => {} }));

const { deepPay, stageLabel } = await import('../../src/stages');

describe('stage payouts', () => {
  // Pins CURRENT behaviour: every run pays double from Descent 2 on, whether or not DESCEND DEEPER
  // was bought. Decision D5b (production/decision-log.md) may change this; update the test with it.
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
