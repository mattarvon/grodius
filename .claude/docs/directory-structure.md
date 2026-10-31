# Directory Structure

```text
/
├── CLAUDE.md                    # Master configuration
├── project.yaml                 # Machine-readable project config — modes, specialists, commands, stage (source of truth)
├── .claude/                     # Agent definitions, skills, hooks, rules, docs
├── src/                         # Game source code (TypeScript) — the code root
│   ├── main.ts                  # Boot, fixed 60 Hz loop, render dispatch
│   ├── state.ts  world.ts       # Module state ($) and entity arrays
│   ├── core.ts                  # Canvas, constants, RNG (R), helpers (swapRm, clamp, ...)
│   ├── step.ts  flow.ts         # Per-step sim update; run/screen flow (newGame, shop, fork)
│   ├── player.ts shots.ts perks.ts mutations.ts contraptions.ts shipform.ts
│   ├── stages.ts biomes.ts depth.ts  # Stage scripts, biome forks, depth/pressure scaling
│   ├── enemies/  boss/          # Enemy and boss behaviour, spawning, stage scripts
│   ├── render/  fx/             # Canvas drawing, HUD/screens, gore, post-FX, particles
│   ├── audio.ts music.ts        # Procedural Web Audio + recorded sfx/voice
│   ├── input.ts platform.ts save.ts perf.ts
│   └── img/ sprites/ sfx/ music/  # Game assets imported by the code (bundled by Vite)
├── assets/                      # App icon and splash sources (Capacitor)
├── android/                     # Capacitor Android project (Gradle)
├── design/                      # Design record: game-brief.md (+ progression notes)
├── docs/                        # Technical docs: architecture/ (overview, stack-reference), pacing.md
├── tests/                       # Vitest suites: unit/, integration/ (*.test.ts)
├── tools/                       # Probes, screenshot rigs, harness, asset prep, vault mirror
├── prototypes/                  # Throwaway prototypes (created on demand; may import src/)
├── production/                  # Roadmap, decision log, sprints, QA evidence
│   ├── qa/evidence/             # Retained screenshots
│   ├── session-state/           # Ephemeral session state (active.md — gitignored)
│   └── session-logs/            # Session audit trail (gitignored)
└── dist/                        # Vite build output (gitignored; deployed to gh-pages, synced into android/)
```

## The code root is `src/`

Grodius has no engine, so the template's engine table does not apply: the code
root is `src/`, resolved from the tree because `engine.name` is unset
(`resolve_code_root` in `.claude/hooks/yaml-helper.sh` reports `src detected`).
A path shown as `src/…` in a skill means this `src/`.

## Tests

| Kind | Root | Runner |
|---|---|---|
| Unit | `tests/unit/[system].test.ts` | Vitest (`npm run test:unit`) |
| Integration | `tests/integration/[system].test.ts` | Vitest (`npm run test:unit`) |
| Whole-game regression | `tools/harness.mjs` + `tools/harness.baseline.json` | Playwright (`npm run test:regress`) |

`npm test` runs the Vitest suites and then the harness. Read `tests/unit/[system]/`
in any template doc as `tests/unit/[system].test.ts`.
