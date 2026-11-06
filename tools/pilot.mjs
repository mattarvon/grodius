// Dodging autopilot for the mortal bots (LS1 carry-forwards: the long4 mortal bot game-overs in the first biome, so
// hits/min, grades, wall times and biomass past Orbit can't be measured; build plan "LS1-G studio review" items 1, 2, 9).
// The older pilots (pod-probe, layout-parity, harness) only steer toward a target and never dodge. This one picks,
// every frame, the move that keeps the ship clearest of danger over a short look-ahead, and only then pulls toward the
// target the calling tool chooses.
//
// It plays by the ship's rules: it moves at most the ship's real speed per frame (player.ts: (1.25 + .42 x speed) x
// SLOW), inside the same screen clamp, and it sees only what a player sees on screen (enemy shots, bodies, the boss,
// terrain, biome hazards). It does not read the sim RNG, so it doesn't move the sim stream; it changes where the ship
// is, which is the point.
//
// Usage (in a tool):
//   import { PILOT } from './pilot.mjs';
//   await p.addInitScript(PILOT);                         // defines window.__pilotStep (before page scripts)
//   ...after window.__started:  await p.evaluate(async () => { window.__W = await import('/src/world.ts');
//                                 window.__BU = await import('/src/boss/update.ts'); });
//   in the per-frame hook, instead of moving P toward (tx, ty):  window.__pilotStep(g, tx, ty);
// `window.__pilotLog` reports `frames` piloted, `trapped` (frames where every candidate move was unsafe) and `deaths`
// (for each life lost: the stage, scroll, position, the midboss or Drive up, and the two nearest threats just before).
// Attacks with no projectile that it models from their telegraphs: the Saucer's lash, the Drive's beam, the
// Apprentice's and the Butcher's cleaver sectors, and the Butcher's hook; the Drive's tentacles are predicted from
// boss/update.ts tentPts. Not modelled (seen only through the enemy's body and shots): any other no-projectile attack.
// Like the older bots it moves the ship by writing P.x / P.y, not through input; the speed cap keeps that honest.

/** look-ahead (frames) and its sampling step, candidate speeds (fractions of the ship's speed) and directions, the
 *  clearance under which a threat starts to cost (px, x3), the wall clearance (px), and the pull toward the target */
export const PILOT_TUNE = { H: 24, step: 2, speeds: [0, .5, 1], dirs: 16, margin: 6, wall: 7, goalW: .02 };

