import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spick, sri, srnd, srr } from '../../src/srnd';

// M2 #13 / LS1-B1: render and fx draw from srnd() (src/srnd.ts), never the sim RNG. The sim RNG is core's R and the
// helpers built on it (rr, ri, pick), and Math.random itself, which R is and which the harness seeds. A render-side
// draw from it makes the sim depend on the frame rate, the render path and the HELL FLASHES setting.
// tools/rng-probe.mjs is the runtime proof (each fight identical rendered / unrendered / flashes off).
const SIM_RNG = ['R', 'rr', 'ri', 'pick'];
const ROOTS = ['src/render', 'src/fx'];
// audio too: sfx args are evaluated even with no AudioContext, so an fx-timed sfx call drawing R() leaks fx into the sim.
// shipform: render's drawShip diffs the ship form every frame (trackForm) and sprouts/withers parts as particles, and its
// death shed reads that render-built diff, so it is presentation through and through (LS1-B1fix).
const EXTRA = ['src/audio.ts', 'src/shipform.ts'];
const root = new URL('../../', import.meta.url);

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

/** every way a source file can reach the sim RNG: a named import of R/rr/ri/pick from core, a namespace import
 *  of core, or a Math.random call */
function simRngUses(src: string): string[] {
  const s = stripComments(src), out: string[] = [];
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](?:\.{1,2}\/)+core(?:\.[jt]s)?['"]/g)) {
    for (const spec of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) if (SIM_RNG.includes(spec)) out.push(`imports ${spec} from core`);
  }
  if (/import\s*\*\s*as\s+\w+\s+from\s*['"](?:\.{1,2}\/)+core(?:\.[jt]s)?['"]/.test(s)) out.push('namespace import of core');
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
    expect(simRngUses("import { R } from '../core.js';")).toEqual(['imports R from core']);
    expect(simRngUses("import * as K from '../core';")).toEqual(['namespace import of core']);
    expect(simRngUses('const a = Math.random() * 2;')).toEqual(['calls Math.random']);
    expect(simRngUses("import { TAU, hash } from '../core';\n// R() and Math.random() named in a comment\nconst x = srnd();")).toEqual([]);
  });
});

const RNG_CALL = /(?<![\w.$])(?:R|rr|ri|pick)\s*\(|Math\s*\.\s*random\b/g;
const read = (f: string) => stripComments(readFileSync(new URL(f, root), 'utf8'));

/** the text of the block or statement starting at i: brace-matched if it opens with {, else up to the next ; */
function blockAt(s: string, i: number): string {
  while (/\s/.test(s[i])) i++;
  if (s[i] !== '{') { const j = s.indexOf(';', i); return s.slice(i, j < 0 ? s.length : j + 1); }
  for (let d = 0, j = i; j < s.length; j++) { if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) return s.slice(i, j + 1); }
  return s.slice(i);
}
/** body of a top-level function or arrow named `name` in a module source, or null */
function fnBody(src: string, name: string): string | null {
  let m = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?function\\s+${name}\\s*\\([^)]*\\)[^{]*`).exec(src);
  if (m) return blockAt(src, m.index + m[0].length);
  m = new RegExp(`(?:^|\\n|,)\\s*(?:export\\s+)?(?:const|let)?\\s*${name}\\s*=\\s*(?:\\((?!\\()[^)]*\\)|\\w+)\\s*=>\\s*`).exec(src);
  if (m) { const i = m.index + m[0].length; return src[i] === '{' ? blockAt(src, i) : src.slice(i, src.indexOf('\n', i)); }
  return null;
}
/** sim-RNG draws reachable from `name` in this module, following calls to its own functions (any depth) */
function reachDraws(src: string, name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return [];
  seen.add(name);
  const b = fnBody(src, name);
  if (b == null) return [];
  const out = [...b.matchAll(RNG_CALL)].map((m) => `${name}: ${m[0].replace(/\s*\($/, '()')}`);
  for (const [, callee] of b.matchAll(/(?<![\w.$])([A-Za-z_]\w*)\s*\(/g)) if (callee !== name) out.push(...reachDraws(src, callee, seen));
  return out;
}
const resolveMod = (from: string, spec: string) => {
  const parts = from.split('/').slice(0, -1);
  for (const seg of spec.split('/')) seg === '..' ? parts.pop() : seg !== '.' && parts.push(seg);
  const p = parts.join('/');
  return [p + '.ts', p + '/index.ts'].find((c) => { try { readFileSync(new URL(c, root)); return true; } catch { return false; } });
};
/** sim-RNG draws inside `if (v)` / `v &&` where v holds the result of an fx spawner that returns null at its cap */
function fxGatedDraws(src: string, nullable: string[]): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*(${nullable.join('|')})\\s*\\(`, 'g'))) {
    const v = m[1], rest = src.slice(m.index);
    for (const g of rest.matchAll(new RegExp(`if\\s*\\(\\s*${v}\\s*\\)|(?<![\\w.$])${v}\\s*&&`, 'g'))) {
      const b = g[0].startsWith('if') ? blockAt(rest, g.index + g[0].length) : rest.slice(g.index, rest.indexOf(';', g.index) + 1);
      for (const d of b.matchAll(RNG_CALL)) out.push(`${m[2]}() -> ${v}: ${d[0].replace(/\s*\($/, '()')}`);
    }
  }
  return out;
}

