// Pure rules for tools/harness.mjs, kept apart because harness.mjs launches a browser on import.
// Usage: imported by tools/harness.mjs only (no CLI, no output). Unit-tested in tests/unit/harness-rules.test.ts.

/** The subject a scenario must meet: 'slotB' is the stage's second midboss from `pair` ('a+b'); null if it cannot resolve. */
export function resolveWant(want, pair) {
  if (!want) return null;
  if (want !== 'slotB') return want;
  return (typeof pair === 'string' && pair.split('+')[1]) || null;
}

/** The harness's own failures in a run's errs (entries it pushed itself, prefixed 'harness:'). */
export const harnessErrs = (errs) => errs.filter((e) => typeof e === 'string' && e.startsWith('harness:'));

/** Why --update must not record this run, or null to record it. Scenarios refuse any error; short/long4 refuse harness failures. */
export function refuseUpdate(errs, scenario) {
  const bad = scenario ? errs : harnessErrs(errs);
  return bad.length ? bad.join('; ') : null;
}

/** D33: a FLAKY result (first run differed, retry matched) fails. Local opt-out HARNESS_ALLOW_FLAKY=1, ignored under CI. */
export const flakyFails = (env) => !(env.HARNESS_ALLOW_FLAKY === '1' && !env.CI);

/** --runs N: an integer of 1 or more, else null (the caller exits 1). Absent means 1. */
export function parseRuns(v) {
  if (v == null) return 1;
  return /^\d+$/.test(v) && +v >= 1 ? +v : null;
}

/** In-page (passed to p.evaluate, so self-contained): the scenario's closing sim state. { jump: false } when no run is
 *  up (a jump that never started leaves G null), so the harness reports that instead of throwing on G */
export const simState = () => { const { G, P, enemies, drops, caps } = window.__G(), r = (v) => (typeof v === 'number' ? +v.toFixed(3) : v ?? null);
  if (!G) return { jump: false };
  return { jump: !!G.jump, stage: G.stage, pair: ((G.mb && G.mb[G.stage]) || []).join('+'), loop: G.loop, pow: r(G.pow), rank: r(G.rank), lvl: G.lvl, kills: G.kills, t: G.t, simSig: JSON.stringify([G.score, G.scroll, G.bio, G.xpTot, G.mb, G.route, P && [P.x, P.y, P.inv, P.shield], enemies.map((e) => [e.k, r(e.x), r(e.y), e.hp]), drops.length, caps.map((c) => [c.ty, r(c.x), r(c.y)])]) }; };

/** In-page, run after simState on a started jump: the sig's second half (SUMMARY #7). It covers the Gravity Drive (G.boss is
 *  not in enemies), enemy shots (world.ts eshots, not in __G: read through the dev server's module, as ready() does) and the
 *  midboss's own clock/state plus the picker's per-stage tables. A failed import (a built page) or a second module instance
 *  throws, so the gate fails instead of recording a weaker sig. W is for the unit test; the page passes nothing. */
export const simExtra = async (W) => { const { G, enemies } = window.__G(), r = (v) => (typeof v === 'number' ? +v.toFixed(3) : v ?? null);
  W = W || await import('/src/world.ts');
  if (W.enemies !== enemies) throw new Error("harness: /src/world.ts is not the game's module instance");
  const B = G.boss, M = G.mini;
  return JSON.stringify([B && [r(B.x), r(B.y), r(B.hp), r(B.max), B.phase, B.t, B.dying, B.enter, B.plates.map((q) => r(q.hp))], W.eshots.map((e) => [e.k, r(e.x), r(e.y)]),
    M && [M.k, r(M.x), r(M.y), r(M.hp), M.st ?? null, M.t ?? null, M.leave ?? null], G.mbUsed ?? null, G.mbLast ?? null]); };
