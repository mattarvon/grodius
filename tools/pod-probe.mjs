// Seeded pacing probe: progression.mjs bot + pick/fork/shop handling, seeded RNG,
// per-frame pod-pickup timestamps, per-stage pods/min, bio per descent.
// Usage: node tools/pod-probe.mjs <url> <seed> [minutes=12] [endLoop=1] [--layout long4|short] [--mortal] [--pilot | --park] [--hull N] [--kit mid|full|end] [--brutal 0-3 | --tier 0-3] [--drift] [--rig full] [--react N]
// --pilot: steer with the dodging autopilot (tools/pilot.mjs) instead of the plain target-seeker; use it with --mortal
// (the plain bot game-overs in long4's first biome). Its frames with no safe move are reported as `pilot.trapped`.
// --react N (with --pilot): the pilot's reaction time, frames (tools/pilot.mjs PILOT_TUNE.react, 0 by default): a shot,
// body, hazard or tell is unseen until N frames old. The M2 sensitivity runs (W6 tune-tp): how far the clear rate
// moves with a slower reader
// --mortal: the bot is not kept invincible, so it takes real hits, loses ships and can game over (the run then ends
// early and `endState` says so). Without it, hits stay 0 and every tally grades on kill% alone.
// `firstKills` lists the midboss kinds paid the first-kill biomass (meta.mbK; the probe starts on a fresh profile, so
// every kind killed pays once: subtract 100 per kind on long entries for the steady-state figure). `grades[].fk` counts
// them at each tally. Per stage `grades` keeps each tally's grade, hits, deaths, kill% and the stage's regular spawns (G.st.spawned), and
// `bossFight_s` the seconds the Gravity Drive (G.boss; biome bosses are enemies) was up and not dying, per stage.
// Stage times: `stages[].dur` runs from one stage label to the next (so it includes the tally card, a fork or the
// shop); `tally_s` is the tally card's own clock, STAGE card to boss kill (spec §3.1's wall-time definition).
// Kit snapshots (economy plan d31 §4, measure-only: read between ticks, no input and no R() draw): `grades[].kit` at each
// tally and `warns[]` at each WARNING banner (midbosses, the Saucer, and the biome bosses too: `title` names it; one per
// banner, polled every 30 frames, so `f` is within 30 frames)
// carry { xpTot, pow, lvl, slots (player.ts SLOTS order THRUST MISSILE SPLIT ARC PYRE WRAITH WARD, + shield), pk (G.pk
// perks), gm (G.gm grafts) }. `stages[].kinds` splits that stage's pickups by kind (pod/choice/blue/graft/salv);
// `stages[].pods` stays pod + choice. `stages[].src` splits the same pickups by origin, read off what died the frame the
// cap appeared: fixed:mid (a midboss or the Maw), fixed:saucer (dropped while the Saucer is up), fixed:release (a group
// spawned with pod: the biome breath's release), fixed:choice, carrier (e.cap), formation (a group's last kill), else
// salv/graft/blue/unknown. A carrier that is also in a group counts as fixed:release or carrier, never formation.
// `grades[].gradeBio` is the tally's grade biomass (G.tally.bio, stages.ts clearStage). Not measured: the Drive's own WARNING (its banner is its title, not WARNING).
// --park (D63, Matt's "I don't need to do anything but hold the spacebar"): the ship never moves: it sits where it
// spawned (and respawned), fire held. Use it with --mortal: the D63 gate is that this bot GAME OVERs in Descent 1.
// `deaths[]` (every mortal run) and `hitLog` say what took each ship / shield hit, read by proximity the frame before
// it happened (measure-only): shot:<kind> (an enemy bullet within 26 px), body:<k> (an enemy within its r + 14 px),
// haz:<k> (a hazard within 12 px of the ship's column), terrain (the ship inside the floor or ceiling), else other
// (a lash, hook, lane or beam); `ctx` names the fight that was up (mid:<k>, boss:<k>, drive).
// ---- W5 difficulty-rebuild additions (DIFFICULTY-SPEC §3.1), all measure-only (no input, no R(), no sim writes) ----
// --tier N (0 Easy .. 3 Very Hard) flies ?tier=N. --brutal N stays as the old flag (?brutal=N, D63): on a build with
//   the tier switch it is read as Normal, on an older build it picks the BRUTAL dial. `tier` and `brutal` in the output
//   are what the game says it flew (G.tier / G.brutal), 'n/a' when the build has no such field.
// --drift: the hold-fire drifter (P2, Matt's play): fire held, never dodges or chases; the ship holds x 70 and drifts
//   up and down at half its speed, turning 14 px short of the terrain. Use it with --mortal.
// --rig full: the profile owns every contraption, has every socket, and bolts the three heaviest (POWER.rig) at level 3.
// `bullets`: enemy bullets per frame by cap context (spec §2.1: scroll, setp = a midboss / the Orbit Maw / G.setp, boss
//   = the Drive or a stage boss), overall and per stage|context: `cap` (the spec cap at the flown tier, Normal when the
//   build has no tier), `overCap` frames whose counted shots (every eshot but haz ones) exceed it and the worst count
//   (shots still in flight when the context drops to a lower cap are carried and not counted: `carriedFrames`),
//   on-screen p50 / p90 / max and the share of frames above 5 (B2), the fastest shot and the frames' shots over V_CAP,
//   and the shot speed / ship speed ratio p50 / p90 (S1). `bulletHist` keeps the raw histograms for cross-seed sums.
//   `rankTrace`: [frame, stage, rank] every frame src/rank.ts rank($) changes (null on a build without rank.ts);
//   `rankAtStage` the rank on entering each stage, `rankAtDrive` the rank the frame the Drive (G.boss) appears (R1). `deaths[]` add: `rank1` (rank 1 frame after the death, D1),
//   `kit` (the slots that died), `src` (terrain / solid / hazard / body / bullet / other, M3: read from probe-lib
//   PL.cause, the exact overlaps padded by one frame of motion, shot first; a cause found only by the old proximity
//   guess is marked ~), `shot` for a shot death (null when the shot spawned and hit inside one step):
//   { age (its own frame counter s.t), sd (its spawn distance from the ship, px), atRsp (it existed when the ship
//   last respawned), sinceInv (frames since that respawn's i-frames ended), by (the shooter's kind) } (F1),
//   `rebuild_s` { k0, kit, k0w }: seconds from control returning to K0 and to the death's own kit (null = never) (E6),
//   k0w = K0 with the WARD slot ignored (the pending 'K0 minus WARD' reading of E6),
//   `restart` (a checkpoint restart rather than a respawn in place). `recovery[]`: per respawn or restart, the pods
//   that appeared within 10 s (`n`), those tagged rec, and those picked up (E1). `slack` = WARD hits + deaths,
//   `shieldHits` the WARD hits (H1, H2). `revenge`: enemy shots flagged rev (D3; 'n/a' when no shot carries a rev field).
//   `k0_s` / `k1_s`: first second the ship held K0 / K1 (E2, E3). `grades[].score`: G.score at each tally.
//   Pickup `src` adds `rec` (a recovery pod: c.rec, e.rec or group.rec) and `fixed:open` (an authored opening
//   carrier: e.open or group.open; assumed field names, to pin in spec §5.6) ahead of the older tags. `recovery[]`
//   counts only caps that appear after the respawn. `contractErr`: a future module that answered in another shape. `mods` lists which optional modules the build has.
// ---- W6 round 3 (r3-econ) additions, all measure-only ----
// `ward`: the shield ledger (gate H2, H1). fullHits = WARD hits that set the WARD i-frames (playerHit); grazes = the
//   shots.ts near-miss drain (.34 a shot within 16 px, no i-frames). The older `shieldHits` counts every fall of
//   P.shield, so it counts each graze as a whole hit: H2 and H1 should read fullHits. supply / spentHits /
//   spentHitsLife0 / unspent split the shield by where it came from (lvl, lvl:rec, lvl:prime, top, top:rec, scab, regrow;
//   spent LIFO; graze<-src is graze drain). `driveKit`: the slots, grafts and rank.ts rankP the frame the Drive appears
//   (R1: rank = T_base + 3 + P). `fights[]`: each held midboss / Maw, its start, length, hp left and kill / left (E2: a
//   Saucer that leaves pays no kill pair). `drops`: every cap that appeared by stage and src, taken or not; `openG[]`:
//   each opening formation's members seen / killed / paid (E2's fixed:open). `stages[].types`: each pod's slot.
//   deaths[].kitClass (below / k0 / above K0) and rebuild_s.horizon (seconds to the next death or the run's end) (E6).
//   --rebuild [stage]: see below.
// ---- W6 round 3 integration additions (measure-only) ----
// `openG[].esc`: each opening-carrier member that left alive (where, when, the ship's spot). `--open-trace`: openG[].tr, the
//   biome and Drive openers every 6 f (members, the other enemies on screen, caps) and openG[].sc, the script around the
//   spawn. A blue capsule an opener dropped is tagged fixed:open, not blue (every 12th red is blue, G.redN; it is still
//   that formation's pod). The plain bot drops a target untouched for 120 f while it is the target (`botStuck` counts them;
//   see the target block). The --rebuild rig zeroes every slot before it fits END D1, so the death kit is END D1 exactly.
import { chromium } from 'playwright';
import { useLayout, LAYOUT } from './layout-arg.mjs';
import { PILOT } from './pilot.mjs';
import { pageLib, CAPS, VCAP, hq, hmax, hshare } from './probe-lib.mjs';
import { hostGuard } from './host-guard.mjs';
const flag = (n) => { const i = process.argv.indexOf(n); if (i < 0) return false; process.argv.splice(i, 1); return true; };
const opt = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv.splice(i, 2)[1] : null; };
const MORTAL = flag('--mortal'), PIL = flag('--pilot'), PARK = flag('--park'), DRIFT = flag('--drift');
const BRU = opt('--brutal'); // D63: ?brutal=N (default: the game's)
const TIER = opt('--tier'); // spec §2.1: ?tier=N
if (TIER != null && !/^[0-3]$/.test(TIER)) { console.error('--tier needs 0-3'); process.exit(2); }
const KIT = opt('--kit'), HULL = +(opt('--hull') || 0), RIG = opt('--rig'), REACT = opt('--react');
// --rebuild [stage] (W6 round 3, gate E6's kit half: the spec's worked example, 'the END D1 kit dies in biome B'):
// a deathless run that, 30 s into that stage (default 1-3, biome B), fits the END D1 kit below (guns, grafts, perks), kills
// the ship once (flow.ts killPlayer: a staging write, the rig's only one) and flies on invincible. The death is logged
// in deaths[] like a mortal one (cause 'rig'), so rebuild_s.kit is the time back to the END D1 kit under the real faucet
const RB = (() => { const i = process.argv.indexOf('--rebuild'); if (i < 0) return null; const v = process.argv[i + 1]; const st = v && /^\d-\d$/.test(v) ? v : '1-3'; process.argv.splice(i, v === st ? 2 : 1); return st; })();
if (REACT != null && !(+REACT >= 0)) { console.error('--react needs frames >= 0'); process.exit(2); }
if (RIG && RIG !== 'full') { console.error('--rig takes full'); process.exit(2); }
const [url, SEED = '1', MIN = '12', END = '1'] = process.argv.slice(2);
// --kit bare|mid|full: the first life starts with src/jump.ts KITS[kit].p fitted (guns only; lives and level are the
// run's own). A death strips it as usual. With --park it asks Matt's question: once powered, can you just sit and fire?
// restated from src/jump.ts KITS (its extensionless imports don't load in Node); keep in step
// end: the END D1 kit of boss-probe / dps-probe (spec R1), grafts and perks included: gm.cal 1 is what lifts its rank to
// 16 on Drive entry (a SPLIT kit without it reads 15, W0-CONTRACT)
const KITS = { bare: { p: {} }, mid: { p: { speed: 2, double: 1, missile: 1, options: 1 } }, full: { p: { speed: 4, laser: 1, missile: 2, pyre: 1, options: 3, wardLv: 2, shield: 3 } },
  end: { p: { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2, shield: 3 }, gm: { cal: 1, rapid: 1 }, pk: { dmg: 2, rof: 1, crit: 2 } } };
