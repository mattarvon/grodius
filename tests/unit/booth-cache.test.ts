// The booth's preview caches (tools/booth/cache.ts): the key a keep must match to be filed from its preview's render,
// the id it names it by, and the shelf's expiry, size cap and holds. Pure: no files, no ffmpeg, a fake clock.
import { describe, expect, it } from 'vitest';
import { PREVIEW_ID_RE, Shelf, fxKey, previewParam, renderKey, sameKey } from '../../tools/booth/cache';
import { FX_CHAIN, PRESETS, defaults } from '../../tools/booth/fx';
import { CACHE } from '../../tools/booth/plugin';

const ROBOT = PRESETS.find((p) => p.name === 'Robot')!.fx;
const SHA = 'a'.repeat(64) + '.webm';

describe('renderKey / sameKey', () => {
  const k = renderKey('hype10', SHA, true, ROBOT);
  it('binds the slot, the raw bytes, the squeeze, the rack and the FX chain', () => {
    expect(k).toEqual({ cat: 'hype10', sha: SHA, squeeze: true, fx: JSON.stringify(ROBOT), chain: FX_CHAIN, denoise: '' });
    expect(sameKey(k, renderKey('hype10', SHA, true, ROBOT))).toBe(true);
    expect(sameKey(k, renderKey('hype35', SHA, true, ROBOT))).toBe(false);
    expect(sameKey(k, renderKey('hype10', 'b'.repeat(64) + '.webm', true, ROBOT))).toBe(false);
    expect(sameKey(k, renderKey('hype10', 'a'.repeat(64) + '.ogg', true, ROBOT))).toBe(false);
    expect(sameKey(k, renderKey('hype10', SHA, false, ROBOT))).toBe(false);
    expect(sameKey(k, renderKey('hype10', SHA, true, {}))).toBe(false);
    expect(sameKey(k, renderKey('hype10', SHA, true, ROBOT, FX_CHAIN + 1))).toBe(false);
  });
  it('binds the denoise stage: a DFN render is never filed as an afftdn keep, nor one DFN version as another', () => {
    const d = renderKey('hype10', SHA, true, ROBOT, FX_CHAIN, 'dfn-0.5.6');
    expect(sameKey(d, renderKey('hype10', SHA, true, ROBOT, FX_CHAIN, 'dfn-0.5.6'))).toBe(true);
    expect(sameKey(d, renderKey('hype10', SHA, true, ROBOT, FX_CHAIN, 'afftdn'))).toBe(false);
    expect(sameKey(d, renderKey('hype10', SHA, true, ROBOT, FX_CHAIN, 'dfn-0.5.7'))).toBe(false);
    expect(sameKey(d, k)).toBe(false);
  });
  it('compares racks as cleanFx leaves them: knob order, junk keys and unsnapped values do not matter', () => {
    const shuffled = Object.fromEntries(Object.entries(ROBOT).reverse().map(([id, v]) => [id, Object.fromEntries(Object.entries(v).reverse())]));
    expect(sameKey(k, renderKey('hype10', SHA, true, { ...shuffled, nope: { x: 1 } } as never))).toBe(true);
    const a = { pitch: defaults('pitch') }, b = { pitch: { ...defaults('pitch'), semi: defaults('pitch').semi + 1 } };
    expect(fxKey(a)).not.toBe(fxKey(b));
  });
  it('a rack with no effect on is the clean take, as processTake and a keep treat it', () => {
    expect(fxKey(undefined)).toBe('');
    expect(fxKey(null)).toBe('');
    expect(fxKey({})).toBe('');
    expect(fxKey({ bogus: {} } as never)).toBe('');
    expect(sameKey(renderKey('hype10', SHA, true, undefined), renderKey('hype10', SHA, true, {}))).toBe(true);
  });
});

describe('previewParam', () => {
  const q = (s: string) => new URLSearchParams(s);
  it('takes a 24-hex-digit id and nothing else', () => {
    expect(previewParam(q('preview=0123456789abcdef01234567'))).toBe('0123456789abcdef01234567');
    for (const bad of ['', 'preview=', 'preview=xyz', 'preview=0123456789ABCDEF01234567', 'preview=0123456789abcdef0123456', 'preview=../../etc', 'preview=0123456789abcdef012345678'])
      expect(previewParam(q(bad))).toBeNull();
    expect(PREVIEW_ID_RE.test('f'.repeat(24))).toBe(true);
  });
});

