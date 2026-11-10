// The back tree at the menu level (menus.ts): the DESCEND arm's timeout, the sub-menus' close and their layout budget.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// menus.ts pulls in audio, input, flow and contraptions, which touch the canvas, DOM or audio at import time
vi.mock('../../src/audio', () => ({ auInit: () => {}, sample: () => false, setMute: () => {}, voiceStopAll: () => {}, sfx: { menu: () => {}, deny: () => {}, power: () => {} } }));
vi.mock('../../src/input', () => ({ I: {}, PR: new Set() }));
const { I } = await import('../../src/input');
vi.mock('../../src/platform', () => ({ NATIVE: false }));
// shopNext through a getter, so a test can open the loop shop (menus.ts reads the binding at call time)
const F = vi.hoisted(() => ({ shopNext: 'title' as 'title' | 'loop', startLoop: (_l: number) => {} }));
vi.mock('../../src/flow', () => ({ newGame: () => {}, openPause: () => {}, openShop: () => {}, resumeLast: () => {}, resumedFrom: null, get shopNext() { return F.shopNext; }, startLoop: (l: number) => F.startLoop(l) }));
vi.mock('../../src/contraptions', () => ({ RIG: [], RIG_BY: {}, SOCKET_COST: [], rigInit: () => {}, rigged: () => [], sockets: () => 1 }));

const { $ } = await import('../../src/state');
const { SET } = await import('../../src/save');
const M = await import('../../src/menus');
const { ARM_T, SUB_BACK, titleMenuBottom } = await import('../../src/backstep');

const open = (l: string) => { const it = M.titleItems(); it[it.findIndex((x: any) => x.l === l)].a(); };
const rowOf = (l: string) => M.titleItems().findIndex((x: any) => x.l === l);

beforeEach(() => {
  SET.asked = true;
  $.gate = false;
  $.state = 'title';
  $.menuSel = 0;
  $.T = 100;
  $.meta = { bio: 0, lv: {} };
  if (M.titleSubOf()) M.doBack('closeSub');
});

describe('DESCEND confirm: the arm (menuPointer + stepArm)', () => {
  const box = (fire: () => void) => [{ x: 0, y: 0, w: 10, h: 10, i: 1, a: fire, confirm: true }];

  it('arms on the first tap, then fires on a second tap on the same row', () => {
    const fire = vi.fn();
    $.menuBoxes = box(fire);
    M.menuPointer(5, 5);
    expect(M.armedRow()).toBe(1);
    expect(fire).not.toHaveBeenCalled();
    M.menuPointer(5, 5);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(M.armedRow()).toBe(null);
  });

  it('stays armed for ARM_T frames of $.T and clears on the next, so a late tap arms again instead of firing', () => {
    const fire = vi.fn();
    $.menuBoxes = box(fire);
    M.menuPointer(5, 5);
    $.T += ARM_T;
    M.stepArm();
    expect(M.armedRow()).toBe(1);
    $.T += 1;
    M.stepArm();
    expect(M.armedRow()).toBe(null);
    M.menuPointer(5, 5);
    expect(fire).not.toHaveBeenCalled();
    expect(M.armedRow()).toBe(1);
  });

  it('clears when the selection moves or the title is left', () => {
    $.menuBoxes = box(() => {});
    M.menuPointer(5, 5);
    $.menuSel = 2;
    M.stepArm();
    expect(M.armedRow()).toBe(null);
    $.menuSel = 1;
    M.menuPointer(5, 5);
    $.state = 'play';
    M.stepArm();
    expect(M.armedRow()).toBe(null);
  });
});

