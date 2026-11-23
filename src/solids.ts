// SOLIDS: moving solid blocks, and the DYN moving-terrain windows they share a stepper with (DIFFICULTY-SPEC §2.4
// "Shared code", levels.md §2.1-2.2; workstream W3a, the engine W3b's THE STROKE and W3c's MORGUE RUSH / HIGH TIDE /
// THE SWALLOW are built on). The contract other streams code against: scratchpad spec/W3A-API.md.
//
// A solid is an axis-aligned box in world x / screen y (it scrolls with the terrain), with a class that says what it
// does to the ship:
// - terrain class (HARD, LODGE, PLUG): kills like a wall, through WARD (Matt's decision 5): player.ts's terrain loop
//   asks solidAt, so a solid is exactly as lethal as the arrays;
// - BODY (an ice block still in flight): a body hit, which WARD absorbs (levels.md §5.1); stepSolids reports it.
// Player shots chip a shootable solid (hp in player damage units, a naked bolt is 1) and tink off the rest; enemy shots
// die on every solid; the rigs (contraptions.ts solid()) treat them as terrain.
//
// Determinism: frame counters and world x only, never R(). A lane is the ship's y at the tell (sim state). The engine
// resets itself when $.G or the FLOOR array is replaced (newGame, startLoop, resumeRun / a checkpoint restore,
// deathRestart), so a resumed run never inherits a block, and the signature beats re-arm what lies past the checkpoint
// (checkpoints never sit inside a signature window, spec §5.1). solidsSnap / solidsLoad round-trip the full state.
// Short never spawns one: with an empty list every entry point returns at its first line (harness and parity unmoved).
import { $ } from './state';
import { PH, TS, W } from './core';
import { CEIL, FLOOR, ceilAt, floorAt } from './world';
import { DYN, DYNS, armDynWin, dynAt as dynAtT, dynBase, ramp, resetDynWins, stepDynWins } from './terrainb';
import type { DynSpec, DynWin } from './terrainb';
import { SOLID_KILLS } from './sigs';

// sigs.ts SOLID_KILLS (decision 5A): true, a moving solid kills like a wall through WARD; false, the split rule (levels.md
// D-1: wedged blocks and plugs stay walls, a piston becomes a body WARD absorbs)

/** solid classes (bit flags), the masks the queries take */
export const SC = {
  /** unshootable terrain class: pistons, generic slabs */
  HARD: 1,
  /** an ice block wedged in a wall: shootable, terrain class */
  LODGE: 2,
  /** a mucus plug cell: a shootable barrier, terrain class (S6 is held by its hp table, not by the fit gap) */
  PLUG: 4,
  /** an ice block in flight: a body (WARD absorbs it) */
  BODY: 8,
  /** what kills like a wall through WARD (decision 5) */
  TERRAIN: 7,
  /** what route-probe's swept fit gap counts (gate L5): a plug is cut, not flown round */
  FIT: 3,
  ALL: 15,
} as const;

/** the engine's tuning table. Signature numbers (counts, pitches, variations) live in sigs.ts (W3c); these are the
 *  engine's own rules, each with its spec tag and the gate or test that holds it */
export const SOLID = {
  /** S2: no terrain-class solid edge moves faster than this, px/f (route-probe slam, gate L5; solids.test.ts). A
   *  flying ice block is a body, not terrain, so its flight is exempt (levels.md §5.1) */
  vMax: DYN.vMax,
  /** S5: nothing spawns with its centre within this of the ship's (route-probe hazBad 'solid-on-ship', gate L5) */
  noSpawn: 48,
  /** S5: a cut plug cell never regrows (and a growing cell never sets) within this of the ship */
  regrowClear: 24,
  /** levels.md §6.3: a piston whose tell would start with the ship within this of its x holds back one cycle */
  pistonClear: 30,
  /** S1: the engine's own fit floor (a window may ask for more, never less) */
  minFit: 72,
  /** S4: the shortest tell any solid gets (D59) */
  minTell: 44,
  /** MORGUE RUSH block (levels.md §5.1): 22 x 14, hp 2 (2 naked bolts, S6), a 50 f frost-streak tell, flight 2.2 px/f
   *  (screen), the turn to the wall at 2.5 px/f, lanes kept 12 px inside the walls, xStop = max(P.x + 120, 220), entry
   *  at W + 12 but never nearer the ship than shipLead (S5) */
  ice: { w: 22, h: 14, hp: 2, tell: 50, vFly: 2.2, vTurn: 2.5, inset: 12, stopAhead: 120, stopMin: 220, enterX: 12, shipLead: 60 },
  /** MUCUS PLUG (levels.md §5.4): 10 x 10 cells, hp 1 (a 3-cell hole is 3 bolts, S6), grown over 44 f, regrown 150 f
   *  after a cut; `root` cells reach into each wall past the relaxed edge so a clench or relax never opens a seam */
  plug: { cell: 10, hp: 1, tell: 44, regrow: 150, root: 1 },
  /** THE STROKE piston (levels.md §6.3): 30 px wide, a 50 f tell, hold 90, rest 60. Stroke speed is S2's .5 px/f (the
   *  1.2 / .8 of levels.md §6.3 broke S2, which the merged spec §2.4 keeps for every moving edge). `ease` stretches the
   *  stroke so its ends ease (1 = a hard linear stroke at vMax). `rootPad`: px a retracted tip sits inside its wall */
  piston: { w: 30, tell: 50, hold: 90, rest: 60, ease: 1.25, rootPad: 2 },
  /** shotSolid also tests this far behind the shot (half a plug cell): a point test can step over a 10 px cell */
  shotSweep: 8, // the fastest player shot point is ARC's tip while it extends: 9 + 8 px/f, plus the 1 px/f scroll (player.ts laser)
  /** a solid this far off the screen's left edge is dropped */
  cull: 48,
  /** the fx/audio event queue's cap (fx/update.ts drains it every frame) */
  fxCap: 64,
};

