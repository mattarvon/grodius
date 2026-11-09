import { afterEach, describe, it, expect, vi } from 'vitest';
// @ts-ignore: plain .mjs tool module, no types
import { resolveWant, harnessErrs, refuseUpdate, flakyFails, parseRuns, simState } from '../../tools/harness-rules.mjs';

describe('resolveWant', () => {
  it('returns null when the scenario wants nothing', () => {
    expect(resolveWant(undefined, 'choir+cyst')).toBeNull();
  });
  it('passes a named subject through', () => {
    expect(resolveWant('ufo', '')).toBe('ufo');
  });
  it('resolves slotB to the second entry of the pair', () => {
    expect(resolveWant('slotB', 'choir+cyst')).toBe('cyst');
  });
  it('returns null for slotB when the pair has fewer than two entries', () => {
    expect(resolveWant('slotB', '')).toBeNull();
    expect(resolveWant('slotB', 'ufo')).toBeNull();
    expect(resolveWant('slotB', 'choir+')).toBeNull();
    expect(resolveWant('slotB', undefined)).toBeNull();
  });
});

describe('refuseUpdate', () => {
  const ready = 'harness: game not ready after 15 s (boot, fonts or images)';
  const page = 'TypeError: x is undefined';
  it('records a clean run for every gate', () => {
    expect(refuseUpdate([], false)).toBeNull();
    expect(refuseUpdate([], true)).toBeNull();
  });
  it('refuses a short or long4 run with a harness failure', () => {
    expect(refuseUpdate([page, ready], false)).toBe(ready);
  });
  it('lets a short or long4 run record a page error with no harness failure', () => {
    expect(refuseUpdate([page], false)).toBeNull();
  });
  it('refuses a scenario run with any error', () => {
    expect(refuseUpdate([page], true)).toBe(page);
  });
  it('picks out only harness entries', () => {
    expect(harnessErrs([page, ready, 'harness: page reloaded 1x'])).toEqual([ready, 'harness: page reloaded 1x']);
  });
});

describe('flakyFails', () => {
  it('fails a flake by default', () => {
    expect(flakyFails({})).toBe(true);
  });
  it('fails a flake under CI even with the opt-out set', () => {
    expect(flakyFails({ CI: 'true', HARNESS_ALLOW_FLAKY: '1' })).toBe(true);
  });
  it('passes a flake locally with the opt-out set', () => {
    expect(flakyFails({ HARNESS_ALLOW_FLAKY: '1' })).toBe(false);
  });
});

describe('parseRuns', () => {
  it('reads an absent --runs as one run', () => {
    expect(parseRuns(null)).toBe(1);
  });
  it('takes an integer of 1 or more', () => {
    expect(parseRuns('1')).toBe(1);
    expect(parseRuns('5')).toBe(5);
  });
  it('refuses 0, a word, a fraction, a negative and an empty value, so a determinism proof never runs once quietly', () => {
    for (const v of ['0', 'abc', '2.5', '-3', '', '1e2']) expect(parseRuns(v)).toBeNull();
  });
});

describe('simState', () => {
  const page = (g: unknown) => { vi.stubGlobal('window', { __G: () => g }); };
  afterEach(() => { vi.unstubAllGlobals(); });
  it('reports no jump, instead of throwing, when a failed jump leaves G null on the title', () => {
    page({ G: null, P: null, enemies: [], drops: [], caps: [], state: 'title' });
    expect(simState()).toEqual({ jump: false });
  });
  it('reports the run and its sim signature when a jump started', () => {
    page({ G: { jump: true, stage: 1, mb: { 1: ['choir', 'cyst'] }, loop: 0, pow: .5, rank: .5, lvl: 6, kills: 3, t: 9, score: 100, scroll: 2400 }, P: { x: 1, y: 2, inv: 0, shield: 0 }, enemies: [], drops: [], caps: [] });
    const st = simState();
    expect(st).toMatchObject({ jump: true, stage: 1, pair: 'choir+cyst' });
    expect(typeof st.simSig).toBe('string');
  });
});
