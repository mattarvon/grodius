# LS1 sprint 2, lane D2: the in-app layout toggle (LAB)

Branch `ls1-d2`, off main `8ff9ba4`. Owner roles: ui-programmer + engine-programmer. Build plan row D2
(`production/content-build-plan.md` §2 Sprint 2).

## What changed

| File | Change |
|---|---|
| `src/lab.ts` (new) | The LAB: localStorage key `grodius.lab`, separate from `grodius.v1` (meta) and `grodius.run` (run save). Fields `layout` (`short`/`long`, maps to `long4`), `mids` (`''`/`wip`, no consumer yet: LS2), `cp` (`a` = app kill or quit only, the spec §4 default; `b` = also on death; consumer is sprint 3 H). Pure `layoutChoice(search, lab)` and `urlLayout(search)` (URL `?layout=` > LAB > `short`), `labOf()` sanitiser, the cached `lab()`, `activeLayout()`, `midsWip()`, `cpTrigger()`, `setLab()`. Every storage call is in try/catch, like `save.ts`. The LAB is read once at load and cached, so draw code never touches storage (UI rule). |
| `src/menus.ts` | A `LAB` row added **last** on the title list, so `DESCEND` stays row 0 for the harness and the probes. Its right column is the active layout (`SHORT` / `LONG`, plus `(URL)` when a `?layout=` flag overrides the LAB). A LAB sub-menu holds `LAYOUT`, `MIDBOSSES`, `CHECKPOINT` and `BACK`. Changing the layout calls `clearRun()`. `DESCEND`, `DESCEND DEEPER` and `DESCEND AGAIN` now start through `startRun()`, which calls `applyRunLayout()` and then `newGame()`. |
| `tests/unit/lab.test.ts` (new) | 13 tests: precedence, sanitising, persistence across a fresh import (a reload), run-save discard on a layout change only, blocked storage, a corrupt blob, the stub. |
| `tools/lab-check.mjs` (new) | A Playwright check. It starts its own Vite server and uses a Fold-ish 904x388 touch viewport. It drives the real title with keys and touch taps, checks the toggle survives a reload, checks the URL override and the run-save discard, and writes the screenshots below. |
| `production/qa/evidence/ls1-d2/*.png` | Title screenshots. |

`src/render/screens.ts` is unchanged in the end. I first added a `LAYOUT …` tag beside `HI`, but with the real font it ran into the credits, and the LAB row already shows the active layout. So it was removed.

## The setLayout hook: a stub (needs item D)

`applyRunLayout()` in `src/lab.ts` is the one place a run's layout gets applied, just before `newGame()`. On this branch it is a **stub that returns `'short'` and calls nothing**, because:
- `origin/ls1-d` had not been pushed when this lane finished, so there is no flag parse and no `long4` entry to switch to;
- hard rule 5 / the J tripwire: no new `setLayout` caller may exist while the deprecated aliases do.

