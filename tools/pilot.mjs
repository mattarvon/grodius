// Dodging autopilot for the mortal bots (LS1 carry-forwards: the long4 mortal bot game-overs in the first biome, so
// hits/min, grades, wall times and biomass past Orbit can't be measured; build plan "LS1-G studio review" items 1, 2, 9).
// The older pilots (pod-probe, layout-parity, harness) only steer toward a target and never dodge. This one picks,
// every frame, the move that keeps the ship clearest of danger over a short look-ahead, and only then pulls toward the
// target the calling tool chooses.
//
// It plays by the ship's rules: it moves at most the ship's real speed per frame (player.ts: (1.25 + .42 x speed) x
// SLOW), inside the same screen clamp, and it sees only what a player sees on screen (enemy shots, bodies, the boss,
// terrain, solids, biome hazards, and every attack's telegraph). It does not read the sim RNG, so it doesn't move the sim
// stream; it changes where the ship is, which is the point.
//
// Usage (in a tool):
//   import { PILOT } from './pilot.mjs';
//   await p.addInitScript(PILOT);                         // defines window.__pilotStep (before page scripts)
//   ...after window.__started:  await p.evaluate(() => window.__pilotLoad());   // the live modules it reads (below)
//   in the per-frame hook, instead of moving P toward (tx, ty):  window.__pilotStep(g, tx, ty);
// (Older callers that set window.__W / __BU / __DN, or load probe-lib's window.__PL, still work: the pilot reads its
// modules from whichever is there, and starts loading the rest itself on its first frame.)
// `window.__pilotLog` reports `frames` piloted, `trapped` (frames where every candidate move was unsafe), `deaths`
// (for each life lost: the stage, scroll, position, the midboss or Drive up, the two nearest threats and the modelled
// attacks live just before), `seen` (frames each attack model was live: which reads the pilot used) and `err` / `errN` (a model
// that threw, by name, its last message and how many times: it is switched off for that frame, never the pilot).
//
// What it reads, per attack (W6 tune-tp: every new threat of the difficulty rebuild; the sims' own pure geometry
// wherever a module exports it):
//   bodies      every enemy, at its measured velocity; exact paths where the sim's motion is a closed form: the
//               Butcher's meat hooks (pendulums), CREW KNOTS (drift + bob), sine / zig drones, the Maw's bite lunge
//               (bossrules.ts lungeX: down the locked lane to W x .35, held, home)
//   shots       every eshot, globs with their .025 px/f^2 fall
//   Apprentice  (enemies/mid/prentice.ts) the cleaver: its lunge tracks the ship (x + 64, y + 6 for 25 f), simulated per
//               candidate move, then the 12 f sweep (angle 3.98 -> 2.30 rad, r 14-84); the hook (_deny.ts DN): the tip's
//               flight from the end of its tell to where it strikes, the bite's wire with the phase-2 sag (hookSag) and
//               the reel, and the second hook (rank >= 14) on its own line
//   KEEPSAKE    (_keepsake.ts KB / KR, keepsake.ts) the boomerang (from its tell: the exact out-and-back path), the hanging
//               mobile forks and their drops, planted forks, the recall's and the tug's threads (each fork's flight home
//               from its release), forks flying home, the search beam's three forks in the marked column, the aimed throw
//   W3a solids  (solids.ts) pistons at their cycle's tip for each look-ahead frame (rest ahead included), plugs (growing
//               and regrowing cells from when they set), wedged blocks, slabs; flying ice blocks as bodies
//   DYN terrain (terrainb.ts dynOff) the tide / swallow's walls at each look-ahead frame
//   Choir       the lane bar from its tell (out at lSp, back at lBack; the twin lane alongside); denyPts while it sweeps
//   Saucer      the lash's stab and its phase-2 SWEEP (_deny.ts sweepA)
//   Butcher     the cleaver sector, the chain hook and its planted chain (enemies/butcherhook.ts)
//   Drive       the hull, the beam and the TWIN BEAM's second line (laser.ang2), the tentacles with THE REACH / pincer
//               state advanced as stepReach does (bossrules.ts DRIVE.reach), each tested along its segments
//   hazards     icicles falling, geysers and jets (aimed ones too: they are the same column), strands, MORGUE RUSH blocks
// Long telegraphs (the cleaver's 50 f, the hook's 50 f, the boomerang's 54 f, a recall's 50 f, the beam rain) strike past
// the 24 f look-ahead: each candidate move is carried on, straight, to T.HL frames against those alone (kept inside the
// screen and the walls), so the pilot starts its escape while the tell is up rather than once the blow is inside its window.
// (Only threats that start late are carried that far; one already live, e.g. the Butcher's planted chain, is read over the
// short look-ahead, re-planned every frame.)
// The copied rules (the lunge, the hook's strike march, pistonTipAt, the pendulums) restate the sims as of g3 128cbac;
// tests/unit/pilot.test.ts flies each against the same rules closed loop. A sim change there must be mirrored here.
// Like the older bots it moves the ship by writing P.x / P.y, not through input; the speed cap keeps that honest.

/** look-ahead (frames) and its sampling step, the long look-ahead for the telegraphed attacks and its step, candidate
 *  speeds (fractions of the ship's speed) and directions, the clearance under which a threat starts to cost (px, x3),
 *  the wall clearance (px), the pull toward the target, a cleaver wedge's hit and cost clearances (px), and the reaction
 *  time (frames): a shot, a body, a hazard or an attack's tell is unseen until it is that many frames old (0 = the
 *  frame it appears; a tool may set window.__pilotReact to fly a slower reader: the M2 sensitivity runs) */
export const PILOT_TUNE = { H: 24, step: 2, HL: 72, stepL: 3, speeds: [0, .5, 1], dirs: 16, margin: 6, wall: 7, goalW: .02, secHit: 6, secSoft: 26, react: 0 };
/** r4 decision 29 (Matt, 2026-11-24): the HUMAN profile (window.__pilotHuman = { seed }, pod-probe --human), measure-only. A
 *  player is not this pilot: they see a threat late, read a telegraph later still, re-plan in discrete corrections, move
 *  with noise, and sometimes overshoot. Each value and where it comes from (60 f = 1 s; 1 f = 16.7 ms):
 *  - react 19 f (~317 ms), jitter -2..+3 f per attention spell: visual CHOICE reaction time (several possible escapes) is
 *    ~300-400 ms against ~200-250 ms simple RT (Hick 1952 / Hyman 1953; Welford 1980; Kosinski 2013 review), and the
 *    online Human Benchmark median for a single click is ~270 ms before any choice. A 60 Hz display plus a game's input
 *    path add ~30-60 ms more. 19 f sits inside that, at a practised player's end. It is re-drawn every `spell` frames
 *    (attention varies; not per threat, so a threat never flickers in and out of view)
 *  - tell +6 f (~100 ms): reading a telegraph (a dashed line, a glow, a lane) is identification, not detection: the
 *    choice-minus-simple RT gap, ~100 ms in the sources above. A tell is first seen react + tell frames after it starts
 *  - plan 6 f (~100 ms): human steering is intermittent, one corrective sub-movement every ~100-200 ms (Craik 1947; Miall,
 *    Weir & Stein 1993). The pilot re-plans every `plan` frames and holds its move in between
 *  - dirSd .15 rad, speed 85-100%: signal-dependent motor noise, endpoint spread ~5-10% of the movement (Harris & Wolpert
 *    1998); a pad or a thumb on glass does not hit the exact 22.5 deg step the plan chose
 *  - aimSd 6 px: where the player means to sit (lining up a shot, a pod) wobbles: the goal point is jittered per plan
 *  - over .2 / overF 6 f: overshoot in step tracking; one dodge in five carries on ~100 ms past the safe point
 *  The pilot's own PRNG (mulberry32 on the seed): it never draws the sim's R(), so the game's stream is untouched
 *  - brk 40 px: a correction is broken off (re-planned at once) for a seen threat this close and closing, or after a plan
 *    with no safe move (qa-lead): a person keeps jinking when cornered. pilotLog.hbrk counts the breaks
 *  The 8-way pad reading: on keys or a d-pad the real limit is 8 directions at full speed; dirSd and spLo model a thumb on
 *  glass (the phone build) better than a pad, and err toward the clumsier input */