/** one solid. x, y, w, h: the collidable box (world x, screen y). cls: its SC class now (0 while it is a tell, growing
 *  or cut). hp: player damage left (0 = unbreakable when !shoot). t: frames in the current state */
export type Solid = {
  id: number; k: 'ice' | 'plug' | 'piston' | 'slab'; st: string; cls: number;
  x: number; y: number; w: number; h: number; hp: number; hp0: number; shoot: boolean;
  t: number; fit: number; side: number; sig: string; grp: number; hit: number;
  // ice
  lane?: number; xStop?: number; vFly?: number; vTurn?: number; tell?: number;
  // plug
  cy?: number; regrow?: number;
  // piston
  root?: number; reach?: number; tip?: number; age?: number; phase?: number; hold?: number; rest?: number; ext?: number;
  skipN?: number; v?: number;
  // slab
  vx?: number; vy?: number; life?: number;
};
/** the live list (route-probe reads it as solids.ts `solids`). Dead entries are dropped at the next step */
export const solids: Solid[] = [];
/** fx and audio events from the sim (fx/update.ts drainSolidFx plays them; render stream only) */
export type SolidEv = { k: string; x: number; y: number; s: string };
export const SOLID_FX: SolidEv[] = [];

/** what kills like a wall (player.ts:371's solidAt default): the terrain class, less the pistons under the split rule */
const WALL = SC.TERRAIN; // under the split rule (SOLID_KILLS false) solidAt skips pistons itself
/** what hits as a body (WARD absorbs): flying blocks, and the pistons under the split rule */
const BODYM = SC.BODY; // under the split rule a piston is a body too (bodyContact checks k, not HARD: slabs stay walls)
let nextId = 1, nextGrp = 1;
let boundG: any = null, boundF: Float32Array | null = null;

/** the ship's 5 terrain points (player.ts:371), for body contact */
const HULL = [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]];

/** queue an fx/audio event at world x, screen y; s: the solid (its kind is the event's s) or a kind name */
const EVP: SolidEv[] = [];
function ev(k: string, s: Solid | string | null, x: number, y: number) {
  const n = SOLID_FX.length;
  if (n >= SOLID.fxCap) return; // a frame's cues past the cap are dropped (fx/update.ts drains every frame)
  const e = EVP[n] || (EVP[n] = { k: '', x: 0, y: 0, s: '' }); // pooled: no allocation per event
  e.k = k; e.x = x - ($.G ? $.G.scroll : 0); e.y = y; e.s = typeof s === 'string' ? s : s ? s.k : '';
  SOLID_FX.push(e);
}

// ---------------- binding, reset, buckets ----------------
/** drop every solid and every DYN window. Writes the DYN bases back when the terrain is still the one they were armed on */
export function resetSolids() {
  resetDynWins(CEIL, FLOOR);
  solids.length = 0;
  SOLID_FX.length = 0;
  nextId = nextGrp = 1; // a replay from the same beats is byte-identical, ids included
  bkDirty = true;
  boundG = $.G;
  boundF = FLOOR;
}
/** true when the engine may hold state for this run: resets itself first when the run or the terrain was replaced */
function bound() {
  if (!$.G) return false;
  if ($.G !== boundG || FLOOR !== boundF) {
    if (FLOOR !== boundF) DYNS.length = 0; // a rebuilt terrain: the old bases belong to the old arrays
    resetSolids();
  }
  return true;
}

// screen-column buckets over x -64 .. W + 64, rebuilt at the end of each step; a query outside them, or before the
// first rebuild of a frame's scroll, scans the whole list (correct, just slower)
const BW = 16, BX = 64, NB = Math.ceil((W + 2 * BX) / BW);
const BK: Solid[][] = Array.from({ length: NB }, () => []);
let bkScroll = NaN, bkDirty = true;
function rebucket() {
  for (let i = 0; i < NB; i++) BK[i].length = 0;
  const sc = $.G.scroll;
  for (const s of solids) {
    if (!s.cls) continue;
    const a = Math.floor((s.x - sc + BX) / BW), b = Math.floor((s.x + s.w - sc + BX) / BW);
    for (let i = Math.max(0, a); i <= Math.min(NB - 1, b); i++) BK[i].push(s);
  }
  bkScroll = sc;
  bkDirty = false;
}
function cand(wx: number): Solid[] {
  if (bkDirty || !$.G || $.G.scroll !== bkScroll) return solids;
  const i = Math.floor((wx - bkScroll + BX) / BW);
  return i >= 0 && i < NB ? BK[i] : solids;
}
/** the engine's state belongs to this run and this terrain (a query between a rebuild and the next step sees nothing) */
const fresh = () => $.G === boundG && FLOOR === boundF;
const inside = (s: Solid, wx: number, y: number) => wx >= s.x && wx <= s.x + s.w && y >= s.y && y <= s.y + s.h;

