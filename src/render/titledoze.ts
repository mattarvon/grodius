// THE KEEPSAKE on the title (Matt 2026-11-20): its sleep eyes, as a pure function of the frame counter, like titlegaze.ts
// for ROT. No state: the title rig and a resume land on any $.T and must see the same head. Leaf module: no imports,
// unit-testable (tests/unit/titledoze.test.ts).
// Motion is the D39 motion rule: stillness, then a hitch. It dozes half-lidded (never open at rest: open is the tell);
// now and then the lids droop shut with a clack and the head dips a px, holds, and they come back to half; some epochs
// flutter instead. On DESCEND (titleOutPose) the eyes snap open and the fork works up out of the wound in three jerks
// over the run's first frames, then the title fades off it: the run is never held up (render/titledoll.ts).

export const HALF = 0, SHUT = 1, OPEN = 2;

export const TD = {
  // Epoch starts are k * period + a hash in 0..jitter, O(1) from t: gaps of 300..1080 frames (5-18 s) between droops
  period: 690, jitter: 390,
  shut: [45, 110],     // a droop holds shut this many frames, then the lids come back to half
  flutter: .3,         // the share of epochs that flutter (shut 6, half 8, shut 6) instead of drooping
  dip: 4,              // frames the head dips 1 px when the lids clack shut (and lifts 1 px when they open)
} as const;

/** DESCEND: frames from the press. The eyes are open from frame 0; the fork rises a step at each riseAt (0 -> 3 -> 6 ->
 *  9 boss px, the baked wound_<rise> layers); the title holds to `hold`, then fades out by `end` */
export const TOUT = { riseAt: [3, 6, 9], hold: 14, end: 30 } as const;

const hash = (k: number, s: number) => { const v = Math.sin(k * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const startOf = (k: number) => k * TD.period + Math.floor(hash(k, 1) * (TD.jitter + 1));

export interface DozePose { eye: number; jy: number }

/** the idle doze at frame t: eye HALF or SHUT, and jy, the head's dip in title px (0 or 1, -1 on a lift) */
export function titleDoze(t: number, out: DozePose): DozePose {
  let k = Math.floor(t / TD.period);
  if (startOf(k) > t) k--;
  const f = t - startOf(k);
  out.eye = HALF; out.jy = 0;
  if (hash(k, 2) < TD.flutter) {
    if (f < 6 || (f >= 14 && f < 20)) out.eye = SHUT;
    if (f < 2 || (f >= 14 && f < 16)) out.jy = 1;
    return out;
  }
  const dur = TD.shut[0] + Math.floor(hash(k, 3) * (TD.shut[1] - TD.shut[0] + 1));
  if (f < dur) {
    out.eye = SHUT;
    if (f < TD.dip) out.jy = 1;
  } else if (f < dur + TD.dip) out.jy = -1;
  return out;
}

export interface OutPose { rise: number; a: number }

/** DESCEND's beat at f frames from the press: the fork's rise step (0..3, the index into the baked rises) and the title's
 *  alpha over the run (1 while it holds, fading to 0 by TOUT.end) */
export function titleOutPose(f: number, out: OutPose): OutPose {
  let r = 0;
  for (const at of TOUT.riseAt) if (f >= at) r++;
  out.rise = r;
  out.a = f < TOUT.hold ? 1 : Math.max(0, 1 - (f - TOUT.hold) / (TOUT.end - TOUT.hold));
  return out;
}
