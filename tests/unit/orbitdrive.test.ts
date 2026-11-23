// W3b, the long4 Open Orbit and Drive approach rebuilt on Gradius III (DIFFICULTY-SPEC §2.4, LVL §3 and §6): the Orbit
// hull and breach (world.ts buildTerrain, layout.ts hT / oT), the Drive's deepened corridor (kD), CREW KNOTS and THE
// STROKE (layout.ts ORBIT_SIG / DRIVE_SIG, enemies/scripts.ts orbitSets / driveSets), the checkpoint list and signature
// windows (cps, sigs), the authored carriers and the entry mix. Short stays byte-identical: its terrain is checked here
// against the literal formula it was built from, its scripts in stagebuild.test.ts (D1) and layout.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// the real core math (the same bodies as src/core.ts; core.ts itself touches the DOM at load) so world.ts builds real
// terrain, and recorders for every spawn the stage scripts call
vi.mock('../../src/core', () => {
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t, clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
  const hash = (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  const vnoise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const sstep = (a: number, b: number, x: number) => { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  return { H: 270, PH: 254, TS: 4, W: 480, TAU: Math.PI * 2, clamp, hash, lerp, sstep, vnoise };
});
const calls: { k: string; a: unknown[] }[] = [];
const rec = (k: string) => (...a: unknown[]) => { calls.push({ k, a }); };
vi.mock('../../src/audio', () => ({ sfx: { dread: () => {}, siren: () => {}, tele: () => {}, groan: () => {}, chain: () => {} } }));
vi.mock('../../src/boss/update', () => ({ startBoss: () => {} }));
vi.mock('../../src/enemies/mid/ufo', () => ({ ufoWarn: () => {} }));
vi.mock('../../src/enemies/spawn', () => Object.fromEntries(
  ['banner', 'behindWave', 'corpse', 'crawler', 'edgeWave', 'eyeT', 'flayer', 'formation', 'hatch', 'knot', 'logLine', 'maw', 'mk', 'mutant', 'sentry', 'womb'].map((k) => [k, rec(k)]),
));

const W = await import('../../src/world');
const { stageScript } = await import('../../src/enemies/scripts');
const { stream, seedOf } = await import('../../src/rng');
const { CP_RULE, DRIVE_SIG, LAYOUTS, ORBIT_SIG, cpsOf, pairCentre, pistonPhase, pistonReach, rowSigWindows, setLayout } = await import('../../src/layout');

const L4 = LAYOUTS.long4!, ORBIT = L4.stages[0], DRIVE = L4.stages[3];
const PH = 254;

// ---------------- terrain ----------------
/** short's buildTerrain before rev 3, verbatim (world.ts at 517c324), for the parity check */
function oldShort(Lp: number) {
  const { hash, lerp, sstep } = { hash: (n: number) => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }, lerp: (a: number, b: number, t: number) => a + (b - a) * t, sstep: (a: number, b: number, x: number) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); } };
  const vn = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };
  const T = LAYOUTS.short!.terrain, n = Math.ceil((LAYOUTS.short!.level + 480 * 2) / 4) + 2, F = new Float32Array(n), C = new Float32Array(n), o = Lp * 91.7;
  for (let i = 0; i < n; i++) {
    const x = i * 4, fT = sstep(T.fT[0], T.fT[1], x) * (1 - sstep(T.fT[2], T.fT[3], x)), cT = sstep(T.cT[0], T.cT[1], x) * (1 - sstep(T.cT[2], T.cT[3], x));
    const kT = sstep(T.kT[0], T.kT[1], x) * (1 - sstep(T.kT[2], T.kT[3], x)), zT = sstep(T.zT[0], T.zT[1], x);
    const a = vn(x / 210 + o) * 2 - 1, b = vn(x / 61 + o + 5) * 2 - 1, c = vn(x / 19 + o + 9) * 2 - 1;
    const a2 = vn(x / 190 + o + 40) * 2 - 1, b2 = vn(x / 57 + o + 45) * 2 - 1, c2 = vn(x / 23 + o + 49) * 2 - 1;
    let fl = PH - 30 - a * 24 - b * 8 - c * 2 - kT * (24 + a * 12), ce = 24 + a2 * 20 + b2 * 8 + c2 * 2 + kT * (28 + a2 * 10);
    const blk = Math.floor(x / 360), bx = x % 360;
    if (blk % 2 === 1 && bx < 44 && x > T.blocks[0] && x < T.blocks[1]) { if (hash(blk + Lp) < .5) fl -= 34; else ce += 34; }
    fl = lerp(PH + 70, fl, fT); ce = lerp(-70, ce, cT); fl = lerp(fl, PH - 12, zT); ce = lerp(ce, 12, zT);
    if (fl - ce < 104) { const m = (fl + ce) / 2; fl = m + 52; ce = m - 52; }
    F[i] = fl; C[i] = ce;
  }
  return { F, C };
}
/** free height at world x: the open interval between the walls inside the 0..254 playfield, as a share of 254 */
const fh = (x: number) => (Math.min(PH, W.floorAt(x)) - Math.max(0, W.ceilAt(x))) / PH;
/** levels.md S1 swept fit gap: min floor - max ceil over [x - 9, x + 12] */
const fit = (x: number) => { let f = 1e9, c = -1e9; for (let u = x - 9; u <= x + 12; u += 1) { f = Math.min(f, W.floorAt(u)); c = Math.max(c, W.ceilAt(u)); } return f - c; };
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

