# The voice booth

A dev-only page for recording Grodius's voice lines on the laptop and dropping them straight into the game
(LS2-booth). It never ships: the Vite plugin that serves it is `apply: 'serve'`, and the `?vox=` hook is dropped
from a build, so `npm run build` and the APK carry neither the page nor its endpoints.

**Needs** `ffmpeg` and `ffprobe` on PATH. Without them a keep fails with `spawn ffmpeg ENOENT`.

## Start

```sh
npm run dev
```

Open **http://localhost:5173/booth.html**, or whichever port Vite prints. Use `localhost`, not the Network address:
- the mic needs a secure context;
- the booth only answers this machine.

Allow the mic when the browser asks, then click once anywhere so the level meter starts.

**Check the mic path is raw.** The booth turns off the browser's echo cancel, noise suppression and auto gain. PipeWire
can still run its own echo-cancel or noise-suppression module on the mic: the booth then records a pumping, gated
voice, and its own denoise works on top of that. Check with `pw-cli ls Node | grep -i -E "echo|noise|rnnoise"` (or
the KDE audio settings) that the input you pick is the plain device, not an `echo-cancel` / `rnnoise` virtual source.

Recording on the Yeti: see [YETI.md](YETI.md).

Never tunnel or port-forward the dev server (ngrok, cloudflared, ssh -L). The booth refuses forwarded requests, but a
tunnel is the one way in from outside.

## Set the input level first

Matt's first three takes clipped by about 18 dB: the laptop mic had +60 dB of gain on it. No processing can remove
clipping, so a clipped take is refused. Before a session:

1. **Mic boost 0.** Check it in `alsamixer -c 2` (F4, Internal Mic Boost). PipeWire drives the boost on this path,
   so it is set there (or in the KDE audio settings), not with amixer: a manual amixer change gets overwritten. Boost 0
   is what keeps the clip guard trustworthy: with boost on, the mic clips in its own preamp before the booth sees it.
2. **Source volume about 40%** (set 2026-11-09): `pactl set-source-volume @DEFAULT_SOURCE@ 40%`, or the KDE audio
   settings.
3. **20-30 cm from the mic**, off-axis from the keyboard.
4. **Then set the level by the meter:** read a test line. The loudest syllable belongs in the marked band, **-10 to
   -6 dBFS**. Peaks under -14: raise the source to 50-60%. **HOT** (past **-3**): drop it 5%. **CLIP** lights at
   **-0.5**, and a take that reaches it is refused.
5. **Wait about 0.5 s after Space** before the first word: the denoise learns the room from it.
6. **One breath, unhurried:** a short beat between the two caption lines is fine (pauses up to 0.4 s are kept); a
   long gap is what puts a line over its target.

## Record

1. **Pick the mic** in the header. The laptop mic works now; plug in a USB mic later and choose it, and the booth
   remembers the choice.
   - The meter shows the input level: see the checklist above. A take that went HOT or CLIPPED says so when you stop.
   - If the mic is unplugged, the booth says so. Pick another, or press Space to retry the default.
2. **Pick a line** on the left.
   - The script is the game's own text (the HYPE captions, the kill words, the chain word), read from the game modules.
   - Each row shows its folder, its take count, its caller, and whether the game plays it yet. The line shows its
     delivery direction and a length target:
     - **SGT. RAMROD SLAB**: flat, low, unhurried gallows deadpan, not a hype yell. CALAMARI SERVED is his one line
       read as a joke.
     - **CREWMAN #5**: a distinct voice.
     - The caller's face and tag are the game's own (`voiceOf` in `src/render/hype.ts`): SGT. RAMROD SLAB is Matt's
       head.
     - **Length targets**: OPENED 0.8 s or less, kill words 1.2 s, hype lines and TAKEN DOWN 2 s. A take more than
       0.5 s over its target (after the trim: 1.3 s, 1.7 s, 2.5 s) is kept, with a warning: the fix is fewer or
       shorter pauses, not a faster read.
3. **Record:** **Space** starts recording and **Space** stops it. Let the last word ring out a beat before you stop:
   the stop key's click is found and cut (30-90 ms on the Yeti; never more than 0.2 s), so the end of the last word stays. With an FX rack on, the take is auditioned **through the rack** (the B render plays when it is ready; the raw take is the A lane, one **B** key away); with the rack off the raw take plays. A take stops itself after 15 s.
