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

### Delegated batch — 2026-10-31

Matt, 2026-10-31: "do it all and commit to the main and let me play it when we get to certain milestones."
Claude took the studio's recommended option wherever the roadmap named one, and a conservative option elsewhere.
Each is **provisional until Matt plays the milestone it ships in** — overrule any of them and it gets reverted.
Not decided (Matt only): D7 licensing/consent, D9 recordings, D12 WARD, D13-D14, D15 distribution (except
localization), D16-D18, and the signing keystore half of D6.

| ID | Chosen | Milestone |
|----|--------|-----------|
| D1 | Power shows up as enemy fire and density only; HP comes from depth (and loop) alone. The Gravity Drive loses its rank HP term too, unless boss-probe shows its fight collapsing. | M2 |
| D2 | All perks and bolted contraptions count toward power from Descent 1 (one weight table). Drone `(1+loop)` double scaling removed. pow-2 fire compression kept. | M1 (drone), M2 |
| D3 | Flashes stay ON by default but a first-launch prompt asks; OFF removes white/red washes, glitch tear and flicker entirely; a ≤3 flashes/s limiter applies in both modes. | M1 |
| D4 | A red `verify` blocks both Pages and the APK. `workflow_dispatch` still exists for manual builds. Work commits straight to main (Matt's call), gated locally by `npm test`. | M1 |
| D5b | DESCEND DEEPER keeps the run-wide double pay but is described honestly as a Descent 2 start. An escaped boss pays no biomass (matches README) but the stage still counts toward seals. Grade pay and the biomass sink are left for a later pass. | M2 |
| D6 | Save hardening plus save export/import ship first; the stable-signing switch waits for Matt's keystore. | M1 |
| D8 | No-crosses covers all cross and halo imagery on player-facing surfaces; logs and stage cards stay deadpan. | M3 |
| D10 | Daily seeds and replays are not a goal; the RNG split is hygiene, done only where it serves the harness. | — |
| D11 | Shared Maw body with biome-specific attack sets for acid and snot. | M3 |
| D15 | Localization: English-only for now. | — |

**M2 amendments (2026-10-31, studio review of the integrated branch):**
- **D1:** the Gravity Drive keeps its rank/over HP terms as the one documented exception. Without them a stacked Descent 1 build kills it in 9.8 s (boss-probe; `design/progression.md`). M3 replaces them with phase structure if both instruments pass (milestone plan Q3). The loop HP weights absorbed the old `over()` term (fodder/mid .8→1.12, boss 1.1→1.5), so light builds and DESCEND DEEPER starts pay ~+18% HP at Descent 2 while typical builds hold. To be measured in the M2 re-measure (bare and rigged kits).
- **D2:** cooldowns are centralised in `src/enemies/cadence.ts`, but **Matt's per-kind depth curves (cb50d04) are kept exactly**. The first pass dropped them and softened Descent 3 fire by ~22%. The creative director blocked that as beyond D2's mandate. Whether deep fire should be softer is offered to Matt in the art-direction picker ("deep fire").
- **D5b:** DESCEND DEEPER's final wording is offered to Matt in the picker (variants that keep "pays double"); the code ships the honest interim text.

---

### D19 Content scale — 2026-11-01 (Matt)

- **Phone:** the game no longer has to be catered to phone sessions, but it must stay playable on a phone (touch controls, readable at phone size, holds frame rate on the reference device).
- **Stage length:** ~90–120 s per stage, classic Gradius length (was ~35 s). A mid-stage checkpoint follows from this.
- **More levels:** all three kinds: new biomes, more stages per descent, and ship-interior stages (non-biome, like Open Orbit and the Drive).
- **Mini bosses:** a pool of 3–4 per biome; a long stage meets two different ones, and repeat runs meet different ones.
- **Supersedes:** game-brief Pillar 4's "phone-sized, about 35 s stages" and the pacing.md stage-length targets. The "never the same twice" half of the pillar stands.

### D19-Q19 Old best grades — 2026-11-01 (default; Matt to confirm)

- Save v3 (LS1-H0) applies spec Q19's recommended default: best grades move to stage-kind keys (`1-orbit`, `1-ice`, `1-drive`); v2's `N-1` becomes `N-orbit`, `N-4` becomes `N-drive`, and the biome-slot grades `N-2`/`N-3` leave `meta.best`.
- **Reversible:** the dropped slot grades are kept in `meta.bestV2` (written, never read), so a different answer to Q19 can still restore them. Asked for by the game-designer in the H0 Studio review; Matt chose "keep them in bestV2" on 2026-11-01.
- Player-visible: a returning player's next clear of a biome stage reads FIRST CLEAR. Carried as a CHANGELOG line when H0 reaches main.
- **Removing `bestV2`:** owner lead-programmer. Trigger: Matt confirms Q19 at the LS1 playtest (build plan item L); then a save v4 drops `meta.bestV2` (or maps it, if he answers otherwise). Caveat: reverting `main` to a build from before H0 drops `meta.bestV2` and `meta.mb` on that build's next save, the one way this stops being reversible.
- **Backlog (not an H0 regression, found in its review):** older load code in `src/save.ts` coerces imported values with `+` (`+d.hi`, `+(d.meta.bio)`, `+(m.cl[id])`) and spreads `d.meta.lv` unchecked; an imported object there can throw mid-load like S3 did. Owner: a later save-hardening pass (engine-programmer).

### D20 LS1-A layout table: rulings — 2026-11-01 (studio review; Matt approved running it)

**Decision point:** Three questions the layout table (`src/layout.ts`, branch `ls1-a`) raised against spec `design/content-expansion.md` §2.2/§3.2.
**Chosen:**
- **The DRIFT forced-exit rule is measured to the next WARNING the player sees** (a miniWarn banner, a row's `warnX` banner, another drift's WARNING), not to the later `G.mini` write. Game-designer ruling; spec wording stands. `tests/unit/layout.test.ts` measures it that way, breath WARNINGs included.
- **The `short` layout keeps its gaps as pinned legacy exceptions**, because it must stay byte-identical:
  - the Saucer's exit is 220 px before "SOMETHING IS COMING" (about 3.7 s);
  - repeat-visit set pieces are 158.9 px and 38.8 px after the breath with the gate taken early;
  - with the gate taken late they are 144.9 px, 280.0 px and 0.0 px.
  - In play, the slot-1 repeat-visit set piece fires within a second of the midboss kill, with no release beat.
  - The pins are known short-layout debt. Matt may ask for a separate short tune story; otherwise `short` is deleted one milestone after the long flip.
- **Beat invariants are checked at both the earliest and the latest gate** (`gateLate` per biome row). Long entries are authored against the late case.
- **hellFlash re-key is neutral:** `layout().hell` is its own kind-keyed table. In `short` it equals the AMT corr/core curves (pinned bit for bit). Real per-kind values come with the long rows (items D/E).
- **Scope deviation:** row A's `perks.ts:48` (`stageXP`) was not re-keyed. It moves to G0/G, which own the economy and list `perks.ts:48`.
- **The parity check stays a manual pre-merge gate** (about 7 min with its third-descent and mortal-bot runs), not a CI job. It is required for any lane touching layout, stages, biomes or scripts. A lane that moves the RNG re-records the baseline with `--update` in the same commit and explains it.

**Reason:** Studio Hierarchy review of LS1-A (3 specialists, 8 leads: all APPROVE WITH NOTES). Evidence: `production/qa/evidence/ls1-a.md`.
**Category:** design_rules

## Open

### Now — blocks sprint 1 or the critical path

- *(delegated 2026-10-31, see the batch above)* **D1 Power rule.** Power only as fire and density, HP only from depth (recommended, matches 48eb7cb) — or rank also raises HP? Does the Gravity Drive keep its rank HP term (`src/boss/update.ts:22`)?
- *(delegated 2026-10-31, see the batch above)* **D2 One power accounting.** Count all 24 perks and the contraptions toward difficulty in Descent 1? Is the pow-2 fire compression intended? Is the drone `(1+loop)` factor a leftover (recommended: remove)?
- **D3 Photosensitivity.** Flashes default OFF, or ON behind a first-launch prompt? Does OFF remove washes, glitch and flicker (recommended) or cap them?
- **D4 Gate policy.** Does a red `verify` block Pages only, or the APK too (recommended: both, plus manual dispatch for debug builds)? Move tune work to PRs?

### Soon — before sprint 2/3

- **D21 Short-layout tune** *(creative-director condition, LS1-A review, 2026-11-01)*. The `short` layout keeps known pacing debt (D20). On a slot-2 repeat visit, a set piece fires within a second of the midboss kill, with no release beat. The Saucer leaves about 3.7 s before "SOMETHING IS COMING". **Default: no tune.** `short` is deleted one milestone after the long flip, and the long layouts build in the Release beat (spec §3.2). **Trigger:** if the long flip slips past the next milestone, offer Matt a separate short-tune story. It moves the harness baseline once, and the short layout's byte-identical parity no longer applies after it.

- *(delegated 2026-10-31, see the batch above)* **D5b Economy.** What DESCEND DEEPER gives (`deepPay` ignores `lv('deep')`, `src/stages.ts:28`; pinned as current behaviour in `tests/unit/stages.test.ts`). Does an escaped boss pay and count toward seals? Should grade pay more? Which biomass sink?
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
