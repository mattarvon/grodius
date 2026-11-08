// The set-piece catalogue and the stage's build picks (spec §3.3, §10; build plan LS2-mv). Each biome has five set
// pieces, three per stage, drawn without replacement per run: the used set G.spUsed lives on the run and is stored in
// the run save, and when a biome runs out its pool refills. Pure: no imports, so runsave.ts can check saved ids against
// the catalogue and tests load it without a DOM. The pieces themselves are biomes.ts SET.

/** the biome's five: its signature, its remix signature, three more (tests/unit/setdraw.test.ts keeps it in step with
 *  biomes.ts SET and BIOMES) */
export const CATALOG: Readonly<Record<string, readonly string[]>> = {
  ice: ['morgue', 'crucify', 'thaw', 'vigil', 'pack'],
  acid: ['walls', 'gutter', 'slurry', 'vats', 'lining'],
  fire: ['pincer', 'kiln', 'meatline', 'backdraft', 'cinders'],
  snot: ['flood', 'drip', 'sneeze', 'clot', 'congestion'],
};
/** how heavy each piece is, for slot order only: S2 sits in movement B, where the spec wants lighter spawns ("the terrain
 *  is the threat"), so it takes the lightest of the three. A proxy summed from biomes.ts SET: corpse 1, mutant 2.5, flayer 2,
 *  eye/cross/hook 1.5, womb 2, slime/crawler 1, drone .7, hatchling .6 (mean of ri). Never used for the draw itself */
export const SETW: Readonly<Record<string, number>> = {
  morgue: 5.5, crucify: 7, thaw: 3, vigil: 4, pack: 7,
  walls: 4.8, gutter: 7.5, slurry: 5.2, vats: 5.5, lining: 6,
  pincer: 5.4, kiln: 10, meatline: 6.5, backdraft: 6.7, cinders: 4.1,
  flood: 9.8, drip: 7, sneeze: 6.6, clot: 6.1, congestion: 5,
};
/** set pieces in a stage (layout beats.sets); the light slot is S2, index 1 */
export const SETS_PER_STAGE = 3;
const LIGHT = 1;
/** the chance a first visit from Descent 2 on rolls B1 (spec §3.3: "may also roll B1") */
export const B1_FIRST_VISIT = .5;

const ALL: ReadonlySet<string> = new Set(Object.values(CATALOG).flat());
/** is v a catalogue set piece */
export const isSetId = (v: unknown) => typeof v === 'string' && ALL.has(v);

/** one stage's three set pieces in biome b, in play order, from rs. Writes `used[b]`. A piece is taken from the unused
 *  part of the catalogue; once that is empty the used set clears, and the pieces this stage already holds stay out.
 *  Then the lightest of the three moves to S2 (the others keep their drawn order): no extra draw */
export function drawSets(b: string, used: Record<string, string[]>, rs: () => number): string[] {
  const out: string[] = [], seen = (used[b] ||= []);
  while (out.length < SETS_PER_STAGE) {
    let pool = CATALOG[b].filter((id) => !seen.includes(id));
    if (!pool.length) { seen.length = 0; seen.push(...out); pool = CATALOG[b].filter((id) => !seen.includes(id)); }
    const id = pool[Math.floor(rs() * pool.length)];
    seen.push(id);
    out.push(id);
  }
  let li = 0;
  for (let i = 1; i < out.length; i++) if ((SETW[out[i]] ?? 0) < (SETW[out[li]] ?? 0)) li = i;
  const [light] = out.splice(li, 1);
  out.splice(LIGHT, 0, light);
  return out;
}

/** which movement B a stage flies. v: earlier visits this run; seen: the variants this biome has flown this run (bit 0
 *  B0, bit 1 B1). A first visit flies B0 in Descent 1 and from Descent 2 may roll B1 (spec §3.3). A remix flies the
 *  variant the biome hasn't flown yet, so a run that met it on B1 still sees B0 (game-design review: Pillar 4, no
 *  repeat), and B1 (the spec's remix variant) once both are spent. Draws rs only on the first-visit roll */
export const moveRoll = (v: number, loop: number, rs: () => number, seen = 0) =>
  v > 0 ? (seen === 2 ? 0 : 1) : loop > 0 && rs() < B1_FIRST_VISIT ? 1 : 0;

/** a stage's build picks: its movement-B variant, then its set pieces, both from rs (biomes.ts stagePicks stores them).
 *  Writes used[b] and mvSeen[b] (the run's variant bits for biome b) */
export function drawPicks(b: string, v: number, loop: number, used: Record<string, string[]>, rs: () => number, mvSeen: Record<string, number> = {}) {
  const mv = moveRoll(v, loop, rs, mvSeen[b] || 0);
  mvSeen[b] = (mvSeen[b] || 0) | (1 << mv);
  return { mv, sp: drawSets(b, used, rs) };
}
