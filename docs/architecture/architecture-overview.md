<!-- Generated 2026-10-31 by the Claude Code Game Studios hierarchy against main @ 8ce8bdd (read-only audit). -->

# Grodius: Architecture Overview

> Status: this describes the code as it stands at `8ce8bdd` (main, 2026-10-31). It is descriptive, not aspirational. Grodius has **no engine**. The CCGS framework's Godot/Unity/Unreal assumptions (`src/CLAUDE.md`, `docs/engine-reference/`, `.claude/rules/engine-code.md`, `scene-files.md`, `shader-code.md`) do not apply until they are reconfigured.

## 1. Stack

| Layer | Technology | Where |
|---|---|---|
| Language | TypeScript (`strict:false`), ES2022 | `tsconfig.json` |
| Bundler / dev | Vite 8 (`base:'./'`, `assetsInlineLimit:0`) | `vite.config.ts`, `package.json:6-12` |
| Rendering | Canvas 2D only (no WebGL) | `src/core.ts:13-32` |
| Audio | Web Audio graph plus HTMLAudioElement music | `src/audio.ts`, `src/music.ts` |
| Mobile | Capacitor 8 Android shell (haptics, TTS, keep-awake, app lifecycle) | `capacitor.config.ts`, `android/`, `src/platform.ts` |
| Fonts | @fontsource Silkscreen 400, Grenze Gotisch 600/900 | `src/main.ts:3-5` |
| CI/CD | GitHub Actions: debug APK to a rolling `latest` prerelease, `dist/` force-pushed to gh-pages | `.github/workflows/build.yml` |
| Tooling | Playwright probes and shot rigs (`tools/*.mjs`), Python asset pipeline (`tools/prep_*.py`, `gen_*_sfx.py`) | `tools/` |

There are no runtime dependencies beyond the Capacitor plugins and the fonts (`package.json:24-33`).

## 2. Module map (`src/`, about 21k LOC)

The modules form a flat ES-module graph. `main.ts` imports almost every module purely for side effects, in a fixed order that sets up the globals (`src/main.ts:2-33`, "Side-effect imports keep the original top-to-bottom init order"). Import order therefore matters.

