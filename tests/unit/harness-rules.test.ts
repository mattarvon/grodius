import { describe, it, expect } from 'vitest';
// @ts-ignore: plain .mjs tool module, no types
import { resolveWant, harnessErrs, refuseUpdate, flakyFails } from '../../tools/harness-rules.mjs';

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
