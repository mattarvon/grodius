// Shared measurement kit for the difficulty probes (DIFFICULTY-SPEC §3.1, workstream W5). Measure-only: nothing here
// moves the ship, writes sim state or draws R(). It reads the page through window.__G() and the live /src modules.
//
// Graceful on older builds: the modules the difficulty rebuild adds (src/rank.ts, src/sigs.ts, src/solids.ts) are
// imported optionally. A probe on a build without them reports 'n/a' for what they feed (rank, signature windows,
// solids) instead of failing, and G.tier missing reads as 'n/a' too (the caps then use Normal's column).
//
// Node side:  import { pageLib, CAPS, VCAP, hq, hmax, hshare, K0, K1, kitHas, pct } from './probe-lib.mjs';
//             await p.addInitScript(pageLib);              // defines window.__PL before page scripts
//             ...after window.__started:  await p.evaluate(() => window.__PL.load());
// Page side (window.__PL): see each member's comment below.

/** spec §2.1 bullet caps by context and tier (Easy, Normal, Hard, Very Hard): scroll / set piece + midboss / boss */
export const CAPS = { scroll: [6, 8, 10, 10], setp: [12, 16, 20, 20], boss: [18, 24, 30, 30] };
/** spec §2.1 V_CAP (px/f) by tier */
export const VCAP = [2.6, 2.6, 2.9, 2.9];
/** spec §2.2 K0 and K1 as minimum slot levels, P = [speed, missile, double, laser, pyre, options, wardLv]:
 *  K0 THRUST 2, MISSILE 1, SPLIT, WRAITH 1, WARD 1; K1 THRUST 3, MISSILE 2 or PYRE 1, SPLIT or ARC, WRAITH 2, WARD 2 */
export const K0 = (s) => s[0] >= 2 && (s[1] >= 1 || s[4] >= 1) && (s[2] >= 1 || s[3] >= 1) && s[5] >= 1 && s[6] >= 1;
export const K1 = (s) => s[0] >= 3 && (s[1] >= 2 || s[4] >= 1) && (s[2] >= 1 || s[3] >= 1) && s[5] >= 2 && s[6] >= 2;
/** does slot vector s carry at least kit k, slot by slot (same order) */
export const kitHas = (s, k) => k.every((v, i) => (s[i] || 0) >= (v || 0));

/** quantile of a count histogram ({value: n} or an array indexed by value) */
export function hq(h, q) {
  const e = Object.entries(h).map(([v, n]) => [+v, n]).filter(([, n]) => n > 0).sort((a, b) => a[0] - b[0]);
  const tot = e.reduce((a, [, n]) => a + n, 0); if (!tot) return null;
  let acc = 0; const want = q * tot;
  for (const [v, n] of e) { acc += n; if (acc >= want) return v; }
  return e[e.length - 1][0];
}
/** largest value with a non-zero count */
export const hmax = (h) => { let m = null; for (const [v, n] of Object.entries(h)) if (n > 0 && (m == null || +v > m)) m = +v; return m; };
/** share of the histogram's mass strictly above v */
export const hshare = (h, v) => { let a = 0, t = 0; for (const [x, n] of Object.entries(h)) { t += n; if (+x > v) a += n; } return t ? a / t : null; };
/** merge histogram b into a (in place), returns a */
export const hadd = (a, b) => { for (const [v, n] of Object.entries(b || {})) a[v] = (a[v] || 0) + n; return a; };
/** quantile of a plain array */
export const aq = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]; };
export const pct = (v) => (v == null ? 'n/a' : Math.round(v * 100) + '%');
/** spec E8 / K1: the 8-spot park grid, screen (x, y). keepsake-probe's six D59 spots (40/90/200 at mid height,
 *  150,160, 90,180, 90,60), rounded to a grid that keeps mid height, plus two more in the upper and lower thirds.
 *  A spot inside terrain is clamped 10 px into the open band at that column */
export const SPOTS = [[40, 127], [90, 127], [150, 127], [200, 127], [90, 64], [90, 190], [150, 96], [150, 160]];
/** a fight's spot table, from per-spot { ph: { n: { hits, f, by } } }: the min hits per reached phase, K1's pass, and
 *  the source split of every spot hit (for K2's denial share) */
export function spotSummary(rows) {
  const by = {}; let min = Infinity; const phases = new Set();
  for (const r of rows) for (const [ph, v] of Object.entries(r.ph)) { phases.add(ph); min = Math.min(min, v.hits); for (const [k, n] of Object.entries(v.by)) by[k] = (by[k] || 0) + n; }
  const tot = Object.values(by).reduce((a, n) => a + n, 0) || 1;
  return { min: min === Infinity ? null : min, phases: [...phases].sort(), pass: min !== Infinity && min >= 2, share: Object.fromEntries(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, +(n / tot).toFixed(2)])) };
}

