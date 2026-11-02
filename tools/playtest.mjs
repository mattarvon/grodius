// Playtest probe: a bot plays the real game for several descents the way a player would (fires, chases pods, takes
// perks, alternates fork gates, SPENDS its biomass in the Infirmary), invincible but counting would-be hits, and reports
// whether it gets overpowered and whether things repeat:
//   power  - level, power rank (0..1; enemy HP scales with it), weapon levels, grafts, contraptions, per stage
//   kill   - how long regular enemies live once on screen (median / p90 s), % killed in the right quarter of the screen,
//            % that escape; boss / midboss kill times
//   danger - would-be hits per minute (enemy shot or body overlapping the ship while it's invincible)
//   variety - enemy kinds per stage, wave signatures (kinds spawned together) and how often the top one repeats,
//            how much of descent N's stage repeats descent N-1's mix, hype voice count, music per stage
// Screenshots every SHOT seconds of game time go to <outDir>. Needs the VITE dev server (imports live modules).
// Usage: node tools/playtest.mjs <url> <outDir> [descents=3] [seed=7] [maxMinutes=30] [--layout short]
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import fs from 'node:fs';
const [url, OUT, DESC = '3', SEED = '7', MAXM = '30'] = process.argv.slice(2);
const SHOT = 20;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript((seed) => {
  let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); } catch (e) {}
  const L = (window.__pt = { fr: 0, seen: new Map(), life: [], spawns: [], hits: 0, hitCD: 0, bosses: [], hype: 0, lastHype: 0 });
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; const g = window.__G && window.__G();
      if (g && g.P && g.state === 'play') { g.P.inv = 30; g.P.alive = true; const G = g.G; let tx, ty;
        if (G.fork && G.fork.t > 45) { tx = 480 * .74; ty = (window.__gi ?? 0) % 2 ? 254 * .72 : 254 * .28; }
        else { const c = g.caps.filter((c) => c.x > 0 && c.x < 470).sort((a, b) => a.x - b.x)[0];
          const t = c || g.enemies.filter((e) => !e.dead && e.x > g.P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, b) => (a.k === 'heart' || a.k === 'nailbar' ? -1 : 0) || Math.abs(a.y - g.P.y) - Math.abs(b.y - g.P.y))[0];
          if (t) { tx = c ? c.x : Math.min(140, t.x - 60); ty = t.y; }
          else { const m = (G.mini && !G.mini.dead && G.mini) || G.boss || g.enemies.find((e) => !e.dead); tx = 90; ty = m ? m.y : g.P.y; } }
        if (tx != null) { g.P.x += Math.sign(tx - g.P.x) * Math.min(3, Math.abs(tx - g.P.x)); g.P.y += Math.sign(ty - g.P.y) * Math.min(3, Math.abs(ty - g.P.y)); } }
      q.splice(0).forEach((f) => f(now));
      const h = window.__G && window.__G();
      if (!h || !h.G || h.state !== 'play') continue;
      L.fr++; const G = h.G, P = h.P, st = `${G.loop + 1}-${(G.stage || 0) + 1}`;
      // enemy lifetimes: from first on screen to removal; killed if removed while still on screen
      const alive = new Set();
      for (const e of h.enemies) { alive.add(e);
        if (!L.seen.has(e)) { L.seen.set(e, { k: e.k, f0: null, st, big: !!(e.big || e.mini || e.mid) }); L.spawns.push({ f: L.fr, k: e.k, st, el: !!e.elite }); }
        const r = L.seen.get(e); if (r.f0 == null && e.x < 480 && e.x > 0) r.f0 = L.fr; r.x = e.x; }
      for (const [e, r] of L.seen) if (!alive.has(e)) { L.seen.delete(e);
        if (r.f0 != null && !r.big) L.life.push({ k: r.k, st: r.st, s: (L.fr - r.f0) / 60, killed: r.x > -8 && r.x < 490, right: r.x > 360 }); }
      // would-be hits (ship hitbox ~4 px), at most one per 30 frames like real i-frames
      if (L.hitCD > 0) L.hitCD--;
      else if (h.eshots && h.eshots.some((s) => (s.x - P.x) ** 2 + (s.y - P.y) ** 2 < 36) || h.enemies.some((e) => !e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < ((e.r || 6) + 2) ** 2)) { L.hits++; L.hitCD = 30; }
      // bosses
      for (const m of [G.mini, G.boss]) if (m && !m.__pt) { m.__pt = 1; L.bosses.push({ k: m.k || 'drive', title: m.title || '', st, f0: L.fr, m }); }
      for (const bo of L.bosses) if (bo.f1 == null && (bo.m.dead || (bo.m !== G.mini && bo.m !== G.boss))) { bo.f1 = L.fr; bo.killed = !!bo.m.dead || (bo.m.hp != null && bo.m.hp <= 0); }
      if ((G.hypeCD || 0) > L.lastHype) L.hype++; L.lastHype = G.hypeCD || 0; } };
}, +SEED);
await p.goto(url); await p.waitForFunction(() => window.__started);
await useLayout(p, 'playtest');
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(30)'); await key('keydown', 'KeyZ');

