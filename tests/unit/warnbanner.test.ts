// Story type: Logic (source guard, merge-2 review). Gate: BLOCKING. Every WARNING banner passes `true` as its 5th
// argument, the flag that gates the warm-up on it (warmplan.ts): a WARNING without it lets the warm-up run into a fight
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../src/', import.meta.url).pathname;
const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.ts'));

describe("banner('WARNING', ...) callers", () => {
  const calls = files.flatMap((f) => [...readFileSync(join(root, f), 'utf8').matchAll(/banner\('WARNING',([^;\n]*)/g)].map((m) => ({ f, args: m[1] })));

  it('finds the known callers (spawn.ts miniWarn, scripts.ts Drive WARNING), so the guard is not vacuous', () => {
    expect(calls.map((c) => c.f).sort()).toEqual(expect.arrayContaining(['enemies/scripts.ts', 'enemies/spawn.ts']));
  });

  it.each(calls.map((c) => [c.f, c.args]))('%s passes true as the 5th argument', (_f, args) => {
    // args: everything after 'WARNING', up to the call's close: name, colour, duration, flag
    expect(args).toMatch(/^\s*[^,]+,\s*'[^']*',\s*\d+,\s*true\s*\)/);
  });
});
