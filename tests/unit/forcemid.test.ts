// D53's APK gap: the LAB's FORCE MID row (lab.ts Lab.mid, midForce) and its JUMP TO MID (jump.ts midJump, menus.ts),
// the phone's way to fly a wip midboss without a query string. Off by default, so a fresh save (the harness, the
// probes) flies exactly what it did; a ?mid= query that names a wip kind wins over the row. THE TESTWIP was its first
// kind; its row retired into the stage boss (D55), so the roster has no wip kind today and these tests fly a fixture
// one (`testwip`, mocked into the roster below). The LAB's JUMP TO BOSS (jump.ts bossJump) is tested here too.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// menus.ts pulls in audio, input, flow and contraptions, which touch the canvas, DOM or audio at import time (backmenu.test.ts's set)
vi.mock('../../src/audio', () => ({ auInit: () => {}, bankWant: () => {}, sample: () => false, setMute: () => {}, voiceStopAll: () => {}, sfx: { menu: () => {}, deny: () => {}, power: () => {} } }));
vi.mock('../../src/input', () => ({ I: {}, PR: new Set() }));
vi.mock('../../src/platform', () => ({ NATIVE: false }));
// a wip ship-pool row, so the FORCE MID machinery has a kind to force (the real roster has none since D55)
vi.mock('../../src/enemies/mid/roster', async (orig) => {
  const m: any = await orig();
  const ROSTER = [...m.ROSTER, { k: 'testwip', name: 'THE TEST', label: 'TESTWIP', tag: 'ANGLE', pool: 'ship', min: 1, wip: true }];
  return { ...m, ROSTER, midRow: (k: string) => ROSTER.find((r: any) => r.k === k) };
});
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
const { bossJump, midJump, parseJump, jumpBlob } = await import('../../src/jump');
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
    expect(L.labOf({ mid: 'testwip' }).mid).toBe('testwip');
    for (const v of ['cyst', 'nobody', 'testwip junk', 7, null]) expect(L.labOf({ mid: v }).mid).toBe('');
  });
  it('cycles off, then every wip row in roster order', () => {
    expect(L.wipMids()).toEqual(['', ...ROSTER.filter((r) => r.wip).map((r) => r.k)]);
    expect(L.wipMids()).toContain('testwip');
  });
});

