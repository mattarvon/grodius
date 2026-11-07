// LS2-0: the midboss registry. Every list of kinds comes from enemies/mid/roster.ts, each kind has its sim and render
// file, nothing else keeps a list, and the module order holds (sim never imports render; the roster stays a leaf).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BIOME_POOLS, MID_ET, MID_NAMES, MID_SIM, ROSTER, biomePool, defineMid, midProblems, midRow, type MidRow } from '../../src/enemies/mid/roster';
import { HOME, MIDS, PHASE1_BIOME_POOL, pickBiomeMids, pickMids, slotClock } from '../../src/midpick';
import { HOME_FIT, MID_BODY, MID_HOME } from '../../src/enemies/midhost';
import { BOOT_ART, routeKeys } from '../../src/warmplan';

const src = (p: string) => readFileSync('src/' + p, 'utf8');
/** the kind files in a registry folder: `_name.ts` is a shared helper, which both globs skip */
const kindFiles = (dir: string, not: string[]) => readdirSync('src/' + dir).filter((f) => f.endsWith('.ts') && !f.startsWith('_') && !not.includes(f)).map((f) => f.slice(0, -3)).sort();
const KINDS = ROSTER.map((r) => r.k);
/** a greybox row as a pool lane adds one */
const GREY: MidRow = { k: 'greybox', name: 'THE GREYBOX', label: 'GREYBOX', tag: 'WINDOW', pool: 'ice', min: 0, fit: { up: 20, dn: 20, hw: 20 }, wip: true };
/** a seeded [0, 1) stream (mulberry32) */
const stream = (s: number) => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('the roster', () => {
  it('keeps the existing midbosses, in the order the picker walks', () => {
    expect(KINDS.slice(0, 5)).toEqual(['choir', 'cyst', 'prentice', 'brood', 'ufo']);
    expect(PHASE1_BIOME_POOL.slice(0, 4)).toEqual(['choir', 'cyst', 'prentice', 'brood']);
  });

  it('holds no kind twice, and a probe label fits its column', () => {
    expect(new Set(KINDS).size).toBe(KINDS.length);
    for (const r of ROSTER) expect(r.label.length).toBeLessThanOrEqual(12);
  });

  it('gives every biome-pool kind a terrain fit that leaves a band in the narrowest corridor', () => {
    for (const r of ROSTER.filter((x) => BIOME_POOLS.includes(x.pool))) {
      expect(r.fit, r.k).toBeDefined();
      expect(r.fit!.up + r.fit!.dn, r.k).toBeLessThan(108);
    }
  });

  it('feeds every table that used to be kept by hand', () => {
    expect(Object.keys(MIDS)).toEqual(KINDS);
    // toMatchObject and slices: a pool lane's new row must not need an edit here
    expect(HOME).toEqual({ ice: 'choir', acid: 'cyst', fire: 'prentice', snot: 'brood' });
    expect(MID_HOME).toMatchObject({ choir: 'ice', cyst: 'acid', prentice: 'fire', brood: 'snot' });
    expect(Object.keys(MID_BODY).slice(0, 4)).toEqual(['choir', 'cyst', 'prentice', 'brood']);
    expect(HOME_FIT).toContain('brood');
    expect(MID_NAMES.ufo).toBe('THE SQUIDFUCKED SAUCER');
    expect(BOOT_ART).toEqual(['hero', 'eyes', 'derelict', 'maw:orbit', ...ROSTER.filter((r) => r.boot && !r.wip).map((r) => r.k), 'drive']);
    expect(BOOT_ART).toContain('ufo');
  });

  it('gives every kind in a pool a different tag (spec §6.1), so the two midbosses of a stage test two skills', () => {
    for (const p of new Set(ROSTER.map((r) => r.pool))) {
      const tags = ROSTER.filter((r) => r.pool === p).map((r) => r.tag);
      expect(new Set(tags).size, p).toBe(tags.length);
    }
  });

  it('keeps ANGLE and RACE kinds out of Descent 1 (spec §6.3 step 1)', () => {
    for (const r of ROSTER) if (r.tag === 'ANGLE' || r.tag === 'RACE') expect(r.min, r.k).toBeGreaterThanOrEqual(1);
  });

  it('keeps the picker values of the five kinds it moved', () => {
    expect(MIDS.choir).toEqual({ body: 'choir', tag: 'LINE', min: 0 });
    expect(MIDS.cyst).toEqual({ body: 'cyst', tag: 'SPACE', min: 0 });
    expect(MIDS.prentice).toEqual({ body: 'prentice', tag: 'RANGE', min: 0 });
    expect(MIDS.brood).toEqual({ body: 'brood', tag: 'CROWD', min: 0 });
    expect(MIDS.ufo).toEqual({ body: 'ufo', tag: 'DRIFT', min: 0 });
    expect(slotClock('ufo', 0)).toBe(1080);
  });
});

