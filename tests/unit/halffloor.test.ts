// r3 fights (K1): the midbosses' half floor and half clock, and the lob reach test (src/enemies/mid/_fight.ts phaseAtt /
// phaseShare / halfClock / lobReach). Pure: no sim, the world stubbed to an open cave.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const eshots = vi.hoisted(() => [] as any[]);
const cave = vi.hoisted(() => ({ ceil: 0 }));
vi.mock('../../src/world', () => ({ eshots, ceilAt: () => cave.ceil })); // world.ts loads the canvas
import { setLayout } from '../../src/layout';
import { bsMul } from '../../src/rank';
import { FT, halfClock, lobReach, lobV, phaseAtt, phaseShare } from '../../src/enemies/mid/_fight';

const boss = (o: any = {}) => ({ hp: 100, max: 100, t: 0, leave: 1080, ...o });
beforeEach(() => {
  setLayout('long4');
  cave.ceil = 0;
  $.G = { loop: 0, stage: 0, gm: {}, scroll: 0, shake: 0 } as any;
  $.P = { x: 100, y: 120 } as any;
});

describe('the half floor', () => {
  it('holds the first half at its line until floorN attacks have started and each has landed', () => {
    const e: any = boss({ hp: 55 });
    expect(phaseShare(e, 10)).toBeCloseTo(.5); // only down to 50: 5 of the 10 lands, the rest is lost (no carry)
    expect(e.tk).toBe(0); // the render's tink stamp
    phaseAtt(e, 30); e.t = 10; phaseAtt(e, 30); // two attacks: landed at 30 and 40
    expect(phaseShare(e, 10)).toBeCloseTo(.5);
    e.t = 39; expect(phaseShare(e, 10)).toBeCloseTo(.5);
    e.t = 40; expect(phaseShare(e, 10)).toBe(1);
    e.hp = 50; e.t = 41; delete e.tk;
    expect(phaseShare(e, 10)).toBe(1); // open: 50 -> 40 crosses into the second half
    expect(e.tk).toBeUndefined();
  });
  it('holds the second half at 1 HP: it can not die before its own attacks are out', () => {
    const e: any = boss({ hp: 30 });
    expect(phaseShare(e, 50)).toBeCloseTo(29 / 50);
    e.hp = 1; expect(phaseShare(e, 999)).toBe(0); // a nuke at the line is a tink
    phaseAtt(e, 0); phaseAtt(e, 0);
    expect(phaseShare(e, 999)).toBe(1);
  });
  it('holds the line against a corroding acid tick when it is told the real damage (shots.ts, W6 round 3)', () => {
    // CORRODE 2: acid deals .02 x 3 = .06 a tick. Told .02 (the old call), the floor let the whole .06 through: 50.04 -> 49.98
    const e: any = boss({ hp: 50.04 }), d = .02 * (1 + 2);
    expect(50.04 - d * phaseShare(e, .02)).toBeLessThan(50); // the leak the old call had
    expect(50.04 - d * phaseShare(e, d)).toBeCloseTo(50, 9); // told the real hit: only down to the line
  });
  it('counts each half apart: the first half\'s attacks do not open the second', () => {
    const e: any = boss({ hp: 60 });
    phaseAtt(e, 0); phaseAtt(e, 0); e.hp = 40;
    expect(phaseShare(e, 100)).toBeCloseTo(39 / 100);
    expect(e.hfN).toEqual([2, 0]);
  });
  it('lets the later of the first floorN attacks set the landing frame, and ignores the ones after', () => {
    const e: any = boss();
    phaseAtt(e, 200); e.t = 5; phaseAtt(e, 10); e.t = 6; phaseAtt(e, 900);
    expect(e.hfT[0]).toBe(200);
    expect(FT.floorN).toBe(2);
  });
  it('is a full share for a zero hit (a kill already paid) and off on short', () => {
    const e: any = boss({ hp: 51 });
    expect(phaseShare(e, 0)).toBe(1);
    setLayout('short');
    expect(phaseShare(e, 10)).toBe(1);
    phaseAtt(e); expect(e.hfN).toBeUndefined();
  });
});

describe('the half clock', () => {
  it('lurches a first half still up at halfK of the slot clock to just under the line, never a kill', () => {
    const e: any = boss({ t: 1080 * FT.halfK - 1 });
    halfClock(e); expect(e.hp).toBe(100);
    e.t++; halfClock(e);
    expect(e.hp).toBeLessThan(50); expect(e.hp).toBeGreaterThan(49);
    expect(e.flash).toBe(3);
    const hp = e.hp; e.t += 100; halfClock(e); expect(e.hp).toBe(hp); // the second half is left alone
  });
  it('does nothing without a slot clock, or on short', () => {
    const a: any = boss({ leave: 0, t: 5000 }); halfClock(a); expect(a.hp).toBe(100);
    setLayout('short');
    const b: any = boss({ t: 5000 }); halfClock(b); expect(b.hp).toBe(100);
  });
});

describe('lobReach', () => {
  it('reaches a ship in front and below, not one far up and to the left under a low ceiling', () => {
    expect(lobReach(370, 140, 200, 127)).toBe(true);
    cave.ceil = 60;
    expect(lobReach(378, 137, 150, 96)).toBe(false); // the Brood's sneeze at 150,96: every arc under V_CAP strikes the ceiling
  });
  it('agrees with lobV: when it reaches, lobV fits an arc under the ceiling', () => {
    cave.ceil = 40;
    const [x, y, tx, ty] = [370, 140, 200, 127];
    expect(lobReach(x, y, tx, ty)).toBe(true);
    const w = lobV(x, y, tx, ty, .3) * bsMul($); // lobV is in BS units
    expect((w * w) / .05).toBeLessThanOrEqual(y - (cave.ceil + 8) + 1e-6);
  });
});
