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

1. **One row, at the end of your lane's block** in `src/enemies/mid/roster.ts` (`ICE`,
   `ACID`, `FIRE`, `SNOT`, `ORBIT_SHIP`; each lane edits only its own block, so rebases
   don't conflict): `k`, `name`, `label`, `tag`, `pool`, `min`, a measured `fit` for a
   biome-pool kind, and **`wip: true`** until its art and name are approved. Each kind in
   a pool needs a different tag (spec §6.1), and ANGLE and RACE need `min: 1` (§6.3);
   `midreg.test.ts` checks both. Never reorder finished rows: the picker walks them in order.
2. **`src/enemies/mid/<kind>.ts`**: `function upd<Kind>(e)` (that name: `midhost.test.ts`
   finds it) and one `defineMid('<kind>', { et, word, update })`. Copy `cyst.ts`. `midLeave`,
   `bandFit` and `lob` come from `../update`; `midPh2(e)` from `../midhost` is phase 2. Optional hooks,
   so no kind edits a shared file:
   - `spawnY`, `onSpawn`, `kill`: the spawn height, after the spawn, after the kill word.
   - `hurt(e, d, hx, hy, dir)`: the damage multiplier (1 full, .15 a closed WINDOW, 0 a tink).
     Every damage path asks it, burn, acid and the slick included. Area damage arrives at
     exactly `(e.x, e.y)` with `dir` 0: decide what an area hit does. Shots still collide on
     `e.r`, so a small hittable part (the Spine's eye) also needs `e.hb` or a 0 off the part.
   - `leave(e)`: once, when the withdraw clock runs out (reset a lake, a counter).
   - `kidKill(kid, owner)`: a child spawned with `own: e` (and `kid: 1`) died. Count your
     own children by `own`, not `kid`, once two kinds can spawn them.
3. **`src/render/gross/mid/<kind>.ts`**: in pass 1, one line:
   `export default greybox({ col, r, tell })` from `./_greybox` (a wobbling blob in the
   biome tint with one eye; `tell(e)` returns the telegraph strength from 0 to 1; it has no
   cached layer, so no `built` or `drop`, and the warm-up skips it). In
   pass 2, `export default { draw, warm, built, drop }`, plus `under` for a telegraph or
   chain beneath the body. Keep each `warm()` slice under about 4 ms on the phone. Copy `cyst.ts`; the shared particles, layers and crossover
   tint are in `../midbosses.ts`.

Both folders are loaded by file name (`import.meta.glob`), so there is no import
line to add. Every `.ts` there is a kind, except `_name.ts`, which is a shared helper. `main.ts` refuses to boot if a row is missing either file, and
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
- **A `wip` kind leaves the real profile alone:** no first-kill pay, no `meta.mbK` and no
  `meta.mb`. A run saved while it was up still holds it, so renaming a `wip` kind loses that
  saved run. A `boot: true` `wip` row is not boot art: it builds on first draw until it ships.
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
- **Defaults:** a kind unlisted in `DEPTH.w` takes its tag's weight (`depth.ts` `TAG_W`:
  WINDOW and ANGLE .6, RACE .5, the rest 1). `music.ts` `ufoMix` and `hud.ts` `drawUfoFx` are
  the Saucer's alone.
- **Unit tests load every kind file** (`midboss-hp`, `midhooks`, `firstkill`) against partial
  mocks. A kind file that uses an import at its top level, outside a function, can fail them.
- **Not yet shared:** a DRIFT kind repeats the Saucer's spawn and forced exit (`ufo.ts`);
  a shared helper is due before the first wave-2 DRIFT kind (the Calving Shelf).

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
