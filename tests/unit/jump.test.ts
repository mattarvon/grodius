import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JUMP, KITS, jumpBlob, jumpBoot, parseJump } from '../../src/jump';
import { LAYOUTS, setLayout } from '../../src/layout';
import { HOME, forkAllows } from '../../src/midpick';
import { RUN_KEY, RUN_V, clearRun, decodeRun, lastRun, readRun, rewriteRun, sealRun, storeRun } from '../../src/runsave';

const L = LAYOUTS.long4!;
const good = (q: string) => { const r = parseJump(q); if (!r || 'error' in r) throw new Error(`no jump from ${q}: ${JSON.stringify(r)}`); return r; };
const bad = (q: string) => { const r = parseJump(q); if (!r || !('error' in r)) throw new Error(`no error from ${q}`); return r.error; };

function storage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => (m.has(k) ? m.get(k)! : null), setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), map: m };
}

beforeEach(() => { setLayout('long4'); });
afterEach(() => { sealRun(false); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('parseJump', () => {
  it('returns null for a URL with no stage, so a normal URL boots as it always has', () => {
    expect(parseJump('')).toBeNull();
    expect(parseJump('?layout=short&x=200&loop=1&kit=full')).toBeNull();
  });

  it('reads every param of a full URL', () => {
    const { jump, warn } = good('?stage=drive&x=120.5&loop=2&kit=full&rank=.5&seed=7');
    expect(jump).toEqual({ kind: 'drive', stage: 3, biome: null, x: 120.5, loop: 2, kit: 'full', rank: .5, seed: 7 });
    expect(warn).toEqual([]);
  });

  it('defaults to the stage start of Descent 1 on a bare kit, with rank and seed free', () => {
    expect(good('?stage=orbit').jump).toEqual({ kind: 'orbit', stage: 0, biome: null, x: 0, loop: 0, kit: 'bare', rank: null, seed: null });
  });

  it('resolves a biome name, and the kind biome, to the first biome row', () => {
    expect(good('?stage=fire').jump).toMatchObject({ stage: 1, biome: 'fire' });
    expect(good('?stage=biome').jump).toMatchObject({ stage: 1, biome: Object.keys(HOME)[0] });
  });

  it('refuses a kind the layout has no row for, an inherited name and an empty value', () => {
    for (const k of ['nope', 'interior', 'toString', '__proto__', '']) expect(bad(`?stage=${k}`)).toContain('unknown stage kind');
  });

  it('takes x from 0 up to just short of the stage end encounter', () => {
    const span = L.stages[0].bossX - L.stages[0].x0;
    expect(good('?stage=orbit&x=0').jump.x).toBe(0);
    expect(good(`?stage=orbit&x=${span - 1}`).jump.x).toBe(span - 1);
  });

  it('refuses an x at or past the end encounter, which the rebuild would skip, and a negative or non-numeric one', () => {
    const span = L.stages[0].bossX - L.stages[0].x0;
    for (const x of [span, span + 1, -1, 'abc', '', '1e3', '0x10', 'Infinity']) expect(bad(`?stage=orbit&x=${x}`)).toContain('out of range');
  });

  it('clamps loop to the deepest descent and says so', () => {
    const { jump, warn } = good(`?stage=orbit&loop=${JUMP.maxLoop + 5}`);
    expect(jump.loop).toBe(JUMP.maxLoop);
    expect(warn).toHaveLength(1);
  });

  it('clamps rank to the cap every() reads and says so', () => {
    const { jump, warn } = good('?stage=orbit&rank=7');
    expect(jump.rank).toBe(JUMP.maxRank);
    expect(warn).toHaveLength(1);
  });

  it('refuses a negative or fractional loop, an unknown kit, a bad rank and a bad seed', () => {
    expect(bad('?stage=orbit&loop=-1')).toContain('?loop=');
    expect(bad('?stage=orbit&loop=1.5')).toContain('?loop=');
    expect(bad('?stage=orbit&kit=god')).toContain('?kit=');
    expect(bad('?stage=orbit&kit=constructor')).toContain('?kit=');
    expect(bad('?stage=orbit&rank=-1')).toContain('?rank=');
    expect(bad('?stage=orbit&rank=hi')).toContain('?rank=');
    expect(bad('?stage=orbit&seed=1.5')).toContain('?seed=');
  });

  it('bounds x by the active layout, not long4', () => {
    const q = `?stage=orbit&x=${LAYOUTS.short!.stages[0].bossX}`;
    expect(good(q).jump.stage).toBe(0);
    setLayout('short');
    expect(bad(q)).toContain('out of range');
  });
});

describe('jumpBlob', () => {
  const blob = (q: string) => jumpBlob(good(q).jump, 7);

  it('builds a checkpoint the run save accepts for every stage kind, kit and both layouts', () => {
    for (const id of ['long4', 'short']) {
      setLayout(id);
      for (const stage of ['orbit', 'drive', ...Object.keys(HOME)]) for (const kit of Object.keys(KITS)) {
        const b = blob(`?stage=${stage}&x=30&loop=2&kit=${kit}`);
        expect(b.v).toBe(RUN_V);
        expect(decodeRun(b), `${id} ${stage} ${kit}`).not.toBeNull();
      }
    }
  });

  it('places cpX at the row start plus x', () => {
    expect(blob('?stage=ice&x=500').g.cpX).toBe(L.stages[1].x0 + 500);
  });

  it('commits a biome stage at its gateLate with nothing past it', () => {
    const { g } = blob('?stage=fire');
    expect(g.route).toEqual(['fire', null]);
    expect(g.bx).toEqual([L.stages[1].gateLate, null, null]);
  });

  it('commits both slots and the hand-back for the Drive, on a route the fork could give', () => {
    const { g } = blob('?stage=drive');
    const route = g.route as string[];
    expect(route.every((b) => Object.hasOwn(HOME, b))).toBe(true);
    expect(route[0]).not.toBe(route[1]);
    expect(forkAllows(route[1], [route[0], null])).toBe(true);
    expect(g.bx).toEqual([L.stages[1].gateLate, L.stages[2].gateLate, L.tEnd[0]]);
    expect(g.visited).toEqual(route);
  });

  it('records the Saucer as met past Orbit but leaves Orbit to its own build', () => {
    expect(blob('?stage=ice').g).toMatchObject({ mb: { 0: ['ufo'] }, mbUsed: ['ufo'], mbLast: { orbit: ['ufo'] } });
    expect(blob('?stage=orbit').g.mb).toEqual({});
  });

  it('counts the stages before it as cleared, across descents', () => {
    expect(blob('?stage=drive&loop=2').g.cleared).toBe(2 * L.stages.length + 3);
  });

  it('carries the kit onto the ship and G', () => {
    const b = blob('?stage=orbit&kit=full');
    expect(b.p).toEqual(KITS.full.p);
    expect(b.g.lives).toBe(KITS.full.g.lives);
  });

  it('gives the same blob for the same URL and seed', () => {
    expect(blob('?stage=drive&x=40&kit=mid')).toEqual(blob('?stage=drive&x=40&kit=mid'));
  });
});

describe('jumpBoot', () => {
  it('logs a console error and returns null on a bad value, leaving the slot unsealed', () => {
    vi.stubGlobal('localStorage', storage());
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(jumpBoot('?stage=nope')).toBeNull();
    expect(err).toHaveBeenCalledOnce();
    expect(storeRun('{}')).toBe(true);
  });

  it('warns about a clamp and still jumps', () => {
    vi.stubGlobal('localStorage', storage());
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(jumpBoot('?stage=orbit&loop=99')).toMatchObject({ loop: JUMP.maxLoop });
    expect(warn).toHaveBeenCalledOnce();
  });

  it('does nothing at all on a normal URL', () => {
    const s = storage();
    vi.stubGlobal('localStorage', s);
    expect(jumpBoot('?layout=long')).toBeNull();
    expect(storeRun('{}')).toBe(true);
    clearRun();
  });
});

describe('the sealed run-save slot', () => {
  const saved = () => JSON.stringify({ v: RUN_V, g: { layout: 'long4', loop: 0, stage: 2, cpX: 9000, cpN: 1, seed: 3, bx: [4750, 8500, null], route: ['ice', 'fire'] }, p: {} });

  it('keeps an existing RESUME through every write and clear a jump run can reach', () => {
    const s = storage(), blob = saved();
    vi.stubGlobal('localStorage', s);
    s.setItem(RUN_KEY, blob);
    expect(jumpBoot('?stage=orbit')).not.toBeNull();
    expect(readRun()).not.toBeNull();

    expect(storeRun('{"other":1}')).toBe(false);
    expect(rewriteRun()).toBe(false);
    clearRun();

    expect(s.getItem(RUN_KEY)).toBe(blob);
    expect(lastRun()).toBe(blob);
  });

  it('writes nothing on a profile with no RESUME', () => {
    const s = storage();
    vi.stubGlobal('localStorage', s);
    jumpBoot('?stage=orbit');
    storeRun(saved());
    expect(s.map.size).toBe(0);
  });

  it('works normally again once unsealed', () => {
    const s = storage();
    vi.stubGlobal('localStorage', s);
    sealRun();
    sealRun(false);
    expect(storeRun(saved())).toBe(true);
    clearRun();
    expect(s.getItem(RUN_KEY)).toBeNull();
  });
});

// SUMMARY #12: main.ts gates the switch on import.meta.env.DEV (the build sets it false). main.ts touches the DOM at
// import, so this evaluates its gate line as written against the stubbed env: dropping or inverting the gate fails here.
// The dist side (the code shaken out of the bundle) is CI's "Jump switch absent" step
describe('the dev gate in main.ts', () => {
  const line = readFileSync(join(__dirname, '../../src/main.ts'), 'utf8').match(/^const jump = (.+);$/m);
  const gate = (env: { DEV: unknown }, boot: (s: string) => unknown) =>
    new Function('env', 'jumpBoot', 'location', `return ${line![1].replaceAll('import.meta.env', 'env')}`)(env, boot, { search: '?stage=drive&x=100&kit=full' });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('finds the gate line in main.ts', () => {
    expect(line?.[1]).toMatch(/import\.meta\.env\.DEV/);
  });

  it('never reads ?stage= when DEV is false, so a deployed page boots normally', () => {
    vi.stubEnv('DEV', false);
    const boot = vi.fn(() => ({ kind: 'drive' }));
    expect(gate(import.meta.env, boot)).toBeNull();
    expect(boot).not.toHaveBeenCalled();
  });

  it('hands the URL to jumpBoot on the dev server', () => {
    vi.stubEnv('DEV', true);
    const boot = vi.fn(() => ({ kind: 'drive' }));
    expect(gate(import.meta.env, boot)).toEqual({ kind: 'drive' });
    expect(boot).toHaveBeenCalledWith('?stage=drive&x=100&kit=full');
  });
});
