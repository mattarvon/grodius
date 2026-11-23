// =====================================================================
//  THE MIDBOSSES' AREA DENIAL (D61 Pass 1, "it notices you"): one move per biome midboss, matching its roster tag, so a
//  parked ship has to move. The fairness rules are D59's (THE KEEPSAKE): every new threat has a tell of at least 44 f and
//  a guaranteed gap (tests/unit/middeny.test.ts holds both).
//   LINE   THE NAIL CHOIR: a nailbar comes loose and sweeps a lane the width of the screen, then sweeps back (no bars
//          left: the eye spits a column of nails down the lane instead)
//   SPACE  THE DISSOLVING WOMB: its lobs that strike the floor or ceiling plant acid pools that linger; a burning pool
//          erupts on its own clock, a column of acid standing most of the way across the cave (tell: it boils, its
//          column outlined)
//   RANGE  THE BUTCHER'S APPRENTICE: a chain hook thrown to the far wall or the screen's edge; it bites and holds there,
//          the taut chain a wire across the screen, then reels in
//   CROWD  THE BROOD MOTHER: from her phase 2 her litter comes in from behind the ship, at its height
//
//  DIFFICULTY-SPEC §2.3 (W4a, long4 only: the kinds gate these on _fight.ts g3()):
//   DRIFT  SQUID SAUCER 2000: in phase 2 the lash, held at full reach, SWEEPS +-.5 rad (UFO_SW) under a hatched wedge
//   LINE   the Choir's phase 2 sweeps TWIN lanes (lanePair: a free band >= 40 px between them); at rank >= 14 the
//          return sweep re-locks on the ship at the turn (LP.turn, a 16 f solid line, the bar off screen)
//   SPACE  the Womb's spray alternates floor and ceiling (cyst.ts)
//   RANGE  the Apprentice's phase-2 bite holds DN.hBite2 with the wire SAGGING (hookSag); at rank >= 14 a SECOND hook
//          (e.st2, e.ha2, e.hd2) is thrown on the ship's new lane, never within DN.h2Gap of the first's wire (hook2Aim)
//   CROWD  the Brood's phase-1 litter drops in from the TOP or BOTTOM edge (alternating) under a DN.bTel edge chevron
//
//  Pure: no imports, so the kinds' files, the unit tests and the probes (tools/mid-deny-probe.mjs, tools/pilot.mjs via
//  window.__DN) all read the same numbers and the same hit tests. The hit tests read only the midboss's own fields, so
//  an invincible probe ship can count the hits it would have taken.
// =====================================================================

