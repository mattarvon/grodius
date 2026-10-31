---
paths:
  - "tests/**"
  - "tools/harness.mjs"
  - "tools/harness.baseline.json"
---

# Test Standards

Grodius has two test layers:

- **Unit/integration tests** in `tests/unit/` and `tests/integration/`, run by
  Vitest (`npm run test:unit`; `npm test` runs these and then the harness). They
  import functions from `src/` directly, in a Node environment.
- **The regression harness** (`npm run test:regress`, `tools/harness.mjs`): a
  seeded, fake-clock, audio-less Playwright run of the real game, compared against
  `tools/harness.baseline.json`. It gates CI and the Pages deploy.

- Test naming: one file per system, `tests/unit/[system].test.ts`; a `describe`
  per function or rule, each `it` named as a sentence stating the scenario and the
  expected result (`it('is exactly 1 everywhere in Descent 1, even at max power')`)
- Modules that touch the DOM, canvas or audio at import time are stubbed with
  `vi.mock` before a dynamic `import()` of the module under test
  (`tests/unit/every.test.ts` is the pattern). Prefer testing pure functions that
  need no mocks.
- Shared module state (`$.G`, `$.meta`) is set per test in `beforeEach`, never
  left over from another test
- Every test must have a clear arrange/act/assert structure
- Unit tests must not depend on external state (filesystem, network, database)
- Integration tests must clean up after themselves
- Performance tests must specify acceptable thresholds and fail if exceeded
- Test data must be defined in the test or in dedicated fixtures, never shared mutable state
- Mock external dependencies — tests should be fast and deterministic
- Every bug fix must have a regression test that would have caught the original bug —
  and **you must watch it fail before you trust it.** Run the new test against the
  unfixed code, confirm it fails, then apply the fix and confirm it passes. A
  regression test that has only ever been seen passing is not known to test anything.

  > This is `.claude/rules/skill-authoring.md`'s "a gate you have not watched fail
  > is not a gate", applied to tests. It is written out here because stating the
  > *goal* is not enough. A regression test for an iteration-order defect can use
  > a fixture where no cell takes part in two transfers per tick — it then passes
  > against the very bug it was written for, and looks authoritative doing it. The
  > fixture, not the assertion, is what makes it useless, and only running it
  > against the unfixed code exposes that.

## The harness baseline

- The harness gates on sim state and page errors; canvas hashes are reported as
  advisory. A change that moves the baseline on purpose is re-baselined with
  `node tools/harness.mjs --update` in the same commit, and the commit message
  says why the numbers moved. Never re-baseline to silence an unexplained diff.
- The scripted harness run is short (it dies before midbosses, forks and choice
  capsules). A fix in code it does not reach needs its own test or a targeted
  in-page check, and the commit message must say the harness did not cover it.

## Examples

**Correct** (sentence names, Arrange/Act/Assert, state set per test), `tests/unit/stages.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { $ } from '../../src/state';
import { deepPay } from '../../src/stages';

describe('deepPay', () => {
  beforeEach(() => { $.G = { loop: 0 }; });

  it('does not double stage pay in Descent 1', () => {
    // Act + Assert
    expect(deepPay()).toBe(1);
  });

  it('doubles stage pay from Descent 2', () => {
    // Arrange
    $.G.loop = 1;
    // Act + Assert
    expect(deepPay()).toBe(2);
  });
});
```

**Incorrect**:

```ts
it('test1', () => {               // VIOLATION: no descriptive name
  $.G.loop = 2;                   // VIOLATION: relies on state from an earlier test
  expect(deepPay() > 1).toBe(true); // VIOLATION: imprecise assertion
});
```
