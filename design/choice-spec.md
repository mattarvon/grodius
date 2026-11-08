# Choice lane: paper spec (D38 item 2)

Status: **revised after `/design-review` (2026-11-07, NEEDS REVISION); re-review pending.** game-designer wrote it in lane ls2-read item 4; systems-designer and economy-designer extended it. Rigor: minimal, so this sits beside `design/game-brief.md` rather than in `design/gdd/`.
Lands: **after D31 merges**, as one batched "choice" lane (producer, D38). Each item is fitted against D31's measured pick count and biomass band, not today's numbers. Bands quoted below are today's (`src/economy.ts`); where D31 re-fits one, D31's number replaces it.
Source: D38 and D31 in `production/decision-log.md`, and the crew notes (creative-director package B, systems-designer 1-2, economy-designer 1-4, game-designer 2 and 4).

**The rule for every item: add prices and decisions, not volume.** Every item here either puts a price on power the player already gets, or turns a free drop into a choice. Where an item adds faucet anyway (§3 SURPLUS, §5 MEAT), it says how much and caps it.

## 0. Shared reference

**Pillars** (`design/game-brief.md`): P1 you become what you kill · P2 the bullet is sacred · P3 earn your guns, in the run · P4 classic length, hard, never the same twice · P5 the ship is evil, and only the comms crack.

**Pick counts (stated once; every section uses these).** Perk offer: 3 cards (unchanged). Stage-boss pick: 3 caps (unchanged), 4 only under §5 option D's `PICK` tag and only when ≥ 4 slots are unmaxed, else one per unmaxed slot. Midboss pick (§3): 2 caps, 1 when one slot is unmaxed. Seal pick (§4): 3 keys, fewer when fewer are eligible.

**Bands (file:symbol).** Biomass per descent `src/economy.ts:BIO_LONG` = D1 [1300, 1500], D2 [2100, 2400], D3 [2600, 3600]. LV at the end of D1 `ECON.long4.targets.lvD1` = [12, 14] (long5 [13, 15]). No D4-D5 bands exist.

**Probes.** Existing (`tools/`): beat, boss, density, depth, dps, fire, hazard, kind, meter, midboss, perf, pod, rig, rng, route, ship, shop (`*-probe.mjs`), `layout-parity.mjs`, `harness.mjs`. The standard balance run, used wherever an AC says "the pod run":
`node tools/pod-probe.mjs http://localhost:5173/ <seed> 12 1 --layout long4 --mortal --pilot` for seeds 1-5, read as the median (12 minutes, end after Descent 1; `endLoop` 3 where an AC reads D2-D3). Every probe mode or output field marked **NEW** below does not exist yet and is part of the lane's work.

**Harness and parity.** Perk, pod and seal code is layout-agnostic, so §1-§4 can move every harness baseline. The harness flies a fixed frame budget and may never reach a perk pick, seal or midboss on some baselines, so "moves" is a claim to check, not assume. **Required in the lane's commit:** for each of the 14 baselines (`tools/harness.baseline.json` (short), `harness.long4`, `breath2`, `butcher-d1`, `butcher-d3`, `crux-d1`, `crux-d3`, `drive`, `drive-d1`, `drive-d3`, `maw-d1`, `maw-d3`, `orbit`, `saucer`) and `layout-parity`, record moved / unchanged and why. A section whose code moves **no** baseline gets an integration test in `tests/integration/choice.test.ts` (**NEW**) that drives the changed path. Each move gets one explained re-baseline (`.claude/rules/sim-determinism.md`).

**Fold UI basis.** The canvas is 480x270 logical px, and the Fold scales it about 4x. "≥24 px" means 24 logical px, the gate capture radius at `biomes.ts:482`. **Anything the player decides by is ≥ 8 px text.** 7 px survives only on existing lines (perk COST, flavour); this spec adds no new 7 px text.

**Sizes:** S ≤ 1 day, M 2-3 days, L ≥ 4 days of lane time, excluding lock-days for re-baselines.

---

## 1. Perks with costs

**Today.** 24 perks, and 2 of them carry a price: GLASS JAW and TAPEWORM (`c:` field, `perks.ts:36-37`). The pick screen already draws a red **BLOOD PACT** tag and a `COST:` line for any card with `c` (`hud.ts:612, 634-636`), so a new two-sided card needs no new UI.

### 1.1 New two-sided cards (5)

Every new card is `max: 1`. `fuse` (FUSED SOCKETS) is **cut**: its gain was hidden maths that didn't fit the 4-line card. Bench card if one of the five fails: `stomach` SECOND STOMACH (+60% biomass / -15% damage), which would fall under the biomass cap in §5.

| id | name | flavour (`f`) | gain (`d`) | price (`c`) | w | POWER.perk | build it feeds |
|---|---|---|---|---|---|---|---|
| `bloat` | BLOATED HEART | it beats slow. it beats hard. | +40% damage, every gun | -25% fire rate, every gun | 5 | .5 (net DPS x1.05) | per-hit builds: pierce, VOLATILE, crit |
| `strip` | STRIPPED HULL | it was only ever padding | +16% ship speed, hitbox 20% smaller | half invulnerability, always | 5 | .4 (≈ `spd` x2 + `tiny` x1, less the price) | dodge and graze builds |
| `splay` | SPLAYED RIBS | the ribs part. teeth wait. | +1 orbiting tooth, teeth chew 50% faster | hitbox 25% bigger | 6 | .6 (teeth DPS x2.25-3) | ORBITING TEETH (`need: 'teeth'`, §2) |
| `nerve` | RAW NERVE | everything touches you now | near-misses: +25% fire rate for 1 s | hitbox 20% bigger | 5 | .4 (≈ +10% fire rate at ~40% uptime) | GRAZE NERVES, `strip` |
| `lung` | BORROWED LUNG | it was someone else's | +2 ships, now | each death takes all THRUST and 2 graft levels | 4 | .3 | the long run, at higher risk |

**Exact rules** (what each `d`/`c` string means in code):

