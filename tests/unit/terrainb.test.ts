// Terrain movement B through the real rewriteTerrain (spec §3.3; build plan LS2-mv): the gap, the band, what short keeps,
// and that the stage's picks are drawn once. core's hash and vnoise are the real arithmetic; only the DOM side is stubbed.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

const world = vi.hoisted(() => ({ CEIL: new Float32Array(0), FLOOR: new Float32Array(0) }));
/** what the stubbed spawners were called with: [name, ...args] */
const spawned = vi.hoisted(() => [] as unknown[][]);
vi.mock('../../src/core', () => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t, clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
  const hash = (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const sstep = (a: number, b: number, x: number) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  return { C: {}, DC: [], FIRE: ['#f00'], H: 270, PH: 254, R: () => .5, TAU: Math.PI * 2, TS: 4, W: 480, ctx: {}, clamp, dist2: () => 0, hash, lerp, pick: (a: unknown[]) => a[0], ri: (a: number) => a, rr: (a: number) => a, sstep, vnoise };
});
vi.mock('../../src/world', () => ({ get CEIL() { return world.CEIL; }, get FLOOR() { return world.FLOOR; }, ceilAt: (x: number) => world.CEIL[Math.floor(x / 4)] ?? 0, floorAt: (x: number) => world.FLOOR[Math.floor(x / 4)] ?? 254, shots: [], enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => null }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
vi.mock('../../src/render/util', () => ({ glow: () => {}, light: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteChance: () => 0, eliteRoll: () => {} }));
vi.mock('../../src/stages', () => ({ startStage: () => {} }));
vi.mock('../../src/render/biomeart', () => ({ biomePat: () => {}, biomeTerrainFill: () => {}, biomeEdge: () => {}, drawBiomeBG: () => {}, drawBiomeDecor: () => {}, splatCols: () => {}, biomeDark: () => 1, biomeMist: () => null, drawFX: () => {} }));
vi.mock('../../src/enemies/spawn', () => {
  const k = ['banner', 'behindWave', 'butcher', 'corpse', 'crawler', 'crossT', 'eyeT', 'flayer', 'formation', 'hatch', 'hookE', 'logLine', 'maw', 'midboss', 'miniWarn', 'womb', 'crux', 'mutant', 'slime'];
  return Object.fromEntries(k.map((n) => [n, (...a: unknown[]) => { spawned.push([n, ...a]); }]));
});

const L = await import('../../src/layout');
const { BIOMES, SET_KINDS, biomeReset, biomeScript, biomeStage, stagePicks } = await import('../../src/biomes');
const { CATALOG, drawPicks } = await import('../../src/setdraw');
const { MOVE, MOVE_HAZ_MIN, MOVES, TIP_W, bandClamp, gimmick, hazInterval, moveAt, moveHazMul, snapVent, ventNear } = await import('../../src/terrainb');
const { pickSeedOf, seedOf, stream } = await import('../../src/rng');
/** spec §3.3's floor, written out: not MOVE_GAP, so a change to the constant can't pass its own test */
const GAP = 108;

const KEYS = Object.keys(BIOMES), TS = 4;
/** a base level wider than any biome gap, so what is measured is the biome's own */
function base() {
  const n = Math.ceil(L.layout().level / TS) + 300;
  world.CEIL = new Float32Array(n).fill(10);
  world.FLOOR = new Float32Array(n).fill(244);
}
/** run seed s into biome b at slot seg, gate from, with the variant forced through the stored picks */
function fly(seg: number, b: string, from: number, mv: number, loop = 0) {
  base();
  const i = L.stageOfSlot(seg), route = [null, null] as (string | null)[];
  route[seg] = b;
  $.G = { loop, seed: 7, pend: [], script: [], si: 0, route, visitNo: [0, 0], bx: [null, null, null], mb: { [i]: ['choir', 'cyst'] }, picks: { [i]: { mv, sp: CATALOG[b].slice(0, 3) } }, spUsed: {} };
  MOVES.length = 0;
  biomeStage(seg, from);
  return L.beatPlan(L.slotRow(seg), from, false);
}
const gapOver = (a: number, z: number) => { let m = 1e9, M = 0; for (let i = Math.ceil(a / TS); i <= Math.floor(z / TS); i++) { const g = world.FLOOR[i] - world.CEIL[i]; m = Math.min(m, g); M = Math.max(M, g); } return [m, M]; };
const cases = KEYS.flatMap((b) => [0, 1].flatMap((mv) => [0, 1].flatMap((seg) => [0, 1, 3].map((loop) => ({ b, mv, seg, loop })))));

describe('movement B on long4', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));

  it.each(cases)('$b B$mv slot $seg descent $loop: gap >= 108 from the gate to the boss, at both gates', ({ b, mv, seg, loop }) => {
    const r = L.slotRow(seg);
    for (const from of [r.x0, r.gateLate!]) {
      fly(seg, b, Math.max(from, r.x0), mv, loop);
      expect(gapOver(from + 300, r.bossX)[0]).toBeGreaterThanOrEqual(GAP - 1e-3);
    }
  });

  it.each(cases)('$b B$mv slot $seg descent $loop: a naked ship can fly it', ({ b, mv, seg, loop }) => {
    // reachable y per tile at 1 px/frame scroll and the 1.25 px/f naked speed (spec §9), 10 px of clearance each edge
    const P = fly(seg, b, L.slotRow(seg).gateLate!, mv, loop), climb = 1.25 * TS, pad = 10;
    const i0 = Math.ceil(P.moveB!.a / TS), i1 = Math.floor(P.moveB!.z / TS);
    let lo = world.CEIL[i0] + pad, hi = world.FLOOR[i0] - pad;
    for (let i = i0 + 1; i <= i1; i++) {
      lo = Math.max(lo - climb, world.CEIL[i] + pad);
      hi = Math.min(hi + climb, world.FLOOR[i] - pad);
      expect(hi, `no way through at ${i * TS}`).toBeGreaterThan(lo);
    }
  });

  it.each(KEYS.flatMap((b) => [0, 1].map((mv) => ({ b, mv }))))('$b B$mv changes the terrain only inside its band', ({ b, mv }) => {
    const r = L.slotRow(0), P = fly(0, b, r.gateLate!, mv), snap = [world.CEIL.slice(), world.FLOOR.slice()];
    $.G.picks[1].mv = 1 - mv;
    base();
    MOVES.length = 0;
    biomeStage(0, r.gateLate!);
    let inside = 0;
    for (let i = 0; i < snap[0].length; i++) {
      const same = snap[0][i] === world.CEIL[i] && snap[1][i] === world.FLOOR[i], x = i * TS;
      if (x <= P.moveB!.a || x >= P.moveB!.z) expect(same, `${x}`).toBe(true);
      else if (!same) inside++;
    }
    expect(inside).toBeGreaterThan(100);
  });

  it('sits between the breaths: from CP1 at breath 1\'s end, gone before midboss B\'s held screen, ~20 s at full (D31 stretch)', () => {
    for (const seg of [0, 1]) for (const from of [L.slotRow(seg).x0, L.slotRow(seg).gateLate!]) {
      const P = L.beatPlan(L.slotRow(seg), from, false), M = P.moveB!;
      expect(M.a).toBe(P.breaths[0].z); // spec §3.3: movement A runs "intro to CP1", and CP1 is written at breath 1's end
      expect(M.z).toBeLessThan(P.breaths[1].z - 20); // the scroll holds ~20 px before the breath's end
      expect(M.z - M.a - 2 * M.blend).toBeGreaterThan(1000); // the full gimmick, ~20 s at 1 px/f under the D31 stretch (D31 amended: about 18 s)
    }
  });

  it('holds snot B0\'s throat to its 108-150 px gap', () => {
    const P = fly(0, 'snot', L.slotRow(0).gateLate!, 0), M = P.moveB!, [m, X] = gapOver(M.a + M.blend, M.z - M.blend);
    expect(m).toBeGreaterThanOrEqual(MOVE.throat.min - 1e-3);
    expect(X).toBeLessThanOrEqual(MOVE.throat.max + 1e-3);
  });

  it('steps ice B1\'s floor every 120 px, no step over one rise', () => {
    const P = fly(0, 'ice', L.slotRow(0).gateLate!, 1), M = P.moveB!, E = MOVE.stair.every;
    expect(E).toBe(120); // spec §3.3
    expect(MOVE.stair.rise).toBeLessThanOrEqual(24); // a face a naked ship clears in under 20 f
    for (let x = Math.ceil((M.a + M.blend) / E) * E; x + E < M.z - M.blend; x += E) {
      expect(world.FLOOR[(x + 8) / TS], `tread at ${x}`).toBeCloseTo(world.FLOOR[(x + E - 8) / TS], 3);
      expect(Math.abs(world.FLOOR[(x + E + 8) / TS] - world.FLOOR[(x + 8) / TS])).toBeCloseTo(MOVE.stair.rise, 3);
    }
  });

  it('raises acid B0\'s lake about 30 px over the whole band, not at one point', () => {
    for (const o of [3.1, 40, 77.7]) {
      let sum = 0, n = 0;
      for (let x = 6000; x < 6600; x += 4) { sum += gimmick('acid', 0, x, o, 20, 236)[1]; n++; }
      expect(254 - 18 - sum / n, `o ${o}`).toBeGreaterThan(30); // mean floor at least the 30 px rise above the 18 px base
    }
  });

  it('opens fire B1\'s vents where ventNear says, with the mouth clear of spawnHazard\'s c > 4', () => {
    const v = ventNear(1234);
    expect(Math.abs(v - 1234)).toBeLessThanOrEqual(MOVE.vent.every / 2);
    expect(gimmick('fire', 1, v, 40, 30, 230)[0]).toBe(MOVE.vent.mouth);
    expect(MOVE.vent.mouth).toBeGreaterThan(4);
    expect(MOVE.vent.mouth).toBeGreaterThanOrEqual(34); // below the HUD strip, so the grille and the telegraph read (spec §9)
  });

  it('publishes the live band to hazards and props, and clears it on a new descent', () => {
    const P = fly(0, 'fire', L.slotRow(0).gateLate!, 1), M = P.moveB!;
    expect(moveAt((M.a + M.z) / 2)).toMatchObject({ b: 'fire', mv: 1 });
    expect(moveAt(M.a + 1)).toBeNull(); // still blending
    expect(moveAt(M.z + 1)).toBeNull();
    biomeReset();
    expect(moveAt((M.a + M.z) / 2)).toBeNull();
  });

  it.each(KEYS.flatMap((b) => [0, 1].flatMap((mv) => [0, 1].map((seg) => ({ b, mv, seg })))))('$b B$mv slot $seg blends in without a cliff at either band edge', ({ b, mv, seg }) => {
    // the worst tile-to-tile step near each edge is no bigger than movement A's own nearby (or 12 px: measured 2.3-11.2
    // here; with no blend it is 14-89, qa-tester M4)
    const M = fly(seg, b, L.slotRow(seg).gateLate!, mv).moveB!;
    const step = (i: number) => Math.max(Math.abs(world.FLOOR[i + 1] - world.FLOOR[i]), Math.abs(world.CEIL[i + 1] - world.CEIL[i]));
    let A = 0, edge = 0;
    for (let i = Math.floor((M.a - 600) / TS); i < Math.floor((M.a - 8) / TS); i++) A = Math.max(A, step(i));
    for (const [lo, hi] of [[M.a - 8, M.a + M.blend / 4], [M.z - M.blend / 4, M.z + 8]]) for (let i = Math.floor(lo / TS); i < Math.ceil(hi / TS); i++) edge = Math.max(edge, step(i));
    expect(edge).toBeLessThanOrEqual(Math.max(A, 12));
  });

  it('keeps a spawn height inside the walls only where a band covers x (hatchlings, set pieces)', () => {
    const P = fly(0, 'snot', L.slotRow(0).gateLate!, 0), M = P.moveB!, mid = (M.a + M.z) / 2;
    expect(bandClamp(30, mid, 73, 181, 12)).toBe(85);
    expect(bandClamp(224, mid, 73, 181, 12)).toBe(169);
    expect(bandClamp(120, mid, 73, 181, 12)).toBe(120);
    expect(bandClamp(30, M.a + 2, 73, 181)).toBe(89); // the blend counts: the walls move from its first px
    expect(bandClamp(30, M.a - 1, 73, 181)).toBe(30); // outside: untouched (short never has a band)
    expect(bandClamp(30, M.z + 1, 73, 181)).toBe(30);
  });
});

