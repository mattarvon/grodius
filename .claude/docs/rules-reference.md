# Path-Specific Rules

Rules in `.claude/rules/` carry `paths:` frontmatter. Claude Code loads a
path-scoped rule **when it READS a file matching one of those globs** — not on
every tool use, and not when it creates one.

Three consequences, and none of them are optional reading:

1. **Reading, not editing.** A rule scoped to a gameplay folder reaches the
   model when a file there is opened. An agent that writes a brand-new file in that
   directory without opening an existing one never sees it. Most work in this
   framework creates files rather than reads them, so this is the common case,
   not the corner case.
2. **Context, not enforcement.** A loaded rule is guidance the model weighs, the
   same as `CLAUDE.md`. Anything that must hold regardless of what the model
   decides belongs in a hook — `.claude/hooks/` already enforces JSON validity
   and commit shape that way.
3. **A rule with no `paths:` loads every session**, at the same priority as
   `.claude/CLAUDE.md`. That is the lever for a rule that must always apply; it
   costs context in every session, so it is a deliberate trade, not a default.

Where a rule duplicates guidance an agent definition already carries, the two
must agree. Contradicting instructions are resolved arbitrarily, so a rule and
an agent stating different versions of the same standard is worse than either
alone.

To see which rules actually load, and why, wire the `InstructionsLoaded` hook —
`.claude/hooks/log-instructions.sh` records every instruction file and its load
reason (`session_start`, `path_glob_match`, `nested_traversal`, `include`,
`compact`) to `production/session-logs/instructions-loaded.log`.

**Globs match regardless of case.** Claude Code 2.1.282 matches `paths:`
gitignore-style and case-insensitively (observed; the docs do not say), so
`src/render/**` would also match a hypothetical `SRC/Render/` folder; Grodius's
globs below name exact files where a folder glob would over-match.

Grodius has no engine: the template's Unity/Unreal globs and the scene,
shader, network and data-file rules were removed, and the code rules were
re-scoped to Grodius's real files.

| Rule File | Path Pattern | Enforces |
| ---- | ---- | ---- |
| `gameplay-code.md` | `src/{player,shots,perks,mutations,contraptions,shipform,stages,biomes,depth,flow,step,state}.ts` | Named typed tuning tables, frame-based time, `$` state lifecycle, swapRm safety, pure formulas |
| `engine-code.md` | `src/{core,world,main,perf,platform,input,save,audio,music,sprites,textures}.ts`, `src/render/**`, `src/fx/**` | No hot-path allocation, draw order, graceful native degradation, save migrations |
| `ai-code.md` | `src/enemies/**`, `src/boss/**` | Telegraphs, `every()`/`cdm()` cadence, wind-up safety, `kid`/`par` children, probes |
| `ui-code.md` | `src/menus.ts`, `src/input.ts`, `src/render/{screens,hud,hype}.ts` | Display-only UI, keyboard/gamepad/touch, legibility, flash limits |
| `sim-determinism.md` | `src/**` | One shared random stream; no environment-dependent draws; harness baseline discipline |
| `tools.md` | `tools/**` | Probes measure and never mutate; pinned Playwright; self-started server; usage headers |
| `design-docs.md` | `design/gdd/**` | Required sections per `modes.workflow` (8 at `full`, 5 at `standard`), formula format, edge cases |
| `narrative.md` | `design/narrative/**` | Lore consistency, character voice, canon levels |
| `test-standards.md` | `tests/**`, `tools/harness.mjs`, `tools/harness.baseline.json` | Vitest naming and structure, watched-fail regression tests, harness baseline |
| `prototype-code.md` | `prototypes/**` | Relaxed standards, README required, hypothesis documented |
| `agent-memory.md` | `.claude/agent-memory/**` | The one place an agent may write unasked — and why a temporary absence must never be recorded as a durable fact |
| `skill-authoring.md` | `.claude/skills/**`, `.claude/agents/**` | A check must be able to report that it did not run — the five obligations for verdicts, defaults, skips, sourcing and derived coverage |

> **`skill-authoring.md` is the odd one out and deliberately so.** Every other
> rule here scopes a *game* directory; that one scopes the **framework's own**
> authoring paths. It exists because one failure shape kept recurring across
> unrelated subsystems — a step that could not run producing output
> indistinguishable from a step that ran and found nothing. The same mistake in
> nine places is a missing design rule, not nine mistakes.