// ---------------- queries ----------------
/** is (wx, y) inside a solid of class `mask` (default: terrain class, which kills like a wall through WARD)? The W0 hooks:
 *  player.ts:371's terrain loop and contraptions.ts:113 solid() */
export function solidAt(wx: number, y: number, mask: number = WALL): boolean {
  if (!solids.length || !fresh()) return false;
  const L = cand(wx);
  for (let i = 0; i < L.length; i++) { const s = L[i]; if (s.cls & mask && (SOLID_KILLS || s.k !== 'piston' || mask !== WALL) && inside(s, wx, y)) return true; }
  return false;
}
/** the solid at (wx, y) of class `mask`, or null */
export function solidHit(wx: number, y: number, mask: number = SC.ALL): Solid | null {
  if (!solids.length || !fresh()) return null;
  const L = cand(wx);
  for (let i = 0; i < L.length; i++) { const s = L[i]; if (s.cls & mask && inside(s, wx, y)) return s; }
  return null;
}
/** the blocked y intervals [y0, y1] of the solids of class `mask` at world x (probes: FH, fit, forced moves, death
 *  source; W0 contract). No allocation per call: the list and its pairs are reused, so they hold only until the next
 *  call (copy them to keep them) */
const COL: [number, number][] = [], POOL: [number, number][] = [];
export function solidsCol(wx: number, mask: number = WALL): [number, number][] { // WALL: the probes agree with the sim
  COL.length = 0;
  if (!solids.length || !fresh()) return COL;
  const L = cand(wx);
  for (let i = 0; i < L.length; i++) {
    const s = L[i];
    if (!(s.cls & mask) || wx < s.x || wx > s.x + s.w) continue;
    const q = POOL[COL.length] || (POOL[COL.length] = [0, 0]);
    q[0] = s.y; q[1] = s.y + s.h;
    COL.push(q);
  }
  return COL;
}
/** solidsCol with the fit-gap mask (route-probe L5) */
export const solidsColFit = (wx: number) => solidsCol(wx, SC.FIT);

/** a player shot at (wx, y) with damage dmg: 0 no solid (fly on), 1 tinked off an unshootable one, 2 chipped, 3 broke
 *  it. Nonzero: the shot dies. The W0 hook in shots.ts's player-shot terrain test (call it last in the ||: it hurts) */
export function shotSolid(wx: number, y: number, dmg: number): 0 | 1 | 2 | 3 {
  // swept back half a plug cell: a bolt moves ~10 world px a frame, a cell is 10 wide, so a point test could step
  // over one (qa-lead). The shot's own position first
  const s = solidHit(wx, y, SC.ALL) || solidHit(wx - SOLID.shotSweep, y, SC.ALL);
  if (!s) return 0;
  if (!s.shoot || s.hp <= 0) { ev('tink', s, wx, y); return 1; }
  s.hp -= Math.max(0, dmg);
  s.hit = 6;
  if (s.hp > 0) { ev('chip', s, wx, y); return 2; }
  breakSolid(s, wx, y);
  return 3;
}
/** W0's contract name (shots.ts hook): true when a solid stopped the shot (and took its damage if shootable, S6) */
export const solidShot = (wx: number, y: number, dmg: number): boolean => shotSolid(wx, y, dmg) !== 0;
/** an enemy shot at (wx, y) dies on any solid, a flying block included. The W0 hook in shots.ts's enemy-shot terrain test */
export function eshotSolid(wx: number, y: number): boolean {
  return solidAt(wx, y, SC.ALL);
}
const IV: number[][] = [], IVP: number[][] = [], byTop = (a: number[], b: number[]) => a[0] - b[0];
/** levels.md S1's swept fit gap at world x with the solids of class `mask` as terrain: the largest open y interval over
 *  the ship's 21 px footprint [wx - 9, wx + 12] (min floor, max ceiling, minus every solid overlapping that run) */