describe('midForce precedence: ?mid=<wip kind> > the LAB row > null', () => {
  it('is null with the row off and no query (a fresh save flies unchanged)', () => {
    expect(L.lab().mid).toBe('');
    expect(L.midForce()).toBe(null);
  });
  it('flies the row with no query, the query over it, and ignores a query that names no wip kind', () => {
    L.setLab({ mid: 'testwip' });
    expect(L.midForce()).toBe('testwip');
    vi.stubGlobal('location', { search: '?mid=cyst' }); // finished: ignored, the row applies
    expect(L.midForce()).toBe('testwip');
    L.setLab({ mid: '' });
    vi.stubGlobal('location', { search: '?mid=testwip' });
    expect(L.midForce()).toBe('testwip');
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
    expect(rows()).toEqual(['LAYOUT = LONG', 'MIDBOSSES = OFF', 'CHECKPOINT = QUIT ONLY', 'DIFFICULTY = NORMAL', 'FORCE MID = OFF', 'JUMP TO BOSS = KEEPSAKE', 'BACK']);
  });
  it('a tap forces the first wip kind, persists it, and offers the jump; cycling comes back to OFF', () => {
    tap('LAB');
    tap('FORCE MID');
    expect(L.lab().mid).toBe('testwip');
    expect(rows()).toEqual(['LAYOUT = LONG', 'MIDBOSSES = OFF', 'CHECKPOINT = QUIT ONLY', 'DIFFICULTY = NORMAL', 'FORCE MID = TESTWIP', 'JUMP TO MID = TESTWIP', 'JUMP TO BOSS = KEEPSAKE', 'BACK']);
    M.doBack('closeSub');
    expect(rows().at(-1)).toBe('LAB = LONG TESTWIP');
    tap('LAB');
    for (let i = 1; i < L.wipMids().length; i++) tap('FORCE MID');
    expect(L.lab().mid).toBe('');
    expect(rows().some((r) => r.startsWith('JUMP TO MID'))).toBe(false);
  });
  it('hides the jump on short and says the row is long-only there', () => {
    L.setLab({ layout: 'short', mid: 'testwip' });
    tap('LAB');
    expect(rows()).toContain('FORCE MID = TESTWIP (LONG ONLY)');
    expect(rows().some((r) => r.startsWith('JUMP TO MID'))).toBe(false);
  });
  it('JUMP TO MID flies midJump sealed and lands back on the title root; the next DESCEND lifts that seal', () => {
    L.setLab({ mid: 'testwip' });
    tap('LAB');
    tap('JUMP TO MID');
    expect(F.jumps).toEqual([midJump()]);
    expect(runSealed()).toBe(true);
    expect(M.titleSubOf()).toBe(null);
    tap('DESCEND');
    expect(F.games).toBe(1);
    expect(runSealed()).toBe(false);
  });
  it('two JUMP TO MIDs in a row, then DESCEND: the real run is unsealed (studio review 2026-11-15)', () => {
    L.setLab({ mid: 'testwip' });
    tap('LAB');
    tap('JUMP TO MID');
    tap('LAB');
    tap('JUMP TO MID');
    expect(runSealed()).toBe(true);
    tap('DESCEND');
    expect(runSealed()).toBe(false);
  });
  it('a jump that does not start leaves the slot unsealed and the LAB open; a URL jump seal is never lifted', () => {
    L.setLab({ mid: 'testwip' });
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

describe('JUMP TO BOSS (D55): THE KEEPSAKE from the LAB', () => {
  it('is the URL ?stage=<biome>&slot=1&x=boss&kit=full, built without a URL, at the second biome stage in Descent 1', () => {
    const j = bossJump()!;
    const r = row(j.stage)!;
    expect(r.kind).toBe('biome');
    expect(r.slot).toBe(1);
    expect(j.loop).toBe(0);
    expect(j.kit).toBe('full');
    expect(j.x + r.x0).toBe(r.bossX - 180); // JUMP.bossLead: ~3 s before the WARNING
    const p = parseJump(`?stage=${j.kind}&slot=1&x=boss&kit=full`)!;
    expect('jump' in p && p.jump).toEqual(j);
    expect(jumpBlob(j, 1).g.stage).toBe(j.stage);
  });
  it('flies sealed from the LAB, like JUMP TO MID', () => {
    tap('LAB');
    tap('JUMP TO BOSS');
    expect(F.jumps).toEqual([bossJump()]);
    expect(runSealed()).toBe(true);
  });
  it('JUMP TO BOSS then DESCEND lifts the seal it set (the real run stores its checkpoint again)', () => {
    tap('LAB');
    tap('JUMP TO BOSS');
    expect(runSealed()).toBe(true);
    expect(M.titleSubOf()).toBe(null);
    tap('DESCEND');
    expect(F.games).toBe(1);
    expect(runSealed()).toBe(false);
  });
  it('starts the run and lifts the seal even when the DESCEND hook throws (the title doll snap on a lost canvas)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    M.onDescend(() => { throw new Error('getContext lost'); });
    try {
      tap('LAB');
      tap('JUMP TO BOSS');
      tap('DESCEND');
      expect(F.games).toBe(1);
      expect(runSealed()).toBe(false);
      expect(warn).toHaveBeenCalled();
    } finally { M.onDescend(() => {}); warn.mockRestore(); }
  });
  it('two JUMP TO BOSSes in a row, then DESCEND: the real run is unsealed', () => {
    tap('LAB');
    tap('JUMP TO BOSS');
    tap('LAB');
    tap('JUMP TO BOSS');
    expect(F.jumps).toEqual([bossJump(), bossJump()]);
    expect(runSealed()).toBe(true);
    tap('DESCEND');
    expect(runSealed()).toBe(false);
  });
  it('is not offered on short (THE KEEPSAKE is never placed there) and parses no slot past the layout', () => {
    expect(parseJump('?stage=ice&slot=7')).toHaveProperty('error');
    expect(parseJump('?stage=orbit&slot=1')).toHaveProperty('error');
    setLayout('short');
    expect(bossJump()).toBe(null);
    L.setLab({ layout: 'short' });
    tap('LAB');
    expect(rows().some((r) => r.startsWith('JUMP TO BOSS'))).toBe(false);
  });
});
