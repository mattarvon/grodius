// Perk verification: against the Vite DEV server (module imports share the game's instances), grants each perk
// and measures what it actually changes. Usage: node tools/perk-verify.mjs http://localhost:<devport>/
import { chromium } from 'playwright';
const url = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; const q = []; performance.now = () => now; window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = (f) => 0; window.speechSynthesis = undefined;
  try { localStorage.clear(); } catch (e) {}
  window.__nr = 1; { const P = CanvasRenderingContext2D.prototype; for (const m of ['fillRect','strokeRect','drawImage','fill','stroke','fillText','strokeText','putImageData','clearRect','getImageData']) { const o = P[m]; P[m] = function (...a) { if (window.__nr) return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; return o.apply(this, a); }; } }
  window.__tick = (n) => { for (let i = 0; i < n; i++) { now += 1000 / 60; q.splice(0).forEach((f) => f(now)); } }; });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 60000 });
const key = (t, c) => p.evaluate(([t, c]) => dispatchEvent(new KeyboardEvent(t, { code: c })), [t, c]);
await key('keydown', 'KeyA'); await p.evaluate('__tick(5)'); await key('keyup', 'KeyA');
await key('keydown', 'Enter'); await p.evaluate('__tick(2)'); await key('keyup', 'Enter'); await p.evaluate('__tick(60)');
const res = await p.evaluate(async () => {
  const W = await import('/src/world.ts'), PL = await import('/src/player.ts'), SH = await import('/src/shots.ts'), EU = await import('/src/enemies/update.ts'),
    SP = await import('/src/enemies/spawn.ts'), MU = await import('/src/mutations.ts'), PK = await import('/src/perks.ts'), ST = await import('/src/state.ts'), FX = await import('/src/fx/update.ts');
  const $ = ST.$, G = $.G, P = $.P, out = [];
  const clear = () => { for (const a of [W.shots, W.eshots, W.enemies, W.orbs, W.caps, W.texts]) a.length = 0; };
  const set = (o) => { G.pk = { ...o }; };
  const row = (id, base, withp, note = '') => out.push({ id, base, with: withp, ok: base !== withp && withp !== undefined, note });
  const holdStill = () => { P.alive = true; P.x = 100; P.y = 120; P.inv = 0; P.shield = 0; };
  const fire1 = () => { W.shots.length = 0; P.cd = 0; P.mcd = 0; P.pcd = 0; PL.fire(); return W.shots.slice(); };
  G.script = []; // no spawns
  // dmg / rof / pierce
  set({}); holdStill(); let s0 = fire1(), cd0 = P.cd; set({ dmg: 3 }); let s1 = fire1();
  row('dmg', s0[0].dmg.toFixed(2), s1[0].dmg.toFixed(2));
  set({ rof: 3 }); fire1(); row('rof (P.cd)', cd0, P.cd);
  set({ pierce: 2 }); s1 = fire1(); row('pierce', s0[0].pierce, s1[0].pierce);
  // reload: missile cooldown
  P.missile = 1; P.pyre = 1; set({}); fire1(); const m0 = P.mcd, p0 = P.pcd; set({ reload: 2 }); fire1(); row('reload (mcd/pcd)', m0 + '/' + p0, P.mcd + '/' + P.pcd); P.missile = 0; P.pyre = 0;
  // crit
  const crate = () => { let c = 0; for (let i = 0; i < 4000; i++) if (MU.critMul(0, 0) > 1) c++; W.texts.length = 0; return (c / 40).toFixed(1) + '%'; };
  set({}); const c0 = crate(); set({ crit: 3 }); row('crit', c0, crate());
  // volatile: kill one drone in a pack, count collateral
  const pack = () => { clear(); const es = []; for (let i = 0; i < 6; i++) es.push(SP.mk('drone', 300 + (i % 3) * 12, 100 + (i / 3 | 0) * 12)); return es; };
  const volTest = (lvl) => { set({ volatile: lvl }); const es = pack(); es.forEach((e) => (e.hp = 1)); EU.killEnemy(es[0]); return es.filter((e) => e.dead).length; };
  row('volatile (dead of 6, hp1)', volTest(0), volTest(3));
  // volatile chain: a long line of drones 18px apart
  { set({ volatile: 3 }); clear(); const es = []; for (let i = 0; i < 40; i++) es.push(SP.mk('drone', 20 + i * 11, 100)); es.forEach((e) => (e.hp = 1)); const t = performance.now(); EU.killEnemy(es[0]); out.push({ id: 'volatile chain (line of 40, 11px)', base: '-', with: es.filter((e) => e.dead).length, ok: true, note: 'chain length' }); }
  // scab
  { P.wardLv = 1; let n = 0; set({ scab: 3 }); for (let i = 0; i < 300; i++) { P.shield = 0; clear(); const e = SP.mk('drone', 300, 100); EU.killEnemy(e); if (P.shield > 0) n++; } row('scab (regrow per 300 kills)', 0, n); P.wardLv = 0; P.shield = 0; }
  // inv
  { P.shield = 1; P.inv = 0; set({}); PL.playerHit(); const i0 = P.inv; P.shield = 1; P.inv = 0; set({ inv: 2 }); PL.playerHit(); row('inv frames', i0, P.inv); P.shield = 0; P.inv = 0; }
  // tiny: enemy bullet at 4.3px from ship centre
  const tinyT = (lvl) => { set({ tiny: lvl }); clear(); holdStill(); P.inv = 0; P.shield = 0; const l0 = G.lives; W.eshots.push({ k: 'orb', x: P.x, y: P.y + 4.3, vx: 0, vy: 0, r: 2, t: 0 }); SH.updateEShots(); const hit = !P.alive; G.lives = l0; P.alive = true; G.deadT = 0; return hit ? 'hit' : 'miss'; };
  row('tiny (bullet @4.3px)', tinyT(0), tinyT(2));
  // graze
  const grazeT = (lvl) => { set({ graze: lvl }); clear(); holdStill(); const x0 = G.xp + G.lvl * 1000, s0 = G.score; P.inv = 99; W.eshots.push({ k: 'orb', x: P.x, y: P.y + 10, vx: 0, vy: 0, r: 2, t: 0 }); SH.updateEShots(); P.inv = 0; return ((G.xp + G.lvl * 1000 - x0).toFixed(2)) + 'xp/' + (G.score - s0); };
  row('graze', grazeT(0), grazeT(2));
  // magnet: a pod 100px away, distance after 30 cap updates
  const magT = (lvl) => { set({ magnet: lvl }); clear(); holdStill(); G.scrollSpeed = 0; W.caps.push({ x: P.x + 100, y: P.y, t: 0, ty: 0 }); for (let i = 0; i < 30; i++) SH.updateCaps(); const c = W.caps[0]; return c ? Math.round(Math.hypot(c.x - P.x, c.y - P.y)) : 'grabbed'; };
  row('magnet (pod dist after 30f)', magT(0), magT(2));
  // greed: bio from one orb
  const greedT = (lvl) => { set({ greed: lvl }); clear(); holdStill(); const b0 = G.bio; W.orbs.push({ x: P.x, y: P.y, vx: 0, vy: 0, v: 10, l: 600, t: 20 }); FX.updateFX && FX.updateFX(); return +(G.bio - b0).toFixed(2); };
  row('greed (bio from 10-orb)', greedT(0), greedT(2), typeof FX.updateFX);
  // spd
  // biome perks: hit a high-hp drone once
  const hitT = (o) => { set(o); clear(); holdStill(); const e = SP.mk('drone', 200, 100); e.hp = e.max = 100; W.shots.push({ k: 'bolt', x: 199, y: 100, vx: 0, vy: 0, dmg: 1, r: 2, pierce: 0, t: 0 }); SH.updateShots(); const h1 = e.hp, c1 = e.chill || 0; for (let i = 0; i < 200; i++) { e.x = 200; e.y = 100; SH.updateEnemies(); } return { chill: c1, acid: e.acid || 0, burn: e.burn || 0, dot: +(h1 - e.hp).toFixed(2) }; };
  { const a = hitT({}), b = hitT({ frost: 2 }); row('frost (chill frames per hit)', a.chill + '', b.chill + ' (L2)'); }
  { const a = hitT({}), b = hitT({ corrode: 1 }), c = hitT({ corrode: 2 }); row('corrode (DoT over 200f)', a.dot, b.dot + ' / L2 ' + c.dot); }
  { const a = hitT({}), b = hitT({ ignite: 1 }), c = hitT({ ignite: 2 }); row('ignite (DoT over 200f)', a.dot, b.dot + ' / L2 ' + c.dot); }
  // life
  { G.pick = { opts: ['life'], sel: 0, t: 99 }; const l0 = G.lives; PK.take('life'); row('life', l0, G.lives); }
  // real fire rate: shots per 600 frames of held fire
  const IN = await import('/src/input.ts');
  const rate = (o) => { set(o); holdStill(); P.cd = 0; let n = 0; for (let i = 0; i < 600; i++) { W.shots.length = 0; IN.I.fire = true; P.alive = true; PL.updatePlayer(); n += W.shots.filter((s) => s.k === 'bolt' && !s.glob).length; } IN.I.fire = false; return n; };
  row('rof (bolts/600f) L1 / L3', rate({}), rate({ rof: 1 }) + ' / ' + rate({ rof: 3 }));
  // glass
  { set({}); const a = fire1()[0].dmg; set({ glass: 1 }); const b = fire1()[0].dmg; P.shield = 3; PL.updatePlayer(); row('glass (dmg, shield 3->)', a.toFixed(2), b.toFixed(2) + ', shield ' + P.shield); P.shield = 0; }
  // teeth: a drone parked on the orbit for 120 frames
  const teethT = (lvl) => { set({ teeth: lvl }); clear(); holdStill(); const e = SP.mk('drone', 0, 0); e.hp = e.max = 50; for (let i = 0; i < 120; i++) { G.t++; const tp = PK.teethPos(); e.x = P.x + 24; e.y = P.y; PK.perkTick(EU.hurt); } return +(50 - e.hp).toFixed(2); };
  row('teeth (dmg to parked drone /2s)', teethT(0), teethT(1) + ' / L2 ' + teethT(2));
  // trail: kill spills a slick; a drone sitting in it bleeds
  const trailT = (lvl) => { set({ trail: lvl }); clear(); PK.perkFX.slicks.length = 0; holdStill(); G.scrollSpeed = 0; const k = SP.mk('drone', 300, 100); EU.killEnemy(k); const e = SP.mk('drone', 300, 100); e.hp = e.max = 50; for (let i = 0; i < 120; i++) { G.t++; e.x = 300; e.y = 100; PK.perkTick(EU.hurt); } return PK.perkFX.slicks.length + ' slick, ' + (50 - e.hp).toFixed(2) + ' dmg'; };
  row('trail (slicks, dmg /2s)', trailT(0), trailT(1) + ' / L2 ' + trailT(2));
  // shard: a WARD hit spits rib shards
  const shardT = (lvl) => { set({ shard: lvl }); clear(); holdStill(); P.shield = 1; PL.playerHit(); P.inv = 0; return W.shots.filter((s) => s.rib).length; };
  row('shard (ribs per WARD hit)', shardT(0), shardT(1) + ' / L2 ' + shardT(2));
  // gasp: first lethal hit eaten, second kills
  { set({ gasp: 1 }); clear(); holdStill(); G.gasp = -1; const l0 = G.lives; const r1 = PL.playerHit(), a1 = P.alive, inv = P.inv; P.inv = 0; const r2 = PL.playerHit(), a2 = P.alive; P.alive = true; G.deadT = 0; G.lives = l0; G.hitstop = 0;
    row('gasp (hit1 alive/inv, hit2 alive)', 'dies', `${a1}/${inv}, ${a2}`); }
  // tape: -1 ship, +50% xp
  { set({}); G.pick = { opts: ['tape'], sel: 0, t: 99 }; const l0 = G.lives; PK.take('tape'); const x0 = G.xpTot; PK.gainXP(10); row('tape (lives, xp from 10)', l0 + ', 10', G.lives + ', ' + (G.xpTot - x0)); G.lives = l0; }
  set({}); clear(); G.pickQ = 0; G.pick = null; G.xp = -1e6;
  return out;
});
// spd + snot need real steps
const step = async (n) => p.evaluate((n) => __tick(n), n);
const spd = async (lvl) => { await p.evaluate((l) => { const { G, P } = __G(); G.pk = { spd: l }; P.x = 60; P.y = 120; P.slow = 0; }, lvl); await key('keydown', 'ArrowRight'); await step(20); await key('keyup', 'ArrowRight'); return p.evaluate(() => Math.round(__G().P.x - 60) + ' ' + __G().state + ' ' + __G().P.alive); };
res.push({ id: 'spd (px in 20f)', base: await spd(0), with: await spd(3) });
res.at(-1).ok = res.at(-1).base !== res.at(-1).with;
const snot = async (lvl) => p.evaluate(async (l) => { const W = await import('/src/world.ts'); const { G } = __G(); G.pk = { snot: l }; G.pick = null; G.pickQ = 0; let n = 0; for (let i = 0; i < 600; i++) { __G().P.alive = true; __G().P.inv = 99; window.__tick(1); n += W.shots.filter((s) => s.glob && s.t === undefined || s.glob && !s.__c && (s.__c = 1)).length; } return n; }, lvl);
res.push({ id: 'snot (globs in 600f)', base: await snot(0), with: await snot(2) });
res.at(-1).ok = res.at(-1).with > res.at(-1).base;
for (const r of res) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.id.padEnd(34)} ${String(r.base).padEnd(12)} -> ${r.with} ${r.note || ''}`);
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
