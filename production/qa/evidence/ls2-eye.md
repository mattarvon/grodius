# LS2-eye: ROT title eye, Matt's easter-egg head, eye kit

Branch `ls2-eye`, rebased onto main `586b183` (ls2-read). Decision: D41. Matt watched the capture and said "looks cool merge it".

**The sim does not move.** Short harness and parity pass.

## What changed

- **Title eye is ROT.** `src/render/heroeye.ts` is rewritten in place and keeps its exports, so `eyes.ts` and `warmup.ts` are untouched. It draws four baked layers: `rot_ball`, `rot_lens`, `rot_shade`, `rot_spec`. The silhouette table is `src/sprites/rot_layout.json`.
- **Life.** Gaze holds for 240-900 frames, then hitches; darts come in hash-timed bursts (`src/render/titlegaze.ts`, a pure function of `$.T`). A nictitating membrane replaces the lids. The rope and drool are regraded to tallow and ochre. The breathing squash, sine drift and metronome blink are gone (D39).
- **Placement.** The eye moved to x 396, r 88, cropped by the right frame. The wordmark is clear of it.
- **Easter egg.** `src/render/titlehead.ts` and `titleblood.ts`, sprite `head_egg@3.png` (19x31 px). The head peeks in at an edge or corner, drifts, lingers, leaves, and stays away 6-20 s. At most 24 small drips, no pool. The gross eye fully covers Matt's real left eye, and that eye was removed from the art.
- **Kit.** Five sprites baked to `src/sprites/kit/` and wired into nothing (ranking below). The boot glob skips the subfolder, so they cost players nothing until one is used.
- **Title layout.** `src/titlelayout.ts` holds the title's positions and no-go rects. `drawTitle`, `drawTitleEye`, the egg's rails and its test all read it.
- **Tools.** `tools/gen_eyes.py`, `title-shots.mjs`, `title-capture.mjs`, `title-perf-probe.mjs`; `fx-shots.mjs` crop updated.
- **Docs.** D41, CREDITS.

**`screens.ts` outside `drawTitleEye`:** the `drawTitleHead();` call, the title layout's positions in place of literals (same pixels), the `titlegaze` and `titlelayout` imports at the top, and the `hangSpine` calls and import removed.

## Gates

**Final tree: this commit.** The `final-*` logs are stamped with its `src` and `tests` tree IDs (`src-tree=fc7e0fcd04`, `tests-tree=91204dfc39`). They ran before the commit so the fixes and logs could land together; check with `git rev-parse <sha>:src`.

