# LS1 sprint 2, lane D2: the in-app layout toggle (LAB)

Branch `ls1-d2`. It started off main `8ff9ba4` and was then merged with `origin/ls1-s2` at `7f0c775` (J, B1fix, C/B2 and D), as the coordinator asked: a merge, with no rebase and no force-push. Owner roles: ui-programmer + engine-programmer. Build plan row D2 (`production/content-build-plan.md` §2 Sprint 2).

## Commits

1. `77d23a2` feat: the LAB title row, storage and tests, with the hook as a stub (built on main before D was out).
2. evidence commit: the first lane report.
3. merge `origin/ls1-s2`.
4. feat: wire the LAB to `setLayout`, with `layoutChoice` as the single layout parse (this report's final state).

## What changed

| File | Change |
|---|---|
| `src/lab.ts` (new) | The LAB lives under the localStorage key `grodius.lab`, separate from `grodius.v1` (meta) and `grodius.run` (run save). Every storage call is in try/catch, like `save.ts`. The LAB is read once at load and cached, so draw code never touches storage.<br>Fields: `layout` (`short`/`long`, maps to `long4`); `mids` (`''`/`wip`, with no consumer yet: LS2); `cp` (`a` = app kill or quit only, the spec §4 default; `b` = also on death; consumer is sprint 3 H).<br>**`layoutChoice(search, lab)` is the only `?layout=` parse.** It holds D's `LAYOUT_FLAG` map (moved here from `main.ts`). Other functions: `urlLayout`, `labOf` (sanitiser), `lab()`, `activeLayout()`, `midsWip()`, `cpTrigger()`, `setLab()`, `applyRunLayout()`. |
| `src/main.ts` | D's inline boot parse is replaced by `applyRunLayout()`. It still runs at boot, before any `newGame()`, and now honours the LAB as well. It warns on an unknown value as D's did. |
| `src/menus.ts` | A `LAB` row is added **last** on the title list, so `DESCEND` stays row 0 for the harness and the probes. Its right column shows the active layout: `SHORT` or `LONG`, plus `(URL)` when a flag overrides the LAB.<br>The LAB sub-menu holds `LAYOUT`, `MIDBOSSES`, `CHECKPOINT` and `BACK`. Changing the layout calls `clearRun()`.<br>`DESCEND`, `DESCEND DEEPER` and `DESCEND AGAIN` start through `startRun()`, which calls `applyRunLayout()` and then `newGame()`. |
| `tests/unit/lab.test.ts` (new) | 17 tests: precedence, D's flag map and its "any other value is an entry id" rule, unknown and inherited (`constructor`) values, sanitising, persistence across a reload, run-save discard, blocked storage, a corrupt blob, and `applyRunLayout` (**applies long4 when the LAB says long**, URL beats LAB at run start, and it leaves a probe's in-page `--layout` alone). |
| `tools/lab-check.mjs` (new) | A Playwright check. It starts its own Vite server and uses a Fold-ish 904x388 touch viewport. It drives the real title with keys and touch taps; checks the toggle survives a reload, **starts a run with the LAB on long** and checks it flies `long4`, and checks the URL override and the run-save discard. It writes the screenshots below. |

### How the layout is applied

- **Precedence:** `layoutChoice` resolves a registered `?layout=` flag first (`long`/`long4` map to `long4`, `short` maps to `short`, any other value is tried as an entry id, as in D), then the LAB, then `short`.
- **When:** `applyRunLayout()` calls `setLayout` at boot and again at each run start, always before `newGame()`. A LAB change on the title therefore takes effect at the next run without a reload, and never mid-run, because the menu exists only on the title.
- **No flag and no LAB key:** `applyRunLayout()` leaves the active entry alone. That entry is `short` at boot. D's probes and rigs call `setLayout` in-page through `tools/layout-arg.mjs useLayout()` and then press Enter, so resetting to short at run start would have silently put `--layout long4` probes back on short. A unit test pins this. The harness, parity and every probe clear localStorage, so none of them has a LAB key.
- **Behaviour change from D (small, deliberate):** an unknown `?layout=` value used to fall back to `short` unconditionally. It now falls through to the LAB, then `short`. Without a LAB key the result is identical (short, plus a warning).

## Acceptance