| card | gain, exactly | price, exactly |
|---|---|---|
| `bloat` | `dmMul` x1.4 (F1.1): main gun, MISSILE, PYRE, snot glob and rib shards. Teeth (`1+.1·dmg`) and slicks do not | main-gun `rate` x.75 (`player.ts:179`) and MISSILE/PYRE cooldowns ÷.75 (`:262, :296`). Snot, teeth and shards keep their cadence |
| `strip` | speed term +.16 (F1.3). Hitbox term -.2 (F1.2) | every invulnerability grant x.5 (F1.4): WARD hit (`player.ts:150`), death respawn (`flow.ts:214`, 160 → 80), checkpoint restore (`checkpoint.ts:CP.inv`, applied `flow.ts:146`, 280 → 140) and descent start (`flow.ts:183`, 150 → 75). LAST GASP's 120 (`perks.ts:237`) and the boss-kill 9999 are unchanged |
| `splay` | tooth count `n = pk('teeth') + pk('splay')`, spaced `TAU/n` (identical to today for n ≤ 2). Chew cooldown 15 → 10 frames (`perks.ts:199`) | hitbox term +.25 (F1.2) |
| `nerve` | any near-miss (the 14 px graze test, `shots.ts:232`, now run when `graze` **or** `nerve` is held) sets `G.nerveT = 60`; while `> 0`, main-gun `rate` x1.25. Graze XP and score still need `graze` | hitbox term +.2 (F1.2) |
| `lung` | `G.lives += 2` in `take()` | on death, `resetPlayer(true)` keeps 0 THRUST (today `floor(speed/2)`, `flow.ts:203`), and the wither (`flow.ts:274`) takes 2 levels per graft (F1.6). The THRUST half makes the price real with no grafts held |

Why the price is at death, not up front (game-designer R6 not adopted): a ship's value is only realised at a death, so the price lands at the same moment. Taking all THRUST makes every death after the pick cost more, grafts or not.

Voice check (P5): each flavour line is cold, short, lower case and bodily, and none jokes or explains itself.

### 1.2 Existing cards that become two-sided

| id | today | proposed price | why |
|---|---|---|---|
| `greed` BLOOD MONEY | +30%/lv biomass, free | **pending Q6** (default: `-6% damage per level`) | P3's purest trade, meat against guns |
| `glass` GLASS JAW | +35% damage / WARD ≤ 1 hit | **adds "half invulnerability, always"**, the same price and rule as `strip` (F1.4) | today its price is zero until WARD is worn (`player.ts:320` only clamps a shield), so before the first WARD pod it is the best card in the pool |
| `life` SPARE MEAT | +1 ship, w 2 | **stays free** | a rare gift at weight 2. `lung` is the priced version |
| `teeth`, `spd` | free | **stay free** | `splay` and `strip` carry the price on the build line, so the base card stays an easy first step |

Implementation note: `c` is a string today, and `perkCost(id)` takes no level. A per-level price (BLOOD MONEY) needs `c` to accept `(l) => string`, with `perkCost(id, l)` and the `take()` feed line updated.

### 1.3 Offer rule: one heavy card from stage 2

From the second stage (`G.cleared ≥ 1`), every offer holds at least one heavy card if the pool has one. Without this, 3 flat cards win most offers (flat w 7-8 against 4-6).
- **Heavy set** `H` = cards with `c`, the `// build-definers` block (teeth, trail, shard, gasp, glass, tape), biome perks, and the 5 new cards.
- If the `boostReq` card was placed (a biome perk), the rule is met and the offer runs as today. Otherwise the **first** weighted draw is over `pool ∩ H` (weights `w'`, F2.1); the rest are over everything left. If `pool ∩ H` is empty, the offer runs as today.
- Draw count is unchanged (F2.3). Only which subset the first draw reads changes.
- `dmg`/`rof` stay at w 8. Lower both to 6 only if the pod run with **NEW** `--offers` shows `dmg + rof` above 40% of D1 picks.

### 1.4 Formulas

All read `pk()` (0 or the level) and are pure functions of `$`. `[x]` is 1 if x is held, else 0.

| id | expression | variables (range) | output range | worked example |
|---|---|---|---|---|
| F1.1 `dmMul` | `(1 + .1·dmg) × (1 + .35·[glass]) × (1 + .4·[bloat]) × (1 − .06·greed)` | dmg 0-3, greed 0-2, glass/bloat 0-1 | .88 (greed 2 only) to 2.457. Today's max 1.755. Never ≤ 0 | dmg 1, bloat, greed 1: 1.1 × 1.4 × .94 = 1.448 |
| F1.2 hitbox `hb` | `clamp(1 − .2·tiny − .2·[strip] + .25·[splay] + .2·[nerve], HB_MIN, HB_MAX)`. Bullet test: `s.r + 2.6·hb`. Body test: `e.r + 4 − 6.5·(1 − hb)` | tiny 0-2, others 0-1. `HB_MIN .5`, `HB_MAX 1.45` | .5 to 1.45. Reproduces today's `tiny` exactly (`shots.ts:258, :315`) | tiny 1 + nerve: hb 1.0 |
| F1.3 speed | `(1.25 + .42·thrust) × (1 + .08·spd + .16·[strip]) × slow` | thrust 0-5, spd 0-3 | factor 1.0 to 1.40. Top 4.69 px/frame at THRUST 5 | spd 1 + strip, thrust 2: 2.09 × 1.24 = 2.59 |
| F1.4 invulnerability | `INV_HALF = .5^([strip] + [glass])`. WARD hit: `round(18 × (1 + .5·inv) × INV_HALF)`. Death respawn `160 × INV_HALF`, checkpoint restore `280 × INV_HALF`, descent start `150 × INV_HALF` | inv 0-2 | WARD hit 5-36 f; respawn 40, 80 or 160; restore 70, 140 or 280 | inv 1 + strip: 13.5 → 14 f. strip + glass: respawn 40 |
| F1.5 main-gun rate | `1.25^rapid × (1 + ROF[rof]) × (1 − .25·[bloat]) × (1 + .25·[nerveT > 0])`, `ROF = [0, .08, .15, .21]` | rapid 0-2, rof 0-3 | .75 up to 2.36. MISSILE/PYRE cd ÷(1 − .25·[bloat]) | bloat + nerve burst: .75 × 1.25 = .94 |
| F1.6 graft wither | `gm[k] = max(0, gm[k] − (1 + lung))` per death | lung 0-1 | 0 to 2 levels per graft | GLUTTONY 2 + lung: one death empties it |

