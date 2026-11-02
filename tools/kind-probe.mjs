// Kind probe: what a biome stage actually spawns, fast. For every biome x biome slot (src/layout.ts slotRow) x visit (first / repeat) x descent it
// enters the biome through a real fork (openFork + gate), then walks the inserted script without stepping the game:
// each entry runs with the scroll parked at its x and any deferred spawns (rear waves) flushed at once. Counts
// enemies by kind (bosses, midbosses and their parts excluded) and elites, averaged over N rolls at a fixed rank.
// Usage: node tools/kind-probe.mjs <url> [N=40] [rank=.9] [--layout short]   (needs the VITE dev server)
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
const [url, N = '40', RANK = '.9'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; window.setTimeout = () => 0; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'kind-probe');
const res = await p.evaluate(async ([N, RANK]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), LY = await import('/src/layout.ts');
  const $ = S.$; $.gate = false; const out = {};
  const cases = [];
  for (const b of Object.keys(BI.BIOMES)) for (let seg = 0; seg < LY.nSlots(); seg++) for (const [loop, rep] of [[0, 0], [1, 0], [2, 1]]) cases.push([b, seg, loop, rep]);
  for (const [b, seg, loop, rep] of cases) {
    const cnt = {}; let tot = 0, el = 0, sig = {};
    for (let n = 0; n < N; n++) {
      F.newGame(0); $.state = 'play';
      $.G.loop = loop; $.G.rank = RANK; $.G.visited = rep ? [b] : []; $.G.bvis = rep ? { [b]: 1 } : {};
      for (const a of [W.enemies, W.eshots]) a.length = 0;
      $.G.si = $.G.script.length; $.G.route = Array(LY.nSlots()).fill(null); for (let i = 0; i < seg; i++) $.G.route[i] = Object.keys(BI.BIOMES).find((k) => k !== b);
      $.G.scroll = LY.slotRow(seg).x0 - 500; BI.openFork(seg); $.G.fork.opts = [b, b]; $.G.fork.t = 50;
      Object.assign($.P, { x: C.W * .74, y: $.G.fork.gy[0], alive: true, inv: 30 });
      ST.step();
      const sc = $.G.script.slice($.G.si).filter((e) => e.x < LY.slotRow(seg).bossX);
      for (const e of sc) {
        const s = e.f.toString(); if (/miniWarn|logLine/.test(s)) continue;
        $.G.scroll = e.x; $.G.pend.length = 0; const n0 = W.enemies.length;
        e.f();
        for (let g = 0; g < 4 && $.G.pend.length; g++) { const q = $.G.pend.splice(0); for (const x of q) x.f(); }
        const ks = W.enemies.slice(n0).filter((x) => !x.mini && !x.par).map((x) => x.k);
        for (const x of W.enemies.slice(n0)) if (x.elite) el++;
        for (const k of ks) { cnt[k] = (cnt[k] || 0) + 1; tot++; }
        const w = [...new Set(ks)].sort().join('+'); if (w) sig[w] = (sig[w] || 0) + 1;
        W.enemies.length = 0;
      }
    }
    const k = `${b} s${seg} L${loop}${rep ? ' rep' : ''}`;
    out[k] = { tot: tot / N, drone: (cnt.drone || 0) / Math.max(1, tot), el: el / N, cnt: Object.fromEntries(Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / N).toFixed(1)])), sig: Object.keys(sig).length };
  }
  return out;
}, [+N, +RANK]);
await b.close();
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(16), `tot ${r.tot.toFixed(1).padStart(5)}  drone ${(r.drone * 100).toFixed(0).padStart(3)}%  elites ${r.el.toFixed(1).padStart(4)}  sigs ${String(r.sig).padStart(3)}  ${JSON.stringify(r.cnt)}`);
console.log('errors', errs.length ? errs.slice(0, 5) : 'none');
ranOn('kind-probe');