/** the tuning, frames and px. The tells (lTel, plArm, hTel, bTel) stay >= TELL_MIN */
export const DN = {
  // ---- THE NAIL CHOIR's lane
  /** every lEvery-th attack is the lane (the rest are its fan) */
  lEvery: 2,
  /** the tell: the bar flies to the lane's mouth over lFly, then trembles there while the lane fills */
  lTel: 56, lFly: 24,
  /** the bar's half-length (the lane's half-height) and half-width: the art's nail sheet, 30 px tall */
  lHH: 15, lHW: 6,
  /** sweep left at lSp px/f to lEnd (off the left edge), then back at lBack to the mouth, then home over lHome */
  lSp: 6, lBack: 5, lEnd: -24, lHome: 16,
  /** the mouth: this far in front of (left of) the eye */
  lFront: 34,
  /** with no bar left: lSpikes spikes in a column, lSpikeDy apart, at lSpikeSp (x BS) */
  lSpikes: 5, lSpikeDy: 6, lSpikeSp: 2.3,
  // ---- THE DISSOLVING WOMB's pools
  /** pools alive at once (phase 2: plN2); the oldest goes when a new one needs the room */
  plN: 4, plN2: 6,
  /** a pool fizzes harmless for plArm (the tell), burns for plLive, then dries harmless for plDry */
  plArm: 44, plLive: 300, plDry: 30,
  /** a burning pool's half-width along the surface and the height its fumes stand off it */
  plHW: 14, plH: 18,
  /** a glob striking within plMerge px of a pool feeds it (its burn starts over; an armed pool stays armed) */
  plMerge: 30,
  /** eruptions: plEr0 into its burn, then every plEvery, a pool boils for plErTel (the tell) and a column of acid
   *  stands for plErLive, plCW half-wide, reaching plReach of the cave (at most plRMax px; the far side stays open) */
  plEr0: 24, plEvery: 150, plErTel: 44, plErLive: 36, plCW: 9, plReach: .6, plRMax: 130,
  // ---- THE APPRENTICE's hook
  /** the tell: it aims along a dashed line for hTel, locked for the last hLock; it tracks at hTrack per frame before that */
  hTel: 50, hLock: 16, hTrack: .08,
  /** the throw: out at hSp px/f until it strikes terrain or the screen's edge (hMax at most) */
  hSp: 9, hMax: 520,
  /** the bite: it holds for hBite, the chain taut; then it reels in at hIn px/f */
  hBite: 44, hIn: 8,
  /** the tip's hit radius, and the chain's half-width while it is taut or reeling */
  hR: 8, hW: 3,
  /** the hook's eye on the body, from e.x, e.y (the hand that holds the chain) */
  hOx: -6, hOy: -12,
  // ---- THE BROOD MOTHER's litter from behind (phase 2)
  /** the heave is the tell: the BEHIND warning shows at the lane for bTel */
  bTel: 56,
  /** the litter enters at x bX, each bDx further back, its rows bDy apart around the lane (rows of three) */
  bX: -8, bDx: 9, bDy: 14,
  /** the lane stays this far inside the screen's top and bottom */
  bEdge: 30,
  // ---- DIFFICULTY-SPEC §2.3 (W4a): the extensions, long4 only
  /** the Choir's twin lanes: the second sits lGap2 from the first, a free band of lGap2 - 2 lHH = 50 >= lFree between */
  lGap2: 80, lFree: 40,
  /** the rank >= 14 re-lock at the turn: the bar waits off screen for lTurn, its new lane ruled solid (spec: 16 f) */
  lTurn: 16,
  /** the Apprentice's phase-2 bite: held hBite2 (spec 44 -> 60), the wire sagging hSag at its middle, never nearer than
   *  hSagGap to the floor or the ceiling there */
  hBite2: 60, hSag: 30, hSagGap: 30,
  /** the rank >= 14 second hook: its line locks h2Lock after the first bites and it throws hLock after that, never sooner
   *  than TELL_MIN from the start of its own tell; at the ship's range it stays h2Gap from the first's wire */
  h2Lock: 16, h2Gap: 40,
  /** the Brood's phase-1 litter from an edge: a column at x = the ship's + eDx[att % 4] (spec 60-90), eDy apart, starting
   *  eY0 off the edge and falling at eV until it reaches the ship's lane (then an ordinary hatchling); its tell is bTel */
  eDx: [60, 70, 80, 90] as readonly number[], eDy: 14, eV: 1.4, eY0: 12,
  /** ...then it dives at the ship at eV until it is past the ship's x or eT frames old (then an ordinary hatchling). A
   *  column that only fell to the lane met the ship's forward fire head on (K2: bodies >= 50% of would-be hits) */
  eT: 150,
  /** no hatchling of an edge litter spawns within eClear of the ship (it may have moved under the column during the tell;
   *  spec C9 / N4 hold bodies to 48, the brood gate asks 64) */
  eClear: 64,
} as const;

// ---------------- SQUID SAUCER 2000 (its sim is ufo.ts; the sweep's numbers live here for the probes and the art) ----------------
/** the phase-2 sweep: f frames at full reach, swinging amp rad either side of the locked line (spec: +-.5 over 24 f).
 *  The lash's root and reach (ufo.ts LASH_O, LASH_LEN + 18) are copied here so this file stays a leaf */
export const UFO_SW = { f: 24, amp: .5, ox: -34, oy: 9, len: 238, w: 6 } as const;
/** the lash's angle u frames into the sweep from the locked a0, first toward dir (+-1): one full swing, back to a0 */
export const sweepA = (a0: number, u: number, dir: number) => a0 + dir * UFO_SW.amp * Math.sin(2 * Math.PI * u / UFO_SW.f);
/** is the ship at (px, py) on the sweeping lash? The frames past the plain stab only (the probes count the stab as 'lash') */
export function sweepHit(e: any, px: number, py: number): boolean {
  if (e.k !== 'ufo' || e.st !== 'whip' || !e.sw || e.wt <= 20 || e.wt > 20 + UFO_SW.f || !(e.ll >= 30)) return false;
  const ox = e.x + UFO_SW.ox, oy = e.y + UFO_SW.oy;
  return segD2(ox, oy, ox + Math.cos(e.la) * e.ll, oy + Math.sin(e.la) * e.ll, px, py) < UFO_SW.w * UFO_SW.w;
}

/** D59: no new threat with a tell under this */
export const TELL_MIN = 44;
/** the ship's hit radius against a shot (shots.ts: s.r + 2.6) */
export const SHIP_R = 2.6;

