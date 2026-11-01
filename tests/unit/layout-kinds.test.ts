import { describe, expect, it, vi } from 'vitest';
import { LAYOUTS } from '../../src/layout';

// stages.ts and music.ts pull in audio / save / DOM-touching modules at import; only their tables are under test
vi.mock('../../src/save', () => ({ save: () => {}, lv: () => 0, SET: {} }));
vi.mock('../../src/audio', () => ({ AU: {}, sample: () => {}, sfx: {} }));
vi.mock('../../src/enemies/spawn', () => ({ banner: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/biomes', () => ({ BIOMES: {}, openFork: () => {}, holdForFork: () => {}, biomeExit: () => {} }));

const { STAGE_NAMES } = await import('../../src/stages');
const { TRACKS } = await import('../../src/music');

/** every stage kind any layout entry uses */
const KINDS = [...new Set(Object.values(LAYOUTS).flatMap((L) => L!.stages.map((r) => r.kind)))];

describe('every stage kind in a layout has its data', () => {
  // a kind with no name crashes startStage (stageInfo(i).name); one with no track plays silence (music.ts wanted()).
  // Adding an `interior` row (long5) without both fails here instead of in play
  it.each(KINDS)('%s has a stage name and subtitle', (k) => {
    const n = (STAGE_NAMES as Record<string, { name: string; sub: string }>)[k];
    expect(n && n.name && n.sub).toBeTruthy();
  });

  it.each(KINDS)('%s has a music track', (k) => {
    const t = (TRACKS as Record<string, unknown>)[k];
    expect(Array.isArray(t) ? t.length : !!t).toBeTruthy();
  });

  it('gives every biome slot a fallback track', () => {
    for (const L of Object.values(LAYOUTS)) for (const r of L!.stages) if (r.kind === 'biome') expect(TRACKS.biome[r.slot!]).toBeTruthy();
  });
});
