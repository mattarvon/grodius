// LS1 sprint 2 item D2: the LAB row's storage and the layout choice (URL flag > LAB > DEFAULT_LAYOUT, long4 since D24).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT, LAB_DEFAULT, labOf, layoutChoice, urlLayout, type Lab } from '../../src/lab';

const LONG: Lab = { ...LAB_DEFAULT, layout: 'long' };
const SHORT: Lab = { ...LAB_DEFAULT, layout: 'short' };

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

describe('layoutChoice: URL flag > LAB > default (long4)', () => {
  it('flies long4 with no flag and no LAB key (D24)', () => {
    expect(DEFAULT_LAYOUT).toBe('long4');
    expect(layoutChoice('', null)).toEqual({ id: 'long4', src: 'default' });
  });
  it('flies the LAB setting when the URL sets nothing', () => {
    expect(layoutChoice('?perf', LONG)).toEqual({ id: 'long4', src: 'lab' });
  });
  it('lets a URL flag override the LAB both ways', () => {
    expect(layoutChoice('?layout=short', LONG)).toEqual({ id: 'short', src: 'url' });
    expect(layoutChoice('?dk=2&layout=long', SHORT)).toEqual({ id: 'long4', src: 'url' });
  });
  it('accepts the table id long4 as the flag value', () => {
    expect(layoutChoice('?layout=long4', null)).toEqual({ id: 'long4', src: 'url' });
  });
  it('tries any other flag value as a registered entry id (item D)', () => {
    expect(layoutChoice('?layout=long5', null, (id) => id === 'long5')).toEqual({ id: 'long5', src: 'url' });
  });
  it('ignores an unknown flag value: the LAB applies, else the default, and the value is reported', () => {
    expect(layoutChoice('?layout=long9', LONG)).toEqual({ id: 'long4', src: 'lab', bad: 'long9' });
    expect(layoutChoice('?layout=long9', null)).toEqual({ id: 'long4', src: 'default', bad: 'long9' });
  });
  it('never resolves an inherited name such as constructor to an entry', () => {
    expect(layoutChoice('?layout=constructor', null)).toEqual({ id: 'long4', src: 'default', bad: 'constructor' });
    expect(urlLayout('?layout=__proto__')).toBe('__proto__');
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

  it('with no grodius.lab key the title shows the active entry and the LAB defaults (the harness fresh save)', async () => {
    const { activeLayout, lab, cpTrigger, midsWip } = await load({ 'grodius.v1': '{}' });
    expect(activeLayout()).toEqual({ id: 'short', src: 'default' });
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
    expect(again.activeLayout()).toEqual({ id: 'long4', src: 'lab' });
    expect(again.cpTrigger()).toBe('b');
  });

  it('discards the checkpoint when the layout changes, and only then', async () => {
    const { ls, setLab } = await load({ 'grodius.run': '{"v":1}' });
    setLab({ cp: 'b' });
    expect(ls.map.has('grodius.run')).toBe(true);
    setLab({ layout: 'short' });
    expect(ls.map.has('grodius.run')).toBe(false);
  });

  it('shows the URL flag over the stored LAB', async () => {
    const { activeLayout, midsWip } = await load({ 'grodius.lab': '{"layout":"long"}' }, '?layout=short&mids=wip');
    expect(activeLayout()).toEqual({ id: 'short', src: 'url' });
    expect(midsWip()).toBe(true);
  });

  it('boots and toggles with blocked storage (private window)', async () => {
    const { activeLayout, setLab } = await load({}, '', true);
    expect(activeLayout().id).toBe('short');
    expect(() => setLab({ layout: 'long' })).not.toThrow();
    expect(activeLayout().id).toBe('long4'); // kept for the session, just not persisted
  });

  it('reads a corrupt grodius.lab as no LAB', async () => {
    const { activeLayout } = await load({ 'grodius.lab': '{not json' });
    expect(activeLayout().src).toBe('default');
  });
});

describe('applyRunLayout', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('applies long4 when the LAB says long', async () => {
    const { applyRunLayout, setLab } = await load({});
    const L = await import('../../src/layout');
    setLab({ layout: 'long' });
    applyRunLayout();
    expect(L.layout().id).toBe('long4');
    setLab({ layout: 'short' });
    applyRunLayout();
    expect(L.layout().id).toBe('short');
  });

  it('lets the URL flag beat the LAB at run start', async () => {
    const { applyRunLayout } = await load({ 'grodius.lab': '{"layout":"long"}' }, '?layout=short');
    const L = await import('../../src/layout');
    L.setLayout('long4');
    applyRunLayout();
    expect(L.layout().id).toBe('short');
  });

  it('leaves the active entry alone with no flag and no LAB key (a probe set it in-page with --layout)', async () => {
    const { applyRunLayout, activeLayout } = await load({});
    const L = await import('../../src/layout');
    L.setLayout('long4');
    expect(applyRunLayout()).toEqual({ id: 'long4', src: 'default' });
    expect(L.layout().id).toBe('long4');
    expect(activeLayout().id).toBe('long4'); // the title shows what the run will fly
  });

  it('applies the default at boot, even over an entry already active', async () => {
    const { applyRunLayout } = await load({});
    const L = await import('../../src/layout');
    L.setLayout('short');
    expect(applyRunLayout(true)).toEqual({ id: 'long4', src: 'default' });
    expect(L.layout().id).toBe('long4');
  });
});
