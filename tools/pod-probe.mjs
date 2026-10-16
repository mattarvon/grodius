// Seeded pacing probe: progression.mjs bot + pick/fork/shop handling, seeded RNG,
// per-frame pod-pickup timestamps, per-stage pods/min, bio per descent.
// Usage: node tools/pod-probe.mjs <url> <seed> [minutes=12] [endLoop=1]
import { chromium } from 'playwright';
const [url, SEED = '1', MIN = '12', END = '1'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((seed) => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); } catch (e) {}
  window.__pods = []; window.__fr = 0;
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G(); let before = null;
      if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true; const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; }
          else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss || g.enemies.find((e) => !e.dead); tx = 90; ty = m ? m.y : g.P.y; } }
        if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); }
        before = g.caps.slice(); }
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G();
      if (h && h.G && h.state === 'play') window.__fr++;
      if (before && h && h.P) { const seen = new Set(h.caps); let chosen = false;
        for (const c of before) if (!seen.has(c) && c.x >= -12 && (c.x - h.P.x) ** 2 + (c.y - h.P.y) ** 2 < 20 * 20) {
          const kind = c.graft ? 'graft' : c.blue ? 'blue' : c.choice ? 'choice' : c.salv ? 'salv' : 'pod';
          if (kind === 'choice') { if (chosen) continue; chosen = true; }
          window.__pods.push({ f: window.__fr, kind, st: `${h.G.loop + 1}-${(h.G.stage || 0) + 1}` }); } } } }; }, +SEED);
await p.goto(url); await p.waitForFunction(() => window.__started);
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');
await p.evaluate(() => { window.__fr = 0; window.__pods.length = 0; });
let last = '', lastFork = false; const seg = []; let endState = '';
for (let it = 0; it < MIN * 60 * 2; it++) {
  await p.evaluate('__tick(30)');
  const s = await p.evaluate(() => { const g = __G(), G = g.G; return { st: g.state, stage: G.stage, loop: G.loop, lvl: G.lvl, pick: !!G.pick, pt: G.pick ? G.pick.t : 0, fork: !!G.fork, fr: window.__fr, bio: Math.round(G.bio || 0), kills: G.kills }; });
  if (s.fork && !lastFork) await p.evaluate(() => (window.__gi = (window.__gi ?? 0) + 1));
  lastFork = s.fork;
  const k = `${s.loop + 1}-${(s.stage || 0) + 1}`;
  if (process.env.DBG && it % 20 === 0) console.log(await p.evaluate(() => { const g = __G(), G = g.G; return `${(window.__fr/60).toFixed(0)}s ${g.state} st${G.loop+1}-${(G.stage||0)+1} scroll${Math.round(G.scroll)} kills${G.kills} lv${G.lvl} pick${!!G.pick} fork${!!G.fork} tally${!!G.tally} boss${!!G.boss} mini${G.mini&&!G.mini.dead?G.mini.k:''} en${g.enemies.filter(e=>!e.dead).map(e=>e.k).slice(0,6)} P${Math.round(g.P.x)},${Math.round(g.P.y)} caps${g.caps.length}`; }));
  if (k !== last) { seg.push({ k, f0: s.fr, lvl: s.lvl, bio: s.bio, kills: s.kills }); last = k; }
  if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  if (s.st === 'shop') { await p.evaluate('__tick(40)'); await key('keydown', 'Backspace'); await p.evaluate('__tick(1)'); await key('keyup', 'Backspace'); await p.evaluate('__tick(40)'); continue; }
  if (s.st !== 'play' || s.loop >= +END) { endState = JSON.stringify(s); break; }
}
const fin = await p.evaluate(() => { const g = __G(), G = g.G; return { fr: window.__fr, pods: window.__pods, bio: Math.round(G.bio || 0), metaBio: Math.round((g.G && window.__G && 0) || 0), lvl: G.lvl, kills: G.kills, st: g.state }; });
seg.push({ k: 'END', f0: fin.fr });
const podsOnly = fin.pods.filter((x) => x.kind === 'pod' || x.kind === 'choice');
const first = podsOnly[0];
const stages = seg.slice(0, -1).map((sg, i) => { const f1 = seg[i + 1].f0; const n = podsOnly.filter((x) => x.f >= sg.f0 && x.f < f1).length; const dur = (f1 - sg.f0) / 60;
  return { stage: sg.k, dur: +dur.toFixed(1), pods: n, ppm: +(n / (dur / 60)).toFixed(2), lvlAtStart: sg.lvl, bioAtStart: sg.bio }; });
console.log(JSON.stringify({ seed: +SEED, firstPod_s: first ? +(first.f / 60).toFixed(2) : null, firstPodKind: first && first.kind,
  podTimes_s: podsOnly.slice(0, 12).map((x) => +(x.f / 60).toFixed(1)), kinds: fin.pods.reduce((a, x) => ((a[x.kind] = (a[x.kind] || 0) + 1), a), {}),
  stages, finalBio: fin.bio, finalLvl: fin.lvl, kills: fin.kills, endState, errors: errs.slice(0, 3) }));
await b.close();
