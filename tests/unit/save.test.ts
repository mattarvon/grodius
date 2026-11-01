import { beforeEach, describe, expect, it, vi } from 'vitest';

// save.ts loads at import time, so each test stubs localStorage and imports a fresh copy
function storage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    map: m,
  };
}
async function load(init: Record<string, string>) {
  const ls = storage(init);
  vi.stubGlobal('localStorage', ls);
  vi.resetModules();
  const { $ } = await import('../../src/state');
  const mod = await import('../../src/save');
  return { ls, $, ...mod };
}
const good = (bio: number) => JSON.stringify({ meta: { bio, lv: {}, v: 2 }, hi: 0, asked: true });

describe('save loading', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('falls back to the backup when the main save is corrupt', async () => {
    const { $ } = await load({ 'grodius.v1': '{not json', 'grodius.v1.bak': good(777) });
    expect($.meta.bio).toBe(777);
  });

  it('keeps an unreadable save aside instead of writing defaults over it', async () => {
    const { ls, save } = await load({ 'grodius.v1': '{not json' });
    save();
    expect(ls.map.get('grodius.v1.corrupt')).toBe('{not json');
    expect(JSON.parse(ls.map.get('grodius.v1')!).meta.bio).toBe(0);
  });

  it('backs up the previous save on every write', async () => {
    const { ls, $, save } = await load({ 'grodius.v1': good(50) });
    $.meta.bio = 60;
    save();
    expect(JSON.parse(ls.map.get('grodius.v1.bak')!).meta.bio).toBe(50);
    expect(JSON.parse(ls.map.get('grodius.v1')!).meta.bio).toBe(60);
  });
});

describe('save export and import', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('round-trips the whole save through a code', async () => {
    const a = await load({ 'grodius.v1': good(1234) });
    const code = a.exportSave();
    const b = await load({ 'grodius.v1': good(1) });
    expect(b.importSave(code)).toBe(true);
    expect(JSON.parse(b.ls.map.get('grodius.v1')!).meta.bio).toBe(1234);
    expect(JSON.parse(b.ls.map.get('grodius.v1.bak')!).meta.bio).toBe(1);
  });

  it('rejects a code that is not a Grodius save and leaves the save alone', async () => {
    const { ls, importSave } = await load({ 'grodius.v1': good(5) });
    expect(importSave('hello')).toBe(false);
    expect(importSave(btoa('{"x":1}'))).toBe(false);
    expect(JSON.parse(ls.map.get('grodius.v1')!).meta.bio).toBe(5);
  });
});

// A v2 save exactly as snapshot() wrote it on main at f2f9c03 (key order, fields and best-grade keys as the game
// produces them): two descents of best grades under the old slot keys N-1..N-4, contraptions, a v1 refund note.
const V2_BLOB = JSON.stringify({
  meta: {
    bio: 2310,
    lv: { hull: 1, gland: 2, lure: 1, socket: 1 },
    best: { '1-1': 'A', '1-2': 'S', '1-3': 'B', '1-4': 'C', '2-1': 'B', '2-2': 'A', '2-3': 'C', '2-4': 'A' },
    rig: ['saw'],
    own: ['saw', 'gut'],
    cl: { saw: 2, gut: 1 },
    v: 2,
    refund: 420,
  },
  hi: 412300,
  flashes: true,
  asked: true,
  muted: false,
  music: true,
  meter: false,
});