export function freeSpan(wx: number, ce: (x: number) => number = ceilAt, fl: (x: number) => number = floorAt, mask: number = SC.FIT): number {
  let top = -Infinity, bot = Infinity;
  for (let u = wx - 9; u <= wx + 12; u += 3) { top = Math.max(top, ce(u)); bot = Math.min(bot, fl(u)); }
  if (bot <= top) return 0;
  if (!solids.length) return bot - top;
  // sweep the blocked intervals of the solids over the run, sorted by top, keeping the largest gap
  const iv = IV;
  iv.length = 0;
  for (const s of solids) if (s.cls & mask && s.x < wx + 12 && s.x + s.w > wx - 9) { const q = IVP[iv.length] || (IVP[iv.length] = [0, 0]); q[0] = s.y; q[1] = s.y + s.h; iv.push(q); }
  if (!iv.length) return bot - top;
  iv.sort(byTop);
  let best = 0, y = top;
  for (const [a, b] of iv) { if (a > y) best = Math.max(best, Math.min(a, bot) - y); y = Math.max(y, b); if (y >= bot) break; }
  if (y < bot) best = Math.max(best, bot - y);
  return Math.max(0, best);
}
/** the narrowest swept fit gap over every ship x whose footprint touches world run [x0, x1] (the lodge rule) */
function minSpanOver(x0: number, x1: number, mask: number) {
  let m = Infinity;
  for (let u = x0 - 12; u <= x1 + 9; u += 3) m = Math.min(m, freeSpan(u, ceilAt, floorAt, mask)); // freeSpan's own 3 px step
  return m;
}

// ---------------- breaking ----------------
function breakSolid(s: Solid, wx: number, y: number) {
  if (s.k === 'plug') { // a cut cell: open until it regrows (S5: never on the ship)
    s.st = 'cut'; s.cls = 0; s.t = 0; s.hp = 0;
    ev('cut', s, s.x + s.w / 2, s.y + s.h / 2);
    return;
  }
  s.st = 'dead'; s.cls = 0; s.hp = 0;
  ev('shatter', s, s.x + s.w / 2, s.y + s.h / 2);
}

// ---------------- spawners ----------------
const P = () => $.P;
const shipW = () => (P() ? P().x + $.G.scroll : -1e9);
/** S5: does the box (world x, screen y) come within r of the ship's centre? (the nearest point of the box, not its
 *  centre: a piston's box runs off the screen and a long slab's centre can be far from the ship standing in it) */
function nearBox(x: number, y: number, w: number, h: number, r: number) {
  const p = P();
  if (!p || !p.alive) return false;
  const sx = shipW(), dx = Math.max(x - sx, 0, sx - (x + w)), dy = Math.max(y - p.y, 0, p.y - (y + h));
  return dx * dx + dy * dy < r * r;
}
const nearS = (s: Solid, r: number) => nearBox(s.x, s.y, s.w, s.h, r);
function mk(o: Partial<Solid>): Solid {
  const s = { id: nextId++, k: 'slab', st: 'live', cls: 0, x: 0, y: 0, w: 1, h: 1, hp: 0, hp0: 0, shoot: false, t: 0, fit: SOLID.minFit, side: 0, sig: '', grp: 0, hit: 0, ...o } as Solid;
  s.hp0 = s.hp;
  solids.push(s);
  bkDirty = true;
  return s;
}

/** a MORGUE RUSH ice block (levels.md §5.1). Its tell starts now: a frost streak on lane `lane` (default the ship's y,
 *  kept SOLID.ice.inset inside the walls). Then it flies left (a body), turns to the nearer wall at xStop (screen x) and
 *  wedges there (terrain class), stacking on blocks already lodged; if lodging would leave the swept fit gap under
 *  `fit`, it shatters instead. null when there is no run */
export function spawnIce(o: { lane?: number; tell?: number; xStop?: number; fit?: number; hp?: number; sig?: string; w?: number; h?: number; vFly?: number; vTurn?: number } = {}): Solid | null {
  if (!bound()) return null;
  const I = SOLID.ice, p = P(), w = o.w ?? I.w, h = o.h ?? I.h, sc = $.G.scroll;
  const sx = Math.max(W + I.enterX, (p ? p.x : 0) + I.shipLead), wx = sx + sc;
  const ce = Math.max(ceilAt(wx), ceilAt(wx + w)), fl = Math.min(floorAt(wx), floorAt(wx + w));
  const y0 = o.lane ?? (p ? p.y : PH / 2);
  const lane = Math.max(ce + I.inset + h / 2, Math.min(fl - I.inset - h / 2, y0));
  if (nearBox(wx, lane - h / 2, w, h, SOLID.noSpawn)) return null;
  const xStop = o.xStop ?? Math.max((p ? p.x : 0) + I.stopAhead, I.stopMin);
  ev('icetell', 'ice', wx, lane);
  return mk({ k: 'ice', st: 'tell', x: wx, y: lane - h / 2, w, h, hp: o.hp ?? I.hp, shoot: true, fit: Math.max(SOLID.minFit, o.fit ?? 100), sig: o.sig ?? 'morgue_rush', grp: nextGrp++, lane, xStop, tell: Math.max(SOLID.minTell, o.tell ?? I.tell), vFly: o.vFly ?? I.vFly, vTurn: o.vTurn ?? I.vTurn });
}

/** a MUCUS PLUG column at world x (levels.md §5.4): cell x cell cells from y0 to y1 (default the relaxed walls there,
 *  the DYN base under a live window, plus SOLID.plug.root cells into each wall). Each grows over `tell` f, then is a
 *  PLUG; a cut one regrows `regrow` f later. Cells within SOLID.noSpawn of the ship are not made (S5). The cells, or [] */
