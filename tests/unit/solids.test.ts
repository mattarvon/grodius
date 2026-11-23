// SOLIDS engine (src/solids.ts; DIFFICULTY-SPEC §2.4, levels.md §2.1 / §5.1 / §5.4 / §6.3, Matt's decision 5): hit tests
// on slab edges, the class masks, shots (tink / chip / break), the MORGUE RUSH wedge and its lodge rule, the plug's
// regrowth and its S5 clearances, the piston's S2 speed and hold-back, body contact, and the checkpoint rules: the
// engine resets itself on a new run or terrain, and a snapshot or a replay from the same beats is byte-identical.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const world = vi.hoisted(() => ({ CEIL: new Float32Array(0), FLOOR: new Float32Array(0) }));
vi.mock('../../src/core', () => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const hash = (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  return { PH: 254, W: 480, TS: 4, hash, vnoise, lerp };
});
vi.mock('../../src/world', () => {
  const at = (A: Float32Array, wx: number) => { const f = wx / 4, i = Math.floor(f); if (i < 0) return A[0]; if (i >= A.length - 1) return A[A.length - 1]; return A[i] + (A[i + 1] - A[i]) * (f - i); };
  return { get CEIL() { return world.CEIL; }, get FLOOR() { return world.FLOOR; }, ceilAt: (x: number) => at(world.CEIL, x), floorAt: (x: number) => at(world.FLOOR, x) };
});
const S = await import('../../src/solids');
const { SC, SOLID, solids, solidAt, solidsCol, shotSolid, eshotSolid, freeSpan, stepSolids, resetSolids, spawnIce, spawnPlug, spawnPiston, spawnPistonPair, spawnSlab, armTide, armSwallow, dynAt, engineWindows, solidsSnap, solidsLoad, SOLID_FX, pistonPeriod, solidShot } = S;

const N = 3000;
/** a flat corridor: ceiling ce, floor fl */
function terrain(ce = 60, fl = 200) {
  world.CEIL = new Float32Array(N).fill(ce);
  world.FLOOR = new Float32Array(N).fill(fl);
}
function run(scroll = 0) {
  terrain();
  $.G = { t: 0, scroll, scrollSpeed: 1 };
  $.P = { x: 60, y: 130, alive: true };
  resetSolids();
}
/** one game frame as step.ts runs it: t and scroll advance, then the engine */
function frame(n = 1) {
  let hit = false;
  for (let i = 0; i < n; i++) { $.G.t++; $.G.scroll += $.G.scrollSpeed; hit = stepSolids() || hit; }
  return hit;
}
const sx = (s: { x: number }) => s.x - $.G.scroll;

beforeEach(() => run());

