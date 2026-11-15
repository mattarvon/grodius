// Story type: Logic (LS1 audit H carry-forward, spec §4). Gate: BLOCKING. Every run end drops the checkpoint:
// gameOver, newGame and endLoop each call runsave's clearRun (flow.ts). Mocks as resumeguard.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

vi.mock('../../src/core', () => ({ PH: 270, R: () => 0, clamp: (v: number) => v, dist2: () => 1e9, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
vi.mock('../../src/save', () => ({ lv: () => 0, save: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: new Proxy({}, { get: () => () => {} }), resetOpened: () => {}, voiceDropQueued: () => {}, voiceCutQuips: () => {}, voiceStopAll: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/world', () => ({ ALL: [], buildTerrain: () => {}, caps: [], ceilAt: () => 0, eshots: [], floorAt: () => 270 }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gore: () => {}, spark: () => {}, splat: () => {} }));
vi.mock('../../src/enemies/spawn', () => ({}));
vi.mock('../../src/stages', () => ({ startStage: () => {}, stageBanner: () => {}, sealFor: () => 0 }));
vi.mock('../../src/biomes', () => ({ biomeReset: () => {} }));
vi.mock('../../src/perks', () => ({ perksReset: () => {} }));
vi.mock('../../src/contraptions', () => ({ resetContraptions: () => {}, rigFresh: () => ({}) }));
vi.mock('../../src/shipform', () => ({ shipShed: () => {} }));
vi.mock('../../src/rng', () => ({ newRunSeed: () => 1 }));
vi.mock('../../src/stagebuild', () => ({ rebuildAt: () => {} }));
vi.mock('../../src/lab', () => ({ cpTrigger: () => 'a' }));
vi.mock('../../src/runsave', async (orig) => ({ ...(await orig<typeof import('../../src/runsave')>()), clearRun: vi.fn() }));

const F = await import('../../src/flow');
const { clearRun } = await import('../../src/runsave');

/** run a flow entry point; only its first line (the clearRun call) is under test, so a later throw on the
 *  partial mocks is not this test's concern */
const call = (f: () => void) => { try { f(); } catch { /* past the guarded line */ } };

describe('clearRun on every run end (flow.ts, spec §4)', () => {
  beforeEach(() => {
    vi.mocked(clearRun).mockClear();
    $.meta = { bio: 0, lv: {} } as any;
    $.G = { loop: 0, stage: 0, lives: 0, score: 0, route: [null, null], visitNo: [0, 0] } as any;
  });

  it.each([['gameOver', () => F.gameOver()], ['newGame', () => F.newGame()], ['endLoop', () => F.endLoop()]])(
    '%s drops the stored checkpoint', (_n, f) => {
      call(f);
      expect(clearRun).toHaveBeenCalled();
    });
});
