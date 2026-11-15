// D53's APK gap: the LAB's FORCE MID row (lab.ts Lab.mid, midForce) and its JUMP TO MID (jump.ts midJump, menus.ts),
// the phone's way to fly a wip midboss without a query string. Off by default, so a fresh save (the harness, the
// probes) flies exactly what it did; a ?mid= query that names a wip kind wins over the row.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// menus.ts pulls in audio, input, flow and contraptions, which touch the canvas, DOM or audio at import time (backmenu.test.ts's set)
vi.mock('../../src/audio', () => ({ auInit: () => {}, sample: () => false, setMute: () => {}, voiceStopAll: () => {}, sfx: { menu: () => {}, deny: () => {}, power: () => {} } }));
vi.mock('../../src/input', () => ({ I: {}, PR: new Set() }));
vi.mock('../../src/platform', () => ({ NATIVE: false }));
const F = vi.hoisted(() => ({ jumps: [] as unknown[], games: 0, ok: true }));
vi.mock('../../src/flow', () => ({
  newGame: () => { F.games++; }, openPause: () => {}, openShop: () => {}, resumeLast: () => {}, resumedFrom: null, shopNext: 'title', startLoop: () => {},
  jumpRun: (j: unknown) => { F.jumps.push(j); return F.ok; },
}));
vi.mock('../../src/contraptions', () => ({ RIG: [], RIG_BY: {}, SOCKET_COST: [], rigInit: () => {}, rigged: () => [], sockets: () => 1 }));

const { $ } = await import('../../src/state');
const { SET } = await import('../../src/save');
const M = await import('../../src/menus');
const L = await import('../../src/lab');
const { midJump, parseJump, jumpBlob } = await import('../../src/jump');
const { beatPlan, layout, row, setLayout } = await import('../../src/layout');
const { runSealed, sealRun } = await import('../../src/runsave');
const { ROSTER } = await import('../../src/enemies/mid/roster');

const rows = () => M.titleItems().map((x: any) => x.l + (x.r ? ' = ' + x.r : ''));
const tap = (l: string) => { const it = M.titleItems(), i = it.findIndex((x: any) => x.l === l); expect(i, l).toBeGreaterThanOrEqual(0); it[i].a(); };

beforeEach(() => {
  vi.unstubAllGlobals();
  SET.asked = true;
  $.gate = false;
  $.state = 'title';
  $.menuSel = 0;
  $.meta = { bio: 0, lv: {} };
  if (M.titleSubOf()) M.doBack('closeSub');
  L.setLab({ ...L.LAB_DEFAULT });
  setLayout('long4');
  sealRun(false);
  F.jumps.length = 0; F.games = 0; F.ok = true;
});

describe('the stored FORCE MID value', () => {
  it('keeps only a wip kind: finished, unknown or malformed is off', () => {
    expect(L.labOf({ mid: 'keepsake' }).mid).toBe('keepsake');
    for (const v of ['cyst', 'nobody', 'keepsake junk', 7, null]) expect(L.labOf({ mid: v }).mid).toBe('');
  });
  it('cycles off, then every wip row in roster order', () => {
    expect(L.wipMids()).toEqual(['', ...ROSTER.filter((r) => r.wip).map((r) => r.k)]);
    expect(L.wipMids()).toContain('keepsake');
  });
});

describe('midForce precedence: ?mid=<wip kind> > the LAB row > null', () => {
  it('is null with the row off and no query (a fresh save flies unchanged)', () => {
    expect(L.lab().mid).toBe('');
    expect(L.midForce()).toBe(null);
  });
  it('flies the row with no query, the query over it, and ignores a query that names no wip kind', () => {
    L.setLab({ mid: 'keepsake' });
    expect(L.midForce()).toBe('keepsake');
    vi.stubGlobal('location', { search: '?mid=cyst' }); // finished: ignored, the row applies
    expect(L.midForce()).toBe('keepsake');
    L.setLab({ mid: '' });
    vi.stubGlobal('location', { search: '?mid=keepsake' });
    expect(L.midForce()).toBe('keepsake');
  });
});

