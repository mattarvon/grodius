// The jump switch (D19 build plan LS1 row I, pulled forward from M3): ?stage=<kind>&x=<rel>&loop=&kit= starts a run at
// a stage kind, a stage-relative x, a descent and a kit. A dev and harness tool: main.ts reads it on the dev server only.
//
// It has no fast-forward of its own. It builds a checkpoint blob from the URL and hands it to the resume's path
// (flow.ts jumpRun: decodeRun, resumeRun, stagebuild.ts rebuildAt), so `x` means what cpX means: entries up to it are
// skipped and the scroll starts CP.lead before it. The run-save slot is sealed first (runsave.ts sealRun): a jump never
// writes or clears the player's RESUME. Meta (grodius.v1) is NOT sealed: a jump run's clears pay out as usual.
//
// Extra params: rank= pins G.pow (the harness's fixed-rank boss scenarios; G.rank is its clamp to 0-1) and seed= fixes
// the run seed (without it a run draws one, as newGame does). Pure apart from reading the active layout; no DOM.
import { lastStage, layout, nSlots, row, slotRow, stageOfSlot } from './layout';
import { forkAllows, HOME } from './midpick';
import { RUN_V, sealRun } from './runsave';

export const JUMP = {
  /** the deepest descent a jump takes; a higher loop= is clamped to it. Harness boss scenarios fly D3 (loop 2) */
  maxLoop: 9,
  /** rank= is G.pow: every()/BS()/formation() cap it at 2, so more would change nothing */
  maxRank: 2,
};

/** the loadouts kit= names. Levels are the ship's own (player.ts slotLv) and raw power follows src/power.ts. A kit is
 *  a fixed start, not a fixed rank: pods and level-ups still raise G.pow unless rank= pins it */
export const KITS: Record<string, { p: Record<string, number>; g: Record<string, number> }> = {
  /** a fresh ship: nothing fitted, pow 0 */
  bare: { p: {}, g: {} },
  /** about mid Descent 1 (raw 4, pow .26) */
  mid: { p: { speed: 2, double: 1, missile: 1, options: 1 }, g: { lvl: 6 } },
  /** about the end of Descent 1 (raw 11, pow .71), with lives to outlast a D3 fight's opening on a blind script */
  full: { p: { speed: 4, laser: 1, missile: 2, pyre: 1, options: 3, wardLv: 2, shield: 3 }, g: { lvl: 12, lives: 5 } },
};

export interface Jump {
  /** the stage= value as written, and the layout row it resolved to */
  kind: string;
  stage: number;
  /** the biome flown, on a biome row */
  biome: string | null;
  /** stage-relative x: the row's x0 + x is the blob's cpX */
  x: number;
  loop: number;
  kit: string;
  rank: number | null;
  seed: number | null;
}
export type JumpParse = { jump: Jump; warn: string[] } | { error: string };

const NUM = /^-?(\d+\.?\d*|\.\d+)$/; // plain decimals only: Number() would also take '', 1e3 and 0x10
const num = (s: string | null) => (s != null && NUM.test(s) ? +s : NaN);
const isBiome = (k: string) => Object.hasOwn(HOME, k);

/** the jump a URL asks for under the active layout: null with no stage=, { error } when a value is bad, else
 *  { jump, warn } with loop= and rank= clamped into range (each clamp noted in warn). x has no clamp: a jump past the
 *  stage's end encounter would skip it, so x must sit in [0, bossX - x0) */
