# THE KEEPSAKE: difficulty and interest pass (design proposal)

*Combat team (game-designer + systems-designer lenses), 2026-11-20, worktree `kboss-core` @ f728316.*

> **Status: DECIDED and BUILT (D59, 2026-11-20).** Matt picked **Package C "IT WON'T LET GO" plus Package B's search beam
> in CRACKED only**, and **all four shared fixes**. He left length and difficulty open, so the targets in section 4 apply.
> Built on `kboss-core`. The record, the after-numbers and what was not hit are in `production/decision-log.md` D59.
> Changes from the text below, made while building:
> - The recall runs on its own clock, not as a turn, so it overlaps the attacks.
> - The tug yanks its fork home up its thread. A sweep along the floor was too weak against a ship that never touches
>   the floor.
> - From AWAKE on, the throw is a fan of three.
> - HP is 440 base (D58 not applied).
> - The dodging pilot can't score hits/min: it takes 0 on the Butcher too. Pressure is measured with the park bot and
>   the spot grid (`tools/keepsake-probe.mjs`).

**Matt, after playing `?stage=fire&slot=1&x=boss&kit=mid`:** "super cool looking. was easy as hell to beat. can we ... make
it harder and more interesting. the look is great though."

The art, the fiction and the imply-only line (D46/D53(B)) all stay as they are. This pass changes what the fight
*does*, not how it looks.

---

## 1. What the fight is today (code read: `src/enemies/boss/keepsake.ts`, `_keepsake.ts` KB)

- **HP** 320 x depthHP (`DEPTH.w.keepsake` .6). Phase cuts at 65% and 30%. Damage never carries past a cut (`phaseClamp`).
- **ANGLE rule.** A hit at or above the crown line (head-local y <= -26, or -12 in CRACKED) takes x1. Everything else
  takes x.15, and area hits always count as face hits. The wound hitbox (wy -52, r 14) sits far above the crown line,
  so a horizontal stream level with the wound always does full damage.
- **One attack at a time.** The sequence is idle (cooldown 60 / 40 / 36 f x (1 - .3 rank) x cdm), then the eyes open
  (the tell), then the attack.
  - **DOZING** alternates fountain and aimed throw. The fountain has a 48 f tell, 4-5 forks on a 6-column lattice, and
    a 60 f open window after it. The aimed throw is 46 f (30 f tracking, 16 f locked), then a single fork at 2.6 x BS.
  - **IT WOKE UP** runs 90 f.
  - **AWAKE** runs drop, boomerang, drop, wail. The head rocks +-32 deg on a 220 f cycle. A drop releases 2-3 mobile
    forks (50 f tell each). The boomerang has a 54 f line. The wail is a 12-orb ring at .7 px/f. AWAKE can't end
    before 3 windows have passed (`p2MinWin`).
  - **IT CRACKED** runs 120 f.
  - **CRACKED** runs Fountain II, double cry, rain, double cry. The pendulum weight blocks shots and kills on contact.
    The crier (32 x depth HP) ends the cries when it breaks.
- **"It won't let go."** Each phase has a 25 s clock. When it runs out, the phase is forced on. The last clock's runout
  triggers the enrage (cooldowns x.75, grade capped at B).

## 2. Measurements

Commands run on the worktree's dev server (http://localhost:5173):