// The page-side code, as a string so addInitScript can take it. Kept dependency-free: it reads window.__G (main.ts),
// window.__W (src/world.ts: eshots, floorAt, ceilAt), window.__BU (src/boss/update.ts: tentPts, the Drive's tentacles)
// and globalThis.__biome (biomes.ts: hazards).
export const PILOT = `(() => {
  const T = ${JSON.stringify(PILOT_TUNE)};
  const W = 480, PH = 254;
  const prev = new WeakMap();
  window.__pilotLog = { frames: 0, trapped: 0, deaths: [] }; let alive = false, ctx = null;
  // per-entity velocity from the last frame's position (most enemies move by their own rules, not vx/vy)
  const vel = (e) => { const p = prev.get(e); const v = p ? [e.x - p[0], e.y - p[1]] : [e.vx || 0, e.vy || 0]; return v; };
  window.__pilotStep = (g, tx, ty) => {
    const P = g.P, G = g.G, Wm = window.__W;
    // a death since the last frame: keep what the pilot saw just before it (where, and the closest threats)
    if (P && alive && !P.alive && ctx) window.__pilotLog.deaths.push(ctx);
    alive = !!(P && P.alive); if (!P || !P.alive || !Wm) return;
    window.__pilotLog.frames++;
    const sp = (1.25 + (P.speed || 0) * .42) * (P.slow > 0 ? .45 : 1);
    const ss = G.scrollSpeed ?? 1, sc = G.scroll; // ?? not ||: the scroll is exactly 0 during held midbosses and the Drive (step.ts)
    // threats, each { x, y, vx, vy, r } in screen space; terrain and hazards are checked separately
    const th = [];
    for (const s of Wm.eshots) th.push({ x: s.x, y: s.y, vx: s.vx || 0, vy: s.vy || 0, r: (s.r || 2) + 2.6, k: 'shot:' + s.k });
    for (const e of g.enemies) { if (e.dead || e.ghost > 0) continue; const [vx, vy] = vel(e); th.push({ x: e.x, y: e.y, vx, vy, r: (e.r || 6) + 4, k: e.k });
      if (e.hb) for (const h of e.hb) th.push({ x: e.x + h[0], y: e.y + h[1], vx, vy, r: h[2] + 4 }); }
    if (G.boss && !G.boss.dying) { const b = G.boss, [vx, vy] = vel(b); th.push({ x: b.x, y: b.y, vx, vy, r: 62, k: 'drive' }); }
    const B = globalThis.__biome ? globalThis.__biome() : null, haz = B ? B.haz : [];
    // line attacks with no projectile, each { x, y, a, len, w, t0, t1 }: active for look-ahead frames t0 <= t < t1
    const lines = [];
    for (const e of g.enemies) if (!e.dead && e.k === 'ufo' && (e.st === 'lash' || e.st === 'whip')) {
      // the Saucer's lash (enemies/ufo.ts): telegraph (aims, locks 16 f before), then the whip hits from wt 4 to 20
      const ox = e.x - 34, oy = e.y + 9, tel = e.lash2 ? 28 : 42, w0 = e.st === 'lash' ? tel - e.wt : -e.wt;
      lines.push({ x: ox, y: oy, a: e.la, len: 238, w: 6, t0: w0 + 4, t1: w0 + 21 });
    }
    // the Apprentice's cleaver (enemies/update.ts 'tel' 50 f, then 'cut' hits for 12 f): a sector of radius 14-84 px
    // around its cleaver, angles 2.30-3.99 rad (down-left round to up-left); the safe places are above, below, behind it
    const sectors = [];
    for (const e of g.enemies) if (!e.dead && e.k === 'prentice' && (e.st === 'tel' || e.st === 'cut')) {
      const [vx, vy] = vel(e), w0 = e.st === 'tel' ? 50 - e.wt : -e.wt;
      sectors.push({ x: e.x - 8, y: e.y - 6, vx, vy, r0: 14, r1: 84, a0: 2.30, a1: 3.99, t0: w0, t1: w0 + 13 });
    }
    // the Butcher (the fire biome's boss, enemies/update.ts): the same cleaver sector, larger (18-100 px, 'ctel' 48 f), and
    // a chain hook aimed at you ('htel' 40 f) that flies out 7 px/f to 230 px (hit radius 8)
    for (const e of g.enemies) if (!e.dead && e.k === 'butcher') {
      const [vx, vy] = vel(e);
      if (e.st === 'ctel' || e.st === 'cut') { const w0 = e.st === 'ctel' ? 48 - e.wt : -e.wt; sectors.push({ x: e.x - 10, y: e.y - 10, vx, vy, r0: 18, r1: 100, a0: 2.30, a1: 3.99, t0: w0, t1: w0 + 13 }); }
      if (e.st === 'htel' || (e.st === 'hook' && e.hk && e.hk.out)) { const w0 = e.st === 'htel' ? 40 - e.wt : 0;
        lines.push({ x: e.x + 10, y: e.y - 8, a: e.ha, len: 236, w: 8, t0: w0, t1: w0 + 34 }); }
    }
    const Bo = G.boss;
    if (Bo && !Bo.dying && Bo.laser) { const L = Bo.laser; // the Drive's beam (boss/update.ts): charges L.tel, then 40 f
      lines.push({ x: Bo.x, y: Bo.y, a: L.ang, len: 1000, w: 6, t0: L.tel > 0 ? L.tel : 0, t1: (L.tel > 0 ? L.tel : 0) + (L.tel > 0 ? 40 : L.beam) }); }
    const BU = window.__BU;
    const tent = (t) => { const out = []; if (!Bo || Bo.dying || !Bo.tent || !BU) return out; const bf = { ...Bo, t: Bo.t + t };
      for (const tt of Bo.tent) { const pts = BU.tentPts(bf, tt); for (let i = 10; i < pts.length; i++) out.push([pts[i].x, pts[i].y, i === 16 ? 8 : 5]); } return out; };
    const tentAt = {};
    // danger of standing at (x, y) at look-ahead frame t: 1e6 inside a hit, else a falloff with clearance
    const danger = (x, y, t) => {
      let d = 0;
      for (const o of th) { const ox = o.x + o.vx * t, oy = o.y + o.vy * t, c = Math.hypot(x - ox, y - oy) - o.r;
        if (c < 0) return 1e6; if (c < T.margin * 3) d += (T.margin * 3 - c) ** 2; }
      for (const l of lines) { if (t < l.t0 - 4 || t >= l.t1 + 2) continue; const dx = Math.cos(l.a), dy = Math.sin(l.a), px = x - l.x, py = y - l.y;
        const u = Math.max(0, Math.min(l.len, px * dx + py * dy)), c = Math.hypot(px - dx * u, py - dy * u) - l.w;
        if (c < 4) return 1e6; if (c < 20) d += (20 - c) ** 2 * 2; }
      for (const q of sectors) { if (t < q.t0 - 4 || t >= q.t1 + 2) continue; const qx = q.x + q.vx * t, qy = q.y + q.vy * t, r = Math.hypot(x - qx, y - qy);
        let a = Math.atan2(y - qy, x - qx); if (a < 0) a += Math.PI * 2;
        if (r > q.r0 - 6 && r < q.r1 + 8 && a > q.a0 - .15 && a < q.a1 + .15) return 1e6; }
      if (Bo && Bo.tent) { const pts = tentAt[t] || (tentAt[t] = tent(t)); for (const [qx, qy, qr] of pts) { const c = Math.hypot(x - qx, y - qy) - qr - 4; if (c < 0) return 1e6; if (c < 12) d += (12 - c) ** 2; } }
      // terrain: the ship's hull points (player.ts) against floor and ceiling at that frame's world x
      for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) { const wx = x + ox + sc + ss * t, yy = y + oy;
        const f = Wm.floorAt(wx), c = Wm.ceilAt(wx);
        if (yy >= f - 1 || yy <= c + 1) return 1e6;
        const m = Math.min(f - yy, yy - c); if (m < T.wall) d += (T.wall - m) ** 2 * 4; }
      for (const h of haz) { const hx = h.x - ss * t; if (Math.abs(hx - x) > 12) continue;
        if (h.k === 'icicle') { const fall = h.t + t > 50 ? (h.vy || 0) * t + .11 * t * t : 0, y0 = h.y + fall; if (y > y0 - 2 && y < y0 + h.len + 6) return 1e6; }
        else if (h.k === 'geyser' || h.k === 'jet') { const warm = h.k === 'geyser' ? 70 : 60; if (h.t + t < warm - 20) continue;
          const reach = (h.k === 'geyser' ? h.y - h.top : h.span) * (h.k === 'geyser' ? .62 : .55);
          const y0 = h.k === 'geyser' ? h.y - reach : h.dir > 0 ? h.y : h.y - reach, y1 = h.k === 'geyser' ? h.y : h.dir > 0 ? h.y + reach : h.y;
          if (y > y0 - 6 && y < y1 + 6) return 1e6; }
        else if (h.k === 'strand') d += 400; }
      return d;
    };
    // candidates: stay, or move in one of T.dirs directions at each speed, held for the look-ahead
    let best = [0, 0], bestS = Infinity, safe = false; // [0, 0] = stay: if every score is NaN (bad terrain read), hold still rather than throw
    for (const f of T.speeds) for (let k = 0; k < (f ? T.dirs : 1); k++) {
      const a = (k / T.dirs) * Math.PI * 2, vx = Math.cos(a) * sp * f, vy = Math.sin(a) * sp * f;
      let s = 0, x = P.x, y = P.y, hit = false;
      for (let t = T.step; t <= T.H; t += T.step) { x = Math.min(W - 16, Math.max(10, P.x + vx * t)); y = Math.min(PH - 6, Math.max(6, P.y + vy * t));
        const d = danger(x, y, t); if (d >= 1e6) { s += 1e6 / t; hit = true; break; } s += d / t; }
      // the goal pull: the calling tool's target, so the bot still aims, collects and kills
      if (tx != null) s += T.goalW * Math.hypot(x - tx, y - ty) ** 2 / 10;
      if (!hit) safe = true;
      if (s < bestS) { bestS = s; best = [vx, vy]; }
    }
    if (!safe) window.__pilotLog.trapped++;
    { const near = th.map((o) => [Math.round(Math.hypot(o.x - P.x, o.y - P.y) - o.r), o.k]).sort((a, b) => a[0] - b[0]).slice(0, 2);
      ctx = { st: (G.loop + 1) + '-' + ((G.stage || 0) + 1), sc: Math.round(sc), x: Math.round(P.x), y: Math.round(P.y), mini: G.mini && !G.mini.dead ? G.mini.k : null, boss: !!G.boss,
        near, en: g.enemies.filter((e) => !e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 90).map((e) => e.k + ':' + (e.st || '')).slice(0, 4), safe, inv: P.inv, shield: P.shield }; }
    P.x = Math.min(W - 16, Math.max(10, P.x + best[0])); P.y = Math.min(PH - 6, Math.max(6, P.y + best[1]));
    for (const e of g.enemies) prev.set(e, [e.x, e.y]); if (G.boss) prev.set(G.boss, [G.boss.x, G.boss.y]);
  };
})();`;
