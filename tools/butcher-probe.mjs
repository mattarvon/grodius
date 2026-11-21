// THE BURNING BUTCHER park probe (D61): the second half's hook plants a chain across the lane. For a grid of parking spots
// (X,Y) an invincible ship sits still and holds fire while the boss, pinned just under half HP, fights for 40 s; the probe
// counts would-be hits (playerHit calls that land: a 9-point shield and the ship's own invulnerability frames, so a sustained contact counts once per ~18 f). Spots inside terrain print R and are not counted per spot.
// A spot with 0 hits is a safe park. Also lists what hit it (hook chain vs everything else is not split: the grid is the
// whole second half) and, with HALF=1, the same grid in the first half (hp pinned at 80%) for the learnable half.
// Needs a Vite dev server (imports live modules). Usage: node tools/butcher-probe.mjs <url> [seconds=40] [seed=7]
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, SEC = '40', SEED = '7'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(([seed]) => {
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
}, [+SEED]);
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'butcher-probe', { limits: 'staged in biome slot 0 only' });
const res = await p.evaluate(async ([SEC, FRAC]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts'), LY = await import('/src/layout.ts'), IN = await import('/src/input.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = false;
  const XS = [20, 40, 70, 120, 200, 300], YS = []; for (let y = 12; y <= 244; y += 28) YS.push(y);
  const rows = {}; let safe = [], total = 0;
  for (const X of XS) for (const Y of YS) {
    F.newGame(0); $.state = 'play'; for (let i = 0; i < 30; i++) ST.step();
    $.G.lvl = 10; $.G.scroll = LY.slotRow(0).x0 + 700; $.G.si = $.G.script.length;
    W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0; SP.butcher();
    const m = $.G.mini; let hits0 = -1, hits = 0, rock = false;
    for (let f = 0; f < SEC * 60; f++) {
      m.hp = m.max * FRAC;
      $.P.x = X; $.P.y = Y; $.P.alive = true; $.P.shield = 9; $.G.lives = 9; $.P.hist.unshift({ x: X, y: Y }); if ($.P.hist.length > 80) $.P.hist.pop();
      if (hits0 < 0 && m.t > 240) { hits0 = $.G.st.hits; if (W.floorAt(X + $.G.scroll) < Y + 6 || W.ceilAt(X + $.G.scroll) > Y - 6) { rock = true; break; } } // the arena scrolls in during the run-up: judge the terrain once it holds
      ST.step();
    }
    if (m.t < SEC * 60 * .5) rock = true; // inside a wall the ship is crushed over and over and the fight's clock crawls: not a spot
    if (rock) { rows[X + "," + Y] = "R"; continue; }
    hits = $.G.st.hits - hits0; rows[X + ',' + Y] = hits; total += hits; if (!hits) safe.push(X + ',' + Y);
  }
  return { rows, safe, total, XS, YS };
}, [+SEC, +(process.env.FRAC || .45)]);
console.log(`hits per spot over ${SEC}s, boss pinned at ${(+(process.env.FRAC || .45) * 100)}% HP (rows y, cols x)`);
console.log('y|x'.padEnd(6), ...res.XS.map((x) => String(x).padStart(5)));
for (const y of res.YS) console.log(String(y).padEnd(6), ...res.XS.map((x) => String(res.rows[x + ',' + y]).padStart(5)));
console.log('total hits:', res.total, ' zero-hit spots:', res.safe.length, '/', res.XS.length * res.YS.length, res.safe.join(' '));
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('butcher-probe'); await b.close();
