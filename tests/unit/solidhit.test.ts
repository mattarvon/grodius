// step.ts: a moving slab that strikes the ship this step (solids.ts stepSolids() -> true) costs a hit through
// player.ts playerHit(), which honours i-frames and WARD like any body hit. Wall-crush deaths stay on the solidAt()
// terrain test in player.ts (decision 5A). Every step.ts import is stubbed; solids.ts is mocked so the test drives it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const h = vi.hoisted(() => ({ solid: false, hits: 0 }));
const noop = () => {};
vi.mock('../../src/solids', () => ({ stepSolids: () => h.solid }));
vi.mock('../../src/player', () => ({ playerHit: () => { h.hits++; return false; }, updatePlayer: noop }));
vi.mock('../../src/biomes', () => ({ stepBiome: noop, hazardHit: () => false }));
vi.mock('../../src/perks', () => ({ stepPerks: () => false }));
vi.mock('../../src/power', () => ({ powerBudget: () => 0 }));
vi.mock('../../src/music', () => ({ musicUpdate: noop }));
vi.mock('../../src/core', () => ({ clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), swapRm: noop }));
vi.mock('../../src/srnd', () => ({ srnd: () => 0 }));
vi.mock('../../src/save', () => ({ SET: {}, save: noop }));
vi.mock('../../src/audio', () => ({ setMute: noop }));
vi.mock('../../src/input', () => ({ I: {}, PR: new Set(), pollInput: noop }));
vi.mock('../../src/world', () => ({ arcs: [], decals: [] }));
vi.mock('../../src/flow', () => ({ endLoop: noop, openPause: noop }));
vi.mock('../../src/enemies/spawn', () => ({ runScript: noop, stepRecovery: noop }));
vi.mock('../../src/boss/update', () => ({ updateBoss: noop }));
vi.mock('../../src/shots', () => ({ updateCaps: noop, updateEShots: noop, updateEnemies: noop, updateShots: noop }));
vi.mock('../../src/fx/update', () => ({ decayFX: noop, updateAmbient: noop, updateCombo: noop, updateFX: noop }));
vi.mock('../../src/contraptions', () => ({ stepContraptions: noop }));
vi.mock('../../src/menus', () => ({ keyBack: noop, menuNav: noop, overItems: () => [], pauseItems: () => [], startLine: () => true, stepArm: noop, stepShop: noop, titleItems: () => [] }));
vi.mock('../../src/checkpoint', () => ({ cpStep: noop }));
vi.mock('../../src/backstep', () => ({ backPressed: () => false }));

const { stepWorld } = await import('../../src/step');

beforeEach(() => {
  h.solid = false; h.hits = 0;
  $.state = 'play';
  $.G = { t: 1, loop: 0, stage: 0, scroll: 0, scrollSpeed: 1, pend: [], warn: [], gm: {} };
  $.P = { x: 60, y: 120, alive: true, inv: 0, shield: 0 };
});

describe('step.ts stepSolids hook', () => {
  it('calls playerHit once when a slab strikes the ship this step', () => {
    h.solid = true;
    stepWorld();
    expect(h.hits).toBe(1);
  });
  it('does nothing when no slab strikes (the W0 stub)', () => {
    stepWorld();
    expect(h.hits).toBe(0);
  });
  it('skips the hit with no ship (a step before the first spawn)', () => {
    h.solid = true;
    $.P = null;
    expect(() => stepWorld()).not.toThrow();
    expect(h.hits).toBe(0);
  });
});