describe('Shelf', () => {
  const make = (max = 3, ttl = 1000) => {
    let t = 0;
    const dropped: string[] = [];
    const s = new Shelf<string>({ max, ttl, drop: (v) => dropped.push(v), now: () => t });
    return { s, dropped, tick: (ms: number) => { t += ms; } };
  };
  it('hands back what it holds until it expires, then drops it', () => {
    const { s, dropped, tick } = make();
    s.put('a', 'A');
    tick(999);
    expect(s.get('a')).toBe('A'); // a use restarts its time
    tick(999);
    expect(s.get('a')).toBe('A');
    tick(1001);
    expect(s.get('a')).toBeUndefined();
    expect(dropped).toEqual(['A']);
    expect(s.size).toBe(0);
  });
  it('sweep drops every expired entry, and only those', () => {
    const { s, dropped, tick } = make();
    s.put('a', 'A');
    tick(600);
    s.put('b', 'B');
    tick(600);
    s.sweep();
    expect(dropped).toEqual(['A']);
    expect(s.get('b')).toBe('B');
  });
  it('past max, the least recently used goes first', () => {
    const { s, dropped } = make(2);
    s.put('a', 'A');
    s.put('b', 'B');
    s.get('a');
    s.put('c', 'C');
    expect(dropped).toEqual(['B']);
    expect([s.get('a'), s.get('b'), s.get('c')]).toEqual(['A', undefined, 'C']);
  });
  it('a put over a key drops the value it replaces', () => {
    const { s, dropped } = make();
    s.put('a', 'A1');
    s.put('a', 'A2');
    expect(dropped).toEqual(['A1']);
    expect(s.get('a')).toBe('A2');
  });
  it('take hands an entry over only when it matches: removed, not dropped; a mismatch leaves it in place', () => {
    const { s, dropped, tick } = make();
    s.put('a', 'A');
    expect(s.take('a', (v) => v === 'other')).toBeUndefined();
    expect(s.take('nope')).toBeUndefined();
    expect(s.take('a', (v) => v === 'A')).toBe('A');
    expect(s.get('a')).toBeUndefined();
    expect(dropped).toEqual([]); // the taker owns it now
    s.put('b', 'B');
    tick(1001);
    expect(s.take('b')).toBeUndefined(); // expired: never handed out
    expect(dropped).toEqual(['B']);
  });
  it('a held entry is never dropped, past its time or the cap, until it is released', () => {
    const { s, dropped, tick } = make(1);
    s.put('a', 'A');
    s.hold('a');
    s.put('b', 'B'); // over the cap: a is held, so it stays
    expect(dropped).toEqual([]);
    tick(5000);
    s.sweep();
    expect(s.get('a')).toBe('A');
    expect(s.take('a')).toBeUndefined(); // nor taken while a render reads it
    s.release('a'); // its time restarts; b is the older now, and expired
    expect(dropped).toEqual(['B']);
    tick(1001);
    s.sweep();
    expect(dropped).toEqual(['B', 'A']);
  });
  it('forget removes without dropping (a failed render), only the value it names', () => {
    const { s, dropped } = make();
    s.put('a', 'A');
    s.forget('a', 'other');
    expect(s.get('a')).toBe('A');
    s.forget('a', 'A');
    expect(s.get('a')).toBeUndefined();
    expect(dropped).toEqual([]);
  });
  it('clear drops everything, held or not', () => {
    const { s, dropped } = make();
    s.put('a', 'A');
    s.put('b', 'B');
    s.hold('b');
    s.clear();
    expect(dropped.sort()).toEqual(['A', 'B']);
    expect(s.size).toBe(0);
  });
  it("the plugin's caches: ten minutes, a few takes' worth", () => {
    expect(CACHE.ttl).toBe(600_000);
    expect(CACHE.renders).toBeGreaterThanOrEqual(2); // a preview's A and B at least
    expect(CACHE.preps).toBeGreaterThanOrEqual(2);
  });
});
