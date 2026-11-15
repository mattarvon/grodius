// THE KEEPSAKE stage boss, the pure side: its tuning table and every rule a test or the art needs to read, with no
// imports, so tests/unit/keepsake.test.ts drives them without mocks and render/gross/boss/keepsake.ts reads the same
// geometry. The leading underscore keeps this file out of the kind glob (enemies/boss/index.ts): it is a helper.
// Design: production/decision-log.md D55 (Matt, 2026-11-15: the midboss KEEPSAKE, D53, retired into this fight's phase 1).
// The fountain helpers (fountLattice, forkCols, riseCap, lobFrames) moved here from the retired enemies/mid/_keepsake.ts.
//
// Geometry contract (the art lane codes against it, tools/keepsake-boss-art.json): boss-local px from (e.x, e.y), y down,
// at tilt 0. The head frame is FW x FH with the boss origin at (OX, OY) inside it; the crown line is KB.crown above the
// origin; a positive tilt rolls the crown AWAY from the ship (to the right), a negative one TOWARD it (the window).

/** every gameplay value of the fight, in frames and boss-local px. Probe: tools/boss-probe.mjs (TTK per kit) */
export const KB = {
  // ---- the head (2.15x the midboss's 48x58, D55)
  fw: 104, fh: 124, ox: 52, oy: 67, // the head box and the boss origin inside it (tools/keepsake-boss-art.json)
  r: 44, //         the body hitbox: the head is ~88 px wide, ~117 tall from crown to stump; the cap and the wound add e.hb
  rest: 58, //      it rests on the floor like a dropped toy: e.y = floor - rest (the stump's bottom is ~58 below the origin)
  tx: 120, //       its resting x: W - tx
  // ---- the ANGLE rule, kept from the midboss (D53) and rotated with the head
  crown: 26, //     phases 1-2: a hit whose head-local y is at or above -crown is on the crown (full damage)
  crown3: 12, //    phase 3 (CRACKED): the split face exposes more meat, so the line drops (the reward for surviving it)
  face: .15, //     everywhere else, and every area hit (they arrive at (e.x, e.y), head-local y 0)
  wx: 4, wy: -52, wr: 14, // the wound in the soft spot: its own hitbox (e.hb), the forks' launch point, the probe's aim
  cy: -34, cr: 24, //       the crown cap: a second hitbox so the dome above the body circle is hittable at every tilt
  // ---- phases: HP cuts as shares of max. Damage never carries past a cut (phaseClamp), see D55
  cut1: .65, //     DOZING -> AWAKE at 65%
  cut2: .30, //     AWAKE -> CRACKED at 30%
  end: .002, //     CRACKED's floor: the last hit leaves this much and the sleep eyes close (the dying beat) before the kill
  p2MinWin: 3, //   AWAKE takes at least this many tilt windows: the staged floor (p2Floor) caps each window's damage
  clock: 1500, //   each phase's clock (25 s, as the biome bosses' halves, docs/pacing.md 3.6). HUD fuse
  tr1: 90, //       IT WOKE UP: the transition (crown closed, nothing fires) and the mobile lowering
  tr2: 120, //      IT CRACKED: the vinyl splits, the rocker drops out
  dieBeat: 40, //   PUT TO BED: three slow clacks shut, this far apart (frames 1, 41, 81; kboss_shut's rates 1, .9, .8)...
  dieF: 110, //     ...the head tips onto its side after the last (kboss_topple's thud lands ~23 f later), then the kill
  enter: 150, //    the roll-in: no attacks and no clock until it has settled (e.t)
  // ---- phase 1, DOZING: the midboss's kit (D53), at boss scale
  tell: 48, //      the fountain's tell: eyes open, brain bulges, handles rise; landing marks from frame 1 (>= 44 f)
  stagger: 4, //    frames between forks leaving the wound
  slots: 6, pitch: 46, //   the lattice: >= 1 column always empty (forkCols), one column always on the ship (fountLattice)
  slots3: 7, pitch3: 40, // CRACKED's Fountain II: 5 forks of 7
  x0: -150, //      the lattice's default left end, from e.x
  jit: 5, //        per-fork jitter, px
  u0: 1.55, u1: 1.9, // launch rise speeds (px/f, BS-independent so the marks never grow with depth)
  top: 16, //       the apex never passes this screen y
  land: 6, //       the landing plane: this far below the wound at the tell's first frame (the crown lane)
  open: 60, //      the window after the fountain: the wound gapes, nothing fires
  aim: 46, lock: 16, //     the aimed throw: tracks for aim - lock, locks for lock (46 f), then the fork flies
  throwSp: 2.6, //  x BS(), like every aimed shot
  // ---- phase 2, AWAKE
  tilt: .5585, //   +-32 deg: the head rocks between crown TOWARD the ship (-tilt: the window) and AWAY (+tilt)
  hold: 70, roll: 40, // one tilt cycle = 2 x (hold + roll) = 220 f; the eyes clack at each extreme
  flutter: 30, //   the last frames of a hold: the lashes flutter before it rolls (the render reads it; the clack is the tell)
  boomTel: 54, boomLock: 20, // the boomerang: tracks 34, locks 20
  boomSp: 3.4, boomR: 6, boomEnd: 22,
  wail: 44, wailN: 12, wailSp: .7, // the wail ring: 12 orbs at .7 after a 44 f tell
  drop: 50, //      a mobile fork's drop tell: it shudders and its thread glints, then falls straight in its column
  dropGap: 12, //   the stagger between forks of one drop
  dropN: 3, //      2-3 per drop (never all of them: mobilePick leaves one)
  // ---- the mobile: a HOOP of forks on threads (seen edge-on a ring, never crossed bars: crossed bars read as a cross)
  mobN: 6, //       forks on the hoop
  mobDx: 22, //     their spacing, px; the hoop's centre sits at e.x + mobX
  mobX: -10,
  mobY: 34, //      the hoop's screen y once lowered (it starts above the screen and lowers over tr1), clear of the HUD's top rows
  mobLen: 36, //    hoop to fork tip (+ 0-6 per fork, mobVar): tips at screen y 70-76, so a lane of >= 20 px stays between them and
  //               the crown in the tightest arena (snot); the forks are drawn 33 px long (render: drawFork x2.2)
  mobVar: 1.5, //   per-fork extra thread, x ((i * 7 + 3) % 5): fixed per fork, no draw
  headTop: 58, //   the crown's top above the origin at tilt 0 (the art's bbox, tools/keepsake-boss-art.json)
  mobHit: 5, //     a hanging fork's contact radius (+ the ship's 2.6), at its tip, 11 px and 22 px up its length
  // ---- phase 3, CRACKED
  pvx: -24, pvy: -30, //    the rocker's pivot: where the crack opens, by the player-side eye
  pLen: 58, //      the wire, pivot to the lead weight
  pAmp: 1.9, //     its swing, radians each side of hanging: high enough that the weight sweeps the crown lane in front
  pPer: 180, //     a 3 s period, slow and constant
  pRamp: 60, //     the first swing starts from rest and builds over this many frames
  pR: 9, //         the weight-and-eyes bob: a part that blocks shots (a tink) and kills on contact
  crx: -33, cry: -8, crR: 9, // the crier (the 'mama' voice box) seated in the split at the temple (the art lane's seat), a breakable part
  crHp: 40, //      its HP (x depth, like every part): breaking it ends the wails for good (IT STOPPED CRYING)
  mama: 44, mamaGap: 30, // the double cry: a 44 f tell, the first ring, then the second 30 f later rotated half a gap
  rain: 50, //      fork rain: every fork left on the mobile but one, columns marked
  // ---- pacing
  cool: 60, cool2: 40, cool3: 36, // idle between attacks, x (1 - .3 rank) x cdm() x rage
  rage: .75, //     IT WON'T LET GO: the last clock's one capped enrage (D55): cooldowns x .75, never a tell
  rageGrade: 'B', // ...and the stage grade is capped here
  // ---- the arena (movement C override, biomes.ts rewriteTerrain): flat floor, open ceiling, a wide gap
  aAmp: .15, //     the biome's swing kept, as a share
  aGap: 200, //     the minimum gap over the arena (layout invariant: tests/unit/keepsake.test.ts)
  aCeil: 16, //     the ceiling never comes lower than this over the arena: the mobile needs the room
} as const;