describe('the gimmick shapes', () => {
  const OFFS = Array.from({ length: 60 }, (_, i) => i * 13.37 + .5), BASES: [number, number][] = [[10, 244], [40, 150], [60, 170], [90, 200], [20, 128]];
  it('keeps a 108 px gap in every gimmick, over 60 terrain offsets and five movement-A gaps', () => {
    let min = 1e9;
    for (const b of KEYS) for (const mv of [0, 1]) for (const o of OFFS) for (const [ce, fl] of BASES) for (let x = 5000; x < 7000; x += 2) {
      const [c, f] = gimmick(b, mv, x, o, ce, fl);
      min = Math.min(min, f - c);
    }
    expect(min).toBeGreaterThanOrEqual(GAP - 1e-6);
  });
  it.each([['ice', 0, 'tooth'], ['fire', 0, 'spire']] as const)('gives %s B%i\'s tips a flat top at least 3 px wide (spec §9)', (b, mv, key) => {
    expect(TIP_W).toBeGreaterThanOrEqual(3);
    const e = MOVE[key].every;
    for (let n = 140; n < 160; n++) {
      const mid = n * e + e / 2, edge = (x: number) => gimmick(b, mv, x, 40, 10, 244)[b === 'ice' ? 0 : 1];
      expect(Math.abs(edge(mid) - edge(mid + 1.4)), `cell ${n}`).toBeLessThan(1); // level to under 1 px (the flank noise) from the tip's middle to 1.4 px off; a needle drops several px there
    }
  });
});