/** squared distance from (px, py) to the segment (ax, ay)-(bx, by) */
export function segD2(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
  let u = L > 0 ? ((px - ax) * dx + (py - ay) * dy) / L : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const qx = ax + dx * u - px, qy = ay + dy * u - py;
  return qx * qx + qy * qy;
}

// ---------------- THE NAIL CHOIR ----------------
/** the lane's y for a ship at py: on it, kept a bar's length inside the screen (ph = the playfield's height) */
export const laneY = (py: number, ph: number) => Math.max(DN.lHH + 4, Math.min(ph - DN.lHH - 4, py));
/** the twin lane's y for a first lane at y1: DN.lGap2 below it when the whole bar fits there, else DN.lGap2 above */
export const lanePair = (y1: number, ph: number) => (y1 + DN.lGap2 <= ph - DN.lHH - 4 ? y1 + DN.lGap2 : y1 - DN.lGap2);
/** the lane's phases (e.lp): its tell, the sweep left, the sweep back, the bar flying home, the re-lock at the turn */
export const LP = { tel: 1, out: 2, back: 3, home: 4, turn: 5 } as const;
/** is the ship at (px, py) on the loose bar, or on the twin bar (e.tw, at e.ly2)? Only while they sweep (out and back);
 *  the bars' own bodies still touch as every enemy does (enemies/update.ts updateEnemies) */
export function laneHit(e: any, px: number, py: number): boolean {
  if (e.lp !== LP.out && e.lp !== LP.back) return false;
  if (Math.abs(px - e.lx) >= DN.lHW + SHIP_R) return false;
  return Math.abs(py - e.ly) < DN.lHH + SHIP_R || (!!e.tw && Math.abs(py - e.ly2) < DN.lHH + SHIP_R);
}

// ---------------- THE DISSOLVING WOMB ----------------
/** a pool's age a frames after it was planted: 0 fizzing (the tell), 1 burning, 2 drying, -1 gone */
export function poolStage(a: number): number {
  return a < DN.plArm ? 0 : a < DN.plArm + DN.plLive ? 1 : a < DN.plArm + DN.plLive + DN.plDry ? 2 : -1;
}
/** a pool's eruption a frames after planting: 0 none, 1 boiling (the tell), 2 the column stands */
export function eruptStage(a: number): number {
  if (poolStage(a) !== 1) return 0;
  const b = a - DN.plArm - DN.plEr0;
  if (b < 0) return 0;
  const q = b % DN.plEvery;
  return q < DN.plErTel ? 1 : q < DN.plErTel + DN.plErLive ? 2 : 0;
}
/** an eruption's column length for a cave gap px across at the pool */
export const poolReach = (gap: number) => Math.max(0, Math.min(DN.plRMax, gap * DN.plReach));
/** is the ship at screen (px, py) in a burning pool or its standing column? Pools sit at world x pX (sc = the scroll),
 *  surface pY, side pS (1 floor, -1 ceiling), column reach pR, planted at e.t = pT */
export function poolHit(e: any, sc: number, px: number, py: number): boolean {
  for (let i = 0; i < (e.pn || 0); i++) {
    const a = e.t - e.pT[i];
    if (poolStage(a) !== 1) continue;
    const dx = Math.abs(px - (e.pX[i] - sc));
    if (dx >= DN.plHW + SHIP_R) continue;
    const d = (e.pY[i] - py) * e.pS[i]; // how far off the surface, into the cave
    if (d > -SHIP_R && d < DN.plH + SHIP_R) return true;
    if (dx < DN.plCW + SHIP_R && d > -SHIP_R && d < e.pR[i] + SHIP_R && eruptStage(a) === 2) return true;
  }
  return false;
}
/**
 * Plant a pool at world x wx on the surface y (side 1 floor, -1 ceiling) at frame t, its column reach px long. Feeds a
 * pool within plMerge on the same side instead; with no room, replaces the oldest. Writes e.pX/pY/pS/pT/pR (fixed
 * arrays, e.pn used): no allocation. Returns the slot it used.
 */
