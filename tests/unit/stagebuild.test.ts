import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $ } from '../../src/state';

// LS1 rows C and B2: each stage is built by buildStage(i, fromX). These pin that the per-stage build of the short
// layout places Descent 1 exactly as the old up-front buildScript did, dispatches a biome stage to its slot, and merges
// into the live script. tests/unit/buildstream.test.ts covers the build streams (no sim RNG, rebuilds identical).
// The LS1 sprint 2 studio review added two more (production/content-build-plan.md, carry-forward items 2 and 3):
// long4 rebuild stability through buildStage for every row, and every row's first entry clear of its stage start.
//
// The real biomes module is loaded (its draws are all on the build stream), so the core mock THROWS on any sim RNG
// call, as in buildstream.test.ts. biomeStage is a spy: a no-op for the short dispatch test, the real build for the
// rest (`realBiome`, below).
const simDraw = () => { throw new Error('a stage build drew the sim RNG'); };
vi.mock('../../src/core', () => ({
  C: { blood: '', bloodD: '', bloodL: '' }, DC: ['', '', '', '', '', ''], FIRE: [], H: 270, PH: 254, TAU: Math.PI * 2, TS: 4, W: 480,
  R: simDraw, rr: simDraw, ri: simDraw, pick: simDraw,
  clamp: (v: number) => v, ctx: {}, dist2: () => 0, hash: () => 0, lerp: (a: number) => a, sstep: () => 0, vnoise: () => 0,
}));
vi.mock('../../src/world', () => ({ CEIL: new Float32Array(4), FLOOR: new Float32Array(4), ceilAt: () => 0, floorAt: () => 0, shots: [], enemies: [] }));
vi.mock('../../src/textures', () => ({ mkTex: () => ({}) }));
vi.mock('../../src/audio', () => ({ sfx: {}, sample: () => {} }));
vi.mock('../../src/platform', () => ({ buzz: () => {} }));
vi.mock('../../src/fx/spawn', () => ({ spark: () => {}, drop: () => {}, flash: () => {}, gore: () => {}, pop: () => {}, mist: () => {} }));
const noop = () => {};
vi.mock('../../src/enemies/spawn', () => ({
  banner: noop, behindWave: noop, butcher: noop, corpse: noop, crawler: noop, crossT: noop, eyeT: noop, flayer: noop, formation: noop,
  hatch: noop, hookE: noop, logLine: noop, maw: noop, midboss: noop, miniWarn: noop, womb: noop, crux: noop, mutant: noop, slime: noop, sentry: noop,
}));
vi.mock('../../src/render/util', () => ({ glow: noop, light: noop }));
vi.mock('../../src/stages', () => ({ startStage: noop }));
vi.mock('../../src/render/biomeart', () => ({ drawFX: noop, biomePat: noop, biomeTerrainFill: noop, biomeEdge: noop, drawBiomeBG: noop, drawBiomeDecor: noop, splatCols: noop, biomeDark: noop, biomeMist: noop }));
vi.mock('../../src/boss/update', () => ({ startBoss: noop }));
vi.mock('../../src/enemies/ufo', () => ({ ufoWarn: noop }));
const biomeStage = vi.fn();
const realBiome = vi.hoisted(() => ({ stage: null as null | ((seg: number, from: number) => void) }));
vi.mock('../../src/biomes', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/biomes')>();
  realBiome.stage = real.biomeStage;
  return { ...real, biomeStage: (...a: unknown[]) => biomeStage(...a) };
});

const { stageScript } = await import('../../src/enemies/scripts');
const { seedOf, stream } = await import('../../src/rng');
const { buildStage } = await import('../../src/stagebuild');
const { BIOME_KEYS } = await import('../../src/biomes');
const { LAYOUTS, lastStage, nSlots, row, setLayout } = await import('../../src/layout');

type Entry = { x: number; k?: string };
const list = (S: Entry[]) => S.map((e) => `${e.x}:${e.k}`);

