// Kind probe: what a biome stage actually spawns, fast. For every biome x biome slot (src/layout.ts slotRow) x visit (first / repeat) x descent it
// enters the biome through a real fork (openFork + gate), then walks the inserted script without stepping the game:
// each entry runs with the scroll parked at its x and any deferred spawns (rear waves) flushed at once. Counts
// enemies by kind (bosses, midbosses and their parts excluded) and elites, averaged over N rolls at a fixed rank.
// Usage: node tools/kind-probe.mjs <url> [N=40] [rank=.9] [--layout long4|short]   (needs the VITE dev server)
// W5 (DIFFICULTY-SPEC §3 N3, measure-only): node tools/kind-probe.mjs <url> --attack [seed=7] [minutes=14]
//   flies Descent 1 for real with playtest's statue bot (invincible, always firing, chasing targets, never dodging)
//   and times, per regular enemy, the frames from first visible (on screen) to its first shot (a shot attributed to
//   the enemy nearest its spawn point, probe-lib tagShots) and to its first act (the first change of its attack state,
//   e.st or e.ws: a tell counts, but so can a movement state, so it is context only). Per kind: on screen, fired, and
//   first shot / first act p50 / p90 / max. N3 is read on the first shot; an enemy that never fires is listed by the
//   fired / on-screen count, not dropped silently. Drones are split into designated shooters (e.sh, probe-lib
//   PL.designated) and the rest ("drone(not a shooter)"; "drone(undesignated)" on a build with no e.sh). Prints one ATTACK {...} JSON line after the table.
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import { pageLib, aq } from './probe-lib.mjs';
if (process.argv.includes('--attack')) { process.argv.splice(process.argv.indexOf('--attack'), 1); await attack(); process.exit(0); }
// --rank N: pin src/rank.ts rank($) to N by fitting the ship (probe-lib PL.pinRank; the positional rank only sets the
// legacy G.rank, which nothing on long4 reads once W0 landed). Prints the rank reached
const rki = process.argv.indexOf('--rank'), RANKN = rki >= 0 ? +process.argv.splice(rki, 2)[1] : null;
const [url, N = '40', RANK = '.9'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(pageLib);
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; window.setTimeout = () => 0; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await useLayout(p, 'kind-probe');
await p.evaluate(() => window.__PL.load());
const res = await p.evaluate(async ([N, RANK, RANKN]) => {
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
      ST.step(); if (RANKN != null) window.__rk = window.__PL.pinRank($, RANKN); // after the fork: the rank reads the biome stage
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
}, [+N, +RANK, RANKN]);
if (RANKN != null) console.log(`rank pinned: asked ${RANKN}, reached ${await p.evaluate(() => window.__rk)} (src/rank.ts; null = no rank.ts)`);
await b.close();
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(16), `tot ${r.tot.toFixed(1).padStart(5)}  drone ${(r.drone * 100).toFixed(0).padStart(3)}%  elites ${r.el.toFixed(1).padStart(4)}  sigs ${String(r.sig).padStart(3)}  ${JSON.stringify(r.cnt)}`);
console.log('errors', errs.length ? errs.slice(0, 5) : 'none');
ranOn('kind-probe');

/** --attack: first-attack frames per kind on a real Descent 1 run (see the header) */
async function attack() {
  const [url, SEED = '7', MIN = '14'] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript(pageLib);
  await p.addInitScript((seed) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
    let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
    try { localStorage.clear(); } catch (e) {}
    const A = (window.__at = { fr: 0, seen: new Map(), done: [] });
    window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G();
        if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true; const G = g.G; let tx, ty;
          if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
          else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
            const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
            if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; }
            else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss || g.enemies.find((e) => !e.dead); tx = 90; ty = m ? m.y : g.P.y; } }
          if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); } }
        q.splice(0).forEach((f) => f(now));
        const h = window.__G && window.__G(), PL = window.__PL;
        if (!h || !h.G || h.state !== 'play' || !PL || !PL.mods.W) continue;
        A.fr++;
        for (const t of PL.tagShots(h, A.fr) || []) { const r = t.e && A.seen.get(t.e); if (r && r.shot == null && r.vis != null) r.shot = A.fr - r.vis; }
        const alive = new Set();
        for (const e of h.enemies) { if (e.dead || !PL.regular(e)) continue; alive.add(e);
          let r = A.seen.get(e); if (!r) { const ds = PL.designated(e, PL.rank()); A.seen.set(e, (r = { k: e.k === 'drone' && !ds ? (ds === null ? 'drone(undesignated)' : 'drone(not a shooter)') : e.k, vis: null, shot: null, act: null, s0: e.st ?? e.ws })); }
          if (r.vis == null && e.x > 0 && e.x < 480 && e.y > 0 && e.y < 254) r.vis = A.fr;
          if (r.vis != null && r.act == null && (e.st ?? e.ws) !== r.s0) r.act = A.fr - r.vis; }
        for (const [e, r] of A.seen) if (!alive.has(e)) { A.seen.delete(e); if (r.vis != null) A.done.push([r.k, r.shot, r.act]); } } };
  }, +SEED);
  await p.goto(url); await p.waitForFunction(() => window.__started);
  await useLayout(p, 'kind-probe', { quiet: true });
  await p.evaluate(() => window.__PL.load());
  const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
  await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
  await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
  let lastFork = false;
  for (let it = 0; it < MIN * 60 * 2; it++) {
    await p.evaluate('__tick(30)');
    const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, loop: G.loop, fork: !!G.fork, pick: !!G.pick, pt: G.pick ? G.pick.t : 0 }; });
    if (s.fork && !lastFork) await p.evaluate(() => (window.__gi = (window.__gi ?? 0) + 1));
    lastFork = s.fork;
    if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
    if (s.st !== 'play' || s.loop >= 1) break;
  }
  const done = await p.evaluate(() => { for (const [, r] of window.__at.seen) if (r.vis != null) window.__at.done.push([r.k, r.shot, r.act]); return window.__at.done; });
  const by = {}; for (const [k, sh, ac] of done) { const o = (by[k] ||= { n: 0, fired: 0, shot: [], act: [] }); o.n++; if (sh != null) { o.fired++; o.shot.push(sh); } if (ac != null) o.act.push(ac); }
  console.log('kind'.padEnd(10), 'on screen'.padStart(9), 'fired'.padStart(6), 'first shot p50/p90/max (f)'.padStart(28), 'first act p50/p90/max (f)'.padStart(27));
  const out = {};
  for (const [k, o] of Object.entries(by).sort((a, b) => b[1].n - a[1].n)) {
    const f = (a) => (a.length ? `${aq(a, .5)}/${aq(a, .9)}/${Math.max(...a)}` : '-');
    out[k] = { n: o.n, fired: o.fired, shotP50: aq(o.shot, .5), shotP90: aq(o.shot, .9), shotMax: o.shot.length ? Math.max(...o.shot) : null, actP50: aq(o.act, .5), actP90: aq(o.act, .9) };
    console.log(k.padEnd(10), String(o.n).padStart(9), String(o.fired).padStart(6), f(o.shot).padStart(28), f(o.act).padStart(27));
  }
  console.log('ATTACK ' + JSON.stringify({ seed: +SEED, kinds: out, errors: errs.slice(0, 3) }));
  ranOn('kind-probe'); await b.close();
}