const KITP = KIT ? KITS[KIT] : null; if (KIT && !KITP) { console.error(`unknown kit ${KIT}`); process.exit(2); }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
if (PIL) await p.addInitScript(PILOT);
if (PIL && REACT != null) await p.addInitScript((r) => { window.__pilotReact = r; }, +REACT);
// r4 decision 29: --human flies the pilot's HUMAN profile (tools/pilot.mjs PILOT_HUMAN: reaction, tell latency, intermittent
// correction, motor noise, overshoot), seeded with the run's seed on the pilot's own PRNG (no sim R()). Measure-only
const HUMAN = process.argv.includes('--human');
if (PIL && HUMAN) await p.addInitScript((sd) => { window.__pilotHuman = { seed: sd }; }, +process.argv[3] || 1);
await p.addInitScript(pageLib);
if (process.argv.includes('--open-trace')) await p.addInitScript(() => { window.__otr = 1; }); // openG[].tr: the biome openers every 6 f (measure-only)
await p.addInitScript(hostGuard); // W6 round 3: the host's blur / visibility / gamepad can't pause or steer a probe page (tools/host-guard.mjs; four runs paused at the same second mid-batch)
await p.addInitScript(([seed, mortal, pil, park, hull, kit, drift, rb, rbKit]) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); } catch (e) {}
  window.__pods = []; window.__capSrc = new WeakMap(); window.__fr = 0; window.__bf = {}; window.__deaths = []; window.__hits = {};
  const X = (window.__x = { rank: [], lastRank: undefined, rankAt: {}, rsp: [], rspShots: new WeakSet(), invEnd: null, lastP: null, pendRank: null, k0: null, k1: null, rev: 0, revSeen: new WeakSet(), lastSc: 0, lastStage: '' });
  const slotsOf = (P) => [P.speed || 0, P.missile || 0, P.double || 0, P.laser || 0, P.pyre || 0, P.options || 0, P.wardLv || 0];
  const isK0 = (s) => s[0] >= 2 && (s[1] >= 1 || s[4] >= 1) && (s[2] >= 1 || s[3] >= 1) && s[5] >= 1 && s[6] >= 1;
  const isK1 = (s) => s[0] >= 3 && (s[1] >= 2 || s[4] >= 1) && (s[2] >= 1 || s[3] >= 1) && s[5] >= 2 && s[6] >= 2;
  const has = (s, k) => k.every((v, i) => s[i] >= v);
  const hasEq = (s, k) => s[0] >= k[0] && (s[2] || s[3] ? 1 : 0) >= (k[2] || k[3] ? 1 : 0) && Math.max(s[1], s[4] ? s[4] + 1 : 0) >= Math.max(k[1], k[4] ? k[4] + 1 : 0) && s[5] >= k[5] && s[6] >= k[6]; // W6 round 3: E6 read as the game's rebuild trigger reads it
  // what was touching the ship the frame before a hit or a death (see the header's `deaths[]`); the shot is kept so
  // its tag (age, spawn distance) can be read
  window.__near = (g) => { const P = g.P, G = g.G, W_ = window.__W, PL = window.__PL; let best = null, bd = 1e9, shot = null; const put = (c, d, q) => { if (d < bd) { bd = d; best = c; shot = q || null; } };
    const ctx0 = G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? (G.mini.mid ? 'mid:' : 'boss:') + G.mini.k : '';
    if (PL && PL.mods.W) { const k = PL.cause(g); if (k.c) return { c: k.c, ctx: ctx0, shot: k.shot }; } // exact overlap first (qa-lead review); the proximity guess below is marked ~
    if (W_) { for (const q of W_.eshots) { const d = (q.x - P.x) ** 2 + (q.y - P.y) ** 2; if (d < 26 * 26) put('shot:' + (q.k || 'orb'), d, q); }
      const wx = P.x + G.scroll; if (P.y + 6 >= W_.floorAt(wx) || P.y - 6 <= W_.ceilAt(wx)) put('terrain', 0);
      else if (PL && PL.solids(wx).some(([a, b]) => P.y + 6 >= a && P.y - 6 <= b)) put('solid', 0); }
    if (PL && PL.blocks().some((b) => Math.abs(P.x - b.cx) < b.hw + 14 && Math.abs(P.y - b.cy) < b.hh + 10)) put('haz:block', 1); // a flying ice block (proximity fallback)
    for (const e of g.enemies) if (!e.dead) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2, r = (e.r || 8) + 14; if (d < r * r) put('body:' + e.k, d + 1); }
    const bi = globalThis.__biome && globalThis.__biome(); if (bi && bi.haz) for (const h of bi.haz) if (Math.abs(h.x - P.x) < 12) put('haz:' + h.k + (h.aim ? '(aimed)' : ''), 2);
    const ctx = G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? (G.mini.mid ? 'mid:' : 'boss:') + G.mini.k : '';
    return { c: best ? (PL && PL.mods.W ? '~' : '') + best : 'other', ctx, shot }; };
  // H2 shield ledger (W6 round 3, measure-only: reads P before and after each tick, no input, no R()). Every rise in
  // P.shield is a SUPPLY tagged by its source: lvl (a WARD level-up from a pod), lvl:rec (a level-up from a recovery
  // carrier's pod: R2's WARD), lvl:prime (seal priming's STORED PARTS GROW IN, no pickup), top (an at-cap pod's +wardTop),
  // top:rec (the same from a recovery pod), scab (SCAB WEAVE on a kill), regrow (REGROWTH's timer). Every fall is a full
  // HIT (playerHit: it sets the WARD i-frames, so P.inv rises) or a GRAZE (shots.ts: a shot within 16 px drains .34, no
  // i-frames; glass clamps count here too). Spent hits are charged to the newest unspent supply (LIFO), per life; what
  // a death or the run's end leaves unspent is `wardLeft`. `wardSpentL0` is the first life's share
  window.__wl = { sup: {}, spent: {}, spent0: {}, left: {}, grz: 0, grzAmt: 0, hits: 0, life: 0, stk: [], P: null };
  window.__wardLedger = (q, h) => { const L = window.__wl, P = h.P, add = (o, k, v) => { o[k] = +((o[k] || 0) + v).toFixed(2); };
    if (P !== q.P) { for (const c of L.stk) add(L.left, c.src, c.amt); L.stk = []; if (L.P) L.life++; L.P = P; return; } // a respawn: the old ship's unspent shield is lost
    L.P = P; if (!P.alive) { for (const c of L.stk) add(L.left, c.src, c.amt); L.stk = []; return; }
    const sh = P.shield || 0, d = sh - q.sh; if (Math.abs(d) < 1e-6) return;
    if (d > 0) { const pod = window.__w6, rec = pod === 'rec' ? ':rec' : '';
      const src = (P.wardLv || 0) > q.lv ? (pod ? 'lvl' + rec : 'lvl:prime') : pod ? 'top' + rec : (h.G.kills || 0) > q.kills ? 'scab' : 'regrow';
      add(L.sup, src, d); L.stk.push({ src, amt: d }); return; }
    const hit = (P.inv || 0) > q.inv; let need = -d; if (hit) L.hits++; else { L.grz++; L.grzAmt += need; }
    while (need > 1e-6 && L.stk.length) { const c = L.stk[L.stk.length - 1], u = Math.min(c.amt, need); c.amt -= u; need -= u;
      if (hit) { add(L.spent, c.src, u); if (L.life === 0) add(L.spent0, c.src, u); } else add(L.spent, 'graze<-' + c.src, u);
      if (c.amt <= 1e-6) L.stk.pop(); } };
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); let before = null, beforeE = null;
      if (g && g.P && g.state === 'play') { if (window.__lives0 == null) { if (kit) { Object.assign(g.P, kit.p); if (kit.gm) g.G.gm = { ...(g.G.gm || {}), ...kit.gm }; if (kit.pk) g.G.pk = { ...(g.G.pk || {}), ...kit.pk }; } window.__lives0 = g.G.lives; } if (rb) { const X = window.__x, st = `${g.G.loop + 1}-${(g.G.stage || 0) + 1}`; (X.stF ||= {})[st] ??= window.__fr; // --rebuild (header)
          if (!X.rbDone && st === rb && g.P.alive && !g.G.tally && window.__fr - X.stF[st] >= 1800) { const P = g.P; Object.assign(P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0 }, rbKit.p); /* W6 round 3: every slot first, so the death kit is exactly END D1 (an ARC the ship already held stayed, and the rig then waited for SPLIT and ARC both) */ g.G.gm = { ...(g.G.gm || {}), ...rbKit.gm }; g.G.pk = { ...(g.G.pk || {}), ...rbKit.pk };
            const k = slotsOf(P); P.inv = 0; P.shield = 0; X.rbDone = 1; X.rbHold = P; window.__FL.killPlayer();
            window.__deaths.push({ st, s: +(window.__fr / 60).toFixed(1), f: window.__fr, cause: 'rig', src: 'rig', lives: g.G.lives, x: Math.round(P.x), y: Math.round(P.y), kit: k, shot: null, rank1: null, rebuild_s: { k0: null, kit: null, k0w: null, kitEq: null } }); }
          if (X.rbHold && g.P !== X.rbHold) X.rbHold = null; }
        if (!mortal && !(window.__x.rbHold && g.P === window.__x.rbHold)) { g.P.inv = 30; g.P.alive = true; } const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const plain = !pil && !park && !drift, SK = plain ? (window.__stuck ||= new WeakSet()) : null; // W6 round 3 (E2 fixed:open): the plain bot gives up a target it can't hurt
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0 && !(SK && SK.has(e))).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          // the plain bot steers to the target nearest its own height and stays on it. A wall- or ceiling-mounted one its bolts
          // never reach (a cross turret in the wall, a ceiling womb: the bolts die in the terrain) held it for seconds, pinned
          // under the target, while an opening carrier formation crossed below and left: E2's fixed:open read 8-9 for that,
          // not for anything the formation did (entry, exit and despawn were normal: pod-probe openG[].tr). Untouched for 120 f
          // while it is the target, it is dropped for good. Measure-side (the bot's input only); the pilot, park and drift keep theirs
          if (SK && t && !c && !t.mid && !t.mini && !t.big && !t.par && t.k !== 'maw' && t.k !== 'heart' && t.k !== 'nailbar') { // never a midboss, boss or part: a half floor or armoured phase holds HP on purpose (review)
            const T = (window.__tg ||= { e: null, hp: 0, f: 0 }); if (T.e !== t || (t.hp || 0) < T.hp) { T.e = t; T.hp = t.hp || 0; T.f = window.__fr; } else if (window.__fr - T.f > 120) { SK.add(t); window.__x.stuck = (window.__x.stuck || 0) + 1; } }
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; }
          else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss || g.enemies.find((e) => !e.dead); tx = 90; ty = m ? m.y : g.P.y; } }
        if (park) { /* --park: never move */ }
        else if (drift) { // --drift: hold x 70, drift vertically at half speed, turn 14 px short of terrain (no dodging, no chasing)
          const P = g.P, v = (1.25 + .42 * (P.speed || 0)) * (P.slow > 0 ? .45 : 1), Wm = window.__W, wx = P.x + G.scroll;
          if (G.fork && G.fork.t > 45) { P.x += Math.sign(tx - P.x) * Math.min(v, Math.abs(tx - P.x)); P.y += Math.sign(ty - P.y) * Math.min(v, Math.abs(ty - P.y)); }
          else { P.x += Math.sign(70 - P.x) * Math.min(v, Math.abs(70 - P.x)); window.__dd ??= 1;
            const f = Wm ? Math.min(254, Wm.floorAt(wx + 12)) : 254, c = Wm ? Math.max(0, Wm.ceilAt(wx + 12)) : 0;
            if (P.y + v * .5 > f - 14 || P.y > 254 - 10) window.__dd = -1; else if (P.y - v * .5 < c + 14 || P.y < 10) window.__dd = 1;
            P.y = Math.max(6, Math.min(248, P.y + window.__dd * v * .5)); } }
        else if (pil) window.__pilotStep(g, tx, ty);
        else if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); }
        before = g.caps.slice(); beforeE = g.enemies.slice(); window.__redN0 = g.G.redN || 0; }
      const pre = mortal && g && g.P && g.state === 'play' && g.P.alive && g.P.inv <= 1 ? { sh: g.P.shield || 0, n: window.__near(g), x: g.P.x, y: g.P.y, kit: slotsOf(g.P) } : null;
      const wq = g && g.P && g.state === 'play' ? { P: g.P, sh: g.P.shield || 0, lv: g.P.wardLv || 0, inv: g.P.inv || 0, kills: g.G.kills || 0 } : null; window.__w6 = null; // H2 shield ledger (below)
      if (window.__PL && window.__PL.trapHits && g && g.G) { window.__PL.trapHits(g.G); window.__PL.takeHits(); } // g5: arm the hit trap; nothing from before this step
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G(), PL = window.__PL, trap = PL && PL.takeHits ? PL.takeHits() : [], trapAt = (trap.find((x) => x.k === 'deaths') || trap[0] || null);
      // g5 (qa): the after-step replay (PL.hitBy: the lash and a body touch on the sim's own tests) settles what the frame-before
      // read missed or guessed; cls is the fine class (whip / doll / watcher:orb / watcher:body, else the five-way src)
      if (pre && h && h.P) { const st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`, hitC = h.P.alive && (h.P.shield || 0) >= pre.sh && h.state !== 'over' ? pre.n.c : PL && PL.settle ? PL.settle(PL.settle(pre.n.c, PL.hitBy(h)), PL.atCause(trapAt, h)) : pre.n.c, cause = hitC + (pre.n.ctx ? ' @' + pre.n.ctx : '');
        if (!h.P.alive || h.state === 'over') { const sq = hitC === pre.n.c ? pre.n.shot : null, tg = sq && PL ? PL.tag.get(sq) : null;
          window.__deaths.push({ st, s: +(window.__fr / 60).toFixed(1), f: window.__fr, cause, src: PL ? PL.bucket(hitC) : null, cls: PL && PL.cls ? PL.cls(hitC, tg && tg.by) : null, at: trapAt ? trapAt.at.slice(0, 3) : null, lives: h.G.lives, x: Math.round(pre.x), y: Math.round(pre.y), kit: pre.kit,
            shot: tg ? { age: sq.t != null ? sq.t : window.__fr - tg.f, sd: Math.round(tg.sd), atRsp: X.rspShots.has(sq), sinceInv: X.invEnd != null ? window.__fr - X.invEnd : null, by: tg.by } : null, rank1: null, rebuild_s: { k0: null, kit: null, k0w: null } });
          X.pendRank = window.__deaths.length - 1; }
        else if ((h.P.shield || 0) < pre.sh) window.__hits[cause] = (window.__hits[cause] || 0) + 1; }
      else if (X.pendRank != null && PL && window.__fr > window.__deaths[X.pendRank].f) { window.__deaths[X.pendRank].rank1 = PL.rank(); X.pendRank = null; }
      if (h && h.G && h.state === 'play') { window.__fr++; if (h.G.boss && !h.G.boss.dying && !h.G.tally) { const k = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`; window.__bf[k] = (window.__bf[k] || 0) + 1; }
        const P = h.P, st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`;
        if (PL && P) { PL.tagShots(h, window.__fr); if (!h.G.tally && !h.G.fork) PL.bulFrame(h, st);
          if (window.__W) for (const q of window.__W.eshots) { if ('rev' in q) X.revTag = true; if (q.rev && !X.revSeen.has(q)) { X.revSeen.add(q); X.rev++; } }
          { const r = PL.rank(); if (r !== X.lastRank) { X.rank.push([window.__fr, st, r]); X.lastRank = r; } if (st !== X.lastStage) { X.rankAt[st] = r; X.lastStage = st; }
            if (h.G.boss && !X.bossSeen) { X.bossSeen = true; X.rankDrive = r; X.driveKit = { slots: slotsOf(P), gm: h.G.gm ? Object.fromEntries(Object.entries(h.G.gm).filter(([, v]) => v)) : {}, p: PL.mods.RK && PL.mods.RK.rankP ? PL.mods.RK.rankP(P, h.G) : null }; } if (!h.G.boss) X.bossSeen = false; } }
        if (P) { // respawns and restarts after a death: a new P object (resetPlayer); a restart also rewinds the scroll
          if (X.lastP && P !== X.lastP && P.alive && window.__deaths.some((d) => d.rsp == null)) { const restart = h.G.scroll < X.lastSc - 4; X.rsp.push({ f: window.__fr, st, restart, n: 0, rec: 0, got: 0, caps: new WeakSet(h.caps), recSeen: new WeakSet(h.caps) }); X.invEnd = null; // caps already out are not recovery pods (qa-lead review)
            if (window.__W) for (const q of window.__W.eshots) X.rspShots.add(q);
            for (const d of window.__deaths) if (d.rsp == null) { d.rsp = X.rsp.length - 1; d.restart = restart; } }
          if (X.invEnd == null && X.rsp.length && P.alive && P.inv <= 0) X.invEnd = window.__fr;
          X.lastP = P; X.lastSc = h.G.scroll;
          const sl = slotsOf(P); if (X.k0 == null && isK0(sl)) X.k0 = window.__fr; if (X.k1 == null && isK1(sl)) X.k1 = window.__fr;
          if (P.alive) for (const d of window.__deaths) if (d.rsp != null) { const r0 = X.rsp[d.rsp].f;
            if (d.rebuild_s.k0 == null && isK0(sl)) d.rebuild_s.k0 = +((window.__fr - r0) / 60).toFixed(1);
            if (d.rebuild_s.k0w == null && isK0([...sl.slice(0, 6), 1])) d.rebuild_s.k0w = +((window.__fr - r0) / 60).toFixed(1); // E6 read as 'K0 minus WARD' (pending amendment, tune-tc)
            if (d.rebuild_s.kit == null && has(sl, d.kit)) d.rebuild_s.kit = +((window.__fr - r0) / 60).toFixed(1);
            if (d.rebuild_s.kitEq == null && hasEq(sl, d.kit)) d.rebuild_s.kitEq = +((window.__fr - r0) / 60).toFixed(1); } // kitEq: the gun pairs as one slot (economy.ts rebuildMul's reading: ARC for SPLIT, PYRE n for MISSILE n+1)
          const r = X.rsp[X.rsp.length - 1];
          if (r && window.__fr - r.f <= 600) for (const c of h.caps) if (!r.caps.has(c)) { r.caps.add(c); r.n++; } } }
      if (before && h && h.P) { const seen = new Set(h.caps); let chosen = false;
        // where each new cap came from, read off what died this frame (measure-only; see the header's `src`)
        const had = new Set(before), nowE = new Set(h.enemies), gone = beforeE.filter((e) => e.dead || !nowE.has(e));
        const rec = (e) => e.rec || (e.group && e.group.rec), open = (e) => e.open || (e.group && e.group.open); // formation()'s `fixed` means "exactly n" (spawn.ts), not an opening carrier
        // round-4 integration (E2 fixed:open, measure-only): an opener's pod is the one its group drops at its LAST kill
        // (update.ts killEnemy: group.killed === group.n), pushed after that member's own cap (e.cap, a random carrier pod),
        // so the member's own cap is 'carrier', never fixed:open (it read 11-12 of 10 on some seeds); and a pod taken on the
        // frame it drops never shows in caps: G.redN (every non-recovery dropCap counts one, long4) says how many dropped
        // unseen, and an opener group that finished this frame with no visible pod of its own takes one of them
        const OD = (window.__openDone ||= new WeakSet()), fresh = h.caps.filter((c) => !had.has(c) && !window.__capSrc.has(c)), plainC = (c) => !c.rec && !c.choice && !c.salv && !c.graft;
        const openCap = new Set(), openUnseen = [];
        for (const e of gone) { const g2 = e.group; if (!g2 || !g2.open || (e.hp || 0) > 0 || (g2.killed || 0) < (g2.n || 0) || OD.has(g2)) continue; OD.add(g2);
          const near = fresh.filter((c) => plainC(c) && !openCap.has(c) && (c.x - e.x) ** 2 + (c.y - e.y) ** 2 < 40 * 40);
          if (near.length >= (e.cap ? 2 : 1)) openCap.add(near[near.length - 1]); else openUnseen.push(e); } // the later push is the group's pod
        const genSrc = () => gone.some(rec) ? 'rec' : gone.some((e) => e.mid || e.k === 'maw') ? 'fixed:mid' : gone.some((e) => e.group && e.group.pod && !e.group.open) ? 'fixed:release' : gone.some((e) => e.cap) ? 'carrier'
          : gone.some((e) => e.group) ? 'formation' : h.G.mini && h.G.mini.k === 'ufo' && !h.G.mini.dead ? 'fixed:saucer' : 'unknown';
        for (const c of fresh) window.__capSrc.set(c, c.rec ? 'rec' : c.choice ? 'fixed:choice' : c.salv ? 'salv' : c.graft ? 'graft' : openCap.has(c) ? 'fixed:open' : c.blue ? 'blue' : genSrc());
        // the unseen ones (ΔredN past the plain caps that showed): picked up on their drop frame, so they are pickups too
        { const unseen = Math.max(0, (h.G.redN || 0) - (window.__redN0 || 0) - fresh.filter(plainC).length), st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`, DR = (window.__drops ||= {}), OG = (window.__openG ||= new Map());
          // a blue taken on its drop frame (every 12th redN step, notice.ts blueAt; an owed blue lands on a non-opener) is a
          // blue, not a power pod: the steps in (redN0, redN] that are blue, less the blues that showed (review note)
          let blues = 0; for (let n = (window.__redN0 || 0) + 1; n <= (h.G.redN || 0); n++) if (n % 12 === 0) blues++;
          blues = Math.max(0, blues - fresh.filter((c) => plainC(c) && c.blue).length);
          for (let k = 0; k < unseen; k++) { const oe = openUnseen.shift(), bl = !oe && blues > 0 && (blues--, true), src = oe ? 'fixed:open' : bl ? 'blue' : genSrc();
            (DR[st] ||= {})[src] = (DR[st][src] || 0) + 1; if (oe && OG.has(oe.group)) OG.get(oe.group).paid++;
            window.__pods.push({ f: window.__fr, kind: bl ? 'blue' : 'pod', ty: null, full: 0, src, st, same: 1 }); } }
        // drops[] (W6 round 3, gate E2, measure-only): every cap that appeared, by stage and src, picked up or not (pods[] keeps
        // the pickups); openG[]: each authored opening formation (group.open): members seen, killed, and whether it paid
        { const st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`, DR = (window.__drops ||= {}), OG = (window.__openG ||= new Map());
          for (const c of h.caps) if (!had.has(c) && !(window.__dropSeen ||= new WeakSet()).has(c)) { window.__dropSeen.add(c); const k = window.__capSrc.get(c) || 'unknown'; (DR[st] ||= {})[k] = (DR[st][k] || 0) + 1; if (k === 'fixed:open') { const e = gone.find((e) => open(e) && e.group && OG.has(e.group) && (c.x - e.x) ** 2 + (c.y - e.y) ** 2 < 40 * 40) || gone.find((e) => open(e) && e.group && OG.has(e.group)); if (e) OG.get(e.group).paid++; } } // once per opener pod, to its own group
          for (const e of h.enemies) if (e.group && e.group.open && !OG.has(e.group)) OG.set(e.group, { st, s: +(window.__fr / 60).toFixed(1), n: e.group.n || null, seen: new WeakSet(), ns: 0, killed: 0, paid: 0 });
          for (const e of h.enemies) if (e.group && OG.has(e.group)) { const o = OG.get(e.group); if (!o.seen.has(e)) { o.seen.add(e); o.ns++; } }
          if (window.__otr) for (const [g, o] of OG) if (o.st !== '1-1' && window.__fr % 6 === 0 && h.enemies.some((e) => e.group === g)) { const W_ = window.__W, sc = h.G.scroll; // --open-trace (measure-only): the biome openers frame by frame
            if (!o.sc) o.sc = (h.G.script || []).filter((q) => Math.abs(q.x - sc) < 700).map((q) => [Math.round(q.x - sc), q.k]); // the script around its spawn (scroll-relative)
            (o.tr ||= []).push([window.__fr, Math.round(h.P.x), Math.round(h.P.y), h.enemies.filter((e) => e.group === g && !e.dead).map((e) => [e.i, Math.round(e.x), Math.round(e.y), +(e.hp || 0).toFixed(2), W_ ? Math.round(W_.ceilAt(e.x + sc)) : null, W_ ? Math.round(W_.floorAt(e.x + sc)) : null]), (window.__W && window.__W.shots ? window.__W.shots.length : null), h.enemies.filter((e) => !e.dead && e.group !== g && e.x < 490).map((e) => [e.k, Math.round(e.x), Math.round(e.y), +(e.hp || 0).toFixed(1)]), h.caps.map((c) => [Math.round(c.x), Math.round(c.y)]), h.G.fork ? 1 : 0, h.G.state]); }
          for (const e of gone) if (e.group && OG.has(e.group) && !(window.__ogGone ||= new WeakSet()).has(e)) { window.__ogGone.add(e); const o = OG.get(e.group); if ((e.hp || 0) <= 0) o.killed++; else (o.esc ||= []).push({ i: e.i, age: e.t, x: Math.round(e.x), y: Math.round(e.y), y0: Math.round(e.y0 || 0), px: Math.round(h.P.x), py: Math.round(h.P.y), alive: h.P.alive ? 1 : 0 }); } } // esc[] (W6 round 3, gate E2 fixed:open, measure-only): each member that left alive, where and when; each member once (a member killed after its own update stays in the array a frame and was counted twice)
        // E1: a recovery pod (spawn.ts recoveryWave: c.rec on the pod, or dropped by a rec carrier) inside a respawn's 10 s
        { const r = X.rsp[X.rsp.length - 1]; if (r && window.__fr - r.f <= 600) for (const c of h.caps) if (window.__capSrc.get(c) === 'rec' && !r.recSeen.has(c)) { r.recSeen.add(c); r.rec++; } }
        for (const c of before) if (!seen.has(c) && c.x >= -12 && (c.x - h.P.x) ** 2 + (c.y - h.P.y) ** 2 < 20 * 20) {
          const kind = c.graft ? 'graft' : c.blue ? 'blue' : c.choice ? 'choice' : c.salv ? 'salv' : 'pod';
          if (kind === 'choice') { if (chosen) continue; chosen = true; }
          const r = X.rsp[X.rsp.length - 1]; if (r && window.__fr - r.f <= 600 && r.caps.has(c)) r.got++;
          window.__w6 = window.__capSrc.get(c) || 'unknown'; // any pod taken this tick: K0 FIRST and the re-roll can turn it into WARD (qa-lead)
          window.__pods.push({ f: window.__fr, kind, ty: c.ty, full: c.full ? 1 : 0, src: window.__capSrc.get(c) || 'unknown', st: `${h.G.loop + 1}-${(h.G.stage || 0) + 1}` }); } }
      if (wq && h && h.P) window.__wardLedger(wq, h);
      if (h && h.G) { const m = h.G.mini, F = (window.__fights ||= []), cur = F.length ? F[F.length - 1] : null; // fights[] (measure-only): each held midboss / Maw, killed or not
        if (m && (!cur || cur.e !== m)) F.push({ e: m, k: m.k, st: `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`, f0: window.__fr, f1: null, hp: 1, out: null });
        for (const c of F) if (c.f1 == null && (c.e.dead || h.G.mini !== c.e)) { c.f1 = window.__fr; c.hp = +Math.max(0, (c.e.hp || 0) / (c.e.max || 1)).toFixed(2); c.out = (c.e.hp || 0) <= 0 && !c.e.gone ? 'kill' : 'left'; /* gone: it withdrew (ufo.ts), even at 0 hp sliding off */ } } } }; }, [+SEED, MORTAL, PIL, PARK, HULL, KITP, DRIFT, RB, KITS.end]);
const qs = [TIER != null ? 'tier=' + TIER : '', BRU != null ? 'brutal=' + BRU : ''].filter(Boolean).join('&');
await p.goto(qs ? url + (url.includes('?') ? '&' : '?') + qs : url); await p.waitForFunction(() => window.__started);
await useLayout(p, 'pod-probe', { quiet: true }); // stdout stays one JSON object; it carries the layout
// --hull N: REINFORCED HULL bought N times on the profile. The ships are the game's own: the probe used to force
// lives to 2 + N, but W2 gives every profile 3 ships in Descent 1 (HULL's ship arrives at the Descent 2 gate), so
// `lives0` is read from the run, never set
if (HULL) await p.evaluate(async (h) => { (await import('/src/state.ts')).$.meta.lv.hull = h; }, HULL);
const RIGS = RIG ? await p.evaluate(async () => { // --rig full: own everything, every socket, the three heaviest bolted at level 3
  const S = await import('/src/state.ts'), C = await import('/src/contraptions.ts'), POW = await import('/src/power.ts'), m = S.$.meta;
  const ids = C.RIG.map((r) => r.id), w = (POW.POWER && POW.POWER.rig) || {};
  m.own = [...ids]; m.lv = m.lv || {}; m.lv.socket = C.SOCKET_COST.length; m.cl = Object.fromEntries(ids.map((id) => [id, 3]));
  m.rig = [...ids].sort((a, b) => (w[b] || 0) - (w[a] || 0)).slice(0, C.sockets());
  return m.rig.slice();
}) : null;
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
const MODS = await p.evaluate(async () => { window.__fr = 0; window.__pods.length = 0; window.__S = (await import('/src/state.ts')).$; window.__W = await import('/src/world.ts'); window.__FL = await import('/src/flow.ts'); window.__BU = await import('/src/boss/update.ts'); window.__DN = await import('/src/enemies/mid/_deny.ts'); if (window.__pilotLoad) await window.__pilotLoad(); return window.__PL.load(); });
let last = '', lastFork = false; const tally = {}, grades = {}, warns = []; const k0 = (s) => `${s.loop + 1}-${(s.stage || 0) + 1}`; const seg = []; let endState = '';
for (let it = 0; it < MIN * 60 * 2; it++) {
  await p.evaluate('__tick(30)');
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, stage: G.stage, loop: G.loop, lvl: G.lvl, pick: !!G.pick, pt: G.pick ? G.pick.t : 0, fork: !!G.fork, fr: window.__fr, bio: Math.round(G.bio || 0), kills: G.kills, tally: G.tally ? [G.tally.id, G.tally.secs] : null, gr: G.tally ? { g: G.tally.g, gradeBio: Math.round(G.tally.bio || 0), hits: G.tally.hits, deaths: G.tally.deaths, pct: G.tally.pct, spawned: G.st ? G.st.spawned : null, lvl: G.lvl, bio: Math.round(G.bio || 0), score: Math.round(G.score || 0), fk: Object.keys(window.__S.meta.mbK || {}).length } : null, lives: G.lives,
    kit: { xpTot: G.xpTot != null ? Math.round(G.xpTot * 10) / 10 : null, pow: G.pow != null ? +G.pow.toFixed(3) : null, rank: window.__PL.rank(), lvl: G.lvl, slots: g.P ? [g.P.speed, g.P.missile, g.P.double, g.P.laser, g.P.pyre, g.P.options, g.P.wardLv || 0, Math.round((g.P.shield || 0) * 100) / 100] : null, pk: G.pk ? { ...G.pk } : null, gm: G.gm ? Object.fromEntries(Object.entries(G.gm).filter(([, v]) => v)) : null },
    warn: G.banner && G.banner.text === 'WARNING' && G.banner !== window.__wb ? ((window.__wb = G.banner), G.banner.sub || '?') : null }; });
  if (s.tally) { tally[s.tally[0]] = s.tally[1]; if (!grades[s.tally[0]]) grades[s.tally[0]] = { ...s.gr, kit: s.kit }; }
  if (s.warn) warns.push({ stage: k0(s), f: s.fr, title: s.warn, kit: s.kit });
  if (s.fork && !lastFork) await p.evaluate(() => (window.__gi = (window.__gi ?? 0) + 1));
  lastFork = s.fork;
  const k = `${s.loop + 1}-${(s.stage || 0) + 1}`;
  if (process.env.DBG && it % 20 === 0) console.log(await p.evaluate(() => { const g = __G(), G = g.G; return `${(window.__fr/60).toFixed(0)}s ${g.state} st${G.loop+1}-${(G.stage||0)+1} scroll${Math.round(G.scroll)} kills${G.kills} lv${G.lvl} pick${!!G.pick} fork${!!G.fork} tally${!!G.tally} boss${!!G.boss} mini${G.mini&&!G.mini.dead?G.mini.k:''} en${g.enemies.filter(e=>!e.dead).map(e=>e.k).slice(0,6)} P${Math.round(g.P.x)},${Math.round(g.P.y)} caps${g.caps.length}`; }));
  if (k !== last) { seg.push({ k, f0: s.fr, lvl: s.lvl, bio: s.bio, kills: s.kills }); last = k; }
  if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  if (s.st === 'shop') { await p.evaluate('__tick(40)'); await key('keydown', 'Backspace'); await p.evaluate('__tick(1)'); await key('keyup', 'Backspace'); await p.evaluate('__tick(1)'); await key('keydown', 'Backspace'); await p.evaluate('__tick(1)'); await key('keyup', 'Backspace'); await p.evaluate('__tick(40)'); continue; } // the loop shop's back takes two presses (ls1-audit)
  if (s.st !== 'play' || s.loop >= +END) { endState = JSON.stringify(s); break; }
}
const fin = await p.evaluate(() => { const g = __G(), G = g.G, X = window.__x; return { deaths: window.__deaths, hitLog: window.__hits, lives0: window.__lives0, fr: window.__fr, pods: window.__pods, bio: Math.round(G.bio || 0), lvl: G.lvl, kills: G.kills, st: g.state, bf: window.__bf, fk: Object.keys(window.__S.meta.mbK || {}),
  tier: Number.isInteger(G.tier) ? G.tier : 'n/a', brutal: G.brutal != null ? G.brutal : window.__PL.mods.BR ? 0 : 'n/a', bul: window.__PL.bul, rank: X.rank, rankAt: X.rankAt, rsp: X.rsp.map(({ caps, recSeen, ...r }) => r), rev: X.revTag ? X.rev : 'n/a', rankDrive: X.rankDrive ?? null, driveKit: X.driveKit || null, drops: window.__drops || {}, openG: [...(window.__openG || new Map()).values()].map(({ seen, ...o }) => o), fights: (window.__fights || []).map(({ e, ...c }) => ({ ...c, s: +(c.f0 / 60).toFixed(1), dur: c.f1 != null ? +((c.f1 - c.f0) / 60).toFixed(1) : null, hp: c.f1 != null ? c.hp : +((e.hp || 0) / (e.max || 1)).toFixed(2) })), wl: (() => { const L = window.__wl; return { sup: L.sup, spent: L.spent, spent0: L.spent0, left: { ...L.left, ...L.stk.reduce((a, c) => ((a[c.src + '@end'] = +((a[c.src + '@end'] || 0) + c.amt).toFixed(2)), a), {}) }, grz: L.grz, grzAmt: +L.grzAmt.toFixed(2), hits: L.hits }; })(), contractErr: window.__PL.contractErr, lobMax: +window.__PL.lobMax.toFixed(2), k0: X.k0, k1: X.k1, stuck: X.stuck || 0, score: Math.round(G.score || 0) }; });
seg.push({ k: 'END', f0: fin.fr });
// E6 (W6 round 3, post-processing only): each death's censor horizon, the seconds from its respawn to the next death (or
// the run's end), so a null rebuild reads 'not within h s', not a missing sample; and its kit's class against K0 (k0 =
// exactly K0's levels in every slot it has, above = more than K0 somewhere, below = short of K0). The kit half of E6
// (120-240 s back to the death kit) is the spec's END D1 example: a death holding more than K0
for (const d of fin.deaths) { const r = d.rsp != null ? fin.rsp[d.rsp] : null, nx = r ? fin.deaths.find((q) => q.f > r.f) : null;
  d.rebuild_s.horizon = r ? +(((nx ? nx.f : fin.fr) - r.f) / 60).toFixed(1) : 0;
  const k = d.kit, ge = k[0] >= 2 && (k[1] >= 1 || k[4] >= 1) && (k[2] >= 1 || k[3] >= 1) && k[5] >= 1 && k[6] >= 1;
  d.kitClass = !ge ? 'below' : k[0] > 2 || k[1] > 1 || k[4] > 1 || k[5] > 1 || k[6] > 1 ? 'above' : 'k0'; } // ARC and PYRE 1 are K0 forms, like SPLIT and MISSILE 1
const podsOnly = fin.pods.filter((x) => x.kind === 'pod' || x.kind === 'choice');
const first = podsOnly[0];
const stages = seg.slice(0, -1).map((sg, i) => { const f1 = seg[i + 1].f0; const n = podsOnly.filter((x) => x.f >= sg.f0 && x.f < f1).length; const dur = (f1 - sg.f0) / 60;
  const kinds = fin.pods.filter((x) => x.f >= sg.f0 && x.f < f1).reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {});
  const src = fin.pods.filter((x) => x.f >= sg.f0 && x.f < f1).reduce((a, x) => ((a[x.src] = (a[x.src] || 0) + 1), a), {});
  const types = podsOnly.filter((x) => x.f >= sg.f0 && x.f < f1).map((x) => (x.ty ?? '?') + (x.src === 'rec' ? 'r' : '')).join(''); // the slot of each pod taken (player.ts SLOTS 0-6; r = a recovery pod)
  return { stage: sg.k, dur: +dur.toFixed(1), pods: n, types, kinds, src, ppm: +(n / (dur / 60)).toFixed(2), lvlAtStart: sg.lvl, bioAtStart: sg.bio }; });
const tierN = Number.isInteger(fin.tier) ? fin.tier : 1;
const bullets = Object.fromEntries(Object.entries(fin.bul).map(([k, v]) => { const c = k.split('|').pop(), rq = (q) => hq(v.ratio, q);
  return [k, { frames: v.frames, cap: CAPS[c][tierN], overCap: v.over, overMax: v.overMax, p50: hq(v.ns, .5), p90: hq(v.ns, .9), max: hmax(v.ns), maxAll: hmax(v.n), gt5: v.frames ? +hshare(v.ns, 5).toFixed(3) : null, carriedFrames: v.carried || 0, vmax: +v.vmax.toFixed(2), vmaxKind: v.vk || null, vcap: VCAP[tierN], vOver: v.vOver, ratioP50: rq(.5), ratioP90: rq(.9) }]; }));
const shieldHits = Object.values(fin.hitLog).reduce((a, n) => a + n, 0);
const deathSrc = fin.deaths.reduce((a, d) => ((a[d.src || 'other'] = (a[d.src || 'other'] || 0) + 1), a), {});
const deathCls = fin.deaths.reduce((a, d) => ((a[d.cls || d.src || 'other'] = (a[d.cls || d.src || 'other'] || 0) + 1), a), {}); // g5: whip / doll / watcher split
console.log(JSON.stringify({ seed: +SEED, layout: LAYOUT, firstPod_s: first ? +(first.f / 60).toFixed(2) : null, firstPodKind: first && first.kind,
  podTimes_s: podsOnly.slice(0, 12).map((x) => +(x.f / 60).toFixed(1)), kinds: fin.pods.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {}),
  mortal: MORTAL, rebuild: RB, park: PARK, drift: DRIFT, hull: HULL, kit: KIT, rig: RIGS, react: PIL ? +(REACT ?? 0) : null, human: PIL && HUMAN ? 1 : 0, tierAsked: TIER, tier: fin.tier, brutal: fin.brutal, mods: MODS,
  deaths: fin.deaths, deathSrc, deathCls, hitLog: fin.hitLog, shieldHits, slack: shieldHits + fin.deaths.length, recovery: fin.rsp, revenge: fin.rev,
  botStuck: fin.stuck, k0_s: fin.k0 != null ? +(fin.k0 / 60).toFixed(1) : null, k1_s: fin.k1 != null ? +(fin.k1 / 60).toFixed(1) : null,
  rankTrace: fin.rank.every((r) => r[2] == null) ? null : fin.rank, rankAtStage: fin.rankAt, rankAtDrive: fin.rankDrive, driveKit: fin.driveKit, fights: fin.fights, drops: fin.drops, openG: fin.openG,
  ward: { fullHits: fin.wl.hits, grazes: fin.wl.grz, grazeDrain: fin.wl.grzAmt, supply: fin.wl.sup, spentHits: fin.wl.spent, spentHitsLife0: fin.wl.spent0, unspent: fin.wl.left }, lobMax: fin.lobMax, contractErr: fin.contractErr, bullets, bulletHist: fin.bul,
  lives0: fin.lives0, pilot: PIL ? await p.evaluate(() => window.__pilotLog) : null, stages, tally_s: tally, grades, warns, bossFight_s: Object.fromEntries(Object.entries(fin.bf).map(([k, f]) => [k, +(f / 60).toFixed(1)])), finalBio: fin.bio, finalScore: fin.score, firstKills: fin.fk, finalLvl: fin.lvl, kills: fin.kills, endState, errors: errs.slice(0, 3) }));
console.error(`pod-probe: ran on ${LAYOUT}`); await b.close();