// the Infirmary: spend like a player would. Contraptions first (and their levels), then sockets, then upgrades
async function shop() {
  return p.evaluate(async () => {
    const M = await import('/src/menus.ts'), S = await import('/src/state.ts'), $ = S.$, bought = [];
    // a player's order: a socket when there are more machines than sockets, a new machine, levels for the BOLTED ones,
    // then hull/ship upgrades; owned machines get bolted into any free socket (free)
    const bolt = () => { for (const x of M.shopItems()) if (x.k === 'rig' && M.rigOwned(x.r.id) && !M.rigBolted(x.r.id) && ($.meta.rig || []).length < ($.meta.lv?.socket || 0) + 1) M.shopAct(x, 0); };
    for (let n = 0; n < 60; n++) {
      bolt();
      const before = $.meta.bio, items = M.shopItems(), owned = ($.meta.own || []).length, socks = ($.meta.lv?.socket || 0) + 1;
      const tries = [...(owned > socks ? items.filter((x) => x.k === 'sock').map((x) => [x, 0]) : []),
        ...items.filter((x) => x.k === 'rig' && !M.rigOwned(x.r.id)).map((x) => [x, 0]),
        ...items.filter((x) => x.k === 'rig' && M.rigBolted(x.r.id)).map((x) => [x, 1]),
        ...items.filter((x) => x.k === 'sock').map((x) => [x, 0]), ...items.filter((x) => x.k === 'upg').map((x) => [x, 0])];
      let did = false;
      for (const [x, side] of tries) { M.shopAct(x, side); if ($.meta.bio < before) { bought.push(x.k === 'rig' ? x.r.id + (side ? '+' : '') : x.k === 'upg' ? x.u.id : 'socket'); did = true; break; } }
      if (!did) break;
    }
    bolt();
    return { bought, bio: Math.round($.meta.bio), rig: ($.meta.rig || []).join(','), cl: JSON.stringify($.meta.cl || {}) };
  });
}

const stages = []; let cur = null, lastFork = false, nextShot = SHOT, end = '';
const snap = () => p.evaluate(() => { const g = __G(), G = g.G, P = g.P, M = window.__music && __music();
  return { st: g.state, k: G ? `${G.loop + 1}-${(G.stage || 0) + 1}` : '', loop: G ? G.loop : 0, fr: __pt.fr, lvl: G && G.lvl, rank: G ? +(G.rank || 0).toFixed(2) : 0,
    wep: P ? [P.speed, P.missile, P.double, P.laser, P.pyre, P.options, P.wardLv || 0].join(',') : '', gm: G ? Object.entries(G.gm || {}).filter(([, v]) => v > 0).map(([k, v]) => k + v).join(' ') : '',
    pick: !!(G && G.pick), pt: G && G.pick ? G.pick.t : 0, fork: !!(G && G.fork), biome: G && G.route && __LY.slotOf(G.stage) >= 0 ? G.route[__LY.slotOf(G.stage)] : null, remix: G && G.visitNo && __LY.slotOf(G.stage) >= 0 ? G.visitNo[__LY.slotOf(G.stage)] : 0, mix: M ? M.mix : '', kills: G ? G.gmk || G.kills : 0, bio: G ? Math.round(G.bio || 0) : 0 }; });