| Area | Modules | Role |
|---|---|---|
| Entry / loop | `main.ts` | Fixed-step loop, auto-quality, idle-time warm-up of boss art, Android lifecycle, debug hooks `window.__G/__rig/__mb/__au/__sfx/__music` |
| Shared state | `state.ts` (`export const $: any = {}`), `world.ts` | `$` holds state, `G` (run), `P` (player), `T`, `DK`, `meta`, menu state. `world.ts` holds the entity/particle pools (`shots, eshots, enemies, drops, gibs, mists, sparks, flashes, decals, geysers, splats, caps, orbs, texts, arcs`) and terrain arrays |
| Core utils | `core.ts` | Constants (`W=480,H=270`, `LEVEL`, `BOSS_AT`), canvases (`cv/dctx` display, `lo/ctx` 480x270 world, `lc`, `hc`), RNG `R = Math.random` and `rr/ri/pick`, `swapRm`, palette `C` |
| Sim step | `step.ts` | `step()` handles state dispatch, input and music. `stepWorld()` computes `G.pow/G.rank`, then runs the per-system updates in a fixed order, the deferred `G.pend` queue and the periodic `save()` |
| Run flow | `flow.ts`, `stages.ts`, `biomes.ts`, `depth.ts` | New game, stage sequencing and grades/payouts, biome fork and scripts, per-descent scaling tables (`DEPTH`) |
| Player / weapons | `player.ts`, `shots.ts`, `perks.ts`, `mutations.ts`, `contraptions.ts`, `shipform.ts` | Movement, firing, collision resolution (`shots.ts`), in-run perks, kill-count grafts, Infirmary contraptions, ship-tier form |
| Enemies / bosses | `enemies/{spawn,update,scripts,elite,ufo}.ts`, `boss/update.ts` | Wave scripts, `mk()` HP, `BS()/every()/formation()` pressure curves, per-kind AI in one large `switch` (`enemies/update.ts`, 1016 LOC), Gravity Drive |
| FX sim | `fx/{spawn,update,gunfx,fxsprites}.ts` | Gore particles, combo/hype triggers, ambient, glitch/hell triggers |
| Rendering | `render/*.ts`, `render/gross/*.ts` (about 11k LOC, half the codebase) | World/terrain/biome art, enemies, ship plus `shipparts`, bullets, HUD, screens/menus, hype comms window, post-FX (`hell.ts`), hi-res eyes, code-drawn gross boss art (`drive.ts` 1754 LOC) |
| Assets | `sprites.ts` (+`src/sprites/*.png` via `import.meta.glob`), `textures.ts`, `src/img`, `src/sfx`, `src/music` | Background-loaded sprite strips with code-drawn fallbacks. Render RNG `srnd()` |
| Input | `input.ts` | Keyboard, touch and pointer listeners, then `pollInput()` into `I`/`PR` per step. `fit()` scales the display. `lowerDK()` |
| Audio | `audio.ts`, `music.ts` | Sample banks with shuffle bags, synth fallbacks, a 14-voice cap, drone bed, master compressor. Music tracks per biome with ducking |
| Menus | `menus.ts` | Title, pause, game-over and Infirmary (shop) item lists and navigation |
| Persistence | `save.ts` | `SET` settings plus `$.meta` in localStorage `grodius.v1`, with a v1-to-v2 refund migration |
| Platform | `platform.ts` | `NATIVE`/`TOUCH`, haptics `buzz()`, native TTS `nativeSay()`. One of only 2 type-checked files |
| Perf | `perf.ts` | `?perf` phase timer (`pIn/pOut/pFrame`) |

## 3. Game loop

`src/main.ts:41-59` runs a classic fixed-timestep accumulator. Each frame:

- `dt` is clamped to 100 ms.
- Up to 5 steps of 1/60 s run per rAF.
- `render()` runs only if at least one step ran.
- `autoQuality()` then lowers the display multiplier `DK` (down to a floor of 2) when the average frame time exceeds 19.2 ms over 120 frames.

Simulation and rendering share one thread and one RNG. Pause, hitstop and perk-pick slow-mo (one world step in every 5) are handled inside `step()` (`src/step.ts:67-90`). Timers mostly count steps (`G.pend`, `G.tally`), but voice lines and `warmUp` still use `setTimeout` and `requestIdleCallback`.

## 4. State model

- **Global mutable bag `$`** (`state.ts:2`, typed `any`). There is no ECS or class hierarchy. Entities are plain objects in module-level arrays (`world.ts`) and are removed with `swapRm`, which does not preserve order.
- **Screen state machine** is the `$.state` string (`'title' | 'play' | 'pause' | 'over' | 'shop'` plus fork/transition flags on `G`), dispatched in `step()` and `render()`.
- **Run state `G`** is rebuilt by `flow.ts` `newGame()`. **Meta state `$.meta`** (biomass, Infirmary `lv`, contraptions `own/rig/cl`, `best`) persists across runs.
- **Difficulty**: `G.pow` is a raw power sum divided by 14 and is uncapped. `G.rank = clamp(pow,0,1)` (`step.ts:24-28`). The `DEPTH` multipliers in `depth.ts` apply from Descent 2 onward.

## 5. Rendering

- **World buffer**: everything is drawn at 480x270 into `lo/ctx` (`core.ts:15-20`) with smoothing off.
- **Present**: `render/eyes.ts:474-479` blits `lo` to the display canvas `cv` at `W*DK`. Hi-res photo eyes and the hero eye are then drawn directly on `dctx` at display resolution.
- **Order** (`render/screens.ts:444-485`): world (with screen-shake transform), splats, enemy shots, `postFX()` (hell image, washes, glitch strips), HUD, then overlays (over/pause/menus). Note that `postFX` runs **after** enemy bullets.
- **Art sources**: code-drawn vector (`render/enemies.ts`, `shipparts.ts`, `gross/*`), bitmap strips from `tools/sprite_prep.py`, and JWST/RODA backdrops. Static boss art is prebuilt during idle time (`main.ts:72-77`). Six separate `GROSS=1` constants control gore detail.
- **CRT scanlines** are a CSS gradient on `#crt` (`input.ts:225`).

