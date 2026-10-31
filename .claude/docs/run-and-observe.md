# Run and Observe

Shared procedure for any skill that closes a story which changes something a
player can see. Used by `/dev-story` (Phase 6) and `/story-done` (Phase 3).
**A parse check is not a run, and a story nobody looked at does not close.**
This file explains how to look.

`.claude/docs/coding-standards.md` is the authority for *what* evidence a story
needs. This file is the procedure for *producing* the visual half of it.

## The rule

Every story that changes something player-observable is **launched and observed
before it closes**, and the observation is a **retained screenshot** in
`production/qa/evidence/`. Compiling proves the code loads. Tests prove the
logic. Neither proves the text fits in the box.

The agent can see images: Claude Code's `Read` tool renders a PNG. Grodius has
no engine: it runs in a browser, so the picture comes from Playwright driving
Chromium against the Vite dev server, the same way the `tools/*-shots.mjs` rigs
do.

## The procedure

1. **Serve the game**: `npm run dev` (`commands.run`), or start Vite from the
   script through its JS API as `tools/harness.mjs` does, so the run needs no
   separate terminal. Use a fixed viewport, `960x540` or `1280x720`.
2. **Reach the state the story touched.** The title screen proves nothing about
   a Descent 3 boss. Call the game's own modules from the page
   (`await import('/src/flow.ts')` then `newGame()`, set `$.G`/`$.P` fields from
   `/src/state.ts`, spawn with `/src/enemies/spawn.ts`), or reuse the matching
   shots rig (`tools/screens-shot.mjs`, `tools/maw-shots.mjs`,
   `tools/elite-shots.mjs`, ...). See "Reaching the state" below.
3. **Wait, capture, quit.** Let real frames render (a few hundred ms of the live
   loop), then `page.locator('#c').screenshot({ path })`, close the browser and
   the server. Never stub `requestAnimationFrame` for an evidence shot; that is
   the harness's job, not the look's.
4. **Look.** `Read` the PNG. Compare what is on screen to the acceptance
   criteria. Clipped text, an overflowing panel, a missing element, a bullet
   hidden under an effect, the wrong colour: these are defects, and this is the
   only step that finds them.
5. **Retain.** Capture straight into the story's evidence folder:
   `mkdir -p production/qa/evidence/[story-slug]`, then pass
   `production/qa/evidence/[story-slug]/[NN]-[what-it-shows].png` as the path.
   `[story-slug]` is the story file's name without `.md`. For a fix, capture a
   before and an after (run the rig once against the old file). Reference the
   image from the evidence doc, and stamp the files it proves:
   `bash .claude/scripts/review-receipts.sh hash <each file the story changed> > production/qa/evidence/[story-slug]/stamp.txt`.
6. **Report** one `Run result:` line in the implementation summary (vocabulary
   below).

## Grodius (web, no engine)

| Step | How |
|---|---|
| Serve | `npm run dev`, or `createServer()` from `vite` inside the script |
| Drive | `playwright` (pinned in `package.json`), `chromium.launch()`; block `fonts.googleapis`/`gstatic` |
| Reach state | `page.evaluate(async () => { const { $ } = await import('/src/state.ts'); ... })` |
| Capture | `page.locator('#c').screenshot({ path })` |
| Never use | the harness's fake clock / rAF stub for evidence shots |
| Scaffold needed | none: copy the nearest `tools/*-shots.mjs` rig |

Worked example (bullets over post-FX, sprint 1): start Vite, `newGame()`, set
`$.G.white`/`$.G.red` every frame, spawn bullets with `eshoot()`, screenshot the
canvas; the before/after pair is in `production/qa/evidence/s1-4-*.png`.

On a machine with no display the run is still fine: Playwright's Chromium
renders the canvas headless. The Android build is not covered by this: device
checks (touch layout, frame rate on a phone) stay a human step and the run
result must say so.

## The `Run result:` line

Exactly one of three shapes, in the implementation summary:

- **`Run result: OBSERVED — <what was on screen, one line>`** with the retained
  path. *"Shop panel renders, all 6 slots inside the frame, prices legible at
  720p — `production/qa/evidence/shop-panel/01-shop-open.png`."*
- **`Run result: NOT VERIFIED — <reason>`**. Engine binary not found,
  `commands.run` unset, launch crashed, screenshot empty. This is a **blocker**
  at the default gate level for Visual/Feel and UI stories, not a note — a
  story nobody looked at does not close. Under an explicit
  `testing.strict.visual`/`.ui: false` it is recorded and the story may close
  with the gap in `## Completion Notes`.
- **`Run result: N/A — <reason>`**, only for a story with genuinely nothing
  observable — a pure data migration, a save-format change with no surface.
  Say why. "It's a Logic story" is not a reason: a damage formula has a number
  on screen somewhere.

The run is **not waived at `qa.level: minimal`**. Tests are waived there; the
look is not. It is the cheapest verification in the pipeline and the one
whose absence produces a well-tested game that looks wrong.

## What a still can and cannot show

**Can:** layout, clipping, overflow, presence, alignment, colour, legibility,
that the right screen appeared at all. This is where shipped visual defects
actually live.

**Cannot:** timing, responsiveness, weight, animation curves, audio sync: the
"feel" half of Visual/Feel. A short frame sequence (several screenshots a few
frames apart) helps with motion; feel stays a human check in `/team-qa`. Say
which half the screenshot covered.

## Reaching the state

A screenshot of the title screen verifies nothing about depth 2. Set the state
through the game's own modules from the page (`newGame()`, `$.G.loop = 2`,
`openFork(0)`, `midboss(...)`), or reuse the shots rig that already reaches it.
A dev-only jump switch (`?at=&loop=&kit=` behind `import.meta.env.DEV`) is
planned in the roadmap; until it exists, write stories so their surface is
reachable by a few module calls, or they will be marked `NOT VERIFIED` every
time.

## Finding the browser

Playwright's Chromium is installed by `npx playwright install chromium`
(CI also passes `--with-deps`). If `chromium.launch()` fails with a missing
executable, install it before concluding the run is impossible.

---

*Procedure verified on Linux (CachyOS) with Playwright 1.64.1 / Chromium
156.0.8078.4 against the Vite 8 dev server, 2026-10-31. Pinned versions:
`docs/architecture/stack-reference.md`.*
