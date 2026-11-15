// The title eye's gaze and membrane, as a pure function of the frame counter. No state: the title rig (and a resume) can
// land on any $.T and must see the same eye, so nothing here may accumulate. Leaf module: no imports, unit-testable.
// Motion is the D39 motion rule: stillness, then a hitch. Offsets are in ball radii. Pinned by tests/unit/titlegaze.test.ts.

export interface TitleGaze {
  /** lens offset from the ball's centre, in ball radii */
  x: number; y: number;
  /** the same offset as polar, for eye() */
  ang: number; m: number;
  /** membrane coverage 0..MEMBRANE_MAX */
  bl: number;
  /** jiggle, 0..1: fires on a hitch or saccade only */
  jig: number;
  /** 0 hold, 1 hitch to a new hold, 2 a dart burst */
  phase: number;
}

export const TG = {
  restX: -.16, restY: .14, // menu direction horizontally, the concept's sag vertically
  wander: .24,             // a hold stays this close to rest
  maxR: .36,               // lens radius is about .45, so this keeps it and its ring on the ball
  creep: .018,             // a hold is not dead still: total slide across it
  hitch: 6,                // frames for any jump
  // Epoch starts are k * period + a hash in 0..jitter, O(1) from t. Gaps are period +- jitter = 324..900 frames, so a
  // hold (gap, less its hitch and any burst of at most 75) is always 240..894
  period: 612, jitter: 288,
  burstChance: .5,         // about one epoch in two ends in darts
  dartDwell: [8, 19],      // frames between saccades (with the 6-frame hitch, a burst is at most 75)
  dartDist: [.1, .2],      // how far a dart leaves the hold target
  jigFrames: 20,           // art-director: decays in about 20
  jigHold: .6,             // a change of hold is a smaller lurch than a dart
  // Membrane windows: same trick, gaps 480..1200 frames (8-20 s)
  memPeriod: 840, memJitter: 360,
  memIn: 40, memStay: 12, memOut: 40,
  memMax: .6,
} as const;

const TAU = Math.PI * 2;
const hash = (k: number, s: number) => { const v = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const startOf = (k: number) => k * TG.period + Math.floor(hash(k, 1) * (TG.jitter + 1));
const dwellOf = (k: number, i: number) => TG.dartDwell[0] + Math.floor(hash(k, 10 + i) * (TG.dartDwell[1] - TG.dartDwell[0] + 1));
const dartsOf = (k: number) => (hash(k, 4) < TG.burstChance ? (hash(k, 5) < .4 ? 3 : 2) : 0);

// two scalars out of helpers without allocating a pair per frame
let px = 0, py = 0;
function holdAt(k: number, s: number) { // s 0..1 through the hold
  const a = hash(k, 2) * TAU, d = (TG.wander - TG.creep) * Math.sqrt(hash(k, 3)), c = hash(k, 6) * TAU;
  px = TG.restX + Math.cos(a) * d + Math.cos(c) * TG.creep * (s - .5);
  py = TG.restY + Math.sin(a) * d + Math.sin(c) * TG.creep * (s - .5);
  // wander less creep above keeps this inside the wander radius; pulling back to maxR only moves it nearer rest
  clampMax();
}
function dartAt(k: number, i: number) {
  holdAt(k, 1);
  const a = hash(k, 20 + i) * TAU, d = TG.dartDist[0] + (TG.dartDist[1] - TG.dartDist[0]) * hash(k, 30 + i);
  px += Math.cos(a) * d; py += Math.sin(a) * d;
  clampMax();
}
function clampMax() {
  const d = Math.hypot(px, py);
  if (d > TG.maxR) { px *= TG.maxR / d; py *= TG.maxR / d; }
}
function endOf(k: number) { const n = dartsOf(k); if (n) dartAt(k, n - 1); else holdAt(k, 1); }
const ease = (f: number) => { const u = 1 - f; return 1 - u * u * u; };
const jigOf = (amp: number, since: number) => { const u = 1 - since / TG.jigFrames; return u > 0 ? amp * u * u : 0; };

function membrane(t: number) {
  let k = Math.floor(t / TG.memPeriod), s = k * TG.memPeriod + Math.floor(hash(k, 7) * (TG.memJitter + 1));
  if (t < s) { k--; s = k * TG.memPeriod + Math.floor(hash(k, 7) * (TG.memJitter + 1)); }
  const tt = t - s;
  const smooth = (f: number) => f * f * (3 - 2 * f);
  if (tt < TG.memIn) return TG.memMax * smooth(tt / TG.memIn);
  if (tt < TG.memIn + TG.memStay) return TG.memMax;
  if (tt < TG.memIn + TG.memStay + TG.memOut) return TG.memMax * smooth(1 - (tt - TG.memIn - TG.memStay) / TG.memOut);
  return 0;
}

/** the gaze at frame t: same t, same answer, whatever came before. Pass out to avoid the allocation per call */
export function titleGaze(t: number, out: TitleGaze = { x: 0, y: 0, ang: 0, m: 0, bl: 0, jig: 0, phase: 0 }): TitleGaze {
  let k = Math.floor(t / TG.period);
  if (t < startOf(k)) k--;
  const s0 = startOf(k), gap = startOf(k + 1) - s0, tt = t - s0, n = dartsOf(k);
  let burst = 0;
  for (let i = 0; i < n; i++) burst += TG.hitch + dwellOf(k, i);
  const burstAt = gap - burst;
  let x, y, phase, jig;
  if (tt < TG.hitch) {
    endOf(k - 1);
    const fx = px, fy = py, f = ease((tt + 1) / TG.hitch);
    holdAt(k, 0);
    x = fx + (px - fx) * f; y = fy + (py - fy) * f;
    phase = 1; jig = jigOf(TG.jigHold, tt);
  } else if (tt < burstAt) {
    holdAt(k, (tt - TG.hitch) / Math.max(1, burstAt - TG.hitch));
    x = px; y = py;
    phase = 0; jig = jigOf(TG.jigHold, tt);
  } else {
    let i = 0, st = tt - burstAt, len = TG.hitch + dwellOf(k, 0);
    while (st >= len) { st -= len; i++; len = TG.hitch + dwellOf(k, i); }
    if (i) dartAt(k, i - 1); else holdAt(k, 1);
    const fx = px, fy = py, f = st < TG.hitch ? ease((st + 1) / TG.hitch) : 1;
    dartAt(k, i);
    x = fx + (px - fx) * f; y = fy + (py - fy) * f;
    phase = 2; jig = jigOf(1, st);
  }
  out.x = x; out.y = y;
  out.ang = Math.atan2(y, x); out.m = Math.hypot(x, y);
  out.bl = membrane(t);
  out.jig = jig;
  out.phase = phase;
  return out;
}
