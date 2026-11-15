// A dinner fork, the one silhouette THE KEEPSAKE throws (enemies/boss/keepsake.ts): a shaft and four tines in pale
// steel with a near-black outline so it reads on any biome and at phone size. Drawn by render/hud.ts drawEShots for a
// fork eshot (`s.fk`) and by the kind's art for the phase-2 boomerang. Render-only: no RNG, no allocation.

/** a fork at (x, y) pointing along angle a (tines first), s = scale (1 = a 15 px eshot fork) */
export function drawFork(c: CanvasRenderingContext2D, x: number, y: number, a: number, s = 1): void {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  c.scale(s, s);
  // tines at +x (the travelling end), the handle trailing at -x
  c.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    c.strokeStyle = pass ? '#d9dee3' : '#060708';
    c.lineWidth = pass ? 1.3 : 3;
    c.beginPath();
    c.moveTo(-9, 0); c.lineTo(1, 0); //         the handle and neck
    c.moveTo(1, -2.4); c.lineTo(1, 2.4); //     the bridge
    for (let i = 0; i < 4; i++) { const ty = -2.4 + i * 1.6; c.moveTo(1, ty); c.lineTo(6, ty); } // the tines
    c.stroke();
  }
  c.fillStyle = '#f4f8fb'; // a glint on the handle's end: steel, not bone
  c.fillRect(-9, -.6, 2, 1.2);
  c.restore();
}