Net DPS check: `bloat` 1.4 × .75 = **1.05** against `dmg` I's 1.10 free, so it wins only where per-hit size counts (pierce, crit, armour) and loses on 1-hit fodder. With `nerve`'s burst, bloat's rate is .94, so the pair still pays a rate price plus nerve's +20% hitbox (systems R4). `lung` (+2, priced) against `life` (+1, free) is a real choice. `strip` against `spd` II + `tiny` I trades one pick for a permanent invulnerability cut. `glass` before WARD now costs half invulnerability.

### 1.5 Card copy budget

The card is 142x112. Description lines start at `y+43`, 9 px apart; COST adds a 3 px gap; the flavour sits at `y+ch−27` (`hud.ts:632-640`). So **gain + COST ≤ 4 wrapped lines** (≈ 25 characters a line in 128 px). `lung` is the tightest at 1 + 2. AC1.4 is the check.

| Pillars | Tables (file:symbol) | Probe | Fold UI | Harness / parity | Size |
|---|---|---|---|---|---|
| P1 (each card grows a part, `shipform.ts`), P3 | `src/perks.ts:PERKS` (+`need` field), `src/power.ts:POWER.perk`, `src/mutations.ts:dmMul` (F1.1), `src/player.ts` (F1.3-F1.5), `src/shots.ts` (F1.2, nerve), `src/flow.ts` + `src/checkpoint.ts:CP` (F1.4, lung THRUST), `src/perks.ts:teethPos/perkTick` (splay). New `HB = { MIN: .5, MAX: 1.45 }`, `INV_HALF_BASE: .5` | pod run (LV, NEW `slotSum`), `dps-probe` (bloat, splay), `ship-probe` (F1.3) | pick screen as it is (1.5) | per-baseline record (§0) | M (5 cards, 5 sprouts, glass price, POWER weights) |

**Acceptance criteria**
- AC1.1 Each new card and GLASS JAW's price apply exactly as written. One unit test per card in `tests/unit/perks.test.ts` (**NEW file**) that sets `$.G.pk` and reads the affected formula.
- AC1.2 `tests/unit/power.test.ts` (existing): every PERKS row has a `POWER.perk` weight.
- AC1.3 `splay` never appears unless `teeth` is held (AC2.1 covers it).
- AC1.4 Screenshot rig `tools/choice-shots.mjs` (**NEW**, mode `cards`) renders every card with `c` at 480x270 to `production/qa/evidence/choice/cards-<id>.png`. Pass: BLOOD PACT shown, gain + COST ≤ 4 lines, no text past the card edge.
- AC1.5 Every new card grows a visible part (P1), same rig, `sprout-<id>.png`.
- AC1.6 Playtest (Matt, Fold): across 3 runs, at least one blood pact taken by choice and the end-of-D1 ships differ. Watch for two death spirals: `strip` + `glass` leaves a 40 f respawn window (F1.4), and `lung`'s price stacks with D32's death cost.
- AC1.7 The pod run: LV at D1 end inside `ECON.long4.targets.lvD1` [12, 14], and NEW output `slotSum` (sum of `slotLv` 0-6 at D1 end) within ±1 of the pre-lane median.
- AC1.8 Unit tests (`perks.test.ts`) for F1.1-F1.6 at both ends of each range, including `hb` clamped at .5 (tiny 2 + strip), today's `tiny` hitboxes unchanged with no new card held, and F1.4 at 40 / 80 / 160.
- AC1.9 `splay` with `teeth` 1 or 2: `teethPos()` returns `n` teeth spaced `TAU/n`; n ≤ 2 positions equal today's.

**Systems review (systems-designer).** strip's price covers every invulnerability grant (corrected numbers: 160 / 280 / 150); bloat rate x.8 → x.75 (net 1.12 was above `dmg` I); splay chew x1.5; nerve lost its x3 graze XP; lung +2 ships with a THRUST price; fuse cut; GLASS JAW priced; copy cut to budget; heavy-slot rule pinned down.

---

## 2. Build-aware offers

### 2.1 Dead and half-dead cards (every condition found)

| card | condition | today | rule |
|---|---|---|---|
| `reload` MISSILE GLAND | `P.missile == 0 && P.pyre == 0` | offered, does nothing (`player.ts:262, 296`) | **drop** |
| `crit` HOLLOW HEART | the next level adds < .035 under the .42 cap (F2.2, `mutations.ts:198`) | offered | **drop**; re-checked every offer (GLUTTONY withers, F1.6) |
| `magnet` AMPOULE MAGNET | `lv('lure') ≥ pk('magnet') + 1`: pod pull dead (`shots.ts:339`), biomass pull live (`fx/update.ts:196`) | offered | weight x.5 |
| `scab` SCAB WEAVE | `pk('glass')`: only a regrow from 0 counts (`player.ts:320` clamps to 1) | offered | weight x.5 (the `R()` at `enemies/update.ts:596` unchanged) |
| `inv` PAIN SPONGE | no WARD worn: `inv` scales only the WARD-hit window | offered, does nothing | **drop** (`ward: 1`) |
| `inv` PAIN SPONGE | `INV_HALF < 1` (strip or glass, F1.4) | n/a | weight x.5 |
| `tiny` SHRUNKEN CORE | next level would push `hb` below `HB_MIN` | n/a | weight x.5; **drop** if `hb ≤ HB_MIN` |
| `scab`, `shard` | no WARD worn | gated (`avail`, `ward: 1`) | keep |
| `tape` | `G.lives < 2` | gated (`lives: 2`) | keep |
| biome perks | biome not cleared | gated (`req`) | keep |
| `splay` (new) | no `teeth` | n/a | **drop** (`need`) |
| `nerve`, `bloat`, `strip`, `lung` | none found | n/a | keep |