/** the page-side kit. Passed whole to addInitScript, so it must be self-contained (no closures over Node values) */
export function pageLib() {
  const W = 480, PH = 254;
  const PL = (window.__PL = { mods: {}, tag: new WeakMap(), fired: new WeakSet(), seen: new WeakMap(), contractErr: {} });
  const OPT = [['S', '/src/state.ts'], ['W', '/src/world.ts'], ['BR', '/src/brutal.ts'], ['TI', '/src/tier.ts'], ['RK', '/src/rank.ts'], ['SG', '/src/sigs.ts'], ['SO', '/src/solids.ts'], ['DN', '/src/enemies/mid/_deny.ts'], ['KS', '/src/enemies/boss/_keepsake.ts'], ['BU', '/src/boss/update.ts'], ['EU', '/src/enemies/update.ts'], ['TB', '/src/terrainb.ts']];
  /** import the live modules; a missing one (an older build) stays null and its metrics read 'n/a' */
  PL.modErr = {};
  PL.load = async () => { for (const [k, path] of OPT) { try { PL.mods[k] = await import(path); } catch (e) { PL.mods[k] = null; PL.modErr[k] = String((e && e.message) || e).slice(0, 160); } }
    return Object.fromEntries(OPT.map(([k]) => [k, PL.mods[k] ? true : PL.modErr[k] && !/Failed to fetch|404|Not Found|does not provide/.test(PL.modErr[k]) ? 'ERROR: ' + PL.modErr[k] : false])); };
  PL.onS = (o) => o.x > -8 && o.x < W + 8 && o.y > -8 && o.y < PH + 8;
  /** spec §2.1: every eshots entry counts toward the cap except those flagged haz (KEEPSAKE's planted forks) */
  PL.counted = (q) => !q.haz;
  /** the Open Orbit Maw and a mid-stage Maw are midbosses (depth.ts isMid: !stageBoss, or the stage is Orbit, which
   *  spawns maw(true)); a biome's Maw stage boss is a boss. Needs window.__LY (layout-arg.mjs useLayout sets it):
   *  without it the Orbit Maw reads as a boss (cap 24) */
  PL.mawMid = (m, G) => m.k === 'maw' && (!m.stageBoss || (window.__LY && window.__LY.row && (window.__LY.row(G.stage || 0) || {}).kind === 'orbit'));
  /** spec §2.1 cap context: boss (the Drive, a stage boss), setp (a midboss, the Orbit Maw, G.setp or the ship inside
   *  a src/sigs.ts window), scroll */
  PL.ctx = (G) => {
    const m = G.mini && !G.mini.dead ? G.mini : null;
    if (G.boss || (m && !m.mid && !PL.mawMid(m, G))) return 'boss';
    if (m || G.setp) return 'setp';
    const P = PL.mods.S && PL.mods.S.$ && PL.mods.S.$.P;
    if (P && PL.inSig(P.x + (G.scroll || 0), PL.sigs())) return 'setp';
    return 'scroll';
  };
  /** G.tier (0-3) once W0 lands, else null (the caps then read Normal's column) */
  PL.tier = (G) => (G && Number.isInteger(G.tier) ? G.tier : null);
  PL.CAP = { scroll: [6, 8, 10, 10], setp: [12, 16, 20, 20], boss: [18, 24, 30, 30] };
  /** the cap for context c: src/rank.ts bulletCap($, c) when the build has it (the game's own table), else the spec table */
  PL.cap = (G, c) => { const RK = PL.mods.RK, S = PL.mods.S; if (RK && typeof RK.bulletCap === 'function' && S && S.$ && S.$.G === G) { try { const v = RK.bulletCap(S.$, c); if (Number.isFinite(v)) return v; } catch (e) {} } return PL.CAP[c][PL.tier(G) ?? 1]; };
  /** the integer rank (src/rank.ts rank($)) or null before W0 */
  PL.rank = () => { const RK = PL.mods.RK, S = PL.mods.S; if (!RK || typeof RK.rank !== 'function' || !S) return null; try { const r = RK.rank(S.$); return Number.isFinite(r) ? r : null; } catch (e) { return null; } };
  /** pin src/rank.ts rank($) to `target` by fitting the ship (the jump `rank=` pin feeds only the legacy G.rank / G.pow,
   *  W0-CONTRACT): from a naked ship, add P_term weight greedily without overshooting (WARD 4, ARC 3, SPLIT 2, then
   *  MISSILE / PYRE levels, WRAITH options, CAL / SERR). A staging write, for a probe's scene only. Returns the rank
   *  reached (below target when the base already exceeds it or the slots run out), or null without rank.ts */
  PL.pinRank = ($, target) => {
    if (PL.rank() == null || !$ || !$.P || !$.G) return null;
    Object.assign($.P, { missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0 }); $.G.gm = { ...($.G.gm || {}), cal: 0, serr: 0 };
    const steps = [['wardLv', 1, 1], ['laser', 1, 1], ['double', 1, 1], ['missile', 1, 2], ['pyre', 1, 2], ['options', 1, 3], ['gm.cal', 1, 1], ['gm.serr', 1, 2]];
    for (const [k, d, max] of steps) for (let n = 0; n < max; n++) {
      if (PL.rank() >= target) return PL.rank();
      const o = k.startsWith('gm.') ? $.G.gm : $.P, kk = k.replace('gm.', ''), was = o[kk] || 0; o[kk] = was + d;
      if (PL.rank() > target) { o[kk] = was; break; }
    }
    return PL.rank();
  };
  /** the ship's speed per frame (player.ts: 1.25 + .42 THRUST, x .45 while slowed) */
  PL.shipV = (P) => (1.25 + (P.speed || 0) * .42) * (P.slow > 0 ? .45 : 1);
  /** blocked y intervals of the SOLIDS slabs at world x (src/solids.ts solidsCol, levels.md §2.1), [] before W3 */
  /** mask: a W3a SC class mask (default: the engine's own default, SC.TERRAIN); PL.fitAt passes SC.FIT */
  PL.solids = (wx, mask) => {
    const SO = PL.mods.SO; if (!SO || typeof SO.solidsCol !== 'function') return [];
    // levels.md §2.1 contract: solidsCol(wx) -> [y0, y1][]. Another shape or a throw is a contract break: it is
    // recorded in PL.contractErr (printed beside `mods`) rather than read as "no solids"
    try { const r = (mask != null ? SO.solidsCol(wx, mask) : SO.solidsCol(wx)) || []; const out = r.filter((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1])); if (out.length !== r.length) PL.contractErr.solidsCol = 'solidsCol(wx) returned a non-[y0,y1] entry'; return out; } catch (e) { PL.contractErr.solidsCol = String(e && e.message || e).slice(0, 120); return []; }
  };
  PL.hasSolids = () => !!(PL.mods.SO && typeof PL.mods.SO.solidsCol === 'function');
  /** W6 tune-tp (fm): the blocked y intervals at world x t frames from now, on the solids' own timeline: a piston at its
   *  cycle's tip then (solids.ts stepPiston: cycle frame ++age + phase; pistonTipAt with terrainb.ts ramp; a skipped
   *  cycle known now stays skipped), a growing or cut plug cell once it sets, every other terrain-class solid where it
   *  stands (slabs drift at their vy). t 0 is PL.solids(wx). [] before W3 */
  PL.solidsAt = (wx, t, mask) => {
    const SO = PL.mods.SO; if (!SO || !Array.isArray(SO.solids) || !SO.SC) return PL.solids(wx, mask);
    if (!t) return PL.solids(wx, mask);
    const TB = PL.mods.TB, m = mask != null ? mask : SO.SC.TERRAIN, out = [];
    for (const s of SO.solids) {
      if (!s || s.st === 'dead' || wx < s.x || wx > s.x + s.w) continue;
      if (s.k === 'piston') { if (!(s.cls & m)) continue; const C = s.rest + 2 * s.ext + s.hold; if (!(C > 0)) continue;
        const a = s.age + s.phase + t, n = Math.floor(a / C), u = a - n * C, d = s.reach - s.root, rp = (x, e) => (TB && TB.ramp ? TB.ramp(d, e, s.v, x) : d * Math.min(1, x / e));
        const tip = s.skipN === n || u < s.rest ? s.root : u < s.rest + s.ext ? s.root + rp(u - s.rest, s.ext) : u < s.rest + s.ext + s.hold ? s.reach : s.reach - rp(u - s.rest - s.ext - s.hold, s.ext);
        out.push(s.side > 0 ? [tip, PH + 99] : [-99, tip]); continue; }
      if (s.k === 'plug' && (s.st === 'grow' || s.st === 'cut')) { if (!(m & SO.SC.PLUG)) continue; const tSet = s.st === 'grow' ? (s.tell || 44) - s.t : (s.regrow || 150) - s.t + (s.tell || 44); if (t >= tSet) out.push([s.y, s.y + s.h]); continue; }
      if (!(s.cls & m)) continue;
      const vy = s.k === 'slab' ? s.vy || 0 : 0; out.push([s.y + vy * t, s.y + s.h + vy * t]);
    }
    return out;
  };
  /** the [ceiling, floor] at world x t frames from now: the arrays, moved by a live DYN window's offset change
   *  (terrainb.ts dynOff, clocked by G.t from the window's arm; with writeWin's fit clamp) */
  PL.wallAt = (wx, t) => {
    const Wm = PL.mods.W, TB = PL.mods.TB, S = PL.mods.S; let f = Wm.floorAt(wx), c = Wm.ceilAt(wx);
    if (t > 0 && TB && TB.DYNS && TB.DYNS.length && TB.dynWinAt && S && S.$ && S.$.G) { const w = TB.dynWinAt(wx);
      if (w) { const lt = S.$.G.t - w.t0, o0 = TB.dynOff(w.spec, wx, lt), o1 = TB.dynOff(w.spec, wx, lt + t); f -= o1[1] - o0[1]; c += o1[0] - o0[0];
        const sp = w.spec, fit = sp.fit || 0; // terrainb.ts writeWin's fit clamp: a tide stops short on its own side, a swallow opens about the middle
        if (f - c < fit) { if (sp.kind === 'tide') { if (sp.side === -1) c = f - fit; else f = c + fit; } else { const m = (c + f) / 2; c = m - fit / 2; f = m + fit / 2; } } } }
    return [c, f];
  };
  /** the W3a fit mask (SC.FIT = HARD | LODGE: a mucus plug is an S6 barrier you cut, not a 0 px gap), or undefined */
  PL.fitMask = () => (PL.mods.SO && PL.mods.SO.SC && Number.isFinite(PL.mods.SO.SC.FIT) ? PL.mods.SO.SC.FIT : undefined);
  /** the largest open y interval at world x: terrain minus solids (levels.md §7 FH) */
  PL.openAt = (wx, mask) => {
    const Wm = PL.mods.W; const f = Math.min(PH, Wm.floorAt(wx)), c = Math.max(0, Wm.ceilAt(wx));
    let iv = [[c, f]];
    for (const [a, b] of PL.solids(wx, mask)) { const nx = []; for (const [p, q] of iv) { if (b <= p || a >= q) nx.push([p, q]); else { if (a > p) nx.push([p, a]); if (b < q) nx.push([b, q]); } } iv = nx; }
    let best = [c, c]; for (const q of iv) if (q[1] - q[0] > best[1] - best[0]) best = q;
    return { c, f, lo: best[0], hi: best[1], h: Math.max(0, best[1] - best[0]) };
  };
  /** levels.md S1 swept fit gap at world x: min(floor) - max(ceil) over [wx - 9, wx + 12], solids as terrain (the
   *  largest open interval per column, intersected across the footprint). Solids are read with the W3a fit mask
   *  (SC.FIT), so a plug column is not a 0 px gap (W3A-API: route-probe L5) */
  PL.fitAt = (wx) => {
    let lo = -1e9, hi = 1e9; const m = PL.fitMask();
    for (let u = wx - 9; u <= wx + 12; u += 3) { const o = PL.openAt(u, m); lo = Math.max(lo, o.lo); hi = Math.min(hi, o.hi); }
    return Math.max(0, hi - lo);
  };
  /** the registered signature windows (src/sigs.ts sigWindows()), as [{x0, x1, floor, id}] in world x; [] before W3,
   *  null when the module is missing (so a probe can say 'n/a' rather than 'none') */
  PL.sigs = () => {
    const SG = PL.mods.SG; if (!SG || typeof SG.sigWindows !== 'function') return null;
    // assumed contract (to pin in §5.6): sigWindows() -> { x0, x1, floor, id }[] in world x. A mismatch or a throw
    // is recorded in PL.contractErr and the windows read as null ('n/a'), never as "none"
    try { const S = PL.mods.S; const r = SG.sigWindows(S && S.$) || []; const bad = r.some((w) => !Number.isFinite(w.x0) || !Number.isFinite(w.x1));
      if (bad) { PL.contractErr.sigWindows = 'sigWindows() entry without numeric x0 / x1'; return null; }
      return r.map((w) => ({ x0: w.x0, x1: w.x1, floor: Number.isFinite(w.floor) ? w.floor : 72, id: w.id || '' })); } catch (e) { PL.contractErr.sigWindows = String(e && e.message || e).slice(0, 120); return null; }
  };
  /** the window holding world x: x0 inclusive, x1 exclusive (the game's own test, W0-CONTRACT) */
  PL.inSig = (wx, ws) => (ws || []).find((w) => wx >= w.x0 && wx < w.x1) || null;

  // ---- shot tagging: where and when each enemy shot was first seen, and who fired it (spec F1, N1, N2, N3) ----
  /** call once per frame after the step: tags new eshots with { f, x0, y0 (spawn point), sd (distance to the ship at
   *  spawn), px (the ship's x at spawn), by (the shooter's kind), e (the shooter) }; marks the shooter as having fired.
   *  The tag lives in a WeakMap, not on the shot, so the sim object is untouched */
  PL.shotWas = new WeakMap();
  PL.tagShots = (g, fr) => {
    const Wm = PL.mods.W; if (!Wm || !g || !g.P) return;
    const P = g.P, out = [], flip = [];
    // W6 tune-tp (N1): the owner, not the nearest body. A drone fires once and its e.shot flag turns on the frame it does
    // (enemies/update.ts: aimShot(e.x - 5, e.y, ..) then e.shot = 1), so a new shot from that drone's muzzle on that
    // frame is its own, even with a formation mate nearer the spawn point (the nearest-within-40-px rule gave the
    // undesignated neighbour the credit, and N1 read low). Every other shot keeps the nearest rule
    for (const e of g.enemies) if (e.k === 'drone') { const was = PL.shotWas.get(e); if (e.shot && !was && PL.shotWas.has(e) && !e.dead) flip.push(e); PL.shotWas.set(e, !!e.shot); } // shotWas.has: seen before with its flag off (a drone first seen already spent never claims a shot)
    for (const q of Wm.eshots) {
      if (PL.tag.has(q)) continue;
      const age = Math.max(1, q.t || 1), x0 = q.x - (q.vx || 0) * age, y0 = q.y - (q.vy || 0) * age;
      let by = null, bd = 1e9, own = null;
      if (age <= 1) for (const e of flip) { const d = Math.hypot(e.x - 5 - x0, e.y - y0); if (d < 12 && (!own || d < own[1])) own = [e, d]; }
      if (own) { by = own[0]; bd = -1; }
      else for (const e of g.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x0, e.y - y0) - (e.r || 8); if (d < bd) { bd = d; by = e; } }
      if (!own && g.G.boss) { const B = g.G.boss, d = Math.hypot(B.x - x0, B.y - y0) - 70; if (d < bd) { bd = d; by = B; } }
      const shooter = bd < 40 ? by : null;
      const t = { f: fr - age + 1, x0, y0, sd: Math.hypot(x0 - P.x, y0 - P.y), px: P.x, by: shooter ? (shooter === g.G.boss ? 'drive' : shooter.k) : '?', e: shooter, rev: !!q.rev };
      PL.tag.set(q, t); if (shooter) PL.fired.add(shooter); out.push(t);
    }
    return out;
  };

  // ---- would-be contact geometry at (x, y), for the invincible statue and spot bots ----
  /** what would hit a ship core at (x, y) this frame: { shots: [eshot], bodies: [enemy], other: [name] } (no padding:
   *  shots at r + 2.6 as shots.ts EHIT, bodies at r + 2.6 and their hb parts, the midbosses' denial through
   *  _deny.ts denyHit, the line and sector attacks the dodging pilot models while they are live, the Drive's beam and
   *  tentacles, terrain and solids on the hull's 5 points, and the biome hazards) */
  PL.contact = (g, x, y) => {
    const G = g.G, Wm = PL.mods.W, out = { shots: [], bodies: [], other: [] };
    if (Wm) for (const s of Wm.eshots) if ((s.x - x) ** 2 + (s.y - y) ** 2 < ((s.r || 2) + 2.6) ** 2) out.shots.push(s);
    for (const e of g.enemies) {
      if (e.dead || e.ghost > 0) continue;
      let hit = (e.x - x) ** 2 + (e.y - y) ** 2 < ((e.r || 6) + 2.6) ** 2;
      if (!hit && e.hb) for (const h of e.hb) if ((e.x + h[0] - x) ** 2 + (e.y + h[1] - y) ** 2 < (h[2] + 2.6) ** 2) { hit = true; break; }
      if (hit) out.bodies.push(e);
    }
    const sc = G.scroll, DN = PL.mods.DN;
    if (DN && typeof DN.denyHit === 'function' && G.mini && !G.mini.dead) { try { const d = DN.denyHit(G.mini, sc, x, y); if (d) out.other.push('deny:' + d); } catch (e) {} }
    const KS = PL.mods.KS; // THE KEEPSAKE's boomerang and hanging / planted / homing forks (not eshots): _keepsake.ts keepTouch, the sim's own geometry (W4c)
    if (KS && typeof KS.keepTouch === 'function' && G.mini && G.mini.k === 'keepsake' && !G.mini.dead) { try { const d = KS.keepTouch(G.mini, sc, x, y); if (d) out.other.push('keep:' + d); } catch (e) {} }
    const seg = (ox, oy, a, len, w) => { const dx = Math.cos(a), dy = Math.sin(a), px = x - ox, py = y - oy, u = Math.max(0, Math.min(len, px * dx + py * dy)); return Math.hypot(px - dx * u, py - dy * u) < w + 2.6; };
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (e.k === 'ufo' && e.st === 'whip' && e.wt >= 4 && e.wt < 21 && seg(e.x - 34, e.y + 9, e.la, 238, 4)) out.other.push('lash');
      if (e.k === 'flayer') { const wh = PL.whipHit(e, x, y); if (wh ?? (e.ws === 'strike' && e.wt >= 5 && e.wt < 16 && seg(e.x - 7, e.y + 1, e.ang, 122, 3))) out.other.push('whip'); } // g5: whipPts exact when EU loads
      if ((e.k === 'prentice' || e.k === 'butcher') && e.st === 'cut' && e.wt < 13) {
        const big = e.k === 'butcher', qx = e.x - (big ? 10 : 8), qy = e.y - (big ? 10 : 6), r = Math.hypot(x - qx, y - qy);
        let a = Math.atan2(y - qy, x - qx); if (a < 0) a += Math.PI * 2;
        if (r > (big ? 18 : 14) && r < (big ? 100 : 84) && a > 2.30 && a < 3.99) out.other.push('cleaver');
      }
      // the Butcher's hook: the second half's chain (h.v2: tx, ty), the first half's tip only while it flies out (e.ha, h.d;
      // butcherhook.ts hookHits at KH.tipR 8, the ship's core not added there). W6 tune-tf request
      if (e.k === 'butcher' && e.st === 'hook' && e.hk) { const ax = e.x + 10, ay = e.y - 8, h = e.hk;
        if (h.v2 ? h.tx != null && seg(ax, ay, Math.atan2(h.ty - ay, h.tx - ax), Math.hypot(h.tx - ax, h.ty - ay), 6) : h.out && Math.hypot(ax + Math.cos(e.ha) * (h.d || 0) - x, ay + Math.sin(e.ha) * (h.d || 0) - y) < 8) out.other.push('hook'); }
    }
    const Bo = G.boss;
    if (Bo && !Bo.dying) {
      // the beam, and W4's TWIN BEAM second arm (laser.ang2) when it is set
      if (Bo.laser && !(Bo.laser.tel > 0) && Bo.laser.beam > 0 && (seg(Bo.x, Bo.y, Bo.laser.ang, 1000, 6) || (Number.isFinite(Bo.laser.ang2) && seg(Bo.x, Bo.y, Bo.laser.ang2, 1000, 6)))) out.other.push('beam');
      if ((Bo.x - x) ** 2 + (Bo.y - y) ** 2 < 60 * 60) out.other.push('drive');
      const BU = PL.mods.BU;
      // tentacles: distance to each segment between sample points, not to the points (a REACHING tentacle stretches
      // its spacing past the hit radius, so a point test lets a ship sit between two samples)
      if (Bo.tent && BU && BU.tentPts) for (const tt of Bo.tent) { const pts = BU.tentPts(Bo, tt); let hit = false;
        for (let i = 10; i < pts.length && !hit; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / L2));
          if (Math.hypot(a.x + dx * u - x, a.y + dy * u - y) < (i === 16 ? 8 : 5) + 2.6) hit = true; }
        if (hit) { out.other.push('tentacle'); break; } }
    }
    if (Wm) for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) {
      const wx = x + ox + sc, yy = y + oy;
      if (yy >= Wm.floorAt(wx) || yy <= Wm.ceilAt(wx)) { out.other.push('terrain'); break; }
      if (PL.solids(wx).some(([a, b]) => yy >= a && yy <= b)) { out.other.push('solid'); break; }
    }
    const B = globalThis.__biome ? globalThis.__biome() : null;
    if (PL.blockAt(x, y)) out.other.push('haz:block');
    if (B && B.haz) for (const z of B.haz) {
      if (z.k === 'icicle' && Math.abs(x - z.x) < 5 && y > z.y && y < z.y + z.len + 4) out.other.push('haz:icicle');
      if ((z.k === 'geyser' || z.k === 'jet') && z.reach && Math.abs(x - z.x) < 7) {
        const y0 = z.k === 'geyser' ? z.y - z.reach : z.dir > 0 ? z.y : z.y - z.reach, y1 = z.k === 'geyser' ? z.y : z.dir > 0 ? z.y + z.reach : z.y;
        if (y > y0 && y < y1) out.other.push('haz:' + z.k);
      }
    }
    return out;
  };
  /** what is about to hit the ship, read the frame before a hit or a death (pod-probe deaths[].src, M3): the exact
   *  overlaps of PL.contact, each padded only by one frame of relative motion (the shot's speed and the ship's), tested
   *  shot first, then a body, then terrain / a solid on the hull's 5 points, then the line attacks and hazards.
   *  { c: 'shot:<k>' | 'body:<k>' | 'terrain' | 'solid' | 'haz:<k>' | <attack> | '', shot } ('' = nothing in reach) */
  PL.cause = (g) => {
    const P = g.P, G = g.G, Wm = PL.mods.W, v = PL.shipV(P);
    let best = null, bd = 1e9; PL.causeN++;
    if (Wm) for (const s of Wm.eshots) { const d = Math.hypot(s.x - P.x, s.y - P.y) - ((s.r || 2) + 2.6 + Math.hypot(s.vx || 0, s.vy || 0) + v + 1); if (d < 0 && d < bd) { bd = d; best = s; } }
    if (best) return { c: 'shot:' + (best.k || 'orb'), shot: best };
    // g5 (qa): the flayer's lash on the sim's own test one step ahead (PL.whipNext); its seg() stand-in in PL.contact
    // missed most lash deaths (M3 read them 'other'). A body is padded by its own last-frame step too (PL.eStep: a doll's lunge)
    for (const e of g.enemies) if (e.k === 'flayer' && PL.whipNext(e, P.x, P.y, v + 1)) return { c: 'whip', shot: null };
    for (const e of g.enemies) { if (e.dead || e.ghost > 0) continue; const pad = (e.r || 6) + 2.6 + v + 2 + PL.eStep(e);
      if (Math.hypot(e.x - P.x, e.y - P.y) < pad || (e.hb && e.hb.some((h) => Math.hypot(e.x + h[0] - P.x, e.y + h[1] - P.y) < h[2] + 2.6 + v + 2))) return { c: 'body:' + e.k, shot: null }; }
    if (Wm) for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) { const wx = P.x + ox + G.scroll, y = P.y + oy;
      if (y + v + 1 >= Wm.floorAt(wx) || y - v - 1 <= Wm.ceilAt(wx)) return { c: 'terrain', shot: null };
      if (PL.solids(wx).some(([a, b]) => y + v + 1 >= a && y - v - 1 <= b)) return { c: 'solid', shot: null }; }
    // THE KEEPSAKE's own attacks (_keepsake.ts keepTouch), padded like a shot by one frame of their motion (the boomerang
    // at boomSp, a fork home at its own step) and the ship's: a fast boomerang death read 'other' (W6 tune-tf request)
    const KS = PL.mods.KS, m = G.mini;
    if (KS && typeof KS.keepTouch === 'function' && m && m.k === 'keepsake' && !m.dead) { try { let mv = KS.KB ? KS.KB.boomSp : 3.4; for (let j = 0; j < (m.fh || 0); j++) mv = Math.max(mv, Math.hypot(m.hVX[j], m.hVY[j]));
      const k = KS.keepTouch(m, G.scroll, P.x, P.y, 2.6 + v + 1 + mv); if (k) return { c: 'keep:' + k, shot: null }; } catch (e) {} }
    const o = PL.contact(g, P.x, P.y).other.filter((k) => k !== 'terrain' && k !== 'solid');
    return { c: o[0] || '', shot: null };
  };
  /** the edge a regular enemy entered by, read the first frame it is seen (spec §2.3 entry mix; levels.md §7):
   *  e.pat behind / drop / rise and a wall birth (e.wall, e.born) decide first, then where it is */
  PL.entryEdge = (e, G) => {
    const Wm = PL.mods.W, rr = (e.r || 6) + 6;
    if (e.pat === 'behind') return 'left'; if (e.pat === 'drop') return 'top'; if (e.pat === 'rise') return 'bottom'; if (e.wall || e.born) return 'wall';
    if (e.x >= 470) return 'right'; if (e.x <= 10) return 'left'; if (e.y <= 4) return 'top'; if (e.y >= 250) return 'bottom';
    if (Wm) { const wx = e.x + G.scroll; if (e.y + rr >= Wm.floorAt(wx) || e.y - rr <= Wm.ceilAt(wx)) return 'wall'; }
    return 'inside';
  };
  /** spec §2.3 / C6: may this enemy shoot at all? A drone only as its formation's designated shooter (W1 marks it at
   *  spawn: e.sh 1 = the leader, member 0, since tune-te; e.sh 2 = the last member, live at rank >= 14). rk: the rank when it was seen.
   *  Every other kind: yes. A build with no e.sh field on its drones (pre-W1) answers null: undesignated */
  PL.designated = (e, rk) => (e.k !== 'drone' ? true : !('sh' in e) ? null : e.sh === 1 || (e.sh === 2 && rk != null && rk >= 14));
  /** a regular enemy (not a midboss, boss, part or child) */
  PL.regular = (e) => !(e.mini || e.par || e.kid || e.big);
  /** what the entry mix counts: formations (one per group), drones and hatchlings, anything flown on a pattern */
  PL.entrant = (e) => PL.regular(e) && !!(e.group || e.pat || e.k === 'drone' || e.k === 'hatch');
  /** W6 tune-tp (N4): a hatchling swarm is one entry. Hatchlings carry no group (spawn.ts hatch(n) and wallBirth spawn n
   *  in one call), so the first one seen on frame fr at an edge counts and the rest of that frame's at that edge do not.
   *  true = already counted (skip it). Anything but an ungrouped hatchling: false */
  PL.swarm = { fr: -1, edges: new Set() };
  PL.swarmSeen = (e, fr, edge) => {
    if (e.k !== 'hatch' || e.group) return false;
    if (PL.swarm.fr !== fr) { PL.swarm.fr = fr; PL.swarm.edges.clear(); }
    if (PL.swarm.edges.has(edge)) return true;
    PL.swarm.edges.add(edge); return false;
  };
  /** MORGUE RUSH ice blocks in flight (bodies outside haz): W3c's adapter list __biome().sig.eng.blocks (screen x of
   *  the left edge, centre y, the game's own touch box |dx| < w/2 + 8, |dy| < h/2 + 4; w 22, h 14 unless the block
   *  carries them), and the W3a engine's BODY-class solids (world-x boxes). A block still in its tell is not solid.
   *  [] / false on a build without either */
  PL.blocks = () => {
    const out = [], B = globalThis.__biome ? globalThis.__biome() : null, eng = B && B.sig && B.sig.eng, G = PL.mods.S && PL.mods.S.$ && PL.mods.S.$.G;
    if (eng && Array.isArray(eng.blocks)) for (const k of eng.blocks) if (k && k.st !== 'tell' && Number.isFinite(k.x)) { const w = k.w || 22, h = k.h || 14; out.push({ k, cx: k.x + w / 2, cy: k.y, hw: w / 2, hh: h / 2 }); }
    const SO = PL.mods.SO; if (SO && Array.isArray(SO.solids) && SO.SC && G) for (const q of SO.solids) if (q && q.cls === SO.SC.BODY) out.push({ k: q, cx: q.x - G.scroll + q.w / 2, cy: q.y + q.h / 2, hw: q.w / 2, hh: q.h / 2 });
    return out;
  };
  PL.blockAt = (x, y) => PL.blocks().some((b) => Math.abs(x - b.cx) < b.hw + 8 && Math.abs(y - b.cy) < b.hh + 4);
  /** the five-way source bucket of a would-be hit or a death cause string (spec L4 / M3) */
  PL.bucket = (c) => { c = (c || '').replace(/^~/, ''); return !c ? 'other' : c.startsWith('shot') ? 'bullet' : c === 'terrain' ? 'terrain' : c === 'solid' ? 'solid' : c.startsWith('haz') || /^keep:(planted|mobile)/.test(c) ? 'hazard' : c.startsWith('body') || /^keep:/.test(c) || /^(lash|whip|cleaver|hook|beam|drive|tentacle|deny:)/.test(c) ? 'body' : 'other'; };

  // ---- g5 (qa): death-cause classes for the flayer's whip and the two new kinds, measure-only (no R(), no sim writes) ----
  /** the g5 kinds by e.k (rename here if the sim names them differently): doll = mini baby-doll heads in groups of 5,
   *  contact only (its lunge is a body touch); watcher = the big flying eyeball, one aimed orb after a blink tell */
  PL.K5 = { doll: 'doll', watcher: 'watcher' };
  /** the flayer's lash on the sim's own test (enemies/update.ts 'flayer' strike: whipPts points 4.. within 4.5 px of the
   *  ship's centre while 4 < wt < 16, read after the step's e.wt++), widened by pad. null when the build's EU module
   *  (whipPts) is not loaded, so a caller can fall back */
  PL.whipHit = (e, x, y, pad = 0) => {
    const EU = PL.mods.EU; if (!EU || typeof EU.whipPts !== 'function') return null;
    if (!e || e.k !== 'flayer' || e.ws !== 'strike' || !(e.wt > 4 && e.wt < 16)) return false;
    const pts = EU.whipPts(e), r = 4.5 + pad; for (let i = 4; i < pts.length; i++) if ((x - pts[i].x) ** 2 + (y - pts[i].y) ** 2 < r * r) return true;
    return false; };
  /** the lash as the next step will test it (PL.cause reads the frame before a hit): e.t and e.wt one on (update.ts bumps
   *  e.t first, then the strike's wt). A tell's last frame turns into strike wt 0, which can't hit yet. A copy: e is not touched */
  PL.whipNext = (e, x, y, pad = 0) => (e && e.ws === 'strike' ? PL.whipHit({ ...e, wt: e.wt + 1, t: (e.t || 0) + 1 }, x, y, pad) : false);
  /** an enemy's step over the last PL.cause read (0 on its first read or after a gap; capped at 12 px so a respawn or a
   *  teleport doesn't pad the world). Lives in a WeakMap, never on the enemy */
  PL.causeN = 0; PL.ePos = new WeakMap();
  PL.eStep = (e) => { const q = PL.ePos.get(e); PL.ePos.set(e, [e.x, e.y, PL.causeN]);
    return q && q[2] === PL.causeN - 1 ? Math.min(12, Math.hypot(e.x - q[0], e.y - q[1])) : Math.min(12, Math.hypot(e.vx || 0, e.vy || 0)); };
  /** what hit the ship, read AFTER the step on the sim's own exact tests (an enemy's state is not changed by its hit):
   *  the flayer's lash ('whip'), then a body touch (shots.ts: |e - P| < e.r + 4; a recovery carrier or a ghost is
   *  harmless). Shots are consumed by their hit, so they are PL.cause's (the frame before). '' = neither */
  PL.hitBy = (g) => {
    const P = g && g.P; if (!P) return '';
    for (const e of g.enemies) if (e.k === 'flayer' && PL.whipHit(e, P.x, P.y)) return 'whip';
    for (const e of g.enemies) if (!e.dead && !(e.ghost > 0) && !e.rec && !(e.group && e.group.rec) && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < ((e.r || 6) + 4) ** 2) return 'body:' + e.k;
    return ''; };
  /** the cause to record: the frame-before read (pre, PL.cause or a '~' proximity guess) unless the after-step replay
   *  (post, PL.hitBy) is exact where pre is not: a lash beats anything but a shot; a body fills an empty or guessed cause */
  PL.settle = (pre, post) => {
    pre = pre || ''; if (!post) return pre || 'other';
    if (post === 'whip') return /^~?shot/.test(pre) ? pre : 'whip';
    return !pre || pre === 'other' || pre.startsWith('~') ? post : pre; };
  /** the fine death class (g5 M3 / H1 detail; PL.bucket stays the five-way source): whip, doll, watcher:orb (a shot
   *  its tag credits to a watcher: by = PL.tag's shooter kind), watcher:body, else the bucket */
  PL.cls = (c, by) => {
    c = (c || '').replace(/^~/, ''); const K = PL.K5;
    if (c === 'whip') return 'whip';
    if (c === 'body:' + K.doll) return 'doll';
    if (c === 'body:' + K.watcher) return 'watcher:body';
    if (c.startsWith('shot') && by === K.watcher) return 'watcher:orb';
    return PL.bucket(c); };
  /** g5 N3: is e's attack that is not a shot live this frame? The flayer's lash (ws strike), the doll's lunge (its
   *  attack state reads lunge / dash / charge / bite: e.st, else e.ws). Its first frame is the kind's first attack */
  PL.strike = (e) => {
    if (!e) return false;
    if (e.k === 'flayer') return e.ws === 'strike';
    if (e.k === PL.K5.doll) return /^(lunge|dash|charge|bite)/.test(String(e.st ?? e.ws ?? ''));
    return false; };

  // ---- the 8-spot park grid (spec K1, K2; keepsake-probe's spot:X,Y generalised) ----
  /** a fight's phase: THE KEEPSAKE's m.ph, the Drive's b.phase, else the shared half rule (midhost.ts midPh2) */
  PL.phase = (m, isDrive) => (!m ? 0 : isDrive ? m.phase || 0 : m.k === 'keepsake' ? m.ph || 0 : m.hp < m.max * .5 ? 1 : 0);
  PL.spotNew = () => ({ ph: {}, shotSeen: new WeakSet(), prev: new Set() });
  /** count this frame's would-be hits on a ship at (x, y) into acc.ph[phase]: each enemy shot once, every other
   *  contact (a body by kind, a lash, the denial, terrain) once per touch, as keepsake-probe's spot mode */
  // W6 tune-tf requests (K2): a shot that carries s.dn is its fight's denial (deny:<dn>, the Bloat's comb); a denial's
  // own body counts as the denial only while it is the denial (the Maw in its bite, bs 2-4: deny:bite; the Choir's loose
  // bar while it sweeps the lane: deny:lane, one touch with _deny.ts laneHit's), else as a body; and nothing counts once
  // the midboss is withdrawing (midLeave: e.gone / e.t >= e.leave), so a phase reached only after the clock is not a phase
  PL.bodyKey = (e) => {
    if (e.k === 'maw' && e.bs >= 2 && e.bs <= 4) return 'deny:bite';
    if (e.k === 'nailbar' && e.par && e.par.k === 'choir' && (e.par.lb === e || e.par.lb2 === e) && (() => { const LP = PL.mods.DN && PL.mods.DN.LP; return e.par.lp === (LP ? LP.out : 2) || e.par.lp === (LP ? LP.back : 3); })()) return 'deny:lane';
    return 'body:' + e.k;
  };
  // r3 fights: an icicle that reaches the ship's core is spent in that same step (biomes.ts stepBiome sets G.hazHit and
  // drops it), so the post-step contact read never saw one: THE BLOAT's icicle curtain (its second-half denial, spec §2.3)
  // read 0 hits. watchIce wraps the hazard list's splice (installed once) and notes a removed icicle that met the ship's
  // core by the sim's own test, at the moment the sim removes it: 'deny:curtain' for THE BLOAT's own (biomes.ts dropHazard
  // marks them aim), 'haz:icicle' for the biome's. Measure-only: it reads, never changes the list
  PL.iceTouch = [];
  PL.watchIce = () => {
    const B = globalThis.__biome ? globalThis.__biome() : null, hz = B && B.haz; if (!hz || hz.__plIce) return;
    const sp = hz.splice; Object.defineProperty(hz, '__plIce', { value: 1 });
    hz.splice = function (i, ...rest) { const z = this[i], S = PL.mods.S, P = S && S.$ && S.$.P;
      if (z && z.k === 'icicle' && P && P.alive && Math.abs(P.x - z.x) < 5 && P.y > z.y && P.y < z.y + z.len + 4) { const m = S.$.G && S.$.G.mini; PL.iceTouch.push(z.aim && m && m.k === 'crux' ? 'deny:curtain' : 'haz:icicle'); }
      return sp.call(this, i, ...rest); };
  };
  PL.spotFrame = (acc, g, x, y, ph) => {
    PL.watchIce(); if (!acc.iceOn) { acc.iceOn = 1; PL.iceTouch.length = 0; } // a fight's first frame: no earlier touch carries in
    { const m = g.G && g.G.mini; if (m && !m.dead && (m.mid || (m.k === 'maw' && !m.stageBoss)) && (m.gone || (m.leave != null && m.t >= m.leave))) { acc.withdrawSkipped = (acc.withdrawSkipped || 0) + 1; PL.iceTouch.length = 0; return; } } // frames skipped, kept visible
    const c = PL.contact(g, x, y), P = (acc.ph[ph] ||= { f: 0, hits: 0, by: {} }); P.f++;
    const add = (k) => { P.hits++; P.by[k] = (P.by[k] || 0) + 1; };
    for (const k of PL.iceTouch.splice(0)) add(k); // each spent icicle is its own touch
    for (const s of c.shots) if (!acc.shotSeen.has(s)) { acc.shotSeen.add(s); add(s.dn ? 'deny:' + s.dn : 'shot:' + (s.k || 'orb')); }
    const now = new Set([...c.bodies.map(PL.bodyKey), ...c.other]);
    for (const k of now) if (!acc.prev.has(k)) add(k);
    acc.prev = now;
  };
  /** the fight's on-screen counted bullets this frame, into histogram h (spec B3) */
  PL.fightBul = (h) => { const Wm = PL.mods.W; if (!Wm) return; let n = 0; for (const q of Wm.eshots) if (PL.counted(q) && PL.onS(q)) n++; h[n] = (h[n] || 0) + 1; };
  /** clamp a spot's y 10 px into the open band at its column */
  PL.spotY = (x, y, sc) => { const Wm = PL.mods.W; if (!Wm) return y; const o = PL.openAt(x + sc); return Math.max(o.lo + 10, Math.min(o.hi - 10, y)); };

  // ---- bullets on screen by context (B1, B2, S1): fed every frame ----
  PL.bul = {}; PL.lobMax = 0;
  const H = (k) => (PL.bul[k] ||= { n: {}, ns: {}, frames: 0, over: 0, overMax: 0, ratio: {}, vmax: 0, vOver: 0, shots: 0 });
  // B1 grace: when the cap context drops to a lower cap (a midboss leaves: setp/boss -> scroll), the shots already in
  // flight belong to the old context. They are carried (PL.carry) and not counted against the new cap until they die.
  // The game's volleys still see them (rank.ts countShots), so only new spawns can breach a cap
  PL.carry = new WeakSet(); PL.lastCap = null;
  /** one frame's sample: counted shots (for the cap; carried shots left out, `carried` counts the frames that had
   *  some) and on screen (for density), their speed and the ratio to the ship's speed, by context and stage|context */
  PL.bulFrame = (g, stage) => {
    const Wm = PL.mods.W; if (!Wm || !g || !g.P) return;
    const G = g.G, c = PL.ctx(G), cap = PL.cap(G, c), v = PL.shipV(g.P), vcap = [2.6, 2.6, 2.9, 2.9][PL.tier(G) ?? 1];
    if (PL.lastCap != null && cap < PL.lastCap) for (const q of Wm.eshots) PL.carry.add(q);
    PL.lastCap = cap;
    let n = 0, ns = 0, nc = 0; const sp = [];
    for (const q of Wm.eshots) if (PL.counted(q)) { if (PL.carry.has(q)) nc++; else n++; if (PL.onS(q)) { ns++; const sv = Math.hypot(q.vx || 0, q.vy || 0); if (q.fk === 1 && q.k === 'glob') { if (sv > PL.lobMax) PL.lobMax = sv; } else sp.push([sv, q.k || 'orb']); } }
    // S1 (W6 tune-tf request, FLAGGED for a design reviewer): THE KEEPSAKE's gravity lobs (fk 1 on a lob() path: the
    // fountain and the mobile's drops, k glob; shots.ts skips the falling-glob clamp for fk) are left out of the speeds and
    // reported apart as PL.lobMax; its beam rain (fk 1, a straight spike) stays in
    for (const k of [c, stage + '|' + c]) {
      const b = H(k); b.frames++; b.n[n] = (b.n[n] || 0) + 1; b.ns[ns] = (b.ns[ns] || 0) + 1; if (nc) b.carried = (b.carried || 0) + 1;
      if (n > cap) { b.over++; b.overMax = Math.max(b.overMax, n); }
      for (const [s, sk] of sp) { b.shots++; if (s > b.vmax) { b.vmax = s; b.vk = sk; } if (s > vcap + 1e-6) b.vOver++; const r = Math.round(s / v * 20) / 20; b.ratio[r] = (b.ratio[r] || 0) + 1; }
    }
  };
}
