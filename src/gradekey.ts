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

/** save v2 -> v3: N-1 -> N-orbit, N-4 -> N-drive; N-2/N-3 are dropped (which biome that slot was is unknown).
 *  Keys already in the kind form are kept; on a clash the better grade wins. Pure: returns a new object. */
export function migrateBest(best) {
  const ORDER = 'SABC', out = {};
  const put = (k, g) => {
    if (typeof g !== 'string' || ORDER.indexOf(g) < 0) return;
    if (!out[k] || ORDER.indexOf(g) < ORDER.indexOf(out[k])) out[k] = g;
  };
  if (!best || typeof best !== 'object' || Array.isArray(best)) return out;
  for (const [k, g] of Object.entries(best)) {
    const m = /^(\d+)-(\d+)$/.exec(k);
    if (!m) { put(k, g); continue; }
    if (m[2] === '1') put(`${m[1]}-orbit`, g);
    else if (m[2] === '4') put(`${m[1]}-drive`, g);
    // 2 and 3: the biome slots, dropped
  }
  return out;
}