// the script x list at Descent 1's start, tools/layout-parity.baseline.json run 1 stage 0-0 (the classic variants;
// recorded from the old up-front buildScript). The exact numbers are the point
const D1 = [200, 400, 500, 580, 660, 730, 800, 980, 1040, 1100, 1220, 1320, 1400, 1500, 1620, 1700, 1760, 1880, 1900, 2000, 2120,
  8430, 8440, 8520, 8580, 8650, 8730, 8760, 8790, 8850, 8920, 8990, 9060, 9150, 9300];

/** every non-biome stage of a descent, each built as on its entry */
function buildDescent() {
  for (let i = 0; i <= lastStage(); i++) if (row(i)!.kind !== 'biome') buildStage(i);
}

describe('buildStage (short layout)', () => {
  beforeEach(() => {
    setLayout('short');
    $.G = { loop: 0, seed: 1, script: [], si: 0, route: [null, null], visitNo: [0, 0] };
    biomeStage.mockReset();
  });

  it('places Descent 1 exactly as the old up-front build did', () => {
    buildDescent();
    expect($.G.script.map((e: { x: number }) => e.x)).toEqual(D1);
  });

  it('keeps every script x inside its own stage row, in every descent', () => {
    for (const L of [0, 1, 2]) {
      $.G.loop = L;
      for (const i of [0, 3]) {
        const r = row(i)!;
        for (const e of stageScript(i, stream(seedOf(1, L, i)))) expect(e.x >= r.x0 && e.x < r.x1).toBe(true);
      }
    }
  });

  it('builds a biome stage through its slot, from the gate x', () => {
    buildStage(2, 5637);
    expect(biomeStage).toHaveBeenCalledWith(1, 5637);
  });

  it('merges a stage into the unplayed script, sorted, leaving the played part alone', () => {
    buildStage(3);
    $.G.si = 2;
    const played = $.G.script.slice(0, 2);
    buildStage(0);
    expect($.G.script.slice(0, 2)).toEqual(played);
    const xs = $.G.script.slice(2).map((e: { x: number }) => e.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });
});

// ---------------- shared fixtures for the long4 and every-layout tests ----------------
// gate x per slot (G.bx[slot], choose(): scroll + W + 10 at the fork), as the parity bots take them: short from
// tools/layout-parity.baseline.json (2658.007 / 5637.022), long4 from a long4 run of the same tool (4738.007 /
// 8487.022, first biome entries 4538.007 / 8287.022). Each sits inside [row x0, row gateLate]
const GATES: Record<string, number[]> = { short: [2658.007, 5637.022], long4: [4738.007, 8487.022] };
const ROUTE = ['acid', 'ice'], VISITS = [0, 1]; // slot 1 is a repeat visit, so the remix draws are covered too
const SEED = 0xc0ffee;

/** the run state a stage build reads (the resume inputs: G.seed, G.loop, G.route, G.visitNo, G.remixV, G.bx). remixV
 *  is copied, so every build starts from the same memory and draws again (pickPlanned returns a stored pick unread) */
function runState(seed: number, loop: number, remixV: object = {}) {
  return { seed, loop, script: [], si: 0, pend: [], route: [...ROUTE], visitNo: [...VISITS], remixV: structuredClone(remixV),
    bx: [...GATES[layoutId()], null] };
}
let currentLayout = 'short';
const layoutId = () => currentLayout;
/** setLayout, only ever called before a run state is made (its contract: before newGame) */
function useLayout(id: string) { setLayout(id); currentLayout = id; }

/** build stage i as on its entry (a biome stage from its stored gate, G.bx[slot]) into an empty script; its x/kind list */
function built(i: number): string[] {
  $.G.script = []; $.G.si = 0;
  const r = row(i)!;
  buildStage(i, r.kind === 'biome' ? $.G.bx[r.slot!] : undefined);
  return list($.G.script);
}
/** every stage of a descent, built one at a time from the same run state */
const descent = (seed: number, loop: number, remixV?: object) => {
  const out: string[][] = [];
  for (let i = 0; i <= lastStage(); i++) { $.G = runState(seed, loop, remixV); out.push(built(i)); }
  return out;
};
/** G.remixV after Descent 1's stages are built (the cell and section memory a Descent 2 build reads) */
function memoryAfterDescent1(seed: number) {
  $.G = runState(seed, 0);
  for (let i = 0; i <= lastStage(); i++) built(i);
  return structuredClone($.G.remixV);
}

describe('buildStage (long4): a rebuild from the same inputs is the same stage', () => {
  beforeEach(() => {
    biomeStage.mockReset();
    biomeStage.mockImplementation((seg: number, from: number) => realBiome.stage!(seg, from));
    useLayout('long4');
  });
  afterEach(() => { useLayout('short'); });

  it('covers all four long4 rows: Orbit, both biome slots and the Drive', () => {
    expect([0, 1, 2, 3].map((i) => row(i)!.kind)).toEqual(['orbit', 'biome', 'biome', 'drive']);
    expect(nSlots()).toBe(2);
  });

  it('builds every row twice to the same script, in Descent 1 and Descent 2', () => {
    for (const loop of [0, 1]) {
      const mem = loop ? memoryAfterDescent1(SEED) : {};
      for (let i = 0; i <= lastStage(); i++) {
        $.G = runState(SEED, loop, mem);
        const a = built(i);
        $.G = runState(SEED, loop, mem);
        const b = built(i);
        expect(a.length).toBeGreaterThan(10);
        expect(a.every((s) => !s.endsWith(':undefined'))).toBe(true); // every entry names what it spawns
        expect(b).toEqual(a);
      }
    }
  });

  it('gives another run seed a different script on every row', () => {
    const a = descent(SEED, 1, memoryAfterDescent1(SEED)), b = descent(SEED + 1, 1, memoryAfterDescent1(SEED));
    for (let i = 0; i <= lastStage(); i++) expect(b[i], `row ${i}`).not.toEqual(a[i]);
  });

  it('gives another descent a different script on every row', () => {
    const mem = memoryAfterDescent1(SEED);
    const a = descent(SEED, 1, mem), b = descent(SEED, 2, mem);
    for (let i = 0; i <= lastStage(); i++) expect(b[i], `row ${i}`).not.toEqual(a[i]);
  });

  it('builds short\'s scripts again once the layout is switched back to short', () => {
    // Arrange: short's descent before long4 is ever built, then a long4 descent
    useLayout('short');
    const before = descent(SEED, 1);
    useLayout('long4');
    const long = descent(SEED, 1);
    // Act: back to short, a fresh run state (setLayout comes before the run, never during one)
    useLayout('short');
    const after = descent(SEED, 1);
    // Assert
    expect(after).toEqual(before);
    expect(after).not.toEqual(long);
    $.G = runState(1, 0);
    buildDescent();
    expect($.G.script.map((e: { x: number }) => e.x)).toEqual(D1);
  });
});

// ---------------- every row's first entry clears its stage start ----------------
// runScript fires every entry with x <= scroll, and a stage's entries are inserted when it is built, so an entry
// that sits behind the scroll at that moment fires at once, on the same frame as the stage card, with no lead-in
// (ls1-c.md "Stubs and open risks"). Where each stage starts, in scroll x:
// - stage 0: scroll 0 (startLoop, then startStage(0)).
// - a biome row: built at its gate, at scroll = gate x - W - 10 (choose()). The latest gate (row.gateLate) is the
//   worst case, and the earliest (row.x0) is checked too.
// - any other row after a biome row (the Drive): startStage runs 200 f after the biome boss's clear, which every
//   parity run puts 347.9-348.9 px of scroll past that boss's bossX, in both layouts (short: 8367.916-8368.851 against
//   bossX 8020, tools/layout-parity.baseline.json stage 0-3; long4: 11897.916 against 11550, a long4 run of the same
//   tool). CLEAR_TO_ENTRY rounds the latest up. It is a measurement: re-measure it if the clear or the 200 f delay moves.
const W_ = 480, CLEAR_TO_ENTRY = 349;
// MARGIN: 60 px is one second of scroll at the base speed (1 px a frame), the least lead-in a stage's first wave
// gets after the stage card. Short's tightest row today is the Drive at 8430 - (8020 + 349) = 61 (62 against the
// measured 8367.9), so 60 passes short; a start that moves even 2 px later, or past the first entry, fails.
const MARGIN = 60;

/** the scroll x stage i starts at on entry, worst case (see above); biome rows take their gate x */
function entryScroll(i: number, gate?: number) {
  const r = row(i)!;
  if (i === 0) return 0;
  if (r.kind === 'biome') return gate! - W_ - 10;
  return row(i - 1)!.bossX + CLEAR_TO_ENTRY;
}

/** KNOWN FAIL (reported, not fixed here): long4's Drive starts at scroll ~11898 (11550 + 348) but its first entries
 *  sit at 11880 (the GRAVITY RISING log line, x0 + 130, src/enemies/scripts.ts) and 11890 (the floor cell, x0 + 140,
 *  src/layout.ts LONG4_DRIVE_PLAN), so both fire on the Drive's first frame; measured with a long4 parity run (stage
 *  0-3 scroll0 11897.916, script head 11880, 11890, 11970). it.fails keeps the rule in force: when the row or the
 *  script moves clear, this case turns red and the marker must go */
const knownFail = (_id: string, _kind: string) => false; // long4's Drive fixed: its first beats moved to x0 + 230

describe('every layout row: the first entry clears the stage start', () => {
  beforeEach(() => {
    biomeStage.mockReset();
    biomeStage.mockImplementation((seg: number, from: number) => realBiome.stage!(seg, from));
  });
  afterEach(() => { useLayout('short'); });

  for (const id of Object.keys(LAYOUTS)) {
    const rows = LAYOUTS[id as keyof typeof LAYOUTS]!.stages;
    rows.forEach((r, i) => {
      const name = `${id} row ${i} (${r.kind}) fires its first entry at least ${MARGIN} px after its start`;
      (knownFail(id, r.kind) ? it.fails : it)(name, () => {
        useLayout(id);
        const gates = r.kind === 'biome' ? [r.x0, r.gateLate!] : [undefined];
        for (const loop of [0, 1, 2]) for (const seed of [1, SEED]) for (const gate of gates) {
          // Arrange: every biome on this slot, first and repeat visit, at this gate
          const biomes = r.kind === 'biome' ? BIOME_KEYS : [null];
          for (const b of biomes) for (const v of r.kind === 'biome' ? [0, 1] : [0]) {
            $.G = runState(seed, loop);
            if (r.kind === 'biome') { $.G.route[r.slot!] = b; $.G.visitNo[r.slot!] = v; $.G.bx[r.slot!] = gate; }
            // Act
            $.G.script = []; $.G.si = 0;
            buildStage(i, gate);
            const first = Math.min(...$.G.script.map((e: Entry) => e.x));
            // Assert
            expect($.G.script.length).toBeGreaterThan(0);
            expect(first - entryScroll(i, gate), `${id} row ${i} loop ${loop} seed ${seed} gate ${gate} ${b ?? ''} v${v}`).toBeGreaterThanOrEqual(MARGIN);
          }
        }
      });
    });
  }

  it('uses a start model that matches the measured stage starts', () => {
    // short: the parity baseline's Drive start, and the biome builds at the parity gates (2168.007 / 5147.022 scroll)
    useLayout('short');
    expect(entryScroll(3)).toBeCloseTo(8368.9, 0);
    expect(entryScroll(1, GATES.short[0])).toBeCloseTo(2168.007, 3);
    // long4: the long4 run's Drive start (11897.916)
    useLayout('long4');
    expect(entryScroll(3)).toBeGreaterThanOrEqual(11897.916);
    expect(entryScroll(3) - 11897.916).toBeLessThan(2);
  });
});
