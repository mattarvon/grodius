import { describe, it, expect, beforeEach } from 'vitest';
// @ts-ignore: plain .mjs tool module, no types
import { PILOT } from '../../tools/pilot.mjs';
import * as DN from '../../src/enemies/mid/_deny';
import * as KS from '../../src/enemies/boss/_keepsake';

// tools/pilot.mjs (W6 tune-tp): the dodging pilot reads the new attacks from the sims' own geometry. Each case runs the
// page code against a stub window and a few lines of the attack's own rules (restated from the sim file named), closed
// loop: the pilot steers every frame and the attack follows its rules, and the ship must never be touched.

type V = { x: number; y: number };
const W = 480, PH = 254, TAU = Math.PI * 2;
let win: any;
const step = (g: any, tx = 90, ty = 127) => win.__pilotStep(g, tx, ty);
beforeEach(() => {
  win = (globalThis as any).window = {};
  win.__W = { eshots: [], floorAt: () => 236, ceilAt: () => 18 };
  win.__DN = DN; win.__KS = KS;
  win.__pilotLoad = undefined;
  (0, eval)(PILOT);
  win.__pilotLoad = () => Promise.resolve(); // the stub window serves the modules: no dynamic import in Node
});
const game = (P: V & Record<string, any>, enemies: any[], G: any = {}) => ({ P, G: { scroll: 0, scrollSpeed: 0, loop: 0, stage: 1, t: 0, ...G }, enemies });

describe('pilot: the Apprentice cleaver (enemies/mid/prentice.ts)', () => {
  it('a ship in front of the lunge is out of the 12 f sweep when it cuts, from any start (naked THRUST too)', () => {
    for (const [x0, y0, ey, sp] of [[120, 60, 110, 2], [120, 127, 110, 2], [120, 200, 110, 2], [60, 40, 60, 2], [200, 225, 180, 2], [160, 127, 127, 0], [90, 100, 90, 0], [240, 127, 130, 1]]) {
      const P = { x: x0, y: y0, speed: sp, alive: true, inv: 0 };
      const e: any = { k: 'prentice', x: 330, y: ey, r: 15, hp: 100, max: 150, st: 'tel', wt: 0, tx: 330, t: 400 };
      const g = game(P, [e], { mini: e });
      let hit = false;
      for (let f = 0; f < 90 && !hit; f++) {
        step(g, Math.min(140, e.x - 60), e.y);
        // prentice.ts updPrentice: midLeave's x lerp, the tell's y track, wt++, the tell's tx, the cut's sweep
        e.x += (e.tx - e.x) * (e.st === 'tel' ? .06 : .03);
        if (e.st === 'tel' && e.wt < 25) e.y += (Math.max(50, Math.min(PH - 40, P.y + 6)) - e.y) * .06;
        e.wt++;
        if (e.st === 'tel') { e.tx = Math.max(130, Math.min(W - 70, P.x + 64)); if (e.wt >= 50) { e.st = 'cut'; e.wt = 0; } }
        else if (e.st === 'cut') {
          const p = Math.min(1, e.wt / 12), sx = e.x - 8, sy = e.y - 6, d = Math.hypot(P.x - sx, P.y - sy);
          let pa = Math.atan2(P.y - sy, P.x - sx), cur = -2.3 - p * (TAU - 4.6); if (pa < 0) pa += TAU; if (cur < 0) cur += TAU;
          if (e.wt <= 12 && d > 14 && d < 84 && pa <= 3.99 && pa >= cur) hit = true;
          if (e.wt >= 30) e.st = 'idle';
        }
      }
      expect(hit, 'cleaved from ' + x0 + ',' + y0 + ' THRUST ' + sp).toBe(false);
      expect(win.__pilotLog.seen.cleaver).toBeGreaterThan(0);
    }
  });
});

