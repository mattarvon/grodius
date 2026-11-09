# LS2-names: the held renames (D42 owned item 1) and SQUID SAUCER 2000

Branch `ls2-names`, off main `44890d2`. This is a copy-only change. No sim behaviour changed: the harness passes with no
`--update`, and the parity baseline moved by title strings only.

## Old → new

| Where | Old | New | Source |
|---|---|---|---|
| Orbit midboss name (`roster.ts` `name`: WARNING banner, HP bar, parity title) | THE SQUIDFUCKED SAUCER | SQUID SAUCER 2000 | Matt 2026-11-09 (overrides D39's THE DROWNED LANDER) |
| Orbit midboss `label` (probe-only, 12-character cap in `midreg.test.ts`) | SQUID SAUCER | SQUID SAUCER (unchanged) | narrative-director |
| Saucer kill word (`ufo.ts` `word`) | CALAMARI SERVED | SEVERED | tone.md §4(A)9 |
| Ice boss name (`biomes.ts` `bossName`, `hud.ts` MINI_NAMES) | THE BLOATED BITCH | THE BLOAT | D39 |
| Ice gate-plate tag (`biomes.ts`) | FROZEN // BLOATED BITCH | FROZEN // BLOAT | narrative-director, after the sibling tags |
| Stage-boss kill banner (`enemies/update.ts`), both bosses | UNCRUCIFIED / BUTCHERED | TAKEN DOWN | tone.md §4(A)9 |
| CARN chain word at 5 (`fx/update.ts`) | MESSY | OPENED | D39 |
| HYPE 10 | HELL YEAH / BROTHER! | THAT ONE / HAD A NAME | D39 |
| HYPE 35 | SPLATTER / 'EM, BROTHER! | WE WILL NEED / A BIGGER BAG | D39 |
| HYPE 50 | GLORIOUS / CARNAGE! | FILE IT / UNDER LOSSES | D39 |
| HYPE 75 | THE GATE / FEARS YOU! | THE GATE / KNOWS YOUR NAME | D39 |
| HYPE 100 | HELL IS / YOUR HOUSE! | YOU ARE / PART OF IT NOW | D39 |
| Snot stage `sub` (`biomes.ts`) | THE SHIP HAS A COLD | IT IS BREATHING. YOU ARE IN THE AIRWAY | tone.md §4(A)9; the final full stop was dropped to match the other subs (narrative-director) |
| Unvoiced chain caption (`render/hype.ts`) | SGT. RAMROD SLAB's face and tag | no face, no caller tag (the window, its static and the line only) | D42 item 1 |
| CREDITS.md row | THE SQUIDFUCKED SAUCER | SQUID SAUCER 2000 | |

**Also renamed:**
- comments: `ufo.ts`, `scripts.ts`, `music.ts`, `render/gross/mid/ufo.ts`, `crux.ts`, `audiomix.ts`, `eyes.ts`, `render/enemies.ts`;
- tool docstrings: `tools/bossart/{ufo,crux}/*.py`, `prep_midboss.py`, `ufo-shots`, `midslot-shots`, `midboss-probe`, `biomeboss-shots`, `upgrade-picker`;
- docs: `design/content-expansion.md`, `docs/pacing.md`, README.md:88 and :92;
- tests: `midreg`, `midslot`.

Every code key is unchanged (`k: 'ufo'`, `crux`). CHANGELOG history and old QA evidence are untouched. The CHANGELOG known-issue line at :41 (THE BLOATED BITCH, still shown) is resolved by this lane, and is left for the parent.

## The WARNING gate (brief item 3)

Fix merge 2 had already keyed the gate off `banner()`'s `warn` flag, not its text (`spawn.ts:419-430`). So the renames cannot open or close it, and no code change was needed. There is a new `tests/unit/warngate.test.ts` with 5 tests:
- every `MID_NAMES` entry through `miniWarn` holds the warm-up;
- THE BLOAT holds it exactly as any other name does;
- an unflagged banner reading "WARNING" does not hold it;
- the TAKEN DOWN kill banner does not hold it;
- a flagged banner holds it whatever its text.

**Watched failing:** with `banner()` temporarily keyed on `text === 'WARNING'`, 2 of the 5 fail. The edit was then restored, and `git diff` on `spawn.ts` is empty.

`layout-literals`: the "2000" in the name collides with a layout anchor. Per that test's rule, it gets a `NOT_X` row (`enemies/mid/roster.ts: [2000]`, part of a name), not a file skip.

## Gates (code tree as committed; Vite `cacheDir` gate-only, uncommitted)

- **typecheck:** clean.
- **vitest:** 57 files, 1122 pass, plus 1 expected fail. That is the 1117 from before, plus warngate's 5.
- **build:** exit 0 (`ls2-names/gate-build.txt`).
- **harness, no `--update`:** short PASS @8ff9ba4, long4 PASS @88d9525, 12/12 scenarios PASS (`ls2-names/gate-harness.txt`). No `sig`, `seen` or `st` moved.
- **parity:** `tools/layout-parity.baseline.json` was edited by substitution alone, `|THE SQUIDFUCKED SAUCER|` → `|SQUID SAUCER 2000|` (14 lines) and `|THE BLOATED BITCH|` → `|THE BLOAT|` (5 lines).
  - **Proof:** the old baseline with those strings normalised is byte-identical to the new one.
  - **Run:** `node tools/layout-parity.mjs`, with no `--update`, gives PARITY PASS: runs 3, 6, 7, 11, 15, 3x3 and 7m are identical (`ls2-names/gate-parity.txt`). So the real run differs from the old baseline in titles only.
  - **What parity compares:** the `commit` field does not take part (qa-lead checked `layout-parity.mjs:218-231`).
- **`srnd()`:** the faceless caption keeps the tear's draws. The old fallback face was also face 0, so the hiccup and tear draw counts are identical (web-specialist and qa-lead both checked). The harness `st`/`gibs` agree.
- **Heavy jobs:** each ran under `/tmp/grodius-heavy.lock` with Tctl below 80 °C (61-63 °C at the start).

## Screenshot evidence (`production/qa/evidence/ls2-names/`; looked at)

- **`saucer-warning-title.png`:** WARNING / SQUID SAUCER 2000 (`tools/ufo-shots.mjs`, long4). It is in the real blackletter/Silkscreen fonts, served through a gate-only `fs.allow`.
- **`saucer-kill-severed.png`:** the SEVERED kill word over the Saucer's death.
- **`hype-10-faceless.png`:** the 10-chain caption THAT ONE / HAD A NAME, in an empty comms window with no face and no tag (a scratchpad rig: it sets `combo` to 10 and steps 40 frames).

## Not measured

- **Screenshots not taken:** THE BLOAT on the HP bar and the gate plate, TAKEN DOWN, OPENED (the 5-chain) and the Sinus stage card. They are string-only, at the same draw sites as the shots above. web-specialist checked their widths: each is shorter than an existing string at the same site.
- No device or Fold check.

## Open items

- README.md:111 still describes the pre-D39 audio: hype10 "hell yeah", the 20-chain surfer, `fart_nav`/`fart_ok`, and the TTS fallback. That is stale documentation, outside the rename scope.
- `src/render/hype.ts:9` and `src/render/hell.ts:112` still head the unused `drawSlab` art with "hype man: SGT. RAMROD SLAB". It is dead art, not shown to players, and was left alone (no drive-by changes).
- D47 owned item 1, "repaint it waterlogged for THE DROWNED LANDER", needs restating for SQUID SAUCER 2000 (parent, decision log).
- The CHANGELOG entry and the decision-log entry are the parent's.

## Agents used

| Agent | What it did |
|---|---|
| narrative-director | Checked every string against Pillar 5: label stays SQUID SAUCER (12-character cap), no final full stop on the sub, TAKEN DOWN for both bosses, no face and no tag on the caption. Found the README and CHANGELOG sites. |
| web-specialist | Reviewed the code diff: no S1 or S2. `srnd()` parity confirmed; widths, save and key exposure clear. |
| qa-lead | APPROVE WITH NOTES: the parity titles-only method holds, `warngate` is adequate, copy-pinning tests are not worth it, and named the minimal shots. |

## Merge notes

One commit, off main `44890d2`. Not pushed (lane brief).
