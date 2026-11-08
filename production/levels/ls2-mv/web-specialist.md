# LS2-mv engine-specialist review (web-specialist)

Lane: LS2-mv, branch `ls2-mv`, diff `7391234..HEAD`. Scope read: `src/terrainb.ts`, `src/setdraw.ts`, `src/render/moveprops.ts`,
the `src/biomes.ts`, `src/layout.ts`, `src/runsave.ts` and `src/render/biomeart.ts` hunks, and the five tools.
Run: `npm run typecheck` is clean (no diagnostics); `npx vitest run` is 31 files, 719 tests, all green.
Not run: harness, parity, probes, build (not needed for this pass).

## Standards Compliance: 4/6

| Standard | Result |
|---|---|
| Typed new modules | PASS for `terrainb.ts` and `setdraw.ts` (no `@ts-nocheck`, annotated tuples and records, no `any`). PARTIAL for `moveprops.ts` (line 1 `// @ts-nocheck`, see S1) |
| One-line doc comments on exports | PASS. Every export in `terrainb.ts`, `setdraw.ts`, `moveAt`, `MOVES`, `stagePicks`, `drawMoveProps`, `SET_KINDS` carries one. Nothing multi-paragraph |
| Tuning tables (DEPTH pattern) | PARTIAL, see R2/S2. `MOVE` is named, commented and gives its probe, but about half the gimmick numbers sit outside it |
| No literal world x outside `layout.ts` (D20) | PASS. See below |
| Canvas 2D hygiene | PARTIAL, see R1 |
| Module boundaries / determinism | PARTIAL, see S3 |

D20 literal-x check. I found no literal world x in the terrainb, setdraw, moveprops or biomes hunks. The band comes from
`beatPlan(...).moveB`, and `lead: [100, 200]` and `blend: 200` live in `layout.ts:236`. The remaining literals are
either screen-space (`moveprops.ts:220` `x < -40 || x > W + 40`, `biomes.ts` `W - 20`) or periodic cell sizes in
`MOVE` (`every: 36/120/110/40/150/170/130`), which are terrain pitch and not positions. `x / 200`, `x / 47` and
`x / 260` in `gimmick` are noise frequencies (same idiom as `shape()`).

## Architecture

Good overall. Pure, DOM-free `terrainb.ts` and `setdraw.ts` are the right shape for this stack (unit-testable with no
mocks). The terrain stays noise-only, as the checkpoint rebuild needs. The picks are drawn once from a fresh
`stageStream(i)` and stored in `G.picks`, so a resume draws nothing. `rewriteTerrain` blends gimmick-over-A by lerp, and
the "lerp of two >=108 gaps stays >=108" argument is sound. `moveB` is derived through `beatPlan` and does not depend on
`remix`, so the hard-coded `false` at `biomes.ts` `beatPlan(slotRow(seg), from, false).moveB` is harmless.

Dependency direction. `moveprops.ts:141` imports `MOVES` from `../biomes`. `biomes.ts` already re-exports from
`./render/biomeart` and `biomeart` imports `../biomes` (a pre-existing cycle). The lane adds a second edge to it:
biomes -> biomeart -> moveprops -> biomes. It is safe today, because `MOVES` is only read at call time and is not in a
TDZ path. But a render module is now reading sim-owned state through a module that is part of a cycle. See S3.

## SOLID

- Single responsibility: `terrainb` (shape), `setdraw` (draw), `moveprops` (decor) is a clean split.
- Open/closed: `PROP[b][mv]` in `moveprops.ts:255` is table-driven and extends by adding an entry. `gimmick()`
  (`terrainb.ts:52-81`) is the opposite, an if-chain per biome with eight dense one-liners. It is the complexity hot
  spot of the lane (S4).
- Dependency inversion is not applicable here (module state is the architecture), but `biomes.ts` now owns
  `MOVES`, which both sim and render read. See S3.

## Game-Specific Concerns

Frame budget and canvas (Android WebView).
- `moveprops.ts` has no shadowBlur, filter or per-frame gradient. `glow()` (`util.ts:36`) is a cached 64 px sprite
  `drawImage`, which is right. Only two props use `'lighter'` (spires, chimney), and each pairs `lit()` and `flat()`
  with no early `continue` between them, so the composite op cannot leak.
