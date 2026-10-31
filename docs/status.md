# Grodius — Status and Handoff

_Last synced 2026-10-31 19:33 EDT from the Linux laptop (nullx2). `main` is current on GitHub; the vault
mirror is refreshed. Update this file whenever work changes hands between machines._

## Pick up on the home machine

1. `git pull` on `main`, then `npm ci`. New dev dependencies: vitest 5.0.5 and Playwright 1.64.1.
2. Run `npm test`. It runs 17 unit tests, then the regression harness, and both should pass.
3. Start Claude Code from the repo root so the Claude Code Game Studios hooks, rules and permissions load. The
   hooks need Git Bash, Python 3 and jq on Windows.
4. Update `Sync-Vault.ps1` to match `tools/vault_mirror.py`: its `EXCLUDE` keeps the framework's five `docs/*.md`
   files out of the vault.
5. Standing rule: every change gets the full Studio Hierarchy review before it reaches `main` (`CLAUDE.md`,
   "Studio Hierarchy on Every Change").

## Shipped (newest first; details in CHANGELOG.md)

| What | Commit | Notes |
|------|--------|-------|
| Full Studio Hierarchy on every change | `7b1db9a` | `review_mode: full`, `team.size: studio`; rigor stays minimal |
| **M1 "safe and fair"** | `cb67b3e` | Flashes prompt, OPTIONS menu, flashes OFF really off, ≤3 flashes/s, save backup + export/import, drone fire fix, APK gated by CI |
| Framework adapted to the stack | `52ca694` | Engine-less profile, `web-specialist`, vitest, rules and skills for TypeScript/Canvas |
| Sprint 1 | `f0a8c77` | Regression gate, bug bundle, CI `verify` job |

## Play M1 (not yet playtested)

Web: https://mattarvon.github.io/grodius/ · Android: the `latest` release APK. Check:

- **First launch:** a fresh install asks HELL FLASHES ON or OFF before the title menu.
- **Title menu:** it is now DESCEND / INFIRMARY / OPTIONS. This is the change most likely to need your call.
- **Flashes OFF:** no washes, tearing, flicker or hell images. **ON:** the hell image pulses instead of strobing.
- **Descent 2+:** drones fire less, at the documented +45% per descent.
- **Export a save:** keep the code as a backup until there is a stable signing key.

## In progress: M2 "one power rule"

Three studio agents run on the laptop in herdr panes, each in its own worktree. Each branch is pushed:

| Branch | Agent | Scope | State at sync |
|--------|-------|-------|---------------|
| `m2-power` | systems-designer | D1/D2: one power weight table (all perks + contraptions), Drive rank HP, flat-damage scaling, set-piece layouts | working, nothing committed yet |
| `m2-economy` | economy-designer | D5b: honest DESCEND DEEPER text, escaped boss pays no biomass but counts toward seals | working, nothing committed yet |
| `m2-loopfire` | ai-programmer | D2: attacks whose fire scales twice with descent, routed through `src/depth.ts` | **done**: `a1a0ba4` fire probe, `6ba335e` cooldowns scaled once |

**Next:** run the full Studio Hierarchy review on the combined branches (specialists, all eight leads, three
directors), merge to `main`, re-run the probes on the merged build, then update `docs/pacing.md` and `README.md`.
Then playtest M2. If the laptop agents haven't finished, `git fetch` shows how far they got. Unpushed work lives
only in the laptop worktrees (`~/Projects/grodius-m2-*`).

## After M2: M3 "biome bosses"

Acid and snot get their own Maw attack sets (D11), plus a dev jump-to-scenario switch, audio correctness fixes and
the no-crosses copy pass (D8).

## Decisions

`production/decision-log.md`. The delegated batch (D1-D6, D8, D10, D11, D15 localization) is provisional until you
play the milestone it ships in. Overrule any of them and it gets reverted.

**Still yours:**
- D7: licensing and voice consent
- D9: hype-man recordings
- D12: WARD
- D13: gross dial
- D14: shop input
- D15: distribution and reference device
- D16-D18: audio, art and canon direction
- The stable APK signing keystore: add the 4 `GRODIUS_*` secrets

## Where things live

| What | Where |
|------|-------|
| Roadmap | `production/studio-roadmap.md` |
| Audit | `production/studio-onboarding-2026-10-31.md` |
| Design record | `design/game-brief.md` |
| Architecture | `docs/architecture/architecture-overview.md` |
| Stack versions | `docs/architecture/stack-reference.md` |
| Changes against upstream Claude Code Game Studios | `.claude/.ccgs-source` |
