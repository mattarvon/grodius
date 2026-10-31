# Technical Preferences

<!-- project.yaml at the repo root is the machine-readable source of truth for
     engine, specialists, naming, performance, platform, and testing.framework.
     This file is the human-readable LEGACY FALLBACK: agents and skills resolve
     each key from project.yaml first and fall back here only when the
     project.yaml key is absent. /setup-engine dual-writes both.
     Forbidden patterns and allowed libraries are NOT migrated — they live only
     in this file. Populated by /setup-engine; updated as decisions are made.
     Grodius: written by hand (no engine, so /setup-engine does not apply). -->

## Engine & Language

- **Engine**: None (TypeScript canvas) — no game engine; see `docs/architecture/stack-reference.md`. `engine.name` in project.yaml is intentionally unset
- **Language**: TypeScript 7 (most files `// @ts-nocheck`, `strict: false`), bundled by Vite 8
- **Rendering**: Canvas 2D on one canvas (`#c`), procedural art cached in offscreen canvases
- **Physics**: None — hand-written movement and circle/terrain collision in a fixed 60 Hz step

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (GitHub Pages) and Android (Capacitor 8, sideloaded APK)
- **Input Methods**: Keyboard, Gamepad, Touch
- **Primary Input**: Touch on Android; keyboard on web
- **Gamepad Support**: Partial (Gamepad API polled in `src/input.ts`)
- **Touch Support**: Full (on-screen controls, `TOUCH` in `src/platform.ts`)
- **Platform Notes**: Landscape phone; Android WebView floor is `minSdkVersion` 24; audio unlocks on first input (title gate)

## Naming Conventions

- **Classes**: Rare — prefer plain objects and module functions
- **Variables**: camelCase, short names in hot code (`e`, `P`, `G`); entity fields are terse (`hp`, `t`, `st`, `cool`)
- **Signals/Events**: None — direct calls and module state (`$`)
- **Files**: lowercase single-word modules (`src/depth.ts`), grouped in folders by system (`src/enemies/`, `src/render/`)
- **Scenes/Prefabs**: N/A
- **Constants**: UPPER_CASE for tuning tables and fixed values (`DEPTH`, `GRADE`, `W`, `PH`)

## Performance Budgets

- **Target Framerate**: 60 fps (fixed 60 Hz sim step)
- **Frame Budget**: 16.7 ms on a mid-range Android phone (reference device pending decision D15)
- **Draw Calls**: N/A (Canvas 2D); watch per-frame fill area and particle counts instead
- **Memory Ceiling**: Not set

## Testing

- **Framework**: Vitest for unit/integration tests (`npm run test:unit`), plus the Playwright regression harness (`npm run test:regress`); `npm test` runs both
- **Minimum Coverage**: None set
- **Required Tests**: Pure formulas (depth scaling, pay, XP, crit, cadence), save migrations, and a harness baseline update for any intended sim change

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- New `R()`/`Math.random()` draws in render, audio or setting-dependent code (`.claude/rules/sim-determinism.md`)
- Wall-clock time (`Date.now`, `performance.now`, `setTimeout`) driving sim behaviour
- `swapRm` on any index other than the current backward-loop index
- Per-frame allocation in `step()` or render hot paths
- Re-baselining the harness without explaining the diff

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- Capacitor 8: `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor-community/keep-awake`, `@capacitor-community/text-to-speech`
- Fonts: `@fontsource/silkscreen`, `@fontsource/grenze-gotisch`
- Dev: `vite`, `typescript`, `vitest`, `playwright` (pinned), `prettier`, `@babel/*`
- Anything else (frameworks, engines, WebGL renderers, new plugins) needs technical-director sign-off

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- No ADRs at `rigor: minimal`; decisions are logged in `production/decision-log.md`. Architecture overview: `docs/architecture/architecture-overview.md`

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: web-specialist
- **Language/Code Specialist**: web-specialist
- **Shader Specialist**: web-specialist (no shaders; Canvas 2D effects and post-FX)
- **UI Specialist**: web-specialist
- **Additional Specialists**: None
- **Routing Notes**: There is no engine; web-specialist covers TypeScript, Canvas 2D, Vite, Capacitor/Android and the Playwright rigs

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (primary language) | web-specialist (`src/**/*.ts`) |
| Shader / material files | web-specialist (render code in `src/render/**`, `src/fx/**`) |
| UI / screen files | web-specialist (`src/menus.ts`, `src/render/screens.ts`, `src/render/hud.ts`) |
| Scene / prefab / level files | N/A (stages are scripted in `src/stages.ts`, `src/biomes.ts`, `src/enemies/scripts.ts`) |
| Native extension / plugin files | web-specialist (`android/`, `capacitor.config.ts`) |
| General architecture review | Primary |
