// THE KEEPSAKE stage boss (D55): its pure rules from enemies/boss/_keepsake.ts and its placement from
// enemies/boss/registry.ts. The fight itself is measured by tools/boss-probe.mjs (TTK per kit) and tools/rng-probe.mjs.
// The fountain helpers moved here from the retired midboss's test (D53).
import { describe, expect, it } from 'vitest';
import { KB, TILT0, beamDir, beamSees, fountLattice, forkCols, inWindow, kbArena, keepHurtRot, lineAtX, lobFrames, maxFree, mobilePick, p1Floor, p2Floor, pendA, pendAt, pendXY, phaseClamp, phaseFloor, recallPick, riseCap, rotXY, tiltAt, tiltEdge } from '../../src/enemies/boss/_keepsake';
import { KEEPSAKE_SLOT, bossFor, capGrade } from '../../src/enemies/boss/registry';
import { ROSTER, midRow } from '../../src/enemies/mid/roster';

/** a seeded [0, 1) stream (mulberry32), counting its draws */
const stream = (s: number) => { const f = () => { f.n++; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.n = 0; return f; };
const E = { x: 360, y: 166 };
const deg = (d: number) => (d * Math.PI) / 180;

describe('keepHurtRot: the rotated ANGLE rule', () => {
  it('is exactly the midboss y-only rule at tilt 0: full at or above the crown line, x.15 below it, whatever the x', () => {
    for (const dx of [-60, -44, -20, 0, 20]) {
      expect(keepHurtRot(E.x, E.y, 0, E.x + dx, E.y - KB.crown)).toBe(1);
      expect(keepHurtRot(E.x, E.y, 0, E.x + dx, E.y - KB.crown + .01)).toBe(KB.face);
    }
  });

  it('opens the crown to a level shot from the ship when the head tilts toward it, and closes it when it tilts away', () => {
    const hx = E.x - 40, hy = E.y - 18; // a bolt meeting the head's left edge a little under the crown line
    expect(keepHurtRot(E.x, E.y, 0, hx, hy)).toBe(KB.face);
    expect(keepHurtRot(E.x, E.y, -KB.tilt, hx, hy)).toBe(1); //            toward (-32 deg): the window
    expect(keepHurtRot(E.x, E.y, KB.tilt, hx, E.y - 34)).toBe(KB.face); //   away: even higher on that side is face
  });

  it('agrees with the head frame: a point on the crown, turned with the head, is always a crown hit', () => {
    const v = [0, 0];
    for (const d of [-32, -16, 0, 16, 32]) {
      rotXY(KB.wx, KB.wy, deg(d), v);
      expect(keepHurtRot(E.x, E.y, deg(d), E.x + v[0], E.y + v[1]), `wound at ${d}`).toBe(1);
      rotXY(0, 10, deg(d), v);
      expect(keepHurtRot(E.x, E.y, deg(d), E.x + v[0], E.y + v[1]), `face at ${d}`).toBe(KB.face);
    }
  });

  it('treats area damage, which arrives at exactly (e.x, e.y), as a face hit at every tilt', () => {
    for (let d = -40; d <= 40; d += 4) expect(keepHurtRot(E.x, E.y, deg(d), E.x, E.y)).toBe(KB.face);
  });

  it('keeps the crown line in CRACKED (D59: dropping it made the last phase the easiest to hit)', () => {
    expect(KB.crown3).toBe(KB.crown);
    expect(keepHurtRot(E.x, E.y, 0, E.x - 40, E.y - 18, KB.crown3)).toBe(KB.face);
  });

  it('puts the wound hitbox above the crown line, and gives a bolt and the laser the same answer at every height', () => {
    expect(KB.wy + KB.wr).toBeLessThanOrEqual(-KB.crown);
    const hit = (x: number, y: number, cx: number, cy: number, r: number, sr: number) => (x - cx) ** 2 + (y - cy) ** 2 < (r + sr) ** 2;
    let full = 0;
    for (const [vx, sr] of [[6, 2], [9, 2.8], [7, 4]]) for (let dy = -70; dy <= 50; dy += .5) {
      const y = E.y + dy;
      let m: number | null = null;
      for (let x = E.x - 200; x < E.x + 60 && m == null; x += vx) {
        if (hit(x, y, E.x, E.y, KB.r, sr) || hit(x, y, E.x + KB.wx, E.y + KB.wy, KB.wr, sr) || hit(x, y, E.x, E.y + KB.cy, KB.cr, sr)) m = keepHurtRot(E.x, E.y, 0, x, y);
      }
      if (m == null) continue;
      const want = dy <= -KB.crown ? 1 : KB.face;
      expect(m, `bolt vx ${vx} at dy ${dy}`).toBe(want);
      expect(keepHurtRot(E.x, E.y, 0, E.x - KB.r * .5, y), `laser at dy ${dy}`).toBe(want);
      if (m === 1) full++;
    }
    expect(full).toBeGreaterThan(60);
  });
});

describe('phaseClamp: no damage carries past a phase cut', () => {
  it('passes a hit that stays above the floor unchanged', () => {
    expect(phaseClamp(200, 10, 1, 169)).toBe(1);
    expect(phaseClamp(200, 10, KB.face, 169)).toBe(KB.face);
  });
  it('cuts a hit that would cross the floor to land exactly on it', () => {
    const m = phaseClamp(175, 45, 1, 169);
    expect(175 - 45 * m).toBeCloseTo(169, 9);
  });
  it('lets nothing through once the floor is reached (a nuke included), and never goes negative', () => {
    expect(phaseClamp(169, 999, 1, 169)).toBe(0);
    expect(phaseClamp(168, 5, 1, 169)).toBe(0);
  });
  it('keeps a tink a tink and passes a zero hit (the slick) untouched', () => {
    expect(phaseClamp(200, 10, 0, 169)).toBe(0);
    expect(phaseClamp(200, 0, 1, 169)).toBe(1);
  });
});

describe('phaseFloor: the cuts', () => {
  it('cuts DOZING at 75%, AWAKE at 35% and CRACKED near zero (the dying beat, D59)', () => {
    expect(KB.cut1).toBe(.75);
    expect(KB.cut2).toBe(.35);
    expect(phaseFloor(260, 0)).toBeCloseTo(260 * .75, 9);
    expect(phaseFloor(260, 2)).toBeCloseTo(260 * KB.end, 9);
    expect(KB.end).toBeGreaterThan(0);
  });
  it('stages DOZING: until p1MinAtt attacks are out each takes only its share, then the floor is the cut (D59)', () => {
    expect(KB.p1MinAtt).toBe(3);
    expect(p1Floor(0)).toBeCloseTo(1 - (1 - KB.cut1) / KB.p1MinAtt, 9);
    expect(p1Floor(KB.p1MinAtt - 1)).toBeCloseTo(KB.cut1, 9);
    expect(phaseFloor(100, 0, 0, 0)).toBeGreaterThan(phaseFloor(100, 0, 0, 1));
    expect(phaseFloor(100, 0, 0, 9)).toBeCloseTo(100 * KB.cut1, 9);
  });
  it('stages AWAKE: each of the first p2MinWin windows takes only its share, then the floor is the cut', () => {
    expect(p2Floor(0)).toBeCloseTo(KB.cut1 - (KB.cut1 - KB.cut2) / KB.p2MinWin, 9);
    expect(p2Floor(KB.p2MinWin - 1)).toBeCloseTo(KB.cut2, 9);
    expect(p2Floor(9)).toBeCloseTo(KB.cut2, 9);
    for (let w = 1; w < 5; w++) expect(phaseFloor(100, 1, w)).toBeLessThanOrEqual(phaseFloor(100, 1, w - 1));
  });
});

describe('the AWAKE tilt', () => {
  it('starts upright (no snap) and rolls into a window first', () => {
    expect(tiltAt(TILT0)).toBeCloseTo(0, 9);
    let t = TILT0;
    while (!inWindow(t)) t++;
    expect(tiltAt(t)).toBe(-KB.tilt);
    expect(t - TILT0).toBeLessThanOrEqual(KB.roll);
  });
  it('rocks between toward and away on a 220 f cycle, never past +-32 deg, with no jump frame to frame', () => {
    const C = 2 * (KB.hold + KB.roll);
    expect(C).toBe(220);
    for (let t = 0; t < 2 * C; t++) {
      expect(Math.abs(tiltAt(t))).toBeLessThanOrEqual(KB.tilt + 1e-9);
      expect(Math.abs(tiltAt(t + 1) - tiltAt(t))).toBeLessThan(.05);
    }
    expect(KB.tilt).toBeCloseTo(deg(32), 3);
  });
  it('clacks at each extreme: once toward, once away, per cycle', () => {
    let n = 0;
    for (let t = 1; t <= 2 * (KB.hold + KB.roll); t++) if (tiltEdge(t)) n++;
    expect(n).toBe(2);
  });
  it('holds each window for KB.hold frames', () => {
    let n = 0;
    for (let t = 0; t < 2 * (KB.hold + KB.roll); t++) if (inWindow(t)) n++;
    expect(n).toBe(KB.hold);
  });
});

describe('the pendulum', () => {
  it('starts from rest and builds over pRamp, then swings at a constant 3 s period', () => {
    expect(pendAt(0)).toBe(0);
    expect(Math.abs(pendAt(KB.pRamp / 4))).toBeLessThan(KB.pAmp * .3);
    for (let t = 200; t < 400; t++) expect(pendAt(t + KB.pPer)).toBeCloseTo(pendAt(t), 9);
    expect(KB.pPer).toBe(180);
  });
  it('carries its phase, so slowing it (the crier broken, D59) never jumps the weight', () => {
    let ph = 0, last = 0;
    for (let t = 0; t < 900; t++) {
      ph += (Math.PI * 2) / (t < 400 ? KB.pPer : KB.pPer2);
      const a = pendA(t, ph);
      if (t > 0) expect(Math.abs(a - last)).toBeLessThan(.08);
      last = a;
    }
    expect(pendA(300, (300 / KB.pPer) * Math.PI * 2)).toBeCloseTo(pendAt(300), 12);
    expect(KB.pPer2).toBeGreaterThan(KB.pPer);
  });
  it('sweeps its weight up into the crown lane in front of the head at the swing toward the ship', () => {
    const v = [0, 0];
    pendXY(KB.pAmp, v);
    expect(v[0]).toBeLessThan(-KB.r); //            out in front of the face, on the ship's side
    expect(v[1]).toBeLessThanOrEqual(-KB.crown); // at crown height
    pendXY(0, v);
    expect(v[1]).toBeGreaterThan(0); //             hanging: in front of the lower face
  });
});

describe('mobilePick: a drop never takes the whole mobile', () => {
  const out = new Uint8Array(6);
  it('picks n distinct hanging forks and always leaves one, over 2000 drops', () => {
    const rng = stream(3);
    for (let k = 0; k < 2000; k++) {
      const alive = new Uint8Array(6).map(() => (rng() < .7 ? 1 : 0)), live = alive.reduce((a, b) => a + b, 0);
      const want = 1 + (k % 6), n = mobilePick(alive, 6, want, rng, out);
      expect(n).toBe(Math.max(0, Math.min(want, live - 1)));
      const seen = new Set<number>();
      for (let i = 0; i < n; i++) { expect(alive[out[i]]).toBe(1); seen.add(out[i]); }
      expect(seen.size).toBe(n);
    }
  });
  it('draws exactly one value per pick from the sim stream', () => {
    const rng = stream(9);
    mobilePick(new Uint8Array([1, 1, 1, 1, 1, 1]), 6, 3, rng, out);
    expect(rng.n).toBe(3);
  });
});

describe('kbArena: the arena override (layout invariant: gap >= 200 wherever bossFor places it)', () => {
  it('opens a gap of at least aGap and a ceiling no lower than aCeil, from any movement A column, in every biome', () => {
    const REST = { ice: [18, 224], acid: [16, 236], fire: [26, 230], snot: [34, 220] };
    const o = [0, 0];
    for (const [c0, f0] of Object.values(REST)) for (let ce = -10; ce <= 140; ce += 7) for (let fl = ce + 108; fl <= 254; fl += 9) {
      kbArena(c0, f0, ce, fl, o);
      expect(o[1] - o[0]).toBeGreaterThanOrEqual(KB.aGap);
      expect(o[0]).toBeLessThanOrEqual(KB.aCeil);
      expect(o[1]).toBeLessThanOrEqual(254);
    }
  });
  it('leaves a lane between the lowest hanging fork and the head resting on the floor', () => {
    const o = [0, 0];
    kbArena(34, 220, 60, 170, o); // the snot rest, the tightest
    const top = o[1] - KB.rest - KB.headTop, lowest = KB.mobY + KB.mobLen + 4 * KB.mobVar;
    expect(top - lowest).toBeGreaterThanOrEqual(20); // the ship (16 px tall) fits between the fork tips and the crown
    expect(KB.mobY).toBeGreaterThanOrEqual(KB.aCeil + 10); // the hoop hangs below the arena ceiling
  });
});

describe('IT WON\'T LET GO: the hoard, the recall\'s gap, the search beam (D59)', () => {
  it('keeps a lane of more than 170 px with forks planted top and bottom in the tightest arena', () => {
    expect(KB.aGap - 2 * KB.plOut).toBeGreaterThanOrEqual(170);
    expect(KB.plRage).toBeGreaterThanOrEqual(KB.plN);
  });
  it('reads a thread\'s height at the ship\'s x, and NaN where it does not cross', () => {
    expect(lineAtX(0, 200, 100, 100, 50)).toBeCloseTo(150, 9);
    expect(lineAtX(100, 100, 0, 200, 50)).toBeCloseTo(150, 9);
    expect(lineAtX(60, 200, 100, 100, 50)).toBeNaN();
  });
  it('measures the longest free run in a column', () => {
    const tmp = new Float32Array(8);
    expect(maxFree(new Float32Array([NaN]), 1, 0, 200, 7, tmp)).toBe(200);
    expect(maxFree(new Float32Array([100]), 1, 0, 200, 7, tmp)).toBe(93);
    expect(maxFree(new Float32Array([150, 50, 100]), 3, 0, 200, 7, tmp)).toBe(43);
  });
  it('never lets a recall close the ship\'s column: a free run of recGap always stays, over 3000 random hoards', () => {
    const rng = stream(5), n = KB.plRage, ys = new Float32Array(n), keep = new Uint8Array(n), cur = new Float32Array(n), tmp = new Float32Array(n), kept = new Float32Array(n);
    for (let k = 0; k < 3000; k++) {
      for (let i = 0; i < n; i++) ys[i] = rng() < .2 ? NaN : 16 + rng() * 210;
      const c = recallPick(ys, n, 16, 226, KB.recW, KB.recGap, keep, cur, tmp);
      let m = 0;
      for (let i = 0; i < n; i++) if (keep[i]) kept[m++] = ys[i];
      expect(m).toBe(c);
      expect(maxFree(kept, m, 16, 226, KB.recW, tmp)).toBeGreaterThanOrEqual(KB.recGap);
      for (let i = 0; i < n; i++) if (ys[i] !== ys[i]) expect(keep[i]).toBe(1); // a thread that misses the column is always free to fly
    }
  });
  it('points the beam out along the wire, and sees only inside its cone and reach', () => {
    const d = [0, 0];
    beamDir(0, 0, d); //                hanging: straight down
    expect(d[0]).toBeCloseTo(0, 9); expect(d[1]).toBeCloseTo(1, 9);
    beamDir(KB.pAmp, 0, d); //          swung toward the ship: out to the left and up
    expect(d[0]).toBeLessThan(-.9); expect(d[1]).toBeLessThan(0);
    expect(beamSees(300, 100, -1, 0, 100, 100)).toBe(true);
    expect(beamSees(300, 100, -1, 0, 100, 100 + 200 * Math.tan(KB.bHalf * 1.2))).toBe(false);
    expect(beamSees(300, 100, -1, 0, 300 - KB.bLen - 5, 100)).toBe(false);
    expect(beamSees(300, 100, -1, 0, 400, 100)).toBe(false); // behind it
  });
});

describe('bossFor: placement (Matt, decision 1)', () => {
  it('puts THE KEEPSAKE at the second biome stage in Descent 1, and alternates with the home boss after', () => {
    expect(KEEPSAKE_SLOT).toBe(1);
    expect(bossFor(1, 0, true)).toBe('keepsake');
    expect(bossFor(1, 1, true)).toBe(null);
    expect(bossFor(1, 2, true)).toBe('keepsake');
    expect(bossFor(1, 3, true)).toBe(null);
  });
  it('never touches the first biome stage, and never the short layout (parity)', () => {
    for (let loop = 0; loop < 6; loop++) {
      expect(bossFor(0, loop, true)).toBe(null);
      expect(bossFor(1, loop, false)).toBe(null);
      expect(bossFor(0, loop, false)).toBe(null);
    }
  });
});

describe('the enrage grade cap', () => {
  it('caps S and A at B and leaves B, C and an uncapped stage alone', () => {
    expect(capGrade('S', 'B')).toBe('B');
    expect(capGrade('A', 'B')).toBe('B');
    expect(capGrade('B', 'B')).toBe('B');
    expect(capGrade('C', 'B')).toBe('C');
    expect(capGrade('S', undefined)).toBe('S');
    expect(KB.rageGrade).toBe('B');
    expect(KB.rage).toBeGreaterThanOrEqual(.75); // one capped enrage: cooldowns x.75 at most
  });
});

describe('the telegraphs (.claude/rules/ai-code.md: >= 44 f for a killing attack)', () => {
  it('gives every killing attack a tell of at least 44 frames', () => {
    // D59: the recall's and the tug's threads, the search beam's marked column, the cries that shake the planted forks
    for (const [k, f] of Object.entries({ tell: KB.tell, aim: KB.aim, boom: KB.boomTel, wail: KB.wail, drop: KB.drop, rain: KB.rain, mama: KB.mama, recall: KB.recall, tug: KB.tug, beam: KB.bTel })) expect(f, k).toBeGreaterThanOrEqual(44);
    expect(KB.recLock).toBeLessThan(KB.recall); // the threads are seen dashed before they lock
    expect(KB.pRamp).toBeGreaterThanOrEqual(44); // the pendulum's first swing builds from rest
  });
});

describe('the retired midboss (D55)', () => {
  it('has no roster row, and the roster has no wip kind left to force', () => {
    expect(midRow('keepsake')).toBe(undefined);
    expect(ROSTER.filter((r) => r.wip)).toEqual([]);
  });
});

describe('fountLattice: one column on the ship', () => {
  const lat = new Float32Array(3);
  it('stretches the lattice left to a ship in the firing lane, its first column on the ship', () => {
    fountLattice(90, 388, 6, 46, -150, lat);
    expect(lat[0]).toBe(90);
    expect(lat[2]).toBe(0);
    expect(lat[0] + 5 * lat[1]).toBeCloseTo(388 - 150 + 5 * 46);
  });
  it('slides the lattice left by under a pitch so a column lands on a ship inside it', () => {
    for (let px = 239; px <= 388 - 150 + 5 * 46; px += 7) {
      fountLattice(px, 388, 6, 46, -150, lat);
      expect(lat[1]).toBe(46);
      expect(lat[0] + lat[2] * lat[1]).toBeCloseTo(px);
    }
  });
});

describe('forkCols: the fountain always leaves a gap', () => {
  const out = new Float32Array(8), used = new Uint8Array(8);
  it('never fills every column, keeps forks a column apart and always takes the ship\'s column', () => {
    for (const [slots, pitch, n, must] of [[KB.slots, KB.pitch, 5, 0], [KB.slots3, KB.pitch3, 5, 3], [KB.slots, KB.pitch, 9, -1]]) {
      const rng = stream(slots * 31 + n);
      for (let k = 0; k < 2000; k++) {
        const m = forkCols(n, slots, pitch, 100, KB.jit, 0, 1e4, rng, out, used, must);
        expect(m).toBe(Math.min(n, slots - 1));
        if (must >= 0) expect(used[must]).toBe(1);
        for (let i = 1; i < m; i++) expect(out[i] - out[i - 1]).toBeGreaterThanOrEqual(pitch - 2 * KB.jit);
      }
    }
  });
  it('draws exactly 2n values from the sim stream, 2n - 1 with a forced column', () => {
    for (const [must, want] of [[-1, 8], [2, 7]]) {
      const rng = stream(5);
      forkCols(4, KB.slots, KB.pitch, 0, KB.jit, 0, 1e4, rng, out, used, must);
      expect(rng.n).toBe(want);
    }
  });
});

describe('lobFrames and riseCap', () => {
  it('matches lob(): a glob launched at rise u under .025 gravity passes dy below its start at that frame', () => {
    for (const [u, dy] of [[1.55, 10], [1.9, 10], [1.7, -20]]) {
      const t = lobFrames(u, dy);
      expect(-u * t + .0125 * t * t).toBeCloseTo(dy, 6);
    }
  });
  it('caps the rise so the apex never goes above KB.top, from any launch height', () => {
    for (let y = 20; y <= 250; y += 10) expect(y - riseCap(KB.u1, y) ** 2 / .05).toBeGreaterThanOrEqual(KB.top - 1e-9);
  });
});