describe('hit tests and masks', () => {
  it('a slab is solid on its edges and not a hair outside, in world x', () => {
    const s = spawnSlab({ x: 400, y: 100, w: 20, h: 10 })!;
    expect(s.cls).toBe(SC.HARD);
    expect(solidAt(400, 100)).toBe(true); expect(solidAt(420, 110)).toBe(true); expect(solidAt(410, 105)).toBe(true);
    expect(solidAt(399.9, 105)).toBe(false); expect(solidAt(420.1, 105)).toBe(false);
    expect(solidAt(410, 99.9)).toBe(false); expect(solidAt(410, 110.1)).toBe(false);
    frame(); // bucketed queries after a step agree with the scan
    expect(solidAt(400 , 105)).toBe(true); expect(solidAt(421, 105)).toBe(false);
  });
  it('solidsCol returns [y0, y1] by mask; a flying block is a body, not terrain', () => {
    spawnSlab({ x: 400, y: 100, w: 20, h: 10 });
    expect(solidsCol(410)).toEqual([[100, 110]]);
    expect(solidsCol(430)).toEqual([]);
    const b = spawnSlab({ x: 500, y: 40, w: 10, h: 10 })!;
    b.cls = SC.BODY;
    expect(solidsCol(505)).toEqual([]);
    expect(solidsCol(505, SC.ALL)).toEqual([[40, 50]]);
    expect(solidAt(505, 45)).toBe(false); // the terrain-class query (player.ts:371) ignores a body
    expect(eshotSolid(505, 45)).toBe(true); // an enemy shot dies on anything
  });
  it('freeSpan is the swept fit gap with solids as terrain', () => {
    expect(freeSpan(1000)).toBe(140);
    spawnSlab({ x: 995, y: 60, w: 10, h: 30 }); // a 30 px shelf off the ceiling, inside the footprint run
    expect(freeSpan(1000)).toBe(110);
    expect(freeSpan(1020)).toBe(140); // footprint [1011, 1032] misses it
    spawnSlab({ x: 1000, y: 120, w: 4, h: 10 }); // a block mid-gap: the largest open interval wins
    expect(freeSpan(1000)).toBe(70);
  });
  it('an empty engine answers false / [] at once (short never spawns one)', () => {
    expect(solidAt(100, 100)).toBe(false);
    expect(solidsCol(100)).toEqual([]);
    expect(shotSolid(100, 100, 1)).toBe(0);
    expect(stepSolids()).toBe(false);
  });
});

describe('shots', () => {
  it('tinks off an unshootable slab, chips and breaks a shootable one by damage', () => {
    spawnSlab({ x: 400, y: 100, w: 20, h: 10 });
    expect(shotSolid(410, 105, 5)).toBe(1);
    const s = spawnSlab({ x: 600, y: 100, w: 20, h: 10, hp: 2, shoot: true })!;
    expect(s.cls).toBe(SC.LODGE);
    expect(shotSolid(610, 105, 1)).toBe(2);
    expect(shotSolid(610, 105, 1)).toBe(3);
    expect(s.st).toBe('dead');
    expect(solidAt(610, 105)).toBe(false);
    expect(SOLID_FX.map((e) => e.k)).toEqual(['tink', 'chip', 'shatter']);
  });
});

