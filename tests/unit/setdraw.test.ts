// The set-piece catalogue and draw (spec §3.3, §10; build plan LS2-mv): pure, no DOM.
import { describe, expect, it } from 'vitest';
import { B1_FIRST_VISIT, CATALOG, SETS_PER_STAGE, drawSets, isSetId, moveRoll } from '../../src/setdraw';
import { stream } from '../../src/rng';

const BIOMES = Object.keys(CATALOG);
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('the set-piece catalogue', () => {
  it('has five distinct pieces per biome and no piece in two biomes', () => {
    for (const b of BIOMES) expect(new Set(CATALOG[b]).size, b).toBe(5);
    expect(new Set(Object.values(CATALOG).flat()).size).toBe(5 * BIOMES.length);
  });
  it('recognises its own ids and nothing else', () => {
    expect(isSetId('morgue')).toBe(true);
    for (const v of ['nope', '', 3, null, undefined, 'constructor']) expect(isSetId(v)).toBe(false);
  });
});

describe('drawSets', () => {
  it.each(BIOMES)('%s: a stage draws three different pieces, the same three from the same stream', (b) => {
    for (const s of SEEDS) {
      const a = drawSets(b, {}, stream(s));
      expect(a).toHaveLength(SETS_PER_STAGE);
      expect(new Set(a).size).toBe(SETS_PER_STAGE);
      expect(drawSets(b, {}, stream(s))).toEqual(a);
    }
  });
  it.each(BIOMES)('%s: a second visit plays both unused pieces, refilling for its third and repeating nothing within the stage', (b) => {
    for (const s of SEEDS) {
      const used = {}, rs = stream(s), one = drawSets(b, used, rs), two = drawSets(b, used, rs);
      expect(new Set(two).size).toBe(SETS_PER_STAGE);
      for (const id of CATALOG[b].filter((x) => !one.includes(x))) expect(two).toContain(id);
    }
  });
  it.each(BIOMES)('%s: over a long run no piece comes back before the catalogue has been through, bar the refill stage', (b) => {
    const used = {}, rs = stream(9), n = Object.fromEntries(CATALOG[b].map((k) => [k, 0]));
    for (let v = 0; v < 500; v++) for (const id of drawSets(b, used, rs)) n[id]++;
    for (const k of CATALOG[b]) expect(n[k], k).toBeGreaterThan(200); // 1500 draws over five: every piece is reached
  });
  it('keeps each biome\'s used set apart', () => {
    const used: Record<string, string[]> = {};
    drawSets('ice', used, stream(1));
    expect(used.ice).toHaveLength(3);
    expect(used.fire).toBeUndefined();
  });
});

describe('moveRoll', () => {
  it('flies B0 on a first visit in Descent 1, without drawing', () => {
    let n = 0;
    expect(moveRoll(0, 0, () => { n++; return 0; })).toBe(0);
    expect(n).toBe(0);
  });
  it('flies B1 on every remix, without drawing', () => {
    let n = 0;
    for (const loop of [0, 1, 3]) expect(moveRoll(1, loop, () => { n++; return .99; })).toBe(1);
    expect(n).toBe(0);
  });
  it('may roll B1 on a first visit from Descent 2', () => {
    expect(moveRoll(0, 1, () => B1_FIRST_VISIT - .01)).toBe(1);
    expect(moveRoll(0, 1, () => B1_FIRST_VISIT)).toBe(0);
  });
});