describe('one file per kind', () => {
  it('has a sim file calling defineMid and an art file with draw and warm for every row, and no orphan', () => {
    expect(kindFiles('enemies/mid', ['index.ts', 'roster.ts'])).toEqual([...KINDS].sort());
    expect(kindFiles('render/gross/mid', ['index.ts'])).toEqual([...KINDS].sort());
    for (const k of KINDS) {
      expect(src(`enemies/mid/${k}.ts`)).toContain(`defineMid('${k}', {`);
      expect(src(`render/gross/mid/${k}.ts`)).toMatch(/export default (\{[\s\S]*draw[\s\S]*warm|greybox\()/);
    }
  });

  it('gives route art built and drop too, which only a boot kind or a greybox may leave out', () => {
    for (const r of ROSTER) if (!r.boot) expect(src(`render/gross/mid/${r.k}.ts`).split('export default')[1], r.k).toMatch(/built[\s\S]*drop|^ greybox\(/);
  });

  it('keeps a unit with no built or drop out of the warm-up drop pass, so the warm-up never spins on a no-op drop', () => {
    const units = { boot: { built: () => true, drop: () => {} }, art: { built: () => true, drop: () => {} }, grey: {}, half: { built: () => true } };
    expect(routeKeys(units, ['boot'])).toEqual(['art']);
  });

  it('names every registry problem checkMids would refuse to boot on, and none for the real registry', () => {
    const sim = Object.fromEntries(KINDS.map((k) => [k, {}]));
    expect(midProblems(ROSTER, sim, KINDS)).toEqual([]);
    expect(midProblems([...ROSTER, GREY], sim, KINDS)).toEqual(['greybox (no enemies/mid/greybox.ts defineMid)', 'greybox (no render/gross/mid/greybox.ts)']);
    expect(midProblems(ROSTER, sim, [...KINDS, 'stray'])).toEqual(['stray (art with no roster row)']);
  });

  it('checks both sides at boot', () => {
    expect(src('main.ts')).toMatch(/^checkMids\(\);/m);
  });
});

describe('defineMid', () => {
  const sim = { et: { hp: 1 }, word: 'X', update: () => {} };

  it('refuses a kind with no roster row', () => {
    expect(() => defineMid('nobody', sim)).toThrow(/midboss 'nobody' has no row/);
    expect(MID_SIM.nobody).toBeUndefined();
  });

  it('refuses a kind defined twice, and files the ET row with the sim side', () => {
    defineMid('choir', sim); // this file loads no kind, so the first define is ours
    try {
      expect(MID_ET.choir).toBe(sim.et);
      expect(() => defineMid('choir', sim)).toThrow(/defined twice/);
    } finally { delete MID_SIM.choir; delete MID_ET.choir; }
  });
});

describe('no hand-kept kind list survives', () => {
  // built from the roster, so a pool lane's kind is caught the same as the five that moved
  const ANY = KINDS.join('|');
  const KIND_KEY = new RegExp(`\\b(${ANY}): *['"{]`);

  it('has no kind table left in the files that used to hold one', () => {
    for (const f of ['biomes.ts', 'midpick.ts', 'enemies/midhost.ts', 'warmplan.ts', 'render/warmup.ts', 'render/hud.ts', 'enemies/spawn.ts', 'enemies/update.ts', 'render/gross/midbosses.ts']) expect(src(f), f).not.toMatch(KIND_KEY);
  });

  it('has no switch arm or per-kind branch left in the sim or the draw', () => {
    expect(src('enemies/update.ts')).not.toMatch(new RegExp(`case '(${ANY})'`));
    expect(src('enemies/update.ts')).not.toMatch(/e\.k === 'ufo'/);
    expect(src('enemies/spawn.ts')).not.toMatch(/k === '(choir|prentice)'/);
    expect(src('render/enemies.ts')).not.toMatch(/e\.k === '(choir|prentice)'/);
  });

  it('reads the kinds in the probes from the roster', () => {
    for (const t of ['midboss-probe', 'perf-probe', 'depth-probe', 'rng-probe']) expect(readFileSync(`tools/${t}.mjs`, 'utf8'), t).toContain("from '../src/enemies/mid/roster.ts'");
  });
});

describe('module order', () => {
  const simFiles = kindFiles('enemies/mid', []).map((k) => `enemies/mid/${k}.ts`);

  it('keeps the roster a leaf: no import, so pure modules and plain Node can read it', () => {
    expect(src('enemies/mid/roster.ts')).not.toMatch(/^import /m);
  });

  it('loads the roster in plain Node, as the probes do (an enum or a namespace would pass Vite and fail there)', () => {
    const out = execFileSync(process.execPath, ['--input-type=module', '-e',
      "const m = await import('./src/enemies/mid/roster.ts'); console.log(m.ROSTER.map((r) => r.k).join())"], { encoding: 'utf8' });
    expect(out.trim()).toBe(KINDS.join());
  });

  it('never imports render from the sim side of the registry', () => {
    for (const f of simFiles) expect(src(f), f).not.toMatch(/from '[^']*render\//);
  });

  it('keeps the pure modules off the kinds\' files', () => {
    const kindFile = new RegExp(`enemies/mid'|mid/(${KINDS.join('|')})'`);
    for (const f of ['midpick.ts', 'warmplan.ts', 'runsave.ts', 'enemies/midhost.ts', 'depth.ts', 'midslot.ts']) expect(src(f), f).not.toMatch(kindFile);
  });

  it('keeps the load edge that fixes the spawn <-> kinds init order in the built game', () => {
    expect(src('enemies/spawn.ts')).toMatch(/^import '\.\/mid';$/m);
    expect(existsSync('src/enemies/ufo.ts')).toBe(false);
  });
});

describe('the WIP flag', () => {
  const rows = [...ROSTER, GREY];
  const defs = { ...MIDS, greybox: { body: 'greybox', tag: GREY.tag, min: 0 } };
  /** how often 2000 picks over this pool meet the greybox */
  const met = (pool: readonly string[]) => {
    let n = 0;
    const rng = stream(7);
    for (let i = 0; i < 2000; i++) if (pickMids({ pool, L: 0, used: [], rng, defs }).picks.includes('greybox')) n++;
    return n;
  };

  it('leaves a WIP row out of the pool unless the flag is on', () => {
    expect(biomePool(false, rows)).not.toContain('greybox');
    expect(biomePool(true, rows)).toContain('greybox');
    expect(biomePool(false, rows)).toEqual(biomePool(false, ROSTER));
  });

  it('never picks a WIP kind with the flag off, and reaches it with the flag on', () => {
    expect(met(biomePool(false, rows))).toBe(0);
    expect(met(biomePool(true, rows))).toBeGreaterThan(0);
  });

  // only meaningful while the roster has no wip row: once a lane adds one, the flag is meant to move picks
  it.skipIf(ROSTER.some((r) => r.wip))('draws the same picks with the flag on while no row is WIP, so the flag alone never moves a run', () => {
    for (let s = 1; s <= 200; s++) {
      const a = pickBiomeMids({ mbUsed: [], mbLast: {} }, 'ice', 0, stream(s), undefined, false, false);
      const b = pickBiomeMids({ mbUsed: [], mbLast: {} }, 'ice', 0, stream(s), undefined, false, true);
      expect(b).toEqual(a);
    }
  });

  it('never makes a WIP row a home midboss', () => {
    for (const b of BIOME_POOLS) expect(midRow(HOME[b])!.wip).toBeFalsy();
  });

  // the flag's wiring into biomes.ts stageMids is proved by behaviour in midwip-stage.test.ts
});
