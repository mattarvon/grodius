---
paths:
  - "src/enemies/**"
  - "src/boss/**"
---

# Enemy and Boss Behaviour Rules

Enemy and boss behaviour is scripted per kind in `switch` cases
(`src/enemies/update.ts`, `src/boss/update.ts`), spawned through `mk()` and the
stage scripts (`src/enemies/spawn.ts`, `src/enemies/scripts.ts`).

- **Telegraph every attack**: an attack that can kill must have a readable tell
  (a `tel` state, a flash, a sound) before it fires. Shortening a telegraph is a
  design decision, not a tuning tweak.
- Attack cadence goes through `every(e, n)` and cooldowns through `cdm()` so the
  pressure/depth scaling reaches every enemy. A wind-up that `every()` can
  re-trigger must not reset itself mid-wind-up (the Nail Choir bug): only start it
  when idle.
- Bullet patterns use the existing primitives (`fan`, `ring`, `eshoot` in
  `src/enemies/spawn.ts`; `lob`/`lobAt` in `src/enemies/update.ts`). Use the existing bullet kinds; a new kind needs art and a
  hitbox reviewed by `technical-artist`.
- Spawned children (litters, hatchlings) carry `kid: 1` so they don't count toward
  the stage's spawned/kill totals or feed grafts; parts carry `par`.
- Per-frame cost: no array allocation (`filter`, spreads) in an enemy's update
  case; reuse module-level scratch arrays. Profile with `tools/perf-probe.mjs`
  before and after a change that adds per-entity work.
- Behaviour must be deterministic under the harness: randomness only via `R()`,
  never in branches that depend on settings, frame rate or device.
- A boss or midboss change is verified with its probe (`tools/boss-probe.mjs`,
  `tools/midboss-probe.mjs`) and, if it changes look, its shots rig.
