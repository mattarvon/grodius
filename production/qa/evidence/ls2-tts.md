# LS2-tts: TTS dependency removed (D42 item 3) + CALAMARI SERVED back

Branch `ls2-tts` off `1f7f142`. Local commits only (not pushed).

| Commit | What |
|---|---|
| `b46a8d5` feat | SQUID SAUCER 2000's kill word is CALAMARI SERVED again (Matt 2026-11-09, "keep CALAMARI SERVED"); overrides D39's SEVERED for this enemy only (`src/enemies/mid/ufo.ts:168`, comment says so) |
| `86a639f` chore | `@capacitor-community/text-to-speech` removed: package.json, package-lock.json, Android gradle wiring, README, architecture docs, a guard test |
| (this) docs | this report and the gate logs |

## What changed

- **Kill word.** `ufo.ts:168` `word: 'CALAMARI SERVED'`. No test, tool or live doc keyed on SEVERED for the saucer (grep of src/tests/tools/docs/design/README). Old QA evidence (`ls2-names/saucer-kill-severed.png`) left as history.
- **Lockfile.** `npm uninstall --package-lock-only` (shared node_modules untouched). The lock loses exactly two things: the root `packages[""].dependencies` entry and the `node_modules/@capacitor-community/text-to-speech` block (8.0.2). No version, peer or `lockfileVersion` moved.
- **Android.** `android/capacitor.settings.gradle` (include + projectDir + blank line) and `android/app/capacitor.build.gradle` (one `implementation` line) edited by hand. devops-engineer read the Capacitor 8 generator (`@capacitor/cli/dist/android/update.js`) and confirmed the files now equal what `cap sync` writes. `capacitor.plugins.json` is gitignored. No TTS reference in AndroidManifest, proguard, MainActivity or `capacitor.config.ts`.
- **Dead code.** None left to delete: nativeSay, the babe bubble and the `$.G.babe` countdown went in the D42 review fixes (D42 "S2s fixed": "the dead babe and nativeSay code removed"). `git grep` in src finds only comments that say TTS is gone. No src change in commit 2, so the sim can't move.
- **README.** :28 platform.ts is haptics only. The audio notes now describe the D39 bank: recorded clips only, no text-to-speech; `startgame` and `corpsevoice` ship; no `hype<N>` folder ships, so a chain is its comms window and the sting; menu is `gross_pop`/`splat_s`; shelved clips (hype lines, boss reward, surfer, `silly`, menu farts) sit in `src/sfx-shelved/`. `silly` also dropped from the kill-sample list beside it (same D39 shelving). SQUID SAUCER 2000 added to Mini-bosses (D48 item 1), with "the scroll stops until they die (except the Saucer)", taken from the `ufo.ts` pacing header.
- **Docs.** `docs/architecture/architecture-overview.md` (:15, :42, :77) and `stack-reference.md` (the plugin row) no longer list TTS.
- **Test.** `tests/unit/voicebank.test.ts`: package.json does not depend on the plugin and neither gradle file includes it. Seen failing against the `b46a8d5` files (1 failed / 4 passed), passing on `86a639f`.

## Acceptance checklist

- [x] Kill word CALAMARI SERVED, screenshot looked at: `ls2-tts/saucer-kill-calamari-served.png` (`tools/ufo-shots.mjs`, long4, real blackletter font via a gate-only `fs.allow`). The banner sits over the "FIRST KILL +100" popup's left edge; that popup was there before too, and the longer word only covers more of it.
- [x] Dependency gone from package.json and the lock; the lock diff is that package only
- [x] Android wiring matches `cap sync` output (devops-engineer)
- [x] CI regenerates the same files: the android job runs `npm ci`, `npm run build`, `npx cap sync android`, gradle
- [x] No TTS code in src; the bundle has no `text-to-speech`/`TextToSpeech` string (`grep -ric dist`: 0 files)
- [x] README :28, :111, Mini-bosses
- [ ] Device boot check: Matt, below

## Gates (logs in `ls2-tts/`, each starts with the commit and `git status --short`)

Run on `86a639f` with a clean tree except the untracked gate logs. Heavy jobs ran under `/tmp/grodius-heavy.lock`, with Tctl at 48-56 °C. The lane used its own Vite server, which had its own `cacheDir` in the scratchpad and `fs.allow` for the shared node_modules.

- typecheck: exit 0 (`gate-typecheck.txt`)
- vitest: 57 files, 1123 pass + 1 expected fail (1122 before + the new guard) (`gate-vitest.txt`)
- build: exit 0, tail only (`gate-build.txt`)
- harness, no `--update`: short PASS @8ff9ba4, long4 PASS @88d9525, 12/12 scenarios PASS (`gate-harness.txt`). Sim state `st` is unchanged.
- layout-parity, no `--update`: PARITY PASS; runs 3, 6, 7, 11, 15, 3x3 and 7m are identical (`gate-parity.txt`). The kill word is not in parity's record (it records titles).

## Device boot check (for Matt; devops-engineer)

After the merge, in the **main checkout** first: `git pull && npm ci && npx cap sync android && git status android/`, and expect a clean tree. The shared node_modules still holds the plugin, and a `cap sync` or `npm run android` before `npm ci` re-adds the gradle lines (the new vitest would then fail locally; that is the guard).

1. Open the rolling "latest" release, download the APK, and check that its notes name the merge commit. Install it over the old build (uninstall first only if the signing key differs).
2. Launch the app. It should reach the title screen with no crash, no blank WebView and no hang.
3. The title music should play, and a menu tap should give haptics (the app and haptics plugins still load).
4. Press DESCEND. The startgame clip should play, and the screen should stay awake.
5. Make a 10-kill chain. You should see the caption THAT ONE / HAD A NAME in the comms window and hear the sting. There should be no spoken line.
6. Background the app and return, then press back. The pause menu should appear. Then quit.
7. Optional, with adb: `adb logcat -c`, play, then `adb logcat | grep -iE "Capacitor|chromium|AndroidRuntime|FATAL"`. The registered plugins should be App, Haptics and KeepAwake only. Report any `FATAL EXCEPTION` or `"TextToSpeech" plugin is not implemented`.

## Not measured

- No CI APK build or device run from this lane (local commits only). The gradle build is checked only by matching the generator's output.
- `npm ci` against the new lock was not run (the node_modules is shared). The match between package.json and the lock was checked by reading them.

## Open items (for the parent)

- `.claude/agents/web-specialist.md:70` and `.claude/docs/technical-preferences.md:65` still list the plugin. These are studio config, so web-specialist left them and so did I. Each fix deletes one list item, and needs Matt's or the parent's say-so.
- game-designer or narrative should check the README Saucer line's wording.
- CHANGELOG and decision-log entries are the parent's (the D48 "SEVERED stays unless Matt asks" line is now answered: Matt asked).

## Agents used

| Agent | What it did |
|---|---|
| web-specialist | Built commit 2: the lockfile uninstall, gradle edits, README, docs and the guard test; left the `.claude/` config lines alone |
| devops-engineer | Reviewed the Android/CI side against the Capacitor generator and the workflow: APPROVE WITH NOTES. Wrote the boot check and the local post-merge steps |
