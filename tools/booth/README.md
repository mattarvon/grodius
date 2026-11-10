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

1. **Mic boost down:** `amixer -c 2 sset 'Internal Mic Boost' 1` (+10 dB; 0 is off). Check it in `alsamixer -c 2`, F4.
2. **Source volume about 70%:** `pactl set-source-volume @DEFAULT_SOURCE@ 70%`, or the KDE audio settings.
3. **20-30 cm from the mic**, off-axis from the keyboard.
4. **Read a test line and watch the meter:** the loudest syllable should land in the marked band, **-10 to -6 dBFS**.
   **HOT** lights past **-3**: back off a little. **CLIP** lights at **-0.5**, and a take that reaches it is refused.
5. **Wait about 0.5 s after Space** before the first word: the denoise learns the room from it.
6. **One breath per line.** A pause in the middle is what puts a line over its length target.

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
     - **Length targets**: OPENED 0.8 s or less, kill words 1.2 s, hype lines and TAKEN DOWN 2 s. A take more than
       0.5 s over its target (after the trim: 1.3 s, 1.7 s, 2.5 s) is kept, with a warning. The caller's face and
     tag are the game's own (`voiceOf` in `src/render/hype.ts`): SGT. RAMROD SLAB is Matt's head.
3. **Record:** **Space** starts recording and **Space** stops it. Let the last word ring out a beat before you stop:
   the stop key's click is cut, and with it the last 0.2 s. The raw take plays back. A take stops itself after 15 s.
4. **Keep or discard:** **Enter** keeps it, **Backspace** throws it away, and **Space** records it again.
   - **Shorten pauses over 0.4 s** (on by default, for every new take): a pause inside the take longer than 0.4 s is
     cut to 0.25 s when it is kept. Untick it before Enter for a line whose pause is part of the read.
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

- mono;
- the key clicks at the start and the end cut;
- an 80 Hz highpass;
- the clip guard: a raw take peaking at -0.5 dBFS or above (the key clicks aside) is refused;
- a 14 kHz lowpass (the laptop's hiss lives above it);
- a light FFT denoise;
- an **expander between the phrases**: it turns the room down by up to 20 dB wherever the take falls quiet, from a
  threshold set per take from the room's level, so the gain below doesn't lift the room in every gap. The gaps land
  around -35 to -45 dBFS, like the shipped corpsevoice clip, and word tails decay rather than chop;
- the silence trimmed from the head and tail. The gate is set from the room's noise floor, and 90 ms is kept before
  the first word and 250 ms after the last;
- pauses over 0.4 s cut to 0.25 s (the checkbox above);
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
