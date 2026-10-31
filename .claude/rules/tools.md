---
paths:
  - "tools/**"
---

# Tools Rules (probes, rigs, harness, asset prep)

`tools/` holds the measurement and pipeline scripts: `*-probe.mjs` (balance and
pacing measurement), `*-shots.mjs` (screenshot rigs), `harness.mjs` (the
regression gate), `playtest.mjs`/`progression.mjs` (bot runs), and Python asset
prep (`prep_*.py`, `gen_*_sfx.py`, `vault_mirror.py`).

- **Probes and rigs measure; they never change the game.** They drive the real
  build through Playwright and read state (`window.__G` or the module globals).
  A probe must not write to `src/`, `assets/` or saves outside its own output
  directory.
- **Playwright is pinned** (`playwright` exact version in `package.json`, so the
  Chromium build is fixed). Don't upgrade it in passing; it can move harness
  results and canvas hashes.
- **Start your own server or take a URL.** The harness self-starts Vite through
  its JS API when no URL is given; older probes take `<url>` as the first
  argument. New tools should follow the harness pattern so they run in CI
  without a separate server step.
- **Determinism**: a probe whose output is compared over time seeds
  `Math.random`, fakes the clock and stubs `setTimeout`/`AudioContext` the way
  `tools/harness.mjs` does (see `.claude/rules/sim-determinism.md`). Without
  that, two runs of the same build differ.
- **Every script starts with a usage header** (the existing convention): what
  it measures, `// Usage: node tools/<name>.mjs ...`, and where output goes.
- **Report what was not measured.** If a probe skips a scene, a biome or a
  loadout, it says so in its output rather than silently omitting it
  (`.claude/rules/skill-authoring.md` obligation 3).
- Python tools run with `python3` and the standard library unless a dependency
  is already in use. Asset prep writes only into the asset folders it owns
  (`src/sfx/`, `src/sprites/`, `src/img/`, `assets-raw/`), and generated files
  carry a recognisable prefix (`gen-*.ogg`) so a re-run replaces only its own
  output. Never touch `.ts` source from an asset script.