export function spawnPlug(o: { wx: number; tell?: number; fit?: number; hp?: number; cell?: number; regrow?: number; sig?: string; y0?: number; y1?: number }): Solid[] {
  if (!bound()) return [];
  const Q = SOLID.plug, c = o.cell ?? Q.cell, base = dynBase(o.wx);
  const ce = o.y0 ?? (base ? base[0] : ceilAt(o.wx)) - Q.root * c, fl = o.y1 ?? (base ? base[1] : floorAt(o.wx)) + Q.root * c;
  const n = Math.max(1, Math.ceil((fl - ce) / c)), grp = nextGrp++, out: Solid[] = [];
  for (let i = 0; i < n; i++) {
    const y = ce + i * c;
    if (nearBox(o.wx - c / 2, y, c, c, SOLID.noSpawn)) continue;
    out.push(mk({ k: 'plug', st: 'grow', x: o.wx - c / 2, y, w: c, h: c, hp: o.hp ?? Q.hp, shoot: true, fit: Math.max(SOLID.minFit, o.fit ?? 72), sig: o.sig ?? 'swallow', grp, cy: i, tell: Math.max(SOLID.minTell, o.tell ?? Q.tell), regrow: o.regrow ?? Q.regrow }));
  }
  return out;
}

/** frames one cycle of this piston lasts (rest + extend + hold + retract): read it from the spawned solid for pitch and
 *  phase math (its stroke depends on the wall it found) */
export const pistonPeriod = (s: Solid) => s.rest! + 2 * s.ext! + s.hold!;
/** a piston's tip at frame u of its cycle (u in [0, period)): rest at the root, extend, hold at the reach, retract. Pure */
function pistonTipAt(s: Solid, u: number) {
  const d = s.reach! - s.root!, r = s.rest!, e = s.ext!, h = s.hold!;
  if (u < r) return s.root!;
  if (u < r + e) return s.root! + ramp(d, e, s.v!, u - r);
  if (u < r + e + h) return s.reach!;
  return s.reach! - ramp(d, e, s.v!, u - r - e - h);
}
/** the root and reach a piston would get at world x (shared by spawnPiston and spawnPistonPair, so a pair can agree on
 *  one stroke time before either exists) */
function pistonGeom(o: { x: number; side: number; reach: number; w?: number; fit?: number; far?: number; out?: number }) {
  const K = SOLID.piston, w = o.w ?? K.w, side = o.side === -1 ? -1 : 1, fit = Math.max(SOLID.minFit, o.fit ?? SOLID.minFit);
  let ce = -Infinity, fl = Infinity;
  for (let u = o.x; u <= o.x + w; u += 3) { ce = Math.max(ce, ceilAt(u)); fl = Math.min(fl, floorAt(u)); }
  // the root: just inside the wall at its nearest point to the gap (less rootPad), so a retracted piston never stands
  // out, unless "out" asks for a housing standing out of the wall (a shorter stroke, so a quicker cycle within S2)
  let root = side > 0 ? fl + K.rootPad : ce - K.rootPad;
  const far = o.far ?? (side > 0 ? ce : fl); // the opposite edge the reach keeps fit from (a pair passes its partner's tip)
  const reach = side > 0 ? Math.max(o.reach, far + fit) : Math.min(o.reach, far - fit);
  const out = Math.max(0, o.out ?? 0);
  root = side > 0 ? Math.max(reach, root - out) : Math.min(reach, root + out);
  return { w, side, fit, root, reach, stroke: Math.abs(root - reach) };
}
/** the extend (and retract) time of a stroke at <= v, eased (SOLID.piston.ease, or ease >= 1) */
const extFor = (stroke: number, v: number, ease?: number) => Math.ceil(stroke / v * Math.max(1, ease ?? SOLID.piston.ease));

type PistonOpts = { x: number; side: 1 | -1; reach: number; w?: number; tell?: number; hold?: number; rest?: number; phase?: number; sig?: string; v?: number; fit?: number; far?: number; out?: number; ease?: number; ext?: number };
/** a THE STROKE piston (levels.md §6.3) rooted in the floor (side 1) or the ceiling (-1) over world x .. x + w. reach:
 *  the tip's y at full stroke (clamped so the gap to the far wall keeps SOLID.minFit, or fit). Cycle: rest (its last
 *  tell f are the tell), extend, hold, retract, at <= SOLID.vMax; ext forces the stroke time (never faster than vMax),
 *  out stands the retracted tip out of the wall as a housing, ease (>= 1) slows the stroke's ends. phase: frames into
 *  the cycle at spawn; the tip starts where that phase puts it (no first-frame jump, S2). HARD. null when S5 refuses
 *  it (its box at that phase within 48 px of the ship) */