describe('pilot: the Apprentice hook (_deny.ts hookHit)', () => {
  it('the thrown tip and the bitten, sagging wire (phase 2) never touch the ship', () => {
    const D = DN.DN, P = { x: 120, y: 127, speed: 2, alive: true, inv: 0 };
    const e: any = { k: 'prentice', x: 380, y: 110, r: 15, hp: 60, max: 150, st: 'htel', wt: 0, ha: Math.PI, hd: 0, sag: 0, st2: '', t: 400, tx: 380 };
    const g = game(P, [e], { mini: e });
    let hit = false;
    for (let f = 0; f < 220 && !hit && e.st !== 'idle'; f++) {
      step(g, 90, e.y);
      const ox = e.x + D.hOx, oy = e.y + D.hOy; e.wt++;
      // prentice.ts hook(): track then lock, throw at hSp, bite (hBite2 in phase 2, the wire sagging), reel at hIn
      if (e.st === 'htel') { if (e.wt <= D.hTel - D.hLock) { const a = Math.atan2(P.y - oy, P.x - ox); e.ha += Math.atan2(Math.sin(a - e.ha), Math.cos(a - e.ha)) * D.hTrack; } if (e.wt >= D.hTel) { e.st = 'hook'; e.wt = 0; e.hd = 10; } }
      else if (e.st === 'hook') { e.hd += D.hSp; const tx = ox + Math.cos(e.ha) * e.hd, ty = oy + Math.sin(e.ha) * e.hd; if (ty >= 236 || ty <= 18 || tx <= 2 || e.hd >= D.hMax) { e.st = 'bite'; e.wt = 0; } }
      else if (e.st === 'bite') { if (e.wt >= D.hBite2) { e.st = 'reel'; e.wt = 0; } }
      else if (e.st === 'reel') { e.hd -= D.hIn; if (e.hd <= 12) { e.hd = 0; e.st = 'idle'; } }
      if (e.st === 'bite' || e.st === 'reel') { const tx = ox + Math.cos(e.ha) * e.hd, ty = oy + Math.sin(e.ha) * e.hd; e.sag = DN.hookSag(oy, ty, 236); } else e.sag = 0;
      if (DN.hookHit(e, P.x, P.y)) hit = true;
    }
    expect(hit).toBe(false);
    expect(win.__pilotLog.seen['hook:wire']).toBeGreaterThan(0);
  });
});

describe('pilot: THE KEEPSAKE boomerang (_keepsake.ts capsuleHit)', () => {
  it('reads the locked line from the tell and is never touched out or back', () => {
    const KB = KS.KB, P = { x: 100, y: 120, speed: 2, alive: true, inv: 0 };
    const m: any = { k: 'keepsake', x: 360, y: 150, r: 44, hp: 300, max: 440, ph: 1, st: 'boom', wt: 0, th: 0, la: Math.PI, lx: 0, ly: 0, bx: 0, by: 0, bs: 0, bl: 0, bd: 1, bsa: 0, pn: 0, fh: 0, ma: null, my: -99, t: 600 };
    const g = game(P, [], { mini: m });
    let hit = false;
    for (let f = 0; f < 260 && !hit && m.st !== 'idle'; f++) {
      step(g, 90, m.y - 52);
      m.wt++;
      // keepsake.ts 'boom' / 'fly': the line tracks the ship, locks for boomLock, then out at boomSp and back
      if (m.st === 'boom') { const wx = m.x + KB.wx, wy = m.y + KB.wy; if (m.wt < KB.boomTel - KB.boomLock) { const a = Math.atan2(P.y - wy, P.x - wx); m.la += Math.atan2(Math.sin(a - m.la), Math.cos(a - m.la)) * .1; m.lx = wx; m.ly = wy; }
        if (m.wt >= KB.boomTel) { const dx = Math.cos(m.la), dy = Math.sin(m.la); let L = dx < -.05 ? (m.lx - KB.boomEnd) / -dx : 400; if (dy < -.05) L = Math.min(L, (m.ly - 6) / -dy); if (dy > .05) L = Math.min(L, (PH - 6 - m.ly) / dy);
          m.bl = Math.max(40, L); m.bs = 0; m.bd = 1; m.bsa = m.la; m.bx = m.lx; m.by = m.ly; m.st = 'fly'; m.wt = 0; } }
      else if (m.st === 'fly') { m.bs += m.bd * KB.boomSp; if (m.bs >= m.bl) { m.bs = m.bl; m.bd = -1; } m.bx = m.lx + Math.cos(m.la) * m.bs; m.by = m.ly + Math.sin(m.la) * m.bs; m.bsa += KB.boomSpin;
        if (KS.capsuleHit(m.bx, m.by, m.bsa, KB.boomHalf, KB.boomR + 2.6, P.x, P.y)) hit = true; if (m.bd < 0 && m.bs <= 0) m.st = 'idle'; }
    }
    expect(hit).toBe(false);
    expect(win.__pilotLog.seen['keep:boom']).toBeGreaterThan(0);
  });
});

