// Set-piece shots (build plan LS2-mv), two passes, each shot on an empty screen with the ship invincible and parked left:
//   plain: every catalogue piece new in LS2-mv, fired from its S1 entry in its own biome on movement A, until its waits and telegraphs run out and its rear
//          drones have left the screen (cap 480 f).
//   band:  every catalogue piece (old and new: any can land in S2) fired from its S2 entry, inside movement B, once over
//          B0 and once over B1, to the same stop. Counts buried, the enemies that first appear inside the terrain mass (y
//          outside the gap at their world x): set pieces spawn at fixed heights and the gimmick moves the walls; and
//          crossed, rear-wave drones seen on screen inside the terrain at any frame (they cross the screen at one y).
// Output: <outDir>/<biome>-<id>.png and <outDir>/band/<biome>-<id>-B<mv>.png; counts on stdout.
// Usage: node tools/set-shots.mjs <outDir> [url] [--layout long4|short]   (no url: starts its own Vite dev server)
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import fs from 'node:fs';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const OUT = pos[0];
let url = pos[1], server, b;
if (!OUT) { console.error('usage: node tools/set-shots.mjs <outDir> [url] [--layout long4|short]'); process.exit(2); }
fs.mkdirSync(`${OUT}/band`, { recursive: true });
try {
  if (!url) {
    const { createServer } = await import('vite');
    server = await createServer({ server: { port: 5498, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
    await server.listen();
    url = server.resolvedUrls.local[0];
  }
  b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
  await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
  await useLayout(p, 'set-shots');
  await p.waitForTimeout(1500);
  const list = await p.evaluate(async () => {
    const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
    const C = await import('/src/core.ts'), IN = await import('/src/input.ts'), RS = await import('/src/render/screens.ts'), BI = await import('/src/biomes.ts'), L = await import('/src/layout.ts'), SD = await import('/src/setdraw.ts');
    const { $ } = S;
    const wipe = () => { $.G.banner = null; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null; $.G.mini = null; $.G.pend.length = 0; for (const a of [W.enemies, W.eshots, W.caps, W.shots, W.gibs, W.drops]) if (a) a.length = 0; };
    // into biome bk's slot-0 stage with its picks forced: variant mv, set pieces sp (a rig: no catalogue or save rules)
    window.__into = (bk, mv, sp) => {
      S.$.gate = false; IN.K.KeyZ = false; F.newGame(0); $.state = 'play';
      for (let i = 0; i < 30; i++) ST.step();
      wipe();
      $.G.scroll = L.rowOfKind('orbit').bossX + 50;
      ($.G.picks ||= {})[L.stageOfSlot(0)] = { mv, sp };
      BI.openFork(0); $.G.fork.opts = [bk, bk]; $.G.fork.t = 50;
      Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 }); ST.step();
    };
    // fire the nth script entry of piece id and step until its G.pend has run out, no rear-wave telegraph is left
    // (backdraft's second wave spawns 120 f on) and every rear-wave drone has flown off the right edge, capped at
    // FIRE_CAP. Stopping when pend and warn drain would stop on the frame the last wave spawns, off-screen left, and
    // crossed would watch no flight. buried: enemies first seen inside the walls. crossed: rear-wave drones (pat
    // 'behind') seen on screen inside the terrain at any frame, once per drone
    window.__fire = (id, nth) => {
      // > 410 f: backdraft's second wave spawns at later 20 + rearWarn 100 = 120 f, and its last drone (x = -48) flies
      // to the right edge (W - 6, spawn.ts onScreen) at 1.8 px/f (enemies/update.ts 'behind'): 120 + 522 / 1.8 ~ 410 f
      const FIRE_CAP = 480;
      const idx = $.G.script.map((e, i) => (e.k === 'set:' + id ? i : -1)).filter((i) => i >= 0)[nth], x = $.G.script[idx].x;
      wipe(); $.G.stage = 1; $.G.si = idx; $.G.scroll = x - 1;
      const seen = new Set(), hit = new Set(); let buried = 0, n = 0;
      const inWall = (e) => { const wx = $.G.scroll + e.x; return e.y < W.ceilAt(wx) || e.y > W.floorAt(wx); };
      const flying = () => W.enemies.some((e) => e.pat === 'behind' && !e.dead && e.x < C.W - 6); // a rear drone not yet off the right edge
      while (n < FIRE_CAP && (n === 0 || $.G.pend.length || $.G.warn.length || flying())) {
        n++;
        Object.assign($.P, { x: 40, y: C.PH / 2, alive: true, inv: 30 }); ST.step(); if ($.G.si > idx) $.G.si = $.G.script.length;
        for (const e of W.enemies) {
          if (!seen.has(e)) { seen.add(e); if (e.x > -40 && e.x < C.W + 60 && inWall(e)) buried++; }
          if (e.pat === 'behind' && !hit.has(e) && e.x > -10 && e.x < C.W - 6 && inWall(e)) hit.add(e); // on screen: spawn.ts onScreen
        }
      }
      RS.render();
      return { n: W.enemies.length, seen: seen.size, buried, crossed: hit.size, f: n, x };
    };
    return Object.entries(SD.CATALOG).map(([bk, a]) => [bk, a]);
  });
  let total = 0, crossedT = 0;
  for (const [bk, ids] of list) {
    const fresh = ids.slice(2);
    await p.evaluate(([bk, sp]) => window.__into(bk, 0, sp), [bk, fresh]);
    for (const id of fresh) {
      const r = await p.evaluate(([id]) => window.__fire(id, 0), [id]);
      await p.screenshot({ path: `${OUT}/${bk}-${id}.png` });
      console.log(`plain ${bk} ${id}: ${r.n} enemies at frame ${r.f} (${r.seen} seen, buried ${r.buried}, crossed ${r.crossed})`);
    }
    for (const mv of [0, 1]) for (const id of ids) {
      await p.evaluate(([bk, mv, id]) => window.__into(bk, mv, [id, id, id]), [bk, mv, id]);
      const r = await p.evaluate(([id]) => window.__fire(id, 1), [id]);
      total += r.buried; crossedT += r.crossed;
      await p.screenshot({ path: `${OUT}/band/${bk}-${id}-B${mv}.png` });
      console.log(`band  ${bk} B${mv} ${id} (S2 at x ${Math.round(r.x)}): ${r.n} enemies at frame ${r.f}, ${r.seen} seen, buried ${r.buried}, crossed ${r.crossed}`);
    }
  }
  console.log(`band total: buried ${total} (first seen inside the walls), crossed ${crossedT} (rear-wave drones inside the walls on screen) (want 0 and 0)`);
  console.log(errs.length ? 'page errors:\n' + errs.slice(0, 5).join('\n') : 'no page errors');
  console.log('not measured: S1/S3 over movement A and C (no band there); Descent 2+ terrain offsets; front-entering enemies that fly into a wall after spawning (their own patterns, as on main; rear waves are counted as crossed); the player-dependent rearLane re-pick (the ship is parked at mid-height)');
  ranOn('set-shots');
} finally {
  if (b) await b.close();
  if (server) await server.close();
}
