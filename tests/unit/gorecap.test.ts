// decision 32 (r4-perf): the phone profile's gore-density cap (src/fx/gorecap.ts). FULL must be the old caps exactly (the
// desktop, the harness and parity never change); the mode rule: ?gore= wins, then the setting, then auto (app / touch).
import { describe, expect, it } from 'vitest';
import { GORE_CAPS, autoLite, gibCount, goreLite, setGoreMode, urlGore } from '../../src/fx/gorecap';

describe('gore density', () => {
  it('FULL keeps the long-standing fx/spawn.ts caps', () => {
    expect(GORE_CAPS.full).toMatchObject({ drops: 4800, gibs: 720, sparks: 500, mists: 340, decals: 1800, flashes: 140 });
    expect(GORE_CAPS.full.ropes).toBe(Infinity);
    expect(GORE_CAPS.full.eyes).toBe(Infinity);
  });
  it('LITE is below FULL on every cap', () => {
    for (const k of Object.keys(GORE_CAPS.lite) as (keyof typeof GORE_CAPS.lite)[]) expect(GORE_CAPS.lite[k]).toBeLessThan(GORE_CAPS.full[k]);
  });
  it('auto is LITE on the app or a coarse pointer, FULL on a desktop', () => {
    expect(autoLite(false, false)).toBe(false);
    expect(autoLite(true, false)).toBe(true);
    expect(autoLite(false, true)).toBe(true);
  });
  it('reads ?gore= and ignores anything else', () => {
    expect(urlGore('?layout=long4&gore=lite')).toBe('lite');
    expect(urlGore('?gore=full')).toBe('full');
    expect(urlGore('?gore=max')).toBeNull();
    expect(urlGore('')).toBeNull();
  });
  it('the setting decides when there is no URL override (the test host has no touch: auto is FULL)', () => {
    setGoreMode('auto'); expect(goreLite()).toBe(false);
    setGoreMode('lite'); expect(goreLite()).toBe(true);
    setGoreMode('full'); expect(goreLite()).toBe(false);
    setGoreMode('auto');
  });
  it('counts gibs of a kind', () => expect(gibCount([{ k: 'rope' }, { k: 'eye' }, { k: 'rope' }], 'rope')).toBe(2));
});
