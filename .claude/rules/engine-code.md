---
paths:
  - "src/core.ts"
  - "src/world.ts"
  - "src/main.ts"
  - "src/perf.ts"
  - "src/platform.ts"
  - "src/input.ts"
  - "src/save.ts"
  - "src/audio.ts"
  - "src/music.ts"
  - "src/sprites.ts"
  - "src/textures.ts"
  - "src/render/**"
  - "src/fx/**"
---

# Runtime Code Rules (loop, render, audio, input, save, platform)

Grodius has no engine; this is the code that plays that role. `web-specialist`
owns it.

- **No allocations in hot paths**: `step()`, the render functions and per-entity
  fx updates run every frame. No array spreads, `filter`/`map`, closures or new
  gradients/paths per entity per frame. Cache procedural art in offscreen
  canvases (the `warm*()` functions at boot) and reuse scratch arrays.
- **Profile before and after** any optimisation and record the numbers
  (`src/perf.ts` timers, `tools/perf-probe.mjs`). The budget is 16.7 ms per frame
  at 60 Hz on a mid-range Android phone, not a desktop.
- **Dependency direction**: runtime modules (`core`, `world`, `state`, `render/util`)
  must not import gameplay modules. Gameplay may import runtime.
- **Draw order is meaning**: enemy bullets draw after `postFX()`; any new
  full-screen layer goes below them. Full-screen washes, flicker and glitch tears
  must respect `SET.flashes`.
- **Audio and render must not perturb the sim**: see
  `.claude/rules/sim-determinism.md`. Audio init consumes `R()` per sample today;
  do not add more environment-dependent draws.
- **Graceful degradation**: every Capacitor call is guarded by `NATIVE`
  (`src/platform.ts`) and must work in a plain browser (Pages) and in the
  harness, where `AudioContext`, `speechSynthesis` and `setTimeout` are stubbed out.
- **Save format**: a change to what `src/save.ts` writes needs a migration for old
  saves and must not write defaults back after a failed load.
- **Verify library APIs** against `node_modules/<pkg>` types; see
  `docs/architecture/stack-reference.md` for the post-cutoff versions.