describe('save v3', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('loads a real v2 save with Orbit and Drive best grades under kind keys and the biome-slot keys dropped', async () => {
    const { $ } = await load({ 'grodius.v1': V2_BLOB });
    expect($.meta.v).toBe(3);
    expect($.meta.best).toEqual({ '1-orbit': 'A', '1-drive': 'C', '2-orbit': 'B', '2-drive': 'A' });
    // nothing else in the save moves
    expect($.meta.bio).toBe(2310);
    expect($.meta.lv).toEqual({ hull: 1, gland: 2, lure: 1, socket: 1 });
    expect($.meta.own).toEqual(['saw', 'gut']);
    expect($.meta.rig).toEqual(['saw']);
    expect($.meta.cl).toEqual({ saw: 2, gut: 1 });
    expect($.hi).toBe(412300);
    expect($.meta.mb).toEqual({});
  });

  it('writes v3 with meta.mb, and does not migrate a v3 save a second time', async () => {
    const a = await load({ 'grodius.v1': V2_BLOB });
    a.$.meta.best['1-ice'] = 'S';
    a.$.meta.mb = { cyst: 2, brood: 1 };
    a.save();
    const written = a.ls.map.get('grodius.v1')!;
    expect(JSON.parse(written).meta.v).toBe(3);
    const b = await load({ 'grodius.v1': written });
    expect(b.$.meta.best).toEqual({ '1-orbit': 'A', '1-drive': 'C', '2-orbit': 'B', '2-drive': 'A', '1-ice': 'S' });
    expect(b.$.meta.mb).toEqual({ cyst: 2, brood: 1 });
  });

  it('migrates a v1 save through the v2 refund and on to v3', async () => {
    const v1 = JSON.stringify({ meta: { bio: 0, lv: { nerve: 1 }, best: { '1-1': 'S', '1-3': 'A' } }, hi: 5 });
    const { $ } = await load({ 'grodius.v1': v1 });
    expect($.meta.v).toBe(3);
    expect($.meta.bio).toBe(90); // the v2 refund still runs
    expect($.meta.best).toEqual({ '1-orbit': 'S' });
  });

  it('starts a fresh save at v3 with empty best grades and meta.mb', async () => {
    const { $ } = await load({});
    expect($.meta.v).toBe(3);
    expect($.meta.best).toEqual({});
    expect($.meta.mb).toEqual({});
  });

  it('cleans a malformed meta.mb instead of throwing', async () => {
    const blob = JSON.stringify({ meta: { bio: 1, lv: {}, v: 3, mb: { cyst: '3', brood: -1, maw: 'x', choir: 2.7 } } });
    const { $ } = await load({ 'grodius.v1': blob });
    expect($.meta.mb).toEqual({ cyst: 3, choir: 2 });
    const arr = await load({ 'grodius.v1': JSON.stringify({ meta: { bio: 1, lv: {}, v: 3, mb: [1, 2] } }) });
    expect(arr.$.meta.mb).toEqual({});
  });

  it('migrates a malformed best table to an empty one without throwing', async () => {
    const blob = JSON.stringify({ meta: { bio: 7, lv: {}, v: 2, best: { '1-1': 'Z', '1-4': 3, junk: 'A' } } });
    const { $ } = await load({ 'grodius.v1': blob });
    expect($.meta.bio).toBe(7);
    expect($.meta.best).toEqual({ junk: 'A' });
  });
});

describe('gradeKey and migrateBest', () => {
  it('keys best grades by stage kind with a 1-based loop part', async () => {
    const { $ } = await import('../../src/state');
    const { gradeKey } = await import('../../src/gradekey');
    const at = (loop: number, stage: number, route: (string | null)[] = [null, null]) => { $.G = { loop, stage, route }; return gradeKey(); };
    expect(at(0, 0)).toBe('1-orbit');
    expect(at(0, 1, ['ice', null])).toBe('1-ice');
    expect(at(0, 2, ['ice', 'acid'])).toBe('1-acid');
    expect(at(0, 3)).toBe('1-drive');
    expect(at(2, 3)).toBe('3-drive');
  });

  it('keeps the better grade when an old slot key and a kind key collide', async () => {
    const { migrateBest } = await import('../../src/gradekey');
    expect(migrateBest({ '1-1': 'B', '1-orbit': 'A' })).toEqual({ '1-orbit': 'A' });
    expect(migrateBest({ '1-orbit': 'C', '1-1': 'S' })).toEqual({ '1-orbit': 'S' });
    expect(migrateBest(null)).toEqual({});
    expect(migrateBest(['S'])).toEqual({});
  });
});
