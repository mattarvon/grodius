// THE BURNING BUTCHER's second-half hook (D61, Matt 2026-11-20, difficulty Pass 1). Pure numbers and geometry so the sim
// (enemies/update.ts 'butcher'), the render (render/enemies.ts) and the tests agree. Below half HP the hook reaches the
// whole screen; when it bites terrain or the left edge it STAYS planted as a taut chain for KH.plant frames (a solid
// hazard from the boss to the tip), then is reeled home fast along the same line (THE KEEPSAKE's thread-and-tug, D59).
// Fairness (D59): the tell is >= 44 f and its aim line locks for the last KH.lock frames; the chain is one line, so the
// corridor always has a free side; nothing about shooting the boss changes it. The first half keeps the 230 px hook.
export const KH = {
  reach1: 230, //  first half: unchanged reach
  reach2: 520, //  second half: past any lane (the screen is 480 wide)
  out1: 7, //      first half: px/f out
  out2: 8, //      second half: px/f out
  back1: 5, //     first half: px/f home
  back2: 12, //    second half: the reel, ~2x the old pace
  tell1: 40, //    first half's hook tell (frames)
  tell2: 48, //    second half's hook tell: >= 44 f (D59), its aim line locks for the last `lock`
  lock: 16,
  plant: 90, //    the planted chain's hold (D61: ~90 f)
  warn: 22, //     its last frames shudder (the reel's tell)
  pierce: 22, //   the ship this close to the ray beyond a rock: the hook tears through to it
  tipR: 8, //      the hook head's hit radius
  chainR: 4.6, //  the taut chain's half-width + the ship's (2 + 2.6)
};

/** squared-free distance from point (px,py) to segment (ax,ay)-(bx,by) */
export function segDist(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** does the hook's chain (anchor to tip) or its head touch a ship at (px,py)? A planted or reeling chain is solid
 *  along its whole length; the outgoing hook of the first half is the head only (as it always was) */
export function hookHits(ax: number, ay: number, tx: number, ty: number, px: number, py: number, solid: boolean): boolean {
  if (Math.hypot(px - tx, py - ty) < KH.tipR) return true;
  return solid && segDist(ax, ay, tx, ty, px, py) < KH.chainR;
}

/** the second half's hook bites terrain unless the ship is further down its line (within KH.pierce px of the ray, ahead of
 *  the tip): then it tears on through the rock, so a pocket behind a pillar is no park (D61). (tx,ty) the tip, (ca,sa) its direction */
export function hookBehind(tx: number, ty: number, ca: number, sa: number, alive: boolean, px: number, py: number): boolean {
  if (!alive) return false;
  const along = (px - tx) * ca + (py - ty) * sa;
  return along > 0 && Math.abs((px - tx) * sa - (py - ty) * ca) < KH.pierce;
}