| # | command | what it gives |
|---|---|---|
| 1 | `node tools/boss-probe.mjs http://localhost:5173/ 150 --layout long4` | TTK by kit (invincible bot on the wound) |
| 2 | `node tools/harness.mjs http://localhost:5173/ --scenario keepsake-d1` (and `-d3`) | both PASS vs baseline @ 57013d7 (regression only; they script input and don't measure difficulty) |
| 3 | scratch probe `kprobe.mjs` (scratchpad, not in the repo) on Matt's own URL `?layout=long4&stage=fire&slot=1&x=boss&kit=<kit>&seed=<n>` | see below |

The scratch probe has three modes:
- **park:** invincible, moves at the ship's real speed to x 90 level with the wound, never dodges.
- **pilot:** the mortal dodging autopilot `tools/pilot.mjs`, with lives refilled. The boomerang and the mobile forks are
  fed to it as threats, since pilot.mjs can't see them otherwise.
- **spot:X,Y:** invincible, and the ship never moves from (X, Y).

Would-be hits are counted geometrically: each shot once, and each contact (boomerang, mobile, body) once per touch. The
first spot run used the shield to count hits, and a shield eats shots inside 16 px, so it under-counted. That run was
thrown away and redone.

**boss-probe TTK (s):** NAKED 43.3, STAGE 1 kit 25.3, END D1 18.9, STRONG D1 16.0 (floor PASS). Crier broken in 2.9 s.

**Matt's kit (`kit=mid`, rank .26), per phase, seconds and would-be hits:**

| bot | TTK | DOZING | AWAKE | CRACKED | attacks seen (whole fight) |
|---|---|---|---|---|---|
| park, seeds 1-3 | 26.4 | 5.1 s, 0-1 hit | 10.3 s, 1 hit (boomerang) | 11.0 s, 0-1 hit | 1 fountain; 2 drops + 1 boomerang; 2 fountains + 1 throw/rain |
| pilot (mortal), seeds 1-5 | 26.5-27.0 | 0 hits | 0 hits | 0 hits | same |
| park, `kit=bare` | 40.4 | 1 | 2 | 3 | |
| pilot, `kit=bare` | 41.6 | 0 | 0 | 0 | |
| park, `kit=full` | 18.0 | 0.9 s, 0 | 10.3 s, 2 | 6.7 s, 0 | |

- **The mortal pilot: 0 hits, 0 deaths and 0 near misses in 6 fights, naked included.** pilot.jsonl also logged
  0 trapped frames.
- **Park bot (never dodges): about 2 would-be hits per fight, roughly 4.5 per minute.** For comparison, D58's D1 bands
  are 0.8-1.7 per minute for a bot over a whole *stage*. A boss fight should sit well above that.
- **The fight is about 7 attacks in 26 s, one every ~3.7 s, never two at once.**

**Cheese (spot mode: the ship never moves and holds fire), `kit=mid`:**

| spot (x, y) | TTK | DOZING hits | AWAKE hits | CRACKED hits |
|---|---|---|---|---|
| 200, 140 | **20.6** | 0 | 2 (boomerang) | 0 |
| 90, 140 | 28.9 | 0 | 2 | 0 |
| 40, 140 | 29.2 | 0 | 2 | 0 |
| 150, 160 | 27.2 | 0 | 2 | 1 |
| 90, 180 | 30.9 | 0 | 2 | 0 |
| 90, 60 | 36.0 | 0 | 4 | 0 |

**Any mid-height spot is a safe park.** A ship that never moves kills it in 21-29 s and takes 2 hits, both from one
boomerang (out and back). Parking closer (x 200) is *faster* than playing properly. DOZING and CRACKED never hit a
stationary ship at mid height on any spot tried.

## 3. Why it is easy

1. **The fountain threatens one horizontal band.** All its forks land on a plane 6 px below the wound
   (`KB.land`). The "column on the ship's x" fork reaches that plane at the ship's x, so a ship 15+ px above or below
   it is never touched. In the traces, the closest a fountain fork came to a ship at y 100 was 16-20 px.
2. **One attack at a time, with long dead air.** Tell (44-54 f), then the attack, then an open window of 60 f, then a
   36-60 f cooldown. Each beat is fair. Strung together, the fight is a metronome with nothing laid on top.
3. **DOZING ends before it starts.** At `kit=mid` it lasts 5.1 s and shows **one** attack. At kit=full it lasts 0.9 s.
   Its 35% HP share melts while the face tell is still being taught.
4. **AWAKE is gated by the clock, not by the player.** `p2MinWin` 3 x 220 f = 10.3 s at every kit, with 3 attacks.
   The drops fall in the mobile's columns, x ~300-400, and a ship at x <= 200 never stands under the hoop. The
   boomerang is the only thing in the fight that hits a parked ship.
5. **The rings are sparse and slow.** 12 orbs at .7 px/f leave gaps of ~140 px by the time they reach x 90. The double
   cry only halves that gap, and the crier dies in 2.9 s anyway.
6. **ANGLE is solved by sitting level with the wound.** "GO FOR THE TOP" never asks you to *go* anywhere. The wound
   hitbox takes full damage from a plain horizontal stream, and the rocking still leaves 40-50% of AWAKE frames
   damaging. In CRACKED the crown line drops to -12, so the fight gets *easier* as it ends.
7. **The pendulum guards only the space in front of the face.** At range, all it does is eat some shots.
8. **The enrage never happens.** The 25 s clocks never come close against phases of 5, 10 and 11 s, so "it won't let
   go" is never felt.

## 4. Targets (for whichever package; `kit=mid`, Descent 1, D58 off)

| measure | today | target |
|---|---|---|
| TTK, park bot | 26.4 s | 38-46 s (AWAKE >= 13 s, DOZING >= 9 s) |
| would-be hits/min, park bot (never dodges) | ~4.5 | 14-22 (you must move) |
| hits/min, mortal pilot | 0 | 1.5-3 |
| deaths per clear, mortal pilot (lives refilled) | 0 | 0.3-1.0 |
| any fixed spot, any phase | 0 hits/min | >= 6 hits/min in every phase on every spot (no safe park) |
| STRONG D1 floor | 16.0 s | >= 18 s |
| a mortal human on D1 | no hits | about 1 death on a first try, a clean kill within 2-3 tries |

**Fairness rules (all packages):**
- Every new killing threat gets a tell of at least 44 f, the current rule.
- At most two threats are live at once in DOZING, and three in AWAKE and CRACKED.
- A guaranteed gap always stays open.
- Nothing punishes shooting.
- The sleep eyes stay the tell.

**Shared base fixes (any package can take them; they are what kills the cheese):**
- (a) Fountain forks fall through to the floor instead of stopping on one plane. The ship's column then threatens
  every height, and the gap rule still holds.
- (b) Move 10% of HP from DOZING into AWAKE (cuts at 75% / 35%), and give DOZING a three-attack minimum, staged like
  `p2Floor`.
- (c) The crown line stays at -26 in CRACKED, or the CRACKED reward becomes a bigger wound rather than a lower line.
- (d) Clocks drop from 25 s to 18 s, so "won't let go" is something a real player can meet.

---

## 5. Three packages

### Package A: "THE MOBILE TURNS" (a lullaby that drives the fight)
**Fantasy.** The crib mobile is the fight's metronome. The music box winds it up and it turns. While it plays, the head
attacks on its beat. When the box runs down, the head attacks on its own, faster and more ragged.

**Changes.**
- From IT WOKE UP on, the hoop **turns** (seen edge-on). Each fork's x swings sinusoidally across a 160 px band, and a
  near/far scale shows depth. The hanging forks become a moving curtain the ship has to slip through to get above the
  crown.
- **Fling.** On each bar of the box (every 90 f), the nearest fork throws off tangentially. It shudders for 44 f first
  (the drop tell, which is already in the code).
- That gives every phase a **background layer** (the turn plus the flings), with the existing attacks laid over it.
  DOZING gets a slow version: the box is half wound and the mobile sways.
- **CRACKED.** Breaking the crier stops the box (IT STOPPED CRYING). The flings stop, the mobile stops dead, and its
  forks rain all at once on a 60 f tell. After that comes a ragged double tempo (cooldowns x.8).

**Reuses:** `mfork` x2, the hoop render, `kboss_musicbox`, `kboss_mobilebox`, `kboss_chime`, `kboss_snap`,
`kboss_musicend`. **New:** a loopable music-box bed at a fixed tempo with beat markers (sound-designer, procedural), the
render's turn and scale (procedural), and probe support for the mobile's path.

**Risk.**
- The beat must also read with the sound off (phones are often muted). The mobile's sway carries it visually.
- Tempo-locked patterns are easy to learn, so the difficulty fades on repeat plays. Rank can raise the tempo.
- It conflicts with the music duck the box already uses.

**Effort:** medium-high, about 3 lanes (code, audio, render).
**Expected:** TTK 40 s, park bot 15 hits/min, pilot 1.5-2 hits/min, 0.5 deaths per clear.

### Package B: "IT'S WATCHING" (the sleep eyes become a gaze)
**Fantasy.** The doll's eyes open when it sees you. Today the eyes are only a tell. Here they *aim*.

**Changes.**
- When the eyes open, the head **turns its face toward the ship's lane**: the existing rotated ANGLE rule, driven by
  the ship's y instead of the fixed 220 f rock. That hides the crown from wherever you are.
- It **stares**: a faint lane band locks on your y for 44 f, then a volley of 3-5 forks fires down it. The crown is only
  exposed while it **blinks**, the half-lidded doze between attacks, or from an angle it isn't watching.
- In AWAKE, the gaze tracks at a capped turn rate. Strafe vertically and the head lags, opening the crown: a real
  skill test of "go for the top".
- In CRACKED, the **glass eyes on the rocker** take over the gaze. The swinging pendulum sweeps a search beam, and
  wherever it rests a fork rain follows on a 50 f tell.

**Reuses:** `eye_open/half/shut/empty` x5 tilts, `rocker_open/shut` x13, the throw and its line, `keep_clack` (the
"seen" click), `kboss_roll`. **New:** the gaze band and the "spotted" sting (`keep_clack` + `kboss_chime`, or one new
sfx). The doll turning to look at you is the creepiest thing it could do, and none of it needs new photo art.

**Risk.**
- The highest readability risk of the three: a head that dodges your aim can feel unfair or tanky. It needs the turn
  rate capped and a guaranteed blink window.
- pilot.mjs has no gaze model, so the probe needs work to score it.
- TTK could overshoot, because the crown is harder to hit.

**Effort:** high (sim, render and probe).
**Expected:** TTK 44 s, park bot 20 hits/min (staring is lethal), pilot 2-3 hits/min, 0.8 deaths per clear.

### Package C: "IT WON'T LET GO" (it hoards its forks) — **RECOMMENDED**
**Fantasy.** Nothing it throws is ever lost. Forks that land **stick, tines out, in the floor and ceiling**. Then it
**pulls them back**.

**Changes.**
- **Stuck forks.** A fountain, throw, drop or rain fork that lands stays planted, up to 10 at once (the oldest falls
  away). A planted fork is a contact hazard and only sticks up 14 px, so the floor and ceiling bristle without
  closing the lane.
- **Recall** (new; DOZING onward, every third attack).
  - Tell: every planted fork shudders and a thin taut thread shows from each one back to the wound. This is the same
    3 px locked line the throw already draws, held for 50 f.
  - Then they all fly home along those straight lines at once. The ship has to find a gap between converging threads,
    which crosses every height and every x at the same time. That kills the safe park.
  - Recalled forks reload the next fountain, which gains +1 fork per 3 recalled (capped at the lattice's n - 1).
- **AWAKE.** Mobile drops plant as well, so the floor under the hoop fills.
  - **Tug.** Once per cycle, on a 54 f tell, the head yanks one thread and the stuck fork whips along the floor or
    ceiling toward the head: a low sweep the ship has to rise over.
  - The boomerang stays.
- **CRACKED.** Each double cry ("mama") **shakes every planted fork loose upward**: a vertical burst from the floor on
  a 44 f tell (they rattle; `kboss_chime`). Breaking the crier ends that and drops the pendulum's speed. The crier
  becomes a real priority, so the fight has a decision in it.
- **Enrage** (clock 18 s). IT WON'T LET GO really does: recall every 2 attacks, and the cap rises to 14.

**Reuses:** the fork art (`fork`, `mfork`, `keepsake-fork.png`) rotated, the throw's locked line, `keep_tink`
(planting), `keep_whirr` (recall), `kboss_snap` (thread yank), `kboss_chime` (rattle), `keep_throw`. **New:** a planted
fork pose (the same frame rotated, plus a little dirt and blood at the base, procedural) and a thread-tension creak
(one new procedural bank, or `kboss_roll` pitched up). No new photo art.

**Why it's recommended.**
- It is the fiction Matt already chose, "IT WON'T LET GO" (D55 decision 2), made into the core mechanic rather than a
  clock nobody reaches.
- It escalates on its own: the longer you take, the more steel is in the arena. That pressure is a *shape* rather than
  more HP, which is the rule Matt set in 48eb7cb.
- It removes the cheese in the most legible way: every thread is drawn before it moves.
- It reuses more existing assets than A or B and uses the probe as it stands. Planted forks are ordinary contact
  bodies to pilot.mjs, and recall threads are lines, the same shape the pilot already models for the Saucer's lash.

**Risk.**
- Clutter: 10 forks plus threads plus mobile could get noisy. Cap it, and fade old forks.
- On the Fold, planted forks narrow the effective lane. They are capped at 14 px each side, so the gap stays >= 172 px
  (see section 7).
- The recall's convergence must keep a guaranteed gap. Rule: the threads can't cover more than 70% of angles seen from
  the ship's lane, enforced like `forkCols`'s empty column.

**Effort:** medium, about 2 lanes (code with render, and a small audio pass). About 2 probe iterations to tune.
**Expected:** TTK 40-44 s (fix (b) plus a little longer CRACKED, base HP unchanged), park bot 16-20 hits/min,
pilot 1.5-2.5 hits/min, 0.5-0.8 deaths per clear.

## 6. D58 interaction
- If D58 #2 ships (slot B x1.4 in `depthHP`), it multiplies this fight's HP with everything else. DOZING and CRACKED
  stretch about x1.4. AWAKE is window-gated, so it barely moves.
- Today that would mean ~33 s at `kit=mid`. Stacked on a package already at 40-44 s, it would be ~52-58 s, which is a
  tank fight Matt doesn't want.
- **Recommendation:** tune the package with the multiplier off. If D58 #2 ships, divide the KEEPSAKE's base HP by 1.4
  in the same change (D55 already tuned with `HPX`). Either way, the difficulty comes from pattern, not HP.
- D58 #1 (shooter cadence) and #5 (no FULL-pod refill in late fights) don't touch this fight: it is a stage boss in
  slot 1, not slot B. Confirm the slot mapping when D58 is revisited.

## 7. Mobile (Fold) geometry
- The logical screen is 480x254 on the inner screen. Touch is a relative drag at 1.35 gain with autofire, so dodging
  is fast but the thumb covers part of the lower left.
- The arena keeps a gap >= 200 px with the ceiling <= 16. The mobile's tips sit at y 70-76.
- **A (turning mobile):** the moving curtain must not reach below y ~90, or it closes the only way to the crown on a
  small screen.
- **B (gaze band):** it must stay readable at Fold scale and with flashes off. Use a hatch, not a colour-only tint.
- **C:** with 14 px planted forks top and bottom, the gap is >= 172 px. Recall threads at 3 px are already proven
  legible (the D53 review set 3 px for the throw line).
- **All:** new tells must carry visually with the sound muted, and the at-most-two/three-threats rule keeps thumb
  occlusion survivable.
- **The phone's JUMP TO BOSS uses `kit=full`**, where TTK is 18 s today. Probe every package at `kit=full` too, or the
  LAB will read easy again.

## 8. Open questions for Matt
1. **Which package: A (lullaby mobile), B (the gaze) or C (it hoards its forks, recommended)?** Or C with B's
   "the rocker's glass eyes look for you" in CRACKED only.
2. **Take the shared base fixes (a)-(d) regardless?**
   - (a) forks fall through to the floor
   - (b) cuts move to 75/35 with a DOZING attack floor
   - (c) the CRACKED crown line stays at -26
   - (d) clocks drop to 18 s
3. **Target length:** about 40 s at the mid kit (from 26), or keep it near 30 s and get "harder" purely from density?
4. **Deaths:** is about 1 death on a first attempt the right brutality for the end of Descent 1?
5. **If D58's x1.4 returns,** OK to divide THE KEEPSAKE's base HP so the fight's length is set by its patterns alone?

## Appendix: probe caveats
- The pilot doesn't see the boomerang's tell line. It does see the boomerang in flight and the mobile, because the
  probe feeds both in. It reacts to bodies and shots only, so it slightly *overstates* danger. Even so, it took 0 hits.
- park and spot are invincible and count each shot or contact once (no i-frames), so their hit counts are an upper
  bound for a non-dodger.
- All `kit=mid` runs are at rank .26 (unpinned, as Matt's URL). The harness keepsake-d1 pins rank .5.