## 6. Input

DOM listeners in `input.ts` write into raw key and touch state. `pollInput()` turns that into the `I` snapshot and the `PR` pressed-this-step set once per step (`step.ts:69`). Touch steers the ship by relative drag. DOM buttons `#pw` (POWER) and `#ps` (pause) sit over the canvas. Pointer hover sets `$.menuSel`, and hit-testing uses `$.menuBoxes` rebuilt every render. Android back and pause are routed in `main.ts:96-108`.

## 7. Audio

All sound sums into `AU.m` (gain .55), then one `DynamicsCompressor` (-16 dB, 5:1), then the destination (`audio.ts:22-28`). That covers SFX, voice, reverb return, an always-on 41-82 Hz drone (`audio.ts:47-86`) and the music bus (`music.ts:86`). `sample()` enforces a 14-voice cap with no priority (`audio.ts:127`). Voice lines are samples with a TTS fallback: `speechSynthesis` on the web, `nativeSay` on Android. Render modules trigger sounds through five ad-hoc `snd()` wrappers in `render/gross/*`.

## 8. Persistence

There is one localStorage key, `grodius.v1`, loaded once at import time inside a single try/catch (`save.ts:21-61`). `save()` runs on `pagehide`, on Android pause, on some menu actions, and every 600 steps (`step.ts:61`). The save has a schema version `meta.v=2`. There is no backup key and no export/import, so an uninstall (forced by the unstable APK signature) wipes progress.

## 9. Platform layer

`platform.ts` is the only Capacitor-aware module apart from the lifecycle block in `main.ts`, and everything degrades to a no-op on the web. The WebView has `webContentsDebuggingEnabled: true` (`capacitor.config.ts:11`). `perf.ts` reads `?perf` from `location.search`, which the Capacitor WebView never sets.

## 10. Build and CI

`.github/workflows/build.yml`:

- **Triggers**: push to `main` and `workflow_dispatch` only. There is no `pull_request` trigger.
- **`android` job**: `npm ci` then `vite build`, then `cap sync`, then `assembleDebug`. An optional signing step is gated on a step-level env (`:34-37`). The job then deletes and recreates the `latest` prerelease, interpolating the commit message into bash (`:74-77`).
- **`web` job**: `npm ci` then `vite build`, then `git init` in `dist` and `push -f gh-pages`.
- **Gates**: no tests, no typecheck and no harness run, and the `web` job has no `needs:`.
- **Versioning**: `versionCode` is the run number (`android/app/build.gradle:11-12`). The build is not stamped anywhere in the game.

## 11. Test and verification tooling

- `tools/harness.mjs` is a deterministic run. It seeds `Math.random`, fakes the clock and rAF, scripts input, and prints `{st, hashes, errs}`. It **never compares or exits non-zero** (`:37`). `npm run test:regress` passes no URL (`package.json:11`, `harness.mjs:5,23`), so it fails as written.
- About 40 `*-probe.mjs` and `*-shots.mjs` scripts drive the game through `window.__G` and friends. Each duplicates its own clock/RNG stub and port, and none asserts anything.
- **Playwright is not declared** in `package.json`. There is no `tests/` directory and no unit tests. `tsc` checks only `src/state.ts` and `src/platform.ts`, because the other 52 files start with `// @ts-nocheck`.
- Baselines live only in prose that disagrees with itself: CHANGELOG.md:26 vs docs/pacing.md:199 vs :310.

## 12. Key constraints