- Work is clipped to the screen and the band (`Math.max(sc, m.a)` to `Math.min(sc + W, m.z)`) and the props are skipped
  entirely when the band is off screen (`:261`). Cost is bounded: roughly 10-25 cells and a few path strokes each, only
  while a band is on screen.
- Small per-frame allocation: `moveprops.ts:197` `for (const q of [-22, 0, 22])` allocates an array per fold per frame.
  Trivial, but the project rule is no allocation in render loops. Hoist to a module const.
- State leak (R1): no `ctx.save/restore`. After `drawMoveProps`, `lineWidth` is left at 1.4 (folds) or 1.2 (polyps),
  and `strokeStyle`/`fillStyle` are left set. `drawMoveProps` restores only `globalAlpha`. `drawBiomeDecor` then sets
  `globalAlpha = 1` and returns, so whatever draws next inherits the width.

Determinism.
- Render props are RNG-free: positions come from `hash` and cell indices, motion from `$.T`. PASS. No `R()` in render
  or fx.
- Sim side: `biomes.ts` `spawnHazard` now reads `(vent || R() < .5)`. In a vent the `R()` draw is skipped, so the
  count of sim draws differs in that case. It is deterministic (it depends on terrain and scroll, not on the
  environment), so it is acceptable, but it is a deliberate stream shift inside the Chimney only. It should be named in
  the comment.
- `stagePicks` draws a fresh `stageStream(i)` and `moveRoll` draws only on the Descent 2+ roll, so there is no
  environment-dependent draw. PASS.

Save format (`runsave.ts`). The `spUsed` and `picks` validators are tight on key shape. But see R3: they do not enforce
`sp.length === SETS_PER_STAGE`. `RUN_VERSION` does not need a bump: both fields were reserved and never written, so no
old blob can carry them with a different meaning.

## Positive Observations

- `terrainb.ts` and `setdraw.ts` are typed and import-light. `setdraw.ts` is pure so that `runsave.ts` can validate ids
  against the catalogue without pulling in a DOM.
- The `MOVE` table carries its rationale per row (spec reference, px per frame climb cost, HUD clearance) and names the
  measuring probe and test.
- `drawSets` has a correct refill rule (clears `seen` and re-seeds it with this stage's own picks, so a stage never
  holds a duplicate). The refill branch is reachable only when the pool is empty, and 5 > 3 guarantees the loop ends.
- The moveprops header states the key invariant (props stay inside the terrain mass because collision is the arrays
  only). That is the right comment for this kind of decor.
- Tests cover the D20 breath/set separation, the `SET` / `CATALOG` sync (`SET_KINDS`) and the save validators.
- `set-share.mjs` reports what it did not measure, as `.claude/rules/tools.md` requires.

## Required Changes

R1. `src/render/moveprops.ts:258-264` `drawMoveProps` leaks 2D state (`lineWidth` 1.4/1.2, `strokeStyle`, `fillStyle`)
into the rest of the frame. Wrap the loop in `ctx.save()` / `ctx.restore()`, or set `lineWidth = 1` and restore
`fillStyle`/`strokeStyle` at the end. `save/restore` on a rarely-on-screen band is cheap on the WebView.

R2. `src/terrainb.ts:52-81` and `src/render/moveprops.ts:177` hold tuning numbers that the file's own header and
`.claude/docs/coding-standards.md` say belong in a named table. Examples: ice B0 ceiling base `18 + a*10` and exponent
`1.6`; ice B1 `PH - 30` and `walk` phase; acid B1 `16 + a*8` and exponent `.7`; fire B0 `PH - 24` and `n*6` and exponent
`2.4`; fire B1 `base = 30 + a*10`; snot B0 `T.wander` is in the table, but `m` uses `/ 260` and `n * 4`; snot B1
`PH - 34 - n*6`; `moveprops.ts:177` `const e = 58` (the one cell size not read from `MOVE`, so the prop can drift from
the terrain). Add the offsets and exponents to `MOVE` (or `MOVE.<biome>.base`) with a rationale each, and add a
`tank` pitch (or a `MOVE.lake.rung`) for the prop.

R3. `src/runsave.ts` (`isStagePick`) accepts a pick whose `sp` has any length, including 0, 1 or duplicates. `biomes.ts`
(`biomeScript`, the `setIds ? setIds[setIds.length - sets.length - 1] : X.set` line) then indexes `setIds`, and a
short array gives `SET[undefined]`, which throws when the entry fires. Validate `v.sp.length === SETS_PER_STAGE`
(import it from `setdraw`) and, ideally, that every id belongs to that stage's biome. Independently, make the script
line robust: `const id = (setIds && setIds[n]) ?? X.set` with an explicit counter `n`, instead of arithmetic on
`sets.length`.