4. **Keep or discard:** **Enter** keeps it, **Backspace** throws it away, and **Space** records it again.
   - **Enter keeps the take through the FX rack as it stands**, never just the raw take. Every Keep button says what it
     will put on the take: **Keep with FX: pitch + bitcrush + ...** on the RAW TAKE deck, **Keep: pitch + bitcrush +
     ...** in the FX rack beside **Preview** (the one to press while you listen to the filtered take), and **Keep
     clean** on both when the rack is off. Enter works with the preset box focused, too (only a text box keeps its
     own Enter: a preset name, the effect search, a quip's words).
   - **Shorten pauses over 0.4 s** (on by default; the box is **remembered per line**, so a line you unticked stays unticked): a pause inside the take longer than 0.4 s is
     cut to 0.25 s when it is kept. Untick it before Enter for a line whose pause is part of the read, and when the
     pause is the joke (the beat before SERVED in CALAMARI SERVED).
   - **A clipped take is refused** ("input clipped: lower the mic level"). Its raw recording is still saved in
     `assets-raw/voice/<folder>/`, so nothing is lost; lower the level and record it again.
5. **Move on:** after a keep the booth **moves to the next line with no takes** by itself (wrapping; if every line has
   one it stays and says so; `localStorage booth.advance = 0` turns it off). By hand, **↓/→** goes to the next line with
   no take (the next line when there is none), **Shift+↓** always to the next line, **↑/←** to the previous. **T** opens the
   line in the game.

A kept take is cleaned up and filed as `src/sfx/<folder>/<line>-matty-<n>.ogg`, with the next free n, and the processed
file plays back in the **KEPT** deck, tagged with the rack it went through (**with FX: robot + radio band**, or **clean
(no FX)**). **Backspace** right after a keep, or **Delete this take**, removes it again: it deletes at once (no confirm) and a toast says
"Deleted <take>. **Z** to undo" for 6 s; **Z** puts it back (the booth held its bytes; the raw take and its record never left; `POST /__booth/restore`). A shipped clip with no raw take is undoable the same way. Reprocess and Apply still ask first.

**Change the FX on a take you already kept:** set the rack, then **Re-keep with current FX** (on the KEPT deck, or
**Re-keep with FX** on that take in the take list). Only that take is rewritten, from its raw recording, and its record
remembers the new rack; no re-recording, and the line's other takes are left alone. **FX preview** on a kept take
first lets you hear it through the rack; the rack's Keep button then reads **Re-keep <take>: <chain>** and does the
same.

The raw recording is kept in `assets-raw/voice/<folder>/`. That folder is git-ignored, and the dev server refuses to
serve it. **Delete** on a take removes the processed file only. It works on the shipped clips too; `git checkout`
brings one back.

### Processing

ffmpeg does it, in `tools/booth/plugin.ts` (`VOX`), and the audio-director signed it off. The steps:

- first, the clip guard, on the raw take as recorded: a peak at -0.5 dBFS or above (the key clicks aside) is refused;
- mono;
- the key clicks at the start and the end cut;
- an 80 Hz highpass;
- a 14 kHz lowpass (the laptop's hiss lives above it);
- a light FFT denoise;
- an **expander between the phrases**: it turns the room down by up to 20 dB wherever the take falls quiet, from a
  threshold set per take from the room's level, so the gain below doesn't lift the room in every gap. The gaps land
  around -35 to -45 dBFS, like the shipped corpsevoice clip, and word tails decay rather than chop;
- the silence trimmed from the head and tail. The gate is set from the room's noise floor, and 90 ms is kept before
  the first word and 250 ms after the last;
- pauses over 0.4 s cut to 0.25 s (the checkbox above);
- the **FX rack**, when an effect is on (below);
- the gain brought to **-12 LUFS**, the level of the voice clips that ship;
- a gentle 3:1 voice compressor;
- a 4x-oversampled limiter at -1.2 dBFS;
- 44.1 kHz Vorbis q5.

A take that needs more than +18 dB gets a **quiet take** warning. Move closer or raise the input gain, or the room's
hiss comes up with it. A raw peak past -3 dBFS gets a **hot take** warning.

`node tools/booth/chain-probe.mjs` runs synthetic takes through the chain and prints what it did (the gap level, the
length, the refusal); `production/qa/evidence/ls2-booth2.md` has its numbers.

`node tools/booth/fx-e2e.mjs [http://localhost:5199]` drives the real booth page in headless Chromium with a fake mic
against this checkout's running dev server: the FX rack, its preview, a keep with FX (Enter with the preset box focused,
and the rack's own Keep button, the labels and the KEPT deck's chain tag), "apply current FX", a single take re-kept
with FX and back to clean (the other take byte-identical), a clipped take
refused, the studio UI (waveforms, meter, A/B, the render cache, bypass, solo, search, a user preset saved, exported,
deleted and imported), the layout at 1280 and 760 wide. It records into `hype100` and deletes every file it made afterwards.

### Reprocess old takes

When the chain changes, takes kept under the old one can be redone from their raw recordings, without recording again:

- **In the booth:** **Reprocess this line's takes** under the take list (shown when the line has raw takes). It uses
  the pause checkbox's setting. **Re-keep with FX** on a take redoes that one take only, with the rack (FX rack, below).
- **From the shell:** `node tools/booth/reprocess.mjs hype10 hype35` (folders), or `--all`. Add `--no-squeeze` to
  keep the pauses as recorded.

Each `src/sfx/<folder>/<line>-matty-<n>.ogg` that has a raw take is rewritten in place. Skipped: a raw take whose raw
clipped (its processed take stays as it was), and one whose processed take was deleted (it is not brought back). The
shipped clips have no raw take, so they are never touched. Don't reprocess while a gate runs against the dev server.

**Takes kept before fx-dsp do not reprocess the same.** Each keep now stamps its record
(`assets-raw/voice/<folder>/<take>.json`) with `"chain": 2` (`FX_CHAIN` in `fx.ts`). A racked take with no stamp was
kept under the old rack, which the current one renders close to, but not the same as: the pre-gain to -20 LUFS, the
rubberband pitch shifter, the vibrato padding, echo and cave tails cut at 0.3 s and faded, and the bigger makeup (the
list is in `fx.ts`, above `COMP`). The shipped DESCEND take (`startgame/grodius-bitch-matty-1`, Hive mind) would come
out 123 ms shorter, at -1.5 dBTP instead of -0.4, and 0.3 LU quieter. So a reprocess that would rewrite such a take,
and an **Apply current FX** over any unstamped take, stops before it touches anything and warns: **this will change a
shipped take: listen first**. The booth asks (OK rewrites them, Cancel leaves everything as it was); the CLI lists
them and exits 3, and `--yes` rewrites them anyway. A rewritten take is stamped, and the run's summary names the
shipped takes that changed: listen to each before a commit (`git checkout` restores a shipped take). A clean take's
plain reprocess is the chain's own and does not ask.

## FX rack

The **FX rack** is under the takes list and **folded shut by default** behind one line, **Rack: <preset or custom> ▸ edit** (click or Enter on it; the choice is remembered); the preview deck stays outside the fold. The header shows the active preset and the caller. **The rack is remembered per caller** (the slot's `caller`): moving to a line by a caller you have set a rack for loads that rack; a caller never set keeps the rack as it is.

The rack (`tools/booth/fx.ts`) is a voice-design rack: 40 effects in 9 groups, each a set of
numeric knobs. Tick an effect to turn it on; its sliders set it. Most effects that blend have a **mix** knob (0 is
dry, 1 is all effect). With nothing ticked the rack is off and takes are kept clean.

| group (`GROUPS`, display order) | effects |
| --- | --- |
| Dynamics (`dynamics`) | Denoise (afftdn), Noise gate, Compressor (with make-up), De-esser |
| Tone & EQ (`tone`) | 3-band EQ, Exciter, Crystalizer, Sub boost, Radio band |
| Pitch & formant (`pitch`) | Pitch (rubberband, formant shifted / preserved), Formant, Tape speed, Sub octave, Harmonizer |
| Synth & vocoder (`synth`) | Robot, Vocoder, Ring mod |
| Dirt & comms (`dirt`) | Distortion, Wavefolder, Bitcrush, Lo-fi, Megaphone, Static |
| Modulation (`mod`) | Chopper, Clone army (chorus), Flanger, Phaser, Auto-wah, Vibrato, Wow & flutter, Tremolo |
| Time (`time`) | Stutter, Reverse, Echo |
| Space (`space`) | Hull reverb (multi-tap), Convolution (hull / locker / cathedral / plate / sewer), Reverse reverb |
| Weird (`weird`) | Whisper, Freq shifter (Bode), Comb filter |

The graph runs them in `EFFECTS` order (the signal flow, not the page's grouping): clean-up and tone first, then
pitch, synth, dirt, modulation, time and space last.

- **Pitch** is rubberband at high quality (it was resample + atempo). Its **formant** knob: *shifted* is the old sound
  (chipmunk up, ogre down), *preserved* keeps the throat; rubberband preserves formants well going up and only a
  little going down. **Formant** moves the throat and not the note (rubberband shifts the pitch by 1/r keeping the
  formants, then the take is resampled by r): down is a giant (measured: -6 st moves the formants 0.73x, ideal 0.71),
  up is an imp but subtler (+6 st: 1.12x). **Tape speed** moves pitch and tempo together, so it changes the length.
- **Vocoder:** a channel vocoder. The voice is the modulator; the carrier is generated in the graph (`aevalsrc`: saw,
  pulse, a minor-triad chord, white noise, or saw + hiss) at the **note** (Hz) and runs as long as the take. 8-24
  log-spaced bands from 110 Hz to 7 kHz: each band of the voice and of the carrier goes through the same pair of
  band-passes, the voice band's envelope (|x| through a 40 Hz low-pass) multiplies the carrier band, and the bands
  sum. Each carrier band is turned up by its computed power, so the output follows the voice's spectrum (and level)
  whatever the carrier, note or band count. **hiss** mixes the voice's own top (6 kHz up) back in so consonants stay
  words. A 2.3 s take renders in about 0.1 s.
- **Convolution:** a real reverb (`afir`) with an impulse response grown in the graph: decaying noise
  (`exp(-6.9 t / decay)`, RT60 = **decay**) with an onset build-up, filtered for the **room** (hull: metal modes;
  locker: small, boxy, flutter; cathedral: dark, slow bloom; plate: bright, instant; sewer: dark brick tube with a
  flutter echo), scaled by **size**, after a **pre-delay**. No IR files. **Reverse reverb** runs the take backwards,
  reverbs it into a **swell** of padding, and turns it forwards again: the reverb rises into each word (the swell
  adds to the length). **Reverse** plays the take backwards (mixed in, a backmask).
- **Where it runs:** after the cleanup, the trim and the pause squeeze, and **before** the gain to -12 LUFS, the
  compressor and the limiter. The rack first brings the take to -20 LUFS (`FX_LEVEL`), so the level-dependent
  effects (drive, crush, gate, compressor, folder, static) treat a quiet take and a loud one the same; the new
  effects carry a gain trim to come out about as loud as they went in, so a mix knob is a balance, not a level change.
  The original sixteen effects have no trim, but a rack kept before fx-dsp still reprocesses close to, not the same
  as, what ships (see Reprocess old takes: the booth warns first).
- **Loudness:** a racked take gets a bigger makeup than a clean one (up to 8 dB over three passes, VOX.fxMakeup; then
  a faster limiter release for a rack whose gaps hold the limiter down, VOX.fxRelease; and the ceiling lowered if the
  encode overshoots past -0.5 dBTP, VOX.fxPeak). Glitch and Evil machine, 2-3.5 LU under the clean take before, now
  land within about 1 LU of the target. The quiet-take warning is judged on the take before the rack, so it only
  fires for the mic.
- **Length:** echo and the reverbs pad the end so their tails ring out, but the rack adds at most 0.3 s
  (`FX_TAIL`) past the voice, faded out over it. Tape speed, stutter and reverse reverb change the length on purpose.
- **Presets:** Clean (no FX); the originals: Comms radio, Robot, Robot radio, Cyborg, Android, Evil machine (ring
  mod), Demon, Possessed, Ghost, Glitch, Busted PA, Clone army, Alien larva, Dying battery, Hive mind; the controller:
  Broadcast polish, Trailer voice, Cyborg sergeant, Station PA, Riot megaphone, Broken comms, Dead channel; machines:
  Vocoder drone, Pulse drone, Machine whisper, Dying android, Overclocked AI, Meat grinder; the dead: Hive queen,
  Corpse gurgle, Cathedral demon, Reverse-swell ghost, Backmasked, Tape horror, Slow-mo death, Helium leak, Xeno
  hiss, Bode alien, Insectoid, Giant, Imp, Ring wraith, Corpse choir, Abyss calling; places: Vent crawler, Sewer
  thing, Iron lung, Stuck signal. A preset is a starting point: every knob stays live, and the box reads **custom**
  once you move one.
- **Randomize** picks 2 to 5 effects at random settings, mostly mild so the words survive (never the clean-up tools:
  dynamics, EQ, exciter, crystalizer, sub boost). **All off** clears it.
- **Preview** (**P**) renders the source through the whole chain and the rack on the dev server and plays it. The
  source is the take you just recorded (before Enter), else your last take.
- **Auto preview** (on by default) re-renders whenever a preset, Randomize or a tick changes the rack, or a slider is
  let go. A focused slider keeps the arrow keys, to nudge it.
- **FX preview** on a kept take (one with a raw take) makes that take's raw recording the preview source.
- **Keep** (**Enter**, or the rack's own **Keep: <chain>** beside Preview) keeps the take under review with the rack
  as it stands; with the rack off the buttons read **Keep clean**. Solo does not change it: Keep uses the whole rack.
  The take list tags each take with its rack (`robot + radio band`), and the KEPT deck tags the take just kept.
- **Re-keep with current FX** (the KEPT deck; **Re-keep with FX** per take in the take list; the rack's Keep while a
  kept take is the preview source) rewrites that one take from its raw take with the rack as it stands, and records
  that rack with it (it keeps its own pause setting). With the rack off it strips the FX. It asks first, like Apply,
  when the take was kept before fx-dsp; a raw take that clipped is left as it was. The take then shows in the KEPT
  deck as **RE-KEPT**, with its numbers and its chain. (`POST /__booth/reprocess?cat=..&name=<take>&fx=..`.)
- **Each take remembers its rack**, in its record beside the raw take (`assets-raw/voice/<folder>/<take>.json`), so
  **Reprocess this line's takes** redoes each take with its own rack.
- **Apply current FX to this line's takes** rewrites **every** take of the line that has a raw take with the rack as it
  stands (for one take, use Re-keep above), and records that rack with each (each keeps its own pause setting). With the rack off it strips the FX.
  A raw take that clipped is skipped.
- **Previews write nothing to `src/`:** they render into a folder of the OS temp dir (`grodius-booth-*`, this dev
  server's own, never served), deleted when the server closes. A clipped take can be previewed, with a warning, but is
  still refused on a keep.
- **A keep reuses its preview:** the server keeps each preview render of the take under review for 10 minutes (the
  last 8, `CACHE` in `plugin.ts`), and the page's Keep names it (`&preview=<id>`). When the keep is of the same raw
  bytes, line, pause setting, rack and FX chain (`tools/booth/cache.ts`), the render is filed as it is, with the same
  record and numbers a full keep writes, and the keep is near instant; anything else (the rack changed since, Solo
  on, the server restarted) renders the take as ever. The take's clean-up (everything before the rack) is cached
  the same way, so A and B share it and the next rack's preview of the same take skips it.
- **One preview at a time:** a new preview (a knob let go, a preset) aborts the renders still on their way from the
  last one, and the dev server kills their ffmpeg and deletes their temp files.
- The rack setting is remembered by the browser across reloads.

Only numbers reach ffmpeg: `cleanFx` keeps the known effects and knobs, clamps each value to its range and rounds it
to its step, and `fxGraph` builds the filter graph from those numbers alone; an enumeration (a carrier, a room) is an
index into a fixed table in `fx.ts` (`tests/unit/booth-fx.test.ts`: every knob clamped, hostile input, every graph
well-formed). `tests/integration/booth-fx-ffmpeg.test.ts` renders every effect alone and every preset through the real
chain (finite, on target, under the ceiling, length bounded), renders the vibrato ten times in a row (finite every
time) and aborts a render (no temp file left). It needs ffmpeg on PATH: without it the run warns and shows a
`SKIPPED: ...` test, and on CI (`CI` set) that test fails, since `.github/workflows/build.yml` installs Ubuntu's ffmpeg
(checked for rubberband, afir, afreqshift, afftdn, aevalsrc, alimiter) before the tests. And
`node tools/booth/chain-probe.mjs --fx` prints the table: every preset and every effect alone (LUFS, peak, length,
the chain's time), and every effect at its knobs' extremes. ffmpeg's `vibrato` now and then reads its delay line
before writing it (NaN samples, a "silent take"); the rack runs it behind 20 ms of silence, cut off after.

### The studio UI

The page draws takes with [wavesurfer.js](https://wavesurfer.xyz) 8 (BSD-3-Clause, pinned in `package.json`) and its
Spectrogram, Timeline, Hover and Regions plugins. `tools/booth/wave.ts` loads it at runtime from
`/node_modules/wavesurfer.js/dist/` by URL, not with an import: the page's static graph stays leaf-only (no Vite client,
no dep optimizer, `tests/unit/booth.test.ts`). Without the library every display falls back to a plain player.

- **Input meter** (header): peak (bright) and RMS (dim) on a -60 to 0 dBFS scale, the target band, a white
  peak-hold tick (holds 1.5 s), HOT and CLIP lights. **CLIP latches** for the take; click it to clear.
- **Live monitor** under the line: a scrolling scope of the last ~6 s of input (green, amber past -3 dBFS, red at
  CLIP; pinkish while recording) with the take's peak so far, and a 40-band spectrum with falling peak dots.
- **Raw take deck** (in review): waveform, spectrogram (mel, 40 Hz-16 kHz), timeline, hover time; click to seek. Its
  readout gives the duration and the raw peak (red at CLIP, amber when hot). After a keep it shows the processed take
  with the plugin's LUFS, true peak, duration and gain. The GAIN counts every plain gain stage from the cleaned-up take
  to the clip, the rack's pre-gain to -20 LUFS included (before, a racked take's GAIN left it out and read up to
  ~8 dB low), but not the effects' own levels.
- **FX preview deck, A/B:** every preview renders the source twice: **B** through the rack, **A** clean (no FX). Both
  lanes play together and **B** (key or button, or a click on a lane's title) switches which one you hear, so the
  playhead is kept. The louder lane is turned down to the quieter one's LUFS (the MATCH readout), so the comparison is
  the sound, not the level. Each lane shows LUFS, peak and duration from the render. **Drag** across the FX waveform
  to **loop** a stretch (Clear loop drops it). Renders are cached per line, source, pause setting and rack (the last
  24), so going back to a rack, or to clean, is instant.
- **Rack:** effects in collapsible groups (the groups fx.ts names, or the booth's own until it does). Each card has a
  switch (**on / bypass**: an effect switched off keeps its settings, remembered across reloads), **S** (solo: the
  preview plays that effect alone; Keep still uses the whole rack) and **R** (back to its defaults). Double-click a
  slider for its default. The **chain strip** shows what is on, in the order it runs; click a link to find its card.
  **Search** (**/**) filters by name, blurb, group or knob; Escape clears it.
- **Your presets:** type a name and **Save** (Enter); they join the preset box under *Yours*. **Delete** removes the
  selected one; **Export** downloads them as JSON, **Import** loads such a file (same name replaces). They live in this
  browser's storage; the page works without it.
- **Keys:** **K** play / pause (the deck last used), **B** A/B, **/** search, as well as Space, Enter, Backspace, P, T
  and the arrows (a focused slider keeps the arrows).

## Hear it in the game

**Test in game** (**T**) opens the game in a second tab at the moment that plays the line. It uses the dev-only
`?vox=<folder>&clip=<take>` switch (`src/vox.ts`), with `?stage=orbit` where the line needs a run. Click once in the
game tab to start the audio; the line then fires once, through the comms window. Right after a keep it plays the take
you just kept; otherwise it plays one of the folder's takes.

- Each keep or delete reloads the game tab, with the new take in the bank. Click again to hear it.
- After any keep or delete, restart the dev server before running the harness, parity or any probe against it, and
  never pass a booth-session URL to a gate: a keep re-stamps the sfx modules and a stale server gives empty-module
  results. Don't record while a gate is running.
- Every line comes through the comms window with its caller's face. The kill words play just after the midboss's
  roar. OPENED (`carn5`) is skipped while another line talks and plays at most once per 20 s in a real run; the test
  switch skips that rule, and the corpse plea's once-a-stage count, so the line always plays.

## Quips: SLAB's one-liners after a big kill

The **QUIPS** section under the fixed lines is Matt's own list (LS2-quips), kept in `src/voice/quips.json` as
`{ id, text, note? }` rows. The game plays one, as SGT. RAMROD SLAB with the text as the caption, after a midboss's
kill word (30% of the time) or a stage boss's readout (50%): `QUIP.chance` in `src/voice/quiplist.ts`, about 4 a run. Only quips with a
take play; with none recorded, nothing changes in the game.

- **Add:** type the words in the box at the foot of the list and press Enter (or **Add quip**). Caps are made for you;
  ` / ` splits the two caption lines. At most 2 lines of 20 characters; letters, digits, spaces and `. , ' ? -` only (no
  `!`: SLAB never yells).
- **Edit:** change the words in the box under the line and press Enter. The id (the folder `src/sfx/quip-<id>/` and
  the take names) never changes, so no take is orphaned. A take recorded to the old words is marked **stale: says
  ...** in the take list (the words are saved with each take's raw record in `assets-raw/`, so only on the machine
  that recorded it); record it again and delete the stale one.
- **Delete:** **Delete quip** asks first; with takes, it deletes its processed takes too. The raw takes stay in
  `assets-raw/voice/quip-<id>/`, and while that folder exists the id is not handed out again (a fresh clone without
  `assets-raw/` could reuse it).
- **Record** like any line. The pause squeeze starts **off** for a quip (the beat is usually the joke); the target is
  2 s, and a take up to 2.5 s is fine.
- **Test in game** (**T**) opens `?vox=quip-<id>`; `?vox=quip` plays one through the game's own pick.
- **By hand:** the JSON may be edited directly; only `id`, `text` and `note` are kept (a booth edit rewrites the file
  without other keys). A row the game can't read is dropped from the game and shown in red in
  the booth, which then refuses every quip edit until the file is fixed.

In the game a quip is skipped (no roll) when anything but its own kill word is on the comms, or when it could not
start in time after the death (`QUIP.maxLate`: 2.5 s after a midboss, 3.6 s after a stage boss, whose quip waits for
TAKEN DOWN over the tally card); any other voice line called while it still waits takes its place; a quip whose words
are the readout just shown (CALAMARI SERVED after the Saucer) is never picked; and a shuffle bag plays every recorded
quip once before any repeats. When the player dies (any life) or the run ends, a quip talking fades out and a queued
one is dropped; kill words and other lines still finish (D50). A new game stops it like any line.

## The DESCEND line (startgame)

The `startgame` slot (DESCEND on the title) now records Matt's **GRODIUS BITCH**, as SGT. RAMROD SLAB: takes file as
`src/sfx/startgame/grodius-bitch-matty-N.ogg`, beside Lesley's shipped YEAH BABY clip, and the game picks either
(the face and caption by clip name, `VOICE` in `src/render/hype.ts`).

## Adding a line

Add a row to `tools/booth/slots.ts`. Point `text` at the game's export where one exists; otherwise use `copy`, with
the source literal it must still match. A **wired** line also needs:
- its folder in `VOICE_CAT` in `src/audio.ts`;
- a `VOX_FIRE` entry in `src/vox.ts`;
- a `test` query;
- a face mapping in `src/render/hype.ts`.

`tests/unit/booth.test.ts` checks the list against the game.

## Before you commit

Takes are recordings of a real voice, in a public repo. Commit only the ones you mean to ship (`git status src/sfx`).
