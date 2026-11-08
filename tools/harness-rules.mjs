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
