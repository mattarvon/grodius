import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spick, sri, srnd, srr } from '../../src/srnd';

// M2 #13 / LS1-B1: render and fx draw from srnd() (src/srnd.ts), never the sim RNG. The sim RNG is core's R and the
// helpers built on it (rr, ri, pick), and Math.random itself, which R is and which the harness seeds. A render-side
// draw from it makes the sim depend on the frame rate, the render path and the HELL FLASHES setting.
// tools/rng-probe.mjs is the runtime proof (each fight identical rendered / unrendered / flashes off).
const SIM_RNG = ['R', 'rr', 'ri', 'pick'];
const ROOTS = ['src/render', 'src/fx'];
// audio too: sfx args are evaluated even with no AudioContext, so an fx-timed sfx call drawing R() leaks fx into the sim
const EXTRA = ['src/audio.ts'];
const root = new URL('../../', import.meta.url);

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** every way a source file can reach the sim RNG: a named import of R/rr/ri/pick from core, a namespace import
 *  of core, or a Math.random call */
function simRngUses(src: string): string[] {
  const s = stripComments(src), out: string[] = [];
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](?:\.{1,2}\/)+core(?:\.ts)?['"]/g)) {
    for (const spec of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (SIM_RNG.includes(spec)) out.push(`imports ${spec} from core`);
  }
  if (/import\s*\*\s*as\s+\w+\s+from\s*['"](?:\.{1,2}\/)+core(?:\.ts)?['"]/.test(s)) out.push('namespace import of core');
  if (/Math\s*\.\s*random\b/.test(s)) out.push('calls Math.random');
  return out;
}

function tsFiles(dir: string): string[] {
  return readdirSync(new URL(dir + '/', root), { recursive: true, withFileTypes: false } as any)
    .map(String).filter((f) => f.endsWith('.ts')).map((f) => `${dir}/${f}`);
}

describe('render, fx and audio never draw the sim RNG', () => {
  const files = [...ROOTS.flatMap(tsFiles), ...EXTRA];

  it('scans the render and fx trees (including render/gross)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain('src/render/hell.ts');
    expect(files).toContain('src/fx/spawn.ts');
    expect(files.some((f) => f.startsWith('src/render/gross/'))).toBe(true);
  });

  it('finds no import of R, rr, ri or pick from core and no Math.random in src/render, src/fx or src/audio.ts', () => {
    const bad = files.flatMap((f) => simRngUses(readFileSync(new URL(f, root), 'utf8')).map((u) => `${f}: ${u}`));
    expect(bad).toEqual([]);
  });

  it('flags each way of reaching the sim RNG (the scan is not vacuous)', () => {
    expect(simRngUses("import { C, R, TAU } from '../core';")).toEqual(['imports R from core']);
    expect(simRngUses("import {\n  rr,\n  ri as rint\n} from '../../core';")).toEqual(['imports rr from core', 'imports ri from core']);
    expect(simRngUses("import { pick } from './core.ts';")).toEqual(['imports pick from core']);
    expect(simRngUses("import * as K from '../core';")).toEqual(['namespace import of core']);
    expect(simRngUses('const a = Math.random() * 2;')).toEqual(['calls Math.random']);
    expect(simRngUses("import { TAU, hash } from '../core';\n// R() and Math.random() named in a comment\nconst x = srnd();")).toEqual([]);
  });
});

describe('srnd stream', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never consumes Math.random, so render draws cannot move the seeded sim stream', () => {
    const spy = vi.spyOn(Math, 'random');
    for (let i = 0; i < 1000; i++) { srnd(); srr(-1, 1); sri(0, 9); spick([1, 2, 3]); }
    expect(spy).not.toHaveBeenCalled();
  });

  it('stays in range: srnd in [0, 1), srr in [a, b), sri inclusive of both ends, spick from the array', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const u = srnd(); expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThan(1);
      const r = srr(-3, 5); expect(r).toBeGreaterThanOrEqual(-3); expect(r).toBeLessThan(5);
      const n = sri(2, 4); expect(Number.isInteger(n)).toBe(true); seen.add(n);
      expect(['a', 'b']).toContain(spick(['a', 'b']));
    }
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
});
