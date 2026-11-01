// @ts-nocheck
// Best-grade keys by stage KIND (spec design/content-expansion.md §7 "Best grades", plan item H0).
// The old key was stageLabel() = `${loop+1}-${stage+1}`: a slot number, which stops meaning anything once the long
// layouts rearrange stage kinds. The new key is `${loop+1}-${kind}` (loop part still 1-based): 1-orbit, 1-ice, 1-drive.
// stageLabel() is unchanged: it still feeds the "STAGE 1-1" banner and tally.id.
import { $ } from './state';

/** stage kind of slot i in today's 4-stage descent. Stub until LS1-A's layout.ts kindOf(stage) lands: slot 0 is the
 *  Orbit, slot 3 the Drive, slots 1-2 are named by the biome flown into (null if no gate was taken, which never
 *  happens on a clear). LS1-A replaces the body with kindOf; gradeKey's output format must not change. */
export function stageKind(i = $.G.stage || 0, route = $.G.route) {
  if (i === 0) return 'orbit';
  if (i === 3) return 'drive';
  return (route && route[i - 1]) || 'biome';
}

/** best-grade key for the current stage: `${loop+1}-${kind}`, e.g. 1-orbit, 2-acid, 1-drive */
export const gradeKey = () => `${$.G.loop + 1}-${stageKind()}`;

const ORDER = 'SABC';
const isTable = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
/** sets out[k] = g if g is a real grade and beats what is there (so the result never holds junk) */
function put(out, k, g) {
  if (typeof g !== 'string' || g.length !== 1 || ORDER.indexOf(g) < 0) return;
  if (!out[k] || ORDER.indexOf(g) < ORDER.indexOf(out[k])) out[k] = g;
}

/** best grades by kind, from any save: N-1 -> N-orbit, N-4 -> N-drive; N-2/N-3 are dropped (which biome that slot
 *  was is unknown; slotGrades keeps them aside). Kind keys are kept; on a clash the better grade wins; anything that
 *  is not a grade is dropped. Pure and idempotent, so save.ts runs it on every load: it also cleans a v3 import and
 *  folds back slot keys an older build wrote into a v3 save. */
export function migrateBest(best) {
  const out = {};
  if (!isTable(best)) return out;
  for (const [k, g] of Object.entries(best)) {
    const m = /^(\d+)-(\d+)$/.exec(k);
    if (!m) put(out, k, g);
    else if (m[2] === '1') put(out, `${m[1]}-orbit`, g);
    else if (m[2] === '4') put(out, `${m[1]}-drive`, g);
  }
  return out;
}

/** the biome-slot grades (N-2, N-3) migrateBest drops, merged into a kept legacy table (best grade wins). Nothing
 *  reads it: it exists so spec Q19 can still be answered differently without the grades being gone (decision log). */
export function slotGrades(best, kept) {
  const out = {};
  if (isTable(kept)) for (const [k, g] of Object.entries(kept)) if (/^\d+-[23]$/.test(k)) put(out, k, g);
  if (isTable(best)) for (const [k, g] of Object.entries(best)) if (/^\d+-[23]$/.test(k)) put(out, k, g);
  return out;
}
