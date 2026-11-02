// Per-stage build streams and the run seed (D19 build plan LS1 row B2; spec design/content-expansion.md §4).
// Everything a stage BUILD draws (the Orbit/Drive section variants, a biome's remix, its script rolls, and from item
// F the midboss pick) comes from Rs = stream(seedOf(runSeed, loop, stageIdx)), never from the sim R(). So building
// stage i again from the same run seed gives the same script x and kind list, whenever and however often it runs:
// what a resume (item H) needs. Spawn-time rolls (side, y, formation size, elite status, in-flight behaviour) stay on
// the sim R() (spec §4 "What is not reproduced").
//
// Modelled on src/srnd.ts: xorshift32, no Math.random. Pure: no imports, so tests load it without a DOM.

/** fmix32 (MurmurHash3's finaliser): spreads every input bit over the output */
function fmix(h: number) {
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** the 32-bit seed of one stage's build stream: a hash of the run seed, the descent (loop) and the stage index */
export function seedOf(runSeed: number, loop: number, stageIdx: number) {
  let h = fmix((runSeed >>> 0) ^ 0x9e3779b9);
  h = fmix(h ^ Math.imul((loop | 0) + 1, 0x27d4eb2f));
  h = fmix(h ^ Math.imul((stageIdx | 0) + 1, 0x165667b1));
  return h || 0x6d2b79f5; // xorshift's one forbidden state
}

/** a seeded uniform [0, 1) generator (xorshift32): the same seed always gives the same sequence */
export function stream(seed: number): () => number {
  let s = seed >>> 0 || 0x6d2b79f5;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** a stream's integer in [a, b] (the twin of core ri; pickV) */
export const rsInt = (rs: () => number, a: number, b: number) => Math.floor(a + rs() * (b - a + 1));

/** a new run seed from one sim R() draw (newGame): a seeded tool run replays the same run seed, a real run gets a
 *  fresh one. Stored in G.seed and in the run save (runsave.ts `seed`) */
export const newRunSeed = (R: () => number) => Math.floor(R() * 4294967296) >>> 0;
