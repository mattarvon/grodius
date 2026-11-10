# LS2-booth2: booth chain fixes after Matt's first real takes

Branch `ls2-booth2`, off main `98d07f2`. Code commit `8c8dcaf`; this report follows it. Matt, 2026-11-09: "yes set the
levels and do the booth change". The spec is the audio-director's listen verdict on his first three takes. They
clipped: decoded peaks reached +5 dBFS, because the laptop mic had +60 dB of gain. Processed gaps sat at -19 to
-25 dBFS, against the reference's -32 to -39. Two of the takes ran long.

**No `src/` game file changed.** Everything is in `tools/booth/` and `tests/unit/booth.test.ts`. So the gates are
the short harness only, per the brief.

## What changed

| File | What |
|---|---|
| `tools/booth/plugin.ts` | Adds `VOX.lowpass`, `expand`, `squeeze`, `clipAt` and `hotAt`. **The chain** now runs: the clip guard, mono, the click cut, highpass 80, **lowpass 14 kHz**, the denoise, the **expander**, the head/tail trim, the **pause squeeze**, then gain, compressor and limiter as before. `levels()` gives the per-take trim gate and expander threshold. `rawVerdict()` decides clip or hot. `Clipped` is the refusal: 422 `{ error, clipped, rawPeak }`, with the raw kept. The **long-take warning** is returned as `long`. A per-take **`.json` record** beside the raw stores the squeeze choice. **`reprocess()`** and `POST /__booth/reprocess?cat=` run in the keep queue, behind the same guard. Also new: `squeezeParam`, `skipWhy`, `RAW_RE`. |
| `tools/booth/names.ts` | `squeezeCuts()`: pure; it turns silencedetect's pauses into the cuts. |
| `tools/booth/slots.ts` | `LEN_SLACK = 0.5`, `lenLimit()` and `lenWarn()`. |
| `tools/booth/booth.html`, `booth.ts` | Meter band **-10 to -6**, **HOT** past -3, **CLIP** at -0.5, on the plugin's rule. A **"shorten pauses over 0.4 s"** checkbox, per take, default on. It resets after a keep or a line change, never on record. **Reprocess this line's takes** button. A clipped keep shows "Not kept: input clipped...", and the long, hot and quiet warnings come from the plugin. |
| `tools/booth/reprocess.mjs` (new) | CLI: `node tools/booth/reprocess.mjs <folder>... \| --all [--no-squeeze] [--root <repo>]`. A bare `--root`, or a root without `src/sfx`, is refused. |
| `tools/booth/chain-probe.mjs` (new) | The synthetic proof: generates clean, hot, clipped and 4 s takes, runs the real chain, and prints gaps, length and verdict. `--real <raws>` adds real takes. |
| `tools/booth/README.md` | The **input-level checklist** (after the review batch: boost 0, set through PipeWire; source about 40%; then set by the meter, -10 to -6; 20-30 cm; wait 0.5 s after Space; one breath, unhurried). Also the new chain steps, the checkbox, the refusal, and reprocess. |
| `tests/unit/booth.test.ts` | 33 → 65 tests (below). |

## The chain numbers (audio-director signed off, with changes; all applied)

