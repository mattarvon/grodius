// Seeded pacing probe: progression.mjs bot + pick/fork/shop handling, seeded RNG,
// per-frame pod-pickup timestamps, per-stage pods/min, bio per descent.
// Usage: node tools/pod-probe.mjs <url> <seed> [minutes=12] [endLoop=1] [--layout long4|short] [--mortal] [--pilot | --park] [--hull N] [--kit mid|full] [--brutal 0-3 | --tier 0-3] [--drift] [--rig full]
// --pilot: steer with the dodging autopilot (tools/pilot.mjs) instead of the plain target-seeker; use it with --mortal
// (the plain bot game-overs in long4's first biome). Its frames with no safe move are reported as `pilot.trapped`.
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
//   build has no tier), `overCap` frames whose counted shots (every eshot but haz ones) exceed it and the worst count,
//   on-screen p50 / p90 / max and the share of frames above 5 (B2), the fastest shot and the frames' shots over V_CAP,
//   and the shot speed / ship speed ratio p50 / p90 (S1). `bulletHist` keeps the raw histograms for cross-seed sums.
//   `rankTrace`: [frame, stage, rank] every frame src/rank.ts rank($) changes (null on a build without rank.ts);
//   `rankAtStage` the rank on entering each stage, `rankAtDrive` the rank the frame the Drive (G.boss) appears (R1). `deaths[]` add: `rank1` (rank 1 frame after the death, D1),
//   `kit` (the slots that died), `src` (terrain / solid / hazard / body / bullet / other, M3: read from probe-lib
//   PL.cause, the exact overlaps padded by one frame of motion, shot first; a cause found only by the old proximity
//   guess is marked ~), `shot` for a shot death (null when the shot spawned and hit inside one step):
//   { age (its own frame counter s.t), sd (its spawn distance from the ship, px), atRsp (it existed when the ship
//   last respawned), sinceInv (frames since that respawn's i-frames ended), by (the shooter's kind) } (F1),
//   `rebuild_s` { k0, kit }: seconds from control returning to K0 and to the death's own kit (null = never) (E6),
//   `restart` (a checkpoint restart rather than a respawn in place). `recovery[]`: per respawn or restart, the pods
//   that appeared within 10 s (`n`), those tagged rec, and those picked up (E1). `slack` = WARD hits + deaths,
//   `shieldHits` the WARD hits (H1, H2). `revenge`: enemy shots flagged rev (D3; 'n/a' when no shot carries a rev field).
//   `k0_s` / `k1_s`: first second the ship held K0 / K1 (E2, E3). `grades[].score`: G.score at each tally.
//   Pickup `src` adds `rec` (a recovery pod: c.rec, e.rec or group.rec) and `fixed:open` (an authored opening
//   carrier: e.open or group.open; assumed field names, to pin in spec §5.6) ahead of the older tags. `recovery[]`
//   counts only caps that appear after the respawn. `contractErr`: a future module that answered in another shape. `mods` lists which optional modules the build has.
import { chromium } from 'playwright';
import { useLayout, LAYOUT } from './layout-arg.mjs';
import { PILOT } from './pilot.mjs';
import { pageLib, CAPS, VCAP, hq, hmax, hshare } from './probe-lib.mjs';
const flag = (n) => { const i = process.argv.indexOf(n); if (i < 0) return false; process.argv.splice(i, 1); return true; };
const opt = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv.splice(i, 2)[1] : null; };
const MORTAL = flag('--mortal'), PIL = flag('--pilot'), PARK = flag('--park'), DRIFT = flag('--drift');
const BRU = opt('--brutal'); // D63: ?brutal=N (default: the game's)
const TIER = opt('--tier'); // spec §2.1: ?tier=N
if (TIER != null && !/^[0-3]$/.test(TIER)) { console.error('--tier needs 0-3'); process.exit(2); }
const KIT = opt('--kit'), HULL = +(opt('--hull') || 0), RIG = opt('--rig');
if (RIG && RIG !== 'full') { console.error('--rig takes full'); process.exit(2); }
const [url, SEED = '1', MIN = '12', END = '1'] = process.argv.slice(2);
// --kit bare|mid|full: the first life starts with src/jump.ts KITS[kit].p fitted (guns only; lives and level are the
// run's own). A death strips it as usual. With --park it asks Matt's question: once powered, can you just sit and fire?
// restated from src/jump.ts KITS (its extensionless imports don't load in Node); keep in step
const KITS = { bare: { p: {} }, mid: { p: { speed: 2, double: 1, missile: 1, options: 1 } }, full: { p: { speed: 4, laser: 1, missile: 2, pyre: 1, options: 3, wardLv: 2, shield: 3 } } };
const KITP = KIT ? KITS[KIT] : null; if (KIT && !KITP) { console.error(`unknown kit ${KIT}`); process.exit(2); }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
if (PIL) await p.addInitScript(PILOT);
await p.addInitScript(pageLib);
await p.addInitScript(([seed, mortal, pil, park, hull, kit, drift]) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); } catch (e) {}
  window.__pods = []; window.__capSrc = new WeakMap(); window.__fr = 0; window.__bf = {}; window.__deaths = []; window.__hits = {};
  const X = (window.__x = { rank: [], lastRank: undefined, rankAt: {}, rsp: [], rspShots: new WeakSet(), invEnd: null, lastP: null, pendRank: null, k0: null, k1: null, rev: 0, revSeen: new WeakSet(), lastSc: 0, lastStage: '' });
  const slotsOf = (P) => [P.speed || 0, P.missile || 0, P.double || 0, P.laser || 0, P.pyre || 0, P.options || 0, P.wardLv || 0];
  const isK0 = (s) => s[0] >= 2 && (s[1] >= 1 || s[4] >= 1) && (s[2] >= 1 || s[3] >= 1) && s[5] >= 1 && s[6] >= 1;
  const isK1 = (s) => s[0] >= 3 && (s[1] >= 2 || s[4] >= 1) && (s[2] >= 1 || s[3] >= 1) && s[5] >= 2 && s[6] >= 2;
  const has = (s, k) => k.every((v, i) => s[i] >= v);
  // what was touching the ship the frame before a hit or a death (see the header's `deaths[]`); the shot is kept so
  // its tag (age, spawn distance) can be read
  window.__near = (g) => { const P = g.P, G = g.G, W_ = window.__W, PL = window.__PL; let best = null, bd = 1e9, shot = null; const put = (c, d, q) => { if (d < bd) { bd = d; best = c; shot = q || null; } };
    const ctx0 = G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? (G.mini.mid ? 'mid:' : 'boss:') + G.mini.k : '';
    if (PL && PL.mods.W) { const k = PL.cause(g); if (k.c) return { c: k.c, ctx: ctx0, shot: k.shot }; } // exact overlap first (qa-lead review); the proximity guess below is marked ~
    if (W_) { for (const q of W_.eshots) { const d = (q.x - P.x) ** 2 + (q.y - P.y) ** 2; if (d < 26 * 26) put('shot:' + (q.k || 'orb'), d, q); }
      const wx = P.x + G.scroll; if (P.y + 6 >= W_.floorAt(wx) || P.y - 6 <= W_.ceilAt(wx)) put('terrain', 0);
      else if (PL && PL.solids(wx).some(([a, b]) => P.y + 6 >= a && P.y - 6 <= b)) put('solid', 0); }
    for (const e of g.enemies) if (!e.dead) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2, r = (e.r || 8) + 14; if (d < r * r) put('body:' + e.k, d + 1); }
    const bi = globalThis.__biome && globalThis.__biome(); if (bi && bi.haz) for (const h of bi.haz) if (Math.abs(h.x - P.x) < 12) put('haz:' + h.k + (h.aim ? '(aimed)' : ''), 2);
    const ctx = G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? (G.mini.mid ? 'mid:' : 'boss:') + G.mini.k : '';
    return { c: best ? (PL && PL.mods.W ? '~' : '') + best : 'other', ctx, shot }; };
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); let before = null, beforeE = null;
      if (g && g.P && g.state === 'play') { if (window.__lives0 == null) { if (hull) g.G.lives = Math.max(g.G.lives, 2 + hull); if (kit) Object.assign(g.P, kit.p); window.__lives0 = g.G.lives; } if (!mortal) { g.P.inv = 30; g.P.alive = true; } const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
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
        before = g.caps.slice(); beforeE = g.enemies.slice(); }
      const pre = mortal && g && g.P && g.state === 'play' && g.P.alive && g.P.inv <= 1 ? { sh: g.P.shield || 0, n: window.__near(g), x: g.P.x, y: g.P.y, kit: slotsOf(g.P) } : null;
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G(), PL = window.__PL;
      if (pre && h && h.P) { const st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`, cause = pre.n.c + (pre.n.ctx ? ' @' + pre.n.ctx : '');
        if (!h.P.alive || h.state === 'over') { const sq = pre.n.shot, tg = sq && PL ? PL.tag.get(sq) : null;
          window.__deaths.push({ st, s: +(window.__fr / 60).toFixed(1), f: window.__fr, cause, src: PL ? PL.bucket(pre.n.c) : null, lives: h.G.lives, x: Math.round(pre.x), y: Math.round(pre.y), kit: pre.kit,
            shot: tg ? { age: sq.t != null ? sq.t : window.__fr - tg.f, sd: Math.round(tg.sd), atRsp: X.rspShots.has(sq), sinceInv: X.invEnd != null ? window.__fr - X.invEnd : null, by: tg.by } : null, rank1: null, rebuild_s: { k0: null, kit: null } });
          X.pendRank = window.__deaths.length - 1; }
        else if ((h.P.shield || 0) < pre.sh) window.__hits[cause] = (window.__hits[cause] || 0) + 1; }
      else if (X.pendRank != null && PL && window.__fr > window.__deaths[X.pendRank].f) { window.__deaths[X.pendRank].rank1 = PL.rank(); X.pendRank = null; }
      if (h && h.G && h.state === 'play') { window.__fr++; if (h.G.boss && !h.G.boss.dying && !h.G.tally) { const k = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`; window.__bf[k] = (window.__bf[k] || 0) + 1; }
        const P = h.P, st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`;
        if (PL && P) { PL.tagShots(h, window.__fr); if (!h.G.tally && !h.G.fork) PL.bulFrame(h, st);
          if (window.__W) for (const q of window.__W.eshots) { if ('rev' in q) X.revTag = true; if (q.rev && !X.revSeen.has(q)) { X.revSeen.add(q); X.rev++; } }
          { const r = PL.rank(); if (r !== X.lastRank) { X.rank.push([window.__fr, st, r]); X.lastRank = r; } if (st !== X.lastStage) { X.rankAt[st] = r; X.lastStage = st; }
            if (h.G.boss && !X.bossSeen) { X.bossSeen = true; X.rankDrive = r; } if (!h.G.boss) X.bossSeen = false; } }
        if (P) { // respawns and restarts after a death: a new P object (resetPlayer); a restart also rewinds the scroll
          if (X.lastP && P !== X.lastP && P.alive && window.__deaths.some((d) => d.rsp == null)) { const restart = h.G.scroll < X.lastSc - 4; X.rsp.push({ f: window.__fr, st, restart, n: 0, rec: 0, got: 0, caps: new WeakSet(h.caps) }); X.invEnd = null; // caps already out are not recovery pods (qa-lead review)
            if (window.__W) for (const q of window.__W.eshots) X.rspShots.add(q);
            for (const d of window.__deaths) if (d.rsp == null) { d.rsp = X.rsp.length - 1; d.restart = restart; } }
          if (X.invEnd == null && X.rsp.length && P.alive && P.inv <= 0) X.invEnd = window.__fr;
          X.lastP = P; X.lastSc = h.G.scroll;
          const sl = slotsOf(P); if (X.k0 == null && isK0(sl)) X.k0 = window.__fr; if (X.k1 == null && isK1(sl)) X.k1 = window.__fr;
          if (P.alive) for (const d of window.__deaths) if (d.rsp != null) { const r0 = X.rsp[d.rsp].f;
            if (d.rebuild_s.k0 == null && isK0(sl)) d.rebuild_s.k0 = +((window.__fr - r0) / 60).toFixed(1);
            if (d.rebuild_s.kit == null && has(sl, d.kit)) d.rebuild_s.kit = +((window.__fr - r0) / 60).toFixed(1); }
          const r = X.rsp[X.rsp.length - 1];
          if (r && window.__fr - r.f <= 600) for (const c of h.caps) if (!r.caps.has(c)) { r.caps.add(c); r.n++; if (c.rec) r.rec++; } } }
      if (before && h && h.P) { const seen = new Set(h.caps); let chosen = false;
        // where each new cap came from, read off what died this frame (measure-only; see the header's `src`)
        const had = new Set(before), nowE = new Set(h.enemies), gone = beforeE.filter((e) => e.dead || !nowE.has(e));
        const rec = (e) => e.rec || (e.group && e.group.rec), open = (e) => e.open || (e.group && e.group.open); // formation()'s `fixed` means "exactly n" (spawn.ts), not an opening carrier
        for (const c of h.caps) if (!had.has(c) && !window.__capSrc.has(c)) window.__capSrc.set(c, c.rec ? 'rec' : c.choice ? 'fixed:choice' : c.salv ? 'salv' : c.graft ? 'graft' : c.blue ? 'blue'
          : gone.some(rec) ? 'rec' : gone.some(open) ? 'fixed:open'
          : gone.some((e) => e.mid || e.k === 'maw') ? 'fixed:mid' : gone.some((e) => e.group && e.group.pod) ? 'fixed:release' : gone.some((e) => e.cap) ? 'carrier'
          : gone.some((e) => e.group) ? 'formation' : h.G.mini && h.G.mini.k === 'ufo' && !h.G.mini.dead ? 'fixed:saucer' : 'unknown');
        for (const c of before) if (!seen.has(c) && c.x >= -12 && (c.x - h.P.x) ** 2 + (c.y - h.P.y) ** 2 < 20 * 20) {
          const kind = c.graft ? 'graft' : c.blue ? 'blue' : c.choice ? 'choice' : c.salv ? 'salv' : 'pod';
          if (kind === 'choice') { if (chosen) continue; chosen = true; }
          const r = X.rsp[X.rsp.length - 1]; if (r && window.__fr - r.f <= 600 && r.caps.has(c)) r.got++;
          window.__pods.push({ f: window.__fr, kind, src: window.__capSrc.get(c) || 'unknown', st: `${h.G.loop + 1}-${(h.G.stage || 0) + 1}` }); } } } }; }, [+SEED, MORTAL, PIL, PARK, HULL, KITP, DRIFT]);
const qs = [TIER != null ? 'tier=' + TIER : '', BRU != null ? 'brutal=' + BRU : ''].filter(Boolean).join('&');
await p.goto(qs ? url + (url.includes('?') ? '&' : '?') + qs : url); await p.waitForFunction(() => window.__started);
await useLayout(p, 'pod-probe', { quiet: true }); // stdout stays one JSON object; it carries the layout
if (HULL) await p.evaluate(async (h) => { (await import('/src/state.ts')).$.meta.lv.hull = h; }, HULL); // --hull N: REINFORCED HULL bought N times (a played profile's extra ships)
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
const MODS = await p.evaluate(async () => { window.__fr = 0; window.__pods.length = 0; window.__S = (await import('/src/state.ts')).$; window.__W = await import('/src/world.ts'); window.__BU = await import('/src/boss/update.ts'); window.__DN = await import('/src/enemies/mid/_deny.ts'); return window.__PL.load(); });
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
  tier: Number.isInteger(G.tier) ? G.tier : 'n/a', brutal: G.brutal != null ? G.brutal : window.__PL.mods.BR ? 0 : 'n/a', bul: window.__PL.bul, rank: X.rank, rankAt: X.rankAt, rsp: X.rsp.map(({ caps, ...r }) => r), rev: X.revTag ? X.rev : 'n/a', rankDrive: X.rankDrive ?? null, contractErr: window.__PL.contractErr, k0: X.k0, k1: X.k1, score: Math.round(G.score || 0) }; });
seg.push({ k: 'END', f0: fin.fr });
const podsOnly = fin.pods.filter((x) => x.kind === 'pod' || x.kind === 'choice');
const first = podsOnly[0];
const stages = seg.slice(0, -1).map((sg, i) => { const f1 = seg[i + 1].f0; const n = podsOnly.filter((x) => x.f >= sg.f0 && x.f < f1).length; const dur = (f1 - sg.f0) / 60;
  const kinds = fin.pods.filter((x) => x.f >= sg.f0 && x.f < f1).reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {});
  const src = fin.pods.filter((x) => x.f >= sg.f0 && x.f < f1).reduce((a, x) => ((a[x.src] = (a[x.src] || 0) + 1), a), {});
  return { stage: sg.k, dur: +dur.toFixed(1), pods: n, kinds, src, ppm: +(n / (dur / 60)).toFixed(2), lvlAtStart: sg.lvl, bioAtStart: sg.bio }; });
const tierN = Number.isInteger(fin.tier) ? fin.tier : 1;
const bullets = Object.fromEntries(Object.entries(fin.bul).map(([k, v]) => { const c = k.split('|').pop(), rq = (q) => hq(v.ratio, q);
  return [k, { frames: v.frames, cap: CAPS[c][tierN], overCap: v.over, overMax: v.overMax, p50: hq(v.ns, .5), p90: hq(v.ns, .9), max: hmax(v.ns), maxAll: hmax(v.n), gt5: v.frames ? +hshare(v.ns, 5).toFixed(3) : null, vmax: +v.vmax.toFixed(2), vmaxKind: v.vk || null, vcap: VCAP[tierN], vOver: v.vOver, ratioP50: rq(.5), ratioP90: rq(.9) }]; }));
const shieldHits = Object.values(fin.hitLog).reduce((a, n) => a + n, 0);
const deathSrc = fin.deaths.reduce((a, d) => ((a[d.src || 'other'] = (a[d.src || 'other'] || 0) + 1), a), {});
console.log(JSON.stringify({ seed: +SEED, layout: LAYOUT, firstPod_s: first ? +(first.f / 60).toFixed(2) : null, firstPodKind: first && first.kind,
  podTimes_s: podsOnly.slice(0, 12).map((x) => +(x.f / 60).toFixed(1)), kinds: fin.pods.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {}),
  mortal: MORTAL, park: PARK, drift: DRIFT, hull: HULL, kit: KIT, rig: RIGS, tierAsked: TIER, tier: fin.tier, brutal: fin.brutal, mods: MODS,
  deaths: fin.deaths, deathSrc, hitLog: fin.hitLog, shieldHits, slack: shieldHits + fin.deaths.length, recovery: fin.rsp, revenge: fin.rev,
  k0_s: fin.k0 != null ? +(fin.k0 / 60).toFixed(1) : null, k1_s: fin.k1 != null ? +(fin.k1 / 60).toFixed(1) : null,
  rankTrace: fin.rank.every((r) => r[2] == null) ? null : fin.rank, rankAtStage: fin.rankAt, rankAtDrive: fin.rankDrive, contractErr: fin.contractErr, bullets, bulletHist: fin.bul,
  lives0: fin.lives0, pilot: PIL ? await p.evaluate(() => window.__pilotLog) : null, stages, tally_s: tally, grades, warns, bossFight_s: Object.fromEntries(Object.entries(fin.bf).map(([k, f]) => [k, +(f / 60).toFixed(1)])), finalBio: fin.bio, finalScore: fin.score, firstKills: fin.fk, finalLvl: fin.lvl, kills: fin.kills, endState, errors: errs.slice(0, 3) }));
console.error(`pod-probe: ran on ${LAYOUT}`); await b.close();