describe('MORGUE RUSH ice blocks (levels.md §5.1)', () => {
  it('tell (not solid) -> fly (body) -> turn -> lodged in the nearer wall (terrain)', () => {
    $.P.y = 180; // near the floor: the block lodges on the floor
    const b = spawnIce({ fit: 88 })!;
    expect(b.st).toBe('tell'); expect(b.cls).toBe(0);
    expect(sx(b)).toBeGreaterThanOrEqual(480 + SOLID.ice.enterX);
    expect(b.y + b.h).toBeLessThanOrEqual(200 - SOLID.ice.inset); // lane kept inside the wall
    const x0 = sx(b);
    frame(SOLID.ice.tell - 1);
    expect(sx(b)).toBeCloseTo(x0, 6); // the tell pins it to the screen edge
    frame(2);
    expect(b.st).toBe('fly'); expect(b.cls).toBe(SC.BODY);
    let n = 0;
    while (b.st !== 'lodged' && n++ < 400) frame();
    expect(b.st).toBe('lodged'); expect(b.cls).toBe(SC.LODGE);
    expect(b.side).toBe(1);
    expect(b.y + b.h).toBeCloseTo(200, 6);
    expect(sx(b)).toBeLessThanOrEqual(Math.max($.P.x + SOLID.ice.stopAhead, SOLID.ice.stopMin) + 1);
    const wx = b.x + 5;
    expect(solidAt(wx, 195)).toBe(true); // lodged: kills like a wall (decision 5)
    const L = b.x;
    frame(10);
    expect(b.x).toBe(L); // wedged: still in the world, it scrolls with the terrain
  });
  it('stacks on a block already lodged there', () => {
    $.P.y = 180; $.P.x = 10;
    const a = spawnIce({ fit: 72 })!, b = spawnIce({ fit: 72 })!;
    Object.assign(a, { st: 'lodged', cls: SC.LODGE, side: 1, x: 1000, y: 200 - 14 }); // wedged on the floor at 1000
    Object.assign(b, { st: 'turn', cls: SC.BODY, side: 1, x: 1006, y: 100 }); // turning into the same column
    let n = 0; while (b.st !== 'lodged' && b.st !== 'dead' && n++ < 200) frame();
    expect(b.st).toBe('lodged');
    expect(b.y + b.h).toBeCloseTo(a.y, 6);
    expect(solidsCol(1010).length).toBe(2);
  });
  it('shatters instead of lodging when that would leave the fit gap under the window floor', () => {
    terrain(60, 160); // gap 100: one 14 px block leaves 86 < 88
    $.P.y = 150;
    const b = spawnIce({ fit: 88 })!;
    let n = 0; while (b.st !== 'dead' && b.st !== 'lodged' && n++ < 500) frame();
    expect(b.st).toBe('dead');
    expect(SOLID_FX.some((e) => e.k === 'shatter')).toBe(true);
  });
  it('a flying block hits the ship as a body (stepSolids true: playerHit, WARD absorbs) and shatters', () => {
    $.P.x = 300; $.P.y = 130;
    const b = spawnIce({ lane: 130, xStop: 100 })!;
    let hit = false, n = 0;
    while (!hit && n++ < 400) hit = frame();
    expect(hit).toBe(true);
    expect(b.st).toBe('dead');
  });
  it('two bolts break a block (S6)', () => {
    $.P.y = 130;
    const b = spawnIce({})!;
    frame(SOLID.ice.tell + 2);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    expect(shotSolid(cx, cy, 1)).toBe(2);
    expect(shotSolid(cx, cy, 1)).toBe(3);
  });
  it('never enters within 48 px of the ship (S5), even with the ship at the right edge', () => {
    $.P.x = 464; $.P.y = 130;
    const b = spawnIce({})!;
    const d = Math.hypot(sx(b) + b.w / 2 - $.P.x, b.y + b.h / 2 - $.P.y);
    expect(d).toBeGreaterThanOrEqual(SOLID.noSpawn);
  });
});

describe('MUCUS PLUG (levels.md §5.4)', () => {
  it('a column spans the relaxed walls, grows over its tell (not solid), then plugs', () => {
    const cells = spawnPlug({ wx: 900 });
    expect(cells.length).toBe(Math.ceil((200 - 60 + 2 * SOLID.plug.cell) / SOLID.plug.cell));
    expect(solidAt(900, 130)).toBe(false);
    frame(SOLID.plug.tell + 1);
    expect(solidAt(900, 130)).toBe(true);
    expect(cells.every((c) => c.cls === SC.PLUG)).toBe(true);
    expect(freeSpan(900, undefined, undefined, SC.TERRAIN)).toBe(0); // shut: it must be shot
    expect(freeSpan(900)).toBe(140); // the fit mask (route-probe L5) reads a plug as a barrier to cut
  });
  it('a cut cell opens, regrows 150 f later, and waits while the ship is within 24 px', () => {
    const cells = spawnPlug({ wx: 900 });
    frame(SOLID.plug.tell + 1);
    const c = cells.find((q) => q.y <= 130 && q.y + q.h >= 130)!;
    expect(shotSolid(900, c.y + 5, 1)).toBe(3);
    expect(c.st).toBe('cut'); expect(solidAt(900, c.y + 5)).toBe(false);
    // park the ship inside the hole (screen x of world 900 when the regrow comes due)
    frame(SOLID.plug.regrow - 1);
    $.P.x = 900 - $.G.scroll; $.P.y = c.y + 5; $.G.scrollSpeed = 0;
    frame(5);
    expect(c.st).toBe('cut'); // S5: no regrowth on the ship
    $.P.y = c.y + 5 + 60;
    frame(1);
    expect(c.st).toBe('grow');
    $.P.y = c.y + 5; // back into the hole while it grows: it never sets on the ship
    frame(SOLID.plug.tell + 5);
    expect(c.st).toBe('grow');
    $.P.y = 10;
    frame(1);
    expect(c.st).toBe('live');
  });
  it('cells within 48 px of the ship are not made (S5)', () => {
    $.P.x = 100; $.P.y = 130;
    const cells = spawnPlug({ wx: 120 });
    for (const c of cells) expect(Math.hypot(c.x + 5 - $.P.x, c.y + 5 - $.P.y)).toBeGreaterThanOrEqual(SOLID.noSpawn);
    expect(cells.length).toBeGreaterThan(0);
  });
  it('under a live swallow window it spans the relaxed (base) walls', () => {
    armSwallow({ x0: 800, x1: 1280, S: 18, T: 200, dur: 800, fit: 72 });
    frame(44 + 100); // fully clenched
    const cells = spawnPlug({ wx: 1040 });
    expect(cells[0].y).toBeLessThanOrEqual(60 - SOLID.plug.cell + 1e-6);
    expect(cells[cells.length - 1].y + 10).toBeGreaterThanOrEqual(200 + SOLID.plug.cell - 1e-6 - 10);
  });
});

