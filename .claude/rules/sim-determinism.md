---
paths:
  - "src/**"
---

# Sim Determinism Rules

The regression gate (`npm run test:regress`) replays the game with a seeded
`Math.random`, a fake clock and scripted input, and fails on any change in the
final sim state. It only works if the same inputs always produce the same sim.

## Two random streams (split in M2 #13 / LS1-B1)

- `R` in `src/core.ts` is `Math.random`, the **sim** stream the harness seeds.
  Only sim code (`step()` and what it calls) draws it, through `R`/`rr`/`ri`/`pick`.
- `srnd()` in `src/srnd.ts` (with `srr`/`sri`/`spick`) is the **render** stream:
  everything in `src/render/**` and `src/fx/**` draws from it. Audio has its own
  `ar()` in `src/audio.ts`. Neither ever touches `Math.random`.
- `tests/unit/rng-split.test.ts` fails if a render, fx or audio file imports the
  sim RNG or calls `Math.random`. `tools/rng-probe.mjs` is the runtime proof:
  every boss and midboss fight must give the same sim rendered every frame,
  never rendered, and with HELL FLASHES off.
- A sim-side draw is harmless only if its count is the same on every machine and
  every run. It is a bug if the count depends on:
  - the device: audio sample rate, screen size, `devicePixelRatio`, CPU speed
  - the frame rate: anything inside `render()` runs once per animation frame,
    not once per `step()`
  - a user setting: `SET.flashes && R()` draws only when flashes are on
  - timing: `setTimeout`/`setInterval` callbacks (stubbed out in the harness)
  - fx state: fx now runs on `srnd()`, so a sim draw gated on a particle (a gib
    landing, a decal dripping) would pull render timing into the sim
- Still on the sim stream at boot only (fixed count, before the first frame):
  the texture builders in `src/textures.ts`.

## Rules for new code

- Sim code (`step()` and everything it calls) may use `R()`. Render and fx code
  uses `srnd()`; audio uses `ar()`. For variation that must look the same every
  run, prefer deterministic sources: frame counters (`$.T`, `$.G.t`), entity
  fields set at spawn, or a hash of an index. The elite render in
  `src/enemies/elite.ts` is the model: layout from `e.eid`, motion from `$.T`.
- Never let the sim read wall-clock time (`performance.now()`, `Date.now()`) or
  layout (`innerWidth`, `devicePixelRatio`).
- A change that intentionally alters the sim (new spawn, new draw, retune) moves
  the harness baseline. Re-baseline in the same commit (`node tools/harness.mjs
  --update`) and say in the commit message what moved and why. A baseline move
  you cannot explain is a bug.
- If the harness diverges between machines (CI vs laptop), look first for an
  environment-dependent draw; don't loosen the gate.