export function plantPool(e: any, wx: number, y: number, side: number, t: number, cap: number, reach = 0): number {
  for (let i = 0; i < e.pn; i++) {
    if (e.pS[i] !== side || Math.abs(e.pX[i] - wx) > DN.plMerge) continue;
    const a = t - e.pT[i];
    // burning and not erupting: its burn starts over (and its eruption clock with it); fizzing or erupting: it runs on,
    // so a fed pool never cuts a tell short
    if (a >= DN.plArm && !eruptStage(a)) e.pT[i] = t - DN.plArm;
    return i;
  }
  let i = e.pn;
  if (e.pn >= cap) { i = 0; for (let j = 1; j < e.pn; j++) if (e.pT[j] < e.pT[i]) i = j; }
  else e.pn++;
  e.pX[i] = wx; e.pY[i] = y; e.pS[i] = side; e.pT[i] = t; e.pR[i] = reach;
  return i;
}
/** drop the pools that have dried up (compacts in place) */
export function agePools(e: any, t: number): void {
  let n = 0;
  for (let i = 0; i < e.pn; i++) {
    if (poolStage(t - e.pT[i]) < 0) continue;
    e.pX[n] = e.pX[i]; e.pY[n] = e.pY[i]; e.pS[n] = e.pS[i]; e.pT[n] = e.pT[i]; e.pR[n] = e.pR[i]; n++;
  }
  e.pn = n;
}

// ---------------- THE APPRENTICE ----------------
/** the hook's phases (e.st): the tell, the throw, the bite, the reel */
export const HOOK_ST = ['htel', 'hook', 'bite', 'reel'] as const;
/** the hook's eye in screen px */
export const hookO = (e: any, out: number[]) => { out[0] = e.x + DN.hOx; out[1] = e.y + DN.hOy; return out; };
/** one hook's hit: its tip while thrown or reeling, its chain while it bites or reels (sagging sag px at its middle) */
export function hookAt(st: string, ha: number, hd: number, sag: number, ox: number, oy: number, px: number, py: number): boolean {
  if (!(hd > 0) || (st !== 'hook' && st !== 'bite' && st !== 'reel')) return false;
  const tx = ox + Math.cos(ha) * hd, ty = oy + Math.sin(ha) * hd;
  const tr = DN.hR + SHIP_R, dt = (px - tx) * (px - tx) + (py - ty) * (py - ty);
  if (st !== 'bite' && dt < tr * tr) return true;
  if (st === 'hook') return false;
  const w2 = (DN.hW + SHIP_R) ** 2;
  if (!(sag > 0)) return segD2(ox, oy, tx, ty, px, py) < w2;
  const mx = (ox + tx) / 2, my = (oy + ty) / 2 + sag; // the sagging wire: a 3-point polyline
  return segD2(ox, oy, mx, my, px, py) < w2 || segD2(mx, my, tx, ty, px, py) < w2;
}
/** is the ship at (px, py) hit by the hook, or by the second hook (rank >= 14: e.st2, e.ha2, e.hd2, e.sag2)? */
export function hookHit(e: any, px: number, py: number): boolean {
  const ox = e.x + DN.hOx, oy = e.y + DN.hOy;
  return hookAt(e.st, e.ha, e.hd, e.sag || 0, ox, oy, px, py) || (!!e.st2 && hookAt(e.st2, e.ha2, e.hd2, e.sag2 || 0, ox, oy, px, py));
}
/** the sag of a wire from y oy to y ty: DN.hSag, less if its middle would come within DN.hSagGap of the floor (fl) there,
 *  or if the wire's middle already sits that close (it never sags into a closing cave); never negative */
export function hookSag(oy: number, ty: number, fl: number): number {
  return Math.max(0, Math.min(DN.hSag, fl - DN.hSagGap - (oy + ty) / 2));
}
/** the second hook's aim: a, kept at least DN.h2Gap from the first's wire (angle a1) at range d (the ship's distance) */
export function hook2Aim(a: number, a1: number, d: number): number {
  const dm = Math.asin(Math.min(1, DN.h2Gap / Math.max(1, d))), da = Math.atan2(Math.sin(a - a1), Math.cos(a - a1));
  return Math.abs(da) >= dm ? a : a1 + (da < 0 ? -dm : dm);
}

// ---------------- THE BROOD MOTHER ----------------
/** the litter's lane for a ship at py */
export const broodLane = (py: number, ph: number) => Math.max(DN.bEdge, Math.min(ph - DN.bEdge, py));
/** where hatchling i of a litter from behind comes in, around lane y: rows of three, bDy apart, each bDx further back */
export function rearSlot(i: number, y: number, out: number[]): number[] {
  out[0] = DN.bX - i * DN.bDx;
  out[1] = y + ((i % 3) - 1) * DN.bDy;
  return out;
}

/** the phase-1 litter's column x for a ship at px on attack att: the ship's + DN.eDx, kept 40 px inside the right edge
 *  (w = the screen's width). Always ahead of a ship left of it, so the dive meets the ship (a column behind it was wasted) */