| Gate | Final tree | Rebased `e20eef2` |
|---|---|---|
| typecheck | exit 0 (`final-typecheck.txt`) | exit 0 (`typecheck.txt`) |
| vitest | 47 files, 985 passed, 1 expected fail (`final-vitest.txt`) | 47 files, 984 passed, 1 expected fail (`vitest.txt`) |
| build | not re-run (this pass's list is typecheck, vitest, harness, parity) | exit 0 (`build.txt`) |
| short harness | PASS vs baseline @ 8ff9ba4 (`final-harness-short.txt`) | PASS (`harness-short.txt`) |
| parity | PARITY PASS: runs 3, 6, 7, 11, 15, 3x3, 7m identical (`final-parity.txt`) | PARITY PASS (`parity.txt`) |

- **Harness canvas note.** "6/6 canvas hashes differ" is advisory, and expected: the title art changed. The harness and parity logs also show Vite refusing font files (see the font finding). That changes text rendering, not sim state.
- **Long4 and the 12 scenarios were not run.** The brief's gates are short harness and parity.

## Finding: the preview had the wrong wordmark font

This worktree uses private `node_modules` symlinks for its Vite cache (D40). Vite then refuses the font files, because they resolve outside its serving allow list, and the wordmark falls back to a serif. **Every dev-server shot in this lane until the final set had it, including the `before-*` shots and the capture Matt approved.**

- **Players are not affected.** On the production build, font loading returned 200 and `loaded` in 6 of 6 runs (3 phone, 3 desktop, 904x412 and 960x540).
- **Retained evidence.** `final-title-{desktop,phone}.png` are the current title, with fonts served and the head on screen at its bottom and left rail limits. The `after-*` shots and `title-preview.webm` also have the real wordmark (the preview predates the rail changes). The `before-*` shots and `egg-zones.png` still show the serif.
- **For Matt:** the shipped title has the blackletter wordmark, not the serif in the preview he approved. It is narrower, so it clears ROT with more room.
- **For other lanes:** dev-server shots from a worktree with private symlinks can have this problem. `server.fs.allow` or `fs.strict: false` fixes it.

## Finding: the hand-copied no-go table was wrong

The Studio review asked for one shared source. Measuring the real fonts then showed the copied table disagreed with the screen:

| | Copied | Real |
|---|---|---|
| Eye centre y | 124 | 116.84 (`PH` is 254) |
| Last credits line | ends y 249, from x 190 | ends y 257, from x 150 |
| Help text right edge | x 255 | x 323 with the meter on |
| Age line left edge | x 322 | x 314 |

**Deviation from the review, for ux-designer:** it asked for the bottom rail to end at x 280. I ended it at **x 128**, because anywhere past that the head sits behind the last credits line, and lowering it hides the eye. The left rail stops at y 90 as asked. The top rail ends at x 330 and the top-right rail moved to x 461, to clear the eye's true position.

The test also found one real miss once it had the right numbers: the top-right rail came within 100.0 px of the eye against a 100.4 clearance.

Text widths in `titlelayout.ts` are measured constants, so a changed string needs re-measuring. Moving an element in the table does break the test; changing a string's width does not.

## Title cost and drip cap

performance-analyst, on `f0a4e71` before the rebase and the review fixes; one run each, other lanes loading the machine. Radeon 780M, 4x CPU throttle, head and drips on screen, `$.DK` confirmed. ms, p50/p95/p99:

| | Old `93e595b` | New |
|---|---|---|
| DK 2 JS | 3.8/7.2/8.7 | 3.7/8.6/10.8 |
| DK 2 vsync rAF | 16.7/16.7/16.8 | same |
| DK 2 uncapped rAF | 2.9/5.9/10.3 | 2.9/6.9/9.9 |
| DK 4 JS | 3.9/7.8/9.4 | 3.2/7.8/10.0 |
| DK 4 vsync rAF | 16.7/16.7/16.8 | same |
| DK 4 uncapped rAF | 5.6/11.6/22.0 | 4.5/8.7/12.1 |

0 frames over 18 ms under vsync. No regression beyond noise.

**Heap, 3000 frames at DK 4, old → new:** slope 118 → 232 B/frame; growth after forced GC 100 → 146 KB; allocation 48 → 40 KB/frame. No clear leak. `terrain.ts:786` allocates about 34.5 KB/frame in both builds, which is outside this lane.

**Drip cap: 24.** Set by the technical-artist to Matt's "small drips", not derived from a scale test. When Matt shrank the head, the analyst's cap runs at 140-1000 drops were cancelled, so none happened. At 24 small rects, the cost does not show in the table above.

**Not measured:**
- a real Fold or Android WebView: **these are desktop estimates, and D30 judges by the Fold reading;**
- the production bundle under load;
- GPU raster (the timers cover main-thread recording, and throttling doesn't slow the GPU process);
- the old hero's first-frame paint and `rot_*` decode, both skipped at wrap-up.

## Bundle bytes

| Group | Bytes | Ships? |
|---|---|---|
| `rot_*` with `rot_layout.json` | 210,022 | yes |
| `head_egg@3` | 599 | yes |
| `kit/eye_*` | 25,602 | no: nothing imports them, and the boot glob skips `kit/` |
| **Added to the build** | **210,621** | |

No assets were removed by this lane. `dist` sizes were last measured before the kit moved, so 210,621 is from the source files. Using a kit sprite means moving it up or importing it.

## Kit ranking, for Matt to pick

art-director, seen at native size only; motion not judged. Rejected and not baked: Hero (too pink and clean), Icon (cartoonish).

1. **`eye_cluster`:** wall growth or a set-piece prop. The clear best.
2. **`eye_flyer`:** a small drifter.
3. **`eye_wrong`:** a telegraph or one rare reveal.
4. **`eye_rotted`:** a dead variant.
5. **`eye_burst`:** a pop frame. The weakest.

The last three are lone round eyes, so the art-director wants them embedded in meat. ROT's exception to "no single big eye" covers the title only.

## CHANGELOG-ready text

> ## 2026-11-08 (a new eye on the title)
>
> - The title screen has a new eye: dead, rotted and clouded over, and it still follows you.
> - Leave the title open long enough and something finds you.

## Acceptance

- [x] Title hero is ROT, with rope, drips, gaze wander and darts, jiggle, and a blink (as a membrane).
- [x] Render only: no `R()`, `srnd()` only, harness and parity pass.
- [x] Kit baked, generator in `tools/gen_eyes.py`, nothing wired in.
- [x] CREDITS and D41.
- [x] Screenshots looked at, desktop and phone, with the armed state: `after-{desktop,phone}-{title,armed}.png`. The head is not on screen in these (it is away at that moment); it is in `title-preview.webm` and `egg-zones.png`.
- [x] Head: tiny, floats at the edges, never over menu, logo or ROT (`titleblood.test.ts` sweeps every rail against every no-go rect); the gross eye covers his real eye.
- [ ] Fold reading. Not possible from here.

## Open risks and notes

- **The head's generator is outside the repo**, in `~/Pictures/grodius-head/`, with its helpers and the source photo, which is never committed. `head_egg@3.png` can only be rebaked on Matt's machine.
- **`egg-zones.png` shows the serif wordmark and the old rails**; its x6 crops of the head are the point of it.
- **Not this lane's, spotted in the real font:** the third help line (`START PAUSE`) overlaps the start of the first credits line, on desktop and phone. It predates this lane. The earlier font fallback hid it from reviews.
- **ROT's lens:** 1.5% of its pixels exceed the art-director's 60% L ceiling at rest, mostly wet sheen, accepted as such; other gazes not measured.
- **Motion hasn't had a director's eye.** The art-director reviewed stills only; Matt has watched the capture.
- **Orphans:** `queueRampIris` in `eyes.ts` has no callers. Left alone to stay out of `eyes.ts`.
- **Art-director option, not done:** the short drool strand can look like a pin during a blink.
- **The bottom rail clips the head's neck and drips**, so it loses "severed" there. Art-director: acceptable.
- **Scratchpad Vite caches** from the analyst's first run remain; its `rm -rf` was denied and not retried.

## Studio agents used

| Agent | What it did |
|---|---|
| art-director | Rulings for ROT, the head, the blood and placement; two review passes; kit ranking. Rejected the straight membrane, dry glint, olive kit, stray drool beads and leftover spine, all fixed. |
| technical-artist (ROT) | Generator bake, renderer, gaze, kit. |
| technical-artist (head) | Three head builds as Matt's direction changed: big head, eye-cover fix, easter egg. |
| web-specialist | Code review: no S1. Slow test and tautology fixed; gush clamp fixed, then that code was removed with the egg rebuild; `fx-shots` crop fixed. |
| performance-analyst | Two runs: partial on the old head, then the before/after table above. |

**Process note.** The head technical-artist stopped at the "ask first" rule rather than write to `src/` from a lead's message, and built in a draft copy. No tool denied anything. I copied its files in as lane lead, on the authority of this lane's brief and Matt's addenda relayed by the parent, and checked each diff before applying it.

## Studio review

10 reviewers, on `b5a4195`: APPROVE or APPROVE WITH NOTES, no blocks. All the S2s and cheap S3s are in this commit, with the bottom-rail deviation above. The CHANGELOG text is above; `CHANGELOG.md` is left for the merge.

## Merge notes

Parent merges. Render only, no baseline move.
