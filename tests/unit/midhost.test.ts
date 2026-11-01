import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BROOD_CAP, HOST_SPARK, HOST_TINT, MID_BODY, MID_HOME, bodyBand, fitY, isCross, midHost } from '../../src/enemies/midhost';

// Build plan LS1 row P0: the four biome midbosses must work as crossovers in every biome.
// biomes.ts and update.ts touch the DOM at import time, so their facts are read from the source text.
const BIOMES_SRC = readFileSync('src/biomes.ts', 'utf8');
const UPDATE_SRC = readFileSync('src/enemies/update.ts', 'utf8');
const KINDS = Object.keys(MID_HOME) as (keyof typeof MID_HOME)[];
const BIOME_KEYS = ['ice', 'acid', 'fire', 'snot'] as const;
/** the narrowest corridor biome terrain can make (shape() in src/biomes.ts forces fl - ce >= 108) */
const MIN_CORRIDOR = 108;

describe('midboss home and host', () => {
  it('matches each biome midboss to the biome that lists it as mid in biomes.ts', () => {
    for (const k of KINDS) expect(BIOMES_SRC).toMatch(new RegExp(`${MID_HOME[k]}: \\{[\\s\\S]*?mid: '${k}'`));
  });

  it('treats a midboss with no host, or its home host, as a home fight', () => {
    for (const k of KINDS) {
      expect(isCross({ k })).toBe(false);
      expect(isCross({ k, host: MID_HOME[k] })).toBe(false);
      expect(midHost({ k })).toBe(MID_HOME[k]);
    }
  });

  it('treats every other host as a crossover, 12 pairs in all', () => {
    let n = 0;
    for (const k of KINDS) for (const b of BIOME_KEYS) if (b !== MID_HOME[k]) { expect(isCross({ k, host: b })).toBe(true); expect(midHost({ k, host: b })).toBe(b); n++; }
    expect(n).toBe(12);
  });

  it('never calls a non-midboss a crossover', () => {
    expect(isCross({ k: 'maw', host: 'acid' })).toBe(false);
    expect(isCross({ k: 'ufo', host: 'ice' })).toBe(false);
  });
});

describe('terrain band', () => {
  it('leaves every body room in the narrowest biome corridor', () => {
    for (const k of KINDS) expect(MID_BODY[k].up + MID_BODY[k].dn).toBeLessThanOrEqual(MIN_CORRIDOR);
  });

  it('puts the band body-clearance inside the ceiling and floor', () => {
    expect(bodyBand('cyst', 40, 200)).toEqual([40 + MID_BODY.cyst.up, 200 - MID_BODY.cyst.dn]);
  });

  it('collapses the band to the corridor middle when the corridor is narrower than the body', () => {
    const [lo, hi] = bodyBand('choir', 100, 150);
    expect(lo).toBe(hi);
    expect(lo).toBeGreaterThan(100);
    expect(lo).toBeLessThan(150);
  });

  it('writes into the scratch array it is given instead of allocating', () => {
    const out = [0, 0];
    expect(bodyBand('brood', 30, 220, out)).toBe(out);
  });

  it('clamps y into the band and leaves a y already inside it alone', () => {
    expect(fitY(10, 50, 150)).toBe(50);
    expect(fitY(200, 50, 150)).toBe(150);
    expect(fitY(99.5, 50, 150)).toBe(99.5);
  });
});

describe('host palettes', () => {
  it('copies each biome tint colour from BIOMES[b].rgb', () => {
    for (const b of BIOME_KEYS) expect(BIOMES_SRC).toMatch(new RegExp(`${b}: \\{[\\s\\S]*?rgb: '${HOST_TINT[b].rgb}'`));
  });

  it('keeps the tint a wash, not a repaint', () => {
    for (const b of BIOME_KEYS) { expect(HOST_TINT[b].a).toBeGreaterThan(0); expect(HOST_TINT[b].a).toBeLessThanOrEqual(0.3); }
  });

  it('has spark colours for every host', () => {
    for (const b of BIOME_KEYS) { expect(HOST_SPARK[b].length).toBeGreaterThan(0); for (const c of HOST_SPARK[b]) expect(c).toMatch(/^#[0-9a-f]{6}$/); }
  });
});

describe('midboss hygiene in update.ts', () => {
  const cases = UPDATE_SRC.slice(UPDATE_SRC.indexOf("case 'choir':"), UPDATE_SRC.indexOf("case 'ufo':"));

  it('finds the four midboss cases', () => {
    for (const k of KINDS) expect(cases).toContain(`case '${k}':`);
  });

  it('allocates no arrays or closures in the four midboss update cases', () => {
    expect(cases).not.toMatch(/\.(filter|map|some|every|slice|concat)\(/);
    expect(cases).not.toMatch(/=>/);
  });

  it('caps the Brood Mother litter at 8 alive', () => {
    expect(BROOD_CAP).toBe(8);
    expect(cases).toContain('BROOD_CAP - kids');
  });
});