describe('terrain: short is untouched, long4 gets the hull, the breach and the deeper Drive corridor', () => {
  it('builds short exactly as before rev 3, every column, for three descents', () => {
    setLayout('short');
    for (const Lp of [0, 1, 2]) {
      W.buildTerrain(Lp);
      const o = oldShort(Lp);
      expect(Array.from(W.FLOOR)).toEqual(Array.from(o.F));
      expect(Array.from(W.CEIL)).toEqual(Array.from(o.C));
    }
  });

  for (const Lp of [0, 1, 2]) describe(`long4, descent ${Lp + 1}`, () => {
    beforeEach(() => { setLayout('long4'); W.buildTerrain(Lp); });
    const xs = (a: number, b: number, d = 4) => Array.from({ length: Math.floor((b - a) / d) }, (_, i) => a + i * d);

    it('leaves the opener, the Saucer and CREW KNOTS open (no terrain before 3500)', () => {
      for (const x of xs(0, 3500)) expect(fh(x), `x ${x}`).toBe(1);
    });
    it('lifts the hull floor to ~188 (FH ~74%) from 3950, floor only until the breach', () => {
      const fl = xs(3950, 4950).map((x) => W.floorAt(x)), f = xs(3950, 4950).map(fh);
      expect(Math.abs(q(fl, .5) - 188)).toBeLessThan(12);
      expect(q(f, .5)).toBeLessThan(.8);
      for (const x of xs(3950, 4950)) expect(W.ceilAt(x)).toBeLessThan(0);
    });
    it('drops the breach flap to a median FH near 54% over its full span, every column >= 108 px', () => {
      const f = xs(5250, 5850).map(fh);
      expect(q(f, .5)).toBeGreaterThan(.46);
      expect(q(f, .5)).toBeLessThan(.62);
      for (const x of xs(4900, 6200)) if (W.ceilAt(x) > -60) expect(W.floorAt(x) - W.ceilAt(x), `x ${x}`).toBeGreaterThanOrEqual(107.999);
    });
    it('keeps the Orbit swept fit gap >= 100 everywhere (it has no exception window: LVL §3.1, S1)', () => {
      for (const x of xs(3400, 7000, 8)) expect(fit(x), `x ${x}`).toBeGreaterThanOrEqual(100);
    });
    // S3 is about sustained slopes the ship must follow: the hull's 34 px blocks are obstacles seen 8 s ahead, not a
    // weave, so their columns are left out. Edges are read where they are on screen (0..254)
    it('keeps every forced lane change gentle: the on-screen floor and flap slope <= .6 over any 60 px (S3)', () => {
      // a block column (world.ts: odd 360 px cells, the first 44 px), with one 4 px sample of slack for the lerp
      const blockAt = (x: number) => Math.floor(x / 360) % 2 === 1 && x % 360 < 48;
      for (const x of xs(3400, 6400, 8)) {
        if (blockAt(x) || blockAt(x + 60)) continue;
        const f0 = Math.min(PH, W.floorAt(x)), f1 = Math.min(PH, W.floorAt(x + 60));
        expect(Math.abs(f1 - f0) / 60, `floor x ${x}`).toBeLessThanOrEqual(.6);
        const c0 = Math.max(0, W.ceilAt(x)), c1 = Math.max(0, W.ceilAt(x + 60));
        expect(Math.abs(c1 - c0) / 60, `ceil x ${x}`).toBeLessThanOrEqual(.6);
      }
    });
    it('deepens the Drive approach corridor (median FH <= 52% on terrain alone, columns >= 104)', () => {
      const a = DRIVE.x0 + 800, b = DRIVE.x0 + 4200, f = xs(a, b).map(fh);
      expect(q(f, .5)).toBeLessThanOrEqual(.52);
      for (const x of xs(a, b)) expect(W.floorAt(x) - W.ceilAt(x)).toBeGreaterThanOrEqual(103.999);
    });
  });
});