1. **Fixed 480x270 logical resolution** and pixel art. All layout uses hard-coded pixel coordinates.
2. **60 Hz fixed step** with up to 5 catch-up steps. Gameplay timers count in frames.
3. **Determinism only through tooling.** The game itself is unseeded (`R = Math.random`). The harness gets determinism by overriding `Math.random`, so any render or audio call to `R()` shifts the sim stream (rule stated at `sprites.ts:7-9`, violated by about 40 render call sites, `hell.ts:3` and `audio.ts:213`).
4. **Mobile WebView is the primary target** (Galaxy Fold). Perf is managed by the DK display multiplier and hard-capped pools. There is no on-device perf baseline.
5. **Solo developer on two machines.** The Windows box holds `assets-raw/` (git-ignored), so the asset pipeline can't be reproduced on this laptop.
6. **Gameplay values live in typed in-code tables** (`DEPTH`, `GRADE`, perk tables), each with its rationale in a comment. There are no external config files.

## 13. Tech-debt hotspots

| Hotspot | Evidence | Impact |
|---|---|---|
| No working regression gate | `tools/harness.mjs:5,23,37`; `package.json:11`; no playwright dep; `build.yml:24-25,87-88` | Every tune or merge ships unverified to the phone and to Pages |
| Untyped global state | `state.ts:2` `$: any`; 52 of 54 files `@ts-nocheck`; `tsconfig strict:false` | A typo in a `$.G` field or state string fails silently |
| Shared RNG across sim, render and audio | `core.ts:33`; render imports of `R/rr/ri` (`render/hell.ts:3`, `bullets.ts`, `enemies.ts`, `hud.ts`, `screens.ts`); `audio.ts:213`; `boss/update.ts:99` and `fx/update.ts:316` `SET.flashes && R()` | Baseline churn on visual edits, results depend on the Flashes setting, blocks seeded runs |
| Scattered player-damage resolution | `shots.ts:256-263,313-317`; `player.ts:145-154`; WARD ring drain | WARD/perk/telemetry bugs, inconsistent i-frames |
| Fragile entity removal | `shots.ts:354-363` with `swapRm` (`core.ts:55`) | Confirmed double-collect / wrong-capsule-deleted bug |
| Pressure/power formulas without tests | `step.ts:24-28`, `enemies/spawn.ts` `BS/every/formation/mk`, `depth.ts`, `perks.ts:255` `perkPower()` (8 of 24 perks) | Coefficient edits (`d0115f4`, `48eb7cb`) regressed the Choir nailbars and drone fire with nobody noticing |
| Monolithic AI switch and boss art | `enemies/update.ts` (1016 LOC), `render/gross/drive.ts` (1754), `biomebosses.ts` (1203) | Hard to review, and shared cases (Maw used for 3 bosses) |
| Single-bus audio mix | `audio.ts:22-28,127`; `music.ts:86` | No priorities, culls report success, no volume sliders |
| Save robustness | `save.ts:21-61` one try/catch, no backup; unstable APK signing | A load error or an update wipes progress |
| Post-FX over hazards / photosensitivity | `render/screens.ts:470-474`; `hell.ts:66-87`; `save.ts:6` flashes default ON | Readability and safety |
| Release pipeline | `build.yml:34-37,74-77,89-99`; `build.gradle:11-12` | Unsigned updates, notes taken from commit messages, no rollback, no build stamp |
| Order-dependent side-effect imports | `main.ts:2-33` | Moving an import can break init silently |

## 14. Framework fit (CCGS)

`src/CLAUDE.md` mandates "external config files" for gameplay values, dependency injection, an engine-reference lookup and tests in `tests/`. `.claude/rules/` ships engine-, scene- and shader-specific rules. `project.yaml` is unconfigured, and `docs/architecture/` holds only `tr-registry.yaml`. Until `project.yaml` and `src/CLAUDE.md` are adapted, treat these as non-binding for Grodius: typed in-code tables stand in for external config, and a Node-only `tests/` (node --test) is the unit layer.