export const PILOT_HUMAN = { react: 19, jitLo: -2, jitHi: 3, spell: 60, tell: 6, plan: 6, dirSd: .15, spLo: .85, aimSd: 6, over: .2, overF: 6, brk: 40 };

// The page-side code, as a string so addInitScript can take it. Kept dependency-free: it reads window.__G (main.ts) and
// the live /src modules it imports itself (window.__pilotLoad), or the ones a tool already put on window / window.__PL.
export const PILOT = `(() => {
  const T = ${JSON.stringify(PILOT_TUNE)};
  const W = 480, PH = 254, TAU = Math.PI * 2;
  const prev = new WeakMap();
  // ---- the modules (the sims' own geometry). A tool's window.__W / __BU / __DN or probe-lib's __PL.mods also serve
  const MODS = [['W', '/src/world.ts'], ['BU', '/src/boss/update.ts'], ['BRL', '/src/boss/bossrules.ts'], ['DN', '/src/enemies/mid/_deny.ts'],
    ['KS', '/src/enemies/boss/_keepsake.ts'], ['SO', '/src/solids.ts'], ['TB', '/src/terrainb.ts'], ['SP', '/src/enemies/spawn.ts'], ['NO', '/src/notice.ts'], ['BH', '/src/enemies/butcherhook.ts']];
  const M = {}; let ld = null;
  // a page whose game modules carry HMR stamps would hand these imports second, empty copies: flagged (err.instance), never silent
  window.__pilotLoad = () => ld || (ld = Promise.all(MODS.map(([k, p]) => import(p).then((m) => { M[k] = m; }, () => { M[k] = null; }))).then(() => {
    try { const g = window.__G && window.__G(); if (g && M.W && M.W.enemies !== g.enemies) (window.__pilotLog.err ||= {}).instance = 'world.ts is a second copy (HMR?): restart the server'; } catch (e) {} }));
  const mod = (k) => M[k] || (window.__PL && window.__PL.mods && window.__PL.mods[k]) || window['__' + k] || null;
  window.__pilotLog = { frames: 0, trapped: 0, deaths: [], seen: {}, ms: 0 };
  const rnow = performance.now.bind(performance); // the real clock, taken before a tool fakes performance.now: the pilot's own cost (ms)
  let alive = false, ctx = null;
  const live = new Set();
  const seen = (k) => { const s = window.__pilotLog.seen; s[k] = (s[k] || 0) + 1; };
  const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // per-entity velocity from the last frame's position (most enemies move by their own rules, not vx/vy)
  const vel = (e) => { const p = prev.get(e); return p ? [e.x - p[0], e.y - p[1]] : [e.vx || 0, e.vy || 0]; };
  const segD = (ax, ay, bx, by, px, py) => { const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy; let u = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0; u = u < 0 ? 0 : u > 1 ? 1 : u; return Math.hypot(ax + dx * u - px, ay + dy * u - py); };
  // a path / angle / wedge / solid closure that throws inside danger() returns null (that threat is skipped) and is logged by name
  const safeF = (k, f) => (f ? (...a) => { try { return f(...a); } catch (e) { const s = window.__pilotLog.err || (window.__pilotLog.err = {}); s[k || 'fn'] = String(e && e.message || e).slice(0, 120); const c = window.__pilotLog.errN || (window.__pilotLog.errN = {}); c[k || 'fn'] = (c[k || 'fn'] || 0) + 1; return null; } } : f);
  const HULL = [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]];
  const guard = (k, f) => { try { f(); } catch (e) { const s = window.__pilotLog.err || (window.__pilotLog.err = {}); s[k] = String(e && e.message || e).slice(0, 120); const c = window.__pilotLog.errN || (window.__pilotLog.errN = {}); c[k] = (c[k] || 0) + 1; } };

  // r4 human profile state (PILOT_HUMAN): its own PRNG, never the sim's R()
  const HP = ${JSON.stringify(PILOT_HUMAN)};
  let hs = null; // seeded on first use: a tool may set window.__pilotHuman after this script
  const hr = () => { if (hs == null) hs = (Math.imul(((window.__pilotHuman && window.__pilotHuman.seed) | 0) + 1, 2654435761) + 1013904223) >>> 0; hs = (hs + 0x6D2B79F5) >>> 0; let t = hs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hgauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += hr(); return (u - 2) * Math.sqrt(3); }; // ~N(0, 1), bounded
  const HS = { spF: 0, rt: HP.react, hold: 0, v: null, ax: 0, ay: 0, safe: true };
  // the break test: a seen shot or body within HP.brk px of the ship and closing (its last-frame step toward it)
  const brake = (g, P) => { const Wm = mod('W'), B = HP.brk, near = (x, y, vx, vy) => { const dx = P.x - x, dy = P.y - y; return dx * dx + dy * dy < B * B && dx * vx + dy * vy > 0; };
    if (Wm) for (const s of Wm.eshots) if (s.t != null && s.t >= HS.rt && near(s.x, s.y, s.vx || 0, s.vy || 0)) return true;
    for (const e of g.enemies) { if (e.dead || e.ghost > 0 || (e.t != null && e.t < HS.rt)) continue; const q = prev.get(e); if (q && near(e.x, e.y, e.x - q[0], e.y - q[1])) return true; }
    return false; };
  window.__pilotStep = (g, tx, ty) => {
    const P = g.P, G = g.G, Wm = mod('W');
    if (!ld) window.__pilotLoad();
    // a death since the last frame: keep what the pilot saw just before it (where, the closest threats, the models live)
    if (P && alive && !P.alive && ctx) window.__pilotLog.deaths.push(ctx);
    alive = !!(P && P.alive); if (!P || !P.alive || !Wm) return;
    window.__pilotLog.frames++;
    if (window.__pilotHuman) { // the attention spell counts every frame (qa-lead), held or planned
      if ((HS.spF -= 1) <= 0) { HS.spF = HP.spell; HS.rt = HP.react + Math.round(HP.jitLo + hr() * (HP.jitHi - HP.jitLo)); }
      // a person breaks a correction off when the last plan had no safe move, or when a threat they can now see (old enough
      // for the reaction time) is within HP.brk px and closing: re-plan this frame (counted, so M1 can show they are rare)
      if (HS.hold > 0 && HS.v && (!HS.safe || brake(g, P))) { HS.hold = 0; window.__pilotLog.hbrk = (window.__pilotLog.hbrk || 0) + 1; }
      if (HS.hold > 0 && HS.v) { HS.hold--; const spH = (1.25 + (P.speed || 0) * .42) * (P.slow > 0 ? .45 : 1), m = Math.hypot(HS.v[0], HS.v[1]), k = m > spH ? spH / m : 1;
        P.x = Math.min(W - 16, Math.max(10, P.x + HS.v[0] * k)); P.y = Math.min(PH - 6, Math.max(6, P.y + HS.v[1] * k)); // between corrections the hand holds its move
        if (ctx) { ctx.x = Math.round(P.x); ctx.y = Math.round(P.y); ctx.hold = HS.hold + 1; } // a death in a hold records where it was
        keepPrev(g, G); return; } }
    if (window.__pilotHuman && tx != null) { tx += HS.ax; ty += HS.ay; }
    const t00 = rnow();
    live.clear();
    const sp = (1.25 + (P.speed || 0) * .42) * (P.slow > 0 ? .45 : 1);
    const ss = G.scrollSpeed ?? 1, sc = G.scroll; // ?? not ||: the scroll is exactly 0 during held midbosses and the Drive (step.ts)
    const HU = window.__pilotHuman ? HP : null; // r4: the human profile (PILOT_HUMAN), else the reading pilot as before
    const RT = HU ? HS.rt : (window.__pilotReact ?? T.react), early = (age) => RT > 0 && age != null && age < RT; // not yet seen (the reaction time)
    const earlyT = (age) => early(age) || (HU && age != null && age < RT + HU.tell); // a telegraph: read later still (human profile)
    const SP = mod('SP'); let bs = 1; try { if (SP && SP.BS) bs = SP.BS() || 1; } catch (e) {}
    // ---- threats. Circles { x, y, vx, vy, r, k, ay?, t0?, t1?, fn? } in screen space (fn(t) -> [x, y] or null: an exact
    // path), lines { x, y, a, len, w, t0, t1, fa?, pts? } (fa(t): a sweeping angle; pts: a polyline instead), sectors
    // { sim(cs, t) -> [cx, cy, a0, a1] | null }. L: a telegraphed threat the long look-ahead checks too
    const th = [], lines = [], sectors = [];
    const now = (window.__pilotLog.now = {}); // this frame's modelled threats by kind (circles and lines)
    const circ = (o) => { if (o.t0 > T.H - 6) o.L = 1; o.fn = safeF(o.k, o.fn); th.push(o); if (o.k) { live.add(o.k); now[o.k] = (now[o.k] || 0) + 1; } };
    const line = (o) => { if (o.t0 > T.H - 6) o.L = 1; o.fa = safeF(o.k, o.fa); lines.push(o); if (o.k) { live.add(o.k); now[o.k] = (now[o.k] || 0) + 1; } };
    for (const s of Wm.eshots) if (!early(s.t)) th.push({ x: s.x, y: s.y, vx: s.vx || 0, vy: s.vy || 0, ay: s.k === 'glob' ? .025 : 0, r: (s.r || 2) + 2.6, k: 'shot:' + (s.k || 'orb') });
    // bodies: exact paths where the sim's motion is a closed form, else the measured velocity
    const NO = mod('NO'), BR = mod('BRL'); // BRL, not BR: probe-lib's BR is brutal.ts
    const pathOf = (e) => {
      if (e.k === 'hook' && e.len != null && e.sw != null && e.ax != null) return (t) => { const ang = Math.sin((e.t + t) * .035 + e.ph) * e.sw * .55 + (e.kick || 0) * Math.pow(.96, t); return [e.ax - ss * t + Math.sin(ang) * e.len, e.ay + Math.cos(ang) * e.len]; };
      if (e.k === 'knot' && NO && NO.KNOT && e.y0 != null) { const K = NO.KNOT; return (t) => [e.x - (ss + K.drift) * t, e.y0 + Math.sin((e.t + t) * TAU / K.bobF) * K.bob]; }
      if (e.k === 'drone' && e.pat === 'sine' && e.y0 != null) return (t) => [e.x - 1.75 * t, e.y0 + Math.sin((e.t + t + (e.i || 0) * 9) * .07) * 26];
      if (e.k === 'drone' && e.pat === 'zig' && e.y0 != null) return (t) => { const ph = (e.t + t + (e.i || 0) * 6) % 80 / 80; return [e.x - 2 * t, e.y0 + (ph < .5 ? ph * 4 - 1 : 3 - ph * 4) * 28]; };
      if (e.k === 'maw' && e.bs && !(e.bs === 1 && earlyT(e.bt)) && BR && BR.MAW && BR.lungeX) { const Mw = BR.MAW, V = e.bv ? Mw.var : null, hold = V ? V.hold : Mw.hold, back = V ? V.backV : Mw.backV, ly = e.ly ?? e.y;
        // r4 (pressure): the stop is the sim's own e.lsx (bossfights.ts bite: lungeStop, 16 px past the ship's x as its lane locks, never
        // left of W x lungeMin), which the render draws as the lane line's end. This model ran the lunge to W x .35 (g3 128cbac's rule, before
        // W6's MAW.past), so a ship left of x 168 in the lane read as safe and the stage-boss Maw's bite killed the pilot there (round 3 M1)
        const xm = e.lsx != null ? e.lsx : BR.lungeStop ? BR.lungeStop(P.x, W) : W * Mw.lungeX;
        // the bite (bossfights.ts bite): the tell holds x with the lane locked, the lunge runs to its stop, the hold, then home
        if (e.bs <= 2) { const t0 = e.bs === 1 ? Mw.tell - e.bt : -e.bt, x0 = e.bs === 1 ? e.x : e.bx0 ?? e.x, tl = Math.max(0, (x0 - xm) / Mw.lungeV);
          return (t) => { const u = t - t0; if (u <= 0) return [e.x, ly]; if (u <= tl) return [BR.lungeX(x0, W, u, xm), ly]; if (u <= tl + hold) return [xm, ly]; return [xm + back * (u - tl - hold), ly]; }; }
        if (e.bs === 3) return (t) => (t + e.bt <= hold ? [e.x, ly] : [e.x + back * (t + e.bt - hold), ly]);
        return (t) => [e.x + back * t, e.y]; }
      return null;
    };
    for (const e of g.enemies) { if (e.dead || e.ghost > 0 || early(e.t)) continue; const [vx, vy] = vel(e); let fn = null; guard('path', () => { fn = safeF('path:' + e.k, pathOf(e)); });
      th.push({ x: e.x, y: e.y, vx, vy, r: (e.r || 6) + 4, k: e.k, fn });
      if (e.hb) for (const h of e.hb) th.push({ x: e.x + h[0], y: e.y + h[1], vx, vy, r: h[2] + 4, k: e.k, fn: fn ? ((f, dx, dy) => (t) => { const q = f(t); return q && [q[0] + dx, q[1] + dy]; })(fn, h[0], h[1]) : null }); }
    if (G.boss && !G.boss.dying) { const b = G.boss, [vx, vy] = vel(b); th.push({ x: b.x, y: b.y, vx, vy, r: 62, k: 'drive' }); }
    // MORGUE RUSH ice blocks in flight (W3c's __biome().sig.eng.blocks and W3a's BODY solids): circles over the block's
    // box, moving at the block's measured velocity. A block in its tell is not solid
    const SO = mod('SO');
    guard('blocks', () => { const Bb = globalThis.__biome ? globalThis.__biome() : null, eng = Bb && Bb.sig && Bb.sig.eng, bl = [];
      if (eng && Array.isArray(eng.blocks)) for (const k of eng.blocks) if (k && k.st !== 'tell' && Number.isFinite(k.x)) bl.push({ k, cx: k.x + (k.w || 22) / 2, cy: k.y, hw: (k.w || 22) / 2, hh: (k.h || 14) / 2 });
      if (SO && Array.isArray(SO.solids) && SO.SC) for (const q of SO.solids) if (q && q.cls === SO.SC.BODY) bl.push({ k: q, cx: q.x - sc + q.w / 2, cy: q.y + q.h / 2, hw: q.w / 2, hh: q.h / 2 });
      for (const b of bl) { const [vx, vy] = vel(b.k), r = Math.hypot(b.hw / 3 + 8, b.hh + 4); // three circles whose union covers the +8 / +4 touch box
        for (const f of [-2 / 3, 0, 2 / 3]) th.push({ x: b.cx + f * b.hw, y: b.cy, vx, vy, r, k: 'haz:block' }); } });
    // the midbosses' area denial as it stands now (D61, _deny.ts denyPts: the Choir's loose bar, the Saucer's sweep, the
    // Womb's pools, the Apprentice's hook and chain)
    const DN = mod('DN'), mini = G.mini && !G.mini.dead ? G.mini : null;
    if (DN && DN.denyPts && mini) guard('deny', () => { const n = th.length; DN.denyPts(mini, sc, th); if (th.length > n) live.add('deny:' + mini.k); });
    const B = globalThis.__biome ? globalThis.__biome() : null, haz = B ? B.haz : [];
    // ---- the Saucer's lash (enemies/mid/ufo.ts): the tell aims (locks 16 f before), the whip hits from wt 4 to 20 + the
    // sweep, at reach 18 + 220; phase 2 sweeps +-.5 rad over UFO_SW.f at full reach from wt 16 (_deny.ts sweepA)
    for (const e of g.enemies) if (!e.dead && e.k === 'ufo' && ((e.st === 'lash' && !earlyT(e.wt)) || e.st === 'whip')) guard('lash', () => {
      const ox = e.x - 34, oy = e.y + 9, tel = e.lash2 ? 28 : 44, w0 = e.st === 'lash' ? tel - e.wt : -e.wt, swF = e.sw && DN && DN.UFO_SW ? DN.UFO_SW.f : 0;
      const a0 = e.st === 'whip' && e.wt > 16 && e.la0 != null ? e.la0 : e.la;
      line({ x: ox, y: oy, a: a0, len: 238, w: 6, t0: w0 + 4, t1: w0 + 21 + swF, k: 'lash',
        fa: swF ? (t) => { const u = t - w0 - 16; return u >= 0 && u < swF ? DN.sweepA(a0, u, e.sw) : a0; } : null });
    });
    // ---- the flayer's whip (enemies/update.ts 'flayer'): a 34 f tell that tracks to its last frame, then the lash reaches
    // 122 px from (x - 7, y + 1) along e.ang and hits (4.5 px) from strike frame 5 to 15
    for (const e of g.enemies) if (!e.dead && e.k === 'flayer' && ((e.ws === 'tel' && !earlyT(e.wt)) || e.ws === 'strike')) {
      const w0 = e.ws === 'tel' ? 34 - e.wt : -e.wt;
      line({ x: e.x - 7, y: e.y + 1, a: e.ang, len: 122, w: 5, t0: w0 + 5, t1: w0 + 16, k: 'whip' });
    }
    // ---- THE BUTCHER'S APPRENTICE (enemies/mid/prentice.ts)
    for (const e of g.enemies) if (!e.dead && e.k === 'prentice' && !e.gone) guard('prentice', () => {
      // the cleaver: 'tel' 50 f, the lunge's x lerps (.06) to the ship's x + 64 (130 to W - 70), its y to the ship's y + 6
      // (50 to PH - 40) through the tell's first 25 f; then 'cut': 12 f in which the edge sweeps from 3.98 rad down to 2.30
      // round its cleaver (x - 8, y - 6), r 14 to 84, the lunge easing on (.03). Simulated per candidate (it follows the ship)
      if ((e.st === 'tel' && !earlyT(e.wt)) || e.st === 'cut') {
        const st0 = e.st, wt0 = e.wt, x0 = e.x, y0 = e.y, tx0 = e.tx ?? e.x;
        sectors.push({ k: 'cleaver', r0: 14, r1: 84, sim: safeF('cleaver', (cs, t) => {
          let m = cs.m.get(e); if (!m) { m = { f: 0, st: st0, wt: wt0, x: x0, y: y0, tx: tx0 }; cs.m.set(e, m); }
          while (m.f < t) { m.f++; const q = cs.pos(m.f);
            m.x = lerp(m.x, m.tx, m.st === 'tel' ? .06 : .03);
            if (m.st === 'tel' && m.wt < 25) m.y = lerp(m.y, clamp(q[1] + 6, 50, PH - 40), .06);
            m.wt++;
            if (m.st === 'tel') { m.tx = clamp(q[0] + 64, 130, W - 70); if (m.wt >= 50) { m.st = 'cut'; m.wt = 0; } } }
          if (m.st !== 'cut' || m.wt < 1 || m.wt > 12) return null;
          const p = Math.min(1, m.wt / 12); let cur = -2.3 - p * (TAU - 4.6); if (cur < 0) cur += TAU;
          return [m.x - 8, m.y - 6, cur, 3.99]; }) });
        live.add('cleaver');
      }
      // the hook (_deny.ts DN): tell hTel (tracks, locks the last hLock), thrown at hSp from hd 10 until it strikes
      // terrain or the screen's edge (hMax at most), bites hBite (phase 2 on long4: hBite2, the wire sagging), reels at hIn
      if (!DN || !DN.DN) return;
      const D = DN.DN, ox = e.x + D.hOx, oy = e.y + D.hOy, ph2 = e.hp < e.max * .5;
      const strike = (a) => { const c = Math.cos(a), s = Math.sin(a); for (let d = 10; d < D.hMax; d += D.hSp) { const x = ox + c * d, y = oy + s * d, wx = x + sc;
          if (y >= Wm.floorAt(wx) || y <= Wm.ceilAt(wx) || x <= 2 || y <= 2 || y >= PH - 2) return d; } return D.hMax; };
      const hookAt = (a, tThrow, hd0, k) => { // the tip from tThrow (hd0 out then), the wire from its bite to the reel's end
        const ds = strike(a), c = Math.cos(a), s = Math.sin(a), tb = tThrow + Math.max(0, Math.ceil((ds - hd0) / D.hSp)), bf = ph2 ? D.hBite2 : D.hBite;
        circ({ x: ox, y: oy, vx: 0, vy: 0, r: D.hR + 2.6, t0: tThrow, t1: tb + 1, k, fn: (t) => { const d = Math.min(ds, hd0 + D.hSp * Math.max(0, t - tThrow)); return [ox + c * d, oy + s * d]; } });
        const txp = ox + c * ds, typ = oy + s * ds, sag = ph2 && DN.hookSag ? DN.hookSag(oy, typ, Wm.floorAt((ox + txp) / 2 + sc)) : 0;
        // a line hits when its distance - w < 4: w = the wire's hW + the ship's 2.6 - 4, + 2 px of margin
        line({ x: ox, y: oy, a, len: ds, w: D.hW + .6, t0: tb, t1: tb + bf + Math.ceil(ds / D.hIn), k: k + ':wire', pts: sag > 0 ? [[ox, oy], [(ox + txp) / 2, (oy + typ) / 2 + sag], [txp, typ]] : null });
        return tb; };
      let tb1 = null;
      if (e.st === 'htel' && !earlyT(e.wt)) tb1 = hookAt(e.ha, D.hTel - e.wt + 1, 10, 'hook');
      else if (e.st === 'hook' && e.hd > 0) tb1 = hookAt(e.ha, 0, e.hd, 'hook');
      if (e.st2 === 'htel' && e.ha2 != null) { // the second hook: locks h2Lock into the first's bite, throws hLock after (not before TELL_MIN)
        const tBite = tb1 != null ? tb1 : e.st === 'bite' ? -e.wt : 0;
        hookAt(e.ha2, Math.max(D.h2Lock + D.hLock + tBite, (DN.TELL_MIN || 44) - (e.wt2 || 0)), 10, 'hook2'); }
      else if (e.st2 === 'hook' && e.hd2 > 0) hookAt(e.ha2, 0, e.hd2, 'hook2');
    });
    // ---- the Butcher (the fire biome's boss, enemies/update.ts): the cleaver sector (18-100 px, 'ctel' 48 f), and the
    // chain hook ('htel'); D61's second half (enemies/butcherhook.ts): 'htel' 48 f, the line locked for the last 16
    // (origin e.lx, e.ly), the tip flies the whole screen at 8 px/f, PLANTS for 90 f as a solid chain, then reels
    for (const e of g.enemies) if (!e.dead && e.k === 'butcher') guard('butcher', () => {
      const [vx, vy] = vel(e);
      if ((e.st === 'ctel' && !earlyT(e.wt)) || e.st === 'cut') { const w0 = e.st === 'ctel' ? 48 - e.wt : -e.wt, x0 = e.x - 10, y0 = e.y - 10;
        sectors.push({ k: 'cleaver', r0: 18, r1: 100, sim: safeF('bcleaver', (cs, t) => (t < w0 || t >= w0 + 13 ? null : [x0 + vx * t, y0 + vy * t, 2.30, 3.99])) }); live.add('bcleaver'); }
      const ph2 = e.hp < e.max * .5;
      if (earlyT(e.wt) && e.st === 'htel') { /* not yet seen */ }
      else if (e.st === 'htel' && ph2) { const w0 = 48 - e.wt, ox = e.lx != null ? e.lx : e.x + 10, oy = e.ly != null ? e.ly : e.y - 8;
        line({ x: ox, y: oy, a: e.ha, len: 520, w: 6, t0: w0, t1: w0 + 150, k: 'bhook' }); }
      else if (e.st === 'hook' && e.hk && e.hk.v2) { const h = e.hk, ax = e.x + 10, ay = e.y - 8, a = Math.atan2(h.ty - ay, h.tx - ax), l = Math.hypot(h.tx - ax, h.ty - ay);
        line({ x: ax, y: ay, a, len: h.out ? 520 : l, w: 6, t0: 0, t1: h.out ? 150 : h.pl ? 90 - h.pt + 40 : 40, k: 'bhook' }); }
      else if (e.st === 'htel' || (e.st === 'hook' && e.hk && e.hk.out)) { // the first half's hook
        // r4 (pressure): long4 (BUTCHER.farHook, W6 tune-tf) throws it KH.tell2 (48 f, e.hT) after the tell starts, out past the ship as locked
        // (e.hR, up to BUTCHER.reach1 440 px) at KH.out1 px/f; this read g3 128cbac's 40 f / 236 px hook, so a ship beyond 236 px read as safe
        // (short, no e.hT, keeps the old 236 px / 34 f read). The pace is butcherhook.ts KH.out1 (else 7)
        const BH = mod('BH'), out1 = (BH && BH.KH && BH.KH.out1) || 7;
        if (!e.hT) { const w0 = e.st === 'htel' ? 40 - e.wt : 0; line({ x: e.x + 10, y: e.y - 8, a: e.ha, len: 236, w: 8, t0: w0, t1: w0 + 34, k: 'bhook' }); }
        else { const rch = (e.hk && e.hk.rch) || e.hR || (BR && BR.BUTCHER ? BR.BUTCHER.reach1 : 440), w0 = e.st === 'htel' ? e.hT - e.wt : 0;
          line({ x: e.x + 10, y: e.y - 8, a: e.ha, len: rch + 6, w: 8, t0: w0, t1: w0 + Math.ceil(rch / out1) + 4, k: 'bhook' }); } }
    });
    // ---- THE DISSOLVING WOMB's eruptions (_deny.ts poolStage / eruptStage): a burning pool boils for plErTel (its tell,
    // drawn from its first frame) before its column stands plErLive, plCW half-wide, pR long off the surface. denyPts shows
    // the column from the tell's last 24 f; this reads the whole tell, and the next eruption on the pool's clock
    if (DN && DN.DN && DN.poolStage && mini && mini.k === 'cyst') guard('womb', () => { const D = DN.DN, e = mini;
      for (let i = 0; i < (e.pn || 0); i++) { const a = e.t - e.pT[i]; if (DN.poolStage(a) > 1 || DN.poolStage(a) < 0) continue;
        const b = a - D.plArm - D.plEr0; let t0;
        if (b < 0) t0 = -b + D.plErTel; else { const q = b % D.plEvery; t0 = q < D.plErTel ? D.plErTel - q : q < D.plErTel + D.plErLive ? 0 : D.plEvery - q + D.plErTel; }
        if (t0 > D.plErTel || (t0 > 0 && earlyT(D.plErTel - t0))) continue; // seen from the boil's first frame (+ the reaction time), never from the clock before it
        const t1 = t0 + D.plErLive - (t0 === 0 ? (b % D.plEvery) - D.plErTel : 0), lft = D.plArm + D.plLive - a; if (t0 > lft) continue;
        const x = e.pX[i] - sc, sd = e.pS[i];
        for (let d = 6; d < e.pR[i]; d += 10) circ({ x, y: e.pY[i] - sd * d, vx: -ss, vy: 0, r: D.plCW + 2.6 + 2, t0, t1: Math.min(t1, lft), k: 'column' }); } });
    // ---- THE NAIL CHOIR's lane (_deny.ts LP): the bar flies to the mouth (x - lFront) over the tell, sweeps left at lSp
    // to lEnd, then back at lBack (the twin lane alongside in phase 2). denyPts covers the sweeping bar; this adds the
    // tell (the sweep to come) and the return while it still goes out
    if (DN && DN.DN && DN.LP && mini && mini.k === 'choir' && mini.lp && mini.lb) guard('choir', () => {
      const D = DN.DN, LP = DN.LP, e = mini, mouth = e.x - D.lFront, ys = [e.lp === LP.tel ? e.ly0 : e.ly]; if (e.tw) ys.push(e.lp === LP.tel ? e.ly20 : e.ly2);
      let tOut = null, tBack = null;
      if (e.lp === LP.tel && earlyT(e.wt)) return;
      if (e.lp === LP.tel) tOut = D.lTel - e.wt + 1;
      if (e.lp === LP.tel || e.lp === LP.out) { const x1 = e.lp === LP.tel ? mouth : e.lx; tBack = (tOut || 0) + Math.ceil((x1 - D.lEnd) / D.lSp) + 1; }
      // rank >= 14: the turn (LP.turn) re-locks the return on the ship's height (lyB) for lTurn, off screen, then it sweeps back
      if (e.lp === LP.turn && e.lyB != null) { tBack = D.lTurn - (e.lt || 0) + 1; ys.length = 0; ys.push(e.lyB); if (e.tw && DN.lanePair) ys.push(DN.lanePair(e.lyB, PH)); }
      for (const y of ys) for (let dy = -D.lHH + 4; dy <= D.lHH - 4; dy += 8) { const yy = y + dy;
        if (tOut != null) circ({ x: mouth, y: yy, vx: 0, vy: 0, r: D.lHW + 4.6, t0: tOut, k: 'lane', fn: (t) => [mouth - D.lSp * Math.max(0, t - tOut), yy] });
        if (tBack != null) circ({ x: D.lEnd, y: yy, vx: 0, vy: 0, r: D.lHW + 4.6, t0: tBack, k: 'lane', fn: (t) => [D.lEnd + D.lBack * Math.max(0, t - tBack), yy] }); }
    });
    // ---- THE KEEPSAKE (enemies/boss/keepsake.ts, the pure side _keepsake.ts): none of these are eshots
    const KS = mod('KS'), ks = mini && mini.k === 'keepsake' && mini.st !== 'dying' ? mini : null;
    if (KS && KS.KB && ks) guard('keepsake', () => {
      const m = ks, KB = KS.KB, KR = KS.KR || {}, homeR = (KR.homeR || 4.5) + 2.6;
      // the mobile's hanging forks (mobTouch: the tip, 11 and 22 px up), and the drops: fork dq[k] lets go at tel + k gap
      // and falls from rest at the glob's .025 px/f^2 (dropFork: lob(x, tip, x, floor, 0))
      if (m.ph >= 1 && m.ma && m.my > -40) for (let i = 0; i < KB.mobN; i++) if (m.ma[i]) { const x = KS.mobForkX(m, i), tp = KS.mobForkTip(m, i);
        for (const dy of [0, 11, 22]) circ({ x, y: tp - dy, vx: 0, vy: 0, r: KB.mobHit + 2.6, k: 'keep:mobile' }); }
      // (fork k shows its shudder only from wt > k gap, render/gross/boss/keepsake.ts: the RNG's drop order is not read before it)
      if ((m.st === 'drop' || m.st === 'rain') && m.dq && m.ma) { const rain = m.st === 'rain', gap = rain ? 6 : KB.dropGap, tel = rain ? KB.rain : KB.drop;
        for (let k = 0; k < (m.dn || 0); k++) { const i = m.dq[k], t0 = tel + k * gap - m.wt; if (t0 < 0 || !m.ma[i] || m.wt <= k * gap || earlyT(m.wt - k * gap)) continue; const x = KS.mobForkX(m, i), tp = KS.mobForkTip(m, i);
          circ({ x, y: tp, vx: 0, vy: 0, r: KB.mobHit + 2.6, t0, k: 'keep:drop', fn: (t) => { const u = Math.max(0, t - t0); return [x, tp + .0125 * u * (u + 1)]; } }); } }
      // planted forks (plantTouch: 4 and 10 px out of the surface)
      for (let i = 0; i < (m.pn || 0); i++) for (const d of [4, 10]) th.push({ x: m.pX[i] - sc, y: m.pY[i] - m.pS[i] * d, vx: 0, vy: 0, r: KB.plR + 2.6, k: 'keep:planted' });
      // forks flying home: straight, hF frames left (homeTouchJ, KR.homeR)
      for (let j = 0; j < (m.fh || 0); j++) circ({ x: m.hX[j], y: m.hY[j], vx: m.hVX[j], vy: m.hVY[j], r: homeR, t1: m.hF[j] + 1, k: 'keep:home' });
      // the recall's threads (rcW counts up to KB.recall; pQ 2) and the tug's (st 'tug', KB.tug; pQ 1): each fork flies
      // from its tip (9 px out of the surface) to the wound end of its thread, at recSp / tugSp x BS, from its release
      const flights = (q, t0, tx, ty, v) => { for (let i = 0; i < (m.pn || 0); i++) if (m.pQ && m.pQ[i] === q) {
        const x0 = m.pX[i] - sc, y0 = m.pY[i] - m.pS[i] * 9, d = Math.hypot(tx - x0, ty - y0) || 1, ux = (tx - x0) / d, uy = (ty - y0) / d;
        circ({ x: x0, y: y0, vx: 0, vy: 0, r: homeR, t0, t1: t0 + d / v + 1, k: q === 1 ? 'keep:tug' : 'keep:recall', fn: (t) => { const u = Math.max(0, t - t0) * v; return [x0 + ux * u, y0 + uy * u]; } }); } };
      if (m.rcW > 0 && !earlyT(m.rcW) && m.rtx != null) flights(2, KB.recall - m.rcW + 1, m.rtx, m.rty, KB.recSp * bs);
      if (m.st === 'tug' && !earlyT(m.wt) && m.tux != null) flights(1, KB.tug - m.wt + 1, m.tux, m.tuy, KB.tugSp * bs);
      // the boomerang: the 'boom' tell tracks, then locks for boomLock; out along la at boomSp to bl (the screen's edge,
      // or KB.boomEnd from the left), and back. A spinning capsule (boomHalf + boomR): a disc for the pilot
      const boomR = KB.boomHalf + KB.boomR + 2.6;
      if (m.st === 'boom' && !earlyT(m.wt) && m.lx != null) { const x0 = m.lx, y0 = m.ly, a = m.la, c = Math.cos(a), s = Math.sin(a);
        let Lb = c < -.05 ? (x0 - KB.boomEnd) / -c : 400; if (s < -.05) Lb = Math.min(Lb, (y0 - 6) / -s); if (s > .05) Lb = Math.min(Lb, (PH - 6 - y0) / s);
        const t0 = KB.boomTel - m.wt + 1, bl = Math.max(40, Lb);
        circ({ x: x0, y: y0, vx: 0, vy: 0, r: boomR, t0, t1: t0 + 2 * bl / KB.boomSp + 2, L: 1, k: 'keep:boom', fn: (t) => { const u = Math.max(0, t - t0); let d = KB.boomSp * u; if (d > bl) d = 2 * bl - d; return d < 0 ? null : [x0 + c * d, y0 + s * d]; } }); }
      if (m.st === 'fly') { const x0 = m.lx, y0 = m.ly, c = Math.cos(m.la), s = Math.sin(m.la), bl = m.bl, bs0 = m.bs, dir = m.bd;
        circ({ x: m.bx, y: m.by, vx: 0, vy: 0, r: boomR, t0: 0, L: 1, k: 'keep:boom', fn: (t) => { let d = bs0 + dir * KB.boomSp * t; if (dir > 0 && d > bl) d = 2 * bl - d; return d < 0 ? null : [x0 + c * d, y0 + s * d]; } }); }
      // the aimed throw ('aim' KB.aim, locked the last KB.lock): DOZING one fork, from AWAKE three KB.fan apart, at throwSp x BS
      if (m.st === 'aim' && !earlyT(m.wt) && m.lx != null) { const t0 = KB.aim - m.wt + 1, v = KB.throwSp * bs;
        for (let k = m.ph ? -1 : 0; k <= (m.ph ? 1 : 0); k++) { const a = m.la + k * KB.fan, c = Math.cos(a), s = Math.sin(a), x0 = m.lx, y0 = m.ly;
          circ({ x: x0, y: y0, vx: 0, vy: 0, r: 3 + 2.6, t0, k: 'keep:throw', fn: (t) => { const u = Math.max(0, t - t0) * v; return [x0 + c * u, y0 + s * u]; } }); } }
      // the search beam's rain (CRACKED): the ship's column marked mkT frames before three forks fall in it from the ceiling
      if (m.mkT > 0 && !earlyT(KB.bTel - m.mkT) && m.mkX != null) { const t0 = m.mkT + (m.hdB || 0), v = KB.bRainSp * bs;
        for (let k = 0; k < KB.bRainN; k++) { const x = m.mkX + (k - (KB.bRainN - 1) / 2) * KB.bRainDx, y0 = Math.max(2, Wm.ceilAt(x + sc)) + 3;
          circ({ x, y: y0, vx: 0, vy: 0, r: 4 + 2.6, t0, k: 'keep:rain', fn: (t) => [x, y0 + v * Math.max(0, t - t0)] }); } }
      seen('keepsake:' + (m.st || ''));
    });
    // ---- the Drive (boss/update.ts): the beam (and the TWIN BEAM's laser.ang2), live DRIVE.beam.live f after its charge;
    // the tentacles from tentPts with the reach state (rs, rf) advanced as stepReach does (bossrules.ts DRIVE.reach)
    const Bo = G.boss;
    if (Bo && !Bo.dying && Bo.laser && !(Bo.laser.tel > 0 && earlyT((Bo.laser.ml || 75) - Bo.laser.tel))) guard('beam', () => { const L = Bo.laser, Bm = BR && BR.DRIVE ? BR.DRIVE.beam : { live: 40, half: 6 }, t0 = L.tel > 0 ? L.tel : 0, t1 = t0 + (L.tel > 0 ? Bm.live : L.beam);
      line({ x: Bo.x, y: Bo.y, a: L.ang, len: 1000, w: Bm.half, t0, t1, k: 'beam' });
      if (Number.isFinite(L.ang2)) line({ x: Bo.x, y: Bo.y, a: L.ang2, len: 1000, w: Bm.half, t0, t1, k: 'beam2' }); });
    const BU = mod('BU'), RC = BR && BR.DRIVE ? BR.DRIVE.reach : null;
    const adv = (tt, t) => { if (!tt.rs || !RC || (tt.rs === 1 && earlyT(tt.rf))) return tt; let rs = tt.rs, rf = tt.rf + t; // stepReach: tell -> out (ext + hold) -> back
      if (rs === 1 && rf >= RC.tell) { rf -= RC.tell; rs = 2; } if (rs === 2 && rf >= RC.ext + RC.hold) { rf -= RC.ext + RC.hold; rs = 3; } if (rs === 3 && rf >= RC.back) { rs = 0; rf = 0; }
      return { ...tt, rs, rf }; };
    const tent = safeF('tentacle', (t) => { const out = []; if (!Bo || Bo.dying || !Bo.tent || !BU) return out; const bf = { ...Bo, t: Bo.t + t };
      for (const tt0 of Bo.tent) { const tt = adv(tt0, t), pts = BU.tentPts(bf, tt); for (let i = tt.rs ? 9 : 11; i < pts.length; i++) out.push([pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, i === 16 ? 8 : 5]); } return out; }) || (() => []);
    if (Bo && Bo.tent) live.add(Bo.tent.some((q) => q.rs) ? 'reach' : 'tentacle');
    const tentAt = {};
    // ---- terrain, DYN and solids at a look-ahead frame (W3a solids.ts; terrainb.ts dynOff for the tide / swallow)
    const TB = mod('TB'), Gt = G.t || 0, sols = [];
    if (SO && Array.isArray(SO.solids) && SO.SC) guard('solids', () => { const TER = SO.SC.TERRAIN, x0 = sc - 40, x1 = sc + W + ss * T.H + 40;
      for (const s of SO.solids) { if (!s || s.st === 'dead' || s.x > x1 || s.x + s.w < x0) continue;
        if (s.k === 'piston' && s.cls) { const C = s.rest + 2 * s.ext + s.hold; if (!(C > 0)) continue;
          // solids.ts stepPiston / pistonTipAt: the cycle frame is ++age + phase, so t frames on it is age + phase + t
          const ramp = (d, e, u) => (TB && TB.ramp ? TB.ramp(d, e, s.v, u) : d * Math.min(1, u / e));
          const tipAt = (u) => { const d = s.reach - s.root; if (u < s.rest) return s.root; if (u < s.rest + s.ext) return s.root + ramp(d, s.ext, u - s.rest);
            if (u < s.rest + s.ext + s.hold) return s.reach; return s.reach - ramp(d, s.ext, u - s.rest - s.ext - s.hold); };
          sols.push({ x0: s.x, x1: s.x + s.w, at: safeF('piston', (t) => { const a = s.age + s.phase + t, n = Math.floor(a / C), tip = s.skipN === n ? s.root : tipAt(a - n * C); return s.side > 0 ? [tip, PH + 99] : [-99, tip]; }) }); live.add('piston'); }
        else if (s.k === 'plug' && (s.st === 'grow' || s.st === 'cut')) { const tSet = s.st === 'grow' ? (s.tell || 44) - s.t : (s.regrow || 150) - s.t + (s.tell || 44), y0 = s.y, y1 = s.y + s.h;
          sols.push({ x0: s.x, x1: s.x + s.w, at: (t) => (t >= tSet ? [y0, y1] : null) }); }
        else if (s.cls & TER) { const y0 = s.y, y1 = s.y + s.h, vy = s.k === 'slab' ? s.vy || 0 : 0; sols.push({ x0: s.x, x1: s.x + s.w, at: (t) => [y0 + vy * t, y1 + vy * t] }); } } });
    const dynW = TB && TB.DYNS && TB.DYNS.length && TB.dynWinAt && TB.dynOff;
    const wallAt = (wx, t) => { let f = Wm.floorAt(wx), c = Wm.ceilAt(wx);
      if (dynW && t > 0) try { const w = TB.dynWinAt(wx); if (w) { const lt = Gt - w.t0, o0 = TB.dynOff(w.spec, wx, lt), o1 = TB.dynOff(w.spec, wx, lt + t); f -= o1[1] - o0[1]; c += o1[0] - o0[0]; const sp0 = w.spec, fit = sp0.fit || 0;
        if (f - c < fit) { if (sp0.kind === 'tide') { if (sp0.side === -1) c = f - fit; else f = c + fit; } else { const mm = (c + f) / 2; c = mm - fit / 2; f = mm + fit / 2; } } // writeWin's fit clamp
        live.add('dyn'); } } catch (e) { (window.__pilotLog.err ||= {}).dyn = String(e && e.message || e).slice(0, 120); }
      return [c, f]; };
    // ---- danger of standing at (x, y) at look-ahead frame t: 1e6 inside a hit, else a falloff with clearance. cs: the
    // candidate move (its ship path, for the attacks that track the ship); lng: the long look-ahead (telegraphs only)
    const danger = (x, y, t, cs, lng) => {
      let d = 0;
      for (const o of th) { if (lng && !o.L) continue; if (o.t0 != null && t < o.t0 - 3) continue; if (o.t1 != null && t > o.t1) continue;
        let ox, oy; if (o.fn) { const q = o.fn(t); if (!q) continue; ox = q[0]; oy = q[1]; } else { ox = o.x + o.vx * t; oy = o.y + o.vy * t + (o.ay ? .5 * o.ay * t * (t + 1) : 0); }
        const c = Math.hypot(x - ox, y - oy) - o.r;
        if (c < 0) return 1e6; if (!lng && c < T.margin * 3) d += (T.margin * 3 - c) ** 2; }
      for (const l of lines) { if (lng && !l.L) continue; if (t < l.t0 - 4 || t >= l.t1 + 2) continue; let c;
        if (l.pts) { c = 1e9; for (let i = 1; i < l.pts.length; i++) c = Math.min(c, segD(l.pts[i - 1][0], l.pts[i - 1][1], l.pts[i][0], l.pts[i][1], x, y)); c -= l.w; }
        else { const a = l.fa ? l.fa(t) : l.a, dx = Math.cos(a), dy = Math.sin(a), px = x - l.x, py = y - l.y;
          const u = Math.max(0, Math.min(l.len, px * dx + py * dy)); c = Math.hypot(px - dx * u, py - dy * u) - l.w; }
        if (c < 4) return 1e6; if (!lng && c < 20) d += (20 - c) ** 2 * 2; }
      // the cleavers: the swept wedge at each frame u since the last sample, against the candidate's own ship at u. The
      // clearance is px out of the wedge (radially, or round its edge); under T.secHit it is a hit, under T.secSoft it
      // costs, so a plan that clears the edge by a hair (the wedge sweeps .14 rad a frame) loses to one that clears it well
      for (const q of sectors) for (let u = Math.max(1, t - (lng ? T.stepL : T.step) + 1); u <= t; u++) { const z = q.sim(cs, u); if (!z) continue;
        const sp0 = u === t ? [x, y] : cs.pos(u), dx = sp0[0] - z[0], dy = sp0[1] - z[1], r = Math.hypot(dx, dy);
        let a = Math.atan2(dy, dx); if (a < 0) a += TAU;
        const da = a < z[2] ? z[2] - a : a > z[3] ? a - z[3] : 0, ca = da > 0 ? (da >= Math.PI / 2 ? r : r * Math.sin(da)) : -1e9;
        const c = Math.max(ca, q.r0 - r, r - q.r1);
        if (c < T.secHit) return 1e6; if (c < T.secSoft) d += (T.secSoft - c) ** 2 * 2; }
      if (lng) return d;
      if (Bo && Bo.tent) { const sg = tentAt[t] || (tentAt[t] = tent(t) || []); for (const [ax, ay, bx, by, qr] of sg) { const c = segD(ax, ay, bx, by, x, y) - qr - 4; if (c < 0) return 1e6; if (c < 12) d += (12 - c) ** 2; } }
      // terrain and solids: the ship's hull points (player.ts) at that frame's world x
      for (const [ox, oy] of HULL) { const wx = x + ox + sc + ss * t, yy = y + oy;
        const [c, f] = wallAt(wx, t);
        if (yy >= f - 1 || yy <= c + 1) return 1e6;
        let mg = Math.min(f - yy, yy - c);
        for (const s of sols) { if (wx < s.x0 - 3 || wx > s.x1 + 3) continue; const iv = s.at(t); if (!iv) continue;
          if (yy >= iv[0] - 1 && yy <= iv[1] + 1) return 1e6; mg = Math.min(mg, yy < iv[0] ? iv[0] - yy : yy - iv[1]); }
        if (mg < T.wall) d += (T.wall - mg) ** 2 * 4; }
      for (const h of haz) { const hx = h.x - ss * t; if (Math.abs(hx - x) > 12 || early(h.t)) continue;
        if (h.k === 'icicle') { const u = h.t + t > 50 ? h.t + t - Math.max(50, h.t) : 0, fall = (h.vy || 0) * u + .11 * u * (u + 1), y0 = h.y + fall; if (y > y0 - 2 && y < y0 + h.len + 6) return 1e6; }
        else if (h.k === 'geyser' || h.k === 'jet') { const warm = h.k === 'geyser' ? 70 : 60, lv = h.live || (h.k === 'geyser' ? 45 : 70); if (h.t + t < warm - 4 || h.t + t > warm + lv + 2 || Math.abs(hx - x) > 10) continue;
          const reach = (h.k === 'geyser' ? h.y - h.top : h.span) * (h.k === 'geyser' ? .62 : .55);
          const y0 = h.k === 'geyser' ? h.y - reach : h.dir > 0 ? h.y : h.y - reach, y1 = h.k === 'geyser' ? h.y : h.dir > 0 ? h.y + reach : h.y;
          if (y > y0 - 6 && y < y1 + 6) return 1e6; }
        else if (h.k === 'strand') d += 400; }
      return d;
    };
    const anyLong = th.some((o) => o.L) || lines.some((l) => l.L) || sectors.length > 0;
    // candidates: stay, or move in one of T.dirs directions at each speed, held for the look-ahead (and on, straight,
    // to T.HL against the telegraphed attacks, kept inside the screen and the walls)
    let best = [0, 0], bestS = Infinity, safe = false; // [0, 0] = stay: if every score is NaN (bad terrain read), hold still rather than throw
    for (const f of T.speeds) for (let k = 0; k < (f ? T.dirs : 1); k++) {
      const a = (k / T.dirs) * Math.PI * 2, vx = Math.cos(a) * sp * f, vy = Math.sin(a) * sp * f;
      const pos = (u) => { const px = Math.min(W - 16, Math.max(10, P.x + vx * u)); let py = Math.min(PH - 6, Math.max(6, P.y + vy * u));
        if (u > T.H) { const [c, fl] = wallAt(px + sc + ss * u, T.H); py = Math.max(c + 8, Math.min(fl - 8, py)); } return [px, py]; };
      const cs = { pos, m: new Map() };
      let s = 0, x = P.x, y = P.y, hit = false;
      for (let t = T.step; t <= T.H; t += T.step) { [x, y] = pos(t);
        const d = danger(x, y, t, cs, false); if (d >= 1e6) { s += 1e6 / t; hit = true; break; } s += d / t; }
      if (!hit && anyLong) for (let t = T.H + T.stepL; t <= T.HL; t += T.stepL) { const q = pos(t);
        const d = danger(q[0], q[1], t, cs, true); if (d >= 1e6) { s += 1e6 / t; hit = true; break; } s += d / t; }
      // the goal pull: the calling tool's target, so the bot still aims, collects and kills
      if (tx != null) s += T.goalW * Math.hypot(x - tx, y - ty) ** 2 / 10;
      if (!hit) safe = true;
      if (s < bestS) { bestS = s; best = [vx, vy]; }
    }
    if (!safe) window.__pilotLog.trapped++;
    window.__pilotLog.ms += rnow() - t00;
    for (const k of live) seen(k);
    { const near = th.map((o) => [Math.round(Math.hypot(o.x - P.x, o.y - P.y) - o.r), o.k]).sort((a, b) => a[0] - b[0]).slice(0, 2);
      ctx = { st: (G.loop + 1) + '-' + ((G.stage || 0) + 1), sc: Math.round(sc), x: Math.round(P.x), y: Math.round(P.y), mini: mini ? mini.k : null, mst: mini ? mini.st || '' : '', boss: !!G.boss,
        near, en: g.enemies.filter((e) => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 90).map((e) => e.k + ':' + (e.st || '')).slice(0, 4), safe, inv: P.inv, shield: P.shield,
        live: [...live].filter((k) => !k.startsWith('shot:')).slice(0, 8) }; }
    if (HU) { // execution: motor noise on the chosen move, the next correction PLAN frames on, sometimes an overshoot
      const m = Math.hypot(best[0], best[1]);
      if (m > 0) { const a = Math.atan2(best[1], best[0]) + HU.dirSd * hgauss(), f = HU.spLo + (1 - HU.spLo) * hr(); best = [Math.cos(a) * m * f, Math.sin(a) * m * f]; }
      const turned = HS.v && m > 0 && (HS.v[0] * best[0] + HS.v[1] * best[1]) < 0;
      HS.hold = HU.plan - 1 + (turned && hr() < HU.over ? HU.overF : 0);
      HS.v = best; HS.safe = safe; HS.ax = HU.aimSd * hgauss(); HS.ay = HU.aimSd * hgauss(); window.__pilotLog.human = HU; }
    P.x = Math.min(W - 16, Math.max(10, P.x + best[0])); P.y = Math.min(PH - 6, Math.max(6, P.y + best[1]));
    keepPrev(g, G);
  };
  // last frame's positions, which vel() differences: every path that ends a frame (a plan or a human hold) calls it
  function keepPrev(g, G) {
    const SO = mod('SO');
    for (const e of g.enemies) prev.set(e, [e.x, e.y]); if (G.boss) prev.set(G.boss, [G.boss.x, G.boss.y]);
    { const Bb = globalThis.__biome ? globalThis.__biome() : null, eng = Bb && Bb.sig && Bb.sig.eng; if (eng && Array.isArray(eng.blocks)) for (const k of eng.blocks) if (k) prev.set(k, [k.x, k.y]);
      // W3a engine BODY solids (world x): the stored x is advanced by this frame's scroll, so vel() reads screen velocity (W6)
      if (SO && Array.isArray(SO.solids) && SO.SC) for (const q of SO.solids) if (q && q.cls === SO.SC.BODY) prev.set(q, [q.x + (G.scrollSpeed || 0), q.y]); }
  }
})();`;