### 2.2 Partner table: a held card raises its partner's weight

| held (any of) | partner card(s) | mul |
|---|---|---|
| `teeth` | `splay`, `dmg` (`perks.ts:200`) | x2 |
| contraption `saw` bolted | `teeth` | x2 |
| `trail` or contraption `furnace` | `trail`, `volatile` | x2 |
| GLUTTONY graft ≥ 1 | `crit` (until the cap) | x2 |
| MISSILE or PYRE ≥ 1 | `reload` | x2 |
| `glass` | `shard` (WARD breaks every hit) | x2 |
| `graze` | `nerve`, `tiny` | x2 |
| `strip` | `spd`, `graze` | x1.5 |
| `frost`, `ignite` or `corrode` | `rof` | x1.5 |
| BONE NEEDLES graft ≥ 1 | `pierce` | x1.5 |
| `greed` | `magnet` | x2 |

The draft's "WARD worn → scab, shard x1.5" row is removed: both cards are gated `ward: 1`, so the row was always true when they could appear, a flat x1.5 in disguise (systems R10).

### 2.3 Formulas

| id | expression | variables (range) | output range | worked example |
|---|---|---|---|---|
| F2.1 offer weight | `w'(p) = p.w × deadMul(p) × min(PARTNER_CAP, Π partnerMul(p))` over every 2.2 row whose "held" is true and lists p | `p.w` 2-9, `deadMul` ∈ {.5, 1} (drops are `avail()` filters, never weight 0), `partnerMul` ∈ {1.5, 2} | 1 to `p.w × 2` today: no card is in two rows, so the cap 4 guards future rows only | GLUTTONY 1: crit 7 × 2 = 14 |
| F2.2 crit gain | `g(l) = min(.42, G0 + .07(l+1)) − min(.42, G0 + .07l)`, `G0 = [0, .15, .3][gmL('over') \|\| 0] ?? 0`. Drop if `g < CRIT_MIN_GAIN` | l 0-2, `CRIT_MIN_GAIN .035` | g ∈ {.07, .05, 0}. The `\|\| 0` / `?? 0` guards stop a missing or out-of-range graft level giving NaN (NaN `< .035` is false, so a NaN card would never drop) | G0 .3, l 1: .05, offered |
| F2.3 draws per offer | `n_R = max(0, |out| − b) + max(0, |out| − 1)`, `|out| = min(3, |pool| + b)`, where `pool` is **after** the boost card is spliced out | b = 1 if the `boostReq` card was placed | 0 (empty pool, no boost) to 5 | no boost, pool 20: 3 + 2 = 5. Pool 0, b 1: 0 + 0 = 0 |

**Pick loop guard.** `offer()` picks with `while ((r -= pool[k].w) > 0) k++` (`perks.ts:104`). Clamp `k = min(k, pool.length − 1)`: float rounding can leave `r` a hair above 0 after the last card. `R() = 0` still takes `pool[0]`, which is why drops are filters, not weight 0.

**Loop check.** The held → partner graph is acyclic except `trail → trail`, bounded by `max: 2`. Builds may still funnel (game-designer R8); the heavy rule (1.3) and the cap are the only guards in this lane.

**Determinism.** F2.3 holds for the same pool size; dropping a dead card can shrink the pool, which changes which cards come out. No new draws.

| Pillars | Tables | Probe | Fold UI | Harness / parity | Size |
|---|---|---|---|---|---|
| P1 (builds diverge), P3 | new `OFFER = { PARTNER_MUL, PARTNER_CAP: 4, HALF: .5, CRIT_MIN_GAIN: .035, heavyFrom: 1 }` and `PARTNERS` in `src/perks.ts` | pod run with **NEW** `--offers` (logs each offer and pick: dead offers, partner hits) | none | per-baseline record (§0) | S |

**Acceptance criteria**
- AC2.1 `tests/unit/perks.test.ts` (NEW): for each 2.1 row, with that state set and a seeded `R`, the card is never offered (drop) or offered at half weight (±10%) over 10k offers.
- AC2.2 Same file: with a partner held, the partner's rate rises by the multiplier (±10%), never above `PARTNER_CAP`.
- AC2.3 Unit test over `avail()` for every 2.1 drop row (no dead card in the pool), plus the pod run with `--offers`: 0 dead offers across seeds 1-5.
- AC2.4 Same file: mock `core.R` with a counter; draws per offer equal F2.3, with and without a boost card, including pool 0. (`tests/unit/rng-split.test.ts` guards imports only.)
- AC2.5 Same file: F2.2 with `gmL('over')` undefined and 3 returns a number, never NaN.

---

## 3. Midboss pod pick (1 from 2)

**Today:** `e.mid` kill calls `dropCap()` twice (`enemies/update.ts:652-653`). Each draws a random pod type with a 7% blue (purge) chance, and both apply on contact. The stage boss already uses a pick: 3 `choice` caps, touching one purges the rest (`miniReward`, `update.ts:756`; `shots.ts:357`).

**What kind of choice this is.** Not a priced choice: neither cap costs anything, and the other cap's loss is the whole price. It is a **targeting** choice, "which gun grows next", serving P3's autonomy. That a NEED-2 slot is often the obvious answer is accepted: the decision is which build, not whether to pay.

