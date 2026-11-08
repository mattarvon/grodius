# LS2 wave 2 · lane ls2-read · "choices you can read" + tone worklist A

Lane brief: D38 item 1 (render, audio and docs only), plus the parent's addendum for D39 (tone worklist A, Pillar 5).
Branch `ls2-read`, off main `abf85c1` (with D38 at `804a014`). **The sim does not move:** harness and parity results below.

## What changed

### 1. Gate plates show the stakes (`src/render/gateplate.ts`, new; `drawGates()`/`drawPlate()` in `src/render/biomeart.ts`)
- Each plate gains a third line naming the biome perk the gate leads to. Three states, from the fields that drive them:
  - **unlock** (biome not yet cleared): `UNLOCKS IMMOLATION`. The verb is drawn in tag grey and the perk name in mutation gold, so THE SINUS's yellow name and the gold don't merge into one yellow block.
  - **known** (biome in `G.visited`): `IMMOLATION: KNOWN`, light grey `#b0bccb`.
  - **spent** (perk at max): `IMMOLATION: FULLY GROWN`, grey `#8a98a8`.
- A repeat visit (`G.bvis[b] >= 1`) gets an **`ALTERED`** chip in the biome colour on the name line. One state only: a REVISIT ("entered but not cleared") can't reach a gate in real play (ux-designer, `plate.md`).
- Plate 22 → 32 px tall, fill `rgba(0,0,0,.85)`. Every line is 8 px, the Fold floor for decision text. It slides left with a 1 px leader line when it would hit the countdown box. It is hard-edged and no longer pulses with the gate.
- No midboss names or silhouettes (D38 item 3 waits for fix merge 1).
- Pure, import-free module, so it is unit-tested. Results are cached per fork, gate and `pk` level, so a frame allocates nothing; drawing reads `$.G` and never writes it.

### 2. Remix visits look damaged: wound states (`src/render/wounds.ts`, new; `biomeart.ts`, `gore.ts`, `warmplan.ts`, `render/warmup.ts`)
- A slot with `G.visitNo[slot] >= 1` draws its biome's wound. The look table lives in render code, not `biomes.ts`.
  - **Ice, thawed:** slumped ridge, sagging shards with blood runnels, aurora gone, snow drawn at .3.
  - **Fire, burnt out:** dead furnace mouths on coal beds, ash heaps with partial remains, falling ash.
  - **Acid, drained:** empty vats with a teal tide line, tissue smears and bones on the tank floor, no bubbles.
  - **Snot, infected:** dark red-ochre mucosa, torn abscess slits with dim pus cores.
- Each biome keeps its identity colour. The lime band is banned by test.
- A remix gate's portal shows the wound, using only an already-built layer.
- Two extra 320×254 layers per biome (about 2.6 MB for all four), seeded by an FNV hash of the full key. `lay()`'s seed would collide here (`iceFarW` = `iceMidW`).
- The layers warm through `warmPump` (never inside a WARNING) once `bvis >= 1`. Slices measured at 4× CPU throttle are 0.0-1.9 ms. Until a wound is built the stage draws its normal look, so nothing ever bakes in a frame.

### 3. Audio (`src/audiomix.ts`, new; `src/music.ts`, `src/audio.ts`)
- **Midboss and boss intensity in biome stages.** `musicIntensity(G, biome, state)` returns 0, 1 or 2. It reads flags (`mini.mid`, `stageBoss`), never kinds, so new pool kinds get the midboss level for free. Open Orbit and the Drive are excluded.
  - It drives a separate layer after the biome filter: lowshelf, then an 800 Hz presence peak, then drive, then gain. The drive has makeup gain, so quiet passages don't jump when the curve engages (sound-designer's ice finding).
  - It also drives the drone bed (detune, Q and gain), because `fx/update.ts` owns the drone's frequency.
  - **`wanted()`, `mixWanted()` and `musicPlan()` are unchanged**, so parity's music record holds.
- **Kill sounds per biome.** `BIOME_KILL` replaces the snot-only branch:
  - ice plays `gicecrack`; fire plays `gsizzle` on big kills only; snot plays `snot`, now without the Jello clips;
  - acid plays a synth falling hiss over a sour beating pair (a `gfizz` clip set is a follow-up);
  - the layer plays only at 10 voices or fewer, with a 90 ms throttle, using `ar()` only.
- **Drone bed per biome:** a filter only, no root-pitch change.