// (the words, banners, readout and log lines, are src/voice/keepsake.ts's: the narrative lane's leaf, read by the booth)

/** a head-local point (lx, ly) turned by the tilt th, as a screen offset from (e.x, e.y): writes [dx, dy] into out */
export function rotXY(lx: number, ly: number, th: number, out: Float32Array | number[]): Float32Array | number[] {
  const c = Math.cos(th), s = Math.sin(th);
  out[0] = lx * c - ly * s; out[1] = lx * s + ly * c;
  return out;
}

/** THE KEEPSAKE's damage share for a hit at screen (hx, hy) on a head at (ex, ey) tilted th (D55, the rotated ANGLE
 *  rule): the hit is turned into the head's frame by -th; full damage when its head-local y is at or above -crown,
 *  `face` (x.15) otherwise. At th 0 it is exactly the midboss's y-only rule (no bolt/laser dead band, D53). Area damage
 *  arrives at (ex, ey): head-local y 0, a face hit at every tilt. Pure */
export function keepHurtRot(ex: number, ey: number, th: number, hx: number, hy: number, crown: number = KB.crown): number {
  const dx = hx - ex, dy = hy - ey, ly = -dx * Math.sin(th) + dy * Math.cos(th);
  return ly <= -crown ? 1 : KB.face;
}