**Rule**
1. A midboss drops **2 choice caps** with one shared `choice` id, at `(x − 16, y − 22)` and `(x + 16, y + 22)`: 32 px apart horizontally and 44 apart vertically (55 px centre to centre; the 12 px capture radii never overlap, and a vertical touch-drag passes one before the other). Each `y` is clamped to `[30, PH − 30]` and out of terrain (`floorAt`/`ceilAt` + 12).
2. Types are distinct: the first from `podType()`, the second from `podType()` with the first excluded. If only one slot is unmaxed, **a single cap drops and it pays 2 fragments**, placed at the centre. If none is, one SURPLUS cap drops (economy below).
3. **Settling window:** the caps can't be collected for `PICK.settle` = 20 frames after spawn, and draw at 50% alpha until then, so a ship already at the kill spot doesn't pick by accident.
4. The cap you touch applies **2 fragments**: two `applyPower(ty, false)` calls, so a fragment that fills a level carries into the next. Not today's choice path (`applyPower(ty, true)`, a full level, `shots.ts:356`), which the stage boss keeps. The other cap is purged.
5. No blue cap in the pick, and no blue elsewhere. Losing it (0.14 purges a kill) is paid back by +0.14 fragments.
6. METER mode: two plain `METER_CAP` caps, as today.
7. Choice caps ignore `AMPOULE MAGNET` and `lure` (open question 4 for the stage-boss pick).
8. The Maw two-pod drop is unchanged (open question 5).
9. **Bot policy (probes, NEW):** the bot picks by build need, no `R()`: the cap whose 2 fragments complete a level; tie → the slot with the higher current level (commitment); tie → lower slot index. Not "nearer cap", which would measure position, not choice.

**Label (ux B3-B5).** An 8 px chip **beside** each ring on its outer side (left cap: chip left; right cap: chip right), never under it, so it can't collide with the other ring. Content: the slot's HUD glyph plus the level change, `II>III`, when the 2 fragments complete a level; else `+2/N` (N = fragments to the next level). WARD at its cap with a broken shield: `RESTORE`. Longest chip ≈ 40 px.

| Pillars | Tables | Probe | Fold UI | Harness / parity | Size |
|---|---|---|---|---|---|
| P3 (a choice, not a conveyor), P1 | `enemies/update.ts:POD`, new `dropPick`, `shots.ts:updateCaps` (2 fragments, magnet exemption, settle). New `PICK = { dx: 16, dy: 22, frags: 2, settle: 20 }` | pod run (NEW `slotSum`, NEW `surplus`), `midboss-probe` | ring (r 10, gold) + 8 px chip beside it; flown into, no touch target | per-baseline record (§0). Fewer `R()` draws (no blue roll) | S |

**Acceptance criteria**
- AC3.1 `tests/unit/podpick.test.ts` (NEW; not the existing `midpick.test.ts`, which tests the midboss picker): a midboss kill spawns 2 caps of distinct types, 1 when one slot is unmaxed (and it pays 2 fragments), SURPLUS when none is; all `y` inside `[30, PH − 30]`.
- AC3.2 Same file: with AMPOULE MAGNET 2 held, neither cap moves; within 20 frames of spawn a touching ship collects nothing.
- AC3.3 The pod run: typed fragments applied in D1 within ±5% of the pre-lane median (expected +7.5% per midboss kill, 5 kills, so ≤ +0.7 a descent).
- AC3.4 `tools/choice-shots.mjs` (NEW, mode `mid`), seed 1, first midboss kill, 30 frames after spawn: `production/qa/evidence/choice/midpick.png`. Pass: both chips ≥ 8 px and legible, no gore pixel over a chip's box (P2), chips don't overlap either ring.
- AC3.5 The pod run: `slotSum` at D1 end at most +1 above the pre-lane median. LV is XP-driven (D31), so not the measure.
- AC3.6 Playtest (Matt, Fold, thumb): 5 midboss picks, 0 accidental picks reported.

**Economy review (economy-designer)**

| Measure, per midboss kill | Today (2 × `dropCap`) | Pick | Delta |
|---|---|---|---|
| Typed fragments | 2 × 0.93 = **1.86**, 2 types 85% of the time | **2.00**, one type | **+0.14 (+7.5%)** |
| PURGE | 0.14 | 0 | −0.14 |
| Full levels in a NEED-2 slot | under 0.13 | **1.0** if you pick that slot | the real power change |
| Biomass | +5 SURPLUS per pod on a maxed slot | +5 per SURPLUS pay, capped (below) | ±5, capped |

- **Count.** Long4 D1 has 5 midboss kills, so +0.7 fragments a descent. D31 says midboss pods "stay as they are"; this stays within 7.5%.
- **Value.** A 2-fragment pick of a NEED-2 slot is a full level of your choice, 5 times a descent. If AC3.5 fails, the knob is `PICK.frags` = 1. Don't touch D31's formation-pod cut.
- **SURPLUS is a faucet; it is capped.** Today a pod with no unmaxed slot gives 500 score and nothing else. The SURPLUS cap uses the maxed-slot path (`player.ts:50-54`, +5 bio, +1500 score). New `ECON.*.surplusBio` = 40 per descent (8 pays); past it SURPLUS pays score only. AC: unit test in `tests/unit/economy.test.ts` (existing) that the 9th pay in a descent adds 0 bio; the pod run's NEW `surplus` field reports the count and bio.
- **WARD at its cap, shield broken.** Fragment 1 restores, fragment 2 pays SURPLUS. Chip `RESTORE`.
- **Maw pods (Q5).** Economy advice: leave them free, one belt moment a descent.

---

## 4. Choosing your seal unlock

**Today:** clears 2, 4 and 6 break seal tiers 1-3 (`economy.ts:seals`). Each tier raises every slot's cap at once (`player.ts:SBASE`) and the graft slots (`mutations.ts:gunSlots`). Banner: `stages.ts:SEAL_TXT`.

**Rule**
1. Split each tier into **keys**. One key is one cap step, read from SBASE's delta (`SBASE = [[2,3,4,5],[1,2,2,2],[1,1,1,1],[0,1,1,1],[0,1,2,2],[1,2,3,3],[1,2,3,3]]`):

| tier | keys |
|---|---|
| 1 | MISSILE II · ARC · PYRE · WRAITH II · WARD II (MIRROR) · GRAFT SLOT 2 (6) |
| 2 | PYRE II · WRAITH III · WARD III (BONE AEGIS) · GRAFT SLOT 3 (4) |
| 3 | no keys of its own (only THRUST V, unkeyed) |

