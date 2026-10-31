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