describe('THE STROKE pistons (levels.md §6.3)', () => {
  it('extends to its reach and back at <= .5 px/f (S2), tells first, HARD all the way', () => {
    const p = spawnPiston({ x: 900, side: -1, reach: 110 })!;
    expect(p.cls).toBe(SC.HARD);
    let prev = p.tip!, vmax = 0, deepest = p.tip!, sawTell = false;
    const C = pistonPeriod(p);
    $.P.x = 10;
    for (let i = 0; i < 2 * C; i++) { frame(); vmax = Math.max(vmax, Math.abs(p.tip! - prev)); prev = p.tip!; deepest = Math.max(deepest, p.tip!); sawTell ||= p.st === 'tell'; }
    expect(vmax).toBeLessThanOrEqual(SOLID.vMax + 1e-9);
    expect(deepest).toBeCloseTo(110, 6);
    expect(sawTell).toBe(true);
    expect(SOLID_FX.some((e) => e.k === 'hiss')).toBe(true);
  });
  it('a retracted piston sits inside its wall; the box covers the wall side', () => {
    const p = spawnPiston({ x: 900, side: 1, reach: 150 })!;
    expect(p.tip).toBeGreaterThanOrEqual(200);
    expect(solidAt(910, 199)).toBe(false);
    expect(solidAt(910, 240)).toBe(true);
  });
  it('the reach keeps the fit floor to the far wall, and a pair keeps its gap', () => {
    const p = spawnPiston({ x: 900, side: 1, reach: 70 })!; // would leave 10 px: clamped to ceiling + 72
    expect(p.reach).toBe(60 + SOLID.minFit);
    const [a, b] = spawnPistonPair({ x: 1200, centre: 130, gap: 80 })!;
    expect(b!.reach! - a!.reach!).toBe(80);
    expect(a!.grp).toBe(b!.grp);
  });
  it('holds back a cycle when the ship is at its x as the tell would start', () => {
    $.G.scrollSpeed = 0;
    const p = spawnPiston({ x: 300, side: -1, reach: 100, phase: 0 })!;
    $.P.x = 300 + 15 - $.G.scroll; $.P.y = 180; // under the piston, clear of its spawn box
    const C = p.rest! + 2 * p.ext! + p.hold!;
    let moved = false;
    for (let i = 0; i < C - 2; i++) { frame(); moved ||= p.tip! > p.root! + .01; }
    expect(moved).toBe(false);
    $.P.x = 10;
    for (let i = 0; i < C + 2; i++) { frame(); moved ||= p.tip! > p.root! + .01; }
    expect(moved).toBe(true);
  });
  it('the piston crushes like a wall: its extended tip is terrain class at the ship', () => {
    const p = spawnPiston({ x: 900, side: -1, reach: 120, phase: 0 })!;
    $.P.x = 10;
    while (p.st !== 'hold') frame();
    expect(solidAt(p.x + 15, 119)).toBe(true);
    expect(solidAt(p.x + 15, 121)).toBe(false);
  });
});

