# The voice booth

A dev-only page for recording Grodius's voice lines on the laptop and dropping them straight into the game
(LS2-booth). It never ships: the Vite plugin that serves it is `apply: 'serve'`, so `npm run build` and the APK
carry neither the page nor its endpoints.

## Start

```sh
npm run dev
```

Open **http://localhost:5173/booth.html**, or whichever port Vite prints. Use `localhost`, not the Network address: the
mic needs a secure context, and the booth only answers this machine. Allow the mic when the browser asks.

## Record

1. Pick the mic in the header. The laptop mic works now; plug in a USB mic later and choose it, and the booth
   remembers the choice. The meter shows the input level, and the peak number turns red near clipping.
2. Pick a line on the left. The script is the game's own text (the HYPE captions, the kill words, the chain word),
   read from the game modules. Each row shows its folder, its take count, its caller, and whether the game plays
   it yet.
3. **Space** starts recording, and **Space** again stops. The raw take plays back.
4. **Enter** keeps it, **Backspace** throws it away. **↑/↓** move between lines.

A kept take is cleaned up and filed as `src/sfx/<folder>/<line>-matty-<n>.ogg`, with the next free n, and the processed
file plays back. The raw recording is kept in `assets-raw/voice/<folder>/` (git-ignored). **Delete** on a take removes
the processed file only.

The processing is done by ffmpeg in `tools/booth/plugin.ts` (`VOX`):

- mono;
- an 80 Hz highpass;
- a light FFT denoise for the laptop mic;
- the silence trimmed from the head and tail, keeping 50 ms and 120 ms;
- the gain brought to **-12 LUFS**, the level of the voice clips that ship, under a -1 dBFS ceiling;
- 44.1 kHz Vorbis q5.

## Hear it in the game

**Test in game** opens the game in a second tab at the moment that plays the line. It uses the dev-only `?vox=<folder>`
switch (`src/vox.ts`), with `?stage=orbit` where the line needs a run. Click once in the game tab to start the audio,
and the line fires with its comms-window face. Keep the tab open: each new keep reloads it with the new take in the
bank; click once more and the line fires again.

Lines marked **recorded, not wired** are not played by the game yet: the midboss kill words (`kill-<kind>`) and OPENED
(`carn5`). You can record them now; wiring them through the comms window is a follow-up.

## Adding a line

Add a row to `tools/booth/slots.ts`. Point `text` at the game's export where one exists; otherwise use `copy`, with
the source literal it must still match. `tests/unit/booth.test.ts` checks the list against the game.

## Before you commit

Takes are recordings of a real voice, in a public repo. Commit only the ones you mean to ship.
