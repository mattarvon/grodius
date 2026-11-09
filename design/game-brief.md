<!-- Refreshed 2026-11-07 @ 6ac31b3 (ls1-audit). Previously refreshed 2026-11-05 against main @ 56cdf67 (LS1 sprint 3 merged: two midbosses, resume point, long4 economy). First generated 2026-10-31 by the Claude Code Game Studios hierarchy against main @ 8ce8bdd. -->

# Game Brief: Grodius

<!-- Minimal-rigor design record. It describes the game that already ships on Pages and as a sideloaded APK; it does not propose a new one. Sources: README.md, CHANGELOG.md, docs/pacing.md, design/content-expansion.md, production/decision-log.md, vault hub Grodius.md. Status: DRAFT for Matt's approval. Items marked [PENDING] wait on a decision; [PROVISIONAL] items are in force but wait on Matt's playtest. Key: D-numbers are entries in production/decision-log.md; LS1-LS4 and M2 are roadmap milestones (production/content-build-plan.md); Q2 is a question on the LS1 playtest checklist; LAB is the title screen's row of experimental options; `long4` is the long layout, `short` the old one. -->

**One-sentence pitch:** Gradius on a derelict meat-ship: fly the CHARON-7 tug into the MERIDIAN, shoot through four-stage descents of ice, acid, fire and snot, and grow a disgusting living gunship out of everything you kill.

**Touchstone: Gradius meets *Event Horizon* (1997).** Matt's framing (README: "an Event Horizon aesthetic"). Gradius
supplies the mechanics. *Event Horizon* supplies the world: a ship that came back from somewhere it should not have
been, a gravity drive that opened a door, and a crew who are still aboard, changed. The game already says this:
"TARGET: THE MERIDIAN. LOST 7 YEARS. BACK 9 DAYS.", "ITS GRAVITY DRIVE IS STILL RUNNING.", THE GATE / BEYOND THE
GATE, HELL FLASHES and "HELL IS SHIPWIDE", "THE CREW IS STILL MOVING IN THERE.", "CREWMAN #5 // DECEASED", "THE
MERIDIAN KEEPS WHAT IT CATCHES." For the studio this means:
- **The ship is the antagonist** and the Gravity Drive is the door.
- **Dread comes before gore.**
- **Hell is glimpsed**, in flashes and through the gate, never fully explained.
- **The crew is present** as bodies, remains and logs.
- **Machinery is gone wrong and organic**: cold industrial hardware fused with meat.

*Event Horizon* played straight (pillar 5): only the comms callers and kill banners crack. Art, audio, canon and level
work are judged against that.