## Suggestions

S1. Type `moveprops.ts`, or at least its shape. The file is new and small (135 lines), and the standards say type a file
when changing it substantially, so a new file should start typed. Export one `MoveBand = { a: number; z: number;
blend: number; b: string; mv: number; o: number }` from `terrainb.ts` and use it for `m` in the eight prop functions
and in `MOVES`. `@ts-nocheck` hides `m.mv` typos in `PROP[m.b][m.mv]`. If a full conversion is too much for this lane,
note the reason in the header.

S2. `MOVE` is annotated nowhere. Add an interface or `as const` so a value typo fails typecheck, in line with the DEPTH
pattern (typed tables). Currently `MOVE.stair.walk` is `number[]` and `MOVE.vent` is an untyped literal.

S3. Move `MOVES` and `moveAt` out of `biomes.ts` into `terrainb.ts` (`biomes.ts` re-exports them if tests need the old
path). This removes the new `moveprops -> biomes` edge and the extra cycle through `biomeart`, so render depends only
on the pure module. `terrainb.ts` is typed, which also types `MOVES`, which is currently an implicit `any[]` in a
`@ts-nocheck` file. Also name the vent `R()` skip in the `spawnHazard` comment (see Determinism).

S4. `gimmick()` is a long if-chain that computes `a` and `n` (two `vnoise` calls) on every call even for the branches
that use neither. Mirror the `PROP` table: `const GIMMICK: Record<string, [Shape, Shape]>`, one small function per
biome and variant, each beside its `MOVE` rows. Terrain rebuild is not hot, so this is about readability and the
Open/Closed point above, not speed.

S5. `tools/set-share.mjs:27` calls `drawPicks(..., stream(seedOf(seed, loop, i)))`. That duplicates what
`biomes.ts` `stagePicks` and `stageStream` do, so the PASS/FAIL gate can drift from the game. Export a pure
`picksFor(seed, loop, i, b, v, used)` from `setdraw.ts` that both call. Also add the Node requirement to the usage
header (it imports `.ts` directly, so it needs a Node with type stripping; this machine has 25.9, and CI's Node is not
stated in the script).

S6. `tools/set-shots.mjs`: no `try/finally` around the page work, so a thrown `__fire` (for example `findIndex` of -1
then `script[-1].x`) leaves Chromium and the Vite server open (`:104-113`). Same as the pre-existing shape of
`movement-shots.mjs`, so fix both together. It also does not print a "not measured" line (rules/tools.md): say that
set pieces are shown at frame 90 on an empty screen with no terrain-gimmick hazard. Screenshots are not seeded
(`ri()` in `hatch`, `rr` in spawn), so a re-run differs in enemy positions; seed `Math.random` in the init script as
`harness.mjs` does if the shots are to be compared across runs.

S7. `tools/playtest.mjs:69` spreads `{ ...G.picks[G.stage], b: ... }` on every play frame. It is a probe, but the
spread allocates 60 times per second and perturbs GC timing in the run it is measuring. Assign it once per stage
(`if (!L.picks?.[st])`).

S8. `moveprops.ts:155` `const sh = .55 + .45 * Math.sin(...)` and similar flicker constants: fine as decor, but the
header says motion comes from `$.T`. Confirm `$.T` is the pause-aware frame counter (not `performance.now`) so the
shimmer freezes with the sim. I assumed it is from the header and did not trace `$.T`.

S9. `biomes.ts` `SET_KINDS = Object.keys(SET)` is exported only as a test hook, which the comment says. Fine, but a
`tests`-only export from a shipping module is a smell; acceptable here given `biomes.ts` is `@ts-nocheck` already.

## Verdict: CHANGES REQUIRED

Nothing is wrong with the sim (determinism, D20, gap floor, resume rebuild all hold, and 719 tests are green). But three
items are real defects of the kind the project's rules name: leaked canvas state (R1), tuning numbers outside the
table (R2), and a save validator that lets a malformed pick crash at script time (R3). All three are small. After they
are fixed this is APPROVED WITH SUGGESTIONS.
