// Space probe (DIFFICULTY-SPEC §3 L1-L3, L7, N4; levels.md §7): how much room the terrain leaves, flown for real.
// Built on the audit sampler (pod-probe's seeded clock and bot, tools/pilot.mjs's dodging pilot, kept invincible so
// every stage of Descent 1 is sampled). Measure-only: it reads the page every frame and draws no R(); the pilot
// moves the ship, as in pod-probe. Every metric is per stage (biome stages keyed by slot and kind, e.g. 1-2:ice):
//   fh        free height at the ship's world x: the largest open interval (terrain minus SOLIDS) / 254, p50 / p10.
//             Orbit also reports `orbit>=3700` (stage x >= 3700); the Drive row is its approach (no Drive up)
//   squeeze_s seconds with fh <= 55% (Orbit 60%)
//   fit       levels.md S1 swept fit gap (min floor - max ceil over [wx - 9, wx + 12], solids as terrain), the minimum
//             over the visible screen sampled every 8 px each 4th frame: `out` outside the src/sigs.ts windows,
//             `in` inside them, with the window that held the minimum ('n/a' windows on a build without sigs.ts)
//   fm / fmPerMin  forced moves: an episode where a ship holding its y at its x for the next 90 f would touch
//             terrain or a SOLID (from the arrays; the solids are read at their current place), episodes >= 60 f apart
//   cover     body cover at the ship's x + 60: enemy circles (r + 4) crossing that column, the covered share of 254,
//             p50 / p90, and p90 inside the CREW KNOTS window (`coverSig`, a window whose id names knot or crew: L7)
//   entries   formation, drone and hatchling spawns by entry edge (right / left / top / bottom / wall / inside), one
//             per formation, from where each is first seen (probe-lib entryEdge: e.pat behind / drop / rise and a wall
//             birth decide first)
//   near      spawns closer than the fairness distances (spec C9): bodies within 48 px of the ship, enemy shots
//             spawned within 64 px (`near.shot64`), with the closest seen
//   bullets   enemy bullets on screen as pod-probe's `bullets` (the "no increase" check)
// Usage: node tools/space-probe.mjs <url> <seed> [--route ice,fire] [--tier N | --brutal N] [--layout long4]
//   --route a,b forces fork slot 0 to biome a and slot 1 to biome b (both gates: a scenario control that overwrites
//   G.fork.opts after openFork's draws, not bot steering), so four runs cover every biome in both slots with routes
//   the game can produce (midpick.ts forkAllows keeps acid and snot apart): ice,acid  acid,fire  fire,snot  snot,ice.
//   fm counts the condition's false-to-true turns. Prints one JSON line.
import { chromium } from 'playwright';
import { useLayout, LAYOUT } from './layout-arg.mjs';
import { PILOT } from './pilot.mjs';
import { pageLib, CAPS, hq, hmax, hshare } from './probe-lib.mjs';
const opt = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv.splice(i, 2)[1] : null; };
const ROUTE = (opt('--route') || '').split(',').filter(Boolean), TIER = opt('--tier'), BRU = opt('--brutal');
const [url, SEED = '1', MIN = '14'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(PILOT);
await p.addInitScript(pageLib);
await p.addInitScript(([seed, route]) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); } catch (e) {}
  window.__fr = 0;
  const S = (window.__sp = { st: {}, forced: new WeakSet() });
  const row = (k) => (S.st[k] ||= { frames: 0, fh: {}, fh37: {}, sq: 0, fitOut: null, fitIn: null, fitInWin: null, fm: 0, lastFm: -1e9, cover: {}, coverSig: {}, entries: {}, bodies48: 0, bodyMin: null, shot64: 0, shotMin: null });
  const seenE = new WeakSet(), seenG = new WeakSet();
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G();
      if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true; const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; }
          else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss || g.enemies.find((e) => !e.dead); tx = 90; ty = m ? m.y : g.P.y; } }
        if (G.fork && route.length && !S.forced.has(G.fork)) { S.forced.add(G.fork); const bi = route[G.fork.seg]; if (bi) G.fork.opts = [bi, bi]; } // --route
        window.__pilotStep(g, tx, ty); }
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G(), PL = window.__PL;
      if (!h || !h.G || h.state !== 'play' || !PL || !PL.mods.W) continue;
      window.__fr++; const fr = window.__fr, G = h.G, P = h.P, Wm = PL.mods.W, LY = window.__LY;
      if (G.tally || G.fork || !P) continue;
      const si = G.stage || 0, r0 = LY.row(si), kind = r0 ? r0.kind : '?', slot = LY.slotOf(si);
      const key = `${G.loop + 1}-${si + 1}` + (slot >= 0 && G.route ? ':' + G.route[slot] : kind === 'drive' ? ':approach' : kind === 'orbit' ? ':orbit' : '');
      if (kind === 'drive' && G.boss) { PL.tagShots(h, fr); continue; } // the Drive row is the approach
      const R = row(key); R.frames++;
      PL.bulFrame(h, key);
      const wx = P.x + G.scroll, o = PL.openAt(wx), fh = Math.round(o.h / 254 * 100);
      R.fh[fh] = (R.fh[fh] || 0) + 1; if (fh <= (kind === 'orbit' ? 60 : 55)) R.sq++;
      if (kind === 'orbit' && r0 && wx - r0.x0 >= 3700) R.fh37[fh] = (R.fh37[fh] || 0) + 1;
      const ws = PL.sigs();
      if (fr % 4 === 0) for (let x = 0; x <= 480; x += 8) { const u = G.scroll + x, f = PL.fitAt(u), w = PL.inSig(u, ws);
        if (w) { if (R.fitIn == null || f < R.fitIn) { R.fitIn = f; R.fitInWin = w.id || `${w.x0}-${w.x1}`; } } else if (R.fitOut == null || f < R.fitOut) R.fitOut = f; }
      // forced move: holding y at this x for 90 f touches terrain or a solid
      const ss = G.scrollSpeed ?? 1;
      { let touch = false;
        if (ss > 0) for (let t = 3; t <= 90 && !touch; t += 3) for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) { const u = wx + ox + ss * t, yy = P.y + oy;
          if (yy >= Wm.floorAt(u) || yy <= Wm.ceilAt(u) || PL.solids(u).some(([a, b]) => yy >= a && yy <= b)) { touch = true; break; } }
        // an episode starts when the condition turns true, at least 60 f after the last one started (qa-lead review:
        // a long squeeze is one episode, not one a second)
        if (touch && !R.fmOn && fr - R.lastFm >= 60) { R.fm++; R.lastFm = fr; } R.fmOn = touch; }
      // body cover on the column at ship x + 60
      const cx = P.x + 60, iv = [];
      for (const e of h.enemies) { if (e.dead) continue; const rr = (e.r || 6) + 4; if (Math.abs(e.x - cx) < rr) { const hw = Math.sqrt(rr * rr - (e.x - cx) ** 2); iv.push([Math.max(0, e.y - hw), Math.min(254, e.y + hw)]); } }
      iv.sort((a, b) => a[0] - b[0]); let cov = 0, ce = -1; for (const [a, b] of iv) { if (b <= ce) continue; cov += b - Math.max(a, ce); ce = b; }
      const cv = Math.round(cov / 254 * 100); R.cover[cv] = (R.cover[cv] || 0) + 1; const kw = PL.inSig(wx + 60, ws); if (kw && /knot|crew/i.test(kw.id || '')) R.coverSig[cv] = (R.coverSig[cv] || 0) + 1;
      // entries and spawn distances: regular enemies the first frame they are seen
      for (const e of h.enemies) { if (seenE.has(e)) continue; seenE.add(e); if (e.dead || e.mini || e.par || e.kid || e.big) continue;
        const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < 48) R.bodies48++; if (R.bodyMin == null || d < R.bodyMin) R.bodyMin = Math.round(d);
        if (!PL.entrant(e)) continue;
        if (e.group) { if (seenG.has(e.group)) continue; seenG.add(e.group); }
        const edge = PL.entryEdge(e, G); R.entries[edge] = (R.entries[edge] || 0) + 1; }
      for (const t of PL.tagShots(h, fr) || []) { if (t.sd < 64) R.shot64++; if (R.shotMin == null || t.sd < R.shotMin) R.shotMin = Math.round(t.sd); }
    } };
}, [+SEED, ROUTE]);
const qs = [TIER != null ? 'tier=' + TIER : '', BRU != null ? 'brutal=' + BRU : ''].filter(Boolean).join('&');
await p.goto(qs ? url + (url.includes('?') ? '&' : '?') + qs : url); await p.waitForFunction(() => window.__started);
await useLayout(p, 'space-probe', { quiet: true });
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
const MODS = await p.evaluate(async () => { const m = await window.__PL.load(); window.__W = window.__PL.mods.W; window.__BU = window.__PL.mods.BU; window.__DN = window.__PL.mods.DN; window.__fr = 0; return m; });
let lastFork = false, endState = '';
for (let it = 0; it < MIN * 60 * 2; it++) {
  await p.evaluate('__tick(30)');
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, loop: G.loop, stage: G.stage, fork: !!G.fork, pick: !!G.pick, pt: G.pick ? G.pick.t : 0 }; });
  if (s.fork && !lastFork) await p.evaluate(() => (window.__gi = (window.__gi ?? 0) + 1));
  lastFork = s.fork;
  if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  if (s.st !== 'play' || s.loop >= 1) { endState = s.st + ' loop' + s.loop + ' stage' + s.stage; break; }
}
const raw = await p.evaluate(() => ({ st: window.__sp.st, bul: window.__PL.bul, route: __G().G.route, sigs: window.__PL.sigs(), solids: window.__PL.hasSolids(), tier: Number.isInteger(__G().G.tier) ? __G().G.tier : 'n/a', brutal: __G().G.brutal ?? (window.__PL.mods.BR ? 0 : 'n/a'), cerr: window.__PL.contractErr }));
const tierN = Number.isInteger(raw.tier) ? raw.tier : 1;
const stages = Object.fromEntries(Object.entries(raw.st).map(([k, R]) => { const orbit = k.includes(':orbit'), mins = R.frames / 3600;
  const bl = raw.bul[k + '|scroll'], all = {}; for (const c of ['scroll', 'setp', 'boss']) { const v = raw.bul[k + '|' + c]; if (v) for (const [n, m] of Object.entries(v.ns)) all[n] = (all[n] || 0) + m; }
  return [k, { s: +(R.frames / 60).toFixed(1), fh: { p50: hq(R.fh, .5), p10: hq(R.fh, .1) }, ...(orbit ? { 'orbit>=3700': { p50: hq(R.fh37, .5), p10: hq(R.fh37, .1) } } : {}),
    squeeze_s: +(R.sq / 60).toFixed(1), fit: { out: R.fitOut != null ? Math.round(R.fitOut) : null, in: raw.sigs == null ? 'n/a' : R.fitIn != null ? Math.round(R.fitIn) : null, inWin: R.fitInWin },
    fm: R.fm, fmPerMin: mins ? +(R.fm / mins).toFixed(1) : null, cover: { p50: hq(R.cover, .5), p90: hq(R.cover, .9) }, coverSig: raw.sigs == null ? 'n/a' : Object.keys(R.coverSig).length ? hq(R.coverSig, .9) : null,
    entries: R.entries, near: { bodies48: R.bodies48, bodyMin: R.bodyMin, shot64: R.shot64, shotMin: R.shotMin },
    bullets: { p50: hq(all, .5), p90: hq(all, .9), max: hmax(all), scrollP50: bl ? hq(bl.ns, .5) : null, scrollP90: bl ? hq(bl.ns, .9) : null, scrollGt5: bl ? +hshare(bl.ns, 5).toFixed(3) : null, scrollOverCap: bl ? bl.over : null, cap: CAPS.scroll[tierN] }, hist: { fh: R.fh, fh37: R.fh37, cover: R.cover } }]; }));
console.log(JSON.stringify({ seed: +SEED, layout: LAYOUT, route: raw.route, asked: ROUTE, tier: raw.tier, brutal: raw.brutal, mods: MODS, sigs: raw.sigs == null ? 'n/a' : raw.sigs.length, solids: raw.solids ? 'yes' : 'n/a', contractErr: raw.cerr, stages, endState, errors: errs.slice(0, 3) }));
await b.close();