**Concept:** A horizontal shooter in the Gradius tradition (capsule power, exclusive main and sub weapons, options, a Big Core-style shielded heart, bosses that leave if you're too slow), played as body horror and as "ultimate gross-out" (Grodius = Gross Gradius, Grodius.md:9). Each run is a series of descents. Each descent is Open Orbit, two biome stages picked at forks, then the Gravity Drive. Stages are Gradius length (D31: ~120-150 s each on long4; they measure 78-104 s today, and the LS2 tune lane stretches them), and the long layout (`long4`) has been the default since D24. The old short descent remains a LAB option until it is removed. The MERIDIAN has been "lost 7 years, back 9 days", and its gravity drive is still running (src/flow.ts:18).

**Player fantasy:** *You become what you kill.* You start as a small rescue tug and end as an ABOMINATION: egg-sac missile pods, a horn cannon, nerve spines, eye stalks and a lamprey maw. Every part on the hull is power you earned in this run, and every bullet you dodge is one you could read through the gore.

## Design pillars
Each pillar comes with a design test. A change that fails its test needs Matt's explicit sign-off.

1. **You become what you kill.** Power is something you can see on the body. Pods, grafts, perks and contraptions each grow a visible part (src/shipform.ts), and grafts are trophies earned from particular enemy types. *Test:* a new power source that doesn't show on the hull is not finished. The ship tier and the difficulty must count power in the same way.
2. **The bullet is sacred.** Gore, washes, glitch and flashes are the spectacle, and they never get in the way of reading hazards. Enemy fire is lime with a dark outline and is drawn on top of everything (src/render/hud.ts:237-305, README.md:52). *Test:* between a grosser effect and a readable bullet, the bullet wins every time. Turning flashes or gore down must really turn them down.
3. **Earn your guns, in the run.** Power comes from capsules, kills and seals within the run. The Infirmary sells options and comfort, never raw power (README.md:102). Skill shows up as grade, score and survival. *Test:* any meta purchase or biomass sink adds choice, convenience or cosmetics, never extra damage. [PROVISIONAL: power shows up only as enemy fire and density, and HP comes only from depth (one power rule, 2026-10-31), with one exception: the Gravity Drive's HP still grows with your power. Midboss HP takes only the descent number, not the depth step within a descent (D29). Confirm at Matt's M2 playtest.]
4. **Classic length, hard, never the same twice.** Stages run Gradius length (~120-150 s, D31) and must stay playable on a phone: touch controls, readable at phone size, and holding frame rate on the reference device (the Fold, a 16.7 ms frame budget, provisional until D15 sets the perf rule). They hit hard, with forks, remixes, elites, two midbosses per biome stage and timed boss phases. Later descents never replay a script you've already seen (CHANGELOG.md, 2026-10-30). *Test:* repetition counts as a bug. A stage's two midbosses are always different bodies, and no picked midboss body repeats within a descent (the recurring Maws are exempt). Content that makes the player meet the same boss or pattern again in one descent is a regression. Known gap: same-biome set pieces repeat ~60% of the time against a ≤50% target, accepted until each biome has 7 pieces (D36).
5. **The ship is evil, and only the comms crack.** The MERIDIAN, its creatures, bosses, gore, art, sound, music and log text play malevolent body horror straight: dark, wet, anatomical, never cartoonish. The one release valve is deadpan gallows humour in the comms callers and kill banners. *Test:* a funny creature, sound, gib or log line is wrong. A funny comms or banner line must be grim, short, and sayable by someone who has seen the bodies.

## Core loop
- **Moment to moment:** fly, fire, dodge readable lime fire, and kill things for splats, chains and hype calls.
- **Stage:** an intro, a build-up, a breather with midboss A, a gimmick, a second breather with midboss B, movement B (~18 s after D31), then a peak (D31 adds a rest breath before each biome climax). Each biome stage also draws set pieces from its biome's set (D35). Beat the boss before its clock runs out, then get a tally with an S/A/B/C grade (on the long layout, an S allows one hit) that pays score and biomass.
- **Run:** pick capsules, perks and grafts, break seals on stages 2, 4 and 6, choose biome forks, and go deeper. Death keeps half your THRUST, and grafts lose a level. If you close the game mid-stage, RE-ENTER on the title returns you to your last checkpoint (the stage start, or just after midboss A).
- **Between runs:** spend biomass in the Infirmary on contraptions, sockets and comfort grafts, then descend again. On the long layout, the first kill of each midboss kind pays +100 biomass, once per profile.

## Player goal & fail state
- **Goal:** get deeper, score higher, beat your best grade on each stage, and grow the full abomination. A session feels complete when you finish a descent or improve a grade.
- **Fail:** losing your last ship ends the run. The Gravity Drive and the stage bosses escape if their clocks run out.

## Protected core (the shipped MVP — do not regress)
- Gradius rules: exclusive SPLIT/ARC and MISSILE/PYRE, WRAITH options, WARD, the fragment economy, and the alternative POWER: METER mode.
- The four-stage descent with biome forks, two different midbosses per biome stage (Open Orbit has one, the Saucer, until LS2; `short` has one per stage), and timed bosses.
- The mid-stage resume point: two checkpoints per stage, RE-ENTER on the title, saved when the app goes to the background (on-device check still open: the Fold app-kill test).
- Midboss fairness: the second midboss never arrives while the first is up, and the fork never offers both the Digestion Tanks and the Sinus in one descent (no three Maws in a row).
- The mutating ship and kill-type grafts.
- Readable enemy fire on top of all gore.
- Touch play on the Fold (relative drag, auto-fire, thumb zone), plus keyboard and gamepad.
- Infirmary meta loop and saved best grades.
- Honest comfort settings: HELL FLASHES, sound, music.

## Out of scope — not building this
- No engine port and no engine-shaped process (Godot/Unity paths, external-config rule for gameplay values; typed in-code tables like `DEPTH` are the standard).
- No multiplayer, online features, accounts, telemetry or live-ops.
- No pay-for-power, in the Infirmary or anywhere else.
- No localization layer. English only. [PENDING: confirm.]
- No store-release work (AAB, ratings, store copy) until Matt decides whether the game ever leaves sideload and Pages.
- No upside-down crosses or other religious iconography as decor or text (Grodius.md:84). [PENDING: the scope of this rule.]
- No per-mechanic GDD ceremony. This brief is the design record, plus a short formulas note for progression.
- No leaderboards or anti-cheat. Quitting and pressing RE-ENTER to undo damage is a known, accepted exploit (D28).

## Build order (current priorities, in vision order)
Content phases only. M3 (fights change shape) and M4 (biome Maws) run alongside LS2 and LS3 (production/content-build-plan.md).
1. **Close the LS1 exit.** Matt's playtest of the long layout and its LAB options: whether dying also restarts at the checkpoint (Q2), whether SURFACE (was ABANDON SHIP; D34 settled the name) fits in play, whether the long layout's ×0.65 biomass rate still buys something at each shop, the Fold app-kill check. Then the measurements still open: hits per minute, grades past Open Orbit, biome wall times against 120-150 s, Descent 2 and 3 biomass, and the Drive fight (40-55 s on the LS1 bot, against 30-45 s). Most need a bot that survives the biomes (in progress).
2. **LS2, midboss pools.** The midboss registry merged in D35's wave 1 (with perf, movement B and the set pieces). Next, the pool lanes (this brief's old "wave 1"): 8 biome midbosses, 2 for Open Orbit (the first gives it a second midboss), 2 for ship interiors. Mechanics go in first; each body's art and name wait on the round-2 cast and idiom answers. Since then: the D31 tune lane is in flight, the Fold reading is due before the D31 merge (D30), and each biome needs 7 set pieces (D36 follow-up).
3. **LS3, ship interiors.** The first interior stage; its art waits on the round-2 meridian answer.
4. **LS4, new biomes** (the Keel, then the Loom): gated on round 2 (meridian, idiom, sound), v1.1 by default.

