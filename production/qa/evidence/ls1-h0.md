# LS1-H0: run-save serializer, save v3, gradeKey()

Lane H0 of LS1 sprint 1 (`production/content-build-plan.md` §2, row H0; spec `design/content-expansion.md` §4 and §7 "Best grades"). Owner role: engine-programmer. Branch `ls1-h0` off main `f2f9c03`.

## What changed

| File | Change |
|---|---|
| `src/runsave.ts` (new) | Allowlisted `G`/`P` → JSON → `G`/`P`. `serializeRun`, `decodeRun` (own-key allowlist, typed and lower-bounded fields, never throws), `applyRun` (deep copies), and the one slot `writeRun` (refuses a state that would not read back)/`readRun`/`clearRun` under `grodius.run`. `RUN_V = 1`; any other version is discarded, not migrated. **Not wired to any trigger** (item H does CP0/CP1, pause, RESUME). |
| `src/gradekey.ts` (new) | `gradeKey()` = `` `${loop+1}-${kind}` `` (`1-orbit`, `1-ice`, `1-drive`); `stageKind(i)` stub; `migrateBest()` (pure, idempotent): `N-1`→`N-orbit`, `N-4`→`N-drive`, `N-2`/`N-3` out, kind keys kept, better grade wins on a clash, invalid grades dropped; `slotGrades()` collects the dropped `N-2`/`N-3` grades for `meta.bestV2`. |
| `src/save.ts` | Default `meta` is v3 with `mb: {}`. Load: after the v1→v2 refund, `migrateBest` runs on **every** load (cleans v3 imports too), dropped slot grades go to `meta.bestV2` (kept, never read; decision log D19-Q19), v set to 3; `meta.mb` loaded explicitly, numbers ≥ 1 only (no `+n` coercion of imported objects). |
| `src/stages.ts` | `clearStage` (lines 69-72) keys `meta.best` by `gradeKey()`; the tally's "BEST x" line (line 79) reads the same key. `stageLabel()` and `tally.id` unchanged. Plus one import line. |
| `tests/unit/runsave.test.ts` (new) | 34 tests. |
| `tests/unit/save.test.ts` | +12 tests (save v3, gradeKey, migrateBest, slotGrades). |
| `tests/unit/stages.test.ts` | +1 test (kind key written; tally id still `N-M`). |

### Run-save allowlist (spec §4)
- **G:** `loop, stage, cpX, layout, seed, bx` (all three entries, null kept), `pk, xp, xpTot, lvl, gm, kk, gmk, cur, lives, score, bio, kills, maxCombo, seal, cleared, route, bvis, visited, seenV, remix, remixV, visitNo, mbUsed, mbSeen, spUsed, intRot, picks, st`. Required: `loop, stage, bx, route`.
- **P (loadout):** `speed, missile, double, laser, pyre, options, shield, wardLv, aegis, frag`.
- Not stored, by design: live entities, `pend` closures, `script`, `boss`, `scroll`, timers, `P.rig` (live animation/cooldown state), `G.pow`/`G.rank` (recomputed each step). Hull form is derived by `shipform.ts` from loadout + `gm` + `pk` + `meta.rig`, so it needs no field. `meta.rig` already lives in the meta save.
- `remix` quirk: `choose()` does `(G.remix ||= [0,0])` while `pickV` does `(G.remix ||= {})`; if it is ever an array carrying non-index keys, the serializer stores it as a plain object so the keys survive. A merely sparse array (`P.frag`) stays an array; its holes read back as `null`, which `player.ts` reads as 0.

## Acceptance checklist

| Acceptance (row H0) | Result |
|---|---|
| Round trip lossless, including `bx` for a fork taken **late** and one taken **early** | PASS: `runsave.test.ts` "is lossless for a fork taken early / late" (`toStrictEqual`; early: `bx = SEG.x0`; late: `bx = scroll + W + 10`, third entry set and null) and "keeps a sparse frag readable" (review fix S5: the first build failed this case) |
| A **real v2 blob** loads into v3 with Orbit and Drive best grades under the new keys and the biome-slot keys dropped | PASS: `save.test.ts` "loads a real v2 save…" (a full `snapshot()`-shaped v2 save; all other fields unchanged) |
| A bad or old blob is discarded without throwing | PASS: 25 bad run blobs (not JSON, null, old/new version, bad `bx`, unknown field, missing stage/bx/route/G, fractional loop, bad loadout, inherited names `toString`/`constructor`/`hasOwnProperty`/`__proto__`, negative stage/loop/lives/gun level, non-number perk level, own `__proto__` in a table) return null and are removed from storage; throwing storage is survived; `writeRun` refuses a NaN state. Meta save: an `mb` entry that throws on number conversion no longer resets the save (settings and hi kept), and a v3 import with a junk `best` is cleaned (review fixes S3, S4; the first build failed both) |
| `gradeKey()` by kind with a 1-based loop part; `stageLabel()` stays for banner and `tally.id` | PASS: `save.test.ts` gradeKey, `stages.test.ts` kind-key test |
| Short layout behaviour-identical | PASS: harness `st` byte-identical (below) |

