// LS1 row F: the midboss picker wired into play (design/content-expansion.md §3.2 "Breath 2 safety", §6.3-6.5).
// - the slot-B guard (rule 2): slot B's miniWarn and its spawn wait while G.mini is up, held and DRIFT cases
// - the forced exit (rule 1) of a DRIFT midboss in slot A of a biome stage (the Saucer as the stub DRIFT member)
// - the picks: two different bodies per long biome stage, none repeated in a descent, made once per stage from
//   midStream(i); the Orbit's Saucer counted as met; the fork's acid/snot rule; a 200-descent route sweep
// - filler suppression while a midboss is up, the slot clocks, meta.mb on meet
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// a seeded sim RNG (mulberry32) for openFork's shuffles; build rolls draw the stage streams (G.seed)
let seed = 1;
const R = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** what the mocked spawn functions did, in order: [what, scroll x, G.mini set?] */
const log: [string, number, boolean][] = [];
const note = (k: string) => log.push([k, $.G.scroll, !!$.G.mini]);

vi.mock('../../src/core', () => ({
  C: {}, DC: [], FIRE: ['#f00'], H: 270, PH: 254, R: () => R(), TAU: Math.PI * 2, TS: 4, W: 480, ctx: {},
  clamp: (v: number, a: number, b: number) => Math.min(b, Math.max(a, v)), dist2: () => 0, hash: () => .5,
  lerp: (a: number, b: number, t: number) => a + (b - a) * t, pick: (a: unknown[]) => a[0],
  ri: (a: number) => a, rr: (a: number) => a, sstep: () => 0, vnoise: () => .5,
}));
vi.mock('../../src/world', () => ({ CEIL: [], FLOOR: [], ceilAt: () => 0, floorAt: () => 254, shots: [], enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => null }));
vi.mock('../../src/audio', () => ({ sfx: { forkOpen: () => {} }, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
vi.mock('../../src/render/util', () => ({ glow: () => {}, light: () => {} }));
vi.mock('../../src/enemies/elite', () => ({ eliteChance: () => 0, eliteRoll: () => {} }));
vi.mock('../../src/stages', () => ({ startStage: () => {} }));
vi.mock('../../src/render/biomeart', () => ({
  biomePat: () => {}, biomeTerrainFill: () => {}, biomeEdge: () => {}, drawBiomeBG: () => {}, drawBiomeDecor: () => {},
  splatCols: () => {}, biomeDark: () => 1, biomeMist: () => null, drawFX: () => {},
}));
vi.mock('../../src/enemies/spawn', () => {
  const noop = () => {};
  const k = ['banner', 'behindWave', 'butcher', 'corpse', 'crawler', 'crossT', 'eyeT', 'flayer', 'formation', 'hatch', 'hookE', 'logLine', 'maw', 'womb', 'crux', 'mutant', 'slime'];
  return {
    ...Object.fromEntries(k.map((n) => [n, noop])),
    // the real miniWarn: a WARNING banner now, the spawn 150 f later (enemies/spawn.ts)
    miniWarn: (name: string, f: () => void) => { note('warn:' + name); $.G.pend.push({ t: 150, f }); },
    // a held biome midboss: takes G.mini (enemies/spawn.ts midboss)
    midboss: (k: string, _t: string, host: string, leave: number) => { note('mid:' + k); $.G.mini = { k, host, leave, t: 0 }; },
  };
});

const L = await import('../../src/layout');
const { BIOMES, BIOME_KEYS, MID_NAMES, SPAWN_KINDS, biomeReset, biomeScript, fixedMids, midStream, openFork, stageMids } = await import('../../src/biomes');
const { HOME, MIDS, MID_CLOCK, forkAllows, slotClock } = await import('../../src/midpick');
const { BIOME_FILL, fillerQuiet, isFiller, meetMid, miniUp, registerDrift, whenNoMini } = await import('../../src/midslot');

/** the stub DRIFT member: the Saucer's spawner as enemies/ufo.ts registers it (a drift mini forced out at exitX) */
const UFO_EXIT_SPEED = 1.6, UFO_OFF = 180; // ufo.ts: it slides off at 1.6 px/f from about tx (W - 96) to W + 80
registerDrift('ufo', 'THE SQUIDFUCKED SAUCER', (exitX: number, leave: number) => { note('mid:ufo'); $.G.mini = { k: 'ufo', drift: 1, exitX, leave, t: 0 }; });

/** the run state the build and the play loop read */
const run = (over: Record<string, unknown> = {}) => ({ loop: 0, seed: 0xc0ffee, pend: [], rank: 0, scroll: 0, script: [], si: 0, route: [null, null], visitNo: [0, 0], ...over });

/** a stripped-down stepWorld (step.ts): drop a dead mini, hold the scroll for a held one, run the script and the pend
 *  queue, age the mini. A DRIFT mini leaves at its forced exit (ufo.ts updUfo) or its clock; a held one on its clock,
 *  or when `kill` says so. Returns the frames run */
function play(S: { x: number; f: () => void }[], until: number, kill?: (m: any) => boolean, stop?: () => boolean) {
  S.sort((a, b) => a.x - b.x);
  let si = S.findIndex((e) => e.x > $.G.scroll), f = 0; // entries already behind the scroll have played
  if (si < 0) si = S.length;
  for (; f < 20000 && $.G.scroll < until && !(stop && stop()); f++) {
    const G = $.G;
    if (G.mini && G.mini.dead) G.mini = null;
    G.scroll += G.mini && !G.mini.drift ? 0 : 1;
    while (si < S.length && S[si].x <= G.scroll) S[si++].f();
    for (let i = G.pend.length - 1; i >= 0; i--) { const p = G.pend[i]; if (--p.t <= 0) { G.pend.splice(i, 1); p.f(); } }
    const m = G.mini;
    if (m) {
      m.t++;
      if (!m.gone && (m.t >= m.leave || (m.drift && G.scroll > m.exitX) || (kill && kill(m)))) { m.gone = 1; m.off = 0; }
      if (m.gone && (m.off += UFO_EXIT_SPEED) > UFO_OFF) m.dead = true;
    }
  }
  return f;
}

describe('midboss slots on long4 (item F)', () => {
  beforeAll(() => L.setLayout('long4'));
  afterAll(() => L.setLayout('short'));
  beforeEach(() => { log.length = 0; seed = 1; $.G = run(); $.meta = { mb: {} }; });

  describe('the slot-B guard (spec §3.2 rule 2)', () => {
    it('holds a call while G.mini is up and re-checks it every frame: held midboss', () => {
      $.G.mini = { k: 'choir' };
      let fired = 0;
      whenNoMini(() => fired++);
      expect(fired).toBe(0);
      expect($.G.pend).toHaveLength(1);
      expect($.G.pend[0].t).toBe(1); // next frame
      // three frames with the mini still up: still waiting, one re-check queued each frame
      for (let k = 0; k < 3; k++) { const p = $.G.pend.shift(); p.f(); expect(fired).toBe(0); expect($.G.pend).toHaveLength(1); }
      $.G.mini = null;
      $.G.pend.shift().f();
      expect(fired).toBe(1);
      expect($.G.pend).toHaveLength(0);
    });

    it('holds a call while G.mini is up: DRIFT midboss, and a withdrawing one still counts until it is gone', () => {
      $.G.mini = { k: 'ufo', drift: 1 };
      let fired = 0;
      whenNoMini(() => fired++);
      $.G.mini.gone = 1; // on its way out: midboss() would still overwrite it
      $.G.pend.shift().f();
      expect(fired).toBe(0);
      $.G.mini = null;
      $.G.pend.shift().f();
      expect(fired).toBe(1);
    });

    it('runs at once when no midboss is up (normal play: the guard never triggers)', () => {
      let fired = 0;
      whenNoMini(() => fired++);
      expect(fired).toBe(1);
      expect($.G.pend).toHaveLength(0);
    });

    const r = () => L.slotRow(0), gate = () => r().gateLate!;
    const stage = (mids: string[]) => { $.G = run({ scroll: gate() - 490 }); return biomeScript(0, 'ice', gate(), 0, undefined, mids); };
    const warnB = () => log.findIndex(([k], i) => k.startsWith('warn:') && log.slice(0, i).some(([q]) => q.startsWith('mid:')));

    it('never fires breath 2s WARNING while G.mini is up: held slot A that outlives its clock window', () => {
      const S = stage(['choir', 'cyst']), P = L.beatPlan(r(), gate(), false);
      // the held midboss holds the scroll; force the worst case: it never leaves, and the scroll is pushed past breath 2
      play(S, P.warns[1], undefined, () => !!$.G.mini);
      expect($.G.mini.k).toBe('choir');
      $.G.mini.leave = 1e9;
      $.G.mini.drift = 1; // let the stripped-down loop move the scroll on (as if it had kept moving)
      play(S, P.warns[1] + 10);
      expect(log.some(([k]) => k === 'warn:' + MID_NAMES.cyst)).toBe(false); // deferred
      $.G.mini.dead = true;
      play(S, P.warns[1] + 12);
      const i = warnB();
      expect(log[i][0]).toBe('warn:' + MID_NAMES.cyst);
      expect(log[i][2]).toBe(false); // fired with G.mini clear
    });

    it('never fires breath 2s WARNING while G.mini is up: a DRIFT midboss (the Saucer stub) in slot A of a biome stage', () => {
      const S = stage(['ufo', 'choir']), P = L.beatPlan(r(), gate(), false);
      play(S, r().bossX - 10, (m) => m.k === 'choir' && m.t > 300);
      const ufo = log.find(([k]) => k === 'mid:ufo')!, wB = log.find(([k]) => k === 'warn:' + MID_NAMES.choir)!;
      expect(ufo).toBeDefined();
      expect(wB).toBeDefined();
      expect(wB[2]).toBe(false); // G.mini was clear when slot B's WARNING fired
      expect(wB[1]).toBe(P.warns[1]); // on time: the forced exit (rule 1) cleared it first, the guard never had to wait
      // and slot B's midboss landed on a clear slot too
      expect(log.find(([k]) => k === 'mid:choir')![2]).toBe(false);
    });

    it('still holds breath 2s WARNING when the DRIFT midboss ignores its forced exit (the backstop)', () => {
      registerDrift('ufo', 'THE SQUIDFUCKED SAUCER', (exitX: number, leave: number) => { note('mid:ufo'); $.G.mini = { k: 'ufo', drift: 1, exitX: 1e9, leave: 1e9, t: 0, x0: exitX }; });
      try {
        const S = stage(['ufo', 'choir']), P = L.beatPlan(r(), gate(), false);
        play(S, P.warns[1] + 400);
        expect(log.some(([k]) => k === 'warn:' + MID_NAMES.choir)).toBe(false);
        $.G.mini.dead = true;
        play(S, P.warns[1] + 402);
        expect(log.find(([k]) => k === 'warn:' + MID_NAMES.choir)![2]).toBe(false);
      } finally {
        registerDrift('ufo', 'THE SQUIDFUCKED SAUCER', (exitX: number, leave: number) => { note('mid:ufo'); $.G.mini = { k: 'ufo', drift: 1, exitX, leave, t: 0 }; });
      }
    });

    it('spawns a DRIFT slot-A midboss with its stage-relative forced exit and the slot clock, held slot B on its clock', () => {
      const S = stage(['ufo', 'choir']), P = L.beatPlan(r(), gate(), false);
      let ufo: any = null, choir: any = null;
      const spy = (m: any) => { if (m.k === 'ufo') ufo ||= m; if (m.k === 'choir') choir ||= m; return m.k === 'choir' && m.t > 300; };
      play(S, r().bossX - 10, spy);
      expect(ufo.exitX).toBe(P.driftExit[0]);
      expect(P.warns[1] - ufo.exitX).toBeGreaterThanOrEqual(300); // rule 1
      expect(ufo.leave).toBe(MID_CLOCK.slot[0]);
      expect(choir.leave).toBe(MID_CLOCK.slot[1]);
      expect(choir.host).toBe('ice');
    });
  });

  describe('the picks (spec §6.3)', () => {
    it('gives a long biome stage two different bodies with different tags, home preferred, from midStream(i)', () => {
      biomeReset();
      fixedMids(0, 'orbit', ['ufo']);
      const p = stageMids(1, 'ice');
      expect(p).toHaveLength(2);
      expect(p[0]).toBe(HOME.ice);
      expect(MIDS[p[0]].body).not.toBe(MIDS[p[1]].body);
      expect(MIDS[p[0]].tag).not.toBe(MIDS[p[1]].tag);
      expect($.G.mb[0]).toEqual(['ufo']); // the Orbit's Saucer, in Descent 1 as in every descent (its row's drift entry)
      expect($.G.mbUsed).toEqual(['ufo', ...p]);
    });

    it('picks a stage once: a rebuild reads G.mb back and records nothing twice', () => {
      biomeReset();
      const p = stageMids(1, 'fire'), used = [...$.G.mbUsed];
      expect(stageMids(1, 'fire')).toBe(p);
      expect($.G.mbUsed).toEqual(used);
      fixedMids(0, 'orbit', ['ufo']);
      fixedMids(0, 'orbit', ['ufo']);
      expect($.G.mbUsed.filter((k: string) => k === 'ufo')).toHaveLength(1);
    });

    it('does not move with the script: the same seed gives the same picks before or after any number of stage-stream draws', () => {
      biomeReset();
      const a = stageMids(2, 'acid');
      $.G = run();
      biomeReset();
      for (let i = 0; i < 50; i++) midStream(1)(); // a fresh stream each call: nothing leaks between stages
      expect(stageMids(2, 'acid')).toEqual(a);
    });

    it('starts a descent fresh (biomeReset clears G.mb and G.mbUsed) but keeps each biome previous pair', () => {
      biomeReset();
      const p = stageMids(1, 'snot');
      biomeReset();
      expect($.G.mb).toEqual({});
      expect($.G.mbUsed).toEqual([]);
      expect($.G.mbLast.snot).toEqual(p);
    });

    it('sweeps 200 descents through the real forks: 2 different bodies per biome stage, 0 repeats per descent, never acid with snot', () => {
      $.G = run({ mbLast: {}, visited: [] });
      $.meta = { mb: {} };
      let stages = 0, bad = 0, maws = 0;
      const homes = new Set<string>();
      for (let d = 0; d < 200; d++) {
        $.G.loop = d % 4; // descents 1-4 of 50 runs' worth
        $.G.seed = 1000 + Math.floor(d / 4);
        if ($.G.loop === 0) $.G.visited = [];
        $.G.route = [null, null];
        biomeReset();
        fixedMids(0, 'orbit', ['ufo']);
        for (let seg = 0; seg < 2; seg++) {
          openFork(seg);
          const b = $.G.fork.opts[R() < .5 ? 0 : 1];
          $.G.fork = null;
          $.G.route[seg] = b;
          $.G.visited.includes(b) || $.G.visited.push(b);
          const p = stageMids(seg + 1, b);
          stages++;
          if (p.length !== 2 || MIDS[p[0]].body === MIDS[p[1]].body || MIDS[p[0]].tag === MIDS[p[1]].tag) bad++;
          if (p[0] === HOME[b]) homes.add(b);
          for (const k of p) meetMid(k); // met when they arrive
        }
        const used = $.G.mbUsed as string[], bodies = used.map((k) => MIDS[k].body);
        expect(new Set(bodies).size, `descent ${d}: ${used}`).toBe(bodies.length);
        if ($.G.route.includes('acid') && $.G.route.includes('snot')) maws++;
      }
      expect(stages).toBe(400);
      expect(bad).toBe(0);
      expect(maws).toBe(0);
      expect(homes.size).toBe(4); // every biome gets its home midboss on some routes
      // the weighting saw every midboss met: four biome midbosses x 400 slots, and the Orbit's Saucer is counted at spawn in play
      expect(Object.keys($.meta.mb).sort()).toEqual(['brood', 'choir', 'cyst', 'prentice']);
    });
  });

  describe('the fork rule (spec §6.5 interim)', () => {
    it('never offers snot after acid, or acid after snot; the first fork may offer both', () => {
      expect(forkAllows('snot', ['acid', null])).toBe(false);
      expect(forkAllows('acid', ['snot', null])).toBe(false);
      expect(forkAllows('ice', ['acid', null])).toBe(true);
      expect(forkAllows('acid', [null, null])).toBe(true);
      expect(forkAllows('acid', ['acid', null])).toBe(true); // a revisit is the other rules' business
      for (let i = 0; i < 50; i++) {
        $.G = run({ route: ['acid', null], visited: ['acid'] });
        openFork(1);
        expect($.G.fork.opts).not.toContain('snot');
        expect($.G.fork.opts).toHaveLength(2);
      }
    });
  });

  describe('filler suppression while a midboss is up (precondition of item K)', () => {
    it('skips biome spawn rolls and generator filler while a midboss fights, nothing else', () => {
      $.G.mini = { k: 'choir' };
      for (const k of ['corpse', 'flayer', 'fill:drones', 'fill:sentry']) expect(fillerQuiet(k), k).toBe(true);
      for (const k of ['set:morgue', 'pod', 'log', 'mid:cyst', 'boss:crux', 'ufo', 'warn', 'maw', 'o.debris', undefined]) expect(fillerQuiet(k as string), String(k)).toBe(false);
    });

    it('lets the filler back in once the midboss withdraws, dies or is gone', () => {
      $.G.mini = { k: 'ufo', drift: 1 };
      expect(miniUp()).toBe(true);
      $.G.mini.gone = 1;
      expect(fillerQuiet('corpse')).toBe(false);
      $.G.mini = { k: 'ufo', dead: true };
      expect(fillerQuiet('corpse')).toBe(false);
      $.G.mini = null;
      expect(fillerQuiet('corpse')).toBe(false);
    });

    it('leaves the short layout alone', () => {
      L.setLayout('short');
      try { $.G.mini = { k: 'choir' }; expect(fillerQuiet('corpse')).toBe(false); } finally { L.setLayout('long4'); }
    });

    it('counts exactly the biome script spawn kinds as filler', () => {
      expect([...BIOME_FILL].sort()).toEqual([...SPAWN_KINDS].sort());
      expect(isFiller('fill:anything')).toBe(true);
    });
  });
});

describe('midboss tables', () => {
  it('lists each biome own midboss first in B.mids, with the picker roster tag, and HOME agrees', () => {
    for (const b of BIOME_KEYS) {
      const M = BIOMES[b].mids;
      expect(M[0].k).toBe(HOME[b]);
      for (const m of M) expect(m.tag).toBe(MIDS[m.k].tag);
      expect(MID_NAMES[M[0].k]).toBe(M[0].name);
    }
  });

  it('gives slot A 1080 f, slot B 1260 f, and caps a RACE member at 900 f (spec §6.4)', () => {
    expect(slotClock('choir', 0)).toBe(1080);
    expect(slotClock('choir', 1)).toBe(1260);
    const defs = { ...MIDS, solvent: { body: 'solvent', tag: 'RACE' as const, min: 1 } };
    expect(slotClock('solvent', 0, defs)).toBe(900);
    expect(slotClock('solvent', 1, defs)).toBe(900);
  });

  it('refuses to build a midboss beat whose kind has no name, so a WARNING never shows a raw key', () => {
    L.setLayout('long4');
    try {
      $.G = run();
      const r = L.slotRow(0);
      expect(() => biomeScript(0, 'ice', r.gateLate!, 0, undefined, ['nobody', 'choir'])).toThrow(/midboss 'nobody' has no name/);
    } finally { L.setLayout('short'); }
  });

  it('counts a meeting in meta.mb', () => {
    $.meta = {};
    meetMid('choir');
    meetMid('choir');
    meetMid('ufo');
    expect($.meta.mb).toEqual({ choir: 2, ufo: 1 });
  });
});
