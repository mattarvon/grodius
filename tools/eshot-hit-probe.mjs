// ENEMY-SHOT HIT PROBE (Matt, BRUTAL: "some of the green enemy weapons pass through me"). pod-probe.mjs (below,
// unchanged) plus a measure-only pass over every enemy shot each frame: its path in the ship's frame from the last test
// to this one, and what became of each shot that came within 12 px of the core. Output `eh[kind]`:
//   touch        the path entered the core (shot r + 2.6)
//   consumedHit  ...and the shot was used up that frame (a hit, WARD, AEGIS)
//   passInv      ...and it flew on through i-frames (respawn 150 f, checkpoint 280 f, a WARD break 18 f, LAST GASP)
//   sameFrame    ...and it flew on because a sibling (the BRUTAL fan) hit first that frame and set i-frames
//   tunnel/other ...and it flew on with no i-frames: the point-tested miss the swept test (shots.ts EHIT) closes.
//                tunnel counts an i-frame pass too when both frame ends were outside (read step[][5], the inv)
//   visualOnly / vis[d]  it passed 4.6-12 px from the core (vis buckets by whole px): over the hull, outside the hitbox
// It keeps the ship's lives topped up (>= 5) so a mortal run flies on. Jump URLs (stage=) skip the title keys:
//   node tools/eshot-hit-probe.mjs "http://127.0.0.1:5201/?layout=long4&stage=ice&x=0&loop=2&kit=full&rank=2&seed=7" 3 3 9 --mortal --pilot --brutal 3
// ---- pod-probe.mjs's header ----
// Seeded pacing probe: progression.mjs bot + pick/fork/shop handling, seeded RNG,
// per-frame pod-pickup timestamps, per-stage pods/min, bio per descent.
// Usage: node tools/eshot-hit-probe.mjs <url> <seed> [minutes=12] [endLoop=1] [--layout long4|short] [--mortal] [--pilot | --park] [--hull N] [--kit mid|full] [--brutal 0-3]
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
import { chromium } from 'playwright';
import { useLayout, LAYOUT } from './layout-arg.mjs';
import { PILOT } from './pilot.mjs';
const mi = process.argv.indexOf('--mortal'), MORTAL = mi >= 0; if (MORTAL) process.argv.splice(mi, 1);
const pli = process.argv.indexOf('--pilot'), PIL = pli >= 0; if (PIL) process.argv.splice(pli, 1);
const pki = process.argv.indexOf('--park'), PARK = pki >= 0; if (PARK) process.argv.splice(pki, 1);
const bri = process.argv.indexOf('--brutal'), BRU = bri >= 0 ? process.argv.splice(bri, 2)[1] : null; // D63: ?brutal=N (read as Normal since W0)
const tri = process.argv.indexOf('--tier'), TIER = tri >= 0 ? process.argv.splice(tri, 2)[1] : null; // spec §2.1: ?tier=N
const kti = process.argv.indexOf('--kit'), KIT = kti >= 0 ? process.argv.splice(kti, 2)[1] : null;
const hui = process.argv.indexOf('--hull'), HULL = hui >= 0 ? +process.argv.splice(hui, 2)[1] : 0;
const [url, SEED = '1', MIN = '12', END = '1'] = process.argv.slice(2);
// --kit bare|mid|full: the first life starts with src/jump.ts KITS[kit].p fitted (guns only; lives and level are the
// run's own). A death strips it as usual. With --park it asks Matt's question: once powered, can you just sit and fire?
// restated from src/jump.ts KITS (its extensionless imports don't load in Node); keep in step
const KITS = { bare: { p: {} }, mid: { p: { speed: 2, double: 1, missile: 1, options: 1 } }, full: { p: { speed: 4, laser: 1, missile: 2, pyre: 1, options: 3, wardLv: 2, shield: 3 } } };
const KITP = KIT ? KITS[KIT] : null; if (KIT && !KITP) { console.error(`unknown kit ${KIT}`); process.exit(2); }
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
if (PIL) await p.addInitScript(PILOT);
await p.addInitScript(([seed, mortal, pil, park, hull, kit]) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); } catch (e) {}
  window.__pods = []; window.__capSrc = new WeakMap(); window.__fr = 0; window.__bf = {}; window.__deaths = []; window.__hits = {};
  // what was touching the ship the frame before a hit or a death (see the header's `deaths[]`)
  window.__near = (g) => { const P = g.P, G = g.G, W_ = window.__W; let best = null, bd = 1e9; const put = (c, d) => { if (d < bd) { bd = d; best = c; } };
    if (W_) { for (const q of W_.eshots) { const d = (q.x - P.x) ** 2 + (q.y - P.y) ** 2; if (d < 26 * 26) put('shot:' + (q.k || 'orb'), d); }
      const wx = P.x + G.scroll; if (P.y + 6 >= W_.floorAt(wx) || P.y - 6 <= W_.ceilAt(wx)) put('terrain', 0); }
    for (const e of g.enemies) if (!e.dead) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2, r = (e.r || 8) + 14; if (d < r * r) put('body:' + e.k, d + 1); }
    const bi = globalThis.__biome && globalThis.__biome(); if (bi && bi.haz) for (const h of bi.haz) if (Math.abs(h.x - P.x) < 12) put('haz:' + h.k + (h.aim ? '(aimed)' : ''), 2);
    const ctx = G.boss && !G.boss.dying ? 'drive' : G.mini && !G.mini.dead ? (G.mini.mid ? 'mid:' : 'boss:') + G.mini.k : '';
    return { c: best || 'other', ctx }; };
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); let before = null, beforeE = null;
      if (g && g.P && g.state === 'play') { if (window.__lives0 == null) { if (hull) g.G.lives = Math.max(g.G.lives, 2 + hull); if (kit) Object.assign(g.P, kit.p); window.__lives0 = g.G.lives; } if (!mortal) { g.P.inv = 30; g.P.alive = true; } const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; }
          else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss || g.enemies.find((e) => !e.dead); tx = 90; ty = m ? m.y : g.P.y; } }
        if (park) { /* --park: never move */ }
        else if (pil) window.__pilotStep(g, tx, ty);
        else if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); }
        before = g.caps.slice(); beforeE = g.enemies.slice(); }
      const PS = g && g.P && g.state === "play" && window.__W && g.P.alive ? { px: window.__lp ? window.__lp.x : g.P.x, py: window.__lp ? window.__lp.y : g.P.y, inv: g.P.inv, sh: g.P.shield || 0, alive: g.P.alive, lives: g.G.lives, sh0: g.P.shield||0, list: window.__W.eshots.map((s) => [s, s.x, s.y]) } : null;
      if (g && g.G && g.state === "play") g.G.lives = Math.max(g.G.lives, 5);
      const pre = mortal && g && g.P && g.state === 'play' && g.P.alive && g.P.inv <= 1 ? { sh: g.P.shield || 0, n: window.__near(g), x: g.P.x, y: g.P.y } : null;
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G(); window.__lp = h && h.P ? { x: h.P.x, y: h.P.y } : null;
      if (PS && h && h.P) { const P = h.P, now = new Set(window.__W.eshots), hit = !P.alive || (P.shield || 0) < PS.sh || P.inv > PS.inv + 1;
        for (const [s, x0, y0] of PS.list) { if (s.dead) continue; const R = s.r + 2.6 * (1 - .2 * ((h.G.pk && h.G.pk.tiny) || 0));
          // relative path: frame start (x0-px0) to frame end (s.x-P.x); end position is what the sim tested
          const ax = x0 - PS.px, ay = y0 - PS.py, bx = s.x - P.x, by = s.y - P.y, dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
          let u = L ? -(ax * dx + ay * dy) / L : 0; u = Math.max(0, Math.min(1, u)); const cx = ax + u * dx, cy = ay + u * dy, dmin = Math.hypot(cx, cy), dend = Math.hypot(bx, by), dst = Math.hypot(ax, ay);
          if (dmin >= 12) continue; const alive2 = now.has(s); const k = (s.fk ? "fork" : s.k || "orb");
          const rec = window.__eh || (window.__eh = {}); const r = rec[k] || (rec[k] = { sameFrame: 0, touch: 0, consumedHit: 0, passInv: 0, tunnel: 0, visualOnly: 0, other: 0, step: [], R: R, br: 0 });
          if (dmin >= R) { r.visualOnly++; if (!r.vis) r.vis = [0,0,0,0,0,0,0,0,0,0,0,0]; r.vis[Math.min(11, Math.floor(dmin))]++; continue; } r.touch++;
          if (!alive2) { r.consumedHit++; continue; }
          if (dend < R || dst < R) { if (PS.inv > 0) r.passInv++; else if (hit) r.sameFrame++; else { r.other++; if (!r.ox) r.ox = []; if (r.ox.length < 15) r.ox.push({ dst: +dst.toFixed(2), dend: +dend.toFixed(2), inv: P.inv, sh: P.shield, aeg: P.aegis, alive: P.alive, st: h.state, vx: +s.vx.toFixed(2), vy: +s.vy.toFixed(2), r: s.r, t: s.t, fk: s.fk, hs: h.G.hitstop }); } continue; }
          // both sampled points outside R, the path between them inside: tunnelled
          r.tunnel++; if (r.step.length < 12) r.step.push([+Math.sqrt(L).toFixed(2), +dmin.toFixed(2), +dst.toFixed(2), +dend.toFixed(2), +Math.hypot(s.vx,s.vy).toFixed(2), PS.inv]); } }
      if (pre && h && h.P) { const st = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`, cause = pre.n.c + (pre.n.ctx ? ' @' + pre.n.ctx : '');
        if (!h.P.alive || h.state === 'over') window.__deaths.push({ st, s: +(window.__fr / 60).toFixed(1), cause, lives: h.G.lives, x: Math.round(pre.x), y: Math.round(pre.y) });
        else if ((h.P.shield || 0) < pre.sh) window.__hits[cause] = (window.__hits[cause] || 0) + 1; }
      if (h && h.G && h.state === 'play') { window.__fr++; if (h.G.boss && !h.G.boss.dying && !h.G.tally) { const k = `${h.G.loop + 1}-${(h.G.stage || 0) + 1}`; window.__bf[k] = (window.__bf[k] || 0) + 1; } }
      if (before && h && h.P) { const seen = new Set(h.caps); let chosen = false;
        // where each new cap came from, read off what died this frame (measure-only; see the header's `src`)
        const had = new Set(before), nowE = new Set(h.enemies), gone = beforeE.filter((e) => e.dead || !nowE.has(e));
        for (const c of h.caps) if (!had.has(c) && !window.__capSrc.has(c)) window.__capSrc.set(c, c.choice ? 'fixed:choice' : c.salv ? 'salv' : c.graft ? 'graft' : c.blue ? 'blue'
          : gone.some((e) => e.mid || e.k === 'maw') ? 'fixed:mid' : gone.some((e) => e.group && e.group.pod) ? 'fixed:release' : gone.some((e) => e.cap) ? 'carrier'
          : gone.some((e) => e.group) ? 'formation' : h.G.mini && h.G.mini.k === 'ufo' && !h.G.mini.dead ? 'fixed:saucer' : 'unknown');
        for (const c of before) if (!seen.has(c) && c.x >= -12 && (c.x - h.P.x) ** 2 + (c.y - h.P.y) ** 2 < 20 * 20) {
          const kind = c.graft ? 'graft' : c.blue ? 'blue' : c.choice ? 'choice' : c.salv ? 'salv' : 'pod';
          if (kind === 'choice') { if (chosen) continue; chosen = true; }
          window.__pods.push({ f: window.__fr, kind, src: window.__capSrc.get(c) || 'unknown', st: `${h.G.loop + 1}-${(h.G.stage || 0) + 1}` }); } } } }; }, [+SEED, MORTAL, PIL, PARK, HULL, KITP]);
{ const qs = [TIER != null ? 'tier=' + TIER : '', BRU != null ? 'brutal=' + BRU : ''].filter(Boolean).join('&'); await p.goto(qs ? url + (url.includes('?') ? '&' : '?') + qs : url); } await p.waitForFunction(() => window.__started);
const JUMPED = url.includes('stage='); if (!JUMPED) await useLayout(p, 'pod-probe', { quiet: true }); // stdout stays one JSON object; it carries the layout
if (HULL) await p.evaluate(async (h) => { (await import('/src/state.ts')).$.meta.lv.hull = h; }, HULL); // --hull N: REINFORCED HULL bought N times (a played profile's extra ships)
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
if (!JUMPED) { await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); } await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
await p.evaluate(async () => { window.__fr = 0; window.__pods.length = 0; window.__S = (await import('/src/state.ts')).$; window.__W = await import('/src/world.ts'); window.__BU = await import('/src/boss/update.ts'); window.__DN = await import('/src/enemies/mid/_deny.ts'); });
let last = '', lastFork = false; const tally = {}, grades = {}, warns = []; const k0 = (s) => `${s.loop + 1}-${(s.stage || 0) + 1}`; const seg = []; let endState = '';
for (let it = 0; it < MIN * 60 * 2; it++) {
  await p.evaluate('__tick(30)');
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, stage: G.stage, loop: G.loop, lvl: G.lvl, pick: !!G.pick, pt: G.pick ? G.pick.t : 0, fork: !!G.fork, fr: window.__fr, bio: Math.round(G.bio || 0), kills: G.kills, tally: G.tally ? [G.tally.id, G.tally.secs] : null, gr: G.tally ? { g: G.tally.g, gradeBio: Math.round(G.tally.bio || 0), hits: G.tally.hits, deaths: G.tally.deaths, pct: G.tally.pct, spawned: G.st ? G.st.spawned : null, lvl: G.lvl, bio: Math.round(G.bio || 0), fk: Object.keys(window.__S.meta.mbK || {}).length } : null, lives: G.lives,
    kit: { xpTot: G.xpTot != null ? Math.round(G.xpTot * 10) / 10 : null, pow: G.pow != null ? +G.pow.toFixed(3) : null, lvl: G.lvl, slots: g.P ? [g.P.speed, g.P.missile, g.P.double, g.P.laser, g.P.pyre, g.P.options, g.P.wardLv || 0, Math.round((g.P.shield || 0) * 100) / 100] : null, pk: G.pk ? { ...G.pk } : null, gm: G.gm ? Object.fromEntries(Object.entries(G.gm).filter(([, v]) => v)) : null },
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
const fin = await p.evaluate(() => { const g = __G(), G = g.G; return { deaths: window.__deaths, hitLog: window.__hits, lives0: window.__lives0, fr: window.__fr, pods: window.__pods, bio: Math.round(G.bio || 0), lvl: G.lvl, kills: G.kills, st: g.state, bf: window.__bf, fk: Object.keys(window.__S.meta.mbK || {}) }; });
seg.push({ k: 'END', f0: fin.fr });
const podsOnly = fin.pods.filter((x) => x.kind === 'pod' || x.kind === 'choice');
const first = podsOnly[0];
const stages = seg.slice(0, -1).map((sg, i) => { const f1 = seg[i + 1].f0; const n = podsOnly.filter((x) => x.f >= sg.f0 && x.f < f1).length; const dur = (f1 - sg.f0) / 60;
  const kinds = fin.pods.filter((x) => x.f >= sg.f0 && x.f < f1).reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {});
  const src = fin.pods.filter((x) => x.f >= sg.f0 && x.f < f1).reduce((a, x) => ((a[x.src] = (a[x.src] || 0) + 1), a), {});
  return { stage: sg.k, dur: +dur.toFixed(1), pods: n, kinds, src, ppm: +(n / (dur / 60)).toFixed(2), lvlAtStart: sg.lvl, bioAtStart: sg.bio }; });
console.log(JSON.stringify({ eh: await p.evaluate(() => window.__eh), seed: +SEED, layout: LAYOUT, firstPod_s: first ? +(first.f / 60).toFixed(2) : null, firstPodKind: first && first.kind,
  podTimes_s: podsOnly.slice(0, 12).map((x) => +(x.f / 60).toFixed(1)), kinds: fin.pods.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {}),
  mortal: MORTAL, park: PARK, hull: HULL, kit: KIT, brutal: await p.evaluate(() => __G().G.brutal || 0), deaths: fin.deaths, hitLog: fin.hitLog, lives0: fin.lives0, pilot: PIL ? await p.evaluate(() => window.__pilotLog) : null, stages, tally_s: tally, grades, warns, bossFight_s: Object.fromEntries(Object.entries(fin.bf).map(([k, f]) => [k, +(f / 60).toFixed(1)])), finalBio: fin.bio, firstKills: fin.fk, finalLvl: fin.lvl, kills: fin.kills, endState, errors: errs.slice(0, 3) }));
console.error(`pod-probe: ran on ${LAYOUT}`); await b.close();