THRUST is **not keyed**: it rises with the tier (2→3→4→5). SPLIT never changes. GRAFT has no step at tier 3 (`gunSlots` max 3). MIRROR is the WARD II name (`player.ts:133`, `screens.ts:38`). Schedules: clears 2/4/6 on short and long4, 1/3/5 on long5.

2. A seal break opens a **pick of 1 from 3 keys** on the perk screen (same controls and guards: not during a fork, tally or boss death), queued behind the gate like `G.sealQ`. A seal pick opens before any queued perk pick, with a **30-frame gap** between them.
3. Keys are chosen **without `R()`**: sort the eligible keys by `rank`, ties in table order, take the first 3. A key is **eligible** if it is unopened and, for a tier-2 key, its slot's tier-1 key is open (or it has none): no PYRE II without PYRE. `rank` = 0 if `slotLv(i) > 0 && slotLv(i) ≥ capLv(i)` (held at cap; an unowned slot at cap 0 is not "held"), 1 for GRAFT SLOT when every graft slot is full, 2 if held below cap, 3 otherwise.
4. **What happens to keys you don't take is open question 3.** Under **defer**, untaken keys open at the next seal and tier 3 opens everything. Under **lose** (recommended by creative-director and game-designer), untaken tier-1 and tier-2 keys stay shut for the run, and tier 3 becomes a last pick of 1 from 3 eligible lost keys.
5. Cap formula: `capLv(i) = SBASE[i][0] + Σ_{t=1..min(3, G.seal)} open(i,t) × Δ(i,t)`, `Δ(i,t) = SBASE[i][t] − SBASE[i][t−1]`.
   `open(i,t) = 1` if slot i has **no key at tier t** (THRUST, SPLIT, any `Δ = 0`); else 1 if `G.sealK` holds key(i,t); else, under **defer** only, 1 if `t < G.seal` or `G.seal = 3`; else 0.
   Grafts: `gunSlots = 1 + open(GRAFT,1) + open(GRAFT,2)`, max 3 (no tier-3 term).
   Range `SBASE[i][0]` to `SBASE[i][3]`, monotone in `G.seal` (eligibility keeps tier order). Example, seal 1, ARC taken: ARC 0 + 1 = 1, PYRE 0, MISSILE 1, THRUST 2 + 1 = 3, gunSlots 1.

