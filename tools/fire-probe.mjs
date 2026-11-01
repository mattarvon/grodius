// Fire probe: enemy bullets per second for each regular enemy that fires (or litters) on a cooldown, at Descent 1, 2
// and 3. Each trial spawns one enemy, pins its x at 70% of the screen (the scroll keeps running, so terrain moves under
// it) and steps the game 600 frames (10 s) with an invincible, non-firing player at x=60. Counts enemy bullets created
// (eshots) and, for the womb, hatchlings. Averaged over N trials. The Descent 2+ revenge shots are not counted (nothing dies).
// Usage: node tools/fire-probe.mjs <url> [N=30]       (needs the VITE dev server)
import { chromium } from 'playwright';
const [url, N = '30'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
// seeded Math.random + fake clock like tools/harness.mjs, so before/after runs compare like for like
await p.addInitScript(() => { let s = 1234567, now = 0; window.__seed = (v) => { s = v; }; Math.random = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; performance.now = () => now; window.AudioContext = window.webkitAudioContext = undefined; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
const KINDS = ['eye', 'cross', 'flayer', 'slime', 'mutant', 'sentry', 'womb'];
const res = await p.evaluate(async ([N, KINDS]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), C = await import('/src/core.ts');
  const $ = S.$; $.gate = false; const out = {};
  const spawn = { eye: () => SP.eyeT(1), cross: () => SP.crossT(1), flayer: () => SP.flayer(C.PH / 2), slime: () => SP.slime(1), mutant: () => SP.mutant(), sentry: () => SP.sentry(C.PH / 2, C.W * .7), womb: () => SP.womb() };
  for (const k of KINDS) for (const loop of [0, 1, 2]) {
    let n = 0, miss = 0; window.__seed(1234567); // same stream for every kind x descent: Descent 1 rows compare exactly
    for (let t = 0; t < N; t++) {
      F.newGame(0); $.state = 'play';
      for (let i = 0; i < 30; i++) ST.step();
      $.G.loop = loop; $.G.si = $.G.script.length;
      for (const a of [W.enemies, W.eshots, W.caps]) a.length = 0;
      // park the scroll where both surfaces stay on screen for the whole trial (slimes, mutants, wombs need them)
      const ok = (s0) => { for (let x = s0; x < s0 + C.W + 700; x += 16) { const fl = W.floorAt(x), ce = W.ceilAt(x); if (fl > C.PH - 6 || fl < C.PH * .55 || ce < 6 || ce > C.PH * .45) return false; } return true; };
      let s0 = 400; while (s0 < 40000 && !ok(s0)) s0 += 50; $.G.scroll = s0; out.at = s0;
      // surface spawners refuse a spot with no floor/ceiling on screen: walk the scroll on until one takes
      let e; for (let g = 0; g < 80 && !e; g++) { spawn[k](); e = W.enemies.find((x) => x.k === k); if (!e) $.G.scroll += 40; }
      if (!e) { miss++; continue; }
      for (let f = 0; f < 600; f++) {
        Object.assign($.P, { x: 60, y: C.PH / 2, alive: true, inv: 30 });
        e.x = C.W * .7; if (k === 'hook') e.ax = e.x;
        ST.step();
        for (const s of W.eshots) if (!s._c) { s._c = 1; n++; }
        for (const x of W.enemies) if (x.k === 'hatch' && !x._c) { x._c = 1; n++; }
      }
    }
    out[`${k} D${loop + 1}`] = miss < N ? n / (N - miss) / 10 : NaN; if (miss) out.miss = (out.miss || '') + ` ${k} D${loop + 1} x${miss}`;
  }
  return out;
}, [+N, KINDS]);
console.log('bullets/s (womb: hatchlings/s)'.padEnd(32) + 'D1'.padStart(7) + 'D2'.padStart(7) + 'D3'.padStart(7));
for (const k of KINDS) console.log(k.padEnd(32) + [1, 2, 3].map((d) => res[`${k} D${d}`].toFixed(2).padStart(7)).join(''));
console.log('trials parked at scroll', res.at, '(stage 0 terrain)');
console.log('trials with no spawn spot (skipped):', res.miss || 'none');
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