---
**Who it's for / what they feel:** Adult shmup players (Matt first, then friends) who want hard, punishing, readable runs that still play well on a phone and who want body horror played for keeps. They should feel disgust, pride in the monster they've grown, and the "one more descent" pull.

**Art & audio direction:** A crisp 480x270 pixel world with high-resolution wet eyeballs on top, real JWST and pathology imagery graded toward bruise and flesh, and lime hazards. Gross intensity is a dial (`GROSS`), not a fixed constant.

**Reference game:** Gradius III. Grodius keeps the capsule economy, exclusive weapons, options, the shielded-core boss and the timed boss escape. It adds roguelite descents, forks and grafts. Dying does not restart you at a checkpoint (a LAB option, Q2 still open); the checkpoint is a resume point after you quit.

**Tone guardrails:**
- Horror belongs to everything: creatures, bosses, kills, gore, sound, music, world and ship/sensor text play it straight. Dark humour lives only in comms callers (voice lines and captions) and kill banners: deadpan, grim, no exclamation marks, puns, food jokes, surfer-bro or hype-man cheer.
- Profanity is limited to comms callers only, never system or mechanics copy.
- Gore never covers, moves or recolours a hazard. Ambient particles never use the lime bullet signature.
- No real-world religious symbols as shock material.
- Nothing that targets real people. Voice performers must consent, and credits must be right.
- The flashing and gore warning must match what the game actually does, and the OFF settings must do what they say.
- Crude, not cruel: keep the humour to bodily fluids and gallows humour. Slurs don't count as a joke.