// ---------------- checkpoints and signature windows ----------------
describe('the long4 checkpoint lists (§2.1 Checkpoints, C21)', () => {
  /** where each row's scroll starts: Orbit 0; the Drive ~148 px past its x0 (stagebuild.test.ts CLEAR_TO_ENTRY) */
  const start = { orbit: 0, drive: 148 };
  for (const [i, r] of [[0, ORBIT], [3, DRIVE]] as const) {
    it(`${r.kind}: starts at the stage start, stays <= 30 s of scroll apart, and has one at the WARNING - 10 s`, () => {
      const c = r.cps!;
      expect(c[0]).toBe(0);
      expect([...c].sort((a, b) => a - b)).toEqual(c);
      const xs = [Math.max(c[0], start[r.kind as 'orbit' | 'drive']), ...c.slice(1), r.warnX! - r.x0];
      for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1], `${r.kind} ${xs[k - 1]} -> ${xs[k]}`).toBeLessThanOrEqual(CP_RULE.maxGap);
      expect(c).toContain(r.warnX! - r.x0 - CP_RULE.warnLead);
      expect(cpsOf(i, L4)).toEqual(c.map((x) => r.x0 + x));
    });
    if (r.kind === 'drive') it('drive: a restore at any checkpoint still builds every STROKE piston ahead of the ship (rebuildAt keeps x > cp)', () => {
      for (const c of r.cps!) for (const v of DRIVE_SIG.stroke.vars) {
        const beat = v.x[0] - 480 - DRIVE_SIG.stroke.lead, ahead = Math.max(...v.x) + DRIVE_SIG.stroke.w > c - 120 + 50;
        if (ahead) expect(beat, `cp ${c} ${v.id}`).toBeGreaterThan(c);
      }
    });
    it(`${r.kind}: never restores inside a signature window or a fight`, () => {
      for (const x of r.cps!) {
        // a window is the ship's world x while the set piece meets it. A restore starts the scroll at x - 120
        // (checkpoint.ts CP.lead) with the ship at screen x ~50 (flow.ts): before the window, or already past it
        for (const w of r.sigs!) expect(x + 80 < w.a || x - 120 + 50 >= w.b, `${r.kind} cp ${x} in ${w.id}`).toBe(true);
        for (const d of r.drift || []) expect(x < d.at || x > d.gapEnd - d.exitLead, `${r.kind} cp ${x} in the Saucer`).toBe(true);
      }
    });
  }
  it('lists the Orbit and Drive windows in world x, with floors >= 72 (S1) and THE STROKE at 80', () => {
    const ws = rowSigWindows(L4);
    expect(ws.map((w) => w.id)).toEqual(['crew_knots', 'stroke']);
    expect(ws[1]).toEqual({ id: 'stroke', x0: DRIVE.x0 + 1100, x1: DRIVE.x0 + 2385, floor: 80 });
    for (const w of ws) expect(w.floor).toBeGreaterThanOrEqual(72);
    expect(rowSigWindows(LAYOUTS.short!)).toEqual([]);
    expect(cpsOf(0, LAYOUTS.short!)).toBeNull();
  });
});

