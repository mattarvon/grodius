// S2-K1 fix 1: the baked gib atlas must hold a cell for every gib fx/spawn.ts can make, under every gore palette.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { stubDom } from './fakecanvas';

let A: typeof import('../../src/render/gibart');
let C: any, BIOMES: any, require0: any, COLS: typeof import('../../src/fx/gibcols');
const pts = [[1.5, .2], [.3, 2.1]];
const SIZES = [1.3, 1.5, 1.8, 2, 2.6, 3, 3.4, 4.2, 5, 5.7, 7.4, 9];

beforeAll(async () => {
  stubDom();
  A = await import('../../src/render/gibart');
  ({ C } = await import('../../src/core'));
  require0 = await import('../../src/biomes');
  ({ BIOMES } = require0);
  COLS = await import('../../src/fx/gibcols');
  A.gibAtlas();
});
afterAll(() => vi.unstubAllGlobals());
const nPal = () => Object.keys(BIOMES).length + 1;

describe('gibCell', () => {
  it('has a chunk cell for every colour gib() rolls, in every palette, at any size, with any flags', () => {
    const palettes = [C.blood, ...Object.values<any>(BIOMES).map((b) => b.blood[0])];
    const cols = [...COLS.GIB_FLESH, ...palettes];
    for (const col of cols) for (const s of SIZES) for (const fat of [false, true]) for (const bn of [false, true])
      expect(A.gibCell({ k: 'chunk', s, col, fat, bn, pts }, 0), `${col} ${s}`).toBeTruthy();
  });

  it('bakes each blood and flesh colour into its own cell instead of falling back to the first flesh colour', () => {
    // gibCell falls back to FLESH[0] for a colour nobody baked, so "truthy" alone passes even if the bake skipped a palette (qa-tester, wave 1 review)
    const cols = [...COLS.GIB_FLESH.slice(1), C.blood, ...Object.values<any>(BIOMES).map((b) => b.blood[0])];
    for (const col of cols) for (const s of SIZES) {
      const q = { k: 'chunk', s, fat: false, bn: false, pts };
      expect(A.gibCell({ ...q, col }, 0), `${col} ${s}`).not.toBe(A.gibCell({ ...q, col: COLS.GIB_FLESH[0] }, 0));
    }
  });

  it('rolls its flesh from the shared list, in the order spawn has always used', () => {
    expect(COLS.GIB_FLESH).toEqual([C.flesh, C.fleshD, '#8e3a32', '#a3473c']);
    expect(COLS.GIB_METAL).toEqual(['#3a434d', '#56616d', '#2a3038']);
  });

  it('has metal, skin, skull, tooth, bone and limb cells under every palette', () => {
    for (let p = 0; p < nPal(); p++) for (const s of SIZES) {
      for (const col of COLS.GIB_METAL) expect(A.gibCell({ k: 'metal', s, col, pts }, p), col).toBeTruthy();
      expect(A.gibCell({ k: 'skin', s, pts }, p)).toBeTruthy();
      expect(A.gibCell({ k: 'skull', s }, p)).toBeTruthy();
      expect(A.gibCell({ k: 'tooth', s }, p)).toBeTruthy();
      expect(A.gibCell({ k: 'bone', s }, p)).toBeTruthy();
      for (const o of [{ arm: true }, { boot: true }, {}]) expect(A.gibCell({ k: 'limb', s, ...o }, p)).toBeTruthy();
    }
  });

  it('gives a detail the live palette: a bone in the acid changes cell, a chunk keeps its spawn colour', () => {
    expect(A.gibCell({ k: 'bone', s: 3 }, 0)).not.toBe(A.gibCell({ k: 'bone', s: 3 }, 2));
    const q = { k: 'chunk', s: 3, col: C.flesh, pts };
    expect(A.gibCell(q, 0)).toBe(A.gibCell(q, 2));
  });

  it('reads the palette from C.blood, the way applyPalette writes it', () => {
    const keep = C.blood;
    try {
      expect(A.gibPal()).toBe(0);
      C.blood = BIOMES.acid.blood[0];
      expect(A.gibPal()).toBeGreaterThan(0);
    } finally { C.blood = keep; }
  });

  it('gives every gore palette its own blood, so gibPal can tell them apart', () => {
    const { C0 } = require0;
    const bloods = [C0.blood, ...Object.values<any>(BIOMES).map((b) => b.blood[0])];
    for (const b of Object.values<any>(BIOMES)) { expect(b.blood[0]).toBeTruthy(); expect(b.blood[1]).toBeTruthy(); }
    expect(new Set(bloods).size).toBe(bloods.length);
  });

  it('bakes the top size bucket past the largest chunk gore() can roll (3.4 + 0.5 x size 5)', () => {
    const big = A.gibCell({ k: 'chunk', s: 5.9, col: C.flesh, pts }, 0);
    expect(big.r).toBeGreaterThanOrEqual(5.9);
  });

  it('draws a colour it never baked as flesh rather than failing the frame', () => {
    expect(A.gibCell({ k: 'chunk', s: 3, col: '#123456', pts }, 0)).toBeTruthy();
    expect(A.gibCell({ k: 'metal', s: 3, col: '#123456', pts }, 0)).toBeTruthy();
  });

  it('packs every cell apart: no two overlap', () => {
    const cells = A.gibCells();
    expect(cells.length).toBeGreaterThan(500);
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j], ad = a.h * 2, bd = b.h * 2;
      expect(a.x + ad <= b.x || b.x + bd <= a.x || a.y + ad <= b.y || b.y + bd <= a.y).toBe(true);
    }
  });
});
