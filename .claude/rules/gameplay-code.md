---
paths:
  - "src/player.ts"
  - "src/shots.ts"
  - "src/perks.ts"
  - "src/mutations.ts"
  - "src/contraptions.ts"
  - "src/shipform.ts"
  - "src/stages.ts"
  - "src/biomes.ts"
  - "src/depth.ts"
  - "src/flow.ts"
  - "src/step.ts"
  - "src/state.ts"
---

# Gameplay Code Rules

Grodius is TypeScript with module-level state; there is no engine and no
dependency injection. These rules fit that architecture.

- Gameplay values live in **named, typed in-code tuning tables** (the `DEPTH`
  pattern in `src/depth.ts`, `GRADE` in `src/stages.ts`), each value commented
  with its rationale and, when one exists, the probe that measures it
  (`tools/*-probe.mjs`). No anonymous magic numbers buried in logic. External
  JSON config is NOT the convention here.
- Time is **frames**, not seconds: the sim runs a fixed 60 Hz `step()`. Use frame
  counters (`$.G.t`, `e.t`, `c.t`) and frame-based cooldowns; never read
  `performance.now()`, `Date.now()` or timers in sim code.
- Run state lives on `$.G` (reset by `newGame()` in `src/flow.ts`); the player on
  `$.P`; persistent meta progression on `$.meta` (saved by `src/save.ts`). A new
  field gets its initial value where the object is created, and a saved field
  gets a migration in `src/save.ts`.
- Do not draw from `R()` in a branch whose execution depends on a user setting,
  device or frame rate (`.claude/rules/sim-determinism.md`).
- Entity arrays are mutated in place inside backward loops. `swapRm(a, i)` is safe
  only for the element at the loop index; to remove others, mark them and sweep
  after the loop.
- Difficulty follows one power rule (pending decision D1 in
  `production/studio-roadmap.md`): check it before adding any new HP, fire-rate
  or density scaling, and route fire cadence through `every()` / `cdm()`
  (`src/enemies/spawn.ts`, `src/depth.ts`) rather than new ad-hoc multipliers.
- Pure formula functions (`deepPay`, `xpNeed`, `critMul`, depth multipliers) must
  stay pure and importable so `npm test` can cover them.
- Comment *why* a value or branch exists when it encodes a design decision, and
  name the design doc or changelog entry it implements.

## Examples

**Correct** (named table, frame-based):

```ts
export const DEPTH = {
  fod: .8, fodO: .8, //  regular enemies (a boss's parts take the boss's factor)
  fire: .45, //         enemy fire: cooldowns / (1 + fire * loop)
};
if (every(e, 110)) fan(e.x, e.y, aimA(e.x, e.y), 5, 0.16, 1.8, 'spike');
```

**Incorrect**:

```ts
if (Date.now() - e.lastShot > 1800) shoot(e);   // VIOLATION: wall-clock time in the sim
e.hp = 40 * (1 + 0.37 * $.G.loop);              // VIOLATION: unnamed tuning, bypasses DEPTH
if (SET.flashes && R() < 0.3) flash();          // VIOLATION: setting-dependent RNG draw
```
