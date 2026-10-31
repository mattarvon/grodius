# Coding Standards

Grodius is TypeScript on a Canvas 2D context with no engine (see
`docs/architecture/stack-reference.md`). These standards replace the
template's engine-oriented ones; the path-scoped rules in `.claude/rules/` carry
the per-area detail.

- Comment the *why* where it is not obvious: a tuning value's rationale, a
  hidden invariant, a workaround. Public functions that other systems call get a
  one-line doc comment; no multi-paragraph docblocks
- Decisions are logged in `production/decision-log.md`. ADRs in
  `docs/architecture/` are **set by `modes.workflow`**: all at `full`, critical
  only at `standard`, none required at `minimal` (this project's tier), where the
  decision log and `design/game-brief.md` carry the rationale. See
  `.claude/docs/workflow-modes.md`.
- Gameplay values live in **named, typed in-code tuning tables** (the `DEPTH`
  pattern in `src/depth.ts`), each value commented with its rationale and the
  probe that measures it. External config files are not the convention here
- Module-level state (`$` in `src/state.ts`, entity arrays in `src/world.ts`) is
  the architecture; no dependency-injection mandate. Keep formulas as pure
  functions that read `$` so unit tests can set the fields they need
- The sim is deterministic under the harness: no wall-clock time in sim code and
  no new environment-dependent `R()` draws (`.claude/rules/sim-determinism.md`)
- Commits must reference the relevant design document or task ID
- **Commit messages**: Use Conventional Commits format — `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Reference the story or task ID in the body (e.g., `Story: S1-2`).
- **Verification-driven development**: Write tests first when adding pure
  formulas or rules (`npm run test:unit`). For UI and visual changes, verify with
  screenshots. Every implementation needs a way to prove it works; a fix in code
  the harness does not reach needs its own test or targeted in-page check.
- **A parse check is not a run.** Every story that changes something
  player-observable is launched and observed before it closes, and the
  observation is a screenshot in `production/qa/evidence/`. Procedure:
  `.claude/docs/run-and-observe.md`. In this project screenshot evidence is
  advisory (`testing.strict.visual`/`.ui: false`), but the look is still checked.

# Design Document Standards

- All design docs use Markdown
- Each mechanic has a dedicated document in `design/gdd/`
- **How many of the 8 sections are required depends on `modes.workflow`** —
  all 8 at `full`, 5 (+ Formulas when the system defines numeric rules — rates,
  curves, thresholds, costs; the system's `Category` is a hint, not the test) at
  `standard`, and no
  GDD at all at `minimal`, where `design/game-brief.md` is the design record.
  See `.claude/docs/workflow-modes.md`. The 8 sections:
  1. **Overview** -- one-paragraph summary
  2. **Player Fantasy** -- intended feeling and experience
  3. **Detailed Rules** -- unambiguous mechanics
  4. **Formulas** -- all math defined with variables
  5. **Edge Cases** -- unusual situations handled
  6. **Dependencies** -- other systems listed
  7. **Tuning Knobs** -- configurable values identified
  8. **Acceptance Criteria** -- testable success conditions
- Balance values must link to their source formula or rationale

# Testing Standards

## Test Evidence by Story Type

All stories must have appropriate test evidence before they can be marked Done:

| Story Type | Required Evidence | Location | Default Gate Level |
|---|---|---|---|
| **Logic** (formulas, AI, state machines) | Vitest unit test — must pass | `tests/unit/[system].test.ts` | BLOCKING |
| **Integration** (multi-system) | Vitest integration test, harness baseline move explained, OR documented playtest | `tests/integration/[system].test.ts` | BLOCKING |
| **Visual/Feel** (animation, VFX, feel) | Retained screenshot + lead sign-off | `production/qa/evidence/` | BLOCKING |
| **UI** (menus, HUD, screens) | Retained screenshot of each screen touched | `production/qa/evidence/` | BLOCKING |
| **Config/Data** (balance tuning) | Smoke check pass | `production/qa/smoke-[date].md` | ADVISORY |

The **Default Gate Level** applies when `testing.strict` is not set in
`project.yaml`. A project may override it per test type: `testing.strict.logic`,
`.integration`, `.visual`, `.ui`, and `.config` each take `true` (BLOCKING) or
`false` (ADVISORY). `/story-done`, `/story-readiness`, `/dev-story`,
`/gate-check`, and `/smoke-check` resolve the effective level from that setting,
falling back to the defaults above when it is absent.

> **Why Visual and UI block.** "Retained" is load-bearing — the screenshot must
> still be on disk in `production/qa/evidence/` when the story is closed. One
> that was captured and discarded is an assertion, not evidence. These two rows
> block because for a game the way it looks *is* the product: an advisory visual
> gate gets deferred in favour of whatever does block, and the result is a
> well-tested game that looks wrong.

> **Exception — `/smoke-check`.** The ADVISORY default for **Config/Data** above
> applies to *per-story evidence* gates. `/smoke-check` is a build-health gate,
> not a per-story evidence gate, so its own unset default for
> `testing.strict.config` is **BLOCKING**. The two defaults differ on purpose.

## Automated Test Rules

- **Naming**: `.claude/rules/test-standards.md` — `tests/unit/[system].test.ts`, sentence-named `it(...)`
- **Runners**: Vitest for unit/integration (`npm run test:unit`); the Playwright
  regression harness for whole-game regressions (`npm run test:regress`); `npm test` runs both
- **Determinism**: Tests must produce the same result every run — no unpinned
  randomness, no time-dependent assertions. The harness seeds `Math.random`,
  fakes the clock and removes `AudioContext`
- **Isolation**: Each test sets up the module state it reads (`beforeEach`);
  tests must not depend on execution order
- **No hardcoded data**: Test fixtures use constants or factory functions, not inline magic numbers
  (exception: boundary value tests where the exact number IS the point)
- **Independence**: Unit tests do not touch the DOM, canvas, audio, network or
  file I/O. Modules that do at import time are stubbed with `vi.mock`

## What NOT to Automate

- Visual fidelity (shader output, VFX appearance, animation curves)
- "Feel" qualities (input responsiveness, perceived weight, timing)
- Platform-specific rendering (test on target hardware, not headlessly)
- Full gameplay sessions (covered by playtesting, not automation)

## CI/CD Rules

- The `verify` job in `.github/workflows/build.yml` runs on every push to main and
  every PR: `npm ci`, Playwright Chromium, typecheck (non-blocking while most
  files are `@ts-nocheck`), build, unit tests and the harness
- The Pages deploy needs `verify`; PRs run `verify` only and never deploy
- Never disable or skip failing tests to make CI pass, and never re-baseline the
  harness to silence an unexplained diff — fix the underlying issue
