# LS1-H0: run-save serializer, save v3, gradeKey()

Lane H0 of LS1 sprint 1 (`production/content-build-plan.md` §2, row H0; spec `design/content-expansion.md` §4 and §7 "Best grades"). Owner role: engine-programmer. Branch `ls1-h0` off main `f2f9c03`.

## What changed

| File | Change |
|---|---|
| `src/runsave.ts` (new) | Allowlisted `G`/`P` → JSON → `G`/`P`. `serializeRun`, `decodeRun` (validates every field, never throws), `applyRun` (deep copies), and the one slot `writeRun`/`readRun`/`clearRun` under `grodius.run`. `RUN_V = 1`; any other version is discarded, not migrated. **Not wired to any trigger** (item H does CP0/CP1, pause, RESUME). |
| `src/gradekey.ts` (new) | `gradeKey()` = `` `${loop+1}-${kind}` `` (`1-orbit`, `1-ice`, `1-drive`); `stageKind(i)` stub; `migrateBest()` (pure): `N-1`→`N-orbit`, `N-4`→`N-drive`, `N-2`/`N-3` dropped, kind keys kept, better grade wins on a clash, invalid grades dropped. |
| `src/save.ts` | Default `meta` is v3 with `mb: {}`. Load: after the v1→v2 refund, `v < 3` runs `migrateBest` and sets v3; `meta.mb` loaded explicitly and sanitised (positive integers only). |
| `src/stages.ts` | `clearStage` (lines 69-72) keys `meta.best` by `gradeKey()`; the tally's "BEST x" line (line 79) reads the same key. `stageLabel()` and `tally.id` unchanged. Plus one import line. |
| `tests/unit/runsave.test.ts` (new) | 18 tests. |
| `tests/unit/save.test.ts` | +8 tests (save v3 + gradeKey/migrateBest). |
| `tests/unit/stages.test.ts` | +1 test (kind key written; tally id still `N-M`). |

### Run-save allowlist (spec §4)
- **G:** `loop, stage, cpX, layout, seed, bx` (all three entries, null kept), `pk, xp, xpTot, lvl, gm, kk, gmk, meter, lives, score, bio, kills, maxCombo, seal, cleared, route, bvis, visited, seenV, remix, remixV, visitNo, mbUsed, mbSeen, spUsed, intRot, picks, st`. Required: `loop, stage, bx, route`.
- **P (loadout):** `speed, missile, double, laser, pyre, options, shield, wardLv, aegis, frag`.
- Not stored, by design: live entities, `pend` closures, `script`, `boss`, `scroll`, timers, `P.rig` (live animation/cooldown state), `G.pow`/`G.rank` (recomputed each step). Hull form is derived by `shipform.ts` from loadout + `gm` + `pk` + `meta.rig`, so it needs no field. `meta.rig` already lives in the meta save.
- `remix` quirk: `choose()` does `(G.remix ||= [0,0])` while `pickV` does `(G.remix ||= {})`; if it is ever an array carrying string keys, the serializer stores it as a plain object so the keys survive.

## Acceptance checklist

| Acceptance (row H0) | Result |
|---|---|
| Round trip lossless, including `bx` for a fork taken **late** and one taken **early** | PASS: `runsave.test.ts` "is lossless for a fork taken early / late" (early: `bx = SEG.x0`; late: `bx = scroll + W + 10`, third entry set and null) |
| A **real v2 blob** loads into v3 with Orbit and Drive best grades under the new keys and the biome-slot keys dropped | PASS: `save.test.ts` "loads a real v2 save…" (a full `snapshot()`-shaped v2 save; all other fields unchanged) |
| A bad or old blob is discarded without throwing | PASS: 11 bad run blobs (not JSON, null, old/new version, bad `bx`, unknown field, missing stage, fractional loop, bad loadout) return null and are removed from storage; throwing storage is survived. Meta save: malformed `mb` and `best` are cleaned without throwing |
| `gradeKey()` by kind with a 1-based loop part; `stageLabel()` stays for banner and `tally.id` | PASS: `save.test.ts` gradeKey, `stages.test.ts` kind-key test |
| Short layout behaviour-identical | PASS: harness `st` byte-identical (below) |

## Test output
- `npm run test:unit`: 9 files, **82 passed** (was 55 + 27 new).
- `npm run typecheck`: clean.
- `npm run build`: built.
- `npm run test:regress`: **PASS vs baseline @ 1e20b36**, `st` = `{"state":"over","score":2282,"scroll":2168,"lives":0,...}`, `errs: []`. "6/6 canvas hashes differ (advisory)": the worktree's symlinked `node_modules` puts the @fontsource files outside Vite's serving allow list (logged), so canvas text renders in a fallback font. Environment only; no render code changed in this lane.

## Stubs and open risks
- **`stageKind()` is a stub for LS1-A's `kindOf(stage)`** (slot 0 = orbit, 3 = drive, 1-2 = the biome in `G.route`). When A lands, replace its body with `kindOf`; the `gradeKey()` output format is pinned by tests and must not change.
- Field names for state other lanes create (`layout`, `seed`, `remixV`, `visitNo`, `mbUsed`, `mbSeen`, `spUsed`, `intRot`, `picks`, `cpX`) are **reserved here**; owning lanes (A, B2, F, D, H) should use these names on `G` or edit `G_FIELDS` in one place. An absent field is simply not saved.
- `meta.mb` is loaded and saved but nothing writes it yet (item F).
- Grade migration is one-way: a v3 save opened by an older build would read `meta.v` 3 and keep the kind keys (harmless: old builds ignore unknown keys and would start fresh slot keys).
- `migrateBest` keeps non-`N-M` keys as they are, so nothing a future build writes is lost.
- `stages.ts` touched outside lines 68-71 at exactly two places: the `gradekey` import and the tally `BEST` line (line 79), which must read the same key. Both trivial for lane A to rebase over.

## Merge-order notes
- New files (`runsave.ts`, `gradekey.ts`, `runsave.test.ts`) conflict with nothing.
- `save.ts`: this lane owns the v3 bump; `meta.mb` rides in it as the plan requires.
- `stages.ts`: 6 changed lines in `clearStage` + 1 import. Merge either before or after LS1-A; if A lands first, re-apply the `key = gradeKey()` lines and point `stageKind` at `kindOf`.
- Item G (`long4` economy) builds on `gradeKey()`; item H builds on `runsave.ts`.