describe('the title sub-menus close the same way on every path', () => {
  it('lands on the sub-menu\'s own row from the BACK row (button and keys) and from doBack', () => {
    for (const l of ['OPTIONS', 'LAB']) {
      const want = rowOf(l);
      open(l);
      const it = M.titleItems();
      it[it.findIndex((x: any) => x.l === 'BACK')].a(); // the < BACK button and Enter on BACK both run this
      expect(M.titleSubOf()).toBe(null);
      expect($.menuSel).toBe(want);
      open(l);
      M.doBack('closeSub'); // Esc, pad B and Android back
      expect($.menuSel).toBe(want);
    }
  });

  it('ends OPTIONS and LAB above the < BACK button at y 206', () => {
    for (const l of ['OPTIONS', 'LAB']) {
      open(l);
      expect(titleMenuBottom(M.titleItems().length)).toBeLessThanOrEqual(SUB_BACK.y);
      M.doBack('closeSub');
    }
  });
});

describe('the Infirmary lock takes back only from Esc / Backspace (X and pad B are POWER)', () => {
  const lockedShop = () => {
    for (const k of Object.keys(I)) delete (I as any)[k];
    $.state = 'shop';
    $.shopLock = 40;
    $.menuSel = 0;
    $.shopMsg = null;
  };
  it('ignores X or pad B (back without hardBack) during the 40-frame lock', () => {
    lockedShop();
    Object.assign(I, { back: true, hardBack: false });
    M.stepShop();
    expect($.state).toBe('shop');
  });
  it('honours Esc (hardBack) during the lock', () => {
    lockedShop();
    Object.assign(I, { back: true, hardBack: true });
    M.stepShop();
    expect($.state).toBe('title'); // shopNext is 'title' here: one press leaves
  });
});

describe('the title root leave arm (menus.ts)', () => {
  it('arms on a first press, and anything else the player does drops it', async () => {
    const { backStep } = await import('../../src/backstep');
    for (const k of Object.keys(I)) delete (I as any)[k];
    expect(backStep(M.backView(true))).toBe('armExit');
    M.doBack('armExit');
    expect(M.exitArmed()).toBe(true);
    expect(backStep(M.backView(true))).toBe('exit');
    Object.assign(I, { down: true });
    M.stepArm();
    expect(M.exitArmed()).toBe(false);
    for (const k of Object.keys(I)) delete (I as any)[k];
    M.doBack('armExit');
    $.T += 121;
    M.stepArm();
    expect(M.exitArmed()).toBe(false);
  });
});

describe('IMPORT SAVE (LS1 audit, security S3)', () => {
  it('drops the old profile\'s checkpoint before the reload, so RESUME is never offered under the imported profile', async () => {
    const { RUN_KEY } = await import('../../src/runsave');
    const m = new Map<string, string>([[RUN_KEY, '{"v":2}']]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
    const reload = vi.fn();
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('window', { prompt: () => btoa(JSON.stringify({ meta: { bio: 5, lv: {} } })) });
    try {
      open('OPTIONS');
      open('IMPORT SAVE');
      expect(reload).toHaveBeenCalledTimes(1);
      expect(m.has(RUN_KEY)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('back during shopLock (stepShop, LS1 audit)', () => {
  // the 40-frame lock after the shop opens gates the pointer and OK, never back
  const pressBack = () => { I.back = true; I.hardBack = true; try { M.stepShop(); } finally { I.back = false; I.hardBack = false; } }; // Esc: the only back the lock takes
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    $.state = 'shop';
    $.shopLock = 40;
    $.shopMsg = null;
    $.menuSel = 0;
    $.G = null as any;
  });

  it('closes the title shop to the title on a back press inside the lock', () => {
    F.shopNext = 'title';
    try { pressBack(); } finally { vi.unstubAllGlobals(); }
    expect($.state).toBe('title');
    expect($.shopLock).toBe(39); // the lock still counts down on the same frame
  });

  it('selects the exit row of the loop shop on a back press inside the lock, without starting the next descent', () => {
    F.shopNext = 'loop';
    const start = vi.fn();
    F.startLoop = start;
    try { pressBack(); } finally { F.shopNext = 'title'; F.startLoop = () => {}; vi.unstubAllGlobals(); }
    expect($.state).toBe('shop');
    expect($.menuSel).toBe(M.shopItems().length - 1);
    expect(start).not.toHaveBeenCalled();
  });
});
