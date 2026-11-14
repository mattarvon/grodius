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
   the stop key's click is cut, and with it the last 0.2 s. The raw take plays back. A take stops itself after 15 s.
4. **Keep or discard:** **Enter** keeps it, **Backspace** throws it away, and **Space** records it again.
   - **Shorten pauses over 0.4 s** (on by default, for every new take): a pause inside the take longer than 0.4 s is
     cut to 0.25 s when it is kept. Untick it before Enter for a line whose pause is part of the read, and when the
     pause is the joke (the beat before SERVED in CALAMARI SERVED).
   - **A clipped take is refused** ("input clipped: lower the mic level"). Its raw recording is still saved in
     `assets-raw/voice/<folder>/`, so nothing is lost; lower the level and record it again.
5. **Move on:** **↑/↓** (or ←/→) move between lines once the take is kept or discarded. **T** opens the line in the
   game.

A kept take is cleaned up and filed as `src/sfx/<folder>/<line>-matty-<n>.ogg`, with the next free n, and the processed
file plays back. **Backspace** right after a keep, or **Delete this take**, removes it again.

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

### Reprocess old takes

When the chain changes, takes kept under the old one can be redone from their raw recordings, without recording again:

- **In the booth:** **Reprocess this line's takes** under the take list (shown when the line has raw takes). It uses
  the pause checkbox's setting.
- **From the shell:** `node tools/booth/reprocess.mjs hype10 hype35` (folders), or `--all`. Add `--no-squeeze` to
  keep the pauses as recorded.

Each `src/sfx/<folder>/<line>-matty-<n>.ogg` that has a raw take is rewritten in place. Skipped: a raw take whose raw
clipped (its processed take stays as it was), and one whose processed take was deleted (it is not brought back). The
shipped clips have no raw take, so they are never touched. Don't reprocess while a gate runs against the dev server.

## FX rack

The **FX rack** under the line (`tools/booth/fx.ts`) puts cyborg filters and other weird stuff on a take: pitch, a
sub-octave double, robot, whisper, ring mod, chopper, distortion, bitcrush, a radio band, clone army (chorus), flanger,
phaser, vibrato, tremolo, echo and hull reverb. Tick an effect to turn it on; its sliders set it. Most effects that
blend have a **mix** knob (0 is dry, 1 is all effect). With nothing ticked the rack is off and takes are kept clean.

- **Where it runs:** after the cleanup, the trim and the pause squeeze, and **before** the gain to -12 LUFS, the
  compressor and the limiter. So a take with FX still lands at the game's loudness and under the same ceiling (a
  peaky rack such as Glitch or the ring mod can come back up to about 3 LU quieter: the makeup pass is capped). The
  quiet-take warning is judged on the take before the rack, so it only fires for the mic. Echo and hull reverb pad the
  end, so their tails ring out; that can push a line past its length target.
- **Presets:** Clean (no FX), Comms radio, Robot, Robot radio, Cyborg, Android, Evil machine (ring mod), Demon,
  Possessed, Ghost, Glitch, Busted PA, Clone army, Alien larva, Dying battery, Hive mind. A preset is a starting point:
  every knob stays live, and the box reads **custom** once you move one.
- **Randomize** picks 2 to 5 effects at random settings, mostly mild so the words survive. **All off** clears it.
- **Preview** (**P**) renders the source through the whole chain and the rack on the dev server and plays it. The
  source is the take you just recorded (before Enter), else your last take.
- **Auto preview** (on by default) re-renders whenever a preset, Randomize or a tick changes the rack, or a slider is
  let go. A focused slider keeps the arrow keys, to nudge it.
- **FX preview** on a kept take (one with a raw take) makes that take's raw recording the preview source.
- **Keep** (**Enter**) keeps the take with the rack as it stands. The take list tags each take with its rack
  (`robot + radio band`).
- **Each take remembers its rack**, in its record beside the raw take (`assets-raw/voice/<folder>/<take>.json`), so
  **Reprocess this line's takes** redoes each take with its own rack.
- **Apply current FX to this line's takes** rewrites every take of the line that has a raw take with the rack as it
  stands, and records that rack with each (each keeps its own pause setting). With the rack off it strips the FX.
  A raw take that clipped is skipped.
- **Previews write nothing to `src/`:** they render into `assets-raw/voice/.preview/` (git-ignored, never served)
  and are deleted once sent. A clipped take can be previewed, with a warning, but is still refused on a keep.
- The rack setting is remembered by the browser across reloads.

Only numbers reach ffmpeg: `cleanFx` keeps the known effects and knobs, clamps each value to its range and rounds it
to its step, and `fxGraph` builds the filter graph from those numbers alone (`tests/unit/booth-fx.test.ts`).
`node tools/booth/chain-probe.mjs --fx` runs the synthetic clean take through every preset, and every effect alone at
its knobs' extremes, with real ffmpeg.

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
