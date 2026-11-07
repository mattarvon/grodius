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
/** set pieces in a stage (layout beats.sets) */
export const SETS_PER_STAGE = 3;
/** the chance a first visit from Descent 2 on rolls B1 (spec §3.3: "may also roll B1") */
export const B1_FIRST_VISIT = .5;

const ALL: ReadonlySet<string> = new Set(Object.values(CATALOG).flat());
/** is v a catalogue set piece */
export const isSetId = (v: unknown) => typeof v === 'string' && ALL.has(v);

/** one stage's three set pieces in biome b, in play order, from rs. Writes `used[b]`. A piece is taken from the unused
 *  part of the catalogue; once that is empty the used set clears, and the pieces this stage already holds stay out */
export function drawSets(b: string, used: Record<string, string[]>, rs: () => number): string[] {
  const out: string[] = [], seen = (used[b] ||= []);
  while (out.length < SETS_PER_STAGE) {
    let pool = CATALOG[b].filter((id) => !seen.includes(id));
    if (!pool.length) { seen.length = 0; seen.push(...out); pool = CATALOG[b].filter((id) => !seen.includes(id)); }
    const id = pool[Math.floor(rs() * pool.length)];
    seen.push(id);
    out.push(id);
  }
  return out;
}

/** which movement B a stage flies: 0 (B0) on a first visit in Descent 1, 1 (B1) on a remix, and from Descent 2 a first
 *  visit may roll B1. v: earlier visits this run. Draws rs only on that roll */
export const moveRoll = (v: number, loop: number, rs: () => number) => (v > 0 ? 1 : loop > 0 && rs() < B1_FIRST_VISIT ? 1 : 0);

/** a stage's build picks: its movement-B variant, then its set pieces, both from rs (biomes.ts stagePicks stores them) */
export function drawPicks(b: string, v: number, loop: number, used: Record<string, string[]>, rs: () => number) {
  const mv = moveRoll(v, loop, rs);
  return { mv, sp: drawSets(b, used, rs) };
}
