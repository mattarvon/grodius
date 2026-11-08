// =====================================================================
//  PER-ROUTE WARM-UP PLAN (build plan LS1 row K; design/content-expansion.md §9 "Warm-up and memory").
//  What art the run needs built, read from run state. Pure: no canvas, no sim writes, no RNG, so tests drive it
//  directly. src/render/warmup.ts owns the builders and calls this on a timer. Nothing in the sim calls in here, so
//  the warm-up cannot move the sim, and biomes.ts gains no render import (boot module order, see stagebuild.ts).
//
//  - boot:   BOOT_ART, held for the whole session. Every descent flies Orbit and the Drive, and the eyes are shared.
//  - route:  once choose() commits a slot, its picked midboss pair and its boss. Art is keyed by stage, so the
//            previous stage's art leaves the plan at startStage of the next one and gets dropped.
//  - wound:  wound:<b> for every biome visited this run (G.bvis), held until a new run (render/wounds.ts).
//  - WARNING: warmBlocked() holds every build and drop from a WARNING banner, or a stage's warnX, until its fight is over.
// =====================================================================
import { HOME } from './midpick';
import { row, stageOfSlot } from './layout';
import { ROSTER } from './enemies/mid/roster';

/** built at boot and never dropped, in build order: what the title's idle time should reach first */
export const BOOT_ART: readonly string[] = ['hero', 'eyes', 'derelict', 'maw:orbit', ...ROSTER.filter((r) => r.boot && !r.wip).map((r) => r.k), 'drive'];

/** each biome's stage boss art; must match BIOMES[b].boss in biomes.ts (tests/unit/warmplan.test.ts asserts it).
 *  The Maw's art is per variant: acid and snot are separate canvases */
export const BOSS_ART: Readonly<Record<string, string>> = { ice: 'crux', acid: 'maw:acid', fire: 'butcher', snot: 'maw:snot' };

/** the run-state fields the plan reads */
export interface WarmRun {
  stage: number;
  route?: readonly (string | null)[] | null;
  mb?: Readonly<Record<number, readonly string[]>> | null;
  /** earlier visits per biome this run (biomes.ts choose()); 1+ means a later fork may lead to its wound look */
  bvis?: Readonly<Record<string, number>> | null;
}

/** the art keys the route needs now: for every committed slot from the current stage on, its midbosses and boss.
 *  Picker layouts read the stored picks G.mb[stage]; short has none, so its stage gets the biome's home midboss */
export function routeArt(G: WarmRun | null | undefined): string[] {
  const out: string[] = [];
  if (!G || !G.route) return out;
  G.route.forEach((b, s) => {
    const i = stageOfSlot(s);
    if (!b || i < G.stage) return;
    const mids = (G.mb && G.mb[i]) || (row(i) ? [HOME[b]] : []);
    for (const k of [...mids, BOSS_ART[b]]) if (k && !out.includes(k)) out.push(k);
  });
  // the wound look (LS2-read item 2, render/wounds.ts): from the moment a biome is first chosen a remix of it can come up,
  // and its gate portal shows the wound, so it is built before the next fork and held for the rest of the run
  if (G.bvis) for (const b of Object.keys(BOSS_ART)) if ((G.bvis[b] || 0) >= 1) out.push('wound:' + b);
  return out;
}

/** the run-state fields warmBlocked reads */
export interface WarmGate {
  t: number;
  stage?: number;
  scroll?: number;
  warnEnd?: number;
  mini?: unknown;
  boss?: unknown;
  bossStarted?: boolean;
}

/** the scroll sits between its stage's banner and its end encounter: Orbit's "SOMETHING IS COMING" to the Maw, and the
 *  Drive's WARNING to startBoss (about 40 frames outlast the banner). Rows without a warnX open with a miniWarn */
function inLeadIn(G: WarmGate): boolean {
  const r = G.stage == null || G.scroll == null ? null : row(G.stage);
  return !!r && r.warnX != null && G.scroll! >= r.warnX && G.scroll! < r.bossX;
}

/** no warm-up work now: a WARNING is showing (G.warnEnd, written by banner()), a stage's lead-in is running, or a fight
 *  is up. Off the run (title, game over) the G left behind says nothing, so only play and pause count: a pause inside
 *  a WARNING still holds, because the window has to resume where it stopped */
export function warmBlocked(state: string, G: WarmGate | null | undefined): boolean {
  if (!G || (state !== 'play' && state !== 'pause')) return false;
  return G.t < (G.warnEnd || 0) || !!G.mini || !!G.boss || !!G.bossStarted || inLeadIn(G);
}

/** the units the drop pass may free: route art (not boot art) that can say it is built and can drop. A unit with neither
 *  (a greybox, nothing cached; a wip boot kind, built on first draw) never enters it: a no-op drop would read as work
 *  done, so the warm-up would spin and never reach the boss art behind it */
export const routeKeys = (units: Readonly<Record<string, { built?: () => boolean; drop?: () => void }>>, boot: readonly string[] = BOOT_ART): string[] =>
  Object.keys(units).filter((k) => !boot.includes(k) && !!units[k].built && !!units[k].drop);
