import { describe, expect, it, vi } from 'vitest';
import { PLATE, PLATE_COPY, plateBox, plateLines, type PlateLines, type PlateRun } from '../../src/render/gateplate';

// ls2-read item 1: gate plates show the stakes. gateplate.ts is pure and import-free, so these tests need no mocks
// (except the one that cross-checks the perk table against perks.ts).

const IGN = Object.freeze({ id: 'ignite', name: 'IMMOLATION', max: 2 });
const FIRE_B = Object.freeze({ name: 'THE FURNACE', tag: 'BURNING // BUTCHER' });
/** the four biome perk rows, mirrored from perks.ts (the last describe checks they match) */
const BIOME_PERKS = [
  { b: 'ice', id: 'frost', name: 'FROSTBITE', max: 2 },
  { b: 'acid', id: 'corrode', name: 'CORROSIVE SPIT', max: 2 },
  { b: 'fire', id: 'ignite', name: 'IMMOLATION', max: 2 },
  { b: 'snot', id: 'snot', name: 'SNOT ROCKET', max: 2 },
];
const BIOME_NAMES: Record<string, string> = { ice: 'THE CRYOVAULT', acid: 'THE DIGESTION TANKS', fire: 'THE FURNACE', snot: 'THE SINUS' };
const run = ({ visited = [] as string[], bvis = {} as Record<string, number> } = {}): PlateRun =>
  Object.freeze({ visited: Object.freeze([...visited]), bvis: Object.freeze({ ...bvis }) });
const pkOf = (lv: number) => (id: string) => (id === IGN.id ? lv : 0);
const measure = (s: string, px: number) => s.length * px * .55;
// countdown box and canvas at 480x270 (PH 254): cx = W * .74, cy = PH * .5
const GX = 480 * .74, CX = GX, PH = 254, CY = PH * .5, R0 = 24;
const lines = (G: PlateRun | null | undefined, lv = 0, perk: typeof IGN | null = IGN) => plateLines('fire', FIRE_B, G, perk, pkOf(lv));
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const BOX = { x: CX - PLATE.boxHalfW, y: CY - PLATE.boxHalfH, w: 2 * PLATE.boxHalfW, h: 2 * PLATE.boxHalfH };