// ---------------- THE STROKE ----------------
describe('THE STROKE pistons (LVL §6.3)', () => {
  const S = DRIVE_SIG.stroke;
  it('has a >= 44 f tell and runs at S2\'s .5 px/f edge speed', () => {
    expect(S.tell).toBeGreaterThanOrEqual(44);
    expect(S.v).toBeLessThanOrEqual(.5);
  });
  it('flies 3 / 3 / 4 pistons with gaps 96 / 84 / 80, every gap >= the window floor, inside the window', () => {
    expect(S.vars.map((v) => v.x.length)).toEqual([3, 3, 4]);
    expect(S.vars.map((v) => v.gap)).toEqual([96, 84, 80]);
    const w = DRIVE.sigs![0];
    for (const v of S.vars) {
      expect(v.gap).toBeGreaterThanOrEqual(w.floor);
      for (const x of v.x) { expect(x).toBeGreaterThanOrEqual(w.a); expect(x + S.w).toBeLessThanOrEqual(w.b); }
    }
  });
  it('a single piston leaves exactly its gap to the far wall; one that would barely intrude is skipped', () => {
    expect(pistonReach(-1, 96, 60, 190)).toBe(94);
    expect(pistonReach(1, 96, 60, 190)).toBe(156);
    expect(pistonReach(-1, 96, 60, 160)).toBeNull(); // 4 px of intrusion
  });
  it('a pair keeps both tips inside the corridor, so the opening is never under its gap', () => {
    for (let ce = 20; ce <= 100; ce += 5) for (let fl = ce + 104; fl <= 240; fl += 7) for (const qq of [.2, .38, .5, .62, .8]) for (const gap of [80, 84]) {
      const c = pairCentre(qq, gap, ce, fl), top = c - gap / 2, bot = c + gap / 2;
      expect(Math.min(bot, fl) - Math.max(top, ce), `${ce} ${fl} ${qq}`).toBeGreaterThanOrEqual(gap - 1e-9);
    }
  });
  it('weaves gently: the open lane moves <= .75 of the pitch between neighbours on a nominal deepened corridor (S3)', () => {
    const ce = 63, fl = 191; // the rev 3 approach's mean walls (gap ~128)
    for (const v of S.vars) {
      const lane = v.x.map((_, i) => (v.pair ? pairCentre(v.pair[i], v.gap, ce, fl) : v.side![i] < 0 ? fl - v.gap / 2 : ce + v.gap / 2));
      for (let i = 1; i < lane.length; i++) expect(Math.abs(lane[i] - lane[i - 1]) / (v.x[i] - v.x[i - 1]), `${v.id} ${i}`).toBeLessThanOrEqual(.75);
    }
  });
  it('phases each piston to be mid-hold as it reaches the ship, from the ship\'s x at its spawn beat (no R())', () => {
    const cyc = 300, ext = 40;
    for (const x of [1150, 1280, 1650, 2340]) for (const px of [10, 120, 280, 464]) {
      const s = x - 480 - S.lead, p = pistonPhase(x, s, cyc, ext, px), d = x - px - s;
      expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThan(cyc);
      expect((p + d) % cyc).toBeCloseTo(S.rest + ext + S.hold / 2, 6);
    }
  });
  it('leaves no parked x where a STROKE piston stays open: a ship parked anywhere meets every piston in its hold (S8)', () => {
    const ext = 60, cyc = S.rest + 2 * ext + S.hold, holdA = S.rest + ext, holdB = holdA + S.hold;
    for (let px = 10; px <= 464; px += 6) for (const v of S.vars) for (const x of v.x) {
      const s = x - 480 - S.lead, t = (pistonPhase(x, s, cyc, ext, px) + (x - px - s)) % cyc;
      expect(t >= holdA && t < holdB, `parked ${px} piston ${x}`).toBe(true);
    }
  });
  it('spawns every variation off screen (S5: never near the ship) and keeps the wall eyes 60 px from piston centres', () => {
    for (const v of S.vars) expect(v.x[0] - (v.x[0] - 480 - S.lead)).toBeGreaterThanOrEqual(480);
    const v3 = S.vars[2];
    for (const x of v3.x) expect(Math.abs(x + S.w / 2 - v3.eyes!)).toBeGreaterThanOrEqual(60);
  });
});

// ---------------- the Orbit's set pieces ----------------
describe('CREW KNOTS and the hull turrets (LVL §3.2-3.3)', () => {
  it('escalates 1 / 2 / 3 knots inside 2150-3300, v2 102 px apart, each followed by a top, bottom then rear wave', () => {
    const K = ORBIT_SIG.knots;
    expect(K.map((v) => v.lanes.length)).toEqual([1, 2, 3]);
    expect(Math.round((K[1].lanes[1] - K[1].lanes[0]) * PH)).toBe(102);
    expect(K.map((v) => v.then.k)).toEqual(['drop', 'rise', 'behind']);
    for (const v of K) { expect(v.x).toBeGreaterThanOrEqual(2150); expect(v.x + Math.max(...v.dx, v.then.dt)).toBeLessThanOrEqual(3300); }
    expect(K[0].then.teach && K[0].then.carrier).toBe(true);
  });
  it('places 8-10 terrain turrets, floor ones on the hull, ceiling ones under the flap at full drop, none called in the held breath', () => {
    const T = ORBIT_SIG.turrets;
    for (const t of T) expect(t.wx - 480 - (t.k === 'womb' ? 16 : 14), `${t.k} ${t.wx}`).toBeGreaterThanOrEqual(3700);
    expect(T.length).toBeGreaterThanOrEqual(8); expect(T.length).toBeLessThanOrEqual(10);
    const oT = L4.terrain.oT!;
    for (const t of T) {
      if (t.side > 0) expect(t.wx).toBeGreaterThanOrEqual(L4.terrain.fT[1]);
      else { expect(t.wx).toBeGreaterThanOrEqual(oT[1] - 50); expect(t.wx).toBeLessThanOrEqual(oT[2]); }
    }
  });
});