describe('pilot: W3a pistons (solids.ts), read on their cycle', () => {
  it('a floor piston about to extend under the ship is left before its tip arrives', () => {
    const P = { x: 120, y: 200, speed: 1, alive: true, inv: 0 };
    // rest 60 (its tell the last 50), then extends .5 px/f from the floor (root 238) to a reach of 120
    const s: any = { k: 'piston', st: 'tell', cls: 1, x: 100, w: 40, side: 1, root: 238, reach: 120, rest: 60, ext: 236, hold: 90, v: .5, age: 40, phase: 0, skipN: -1, y: 238, h: 115 };
    win.__SO = { SC: { HARD: 1, LODGE: 2, PLUG: 4, BODY: 8, TERRAIN: 7, FIT: 3 }, solids: [s] };
    const g = game(P, []);
    let hit = false;
    for (let f = 0; f < 300 && !hit; f++) {
      step(g, 120, 200); // the target sits over the piston: the pull says stay, the piston says go
      s.age++; const C = s.rest + 2 * s.ext + s.hold, u = (s.age + s.phase) % C;
      s.y = u < s.rest ? s.root : u < s.rest + s.ext ? s.root - (u - s.rest) * .5 : s.reach;
      for (const [ox, oy] of [[12, 0], [-9, -4], [-9, 4], [0, -4], [0, 4]]) { const wx = P.x + ox; if (wx >= s.x && wx <= s.x + s.w && P.y + oy >= s.y) hit = true; }
    }
    expect(hit).toBe(false);
    expect(win.__pilotLog.seen.piston).toBeGreaterThan(0);
  });
});

describe('pilot: a model that throws is switched off for the frame, never the pilot', () => {
  it('logs the model by name and still steers', () => {
    win.__DN = { ...DN, denyPts: () => { throw new Error('boom'); } };
    const P = { x: 100, y: 120, speed: 0, alive: true, inv: 0 }, e: any = { k: 'cyst', x: 300, y: 120, r: 12, hp: 10, max: 20 };
    win.__W.eshots = [{ x: 108, y: 120, vx: -2, vy: 0, r: 2, k: 'orb' }];
    step(game(P, [e], { mini: e }), 100, 120);
    expect(win.__pilotLog.err.deny).toMatch(/boom/);
    expect(P.x !== 100 || P.y !== 120).toBe(true); // it moved off the shot's line
  });
});

describe('pilot: the reaction time (window.__pilotReact, PILOT_TUNE.react)', () => {
  it('a shot younger than the reaction time is unseen; once that old it is dodged', () => {
    win.__pilotReact = 12;
    const P = { x: 100, y: 120, speed: 0, alive: true, inv: 0 }, s = { x: 112, y: 120, vx: -2, vy: 0, r: 2, k: 'orb', t: 3 };
    win.__W.eshots = [s];
    step(game(P, []), 100, 120);
    expect([P.x, P.y]).toEqual([100, 120]); // at its target, the shot not yet seen: it holds
    s.t = 12; step(game(P, []), 100, 120);
    expect(P.x !== 100 || P.y !== 120).toBe(true);
  });
});

