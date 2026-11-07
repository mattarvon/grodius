# Source Directory

When writing or editing game code in this directory, follow these standards.
The path-scoped rules in `.claude/rules/` (gameplay, enemy/boss, runtime, UI,
sim determinism) load automatically for the files they cover.

## Stack Version Warning

Grodius has no engine. It is TypeScript 7 on Canvas 2D, built by Vite 8 and
packaged with Capacitor 8 — all past the LLM's training data. Check
`docs/architecture/stack-reference.md` and the installed types in
`node_modules/<pkg>/` before using any library, build or plugin API. Do not
guess at post-cutoff signatures.

## Coding Standards

- Comment the *why* (a value's rationale, an invariant, a workaround); public
  functions other systems call get a one-line doc comment
- Gameplay values live in **named, typed in-code tuning tables** (the `DEPTH`
  pattern in `src/depth.ts`), each value commented with its rationale and the
  probe that measures it
- Module state (`$` in `state.ts`, arrays in `world.ts`) is the architecture: no
  DI containers. Keep formulas pure functions of `$` so tests can drive them
- The sim is deterministic: frame counters, not wall-clock time; no new
  render/audio/settings-dependent `R()` draws (`.claude/rules/sim-determinism.md`)
- Decisions go in `production/decision-log.md` (`rigor: minimal`: no ADRs required)
- Commits reference the story/task ID or design document

## Adding a midboss

The registry (build plan LS2-0): a **held biome-pool kind with no new part** touches
one shared line, its roster row. Other shapes need more; see "Not just a row" below.
`<kind>` is its key, the same in the row, both file names and `e.k`.

1. **One row, at the end of `ROSTER`** in `src/enemies/mid/roster.ts`: `k`, `name`,
   `label`, `tag`, `pool`, `min`, a measured `fit` for a biome-pool kind, and
   **`wip: true`** until its art and name are approved. Never insert above an
   existing row: the picker walks this order, so that moves every run.
2. **`src/enemies/mid/<kind>.ts`**: the update function and one
   `defineMid('<kind>', { et, word, update })`. Optional: `spawnY`, `onSpawn`, `kill`.
   Copy `cyst.ts`. `midLeave`, `bandFit` and `lob` come from `../update`.
3. **`src/render/gross/mid/<kind>.ts`**: `export default { draw, warm, built, drop }`,
   plus `under` for a telegraph or chain beneath the body. Copy `cyst.ts`; the shared
   particles, layers and crossover tint are in `../midbosses.ts`.

Both folders are loaded by file name (`import.meta.glob`), so there is no import
line to add. `main.ts` refuses to boot if a row is missing either file, and
`tests/unit/midreg.test.ts` fails first.

- **The roster row, not the kind's file, holds the picker fields.** `midpick.ts`,
  `runsave.ts` and `warmplan.ts` are pure and read it at load; a kind's file imports
  the sim, and through `core.ts` the DOM. `roster.ts` stays a leaf: no imports.
- **Load order:** kinds load before `spawn.ts`, in no fixed order. A kind's top level
  must not read `ET` or another kind (a recolour spreading `MID_SIM.cyst` gets
  undefined in the bundle). Read them inside functions.
- **Rules:** sim files never import render. Draw code uses `srnd()`, never `R()`. No
  allocation in `update`. Telegraphs and `kid: 1` follow `.claude/rules/ai-code.md`.
- **See it:** `?mids=wip` or the `mids=wip` LAB row makes a `wip` biome-pool kind
  pickable in any biome stage, on picker layouts only (not `short`), and `min` still
  applies: a `min: 1` kind needs Descent 2. `midboss-probe`, `perf-probe`, `depth-probe` and `rng-probe` read the
  roster and include `wip` kinds without being told.
- **Finish it:** drop `wip: true` in pass 2. That is a behaviour change: it joins the
  picker's pool, so it moves picks and needs an explained re-baseline.

**Not just a row:**

- **Orbit and ship kinds have no spawn path yet.** `biomePool` holds biome pools only,
  so such a row passes every check and never appears, even under the flag. Wire it
  into the stage: `stagebuild.ts` `fixedMids`, the `scripts.ts` Orbit table, or the
  Drive table. Set `boot: true` too: the warm-up's `routeArt` walks only biome slots,
  so without it the art builds on first draw, inside the fight.
- **A DRIFT kind** skips `midboss()`: it calls `registerDrift` (see `enemies/mid/ufo.ts`),
  sets `drift: 1` or the scroll holds (`step.ts`), and needs a forced exit. In a biome
  slot it gets no host, so no tint or terrain fit (`biomes.ts` `midSlot`). A missing
  `registerDrift` throws at the slot, not at boot.
- **A new part kind** (the nailbar pattern) is not a midboss: it needs its own `ET` row
  in `spawn.ts`, an `updEnemy` arm, a `DRAW` entry, the off-screen cull in `updEnemy`
  and the check in `contraptions.ts`. Reusing `nailbar` through `onSpawn` needs none.
- **Silent defaults:** a kind unlisted in `DEPTH.w` takes weight 1 (cyst and brood are
  .6), and `music.ts` `ufoMix` is the Saucer's alone.

## Specialist

`web-specialist` owns the stack (loop, render, input, audio, save, build,
Android). Consult it for changes to those areas or to `vite.config.ts`,
`tsconfig.json`, `capacitor.config.ts` and `android/`.

## Tests

Tests live in `tests/`, not in `src/`: Vitest suites in `tests/unit/*.test.ts`
(`npm run test:unit`), plus the whole-game harness (`npm run test:regress`).
Every pure formula should have unit tests covering its edge cases; a module that
touches the DOM at import time is stubbed with `vi.mock`.

## Verification-Driven Development

Write tests first when adding formulas or rules. For UI and visual changes,
verify with screenshots (`.claude/docs/run-and-observe.md`). If the harness
baseline moves, the change explains why; if the harness does not reach the
changed code, verify it another way and say so.