describe('DYN through the engine', () => {
  it('armTide moves the world arrays and puts its window in engineWindows', () => {
    const w = armTide({ x0: 800, x1: 1800, d: 40, rise: 90, hold: 180, drain: 90, fit: 100 })!;
    expect(w).not.toBeNull();
    expect(engineWindows()).toContainEqual({ x0: 800, x1: 1800, floor: 100, id: 'high_tide' });
    frame(60 + 90 + 5);
    expect(world.FLOOR[325]).toBeCloseTo(160, 4);
    expect(dynAt(1300)!.k).toBeCloseTo(1, 4);
  });
  it('a tide over the fit floor stops short at it; the far wall never moves', () => {
    armTide({ x0: 800, x1: 1800, d: 40, rise: 90, hold: 180, drain: 90, fit: 110 });
    frame(60 + 90 + 5);
    expect(world.FLOOR[325] - world.CEIL[325]).toBeCloseTo(110, 4);
    expect(world.CEIL[325]).toBe(60);
  });
});

describe('checkpoint restore and determinism', () => {
  /** a fixed beat list as W3b / W3c would arm it, by frame */
  const BEATS: [number, () => void][] = [
    [5, () => spawnIce({ fit: 88 })],
    [20, () => spawnPiston({ x: 1200, side: -1, reach: 110, phase: 30 })],
    [40, () => spawnIce({ lane: 80, fit: 88 })],
    [60, () => spawnPlug({ wx: 1500 })],
    [70, () => armSwallow({ x0: 1700, x1: 2180, S: 18, T: 200, dur: 600 })],
  ];
  function fly(n: number, shoot = true) {
    for (let f = 0; f < n; f++) {
      for (const [t, b] of BEATS) if ($.G.t === t) b();
      frame();
      $.P.y = 100 + 40 * Math.sin($.G.t / 30); // a weaving ship, pure in t
      if (shoot && $.G.t % 17 === 0) for (const s of solids) if (s.shoot && s.cls) { shotSolid(s.x + 1, s.y + 1, 1); break; }
    }
  }
  const state = () => JSON.stringify({ s: solids.map((q) => ({ ...q, t: q.t })), C: Array.from(world.CEIL.slice(400, 600)), F: Array.from(world.FLOOR.slice(400, 600)) });
  it('a replay from a reset with the same beats is byte-identical', () => {
    run(); fly(600); const A = state();
    run(); fly(600); expect(state()).toBe(A);
  });
  it('a snapshot loaded into a fresh run continues byte-identically', () => {
    run(); fly(250);
    const snap = JSON.parse(JSON.stringify(solidsSnap())), G = { ...$.G }, P = { ...$.P };
    fly(350); const A = state();
    terrain(); $.G = { ...G }; $.P = { ...P }; resetSolids(); // the restore: a new run object, a rebuilt terrain
    solidsLoad(snap);
    for (let f = 0; f < 350; f++) { // the same tail (beats all fired before frame 250)
      frame(); $.P.y = 100 + 40 * Math.sin($.G.t / 30);
      if ($.G.t % 17 === 0) for (const s of solids) if (s.shoot && s.cls) { shotSolid(s.x + 1, s.y + 1, 1); break; }
    }
    expect(state()).toBe(A);
  });
  it('a new run object (resumeRun) or a rebuilt terrain (startLoop) clears every solid and window', () => {
    run(); fly(200); // the swallow armed at 70 is clenching by now
    expect(solids.length).toBeGreaterThan(0);
    const F0 = Float32Array.from({ length: N }, () => 200);
    expect(Array.from(world.FLOOR.slice(425, 545))).not.toEqual(Array.from(F0.slice(425, 545))); // the swallow is clenching
    $.G = { t: 0, scroll: 0, scrollSpeed: 1 }; // resumeRun: baseG()
    expect(solidAt(1205, 50)).toBe(false); // a stale piston never collides, even before the next step
    stepSolids();
    expect(solids.length).toBe(0);
    expect(Array.from(world.FLOOR)).toEqual(Array.from(F0)); // same arrays: the window's base was written back
    run(); fly(100);
    terrain(); // buildTerrain: new arrays
    expect(solidAt(1205, 50)).toBe(false); // stale before the next step too
    stepSolids();
    expect(solids.length).toBe(0);
    expect(engineWindows()).toEqual([]);
  });
});