describe('movement B hazards', () => {
  const band = (b: string, mv: number) => { MOVES.length = 0; MOVES[0] = { a: 6000, z: 6800, blend: 200, b, mv, o: 1 }; };
  beforeEach(() => { MOVES.length = 0; });
  it('spaces hazards x.7 in ice B0, x.85 in ice B1, x.7 on the Chimney (fit 1) and x1 elsewhere', () => {
    expect([moveHazMul('ice', 0), moveHazMul('ice', 1), moveHazMul('fire', 1)]).toEqual([.7, .85, .7]);
    for (const [b, mv] of [['acid', 0], ['acid', 1], ['fire', 0], ['snot', 0], ['snot', 1], ['nope', 0]] as const) expect(moveHazMul(b, mv), `${b} B${mv}`).toBe(1);
  });
  it('leaves the interval untouched outside every band, scales it inside, and never goes under the floor there', () => {
    expect(hazInterval(110, 6400)).toBe(110); // no band built: short, and long4 outside the band
    band('ice', 0);
    expect(hazInterval(110, 6400)).toBeCloseTo(77, 6);
    expect(hazInterval(60, 6400)).toBe(MOVE_HAZ_MIN);
    expect(hazInterval(110, 6100)).toBe(110); // still blending: only the fully blended part counts
    expect(hazInterval(110, 7000)).toBe(110);
  });
  it('snaps a jet to the nearest Chimney vent past half the blend, pulled back on screen, and nowhere else', () => {
    band('fire', 1);
    const sc = 6100, r = snapVent(250, sc, 480);
    expect(r).toEqual({ x: ventNear(sc + 250) - sc, vent: true });
    expect(snapVent(470, sc, 480).x).toBeLessThanOrEqual(480 - 20); // a vent past the right edge is pulled back a vent
    expect(snapVent(-80, sc, 480)).toEqual({ x: -80, vent: false }); // x 6020: under half blended
    expect(ventNear(6140)).toBe(6075); // x 6140 is past half blended, but its nearest vent (6075) is not:
    expect(snapVent(40, sc, 480)).toEqual({ x: 40, vent: false }); // no snap into the ramp, so no free downward jet there
    band('ice', 1);
    expect(snapVent(250, sc, 480)).toEqual({ x: 250, vent: false });
    MOVES.length = 0;
    expect(snapVent(250, sc, 480)).toEqual({ x: 250, vent: false });
  });
});