describe('midJump: the dev URL jump, built without a URL', () => {
  it('is what ?stage=<first biome>&x=<slot A WARNING - 30>&kit=mid parses to, and its blob builds', () => {
    const j = midJump()!;
    expect(j).not.toBe(null);
    const r = row(j.stage)!;
    expect(r.kind).toBe('biome');
    expect(layout().stages.findIndex((x) => x.kind === 'biome')).toBe(j.stage);
    expect(j.x + r.x0 + 30).toBe(beatPlan(r, r.gateLate ?? r.x0, false).warns[0]);
    const p = parseJump(`?stage=${j.kind}&x=${j.x}&kit=mid`)!;
    expect('jump' in p && p.jump).toEqual(j);
    const b = jumpBlob(j, 1);
    expect(b.g.stage).toBe(j.stage);
    expect((b.g.route as string[])[r.slot!]).toBe(j.biome);
  });
  it('is null on short (no picker, so no slot A to force)', () => {
    setLayout('short');
    expect(midJump()).toBe(null);
  });
});

describe('the LAB rows', () => {
  it('with the row off: FORCE MID = OFF, no JUMP TO MID, the title LAB row unchanged', () => {
    expect(rows().at(-1)).toBe('LAB = LONG');
    tap('LAB');
    expect(rows()).toEqual(['LAYOUT = LONG', 'MIDBOSSES = OFF', 'CHECKPOINT = QUIT ONLY', 'FORCE MID = OFF', 'BACK']);
  });
  it('a tap forces the first wip kind, persists it, and offers the jump; cycling comes back to OFF', () => {
    tap('LAB');
    tap('FORCE MID');
    expect(L.lab().mid).toBe('keepsake');
    expect(rows()).toEqual(['LAYOUT = LONG', 'MIDBOSSES = OFF', 'CHECKPOINT = QUIT ONLY', 'FORCE MID = KEEPSAKE', 'JUMP TO MID = KEEPSAKE', 'BACK']);
    M.doBack('closeSub');
    expect(rows().at(-1)).toBe('LAB = LONG KEEPSAKE');
    tap('LAB');
    for (let i = 1; i < L.wipMids().length; i++) tap('FORCE MID');
    expect(L.lab().mid).toBe('');
    expect(rows().some((r) => r.startsWith('JUMP TO MID'))).toBe(false);
  });
  it('hides the jump on short and says the row is long-only there', () => {
    L.setLab({ layout: 'short', mid: 'keepsake' });
    tap('LAB');
    expect(rows()).toContain('FORCE MID = KEEPSAKE (LONG ONLY)');
    expect(rows().some((r) => r.startsWith('JUMP TO MID'))).toBe(false);
  });
  it('JUMP TO MID flies midJump sealed and lands back on the title root; the next DESCEND lifts that seal', () => {
    L.setLab({ mid: 'keepsake' });
    tap('LAB');
    tap('JUMP TO MID');
    expect(F.jumps).toEqual([midJump()]);
    expect(runSealed()).toBe(true);
    expect(M.titleSubOf()).toBe(null);
    tap('DESCEND');
    expect(F.games).toBe(1);
    expect(runSealed()).toBe(false);
  });
  it('a jump that does not start leaves the slot unsealed and the LAB open; a URL jump seal is never lifted', () => {
    L.setLab({ mid: 'keepsake' });
    tap('LAB');
    F.ok = false;
    tap('JUMP TO MID');
    expect(runSealed()).toBe(false);
    expect(M.titleSubOf()).toBe('lab');
    F.ok = true;
    sealRun(); // a ?stage= boot sealed the page
    tap('JUMP TO MID');
    tap('DESCEND');
    expect(runSealed()).toBe(true);
  });
});