describe('review fixes (lead-programmer, level-designer, qa-lead)', () => {
  it('a phased piston starts where its phase puts it: no first-frame jump (S2)', () => {
    $.P.x = 10;
    const p = spawnPiston({ x: 900, side: -1, reach: 110, phase: 0 })!;
    const C = pistonPeriod(p);
    for (const ph of [p.rest! + 20, p.rest! + p.ext! + 5, C - 10]) {
      run(); $.P.x = 10;
      const q = spawnPiston({ x: 900, side: -1, reach: 110, phase: ph })!;
      const t0 = q.tip!;
      expect(t0).toBeGreaterThan(q.root!); // already out
      frame();
      expect(Math.abs(q.tip! - t0)).toBeLessThanOrEqual(SOLID.vMax + 1e-9);
    }
  });
  it('an off-centre pair shares one stroke time: both reach full stroke on the same frame, every cycle', () => {
    $.P.x = 10;
    const [a, b] = spawnPistonPair({ x: 900, centre: 254 * .62, gap: 84 })!;
    expect(a.ext).toBe(b.ext);
    expect(pistonPeriod(a)).toBe(pistonPeriod(b));
    let both = 0, vmax = 0, pa = a.tip!, pb = b.tip!;
    for (let i = 0; i < 3 * pistonPeriod(a); i++) {
      frame();
      vmax = Math.max(vmax, Math.abs(a.tip! - pa), Math.abs(b.tip! - pb)); pa = a.tip!; pb = b.tip!;
      if (a.st === 'hold') { expect(b.st).toBe('hold'); expect(b.tip! - a.tip!).toBeCloseTo(84, 6); both++; }
    }
    expect(both).toBeGreaterThan(0);
    expect(vmax).toBeLessThanOrEqual(SOLID.vMax + 1e-9);
  });
  it('a pair is atomic: refused whole when S5 refuses either half', () => {
    $.P.x = 300; $.P.y = 200; // under the floor ram's phased box
    expect(spawnPistonPair({ x: 290, centre: 130, gap: 80, phase: 400 })).toBeNull();
    expect(solids.length).toBe(0);
  });
  it('out stands the retracted tip out of the wall and shortens the cycle', () => {
    $.P.x = 10;
    const a = spawnPiston({ x: 900, side: -1, reach: 130 })!, b = spawnPiston({ x: 1100, side: -1, reach: 130, out: 30 })!;
    expect(b.root! - a.root!).toBeCloseTo(30, 6);
    expect(pistonPeriod(b)).toBeLessThan(pistonPeriod(a));
  });
  it('S5 measures to the nearest point of the box: a long slab with the ship inside it is refused', () => {
    $.P.x = 100; $.P.y = 130;
    expect(spawnSlab({ x: 0, y: 120, w: 200, h: 20 })).toBeNull(); // its centre is ~100 px off, the ship is inside it
    expect(spawnSlab({ x: 300, y: 120, w: 200, h: 20 })).not.toBeNull();
  });
  it('an ice block that would wedge onto the ship shatters as a body hit instead (never a terrain kill)', () => {
    $.P.x = 10; $.P.y = 192; // in the floor slot the block is turning into
    const b = spawnIce({ fit: 72 })!;
    Object.assign(b, { st: 'turn', cls: SC.BODY, side: 1, x: $.G.scroll + 14, y: 186 - 14 - .5 });
    $.G.scrollSpeed = 0;
    const s0 = b.y;
    let hit = false;
    for (let i = 0; i < 5 && b.st === 'turn'; i++) hit = frame() || hit;
    expect(b.y).toBeGreaterThan(s0 - 1);
    expect(b.st).toBe('dead');
    expect(hit).toBe(true);
    expect(solidAt($.P.x + $.G.scroll, $.P.y)).toBe(false);
  });
  it('bucketed queries agree with a full scan, across bucket edges and off-screen', () => {
    $.P.x = 10;
    const xs = [-70, -60, 15, 16, 31, 33, 200, 470, 479, 530, 560, 900];
    for (let i = 0; i < xs.length; i++) spawnSlab({ x: 100 + xs[i], y: 20 + (i % 5) * 40, w: 3 + (i % 4) * 7, h: 12 });
    frame();
    const scan = (wx: number, y: number) => solids.some((s) => s.cls & SC.TERRAIN && wx >= s.x && wx <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    for (let wx = $.G.scroll - 120; wx < $.G.scroll + 700; wx += 1.5) for (let y = 15; y < 220; y += 3) expect(solidAt(wx, y)).toBe(scan(wx, y));
  });
  it('spawners clamp the tell to 44 f (S4); slabs clamp to .5 px/f (S2) and expire', () => {
    $.P.x = 10;
    expect(spawnIce({ tell: 10 })!.tell).toBe(SOLID.minTell);
    expect(spawnPlug({ wx: 900, tell: 5 })[0].tell).toBe(SOLID.minTell);
    expect(spawnPiston({ x: 1200, side: -1, reach: 110, tell: 1 })!.tell).toBe(SOLID.minTell);
    const s = spawnSlab({ x: 700, y: 100, w: 10, h: 10, vx: 3, vy: -2, life: 3 })!;
    expect(s.vx).toBe(SOLID.vMax); expect(s.vy).toBe(-SOLID.vMax);
    frame(3);
    expect(solids.includes(s)).toBe(false);
  });
  it('tells, growing and cut cells stop nothing', () => {
    const cells = spawnPlug({ wx: 900 });
    const c = cells[5];
    expect(eshotSolid(900, c.y + 5)).toBe(false); // growing
    frame(SOLID.plug.tell + 1);
    expect(eshotSolid(900, c.y + 5)).toBe(true);
    shotSolid(900, c.y + 5, 1);
    expect(eshotSolid(900, c.y + 5)).toBe(false); // cut
    const b = spawnIce({})!;
    expect(eshotSolid(b.x + 5, b.y + 5)).toBe(false); // a block in its tell
  });
  it('a bolt stepping over a 10 px cell in one frame still hits it (swept back half a cell)', () => {
    spawnPlug({ wx: 900 });
    frame(SOLID.plug.tell + 1);
    expect(solidShot(909, 130, 1)).toBe(true); // the point is past the cell's right edge (900 + 5)
  });
  it('engineWindows gives one window per group, two groups of one signature stay apart', () => {
    $.P.x = 10;
    spawnPiston({ x: 900, side: -1, reach: 110 });
    spawnPiston({ x: 1500, side: -1, reach: 110 });
    const w = engineWindows().filter((q) => q.id === 'stroke');
    expect(w.length).toBe(2);
    expect(w[0].x1).toBeLessThan(w[1].x0);
  });
  it('solidsCol allocates nothing per call: one reused list', () => {
    spawnSlab({ x: 400, y: 100, w: 20, h: 10 });
    expect(solidsCol(410)).toBe(solidsCol(415));
  });
});