export function spawnPiston(o: PistonOpts): Solid | null {
  if (!bound()) return null;
  const K = SOLID.piston, g = pistonGeom(o), v = Math.min(SOLID.vMax, o.v ?? SOLID.vMax);
  const ext = Math.max(extFor(g.stroke, v, o.ease), Math.ceil(g.stroke / v), o.ext ?? 0), tell = Math.max(SOLID.minTell, o.tell ?? K.tell);
  const rest = Math.max(o.rest ?? K.rest, tell);
  const s = mk({ k: 'piston', st: 'rest', cls: SC.HARD, x: o.x, w: g.w, side: g.side, root: g.root, reach: g.reach, tip: g.root, age: 0, phase: Math.max(0, o.phase ?? 0) | 0, hold: o.hold ?? K.hold, rest, ext, v, skipN: -1, tell, sig: o.sig ?? 'stroke', grp: nextGrp++, fit: g.fit });
  s.tip = pistonTipAt(s, s.phase! % pistonPeriod(s));
  pistonBox(s);
  if (nearS(s, SOLID.noSpawn)) { solids.pop(); return null; }
  return s;
}
/** an opposed pair at world x: tips centre -+ gap / 2 at full stroke (the gap keeps SOLID.minFit). Both share one stroke
 *  time (the longer one's), so they close and open together even off-centre. Atomic: both or null. [ceiling, floor] */
export function spawnPistonPair(o: Omit<PistonOpts, 'side' | 'reach' | 'far' | 'fit'> & { centre: number; gap: number }): [Solid, Solid] | null {
  if (!bound()) return null;
  const g = Math.max(SOLID.minFit, o.gap), a = o.centre - g / 2, b = o.centre + g / 2, v = Math.min(SOLID.vMax, o.v ?? SOLID.vMax);
  const ga = pistonGeom({ ...o, side: -1, reach: a, far: b, fit: g }), gb = pistonGeom({ ...o, side: 1, reach: b, far: a, fit: g });
  const ext = Math.max(extFor(ga.stroke, v, o.ease), extFor(gb.stroke, v, o.ease), o.ext ?? 0);
  const top = spawnPiston({ ...o, side: -1, reach: a, far: b, fit: g, ext });
  const bot = top && spawnPiston({ ...o, side: 1, reach: b, far: a, fit: g, ext });
  if (!top || !bot) { if (top) solids.splice(solids.indexOf(top), 1); return null; }
  bot.grp = top.grp;
  return [top, bot];
}
/** a generic terrain-class slab (HARD, or shootable with hp > 0 and shoot). vx, vy (world px/f) clamp to SOLID.vMax
 *  (S2); life in frames, -1 forever (until it scrolls off) */
export function spawnSlab(o: { x: number; y: number; w: number; h: number; hp?: number; shoot?: boolean; sig?: string; vx?: number; vy?: number; life?: number; fit?: number }): Solid | null {
  if (!bound()) return null;
  if (nearBox(o.x, o.y, o.w, o.h, SOLID.noSpawn)) return null;
  const v = SOLID.vMax, shoot = !!o.shoot && (o.hp ?? 0) > 0;
  return mk({ k: 'slab', st: 'live', cls: shoot ? SC.LODGE : SC.HARD, x: o.x, y: o.y, w: o.w, h: o.h, hp: o.hp ?? 0, shoot, sig: o.sig ?? 'slab', grp: nextGrp++, vx: Math.max(-v, Math.min(v, o.vx ?? 0)), vy: Math.max(-v, Math.min(v, o.vy ?? 0)), life: o.life ?? -1, fit: Math.max(SOLID.minFit, o.fit ?? SOLID.minFit) });
}

// ---------------- DYN wrappers (terrainb.ts windows on world.ts's arrays, clocked by G.t) ----------------
/** arm a raw DYN window now (terrainb.ts DynSpec). null without a run, or over a live window */
export function armDyn(spec: DynSpec): DynWin | null {
  if (!bound()) return null;
  const w = armDynWin(spec, $.G.t, CEIL, FLOOR, TS);
  if (w) ev('dyntell', w.spec.kind, (w.spec.x0 + w.spec.x1) / 2, 127);
  return w;
}
/** HIGH TIDE (levels.md §5.2): the floor (side 1) rises d px over rise f, holds, drains; tell 60 f; S2-capped ramps */
export function armTide(o: { x0: number; x1: number; d: number; rise: number; hold: number; drain: number; tell?: number; fit: number; side?: 1 | -1; sig?: string; edge?: number }) {
  return armDyn({ id: o.sig ?? 'high_tide', kind: 'tide', x0: o.x0, x1: o.x1, d: o.d, rise: o.rise, hold: o.hold, drain: o.drain, tell: o.tell ?? 60, fit: o.fit, side: o.side ?? 1, edge: o.edge });
}
/** THE SWALLOW (levels.md §5.4): both walls inset S (1 - cos(2 pi t / T)) / 2 for dur f; split: halves out of phase */
export function armSwallow(o: { x0: number; x1: number; S: number; T: number; dur: number; tell?: number; fit?: number; split?: boolean; sig?: string; edge?: number }) {
  return armDyn({ id: o.sig ?? 'swallow', kind: 'swallow', x0: o.x0, x1: o.x1, S: o.S, T: o.T, dur: o.dur, tell: o.tell ?? 44, fit: o.fit ?? 72, split: !!o.split, edge: o.edge });
}
/** what the DYN window over world x is doing now: { w, t, tell 0..1, k 0..1 } or null (render/moveprops.ts, probes) */
export const dynAt = (wx: number) => ($.G && fresh() ? dynAtT(wx, $.G.t) : null);