export function parseJump(search: string): JumpParse | null {
  const q = new URLSearchParams(search), kind = q.get('stage');
  if (kind == null) return null;
  const biome = isBiome(kind) ? kind : kind === 'biome' ? Object.keys(HOME)[0] : null;
  const stage = layout().stages.findIndex((r) => r.kind === (biome ? 'biome' : kind));
  if (stage < 0) return { error: `?stage=${kind}: unknown stage kind on layout ${layout().id} (orbit, drive, biome, ${Object.keys(HOME).join(', ')})` };
  const r = row(stage)!, span = r.bossX - r.x0, warn: string[] = [];

  const x = q.has('x') ? num(q.get('x')) : 0;
  if (!(x >= 0 && x < span)) return { error: `?x=${q.get('x')}: out of range for ${kind} (0 to under ${span})` };

  let loop = q.has('loop') ? num(q.get('loop')) : 0;
  if (!Number.isInteger(loop) || loop < 0) return { error: `?loop=${q.get('loop')}: not a descent index (0 is Descent 1)` };
  if (loop > JUMP.maxLoop) { warn.push(`?loop=${loop}: clamped to ${JUMP.maxLoop}`); loop = JUMP.maxLoop; }

  const kit = q.get('kit') ?? 'bare';
  if (!Object.hasOwn(KITS, kit)) return { error: `?kit=${kit}: unknown kit (${Object.keys(KITS).join(', ')})` };

  let rank: number | null = null;
  if (q.has('rank')) {
    rank = num(q.get('rank'));
    if (!(rank >= 0)) return { error: `?rank=${q.get('rank')}: not a rank (0 to ${JUMP.maxRank})` };
    if (rank > JUMP.maxRank) { warn.push(`?rank=${rank}: clamped to ${JUMP.maxRank}`); rank = JUMP.maxRank; }
  }
  let seed: number | null = null;
  if (q.has('seed')) {
    seed = num(q.get('seed'));
    if (!Number.isInteger(seed)) return { error: `?seed=${q.get('seed')}: not an integer` };
  }
  return { jump: { kind, stage, biome, x, loop, kit, rank, seed }, warn };
}

/** the checkpoint blob of a jump (the run-save shape, decoded and flown by flow.ts jumpRun), with the run as it would
 *  stand there: each biome slot up to the stage committed at its row's gateLate, the Drive with the biome handed back
 *  at tEnd, earlier rows' DRIFT midbosses met, the stages before it counted as cleared. A slot the URL didn't name
 *  takes the first biome the fork rule allows, so the same URL always flies the same route. `seal` is flow.ts's */
export function jumpBlob(j: Jump, seed: number) {
  const L = layout(), n = nSlots(), t = row(j.stage)!, kit = KITS[j.kit];
  const route: (string | null)[] = Array(n).fill(null), bx: (number | null)[] = Array(n + 1).fill(null);
  if (t.kind === 'biome') route[t.slot!] = j.biome;
  const bvis: Record<string, number> = {}, visited: string[] = [];
  for (let s = 0; s < n; s++) {
    if (stageOfSlot(s) > j.stage) break;
    route[s] ??= Object.keys(HOME).find((b) => !route.includes(b) && (!L.picker || forkAllows(b, route)))!;
    bx[s] = slotRow(s).gateLate ?? slotRow(s).x0;
    bvis[route[s]!] = 1;
    if (stageOfSlot(s) < j.stage) visited.push(route[s]!);
  }
  if (t.kind !== 'biome' && route.some((b) => b)) bx[n] = L.tEnd[0]; // past the last biome: biomeExit's hand-back
  const mb: Record<string, string[]> = {}, mbUsed: string[] = [], mbLast: Record<string, string[]> = {};
  if (L.picker) L.stages.slice(0, j.stage).forEach((r, i) => {
    const ks = (r.drift || []).map((d) => d.k);
    if (ks.length) { mb[i] = ks; mbUsed.push(...ks); mbLast[r.kind] = ks; }
  });
  return {
    v: RUN_V,
    g: {
      layout: L.id, seed, loop: j.loop, stage: j.stage, cpX: t.x0 + j.x, cpN: 1, stT: 0, route, bx, visitNo: Array(n).fill(0), bvis, visited,
      mb, mbUsed, mbLast, cleared: j.loop * (lastStage() + 1) + j.stage, ...kit.g,
    } as Record<string, unknown>,
    p: { ...kit.p },
  };
}

/** the URL's jump, at boot: a bad value is a loud console error and null (the normal boot); a good one seals the
 *  run-save slot before main.ts reads it */
export function jumpBoot(search: string): Jump | null {
  const r = parseJump(search);
  if (!r) return null;
  if ('error' in r) { console.error(`jump switch: ${r.error}; normal boot`); return null; }
  for (const w of r.warn) console.warn(`jump switch: ${w}`);
  sealRun();
  return r.jump;
}