describe('the stage picks', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));
  beforeEach(() => { $.G = { loop: 0, seed: 11, pend: [], picks: {}, spUsed: {} }; });

  it('draws once: a rebuild reads the stored picks and leaves the used set alone', () => {
    const a = stagePicks(1, 'ice', 0), used = [...$.G.spUsed.ice];
    expect(stagePicks(1, 'ice', 0)).toBe(a);
    expect($.G.spUsed.ice).toEqual(used);
  });
  it('gives the same picks from the same run seed, and different ones across seeds', () => {
    const a = JSON.stringify(stagePicks(1, 'fire', 0));
    $.G = { loop: 0, seed: 11, pend: [], picks: {}, spUsed: {} };
    expect(JSON.stringify(stagePicks(1, 'fire', 0))).toBe(a);
    const all = new Set<string>();
    for (let s = 1; s < 40; s++) { $.G = { loop: 0, seed: s, pend: [], picks: {}, spUsed: {} }; all.add(stagePicks(1, 'fire', 0).sp.join()); }
    expect(all.size).toBeGreaterThan(10);
  });
  it('never moves the script: the same script with or without a prior draw', () => {
    const go = () => biomeScript(0, 'ice', 4750, 0, undefined, ['choir', 'cyst'], ['thaw', 'vigil', 'pack']).map((e: { x: number; k: string }) => e.x + e.k).join();
    $.G = { loop: 0, seed: 5, pend: [] };
    const a = go();
    stagePicks(1, 'ice', 0);
    expect(go()).toBe(a);
  });
  it('plays the drawn pieces in order at the three set-piece beats', () => {
    $.G = { loop: 0, seed: 5, pend: [] };
    const S = biomeScript(0, 'ice', 4750, 0, undefined, ['choir', 'cyst'], ['thaw', 'vigil', 'pack']), k = S.filter((e: { k: string }) => e.k.startsWith('set:')).sort((p: { x: number }, q: { x: number }) => p.x - q.x).map((e: { k: string }) => e.k);
    expect(k).toEqual(['set:thaw', 'set:vigil', 'set:pack']);
  });
  it('draws from its own salted stream, not a copy of the script\'s', () => {
    const a = stagePicks(2, 'acid', 0), want = drawPicks('acid', 0, 0, {}, stream(pickSeedOf(11, 0, 2)), {});
    expect(a).toEqual(want);
    expect(pickSeedOf(11, 0, 2)).not.toBe(seedOf(11, 0, 2));
  });
  it('flies a remix on the variant the biome hasn\'t flown this run', () => {
    $.G.loop = 1;
    $.G.mvSeen = { fire: 2 }; // met on B1 (a Descent 2 first visit that rolled it)
    expect(stagePicks(2, 'fire', 1).mv).toBe(0);
    expect($.G.mvSeen.fire).toBe(3);
  });
  it('keeps the used set across descents and forgets the stage picks', () => {
    stagePicks(1, 'ice', 0);
    biomeReset();
    expect($.G.picks).toEqual({});
    expect($.G.spUsed.ice).toHaveLength(3);
  });
});

