// The back tree (LS1 audit S2 #1, #2; Matt's armory bug): one press, one level up, on Android back, Esc and pad B alike.
import { describe, expect, it, vi } from 'vitest';
import { SHOP_EXIT, backPressed, backStep, descendTap, shopListBottom, type BackView } from '../../src/backstep';

const V: BackView = { state: 'title', sub: null, gate: false, asked: true, shopNext: 'title', onExitRow: false, overT: 0, native: true };
const at = (p: Partial<BackView>) => backStep({ ...V, ...p });

describe('backStep: one row per branch of the back tree', () => {
  it('exits from the title root on the native app', () => {
    expect(at({})).toBe('exit');
  });
  it('exits from the press-any-key gate and the flashing-images question (the title root too)', () => {
    expect(at({ gate: true })).toBe('exit');
    expect(at({ asked: false })).toBe('exit');
  });
  it('closes OPTIONS and LAB back to the title root', () => {
    expect(at({ sub: 'opt' })).toBe('closeSub');
    expect(at({ sub: 'lab' })).toBe('closeSub');
  });
  it('leaves the Infirmary opened from the title (or from game over: shopNext is title) in one press', () => {
    expect(at({ state: 'shop' })).toBe('leaveShop');
  });
  it('surfaces from game over once its menu is up, and ignores a press before it', () => {
    expect(at({ state: 'over', overT: 71 })).toBe('surface');
    expect(at({ state: 'over', overT: 70 })).toBe('none');
  });
  it('pauses in play and unpauses in pause', () => {
    expect(at({ state: 'play' })).toBe('pause');
    expect(at({ state: 'pause' })).toBe('unpause');
  });
  it('needs two presses to leave the Infirmary between descents: select DESCEND, then continue', () => {
    expect(at({ state: 'shop', shopNext: 'loop' })).toBe('selectExit');
    expect(at({ state: 'shop', shopNext: 'loop', onExitRow: true })).toBe('leaveShop');
  });
});

describe('backStep: never exits by mistake', () => {
  it('never returns exit from a sub-menu, native or not', () => {
    for (const sub of ['opt', 'lab'] as const) for (const native of [true, false]) expect(at({ sub, native })).not.toBe('exit');
  });
  it('does nothing at the title root off the native app (desktop and web have nothing to exit to)', () => {
    expect(at({ native: false })).toBe('none');
    expect(at({ native: false, gate: true })).toBe('none');
  });
  it('never returns exit outside the title', () => {
    for (const state of ['shop', 'pause', 'over', 'play'] as const) expect(at({ state, overT: 99 })).not.toBe('exit');
  });
});

describe('backPressed: which keys mean back', () => {
  it('takes only Esc and Backspace on the over screen, so mashing X or pad B (POWER) through a death never SURFACEs', () => {
    expect(backPressed('over', { back: true, hardBack: false })).toBe(false);
    expect(backPressed('over', { back: true, hardBack: true })).toBe(true);
  });
  it('takes X and pad B everywhere else', () => {
    for (const s of ['title', 'shop', 'pause'] as const) expect(backPressed(s, { back: true, hardBack: false })).toBe(true);
  });
});

describe('descendTap: the DESCEND confirm while a run save exists', () => {
  it('arms on the first tap without acting', () => {
    expect(descendTap(null, 1, true)).toEqual({ act: false, armed: 1 });
  });
  it('fires on a second tap on the armed row, and disarms', () => {
    expect(descendTap(1, 1, true)).toEqual({ act: true, armed: null });
  });
  it('re-arms on another confirm row instead of firing', () => {
    expect(descendTap(1, 2, true)).toEqual({ act: false, armed: 2 });
  });
  it('acts at once on a row without confirm (no run save), and resets the arm', () => {
    expect(descendTap(1, 3, false)).toEqual({ act: true, armed: null });
    expect(descendTap(null, 1, false)).toEqual({ act: true, armed: null });
  });
});

// contraptions.ts pulls canvas/audio/DOM modules in at import time (power.test.ts's stubs); save.ts loads guarded
vi.mock('../../src/core', () => ({ FIRE: 0, PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, ctx: {}, dist2: () => 0, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/input', () => ({ PR: {}, I: {} }));
vi.mock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0, orbs: [] }));
vi.mock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gib: () => {}, gore: () => {}, mist: () => {}, pop: () => {}, spark: () => {} }));
vi.mock('../../src/enemies/update', () => ({ hurt: () => {} }));
vi.mock('../../src/boss/update', () => ({ bossHitByShot: () => {} }));
vi.mock('../../src/player', () => ({ WARD_MAX: 3 }));
vi.mock('../../src/render/util', () => ({ drawChain: () => {}, drawHookTip: () => {}, light: () => {} }));

describe('the Infirmary list clears its exit button', () => {
  it('ends at y 230 or above with today\'s contraptions, socket and grafts', async () => {
    const { RIG } = await import('../../src/contraptions');
    const { UPG } = await import('../../src/save');
    expect(shopListBottom([RIG.length, 1, UPG.length])).toBeLessThanOrEqual(SHOP_EXIT.y - 2);
  });
  it('measures the flow drawShop draws: 7 contraptions, a socket and 6 grafts end at exactly 230', () => {
    expect(shopListBottom([7, 1, 6])).toBe(230);
    expect(shopListBottom([7, 1, 7])).toBeGreaterThan(230); // one more graft needs a layout change, not a squeeze
  });
});
