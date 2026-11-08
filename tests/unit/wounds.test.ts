// LS2-read item 2: remix visits draw the wound look (src/render/wounds.ts, art spec plan/wounds.md). The look table must
// never enter the lime band enemy bullets own, must keep each biome's identity, the slot lookup must agree with biomeK,
// and each wound layer must get its own seed.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { stubDom } from './fakecanvas';
import { routeArt } from '../../src/warmplan';
import { setLayout } from '../../src/layout';

let WD: typeof import('../../src/render/wounds');
let BI: any, $: any;
const BIOMES4 = ['ice', 'acid', 'fire', 'snot'];
const src = readFileSync(new URL('../../src/render/wounds.ts', import.meta.url), 'utf8');

beforeAll(async () => {
  stubDom();
  ({ $ } = await import('../../src/state'));
  BI = await import('../../src/biomes');
  WD = await import('../../src/render/wounds');
});
afterAll(() => vi.unstubAllGlobals());

/** HSL of an 'r,g,b' triple: hue in degrees, s and l in 0..1 */
function hsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return { h, s, l };
}
/** spec §7 forbidden band: hue 65..150, S > 25%, L > 15% */
const inLimeBand = ({ h, s, l }: { h: number; s: number; l: number }) => h >= 65 && h <= 150 && s > .25 && l > .15;
const parse = (c: string): number[] => {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex) { const n = parseInt(hex[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  return c.replace(/^rgba?\(/, '').split(',').slice(0, 3).map(Number);
};
/** every colour-looking string in a WOUND row */
function colours(row: any): string[] {
  const out: string[] = [];
  const walk = (v: any) => {
    if (typeof v === 'string' && (/^#[0-9a-f]{6}$/i.test(v) || /^\d+,\d+,\d+$/.test(v))) out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
  };
  Object.values(row).forEach(walk);
  return out;
}

describe('WOUND look table', () => {
  it('has a row for each of the four biomes with every field the renderer reads', () => {
    for (const b of BIOMES4) {
      const w = (WD.WOUND as any)[b];
      expect(w, b).toBeTruthy();
      expect(w.bg).toHaveLength(2);
      expect(w.dc).toHaveLength(BI.BIOMES[b].gore.length);
      expect(w.splat).toHaveLength(3);
      expect(typeof w.edge).toBe('string');
      expect(typeof w.mist).toBe('string');
      expect(typeof w.dark).toBe('number');
    }
  });

  it('puts no colour in the lime band enemy bullets own (hue 65-150, S > 25%, L > 15%)', () => {
    for (const b of BIOMES4) for (const c of colours((WD.WOUND as any)[b])) expect(inLimeBand(hsl(...(parse(c) as [number, number, number]))), `${b} ${c}`).toBe(false);
  });

  it('puts no literal colour in the lime band anywhere in the wound painters, overlays or gate motifs', () => {
    const lits = [...src.matchAll(/#[0-9a-f]{6}\b|rgba?\(\d+,\d+,\d+/gi)].map((m) => m[0]);
    expect(lits.length).toBeGreaterThan(30);
    for (const c of lits) expect(inLimeBand(hsl(...(parse(c) as [number, number, number]))), c).toBe(false);
  });

  it('flags the bullet colour itself, so the band check is known to bite', () => {
    expect(inLimeBand(hsl(0xb6, 0xff, 0x3a))).toBe(true);
    expect(inLimeBand(hsl(150, 255, 40))).toBe(true);
  });

  it('keeps each biome\'s identity colour: gates read B.col, which the wound never replaces, and the carrier is in the painters', () => {
    for (const b of BIOMES4) expect(Object.keys((WD.WOUND as any)[b])).not.toContain('col');
    // the named carriers of spec §3: the ice pool surface, the fire embers, the acid tide line, the snot pus core
    expect(src).toContain('rgba(159,216,255,.35)');
    expect(src).toContain("'#ff7a1a'");
    expect(src).toContain('rgba(63,232,200,.5)');
    expect(src).toContain('rgba(236,210,90,.38)');
  });

  it('never lifts the darkness overlay below its biome\'s (dark scales the overlay: higher is darker; spec §7 rule 1)', () => {
    for (const b of BIOMES4) expect((WD.WOUND as any)[b].dark, b).toBeGreaterThanOrEqual(BI.BIOMES[b].dark ?? 1);
  });
});

describe('woundAt / woundLook', () => {
  beforeEach(() => { $.G = { scroll: 0, route: ['ice', 'fire'], bx: [1000, 4000, 7000], visitNo: [0, 1] }; });

  it('picks the same slot biomeK picks, everywhere along the route', () => {
    for (let wx = 0; wx < 8000; wx += 37) {
      const s = WD.woundAt(wx), [b] = BI.biomeK(wx);
      expect(s < 0 ? null : $.G.route[s], `wx ${wx}`).toBe(b);
    }
  });

  it('is a wound only on a slot whose visit number is 1 or more', () => {
    expect(WD.woundLook(2500)).toBeNull(); // slot 0, first visit
    expect(WD.woundLook(5500)).toBe(WD.WOUND.fire); // slot 1, a remix
  });

  it('treats visit 2 and beyond as the same single wound state', () => {
    $.G.visitNo = [3, 2];
    expect(WD.woundLook(2500)).toBe(WD.WOUND.ice);
  });

  it('is never a wound off the route, before the first gate, or with no visit numbers (a LAB jump\'s are all 0)', () => {
    expect(WD.woundAt(100)).toBe(-1);
    $.G.visitNo = undefined;
    expect(WD.woundLook(5500)).toBeNull();
    $.G = null;
    expect(WD.woundAt(5500)).toBe(-1);
    expect(WD.woundDC()).toBeNull();
  });

  it('skips empty route slots and is never a wound for a biome with no WOUND row', () => {
    $.G.route = [null, 'fire'];
    expect(WD.woundAt(2500)).toBe(-1); // slot 0 empty, slot 1 not faded in yet
    expect(WD.woundAt(5500)).toBe(1);
    $.G.route = ['ice', 'no-such-biome']; $.G.visitNo = [1, 1];
    expect(WD.woundLook(5500)).toBeNull();
  });

  it('is never a wound with no gate positions or with a visitNo shorter than the route', () => {
    $.G.visitNo = [1];
    expect(WD.woundLook(5500)).toBeNull();
    $.G.bx = undefined;
    expect(WD.woundAt(5500)).toBe(-1);
    expect(WD.woundLook(5500)).toBeNull();
  });

  it('gives drawDrops the wound drop colours only past the halfway crossfade, like the other look readers', () => {
    $.G.visitNo = [1, 1];
    while (WD.warmWound('fire')); while (WD.warmWound('ice'));
    $.G.scroll = 5500 - 240; // the screen centre (scroll + W / 2) deep in slot 1
    expect(WD.woundDC()).toBe(WD.WOUND.fire.dc);
    $.G.scroll = 1000 - 270 - 240; // early in slot 0's fade-in: slot 0 wins, but at k < .5
    expect(WD.woundAt($.G.scroll + 240)).toBe(0);
    expect(WD.woundDC()).toBeNull();
    WD.dropWound('fire'); WD.dropWound('ice');
  });

  it('keeps the fog, edge, darkness and gore colours normal until the wound layers are built, like the background', () => {
    $.G.visitNo = [1, 1];
    $.G.scroll = 5500 - 240;
    const B = BI.BIOMES.fire, W0 = WD.WOUND.fire as any;
    WD.dropWound('fire');
    expect(WD.woundLive(5500)).toBeNull();
    expect(WD.woundDC()).toBeNull();
    expect(BI.biomeEdge()).toBe(B.edge);
    expect(BI.biomeMist()).toBe(B.mist);
    while (WD.warmWound('fire'));
    expect(WD.woundLive(5500)).toBe(W0);
    expect(WD.woundDC()).toBe(W0.dc);
    expect(BI.biomeEdge()).toBe(W0.edge);
    expect(BI.biomeMist()).toBe(W0.mist);
    expect(BI.splatCols()).toBe(W0.splat);
    WD.dropWound('fire');
  });

  it('reads $.G and writes nothing into it', () => {
    const before = JSON.stringify($.G);
    WD.woundAt(5500); WD.woundLook(5500); WD.woundDC();
    expect(JSON.stringify($.G)).toBe(before);
  });
});

describe('wound layer seeds', () => {
  it('gives every wound layer a distinct seed from the whole key, where lay()\'s first/last/length seed would collide', () => {
    const keys = WD.WOUND_KEYS;
    expect(keys).toHaveLength(8);
    const seeds = keys.map(WD.fnv);
    expect(new Set(seeds).size).toBe(8);
    // lay()'s seed (biomeart.ts) for comparison: iceFarW and iceMidW collide there, which is why wounds.ts does not use it
    const laySeed = (k: string) => k.length * 7919 + k.charCodeAt(0) * 131 + k.charCodeAt(k.length - 1) * 17;
    expect(laySeed('iceFarW')).toBe(laySeed('iceMidW'));
    expect(WD.fnv('iceFarW')).not.toBe(WD.fnv('iceMidW'));
    expect(WD.fnv('snotFarW')).not.toBe(WD.fnv('snotMidW'));
  });

  it('is the same seed every call, so a dropped and rebuilt layer is the same art', () => {
    expect(WD.fnv('acidFarW')).toBe(WD.fnv('acidFarW'));
  });
});

describe('wound warm unit', () => {
  beforeEach(() => setLayout('long4'));

  it('is wanted for every biome visited this run, and not for one never chosen', () => {
    const G = { stage: 0, route: ['fire', null], mb: { 1: ['choir', 'brood'] }, bvis: { fire: 1 } };
    expect(routeArt(G)).toEqual(['choir', 'brood', 'butcher', 'wound:fire']);
  });

  it('stays wanted after the biome\'s stage is over, until a new run clears bvis', () => {
    const G = { stage: 5, route: ['ice', 'acid'], mb: {}, bvis: { ice: 1, acid: 2 } };
    expect(routeArt(G)).toEqual(['wound:ice', 'wound:acid']);
    expect(routeArt({ ...G, bvis: {} })).toEqual([]);
  });

  it('builds in two slices, far then mid, and drops both', () => {
    expect(WD.woundSlices('ice')).toBe(2);
    expect(WD.woundBuilt('ice')).toBe(false);
    expect(WD.warmWound('ice')).toBe(true);
    expect(WD.wBuilt('iceFarW')).toBeTruthy();
    expect(WD.wBuilt('iceMidW')).toBeNull();
    expect(WD.warmWound('ice')).toBe(false);
    expect(WD.woundBuilt('ice')).toBe(true);
    WD.dropWound('ice');
    expect(WD.woundBuilt('ice')).toBe(false);
  });

  it('splits the infected sinus wall into two passes, so the unit takes three slices and the far layer appears only when whole', () => {
    expect(WD.woundSlices('snot')).toBe(3);
    expect(WD.warmWound('snot')).toBe(true);
    expect(WD.wBuilt('snotFarW')).toBeNull(); // half painted: not shown yet
    expect(WD.warmWound('snot')).toBe(true);
    expect(WD.wBuilt('snotFarW')).toBeTruthy();
    expect(WD.warmWound('snot')).toBe(false);
    expect(WD.woundBuilt('snot')).toBe(true);
  });

  it('counts a half-built wound as held, so the drop pass frees it on a new run, while the warm check still wants both layers', () => {
    WD.dropWound('snot');
    expect(WD.woundHeld('snot')).toBe(false);
    WD.warmWound('snot'); // the first of the far layer's two passes
    expect(WD.woundHeld('snot')).toBe(true);
    expect(WD.woundBuilt('snot')).toBe(false);
    WD.dropWound('snot');
    expect(WD.woundHeld('snot')).toBe(false);
  });

  it('drops by held and warms by built in the runner (warmup.ts)', () => {
    const w = readFileSync(new URL('../../src/render/warmup.ts', import.meta.url), 'utf8');
    expect(w).toContain('held: () => woundHeld(b)');
    expect(w).toContain('(u.held || u.built)!()');
  });

  it('forgets a half-built layer on drop, so a rebuild starts from the first pass', () => {
    WD.dropWound('snot');
    WD.warmWound('snot');
    WD.dropWound('snot');
    expect(WD.warmWound('snot')).toBe(true);
    expect(WD.wBuilt('snotFarW')).toBeNull();
  });

  it('is registered as a warm unit for every biome (warmup.ts)', () => {
    const w = readFileSync(new URL('../../src/render/warmup.ts', import.meta.url), 'utf8');
    for (const b of BIOMES4) expect(w).toContain(`'wound:${b}': wnd('${b}')`);
  });
});