### 4. Paper spec for the choice lane (`design/choice-spec.md`, new)
- **Authors:** game-designer drafted it, then systems-designer and economy-designer revised it.
- **Covers:** perks with costs (5 new two-sided cards, `fuse` cut, GLASS JAW priced), build-aware offers (every dead-card condition, the partner table), the midboss pod pick (a targeting choice, not a priced one), the seal unlock choice, and fork pay. Each section lists its pillar, tables, probe, Fold UI and harness impact.
- **At-risk biomass** is a MATT DECISION with options A-E.
- **`/design-review` (full):** 5 adversarial specialists plus a creative-director synthesis, verdict **NEEDS REVISION**. game-designer then applied every spec fix, and the Matt decisions were rewritten as clean questions in §7. A re-review is pending.

### 5. Tone worklist A (D39, Matt-approved `tone.md`)
- **A1:** the midboss greybox (`render/gross/mid/_greybox.ts`) is a dark, angular, asymmetric mass with no eye. Its telegraph is a seam that splits open to wound red and lights the room. `src/CLAUDE.md` is updated.
- **A2:** lime is out of `cyst.ts` (now bile ochre and a tallow telegraph). The pink gut rope in `gore.ts` is now dark wound red.
- **A3:** `silly` is shelved to `src/sfx-shelved/` and its call is removed.
- **A4:** re-voiced:
  - `pick` and `power` are falling minor-2nd/tritone figures on low-passed saws;
  - the stage clear gets a dark G2/G#2 swell through a new `sfx.stageClear()`, the only change in `stages.ts`;
  - `alarm` is a beating 220/233 Hz pair;
  - the hype sting goes from ×1.335 to ×1.0595;
  - `tele`, `chain`, `tink`, `menu` and `drip` are darkened and kept under about 1.1 kHz.
- **A5:** the Jello clips are out of `snot`. Title-menu navigation plays `gross_pop` and `splat_s` instead of farts.
- **A6:** interim music runs at rate .94 with a 3 kHz lowpass and +.12 drive (with makeup gain).
- **A7:** `hell-yeah`, `sfriend` and the unplayed second SHAMALAMA copy are shelved, with README rows. The surfer flyby and its bubble are cut, so the 20-chain calls `hype(20)`.
  - **The TTS fallback is deleted** (`say()` in `audio.ts`). The empty-bank check found that the bank was not silent: it would have spoken "hell yeah brother" through speechSynthesis. An empty bank is silent now.
  - The corpse line and LESLEY's "yeah baby" are kept.
