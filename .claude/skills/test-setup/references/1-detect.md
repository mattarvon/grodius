# /test-setup — Phase 1: Detect Engine and Existing State

> Part of `/test-setup`. `SKILL.md` names when to read this file; the settings it
> resolved and the rules under its later headings still apply here.

## Phase 1: Detect Engine and Existing State

1. **Read engine config**:
   - Read `engine.name` from `project.yaml`; if that key is absent or empty
     (including when `project.yaml` has no `engine:` block), fall back to the
     `Engine:` value in `.claude/docs/technical-preferences.md`.
   - If neither source yields a configured engine (project.yaml `engine.name`
     absent/empty and technical-preferences.md shows `[TO BE CONFIGURED]` or is
     missing), stop:
     "Engine not configured. Run `/setup-engine` first, then re-run `/test-setup`."
     **Exception — engine-less projects.** When `engine.name` is absent/empty but
     `project.yaml` sets `commands.build` and `specialists.code` (a custom stack, e.g. a
     TypeScript web game), the project is configured. Do not stop and do not use any engine
     template in Phases 2-5. Instead, for the whole run:
     - The test runner is `testing.framework` and the entry point is `commands.test`. If either
       is unset, report `NOT ASSESSED — no test runner configured` and stop.
     - Phase 2 proposes only what is missing: `tests/unit/`, `tests/integration/`, and one
       example test written for that runner that imports real code from the code root.
     - Phase 4 writes no new workflow. Read the existing `.github/workflows/*.yml` and report
       whether one of them runs `commands.test` (or its parts) on push and pull_request; if none
       does, propose the step for the user to add to their existing workflow.
     - Phase 5 (smoke seed) and Phase 6 report against `commands.smoke` / `commands.test`.

2. **Check for existing test infrastructure**:
   - Glob `tests/` — does the directory exist?
   - Glob `tests/unit/` and `tests/integration/` — do subdirectories exist?
   - Glob `.github/workflows/` — does a CI workflow file exist?
   - Glob `addons/gdUnit4/bin/GdUnitCmdTool.gd` (Godot — note the capital U) or
     `Assets/Tests/EditMode/` (Unity) or `Source/*/Private/Tests/` (Unreal) for
     engine-specific artifacts. These are the **test roots** in
     `.claude/docs/directory-structure.md`; tests anywhere else are never compiled
     on Unity or Unreal. An engine-less project's test roots are `tests/unit/` and
     `tests/integration/`.

3. **Report findings**:
   - "Engine: [engine]. Test directory: [found / not found]. CI workflow: [found / not found]."
   - If everything already exists AND `force` argument was not passed:
     "Test infrastructure appears to be in place. Re-run with `/test-setup force`
     to regenerate. Proceeding will not overwrite existing test files."

If the `force` argument is passed, skip the "already exists" early-exit and
proceed — but still do not overwrite files that already exist at a given path.
Only create files that are missing.

---
