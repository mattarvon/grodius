// The per-route warm-up plan (build plan LS1 row K): what is wanted when, and the hard rule that no warm-up work runs
// inside a WARNING window. tools/perf-probe.mjs warmcheck is the in-page proof over a real long4 descent.
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOOT_ART, BOSS_ART, routeArt, warmBlocked } from '../../src/warmplan';
import { setLayout } from '../../src/layout';
import { HOME } from '../../src/midpick';

const SLOT0_STAGE = 1, SLOT1_STAGE = 2; // long4 and short: Orbit, biome, biome, Drive
const src = (p: string) => readFileSync(new URL('../../src/' + p, import.meta.url), 'utf8');

beforeEach(() => setLayout('long4'));

describe('routeArt', () => {
  it('wants nothing before the first gate is taken', () => {
    expect(routeArt({ stage: 0, route: [null, null], mb: {} })).toEqual([]);
    expect(routeArt(null)).toEqual([]);
  });

  it('wants the picked pair and the boss the moment choose() commits a slot, before the stage starts', () => {
    const G = { stage: 0, route: ['fire', null], mb: { [SLOT0_STAGE]: ['choir', 'brood'] } };
    expect(routeArt(G)).toEqual(['choir', 'brood', 'butcher']);
  });

  it('drops the previous stage from the plan when the next stage starts', () => {
    const G = { stage: SLOT0_STAGE, route: ['ice', 'snot'], mb: { [SLOT0_STAGE]: ['choir', 'cyst'], [SLOT1_STAGE]: ['brood', 'prentice'] } };
    expect(routeArt(G)).toEqual(['choir', 'cyst', 'crux', 'brood', 'prentice', 'maw:snot']);
    expect(routeArt({ ...G, stage: SLOT1_STAGE })).toEqual(['brood', 'prentice', 'maw:snot']);
    expect(routeArt({ ...G, stage: SLOT1_STAGE + 1 })).toEqual([]);
  });

  it('falls back to the home midboss on the short layout, which has no picks', () => {
    setLayout('short');
    expect(routeArt({ stage: SLOT0_STAGE, route: ['acid', null] })).toEqual([HOME.acid, 'maw:acid']);
  });

  it('gives every biome a boss and keeps the shared art out of the route', () => {
    for (const b of Object.keys(HOME)) expect(BOSS_ART[b]).toBeTruthy();
    for (const k of BOOT_ART) expect(Object.values(BOSS_ART)).not.toContain(k);
  });
});

describe('warmBlocked', () => {
  const calm = { t: 500, warnEnd: 400 };

  it('lets work through in calm play', () => {
    expect(warmBlocked('play', calm)).toBe(false);
    expect(warmBlocked('play', { t: 0 })).toBe(false);
  });

  it('holds for the whole WARNING window, and frees on the step it ends', () => {
    expect(warmBlocked('play', { t: 399, warnEnd: 400 })).toBe(true);
    expect(warmBlocked('play', { t: 400, warnEnd: 400 })).toBe(false);
  });

  it('holds through a pause inside a WARNING', () => {
    expect(warmBlocked('pause', { t: 399, warnEnd: 400 })).toBe(true);
  });

  it('holds while a midboss or a boss is up', () => {
    expect(warmBlocked('play', { ...calm, mini: {} })).toBe(true);
    expect(warmBlocked('play', { ...calm, boss: {} })).toBe(true);
    expect(warmBlocked('play', { ...calm, bossStarted: true })).toBe(true);
  });

  it('ignores the G a dead run left behind, so the title can still warm', () => {
    expect(warmBlocked('title', { t: 10, warnEnd: 400, mini: {} })).toBe(false);
    expect(warmBlocked('over', { t: 10, warnEnd: 400 })).toBe(false);
    expect(warmBlocked('title', null)).toBe(false);
  });
});

describe('the wiring the plan depends on', () => {
  it('names the boss art biomes.ts actually spawns', () => {
    const want: Record<string, string> = { crux: 'crux', butcher: 'butcher', maw: 'maw' };
    for (const [b, key] of Object.entries(BOSS_ART)) {
      const m = src('biomes.ts').match(new RegExp(`\\n\\s*${b}: \\{[\\s\\S]*?boss: '(\\w+)'`));
      expect(m, b).not.toBeNull();
      expect(key.split(':')[0]).toBe(want[m![1]]);
    }
  });

  it('checks the gate before any work in warmPump', () => {
    const body = src('render/warmup.ts').split('export function warmPump')[1];
    expect(body.indexOf('warmBlocked(')).toBeGreaterThan(-1);
    expect(body.indexOf('warmBlocked(')).toBeLessThan(body.indexOf('timed('));
  });

  it('runs the warm-up from one place, and every WARNING goes through banner()', () => {
    expect(src('main.ts')).toContain('startWarm()');
    expect(src('main.ts')).not.toMatch(/\bwarm(Maw|Drive|Ufo|Eyes|HeroEye)\b/);
    expect(src('enemies/spawn.ts')).toMatch(/if \(text === 'WARNING'\) \$\.G\.warnEnd = \$\.G\.t \+ t/);
  });

  it('holds drops while a split corpse can still redraw its body', () => {
    const body = src('render/warmup.ts').split('export function warmPump')[1];
    expect(body.indexOf("q.k === 'half'")).toBeGreaterThan(-1);
    expect(body.indexOf("q.k === 'half'")).toBeLessThan(body.indexOf("'drop'"));
  });

  it('lets a dead Maw rupture once: its split halves must not re-enter the live set', () => {
    expect(src('render/gross/maw.ts')).toMatch(/if \(!e\.dead\) live\.add\(e\)/);
  });

  it('keeps the sim out of the warm-up: no sim file imports it', () => {
    for (const f of ['biomes.ts', 'stages.ts', 'flow.ts', 'step.ts', 'stagebuild.ts']) expect(src(f)).not.toMatch(/warmup|warmplan/);
    expect(src('render/warmup.ts')).not.toMatch(/\bR\(\)|Math\.random/);
  });
});