describe('the catalogue against the game', () => {
  it('names only real set pieces, including each biome\'s signature and remix signature', () => {
    for (const b of KEYS) {
      for (const id of CATALOG[b]) expect(SET_KINDS, id).toContain(id);
      expect(CATALOG[b]).toContain(BIOMES[b].set);
      expect(CATALOG[b]).toContain(BIOMES[b].remix.set);
    }
    expect(SET_KINDS.length).toBe(20);
  });
  it('lands every piece\'s last spawn before the run-up when it plays S3, first visit or repeat (1 px/f scroll)', () => {
    L.setLayout('long4');
    for (const remix of [false, true]) for (const seg of [0, 1]) {
      const r = L.slotRow(seg), P = L.beatPlan(r, r.gateLate!, remix), s3 = P.sets[2];
      for (const id of SET_KINDS) {
        $.G = { loop: 0, seed: 5, pend: [], scroll: 0 };
        const b = KEYS.find((k) => CATALOG[k].includes(id))!;
        const e = biomeScript(seg, b, r.gateLate!, remix ? 1 : 0, undefined, ['choir', 'cyst'], [id, id, id]).filter((q: { k: string }) => q.k === 'set:' + id).sort((p: { x: number }, q: { x: number }) => p.x - q.x)[2];
        expect(e.x, `${id} S3`).toBe(s3); // placed at its planned x (D20 holds on the placed piece)
        e.f();
        const last = Math.max(0, ...$.G.pend.map((p: { t: number }) => p.t));
        expect(s3 + last, `${id} remix ${remix} slot ${seg}`).toBeLessThan(P.runup!);
      }
    }
    L.setLayout('short');
  });
  it('spawns the breath-1 release formation with the pod flag on long4, and no other formation carries it', () => {
    // G2: formation() marks group.pod (podkeep.test.ts) and killEnemy skips the roll for it (poddrop.test.ts); this is
    // the link between them, biomeScript's release (biomes.ts)
    L.setLayout('long4');
    try {
      for (const seg of [0, 1]) for (const b of ['ice', 'fire']) {
        $.G = { loop: 0, seed: 5, pend: [], scroll: 0 };
        const S = biomeScript(seg, b, L.slotRow(seg).gateLate!, 0, undefined, ['choir', 'cyst'], CATALOG[b].slice(0, 3));
        expect(S.filter((e: { k: string }) => e.k === 'pod'), `${b} slot ${seg}`).toHaveLength(1);
        const flagged: string[] = [];
        for (const e of S) {
          $.G.pend = []; spawned.length = 0;
          e.f(); for (const q of $.G.pend) q.f();
          for (const c of spawned) if (c[0] === 'formation' && (c[4] as { pod?: number } | undefined)?.pod === 1) flagged.push(e.k);
        }
        expect(flagged, `${b} slot ${seg}`).toEqual(['pod']);
      }
    } finally {
      L.setLayout('short');
    }
  });

  it('keeps every biome\'s long4 climax under beat-probe\'s 1.7 spawns/s exit in Descent 2+, with margin for the probe', () => {
    // the slot loop's expected rate: (1 + extra + third) spawns per step of B.gap * T.gap px, 60 px of scroll per second.
    // beat-probe reads ~.03 above this model, so the cap here is 1.65 (layout.ts peak B comment)
    const climax = L.LAYOUTS.long4!.beats.tempo.find((t) => t.until === .94)!;
    for (const [k, B] of Object.entries(BIOMES) as [string, { gap: number; dbl: number }][]) {
      const third = climax.third === true ? .35 : (climax.third || 0);
      const rate = (1 + Math.min(.85, B.dbl + climax.dbl) + third) / (B.gap * climax.gap) * 60;
      expect(rate, k).toBeLessThanOrEqual(1.65);
    }
  });

  it('places peak B\'s Descent 2 third spawn only under a .1 draw, and peak A\'s under .35 (long4 slot loop)', () => {
    // C2 (qa-tester re-check): drives biomeScript's `third` chance with a constant stream, so the extras and every other
    // threshold resolve the same way for each pair of draws compared and only the third spawn differs
    L.setLayout('long4');
    try {
      const r = L.slotRow(0), P = L.beatPlan(r, r.gateLate!, false), [, b2, b3] = P.breaths;
      const count = (c: number, lo: number, hi: number) => {
        $.G = { loop: 1, seed: 5, pend: [], scroll: 0 };
        return biomeScript(0, 'fire', r.gateLate!, 0, () => c, ['choir', 'cyst'], CATALOG.fire.slice(0, 3))
          .filter((e: { x: number; k: string }) => e.x >= lo && e.x < hi && !e.k.startsWith('set:') && e.k !== 'log').length;
      };
      const pkB: [number, number] = [b3.z, P.runup!], pkA: [number, number] = [b2.z, b3.a];
      expect(count(.09, ...pkB)).toBeGreaterThan(count(.1, ...pkB));
      expect(count(.1, ...pkB)).toBe(count(.3, ...pkB));
      expect(count(.3, ...pkA)).toBeGreaterThan(count(.36, ...pkA));
      expect(count(.09, ...pkA)).toBe(count(.3, ...pkA));
    } finally {
      L.setLayout('short');
    }
  });

  it('keeps a piece\'s fixed spawn heights out of the walls a band has moved, and leaves them alone elsewhere', () => {
    L.setLayout('long4');
    const P = fly(0, 'ice', L.slotRow(0).gateLate!, 1), M = P.moveB!, mid = (M.a + M.z) / 2;
    const S = biomeScript(0, 'ice', L.slotRow(0).gateLate!, 0, undefined, ['choir', 'cyst'], ['thaw', 'thaw', 'thaw']).find((e: { k: string }) => e.k === 'set:thaw');
    const fire = (scroll: number) => { $.G.scroll = scroll; $.G.pend = []; spawned.length = 0; S.f(); for (const q of $.G.pend) q.f(); return spawned.filter((c) => c[0] === 'corpse').map((c) => c[1] as number); };
    // its entry column (scroll + W + 20) on a stair inside the band's full-gimmick stretch: the first step low enough
    // that the bottom body (254 * .8) would start in it (mid-band moved with the D31 stretch, so search for one)
    let at = mid;
    for (let x = M.a + M.blend; x < M.z - M.blend; x += TS) if (world.FLOOR[Math.floor(x / TS)] - 16 < 254 * .8) { at = x; break; }
    const ys = fire(at - 480 - 20);
    const c = world.CEIL[Math.floor(at / TS)], f = world.FLOOR[Math.floor(at / TS)];
    expect(ys).toHaveLength(3);
    expect(254 * .8).toBeGreaterThan(f - 16); // the case that matters: the bottom body would start inside this step
    for (const y of ys) { expect(y).toBeGreaterThanOrEqual(c + 16 - 1e-6); expect(y).toBeLessThanOrEqual(f - 16 + 1e-6); }
    MOVES.length = 0; // no band (short; long4 outside it): the piece's own fractions of PH
    expect(fire(at - 480 - 20)).toEqual([254 * .2, 254 * .5, 254 * .8]);
    L.setLayout('short');
  });
  it('finishes every new piece inside 60 f, so S3 is done before the run-up', () => {
    $.G = { loop: 0, seed: 5, pend: [] };
    L.setLayout('long4');
    for (const b of KEYS) for (const id of CATALOG[b].slice(2)) {
      $.G.pend = [];
      const S = biomeScript(0, b, 4750, 0, undefined, ['choir', 'cyst'], [id, id, id]).find((e: { k: string }) => e.k === 'set:' + id);
      S.f();
      expect(Math.max(0, ...$.G.pend.map((p: { t: number }) => p.t)), id).toBeLessThanOrEqual(60);
    }
    L.setLayout('short');
  });
});

describe('short', () => {
  it('has no movement B and no draw: biomeStage touches neither picks nor the used set', () => {
    L.setLayout('short');
    base();
    $.G = { loop: 0, seed: 7, pend: [], script: [], si: 0, route: ['ice', null], visitNo: [0, 0], bx: [2660, null, null] };
    MOVES.length = 0;
    biomeStage(0, 2660);
    expect(L.beatPlan(L.slotRow(0), 2660, false).moveB).toBeNull();
    expect(MOVES).toHaveLength(0);
    expect($.G.picks).toBeUndefined();
    expect($.G.spUsed).toBeUndefined();
    expect($.G.script.filter((e: { k: string }) => e.k.startsWith('set:')).every((e: { k: string }) => e.k === 'set:morgue')).toBe(true);
  });
});