| | Spec | Built | Why it moved |
|---|---|---|---|
| Expander threshold | noise floor + 12 | **RMS trough + 15**, trough clamped to [-80, **-45**] | astats' "Noise floor" is a windowed *peak* minimum. A -40.7 dBFS RMS room reads -32.7, so floor + 12 sat on the voice (about -23 against a phrase RMS of -22). The RMS trough sits about 4 dB under the room's mean RMS, so trough + 15 ≈ room RMS + 11, which is the spec's intent (audio-director: accepted). The clamp top of -45 is the audio-director's change: the threshold never passes -30, 8 dB under a phrase. |
| Ratio, range, attack, knee | 3, 0.1, 5 ms, 4 | same | |
| Release | ~200 ms | **150 ms** | audio-director: at 200 ms, about 150 ms of room at -21 dBFS followed each phrase. Their check: word dips within 1.5 dB of the no-expander chain. **At the right input level: 1.2 dB** (-21.36 against -20.15; 200 ms gave -21.33). |
| Placement | after the denoise, before the gain and compressor | after the denoise, **before the trim** | The trim gate tops out at -40 dBFS peak, and a -40 dBFS RMS room peaks at about -33. Unexpanded, the trim kept the whole 0.5 s lead-in and every pause (hype35's 0.5 s of room). Accepted. |
| Lowpass | optional 14 kHz | 14 kHz | |
| Clip guard | ≥ -0.5 dBFS refused | ≥ -0.5 refused, > -3 hot warning | The float peak per channel, with the key-click regions left out (accepted). |
| Squeeze | > 0.4 s to ~0.25 s, optional toggle | exact: > 0.4 s to 0.25 s (0.15 s after the word, 0.10 s before the next), with a **5 ms crossfade** at each cut | `silenceremove` can't do this: the pause it keeps equals its trigger length plus a window (measured). aselect cuts whole 4096-sample frames, up to 93 ms off (tools-programmer). So the cuts are made with atrim plus acrossfade (audio-director: no hard splice). |
| Length warning | target + 0.5 s | hype/bossreward 2.5, kill-* 1.7, carn5 1.3 | |

**Bug caught by the e2e: Chrome records two identical channels**, even for a `channelCount: 1` track. The clip guard's
mono downmix (0.707 L + 0.707 R) read them 3 dB hot. A take peaking at -1.9 dBFS was refused at "+1.1". The guard now
takes the peak over the channels. Matt's three raws read **+2.8, +5.9 and +3.5 dBFS** with the fix, so they are still
refused. The earlier +5.1/+6.7/+5.3 readings were the downmix. The chain's own mono downmix is unchanged: the gain
stage normalises it.

## Proof: synthetic takes (`node tools/booth/chain-probe.mjs`, on `8c8dcaf`)

The synthetic takes are not a voice. They are additive harmonics through moving formants, with syllable envelopes and
fricative onsets, over pink-ish room noise at **-40 dBFS RMS**, with key clicks at both ends, encoded as Opus 256k WebM
the way the MediaRecorder writes them. **Gaps** are 50 ms RMS windows, taking the median of the longest run 20 dB under
the loudest. **Dip** is the mean 50 ms dip between syllables (word tails).

```text
take                     raw pk    LUFS    dBTP    length   gaps dBFS (range)  dip      verdict
clean                    -7.9      -13.4   -0.6    2.31 s   -37.6 (-39.9..-36.9) -23.9    kept
hot                      -1.9      -13.4   -0.6    2.38 s   -37.9 (-43.6..-32.0) -25.2    kept: HOT TAKE
clipped                  0.4                                                            REFUSED (clipped)
long                     -7.8      -12.8   -0.8    4.31 s   -37.1 (-37.1..-37.1) -25.4    kept: LONG
that-one-had-a-name-matty-1 2.8                                                            REFUSED (clipped)
the-gate-knows-your-name-matty-1 5.9                                                            REFUSED (clipped)
we-will-need-a-bigger-bag-matty-1 3.5                                                            REFUSED (clipped)
clean (no squeeze)       -7.9      -13.4   -0.8    2.66 s   -39.8 (-40.1..-36.8) -24.0    kept: LONG
clean (no expander)      -7.9      -14.0   -0.8    3.08 s   none found         -20.0    kept: LONG
```

- **Clean take: gaps -37.6 (range -39.9 to -36.9), inside the brief's -35 to -40.** Without the expander (the old
  chain's behaviour) the gaps sat at about **-18 dBFS**, and the trim kept the 0.5 s lead-in (3.08 s against
  2.31 s).
- **Clipped: refused. 4 s read: kept, with the LONG warning** (4.31 s, past 2.5). **Hot: kept, with the HOT warning.**
- The synthetic takes land about 1.3 LU under -12 LUFS. That is the synth's crest, as the first booth lane found.
  The real-voice stand-in below lands on target.
- Matt's three raw takes (read-only copies) are all refused.

**Real-voice stand-in.** The shipped `stop-killing-me-matty-1` and `lesley-yeah-baby-matty-1` clips, turned down, with
-40 dBFS RMS pink noise, a 0.6 s lead-in and a 0.6 s gap:

| Level | Squeeze | LUFS | Gaps (median, range) | Dips vs no expander |
|---|---|---|---|---|
| Right level (peaks -10.7) | on | -12.5 | -41.4 (-45.5..-34.2) | |
| Right level | off | | -44.1 | -21.36 vs -20.15 (**1.2 dB**) |
| 10 dB too quiet (peaks -19.3; gain +20, QUIET warning) | on | -12.4 | -33.3 | |
| 10 dB too quiet | off | | -34.2 (no expander: about -16) | -21.27 vs -18.19 (3.1 dB; 200 ms: 1.6 dB) |

On the quiet take the no-expander run finds only 5 qualifying dips, against 8, so that 3.1 dB is a weak comparison.
The audio-director's check is at the right level, and it passes there. Spectrograms and waveforms, new chain against
old: `ls2-booth2/ls2-booth2-{voice,synth}-{new,old}-chain-{spec,wave}.png`.

## Proof: the booth in a browser (e2e)

Chromium ran with a fake mic fed the synthetic WAVs (`--use-file-for-fake-audio-capture`) on the lane's own Vite
server (:5311, private cacheDir). For each take: Space, wait about its length, Space, Enter. Every kept take was then
deleted through the page, so `src/sfx/` is clean (`git status` showed nothing there). The fake device loops its file
from mic-open, so each take starts at a random point in the loop. The kept lengths (3.1-4.7 s) are rig artefacts, not
chain numbers.

| Take | Status line (abridged) | Screenshot |
|---|---|---|
| clean | Kept ... -13.8 LUFS, 3.13 s, 0.21 s of pauses cut; long take | `ls2-booth2-clean-{recording,kept}.png` |
| clean, reprocessed (button) | Reprocessed 1 of 1 take | `ls2-booth2-reprocess.png` |
| long | Kept ... 4.66 s, 0.23 s cut; long take | `ls2-booth2-long-*.png` |
| hot | review: "Peaks went past -3 dBFS"; Kept ... **hot take (raw peak -2.1 dBFS, past -3)** | `ls2-booth2-hot-*.png` (HOT lit while recording) |
| clipped | review: "hit CLIP"; **Not kept: input clipped (raw peak +0.4 dBFS)** ... raw saved in assets-raw/voice/hype10/ | `ls2-booth2-clipped-*.png` (CLIP lit) |
| clean, checkbox unticked | Kept ... 3.34 s, no pauses cut; the record says `{"squeeze":false}` | `ls2-booth2-clean-nosqueeze-*.png` |

No page errors in any run. I looked at the hot-recording, clipped-kept and reprocess screenshots: the band, HOT,
CLIP, the refusal text, the checkbox and the reprocess button and summary all render.

**Reprocess CLI.** Run on a scratch root (`--root`) holding: a clean raw with an old processed take, Matt's clipped
raw with an old processed take, a 4 s raw, and a raw whose processed take was deleted. Result: 2 redone (one with
LONG), the clipped one skipped and left as it was, the deleted one left alone. `../etc`, a bare `--root`, `--root --all`
and a root without `src/sfx` are all refused.

## Tests (65 in booth.test.ts, 32 new against main)

- **The long-take warning:** the limits per slot; quiet at exactly 2.5/1.7/1.3 and warning just past; no warning on a
  NaN length or an untimed slot.
- **The chain levels:** the signed-off `VOX` numbers pinned; the gate from the floor and the expander from the trough;
  the clamps (the expander never above -30); rounding; unmeasurable rooms; the `Clipped` message; the page's HOT/CLIP
  constants and rule; the meter band position.
- **rawVerdict:** refuses at exactly -0.5; -0.51 is hot; -3 is not hot, -2.99 is; null and -inf.
- **Reprocess rules:** `RAW_RE` never matches a temp file, a `.json` record, a zero or a capital; `skipWhy`;
  `squeezeParam`; the checkbox reset (not in `record()`).
- **squeezeCuts:** the 0.15/0.10 split; the 0.4 s boundary (0.4 left alone, 0.41 cut); several pauses; unpaired ends,
  NaN, and a pause ending at EOF (checked: ffmpeg 9 does report a `silence_end` at EOF).
- **Watched fail:** `lenWarn` with `>` changed to `>=`, and `levels` with trough changed to floor, each failed a test.
  The code was restored before commit.

The ffmpeg behaviour itself (the gap levels, the refusal on a real file) is proven by `chain-probe.mjs` and the e2e,
not by vitest: CI may have no ffmpeg, and unit tests don't touch files.

