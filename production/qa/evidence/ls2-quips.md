# LS2-quips: SGT. RAMROD SLAB's quips after big kills

Matt (2026-11-09): "add calamari served and some other random cheesy one liners I can customize as needed in the sound
booth". Asked when they play, he chose "On big moments": only after a midboss or stage-boss kill, as a chance roll after
the kill word.

Branch `ls2-quips` off `ae0d137`. Commits: `251ce14` (build), `cf5ec8e` (review batch 1 + tests), `61d24b4` (review
batch 2), and the report commit. Local only, not pushed (lane brief).

## What changed

| Area | Files | What |
|---|---|---|
| Quip list | `src/voice/quips.json` | `[{ id, text, note? }]`: CALAMARI SERVED plus 8 lines (writer drafted, narrative-director cut two and checked tone) |
| Quip rules | `src/voice/quiplist.ts` (new, a leaf with no imports) | caption rules (`normText`, `textError`: caps, 2 lines of 20, `A-Z 0-9 . , ' ? -`, no `!`, no stray `/`), `newId`, `parseQuips` (never throws, bad rows reported), `QUIP` tuning (`chance` .35, `maxLate` 2.5 s), `pickQuip` (a shuffle bag) |
| Game list | `src/voice/quips.ts` (new) | imports the JSON through `parseQuips`; `quipCaption(cat)` |
| Trigger | `src/audio.ts` | `quipAfterKill(word, at, force)`, `dropQueuedQuips()`; `VOICE_CAT` gains `quip-`; in `sample()`, any other voice line takes a queued quip's place, but only once that line is sure to play |
| Call sites | `src/enemies/update.ts`, `src/stages.ts` | after a midboss's kill word (`quipAfterKill(M?.word, KILL_WORD_AT)`); in the stage-boss pend after `bossreward` (`quipAfterKill(BOSS_READOUTS)`, only while `$.state` is `play`) |
| Comms window | `src/render/hype.ts` | `quip-<id>` is SLAB's (`SLAB_CAT`), captioned with the quip's own words |
| Test hook | `src/vox.ts` | `?vox=quip-<id>` (the booth's T) and `?vox=quip` (the game's own pick, forced) |
| Booth | `tools/booth/{plugin,booth,slots,args}.ts`, `booth.html`, `reprocess.mjs`, `README.md` | the Quips section: add, edit, delete; stale-take flag; `GET/POST /__booth/quips`; quip folders as voice slots for keep, delete and reprocess; pause squeeze default off for quips |
| Tests | `tests/unit/quips.test.ts`, `tests/integration/booth-quips.test.ts` (new); `booth.test.ts`, `firstkill.test.ts`, `midhooks.test.ts` (mocks and pins) | 56 + 24 new tests |

### Choices

- **The id never changes.** A quip's id is the slug of its first words, made unique against the list and every
  `quip-*` folder left on disk. Editing the words keeps it, so the folder and take names never move and no take is
  orphaned. Each kept take records the words it was recorded to (beside its raw take in `assets-raw/`), and the booth
  marks a take whose words differ **stale: says ...**. The game captions it with the current words. This flag lives
  only on the machine that recorded the take.
- **Delete** asks first; with takes it deletes the processed takes too (only files named `<id>-matty-<n>.ogg`; any
  other file refuses). The list is written first, then the takes go. The raw takes stay in `assets-raw/`.
- **A broken hand edit** of `quips.json` drops only its rows from the game, and the booth shows it in red and refuses
  every quip edit until it is fixed by hand (a write would lose those rows).
- **Writes** go through the existing guard (loopback, no proxy headers, local Host, token, Origin), in the keep queue,
  via a temp file in `assets-raw/voice/` renamed into `src/voice/quips.json` (same disk checked; `wx`, no symlinks).
  Only `src/voice/quips.json` and `src/sfx/quip-*/` are written.

### In the game

- After a midboss kill word or a stage boss's readout, 35% of the time (`QUIP.chance`: about 4 of a run's ~12 big
  kills), one recorded quip plays as SGT. RAMROD SLAB with its words as the caption, queued behind the kill word on the
  audio clock.
- **Shuffle bag:** every recorded quip plays once before any repeats, and the bag carries across runs.
- **Never one whose words are the readout just shown:** CALAMARI SERVED never follows the Saucer; the stage-boss call
  avoids TAKEN DOWN, TORN APART and GATE SEALED.