export function edgeX(px: number, att: number, w: number): number {
  return Math.min(w - 40, px + DN.eDx[((att % 4) + 4) % 4]);
}
/** where hatchling i of a phase-1 litter starts: the column at x, off the top (side 1) or bottom (side -1) edge */
export function edgeSlot(i: number, x: number, side: number, ph: number, out: number[]): number[] {
  out[0] = x;
  out[1] = side > 0 ? -DN.eY0 - i * DN.eDy : ph + DN.eY0 + i * DN.eDy;
  return out;
}

// ---------------- for the probes (tools only: allocates) ----------------
/**
 * What a midboss's denial move threatens right now, as circles { x, y, vx, vy, r, k } for tools/pilot.mjs's eyes and
 * the probes' counts. Tools only (it allocates); the sim uses the hit tests above.
 */
export function denyPts(e: any, sc: number, out: any[] = []): any[] {
  if (!e || e.dead) return out;
  if (e.k === 'choir' && (e.lp === LP.out || e.lp === LP.back)) {
    const vx = e.lp === LP.out ? -DN.lSp : DN.lBack;
    for (let dy = -DN.lHH + 4; dy <= DN.lHH - 4; dy += 8) {
      out.push({ x: e.lx, y: e.ly + dy, vx, vy: 0, r: DN.lHW + 2, k: 'lane' });
      if (e.tw) out.push({ x: e.lx, y: e.ly2 + dy, vx, vy: 0, r: DN.lHW + 2, k: 'lane' });
    }
  }
  if (e.k === 'ufo' && e.st === 'whip' && e.sw && e.wt > 20 && e.wt <= 20 + UFO_SW.f) {
    const ox = e.x + UFO_SW.ox, oy = e.y + UFO_SW.oy, c = Math.cos(e.la), s = Math.sin(e.la);
    for (let d = 30; d < e.ll; d += 10) out.push({ x: ox + c * d, y: oy + s * d, vx: 0, vy: 0, r: UFO_SW.w + 2, k: 'sweep' });
  }
  if (e.k === 'cyst') for (let i = 0; i < (e.pn || 0); i++) {
    const a = e.t - e.pT[i];
    if (a < DN.plArm - 20 || poolStage(a) > 1 || poolStage(a) < 0) continue;
    const x = e.pX[i] - sc, s = e.pS[i];
    for (const dx of [-DN.plHW * .55, DN.plHW * .55]) out.push({ x: x + dx, y: e.pY[i] - s * DN.plH * .5, vx: 0, vy: 0, r: DN.plHW * .6 + 4, k: 'pool' });
    const b = a - DN.plArm - DN.plEr0, q = b >= 0 ? b % DN.plEvery : -1; // the column: seen from the last 24 f of its tell
    if (poolStage(a) === 1 && q >= DN.plErTel - 24 && q < DN.plErTel + DN.plErLive) for (let d = 8; d < e.pR[i]; d += 12) out.push({ x, y: e.pY[i] - s * d, vx: 0, vy: 0, r: DN.plCW + 4, k: 'column' });
  }
  if (e.k === 'prentice') for (const [st, ha, hd, sag] of [[e.st, e.ha, e.hd, e.sag || 0], [e.st2, e.ha2, e.hd2, e.sag2 || 0]]) {
    if (!(hd > 0) || (st !== 'hook' && st !== 'bite' && st !== 'reel')) continue;
    const ox = e.x + DN.hOx, oy = e.y + DN.hOy, c = Math.cos(ha), s = Math.sin(ha);
    const v = st === 'hook' ? DN.hSp : st === 'reel' ? -DN.hIn : 0;
    out.push({ x: ox + c * hd, y: oy + s * hd, vx: c * v, vy: s * v, r: DN.hR + 2, k: 'hook' });
    if (st !== 'hook') for (let d = 12; d < hd; d += 8) { const u = d / hd; out.push({ x: ox + c * d, y: oy + s * d + sag * (1 - Math.abs(2 * u - 1)), vx: 0, vy: 0, r: DN.hW + 2, k: 'chain' }); }
  }
  return out;
}
/** the name of the denial hit the ship at (px, py) would take from e, or '' (the probes' would-be hit count) */
export function denyHit(e: any, sc: number, px: number, py: number): string {
  if (!e || e.dead) return '';
  if (e.k === 'choir' && laneHit(e, px, py)) return 'lane';
  if (e.k === 'ufo' && sweepHit(e, px, py)) return 'sweep';
  if (e.k === 'cyst' && poolHit(e, sc, px, py)) return 'pool';
  if (e.k === 'prentice' && hookHit(e, px, py)) return 'hook';
  return '';
}