describe('plateLines', () => {
  it('offers the unlock in gold and no chip for a fresh biome', () => {
    const L = lines(run());
    expect(L).toMatchObject({ name: 'THE FURNACE', tag: 'BURNING // BUTCHER', perkState: 'unlock', perk: 'UNLOCKS IMMOLATION', perkCol: PLATE.col.unlock, mark: null });
  });

  it('splits the unlock line by role: the verb for the tag grey, only the perk name in gold', () => {
    const L = lines(run());
    expect([L.perkLead, L.perkName]).toEqual(['UNLOCKS ', 'IMMOLATION']);
    expect(L.perkLead + L.perkName).toBe(L.perk);
  });

  it('keeps known and spent lines whole, with no grey lead', () => {
    for (const [G, lv] of [[run({ visited: ['fire'] }), 0], [run(), 2]] as const) {
      const L = lines(G, lv);
      expect(L.perkLead).toBe('');
      expect(L.perkName).toBe(L.perk);
    }
  });

  it('has no perk parts for a biome with no perk row', () => {
    const L = lines(run(), 0, null);
    expect([L.perkLead, L.perkName]).toEqual(['', null]);
  });

  it('says KNOWN in grey for a cleared biome whose perk is below max', () => {
    for (const lv of [0, 1]) {
      const L = lines(run({ visited: ['fire'] }), lv);
      expect(L).toMatchObject({ perkState: 'known', perk: 'IMMOLATION: KNOWN', perkCol: PLATE.col.known });
    }
  });

  it('says FULLY GROWN once the perk is at max, even with visited empty (spent wins)', () => {
    expect(lines(run(), 2)).toMatchObject({ perkState: 'spent', perk: 'IMMOLATION: FULLY GROWN', perkCol: PLATE.col.spent });
    expect(lines(run({ visited: ['fire'] }), 2).perkState).toBe('spent');
  });

  it('marks ALTERED for any earlier visit, with no count, and nothing for zero or missing', () => {
    expect(PLATE_COPY.remix).toBe('ALTERED');
    expect(lines(run({ bvis: { fire: 1 } })).mark).toBe(PLATE_COPY.remix);
    expect(lines(run({ bvis: { fire: 3 } })).mark).toBe(PLATE_COPY.remix);
    expect(lines(run({ bvis: { fire: 0 } })).mark).toBeNull();
    expect(lines(run({ bvis: { ice: 2 } })).mark).toBeNull();
  });

  it('follows each field on its own when bvis is set but visited is empty', () => {
    expect(lines(run({ bvis: { fire: 1 } }))).toMatchObject({ mark: PLATE_COPY.remix, perkState: 'unlock' });
  });

  it('follows each field on its own when visited has the biome but bvis does not', () => {
    expect(lines(run({ visited: ['fire'] }), 1)).toMatchObject({ mark: null, perkState: 'known' });
  });

  it('still offers the unlock when only other biomes were visited', () => {
    expect(lines(run({ visited: ['ice', 'acid'], bvis: { ice: 1, acid: 1 } }))).toMatchObject({ perkState: 'unlock', mark: null });
  });

  it('reads a perk level above max as spent', () => {
    expect(lines(run({ visited: ['fire'] }), IGN.max + 1).perkState).toBe('spent');
  });

  it('drops the perk line for a biome with no perk row, and the plate to 2 lines', () => {
    const L = lines(run(), 0, null);
    expect([L.perk, L.perkState, L.perkCol]).toEqual([null, null, null]);
    expect(plateBox(L, GX, 60, R0, measure, CX, CY, PH).h).toBe(PLATE.h2);
    expect(plateBox(lines(run()), GX, 60, R0, measure, CX, CY, PH).h).toBe(PLATE.h);
    expect(PLATE.h2).toBeLessThan(PLATE.h);
  });

  it('does not throw on missing run fields and reads them as nothing done', () => {
    for (const G of [undefined, null, {}, { visited: null, bvis: null }] as const) {
      expect(lines(G as PlateRun)).toMatchObject({ perkState: 'unlock', mark: null });
    }
  });

  it('does not mutate its inputs', () => {
    const G = run({ visited: ['fire'], bvis: { fire: 1 } });
    expect(() => lines(G, 1)).not.toThrow();
    expect(G).toEqual({ visited: ['fire'], bvis: { fire: 1 } });
  });

  it('keeps every perk line of the four biome perks within 27 characters, and every plate within the width budget', () => {
    for (const p of BIOME_PERKS) {
      for (const s of ['unlock', 'known', 'spent'] as const) expect(PLATE_COPY[s](p.name).length).toBeLessThanOrEqual(27);
      const L: PlateLines = plateLines(p.b, { name: BIOME_NAMES[p.b], tag: 'DISSOLVING // MAW' }, run({ bvis: { [p.b]: 1 } }), p, () => 0);
      expect(plateBox(L, GX, 60, R0, measure, CX, CY, PH).w).toBeLessThanOrEqual(140);
    }
  });
});

