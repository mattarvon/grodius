# tools/bossart: the bosses' baked art (LS2-bossart)

One folder per boss (`crux butcher drive maw choir cyst prentice brood ufo`), each with a `bake.py` that paints every state of the
boss Matt picked (D46) and writes `src/sprites/boss/<key>.png` + `.json` through `bake.py` here (`Baker`). The runtime is
`src/render/gross/baked.ts`. Run a bake with `python3 -I tools/bossart/<boss>/bake.py` (PIL only, no numpy; about 1 to 5 min).

**Photos are not in the repo.** The painters read real photographs for tissue detail from `assets-raw/bossart/tex/` (91 CC BY /
CC0 / PD photos found on Openverse, credited in `CREDITS.md` under "Boss art photo sources", with `credits.json` beside them) and
`assets-raw/bossart/dl/` (the Maw's oral disc photo and the CC0 teeth plate). `assets-raw/` is git-ignored: it lives on Matt's
machine. Set `BOSSART_TEX` to read the library from elsewhere. Without it a bake cannot run; the committed atlases are the
source of truth for the game.

`bosskit.py`'s `in_game()` mock reads `tools/bossart/bg/`, which is not kept: it was a Phase 1 concept aid, unused by the bakes.
Proof in motion: `tools/boss-clip.mjs` + `tools/boss_clip_pack.py`.