- **A9:** copy, as string-only edits: the acid and snot logs, two perk flavour lines and "cough a piercing glob", the free-graft toast, the CHANGELOG known-issue line (merged so "spires" appears once), and the matching lore note in `production/levels/ls2-mv/lore.md`.
- **Held until fix merge 2 is on main** (parent's instruction): every midboss and boss rename, the kill words, the kill banners and the stage subtitles.
  - **Why:** parity records `G.mini.title`, and the warm-up WARNING gate keys off banner text.
  - **Exact list:** `roster.ts:59` and the SQUIDFUCKED sites (THE DROWNED LANDER); `biomes.ts:35,38`, `hud.ts:27` and the BLOATED sites (THE BLOAT); `ufo.ts:168` (SEVERED); `enemies/update.ts:642` (TAKEN DOWN); `fx/update.ts:222` (CARN MESSY → OPENED); `fx/update.ts:250-255` (the kill banners); `biomes.ts:73` (snot `sub`, IT IS BREATHING. YOU ARE IN THE AIRWAY.).
- **Pillar 5** is rewritten in `design/game-brief.md` at :35 and :83, with follow-ons at :21, :76, :78 and :84. **D39** is added to `production/decision-log.md`.
- **The lane's own items follow `tone.md`:**
  - the wounds are in the bottom third of the value range, with no pink or neon and 2-3 threat-supplied lights;
  - the plate copy is a cold readout, with `ALTERED` replacing `REMIX`;
  - the kill layers and intensity sit in the 200 Hz-1 kHz menace band, and the fizz lost its bubble pops;
  - two choice-spec card flavour lines lost their jokes.

## Agents used, and what each did

| Phase | Agent | What it did |
|---|---|---|
| plan | ux-designer | Plate spec (`plate.md`): states, geometry, the slide rule, the Fold floor, the contract, 15 test cases. Later an adversarial review of the choice spec's Fold UI. |
| plan | art-director | Wound-state direction (`wounds.md`): look table, trigger, budget, contrast rules, the `lay()` seed bug. Later signed off on wounds, gate and plate. |
| plan | audio-director | Audio spec (`audio.md`): intensity layer, kill table, drone bed, the parity-safe design. Later tone self-check (darker values, fizz recipe) and review of A3-A7 (one `tink` value change). |
| plan | game-designer | Drafted `design/choice-spec.md`. Later an adversarial review, then the revision after `/design-review`. |
| plan | systems-designer | Revised spec §1, §2, §4 (card maths, draw count, the RUN_V trap). Later an adversarial formula review. |
| plan | economy-designer | Revised spec §3, §5, §6 (pod-pick income, fork-pay faucet A → A′, option D). Later an adversarial faucet review, which found a possible live exploit (below). |
| plan | writer | Plate copy picks; tone self-check of the plate copy and the spec flavour lines; the A9 copy edits. |
| plan | narrative-director | Ruled the plate copy (`UNLOCKS`/`KNOWN`/`FULLY GROWN`, then `ALTERED`); approved A9; re-pointed the lore note. |
| plan | accessibility-specialist | Fold review of the plate: the contrast blocker (spent grey 2.1:1 over the glow), the 7 px smear, the SINUS gold clash. |
| build | ui-programmer | Built `gateplate.ts`, `drawPlate`, `gateplate.test.ts`, `tools/gateplate-shots.mjs`, with the copy, a11y and art fixes. Deleted the shared evidence folder's PNGs once (22:17); every PNG was retaken. |
| build | technical-artist (1) | Built `wounds.ts`, the biomeart wound paths, the warm units, `wounds.test.ts`, `tools/wound-shots.mjs`. Tone, gore and darkness passes; art and perf fixes (C1, C2, snow, ash, acid floor shot). |
| build | technical-artist (2) | A1 greybox, A2 cyst lime and gore pink, `tools/greybox-shots.mjs`. |
| build | gameplay-programmer | Built the audio item (`audiomix.ts`, music and audio layers, `audiomix.test.ts`). Then A3-A7: shelving, re-voicing, TTS removal, menu nav, interim music. |
| check | sound-designer | Reviewed the audio build: the fizz recipe values and the ice drive flag. The parent fixed the flag with makeup gain. |
| check | performance-analyst | Warm-up and phone cost: PASS with 4 low concerns; C1, C2 and the font strings fixed. Not re-measured (Tctl 82.8 °C, no wound scene in perf-probe). |
| check | qa-tester | Reviewed the three new test files (all ADEQUATE); added 9 tests and replaced pinned values with table references. |
| check | web-specialist | Diff review. 1 blocker: the 20-chain's call window could move the harness gib count; settled by the harness run below. 3 should-fix, all applied: SHAMALAMA copy shelved, `stageClear` binding, dead-code notes. 3 nits: font strings fixed; the `applyBed` key string left (one small string per step). |
| review | (design-review) game-, systems-, economy-designer, qa-lead, ux-designer, creative-director | Full `/design-review` of the choice spec. Verdict NEEDS REVISION; fixes applied. |

The parent also made some changes directly: the drive makeup gain (`clipGain`, `driveMakeup`), splitting `stageClear` out of `power()` (so the swell no longer plays on every buy and confirm), the table-driven fire-shelf test, the `stageClear` sfx mocks, the Pillar 5 and D39 docs, the CHANGELOG merge, and the `src/CLAUDE.md` greybox text.

## Screenshots (`production/qa/evidence/ls2-read/`, desktop 960×540 and phone or Fold 832×384 @2.6)
- **Gate plates:**
  - `plate-01-first-visits` (and `-late`): two UNLOCKS plates.
  - `plate-02-remix-known`: an `ALTERED` plate with KNOWN, next to the widest UNLOCKS line, with the wound portal.
  - `plate-03-spent`: FULLY GROWN, next to the SINUS UNLOCKS plate (grey verb, gold name).
  - `plate-04-squeezed` (and `-late`): slid plates with leader lines.
- **Wound states:**
  - `wound-<ice|acid|fire|snot>-<normal|wound>`: each biome normal against wounded.
  - `wound-*-bullets` and `wound-acid-bullets-floor`: lime volleys over the wounded scenes.
  - `wound-gate`: a remix portal.
- **Tone:** `tone-greybox-calm|half|tell`, `tone-cyst`, `tone-cyst-tel`, `tone-gore`.

Wound probe (background only, conservative):

| Biome | Worst 32 px column, wound / normal (≤ 1.15) | Bullet contrast (≥ 4.5:1) |
|---|---|---|
| ice | 1.14 | 7.1:1 |
| acid | 0.71 | 6.9:1 |
| fire | 0.59 | 9.0:1 |
| snot | 0.75 | 7.6:1 |

## Gates
All run on the final tree; the logs are in `production/qa/evidence/ls2-read/` (`typecheck.txt`, `vitest.txt`, `build.txt`, `regress.txt`, `parity.txt`).

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npx vitest run` | 39 files, 889 tests, all pass (new: `gateplate`, `audiomix`, `wounds`) |
| `npm run build` | exit 0 (the existing chunk-size warning only) |
| `npm run test:regress` | **PASS, no `--update`**: short @ 8ff9ba4, long4 @ 88d9525, and all 12 scenarios (orbit, saucer, breath2, drive, maw-d1/d3, drive-d1/d3, crux-d1/d3, butcher-d1/d3). `sig`, `seen` and `st` are identical. Canvas hashes differ, which is advisory and expected from a render lane. |
| `node tools/layout-parity.mjs` | **PARITY PASS**: runs 3, 6, 7, 11, 15, 3x3 and 7m identical, including the `musicPlan` record. |

This also settles web-specialist's 20-chain blocker: the harness `st` (gibs included) is unchanged with `hype(20)` in place of the flyby.

## Not measured
- Nothing has been heard on a phone speaker.
- **Ear check for Matt:**
  - biome midboss and boss intensity, and the 3 s release;
  - the four kill layers, including the acid synth;
  - pick and power figures, the stage-clear swell, the 220/233 alarm, tele under fire, tink, chain, menu, drip;
  - the sour hype sting at 10 and 20;
  - the title-menu pops, and music at .94 through 3 kHz;
  - an empty voice bank stays silent.
- No real device: Fold readability and warm-slice times are from viewport emulation and 4× CPU throttle only.
- Biome slot 1 and Descent 2+ wound scenes were not shot. A normal-look pixel diff was not taken; it is unchanged by construction, since every normal expression is kept.
- The greybox is staged: no kind uses it yet.
- Perf-probe has no remix scene; the wound slice timings come from the builder's in-page measurement.

## Stubs and open risks
- **Fix lane:** in a squeezed fork the `THE SHIP SPLITS` banner covers the top plate for its first ~2.7 s of 15 s (`plate-04`). The banner is fired by `biomes.ts` `openFork` and drawn by `hud.ts`, both outside this lane. Proposed fix: plates win, so hold or offset the banner while `G.fork` is open.
- **Fix lane, verify now (economy-designer, creative-director):** possible live exploit. `meta.bio` banks the moment biomass is earned, but the run save stores `G.bio`, so quit-and-resume may replay a stage and re-bank first-kill and SURPLUS pay. Not traced through load; reproduce it first.
- **Matt:**
  - `fart_ok` is still played by `render/gross/drive.ts:660,737`, `maw.ts:339,1057` and `mid/ufo.ts:606`. :737 is "Matty's raspberry" on a boss death, which breaks Pillar 5. audio-director recommends swapping it (string-only).
  - The Open Orbit skyline's neon magenta and pink breaks `tone.md` (worklist B1).
  - Acid's ambient lime bubbles (`biomes.ts` ambient) still draw lime in normal acid stages; worklist B.
  - The cyst's membrane is still mauve-pink with a front skull and eye holes; worklist B3.
- **Dead code after the TTS cut, left for the owners:** `platform.ts` `nativeSay`, the babe bubble in `render/hype.ts`, the `$.G.babe` countdown in `fx/update.ts`, and the `@capacitor-community/text-to-speech` dependency (technical-director's call).
- **`gfizz` acid kill clips** are a follow-up (`tools/gen_bossgross_sfx.py`); the synth covers acid until then.
- **The choice spec** needs a `/design-review` re-review, plus Matt's answers to its §7 (Q1 which "linear", Q2 fork pay, Q3 seal stakes, Q6 BLOOD MONEY price, Q8 at-risk biomass).
- **A `wip` kind's greybox** now reads differently. `src/CLAUDE.md` is updated to match.

## Merge-order notes
- **Files touched by string-only edits:** `biomes.ts`, `perks.ts`, `menus.ts`, `fx/update.ts`. The `fx/update.ts` edit is also a small logic change (the 20-chain): web-specialist reviewed it, and the harness is the proof. Rebases against D31 and the fix lane should be trivial, because the edits are string literals plus the `audio.ts` imports.
- **`stages.ts`:** one call changes, `sfx.power()` → `sfx.stageClear()`.
- **After fix merge 2:** apply the held renames list above in one commit. It moves parity (midboss titles), so re-baseline then, with that as the explanation.
- **`src/render/biomeart.ts`:** large hunks (wound paths, `drawPlate`). Any lane editing biome rendering should rebase onto this one.