- **Skipped, with no roll,** when anything but its own kill word is on the comms, or when it could not start within
  2.5 s of the kill (`QUIP.maxLate`; the clean case is 1.9 s).
- **Gives way:** any other voice line called while the quip still waits takes its place; one already talking finishes.
- **Silent** with nothing recorded (no draw at all), muted, or with no audio running (the harness).
- **D50:** game over drops a queued quip, a new game or the title cuts a talking one, and the stage-boss pend no longer
  speaks once the run is over.
- **Determinism:** the roll, the shuffle and the take pick draw only `ar()`. No `R()`, no `srnd()`, no sim state read
  or written beyond `$.state` in the pend guard. With no AudioContext, `quipAfterKill` returns before any draw.

## Acceptance checklist

- [x] One editable quip list the game reads: `src/voice/quips.json`; each quip records into `src/sfx/quip-<id>/`.
- [x] Editing the words keeps the id; old takes are flagged stale (booth), never orphaned.
- [x] Booth Quips section: add, edit, delete (with a confirm and its takes), record like any slot (SLAB, deadpan, 2 s
      target); writes only the list and `src/sfx/quip-*/` through the guarded endpoint. Screenshot below.
- [x] Seed list: CALAMARI SERVED + 8 (writer, narrative-director). No recordings made.
- [x] Game trigger after a midboss kill word and a stage-boss kill, at a named 35% with rationale, `ar()` only, a
      random recorded quip never the same as the last (a shuffle bag: never the same until all have played), comms
      queue as SLAB with the quip caption, silent with no takes, D50 voice rules kept. Unit-tested with a stubbed
      `BANK`.