## Test output
- `npm run test:unit`: 9 files, **102 passed** (55 before H0; 82 at the first H0 commit; +20 from review fixes).
- `npm run typecheck`: clean.
- `npm run build`: built.
- `npm run test:regress`: **PASS vs baseline @ 1e20b36**, `st` = `{"state":"over","score":2282,"scroll":2168,"lives":0,...}`, `errs: []`. "6/6 canvas hashes differ (advisory)": the worktree's symlinked `node_modules` puts the @fontsource files outside Vite's serving allow list (logged), so canvas text renders in a fallback font. Environment only; no render code changed in this lane.

## Stubs and open risks
- **`stageKind()` is a stub for LS1-A's layout.** On `ls1-a`, `kindOf()` returns `'biome'` for both biome rows (`layout.ts:13`), so it must NOT replace the body as is: that would key both slots `N-biome`. The A+H0 merge maps `kindOf(i) === 'biome'` to `G.route[row(i).slot]` and keeps the `orbit`/`drive`/biome-id strings, which `save.test.ts` pins.
- Field names for state other lanes create (`layout`, `seed`, `remixV`, `visitNo`, `mbUsed`, `mbSeen`, `spUsed`, `intRot`, `picks`, `cpX`) are **reserved here**; owning lanes (A, B2, F, D, H) should use these names on `G` or edit `G_FIELDS` in one place. An absent field is simply not saved.
- `meta.mb` is loaded and saved but nothing writes it yet (item F).
- Item H entry criteria from the review (pending picks/boost/seal at CP0; `stage` upper bound by layout; `resetPlayer()` before `applyRun()`; `kindOf` strings) are recorded under Sprint 3 in `production/content-build-plan.md`.
- Grade migration is one-way: a v3 save opened by an older build would read `meta.v` 3 and keep the kind keys (harmless: old builds ignore unknown keys and would start fresh slot keys).
- `migrateBest` keeps non-`N-M` keys as they are, so nothing a future build writes is lost.
- `stages.ts` touched outside lines 68-71 at exactly two places: the `gradekey` import and the tally `BEST` line (line 79), which must read the same key. Both trivial for lane A to rebase over.

## Merge-order notes
- New files (`runsave.ts`, `gradekey.ts`, `runsave.test.ts`) conflict with nothing.
- `save.ts`: this lane owns the v3 bump; `meta.mb` rides in it as the plan requires.
- `stages.ts`: **conflicts with `ls1-a`** (`git merge-tree`, found by the producer): H0's `clearStage` best-grade lines meet A's layout rewrite. H0 merges cleanly with B1, F0, G0 and P0. Recommended: merge H0 before A; A's merge resolves `stages.ts`, wires `stageKind` as above, and re-runs the harness, parity check and `save.test.ts`.
- Item G (`long4` economy) builds on `gradeKey()`; item H builds on `runsave.ts`.

## Studio Hierarchy review (2026-11-01)

- **Tier 3:** web-specialist, security-engineer, qa-tester: all APPROVE WITH NOTES, 7 should-fix (S1-S7) and 3 nits.
- **Tier 2 leads, first pass:** lead-programmer BLOCK (S1, S3, S5), qa-lead BLOCK (S3, S5), release-manager BLOCK (S3, S4); game-designer APPROVE WITH NOTES (keep dropped slot grades, log Q19); art-director and narrative-director APPROVE WITH NOTES (patch-notes line); audio-director and localization-lead NO IMPACT.
- **Fixed in H0 (Matt's choice: blockers + cheap should-fix):** S1 own-key allowlist; S2 lower bounds and number-only tables (stage upper bound deferred to H); S3 `meta.mb` numbers only; S4 `migrateBest` on every load; S5 sparse arrays stay arrays; S6 `writeRun` verifies its output; N1 `cur` instead of the dead `meter`; N2 doc comment; N3 test hygiene. **Matt's choice: keep dropped slot grades in `meta.bestV2`**; Q19 logged as decided-by-default; CHANGELOG line added.
- **Deferred to item H:** S7 and the rest, recorded as H entry criteria.
- **Lead re-review:** lead-programmer, qa-lead, release-manager: blocks lifted (APPROVE WITH NOTES).
- **Directors:** technical-director, creative-director, producer: SIGN OFF WITH NOTES. Their doc notes are applied (evidence counts, the A-merge conflict and `kindOf` mapping, CHANGELOG wording, `bestV2` owner, save-hardening backlog). Release note: reverting `main` to a build from before H0 drops `meta.mb` and `meta.bestV2` on that build's next save; roll-forward recovers the slot keys.
- **Studio review line for the merge commit:** `Studio review: Tier 3 approve with notes; all 8 leads approve (3 blocks lifted after 862f76c); directors sign off with notes.`
