# Source Directory

When writing or editing game code in this directory, follow these standards.
The path-scoped rules in `.claude/rules/` (gameplay, enemy/boss, runtime, UI,
sim determinism) load automatically for the files they cover.

## Stack Version Warning

Grodius has no engine. It is TypeScript 7 on Canvas 2D, built by Vite 8 and
packaged with Capacitor 8 — all past the LLM's training data. Check
`docs/architecture/stack-reference.md` and the installed types in
`node_modules/<pkg>/` before using any library, build or plugin API. Do not
guess at post-cutoff signatures.

## Coding Standards

- Comment the *why* (a value's rationale, an invariant, a workaround); public
  functions other systems call get a one-line doc comment
- Gameplay values live in **named, typed in-code tuning tables** (the `DEPTH`
  pattern in `src/depth.ts`), each value commented with its rationale and the
  probe that measures it
- Module state (`$` in `state.ts`, arrays in `world.ts`) is the architecture: no
  DI containers. Keep formulas pure functions of `$` so tests can drive them
- The sim is deterministic: frame counters, not wall-clock time; no new
  render/audio/settings-dependent `R()` draws (`.claude/rules/sim-determinism.md`)
- Decisions go in `production/decision-log.md` (`rigor: minimal`: no ADRs required)
- Commits reference the story/task ID or design document

## Specialist

`web-specialist` owns the stack (loop, render, input, audio, save, build,
Android). Consult it for changes to those areas or to `vite.config.ts`,
`tsconfig.json`, `capacitor.config.ts` and `android/`.

## Tests

Tests live in `tests/`, not in `src/`: Vitest suites in `tests/unit/*.test.ts`
(`npm run test:unit`), plus the whole-game harness (`npm run test:regress`).
Every pure formula should have unit tests covering its edge cases; a module that
touches the DOM at import time is stubbed with `vi.mock`.

## Verification-Driven Development

Write tests first when adding formulas or rules. For UI and visual changes,
verify with screenshots (`.claude/docs/run-and-observe.md`). If the harness
baseline moves, the change explains why; if the harness does not reach the
changed code, verify it another way and say so.