## Gates (on `8c8dcaf`)

These ran one at a time under `/tmp/grodius-heavy.lock`, with Tctl at 48-70 °C. The harness used the lane's own
server (:5312, private cacheDir), stopped afterwards by PID.

```text
8c8dcaf5ec94542b5d63a033e1c1b2bf336494eb
--- typecheck
tsc exit 0
--- vitest
 Test Files  61 passed (61)
      Tests  1222 passed | 1 expected fail (1223)
build exit 0
✓ built in 611ms
--- dist grep: files containing each string
__booth 0 · booth.html 0 · text.html 0 · textframe 0 · grodius-voice-booth 0 · GRODIUS VOICE BOOTH 0 · x-booth 0
booth-token 0 · ?vox= 0 · VOX_FIRE 0 · afftdn 0 · ebur128 0 · silenceremove 0 · silencedetect 0 · agate 0
acrossfade 0 · ffmpeg 0 · assets-raw 0 · tools/booth 0 · reprocess 0 · rawVerdict 0 · squeezeCuts 0
input clipped 0 · long take 0 · hot take 0 · shorten pauses 0 · chain-probe 0
--- chunks named vox/booth: 0
```

`tools/booth/` is outside `tsconfig`'s `include` (`src` only), as before. It was also checked with `tsc --strict`
directly (plugin, booth, names, slots): clean.

```text
8c8dcaf5ec94542b5d63a033e1c1b2bf336494eb
--- harness short (lane server :5312, private cacheDir)
{"st":{"state":"over","score":1243,"scroll":3538,"lives":0,"px":50,"py":143.25,"en":0,"gibs":0,"drops":0,"caps":0},"hashes":["b9ce4a76ac","83207e90e2","deefef2cf3","cdff70c46c","8ecfcbedc1","0bc5cf3670"],"errs":[]}
note: 6/6 canvas hashes differ (advisory)
PASS vs baseline @ 8ff9ba4
```

`git status` was clean when the gates started.

## Agents used

- **audio-director:** signed off the chain numbers, with changes. It ruled trough+15 ≈ its "floor + 12" and accepted
  the expander before the trim, the 0.15/0.10 split and the click-free clip guard. Its changes: clamp top -45 (was
  -40); release 150 (was 200), with the dips check; re-rendered waveform PNGs (the first rendered blank); fades at the
  squeeze cuts. All four were applied.
- **tools-programmer** (code review, no edits). Applied:
  - a bare `--root` was falling back to the current folder (HIGH): now refused, as is a root without `src/sfx`;
  - aselect cut whole 93 ms frames: now atrim plus crossfade;
  - the checkbox was reset on record: now after a keep or a line change;
  - reprocess ignored each take's squeeze choice: now a `.json` record;
  - the `.sq.wav` temp is now removed in a `finally`;
  - slot names are now validated before any take is touched, and duplicates dropped;
  - the CLIP review text now says "unless that was only the key click";
  - the EOF pause is handled.

  Not applied: #7, a long reprocess request. Node's `requestTimeout` covers receiving the request, not the response,
  and a slot has a handful of takes.
- **qa-tester** (test review). It found the -3 boundary mismatch (the page used `>=`, the plugin `>`), now one rule,
  `rawVerdict`. Its boundary and coverage cases were added (13 tests), and `RAW_RE`, `skipWhy` and `squeezeParam` were
  factored out to test them.

## Not measured

- **A real voice in a real room.** The synthetic and stand-in takes show the chain does what it claims. Matt's
  delivery, and whether the expander chews his soft word tails, are for the audio-director's listen on the re-record.
- Whether the 5 ms crossfades are inaudible by ear. They are cuts in room tone already turned down 20 dB.
- The quiet-take dip comparison (above) is weak.
- The reprocess endpoint with many takes at once. It was tested with one take through the page and four through the
  CLI.
- **The current mixer level.** The brief says Internal Mic Boost was set to +10 dB. A read-only
  `amixer -c 2 sget 'Internal Mic Boost'` during this lane showed **level 2 = +20 dB** (limits 0-3, 10 dB steps). It was not
  changed. The parent should check it before Matt records.

## Open risks and notes for the merge

