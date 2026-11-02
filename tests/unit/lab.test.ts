// LS1 sprint 2 item D2: the LAB row's storage and the layout choice (URL flag > LAB > short).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAB_DEFAULT, labOf, layoutChoice, urlLayout, type Lab } from '../../src/lab';

const LONG: Lab = { ...LAB_DEFAULT, layout: 'long' };

// lab.ts reads storage at import time, so each storage test stubs localStorage (and location) and imports a fresh copy
function storage(init: Record<string, string>, broken = false) {
  const m = new Map(Object.entries(init));
  const no = () => { throw new Error('SecurityError'); };
  return {
    getItem: broken ? no : (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: broken ? no : (k: string, v: string) => void m.set(k, String(v)),
    removeItem: broken ? no : (k: string) => void m.delete(k),
    map: m,
  };
}
async function load(init: Record<string, string>, search = '', broken = false) {
  const ls = storage(init, broken);
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('location', { search });
  vi.resetModules();
  return { ls, ...(await import('../../src/lab')) };
}

describe('layoutChoice: URL flag > LAB > short', () => {
  it('flies short with no flag and no LAB key', () => {
    expect(layoutChoice('', null)).toEqual({ layout: 'short', id: 'short', src: 'default' });
  });
  it('flies the LAB setting when the URL sets nothing', () => {
    expect(layoutChoice('?perf', LONG)).toEqual({ layout: 'long', id: 'long4', src: 'lab' });
  });
  it('lets a URL flag override the LAB both ways', () => {
    expect(layoutChoice('?layout=short', LONG)).toEqual({ layout: 'short', id: 'short', src: 'url' });
    expect(layoutChoice('?dk=2&layout=long', LAB_DEFAULT)).toEqual({ layout: 'long', id: 'long4', src: 'url' });
  });
  it('ignores an unknown ?layout= value and falls through to the LAB', () => {
    expect(urlLayout('?layout=long9')).toBeNull();
    expect(layoutChoice('?layout=long9', LONG).src).toBe('lab');
  });
  it('accepts the table id long4 as the flag value', () => {
    expect(urlLayout('?layout=long4')).toBe('long');
  });
});

describe('labOf', () => {
  it('fills defaults and drops unknown values', () => {
    expect(labOf(null)).toEqual(LAB_DEFAULT);
    expect(labOf({ layout: 'sideways', mids: 1, cp: 'z', extra: 5 })).toEqual(LAB_DEFAULT);
    expect(labOf({ layout: 'long', mids: 'wip', cp: 'b' })).toEqual({ layout: 'long', mids: 'wip', cp: 'b' });
  });
});

describe('LAB storage', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('defaults to short with no grodius.lab key (the harness fresh save)', async () => {
    const { activeLayout, lab, cpTrigger, midsWip } = await load({ 'grodius.v1': '{}' });
    expect(activeLayout().layout).toBe('short');
    expect(lab()).toEqual(LAB_DEFAULT);
    expect(cpTrigger()).toBe('a');
    expect(midsWip()).toBe(false);
  });

  it('persists a toggle under grodius.lab, outside the meta and run saves, and reads it back after a reload', async () => {
    const first = await load({ 'grodius.v1': '{"meta":{"v":3}}' });
    first.setLab({ layout: 'long', cp: 'b' });
    expect(JSON.parse(first.ls.map.get('grodius.lab')!)).toEqual({ layout: 'long', mids: '', cp: 'b' });
    expect(first.ls.map.get('grodius.v1')).toBe('{"meta":{"v":3}}');
    const again = await load(Object.fromEntries(first.ls.map));
    expect(again.activeLayout()).toEqual({ layout: 'long', id: 'long4', src: 'lab' });
    expect(again.cpTrigger()).toBe('b');
  });

  it('discards the checkpoint when the layout changes, and only then', async () => {
    const { ls, setLab } = await load({ 'grodius.run': '{"v":1}' });
    setLab({ cp: 'b' });
    expect(ls.map.has('grodius.run')).toBe(true);
    setLab({ layout: 'long' });
    expect(ls.map.has('grodius.run')).toBe(false);
  });

  it('shows the URL flag over the stored LAB', async () => {
    const { activeLayout, midsWip } = await load({ 'grodius.lab': '{"layout":"long"}' }, '?layout=short&mids=wip');
    expect(activeLayout()).toEqual({ layout: 'short', id: 'short', src: 'url' });
    expect(midsWip()).toBe(true);
  });

  it('boots and toggles with blocked storage (private window)', async () => {
    const { activeLayout, setLab } = await load({}, '', true);
    expect(activeLayout().layout).toBe('short');
    expect(() => setLab({ layout: 'long' })).not.toThrow();
    expect(activeLayout().layout).toBe('long'); // kept for the session, just not persisted
  });

  it('reads a corrupt grodius.lab as no LAB', async () => {
    const { activeLayout } = await load({ 'grodius.lab': '{not json' });
    expect(activeLayout().src).toBe('default');
  });
});

describe('applyRunLayout (stub until item D lands)', () => {
  it('keeps every run on short', async () => {
    const { applyRunLayout, setLab } = await load({});
    setLab({ layout: 'long' });
    expect(applyRunLayout()).toBe('short');
  });
});