/** the live windows the engine holds, for sigs.ts / G.setp: each DYN window, and each signature's solids (their x run and
 *  the lowest fit floor among them) */
export function engineWindows(): { x0: number; x1: number; floor: number; id: string }[] {
  const out: { x0: number; x1: number; floor: number; id: string }[] = [];
  if (!$.G || !fresh()) return out;
  for (const w of DYNS) out.push({ x0: w.spec.x0, x1: w.spec.x1, floor: w.spec.fit, id: w.spec.id });
  const by: Record<number, { x0: number; x1: number; floor: number; id: string }> = {};
  for (const s of solids) { // one window per group (a plug column, a piston pair, a block), named by its signature
    if (s.st === 'dead') continue;
    const q = (by[s.grp] ||= { x0: s.x, x1: s.x + s.w, floor: s.fit, id: s.sig });
    q.x0 = Math.min(q.x0, s.x); q.x1 = Math.max(q.x1, s.x + s.w); q.floor = Math.min(q.floor, s.fit);
  }
  for (const k in by) out.push(by[k]);
  return out;
}

// ---------------- the stepper ----------------
/** the wall face a block on side `side` lodges against over world run x .. x + w: the terrain edge, or the face of a
 *  block already lodged there (stacking) */
function lodgeFace(s: Solid) {
  let f = s.side > 0 ? Infinity : -Infinity;
  for (let u = s.x; u <= s.x + s.w; u += 3) f = s.side > 0 ? Math.min(f, floorAt(u)) : Math.max(f, ceilAt(u));
  for (const q of solids) {
    if (q === s || q.cls !== SC.LODGE || q.side !== s.side || q.x >= s.x + s.w || q.x + q.w <= s.x) continue;
    f = s.side > 0 ? Math.min(f, q.y) : Math.max(f, q.y + q.h);
  }
  return f;
}
function stepIce(s: Solid, ss: number, sc: number) {
  if (s.st === 'tell') { // the frost streak: the block waits off the right edge, pinned to the screen
    s.x += ss;
    if (s.t >= s.tell!) { s.st = 'fly'; s.cls = SC.BODY; s.t = 0; ev('fly', s, s.x, s.lane!); }
    return;
  }
  if (s.st === 'fly') {
    s.x += ss - s.vFly!;
    const touch = s.y + s.h >= Math.min(floorAt(s.x), floorAt(s.x + s.w)) || s.y <= Math.max(ceilAt(s.x), ceilAt(s.x + s.w));
    if (s.x - sc <= s.xStop! || touch) {
      const c = Math.max(ceilAt(s.x), ceilAt(s.x + s.w)), f = Math.min(floorAt(s.x), floorAt(s.x + s.w));
      s.side = f - (s.y + s.h) <= s.y - c ? 1 : -1; // the nearer wall; a tie goes to the floor
      s.st = 'turn'; s.t = 0;
    }
    return;
  }
  if (s.st === 'turn') { // still a body: it drops (or rises) into the wall at vTurn, then wedges
    const face = lodgeFace(s), ty = s.side > 0 ? face - s.h : face, dy = ty - s.y;
    if (Math.abs(dy) > s.vTurn!) { s.y += Math.sign(dy) * s.vTurn!; return; }
    s.y = ty;
    if (hullIn(s)) { // it would wedge with the ship inside it: a body hit (WARD absorbs it), never a terrain kill
      s.st = 'dead'; s.cls = 0; lodgeHit = true;
      ev('shatter', s, s.x + s.w / 2, s.y + s.h / 2);
      return;
    }
    s.cls = SC.LODGE; // try it as terrain: the lodge rule asks the fit gap with it in place
    if (minSpanOver(s.x, s.x + s.w, SC.FIT) < s.fit) { s.st = 'dead'; s.cls = 0; ev('shatter', s, s.x + s.w / 2, s.y + s.h / 2); return; }
    s.st = 'lodged'; s.t = 0;
    ev('lodge', s, s.x + s.w / 2, s.side > 0 ? s.y + s.h : s.y);
  }
}
function stepPlug(s: Solid) {
  if (s.st === 'grow' && s.t >= s.tell!) {
    if (nearS(s, SOLID.regrowClear)) return; // never sets on the ship (S5): it waits
    s.st = 'live'; s.cls = SC.PLUG; s.t = 0; s.hp = s.hp0;
    if (s.cy === 0) ev('grow', s, s.x + s.w / 2, s.y + s.h / 2); // one wet cue per column, not per cell
  } else if (s.st === 'cut' && s.t >= s.regrow!) {
    if (nearS(s, SOLID.regrowClear)) return; // S5: regrow waits for the ship to leave
    s.st = 'grow'; s.t = 0;
    ev('regrow', s, s.x + s.w / 2, s.y + s.h / 2);
  }
}
/** a piston's box from its tip: the root wall side runs off the screen edge, so it reads as one with the wall */
function pistonBox(s: Solid) {
  if (s.side > 0) { s.y = s.tip!; s.h = PH + 99 - s.tip!; } else { s.y = -99; s.h = s.tip! + 99; }
}
function stepPiston(s: Solid) {
  const C = pistonPeriod(s), a = ++s.age! + s.phase!, n = Math.floor(a / C), u = a - n * C;
  if (u === s.rest! - s.tell!) { // the tell would start: hold back a cycle if the ship is at the piston's x (§6.3). A
    // pair shares x, phase and period, so both halves decide alike on the same frame
    const p = P(), d = p && p.alive ? Math.abs(shipW() - (s.x + s.w / 2)) : Infinity;
    if (d < SOLID.pistonClear + s.w / 2) s.skipN = n;
    else ev('hiss', s, s.x + s.w / 2, s.root!);
  }
  const skip = s.skipN === n;
  s.tip = skip ? s.root! : pistonTipAt(s, u);
  if (!skip && u === s.rest! + s.ext!) ev('clunk', s, s.x + s.w / 2, s.reach!);
  s.st = skip || u < s.rest! - s.tell! ? 'rest' : u < s.rest! ? 'tell' : u < s.rest! + s.ext! ? 'ext' : u < s.rest! + s.ext! + s.hold! ? 'hold' : 'ret';
  pistonBox(s);
}
function stepSlab(s: Solid) {
  s.x += s.vx!; s.y += s.vy!;
  if (s.life! > 0 && --s.life! === 0) { s.st = 'dead'; s.cls = 0; }
}
let lodgeHit = false;
/** is a point of the ship's hull inside the solid's box? */
function hullIn(s: Solid) {
  const p = P();
  if (!p || !p.alive) return false;
  const sc = $.G.scroll;
  for (const [ox, oy] of HULL) if (inside(s, p.x + ox + sc, p.y + oy)) return true;
  return false;
}
/** does a BODY solid touch the ship's hull? (the first one shatters on it) */
function bodyContact(sc: number) {
  const p = P();
  if (!p || !p.alive) return false;
  for (const s of solids) {
    if (!(s.cls & BODYM) && !(!SOLID_KILLS && s.k === 'piston' && s.cls)) continue;
    for (const [ox, oy] of HULL) if (inside(s, p.x + ox + sc, p.y + oy)) {
      if (s.k === 'piston') return true; // split rule only: a ram is not destroyed by what it hits
      s.st = 'dead'; s.cls = 0;
      ev('shatter', s, s.x + s.w / 2, s.y + s.h / 2);
      return true;
    }
  }
  return false;
}

