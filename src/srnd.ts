// Render-side RNG (M2 #13, LS1-B1). Everything in src/render and src/fx draws from here, never from the sim RNG
// (R / rr / ri / pick in core.ts). The sim stream is what the harness seeds and replays; a render-side draw there
// would make the sim depend on the frame rate, the render path taken, sprite load timing and the HELL FLASHES
// setting. This stream is its own xorshift32, so render may draw as often as it likes without moving the sim.
// tests/unit/rng-split.test.ts fails if a render or fx file imports the sim RNG or calls Math.random.
let seed = 0x9e3779b9;
/** render-only uniform [0, 1) */
export function srnd() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
/** render-only uniform [a, b) (the srnd twin of core rr) */
export const srr = (a: number, b: number) => a + srnd() * (b - a);
/** render-only integer in [a, b] (the srnd twin of core ri) */
export const sri = (a: number, b: number) => Math.floor(srr(a, b + 1));
/** render-only pick of one element (the srnd twin of core pick) */
export const spick = <T>(a: readonly T[]): T => a[Math.floor(srnd() * a.length)];