- [x] `?vox=quip` (and `?vox=quip-<id>` for the booth's T).
- [x] Dev only: nothing of the editor in dist (dist grep below).
- [x] No test take left in `src/sfx/`.

## Evidence

- `ls2-quips/booth-quips-section.png`: the booth with CLOSED CASKET selected: the Quips section under the fixed lines,
  the add box at its foot, the words editor, SLAB's face and the quip's delivery note, the pause squeeze off.
- `ls2-quips/quip-ingame-window.png` (three frames) and `quip-ingame-full.png`: `?stage=orbit&vox=quip-closed-casket`
  with a synthetic 8 s sine take (made for the shot and deleted after): the comms window opens with SLAB's face, the tag
  SGT. RAMROD SLAB and the caption CLOSED CASKET. The caption font is the serif fallback: the known dev-server font
  issue with the worktree's `node_modules` symlink; blackletter in a real build.
- The booth round trip (Playwright, own dev server :5321): added TEST QUIP / PLEASE IGNORE, edited it with Enter,
  `BANG!` refused ("letters, digits, spaces and . , ' ? - only"), deleted it; 9 quips after; `git status` showed
  `quips.json` byte-identical.

## Tests

- `tests/unit/quips.test.ts` (qa-tester, then extended): `pickQuip` (no draw when nothing may play, the chance
  boundary, the bag: all before a repeat, a new bag never opens with the last, an avoided quip stays for the next kill,
  a gone quip leaves the bag), the caption rules, the shipped list (9, zero errors), `quipAfterKill` with a stubbed
  `BANK` and a fake context (fires only with takes, silent with no context / suspended / muted / empty, the readout
  skip, queued behind the kill word, `Math.random` never called, hit rate 0.2-0.5 over 200 kills), the busy skip, the
  max lateness, preemption by another line, OPENED skipped behind the kill word leaving the quip queued, the comms
  window caption, game over and new game, and source pins on both call sites.
- `tests/integration/booth-quips.test.ts` (qa-tester): `editQuips` on a temp repo (add, edit, delete with and without
  takes, every refusal and its code, a broken list refused and left byte-identical, the written file, no temp file
  left), `quipSlot` / `voiceSlot`, and `parseArgs` with quips.
- **Watched failing:** the four queue-rule tests against `audio.ts` without the rules (4 failed); the OPENED test
  against the old `sample()` order (1 failed); qa-tester broke `audio.ts` twice (no-repeat and the readout skip: 3 and
  2 failed).

## Gates

All on `61d24b4` (each log starts with the sha and `git status`; only the gate logs themselves were untracked).
Heavy jobs ran one at a time under `/tmp/grodius-heavy.lock`, each after a Tctl wait at 80 °C. Harness and parity ran
against the lane's own dev server (port 5322, private cacheDir), stopped by PID afterwards; no source was edited while
they ran.

| Gate | Result | Log |
|---|---|---|
| `npm run typecheck` | `typecheck=0` | `ls2-quips/gate-typecheck.txt` |
| `npx vitest run` | 1315 passed, 1 expected fail (the known `it.fails`); `vitest=0` | `ls2-quips/gate-vitest.txt` |
| `npm run build` + dist grep | `build=0`; `__booth`, `x-booth`, `booth-token`, `editQuips`, `quipOp`, `QUIP_BODY`, `vox=`, `voxBoot`: 0 files each. The quip list itself ships in the game bundle (by design: the captions) | `ls2-quips/gate-build.txt` |
| harness short, long4, 12 scenarios (no `--update`) | all 14 PASS vs their baselines; `regress=0`; no baseline moved | `ls2-quips/gate-harness.txt` |
| `node tools/layout-parity.mjs` (no `--update`) | PARITY PASS; `parity=0` | `ls2-quips/gate-parity.txt` |

The harness has no AudioContext, so `quipAfterKill` returns before any draw there: short and long4 staying identical
is the proof that the trigger leaves the sim alone.

## Agents used

| Agent | What it did | What changed |
|---|---|---|
| writer | Drafted CALAMARI SERVED + 8 and 4 alternates | The seed list |
| narrative-director | Tone check against Pillar 5 and "evil, not cartoonish" | Swapped HAVE A NICE AFTERLIFE and STICK A FORK IN IT (a second food joke) for GUT FEELING / CONFIRMED and DEAD WEIGHT / LEAVE IT; no trailing periods, to match the HYPE captions; delivery notes |
| audio-director | Ruled on the frequency and the queue: APPROVE WITH CHANGES | The shuffle bag, the busy skip, `QUIP.maxLate`, preemption by any other voice line, squeeze default off for quips |
| security-engineer | Reviewed the new write path: no S1/S2, 4 S3 | The list written before takes are deleted, the temp file (`wx`, same-disk check), `newId` fitting its suffix, the JSON reader settling on abort, take DELETE through the keep queue |
| qa-tester | Wrote both test files (68 tests); found the stray-`/` caption bug | Bug fixed |
| tools-programmer | Reviewed the booth editor: 1 S2, 7 S3 | Blur after a save, Escape reverts, caret kept, a busy delete says why, the error line re-read after a refusal, a bad note reported instead of cut, README wording |
| gameplay-programmer | Reviewed the trigger: 2 S2, 2 S3 | OPENED no longer cancels a quip it can't replace; no quip once the run is over; the stage-boss call avoids every readout |

I built the quip rules, the trigger, the plugin endpoints and the booth page myself and applied every fix above. The
leads-and-directors review is the parent's.

## Not measured

- **How the lines sound.** No quip is recorded; the queue and the window were tested with stubbed buffers and one
  synthetic take.
- **A real midboss or boss dying into a quip in a real run.** The call sites are pinned by source checks; the
  harness has no AudioContext, so it never reaches the roll.
- **Phone (Fold) shots.** The comms window is unchanged.

## Open risks and notes for the hierarchy pass

- **Matt's call (audio-director S3):** a quip already talking finishes on game over (D50, like any line). REST IN
  PIECES or DEAD WEIGHT / LEAVE IT over the player's own death could read as SLAB mocking the player. Cutting a
  talking quip at game over is a one-line rule if he wants it.
- **Game-designer to confirm:** the gate boss (GATE SEALED) counts as a big kill and can get a quip.
- **Optional (audio-director S3):** weight the chance by moment (stage boss .5, midboss .3, the same ~4 a run); one
  shared `SLAB_MIX` for the kill words, bossreward, hype and quips.
- **Stale flags are per machine:** they read the raw take's record in git-ignored `assets-raw/`.
- **A deleted quip's id** is held back only while its leftover raw folder exists.
- **Localisation:** every quip is a pun; a translation needs a local equivalent, not a literal one (writer's note).
- D50's "Next" still applies to quip takes: audio-director's and narrative-director's listen before they are committed
  as one batch with a studio pass.

## Merge-order notes

- Touches `src/audio.ts` (`sample()`'s queue block, `VOICE_CAT`), `src/render/hype.ts` (`SLAB_CAT`, `voiceOf`),
  `src/enemies/update.ts` (one line after the kill word), `src/stages.ts` (the bossreward pend) and `tools/booth/*`.
  A lane that edits the voice queue or the booth will conflict there.
- Matt is recording in the main checkout: after this merges, restart his dev server before a keep (new booth plugin
  code and a new `src/voice/` import).
