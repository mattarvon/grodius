// Per-stage build streams and the run seed (D19 build plan LS1 row B2; spec design/content-expansion.md §4).
// Everything a stage BUILD draws comes from that stage's seed, never from the sim R(): the Orbit/Drive section
// variants, a biome's remix and its script rolls from Rs = stream(seedOf(runSeed, loop, stageIdx)), and (from item F)
// the midboss pick from its own sibling stream Rm = stream(midSeedOf(runSeed, loop, stageIdx)). So building
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

/** salt of the midboss pick's stream. Changing it re-rolls every run's midbosses, so it is pinned by a test */
export const MID_SALT = 0x4d1db055;

/** the 32-bit seed of one stage's midboss-pick stream (Rm): the stage seed hashed with MID_SALT. The pick gets its
 *  own stream, not a position in Rs, so its draws can't drift when the script's draw count changes (a tuned beat
 *  plan, a new tempo band, a repeat visit's remix), and adding, moving or removing the pick never shifts the script.
 *  The two are independent: build them in either order (sprint 2 review, carry-forward 4) */
export function midSeedOf(runSeed: number, loop: number, stageIdx: number) {
  return fmix(seedOf(runSeed, loop, stageIdx) ^ MID_SALT) || 0x6d2b79f5;
}

/** salt of the stage's build-picks stream (movement-B variant, set pieces; LS2-mv). Changing it re-rolls every run's
 *  picks, so it is pinned by a test */
export const PICK_SALT = 0x5e7b1c4d;

/** the 32-bit seed of one stage's build-picks stream: the stage seed hashed with PICK_SALT, the midboss pick's pattern.
 *  Its own stream, not a fresh copy of Rs: a fresh stream(seedOf(...)) would replay the script's first draws, so the
 *  set pieces would correlate with the script's opening rolls (game-design review) */
export function pickSeedOf(runSeed: number, loop: number, stageIdx: number) {
  return fmix(seedOf(runSeed, loop, stageIdx) ^ PICK_SALT) || 0x6d2b79f5;
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
