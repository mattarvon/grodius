---
name: vo-booth-qc
description: "Grodius voice-over standards and QC for booth takes: file layout, loudness and length limits (from tools/booth), ffmpeg measurement, reprocessing, and the vitest gate before pushing. Use when checking, measuring, re-rendering or committing VO takes."
user-invocable: false
---

# VO booth QC

The source of truth is the code. Read it before you quote a number:
`tools/booth/plugin.ts` (`VOX`, `measure`, `processTake`), `tools/booth/slots.ts` (`MAX_LEN`, `LEN_SLACK`, `lenLimit`),
`tools/booth/reprocess.mjs` (header), `tools/booth/README.md` (booth workflow), `tools/booth/YETI.md` (mic setup).

## File layout

- Processed takes (shipped, played by the game): `src/sfx/<cat>/<slug>-matty-<n>.ogg`, `n` from 1 up.
  Quips are `src/sfx/quip-<id>/`.
- Raw takes and records (git-ignored, never served): `assets-raw/voice/<cat>/`.
  - `<slug>-matty-<n>.(webm|ogg|wav|m4a)`: the raw recording (`RAW_RE` in plugin.ts).
  - `<take>.json`: the record (chain stamp, FX rack, pause setting). A missing record means a take kept before
    LS2-booth2 (`--no-squeeze` for the CLI).
- Shipped clips with no raw take are never touched by reprocess.
- Commit only takes you mean to ship: `git status src/sfx`. Takes are recordings of a real voice in a public repo.

## Standards (quote the values from the files)

- **Loudness target:** `VOX.lufs = -12` LUFS (integrated). Tolerance `VOX.tol = 0.5` LU.
- **Ceiling:** `VOX.ceil = 0.87` linear, about -1.2 dBFS. Racked takes: `VOX.fxPeak = -0.5` dBTP.
- **Raw clip guard:** a raw sample peak at or above `VOX.clipAt = -0.5` dBFS is refused. Hot warning past `VOX.hotAt = -3`.
- **Quiet take:** gain needed above `VOX.quiet = 18` dB triggers a warning. The fix is at the mic
  (see `tools/booth/YETI.md`), never a denoise turn-up.
- **Length targets** (`MAX_LEN`, seconds): hype 2, bossreward 2, kill 1.2, carn5 0.8, quip 2, bark 2.5.
  The booth warns past `lenLimit = MAX_LEN + LEN_SLACK` (`LEN_SLACK = 0.5`), so kill words warn over 1.7 s.
  A long take is a warning, never a refusal.
- **Trim and tail:** head kept `VOX.head = 0.09` s, tail kept `VOX.tail = 0.25` s. Stop-key click cut before the trim,
  found by `clickTail` (30-90 ms on the Yeti). Recording guidance: leave about 0.3 s of silence after the last word.
- **Pauses:** with the squeeze on, a pause over `VOX.squeeze.over = 0.4` s is cut to `keep = 0.25` s.
- **Format:** mono Vorbis, 44.1 kHz, quality `VOX.q = 5`.

## Measure with ffmpeg

Run these on a finished file (the same filters the booth uses):

```sh
# integrated LUFS, sample peak and true peak (the booth's measure() pads 0.5 s first so ebur128 has a full 400 ms block)
ffmpeg -hide_banner -nostats -i FILE.ogg -af apad=pad_dur=0.5,ebur128=peak=true -f null -
# the summary's first "Peak:" line is the sample peak; the one under "True peak:" is dBTP. Read both.

# length in seconds
ffprobe -v error -show_entries format=duration -of csv=p=0 FILE.ogg

# internal silences (a pause check; -40 dB mirrors the trim gate's upper clamp, VOX.gate.max)
ffmpeg -hide_banner -nostats -i FILE.ogg -af silencedetect=noise=-40dB:d=0.3 -f null -
```

Check a take against: LUFS within 0.5 of -12, true peak at or under -1.2 (-0.5 for a racked take), duration within
`lenLimit` for its slot, and no unexpected long silence. The booth already warns on the same numbers; run these when
a file came from elsewhere or to double-check.

## Re-render with reprocess.mjs

Re-runs the current chain on the kept raw takes and rewrites `src/sfx/<cat>/` in place:

```sh
node tools/booth/reprocess.mjs <folder>... [--no-squeeze] [--yes] [--root <repo>]
node tools/booth/reprocess.mjs --all
```

- `<folder>`: a slot folder (`hype10`, `kill-ufo`, ...) or a quip (`quip-<id>`).
- `--no-squeeze`: keep pauses as recorded (default shortens them).
- Exit 3: the run would change a **shipped** take (a take kept before fx-dsp, with no chain stamp). Nothing was touched.
  Listen to each one, then re-run with `--yes` only if you accept the change. `git checkout` restores a shipped take.
- Needs `ffmpeg` and `ffprobe` on PATH and Node 22.18+ or 23.6+.
- Don't run it while the dev server is in use by a gate, parity or probe run: a rewritten take re-stamps the sfx modules.

## Before pushing new takes

Run the unit suite and make sure it passes:

```sh
npx vitest run
```

- `tests/unit/voicebank.test.ts` guards shelved banks: `babe20`, `fart_nav`, `fart_ok` and `silly` must have no
  `src/sfx` folder, and a bank with no clips must play nothing.
- `tests/unit/booth.test.ts` checks the slot list against the game.
- `tests/unit/booth-fx.test.ts` covers the FX rack; `tests/integration/booth-fx-ffmpeg.test.ts` needs ffmpeg on PATH.

Do not push a new take set on a failing run. A test failure on a voice bank means a file is in the wrong folder or
a bank was un-shelved by accident.

## Checklist for a take

1. Raw peak under -0.5 dBFS and not hot (past -3). A clipped raw is refused: re-record at a lower gain.
2. No quiet-take warning (gain at or under +18 dB).
3. Processed file: LUFS -12 +/- 0.5, true peak at or under -1.2, length within the slot's limit.
4. Re-keyed or reprocessed takes: listen to any shipped take the run reported before committing.
5. `npx vitest run` passes.
6. Only the intended files are staged under `src/sfx/`.