/** the damage share left after the no-carry rule (D55): a hit of d at share m on hp may not take it below floor. Returns
 *  the share to apply (m, or less, down to 0 when hp already sits on the floor). Pure */
export function phaseClamp(hp: number, d: number, m: number, floor: number): number {
  if (!(d > 0) || !(m > 0)) return m > 0 ? m : 0;
  if (hp - d * m >= floor) return m;
  return Math.max(0, (hp - floor) / d);
}

/** the HP floor of phase ph (0 DOZING, 1 AWAKE, 2 CRACKED) for a boss of max HP, wins = AWAKE's finished tilt windows.
 *  AWAKE's floor is staged: until p2MinWin windows have closed, each one can only take its share of the phase (a strong
 *  kit can't empty AWAKE in its first window). Pure */
export function phaseFloor(max: number, ph: number, wins = 0): number {
  if (ph <= 0) return max * KB.cut1;
  if (ph === 1) return max * p2Floor(wins);
  return max * KB.end;
}
/** AWAKE's staged floor, as a share of max, after `wins` closed windows */
export const p2Floor = (wins: number) => Math.max(KB.cut2, KB.cut1 - (KB.cut1 - KB.cut2) * Math.min(1, (wins + 1) / KB.p2MinWin));

/** the AWAKE tilt at tilt-clock frame tc (from 0 at the end of IT WOKE UP): hold TOWARD (-tilt, the window), roll, hold
 *  AWAY (+tilt), roll back. The rolls ease (smoothstep). Pure */
export function tiltAt(tc: number): number {
  const H = KB.hold, Rl = KB.roll, C = 2 * (H + Rl), t = ((tc % C) + C) % C;
  const ease = (k: number) => k * k * (3 - 2 * k);
  if (t < H) return -KB.tilt;
  if (t < H + Rl) return -KB.tilt + 2 * KB.tilt * ease((t - H) / Rl);
  if (t < 2 * H + Rl) return KB.tilt;
  return KB.tilt - 2 * KB.tilt * ease((t - 2 * H - Rl) / Rl);
}
/** where AWAKE's tilt clock starts: mid-roll back toward the ship, so the head is upright (no snap) and the first hold is
 *  a window */
export const TILT0 = 2 * KB.hold + 1.5 * KB.roll;
/** is tilt-clock frame tc inside a window (the TOWARD hold)? */
export const inWindow = (tc: number) => { const C = 2 * (KB.hold + KB.roll); return ((tc % C) + C) % C < KB.hold; };
/** the frame of a tilt cycle a hold starts (0 TOWARD, hold + roll AWAY): the clack lands there */
export const tiltEdge = (tc: number) => { const C = 2 * (KB.hold + KB.roll), t = ((tc % C) + C) % C; return t === 0 ? -1 : t === KB.hold + KB.roll ? 1 : 0; };

/** the rocker's swing angle (radians from hanging; + swings toward the ship) at frame t of CRACKED: a constant-period
 *  pendulum whose amplitude builds from rest over pRamp. Pure */
export function pendAt(t: number): number {
  const k = Math.min(1, Math.max(0, t / KB.pRamp));
  return KB.pAmp * k * Math.sin((t / KB.pPer) * Math.PI * 2);
}
/** the rocker's weight, head-local, at swing angle a: writes [lx, ly] into out */
export function pendXY(a: number, out: Float32Array | number[]): Float32Array | number[] {
  out[0] = KB.pvx - Math.sin(a) * KB.pLen; out[1] = KB.pvy + Math.cos(a) * KB.pLen;
  return out;
}