// ---------------- the scripts: carriers and the entry mix ----------------
/** build stage i's Descent 1 script for a seed and fire every entry in x order, with the ship at (120, 127) */
function fly(i: number, seed: number) {
  $.G = { seed, loop: 0, script: [], si: 0, pend: [], remixV: {}, route: ['acid', 'ice'], visitNo: [0, 0], bx: [null, null, null], scroll: 0 };
  $.P = { x: 120, y: 127 };
  calls.length = 0;
  const S = stageScript(i, stream(seedOf(seed, 0, i))).sort((a: { x: number }, b: { x: number }) => a.x - b.x);
  for (const e of S) { $.G.scroll = e.x; e.f(); }
  return S;
}
/** the entry edge of one recorded spawn call, one per wave (a hatchling swarm counts once), or null when it is not a wave */
function edgeOf(c: { k: string; a: unknown[] }) {
  if (c.k === 'formation') return c.a[0] === 'behind' ? 'behind' : 'right';
  if (c.k === 'behindWave') return 'behind';
  if (c.k === 'edgeWave') return c.a[0] === 'drop' ? 'top' : 'bottom';
  if (c.k === 'hatch') return c.a[1] === true ? 'behind' : c.a[1] === false || c.a[1] == null ? 'right' : 'wall';
  return null;
}
describe('the stage scripts (§2.2 authored carriers, §2.3 entry mix)', () => {
  beforeEach(() => setLayout('long4'));

  it('Orbit pays 4 authored carriers in its first 45 s (the opener cells and CREW KNOTS v1), the Drive 2', () => {
    for (const [i, n, xMax] of [[0, 4, 2700], [3, 2, DRIVE.x0 + 148 + 2700]] as const) {
      const S = fly(i, 7);
      const open = calls.filter((c) => (c.k === 'formation' || c.k === 'edgeWave') && (c.a[3] as { open?: number } | undefined)?.open || (c.k === 'edgeWave' && (c.a[2] as { open?: number } | undefined)?.open));
      expect(open.length, `stage ${i}`).toBe(n);
      expect(S.filter((e: { k: string }) => /carrier|knot:drop/.test(e.k) || e.k === 'o.drones' || e.k === 'o.sentry' || e.k === 'o.swarm').every((e: { x: number }) => e.x <= xMax)).toBe(true);
    }
  });

  it('places CREW KNOTS (6 knots), 10 turrets, the breach birth, and the log lines on the long Orbit', () => {
    fly(0, 3);
    expect(calls.filter((c) => c.k === 'knot').length).toBe(6);
    expect(calls.filter((c) => c.k === 'eyeT' || c.k === 'crawler' || c.k === 'womb').length).toBe(10);
    expect(calls.some((c) => c.k === 'hatch' && c.a[1] === 'top')).toBe(true);
    const logs = calls.filter((c) => c.k === 'logLine').map((c) => c.a[0]);
    expect(logs).toContain('THE DEAD ARE HOLDING HANDS.');
  });

  // N4's design-time check: the share of waves by entry edge over 40 seeds, within +-5 points of the §2.3 table.
  // Counted one per wave, every entry fired (the Saucer eats some of its window's filler in play, so the probe's read
  // of a real run differs a little: space-probe entries is the gate)
  const TARGET = { orbit: { right: .55, behind: .2, top: .12, bottom: .13 }, drive: { right: .5, behind: .2, top: .15, bottom: .15 } };
  for (const [i, kind] of [[0, 'orbit'], [3, 'drive']] as const) {
    it(`${kind}: the entry mix sits within 5 points of right / behind / top / bottom`, () => {
      const n: Record<string, number> = { right: 0, behind: 0, top: 0, bottom: 0, wall: 0 };
      for (let seed = 1; seed <= 40; seed++) { fly(i, seed); for (const c of calls) { const e = edgeOf(c); if (e) n[e]++; } }
      const tot = Object.values(n).reduce((a, b) => a + b, 0), share = Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v / tot]));
      for (const [k, t] of Object.entries(TARGET[kind])) expect(Math.abs(share[k] - t), `${kind} ${k} ${(share[k] * 100).toFixed(1)}% (${JSON.stringify(n)})`).toBeLessThanOrEqual(.05);
    });
  }
});
