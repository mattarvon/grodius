import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';
import { MID_NAMES } from '../../src/enemies/mid/roster';
import { warmBlocked } from '../../src/warmplan';

// The held renames (D42 item 1, LS2-names): the warm-up WARNING gate must key off banner()'s warn flag, never its
// text, so renaming a boss, a midboss or a kill banner (or translating one) cannot open or close the gate.
// spawn.ts pulls in DOM/canvas/audio modules at import time; stubbed as in every.test.ts
vi.mock('../../src/core', () => ({ PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0 }));
vi.mock('../../src/audio', () => ({ sfx: { dread: () => {} } }));
vi.mock('../../src/world', () => ({ ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0 }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/mid', () => ({}));

const { banner, miniWarn } = await import('../../src/enemies/spawn');

const BANNER_T = 170; // miniWarn's banner length in frames (spawn.ts)
const NOW = 1000;

describe('the warm-up WARNING gate', () => {
  beforeEach(() => {
    $.G = { t: NOW, warnEnd: 0, pend: [] } as any;
  });

  it('holds the warm-up for every midboss WARNING, whatever its name', () => {
    for (const name of Object.values(MID_NAMES)) {
      $.G = { t: NOW, warnEnd: 0, pend: [] } as any;
      miniWarn(name, () => {});
      expect($.G.warnEnd, name).toBe(NOW + BANNER_T);
      expect(warmBlocked('play', { t: NOW + BANNER_T - 1, warnEnd: $.G.warnEnd }), name).toBe(true);
    }
  });

  it('holds the warm-up for a renamed stage boss (THE BLOAT) exactly as for any other name', () => {
    miniWarn('THE BLOAT', () => {});
    const renamed = $.G.warnEnd;
    $.G = { t: NOW, warnEnd: 0, pend: [] } as any;
    miniWarn('ANY OTHER NAME', () => {});
    expect(renamed).toBe($.G.warnEnd);
  });

  it('does not hold the warm-up for a banner that only reads WARNING without the flag', () => {
    banner('WARNING', 'SQUID SAUCER 2000');
    expect($.G.warnEnd).toBe(0);
    expect(warmBlocked('play', { t: NOW, warnEnd: $.G.warnEnd })).toBe(false);
  });

  it('does not hold the warm-up for the kill banners', () => {
    banner('TAKEN DOWN', '', undefined, 130);
    expect($.G.warnEnd).toBe(0);
  });

  it('holds the warm-up for a flagged banner whatever its text says', () => {
    banner('TAKEN DOWN', '', '#ff2a2a', 200, true);
    expect($.G.warnEnd).toBe(NOW + 200);
  });
});
