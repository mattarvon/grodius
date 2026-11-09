# LS2-tts: TTS dependency removed (D42 item 3) + CALAMARI SERVED back

Branch `ls2-tts` off `1f7f142`. Local commits only (not pushed).

| Commit | What |
|---|---|
| `b46a8d5` feat | SQUID SAUCER 2000's kill word is CALAMARI SERVED again (Matt 2026-11-09, "keep CALAMARI SERVED"); overrides D39's SEVERED for this enemy only (`src/enemies/mid/ufo.ts:168`, comment says so) |
| `86a639f` chore | `@capacitor-community/text-to-speech` removed: package.json, package-lock.json, Android gradle wiring, README, architecture docs, a guard test |
| `c24e677` feat | Scope add (Matt 2026-11-09, "'stop killing me' is too often"): the crew corpse pleads at most once per stage, on a kill that varies by stage |
| `54f574f` fix | Review N1/N2: the plea plays with `prio` (never dropped at the voice cap); a death restart keeps the played flag |
| `1e2736d` + final docs | this report and the gate logs |

## What changed

- **Kill word.** `ufo.ts:168` `word: 'CALAMARI SERVED'`. No test, tool or live doc keyed on SEVERED for the saucer (grep of src/tests/tools/docs/design/README). Old QA evidence (`ls2-names/saucer-kill-severed.png`) left as history.
- **Lockfile.** `npm uninstall --package-lock-only` (shared node_modules untouched). The lock loses exactly two things: the root `packages[""].dependencies` entry and the `node_modules/@capacitor-community/text-to-speech` block (8.0.2). No version, peer or `lockfileVersion` moved.
- **Android.** `android/capacitor.settings.gradle` (include + projectDir + blank line) and `android/app/capacitor.build.gradle` (one `implementation` line) edited by hand. devops-engineer read the Capacitor 8 generator (`@capacitor/cli/dist/android/update.js`) and confirmed the files now equal what `cap sync` writes. `capacitor.plugins.json` is gitignored. No TTS reference in AndroidManifest, proguard, MainActivity or `capacitor.config.ts`.
- **Dead code.** None left to delete: nativeSay, the babe bubble and the `$.G.babe` countdown went in the D42 review fixes (D42 "S2s fixed": "the dead babe and nativeSay code removed"). `git grep` in src finds only comments that say TTS is gone. No src change in commit 2, so the sim can't move.
- **README.** :28 platform.ts is haptics only. The audio notes now describe the D39 bank: recorded clips only, no text-to-speech; `startgame` and `corpsevoice` ship; no `hype<N>` folder ships, so a chain is its comms window and the sting; menu is `gross_pop`/`splat_s`; shelved clips (hype lines, boss reward, surfer, `silly`, menu farts) sit in `src/sfx-shelved/`. `silly` also dropped from the kill-sample list beside it (same D39 shelving). SQUID SAUCER 2000 added to Mini-bosses (D48 item 1), with "the scroll stops until they die (except the Saucer)", taken from the `ufo.ts` pacing header.
- **Docs.** `docs/architecture/architecture-overview.md` (:15, :42, :77) and `stack-reference.md` (the plugin row) no longer list TTS.
- **Test.** `tests/unit/voicebank.test.ts`: package.json does not depend on the plugin and neither gradle file includes it. Seen failing against the `b46a8d5` files (1 failed / 4 passed), passing on `86a639f`.

- **Corpse plea (scope add).** `src/enemies/corpsevoice.ts` is a pure leaf with no imports. `corpseVoiceAt(stage, loop)` picks kill 1..`CORPSE_VOICE.span` (5) from a multiplicative integer hash; it makes no `R()` or `srnd()` draw. In Descent 1, stages 0-11 land on kills 4 3 1 4 3 2 5 4 3 1 4 3. `corpseKilled(st, ...)` counts in the stage stats as `G.st.corpseN` and sets `G.st.corpseVo` once. `src/enemies/update.ts` calls it in place of the old `$.G.corpseN % 5`.
  - **Lifecycle:**
    - `startStage` builds a fresh `G.st`, so every stage starts at 0 and unplayed.
    - The checkpoint stores `G.st` (`runsave.ts` `st: isObj`), and `resumeRun` merges it back. RE-ENTER resumes the count and the flag as they stood at the checkpoint.
    - `deathRestart` now also carries `corpseVo` over the restore, as it already does deaths and hits, so a plea played since the checkpoint is not replayed.
    - The old `$.G.corpseN` was never reset or saved. It is gone.
  - **Quiet stages:** a stage with fewer corpse kills than its target (about 1 in 5 stages has a target of 5) stays quiet. That is a tuning question for game-designer.
  - **Tests:**
    - `tests/unit/corpsevoice.test.ts`: the plea fires once per stage, never twice even with the count wound back, the target varies across stages and loops, and a stage below its target stays quiet.
    - `runsave.test.ts`: the fixture round-trips `corpseN` and `corpseVo`.
    - `deathrestart.test.ts`: the flag carry, and its absence when the plea had not played. The carry test was seen failing without the `flow.ts` change. The new corpsevoice suite could not run against the old code, because its module didn't exist.

## Acceptance checklist