describe('pilot: a path that throws inside the look-ahead is skipped, never the pilot', () => {
  it('logs the path by name and still steers off a shot', () => {
    const P = { x: 100, y: 120, speed: 0, alive: true, inv: 0 };
    const e: any = { k: 'maw', x: 300, y: 120, r: 20, hp: 10, max: 20, bs: 2, bt: 3, bx0: 300, ly: 120 };
    win.__BRL = { MAW: { tell: 46, hold: 20, backV: 3, lungeV: 6, lungeX: .35 }, lungeX: () => { throw new Error('lunge'); } };
    win.__W.eshots = [{ x: 108, y: 120, vx: -2, vy: 0, r: 2, k: 'orb' }];
    step(game(P, [e], { mini: e }), 100, 120);
    expect(win.__pilotLog.err['path:maw']).toMatch(/lunge/);
    expect(P.x !== 100 || P.y !== 120).toBe(true);
  });
});

describe('pilot: THE KEEPSAKE drop order is read only as each fork shows its tell', () => {
  it('fork k of a drop is not a threat while wt <= k gap (keepsake.ts mobilePick draws the order; render shudders fork k from wt k gap)', () => {
    const KB = KS.KB, P = { x: 100, y: 200, speed: 0, alive: true, inv: 0 };
    const m: any = { k: 'keepsake', x: 360, y: 150, ph: 1, st: 'drop', wt: 2, th: 0, dn: 3, dq: [0, 5, 2], ma: [1, 1, 1, 1, 1, 1], ml: [0, 0, 0, 0, 0, 0], my: KB.mobY, pn: 0, fh: 0 };
    step(game(P, [], { mini: m }), 100, 200);
    expect(win.__pilotLog.err || null).toBe(null);
    expect(win.__pilotLog.now['keep:drop']).toBe(1); // only fork dq[0] is live (k = 0: wt 2 > 0); forks k 1, 2 (gaps 12, 24) are not yet shown
  });
});

describe('tools: every tools/*.mjs parses', () => {
  it('node --check', async () => {
    const { execFileSync } = await import('node:child_process');
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync('tools').filter((x) => x.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', 'tools/' + f]);
  }, 120000);
});

describe('pilot: drop order, the fork after it', () => {
  it('fork k = 1 appears once wt passes its gap', () => {
    const KB = KS.KB, P = { x: 100, y: 200, speed: 0, alive: true, inv: 0 };
    const m: any = { k: 'keepsake', x: 360, y: 150, ph: 1, st: 'drop', wt: KB.dropGap + 1, th: 0, dn: 3, dq: [0, 5, 2], ma: [1, 1, 1, 1, 1, 1], ml: [0, 0, 0, 0, 0, 0], my: KB.mobY, pn: 0, fh: 0 };
    step(game(P, [], { mini: m }), 100, 200);
    expect(win.__pilotLog.now['keep:drop']).toBe(2);
  });
});

describe('pilot: the Womb eruption is read from its boil, not from the pool clock before it', () => {
  it('a column is a threat only once its pool boils', () => {
    const D = DN.DN, P = { x: 100, y: 200, speed: 0, alive: true, inv: 0 };
    const e: any = { k: 'cyst', x: 380, y: 120, r: 14, hp: 50, max: 60, t: 0, pn: 1, pX: [100], pY: [236], pS: [1], pT: [0], pR: [100] };
    e.t = D.plArm + D.plEr0 - 10; // burning, its first boil 10 f away
    step(game(P, [e], { mini: e }), 100, 200);
    expect(win.__pilotLog.now.column || 0).toBe(0);
    e.t = D.plArm + D.plEr0 + 5; // boiling (its tell), the column 39 f away
    step(game(P, [e], { mini: e }), 100, 200);
    expect(win.__pilotLog.now.column).toBeGreaterThan(0);
  });
});