for (let it = 0; it < MAXM * 60 * 2; it++) {
  await p.evaluate('__tick(30)');
  const s = await snap();
  if (s.fork && !lastFork) await p.evaluate(() => (window.__gi = (window.__gi ?? 0) + 1));
  lastFork = s.fork;
  if (s.st === 'play' && (!cur || cur.k !== s.k)) { cur = { k: s.k, f0: s.fr, start: s, music: new Set(), biome: s.biome }; stages.push(cur); }
  if (cur && s.st === 'play') { cur.end = s; if (s.mix) cur.music.add(s.mix); if (s.biome) { cur.biome = s.biome; cur.remix = s.remix; } }
  if (s.fr / 60 >= nextShot && s.st === 'play') { await p.screenshot({ path: `${OUT}/t${String(Math.round(s.fr / 60)).padStart(4, '0')}-${s.k}.png` }); nextShot += SHOT; }
  if (s.pick && s.pt > 36) { await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); }
  if (s.st === 'shop') { const r = await shop(); console.log(`INFIRMARY after descent ${s.loop + 1}: bought ${r.bought.join(' ') || 'nothing'} | bolted ${r.rig} levels ${r.cl} | bio left ${r.bio}`);
    await p.evaluate(async () => (await import('/src/menus.ts')).leaveShop()); await p.evaluate('__tick(60)'); continue; }
  if (s.st !== 'play' || s.loop >= +DESC) { end = JSON.stringify(s); break; }
}
const L = await p.evaluate(() => { const L = __pt; return { fr: L.fr, life: L.life, spawns: L.spawns, hits: L.hits, hype: L.hype, bosses: L.bosses.map(({ m, ...r }) => r) }; });
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(f * s.length))].toFixed(2) : null; };
const prev = {}, prevB = {}, drn = { biome: [0, 0] };
for (let i = 0; i < stages.length; i++) {
  const S = stages[i], f1 = stages[i + 1] ? stages[i + 1].f0 : L.fr, dur = (f1 - S.f0) / 60;
  const life = L.life.filter((x) => x.st === S.k), kl = life.filter((x) => x.killed);
  const sp = L.spawns.filter((x) => x.st === S.k), kinds = {};
  for (const x of sp) kinds[x.k] = (kinds[x.k] || 0) + 1;
  const waves = []; for (const x of sp) { const w = waves[waves.length - 1]; if (w && x.f - w.f1 < 40) { w.ks.push(x.k); w.f1 = x.f; } else waves.push({ f1: x.f, ks: [x.k] }); }
  const sig = {}; for (const w of waves) { const c = {}; w.ks.forEach((k) => (c[k] = (c[k] || 0) + 1)); const key = Object.entries(c).sort().map(([k, n]) => k + (n > 1 ? 'x' + n : '')).join('+'); sig[key] = (sig[key] || 0) + 1; }
  const top = Object.entries(sig).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const slot = S.k.split('-')[1], pk = prev[slot];
  const overlap = pk ? Object.keys(kinds).filter((k) => pk.has(k)).length / Math.max(1, Object.keys(kinds).length) : null;
  prev[slot] = new Set(Object.keys(kinds));
  const pb = S.biome && prevB[S.biome], bo = pb ? Object.keys(kinds).filter((k) => pb.k.has(k)).length / Math.max(1, Object.keys(kinds).length) : null;
  const sigB = new Set(Object.keys(sig)), so = pb ? [...sigB].filter((k) => pb.s.has(k)).length / Math.max(1, sigB.size) : null;
  if (S.biome) prevB[S.biome] = { k: new Set(Object.keys(kinds)), s: sigB };
  const els = sp.filter((x) => x.el).length, big = new Set(['maw', 'crux', 'butcher', 'choir', 'cyst', 'prentice', 'brood', 'nailbar', 'ufo']), reg = sp.filter((x) => !big.has(x.k));
  if (S.biome) { drn.biome[0] += reg.filter((x) => x.k === 'drone').length; drn.biome[1] += reg.length; }
  const bos = L.bosses.filter((x) => x.st === S.k).map((x) => `${x.title || x.k} ${x.f1 ? ((x.f1 - x.f0) / 60).toFixed(1) + 's' + (x.killed ? '' : ' (left)') : 'unfinished'}`);
  console.log(`\n== stage ${S.k}${S.biome ? ' [' + S.biome + ']' : ''}  ${dur.toFixed(0)}s  lvl ${S.start.lvl}->${S.end.lvl}  rank ${S.start.rank}->${S.end.rank}  weapons ${S.end.wep}  grafts ${S.end.gm || '-'}`);
  console.log(`   kill: on-screen life median ${q(kl.map((x) => x.s), .5)}s p90 ${q(kl.map((x) => x.s), .9)}s | killed in right quarter ${kl.length ? Math.round(100 * kl.filter((x) => x.right).length / kl.length) : 0}% | escaped ${life.length ? Math.round(100 * (life.length - kl.length) / life.length) : 0}% (${life.length} enemies)`);
  console.log(`   bosses: ${bos.join(', ') || '-'}`);
  console.log(`   variety: ${Object.keys(kinds).length} kinds ${JSON.stringify(kinds)} | ${waves.length} waves, ${Object.keys(sig).length} distinct, top ${top.map(([k, n]) => k + ' x' + n).join(', ')}${overlap != null ? ` | kinds shared with last descent's stage: ${Math.round(overlap * 100)}%` : ''} | music ${[...S.music].join(', ')}`);
  console.log(`   drones ${reg.length ? Math.round(100 * (kinds.drone || 0) / reg.length) : 0}% of ${reg.length} | elites ${els}${S.biome ? ` | ${S.remix ? 'REMIX (visit ' + (S.remix + 1) + ')' : 'first visit'}` : ''}${bo != null ? ` | vs last ${S.biome} visit: kinds shared ${Math.round(bo * 100)}%, wave signatures shared ${Math.round(so * 100)}%` : ''}`);
}
console.log(`\nbiome stages: drones ${drn.biome[1] ? Math.round(100 * drn.biome[0] / drn.biome[1]) : 0}% of ${drn.biome[1]} regular spawns`);
console.log(`\nwould-be hits: ${L.hits} in ${(L.fr / 3600).toFixed(1)} min (${(L.hits / (L.fr / 3600)).toFixed(1)}/min) | hype voices ${L.hype} | end ${end} | errors ${errs.slice(0, 3).join(' / ') || 'none'}`);
ranOn('playtest'); await b.close();
