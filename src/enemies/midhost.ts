// Biome midbosses as crossovers (design/content-expansion.md §6.3, build plan LS1 row P0).
// Phase 1 of the content expansion puts each existing biome midboss into the other three biomes. A midboss whose
// host biome differs from its home biome is a "crossover": it keeps its body and attacks, but its vertical motion is
// fitted to the host's terrain (the Womb's bob was tuned to the acid lake, the others to their own caves), its
// ambient sim sparks take the host's palette, and its render takes the host's tint.
// In its home biome nothing here changes anything: every crossover branch is gated on isCross().
// Pure tables and formulas only (no DOM, no world access) so tests/unit/midhost.test.ts can drive them.

export type Biome = 'ice' | 'acid' | 'fire' | 'snot';
export type MidKind = 'choir' | 'cyst' | 'prentice' | 'brood';

/** each biome midboss's home biome (mirrors BIOMES[b].mid in src/biomes.ts; the test checks they agree) */
export const MID_HOME: Record<MidKind, Biome> = { choir: 'ice', cyst: 'acid', prentice: 'fire', brood: 'snot' };

/** the biome a midboss is fighting in: its spawn host, else its home */
export function midHost(e: { k: string; host?: string }): string | undefined {
  return e.host || MID_HOME[e.k as MidKind];
}

/** true when a biome midboss is fighting outside its home biome */
export function isCross(e: { k: string; host?: string }): boolean {
  const home = MID_HOME[e.k as MidKind];
  return !!home && !!e.host && e.host !== home;
}

/**
 * Body clearance for the terrain fit, in px from e.y: `up` above, `dn` below, `hw` half-width sampled for terrain.
 * Measured off the gross art (src/render/gross/midbosses.ts) at its largest pulse, hittable parts only (hanging
 * strands and drips may touch the terrain). up + dn stays under the 108 px minimum biome corridor
 * (shape() in src/biomes.ts) so a band always exists. Checked by `node tools/midboss-probe.mjs <url> matrix`.
 */
export const MID_BODY: Record<MidKind, { up: number; dn: number; hw: number }> = {
  choir: { up: 46, dn: 46, hw: 34 }, //   nailbars orbit at 31 px and are 15 px half-long: the bars must stay shootable
  cyst: { up: 28, dn: 30, hw: 28 }, //    membrane rim 22 px x 1.25 swell; the crown sits at -23
  prentice: { up: 30, dn: 30, hw: 18 }, // carcass ellipse -18..24, head and spit point to -24, cleaver arm below
  brood: { up: 28, dn: 28, hw: 26 }, //   sac rim 21-24 px x 1.16 heave; eyes at -16
};

/** how fast the fitted band relaxes when the terrain under the midboss opens up (per frame); it tightens at once */
export const BAND_EASE = 0.08;

/**
 * The y band a crossover body fits in, from the lowest ceiling and highest floor under its width:
 * [ceil + up, floor - dn]. If the corridor is too narrow for the body, both ends meet at its middle.
 * Writes into `out` (update.ts passes a module scratch array so the per-frame fit allocates nothing).
 */
export function bodyBand(k: MidKind, ceilMax: number, floorMin: number, out: number[] = [0, 0]): number[] {
  const b = MID_BODY[k];
  const lo = ceilMax + b.up, hi = floorMin - b.dn;
  if (lo <= hi) { out[0] = lo; out[1] = hi; return out; }
  out[0] = out[1] = (ceilMax + floorMin) / 2 + (b.up - b.dn) / 2;
  return out;
}

/** a native y clamped into the band */
export function fitY(y: number, lo: number, hi: number): number {
  return y < lo ? lo : y > hi ? hi : y;
}

/**
 * Ambient sim sparks for a crossover, in the host's palette. Each list replaces the home colours one for one, and
 * update.ts draws exactly as many R() values for a crossover as for a home fight (a pick() where the home colour
 * was already a draw, a frame-indexed entry where it was a constant), so a crossover adds no RNG draws. Telegraph-cue sparks (the Womb's crown fizz) keep their own colour for readability.
 */
export const HOST_SPARK: Record<Biome, readonly string[]> = {
  ice: ['#d8efff', '#8cc4ee', '#f2fbff'], //   frost glints (the Choir's own two, plus the cave edge)
  acid: ['#a6ff2a', '#7ff0d8', '#46e0c0'], //  bile fizz (the Womb's, plus the tank's teal)
  fire: ['#ffb347', '#ff6a1a', '#ffe2a0', '#ff3a10', '#fff1c0'], // core FIRE: embers
  snot: ['#f4e49a', '#d8e070', '#ecd25a'], //  mucus glints (the Sinus edge and the Brood's snot)
};

/**
 * Host tint over a crossover's body: a source-atop wash of the host's BIOMES[host].rgb (copied here so the render
 * path does not import biomes.ts; the unit test checks they agree) at alpha `a`. Low enough that the
 * body still reads as itself (it is the same creature, it wandered in) and its own telegraph glows still show.
 * Art-director tuning knob; see production/qa/evidence/ls1-p0.md for the 4x4 screenshot matrix.
 */
export const HOST_TINT: Record<Biome, { rgb: string; a: number }> = {
  ice: { rgb: '160,215,255', a: 0.26 }, // frost-blue; a touch stronger, the ice palette is pale and needs it to read
  acid: { rgb: '60,230,195', a: 0.22 },
  fire: { rgb: '255,120,30', a: 0.22 },
  snot: { rgb: '236,210,90', a: 0.2 },
};

/** the Brood Mother's alive cap on her hatchlings (the CROWD cap, spec §6.2; was 10). perf-probe brood scene */
export const BROOD_CAP = 8;
