# Grodius — Claude Code Game Studios

Grodius is a Gradius-style body-horror shooter, developed with the Claude Code
Game Studios framework (35 coordinated subagents, adapted to this engine-less
TypeScript stack; local changes to the framework are listed in
`.claude/.ccgs-source`). Each agent owns a specific domain.

## Technology Stack

- **Engine**: None — custom TypeScript canvas game (Grodius: Gradius-style body-horror shooter)
- **Language**: TypeScript (`src/`, entry `src/main.ts`)
- **Version Control**: Git, trunk on `main` (whether tune work must go through PRs is pending decision D4); GitHub Actions `verify` runs on PRs and gates the Pages deploy, and pushes to `main` build the APK + Pages
- **Build System**: Vite (`npm run dev`, `npm run build`, `npm run typecheck`); Android via Capacitor (`npm run android`)
- **Tests**: Vitest unit tests (`npm run test:unit`, `tests/unit/*.test.ts`) and the deterministic regression harness (`npm run test:regress`, `tools/harness.mjs`); `npm test` runs both. `tools/*-probe.mjs` and `tools/*-shots.mjs` are balance probes and screenshot rigs
- **Asset Pipeline**: Python prep scripts in `tools/` (`prep_*.py`, `gen_*_sfx.py`) feeding `src/sprites/`, `src/sfx/`, `src/img/`

> **No engine.** The template's Godot/Unity/Unreal agents and engine references
> were removed. `web-specialist` is the stack authority (what `specialists.*`
> route to). Pinned toolchain versions and their post-cutoff changes:
> `docs/architecture/stack-reference.md`. Where a skill mentions
> `docs/engine-reference/<engine>/`, use that file instead.

## Project Structure

@.claude/docs/directory-structure.md

## Technical Preferences

`project.yaml` at the repo root is the primary config store — engine, specialists,
naming, platform, performance, modes. Skills resolve it via `resolve_config`
(see `.claude/docs/config-resolution.md`).

`.claude/docs/technical-preferences.md` is the **legacy fallback**, read on demand
when a key is absent from `project.yaml`. For Grodius it was filled in by hand
(no `/setup-engine`) and also holds the forbidden patterns and allowed
libraries.

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
  (exempt: `active.md` appends, agent memory, a subagent's new file at the path
  its orchestrating skill named; see `.claude/rules/agent-memory.md`)
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction
- A skipped or dismissed question is not an answer: act on nothing, re-ask in
  plain text and wait
- Started outside this file's folder? Warn first: hooks, deny rules and the
  ask-first mode load only when Claude Code starts here

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

## Studio Hierarchy on Every Change

Standing instruction from Matt (2026-10-31): **apply every Studio Hierarchy agent to
everything done on Grodius.** `project.yaml` sets `modes.review_mode: full` and
`team.size: studio` for this; paperwork stays at `rigor: minimal`.

- **Every change** (code, tuning, design, art, audio, copy, tools, CI, docs) gets a
  full hierarchy pass before it lands on `main`: the relevant Tier 3 specialists
  build or review it, **every department lead** reviews it for their domain
  (game-designer, lead-programmer, art-director, audio-director,
  narrative-director, qa-lead, release-manager, localization-lead), and the three
  directors (creative-director, technical-director, producer) sign off last.
- A lead or director whose domain is untouched still looks, and says "no impact"
  with a reason; silence is not a pass.
- Use the team skills at `studio` size (`/team-combat`, `/team-ui`, `/team-level`,
  `/team-audio`, `/team-narrative`, `/team-qa`, `/team-polish`, `/team-release`)
  and the review skills at `full` (`/code-review`, `/design-review`,
  `/balance-check`) where they fit. Otherwise run the hierarchy as a multi-agent
  workflow: specialists, then leads, then directors.
- A director or lead **block** stops the merge until it is resolved or Matt
  overrides it. Record the outcome in the commit message (`Studio review: ...`)
  and any decision in `production/decision-log.md`.

> **Where things stand:** `production/studio-roadmap.md` (ranked work, current
> sprint), `production/decision-log.md` (decisions made and pending),
> `design/game-brief.md` (the design record at `rigor: minimal`). Run `/help` for
> the next step in the pipeline.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

Read `.claude/docs/context-management.md` on demand — it is a reference, not
session context. Two of its conventions are load-bearing and cited by name
elsewhere in the repo, so they are restated here rather than lost:

- **`production/session-state/active.md` is the session checkpoint.** The file is
  the memory, not the conversation. Read it first after any compaction, crash, or
  `/clear`.
- **Helpers in `.claude/scripts/` emit observations, never verdicts.** A script
  that scores or judges will eventually contradict a mode or override it cannot
  see. (Cited by `artifact-check.sh` and `adr-dep-graph.sh`.)
