# Docs Directory

When authoring or editing files in this directory, follow these standards.

## Architecture Decision Records (`docs/architecture/`)

At `rigor: minimal` (this project) no ADRs are required: decisions are logged
in `production/decision-log.md`. When an ADR is written (a critical decision,
or a raised rigor), use the template:
`.claude/docs/templates/architecture-decision-record.md`. Its "Engine
Compatibility" section means stack compatibility here
(`docs/architecture/stack-reference.md`).

**Required sections:** Title, Status, Context, Decision, Consequences,
ADR Dependencies, Engine Compatibility, GDD Requirements Addressed

**Status lifecycle:** `Proposed` → `Accepted` → `Superseded`
- Never skip `Accepted` — stories referencing a `Proposed` ADR are auto-blocked
- Use `/architecture-decision` to create ADRs through the guided flow

**TR Registry:** `docs/architecture/tr-registry.yaml`
- Stable requirement IDs (e.g. `TR-movement-001`) that link GDD requirements to stories
- Never renumber existing IDs — only append new ones
- Updated by `/architecture-review` Phase 8

**Control Manifest:** `docs/architecture/control-manifest.md`
- Flat programmer rules sheet: Required / Forbidden / Guardrails per layer
- Date-stamped `Manifest Version:` in header
- Stories embed this version; `/story-done` checks for staleness

**Validation:** Run `/architecture-review` after completing a set of ADRs.

## Stack Reference (`docs/architecture/stack-reference.md`)

Grodius has no engine, so `docs/engine-reference/` holds only a README pointing
here. `docs/architecture/stack-reference.md` pins the toolchain (TypeScript 7,
Vite 8/rolldown, Capacitor 8, Playwright, Vitest) and records what changed in
those post-cutoff majors. **Check it, and the installed types in
`node_modules/`, before using any library or build API.** Update it when a
dependency's major version changes.