- [x] Kill word CALAMARI SERVED, screenshot looked at: `ls2-tts/saucer-kill-calamari-served.png` (`tools/ufo-shots.mjs`, long4, real blackletter font via a gate-only `fs.allow`). The banner sits over the "FIRST KILL +100" popup's left edge (it reads "ST KILL +100" while the banner is up). SEVERED did not overlap it (ls2-names/saucer-kill-severed.png), so this change brings the overlap back; it is backlogged for ui (move the popup clear of the banner).
- [x] Dependency gone from package.json and the lock; the lock diff is that package only
- [x] Android wiring matches `cap sync` output (devops-engineer)
- [x] CI regenerates the same files: the android job runs `npm ci`, `npm run build`, `npx cap sync android`, gradle
- [x] No TTS code in src; the bundle has no `text-to-speech`/`TextToSpeech` string (`grep -ric dist`: 0 files)
- [x] README :28, :111, Mini-bosses
- [x] Corpse plea at most once per stage on a varying kill, with no new sim or render draw. Harness `st` is identical and parity is identical.
- [x] corpseN and corpseVo: reset at stage start, kept through save and RE-ENTER, kept through a death restart
- [ ] Device boot check: Matt, below. Add one step: corpse kills in a stage give at most one "stop killing me".

## Gates (logs in `ls2-tts/`, each starts with the commit and `git status --short`)

The final gates ran on **`54f574f`** (all src and tests; the tree held only the gate logs). The same set also passed on `86a639f` (the TTS commit) and on `c24e677`, and harness and build passed again after the fix.
- Heavy jobs ran under `/tmp/grodius-heavy.lock`, with Tctl at 48-60 °C.
- The lane ran its own Vite server, restarted after every src change. It had its own `cacheDir` in the scratchpad and `fs.allow` for the shared node_modules.

- typecheck: exit 0 (`gate-typecheck.txt`)
- vitest: 58 files, 1132 pass + 1 expected fail (`gate-vitest.txt`). That is the 1122 from before, plus the TTS guard, the 7 corpsevoice tests and the 2 restart tests.
- build: exit 0, tail only (`gate-build.txt`)
- harness, no `--update`: short PASS @8ff9ba4, long4 PASS @88d9525, 12/12 scenarios PASS (`gate-harness.txt`). Sim state `st` is unchanged. Canvas hashes differ, which is advisory and was already so in the ls2-names and ls2-read logs.
- layout-parity, no `--update`: PARITY PASS; runs 3, 6, 7, 11, 15, 3x3 and 7m are identical (`gate-parity.txt`). The kill word is not in parity's record (it records titles).

## Device boot check (for Matt; devops-engineer)

After the merge, in the **main checkout** first: `git pull && npm ci && npx cap sync android && git status android/`, and expect a clean tree. `npm ci` removes the plugin left in the shared node_modules. (Capacitor 8 builds its plugin list from package.json, so after the pull a `cap sync` would not re-add the gradle lines even before `npm ci`; technical-director corrected an earlier claim here.)

1. Open the rolling "latest" release, download the APK, and check that its notes name the merge commit. Install it over the old build (uninstall first only if the signing key differs).
2. Launch the app. It should reach the title screen with no crash, no blank WebView and no hang.
3. The title music should play, and a menu tap should give haptics (the app and haptics plugins still load).
4. Press DESCEND. The startgame clip should play, and the screen should stay awake.
5. Make a 10-kill chain. You should see the caption THAT ONE / HAD A NAME in the comms window and hear the sting. There should be no spoken line.
6. Background the app and return, then press back. The pause menu should appear. Then quit.
7. Optional, with adb: `adb logcat -c`, play, then `adb logcat | grep -iE "Capacitor|chromium|AndroidRuntime|FATAL"`. The registered plugins should be App, Haptics and KeepAwake only. Report any `FATAL EXCEPTION` or `"TextToSpeech" plugin is not implemented`.
8. Corpse plea. In Descent 1's first stage, shoot at least 6 crew corpses: "stop killing me" plays exactly once (on the 4th corpse kill), is not cut off, and the music ducks under it. Die and let the stage restart: it does not play again. If that stage has too few corpses, use stage 2, whose target is the 1st corpse kill. Then say whether once a stage feels right or is still too often.

## Not measured

- The corpse plea was not heard in a live run. The harness removes AudioContext, and the bot rarely kills enough corpses in one stage. The pick, the count and the restart carry are unit-tested; the `sample` call is one line.

- No CI APK build or device run from this lane (local commits only). The gradle build is checked only by matching the generator's output.
- `npm ci` against the new lock was not run (the node_modules is shared). The match between package.json and the lock was checked by reading them.

## Open items (for the parent)

- `.claude/agents/web-specialist.md:70` and `.claude/docs/technical-preferences.md:65` still list the plugin. These are studio config, so web-specialist left them and so did I. The parent removed both list items in the merge (stack docs only, no permission or hook config).
- game-designer or narrative should check the README Saucer line's wording.
- CHANGELOG and decision-log entries are the parent's (the D48 "SEVERED stays unless Matt asks" line is now answered: Matt asked).

## Agents used

| Agent | What it did |
|---|---|
| web-specialist | Built commit 2: the lockfile uninstall, gradle edits, README, docs and the guard test; left the `.claude/` config lines alone |
| web-specialist (2nd) | Reviewed `c24e677`: APPROVE WITH NOTES. N1 (`prio`) and N2 (restart carry) were fixed in `54f574f`. N3 (quiet stages) is open for game-designer. |
| devops-engineer | Reviewed the Android/CI side against the Capacitor generator and the workflow: APPROVE WITH NOTES. Wrote the boot check and the local post-merge steps |