| Item | Result |
|---|---|
| Toggle to long, reload: still long | **PASS** (`lab-check`: `after a reload the LAB is still LONG (long4)`; unit test) |
| A run started with the LAB on long flies long4 | **PASS** (`lab-check`: `run start flies long4 (orbit, biome, biome, drive, level 14370), stage 0`, still `play` on long4 after ~4 s; unit `applies long4 when the LAB says long`, which I watched fail against the old stub) |
| The title shows the active layout | **PASS** (LAB row: `SHORT`, `LONG`, `SHORT (URL)`; screenshots) |
| Short is the default with no LAB key | **PASS** (`lab-check` step 1; unit test) |
| URL flag > LAB > short, one parse | **PASS** (unit precedence tests; `lab-check` `?layout=short` over LAB long; `main.ts` no longer parses the flag itself) |
| Changing the layout discards `grodius.run` | **PASS** (unit test, and `lab-check` with a seeded `grodius.run`). Toggling MIDBOSSES or CHECKPOINT leaves it alone. |
| Reachable by touch and keys | **PASS** (`lab-check`: arrow keys and Enter, and touch taps through the canvas pointer path) |
| Blocked storage still boots | **PASS** (unit test) |
| Short layout identical to `ls1-s2`; the harness's fresh save has no LAB key | **PASS** (harness and parity below; both clear localStorage) |
| **Fold APK** (Matt): toggle to long, kill the app from recents, reopen: still long, and DESCEND flies long | **[ ] PENDING, Matt's check.** I can't run it. |

## Output (merged tree)

```
npm run test:unit      Test Files 20 passed (20), Tests 356 passed (356)
npm run typecheck      exit 0
npm run build          ✓ built
npm run test:regress   st {"state":"over","score":1243,"scroll":3538,"lives":0,...}  PASS vs baseline @ 8ff9ba4
                       (the ls1-s2 baseline, moved by B1fix/B2 on that branch; not re-baselined here)
node tools/layout-parity.mjs (no --update)
  PARITY PASS vs baseline @ ls1-s2 after J + B1FIX + C/B2: runs 3, 6, 7, 11, 15, 3x3, 7m identical
  not measured: seeds 2 and 3 (their bots cannot kill the Gravity Drive)
node tools/lab-check.mjs   15 PASS, 0 FAIL, no page errors
```

## Screenshots (`production/qa/evidence/ls1-d2/`, 904x388 CSS px at DPR 2, touch)

- `title-lab-short.png`: fresh save, LAB row `SHORT`
- `lab-submenu-long.png`: the LAB sub-menu after the toggles (`LAYOUT LONG`, `MIDBOSSES OFF`, `CHECKPOINT ON DEATH`)
- `title-lab-long.png`: back on the title, LAB row `LONG`
- `title-lab-long-reloaded.png`: after a reload, still `LONG`
- `long-orbit-1s.png`, `long-orbit-4s.png`: DESCEND with the LAB on long, the first seconds of long Open Orbit (`STAGE 1-1 OPEN ORBIT`; the HUD depth marks sit at long4's 3700/7270 of 14370, not short's)
- `title-url-override.png`: `?layout=short` with the LAB on long: `SHORT (URL)`

## What was not measured

- The long run past its first seconds. D's `stage-clock`, `beat-probe` and `movement-shots` own long4's pacing; this lane only proves that the LAB selects it.
- The Fold APK app kill (Matt). The web reload covers the same localStorage path, but the WebView's storage surviving an app kill on the device isn't checked.
- The real Fold screen: the screenshots use a Fold-ish viewport in Chromium, not the device.
- The audio-gate screen (first web load, before a key or tap) shows no menu, so the layout isn't on screen until the gate opens. The APK usually skips the gate.
- The OPTIONS sub-menu doesn't show the layout. The main title view and the LAB sub-menu do.

## Open risks and notes

- **Copy:** the row labels (`LAB`, `MIDBOSSES WIP/OFF`, `CHECKPOINT QUIT ONLY/ON DEATH`) are dev labels, not reviewed copy. The playtest checklist (build plan §6) says "checkpoint RESTART"; the row says `ON DEATH`. Align one with the other in review.
- **Visible to everyone:** the LAB row shows on the Pages build, so anyone can now fly long4 from the title. That matches the plan (a dev row on the title, as with `?layout=long`). If friends shouldn't see it before Matt's L playtest, gate the row behind a URL flag or a long-press.
- **A stale LAB overrides nothing a tool sets:** tools clear storage first. A developer with a LAB key set who runs a probe in their own browser profile isn't affected either, since the probes use fresh Playwright contexts.
- **Fonts in worktrees:** `tools/lab-check.mjs` adds the real path of `node_modules` to Vite's `fs.allow`, because a worktree's `node_modules` is a symlink. The harness and parity tools still log "outside of Vite serving allow list" in worktrees, as they did before this change, with no effect on `st`.

## Merge order

`ls1-d2` now contains `origin/ls1-s2` (`7f0c775`). It merges after D, as planned. The only file both D2 and D touch is `src/main.ts`: D's boot parse block is replaced by `applyRunLayout()`, and its `LAYOUT_FLAG` map moved to `src/lab.ts`. Nothing else imported it.