**Save and resume:** **no `RUN_V` bump** (`runsave.ts:13` discards other versions). Add an optional G field `sealK` (the `layout` pattern): `[null, null]` under defer, `[null, null, null]` under lose. A blob **without** `sealK` is an old save: every key up to its tier is open (today's behaviour). A pick is pending iff the tier's `sealK` entry is null at `G.seal ≥` that tier. `cpView` stores the seal as earned (`checkpoint.ts:55`), so a resume re-opens a pending pick. A pick skipped by a tier jump is void (under defer: rolled over; under lose: lost).

**Fold UI (ux R6-R7).** Seal pick screen is visibly not a perk pick: title `SEAL BROKEN // CHOOSE WHAT WAKES`, bone-white card border instead of the perk frame, no BLOOD PACT tag. Each key card: key name at 8 px, the cap change in words (`ARC 0 TO 1`), and the slot's state in words: `AT CAP`, `HELD` or `UNHELD`.

| Pillars | Tables | Probe | Fold UI | Harness / parity | Size |
|---|---|---|---|---|---|
| P3 (seals become a decision), P1 | `player.ts:SBASE`, `capLv`. `mutations.ts:gunSlots`. `stages.ts:SEAL_TXT`. New `SEAL_KEYS`. `ECON.*.seals` read only | pod run (`slotSum`), `dps-probe` (kit at D2 start), `meter-probe` (cursor greys sealed slots). Bot key policy (NEW): take the lowest-rank key | 3 cards at 142x112 as above | per-baseline record (§0); seals are reached late, so check which baselines move | M |

**Acceptance criteria**
- AC4.1 `tests/unit/seals.test.ts` (NEW): seal 1 with ARC taken: `capLv(ARC) = 1`, `capLv(PYRE) = 0`, `capLv(THRUST) = 3`, `gunSlots = 1`. Under defer, seal 2 gives `capLv(PYRE) ≥ 1`, and seal 3 gives `SBASE[i][3]` for every i. Under lose, an untaken key stays shut at seal 3 unless the tier-3 pick takes it.
- AC4.2 Same file: the keys offered are a pure function of `$.P` and `G.sealK` with no `R()`; an unowned slot at cap 0 is never rank 0; PYRE II is never offered with PYRE shut.
- AC4.3 `tests/unit/runsave.test.ts` and `tests/unit/resume.test.ts` (existing): a resume with an unpicked seal re-opens the pick; a save without `sealK` resumes with every key at its tier open and `RUN_V` still 2.
- AC4.4 `tools/choice-shots.mjs` mode `seal`: `production/qa/evidence/choice/seal.png` at 480x270. Pass: title, border and state words visible, all key text ≥ 8 px.
- AC4.5 The HUD's `SEALS I··` readout matches the tier, and the meter greys a slot sealed by an untaken key (`meter-probe`).
- AC4.6 Same file as AC4.1: `capLv(THRUST) = SBASE[0][G.seal]` with no key, and `gunSlots` never exceeds 3.

---

## 5. Fork pay

**Today:** both gates pay the same, and a gate unlocks a biome perk only (`perks.ts:88`). Fork pay scales only fixed per-stage faucets (grade bio `stages.ts:GRADE`, the stage-boss 30 bio in `miniReward`), so D31's `killBio` cut holds.

**Options (Matt decides, open question 2).** Pros and cons are neutral; the reviewers' leanings are in §7.

| | rule | `R()` | pros | cons |
|---|---|---|---|---|
| **A** | Every **remix** gate (`G.bvis[b] ≥ 1`) pays MEAT x1.5 (grade bio, boss bio, stage XP) | none | deterministic; the plate already shows ALTERED | nothing in D1 (no remixes). From D3 both gates are always remixes, so it pays on every biome stage with no trade: +110 to +140 bio a descent of flat faucet |
| **A′** | As A, but only when the **other** gate is fresh | none | keeps A's "new perk or more meat" trade and removes the D3 faucet | comes up at most once a run (`openFork` offers fresh biomes first, `biomes.ts:409-411`), so it rarely matters |
| **D (stream)** | Every fork's two gates carry different tags, `MEAT` (grade bio and boss bio x1.5) and `PICK` (stage-boss pick shows 4 caps, §0). Which gate gets which: salted `forkStream(seg)` (`pickStream`/`midStream` pattern, `biomes.ts:337-343`), drawn at `openFork`, stored on `G.fork.tag` | no sim `R()`; re-derived on resume | live from D1; choice, no volume on PICK | the tag is effectively random per fork (seeded, shown before you choose), which is close to the drawn content the crew warned against |
| **D (biome)** | As D, but the tag **follows the biome** from a fixed `FORK_TAG` table; if both biomes carry the same tag, the upper gate takes the other (fixed rule) | none | learnable: the player can plan routes around it (P4); no stream to explain | 4 biomes split 2/2, so the pairing is often forced; the table assignment is a new tuning decision (economy-designer) |

Dropped by review: **B** (a random tag per gate: drawn content, moves the harness) and **C** (a HARD gate: touches DEPTH, re-bands P4).

**METER mode (`SET.meter`).** Stage-boss caps are `METER_CAP`, so a 4th cap adds nothing and MEAT would dominate. Under D, in METER mode both gates pay as today and show no tag. No draw depends on the setting (both D variants use no sim `R()`).

**Plate (ux B1-B2, R8, N10).** **No new line**: the 32 px plate between gates ≥ 56 px apart has no room. The pay text **replaces the ALTERED chip** (A, A′) or **fills the tag slot** (D), at 8 px, max 10 characters. It shows the number, not a multiplier: `+35 BIO` (the S-grade bonus at this descent, computed from `GRADE`, the boss bio and `deepPay`, so it is never stale) or `PICK 4`. The `plate.md` contract is amended to match. The tally shows the bonus beside its bio.

**Stacking cap (economy B1).** Biomass multipliers on one payout **add their bonuses**, capped: `mul = min(BIO_MUL_MAX, 1 + Σ bonus)`, `BIO_MUL_MAX` = 2.0. BLOOD MONEY 2 (+.6) and MEAT (+.5) give 2.0, not 2.4; the bench `stomach` would add under the same cap.

| Pillars | Tables | Probe | Fold UI | Harness / parity | Size |
|---|---|---|---|---|---|
| P4 (forks as decisions), P3 | new `EconEntry.forkPay` in `src/economy.ts:ECON` (short: **null**), `BIO_MUL_MAX`, `FORK_TAG` (D biome). Read in `stages.ts:clearStage`, `update.ts:miniReward`, `perks.ts:stageXP` (A, A′ only) | pod run with `endLoop` 3 and **NEW** `--worst-bio` (takes MEAT at every fork, BLOOD MONEY whenever offered); `route-probe` | plate chip as above | short and parity identical (`forkPay` null); long4 moves | S (A, A′), M (D) |

**Acceptance criteria**
- AC5.1 `tests/unit/economy.test.ts` (existing): `ECON.short.forkPay === null`, and `clearStage` on short pays as today. On long4, a paying stage pays grade bio x1.5 (and stage XP x1.5 under A/A′).
- AC5.2 Per-baseline record (§0): `tools/harness.baseline.json` (short) and `layout-parity` show **0 diff**, run explicitly and noted in the commit.
- AC5.3 The pod run, `endLoop` 3, seeds 1-5: D2 and D3 bio medians inside `BIO_LONG` [2100, 2400] and [2600, 3600]. If not, economy-designer trims `forkPay` to 1.3 before touching `killBio`.
- AC5.4 **Worst case:** the same run with `--worst-bio`: every seed's D1 ≤ 1500, D2 ≤ 2400, D3 ≤ 3600 (the band tops).
- AC5.5 `tests/unit/gateplate.test.ts` (in this branch): with the longest pay copy (`+140 BIO`), the plate keeps its line count, the chip fits the plate width, and the plate clears the other gate at the minimum 56 px gap. Playtest note (Matt, Fold): which gate he took at each fork and why. (Replaces the route-probe percentage: bots don't choose, and the pairing comes up ≤ 1 time a run.)
- AC5.6 `tests/unit/economy.test.ts`: `mul` never exceeds `BIO_MUL_MAX`.
- AC5.7 (D stream) Unit test: `forkStream(seg)` gives the same tags for the same seed, loop and seg, before and after a resume; `tests/unit/rng-split.test.ts` stays green.
- AC5.8 `gateplate-shots.mjs` (existing rig, NEW mode `pay`): `production/qa/evidence/choice/plate-pay.png`. Pass: chip ≥ 8 px, no clip by a fire spire or ice shelf (`gateYs`).

**Economy review (economy-designer)**

| | grade bio | boss pick bio | fixed total | x1.5 adds | vs the band |
|---|---|---|---|---|---|
| D1 (`deepPay` 1) | 25 (S 40) | 30 | 55 (S 70) | **+27.5** (S +35) | D1 band width 200: 2 biome stages, at most +70 (35% of the width) |
| D2+ (`deepPay` 2) | 50 (S 80) | 60 | 110 (S 140) | **+55** (S +70) | D2 band width 300: at most +140 a descent |

Fixed faucets are about 14% of D1 biomass and about 45% of the D2 increase, so x1.5 on 2 of 4 stages is a band-edge risk in D2-D3, measured by AC5.3-5.4. Stage XP x1.5 is in A/A′ only; D's MEAT leaves XP out on purpose (LV band).

---

## 6. MATT DECISION: at-risk biomass

Today every payout writes `G.bio` and `meta.bio` together (`update.ts:773-774`, `stages.ts:80-81`), so nothing is at stake. **game-designer does not decide this** (open question 8).

| | rule | pros | cons |
|---|---|---|---|
| **A. Bank at once** | status quo | no work, no HUD change, D31's bands hold | biomass never creates risk; the economy part of "linear" stays |
| **B. Bank at the tally, lose half on death** | run bio collects as "carried" and banks at each stage tally; a death loses 50% of carried | a visible stake every stage; careful and greedy play pay differently (P3, P4); loss bounded at half a stage | carried/banked readout needed (tally and pause screens only, ux R9); `killBio` re-fit; RE-ENTER must restore carried bio as at the checkpoint |
| **C. Bank at checkpoints, lose all on death** | banks at CP0 (stage start) and CP1 (`CP.after` = 150 past midboss A's breath, so about mid-stage); stages with no CP1 (`cp1X` null) bank once. A death loses everything since the last bank | ties the stake to the checkpoint rule; Gradius-harsh | stacks with D32's death cost and the gun/graft strip; feel-bad spiral risk |
| **D. Lose it only at game over** | carried bio survives deaths, banks at the descent end (Infirmary); game over loses it | one clean stake, simplest HUD | bimodal: a D1 game over pays almost nothing, hitting new players hardest |
| **E. Recoverable drop** | on death, carried bio (since the last tally) drops as a clot at the death spot, pinned ahead of the respawn x so the scroll can't take it; fly through it to recover; a second death before then loses it | the loss is fixable by skill (Souls bloodstain); a reason to fight forward | a new entity; the death spot is often the hazard that killed you; respawn invulnerability (F1.4) makes the grab easier with no `strip`/`glass` |

**Economy review (economy-designer).** Loss on death destroys biomass; that is not a sink, because it only reduces what the Infirmary catalogue absorbs. Estimates assume ~350 bio per D1 stage and 1-3 pilot-bot deaths per D1.

| | expected loss per death | D1 loss at 2 deaths | variance |
|---|---|---|---|
| A | 0 | 0 | none |
| B | ~90 (50% of half a stage) | ~175 (12% of the band) | low, capped |
| C | ~90 (all of a quarter stage) | ~175 | medium; stacks with D32 |
| D | 0, or the whole descent (up to ~1400) | 0 or ~1400 | bimodal |
| E | 0 if recovered, else as B (all of carried) | 0-350 | depends on skill |

- B-E need the `killBio` re-fit on the pilot bot (which dies); at B's rate about .65 → .72 for the D1 band.
- **No post-catalogue sink exists.** Once the Infirmary catalogue (7 rigs x 3, sockets, UPG) is bought out, no option keeps biomass meaningful, so **the meta economy is not balanced past buy-out** under any option. The candidate sink is the crew report's fix 5 (re-bolt the Infirmary per descent), not specified here.
- First-kill pay and SURPLUS bank at once in every option.
- Economy-designer's **advice** (not a decision): B, for a readable, bounded stake that doesn't stack with D32.

Applies to every option except A: BLOOD MONEY grows in value; `meta.bio` writes move to bank events plus a `runsave` field; bands are re-read on the pilot bot; size M; timing after §1-§5, so the Fold reading separates the effects.

---

## 7. Open questions for Matt

1. **Which "linear"?** (orders the lane)
   - Route: §5 first.
   - Build: §1, §2, §4 first.
   - Stage rhythm: none of this lane leads; set-pieces first.
   - Noticing: §3 labels and §4/§5 plates first.
2. **Fork pay** (§5)
   - A: every remix pays.
   - A′: a remix pays only against a fresh gate.
   - D (stream): seeded MEAT/PICK tags per fork.
   - D (tag follows biome): fixed MEAT/PICK per biome.
   - Leanings: creative-director leans D (biome) and drop A′; economy-designer prefers D + A′.
3. **Seal stakes** (§4 rule 4)
   - Lose: untaken tier 1-2 keys shut for the run; tier 3 is a pick of 1 lost key (recommended by creative-director and game-designer: a real bet, distinct builds).
   - Defer: untaken keys open at the next seal; every run ends with the same caps.
   - Lose, with defer as an easy-mode setting.
4. **Choice caps ignore magnet and lure**, the stage-boss pick included? (recommended: yes)
5. **Maw pods:** two free pods, or a pick? (economy advice: free)
6. **BLOOD MONEY's price** (§1.2)
   - -6% damage per level.
   - -10% damage per level.
   - -10% fire rate per level.
   - Stays free.
   - And SPARE MEAT stays free (default yes)?
7. *Answered:* MIRROR is the WARD II key (§4).
8. **At-risk biomass** (§6): A bank at once · B half on death · C checkpoints · D game over · E recoverable drop.
9. **One lane or two:** §5 (A/A′) is long4-only and short-safe, so it could ship ahead of §1-§4 without a short re-baseline.

---

## Review log

**2026-11-07, full `/design-review`: NEEDS REVISION.** Revised per creative-director's synthesis: `fuse` cut (five new cards); GLASS JAW priced; strip invulnerability numbers corrected (160/280/150) and generalised (F1.4); bloat rate x.75, lung THRUST price; F2.2 NaN guard, F2.3 post-splice `max(0, …)`, pick-loop clamp, always-true WARD partner row removed; §3 reframed as a targeting choice, bot picks by build need, caps split ≥ 32 px with a settle window, 8 px chips beside the ring with the level change, single-cap and `y` clamp; SURPLUS capped; §4 `capLv` `open()` for unkeyed slots, rank-0 fix, tier eligibility, seal-pick UI; §5 no new plate line, numbers not multipliers, METER handling, stacking cap, worst-case probe, `forkPay === null` test; §6 neutral options, option E, C spacing, no post-catalogue sink stated; ACs name files, commands and bands, NEW items labelled; per-baseline harness record. Matt's questions Q1, Q2, Q3, Q6, Q8 restated in §7. **Re-review pending.**
