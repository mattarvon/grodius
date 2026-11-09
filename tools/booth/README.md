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

Never tunnel or port-forward the dev server (ngrok, cloudflared, ssh -L). The booth refuses forwarded requests, but a
tunnel is the one way in from outside.

## Record

1. **Pick the mic** in the header. The laptop mic works now; plug in a USB mic later and choose it, and the booth
   remembers the choice.
   - The meter shows the input level. **CLIP** lights when you hit full scale, and a clipped take says so.
   - If the mic is unplugged, the booth says so. Pick another, or press Space to retry the default.
2. **Pick a line** on the left.
   - The script is the game's own text (the HYPE captions, the kill words, the chain word), read from the game modules.
   - Each row shows its folder, its take count, its caller, and whether the game plays it yet.
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
- The hype lines and TAKEN DOWN show an UNKNOWN CALLER face in the game for now. The comms window maps faces by clip
  name (`src/render/hype.ts`), and mapping these folders to SGT. RAMROD SLAB is a follow-up after LS2-tts.

Lines marked **recorded, not wired** are not played by the game yet: the midboss kill words (`kill-<kind>`) and OPENED
(`carn5`). Record them now; wiring them through the comms window is the same follow-up.

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
