// THE KEEPSAKE's pure side: its tuning table, its ANGLE damage rule and its fork-fountain layout, with no imports so
// tests/unit/keepsake.test.ts drives them without mocks and the art (render/gross/mid/keepsake.ts) can read the same
// geometry. The leading underscore keeps this file out of both registry globs: it is a helper, not a kind.
// Design: Matt, 2026-11-15 (pass-1 greybox; a crew kid's vinyl doll head with a dinner fork in the soft spot; D53).

/** every gameplay value of the fight, in frames and kind-local px from (e.x, e.y). Probe: tools/midboss-probe.mjs */
export const KEEP = {
  r: 22, //        the head: the body hitbox and the greybox radius (the fit below is measured off it)
  // ---- the wound: the soft spot on top of the skull, where the fork went in
  wx: 2, //        its x, a touch behind the crown's centre (a doll's fontanelle sits back of the brow)
  wy: -24, //      its y: the top of the skull. e.hb's centre, the probe bot's aim (e.wy) and the forks' launch
  wr: 8, //        its own hitbox (e.hb) so a shot skimming the crown connects instead of passing over the head
  crown: 13, //    the crown line: any hit landing at or above e.y - crown is on the wound (full damage). y only: above
  //               the line the head's circle is all crown cap (|dx| <= 17.7 px), and a bolt meets the circle there at
  //               hx ~ e.x - 17 while the laser reports e.x - 11, so an x span would scale one and not the other
  face: .15, //    everywhere else, and every area hit: the vinyl face takes x.15 (ANGLE, spec §6.2; hurt()'s dim-flash
  //               path). Its sound is a dull rubbery thud, the wound's a wet squelch (keepsake.ts keepHitSnd, MidSim.hitSnd)
  // ---- the fork fountain (SPACE-style lobs you dodge to stay on top)
  tell: 48, //     brain bulge, eyes open, handles rising: >= 44 f (ai-code.md), the landing marks show from frame 1
  stagger: 4, //   frames between forks leaving the wound
  slots: 6, //     phase 1: the fountain's lattice of columns...
  pitch: 46, //    ...at least this far apart: any two forks land >= pitch - 2 jit apart, and >= 1 slot stays empty.
  //               The lattice is anchored on the ship (fountLattice): one column always comes down on its x at the
  //               tell's first frame, so the firing lane level with the crown is contested, not only the air over the head
  slots2: 7, //    phase 2: denser lattice; 5 forks of 7 leave 2 empty columns
  pitch2: 40,
  x0: -150, //     the lattice's default left end; it stretches left to the ship when the ship is further out
  jit: 5, //       per-fork jitter, px
  u0: 1.55, //     launch rise speed (px/f, BS-independent so the arc and its marks never grow off-screen with depth)
  u1: 1.9, //      apex = u^2 / .05: 48-72 px above the wound
  top: 16, //      the apex never passes this screen y (an eshot above -12 is culled before it lands)
  land: 6, //      the landing plane the marks sit on: this far below the wound (the crown), screen y fixed at the tell
  // ---- the window, then the aimed throw (LINE-style)
  open: 60, //     after the last fork lands: the wound gapes and nothing fires (phase 2: open2). It is always full
  open2: 45, //    damage from above; this is just the safe beat to dive in
  aim: 46, //      the throw's line: tracks you for aim - lock frames...
  lock: 16, //     ...then holds still this long before the fork flies along it
  throwSp: 2.6, // the thrown fork's speed (x BS(), like every aimed shot)
  // ---- phase 2 (midPh2): the big fork as a boomerang, and the wail ring
  boomTel: 54, //  the boomerang's line: tracks you for boomTel - boomLock frames, then locks
  boomLock: 20,
  boomSp: 3.4, //  px/f out to the far end and back along the same line (not BS-scaled: its line is the whole read)
  boomR: 6, //     its hit radius (plus the ship's 2.6)
  boomEnd: 22, //  the far end: this screen x, or the screen edge along the line
  wail: 44, //     the wail ring's tell (the seam opens, the head shudders): >= 44 f, spec §9
  wailN: 10, //    a slow ring: 10 orbs at .7 (the Womb's swell ring is 10-14 at 1.05)
  wailSp: .7,
  // ---- pacing
  cool: 60, //     idle between attacks (phase 2: cool2), x (1 - .3 rank) x cdm() like every midboss
  cool2: 40,
} as const;

/** THE KEEPSAKE's damage share for a hit at (_hx, hy) (MidSim.hurt, spec §6.2 ANGLE): full on the crown cap round
 *  the wound (at or above the crown line), x.15 anywhere else. y only, see KEEP.crown. Area damage arrives at exactly
 *  (e.x, e.y), below the crown, so it is a face hit: no precedent says otherwise, and a blast or burn that ignored the
 *  angle would make the ANGLE rule optional. Pure */
export function keepHurt(e: { x: number; y: number }, _hx: number, hy: number): number {
  return hy <= e.y - KEEP.crown ? 1 : KEEP.face;
}

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

/** a fork's rise speed u launched from screen y, capped so its apex (y - u^2 / .05) stays at or below KEEP.top */
export const riseCap = (u: number, y: number) => Math.min(u, Math.sqrt(.05 * Math.max(4, y - KEEP.top)));

/** frames for a lob launched at rise speed u (px/f, up) to come down through a point dy px below its start (the
 *  formula of enemies/update.ts lob(), with BS() folded out: the kind passes u / BS()) */
export const lobFrames = (u: number, dy: number) => (u + Math.sqrt(Math.max(0, u * u + .05 * dy))) / .025;