/** a mobile drop: pick n of the forks still hanging (alive[i] 1) into out, at random, leaving at least one hanging so
 *  the drop is never the whole mobile (a gap always stays). rng is the sim's R(): exactly one draw per pick. Returns
 *  the count picked. Uses no scratch beyond out */
export function mobilePick(alive: Uint8Array, nf: number, n: number, rng: () => number, out: Uint8Array): number {
  let live = 0;
  for (let i = 0; i < nf; i++) if (alive[i]) live++;
  n = Math.max(0, Math.min(n, live - 1, out.length));
  for (let k = 0; k < n; k++) {
    let j = Math.floor(rng() * (live - k)), s = 0;
    for (; s < nf; s++) {
      if (!alive[s]) continue;
      let taken = false;
      for (let q = 0; q < k; q++) if (out[q] === s) { taken = true; break; }
      if (taken) continue;
      if (j-- === 0) break;
    }
    out[k] = s;
  }
  return n;
}

/** the arena's terrain at a column, movement C override (biomes.ts rewriteTerrain): the biome's swing cut to aAmp
 *  around its rest [c0, f0], then the ceiling raised until the gap is at least aGap and the ceiling is no lower than
 *  aCeil. Writes [ceil, floor] into out. Pure */
export function kbArena(c0: number, f0: number, ce: number, fl: number, out: number[]): number[] {
  fl = f0 + (fl - f0) * KB.aAmp;
  ce = c0 + (ce - c0) * KB.aAmp;
  ce = Math.min(ce, KB.aCeil, fl - KB.aGap);
  out[0] = ce; out[1] = fl;
  return out;
}

// ---------------- the fountain, moved from the retired midboss (D53) ----------------
/** the fountain's lattice, anchored on the ship's x px (head at ex): writes [origin, pitch, must] into lat. The default
 *  lattice runs from ex + x0 at `pitch`; a ship further left stretches it (origin px, wider pitch, `must` 0); a ship
 *  inside or right of it slides it left by under a pitch so a column sits on px (`must` that column). Pure */
export function fountLattice(px: number, ex: number, slots: number, pitch: number, x0: number, lat: Float32Array): Float32Array {
  const a = ex + x0, b = a + (slots - 1) * pitch;
  if (px <= a) { lat[0] = px; lat[1] = (b - px) / (slots - 1); lat[2] = 0; return lat; }
  const k = Math.min(slots - 1, Math.ceil((px - a) / pitch));
  lat[0] = px - k * pitch; lat[1] = pitch; lat[2] = k;
  return lat;
}

/** the fountain's columns: n of `slots` lattice columns (pitch px apart from x0), each jittered by +-jit, clamped to
 *  [lo, hi], written into out (screen x) in lattice order. Column `must` (>= 0) is always one of them (the ship's).
 *  n is capped at slots - 1, so at least one column is always empty: a gap of >= 2 * pitch - 2 * jit. rng is the
 *  sim's R(): 2n draws, 2n - 1 with a `must`, whatever it picks. Uses `used` as scratch: no allocation. Returns n */
export function forkCols(n: number, slots: number, pitch: number, x0: number, jit: number, lo: number, hi: number, rng: () => number, out: Float32Array, used: Uint8Array, must = -1): number {
  n = Math.max(0, Math.min(n, slots - 1, out.length));
  used.fill(0, 0, slots);
  const m0 = n > 0 && must >= 0 && must < slots ? 1 : 0;
  if (m0) used[must] = 1;
  for (let k = m0; k < n; k++) { // pick the k-th free slot at random: one draw per pick, whatever the slots
    let j = Math.floor(rng() * (slots - k));
    let s = 0;
    for (; s < slots; s++) if (!used[s] && j-- === 0) break;
    used[s] = 1;
  }
  let m = 0;
  for (let s = 0; s < slots; s++) if (used[s]) {
    const x = x0 + s * pitch + (rng() * 2 - 1) * jit;
    out[m++] = x < lo ? lo : x > hi ? hi : x;
  }
  return m;
}

/** a fork's rise speed u launched from screen y, capped so its apex (y - u^2 / .05) stays at or below KB.top */
export const riseCap = (u: number, y: number) => Math.min(u, Math.sqrt(.05 * Math.max(4, y - KB.top)));

/** frames for a lob launched at rise speed u (px/f, up) to come down through a point dy px below its start (the
 *  formula of enemies/update.ts lob(), with BS() folded out: the kind passes u / BS()) */
export const lobFrames = (u: number, dy: number) => (u + Math.sqrt(Math.max(0, u * u + .05 * dy))) / .025;
