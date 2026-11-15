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
   `midreg.test.ts` checks both. `wip` rows count toward that rule (the test filters on pool only), so a wip kind
   sharing a finished kind's tag in its pool fails `midreg.test.ts` at once. Never reorder finished rows: the picker walks them in order.
2. **`src/enemies/mid/<kind>.ts`**: `function upd<Kind>(e)` (that name: `midhost.test.ts`
   finds it) and one `defineMid('<kind>', { et, word, update })`. Copy `cyst.ts`. `midLeave`,
   `bandFit` and `lob` come from `../update`; `midPh2(e)` from `../midhost` is phase 2. Optional hooks,
   so no kind edits a shared file:
   - `spawnY`, `onSpawn`, `kill`: the spawn height, after the spawn, after the kill word.
   - `hurt(e, d, hx, hy, dir)`: the damage multiplier (1 full, .15 a closed WINDOW, 0 a tink).
     Every damage path asks it, burn, acid and the slick included; `hurt()` with `d` 0 (a
     kill the slick already paid) never asks. A 0 < m < 1 hit flashes dimmer and tinks. Area damage arrives at
     exactly `(e.x, e.y)` with `dir` 0: decide what an area hit does. Shots still collide on
     `e.r`, so a small hittable part (the Spine's eye) also needs `e.hb` or a 0 off the part.
   - `hitSnd(e, m, hx, hy)`: the kind's own sound for a hit that landed with share `m` (> 0), in place of the
     shared tink (`m` < 1) or hit (`m` 1); return true when it played one. Audio only: `sample()`/`ar()`, never `R()`.
     (THE KEEPSAKE stage boss's vinyl thud and wound squelch use the same hook, D55.) An enemy shot can carry `land(s)`, called
     when it strikes the floor or ceiling (a fork tink), on the same audio-only terms.
   - `leave(e)`: once, when the withdraw clock runs out (reset a lake, a counter). `midLeave` fires it; a
     DRIFT kind withdraws on its own (see `ufo.ts`) and must call `MID_SIM[e.k]?.leave?.(e)` once itself.
   - `kidKill(kid, owner)`: a child spawned with `own: e` (and `kid: 1`) died. Count your
     own children by `own`, not `kid`, once two kinds can spawn them.
3. **`src/render/gross/mid/<kind>.ts`**: in pass 1, one line:
   `export default greybox({ col, r, tell })` from `./_greybox` (a dark, angular, asymmetric mass in
   the biome tint at the bottom of the value range: faceted hull, a bolted plate, ribs, no eye, no blob, still apart
   from a hash-timed hitch; `tell(e)` returns the telegraph strength from 0 to 1 and splits a seam down its front
   that opens to wound red and throws light; it has no
   cached layer, so no `built` or `drop`, and the warm-up skips it). A telegraph the seam can't carry (a landing mark,
   an aimed line) or a thrown part goes in an optional `under(e)`: `greybox({ col, r, tell, under })`. In
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
  Kind files sit in an import cycle (`../update`, `../spawn`, `../midhost`), so a kind's top level may call
  `defineMid` with literals only; imported values are read at call time.
- **`DEPTH.w`:** a per-kind weight defaults to the tag weight, so add a `DEPTH.w` entry only for a
  measured reason (`depth-probe`). It is a shared line in `src/depth.ts`: expect a rebase there.
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
  Drive table. Until then, fly a `wip` one with `?mid=<kind>` (`lab.ts` `forcedMid`): it takes slot A of every
  biome stage on a picker layout, any descent, so give it a `fit` and call `bandFit` when `e.host` is set (the
  retired midboss KEEPSAKE did, D53). `?mid=` works on any web build, deployed included; add `&stage=<biome>&x=<slot A WARNING - 30>&kit=mid`
  (the jump switch, dev server only) to start at its WARNING. **On the phone** (the APK has no query string): title
  LAB > FORCE MID (shown only while the roster has a `wip` kind) cycles off / each `wip` kind in roster order (stored in `grodius.lab` as `mid`, off by default),
  and while one is forced JUMP TO MID (`jump.ts` `midJump`) flies that same URL jump from the LAB: Descent 1, the
  first biome stage, mid kit, 30 px before slot A's WARNING, run-save slot sealed until the next DESCEND or RE-ENTER.
  Precedence: a `?mid=` naming a `wip` kind beats the row; any other `?mid=` is ignored and the row applies. Both
  rows are picker-layout only (FORCE MID says LONG ONLY on short; the jump hides). The title's LAB row names the forced
  kind, since every run then flies it. Off, nothing changes (harness, parity and the probes boot with no LAB key).
  A forced `wip` kind still leaves the profile alone (below). Set `boot: true` too: the warm-up's `routeArt` walks only biome slots,
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

## Adding a stage boss

The registry (D55, THE KEEPSAKE first): a boss that ends a stage, not a midboss. The crux, butcher and Maws predate it and
stay in `enemies/update.ts`'s switch.

1. **`src/enemies/boss/<k>.ts`**: one `defineBoss('<k>', { et, name, word, spawn, update, kill, ... })`
   (`enemies/boss/registry.ts` BossSim). `et` has `big: 1, mini: 1`, **never `mid`** (killEnemy's midboss branch would
   fire a second banner and first-kill pay). Its HP goes through `mk()`/`depthHP` like every stage boss; add a
   `DEPTH.w` entry. `spawn(b)` sets `$.G.mini`. Damage rules go on the entity at spawn: `e.armor(e, d, hx, hy, dir)` and
   `e.hitSnd(e, m)` (`roster.ts` midMul / midHitSnd read them, so every damage path asks). A part reuses `nailbar`
   (`par: e`, its own `armor`), drawn by the boss (`render/enemies.ts` drawNailbar skips the boss's parts). `kill(e)`
   pays the reward (`miniReward`, `clearStage`) and shows the readout, which goes in `stages.ts` BOSS_READOUTS.
   Optional: `warn` (audio on the WARNING), `prep` (audio at the stage's build: lazy banks, `audio.ts` bankWant),
   `runup` (the run-up log line), `arena` (movement C over its fight, `biomes.ts` rewriteTerrain).
2. **`src/render/gross/boss/<k>.ts`**: `export default { draw, under, warm, built, drop }`; the warm-up treats it as
   route art when `warmplan.ts` routeArt names it.
3. **Placement**: `registry.ts` `bossFor(slot, loop, picker)`, pure, by slot and descent (never world x, never RNG),
   picker layouts only so `short` keeps parity. `biomes.ts` `slotBoss` reads it.

Both folders load by file name; `main.ts` `checkBosses` refuses to boot when a placed boss has no sim or art file.
Measure with `tools/boss-probe.mjs` (it stages THE KEEPSAKE at slot 1), `rng-probe`, `perf-probe` and its shots rig
(`tools/keepsake-shots.mjs`).

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
