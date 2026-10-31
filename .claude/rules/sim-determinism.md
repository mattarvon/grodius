---
paths:
  - "src/**"
---

# Sim Determinism Rules

The regression gate (`npm run test:regress`) replays the game with a seeded
`Math.random`, a fake clock and scripted input, and fails on any change in the
final sim state. It only works if the same inputs always produce the same sim.

## The one random stream

- `R` in `src/core.ts` is `Math.random`. Sim, render, fx and audio code all draw
  from it, so under the harness **every draw anywhere shifts every later sim
  result**.
- A draw is harmless only if its count is the same on every machine and every
  run. It is a bug if the count depends on:
  - the device: audio sample rate, screen size, `devicePixelRatio`, CPU speed
  - the frame rate: anything inside `render()` runs once per animation frame,
    not once per `step()`
  - a user setting: `SET.flashes && R()` draws only when flashes are on
  - timing: `setTimeout`/`setInterval` callbacks (stubbed out in the harness)
- Known offenders, kept until the render RNG is split out (roadmap item #13):
  `auInit()` draws `R()` once per noise sample, which is why the harness removes
  `AudioContext`; `SET.flashes && R()` in `src/boss/update.ts` and
  `src/fx/update.ts`; several sprite and title-screen effects.

## Rules for new code

- Sim code (`step()` and everything it calls) may use `R()`. Render, audio and
  settings-dependent code must not add new `R()`/`Math.random()` draws. Use
  deterministic variation instead: frame counters (`$.T`, `$.G.t`), entity
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