describe('plateBox', () => {
  it('slides squeezed plates left of the countdown box and gives them a leader', () => {
    const a = plateBox(lines(run()), GX, CY - 28, R0, measure, CX, CY, PH), b = plateBox(lines(run()), GX, CY + 28, R0, measure, CX, CY, PH);
    for (const q of [a, b]) {
      expect(q.slid).toBe(true);
      expect(q.tipX).toBeLessThanOrEqual(CX - 44 - 2);
      expect(q.leaderTo).not.toBeNull();
      expect(overlap(q, BOX)).toBe(false);
    }
    expect(overlap(a, b)).toBe(false);
  });

  it('keeps unsqueezed plates where they were: right edge at gx - r - 14', () => {
    for (const gy of [60, 200]) {
      const q = plateBox(lines(run()), GX, gy, R0, measure, CX, CY, PH);
      expect(q.slid).toBe(false);
      expect(q.leaderTo).toBeNull();
      expect(q.x + q.w).toBeCloseTo(GX - R0 - 14, 9);
    }
  });

  it('keeps the plate on the canvas at the extreme gate heights and with a huge name', () => {
    for (const gy of [28, PH - 28, 0, PH]) {
      const q = plateBox(lines(run()), GX, gy, R0, measure, CX, CY, PH);
      expect(q.y).toBeGreaterThanOrEqual(2);
      expect(q.y + q.h).toBeLessThanOrEqual(PH - 2);
    }
    const big = plateLines('fire', { name: 'X'.repeat(200), tag: 'T' }, run(), IGN, () => 0);
    expect(plateBox(big, GX, 60, R0, measure, CX, CY, PH).x).toBeGreaterThanOrEqual(4);
  });

  it('decides the slide from the gate height alone, so the pulsing radius never flips it', () => {
    for (const gy of [40, CY - 32, CY - 31.9, CY - 28, CY, CY + 31.9, CY + 32, 210]) {
      const s = new Set([24, 25, 26.4, 27.6].map((r) => plateBox(lines(run()), GX, gy, r, measure, CX, CY, PH).slid));
      expect(s.size).toBe(1);
    }
  });

  it('steps the perk-line colours down in brightness, gold then known then spent, all >= 4.5:1 on the plate', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16), ch = (v: number) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };
      return .2126 * ch(n >> 16) + .7152 * ch((n >> 8) & 255) + .0722 * ch(n & 255);
    };
    const { unlock, known, spent } = PLATE.col;
    expect(lum(unlock)).toBeGreaterThan(lum(known));
    expect(lum(known)).toBeGreaterThan(lum(spent));
    // worst case for the plate: .85 black composited over pure white is sRGB 38 (#262626)
    const bg = lum('#262626');
    for (const c of [unlock, known, spent]) expect((lum(c) + .05) / (bg + .05)).toBeGreaterThanOrEqual(4.5);
  });

  it('never returns a lime colour', () => {
    const lime = (hex: string) => {
      const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      if (d < .35) return false; // low saturation: grey, not lime
      const h = mx === g ? 60 * ((b - r) / d + 2) : mx === r ? 60 * (((g - b) / d) % 6) : 60 * ((r - g) / d + 4);
      return h >= 75 && h <= 150;
    };
    expect(lime('#b6ff3a')).toBe(true); // the enemy-bullet lime: the check is not vacuous
    const cols = [...Object.values(PLATE.col)];
    for (const lv of [0, 2]) for (const G of [run(), run({ visited: ['fire'] })]) cols.push(lines(G, lv).perkCol as string);
    for (const c of cols) expect(lime(c), c).toBe(false);
  });
});

describe('the mirrored biome perk table', () => {
  it('matches the req rows of PERKS in perks.ts', async () => {
    vi.doMock('../../src/core', () => ({ FIRE: 0, PH: 270, R: () => 0, TAU: Math.PI * 2, W: 480, clamp: (v: number) => v, ctx: {}, dist2: () => 0, pick: (a: any[]) => a[0], ri: () => 0, rr: () => 0, swapRm: () => {} }));
    vi.doMock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
    vi.doMock('../../src/platform', () => ({ buzz: () => {} }));
    vi.doMock('../../src/input', () => ({ PR: {}, I: {} }));
    vi.doMock('../../src/world', () => ({ caps: [], ceilAt: () => 0, enemies: [], eshots: [], floorAt: () => 0, orbs: [] }));
    vi.doMock('../../src/fx/spawn', () => ({ drop: () => {}, flash: () => {}, gib: () => {}, gore: () => {}, mist: () => {}, pop: () => {}, spark: () => {} }));
    vi.doMock('../../src/enemies/update', () => ({ hurt: () => {} }));
    vi.doMock('../../src/boss/update', () => ({ bossHitByShot: () => {} }));
    vi.doMock('../../src/save', () => ({ SET: {} }));
    vi.doMock('../../src/player', () => ({ WARD_MAX: 3 }));
    vi.doMock('../../src/render/util', () => ({ drawChain: () => {}, drawHookTip: () => {}, light: () => {} }));
    const { PERKS } = await import('../../src/perks');
    const real = PERKS.filter((p: any) => p.req).map((p: any) => ({ b: p.req, id: p.id, name: p.name, max: p.max }));
    expect(real).toEqual(BIOME_PERKS);
  });
});
