# LS2-eye: ROT title eye, Matt's easter-egg head, eye kit

Branch `ls2-eye`, off main `93e595b`. Source tip `f0a4e71`; later commits touch only docs, evidence and tools. Decision: D41. Matt watched the capture and said "looks cool merge it".

**The sim does not move.** Short harness and parity pass.

## What changed

- **Title eye is ROT.** `src/render/heroeye.ts` is rewritten in place and keeps its exports, so `eyes.ts` and `warmup.ts` are untouched. It draws four baked layers: `rot_ball`, `rot_lens`, `rot_shade`, `rot_spec`. The silhouette table is `src/sprites/rot_layout.json`.
- **Life.** Gaze holds for 240-900 frames, then hitches; darts come in hash-timed bursts (`src/render/titlegaze.ts`, a pure function of `$.T`). A nictitating membrane replaces the lids. The rope and drool are regraded to tallow and ochre. The breathing squash, sine drift and metronome blink are gone (D39).
- **Placement.** The eye moved to x 396, r 88, cropped by the right frame. The wordmark is clear of it.
- **Easter egg.** `src/render/titlehead.ts` and `titleblood.ts`, sprite `head_egg@3.png` (19x31 px). The head peeks in at an edge or corner, drifts, lingers, leaves, and stays away 6-20 s. At most 24 small drips, no pool. The gross eye fully covers Matt's real left eye, and that eye was removed from the art.
- **Kit.** Five sprites baked and wired into nothing (ranking below).
- **Tools.** `tools/gen_eyes.py`, `title-shots.mjs`, `title-capture.mjs`, `title-perf-probe.mjs`; `fx-shots.mjs` crop updated.
- **Docs.** D41, CREDITS.

**`screens.ts` outside `drawTitleEye`** (the brief asked me to say): the `drawTitleHead();` call and its import, the two `hangSpine` calls and the `hangSpine` import removed, and the `titlegaze` import placed beside `drawTitleEye` to stay out of ls2-read's way.

## Gates

| Gate | Result | Log |
|---|---|---|
| `npm run typecheck` | exit 0 | `ls2-eye/typecheck.txt` |
| `npx vitest run` | 43 files, 909 passed, 1 expected fail | `ls2-eye/vitest.txt` |
| `npm run build` | exit 0 | `ls2-eye/build.txt` |
| `node tools/harness.mjs` (short) | PASS vs baseline @ 8ff9ba4 | `ls2-eye/harness-short.txt` |
| `node tools/layout-parity.mjs` | PARITY PASS: runs 3, 6, 7, 11, 15, 3x3, 7m identical | `ls2-eye/parity.txt` |

- **Which commit.** Build, harness and parity ran on `f0a4e71`. Typecheck and vitest were re-run on the final tip. `git diff f0a4e71 <tip> -- src tests` is empty, so I did not repeat the three heavy runs for docs and tools.
- **Harness canvas note.** "6/6 canvas hashes differ" is advisory, and expected: the title art changed. The harness and parity logs also show Vite refusing font files (see the font finding). That changes text rendering, not sim state.
- **Long4 and the 12 scenarios were not run.** The brief's gates are short harness and parity.
- **Merge check.** `git merge-tree` against `origin/main` before the docs commit: clean. I did not merge; that is the parent's. Expect a small text conflict in `production/decision-log.md` (D41 and D42 both sit after D40). `CHANGELOG.md` is untouched for the same reason, and its text is below.

## Finding: the preview had the wrong wordmark font

This worktree uses private `node_modules` symlinks for its Vite cache (D40). Vite then refuses the font files, because they resolve outside its serving allow list, and the wordmark falls back to a serif. **Every dev-server shot in this lane until the final set had it, including the `before-*` shots and the capture Matt approved.**

- **Players are not affected.** On the production build, font loading returned 200 and `loaded` in 6 of 6 runs (3 phone, 3 desktop, 904x412 and 960x540).
- **Retained evidence.** The final `after-*` shots and `title-preview.webm` were retaken with fonts served, and show the real blackletter wordmark. The `before-*` shots still show the serif.
- **For Matt:** the shipped title has the blackletter wordmark, not the serif in the preview he approved. It is narrower, so it clears ROT with more room.
- **For other lanes:** dev-server shots from a worktree with private symlinks can have this problem. `server.fs.allow` or `fs.strict: false` fixes it.

## Title cost and drip cap

performance-analyst; one run each, other lanes loading the machine. Radeon 780M, 4x CPU throttle, head and drips on screen, `$.DK` confirmed. ms, p50/p95/p99:

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

| Group | Bytes |
|---|---|
| `rot_*` with `rot_layout.json` | 210,022 |
| `eye_*` (kit) | 25,602 |
| `head_egg@3` | 599 |
| **Added** | **236,223** |

`dist` PNGs add 235,420. No assets were removed by this lane. The kit is loaded at boot even though nothing draws it yet (`src/sprites.ts` globs the folder).

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
> - Something else drifts around the edges of the title now and then. Keep the screen open and you may catch it.

## Acceptance

- [x] Title hero is ROT, with rope, drips, gaze wander and darts, jiggle, and a blink (as a membrane).
- [x] Render only: no `R()`, `srnd()` only, harness and parity pass.
- [x] Kit baked, generator in `tools/gen_eyes.py`, nothing wired in.
- [x] CREDITS and D41.
- [x] Screenshots looked at, desktop and phone, with the armed state: `after-{desktop,phone}-{title,armed}.png`. The head is not on screen in these (it is away at that moment); it is in `title-preview.webm` and `egg-zones.png`.
- [x] Head: tiny, floats at the edges, never over menu, logo or ROT (`titleblood.test.ts` sweeps every rail against every no-go rect); the gross eye covers his real eye.
- [ ] Fold reading. Not possible from here.

## Open risks and notes

- **The head's generator is not in the repo**, by the brief's rule (the source photo is never committed). It is at `$S/selfie/gen_head.py` in a scratchpad. **If that folder is cleared, `head_egg@3.png` can't be rebaked.** Parent: keep it, or Matt decides where it lives.
- **`egg-zones.png` shows the serif wordmark** (taken before the font finding), and the montage's head shots are the point of it.
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

## Merge notes

Parent merges. Render only, no baseline move. `screens.ts` has no conflict with ls2-read. Run the Studio review on the tip.