describe('code that render or fx calls outside src/render and src/fx', () => {
  it('draws no sim RNG in any function render or fx imports, nor in the same-module helpers those call', () => {
    const bad: string[] = [];
    for (const f of ROOTS.flatMap(tsFiles)) {
      for (const m of read(f).matchAll(/import\s*\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g)) {
        const t = resolveMod(f, m[2].replace(/\.[jt]s$/, ''));
        if (!t || ROOTS.some((r) => t.startsWith(r + '/')) || t === 'src/srnd.ts') continue;
        const tsrc = read(t);
        for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) for (const d of reachDraws(tsrc, n)) bad.push(`${f} -> ${t} ${d}`);
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('follows helper calls, so a render-called function that draws through a private helper is caught', () => {
    const mod = 'function fx(k) { spark(0, 0, rr(0, 1)); }\nexport function track(f) { if (f) fx(1); }\nexport const pure = (a) => a + 1;';
    expect(reachDraws(mod, 'track')).toEqual(['fx: rr()']);
    expect(reachDraws(mod, 'pure')).toEqual([]);
    expect(reachDraws('export const j = (a) => a * R();', 'j')).toEqual(['j: R()']);
    // a value built once by an IIFE at import (textures' DERE) is not a function render calls
    expect(reachDraws('export const D = (() => { return R(); })();', 'D')).toEqual([]);
  });
});

describe('sim draws never depend on fx state', () => {
  // an fx spawner that returns null at its pool cap (gib: 720) makes `if (g) g.x = R()` draw only while the pool has
  // room, and the pool's size follows srnd and render, so the sim stream would follow them too
  const nullable = ROOTS.flatMap(tsFiles).flatMap((f) => {
    const s = read(f);
    return [...s.matchAll(/export\s+function\s+(\w+)/g)].map((m) => m[1]).filter((n) => /return\s+null\b/.test(fnBody(s, n) || ''));
  });

  it('knows which fx spawners can return null (gib at its cap)', () => {
    expect(nullable).toContain('gib');
  });

  it('finds no sim RNG draw gated on a nullable fx spawner result anywhere in src', () => {
    const bad = tsFiles('src').filter((f) => !ROOTS.some((r) => f.startsWith(r + '/')))
      .flatMap((f) => fxGatedDraws(read(f), nullable).map((d) => `${f}: ${d}`));
    expect(bad).toEqual([]);
  });

  it('flags the gated forms and passes draws that do not depend on the result', () => {
    expect(fxGatedDraws('const g = gib(x, y);\nif (g) {\n  g.burning = ri(70, 150);\n}', ['gib'])).toEqual(['gib() -> g: ri()']);
    expect(fxGatedDraws('const g = gib(x, y);\nif (g) g.vr = rr(-1, 1);', ['gib'])).toEqual(['gib() -> g: rr()']);
    expect(fxGatedDraws('const g = gib(x, y); g && (g.c = pick(C));', ['gib'])).toEqual(['gib() -> g: pick()']);
    expect(fxGatedDraws('const b = ri(70, 150);\nconst g = gib(x, y);\nif (g) g.burning = b;', ['gib'])).toEqual([]);
    expect(fxGatedDraws('const g = gib(x, y);\nif (g) g.burning = sri(70, 150);', ['gib'])).toEqual([]);
  });
});

// $.G fields that only render reads (fx, render and sprouting ship parts write them): a sim draw that depends on one is
// a draw whose count render can change. step.ts's screen-shake jitter was the case (shake, set by shipform's sprout fx).
const PRES = ['shake', 'white', 'red', 'glitch', 'hell', 'flick', 'shx', 'shy'];
/** sim-RNG draws in a statement that reads a presentation-only $.G field, or a local computed from one */
function presGatedDraws(src: string): string[] {
  const field = `\\$\\.G\\.(?:${PRES.join('|')})\\b`, out: string[] = [];
  const locals = [...src.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=[^;]*${field}`, 'g'))].map((m) => m[1]);
  const reads = new RegExp([field, ...locals.map((l) => `(?<![\\w.$])${l}\\b`)].join('|'));
  for (const st of src.split(/[;{}]/)) {
    const rhs = st.replace(new RegExp(`^\\s*(?:if\\s*\\([^)]*\\)\\s*)?${field}\\s*=(?!=)`), ''); // a plain write is not a read
    const d = rhs.match(RNG_CALL);
    if (d && reads.test(rhs)) out.push(`${st.trim().slice(0, 60)} (${d[0].replace(/\s*\($/, '()')})`);
  }
  return out;
}

describe('sim draws never depend on presentation state', () => {
  it('finds no sim RNG draw that reads a render-only $.G field (shake, white, red, glitch, hell, flick)', () => {
    const bad = tsFiles('src').filter((f) => !ROOTS.some((r) => f.startsWith(r + '/')))
      .flatMap((f) => presGatedDraws(read(f)).map((d) => `${f}: ${d}`));
    expect(bad).toEqual([]);
  });

  it('flags a draw gated through a local and passes plain writes of the fields', () => {
    expect(presGatedDraws('const k = Math.min(9, $.G.shake);\n$.G.shx = k > .3 ? Math.round((R() * 2 - 1) * k) : 0;')).toHaveLength(1);
    expect(presGatedDraws('if ($.G.glitch > 3) e.y += rr(-1, 1);')).toHaveLength(1);
    expect(presGatedDraws('$.G.glitch = ri(2, 5);\n$.G.shake = Math.min(16, $.G.shake + 2.5);')).toEqual([]);
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