**Wiring once D (and J) are on main.** Replace the body with `const c = activeLayout(); setLayout(c.id); return c.id;`. If D keeps its own boot-time `setLayout` in `main.ts`, either is fine: `applyRunLayout` runs again at every run start, so a LAB change on the title takes effect at the next run without a reload (the brief's "next run start, not mid-run"). D's `?layout=` parse and `urlLayout()` here should agree. `urlLayout` accepts `short`, `long` and `long4`. If D parses the flag differently, make `layoutChoice` the single source. Then turn the stub test in `lab.test.ts` into "applies long4 when the LAB says long", and run `tools/lab-check.mjs` again plus a run start with the LAB set to long.

## Acceptance

| Item | Result |
|---|---|
| Toggle to long, reload: still long | **PASS** (`lab-check`: `after a reload the LAB is still LONG (long4)`; unit `persists a toggle … reads it back after a reload`) |
| The title shows the active layout | **PASS** (LAB row right column: `SHORT`, `LONG`, `SHORT (URL)`; screenshots) |
| Short is the default with no LAB key | **PASS** (`lab-check` step 1; unit `defaults to short with no grodius.lab key`) |
| URL flag > LAB > short | **PASS** (unit precedence tests; `lab-check` `?layout=short` over LAB long → `SHORT (URL)`) |
| Changing the layout discards `grodius.run` | **PASS** (unit, and `lab-check` with a seeded `grodius.run`). Toggling MIDBOSSES or CHECKPOINT leaves it alone. |
| Reachable by touch and keys | **PASS** (`lab-check` opens LAB with ArrowDown/Enter, toggles LAYOUT with Enter, and taps MIDBOSSES twice, CHECKPOINT once and BACK through the canvas pointer path) |
| Blocked storage still boots | **PASS** (unit: every storage call throws; the toggle holds for the session) |
| Harness and parity identical; the fresh save has no LAB key | **PASS**. Both tools start from `localStorage.clear()`, so there is no `grodius.lab` and every run is `short`. The LAB row is appended after OPTIONS, so `DESCEND` is still row 0. |
| A run actually flies `long4` with the LAB set to long | **NOT DONE: stub** (see above; needs D) |
| **Fold APK** (Matt): toggle to long, kill the app from recents, reopen: still long | **[ ] PENDING, Matt's check.** I can't run it. |

## Output

```
npm run test:unit      Test Files 17 passed (17), Tests 221 passed (221)
npm run typecheck      clean
npm run build          ✓ built (only the existing chunk-size notice)
npm run test:regress   st {"state":"over","score":4885,"scroll":2168,"lives":0,...}  PASS vs baseline @ f2f9c03
                       note: 1/6 canvas hashes differ (advisory). Pre-existing: the same 6 hashes come out with
                       main's menus.ts, so it is not this change
node tools/layout-parity.mjs
  PARITY PASS vs baseline @ sprint-1 merge: runs 1, 5, 6, 7, 11, 1x3, 7m identical
  not measured: seeds 2 and 3 (their bots cannot kill the Gravity Drive)
node tools/lab-check.mjs   12 PASS, 0 FAIL, no page errors
```

## Screenshots (`production/qa/evidence/ls1-d2/`, 904x388 CSS px at DPR 2, touch)

- `title-lab-short.png`: fresh save, LAB row `SHORT`
- `lab-submenu-long.png`: the LAB sub-menu after the toggles (`LAYOUT LONG`, `MIDBOSSES OFF`, `CHECKPOINT ON DEATH`)
- `title-lab-long.png`: back on the title, LAB row `LONG`
- `title-lab-long-reloaded.png`: after a reload, still `LONG`
- `title-url-override.png`: `?layout=short` with the LAB on long: `SHORT (URL)`

## What was not measured

- A run flying `long4`: the hook is a stub until D.
- The Fold APK app-kill persistence (Matt). The web reload covers the same localStorage path, but the WebView's storage surviving an app kill on the device isn't checked.
- The real Fold screen: the screenshots use a Fold-ish viewport in Chromium, not the device.
- The audio-gate screen (first web load, before a key or tap) shows no menu, so the layout isn't on screen until the gate opens. The APK usually skips the gate (Android allows autoplay).
- The OPTIONS sub-menu doesn't show the layout. The main title view and the LAB sub-menu do.

## Open risks and notes

- **Copy:** the row labels (`LAB`, `MIDBOSSES WIP/OFF`, `CHECKPOINT QUIT ONLY/ON DEATH`) are dev labels, not reviewed copy. The playtest checklist (build plan §6) says "checkpoint RESTART"; the row says `ON DEATH`. Align one with the other in review.
- **Visible to everyone:** the LAB row shows on the Pages build too, so friends can switch to long once D wires it. That matches the plan (a dev row on the title). If it should be hidden, gate it behind a URL flag or a long-press.
- `tools/lab-check.mjs` adds the real path of `node_modules` to Vite's `fs.allow`, because a worktree's `node_modules` is a symlink and fonts were refused otherwise. The harness and parity tools still log the same "outside of Vite serving allow list" warnings in worktrees (they existed before this change and don't affect `st`).

## Merge order

D2 goes in **after D's flag parse** (and so after J). Rebase onto main once D has merged, wire `applyRunLayout()` as described above, then run the unit tests, `lab-check`, the harness and parity again. If `ls1-b1fix` moves the baselines first, compare against the new ones; this lane doesn't touch either baseline.