/** one frame of the engine: the DYN windows, then every solid. true when a flying block hit the ship this frame (a body
 *  hit, WARD absorbs it): the step.ts hook is `if (stepSolids()) playerHit();`, after the scroll moves and before the
 *  player does */
export function stepSolids(): boolean {
  if (!$.G) return false;
  if ($.G !== boundG || FLOOR !== boundF) bound();
  if (DYNS.length) stepDynWins($.G.t, CEIL, FLOOR);
  if (!solids.length) return false;
  const ss = $.G.scrollSpeed || 0, sc = $.G.scroll;
  lodgeHit = false;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    s.t++;
    if (s.hit > 0) s.hit--;
    if (s.k === 'ice') stepIce(s, ss, sc);
    else if (s.k === 'plug') stepPlug(s);
    else if (s.k === 'piston') stepPiston(s);
    else stepSlab(s);
  }
  const hit = bodyContact(sc) || lodgeHit;
  lodgeHit = false;
  let j = 0;
  for (let i = 0; i < solids.length; i++) { const s = solids[i]; if (s.st !== 'dead' && s.x + s.w > sc - SOLID.cull) solids[j++] = s; }
  solids.length = j;
  rebucket();
  return hit;
}

// ---------------- snapshot (determinism tests; a checkpoint never needs it, see the header) ----------------
/** the engine's whole state as plain JSON */
export function solidsSnap() {
  return {
    nextId, nextGrp,
    solids: solids.map((s) => ({ ...s })),
    dyn: DYNS.filter((w) => w.arr === FLOOR).map((w) => ({ spec: { ...w.spec }, i0: w.i0, i1: w.i1, bc: Array.from(w.bc), bf: Array.from(w.bf), t0: w.t0 })),
  };
}
/** restore a solidsSnap onto the current run and terrain (the DYN bases are written back first, then re-armed) */
export function solidsLoad(snap: ReturnType<typeof solidsSnap>) {
  resetSolids();
  nextId = snap.nextId; nextGrp = snap.nextGrp;
  for (const s of snap.solids) solids.push({ ...s });
  for (const d of snap.dyn) {
    const w: DynWin = { spec: { ...d.spec }, i0: d.i0, i1: d.i1, bc: Float32Array.from(d.bc), bf: Float32Array.from(d.bf), t0: d.t0, arr: FLOOR, TS };
    DYNS.push(w);
  }
  if ($.G) stepDynWins($.G.t, CEIL, FLOOR); // the arrays as that frame left them
  bkDirty = true;
}