- **Takes kept before this branch** have no `.json` record. A reprocess uses the checkbox for them (the button) or
  `--no-squeeze` (the CLI). Matt's three existing raws clipped, so a reprocess skips them anyway. They need a
  re-record.
- Reprocess and keep both rename into `src/sfx/`, which reloads a game tab that has the audio glob. Don't run either
  while a gate uses that dev server (in the README).
- `assets-raw/voice/hype10/` in this worktree holds the e2e's synthetic raws and records. It is git-ignored, and
  nothing in `src/sfx/` remains.
- Merge order: this lane touches only `tools/booth/` and its test, so it sits cleanly on main `98d07f2`.

## Studio review batch (on `d1b956a`; fixed in `e012f37`)

All 8 leads approved, with notes. The parent named this batch; everything else is backlog, which the parent records.

1. **audio-director:** the README's input checklist contradicted the real setting.
   - The parent set the source to 40%. PipeWire drives Internal Mic Boost on this path and set it to 0, so a
     manual amixer change gets overwritten. The **mixer reading in "Not measured" above is superseded** by this.
   - The checklist now says: boost 0 (set through PipeWire or KDE, not amixer), and why boost 0 keeps the clip guard
     trustworthy; source about 40% (set 2026-11-09); then set the level by the meter (-10 to -6; peaks under -14,
     raise to 50-60%; HOT, drop 5%).
   - The chain list now puts the clip guard first, on the raw take, before the highpass.
2. **narrative-director:**
   - "One breath, unhurried: a short beat between the two caption lines is fine (pauses up to 0.4 s are kept); a
     long gap is what puts a line over its target."
   - The long-take warning ends "fewer or shorter pauses, not a faster read" (`slots.ts lenWarn`).
   - The face/tag sentence moved to the direction bullets.
   - Untick the squeeze when the pause is the joke (the beat before SERVED).
3. **lead-programmer, qa-lead:**
   - The CLI's argument rules are now a pure `parseArgs` (`tools/booth/args.ts`). The four refusals are pinned (a
     bare `--root`, `--root --all`, a root without `src/sfx`, `../etc`), plus no folders, an unknown flag,
     dedupe and the defaults.
   - `reprocess()` takes an injectable `process` step. `tests/integration/booth-reprocess.test.ts` runs on a temp
     root with no ffmpeg and covers:
     - `readOpts`: a saved choice, a broken record, a wrong type, none;
     - a deleted processed take, never revived;
     - a clipped raw, left as it was with no temp file behind;
     - the per-take `.json` winning over the run's `--no-squeeze`, and an older take getting the run's setting;
     - files that are not raw takes, ignored;
     - a bad folder, refused before any take is touched.
   - A source pin keeps `peakOf` on `sample_fmts=flt` with no `channel_layouts=mono`.
   - **Watched fail:** three mutations against these tests, each caught by its own test, then restored:
     - squeeze precedence swapped (`o.squeeze ?? readOpts`);
     - the mono downmix put back in `peakOf`;
     - deleted takes revived.
   - The CLI was re-run on the scratch root. The four refusals print their message, and the same 2 redone and
     2 skipped as before; the long-take line carries the new wording.

**Gates on `e012f37`.** Only `tools/booth/` and the tests changed, so there is no harness run, per the parent.

```text
e012f37d30291e418de9d6372b680782b750d357
--- typecheck
tsc exit 0
--- vitest
 Test Files  62 passed (62)
      Tests  1235 passed | 1 expected fail (1236)
build exit 0
✓ built in 309ms
--- dist grep: files containing each string
__booth 0 · booth.html 0 · text.html 0 · textframe 0 · grodius-voice-booth 0 · GRODIUS VOICE BOOTH 0 · x-booth 0
booth-token 0 · ?vox= 0 · VOX_FIRE 0 · afftdn 0 · ebur128 0 · silenceremove 0 · silencedetect 0 · agate 0
acrossfade 0 · ffmpeg 0 · assets-raw 0 · tools/booth 0 · reprocess 0 · rawVerdict 0 · squeezeCuts 0 · parseArgs 0
input clipped 0 · long take 0 · hot take 0 · shorten pauses 0 · not a faster read 0 · chain-probe 0
--- chunks named vox/booth: 0
```

`tools/booth/args.ts` also passes `tsc --strict` with the other booth modules. The booth page doesn't import it,
so the page's import pin is unchanged.
