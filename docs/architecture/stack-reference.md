# Stack Reference — Grodius

Grodius has **no game engine**. This file replaces the template's
`docs/engine-reference/<engine>/` folders: it pins the toolchain the game is
built on and records what changed in the post-cutoff majors.

**Pinned:** 2026-10-31 from `package-lock.json` (lockfileVersion 3) and the
installed `node_modules`. **Verify before trusting:** every version below is
newer than the LLM knowledge cutoff. The installed package is the source of
truth: read `node_modules/<pkg>/**/*.d.ts` and its README before using an API.
Anything marked UNVERIFIED was not confirmed from the installed files.

## Runtime and language

| Package | Version | Role |
|---|---|---|
| `typescript` | 7.0.2 | Typecheck only (`npm run typecheck` = `tsc --noEmit`); Vite strips types at build |
| `vite` | 8.3.2 | Dev server (`npm run dev`) and production build (`npm run build` → `dist/`) |
| `rolldown` | 1.2.12 | Vite 8's bundler (dependency of vite) |
| Node.js | CI: 22 (`.github/workflows/build.yml`); laptop: 26 | Vite 8 requires `^20.19.0 \|\| >=22.12.0` (`node_modules/vite/package.json` engines) |

There is no game framework: the game draws on one Canvas 2D context (`#c`), runs
its own fixed 60 Hz step (`frame()` in `src/main.ts`, up to 5 catch-up steps per
animation frame), and plays procedural Web Audio (`src/audio.ts`, `src/music.ts`).

## Mobile packaging

| Package | Version | Use in Grodius |
|---|---|---|
| `@capacitor/core` | 8.5.2 | `Capacitor.isNativePlatform()` → `NATIVE` in `src/platform.ts` |
| `@capacitor/android` | 8.5.2 | Android project in `android/` (peer: core ^8.5.0) |
| `@capacitor/cli` | 8.5.2 | `npx cap sync android` (`npm run android`) |
| `@capacitor/app` | 8.1.2 | Pause and back-button handling (`src/main.ts`) |
| `@capacitor/haptics` | 8.0.2 | Impact and death haptics (`src/platform.ts`) |
| `@capacitor-community/keep-awake` | 8.0.1 | Screen stays on during play |
| `@capacitor-community/text-to-speech` | 8.0.2 | Native voice lines (browser falls back to `speechSynthesis`) |

`capacitor.config.ts`: appId `com.mattarvon.grodius`, `webDir: 'dist'`,
`webContentsDebuggingEnabled: true` (sideload builds stay inspectable via
`chrome://inspect`).

Android build (`android/`): Android Gradle Plugin 8.13.0, Gradle 8.14.3,
`minSdkVersion` 24, `compileSdkVersion`/`targetSdkVersion` 36
(`android/variables.gradle`). CI builds `assembleDebug` with Java 21 (Temurin).

## Fonts

`@fontsource/silkscreen` 5.3.0 and `@fontsource/grenze-gotisch` 5.3.0, bundled
locally (the game loads them before the first frame; no network fonts).

## Test and tooling

| Package | Version | Use |
|---|---|---|
| `playwright` | 1.64.1 (exact pin) | Harness and all `tools/*-probe.mjs` / `*-shots.mjs` rigs; Chromium 156.0.8078.4 (`playwright-core/browsers.json`) |
| `vitest` | 5.0.5 (exact pin) | Unit/integration tests: `npm run test:unit` (`vitest run`, `vitest.config.ts`, `tests/unit/**/*.test.ts`, Node environment) |
| `prettier` | 3.9.9 | Formatting (no script entry; run ad hoc) |
| `@babel/parser`, `traverse`, `generator`, `types` | 8.0.6 | No importer in `src/` or `tools/`; presumably used by ad-hoc refactor scripts. Do not remove without asking Matt |

Python 3 scripts in `tools/` (`prep_*.py`, `gen_*_sfx.py`, `vault_mirror.py`) run
outside the npm toolchain.

## What changed in the majors that matters here

### TypeScript 7 — native compiler (verified)
- The `typescript` package now ships a launcher (`node_modules/typescript/lib/getExePath.js`)
  that runs a **platform-specific native binary** from an optional dependency
  (`@typescript/typescript-<platform>-<arch>`, e.g. `typescript-linux-x64`).
  `npm ci` on a new OS/arch must install the matching optional package, or
  `tsc` fails to start.
- The package exposes only the `tsc` bin; there is no JS compiler API in
  `lib/` anymore (only `getExePath`, `tsc.js`, `version.cjs`). Tools that
  `import ts from 'typescript'` to use the compiler API will not work.
  UNVERIFIED: the full list of tsconfig options dropped or changed in 7.0 —
  check the TypeScript release notes before editing `tsconfig.json`.
- Grodius impact today is small: `tsconfig.json` is `strict: false`, and 52 of
  54 files in `src/` carry `// @ts-nocheck` (only `src/state.ts` and
  `src/platform.ts` are actually checked).

### Vite 8 — rolldown bundler (verified)
- Vite 8 bundles with rolldown (`vite` depends on `rolldown` 1.2.12;
  `node_modules/vite/dist/node/index.d.ts` imports it).
- Build options are `build.rolldownOptions`; `build.rollupOptions` remains only
  as a deprecated alias (marked `@deprecated` in the installed types). The
  build's chunk-size warning already points at
  `build.rolldownOptions.output.codeSplitting`.
- Vite's JS API (`createServer`, `server.resolvedUrls`) is what
  `tools/harness.mjs` uses to self-start a dev server.

### Capacitor 8 (partly verified)
- `@capacitor/core` 8 bundles a **SystemBars** API for edge-to-edge system bar
  styling (`node_modules/@capacitor/core/system-bars.md`), separate from the
  Status Bar plugin.
- UNVERIFIED: other breaking changes between Capacitor 7 and 8 (minimum
  Android/Java/Gradle requirements, plugin API changes). Read each plugin's
  README in `node_modules` and the Capacitor migration guide before upgrading
  or adding a plugin.

## CI facts

`.github/workflows/build.yml` runs on push to `main`, on pull requests, and on
manual dispatch:
- `verify`: `npm ci`, Playwright Chromium, typecheck (non-blocking), build,
  `npm run test:unit` and `npm run test:regress` (blocking).
- `web` (`needs: verify`, not on PRs): builds and force-pushes `dist/` to
  `gh-pages`.
- `android` (not on PRs, not yet gated on verify — decision D4): builds the
  debug APK, optionally signs it with the `GRODIUS_*` secrets, and replaces
  the rolling `latest` prerelease.

## Determinism facts the harness depends on

- `R` in `src/core.ts` is `Math.random`; the harness seeds `Math.random`, so
  sim, render, fx and audio share one random stream.
- `auInit()` draws `R()` once per noise sample (about 7 x the sample rate), so
  the harness removes `AudioContext` to keep runs identical across machines.
- See `.claude/rules/sim-determinism.md`.
