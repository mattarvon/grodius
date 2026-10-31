# Decision Log

Project-level decisions for Grodius: open questions only Matt can settle, and what
was decided. Source of the open list: `production/studio-roadmap.md` §3 (studio
onboarding, 2026-10-31). Per-session autonomous-mode decisions go to
`production/session-logs/decision-log.md` (gitignored) — this file is the durable
record.

Fields follow the framework's decision-log format (`.claude/docs/effects-map.md`,
"Decision log format"). An OPEN entry has no **Chosen** yet. When one is decided,
fill **Chosen**, **Reason** and the date, and move it to "Decided".

---

## Decided

### D5 Framework adoption — 2026-10-31

**Decision point:** How to apply Claude Code Game Studios to an engine-less TypeScript game.
**Options considered:** fork every skill for a fourth engine; configure an engine-less profile through `project.yaml` (roadmap §4).
**Chosen:** Roadmap §4 settings — `modes.rigor: minimal`, `modes.automation: guided`, `testing.strict` logic-only, `engine.name` unset with `specialists` → `web-specialist` and explicit `commands`, typed in-code tuning tables instead of external config, screenshot evidence advisory. Unit tests run on **vitest** (`npm run test:unit`, `tests/unit/*.test.ts`) instead of `node --test`: `src/` uses extensionless TS imports that plain Node cannot load, and vitest reuses the Vite pipeline.
**Reason:** Matt, 2026-10-31: "apply the framework to Grodius, make it great."
**Category:** schema_changes

---

## Open

### Now — blocks sprint 1 or the critical path

- **D1 Power rule.** Power only as fire and density, HP only from depth (recommended, matches 48eb7cb) — or rank also raises HP? Does the Gravity Drive keep its rank HP term (`src/boss/update.ts:22`)?
- **D2 One power accounting.** Count all 24 perks and the contraptions toward difficulty in Descent 1? Is the pow-2 fire compression intended? Is the drone `(1+loop)` factor a leftover (recommended: remove)?
- **D3 Photosensitivity.** Flashes default OFF, or ON behind a first-launch prompt? Does OFF remove washes, glitch and flicker (recommended) or cap them?
- **D4 Gate policy.** Does a red `verify` block Pages only, or the APK too (recommended: both, plus manual dispatch for debug builds)? Move tune work to PRs?

### Soon — before sprint 2/3

- **D5b Economy.** What DESCEND DEEPER gives (`deepPay` ignores `lv('deep')`, `src/stages.ts:28`; pinned as current behaviour in `tests/unit/stages.test.ts`). Does an escaped boss pay and count toward seals? Should grade pay more? Which biomass sink?
- **D6 Saves.** One final save-wiping uninstall for stable signing, or ship save export first (recommended)?
- **D7 Licensing.** Licence for code, art, voice; second voice performer's consent and credit; CC BY credits vs CC0 swap; which README asset rule is current.
- **D8 Copy rules.** No-crosses scope; deadpan logs and stage cards; one noun per progression system; banner and spelling fixes.
- **D9 Hype man.** Record the missing takes or go text-only; captions; 20-chain cooldown.
- **D10 Seeded runs.** Are daily seeds or replays a goal? Sets whether the RNG split is required or hygiene.
- **D12 WARD.** One pip absorbs one bullet with i-frames, or keep the 16px soak ring?

### Later — before content or release work

- **D11 Biome bosses.** Shared Maw body with biome attacks (recommended) or distinct bosses?
- **D13 Gross dial.** Internal knob or player-facing option; colour-blind bullet palette?
- **D14 Shop input.** Two-tap buy intended? Desktop click behaviour; confirm on permanent buys?
- **D15 Distribution and target.** Sideload + Pages, or itch/Play; reference device and frame budget (then set `performance.enforce`).
- **D16 Audio direction.** Drone under music, UI synth pass, sliders vs VOICE toggle, music size (38 MB).
- **D17 Art direction.** Bitmap strips vs vector enemies; public `assets-raw` provenance manifest.
- **D18 Canon.** The descent/time-loop explanation, the missing 7 years, the Infirmary in the fiction.
