// =====================================================================
//  PER-ROUTE WARM-UP PLAN (build plan LS1 row K; design/content-expansion.md §9 "Warm-up and memory").
//  What art the run needs built, read from run state. Pure: no canvas, no sim writes, no RNG, so tests drive it
//  directly. src/render/warmup.ts owns the builders and calls this on a timer. Nothing in the sim calls in here, so
//  the warm-up cannot move the sim, and biomes.ts gains no render import (boot module order, see stagebuild.ts).
//
//  - boot:   BOOT_ART, held for the whole session. Every descent flies Orbit and the Drive, and the eyes are shared.
//  - route:  once choose() commits a slot, its picked midboss pair and its boss. Art is keyed by stage, so the
//            previous stage's art leaves the plan at startStage of the next one and gets dropped.
//  - WARNING: warmBlocked() holds every build and drop from a WARNING banner until its fight is over.
// =====================================================================
import { HOME } from './midpick';
import { row, stageOfSlot } from './layout';
import { ROSTER } from './enemies/mid/roster';

/** built at boot and never dropped, in build order: what the title's idle time should reach first */
export const BOOT_ART: readonly string[] = ['hero', 'eyes', 'derelict', 'maw:orbit', ...ROSTER.filter((r) => r.boot).map((r) => r.k), 'drive'];

/** each biome's stage boss art; must match BIOMES[b].boss in biomes.ts (tests/unit/warmplan.test.ts asserts it).
 *  The Maw's art is per variant: acid and snot are separate canvases */
export const BOSS_ART: Readonly<Record<string, string>> = { ice: 'crux', acid: 'maw:acid', fire: 'butcher', snot: 'maw:snot' };

/** the run-state fields the plan reads */
export interface WarmRun {
  stage: number;
  route?: readonly (string | null)[] | null;
  mb?: Readonly<Record<number, readonly string[]>> | null;
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
  return out;
}

/** the run-state fields warmBlocked reads */
export interface WarmGate {
  t: number;
  warnEnd?: number;
  mini?: unknown;
  boss?: unknown;
  bossStarted?: boolean;
}

/** no warm-up work now: a WARNING is showing (G.warnEnd, written by banner()), or a fight is up. Off the run
 *  (title, game over) the G left behind says nothing, so only play and pause count: a pause inside a WARNING still
 *  holds, because the window has to resume where it stopped */
export function warmBlocked(state: string, G: WarmGate | null | undefined): boolean {
  if (!G || (state !== 'play' && state !== 'pause')) return false;
  return G.t < (G.warnEnd || 0) || !!G.mini || !!G.boss || !!G.bossStarted;
}
