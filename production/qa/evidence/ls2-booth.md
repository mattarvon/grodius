# LS2-booth: a dev-only voice booth that records into the game

Branch `ls2-booth`, off main `1f7f142`. The commits:
- `81abc2a` feat: the booth;
- `8e80bc6` fix: the studio review fixes;
- `192910a` fix: the vox tip literal;
- `e2f517b` docs: the processTake comment;
- the report commit.

Matt, 2026-11-09: "laptop mic for now and booth", in place of RecForge → Drive → agent. His ruling the same day:
- every new line (hype10-100, bossreward, the kill words, carn5) is spoken by **SGT. RAMROD SLAB**;
- kill-`<k>` and carn5 are listed as **recorded, not wired**;
- wiring them, and the SLAB face, is the parent's follow-up after LS2-tts, because `src/render/hype.ts` is that
  lane's file.

**Booth URL:** `npm run dev`, then **http://localhost:5173/booth.html**, or the port Vite prints. The lane's own
server ran on :5297.

## What changed

| File | What |
|---|---|
| `tools/booth/plugin.ts` | The Vite plugin, `apply: 'serve'`. It serves `/booth.html` and the text frame raw, without the Vite client, so a keep never reloads the booth. It also serves `/__booth/takes` (GET) and `/__booth/take` (POST to keep, DELETE to remove). The keep runs the ffmpeg chain (`VOX`). |
| `tools/booth/slots.ts` | The single list of voice slots: folder, text source, when it plays, caller, wired, test query. It is a leaf module. |
| `tools/booth/names.ts` | Pure name rules: `slugify`, `okCat`, `nextTake`, `takeName`, `TAKE_RE`/`TAKE_MAX`, `rawExt`, `gainTo`. |
| `tools/booth/booth.html`, `booth.ts` | The page: mic picker, meter with CLIP, record, raw playback, keep or discard, processed playback, take list with delete, test in game, and the keys. |
| `tools/booth/text.html`, `text.ts` | A hidden frame. It imports the game modules (HYPE, CARN, the midboss `word`s) and posts the text up to the page. Storage writes and input/page events are stopped before any game module runs. |
| `tools/booth/README.md` | The how-to. |
| `src/vox.ts` (new), `src/main.ts` (+3 lines) | `?vox=<cat>[&clip=<stem>]`. It is dev only (`if (import.meta.env.DEV) import('./vox')`) and fires the game's own trigger once audio runs: `hype(n)`, or the call site's own `sample()`. |
| `vite.config.ts` | The plugin, plus `server.fs.deny` for `**/assets-raw/**` (with Vite's defaults kept) and `watch.ignored` for it. |
| `tests/unit/booth.test.ts` | 33 tests. |

**Lane boundary.** Nothing in `src/platform.ts`, `src/render/hype.ts`, `src/fx/update.ts`, `src/enemies/update.ts`,
`src/enemies/mid/ufo.ts`, `package.json`, `android/` or the README. `booth.test.ts` reads those files to check for
drift: whichever of LS2-booth and LS2-tts merges second re-runs it.

## Acceptance checklist

| Brief item | Result |
|---|---|
| 1. Dev only, never shipped | **PASS.** `apply: 'serve'`; `?vox=` sits behind `import.meta.env.DEV`. The dist grep finds 0 files for all 21 booth strings and no vox/booth chunk (gate log below). |
| 1. Endpoint writes only `src/sfx/<cat>/`, sanitised `[a-z0-9-]` name, no traversal | **PASS.** The folder must be a slot (allowlist) and a real directory inside its base, never a symlink. The slug goes through `slugify`, the number through `nextTake`, and delete accepts `TAKE_RE` names only. Tested live: `../music`, `warning`, `..` slug, `../../main.ts` delete, and a 27 MB body. Unit tests cover the rest. |
| 1. No LAN exposure beyond the dev server's | **PASS, and tighter.** `npm run dev` is `vite --host`, so the server listens on wlan0 and tailscale0. The booth answers loopback only: the LAN IP gets 403. Requests also need a per-process token from the page, a local Host, Origin = Host on writes, and no proxy headers. `assets-raw/` is now refused to everyone, LAN included. |
| 2. One source of truth for slots, text from the game | **PASS.** `slots.ts`. HYPE, CARN and the midboss words come from the game at runtime (the booth showed "SEVERED" for the ufo, today's word). Three lines are copies pinned by tests: TAKEN DOWN, the corpse caption, and YEAH BABY (which is only a clip name in the game). |
| 2. Wired: hype10-100, bossreward, corpsevoice, startgame. Not wired: kill-ufo/brood/choir/cyst/prentice, carn5 | **PASS.** A test checks wired == `VOICE_CAT` (audio.ts) == has a test query == has a `VOX_FIRE` entry. |
| 2. Take counts per slot | **PASS.** `GET /__booth/takes`. |
| 3. getUserMedia, mic picker, meter, record/stop, raw playback, keep/discard, keys | **PASS.** Covered by the e2e below. Space, Enter, Backspace and the arrows work, plus T (test). The browser's AGC, noise suppression and echo cancellation are off. |
| 4. Process on keep: highpass, denoise, trim, loudness-match, mono 44.1 kHz Vorbis, `<slug>-matty-<n>.ogg`, raw kept in git-ignored `assets-raw/voice/` | **PASS.** See the chain below. `.gitignore` already has `assets-raw/`. The processed file plays back in the booth. |
| 5. Test in game | **PASS.** `?stage=orbit&vox=hype10&clip=<kept take>` fired that exact take through the comms window (screenshot). `__au().last = hype10`. |
| 5. A new take plays without a restart | **PASS.** With the game tab open, a keep raised the tab's `__sfx().hype10` from 3 to 4 with no restart (the glob's file-add full-reloads the game tab). The booth page did not reload (`window.__mark` survived a keep and a delete). |
| 5. Dev hooks touch no sim state or R() | **PASS.** Nothing runs without `?vox=`. The harness is identical (below). With `?vox=hypeN` it runs the real `hype()`, which writes `$.G.hype` from a timer; that is documented, and it must never go in a harness scenario. |
| 6. README | **PASS.** `tools/booth/README.md`. |

## The processing chain

The audio-director signed it off, with changes, and they are applied. Every number below was measured here with
ffmpeg ebur128. The reviewer had no shell.

1. Mono.
2. The key click cut: 0.12 s from the head, 0.2 s from the tail.
3. An 80 Hz highpass.
4. `afftdn=nr=10:nf=-50:tn=1`.
5. The head and tail trimmed. The gate is the room's noise floor (astats) + 14 dB, clamped to [-60, -40]. 90 ms is kept before the first word and 250 ms after the last, with 10 ms and 50 ms fades.
6. Gain to **-12 LUFS**, then `acompressor` 3:1 over -20 dBFS.
7. Re-measured, gain to target, then `alimiter` 0.87 (-1.2 dBFS), attack 1 ms, release 80, **at 4x oversampling**.
8. 44.1 kHz Vorbis q5.
9. One makeup pass, at most +3 dB.
10. A quiet-take warning when the first gain is over +18 dB.

**Target.** The shipped clips measure -12.4 LUFS / -0.8 dBTP (stop-killing-me) and -11.9 / -1.2 (lesley-yeah-baby).
The shelved takes measure -12.9 to -13.7.

**Test material: nobody spoke into a mic.** Two kinds were used:

- **Matt's existing voice clips, as a real-voice stand-in.** These were already in the repo, and no new recording was
  made: hell-yeah, shamalama, keyster-easter, stop-killing-me. Each was turned down 20 dB to laptop level, with pink
  room noise, a key click at each end, and 0.5 s / 0.4 s of room. Results:

  | Clip | Gate | LUFS | dBTP |
  |---|---|---|---|
  | hell-yeah | -54 | -12.3 | -0.7 |
  | shamalama | -54 | -12.4 | -0.9 |
  | keyster-easter | -54 | -12.6 | -0.4 |
  | stop-killing-me | -53 | -12.5 | -0.8 |

  The Vorbis encode overshoots the -1.2 ceiling by under 1 dB, as the shipped clips do. These sources were already
  processed, so this shows the chain lands real voice on target and keeps it under 0 dBTP. It does not show how a
  raw, unprocessed laptop take behaves.

- **Synthetic takes.** These were sawtooth buzz through formant bandpasses, a soft S ramp 25 dB under the vowels, a
  breath tail, and key clicks:

  | Take | Gate | LUFS | dBTP | Length |
  |---|---|---|---|---|
  | Tones with room noise | -44 | -13.2 | -1.1 | 1.89 s (1.6 s signal) |
  | One 0.3 s word | -50 | -12.0 | -3.8 | 0.59 s |
  | Speech-like "severed" | -52 | -16.6 | -1.1 | |

  The "severed" take falls short because a sawtooth has a waveform crest no voice has (PLR ~17), and the +3 dB
  makeup cap stops it. On that take:
  - the S onset survives (4-8 kHz RMS in 50 ms windows: -47.9, -38.7, -33.8, -30.3 dB);
  - the breath tail decays into the fade (last 400 ms: -19.7, -33.4, -41.3, -43.6 dB RMS);
  - no click remains (the first 15 ms peak at -34.4 dBFS).

**Tried and dropped:** a tanh soft clip at -6 dBFS. It flat-topped the waveform, cost ~6 dB of loudness, and after the
Vorbis encode threw intersample overs up to **+2.8 dBTP** (caught by the browser e2e). The 4x-oversampled limiter
fixed the overs.

**First real take: check it by ear.** Listen for hiss between words at vol 1.15, and for fizz on S and growled vowels.
If the trim cuts a breath, wait a beat before Stop (the booth says so while recording).

## Test, gate and evidence output

Gates ran on the lane's dev server (:5297, private Vite cacheDir), one at a time under `/tmp/grodius-heavy.lock`,
with Tctl 39-60 C. Typecheck, vitest, build, short, long4 and parity ran at `192910a`. The scenarios were re-run in full
at `e2f517b`, which differs only in a doc comment in `tools/booth/plugin.ts`. Every log begins with `git rev-parse HEAD`
and `git status --short`. Build output is trimmed to the tail.

```text
192910a6e0b6d0e1580e643995da46cd78fdf95a
?? production/qa/evidence/ls2-booth/
--- typecheck
npm notice run tsc --noEmit
--- vitest
 Test Files  58 passed (58)
      Tests  1155 passed | 1 expected fail (1156)
```

```text
192910a6e0b6d0e1580e643995da46cd78fdf95a
?? production/qa/evidence/ls2-booth/
--- npm run build (tail)
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
--- dist grep: files containing each string
__booth                                0
booth.html                             0
text.html                              0
textframe                              0
grodius-voice-booth                    0
GRODIUS VOICE BOOTH                    0
x-booth                                0
booth-token                            0
?vox=                                  0
not a wired voice slot                 0
click or press a key to start audio    0
Reload to hear it again                0
VOX                                    0
voxBoot                                0
VOX_FIRE                               0
afftdn                                 0
ebur128                                0
silenceremove                          0
ffmpeg                                 0
assets-raw                             0
tools/booth                            0
--- chunks named vox/booth:
none
--- matty- in dist: 2 asset files (the shipped corpsevoice/startgame clips)
```

```text
192910a6e0b6d0e1580e643995da46cd78fdf95a
?? production/qa/evidence/ls2-booth/
--- harness short
{"st":{"state":"over","score":1243,"scroll":3538,"lives":0,"px":50,"py":143.25,"en":0,"gibs":0,"drops":0,"caps":0},"hashes":["b9ce4a76ac","83207e90e2","deefef2cf3","cdff70c46c","8ecfcbedc1","0bc5cf3670"],"errs":[]}
note: 6/6 canvas hashes differ (advisory)
PASS vs baseline @ 8ff9ba4
exit 0

192910a6e0b6d0e1580e643995da46cd78fdf95a
--- harness long4
{"st":{"state":"over","score":6096,"scroll":3538,"lives":0,"px":50,"py":153.25,"en":2,"gibs":0,"drops":13,"caps":0},"hashes":["d628aa0103","1a73c77a52","7f6273bddd","338ffbcd59","a91a9eb7c1","81feb21ab0"],"errs":[]}
note: 6/6 canvas hashes differ (advisory)
PASS (long4) vs baseline @ 88d9525
```

```text
e2f517bae6e5370bfac942e8ab77484020213c26
--- harness scenarios (full)
PASS (orbit) vs baseline @ 5c8c3eb
PASS (saucer) vs baseline @ 5c8c3eb
PASS (breath2) vs baseline @ ffd6b77
PASS (drive) vs baseline @ 5c8c3eb
PASS (maw-d1) vs baseline @ 5c8c3eb
PASS (maw-d3) vs baseline @ 5c8c3eb
PASS (drive-d1) vs baseline @ 5c8c3eb
PASS (drive-d3) vs baseline @ 5c8c3eb
PASS (crux-d1) vs baseline @ 5c8c3eb
PASS (crux-d3) vs baseline @ 5c8c3eb
PASS (butcher-d1) vs baseline @ 5c8c3eb
PASS (butcher-d3) vs baseline @ 5c8c3eb
12 scenario(s) in 136 s
exit 0
```

```text
192910a6e0b6d0e1580e643995da46cd78fdf95a
?? production/qa/evidence/ls2-booth.md
?? production/qa/evidence/ls2-booth/
--- layout-parity
run 3 (seed 3, 2 descents) gates 1001: shop 2, 8 stages, 30729 play frames, deaths 0, errors 0
run 6 (seed 6, 2 descents) gates 1100: shop 2, 8 stages, 38325 play frames, deaths 0, errors 0
run 7 (seed 7, 2 descents) gates 1010: shop 2, 8 stages, 28428 play frames, deaths 0, errors 0
run 11 (seed 11, 2 descents) gates 0100: shop 2, 8 stages, 34462 play frames, deaths 0, errors 0
run 15 (seed 15, 2 descents) gates 0111: shop 2, 8 stages, 33266 play frames, deaths 0, errors 0
run 3x3 (seed 3, 3 descents) gates 1001: shop 3, 12 stages, 45484 play frames, deaths 0, errors 0
run 7m (seed 7, 2 descents, mortal) gates 1010: game over, 2 stages, 5414 play frames, deaths 3, errors 0
not measured: render-only output (canvas stubbed); deaths after the mortal run's game over; seeds 2 and 3 (their bots cannot kill the Gravity Drive)
PARITY PASS vs baseline @ ls1-s2 after J + B1FIX + C/B2: B2 re-baseline re-taken on top of B1FIX (anchors and terrain unchanged): runs 3, 6, 7, 11, 15, 3x3, 7m identical (5 seeds x 2 descents + 3x3 + 7m)
```

Every harness run says "canvas hashes differ (advisory)". The worktree can't load the fontsource files through the
shared `node_modules` symlink (the known 403s), so text renders in a fallback font. The sim gate passed in every run.
No baseline moved, and nothing was re-baselined.

**Screenshots** (`production/qa/evidence/ls2-booth/`), all looked at:
- `booth-recording.png`: the REC frame, the clock, the "ring out" hint, the slot list with folders, take counts,
  wired/not wired and callers;
- `booth-kept.png`: the processed playback, Delete this take, the LUFS/dBTP readout, the quiet-take warning, and the
  UNKNOWN CALLER note;
- `game-vox-hype10.png`: `?vox=hype10&clip=that-one-had-a-name-matty-1` fired. THAT ONE / HAD A NAME and the comms
  window are opening.

**E2E** (Playwright Chromium with a fake mic fed from the synthetic take, on the lane's dev server):
- Space held (5 repeats) left it recording, and did not toggle;
- an arrow key in review was refused ("Keep (Enter) or discard (Backspace) this take first");
- Enter kept the take;
- T opened `/?stage=orbit&vox=hype10&clip=that-one-had-a-name-matty-1`, and the tip read "fired
  that-one-had-a-name-matty-1";
- Backspace deleted the kept take, and the booth did not reload;
- no page errors.

The game tabs logged 403s for the fontsource woff/woff2 files. That is the known worktree `node_modules` symlink
issue (fonts outside the served root), not this lane: Matt's main checkout serves them.

**Text frame isolation** (Playwright): `localStorage.setItem` in the frame is a no-op. After `pagehide`, `blur` and
`visibilitychange` were dispatched in the frame and it was unloaded, the game's save was unchanged. Neither page
loads `/@vite/client`.

**Security, live** against :5297:
- the LAN IP got 403 for both the page and the endpoints;
- the endpoints refused requests with no token (403), with a forwarded header (403), or with a bad Origin (403);
- traversal folders and names got 400, and a non-audio body got 415;
- a 27 MB body was reset with nothing written;
- `/assets-raw/...` got 403 locally and over the LAN;
- the page carries `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`.

**Unit tests:** `tests/unit/booth.test.ts`, 33 tests. Each drift test was watched failing on a temporary mutation:
- the guard's LAN check removed;
- a vox `sample()` option changed;
- `defineMid('ufo'` renamed;
- a new kind file added;
- the copied TAKEN DOWN line edited;
- a CSS import added to booth.ts.

## Studio agents used

| Agent | What it did | What changed |
|---|---|---|
| tools-programmer (owner review) | Found 9 bugs: an aborted upload froze the keep queue; ffmpeg had no timeout; a delete during review stranded a take; moves silently discarded a take; the meter was dead until the first record; a double-Space race; one-word takes didn't measure; and minor items. Confirmed that hype/bossreward show UNKNOWN CALLER in game, and proposed the follow-up below. | All applied. |
| security-engineer | PASS WITH FIXES, 7 LOW findings: the token and forwarded-request check; a corrected CSRF comment; frame headers; a forced demuxer and protocol whitelist; symlink and overwrite refusal; the body-stall timeout; and `fs.deny` for `assets-raw` (the dev server listens on the LAN). | All applied. |
| web-specialist | Confirmed the build exclusion, the HMR isolation and harness safety. Found that the text frame's `input.ts` save handlers could write a stale save over the game's, which is fixed. Also: a load-order nit, the unguarded no-client rule (now tested), the vox comment, and the dist grep list. | All applied. |
| ux-designer | Must-fixes: CLIP held, Space repeat, key clicks recorded (cut server-side), mic unplug, select focus. Should-fixes: capture keys, Tab'd buttons, delete after keep, unkept-take guard, test-the-kept-take, meter gradient and wake, denial recovery, live region. Plus nice-to-haves (REC frame, auto-stop). | All must and should items applied. Not done: N4 (the face thumbnail; the booth shows the name) and N5 (progress count). |
| audio-director | Signed off with changes: a relative gate, longer head and tail, a fade-out, no stronger denoise but a quiet warning, the ceiling and true peak, release 80, and the q5 comment. Approved the adaptive gate on re-review. | Applied. It approved a tanh soft clip with `oversample=4`; measurement then showed the clip itself caused the overs and a large loss, so it was replaced by a compressor and an oversampled limiter. **Final chain re-reviewed: SIGN OFF** (compressor settings right for voice, oversampled limiter the right fix for intersample peaks, stand-ins on target). On the first real take, listen for pumping on long vowels and check the S onset and breath tail. |
| qa-tester | INCOMPLETE → added: Host and peer forms, kinds keyed by `defineMid`, copied lines vs their literal, wired vs VOX_FIRE, the take-number cap, and pure-function edges. | All added, and the drift tests were mutation-checked. |

## Not measured

- **A real raw recording of Matt's voice.** Nobody can speak in this session. The real-voice stand-in clips were
  already processed. The first real take is the check.
- The booth in Firefox, and with a real USB mic. Mic unplug was handled in code, not exercised.
- The APK: the dist grep covers what `cap sync` copies, but `cap sync` was not run (android/ is LS2-tts's).
- Whether the processed takes sound good. No one listened. The audio-director's review was by reading only (no shell); every number here was measured by the lane.

## Stubs and open risks (for the parent)

1. **The SLAB face (follow-up, `src/render/hype.ts`).** `voiceOf()` maps a face by clip-name prefix, so new
   hype/bossreward takes show UNKNOWN CALLER. The tools-programmer's proposal: map by category after the clip lookup.
   ```ts
   [/^(hype|bossreward|kill-|carn)/, [0, 'SGT. RAMROD SLAB']]
   ```
   Pass `cat` through `hypeSource` and `cur`. Don't add a VOICE key per hype slug, because those slugs change with the
   text.
2. **Wiring kill-`<k>` and carn5 (the same follow-up).**
   - Add the folders to `VOICE_CAT` (`src/audio.ts:111`): voice ducking, the face, and protection from the voice cap.
   - Play them through the comms window.
   - Flip `wired`, and add `test` and a `VOX_FIRE` row. `booth.test.ts` enforces all of it together.
3. **kill-ufo's word changes in LS2-tts** (to CALAMARI SERVED). A take recorded before that merges is named `severed-…`.
4. **Delete works on shipped clips too.** The confirm says so, and `git checkout` restores them.

## Merge order

Independent of LS2-tts except for the drift tests: `booth.test.ts` reads `fx/update.ts`, `enemies/update.ts`,
`render/hype.ts` and the mid files. Whichever lane merges second runs `npx vitest run tests/unit/booth.test.ts`.
`vite.config.ts` and `src/main.ts` (3 lines after the `__sfx` hook) are the only shared-file hunks.
