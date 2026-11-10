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

## Record

1. **Pick the mic** in the header. The laptop mic works now; plug in a USB mic later and choose it, and the booth
   remembers the choice.
   - The meter shows the input level. Aim your peaks inside the marked band, about **-18 to -6 dBFS**. **CLIP**
     lights when you hit full scale, and a clipped take says so.
   - If the mic is unplugged, the booth says so. Pick another, or press Space to retry the default.
2. **Pick a line** on the left.
   - The script is the game's own text (the HYPE captions, the kill words, the chain word), read from the game modules.
   - Each row shows its folder, its take count, its caller, and whether the game plays it yet. The line shows its
     delivery direction and a length target:
     - **SGT. RAMROD SLAB**: flat, low, unhurried gallows deadpan, not a hype yell. CALAMARI SERVED is his one line
       read as a joke.
     - **CREWMAN #5**: a distinct voice.
     - **Length targets**: OPENED 0.8 s or less, kill words 1.2 s, hype lines and TAKEN DOWN 2 s. A longer take is kept,
       with a warning. The caller's face and
     tag are the game's own (`voiceOf` in `src/render/hype.ts`): SGT. RAMROD SLAB is Matt's head.
3. **Record:** **Space** starts recording and **Space** stops it. Let the last word ring out a beat before you stop:
   the stop key's click is cut, and with it the last 0.2 s. The raw take plays back. A take stops itself after 15 s.
4. **Keep or discard:** **Enter** keeps it, **Backspace** throws it away, and **Space** records it again.
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
- a light FFT denoise;
- the silence trimmed from the head and tail. The gate is set from the room's noise floor, and 90 ms is kept before
  the first word and 250 ms after the last;
- the gain brought to **-12 LUFS**, the level of the voice clips that ship;
- a gentle 3:1 voice compressor;
- a 4x-oversampled limiter at -1.2 dBFS;
- 44.1 kHz Vorbis q5.

A take that needs more than +18 dB gets a **quiet take** warning. Move closer or raise the input gain, or the room's
hiss comes up with it.

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
